import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import {
  SubscriptionRecord,
  SubscriptionStatus,
} from '../common/types/shared';
import { AppLoggerService } from '../common/logger/app-logger.service';
import { SupabaseService } from '../supabase/supabase.service';

interface StripeSubscriptionUpsertInput {
  userId: string;
  status: SubscriptionStatus;
  plan: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

@Injectable()
export class SubscriptionService {
  private readonly memoryStore = new Map<string, SubscriptionRecord>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  private getStripeClient(): Stripe | null {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return null;
    }
    return new Stripe(secret);
  }

  private resolveStatus(status: string): SubscriptionStatus {
    if (
      status === 'trialing' ||
      status === 'active' ||
      status === 'past_due' ||
      status === 'canceled' ||
      status === 'incomplete'
    ) {
      return status;
    }
    return 'incomplete';
  }

  private isStripeMissingResourceError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const stripeErr = error as Error & { code?: string; type?: string };
    return (
      stripeErr.code === 'resource_missing' ||
      stripeErr.type === 'StripeInvalidRequestError'
    );
  }

  private toRecord(row: {
    user_id: string;
    plan: string;
    status: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean | null;
  }): SubscriptionRecord {
    return {
      userId: row.user_id,
      plan: row.plan,
      status: row.status as SubscriptionStatus,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    };
  }

  private async downgradeMissingStripeResource(record: SubscriptionRecord) {
    const downgraded: SubscriptionRecord = {
      userId: record.userId,
      plan: 'free',
      status: 'canceled',
      stripeCustomerId: undefined,
      stripeSubscriptionId: undefined,
      currentPeriodEnd: undefined,
      cancelAtPeriodEnd: false,
    };
    this.memoryStore.set(record.userId, downgraded);
    if (this.supabaseService.isConfigured()) {
      await this.supabaseService.upsertSubscription(downgraded);
    }
    return downgraded;
  }

  private toRecordFromStripeSubscription(
    record: SubscriptionRecord,
    subscription: Stripe.Subscription,
  ): SubscriptionRecord {
    return {
      userId: record.userId,
      plan:
        subscription.items.data[0]?.price?.id ??
        subscription.items.data[0]?.plan?.id ??
        record.plan,
      status: this.resolveStatus(subscription.status),
      stripeCustomerId: String(subscription.customer || record.stripeCustomerId || ''),
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : record.currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    };
  }

  private async upsertIfChanged(
    prev: SubscriptionRecord,
    next: SubscriptionRecord,
  ): Promise<SubscriptionRecord> {
    const changed =
      next.plan !== prev.plan ||
      next.status !== prev.status ||
      next.stripeCustomerId !== prev.stripeCustomerId ||
      next.stripeSubscriptionId !== prev.stripeSubscriptionId ||
      next.currentPeriodEnd !== prev.currentPeriodEnd ||
      next.cancelAtPeriodEnd !== prev.cancelAtPeriodEnd;
    if (!changed) return prev;

    this.memoryStore.set(prev.userId, next);
    if (this.supabaseService.isConfigured()) {
      await this.supabaseService.upsertSubscription(next);
    }
    return next;
  }

  private async findLatestSubscriptionByCustomer(
    stripe: Stripe,
    customerId: string,
  ): Promise<Stripe.Subscription | null> {
    const listed = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20,
    });
    if (!listed.data.length) return null;

    const activeLike = listed.data.find((item) =>
      ['trialing', 'active', 'past_due', 'incomplete'].includes(item.status),
    );
    return activeLike ?? listed.data[0];
  }

  private async findLatestSubscriptionByUserId(
    stripe: Stripe,
    userId: string,
  ): Promise<Stripe.Subscription | null> {
    const escapedUserId = userId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    try {
      const result = await stripe.subscriptions.search({
        query: `metadata['userId']:'${escapedUserId}'`,
        limit: 20,
      });
      if (!result.data.length) return null;
      const activeLike = result.data.find((item) =>
        ['trialing', 'active', 'past_due', 'incomplete'].includes(item.status),
      );
      return activeLike ?? result.data[0];
    } catch (error) {
      this.logger.warn(
        `Stripe subscriptions.search failed for user ${userId}: ${(error as Error).message}`,
        'SubscriptionService',
      );
      return null;
    }
  }

  private async findLatestSubscriptionViaCheckoutSession(
    stripe: Stripe,
    userId: string,
  ): Promise<Stripe.Subscription | null> {
    try {
      const sessions = await stripe.checkout.sessions.list({
        limit: 100,
      });
      const matched = sessions.data
        .filter(
          (item) =>
            item.client_reference_id === userId &&
            item.status === 'complete' &&
            Boolean(item.subscription),
        )
        .sort((a, b) => b.created - a.created);

      const latest = matched[0];
      if (!latest?.subscription) return null;

      return stripe.subscriptions.retrieve(String(latest.subscription));
    } catch (error) {
      this.logger.warn(
        `Stripe checkout-session fallback failed for user ${userId}: ${(error as Error).message}`,
        'SubscriptionService',
      );
      return null;
    }
  }

  private async verifyWithStripe(record: SubscriptionRecord) {
    const stripe = this.getStripeClient();
    if (!stripe) return record;

    const needsVerification =
      ['trialing', 'active', 'past_due', 'canceled', 'incomplete'].includes(
        record.status,
      ) && Boolean(record.stripeSubscriptionId || record.stripeCustomerId);
    if (!needsVerification) {
      const byUserId = await this.findLatestSubscriptionByUserId(stripe, record.userId);
      const byCheckout =
        byUserId ?? (await this.findLatestSubscriptionViaCheckoutSession(stripe, record.userId));
      if (!byCheckout) return record;
      const nextRecord = this.toRecordFromStripeSubscription(record, byCheckout);
      return this.upsertIfChanged(record, nextRecord);
    }

    try {
      if (record.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(
          record.stripeSubscriptionId,
        );
        let nextRecord = this.toRecordFromStripeSubscription(record, subscription);

        if (
          ['canceled', 'incomplete'].includes(nextRecord.status) &&
          nextRecord.stripeCustomerId
        ) {
          const latest = await this.findLatestSubscriptionByCustomer(
            stripe,
            nextRecord.stripeCustomerId,
          );
          if (
            latest &&
            latest.id !== nextRecord.stripeSubscriptionId &&
            ['trialing', 'active', 'past_due', 'incomplete'].includes(
              latest.status,
            )
          ) {
            nextRecord = this.toRecordFromStripeSubscription(record, latest);
          }
        }

        if (['canceled', 'incomplete'].includes(nextRecord.status)) {
          const byCheckout = await this.findLatestSubscriptionViaCheckoutSession(
            stripe,
            record.userId,
          );
          if (
            byCheckout &&
            byCheckout.id !== nextRecord.stripeSubscriptionId &&
            ['trialing', 'active', 'past_due', 'incomplete'].includes(
              byCheckout.status,
            )
          ) {
            nextRecord = this.toRecordFromStripeSubscription(record, byCheckout);
          }
        }

        return this.upsertIfChanged(record, nextRecord);
      }

      if (record.stripeCustomerId) {
        const latest = await this.findLatestSubscriptionByCustomer(
          stripe,
          record.stripeCustomerId,
        );
        if (!latest) {
          return this.upsertIfChanged(record, {
            ...record,
            status: 'canceled',
            plan: record.plan || 'free',
          });
        }
        const nextRecord = this.toRecordFromStripeSubscription(record, latest);
        return this.upsertIfChanged(record, nextRecord);
      }

      const byCheckout = await this.findLatestSubscriptionViaCheckoutSession(
        stripe,
        record.userId,
      );
      if (byCheckout) {
        const nextRecord = this.toRecordFromStripeSubscription(record, byCheckout);
        return this.upsertIfChanged(record, nextRecord);
      }
      return record;
    } catch (error) {
      if (this.isStripeMissingResourceError(error)) {
        this.logger.warn(
          `Stripe resource missing for user ${record.userId}, downgrading local subscription state.`,
          'SubscriptionService',
        );
        return this.downgradeMissingStripeResource(record);
      }

      this.logger.warn(
        `Stripe verification failed for user ${record.userId}: ${(error as Error).message}`,
        'SubscriptionService',
      );
      return record;
    }
  }

  private toDefault(userId: string): SubscriptionRecord {
    return {
      userId,
      plan: 'free',
      status: 'incomplete',
      cancelAtPeriodEnd: false,
    };
  }

  async getSubscription(userId: string): Promise<SubscriptionRecord> {
    if (!this.supabaseService.isConfigured()) {
      return this.memoryStore.get(userId) ?? this.toDefault(userId);
    }

    const row = await this.supabaseService.getSubscriptionByUserId(userId);
    if (!row) return this.toDefault(userId);
    const record = this.toRecord(row);
    return this.verifyWithStripe(record);
  }

  async findUserIdByCustomerId(customerId: string): Promise<string | null> {
    for (const [, value] of this.memoryStore.entries()) {
      if (value.stripeCustomerId === customerId) {
        return value.userId;
      }
    }
    if (!this.supabaseService.isConfigured()) return null;
    const row = await this.supabaseService.getSubscriptionByCustomerId(customerId);
    return row?.user_id ?? null;
  }

  async upsertFromStripe(input: StripeSubscriptionUpsertInput) {
    const nextRecord: SubscriptionRecord = {
      userId: input.userId,
      status: input.status,
      plan: input.plan,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    };
    this.memoryStore.set(input.userId, nextRecord);

    if (!this.supabaseService.isConfigured()) {
      return nextRecord;
    }

    await this.supabaseService.upsertSubscription(nextRecord);
    return nextRecord;
  }

  async cancelAutoRenew(userId: string): Promise<SubscriptionRecord> {
    const record = await this.getSubscription(userId);

    if (!['trialing', 'active', 'past_due'].includes(record.status)) {
      throw new BadRequestException(
        'No renewable subscription found. Only trialing/active/past_due plans can disable auto-renew.',
      );
    }

    if (record.cancelAtPeriodEnd) {
      return record;
    }

    if (!record.stripeSubscriptionId) {
      throw new BadRequestException(
        'Unable to cancel auto-renew because Stripe subscription id is missing.',
      );
    }

    const stripe = this.getStripeClient();
    if (!stripe) {
      throw new BadRequestException('Stripe is not configured.');
    }

    try {
      const updated = await stripe.subscriptions.update(record.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      const nextRecord = this.toRecordFromStripeSubscription(record, updated);
      return this.upsertIfChanged(record, nextRecord);
    } catch (error) {
      if (this.isStripeMissingResourceError(error)) {
        return this.downgradeMissingStripeResource(record);
      }
      throw new BadRequestException(
        `Failed to disable auto-renew: ${(error as Error).message}`,
      );
    }
  }
}

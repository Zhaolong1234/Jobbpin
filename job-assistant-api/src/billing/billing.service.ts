import { BadRequestException, Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { AppLoggerService } from '../common/logger/app-logger.service';
import { SubscriptionStatus } from '../common/types/shared';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

type BillingCycle = 'weekly' | 'monthly' | 'yearly';

@Injectable()
export class BillingService {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: AppLoggerService,
  ) {}

  private getStripeClient() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new BadRequestException('STRIPE_SECRET_KEY is missing');
    }
    return new Stripe(secret);
  }

  private getConfiguredPriceId(cycle: BillingCycle): string {
    const envMap: Record<BillingCycle, string | undefined> = {
      weekly: process.env.STRIPE_WEEKLY_PRICE_ID,
      monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_YEARLY_PRICE_ID,
    };
    const priceId = envMap[cycle];
    if (!priceId) {
      throw new BadRequestException(`Missing Stripe price id for ${cycle} plan.`);
    }
    return priceId;
  }

  private resolveCycleFromRequest(dto: CreateCheckoutSessionDto): BillingCycle {
    if (dto.billingCycle) {
      return dto.billingCycle;
    }

    const weekly = process.env.STRIPE_WEEKLY_PRICE_ID;
    const monthly = process.env.STRIPE_MONTHLY_PRICE_ID;
    const yearly = process.env.STRIPE_YEARLY_PRICE_ID;
    if (dto.priceId && weekly && dto.priceId === weekly) return 'weekly';
    if (dto.priceId && monthly && dto.priceId === monthly) return 'monthly';
    if (dto.priceId && yearly && dto.priceId === yearly) return 'yearly';

    if (dto.trialDays && dto.trialDays > 0) {
      return 'weekly';
    }

    throw new BadRequestException(
      'Unable to resolve billing cycle. Send billingCycle or a known priceId.',
    );
  }

  async createCheckoutSession(dto: CreateCheckoutSessionDto) {
    const stripe = this.getStripeClient();
    const billingCycle = this.resolveCycleFromRequest(dto);
    const configuredPriceId = this.getConfiguredPriceId(billingCycle);
    const existing = await this.subscriptionService.getSubscription(dto.userId);
    let customerId = existing.stripeCustomerId;

    if (dto.priceId && dto.priceId !== configuredPriceId) {
      throw new BadRequestException(
        `Price mismatch for ${billingCycle} plan. Use backend configured price.`,
      );
    }

    const trialRequested = Boolean(dto.trialDays && dto.trialDays > 0);
    if (trialRequested) {
      if (billingCycle !== 'weekly') {
        throw new BadRequestException('Trial is only available for the weekly plan.');
      }

      const hasSubscribedBefore =
        Boolean(existing.stripeSubscriptionId) ||
        Boolean(existing.stripeCustomerId) ||
        ['trialing', 'active', 'past_due', 'canceled'].includes(existing.status);

      if (hasSubscribedBefore) {
        throw new BadRequestException(
          'Trial not available for users who already subscribed before.',
        );
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { userId: dto.userId },
      });
      customerId = customer.id;
    }

    await this.subscriptionService.upsertFromStripe({
      userId: dto.userId,
      status: 'incomplete',
      plan: configuredPriceId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: undefined,
      currentPeriodEnd: undefined,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: dto.successUrl,
      cancel_url: dto.cancelUrl,
      line_items: [
        {
          price: configuredPriceId,
          quantity: 1,
        },
      ],
      customer: customerId,
      subscription_data: {
        ...(dto.trialDays && dto.trialDays > 0
          ? {
              trial_period_days: dto.trialDays,
            }
          : {}),
        metadata: { userId: dto.userId },
      },
      client_reference_id: dto.userId,
      metadata: {
        userId: dto.userId,
      },
    });
    if (!session.url) {
      throw new BadRequestException('Checkout URL was not returned by Stripe.');
    }
    return { url: session.url };
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

  private async syncStripeSubscription(
    userId: string,
    stripeSubscription: Stripe.Subscription,
  ) {
    const itemPeriodEnds = stripeSubscription.items.data
      .map((item) => item.current_period_end)
      .filter((value): value is number => typeof value === 'number' && value > 0);
    const currentPeriodEndUnixFromItems =
      itemPeriodEnds.length > 0 ? Math.max(...itemPeriodEnds) : undefined;
    const currentPeriodEndUnixLegacy = (
      stripeSubscription as unknown as { current_period_end?: number }
    ).current_period_end;
    const currentPeriodEndUnix =
      currentPeriodEndUnixFromItems ?? currentPeriodEndUnixLegacy;

    if (!currentPeriodEndUnix) {
      this.logger.warn(
        `Missing current period end for subscription ${stripeSubscription.id}`,
        'BillingService',
      );
    }

    await this.subscriptionService.upsertFromStripe({
      userId,
      status: this.resolveStatus(stripeSubscription.status),
      plan:
        stripeSubscription.items.data[0]?.price?.id ??
        stripeSubscription.items.data[0]?.plan?.id ??
        'unknown_plan',
      stripeCustomerId: String(stripeSubscription.customer || ''),
      stripeSubscriptionId: stripeSubscription.id,
      currentPeriodEnd: currentPeriodEndUnix
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : undefined,
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is missing');
    }
    if (!signature) {
      throw new BadRequestException('Stripe signature header is missing');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException(
        `Invalid Stripe signature: ${(error as Error).message}`,
      );
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const sessionUserId =
          session.metadata?.userId || session.client_reference_id || undefined;
        if (!session.subscription || !sessionUserId) {
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(
          String(session.subscription),
        );
        await this.syncStripeSubscription(sessionUserId, subscription);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        let userId: string | undefined = subscription.metadata?.userId || undefined;
        if (!userId && subscription.customer) {
          const foundUserId = await this.subscriptionService.findUserIdByCustomerId(
            String(subscription.customer),
          );
          userId = foundUserId ?? undefined;
        }
        if (userId) {
          await this.syncStripeSubscription(userId, subscription);
        } else {
          this.logger.warn(
            `Unable to resolve userId for subscription event ${subscription.id}`,
            'BillingService',
          );
        }
        break;
      }

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`, 'BillingService');
    }

    return { received: true };
  }
}

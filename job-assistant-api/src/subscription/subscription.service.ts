import { Injectable } from '@nestjs/common';

import {
  SubscriptionRecord,
  SubscriptionStatus,
} from '../common/types/shared';
import { SupabaseService } from '../supabase/supabase.service';

interface StripeSubscriptionUpsertInput {
  userId: string;
  status: SubscriptionStatus;
  plan: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
}

@Injectable()
export class SubscriptionService {
  private readonly memoryStore = new Map<string, SubscriptionRecord>();

  constructor(private readonly supabaseService: SupabaseService) {}

  private toDefault(userId: string): SubscriptionRecord {
    return {
      userId,
      plan: 'free',
      status: 'incomplete',
    };
  }

  async getSubscription(userId: string): Promise<SubscriptionRecord> {
    if (!this.supabaseService.isConfigured()) {
      return this.memoryStore.get(userId) ?? this.toDefault(userId);
    }

    const row = await this.supabaseService.getSubscriptionByUserId(userId);
    if (!row) return this.toDefault(userId);
    return {
      userId: row.user_id,
      plan: row.plan,
      status: row.status as SubscriptionStatus,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      currentPeriodEnd: row.current_period_end,
    };
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
    };
    this.memoryStore.set(input.userId, nextRecord);

    if (!this.supabaseService.isConfigured()) {
      return nextRecord;
    }

    await this.supabaseService.upsertSubscription(nextRecord);
    return nextRecord;
  }
}

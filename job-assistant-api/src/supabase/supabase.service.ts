import { Injectable } from '@nestjs/common';

import { AppLoggerService } from '../common/logger/app-logger.service';
import { ResumeParsed, SubscriptionRecord } from '../common/types/shared';

interface ResumeRow {
  id: string;
  user_id: string;
  parsed_json: ResumeParsed;
  created_at: string;
}

interface SubscriptionRow {
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string;
}

@Injectable()
export class SupabaseService {
  constructor(private readonly logger: AppLoggerService) {}

  private get baseUrl(): string | undefined {
    return process.env.SUPABASE_URL?.replace(/\/$/, '');
  }

  private get serviceRoleKey(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.serviceRoleKey);
  }

  private isJwtLike(value: string): boolean {
    return value.startsWith('eyJ') && value.split('.').length === 3;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.baseUrl || !this.serviceRoleKey) {
      throw new Error('Supabase is not configured');
    }
    const headers = new Headers(init?.headers);
    headers.set('apikey', this.serviceRoleKey);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    // Supabase new secret keys (sb_secret_*) are not JWTs.
    // Only set Authorization when using legacy JWT-style service_role keys.
    if (this.isJwtLike(this.serviceRoleKey) && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.serviceRoleKey}`);
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      const trimmedError = errorText.slice(0, 240);
      this.logger.error(
        `Supabase request failed: ${res.status} ${trimmedError}`,
        undefined,
        'SupabaseService',
      );
      throw new Error(
        `Supabase request failed (${res.status}): ${trimmedError || res.statusText}`,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  async insertResume(userId: string, parsed: ResumeParsed) {
    const payload = [
      {
        user_id: userId,
        parsed_json: parsed,
      },
    ];
    const rows = await this.request<ResumeRow[]>(
      '/rest/v1/resumes?select=id,user_id,parsed_json,created_at',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      },
    );
    return rows[0] ?? null;
  }

  async getLatestResume(userId: string) {
    const queryUserId = encodeURIComponent(userId);
    const rows = await this.request<ResumeRow[]>(
      `/rest/v1/resumes?user_id=eq.${queryUserId}&order=created_at.desc&limit=1&select=id,user_id,parsed_json,created_at`,
    );
    return rows[0] ?? null;
  }

  async upsertSubscription(record: SubscriptionRecord) {
    const payload = [
      {
        user_id: record.userId,
        plan: record.plan,
        status: record.status,
        stripe_customer_id: record.stripeCustomerId,
        stripe_subscription_id: record.stripeSubscriptionId,
        current_period_end: record.currentPeriodEnd ?? null,
      },
    ];
    const rows = await this.request<SubscriptionRow[]>(
      '/rest/v1/subscriptions?on_conflict=user_id&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end',
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      },
    );
    return rows[0] ?? null;
  }

  async getSubscriptionByUserId(userId: string) {
    const queryUserId = encodeURIComponent(userId);
    const rows = await this.request<SubscriptionRow[]>(
      `/rest/v1/subscriptions?user_id=eq.${queryUserId}&limit=1&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end`,
    );
    return rows[0] ?? null;
  }

  async getSubscriptionByCustomerId(customerId: string) {
    const encodedCustomer = encodeURIComponent(customerId);
    const rows = await this.request<SubscriptionRow[]>(
      `/rest/v1/subscriptions?stripe_customer_id=eq.${encodedCustomer}&limit=1&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end`,
    );
    return rows[0] ?? null;
  }
}

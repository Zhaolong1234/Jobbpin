import { Injectable } from '@nestjs/common';

import { AppLoggerService } from '../common/logger/app-logger.service';
import {
  OnboardingStateRecord,
  ProfileRecord,
  ResumeParsed,
  SubscriptionRecord,
  UserRecord,
} from '../common/types/shared';

interface ResumeRow {
  id: string;
  user_id: string;
  parsed_json: ResumeParsed;
  created_at: string;
  template_id?: string | null;
}

interface SubscriptionRow {
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean | null;
}

interface ProfileRow {
  user_id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  target_role?: string | null;
  years_exp?: string | null;
  country?: string | null;
  city?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  allow_linkedin_analysis?: boolean | null;
  employment_types?: string[] | null;
  profile_skipped?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

interface OnboardingStateRow {
  user_id: string;
  current_step: number;
  is_completed: boolean;
  profile_skipped?: boolean;
  updated_at?: string;
}

interface UserRow {
  clerk_user_id: string;
  email?: string | null;
  onboarding_completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class SupabaseService {
  constructor(private readonly logger: AppLoggerService) {}

  private isMissingColumnError(
    error: unknown,
    tableName: string,
    columnName: string,
  ): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    const table = tableName.toLowerCase();
    const column = columnName.toLowerCase();
    const qualified = `${table}.${column}`;
    return (
      (message.includes('42703') || message.includes('does not exist')) &&
      message.includes(table) &&
      (message.includes(column) || message.includes(qualified))
    );
  }

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

  async insertResume(
    userId: string,
    parsed: ResumeParsed,
    templateId?: string,
  ) {
    const payload = [
      {
        user_id: userId,
        parsed_json: parsed,
        template_id: templateId ?? null,
      },
    ];
    try {
      const rows = await this.request<ResumeRow[]>(
        '/rest/v1/resumes?select=id,user_id,parsed_json,created_at,template_id',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify(payload),
        },
      );
      return rows[0] ?? null;
    } catch (error) {
      if (!this.isMissingColumnError(error, 'resumes', 'template_id')) {
        throw error;
      }
      this.logger.warn(
        'resumes.template_id is missing. Falling back to legacy resume insert.',
        'SupabaseService',
      );
      const legacyRows = await this.request<ResumeRow[]>(
        '/rest/v1/resumes?select=id,user_id,parsed_json,created_at',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify([
            {
              user_id: userId,
              parsed_json: parsed,
            },
          ]),
        },
      );
      return legacyRows[0] ?? null;
    }
  }

  async getLatestResume(userId: string) {
    const queryUserId = encodeURIComponent(userId);
    try {
      const rows = await this.request<ResumeRow[]>(
        `/rest/v1/resumes?user_id=eq.${queryUserId}&order=created_at.desc&limit=1&select=id,user_id,parsed_json,created_at,template_id`,
      );
      return rows[0] ?? null;
    } catch (error) {
      if (!this.isMissingColumnError(error, 'resumes', 'template_id')) {
        throw error;
      }
      const rows = await this.request<ResumeRow[]>(
        `/rest/v1/resumes?user_id=eq.${queryUserId}&order=created_at.desc&limit=1&select=id,user_id,parsed_json,created_at`,
      );
      return rows[0] ?? null;
    }
  }

  async getResumeById(userId: string, resumeId: string) {
    const queryUserId = encodeURIComponent(userId);
    const queryResumeId = encodeURIComponent(resumeId);
    try {
      const rows = await this.request<ResumeRow[]>(
        `/rest/v1/resumes?user_id=eq.${queryUserId}&id=eq.${queryResumeId}&limit=1&select=id,user_id,parsed_json,created_at,template_id`,
      );
      return rows[0] ?? null;
    } catch (error) {
      if (!this.isMissingColumnError(error, 'resumes', 'template_id')) {
        throw error;
      }
      const rows = await this.request<ResumeRow[]>(
        `/rest/v1/resumes?user_id=eq.${queryUserId}&id=eq.${queryResumeId}&limit=1&select=id,user_id,parsed_json,created_at`,
      );
      return rows[0] ?? null;
    }
  }

  async getResumeHistory(userId: string, limit = 2) {
    const queryUserId = encodeURIComponent(userId);
    const safeLimit = Math.max(1, Math.min(limit, 20));
    try {
      return await this.request<ResumeRow[]>(
        `/rest/v1/resumes?user_id=eq.${queryUserId}&order=created_at.desc&limit=${safeLimit}&select=id,user_id,parsed_json,created_at,template_id`,
      );
    } catch (error) {
      if (!this.isMissingColumnError(error, 'resumes', 'template_id')) {
        throw error;
      }
      return this.request<ResumeRow[]>(
        `/rest/v1/resumes?user_id=eq.${queryUserId}&order=created_at.desc&limit=${safeLimit}&select=id,user_id,parsed_json,created_at`,
      );
    }
  }

  async deleteResumeById(userId: string, resumeId: string): Promise<boolean> {
    const queryUserId = encodeURIComponent(userId);
    const queryResumeId = encodeURIComponent(resumeId);
    const rows = await this.request<Array<{ id: string }>>(
      `/rest/v1/resumes?id=eq.${queryResumeId}&user_id=eq.${queryUserId}&select=id`,
      {
        method: 'DELETE',
        headers: {
          Prefer: 'return=representation',
        },
      },
    );
    return rows.length > 0;
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
        cancel_at_period_end: record.cancelAtPeriodEnd ?? false,
      },
    ];
    try {
      const rows = await this.request<SubscriptionRow[]>(
        '/rest/v1/subscriptions?on_conflict=user_id&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,cancel_at_period_end',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        },
      );
      return rows[0] ?? null;
    } catch (error) {
      if (!this.isMissingColumnError(error, 'subscriptions', 'cancel_at_period_end')) {
        throw error;
      }
      this.logger.warn(
        'subscriptions.cancel_at_period_end is missing. Falling back to legacy subscription upsert.',
        'SupabaseService',
      );
      const legacyPayload = [
        {
          user_id: record.userId,
          plan: record.plan,
          status: record.status,
          stripe_customer_id: record.stripeCustomerId,
          stripe_subscription_id: record.stripeSubscriptionId,
          current_period_end: record.currentPeriodEnd ?? null,
        },
      ];
      const legacyRows = await this.request<SubscriptionRow[]>(
        '/rest/v1/subscriptions?on_conflict=user_id&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(legacyPayload),
        },
      );
      return legacyRows[0] ?? null;
    }
  }

  async getSubscriptionByUserId(userId: string) {
    const queryUserId = encodeURIComponent(userId);
    try {
      const rows = await this.request<SubscriptionRow[]>(
        `/rest/v1/subscriptions?user_id=eq.${queryUserId}&limit=1&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,cancel_at_period_end`,
      );
      return rows[0] ?? null;
    } catch (error) {
      if (!this.isMissingColumnError(error, 'subscriptions', 'cancel_at_period_end')) {
        throw error;
      }
      const rows = await this.request<SubscriptionRow[]>(
        `/rest/v1/subscriptions?user_id=eq.${queryUserId}&limit=1&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end`,
      );
      return rows[0] ?? null;
    }
  }

  async getSubscriptionByCustomerId(customerId: string) {
    const encodedCustomer = encodeURIComponent(customerId);
    try {
      const rows = await this.request<SubscriptionRow[]>(
        `/rest/v1/subscriptions?stripe_customer_id=eq.${encodedCustomer}&limit=1&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,cancel_at_period_end`,
      );
      return rows[0] ?? null;
    } catch (error) {
      if (!this.isMissingColumnError(error, 'subscriptions', 'cancel_at_period_end')) {
        throw error;
      }
      const rows = await this.request<SubscriptionRow[]>(
        `/rest/v1/subscriptions?stripe_customer_id=eq.${encodedCustomer}&limit=1&select=user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end`,
      );
      return rows[0] ?? null;
    }
  }

  async getProfileByUserId(userId: string) {
    const queryUserId = encodeURIComponent(userId);
    let rows: ProfileRow[] = [];
    try {
      rows = await this.request<ProfileRow[]>(
        `/rest/v1/profiles?user_id=eq.${queryUserId}&limit=1&select=user_id,name,first_name,last_name,target_role,years_exp,country,city,linkedin_url,portfolio_url,allow_linkedin_analysis,employment_types,profile_skipped,created_at,updated_at`,
      );
    } catch (error) {
      // Backward compatibility for legacy profiles schema.
      const legacyColumns = [
        'first_name',
        'last_name',
        'country',
        'linkedin_url',
        'portfolio_url',
        'allow_linkedin_analysis',
        'employment_types',
        'profile_skipped',
      ];
      const isLegacySchemaError = legacyColumns.some((column) =>
        this.isMissingColumnError(error, 'profiles', column),
      );
      if (!isLegacySchemaError) {
        throw error;
      }
      this.logger.warn(
        'Legacy profiles schema detected. Falling back to minimal profile select.',
        'SupabaseService',
      );
      rows = await this.request<ProfileRow[]>(
        `/rest/v1/profiles?user_id=eq.${queryUserId}&limit=1&select=user_id,name,target_role,years_exp,city,created_at,updated_at`,
      );
    }
    const row = rows[0];
    if (!row) return null;
    const firstName = row.first_name ?? '';
    const lastName = row.last_name ?? '';
    const fullName = row.name ?? `${firstName} ${lastName}`.trim();
    return {
      userId: row.user_id,
      name: fullName,
      firstName,
      lastName,
      targetRole: row.target_role ?? '',
      yearsExp: row.years_exp ?? '',
      country: row.country ?? '',
      city: row.city ?? '',
      linkedinUrl: row.linkedin_url ?? '',
      portfolioUrl: row.portfolio_url ?? '',
      allowLinkedinAnalysis: Boolean(row.allow_linkedin_analysis),
      employmentTypes: row.employment_types ?? [],
      profileSkipped: Boolean(row.profile_skipped),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies ProfileRecord;
  }

  async upsertProfile(record: ProfileRecord) {
    const payload = [
      {
        user_id: record.userId,
        name: record.name,
        first_name: record.firstName,
        last_name: record.lastName,
        target_role: record.targetRole,
        years_exp: record.yearsExp,
        country: record.country,
        city: record.city,
        linkedin_url: record.linkedinUrl || null,
        portfolio_url: record.portfolioUrl || null,
        allow_linkedin_analysis: record.allowLinkedinAnalysis,
        employment_types: record.employmentTypes,
        profile_skipped: record.profileSkipped,
      },
    ];
    let rows: ProfileRow[] = [];
    try {
      rows = await this.request<ProfileRow[]>(
        '/rest/v1/profiles?on_conflict=user_id&select=user_id,name,first_name,last_name,target_role,years_exp,country,city,linkedin_url,portfolio_url,allow_linkedin_analysis,employment_types,profile_skipped,created_at,updated_at',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        },
      );
    } catch (error) {
      const legacyColumns = [
        'first_name',
        'last_name',
        'country',
        'linkedin_url',
        'portfolio_url',
        'allow_linkedin_analysis',
        'employment_types',
        'profile_skipped',
      ];
      const isLegacySchemaError = legacyColumns.some((column) =>
        this.isMissingColumnError(error, 'profiles', column),
      );
      if (!isLegacySchemaError) {
        throw error;
      }

      this.logger.warn(
        'Legacy profiles schema detected. Falling back to minimal profile upsert.',
        'SupabaseService',
      );
      await this.request<ProfileRow[]>(
        '/rest/v1/profiles?on_conflict=user_id&select=user_id,name,target_role,years_exp,city,created_at,updated_at',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify([
            {
              user_id: record.userId,
              name: record.name,
              target_role: record.targetRole,
              years_exp: record.yearsExp,
              city: record.city,
            },
          ]),
        },
      );

      return null;
    }

    const row = rows[0];
    if (!row) return null;
    const firstName = row.first_name ?? '';
    const lastName = row.last_name ?? '';
    const fullName = row.name ?? `${firstName} ${lastName}`.trim();
    return {
      userId: row.user_id,
      name: fullName,
      firstName,
      lastName,
      targetRole: row.target_role ?? '',
      yearsExp: row.years_exp ?? '',
      country: row.country ?? '',
      city: row.city ?? '',
      linkedinUrl: row.linkedin_url ?? '',
      portfolioUrl: row.portfolio_url ?? '',
      allowLinkedinAnalysis: Boolean(row.allow_linkedin_analysis),
      employmentTypes: row.employment_types ?? [],
      profileSkipped: Boolean(row.profile_skipped),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies ProfileRecord;
  }

  async getOnboardingStateByUserId(userId: string) {
    const queryUserId = encodeURIComponent(userId);
    let rows: OnboardingStateRow[] = [];
    try {
      rows = await this.request<OnboardingStateRow[]>(
        `/rest/v1/onboarding_states?user_id=eq.${queryUserId}&limit=1&select=user_id,current_step,is_completed,profile_skipped,updated_at`,
      );
    } catch (error) {
      if (!this.isMissingColumnError(error, 'onboarding_states', 'profile_skipped')) {
        throw error;
      }
      this.logger.warn(
        'Legacy onboarding_states schema detected. Falling back to select without profile_skipped.',
        'SupabaseService',
      );
      rows = await this.request<OnboardingStateRow[]>(
        `/rest/v1/onboarding_states?user_id=eq.${queryUserId}&limit=1&select=user_id,current_step,is_completed,updated_at`,
      );
    }
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      currentStep: Math.min(Math.max(row.current_step, 1), 4) as 1 | 2 | 3 | 4,
      isCompleted: row.is_completed,
      profileSkipped: Boolean(row.profile_skipped),
      updatedAt: row.updated_at,
    } satisfies OnboardingStateRecord;
  }

  async upsertOnboardingState(record: OnboardingStateRecord) {
    const payload = [
      {
        user_id: record.userId,
        current_step: record.currentStep,
        is_completed: record.isCompleted,
        profile_skipped: record.profileSkipped,
      },
    ];
    let rows: OnboardingStateRow[] = [];
    try {
      rows = await this.request<OnboardingStateRow[]>(
        '/rest/v1/onboarding_states?on_conflict=user_id&select=user_id,current_step,is_completed,profile_skipped,updated_at',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        },
      );
    } catch (error) {
      if (!this.isMissingColumnError(error, 'onboarding_states', 'profile_skipped')) {
        throw error;
      }
      this.logger.warn(
        'Legacy onboarding_states schema detected. Falling back to upsert without profile_skipped.',
        'SupabaseService',
      );
      rows = await this.request<OnboardingStateRow[]>(
        '/rest/v1/onboarding_states?on_conflict=user_id&select=user_id,current_step,is_completed,updated_at',
        {
          method: 'POST',
          headers: {
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify([
            {
              user_id: record.userId,
              current_step: record.currentStep,
              is_completed: record.isCompleted,
            },
          ]),
        },
      );
    }
    const row = rows[0];
    if (!row) return null;
    return {
      userId: row.user_id,
      currentStep: Math.min(Math.max(row.current_step, 1), 4) as 1 | 2 | 3 | 4,
      isCompleted: row.is_completed,
      profileSkipped: Boolean(row.profile_skipped),
      updatedAt: row.updated_at,
    } satisfies OnboardingStateRecord;
  }

  async upsertUserOnboardingCompletion(input: {
    clerkUserId: string;
    email?: string;
  }): Promise<UserRecord | null> {
    const payload = [
      {
        clerk_user_id: input.clerkUserId,
        email: input.email?.trim() || null,
        onboarding_completed_at: new Date().toISOString(),
      },
    ];

    const rows = await this.request<UserRow[]>(
      '/rest/v1/users?on_conflict=clerk_user_id&select=clerk_user_id,email,onboarding_completed_at,created_at,updated_at',
      {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      },
    );

    const row = rows[0];
    if (!row) return null;
    return {
      clerkUserId: row.clerk_user_id,
      email: row.email ?? undefined,
      onboardingCompletedAt: row.onboarding_completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies UserRecord;
  }
}

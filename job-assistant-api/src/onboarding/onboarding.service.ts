import { Injectable } from '@nestjs/common';

import { AppLoggerService } from '../common/logger/app-logger.service';
import { OnboardingStateRecord } from '../common/types/shared';
import { SupabaseService } from '../supabase/supabase.service';

interface ProgressSignals {
  profileCompleted: boolean;
  resumeUploaded: boolean;
  subscriptionActive: boolean;
  profileSkipped?: boolean;
}

@Injectable()
export class OnboardingService {
  private readonly memoryStore = new Map<string, OnboardingStateRecord>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  private isOnboardingTableMissing(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('onboarding_states') &&
      (message.includes('pgrst205') || message.includes('(404)'))
    );
  }

  private toDefault(userId: string): OnboardingStateRecord {
    return {
      userId,
      currentStep: 1,
      isCompleted: false,
      profileSkipped: false,
    };
  }

  private deriveState(
    userId: string,
    signals: ProgressSignals,
  ): OnboardingStateRecord {
    if (signals.profileSkipped && !signals.profileCompleted) {
      return { userId, currentStep: 2, isCompleted: false, profileSkipped: true };
    }
    if (!signals.profileCompleted) {
      return { userId, currentStep: 1, isCompleted: false, profileSkipped: false };
    }
    if (!signals.resumeUploaded) {
      return {
        userId,
        currentStep: 2,
        isCompleted: false,
        profileSkipped: signals.profileSkipped ?? false,
      };
    }
    if (!signals.subscriptionActive) {
      return {
        userId,
        currentStep: 3,
        isCompleted: false,
        profileSkipped: signals.profileSkipped ?? false,
      };
    }
    return {
      userId,
      currentStep: 4,
      isCompleted: true,
      profileSkipped: signals.profileSkipped ?? false,
    };
  }

  private clampStep(value: number): 1 | 2 | 3 | 4 {
    if (value <= 1) return 1;
    if (value >= 4) return 4;
    return value as 1 | 2 | 3 | 4;
  }

  async getState(userId: string): Promise<OnboardingStateRecord> {
    if (!this.supabaseService.isConfigured()) {
      return this.memoryStore.get(userId) ?? this.toDefault(userId);
    }

    try {
      const row = await this.supabaseService.getOnboardingStateByUserId(userId);
      if (!row) return this.memoryStore.get(userId) ?? this.toDefault(userId);
      this.memoryStore.set(userId, row);
      return row;
    } catch (error) {
      if (this.isOnboardingTableMissing(error)) {
        this.logger.warn(
          'Table onboarding_states is missing. Falling back to in-memory onboarding state.',
          'OnboardingService',
        );
        return this.memoryStore.get(userId) ?? this.toDefault(userId);
      }
      throw error;
    }
  }

  async syncBySignals(
    userId: string,
    signals: ProgressSignals,
  ): Promise<OnboardingStateRecord> {
    const existing = this.memoryStore.get(userId) ?? this.toDefault(userId);
    const next = this.deriveState(userId, {
      ...signals,
      profileSkipped: signals.profileSkipped ?? existing.profileSkipped,
    });
    this.memoryStore.set(userId, next);

    if (!this.supabaseService.isConfigured()) {
      return next;
    }

    try {
      const row = await this.supabaseService.upsertOnboardingState(next);
      return row ?? next;
    } catch (error) {
      if (this.isOnboardingTableMissing(error)) {
        this.logger.warn(
          'Table onboarding_states is missing. Saved onboarding state in-memory only.',
          'OnboardingService',
        );
        return next;
      }
      throw error;
    }
  }

  async initialize(userId: string): Promise<OnboardingStateRecord> {
    const existing = await this.getState(userId);
    if (!this.supabaseService.isConfigured()) {
      this.memoryStore.set(userId, existing);
      return existing;
    }
    try {
      const row = await this.supabaseService.upsertOnboardingState(existing);
      return row ?? existing;
    } catch (error) {
      if (this.isOnboardingTableMissing(error)) {
        this.logger.warn(
          'Table onboarding_states is missing during initialization. Using in-memory state.',
          'OnboardingService',
        );
        return existing;
      }
      throw error;
    }
  }

  async updateStep(
    userId: string,
    payload: {
      currentStep: number;
      profileSkipped?: boolean;
      isCompleted?: boolean;
      email?: string;
    },
  ): Promise<OnboardingStateRecord> {
    const current = await this.getState(userId);
    const next: OnboardingStateRecord = {
      userId,
      currentStep: this.clampStep(payload.currentStep),
      isCompleted: payload.isCompleted ?? current.isCompleted,
      profileSkipped: payload.profileSkipped ?? current.profileSkipped,
      updatedAt: current.updatedAt,
    };

    if (next.currentStep < 4 && payload.isCompleted === undefined) {
      next.isCompleted = false;
    }
    if (next.currentStep === 4 && payload.isCompleted === undefined) {
      next.isCompleted = true;
    }

    this.memoryStore.set(userId, next);

    if (!this.supabaseService.isConfigured()) {
      return next;
    }

    try {
      const row = await this.supabaseService.upsertOnboardingState(next);
      if (next.isCompleted && next.currentStep === 4) {
        await this.supabaseService.upsertUserOnboardingCompletion({
          clerkUserId: userId,
          email: payload.email,
        });
      }
      return row ?? next;
    } catch (error) {
      if (this.isOnboardingTableMissing(error)) {
        this.logger.warn(
          'Table onboarding_states is missing during step update. Saved onboarding state in-memory only.',
          'OnboardingService',
        );
        return next;
      }
      throw error;
    }
  }
}

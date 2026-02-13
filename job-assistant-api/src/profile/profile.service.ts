import { Injectable } from '@nestjs/common';

import { ProfileRecord } from '../common/types/shared';
import { SupabaseService } from '../supabase/supabase.service';

interface ProfilePatch {
  userId: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  targetRole?: string;
  yearsExp?: string;
  country?: string;
  city?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  allowLinkedinAnalysis?: boolean;
  employmentTypes?: string[];
  profileSkipped?: boolean;
}

@Injectable()
export class ProfileService {
  private readonly memoryStore = new Map<string, ProfileRecord>();

  constructor(private readonly supabaseService: SupabaseService) {}

  private toDefault(userId: string): ProfileRecord {
    return {
      userId,
      name: '',
      firstName: '',
      lastName: '',
      targetRole: '',
      yearsExp: '',
      country: '',
      city: '',
      linkedinUrl: '',
      portfolioUrl: '',
      allowLinkedinAnalysis: false,
      employmentTypes: [],
      profileSkipped: false,
    };
  }

  private trimOrKeep(value: string | undefined, fallback: string): string {
    if (value === undefined) return fallback;
    return value.trim();
  }

  private deriveName(firstName: string, lastName: string, fallback: string): string {
    const full = `${firstName} ${lastName}`.trim();
    return full || fallback;
  }

  isProfileCompleted(record: ProfileRecord): boolean {
    const hasTargetRole = Boolean(record.targetRole.trim());
    const hasSplitName = Boolean(
      record.firstName.trim() && record.lastName.trim(),
    );
    const hasLegacyName = Boolean(record.name.trim());
    return Boolean(
      hasTargetRole && (hasSplitName || hasLegacyName),
    );
  }

  private normalizePatch(current: ProfileRecord, input: ProfilePatch): ProfileRecord {
    const firstName = this.trimOrKeep(input.firstName, current.firstName);
    const lastName = this.trimOrKeep(input.lastName, current.lastName);
    const next: ProfileRecord = {
      ...current,
      name: this.trimOrKeep(
        input.name,
        this.deriveName(firstName, lastName, current.name),
      ),
      firstName,
      lastName,
      targetRole: this.trimOrKeep(input.targetRole, current.targetRole),
      yearsExp: this.trimOrKeep(input.yearsExp, current.yearsExp),
      country: this.trimOrKeep(input.country, current.country),
      city: this.trimOrKeep(input.city, current.city),
      linkedinUrl: this.trimOrKeep(input.linkedinUrl, current.linkedinUrl ?? ''),
      portfolioUrl: this.trimOrKeep(input.portfolioUrl, current.portfolioUrl ?? ''),
      allowLinkedinAnalysis:
        input.allowLinkedinAnalysis ?? current.allowLinkedinAnalysis,
      employmentTypes:
        input.employmentTypes?.map((type) => type.trim()).filter(Boolean) ??
        current.employmentTypes,
      profileSkipped: input.profileSkipped ?? current.profileSkipped,
    };

    if (!next.name.trim()) {
      next.name = this.deriveName(firstName, lastName, '');
    }
    return next;
  }

  async getProfile(userId: string): Promise<ProfileRecord> {
    const memory = this.memoryStore.get(userId);
    if (!this.supabaseService.isConfigured()) {
      return memory ?? this.toDefault(userId);
    }

    const row = await this.supabaseService.getProfileByUserId(userId);
    if (!row) {
      return memory ?? this.toDefault(userId);
    }
    this.memoryStore.set(userId, row);
    return row;
  }

  async upsertProfile(input: ProfilePatch): Promise<ProfileRecord> {
    const current = await this.getProfile(input.userId);
    const normalized = this.normalizePatch(current, input);
    this.memoryStore.set(input.userId, normalized);

    if (!this.supabaseService.isConfigured()) {
      return normalized;
    }

    const row = await this.supabaseService.upsertProfile(normalized);
    return row ?? normalized;
  }
}

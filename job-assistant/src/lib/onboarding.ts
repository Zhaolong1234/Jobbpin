import { apiFetch } from "@/lib/api";
import type {
  ProfileRecord,
  ResumeRecord,
  SubscriptionRecord,
} from "@/types/shared";

export interface OnboardingSignals {
  profileCompleted: boolean;
  resumeUploaded: boolean;
  subscriptionActive: boolean;
  profileSkipped?: boolean;
}

function isSubscribedStatus(status: string): boolean {
  return ["trialing", "active", "past_due"].includes(status);
}

export function isProfileCompleted(profile: ProfileRecord | null): boolean {
  if (!profile) return false;
  const hasTargetRole = Boolean(profile.targetRole.trim());
  const hasSplitName = Boolean(
    profile.firstName.trim() && profile.lastName.trim(),
  );
  const hasLegacyName = Boolean(profile.name.trim());
  return Boolean(
    hasTargetRole && (hasSplitName || hasLegacyName),
  );
}

export async function computeOnboardingSignals(
  userId: string,
): Promise<{
  profile: ProfileRecord | null;
  resume: ResumeRecord | null;
  subscription: SubscriptionRecord;
  signals: OnboardingSignals;
}> {
  const [profile, resume, subscription] = await Promise.all([
    apiFetch<ProfileRecord>(`/profile/${userId}`).catch(() => null),
    apiFetch<ResumeRecord | null>(`/resume/${userId}/latest`).catch(() => null),
    apiFetch<SubscriptionRecord>(`/subscription/${userId}`).catch(
      (): SubscriptionRecord => ({
        plan: "free",
        status: "incomplete",
      }),
    ),
  ]);

  return {
    profile,
    resume,
    subscription,
    signals: {
      profileCompleted: isProfileCompleted(profile),
      resumeUploaded: Boolean(resume?.id),
      subscriptionActive: isSubscribedStatus(subscription.status),
      profileSkipped: Boolean(profile?.profileSkipped),
    },
  };
}

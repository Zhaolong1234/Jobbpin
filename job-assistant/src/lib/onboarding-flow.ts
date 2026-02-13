import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import type { OnboardingStateRecord, ProfileRecord } from "@/types/shared";

export const TOTAL_ONBOARDING_STEPS = 4;

export const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Manager",
  "HR",
  "Financial Analyst",
  "Marketing Specialist",
  "Sales Representative",
  "Administrator",
] as const;

export const EMPLOYMENT_OPTIONS = [
  { key: "full-time", title: "Full Time", description: "Permanent roles for career building" },
  { key: "part-time", title: "Part Time", description: "Temporary roles for students and recent graduates" },
  { key: "freelance", title: "Freelance", description: "Independent project-based opportunities" },
  { key: "contract", title: "Contract", description: "Fixed-term opportunities with clear scope" },
  { key: "internship", title: "Internship", description: "Learning-first roles to build experience" },
  { key: "casual", title: "Casual", description: "Flexible roles with no fixed hours" },
] as const;

export type EmploymentKey = (typeof EMPLOYMENT_OPTIONS)[number]["key"];

export function getStepPath(step: number): string {
  const next = Math.max(1, Math.min(TOTAL_ONBOARDING_STEPS, step));
  return `/onboarding/step-${next}`;
}

export function previousStep(step: number): number {
  return Math.max(1, step - 1);
}

export function nextStep(step: number): number {
  return Math.min(TOTAL_ONBOARDING_STEPS, step + 1);
}

export function getFallbackOnboardingState(userId: string): OnboardingStateRecord {
  return {
    userId,
    currentStep: 1,
    isCompleted: false,
    profileSkipped: false,
  };
}

export function getEmptyProfile(userId: string = DEV_USER_ID): ProfileRecord {
  return {
    userId,
    name: "",
    firstName: "",
    lastName: "",
    targetRole: "",
    yearsExp: "",
    country: "",
    city: "",
    linkedinUrl: "",
    portfolioUrl: "",
    allowLinkedinAnalysis: false,
    employmentTypes: [],
    profileSkipped: false,
  };
}

export function isOnboardingComplete(profile: ProfileRecord | null): boolean {
  if (!profile) return false;
  const hasTargetRole = Boolean(profile.targetRole?.trim());
  const hasSplitName = Boolean(
    profile.firstName?.trim() && profile.lastName?.trim(),
  );
  const hasLegacyName = Boolean(profile.name?.trim());
  return Boolean(
    hasTargetRole && (hasSplitName || hasLegacyName),
  );
}

export async function fetchProfile(userId: string): Promise<ProfileRecord> {
  const profile = await apiFetch<ProfileRecord>(`/profile/${userId}`);
  return {
    ...getEmptyProfile(userId),
    ...profile,
    employmentTypes: profile.employmentTypes ?? [],
    allowLinkedinAnalysis: Boolean(profile.allowLinkedinAnalysis),
    profileSkipped: Boolean(profile.profileSkipped),
  };
}

export async function saveProfilePatch(
  payload: Partial<ProfileRecord> & { userId: string },
): Promise<ProfileRecord> {
  return apiFetch<ProfileRecord>("/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchOnboardingState(
  userId: string,
): Promise<OnboardingStateRecord> {
  try {
    return await apiFetch<OnboardingStateRecord>(`/onboarding/${userId}`);
  } catch {
    return getFallbackOnboardingState(userId);
  }
}

export async function updateOnboardingStep(
  userId: string,
  currentStep: number,
  options?: { profileSkipped?: boolean; isCompleted?: boolean; email?: string },
): Promise<OnboardingStateRecord> {
  return apiFetch<OnboardingStateRecord>("/onboarding/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, currentStep, ...options }),
  });
}

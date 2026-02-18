"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { StatusBanner } from "@/components/status-banner";
import { DEV_USER_ID } from "@/lib/config";
import {
  fetchProfile,
  getEmptyProfile,
  getStepPath,
  nextStep,
  ROLE_OPTIONS,
  saveProfilePatch,
  updateOnboardingStep,
} from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";
import type { ProfileRecord } from "@/types/shared";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function Step1Page() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [profile, setProfile] = useState<ProfileRecord>(getEmptyProfile(userId));
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Loading profile setup...");

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setMessage("Loading profile setup...");
      try {
        const existing = await fetchProfile(userId);
        setProfile(existing);
        setStatus("empty");
        setMessage("Choose your target role to continue.");
      } catch (error) {
        setStatus("parse_failed");
        setMessage((error as Error).message || "Failed to load profile.");
      }
    };

    void run();
  }, [isLoaded, router, user, userId]);

  const onRoleSelect = (role: string) => {
    setProfile((prev) => ({ ...prev, targetRole: role }));
    setStatus("success");
    setMessage(`${role} selected.`);
  };

  const onNext = async () => {
    if (!profile.targetRole.trim()) {
      setStatus("parse_failed");
      setMessage("Please choose a role before moving to next step.");
      return;
    }

    setStatus("loading");
    setMessage("Saving selected role...");
    try {
      await saveProfilePatch({
        userId,
        targetRole: profile.targetRole,
        profileSkipped: false,
      });
      await updateOnboardingStep(userId, nextStep(1), {
        profileSkipped: false,
        isCompleted: false,
      });
      setStatus("success");
      setMessage("Saved. Moving to step 2.");
      router.push(getStepPath(2));
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Unable to save step 1.");
    }
  };

  const onSkip = async () => {
    setStatus("loading");
    setMessage("Skipping role selection...");
    try {
      await saveProfilePatch({ userId, profileSkipped: true });
      await updateOnboardingStep(userId, 2, {
        profileSkipped: true,
        isCompleted: false,
      });
      setStatus("success");
      setMessage("Skipped. Moving to step 2.");
      router.push(getStepPath(2));
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Unable to skip this step.");
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-panel md:px-10 md:py-10 xl:px-12 xl:py-12">
      <span className="absolute left-10 top-24 animate-float-y text-3xl [animation-duration:2.1s] [will-change:transform]">🔎</span>
      <span className="absolute right-12 top-16 animate-float-y text-3xl [animation-duration:1.8s] [will-change:transform]">💡</span>
      <span className="absolute left-16 bottom-14 animate-float-y text-3xl [animation-duration:2.6s] [will-change:transform]">🚀</span>
      <span className="absolute right-20 bottom-20 animate-float-y text-3xl [animation-duration:2.3s] [will-change:transform]">💼</span>

      <div className="flex flex-col gap-6">
        <StatusBanner status={status} message={message} />

        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Step 1 of 4</p>
          <h1 className="text-[clamp(2rem,4.2vw,3.85rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-slate-900">
            Welcome! Let&apos;s Set Up Your Profile
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-slate-500 md:text-lg">
            Select your target role. You can still update this later in your dashboard.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center md:p-7">
          <p className="text-sm font-semibold text-slate-600">Selected role</p>
          <p className="mt-2 text-[clamp(2.3rem,4.2vw,4.5rem)] font-black tracking-[-0.02em] text-slate-900">
            {profile.targetRole || "Software Engineer"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ROLE_OPTIONS.map((role) => {
            const selected = profile.targetRole === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => onRoleSelect(role)}
                className={`rounded-full border px-4 py-2.5 text-sm transition duration-200 motion-reduce:transition-none ${
                  selected
                    ? "animate-pop-in scale-105 border-blue-500 bg-blue-50 font-semibold text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:scale-105 hover:border-slate-400"
                }`}
              >
                {role}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button type="button" disabled className="btn btn-outline cursor-not-allowed opacity-60">
            Previous
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSkip} className="btn btn-outline">
              Skip fill profile
            </button>
            <button type="button" onClick={onNext} className="btn btn-primary">
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

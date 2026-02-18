"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { StatusBanner } from "@/components/status-banner";
import { DEV_USER_ID } from "@/lib/config";
import {
  EMPLOYMENT_OPTIONS,
  fetchProfile,
  getEmptyProfile,
  getStepPath,
  isOnboardingComplete,
  previousStep,
  saveProfilePatch,
  updateOnboardingStep,
} from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";
import type { ProfileRecord } from "@/types/shared";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function Step4Page() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;
  const userEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress;

  const [profile, setProfile] = useState<ProfileRecord>(getEmptyProfile(userId));
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Loading employment options...");

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setMessage("Loading employment options...");
      try {
        const existing = await fetchProfile(userId);
        setProfile(existing);
        setStatus("empty");
        setMessage("Choose employment preferences and finish onboarding.");
      } catch (error) {
        setStatus("parse_failed");
        setMessage((error as Error).message || "Failed to load step 4 data.");
      }
    };

    void run();
  }, [isLoaded, router, user, userId]);

  const selected = useMemo(() => new Set(profile.employmentTypes ?? []), [profile.employmentTypes]);

  const toggleType = (key: string) => {
    setProfile((prev) => {
      const next = new Set(prev.employmentTypes ?? []);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { ...prev, employmentTypes: Array.from(next) };
    });
  };

  const onPrevious = async () => {
    setStatus("loading");
    setMessage("Returning to step 3...");
    await updateOnboardingStep(userId, previousStep(4), {
      profileSkipped: profile.profileSkipped,
      isCompleted: false,
    }).catch(() => undefined);
    router.push(getStepPath(3));
  };

  const onFinish = async () => {
    setStatus("loading");
    setMessage("Saving employment preferences...");

    try {
      const saved = await saveProfilePatch({
        userId,
        employmentTypes: profile.employmentTypes,
      });

      const complete = isOnboardingComplete(saved);
      await updateOnboardingStep(userId, 4, {
        profileSkipped: saved.profileSkipped,
        isCompleted: complete,
        email: userEmail,
      });

      if (!complete) {
        setStatus("parse_failed");
        setMessage("Required fields are missing. Please complete Step 2 fields.");
        return;
      }

      setStatus("success");
      setMessage("Onboarding completed. Redirecting to celebration page...");
      router.push("/onboarding/completed");
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to finish onboarding.");
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-panel md:px-10 md:py-10 xl:px-12 xl:py-12">
      <span className="absolute right-8 top-8 animate-float-y text-4xl [animation-duration:1.9s] [will-change:transform]">💡</span>
      <span className="absolute bottom-8 right-20 animate-float-y text-5xl [animation-duration:2.4s] [will-change:transform]">😀</span>

      <div className="space-y-6">
        <StatusBanner status={status} message={message} />

        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Step 4 of 4</p>
          <h1 className="text-[clamp(2rem,3.6vw,3.4rem)] font-extrabold leading-tight tracking-[-0.02em] text-slate-900">
            Choose the Type of Employment You&apos;re Looking For
          </h1>
          <p className="max-w-4xl text-base leading-relaxed text-slate-500 md:text-lg">
            Select one or multiple options. You can still change these in dashboard later.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {EMPLOYMENT_OPTIONS.map((item) => {
            const active = selected.has(item.key);
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => toggleType(item.key)}
                className={`relative rounded-2xl border p-4 text-left transition duration-200 motion-reduce:transition-none md:p-5 ${
                  active
                    ? "animate-pop-in border-blue-600 bg-blue-50 shadow"
                    : "border-slate-300 bg-white hover:-translate-y-0.5 hover:border-slate-400"
                }`}
              >
                {active ? (
                  <span className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
                    ✓
                  </span>
                ) : null}
                <p className={`text-2xl font-bold ${active ? "text-blue-700" : "text-slate-900"}`}>{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button type="button" onClick={onPrevious} className="btn btn-outline">
            Previous
          </button>
          <button type="button" onClick={onFinish} className="btn btn-primary">
            Finish
          </button>
        </div>
      </div>
    </section>
  );
}

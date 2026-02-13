"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { StatusBanner } from "@/components/status-banner";
import { DEV_USER_ID } from "@/lib/config";
import {
  fetchProfile,
  getEmptyProfile,
  getStepPath,
  nextStep,
  previousStep,
  saveProfilePatch,
  updateOnboardingStep,
} from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";
import type { ProfileRecord } from "@/types/shared";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const DEMO_MESSAGES = [
  "Let’s get to know you better.",
  "We use this information to personalize your profile and recommendations.",
  "Great, now fill your name so we can continue.",
] as const;

export default function Step2Page() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [profile, setProfile] = useState<ProfileRecord>(getEmptyProfile(userId));
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Loading basic profile fields...");
  const [visibleMessages, setVisibleMessages] = useState(0);

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setMessage("Loading basic profile fields...");
      try {
        const existing = await fetchProfile(userId);
        setProfile(existing);
        setStatus("empty");
        setMessage("Complete required fields and continue.");
      } catch (error) {
        setStatus("parse_failed");
        setMessage((error as Error).message || "Failed to load step 2 data.");
      }
    };

    void run();
  }, [isLoaded, router, user, userId]);

  useEffect(() => {
    setVisibleMessages(0);
    const timer = setInterval(() => {
      setVisibleMessages((prev) => {
        if (prev >= DEMO_MESSAGES.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 700);
    return () => clearInterval(timer);
  }, []);

  const requiredMissing = useMemo(() => {
    return !(profile.firstName.trim() && profile.lastName.trim());
  }, [profile.firstName, profile.lastName]);

  const onNext = async () => {
    if (requiredMissing) {
      setStatus("parse_failed");
      setMessage("First name and last name are required.");
      return;
    }

    setStatus("loading");
    setMessage("Saving step 2...");
    try {
      await saveProfilePatch({
        userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        country: profile.country,
        city: profile.city,
        name: `${profile.firstName} ${profile.lastName}`.trim(),
      });
      await updateOnboardingStep(userId, nextStep(2), {
        profileSkipped: profile.profileSkipped,
        isCompleted: false,
      });
      setStatus("success");
      setMessage("Saved. Moving to step 3.");
      router.push(getStepPath(3));
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to save step 2.");
    }
  };

  const onPrevious = async () => {
    setStatus("loading");
    setMessage("Returning to step 1...");
    await updateOnboardingStep(userId, previousStep(2), {
      profileSkipped: profile.profileSkipped,
      isCompleted: false,
    }).catch(() => undefined);
    router.push(getStepPath(1));
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="panel">
        <div className="panel-body space-y-5">
          <StatusBanner status={status} message={message} />
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Step 2 of 4</p>
            <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Basic Profile Details</h1>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              First Name *
              <input
                className="input mt-1"
                value={profile.firstName}
                onChange={(e) => setProfile((prev) => ({ ...prev, firstName: e.target.value }))}
              />
            </label>
            <label className="label">
              Country <span className="text-slate-400">(optional)</span>
              <input
                className="input mt-1"
                value={profile.country}
                onChange={(e) => setProfile((prev) => ({ ...prev, country: e.target.value }))}
              />
            </label>
            <label className="label">
              Last Name *
              <input
                className="input mt-1"
                value={profile.lastName}
                onChange={(e) => setProfile((prev) => ({ ...prev, lastName: e.target.value }))}
              />
            </label>
            <label className="label">
              City <span className="text-slate-400">(optional)</span>
              <input
                className="input mt-1"
                value={profile.city}
                onChange={(e) => setProfile((prev) => ({ ...prev, city: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button type="button" onClick={onPrevious} className="btn btn-outline">
              Previous
            </button>
            <button type="button" onClick={onNext} className="btn btn-primary">
              Next
            </button>
          </div>
        </div>
      </div>

      <aside className="panel overflow-hidden">
        <div className="panel-body relative space-y-3">
          <span className="absolute right-2 top-2 animate-float-y text-2xl [animation-duration:2s] [will-change:transform]">✨</span>
          <p className="text-sm font-semibold text-slate-700">Assistant Demo</p>
          <div className="space-y-2">
            {DEMO_MESSAGES.slice(0, visibleMessages).map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="animate-chat-reveal rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}

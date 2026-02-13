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
  previousStep,
  saveProfilePatch,
  updateOnboardingStep,
} from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";
import type { ProfileRecord } from "@/types/shared";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function isUrlValid(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export default function Step3Page() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [profile, setProfile] = useState<ProfileRecord>(getEmptyProfile(userId));
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Loading optional profile links...");

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setMessage("Loading optional profile links...");
      try {
        const existing = await fetchProfile(userId);
        setProfile(existing);
        setStatus("empty");
        setMessage("LinkedIn and website are optional.");
      } catch (error) {
        setStatus("parse_failed");
        setMessage((error as Error).message || "Failed to load step 3 data.");
      }
    };

    void run();
  }, [isLoaded, router, user, userId]);

  const onNext = async () => {
    if (!isUrlValid(profile.linkedinUrl || "") || !isUrlValid(profile.portfolioUrl || "")) {
      setStatus("parse_failed");
      setMessage("Please use valid URLs with http:// or https://.");
      return;
    }

    setStatus("loading");
    setMessage("Saving step 3...");

    try {
      const linkedinUrl = profile.linkedinUrl?.trim() || undefined;
      const portfolioUrl = profile.portfolioUrl?.trim() || undefined;
      await saveProfilePatch({
        userId,
        linkedinUrl,
        portfolioUrl,
        allowLinkedinAnalysis: profile.allowLinkedinAnalysis,
      });
      await updateOnboardingStep(userId, nextStep(3), {
        profileSkipped: profile.profileSkipped,
        isCompleted: false,
      });
      setStatus("success");
      setMessage("Saved. Moving to step 4.");
      router.push(getStepPath(4));
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to save step 3.");
    }
  };

  const onPrevious = async () => {
    setStatus("loading");
    setMessage("Returning to step 2...");
    await updateOnboardingStep(userId, previousStep(3), {
      profileSkipped: profile.profileSkipped,
      isCompleted: false,
    }).catch(() => undefined);
    router.push(getStepPath(2));
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="panel">
        <div className="panel-body space-y-5">
          <StatusBanner status={status} message={message} />
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Step 3 of 4</p>
            <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">Links and Portfolio</h1>
          </div>

          <div className="space-y-4">
            <label className="label block">
              LinkedIn Profile <span className="text-slate-400">(optional)</span>
              <input
                className="input mt-1"
                placeholder="https://linkedin.com/in/..."
                value={profile.linkedinUrl || ""}
                onChange={(e) => setProfile((prev) => ({ ...prev, linkedinUrl: e.target.value }))}
              />
            </label>

            <label className="label block">
              Personal Website / Portfolio <span className="text-slate-400">(optional)</span>
              <input
                className="input mt-1"
                placeholder="https://..."
                value={profile.portfolioUrl || ""}
                onChange={(e) => setProfile((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
              />
            </label>

            <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={profile.allowLinkedinAnalysis}
                onChange={(e) =>
                  setProfile((prev) => ({
                    ...prev,
                    allowLinkedinAnalysis: e.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4"
              />
              <span>
                I allow Job Assistant to analyze my LinkedIn profile for personalized
                career suggestions.
              </span>
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
        <div className="panel-body relative">
          <span className="absolute right-3 top-3 animate-float-y text-2xl [animation-duration:2s] [will-change:transform]">💡</span>
          <div className="space-y-2">
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              Do you have portfolios?
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
              They help your profile stand out to employers.
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">...</div>
          </div>
        </div>
      </aside>
    </section>
  );
}

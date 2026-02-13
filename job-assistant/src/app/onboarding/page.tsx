"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { DEV_USER_ID } from "@/lib/config";
import {
  fetchOnboardingState,
  getStepPath,
} from "@/lib/onboarding-flow";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function OnboardingIndexPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      const state = await fetchOnboardingState(userId);
      if (state.isCompleted) {
        router.replace("/dashboard");
        return;
      }
      router.replace(getStepPath(state.currentStep));
    };

    void run();
  }, [isLoaded, router, user, userId]);

  return <p className="text-sm text-slate-600">Loading onboarding...</p>;
}

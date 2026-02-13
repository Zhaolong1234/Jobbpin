"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import { DEV_USER_ID } from "@/lib/config";
import {
  fetchOnboardingState,
  getStepPath,
} from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";
import { StatusBanner } from "@/components/status-banner";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [allowed, setAllowed] = useState(false);
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Checking onboarding status...");

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      setAllowed(false);
      setStatus("loading");
      setMessage("Redirecting to sign in...");
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      setAllowed(false);
      setStatus("loading");
      setMessage("Checking onboarding status...");

      try {
        const onboarding = await fetchOnboardingState(userId);
        const completed = onboarding.isCompleted;

        if (completed && pathname !== "/onboarding/completed") {
          setStatus("success");
          setMessage("Profile already completed. Redirecting to dashboard...");
          router.replace("/dashboard");
          return;
        }

        if (!completed && pathname === "/onboarding/completed") {
          setStatus("parse_failed");
          setMessage("Profile is not complete yet. Redirecting to your current step...");
          router.replace(getStepPath(onboarding.currentStep));
          return;
        }

        setAllowed(true);
      } catch (error) {
        setAllowed(true);
        setStatus("parse_failed");
        setMessage((error as Error).message || "Failed to verify onboarding state.");
      }
    };

    void run();
  }, [isLoaded, pathname, router, user, userId]);

  if (!allowed) {
    return <StatusBanner status={status} message={message} />;
  }

  return <>{children}</>;
}

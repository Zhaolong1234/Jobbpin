"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import type { CSSProperties } from "react";

import { StatusBanner } from "@/components/status-banner";
import { DEV_USER_ID } from "@/lib/config";
import { fetchOnboardingState, getStepPath } from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const CONFETTI_COLORS = [
  "#2563eb",
  "#22c55e",
  "#f97316",
  "#eab308",
  "#ec4899",
  "#06b6d4",
  "#a855f7",
];

export default function OnboardingCompletedPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Checking completion status...");

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, index) => ({
        id: index,
        left: ((index * 17) % 100) + ((index % 5) * 0.4),
        delay: (index % 11) * 0.26,
        duration: 4.2 + (index % 7) * 0.6,
        sway: 1.8 + (index % 5) * 0.35,
        width: 6 + (index % 4) * 3,
        height: 10 + (index % 3) * 4,
        radius: index % 3 === 0 ? "999px" : "2px",
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    [],
  );

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      try {
        const onboarding = await fetchOnboardingState(userId);
        if (!onboarding.isCompleted) {
          setStatus("parse_failed");
          setMessage("Onboarding is not complete yet. Redirecting you to the right step.");
          router.replace(getStepPath(onboarding.currentStep));
          return;
        }

        setStatus("success");
        setMessage("Profile setup completed.");
      } catch (error) {
        setStatus("parse_failed");
        setMessage((error as Error).message || "Unable to verify onboarding completion.");
      }
    };

    void run();
  }, [isLoaded, router, user, userId]);

  return (
    <section className="relative min-h-[78vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-panel">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confettiPieces.map((piece) => (
          <span
            key={piece.id}
            className="absolute top-[-12vh] animate-confetti-sway"
              style={
                {
                  left: `${piece.left}%`,
                  animationDelay: `${piece.delay}s`,
                  "--sway": `${piece.sway}s`,
                } as CSSProperties
              }
            >
              <span
                className="block animate-confetti-drop"
                style={
                {
                  width: `${piece.width}px`,
                  height: `${piece.height}px`,
                  borderRadius: piece.radius,
                  backgroundColor: piece.color,
                  animationDelay: `${piece.delay}s`,
                  "--dur": `${piece.duration}s`,
                } as CSSProperties
              }
            />
          </span>
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-3xl flex-col items-center justify-center px-6 py-10 text-center">
        <StatusBanner status={status} message={message} className="mb-6 w-full" />

        <p className="text-6xl leading-none">🎉</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
          Awesome, your profile is ready.
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Let&apos;s help you land your first opportunity.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link className="btn btn-primary min-w-44" href="/dashboard">
            Go to Dashboard →
          </Link>
          <Link className="btn btn-outline min-w-44" href="/dashboard/resume">
            Start Resume Setup →
          </Link>
        </div>
      </div>
    </section>
  );
}

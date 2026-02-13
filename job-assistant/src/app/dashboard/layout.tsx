"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/nextjs";

import { BrandLogo } from "@/components/brand-logo";
import { StatusBanner } from "@/components/status-banner";
import { DEV_USER_ID } from "@/lib/config";
import { fetchOnboardingState, getStepPath } from "@/lib/onboarding-flow";
import type { GlobalStatus } from "@/lib/status";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Resume", href: "/dashboard/resume" },
  { label: "Subscription", href: "/dashboard/billing" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const userId = user?.id ?? DEV_USER_ID;

  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Checking onboarding state...");
  const [allowed, setAllowed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) {
      router.replace("/sign-in");
      return;
    }

    const run = async () => {
      setStatus("loading");
      setMessage("Checking onboarding state...");

      try {
        const onboarding = await fetchOnboardingState(userId);
        if (!onboarding.isCompleted) {
          setAllowed(false);
          setStatus("parse_failed");
          setMessage("Onboarding is incomplete. Redirecting to your current step.");
          router.replace(getStepPath(onboarding.currentStep));
          return;
        }

        setAllowed(true);
        setStatus("success");
        setMessage("Dashboard ready.");
      } catch (error) {
        setAllowed(false);
        setStatus("parse_failed");
        setMessage((error as Error).message || "Unable to verify onboarding state.");
      }
    };

    void run();
  }, [isLoaded, pathname, router, user, userId]);

  const displayName = useMemo(() => {
    if (!user) return "User";
    return user.firstName || user.username || user.primaryEmailAddress?.emailAddress || "User";
  }, [user]);

  const initial = displayName.charAt(0).toLowerCase();

  if (!allowed) {
    return (
      <div className="page-container">
        <StatusBanner status={status} message={message} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7ff]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1720px] items-center gap-4 px-4 py-2.5 md:px-6">
          <div className="flex shrink-0 items-center">
            <BrandLogo href="/" className="origin-left scale-[0.54]" />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end">
            <nav className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-5 py-1.5 text-[14px] font-medium transition ${
                      active
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <SignedIn>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                    {initial}
                  </span>
                  <span className="max-w-[120px] truncate text-[14px] font-medium">{displayName}</span>
                  <span className="text-xs text-slate-500">▾</span>
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                    <Link
                      href="/"
                      className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Home
                    </Link>
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setMenuOpen(false);
                        void signOut({ redirectUrl: "/" });
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
              </div>
            </SignedIn>

            <SignedOut>
              <Link className="btn btn-primary" href="/sign-in">
                Sign in
              </Link>
            </SignedOut>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1720px] px-4 py-5 md:px-6 md:py-6">{children}</main>
    </div>
  );
}

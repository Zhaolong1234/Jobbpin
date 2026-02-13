import Link from "next/link";
import { SignedIn, UserButton } from "@clerk/nextjs";

import { OnboardingGuard } from "@/components/onboarding-guard";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="page-container flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-blue-600">
          <span className="text-3xl">🎯</span>
          <span>Job Assistant</span>
        </Link>
        <SignedIn>
          <div className="rounded-full border border-slate-300 bg-white px-3 py-1">
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </header>
      <main className="page-container pt-2">
        <OnboardingGuard>{children}</OnboardingGuard>
      </main>
    </div>
  );
}

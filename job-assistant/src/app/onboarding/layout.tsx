import { SignedIn, UserButton } from "@clerk/nextjs";

import { BrandLogo } from "@/components/brand-logo";
import { OnboardingGuard } from "@/components/onboarding-guard";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="onboarding-container flex items-center justify-between py-5">
        <BrandLogo href="/" className="origin-left scale-[0.62] text-[#3563ff]" />
        <SignedIn>
          <div className="rounded-full border border-slate-300 bg-white px-3 py-1">
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </header>
      <main className="onboarding-container onboarding-main pt-2">
        <OnboardingGuard>{children}</OnboardingGuard>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BrainCircuit,
  Compass,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  Zap,
  Calendar,
  Rocket,
  Search,
  Trophy,
  WandSparkles,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import AnimatedShaderBackground from "@/components/ui/animated-shader-background";
import { Feature108 } from "@/components/ui/shadcnblocks-com-feature108";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import RadialOrbitalTimeline, { type TimelineItem } from "@/components/ui/radial-orbital-timeline";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";

const HERO_TITLE = "Land Your Dream Job Faster with JobbPin AI";

const MARKET_PILLARS = [
  {
    title: "AI Resume Copilot",
    description:
      "Upload once, then iterate with guided improvements, quantified bullets, and role-specific rewrites.",
    icon: BrainCircuit,
  },
  {
    title: "Precision Job Matching",
    description:
      "JobbPin scores your profile against target roles so you prioritize high-probability applications first.",
    icon: Target,
  },
  {
    title: "Referral-First Workflow",
    description:
      "Track outreach, discover warm paths, and move from cold application to referral-driven conversations.",
    icon: Compass,
  },
  {
    title: "Interview Readiness Engine",
    description:
      "Generate likely interview topics, STAR examples, and prep checklists from your own resume context.",
    icon: ShieldCheck,
  },
];

const FEATURE_TABS = [
  {
    value: "tab-1",
    icon: <Zap className="h-auto w-4 shrink-0" />,
    label: "Resume Intelligence",
    content: {
      badge: "Core Workflow",
      title: "Turn rough resumes into interview-grade narratives.",
      description:
        "JobbPin AI analyzes your profile and rewrites weak bullets into impact-focused stories tailored to your target role and industry keywords.",
      buttonText: "Open Resume AI",
      imageSrc:
        "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1500&q=80",
      imageAlt: "Professional reviewing resume notes",
    },
  },
  {
    value: "tab-2",
    icon: <Workflow className="h-auto w-4 shrink-0" />,
    label: "Application Ops",
    content: {
      badge: "Pipeline Control",
      title: "Manage your search like a high-performing sales funnel.",
      description:
        "Centralize role targets, track progression, and avoid dead-end applications with a practical, momentum-focused process.",
      buttonText: "Go To Dashboard",
      imageSrc:
        "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1500&q=80",
      imageAlt: "Laptop with tracking workflow",
    },
  },
  {
    value: "tab-3",
    icon: <Sparkles className="h-auto w-4 shrink-0" />,
    label: "Career Strategy",
    content: {
      badge: "Positioning",
      title: "Build a market position recruiters can immediately place.",
      description:
        "Craft role-specific positioning, create keyword-safe summaries, and align your profile with the language hiring teams actually use.",
      buttonText: "Try Strategy Mode",
      imageSrc:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1500&q=80",
      imageAlt: "Team strategy session",
    },
  },
];

const ROADMAP_ITEMS: TimelineItem[] = [
  {
    id: 1,
    title: "Intake",
    date: "Q1 2026",
    content: "Multi-source resume intake and structured parsing pipeline became production ready.",
    category: "foundation",
    icon: Calendar,
    relatedIds: [2, 3],
    status: "completed",
    energy: 100,
  },
  {
    id: 2,
    title: "AI Rewrite",
    date: "Q2 2026",
    content: "Context-aware rewrite plans with implement/rollback controls launched in assistant chat.",
    category: "assistant",
    icon: WandSparkles,
    relatedIds: [1, 4],
    status: "completed",
    energy: 88,
  },
  {
    id: 3,
    title: "Job Match",
    date: "Q3 2026",
    content: "Role-fit scoring and keyword alignment layer currently under active tuning.",
    category: "matching",
    icon: Search,
    relatedIds: [1, 4, 5],
    status: "in-progress",
    energy: 64,
  },
  {
    id: 4,
    title: "Interview Prep",
    date: "Q4 2026",
    content: "Personalized interview prep tracks and question rehearsal are planned next.",
    category: "interview",
    icon: Trophy,
    relatedIds: [2, 3, 5],
    status: "pending",
    energy: 34,
  },
  {
    id: 5,
    title: "Career OS",
    date: "2027",
    content: "Unified career command center across planning, application, networking, and offer strategy.",
    category: "vision",
    icon: Rocket,
    relatedIds: [3, 4],
    status: "pending",
    energy: 18,
  },
];

export default function Home() {
  const { isSignedIn, user } = useUser();
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    const timer = window.setInterval(() => {
      setCount((prev) => {
        if (prev >= HERO_TITLE.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 42);

    return () => window.clearInterval(timer);
  }, []);

  const title = useMemo(() => HERO_TITLE.slice(0, count), [count]);
  const isTyping = count < HERO_TITLE.length;
  const displayName = user?.firstName || user?.username || "User";
  const avatarChar = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/88 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1360px] items-center gap-4 px-5 py-3 md:px-7">
          <BrandLogo href="/" className="origin-left scale-[0.42] md:scale-[0.46]" />

          <nav className="ml-auto hidden items-center gap-11 pr-2 text-[1.05rem] font-medium text-slate-700 lg:flex">
            <Link className="hover:text-slate-950" href="/dashboard/resume">
              Resume AI
            </Link>
            <Link className="hover:text-slate-950" href={isSignedIn ? "/dashboard/billing" : "/sign-in"}>
              Pricing
            </Link>
            <a className="hover:text-slate-950" href="#about">
              About Us
            </a>
            <Link className="font-semibold text-slate-900 hover:text-blue-600" href={isSignedIn ? "/dashboard" : "/sign-in"}>
              Dashboard
            </Link>
          </nav>

          {!isSignedIn ? (
            <div className="hidden items-center gap-3 md:ml-6 md:flex">
              <Link className="btn btn-outline rounded-2xl px-5 py-2 text-[1.05rem] font-semibold" href="/sign-in">
                Sign In
              </Link>
              <Link
                className="btn rounded-2xl border-0 bg-blue-600 px-6 py-2 text-[1.05rem] font-semibold text-white hover:bg-blue-700"
                href="/sign-up"
              >
                Get Started
              </Link>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="ml-4 hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm transition hover:border-blue-300 md:inline-flex"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-lg font-semibold text-white">
                {avatarChar}
              </span>
              <span className="pr-1 text-xl font-medium">{displayName}</span>
            </Link>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[1360px] px-5 pb-20 pt-8 md:px-7 md:pt-10">
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(560px,1fr)] xl:gap-10">
          <div className="space-y-6 pt-1 md:space-y-7">
            <div className="inline-flex items-center rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
              AI Job Search Operating System
            </div>

            <h1 className="min-h-[160px] max-w-[680px] text-[clamp(2.35rem,5vw,4.25rem)] font-black leading-[1.06] tracking-[-0.02em] text-slate-950 md:min-h-[232px]">
              {title}
              <span
                className={`ml-1 inline-block h-[0.95em] w-[0.08em] translate-y-[0.08em] bg-slate-900 ${
                  isTyping ? "animate-pulse" : "opacity-0"
                }`}
              />
            </h1>

            <p className="max-w-[640px] text-[clamp(1.08rem,1.55vw,1.85rem)] leading-[1.5] text-slate-500">
              One platform for resume intelligence, job targeting, referral momentum, and AI-guided interview preparation.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="btn rounded-full border-0 bg-blue-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
                href="/sign-up"
              >
                Get Started
              </Link>
              <Link
                className="btn rounded-full border-blue-600 bg-white px-7 py-3 text-base font-semibold text-blue-600 hover:bg-blue-50"
                href="/dashboard/resume"
              >
                Try Resume AI for Free
              </Link>
            </div>

            <article className="group relative mt-4 hidden overflow-hidden rounded-[34px] border border-slate-500/40 bg-[#070b16] px-7 py-8 text-white shadow-[0_22px_50px_rgba(2,6,23,0.42)] transition-all duration-300 lg:block">
              <div className="pointer-events-none absolute -inset-[2px] rounded-[36px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute inset-0 rounded-[inherit] bg-[conic-gradient(from_120deg_at_50%_50%,#22d3ee_0deg,#60a5fa_90deg,#a78bfa_170deg,#34d399_250deg,#22d3ee_360deg)]" />
                <div className="absolute inset-0 rounded-[inherit] bg-[conic-gradient(from_120deg_at_50%_50%,#22d3ee_0deg,#60a5fa_90deg,#a78bfa_170deg,#34d399_250deg,#22d3ee_360deg)] opacity-70 blur-md" />
                <div className="absolute inset-[2px] rounded-[34px] bg-[#070b16]" />
              </div>
              <GlowingEffect
                spread={60}
                glow={false}
                disabled={false}
                proximity={120}
                inactiveZone={0.02}
                borderWidth={4}
                movementDuration={0.35}
                className="opacity-0 duration-300 group-hover:opacity-100 group-hover:[filter:saturate(1.2)_brightness(1.2)]"
              />
              <div className="pointer-events-none absolute inset-0 opacity-95">
                <AnimatedShaderBackground />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_26%_24%,rgba(34,211,238,0.18),transparent_36%),radial-gradient(circle_at_78%_68%,rgba(129,140,248,0.2),transparent_40%),linear-gradient(120deg,rgba(2,6,23,0.64),rgba(2,6,23,0.56))]" />

              <div className="relative z-10 max-w-[34rem]">
                <h3 className="text-[clamp(2rem,2.8vw,3.1rem)] font-semibold leading-[1.14] tracking-[-0.01em]">
                  Guide: The Roadmap
                  <br />
                  Your AI Career Playbook
                </h3>
                <p className="mt-4 max-w-[28rem] text-[1.45rem] leading-[1.38] text-blue-50/95">
                  Practical systems for resume upgrades, job targeting, and referral-first outreach.
                </p>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center gap-3 text-[1.55rem] font-medium text-white/95 transition hover:text-white"
                >
                  Read Playbook
                  <span className="text-[1.9rem] leading-none">→</span>
                </button>
              </div>
            </article>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[36px] shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <GlowingEffect spread={40} glow disabled={false} proximity={58} inactiveZone={0.08} borderWidth={2} />
              <div className="h-[530px] w-full overflow-hidden rounded-[36px] border border-slate-800/35 bg-[#0b0f18]">
                <AnimatedShaderBackground />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1.1fr_1fr]">
              <div className="group relative overflow-hidden rounded-[34px] border border-transparent bg-blue-100 px-7 py-6 transition-shadow duration-300 hover:shadow-[0_0_28px_rgba(56,189,248,0.35)]">
                <div className="pointer-events-none absolute -inset-[2px] rounded-[36px] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <div className="absolute inset-0 rounded-[inherit] bg-[conic-gradient(from_120deg_at_50%_50%,#22d3ee_0deg,#60a5fa_90deg,#f472b6_170deg,#a3e635_250deg,#22d3ee_360deg)]" />
                  <div className="absolute inset-0 rounded-[inherit] bg-[conic-gradient(from_120deg_at_50%_50%,#22d3ee_0deg,#60a5fa_90deg,#f472b6_170deg,#a3e635_250deg,#22d3ee_360deg)] opacity-70 blur-sm" />
                  <div className="absolute inset-[2px] rounded-[34px] bg-blue-100" />
                </div>
                <GlowingEffect
                  spread={52}
                  glow={false}
                  disabled={false}
                  proximity={96}
                  inactiveZone={0.02}
                  borderWidth={3}
                  movementDuration={0.35}
                  className="opacity-0 duration-300 group-hover:opacity-100"
                />
                <p className="relative z-10 text-7xl font-black leading-none text-slate-900">100+</p>
                <p className="relative z-10 mt-4 text-[1.55rem] leading-tight text-slate-800">
                  Trusted by fast-moving candidates and career switchers
                </p>
              </div>
              <div className="rounded-[34px] bg-black px-7 py-6 text-white">
                <p className="text-4xl">✦ ✦ ✦</p>
                <p className="mt-4 text-[1.65rem] leading-tight">AI-Powered Career Opportunities</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mt-14 grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <article className="rounded-3xl border border-slate-200 bg-white/88 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.08)] md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">What we sell</p>
            <h2 className="mt-2 text-balance text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
              We sell a faster path from resume draft to interview-ready execution.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
              JobbPin AI is positioned as a "Career Execution Platform": not just a resume tool, but a
              complete operating layer for targeting better roles, improving narrative quality, and increasing
              response rates through structure.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {MARKET_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div key={pillar.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-900">{pillar.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{pillar.description}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-[0_12px_28px_rgba(15,23,42,0.1)]">
            <img
              src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1600&q=80"
              alt="Candidate planning applications with laptop"
              className="h-[290px] w-full rounded-2xl object-cover md:h-[360px]"
            />
            <div className="px-2 pb-2 pt-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Positioning</p>
              <h3 className="mt-1 text-2xl font-semibold leading-tight text-slate-900">
                From chaos to a repeatable job-search system.
              </h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-blue-600" /> Structured steps, measurable progress.</p>
                <p className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-blue-600" /> AI suggestions with human-level control.</p>
                <p className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-blue-600" /> Better alignment between story and role.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-16 overflow-hidden rounded-[2rem] border border-slate-200 shadow-[0_22px_45px_rgba(15,23,42,0.14)]">
          <HeroGeometric
            badge="JobbPin AI Vision"
            title1="From Resume Draft"
            title2="To Interview Ready"
            className="min-h-[68vh]"
          />
        </section>
      </main>

      <Feature108
        badge="Product Modules"
        heading="A Productized AI Career Platform Built for Execution"
        description="Every module is designed to convert effort into outcomes: better resume quality, better role fit, and better interview velocity."
        tabs={FEATURE_TABS}
      />

      <section className="mx-auto mt-2 w-full max-w-[1360px] px-5 pb-16 md:px-7">
        <RadialOrbitalTimeline timelineData={ROADMAP_ITEMS} />
      </section>

      <section id="pricing" className="mx-auto w-full max-w-[1360px] px-5 pb-20 md:px-7">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-[0_14px_34px_rgba(15,23,42,0.09)] md:p-10">
          <p className="mx-auto w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Ready to upgrade your job search?
          </p>
          <h2 className="mx-auto mt-4 max-w-3xl text-balance text-3xl font-semibold leading-tight text-slate-900 md:text-5xl">
            Build a higher-conversion career pipeline with JobbPin AI.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
            Start free, then scale with AI-guided optimization, targeting workflows, and interview readiness tools in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link className="btn btn-primary h-12 rounded-xl px-6 text-base font-semibold" href="/sign-up">
              Start Free
            </Link>
            <Link className="btn btn-outline h-12 rounded-xl px-6 text-base font-semibold" href="/dashboard/billing">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/85">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col items-start justify-between gap-3 px-5 py-6 text-sm text-slate-500 md:flex-row md:items-center md:px-8">
          <p>© {new Date().getFullYear()} JobbPin AI</p>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#about" className="hover:text-slate-900">
              About
            </a>
            <a href="#pricing" className="hover:text-slate-900">
              Pricing
            </a>
            <Link href="/sign-in" className="hover:text-slate-900">
              Sign In
            </Link>
            <Link href="/sign-up" className="hover:text-slate-900">
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

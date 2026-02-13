"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { BrandLogo } from "@/components/brand-logo";

const HERO_TITLE = "Land Your Dream Job Faster with JobbPin AI";

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
    <div className="relative min-h-screen overflow-hidden bg-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-44 top-20 h-96 w-96 rounded-full bg-cyan-300/12 blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
        <div className="absolute right-20 top-40 h-[28rem] w-[28rem] rounded-full bg-blue-400/10 blur-3xl animate-[pulse_13s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 left-1/3 h-[24rem] w-[24rem] rounded-full bg-violet-300/12 blur-3xl animate-[pulse_16s_ease-in-out_infinite]" />
      </div>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
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

      <main className="relative z-10 mx-auto w-full max-w-[1360px] px-5 pb-14 pt-8 md:px-7 md:pt-12">
        <section className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-7 pt-1 md:space-y-8">
            <div className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
              AI Resume Platform
            </div>

            <h1 className="min-h-[170px] max-w-[720px] text-[clamp(2.1rem,5.3vw,4.6rem)] font-black leading-[1.05] tracking-[-0.02em] text-slate-950 md:min-h-[250px]">
              {title}
              <span
                className={`ml-1 inline-block h-[0.95em] w-[0.08em] translate-y-[0.08em] bg-slate-900 ${
                  isTyping ? "animate-pulse" : "opacity-0"
                }`}
              />
            </h1>

            <p className="max-w-[680px] text-[clamp(1.15rem,1.65vw,2rem)] leading-relaxed text-slate-500">
              AI-powered job matching, personalized resume generation, and insider referrals in one workflow.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="btn rounded-full border-0 bg-blue-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700"
                href="/sign-up"
              >
                Get Started
              </Link>
              <Link
                className="btn rounded-full border-blue-600 bg-white px-8 py-3.5 text-lg font-semibold text-blue-600 hover:bg-blue-50"
                href="/dashboard/resume"
              >
                Try Resume AI for Free
              </Link>
            </div>

            <article className="relative mt-4 hidden overflow-hidden rounded-[34px] border border-blue-200 bg-gradient-to-br from-[#2b5bff] via-[#3e6bff] to-[#2a46d1] px-7 py-8 text-white shadow-[0_20px_45px_rgba(37,99,235,0.28)] lg:block">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -right-8 -top-12 h-48 w-56 rounded-full bg-white/20 blur-2xl animate-[pulse_8s_ease-in-out_infinite]" />
                <div className="absolute -left-14 bottom-2 h-44 w-44 rounded-full bg-indigo-200/20 blur-2xl animate-[pulse_7s_ease-in-out_infinite]" />
                <div className="absolute left-1/3 top-1/2 h-56 w-64 -translate-y-1/2 rounded-full border border-white/20 animate-[spin_24s_linear_infinite]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.25),rgba(255,255,255,0)_35%),radial-gradient(circle_at_78%_68%,rgba(196,181,253,0.28),rgba(196,181,253,0)_40%),radial-gradient(circle_at_24%_76%,rgba(165,180,252,0.25),rgba(165,180,252,0)_42%)]" />
              </div>

              <div className="relative z-10 max-w-[34rem]">
                <h3 className="text-[clamp(2.1rem,3vw,3.2rem)] font-semibold leading-[1.15] tracking-[-0.01em]">
                  Guide: The Rotar
                  <br />
                  Your AI Tutorial Hand Book
                </h3>
                <p className="mt-4 max-w-[28rem] text-[1.8rem] leading-[1.35] text-blue-50/95">
                  Every thing you need about the first
                  <br />
                  steps in chatbots.
                </p>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center gap-3 text-[2rem] font-medium text-white/95 transition hover:text-white"
                >
                  Read Article
                  <span className="text-[2.3rem] leading-none">→</span>
                </button>
              </div>
            </article>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[36px] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
              <div className="relative h-[530px] w-full overflow-hidden rounded-[28px] bg-[#d8ecff]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(255,255,255,0.95),rgba(255,255,255,0)_40%),radial-gradient(circle_at_72%_26%,rgba(129,140,248,0.33),rgba(129,140,248,0)_48%),radial-gradient(circle_at_80%_82%,rgba(56,189,248,0.33),rgba(56,189,248,0)_50%),radial-gradient(circle_at_24%_74%,rgba(45,212,191,0.22),rgba(45,212,191,0)_45%)]" />
                <div className="absolute -left-24 top-16 h-96 w-96 rounded-full border border-blue-200/40 animate-[spin_26s_linear_infinite]" />
                <div className="absolute right-[-70px] top-[-40px] h-[22rem] w-[22rem] rounded-full border border-cyan-300/35 animate-[spin_34s_linear_infinite_reverse]" />
                <div className="absolute left-[-120px] bottom-[-140px] h-[25rem] w-[25rem] rounded-full border border-indigo-300/25 animate-[spin_40s_linear_infinite]" />
                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.03)_50%,rgba(255,255,255,0.22)_100%)]" />

                <div className="absolute left-12 top-24 h-44 w-56 rounded-[30px] border border-white/45 bg-white/30 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-md animate-[pulse_7s_ease-in-out_infinite]" />
                <div className="absolute right-14 top-32 h-56 w-72 rounded-[34px] border border-white/45 bg-slate-900/25 shadow-[0_20px_50px_rgba(15,23,42,0.2)] backdrop-blur-sm animate-[pulse_8s_ease-in-out_infinite]" />
                <div className="absolute left-1/2 top-[48%] h-72 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[34px] border border-white/45 bg-white/18 backdrop-blur-lg shadow-[0_20px_60px_rgba(30,41,59,0.2)]" />
                <div className="absolute left-[44%] top-[58%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45 bg-cyan-200/30 shadow-[0_18px_34px_rgba(14,165,233,0.25)] animate-[pulse_4s_ease-in-out_infinite]" />
                <div className="absolute left-[57%] top-[42%] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45 bg-indigo-300/35 shadow-[0_12px_24px_rgba(99,102,241,0.28)] animate-[pulse_5s_ease-in-out_infinite]" />
              </div>
              <div className="pointer-events-none absolute inset-4 rounded-[28px] bg-gradient-to-t from-slate-950/20 via-transparent to-transparent" />

              <div className="absolute left-8 top-8 flex gap-3">
                <span className="rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-900 backdrop-blur">
                  AI Job Agent
                </span>
                <span className="rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-900 backdrop-blur">
                  Resume AI
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[1.1fr_1fr]">
              <div className="rounded-[34px] bg-blue-100 px-7 py-6">
                <p className="text-7xl font-black leading-none text-slate-900">100+</p>
                <p className="mt-4 text-[1.75rem] leading-tight text-slate-800">
                  Trusted By 100+ Companies &amp; Businesses
                </p>
              </div>
              <div className="rounded-[34px] bg-black px-7 py-6 text-white">
                <p className="text-4xl">✦ ✦ ✦</p>
                <p className="mt-4 text-[1.9rem] leading-tight">AI-Powered Career Opportunities</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
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

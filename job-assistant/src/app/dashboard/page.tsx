"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
} from "react";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  Briefcase,
  CircleCheckBig,
  FileText,
  Sparkles,
  Target,
} from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import { computeOnboardingSignals } from "@/lib/onboarding";
import type { GlobalStatus } from "@/lib/status";
import type {
  ProfileRecord,
  ResumeRecord,
  SubscriptionRecord,
} from "@/types/shared";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;
const CHAT_SUGGESTIONS = [
  "帮我生成一版软件工程师求职计划",
  "根据当前进度，我下一步最重要的动作是什么？",
  "给我 5 个可以直接复制的投递跟进话术",
];

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ChatResponse {
  reply: string;
}

type JourneyState = "done" | "current" | "locked";

function stateStyles(state: JourneyState) {
  if (state === "done") {
    return {
      card: "border-emerald-200 bg-emerald-50/75",
      badge: "bg-emerald-100 text-emerald-700",
      node: "border-emerald-500 bg-emerald-100 text-emerald-700",
      line: "bg-emerald-400",
    };
  }
  if (state === "current") {
    return {
      card: "border-blue-300 bg-blue-50/80 shadow-[0_8px_20px_rgba(59,130,246,0.12)]",
      badge: "bg-blue-100 text-blue-700",
      node: "border-blue-500 bg-blue-100 text-blue-700",
      line: "bg-blue-300",
    };
  }
  return {
    card: "border-slate-200 bg-slate-50/70",
    badge: "bg-slate-200 text-slate-500",
    node: "border-slate-300 bg-slate-100 text-slate-500",
    line: "bg-slate-300",
  };
}

function readinessTone(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 40) return "text-blue-600";
  return "text-amber-600";
}

function readinessCopy(score: number) {
  if (score >= 80) return "Great momentum. You are almost ready to apply.";
  if (score >= 40) return "Strong start. Complete the next critical step this week.";
  return "Foundation stage. Focus on profile and subscription first.";
}

export default function DashboardOverviewPage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Loading dashboard data...");

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi ${user?.firstName || "there"}! 👋 What can I help you with?`,
    },
  ]);

  const userName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    user?.fullName ||
    user?.firstName ||
    "JobbPin user";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "No email yet";

  const chatListRef = useRef<HTMLDivElement | null>(null);

  const refreshDashboard = useCallback(async () => {
    setStatus("loading");
    setMessage("Loading dashboard data...");

    try {
      const [profileData, onboarding] = await Promise.all([
        apiFetch<ProfileRecord>(`/profile/${userId}`),
        computeOnboardingSignals(userId),
      ]);

      setProfile(profileData);
      setResume(onboarding.resume);
      setSubscription(onboarding.subscription);

      const hasAnyData = Boolean(
        profileData.targetRole?.trim() ||
          profileData.firstName?.trim() ||
          onboarding.resume?.id ||
          onboarding.subscription.status === "active",
      );

      setStatus(hasAnyData ? "success" : "empty");
      setMessage(hasAnyData ? "Dashboard loaded." : "No data yet. Start your journey below.");
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to load dashboard data.");
    }
  }, [userId]);

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) return;
    void refreshDashboard();
  }, [isLoaded, refreshDashboard, user]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  const signals = useMemo(() => {
    const profileCompleted = Boolean(profile?.isCompleted);
    const subscriptionActive = subscription?.status === "active";
    const resumeUploaded = Boolean(resume?.id);
    const resumeImproved = resumeUploaded;
    const readyForApply = profileCompleted && subscriptionActive && resumeUploaded;

    return {
      profileCompleted,
      subscriptionActive,
      resumeUploaded,
      resumeImproved,
      readyForApply,
    };
  }, [profile?.isCompleted, resume?.id, subscription?.status]);

  const steps = useMemo(
    () => [
      {
        key: "profile",
        index: 1,
        title: "Fill profile",
        description: "Complete target role and personal details",
        href: "/onboarding/step-1",
        state: (signals.profileCompleted ? "done" : "current") as JourneyState,
      },
      {
        key: "subscription",
        index: 2,
        title: "Subscription",
        description: "Activate monthly plan from billing",
        href: "/dashboard/billing",
        state: (signals.subscriptionActive
          ? "done"
          : signals.profileCompleted
            ? "current"
            : "locked") as JourneyState,
      },
      {
        key: "upload",
        index: 3,
        title: "Upload resume",
        description: "Upload PDF and parse structured details",
        href: "/dashboard/resume",
        state: (signals.resumeUploaded
          ? "done"
          : signals.profileCompleted
            ? "current"
            : "locked") as JourneyState,
      },
      {
        key: "improve",
        index: 4,
        title: "Improve resume",
        description: "Use AI tips to refine sections and keywords",
        href: "/dashboard/resume",
        state: (signals.resumeImproved
          ? "done"
          : signals.resumeUploaded
            ? "current"
            : "locked") as JourneyState,
      },
      {
        key: "ready",
        index: 5,
        title: "Ready for apply",
        description: "Everything is prepared for applications",
        href: "/dashboard/resume",
        state: (signals.readyForApply ? "done" : "locked") as JourneyState,
      },
    ],
    [signals],
  );

  const completedCount = steps.filter((s) => s.state === "done").length;
  const progressPct = Math.round((completedCount / steps.length) * 100);
  const readinessScore = progressPct;

  const canSend = useMemo(
    () => chatInput.trim().length > 0 && !chatLoading,
    [chatInput, chatLoading],
  );

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const next = [...chatMessages, { role: "user" as const, content: text }];
    setChatMessages(next);
    setChatInput("");
    setChatLoading(true);

    try {
      const data = await apiFetch<ChatResponse>("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: text,
          history: next.slice(-CHAT_HISTORY_LIMIT).map((item) => ({
            role: item.role,
            content: item.content.slice(0, CHAT_HISTORY_ITEM_MAX_CHARS),
          })),
        }),
      });

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No response." },
      ]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Chat request failed: ${(error as Error).message}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const onChatKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) void sendChat();
    }
  };

  const kpis = [
    {
      label: "Profile",
      value: signals.profileCompleted ? "Completed" : "Pending",
      hint: signals.profileCompleted ? "Target role ready" : "Need role + basics",
      tone: signals.profileCompleted ? "text-emerald-600" : "text-amber-600",
      icon: Target,
    },
    {
      label: "Subscription",
      value: signals.subscriptionActive ? "Active" : "Inactive",
      hint: subscription?.plan ? `${subscription.plan} plan` : "Choose a plan",
      tone: signals.subscriptionActive ? "text-emerald-600" : "text-amber-600",
      icon: Briefcase,
    },
    {
      label: "Resume",
      value: signals.resumeUploaded ? "Parsed" : "Not uploaded",
      hint: signals.resumeUploaded ? "AI-ready profile" : "Upload PDF",
      tone: signals.resumeUploaded ? "text-emerald-600" : "text-blue-600",
      icon: FileText,
    },
    {
      label: "Readiness",
      value: `${readinessScore}%`,
      hint: readinessCopy(readinessScore),
      tone: readinessTone(readinessScore),
      icon: CircleCheckBig,
    },
  ];

  return (
    <div className="relative space-y-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-180px] top-[12%] h-[560px] w-[560px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.08),rgba(99,102,241,0)_72%)]" />
        <div className="absolute right-[-220px] top-[8%] h-[580px] w-[580px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.08),rgba(56,189,248,0)_72%)] [animation-delay:2.8s]" />
        <div className="absolute left-1/3 top-[45%] h-[420px] w-[420px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.07),rgba(16,185,129,0)_72%)] [animation-delay:5.2s]" />
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/88 p-5 shadow-[0_20px_45px_rgba(30,41,59,0.07)] backdrop-blur-sm md:p-6">
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <div className="absolute -left-16 top-4 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.2),rgba(99,102,241,0)_72%)]" />
          <div className="absolute right-[-80px] bottom-[-90px] h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.2),rgba(56,189,248,0)_72%)]" />
        </div>

        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Product Command Center
            </div>

            <div>
              <h1 className="text-[clamp(2rem,3.7vw,3.15rem)] font-bold leading-[1.08] text-slate-900">
                Build a repeatable job search engine, not a one-off attempt.
              </h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600 md:text-[17px]">
                Track your execution from profile setup to resume optimization, subscription status,
                and final application readiness in one operational dashboard.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Link
                href="/dashboard/resume"
                className="inline-flex items-center justify-center rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Improve Resume
              </Link>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Manage Plan
              </Link>
              <Link
                href="/onboarding/step-1"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Edit Profile
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {kpis.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.label}
                  className="rounded-2xl border border-slate-200/85 bg-white/90 px-4 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <p className={`mt-2 text-xl font-bold ${item.tone}`}>{item.value}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.hint}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="relative space-y-4 overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_14px_30px_rgba(59,130,246,0.08)] md:p-6">
          <div className="relative z-10 space-y-4">
            <StatusBanner status={status} message={message} />

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Name</p>
                <p className="mt-1 truncate text-base font-semibold text-slate-900">{userName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Email</p>
                <p className="mt-1 truncate text-sm text-slate-700">{userEmail}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Target role</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-800">
                  {profile?.targetRole || "Not set yet"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Subscription</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-800">
                  {subscription?.status || "incomplete"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[clamp(1.9rem,3.2vw,2.85rem)] font-bold leading-[1.1] text-slate-900">
                    Your Job Search Journey
                  </h2>
                  <p className="mt-1 text-[15px] text-slate-500 md:text-[17px]">
                    Complete each milestone to move from preparation to confident applying.
                  </p>
                </div>

                <div className="w-full max-w-[430px] rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="text-slate-600">
                      <span className="font-semibold text-emerald-600">{completedCount}</span> of {steps.length} steps completed
                    </p>
                    <p className={`font-semibold ${readinessTone(readinessScore)}`}>{readinessScore}%</p>
                  </div>
                  <div className="mt-2 h-3 w-full rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{readinessCopy(readinessScore)}</p>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 w-full max-w-[1120px]">
              {steps.map((step, idx) => {
                const styles = stateStyles(step.state);
                const isLocked = step.state === "locked";

                return (
                  <div key={step.key} className="relative pl-[72px]">
                    <div className="absolute left-2 top-3 flex w-10 flex-col items-center">
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-semibold ${styles.node}`}
                      >
                        {step.state === "done" ? "✓" : step.index}
                      </span>
                      {idx < steps.length - 1 ? (
                        <>
                          <span className={`mt-1 h-7 w-1 rounded-full ${styles.line}`} />
                          <span
                            className={`text-base ${step.state === "locked" ? "text-slate-400" : "text-emerald-500"}`}
                          >
                            ↓
                          </span>
                        </>
                      ) : null}
                    </div>

                    <Link
                      href={isLocked ? "#" : step.href}
                      onClick={(event) => {
                        if (isLocked) event.preventDefault();
                      }}
                      className={`mb-3 block rounded-2xl border px-5 py-4 transition ${styles.card}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[24px] font-semibold leading-tight text-slate-900 md:text-[28px]">
                            {step.title}
                          </p>
                          <p className="mt-1 text-[15px] leading-relaxed text-slate-500">{step.description}</p>
                        </div>

                        <span
                          className={`mt-1 rounded-full px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] ${styles.badge}`}
                        >
                          {step.state === "done" ? "Done" : step.state === "current" ? "Now" : "Locked"}
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-white/92 xl:sticky xl:top-24 xl:h-[calc(100vh-120px)] xl:min-h-[600px]">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[2rem] font-bold leading-tight text-slate-900">AI Career Assistant</h3>
                  <p className="text-[15px] text-slate-500">Planning, prioritization, and resume strategy</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <Bot className="h-3 w-3" />
                  Online
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {CHAT_SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setChatInput(prompt)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div ref={chatListRef} className="flex-1 space-y-3 overflow-auto px-4 py-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`rounded-2xl border px-4 py-3 text-[15px] leading-relaxed ${
                    msg.role === "user"
                      ? "ml-5 border-blue-200 bg-blue-50 text-slate-900"
                      : "mr-5 border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading ? (
                <div className="mr-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Thinking...
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-4 py-3.5">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={onChatKeyDown}
                rows={3}
                placeholder="Ask me anything about your resume or job strategy..."
                className="w-full min-h-[94px] resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={!canSend}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

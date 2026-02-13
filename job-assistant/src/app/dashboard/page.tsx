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
      card: "border-emerald-200 bg-emerald-50/70",
      badge: "bg-emerald-100 text-emerald-700",
      node: "border-emerald-500 bg-emerald-100 text-emerald-700",
      line: "bg-emerald-400",
    };
  }
  if (state === "current") {
    return {
      card: "border-blue-300 bg-blue-50/75 shadow-[0_8px_20px_rgba(59,130,246,0.12)]",
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
    "Jobbpin user";
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

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-180px] top-[18%] h-[520px] w-[520px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08),rgba(59,130,246,0)_72%)]" />
        <div className="absolute right-[-220px] top-[8%] h-[560px] w-[560px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.07),rgba(16,185,129,0)_72%)] [animation-delay:2.6s]" />
        <div className="absolute left-1/3 top-[45%] h-[420px] w-[420px] animate-aurora rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.07),rgba(99,102,241,0)_72%)] [animation-delay:5.2s]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="relative space-y-4 overflow-hidden rounded-3xl border border-blue-100/80 bg-white p-5 shadow-[0_14px_30px_rgba(59,130,246,0.08)] md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-28">
          <div className="absolute -left-20 top-10 h-52 w-52 animate-aurora rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.22),rgba(56,189,248,0)_70%)]" />
          <div className="absolute right-[-60px] top-24 h-64 w-64 animate-aurora rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.16),rgba(99,102,241,0)_70%)] [animation-delay:2.5s]" />
          <div className="absolute bottom-[-70px] left-1/3 h-56 w-56 animate-aurora rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.12),rgba(16,185,129,0)_70%)] [animation-delay:5s]" />
        </div>

        <div className="relative z-10">
          <StatusBanner status={status} message={message} />

          <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{profile?.targetRole || "Not set yet"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Subscription</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-800">{subscription?.status || "incomplete"}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
            <div>
              <h2 className="text-[38px] font-bold leading-tight text-slate-900 md:text-[44px]">Your Job Search Journey</h2>
              <p className="mt-1 text-[16px] text-slate-500 md:text-[18px]">Complete each step to land your dream job</p>
            </div>

            <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
              <p className="text-[15px] text-slate-600">
                <span className="font-semibold text-emerald-600">{completedCount}</span> of {steps.length} steps completed
              </p>
              <div className="mt-2 h-3 w-full rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 w-full max-w-[1120px]">
            {steps.map((step, idx) => {
              const styles = stateStyles(step.state);
              const isLocked = step.state === "locked";

              return (
                <div key={step.key} className="relative pl-[76px]">
                  <div className="absolute left-3 top-3 flex w-10 flex-col items-center">
                    <span
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-base font-semibold ${styles.node}`}
                    >
                      {step.state === "done" ? "✓" : step.index}
                    </span>
                    {idx < steps.length - 1 ? (
                      <>
                        <span className={`mt-1 h-7 w-1 rounded-full ${styles.line}`} />
                        <span className={`text-base ${step.state === "locked" ? "text-slate-400" : "text-emerald-500"}`}>
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
                    className={`mb-3 block rounded-2xl border px-5 py-3.5 transition ${styles.card}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[28px] font-semibold leading-tight text-slate-900 md:text-[32px]">{step.title}</p>
                        <p className="mt-1 text-[15px] text-slate-500 md:text-[16px]">{step.description}</p>
                      </div>

                      <span
                        className={`mt-1 rounded-full px-4 py-1.5 text-[13px] font-semibold uppercase tracking-wide ${styles.badge}`}
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

      <aside className="sticky top-[82px] h-[calc(100vh-96px)] min-h-[620px] rounded-3xl border border-slate-200 bg-white">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[25px] font-bold text-slate-900">AI Career Assistant</h3>
                <p className="text-sm text-slate-500">Your smart job search partner</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Online
              </span>
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

          <div className="border-t border-slate-200 px-4 py-3">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={onChatKeyDown}
              rows={2}
              placeholder="Ask me anything about your resume..."
              className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => void sendChat()}
              disabled={!canSend}
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </aside>
    </div>
    </div>
  );
}

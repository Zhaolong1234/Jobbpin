"use client";

import Link from "next/link";
import {
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
  Check,
  Clock3,
  CreditCard,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { apiFetch } from "@/lib/api";
import {
  DEV_USER_ID,
  STRIPE_PRICE_ID,
  STRIPE_PRICE_ID_MONTHLY,
  STRIPE_PRICE_ID_WEEKLY,
  STRIPE_PRICE_ID_YEARLY,
} from "@/lib/config";
import { computeOnboardingSignals } from "@/lib/onboarding";
import type { GlobalStatus } from "@/lib/status";
import type { SubscriptionRecord } from "@/types/shared";

interface CheckoutResponse {
  url: string;
}

interface ChatResponse {
  reply: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

type BillingCycle = "weekly" | "monthly" | "yearly";

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;
const ASSISTANT_HINTS = [
  "我适合 monthly 还是 yearly？",
  "怎么最大化简历优化价值？",
  "先试用还是直接年付更划算？",
];

export default function BillingPage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [voucherCode, setVoucherCode] = useState("");
  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [message, setMessage] = useState("Loading subscription data...");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi ${user?.firstName || "there"}! 👋 Need help choosing a plan?`,
    },
  ]);
  const chatListRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    setStatus("loading");
    setMessage("Loading subscription data...");

    try {
      const { signals, subscription: subscriptionData } = await computeOnboardingSignals(userId);
      setSubscription(subscriptionData);
      setProfileCompleted(signals.profileCompleted);

      if (!subscriptionData?.currentPeriodEnd) {
        setStatus("empty");
        setMessage("No active subscription yet. You can start checkout below.");
      } else {
        setStatus("success");
        setMessage("Subscription loaded.");
      }
    } catch (error) {
      setSubscription({ plan: "free", status: "incomplete" });
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to load subscription.");
    }
  };

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) return;
    void refresh();
  }, [isLoaded, user, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkoutState = new URLSearchParams(window.location.search).get("checkout");

    if (checkoutState === "success") {
      setStatus("success");
      setMessage(
        "Checkout returned successfully. Webhook may take a few seconds to update status.",
      );
    }
    if (checkoutState === "cancel") {
      setStatus("parse_failed");
      setMessage("Checkout was canceled.");
    }
  }, []);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  const selectedPriceId = useMemo(() => {
    if (billingCycle === "weekly") return STRIPE_PRICE_ID_WEEKLY || STRIPE_PRICE_ID;
    if (billingCycle === "yearly") return STRIPE_PRICE_ID_YEARLY || STRIPE_PRICE_ID;
    return STRIPE_PRICE_ID_MONTHLY || STRIPE_PRICE_ID;
  }, [billingCycle]);

  const hasSubscribedBefore = useMemo(() => {
    if (!subscription) return false;
    return ["trialing", "active", "past_due", "canceled"].includes(subscription.status);
  }, [subscription]);

  const trialEligible = billingCycle === "weekly" && !hasSubscribedBefore;

  const cycleMeta = useMemo(() => {
    if (billingCycle === "weekly") {
      return {
        title: "Weekly",
        price: "$5",
        cycleLabel: "per week",
        description: trialEligible
          ? "Includes 7-day trial for first-time weekly subscribers"
          : "Fast launch option for short-term intensive job search",
      };
    }
    if (billingCycle === "yearly") {
      return {
        title: "Yearly",
        price: "$200",
        cycleLabel: "per year",
        description: "Best long-term value for ongoing applications and interview prep",
      };
    }
    return {
      title: "Monthly",
      price: "$19",
      cycleLabel: "per month",
      description: "Balanced option for steady weekly job search execution",
    };
  }, [billingCycle, trialEligible]);

  const planStatusText = (subscription?.status || "incomplete").toUpperCase();
  const currentPlanText = subscription?.plan || "Free";
  const periodText = subscription?.currentPeriodEnd
    ? `Until ${subscription.currentPeriodEnd}`
    : "No billing period yet";

  const startCheckout = async (trialDays?: number) => {
    if (!profileCompleted) {
      setStatus("parse_failed");
      setMessage("Please complete onboarding profile details before billing.");
      return;
    }

    if (!selectedPriceId || selectedPriceId === "price_placeholder") {
      setStatus("parse_failed");
      setMessage("Missing Stripe price id env for selected plan.");
      return;
    }

    setPaying(true);
    setStatus("loading");
    setMessage("Creating Stripe checkout session...");

    try {
      const payload = {
        userId,
        priceId: selectedPriceId,
        successUrl: `${window.location.origin}/dashboard/billing?checkout=success`,
        cancelUrl: `${window.location.origin}/dashboard/billing?checkout=cancel`,
        trialDays,
      };

      const data = await apiFetch<CheckoutResponse>("/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      window.location.href = data.url;
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to create checkout session.");
      setPaying(false);
    }
  };

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

  if (HAS_CLERK && !isLoaded) {
    return <p className="text-sm text-slate-600">Loading user session...</p>;
  }

  if (HAS_CLERK && !user) {
    return (
      <section className="panel">
        <div className="panel-body space-y-3">
          <h2 className="text-xl font-bold">Please sign in first</h2>
          <p className="text-sm text-slate-600">Billing requires an authenticated session.</p>
          <div className="flex gap-2">
            <Link className="btn btn-primary" href="/sign-in">
              Sign in
            </Link>
            <Link className="btn btn-outline" href="/sign-up">
              Sign up
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="relative space-y-4 overflow-hidden rounded-3xl border border-blue-100/80 bg-white/90 p-5 shadow-[0_14px_30px_rgba(59,130,246,0.08)] md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-20 top-10 h-52 w-52 animate-aurora rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.2),rgba(56,189,248,0)_70%)]" />
          <div className="absolute right-[-60px] top-24 h-64 w-64 animate-aurora rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.14),rgba(99,102,241,0)_70%)] [animation-delay:2.5s]" />
        </div>

        <div className="relative z-10 space-y-4">
          <StatusBanner status={status} message={message} />

          <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Pricing Control
                </div>
                <h2 className="mt-3 text-[clamp(1.95rem,3.2vw,2.8rem)] font-bold leading-[1.1] text-slate-900">
                  Subscription and Billing
                </h2>
                <p className="mt-1 text-[15px] text-slate-500 md:text-[17px]">
                  Choose the best plan for your job search speed and optimization depth.
                </p>
              </div>

              <div className="flex rounded-full border border-slate-200 bg-white p-1">
                {(["weekly", "monthly", "yearly"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      billingCycle === cycle
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Current Plan</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{currentPlanText}</p>
              <p className="mt-1 text-sm text-slate-500">Status: {planStatusText}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Billing Period</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{periodText}</p>
              <p className="mt-1 text-sm text-slate-500">Auto-renew based on selected cycle</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Selected Offer</p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {cycleMeta.price}
                <span className="ml-1 text-sm font-medium text-slate-500">{cycleMeta.cycleLabel}</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">{cycleMeta.title} billing cycle</p>
            </article>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.05fr_1fr]">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800">
              Voucher support is available for partner campaigns and enterprise onboarding.
            </div>
            <input
              value={voucherCode}
              onChange={(event) => setVoucherCode(event.target.value)}
              placeholder="Voucher code"
              className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <GlowingEffect
              spread={38}
              glow
              disabled={false}
              proximity={56}
              inactiveZone={0.08}
              borderWidth={2}
            />
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-[1.95rem] font-bold leading-tight text-slate-900">Plan Options</h3>
              <p className="mt-1 text-slate-500">Pick your mode: lean validation or full-scale execution.</p>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/55 p-5">
                <GlowingEffect
                  spread={34}
                  glow
                  disabled={false}
                  proximity={52}
                  inactiveZone={0.06}
                  borderWidth={2}
                />
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Entry
                </div>
                <h4 className="mt-3 text-[1.75rem] font-bold leading-tight text-slate-900">Explorer (Free)</h4>
                <p className="mt-2 text-slate-500">For initial setup and basic platform evaluation.</p>
                <p className="mt-5 text-[2.5rem] font-bold leading-none text-slate-900">
                  $0
                  <span className="ml-1 text-lg font-medium text-slate-500">always</span>
                </p>
                <ul className="mt-5 space-y-2 text-slate-700">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Basic job search workflow</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Limited resume parsing usage</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Core dashboard access</li>
                </ul>
                <button
                  type="button"
                  className="mt-6 h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
                  disabled
                >
                  Current free plan
                </button>
              </article>

              <article className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-5">
                <GlowingEffect
                  spread={34}
                  glow
                  disabled={false}
                  proximity={52}
                  inactiveZone={0.06}
                  borderWidth={2}
                />
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700">
                  <Rocket className="h-3.5 w-3.5" />
                  Recommended
                </div>
                <h4 className="mt-3 text-[1.75rem] font-bold leading-tight text-slate-900">Growth Plan ({cycleMeta.title})</h4>
                <p className="mt-2 text-slate-600">{cycleMeta.description}</p>
                <p className="mt-5 text-[2.5rem] font-bold leading-none text-slate-900">
                  {cycleMeta.price}
                  <span className="ml-1 text-lg font-medium text-slate-500">{cycleMeta.cycleLabel}</span>
                </p>
                <ul className="mt-5 space-y-2 text-slate-700">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Advanced AI resume optimization</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Priority matching + strategy guidance</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" />Assistant support for interview prep</li>
                </ul>
                <button
                  type="button"
                  className="mt-6 inline-flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void startCheckout(trialEligible ? 7 : undefined)}
                  disabled={paying}
                >
                  {paying
                    ? "Redirecting..."
                    : trialEligible && billingCycle === "weekly"
                      ? "Start 7-Day Trial"
                      : billingCycle === "weekly"
                        ? "Subscribe Weekly"
                        : billingCycle === "yearly"
                          ? "Subscribe Yearly"
                          : "Subscribe Monthly"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            </div>
          </section>

          <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Onboarding</div>
              <p className="mt-2 text-sm text-slate-700">
                {profileCompleted ? "Profile complete. Ready for checkout." : "Complete onboarding profile before payment."}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Payment</div>
              <p className="mt-2 text-sm text-slate-700">Secure checkout via Stripe. You can cancel anytime.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Support</div>
              <p className="mt-2 text-sm text-slate-700">Ask AI assistant for recommendation based on your goal and timeline.</p>
            </div>
          </section>

          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => {
              void refresh();
            }}
            disabled={paying}
          >
            <Clock3 className="h-4 w-4" />
            Refresh subscription
          </button>
        </div>
      </section>

      <aside className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/92 xl:sticky xl:top-24 xl:h-[calc(100vh-120px)] xl:min-h-[560px]">
        <GlowingEffect
          spread={42}
          glow
          disabled={false}
          proximity={60}
          inactiveZone={0.12}
          borderWidth={2}
        />
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-3xl font-bold text-slate-900">AI Billing Assistant</h3>
                <p className="text-[15px] text-slate-500">Get plan recommendations by job-search intensity</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                <Bot className="h-3 w-3" />
                Online
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ASSISTANT_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setChatInput(hint)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  {hint}
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
              placeholder="Ask me anything about pricing and plan strategy..."
              className="w-full min-h-[94px] resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => void sendChat()}
              disabled={!canSend}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
              <CreditCard className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

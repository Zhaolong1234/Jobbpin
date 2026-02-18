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
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
  CreditCard,
  Download,
  LayoutTemplate,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { GradualSpacing } from "@/components/ui/gradual-spacing";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
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
type PlanKind = "free" | BillingCycle;

const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;
const ASSISTANT_HINTS = [
  "Should I choose monthly or yearly?",
  "How can I maximize resume optimization value?",
  "Is trial-first better than committing to yearly?",
];

interface PlanCard {
  id: PlanKind;
  title: string;
  subtitle: string;
  price: string;
  priceSuffix: string;
  isFree?: boolean;
}

const parsePlanAmount = (price: string) => {
  const parsed = Number(price.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toPlanLabel = (plan?: string) => {
  const raw = (plan || "").trim();
  if (!raw || raw.toLowerCase() === "free") return "Explorer (Free)";

  if (raw === STRIPE_PRICE_ID_WEEKLY || /week|weekly/i.test(raw)) {
    return "Growth Plan (Weekly)";
  }
  if (raw === STRIPE_PRICE_ID_MONTHLY || /month|monthly/i.test(raw)) {
    return "Growth Plan (Monthly)";
  }
  if (raw === STRIPE_PRICE_ID_YEARLY || /year|yearly|annual/i.test(raw)) {
    return "Growth Plan (Yearly)";
  }

  if (/^price_/i.test(raw)) {
    return "Growth Plan";
  }
  return raw;
};

export default function BillingPage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle | null>(null);
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
  const planCarouselRef = useRef<HTMLDivElement | null>(null);

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

  const hasSubscribedBefore = useMemo(() => {
    if (!subscription) return false;
    return ["trialing", "active", "past_due", "canceled"].includes(subscription.status);
  }, [subscription]);

  const cancelScheduled = Boolean(subscription?.cancelAtPeriodEnd);
  const canCancelAutoRenew = useMemo(() => {
    if (!subscription) return false;
    if (subscription.cancelAtPeriodEnd) return false;
    return ["trialing", "active", "past_due"].includes(subscription.status);
  }, [subscription]);

  const getPriceIdByCycle = (cycle: BillingCycle) => {
    if (cycle === "weekly") return STRIPE_PRICE_ID_WEEKLY || STRIPE_PRICE_ID;
    if (cycle === "yearly") return STRIPE_PRICE_ID_YEARLY || STRIPE_PRICE_ID;
    return STRIPE_PRICE_ID_MONTHLY || STRIPE_PRICE_ID;
  };

  const getCycleMeta = (cycle: BillingCycle) => {
    if (cycle === "weekly") {
      return {
        title: "Weekly",
        price: "$5",
        cycleLabel: "per week",
        description: !hasSubscribedBefore
          ? "Includes a 7-day trial for first-time weekly subscribers."
          : "Fast launch option for short-term intensive job search.",
      };
    }
    if (cycle === "yearly") {
      return {
        title: "Yearly",
        price: "$200",
        cycleLabel: "per year",
        description: "Best long-term value for ongoing applications and interview prep.",
      };
    }
    return {
      title: "Monthly",
      price: "$19",
      cycleLabel: "per month",
      description: "Balanced option for steady weekly job search execution.",
    };
  };

  const cycleMeta = useMemo(
    () => (selectedCycle ? getCycleMeta(selectedCycle) : null),
    [selectedCycle, hasSubscribedBefore],
  );

  const planCards = useMemo<PlanCard[]>(
    () => [
      {
        id: "free",
        title: "Explorer (Free)",
        subtitle: "For initial setup and basic platform evaluation.",
        price: "$0",
        priceSuffix: "always",
        isFree: true,
      },
      {
        id: "weekly",
        title: "Growth Plan (Weekly)",
        subtitle: getCycleMeta("weekly").description,
        price: "$5",
        priceSuffix: "per week",
      },
      {
        id: "monthly",
        title: "Growth Plan (Monthly)",
        subtitle: getCycleMeta("monthly").description,
        price: "$19",
        priceSuffix: "per month",
      },
      {
        id: "yearly",
        title: "Growth Plan (Yearly)",
        subtitle: getCycleMeta("yearly").description,
        price: "$200",
        priceSuffix: "per year",
      },
    ],
    [hasSubscribedBefore],
  );

  const visiblePlans = useMemo(() => {
    if (!selectedCycle) return planCards;
    return planCards.filter((plan) => plan.id === selectedCycle);
  }, [planCards, selectedCycle]);

  const scrollPlans = (direction: "left" | "right") => {
    const node = planCarouselRef.current;
    if (!node) return;
    const firstCard = node.querySelector<HTMLElement>("[data-plan-card='true']");
    const gapValue = getComputedStyle(node).gap || "16px";
    const gap = Number.parseFloat(gapValue) || 16;
    const amount = firstCard
      ? Math.round(firstCard.getBoundingClientRect().width + gap)
      : Math.max(340, Math.round(node.clientWidth * 0.82));
    node.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const node = planCarouselRef.current;
    if (!node) return;
    node.scrollTo({ left: 0, behavior: "auto" });
  }, [selectedCycle, visiblePlans.length]);

  const getSubscribeCta = (cycle: BillingCycle) => {
    const isWeeklyTrial = cycle === "weekly" && !hasSubscribedBefore;
    if (isWeeklyTrial) return "Start 7-Day Trial";
    if (cycle === "weekly") return "Subscribe Weekly";
    if (cycle === "yearly") return "Subscribe Yearly";
    return "Subscribe Monthly";
  };

  const planStatusText = (subscription?.status || "incomplete").toUpperCase();
  const currentPlanText = toPlanLabel(subscription?.plan);
  const isRenewableStatus = subscription
    ? ["trialing", "active", "past_due"].includes(subscription.status)
    : false;
  const isCanceledStatus = subscription?.status === "canceled";
  const periodText = subscription?.currentPeriodEnd
    ? `Until ${subscription.currentPeriodEnd}`
    : "No billing period yet";
  const autoRenewText = !subscription?.currentPeriodEnd
    ? "No active billing period."
    : cancelScheduled
      ? "Auto-renew is OFF. Plan ends at current period end."
      : isRenewableStatus
        ? "Auto-renew is ON based on your active subscription."
        : isCanceledStatus
          ? "Subscription is canceled. No future renewals."
          : "No active auto-renew setting.";
  const selectedOfferText = cycleMeta
    ? `${cycleMeta.price} ${cycleMeta.cycleLabel}`
    : "All plans visible";
  const selectedOfferSubText = cycleMeta
    ? `${cycleMeta.title} billing cycle selected`
    : "No cycle selected. Showing all plan options.";

  const startCheckout = async (cycle: BillingCycle) => {
    if (!profileCompleted) {
      setStatus("parse_failed");
      setMessage("Please complete onboarding profile details before billing.");
      return;
    }

    const selectedPriceId = getPriceIdByCycle(cycle);
    const trialDays = cycle === "weekly" && !hasSubscribedBefore ? 7 : undefined;

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

  const cancelAutoRenew = async () => {
    if (!subscription) return;
    if (!canCancelAutoRenew) {
      setStatus("parse_failed");
      setMessage("No renewable active subscription found for cancellation.");
      return;
    }

    const confirmed = window.confirm(
      "Turn off auto-renew? Your current plan will stay active until the current period ends.",
    );
    if (!confirmed) return;

    setCanceling(true);
    setStatus("loading");
    setMessage("Updating auto-renew settings...");

    try {
      const data = await apiFetch<SubscriptionRecord>(`/subscription/${userId}/cancel`, {
        method: "POST",
      });
      setSubscription(data);
      setStatus("success");
      setMessage(
        "Auto-renew has been disabled. Your plan remains active until current period end.",
      );
    } catch (error) {
      setStatus("parse_failed");
      setMessage((error as Error).message || "Failed to disable auto-renew.");
    } finally {
      setCanceling(false);
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

          <motion.div
            initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 md:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Pricing Control
                </div>
                <div className="mt-3">
                  <GradualSpacing
                    text="Subscription and Billing"
                    duration={0.32}
                    delayMultiple={0.015}
                    className="text-[clamp(1.95rem,3.2vw,2.8rem)] font-bold leading-[1.1] text-slate-900"
                  />
                </div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.12 }}
                  className="mt-1 text-[15px] text-slate-500 md:text-[17px]"
                >
                  Choose the best plan for your job search speed and optimization depth.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="flex rounded-full border border-slate-200 bg-white p-1"
              >
                {(["weekly", "monthly", "yearly"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() =>
                      setSelectedCycle((prev) => (prev === cycle ? null : cycle))
                    }
                    className="relative rounded-full px-4 py-2 text-sm font-semibold transition"
                  >
                    {selectedCycle === cycle ? (
                      <motion.span
                        layoutId="billing-period-pill"
                        className="absolute inset-0 rounded-full bg-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
                        transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      />
                    ) : null}
                    <span
                      className={`relative z-10 ${
                        selectedCycle === cycle
                          ? "text-white"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                    </span>
                  </button>
                ))}
              </motion.div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {selectedCycle
                ? `Filtering plan carousel by ${selectedCycle}. Click the same tab again to show all plans.`
                : "No cycle selected: all plans are visible in the carousel below."}
            </p>
          </motion.div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Current Plan</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{currentPlanText}</p>
              <p className="mt-1 text-sm text-slate-500">Status: {planStatusText}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Billing Period</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{periodText}</p>
              <p className="mt-1 text-sm text-slate-500">{autoRenewText}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Selected Offer</p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {selectedOfferText}
              </p>
              <p className="mt-1 text-sm text-slate-500">{selectedOfferSubText}</p>
            </article>
          </div>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/75 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <XCircle className="h-4 w-4" />
                  Manage Auto-Renew
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {cancelScheduled
                    ? "Cancellation is already scheduled. No further charges after current period."
                    : canCancelAutoRenew
                      ? "You can cancel now to stop renewal at the end of current billing period."
                      : isCanceledStatus
                        ? "This subscription is already canceled."
                        : "No renewable active subscription found."}
                </p>
              </div>

              {cancelScheduled ? (
                <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Cancellation scheduled
                </span>
              ) : isCanceledStatus ? (
                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Already canceled
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void cancelAutoRenew();
                  }}
                  disabled={!canCancelAutoRenew || canceling}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canceling ? "Canceling..." : "Cancel subscription"}
                </button>
              )}
            </div>
          </section>

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
              <h3 className="text-[1.95rem] font-bold leading-tight text-slate-900">
                <VerticalCutReveal
                  splitBy="words"
                  staggerDuration={0.05}
                  containerClassName="justify-start"
                  transition={{
                    type: "spring",
                    stiffness: 220,
                    damping: 32,
                    delay: 0.06,
                  }}
                >
                  Plan Options
                </VerticalCutReveal>
              </h3>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 0.35, delay: 0.08 }}
                className="mt-1 text-slate-500"
              >
                Pick your mode: lean validation or full-scale execution.
              </motion.p>
            </div>

            <div className="p-5">
              <div className="mb-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => scrollPlans("left")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
                  aria-label="Scroll plans left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollPlans("right")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
                  aria-label="Scroll plans right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div
                ref={planCarouselRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 md:px-1 [scrollbar-width:thin]"
              >
                <AnimatePresence initial={false} mode="sync">
                  {visiblePlans.map((plan, index) => {
                    const isFree = plan.id === "free";
                    const cycle = isFree ? null : (plan.id as BillingCycle);
                    const isWeeklyTrial = cycle === "weekly" && !hasSubscribedBefore;
                    const planAmount = parsePlanAmount(plan.price);
                    const isSingleVisible = visiblePlans.length === 1;

                    return (
                      <motion.article
                        data-plan-card="true"
                        key={plan.id}
                        initial={{ opacity: 0, y: 20, scale: 0.98, filter: "blur(7px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -14, scale: 0.98, filter: "blur(6px)" }}
                        transition={{
                          duration: 0.38,
                          delay: index * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        whileHover={{ y: -6, scale: 1.01 }}
                        className={`group isolate relative min-h-[485px] shrink-0 snap-start overflow-hidden rounded-2xl border p-5 transition-[border-color,box-shadow] duration-300 hover:border-slate-900 hover:shadow-[0_26px_58px_rgba(15,23,42,0.42)] ${
                          isSingleVisible
                            ? "w-full"
                            : "w-[calc(100%-0.25rem)] sm:w-[84%] md:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]"
                        } ${
                          isFree
                            ? "border-slate-200 bg-slate-50/55"
                            : cycle === "weekly"
                              ? "border-blue-200 bg-gradient-to-b from-blue-50 to-white"
                              : cycle === "monthly"
                                ? "border-emerald-200 bg-gradient-to-b from-emerald-50 to-white"
                                : "border-violet-200 bg-gradient-to-b from-violet-50 to-white"
                        }`}
                      >
                        <GlowingEffect
                          spread={34}
                          glow
                          disabled={false}
                          proximity={52}
                          inactiveZone={0.06}
                          borderWidth={2}
                        />
                        <div className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-slate-950/0 opacity-0 transition-all duration-300 group-hover:bg-slate-950/90 group-hover:opacity-100" />

                        <div className="relative z-10">
                          <div
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-300 ${
                              isFree
                                ? "border-slate-300 bg-white text-slate-600 group-hover:border-white/35 group-hover:bg-white/10 group-hover:text-white"
                                : "border-blue-200 bg-white text-blue-700 group-hover:border-white/35 group-hover:bg-white/10 group-hover:text-white"
                            }`}
                          >
                            {isFree ? (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            ) : (
                              <Rocket className="h-3.5 w-3.5" />
                            )}
                            {isFree ? "Entry" : cycle === "weekly" ? "Recommended" : "Growth"}
                          </div>

                          <h4 className="mt-3 text-[1.75rem] font-bold leading-tight text-slate-900 transition-colors duration-300 group-hover:text-white">
                            {plan.title}
                          </h4>
                          <p className="mt-2 text-slate-600 transition-colors duration-300 group-hover:text-white/85">
                            {plan.subtitle}
                          </p>

                          <div className="mt-5 flex items-end gap-1">
                            <NumberFlow
                              key={`${plan.id}-${planAmount}`}
                              value={planAmount}
                              format={{
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }}
                              className="text-[2.5rem] font-bold leading-none text-slate-900 transition-colors duration-300 group-hover:text-white"
                            />
                            <span className="pb-1 text-lg font-medium text-slate-500 transition-colors duration-300 group-hover:text-white/80">
                              {plan.priceSuffix}
                            </span>
                          </div>

                          {isFree ? (
                            <ul className="mt-5 space-y-2 text-slate-700 transition-colors duration-300 group-hover:text-white/90">
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-600 transition-colors duration-300 group-hover:text-emerald-300" />
                                Basic job search workflow
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-600 transition-colors duration-300 group-hover:text-emerald-300" />
                                Limited resume parsing usage
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-600 transition-colors duration-300 group-hover:text-emerald-300" />
                                Core dashboard access
                              </li>
                            </ul>
                          ) : (
                            <ul className="mt-5 space-y-2 text-slate-700 transition-colors duration-300 group-hover:text-white/90">
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-600 transition-colors duration-300 group-hover:text-emerald-300" />
                                Advanced AI resume optimization
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-600 transition-colors duration-300 group-hover:text-emerald-300" />
                                Priority matching + strategy guidance
                              </li>
                              <li className="flex items-center gap-2">
                                <Check className="h-4 w-4 text-emerald-600 transition-colors duration-300 group-hover:text-emerald-300" />
                                Assistant support for interview prep
                              </li>
                            </ul>
                          )}

                          <button
                            type="button"
                            className={`mt-6 inline-flex h-11 w-full items-center justify-center gap-1 rounded-xl text-sm font-semibold transition ${
                              isFree
                                ? "border border-slate-300 bg-white text-slate-700 group-hover:border-white/80 group-hover:bg-white group-hover:text-slate-900"
                                : "bg-slate-900 text-white hover:bg-slate-800 group-hover:bg-white group-hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                            }`}
                            onClick={() => {
                              if (cycle) {
                                void startCheckout(cycle);
                              }
                            }}
                            disabled={isFree || paying}
                          >
                            {isFree
                              ? "Current free plan"
                              : paying
                                ? "Redirecting..."
                                : cycle
                                  ? getSubscribeCta(cycle)
                                  : "Subscribe"}
                            {!isFree ? <ArrowRight className="h-4 w-4" /> : null}
                          </button>

                          {isWeeklyTrial ? (
                            <p className="mt-2 text-xs text-blue-700 transition-colors duration-300 group-hover:text-blue-200">
                              Includes a 7-day trial for first-time weekly subscriptions.
                            </p>
                          ) : null}
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <h3 className="text-2xl font-bold text-slate-900">What subscription unlocks</h3>
            <p className="mt-1 text-sm text-slate-500">
              Paid plans are designed for serious execution and faster outcomes.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <LayoutTemplate className="h-4 w-4 text-blue-600" />
                  Choose Resume Templates
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Access multiple resume templates and quickly switch styles for different roles.
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Unlock Advanced AI
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Use advanced optimization flows for stronger summaries, bullets, and keyword alignment.
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  Unlimited AI Conversations
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Chat with the assistant without strict limits while preparing applications and interviews.
                </p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Download className="h-4 w-4 text-violet-600" />
                  Download Resume to Local Device
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Export your latest resume version and keep local copies for direct job submissions.
                </p>
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

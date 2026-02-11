"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { DEV_USER_ID, STRIPE_PRICE_ID } from "@/lib/config";
import type { SubscriptionRecord } from "@/types/shared";

interface CheckoutResponse {
  url: string;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [checkoutState, setCheckoutState] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<SubscriptionRecord>(
        `/subscription/${DEV_USER_ID}`,
      );
      setSubscription(data);
    } catch (e) {
      setError((e as Error).message);
      setSubscription({ plan: "free", status: "incomplete" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const value = new URLSearchParams(window.location.search).get("checkout");
      setCheckoutState(value);
    }
    refresh();
  }, []);

  const startCheckout = async () => {
    if (!STRIPE_PRICE_ID || STRIPE_PRICE_ID === "price_placeholder") {
      setError(
        "Missing NEXT_PUBLIC_STRIPE_PRICE_ID. Configure it before checkout.",
      );
      return;
    }
    setPaying(true);
    setError("");
    try {
      const payload = {
        userId: DEV_USER_ID,
        priceId: STRIPE_PRICE_ID,
        successUrl: `${window.location.origin}/dashboard/billing?checkout=success`,
        cancelUrl: `${window.location.origin}/dashboard/billing?checkout=cancel`,
      };
      const data = await apiFetch<CheckoutResponse>("/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message || "Failed to create checkout session.");
      setPaying(false);
    }
  };

  return (
    <div className="stack-16">
      <section className="panel">
        <div className="panel-header">
          <h2>Subscription status</h2>
        </div>
        <div className="panel-body stack-12">
          {loading ? <p>Loading subscription...</p> : null}
          {checkoutState === "success" ? (
            <p className="status-ok">
              Checkout returned successfully. Refreshing subscription state may
              take a few seconds after webhook processing.
            </p>
          ) : null}
          {checkoutState === "cancel" ? (
            <p className="status-error">Checkout was canceled.</p>
          ) : null}
          {error ? <p className="status-error">{error}</p> : null}
          <p>
            Plan: <strong>{subscription?.plan || "free"}</strong>
          </p>
          <p>
            Status: <strong>{subscription?.status || "incomplete"}</strong>
          </p>
          <p>
            Current period end:{" "}
            <strong>{subscription?.currentPeriodEnd || "-"}</strong>
          </p>
          <div className="stack-12">
            <button
              type="button"
              className="btn btn-primary"
              onClick={startCheckout}
              disabled={paying}
            >
              {paying ? "Redirecting..." : "Start Stripe checkout"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={refresh}
              disabled={paying}
            >
              Refresh subscription
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

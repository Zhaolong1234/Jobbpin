"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignIn } from "@clerk/nextjs";

import { AuthHero } from "@/components/auth-hero";
import { BrandLogo } from "@/components/brand-logo";
import { GoogleIcon } from "@/components/google-icon";
import { StatusBanner } from "@/components/status-banner";
import type { GlobalStatus } from "@/lib/status";

const TARGET_AFTER_AUTH = "/onboarding";

function getClerkErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) return "Request failed.";
  const maybe = error as { errors?: Array<{ message?: string; longMessage?: string }> };
  const first = maybe.errors?.[0];
  return first?.longMessage || first?.message || "Request failed.";
}

export default function SignInPage() {
  const router = useRouter();
  const { setActive } = useClerk();
  const { isLoaded, signIn } = useSignIn();
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<GlobalStatus>("empty");
  const [message, setMessage] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"email" | "verify">("email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<GlobalStatus>("empty");
  const [forgotMessage, setForgotMessage] = useState("");

  const normalizedEmail = useMemo(() => email.trim(), [email]);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !signIn) return;

    if (!normalizedEmail || !password.trim()) {
      setStatus("parse_failed");
      setMessage("Email and password are required.");
      return;
    }

    setSubmitting(true);
    setStatus("loading");
    setMessage("Signing in...");

    try {
      const result = await signIn.create({
        identifier: normalizedEmail,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        setStatus("success");
        setMessage("Sign in successful. Redirecting...");
        router.push(TARGET_AFTER_AUTH);
        return;
      }

      setStatus("parse_failed");
      setMessage("Additional verification is required for this account.");
    } catch (error) {
      setStatus("parse_failed");
      setMessage(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    if (!isLoaded || !signIn) return;

    setStatus("loading");
    setMessage("Redirecting to Google...");

    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: TARGET_AFTER_AUTH,
      });
    } catch (error) {
      setStatus("parse_failed");
      setMessage(getClerkErrorMessage(error));
    }
  };

  const openForgot = () => {
    setForgotOpen(true);
    setForgotStep("email");
    setForgotEmail(normalizedEmail);
    setForgotCode("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotStatus("empty");
    setForgotMessage("");
  };

  const sendResetCode = async () => {
    if (!isLoaded || !signIn) return;
    const targetEmail = forgotEmail.trim();
    if (!targetEmail) {
      setForgotStatus("parse_failed");
      setForgotMessage("Email is required.");
      return;
    }

    setForgotSubmitting(true);
    setForgotStatus("loading");
    setForgotMessage("Sending reset code...");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: targetEmail,
      });
      setForgotStep("verify");
      setForgotStatus("success");
      setForgotMessage("Code sent. Please check your email.");
    } catch (error) {
      setForgotStatus("parse_failed");
      setForgotMessage(getClerkErrorMessage(error));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded || !signIn) return;

    if (!forgotCode.trim() || !newPassword.trim()) {
      setForgotStatus("parse_failed");
      setForgotMessage("Code and new password are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotStatus("parse_failed");
      setForgotMessage("Passwords do not match.");
      return;
    }

    setForgotSubmitting(true);
    setForgotStatus("loading");
    setForgotMessage("Resetting password...");

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: forgotCode.trim(),
        password: newPassword,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        setForgotStatus("success");
        setForgotMessage("Password reset successful. Redirecting...");
        setForgotOpen(false);
        router.push(TARGET_AFTER_AUTH);
        return;
      }

      setForgotStatus("parse_failed");
      setForgotMessage("Could not complete reset flow. Try again.");
    } catch (error) {
      setForgotStatus("parse_failed");
      setForgotMessage(getClerkErrorMessage(error));
    } finally {
      setForgotSubmitting(false);
    }
  };

  if (!hasClerk) {
    return (
      <main className="page-container flex min-h-[70vh] items-center justify-center">
        <section className="panel w-full max-w-xl">
          <div className="panel-body space-y-3">
            <p className="text-sm text-rose-700">Clerk is not configured yet.</p>
            <Link className="btn btn-outline" href="/">
              Back Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="mx-auto grid min-h-screen w-full max-w-[1720px] gap-6 px-4 py-4 lg:grid-cols-[0.9fr_1.1fr] lg:px-6 lg:py-6">
        <div className="flex px-2 pb-8 pt-4 sm:px-4 lg:px-8">
          <div className="mx-auto w-full max-w-[760px]">
            <BrandLogo href="/" className="origin-left scale-[0.8] sm:scale-90" />

            <div className="mt-10 space-y-3 sm:mt-14">
              <p className="text-[clamp(1rem,1.1vw,1.2rem)] font-semibold uppercase tracking-[0.13em] text-slate-500">
                Welcome Back
              </p>
              <h1 className="text-[clamp(2.4rem,4.4vw,5rem)] font-extrabold leading-[1.06] tracking-[-0.02em] text-slate-900">
                Sign in to your account
              </h1>
            </div>

            {status !== "empty" ? (
              <div className="mt-7">
                <StatusBanner status={status} message={message} />
              </div>
            ) : null}

            <form onSubmit={onSignIn} className="mt-7 space-y-6">
              <label className="block text-[clamp(1.2rem,1.2vw,1.9rem)] font-semibold text-slate-700">
                Email Address
                <input
                  type="email"
                  className="mt-2.5 h-[82px] w-full rounded-[22px] border border-slate-300 bg-slate-100 px-6 text-[clamp(1.2rem,1.2vw,1.85rem)] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="block text-[clamp(1.2rem,1.2vw,1.9rem)] font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  className="mt-2.5 h-[82px] w-full rounded-[22px] border border-slate-300 bg-slate-100 px-6 text-[clamp(1.2rem,1.2vw,1.85rem)] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              <div className="-mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-[clamp(1.05rem,1.1vw,1.55rem)] font-medium text-slate-500 transition hover:text-slate-900"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="h-[86px] w-full rounded-[24px] border border-transparent bg-gradient-to-r from-[#0a1737] to-[#344969] text-[clamp(1.3rem,1.25vw,2rem)] font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:from-[#09122d] hover:to-[#2c3f5e] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || !isLoaded}
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="relative mt-9 py-3">
              <div className="h-px w-full bg-slate-200" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 px-4 text-[clamp(1rem,1vw,1.35rem)] font-semibold text-slate-400">
                or continue with
              </span>
            </div>

            <button
              type="button"
              onClick={onGoogle}
              className="mt-3 inline-flex h-[82px] w-full items-center justify-center rounded-[22px] border border-slate-300 bg-white px-6 text-[clamp(1.2rem,1.2vw,1.8rem)] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || !isLoaded}
            >
              <GoogleIcon className="mr-3 h-8 w-8" />
              Continue with Google
            </button>

            <p className="mt-8 text-center text-[clamp(1rem,1.05vw,1.45rem)] text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="font-semibold text-slate-900">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <AuthHero
          title="Smart Resume Builder / AI-Powered Career Tools"
          subtitle="Manage resume starting from now!"
        />
      </section>

      {forgotOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-9">
            <div className="space-y-2">
              <h2 className="text-4xl font-extrabold text-slate-900">Forgot Password</h2>
              <p className="text-lg text-slate-600">
                {forgotStep === "email"
                  ? "Enter your email address and we will send reset instructions."
                  : "Enter the code from email and set a new password."}
              </p>
            </div>

            {forgotStatus !== "empty" ? (
              <div className="mt-5">
                <StatusBanner status={forgotStatus} message={forgotMessage} />
              </div>
            ) : null}

            {forgotStep === "email" ? (
              <div className="mt-5 space-y-4">
                <label className="block text-lg font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setForgotOpen(false)}
                    disabled={forgotSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary min-w-40"
                    onClick={sendResetCode}
                    disabled={forgotSubmitting || !isLoaded}
                  >
                    {forgotSubmitting ? "Sending..." : "Send code"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block text-lg font-semibold text-slate-700">
                  Verification code
                  <input
                    className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
                    placeholder="6-digit code"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                  />
                </label>
                <label className="block text-lg font-semibold text-slate-700">
                  New password
                  <input
                    type="password"
                    className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </label>
                <label className="block text-lg font-semibold text-slate-700">
                  Confirm new password
                  <input
                    type="password"
                    className="mt-2 h-14 w-full rounded-xl border border-slate-300 px-4 text-lg"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setForgotStep("email");
                      setForgotStatus("empty");
                      setForgotMessage("");
                    }}
                    disabled={forgotSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={sendResetCode}
                    disabled={forgotSubmitting || !isLoaded}
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary min-w-40"
                    onClick={resetPassword}
                    disabled={forgotSubmitting || !isLoaded}
                  >
                    {forgotSubmitting ? "Resetting..." : "Reset password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

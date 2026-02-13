"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useSignUp } from "@clerk/nextjs";

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

export default function SignUpPage() {
  const router = useRouter();
  const { setActive } = useClerk();
  const { isLoaded, signUp } = useSignUp();
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"form" | "verify">("form");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<GlobalStatus>("empty");
  const [message, setMessage] = useState("");

  const normalizedEmail = useMemo(() => email.trim(), [email]);

  const onGoogle = async () => {
    if (!isLoaded || !signUp) return;

    setStatus("loading");
    setMessage("Redirecting to Google...");

    try {
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: TARGET_AFTER_AUTH,
      });
    } catch (error) {
      setStatus("parse_failed");
      setMessage(getClerkErrorMessage(error));
    }
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !signUp) return;

    if (!normalizedEmail || !password.trim()) {
      setStatus("parse_failed");
      setMessage("Email and password are required.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("parse_failed");
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setStatus("loading");
    setMessage("Creating account...");

    try {
      await signUp.create({
        emailAddress: normalizedEmail,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPhase("verify");
      setStatus("success");
      setMessage("Verification code sent to your email.");
    } catch (error) {
      setStatus("parse_failed");
      setMessage(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLoaded || !signUp) return;

    if (!code.trim()) {
      setStatus("parse_failed");
      setMessage("Please enter verification code.");
      return;
    }

    setSubmitting(true);
    setStatus("loading");
    setMessage("Verifying code...");

    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        setStatus("success");
        setMessage("Account created successfully. Redirecting...");
        router.push(TARGET_AFTER_AUTH);
        return;
      }

      setStatus("parse_failed");
      setMessage("Verification not completed. Please try again.");
    } catch (error) {
      setStatus("parse_failed");
      setMessage(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const resendCode = async () => {
    if (!isLoaded || !signUp) return;

    setSubmitting(true);
    setStatus("loading");
    setMessage("Resending code...");

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStatus("success");
      setMessage("A new code has been sent.");
    } catch (error) {
      setStatus("parse_failed");
      setMessage(getClerkErrorMessage(error));
    } finally {
      setSubmitting(false);
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
                Create Account
              </p>
              <h1 className="text-[clamp(2.4rem,4.2vw,4.8rem)] font-extrabold leading-[1.06] tracking-[-0.02em] text-slate-900">
                Sign up
              </h1>
              <p className="text-[clamp(1.1rem,1.05vw,1.6rem)] text-slate-600">
                Use email/password or continue with Google.
              </p>
            </div>

            {status !== "empty" ? (
              <div className="mt-7">
                <StatusBanner status={status} message={message} />
              </div>
            ) : null}

            <div className="mt-7 rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-200 px-6 py-7 sm:px-10">
                <h2 className="text-[clamp(1.8rem,1.9vw,2.6rem)] font-bold text-slate-900">Create your account</h2>
                <p className="mt-1 text-[clamp(1rem,1vw,1.3rem)] text-slate-500">
                  Welcome! Please fill in the details to get started.
                </p>
              </div>

              <div className="px-6 py-7 sm:px-10 sm:py-8">
                <button
                  type="button"
                  onClick={onGoogle}
                  className="inline-flex h-[74px] w-full items-center justify-center rounded-[20px] border border-slate-300 bg-white px-6 text-[clamp(1.1rem,1.05vw,1.5rem)] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || !isLoaded}
                >
                  <GoogleIcon className="mr-3 h-8 w-8" />
                  Continue with Google
                </button>

                <div className="relative mt-6 py-3">
                  <div className="h-px w-full bg-slate-200" />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-[clamp(1rem,1vw,1.25rem)] text-slate-400">
                    or
                  </span>
                </div>

                {phase === "form" ? (
                  <form onSubmit={onCreate} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-[clamp(1rem,0.95vw,1.3rem)] font-semibold text-slate-700">
                        First name <span className="font-normal text-slate-400">Optional</span>
                        <input
                          className="mt-2 h-[68px] w-full rounded-[18px] border border-slate-300 bg-slate-50 px-5 text-[clamp(1.1rem,1.05vw,1.4rem)]"
                          placeholder="First name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </label>
                      <label className="block text-[clamp(1rem,0.95vw,1.3rem)] font-semibold text-slate-700">
                        Last name <span className="font-normal text-slate-400">Optional</span>
                        <input
                          className="mt-2 h-[68px] w-full rounded-[18px] border border-slate-300 bg-slate-50 px-5 text-[clamp(1.1rem,1.05vw,1.4rem)]"
                          placeholder="Last name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </label>
                    </div>

                    <label className="block text-[clamp(1rem,0.95vw,1.3rem)] font-semibold text-slate-700">
                      Email address
                      <input
                        type="email"
                        className="mt-2 h-[68px] w-full rounded-[18px] border border-slate-300 bg-slate-50 px-5 text-[clamp(1.1rem,1.05vw,1.4rem)]"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>

                    <label className="block text-[clamp(1rem,0.95vw,1.3rem)] font-semibold text-slate-700">
                      Password
                      <input
                        type="password"
                        className="mt-2 h-[68px] w-full rounded-[18px] border border-slate-300 bg-slate-50 px-5 text-[clamp(1.1rem,1.05vw,1.4rem)]"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>

                    <label className="block text-[clamp(1rem,0.95vw,1.3rem)] font-semibold text-slate-700">
                      Confirm password
                      <input
                        type="password"
                        className="mt-2 h-[68px] w-full rounded-[18px] border border-slate-300 bg-slate-50 px-5 text-[clamp(1.1rem,1.05vw,1.4rem)]"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </label>

                    <button
                      type="submit"
                      className="h-[76px] w-full rounded-[22px] border border-transparent bg-gradient-to-r from-[#0a1737] to-[#344969] text-[clamp(1.2rem,1.15vw,1.7rem)] font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:from-[#09122d] hover:to-[#2c3f5e] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={submitting || !isLoaded}
                    >
                      {submitting ? "Creating..." : "Continue"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={onVerify} className="space-y-5">
                    <p className="text-[clamp(1rem,0.95vw,1.3rem)] text-slate-600">
                      Enter the email verification code to activate your account.
                    </p>

                    <label className="block text-[clamp(1rem,0.95vw,1.3rem)] font-semibold text-slate-700">
                      Email verification code
                      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                        <input
                          className="h-[68px] w-full rounded-[18px] border border-slate-300 bg-slate-50 px-5 text-[clamp(1.1rem,1.05vw,1.4rem)]"
                          placeholder="Enter verification code"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={resendCode}
                          className="inline-flex h-[68px] items-center rounded-[18px] border border-slate-300 bg-white px-5 text-[clamp(0.95rem,0.95vw,1.2rem)] font-semibold text-slate-700 transition hover:bg-slate-50"
                          disabled={submitting || !isLoaded}
                        >
                          Resend
                        </button>
                      </div>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline px-6 py-3 text-[1rem]"
                        onClick={() => {
                          setPhase("form");
                          setStatus("empty");
                          setMessage("");
                        }}
                        disabled={submitting}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="h-[76px] flex-1 rounded-[22px] border border-transparent bg-gradient-to-r from-[#0a1737] to-[#344969] text-[clamp(1.2rem,1.15vw,1.7rem)] font-bold text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:from-[#09122d] hover:to-[#2c3f5e] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={submitting || !isLoaded}
                      >
                        {submitting ? "Verifying..." : "Register with us"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="border-t border-slate-200 px-6 py-6 text-center sm:px-10">
                <p className="text-[clamp(1rem,1.05vw,1.35rem)] text-slate-500">
                  Already have an account?{" "}
                  <Link href="/sign-in" className="font-semibold text-slate-900">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        <AuthHero
          title="Smart Resume Builder / AI-Powered Career Tools"
          subtitle="Create your account, onboard quickly, and start with AI-powered career guidance."
        />
      </section>
    </main>
  );
}

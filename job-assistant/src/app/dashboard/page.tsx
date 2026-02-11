"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEV_USER_ID } from "@/lib/config";
import { apiFetch } from "@/lib/api";
import type { ResumeRecord, SubscriptionRecord } from "@/types/shared";

import styles from "./page.module.css";

interface ProfileForm {
  name: string;
  targetRole: string;
  yearsExp: string;
  city: string;
}

const PROFILE_KEY = "job_assistant_profile";

function loadProfile(): ProfileForm {
  if (typeof window === "undefined") {
    return { name: "", targetRole: "", yearsExp: "", city: "" };
  }
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return { name: "", targetRole: "", yearsExp: "", city: "" };
  try {
    return JSON.parse(raw) as ProfileForm;
  } catch {
    return { name: "", targetRole: "", yearsExp: "", city: "" };
  }
}

export default function DashboardOverviewPage() {
  const [profile, setProfile] = useState<ProfileForm>({
    name: "",
    targetRole: "",
    yearsExp: "",
    city: "",
  });
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(
    null,
  );
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfile(loadProfile());
    const run = async () => {
      try {
        const [resumeData, subData] = await Promise.all([
          apiFetch<ResumeRecord | null>(`/resume/${DEV_USER_ID}/latest`),
          apiFetch<SubscriptionRecord>(`/subscription/${DEV_USER_ID}`),
        ]);
        setResume(resumeData);
        setSubscription(subData);
      } catch {
        setSubscription({ plan: "free", status: "incomplete" });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const profileDone = useMemo(
    () =>
      profile.name.trim().length > 0 &&
      profile.targetRole.trim().length > 0 &&
      profile.yearsExp.trim().length > 0 &&
      profile.city.trim().length > 0,
    [profile],
  );

  const subscriptionDone = subscription?.status === "active";
  const resumeDone = Boolean(resume?.id);
  const completedCount = [profileDone, resumeDone, subscriptionDone].filter(
    Boolean,
  ).length;
  const progress = Math.round((completedCount / 3) * 100);

  const saveProfile = () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaveStatus("Profile saved locally.");
    setTimeout(() => setSaveStatus(""), 1800);
  };

  return (
    <div className="stack-16">
      <section className="panel">
        <div className="panel-header">
          <h2>Welcome, {profile.name || "Developer"}</h2>
        </div>
        <div className="panel-body stack-12">
          <p className="text-muted">
            This MVP uses <code>{DEV_USER_ID}</code> as user identity until
            Clerk is integrated.
          </p>
          <div className={styles.progressBar}>
            <div style={{ width: `${progress}%` }} />
          </div>
          <p className="text-muted">Profile completeness: {progress}%</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Onboarding steps</h2>
        </div>
        <div className="panel-body stack-12">
          <div className={styles.steps}>
            <div className={profileDone ? styles.done : styles.todo}>
              1. Complete profile
            </div>
            <div className={resumeDone ? styles.done : styles.todo}>
              2. Upload resume
            </div>
            <div className={subscriptionDone ? styles.done : styles.todo}>
              3. Activate subscription
            </div>
          </div>
          <div className={styles.links}>
            <Link className="btn btn-outline" href="/dashboard/resume">
              Go to Resume
            </Link>
            <Link className="btn btn-outline" href="/dashboard/billing">
              Go to Billing
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Profile details</h2>
        </div>
        <div className="panel-body stack-12">
          <div className={styles.formGrid}>
            <label>
              Name
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
              />
            </label>
            <label>
              Target role
              <input
                value={profile.targetRole}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, targetRole: e.target.value }))
                }
              />
            </label>
            <label>
              Years of experience
              <input
                value={profile.yearsExp}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, yearsExp: e.target.value }))
                }
              />
            </label>
            <label>
              City
              <input
                value={profile.city}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, city: e.target.value }))
                }
              />
            </label>
          </div>
          <div className={styles.saveRow}>
            <button type="button" className="btn btn-primary" onClick={saveProfile}>
              Save profile
            </button>
            {saveStatus ? <span className="status-ok">{saveStatus}</span> : null}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Snapshot</h2>
        </div>
        <div className="panel-body stack-12">
          {loading ? <p>Loading data...</p> : null}
          <p>
            Resume status:{" "}
            <strong className={resumeDone ? "status-ok" : "status-error"}>
              {resumeDone ? "uploaded" : "not uploaded"}
            </strong>
          </p>
          <p>
            Subscription:{" "}
            <strong
              className={subscriptionDone ? "status-ok" : "status-error"}
            >
              {subscription?.status ?? "unknown"}
            </strong>
          </p>
        </div>
      </section>
    </div>
  );
}

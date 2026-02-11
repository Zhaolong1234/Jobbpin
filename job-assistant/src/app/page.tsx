import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={`container ${styles.home}`}>
      <section className={`panel ${styles.hero}`}>
        <div className="panel-body">
          <p className={styles.label}>Job Assistant MVP</p>
          <h1>Build your resume workflow with parsing, scoring, and subscription.</h1>
          <p className="text-muted">
            This version focuses on deployable infrastructure: dashboard,
            resume upload & structured parsing, and Stripe test-mode
            subscription.
          </p>
          <div className={styles.actions}>
            <Link className="btn btn-primary" href="/dashboard">
              Open Dashboard
            </Link>
            <Link className="btn btn-outline" href="/dashboard/resume">
              Upload Resume
            </Link>
          </div>
        </div>
      </section>

      <section className={`panel ${styles.steps}`}>
        <div className="panel-header">
          <h2>How it works (MVP)</h2>
        </div>
        <div className={`panel-body ${styles.grid}`}>
          <article>
            <h3>Step 1: Complete profile</h3>
            <p className="text-muted">
              Save your role, experience years, and target city to unlock
              onboarding progress.
            </p>
          </article>
          <article>
            <h3>Step 2: Upload resume</h3>
            <p className="text-muted">
              Upload a PDF and get structured resume data displayed in the
              dashboard.
            </p>
          </article>
          <article>
            <h3>Step 3: Activate subscription</h3>
            <p className="text-muted">
              Start Stripe test checkout and sync subscription status via
              webhook.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

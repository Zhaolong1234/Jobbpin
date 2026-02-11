import Link from "next/link";

import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container">
      <header className={`panel ${styles.header}`}>
        <div className="panel-body">
          <div className={styles.top}>
            <div>
              <p className={styles.kicker}>Development Stage</p>
              <h1>Job Assistant Dashboard</h1>
            </div>
            <Link className="btn btn-outline" href="/">
              Back Home
            </Link>
          </div>
          <nav className={styles.nav}>
            <Link href="/dashboard">Overview</Link>
            <Link href="/dashboard/resume">Resume</Link>
            <Link href="/dashboard/billing">Billing</Link>
          </nav>
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

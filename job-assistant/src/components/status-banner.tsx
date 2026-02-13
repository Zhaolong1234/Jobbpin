import type { GlobalStatus } from "@/lib/status";

interface StatusBannerProps {
  status: GlobalStatus;
  message: string;
  className?: string;
}

const statusClasses: Record<GlobalStatus, string> = {
  loading: "border-amber-300 bg-amber-50 text-amber-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  parse_failed: "border-rose-300 bg-rose-50 text-rose-900",
  empty: "border-slate-300 bg-slate-50 text-slate-700",
};

export function StatusBanner({ status, message, className = "" }: StatusBannerProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${statusClasses[status]} ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-block rounded-full border border-current px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
        {status}
      </span>
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

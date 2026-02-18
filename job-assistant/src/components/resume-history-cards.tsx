"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Sparkles, Trash2 } from "lucide-react";

import {
  ResumeTemplatePreview,
  type EditorResumeTemplate,
} from "@/components/ui/resume-template-preview";
import { cn } from "@/lib/utils";
import type { ResumeRecord } from "@/types/shared";

interface ResumeHistoryCardsProps {
  resumes: ResumeRecord[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  actionLabel?: string;
  className?: string;
  maxItems?: number;
  getOpenHref?: (resume: ResumeRecord) => string;
  onOpen?: (resume: ResumeRecord) => void;
  onDelete?: (resume: ResumeRecord) => void;
  deletingResumeId?: string | null;
  deleteLabel?: string;
}

function clampStyle(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

function toTemplateLabel(templateId?: string): string {
  const normalized = (templateId || "").toLowerCase().trim();
  if (normalized === "modern") return "Modern Pro";
  if (normalized === "compact") return "Compact Grid";
  return "Harvard ATS";
}

function toTemplateId(templateId?: string): EditorResumeTemplate {
  const normalized = (templateId || "").toLowerCase().trim();
  if (normalized === "modern" || normalized === "compact" || normalized === "classic") {
    return normalized;
  }
  return "classic";
}

function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fallbackScore(resume: ResumeRecord): number {
  let score = 0;
  if (resume.parsed.basics.name || resume.parsed.basics.email) score += 20;
  if (resume.parsed.basics.summary) score += 20;
  if (resume.parsed.skills.length > 0) score += 20;
  if (resume.parsed.experiences.length > 0) score += 20;
  if ((resume.parsed.education || []).length > 0) score += 20;
  return score;
}

function relativeUpdatedAt(value: string): string {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "Updated recently";

  const deltaMs = Date.now() - target;
  if (deltaMs < 60_000) return "Updated just now";
  const deltaMins = Math.floor(deltaMs / 60_000);
  if (deltaMins < 60) return `Updated ${deltaMins} min ago`;
  const deltaHours = Math.floor(deltaMins / 60);
  if (deltaHours < 24) return `Updated ${deltaHours}h ago`;
  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) return `Updated ${deltaDays} day${deltaDays > 1 ? "s" : ""} ago`;
  return `Updated ${new Date(value).toLocaleDateString()}`;
}

export function ResumeHistoryCards({
  resumes,
  title = "My Resume",
  description = "Open previous parsed resumes, continue editing, or start a fresh parse.",
  emptyMessage = "No parsed resume history yet. Upload your first PDF to create one.",
  actionLabel = "Open",
  className,
  maxItems = 6,
  getOpenHref,
  onOpen,
  onDelete,
  deletingResumeId,
  deleteLabel = "Delete",
}: ResumeHistoryCardsProps) {
  const visibleResumes = resumes.slice(0, Math.max(1, maxItems));

  return (
    <section className={cn("rounded-3xl border border-slate-200 bg-white/92 p-5 md:p-6", className)}>
      <div className="mb-5">
        <h2 className="text-[2rem] font-bold leading-tight text-slate-900 md:text-[2.2rem]">{title}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-slate-500">{description}</p>
      </div>

      {!visibleResumes.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-sm text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleResumes.map((resume, index) => {
            const score =
              normalizeScore(resume.parsed.aiAssessment?.score) ?? fallbackScore(resume);
            const role = resume.parsed.experiences?.[0]?.title?.trim();
            const resumeTitle = role ? `${role} Resume` : "Career Resume";
            const summary = resume.parsed.basics.summary?.trim();
            const skillPreview = resume.parsed.skills.slice(0, 6).join(" • ");
            const templateLabel = toTemplateLabel(resume.templateId);
            const templateId = toTemplateId(resume.templateId);
            const personName = resume.parsed.basics.name || "Candidate";
            const titlePreview = role || "Target Role";
            const summaryPreview =
              summary || "Resume summary appears here after parse and AI extraction.";

            const openAction = onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(resume)}
                className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                {actionLabel}
              </button>
            ) : getOpenHref ? (
              <Link
                href={getOpenHref(resume)}
                className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                {actionLabel}
              </Link>
            ) : (
              <span className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-500">
                {actionLabel}
              </span>
            );

            return (
              <article
                key={resume.id}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
              >
                <div className="relative border-b border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-4">
                  {index === 0 ? (
                    <span className="absolute left-4 top-4 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                      Default
                    </span>
                  ) : null}

                  <div className="relative mx-auto mt-5 h-[250px] w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                    <div className="pointer-events-none absolute left-1/2 top-3 w-[920px] origin-top -translate-x-1/2 scale-[0.26] sm:scale-[0.29]">
                      <ResumeTemplatePreview
                        parsed={resume.parsed}
                        template={templateId}
                        fontFamily="inter"
                        density="compact"
                        textScale="small"
                        shape="square"
                        showBackground={false}
                        editable={false}
                      />
                    </div>

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-100 via-slate-100/65 to-transparent px-4 pb-2 pt-10">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        {personName}
                      </p>
                      <p className="text-[10px] text-slate-500" style={clampStyle(1)}>
                        {titlePreview}
                      </p>
                      <p className="text-[10px] text-slate-500" style={clampStyle(1)}>
                        {summaryPreview || skillPreview || "Resume preview"}
                      </p>
                    </div>
                  </div>

                  <span className="absolute bottom-7 right-6 inline-flex min-w-[88px] items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 px-3 py-2 text-[2rem] font-bold leading-none text-emerald-700">
                    {score}
                  </span>
                </div>

                <div className="space-y-3 px-4 py-4 md:px-5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {templateLabel}
                    </span>
                    <span className="text-xs text-slate-400">{relativeUpdatedAt(resume.createdAt)}</span>
                  </div>
                  <p
                    className="min-h-[3.15rem] text-[1.85rem] font-semibold leading-[1.12] text-slate-900"
                    style={clampStyle(2)}
                  >
                    {resumeTitle}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {openAction}
                  </div>
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(resume)}
                      disabled={deletingResumeId === resume.id}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingResumeId === resume.id ? "Deleting..." : deleteLabel}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-blue-600" />
        Parse history is preserved. Logout clears current workspace only.
      </div>
    </section>
  );
}

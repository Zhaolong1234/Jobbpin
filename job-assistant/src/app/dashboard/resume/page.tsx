"use client";

import {
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  Bot,
  FileCheck2,
  FileUp,
  Gauge,
  Sparkles,
  Wand2,
} from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import { computeOnboardingSignals } from "@/lib/onboarding";
import type { GlobalStatus } from "@/lib/status";
import type { ResumeRecord } from "@/types/shared";

const MAX_SIZE = 8 * 1024 * 1024;
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;
const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const AI_HINTS = [
  "请帮我把 summary 改得更像 Software Engineer",
  "根据当前简历，给我 3 个能量化成果的改写建议",
  "优化关键词，让 ATS 更容易命中",
];

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ChatResponse {
  reply: string;
  action?: "plan_ready" | "implemented" | "rolled_back";
  planId?: string;
  targetField?: string;
  preview?: {
    before?: string;
    after?: string;
  };
  improvements?: string[];
  explanation?: string;
  updatedSummary?: string;
  rollbackHint?: string;
  resume?: ResumeRecord;
}

interface PendingPlan {
  planId: string;
  preview?: {
    before?: string;
    after?: string;
  };
  improvements: string[];
  explanation?: string;
}

const parseTone: Record<GlobalStatus, string> = {
  loading: "border-amber-300 bg-amber-50 text-amber-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  parse_failed: "border-rose-300 bg-rose-50 text-rose-900",
  empty: "border-slate-300 bg-slate-50 text-slate-700",
};

function toLocalDateTime(value?: string) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function ResumePage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? DEV_USER_ID;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);

  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [statusMessage, setStatusMessage] = useState("Loading latest parsing result...");
  const [loading, setLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! 我是你的 AI Career Assistant。你可以问我简历优化、面试关键词、或如何匹配目标岗位。",
    },
  ]);

  const fetchLatest = useCallback(async () => {
    setStatus("loading");
    setStatusMessage("Loading latest parsing result...");
    try {
      const { resume: latestResume, signals } = await computeOnboardingSignals(userId);
      setResume(latestResume);
      setProfileCompleted(signals.profileCompleted);

      if (!latestResume) {
        setStatus("empty");
        setStatusMessage("No parsed resume yet. Upload a PDF to start.");
        return;
      }

      setStatus("success");
      setStatusMessage("Latest parsed resume loaded.");
    } catch {
      setResume(null);
      setStatus("parse_failed");
      setStatusMessage("Unable to fetch parsed result now. Please refresh or upload again.");
    }
  }, [userId]);

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) return;
    void fetchLatest();
  }, [fetchLatest, isLoaded, user]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!chatListRef.current) return;
    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatLoading]);

  const validateFile = (selected: File | null): string | null => {
    if (!selected) return "Please select a PDF file.";
    if (selected.type !== "application/pdf") return "Only PDF files are supported in this stage.";
    if (selected.size > MAX_SIZE) return "File is too large. Max size is 8MB.";
    return null;
  };

  const upload = async () => {
    const validationError = validateFile(file);
    if (validationError) {
      setStatus("parse_failed");
      setStatusMessage(validationError);
      return;
    }
    if (!profileCompleted) {
      setStatus("parse_failed");
      setStatusMessage("Please complete onboarding profile before uploading resume.");
      return;
    }

    setLoading(true);
    setStatus("loading");
    setStatusMessage("Parsing PDF, please wait...");

    try {
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("userId", userId);

      const data = await apiFetch<ResumeRecord>("/resume/upload", {
        method: "POST",
        body: formData,
      });

      setResume(data);
      setStatus("success");
      setStatusMessage("Resume uploaded and parsed successfully.");
    } catch (error) {
      setStatus("parse_failed");
      setStatusMessage((error as Error).message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const canSend = useMemo(
    () => chatInput.trim().length > 0 && !chatLoading,
    [chatInput, chatLoading],
  );

  const callImplementPlan = async (planId: string) => {
    const data = await apiFetch<ChatResponse>("/ai/implement-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        planId,
      }),
    });

    if (data.resume) {
      setResume(data.resume);
    } else {
      await fetchLatest();
    }

    const lines = [
      "Summary 已更新。",
      ...(data.improvements?.length
        ? ["本次优化点：", ...data.improvements.map((item) => `- ${item}`)]
        : []),
      data.explanation ? `说明：${data.explanation}` : "",
      data.updatedSummary ? `修改后 Summary：${data.updatedSummary}` : "",
      data.rollbackHint || "若要回退，请输入 previous。",
    ].filter(Boolean);

    setChatMessages((prev) => [...prev, { role: "assistant", content: lines.join("\n") }]);
    setStatus("success");
    setStatusMessage("Plan implemented. Resume table updated.");
    setPendingPlan(null);
  };

  const callRollbackPrevious = async () => {
    const data = await apiFetch<ChatResponse>("/ai/rollback-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (data.resume) {
      setResume(data.resume);
    } else {
      await fetchLatest();
    }
    setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Rolled back." }]);
    setStatus("success");
    setStatusMessage("Rollback completed.");
  };

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message) return;
    const normalized = message.toLowerCase();

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    const currentPlanId = pendingPlan?.planId;

    try {
      if (
        normalized === "implement the plan" ||
        normalized === "implement plan" ||
        normalized === "implement"
      ) {
        if (!currentPlanId) {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", content: "当前没有可执行的计划。请先提出修改要求。" },
          ]);
        } else {
          setStatus("loading");
          setStatusMessage("Construction in progress...");
          await callImplementPlan(currentPlanId);
        }
        return;
      }

      if (normalized === "previous") {
        setStatus("loading");
        setStatusMessage("Rolling back to previous version...");
        await callRollbackPrevious();
        return;
      }

      if (normalized === "talk more") {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "好的，我们继续打磨这个计划。请告诉我你想强化的方向（例如：更技术、量化结果、对齐某岗位JD）。",
          },
        ]);
        return;
      }

      const data = await apiFetch<ChatResponse>("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message,
          history: nextMessages.slice(-CHAT_HISTORY_LIMIT).map((item) => ({
            role: item.role,
            content: item.content.slice(0, CHAT_HISTORY_ITEM_MAX_CHARS),
          })),
          planId: currentPlanId,
        }),
      });

      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response." }]);
      if (data.action === "plan_ready" && data.planId) {
        setPendingPlan({
          planId: data.planId,
          preview: data.preview,
          improvements: data.improvements || [],
          explanation: data.explanation,
        });
      } else if (!currentPlanId) {
        setPendingPlan(null);
      }
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

  const parserName = resume?.parsed.parser
    ? `${resume.parsed.parser.provider}${resume.parsed.parser.model ? ` / ${resume.parsed.parser.model}` : ""}${resume.parsed.parser.mode ? ` / ${resume.parsed.parser.mode}` : ""}`
    : "Not parsed yet";

  const qualityScore = useMemo(() => {
    if (!resume) return 0;
    let score = 0;
    if (resume.parsed.basics.name) score += 20;
    if (resume.parsed.basics.summary) score += 20;
    if (resume.parsed.skills.length > 0) score += 20;
    if (resume.parsed.experiences.length > 0) score += 20;
    if ((resume.parsed.education || []).length > 0) score += 20;
    return score;
  }, [resume]);

  if (HAS_CLERK && !isLoaded) {
    return <p className="text-sm text-slate-600">Loading user session...</p>;
  }

  if (HAS_CLERK && !user) {
    return (
      <section className="panel">
        <div className="panel-body space-y-3">
          <h2 className="text-xl font-bold">Please sign in first</h2>
          <p className="text-sm text-slate-600">Resume workspace requires authentication.</p>
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
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/88 p-5 shadow-[0_20px_45px_rgba(30,41,59,0.07)] backdrop-blur-sm md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-55">
          <div className="absolute -left-20 top-12 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2),rgba(59,130,246,0)_70%)]" />
          <div className="absolute right-[-70px] bottom-[-70px] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18),rgba(16,185,129,0)_72%)]" />
        </div>

        <div className="relative grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              Resume Intelligence Hub
            </div>
            <h1 className="mt-3 text-[clamp(1.95rem,3.5vw,3rem)] font-bold leading-[1.08] text-slate-900">
              Transform raw resume PDF into execution-ready career assets.
            </h1>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600 md:text-[17px]">
              Upload once, parse structure automatically, then iterate with AI rewrite plans for
              stronger positioning and higher recruiter response rates.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={upload}
                disabled={loading || !profileCompleted}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" />
                {loading ? "Uploading..." : "Upload & Parse"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void fetchLatest();
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                disabled={loading}
              >
                <FileCheck2 className="h-4 w-4" />
                Refresh Result
              </button>
              <button
                type="button"
                onClick={() => setChatInput("请帮我先诊断这份简历的最大问题")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <Wand2 className="h-4 w-4" />
                Start AI Review
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Parser</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{parserName}</p>
              <p className="mt-1 text-xs text-slate-500">Last parsed: {toLocalDateTime(resume?.createdAt)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Resume Quality</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{qualityScore}%</p>
              <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Based on profile, summary, skills, experience and education extraction.</p>
            </article>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[1.95rem] font-bold leading-tight">Upload and Parse</h2>
              <p className="mt-1 text-sm text-slate-500">PDF only, max 8MB. We extract profile, skills, experience, and education fields.</p>
            </div>
            <div className="panel-body space-y-3">
              <StatusBanner status={status} message={statusMessage} />

              {!profileCompleted ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  Complete onboarding profile first before uploading resume.
                </p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-3">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={upload}
                      disabled={loading || !profileCompleted}
                    >
                      {loading ? "Uploading..." : "Upload and parse"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        void fetchLatest();
                      }}
                      disabled={loading}
                    >
                      Refresh latest
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Parse Status</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide">
                    <span className={`rounded-full border px-2 py-0.5 ${parseTone[status]}`}>{status}</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs leading-relaxed">
                    <li>- Prefer clean ATS-friendly PDF layout</li>
                    <li>- Keep section titles explicit (Experience, Skills, Education)</li>
                    <li>- Avoid image-only text blocks</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="text-[1.95rem] font-bold leading-tight">Resume Parsing Results</h2>
              <p className="mt-1 text-sm text-slate-500">Preview your uploaded PDF and verify extracted structured data.</p>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 text-lg font-semibold">PDF preview</h3>
                {previewUrl ? (
                  <iframe
                    title="Uploaded resume preview"
                    src={previewUrl}
                    className="h-[520px] w-full rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="flex h-[520px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500">
                    Choose a PDF file to preview it here.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-3">
                {status === "loading" ? (
                  <p className="text-sm text-slate-600">loading: Parsing in progress...</p>
                ) : status === "parse_failed" ? (
                  <p className="text-sm font-medium text-rose-700">
                    parse_failed: Cannot parse this file right now. Try another PDF.
                  </p>
                ) : status === "empty" || !resume ? (
                  <p className="text-sm text-slate-600">empty: No parsed resume yet.</p>
                ) : (
                  <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        <tr>
                          <th className="w-36 border border-slate-200 px-3 py-2 text-left">Parser</th>
                          <td className="border border-slate-200 px-3 py-2">{parserName}</td>
                        </tr>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold" colSpan={2}>Profile</th>
                        </tr>
                        <tr>
                          <th className="w-36 border border-slate-200 px-3 py-2 text-left">Name</th>
                          <td className="border border-slate-200 px-3 py-2">{resume.parsed.basics.name || "-"}</td>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-3 py-2 text-left">Email</th>
                          <td className="border border-slate-200 px-3 py-2">{resume.parsed.basics.email || "-"}</td>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-3 py-2 text-left">Phone</th>
                          <td className="border border-slate-200 px-3 py-2">{resume.parsed.basics.phone || "-"}</td>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-3 py-2 text-left">Location</th>
                          <td className="border border-slate-200 px-3 py-2">{resume.parsed.basics.location || "-"}</td>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-3 py-2 text-left">Link</th>
                          <td className="border border-slate-200 px-3 py-2">{resume.parsed.basics.link || "-"}</td>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-3 py-2 text-left">Summary</th>
                          <td className="border border-slate-200 px-3 py-2">{resume.parsed.basics.summary || "-"}</td>
                        </tr>

                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold" colSpan={2}>Skills</th>
                        </tr>
                        <tr>
                          <th className="border border-slate-200 px-3 py-2 text-left">Descriptions</th>
                          <td className="border border-slate-200 px-3 py-2">
                            {resume.parsed.skills.length ? resume.parsed.skills.join(", ") : "-"}
                          </td>
                        </tr>

                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold" colSpan={2}>Work Experience</th>
                        </tr>
                        {resume.parsed.experiences.length ? (
                          resume.parsed.experiences.map((exp, idx) => (
                            <tr key={`${exp.company}-${exp.title}-${idx}`}>
                              <th className="border border-slate-200 px-3 py-2 text-left align-top">{`Experience ${idx + 1}`}</th>
                              <td className="space-y-1 border border-slate-200 px-3 py-2">
                                <p className="font-semibold">{exp.title || "-"}</p>
                                <p>{exp.company || "-"}</p>
                                <p className="text-slate-500">{(exp.start || "?") + " - " + (exp.end || "Present")}</p>
                                {exp.highlights?.length ? (
                                  <ul className="ml-4 list-disc space-y-1">
                                    {exp.highlights.map((point, pointIdx) => (
                                      <li key={`${exp.company}-${idx}-${pointIdx}`}>{point}</li>
                                    ))}
                                  </ul>
                                ) : exp.summary ? (
                                  <p>{exp.summary}</p>
                                ) : null}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <th className="border border-slate-200 px-3 py-2 text-left">Experience</th>
                            <td className="border border-slate-200 px-3 py-2">-</td>
                          </tr>
                        )}

                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-3 py-2 text-left font-semibold" colSpan={2}>Education</th>
                        </tr>
                        {resume.parsed.education?.length ? (
                          resume.parsed.education.map((edu, idx) => (
                            <tr key={`${edu.school}-${edu.degree}-${idx}`}>
                              <th className="border border-slate-200 px-3 py-2 text-left align-top">{`Education ${idx + 1}`}</th>
                              <td className="border border-slate-200 px-3 py-2">
                                <p>School: {edu.school || "-"}</p>
                                <p>Degree: {edu.degree || "-"}</p>
                                <p>GPA: {edu.gpa || "-"}</p>
                                <p>Date: {edu.date || "-"}</p>
                                {edu.descriptions?.length ? (
                                  <ul className="ml-4 mt-1 list-disc space-y-1">
                                    {edu.descriptions.map((desc, descIdx) => (
                                      <li key={`${edu.school}-${idx}-${descIdx}`}>{desc}</li>
                                    ))}
                                  </ul>
                                ) : null}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <th className="border border-slate-200 px-3 py-2 text-left">Education</th>
                            <td className="border border-slate-200 px-3 py-2">-</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>

        <aside className="panel relative h-fit overflow-hidden xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)]">
          <GlowingEffect
            spread={42}
            glow
            disabled={false}
            proximity={60}
            inactiveZone={0.1}
            borderWidth={2}
          />
          <div className="panel-header flex items-start justify-between gap-3">
            <div>
              <h3 className="text-3xl font-bold">AI Career Assistant</h3>
              <p className="text-[15px] text-slate-600">
                Rewrite, keyword match, and measurable-impact coaching.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <Bot className="h-3 w-3" />
              Online
            </span>
          </div>

          <div className="panel-body space-y-3">
            <div className="flex flex-wrap gap-2">
              {AI_HINTS.map((hint) => (
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

            <div ref={chatListRef} className="max-h-[470px] space-y-3 overflow-auto pr-1">
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`rounded-2xl border px-4 py-3 text-base leading-relaxed ${
                    msg.role === "user"
                      ? "ml-8 border-blue-200 bg-blue-50"
                      : "mr-8 border-slate-200 bg-slate-50"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading ? (
                <div className="mr-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  Thinking...
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {pendingPlan ? (
                <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-slate-700">
                  <GlowingEffect
                    spread={30}
                    glow
                    disabled={false}
                    proximity={48}
                    inactiveZone={0.12}
                    borderWidth={1}
                  />
                  <p className="inline-flex items-center gap-1 font-semibold text-slate-900">
                    <Gauge className="h-4 w-4" />
                    Plan Preview (Summary)
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Before</p>
                  <p>{pendingPlan.preview?.before || "-"}</p>
                  <p className="mt-2 text-xs text-slate-500">After</p>
                  <p>{pendingPlan.preview?.after || "-"}</p>
                  {pendingPlan.improvements.length ? (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500">Why this change</p>
                      <ul className="ml-4 list-disc">
                        {pendingPlan.improvements.map((item, idx) => (
                          <li key={`${item}-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder="Ask about improving your resume... (type: implement the plan / talk more / previous)"
                rows={3}
                className="input min-h-[104px] resize-y"
              />
              <button
                className="btn btn-primary w-full inline-flex items-center justify-center gap-1"
                type="button"
                onClick={sendChat}
                disabled={!canSend}
              >
                Send
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

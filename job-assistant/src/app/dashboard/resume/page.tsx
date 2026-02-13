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

import { StatusBanner } from "@/components/status-banner";
import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import { computeOnboardingSignals } from "@/lib/onboarding";
import type { GlobalStatus } from "@/lib/status";
import type { ResumeRecord } from "@/types/shared";

const MAX_SIZE = 8 * 1024 * 1024;
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;
const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ChatResponse {
  reply: string;
}

const parseTone: Record<GlobalStatus, string> = {
  loading: "border-amber-300 bg-amber-50 text-amber-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  parse_failed: "border-rose-300 bg-rose-50 text-rose-900",
  empty: "border-slate-300 bg-slate-50 text-slate-700",
};

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

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
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
        }),
      });

      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply || "No response." }]);
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
    <div className="space-y-4">
      <section className="panel">
        <div className="panel-body space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Upload Resume",
              "AI Builder",
              "Create New Resume",
              "Match Jobs",
              "Cover Letter",
              "New Profile",
            ].map((action, index) => (
              <button
                key={action}
                type="button"
                className={`btn ${index < 2 ? "btn-primary" : "btn-outline"}`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <section className="panel">
            <div className="panel-header">
              <h2 className="text-2xl font-bold">Upload resume</h2>
            </div>
            <div className="panel-body space-y-3">
              <StatusBanner status={status} message={statusMessage} />

              {!profileCompleted ? (
                <p className="text-sm font-medium text-rose-700">
                  Complete onboarding profile first before uploading resume.
                </p>
              ) : null}

              <p className="text-sm text-slate-600">
                PDF only, max 8MB. The backend extracts profile, skills, work experience,
                and education fields.
              </p>

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

              <div className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                <span className={`rounded-full border px-2 py-0.5 ${parseTone[status]}`}>{status}</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2 className="text-2xl font-bold">Resume parsing results</h2>
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

        <aside className="panel h-fit xl:sticky xl:top-6">
          <div className="panel-header flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">AI Career Assistant</h3>
              <p className="text-sm text-slate-600">
                Ask for rewrite tips, job-match keywords, and score advice.
              </p>
            </div>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              Online
            </span>
          </div>

          <div className="panel-body space-y-3">
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
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder="Ask about improving your resume..."
                rows={3}
                className="input min-h-[92px] resize-y"
              />
              <button className="btn btn-primary w-full" type="button" onClick={sendChat} disabled={!canSend}>
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

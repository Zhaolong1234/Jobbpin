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
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Eye,
  FileBadge2,
  FileCheck2,
  FileUp,
  Gauge,
  LayoutTemplate,
  ListPlus,
  Lock,
  PencilLine,
  Save,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";

import { StatusBanner } from "@/components/status-banner";
import { ResumeHistoryCards } from "@/components/resume-history-cards";
import { GradualSpacing } from "@/components/ui/gradual-spacing";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import {
  ResumeTemplatePreview,
  type PreviewDensity,
  type PreviewFontFamily,
  type PreviewShape,
  type PreviewTextScale,
} from "@/components/ui/resume-template-preview";
import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import { computeOnboardingSignals } from "@/lib/onboarding";
import type { GlobalStatus } from "@/lib/status";
import type { ResumeParsed, ResumeRecord } from "@/types/shared";

const MAX_SIZE = 8 * 1024 * 1024;
const FREE_DAILY_CHAT_LIMIT = 5;
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;
const HAS_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const AI_HINTS = [
  "Help me rewrite my summary to sound more like a Software Engineer.",
  "Based on my current resume, give me 3 quantified achievement rewrites.",
  "Optimize keywords so ATS can match me better.",
];

type ResumeTemplate = "classic" | "modern" | "compact";

function isResumeTemplate(value: unknown): value is ResumeTemplate {
  return value === "classic" || value === "modern" || value === "compact";
}

interface TemplateOption {
  id: ResumeTemplate;
  name: string;
  note: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "classic",
    name: "Harvard ATS",
    note: "Traditional academic-professional layout with strong section rules.",
  },
  {
    id: "modern",
    name: "Modern Pro",
    note: "Card-based visual hierarchy for startup and product applications.",
  },
  {
    id: "compact",
    name: "Compact Grid",
    note: "Denser two-column style for experienced profiles and short scan time.",
  },
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
  usage?: {
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
  } | null;
}

interface DeleteResumeResponse {
  deleted: boolean;
  latest: ResumeRecord | null;
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
  const searchParams = useSearchParams();
  const userId = user?.id ?? DEV_USER_ID;
  const requestedResumeId = (searchParams.get("resumeId") || "").trim();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [resumeHistory, setResumeHistory] = useState<ResumeRecord[]>([]);
  const [deletingResumeId, setDeletingResumeId] = useState<string | null>(null);
  const [showParseWorkspace, setShowParseWorkspace] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("incomplete");
  const [subscriptionPlan, setSubscriptionPlan] = useState("free");
  const [freeChatUsage, setFreeChatUsage] = useState({
    dailyLimit: FREE_DAILY_CHAT_LIMIT,
    usedToday: 0,
    remainingToday: FREE_DAILY_CHAT_LIMIT,
  });
  const [uploadPrompt, setUploadPrompt] = useState<string | null>(null);

  const [status, setStatus] = useState<GlobalStatus>("loading");
  const [statusMessage, setStatusMessage] = useState("Loading latest parsing result...");
  const [loading, setLoading] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"preview" | "editor">("preview");
  const [editorTemplate, setEditorTemplate] = useState<ResumeTemplate>("classic");
  const [editorDraft, setEditorDraft] = useState<ResumeParsed | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorNotice, setEditorNotice] = useState("");
  const [previewFont, setPreviewFont] = useState<PreviewFontFamily>("arial");
  const [previewDensity, setPreviewDensity] = useState<PreviewDensity>("default");
  const [previewTextScale, setPreviewTextScale] = useState<PreviewTextScale>("default");
  const [previewShape, setPreviewShape] = useState<PreviewShape>("rounded");
  const [previewShowBackground, setPreviewShowBackground] = useState(true);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const uploadSectionRef = useRef<HTMLElement | null>(null);
  const resumePrintRef = useRef<HTMLDivElement | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I am your AI Career Assistant. Ask me about resume optimization, interview keywords, or how to match target roles.",
    },
  ]);

  const fetchLatest = useCallback(async () => {
    setStatus("loading");
    setStatusMessage("Loading latest parsing result...");
    try {
      const [{ resume: latestResume, signals, subscription }, history] = await Promise.all([
        computeOnboardingSignals(userId),
        apiFetch<ResumeRecord[]>(`/resume/${userId}/history?limit=12`).catch(() => []),
      ]);
      const mergedHistory =
        history.length > 0
          ? history
          : latestResume
            ? [latestResume]
            : [];

      setResume(latestResume);
      setResumeHistory(mergedHistory);
      setProfileCompleted(signals.profileCompleted);
      const isSubscribed = ["trialing", "active", "past_due"].includes(subscription.status);
      setSubscriptionActive(isSubscribed);
      setSubscriptionStatus(subscription.status);
      setSubscriptionPlan(subscription.plan || "free");
      if (!isSubscribed) {
        setFreeChatUsage({
          dailyLimit: FREE_DAILY_CHAT_LIMIT,
          usedToday: 0,
          remainingToday: FREE_DAILY_CHAT_LIMIT,
        });
      }

      if (!latestResume) {
        setShowParseWorkspace(false);
        setUploadPrompt("Let's upload and parse your resume to get started.");
        setStatus("empty");
        setStatusMessage("No parsed resume yet. Upload a PDF to start.");
        return;
      }

      setUploadPrompt(null);
      setStatus("success");
      setStatusMessage("Latest parsed resume loaded. Select one from My Resume or upload a new file.");
    } catch {
      setResume(null);
      setResumeHistory([]);
      setShowParseWorkspace(false);
      setSubscriptionActive(false);
      setSubscriptionStatus("incomplete");
      setSubscriptionPlan("free");
      setFreeChatUsage({
        dailyLimit: FREE_DAILY_CHAT_LIMIT,
        usedToday: 0,
        remainingToday: FREE_DAILY_CHAT_LIMIT,
      });
      setStatus("parse_failed");
      setStatusMessage("Unable to fetch parsed result now. Please refresh or upload again.");
    }
  }, [userId]);

  const scrollToUploadSection = useCallback(() => {
    uploadSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    if (HAS_CLERK && !isLoaded) return;
    if (HAS_CLERK && !user) return;
    void fetchLatest();
  }, [fetchLatest, isLoaded, user]);

  useEffect(() => {
    if (!requestedResumeId) return;
    const matched = resumeHistory.find((item) => item.id === requestedResumeId);
    if (!matched) return;
    setResume(matched);
    setWorkspaceMode("preview");
    setShowParseWorkspace(true);
    setStatus("success");
    setStatusMessage("Loaded selected resume from history.");
    setPendingPlan(null);
    setChatMessages([
      {
        role: "assistant",
        content:
          "Loaded selected resume from history. I will use this resume as context for AI suggestions.",
      },
    ]);
    scrollToUploadSection();
  }, [requestedResumeId, resumeHistory, scrollToUploadSection]);

  useEffect(() => {
    if (!HAS_CLERK) return;
    if (!isLoaded || user) return;
    setFile(null);
    setPreviewUrl("");
    setResume(null);
    setResumeHistory([]);
    setShowParseWorkspace(false);
    setWorkspaceMode("preview");
    setEditorDraft(null);
    setEditorDirty(false);
    setEditorNotice("");
    setStatus("empty");
    setStatusMessage("Session ended. Sign in to load your resume workspace.");
  }, [isLoaded, user]);

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

  useEffect(() => {
    if (!resume) {
      setEditorDraft(null);
      setEditorTemplate("classic");
      setEditorDirty(false);
      setEditorNotice("");
      return;
    }
    const cloned = JSON.parse(JSON.stringify(resume.parsed)) as ResumeParsed;
    setEditorDraft(cloned);
    const initialTemplate = isResumeTemplate(resume.templateId) ? resume.templateId : "classic";
    setEditorTemplate(!subscriptionActive && initialTemplate !== "classic" ? "classic" : initialTemplate);
    setEditorDirty(false);
    setEditorNotice("");
  }, [resume?.id, resume?.createdAt, resume?.templateId, subscriptionActive]);

  const validateFile = (selected: File | null): string | null => {
    if (!selected) return "Please select a PDF file.";
    if (selected.type !== "application/pdf") return "Only PDF files are supported in this stage.";
    if (selected.size > MAX_SIZE) return "File is too large. Max size is 8MB.";
    return null;
  };

  const openResumeFromHistory = useCallback((target: ResumeRecord) => {
    setFile(null);
    setPreviewUrl("");
    setResume(target);
    setWorkspaceMode("preview");
    setShowParseWorkspace(true);
    setEditorNotice("");
    setStatus("success");
    setStatusMessage("Loaded selected resume version.");
    setPendingPlan(null);
    setChatMessages([
      {
        role: "assistant",
        content:
          "Loaded selected resume version. I will use this resume as context for AI suggestions.",
      },
    ]);
    scrollToUploadSection();
  }, [scrollToUploadSection]);

  const deleteResumeFromHistory = useCallback(
    async (target: ResumeRecord) => {
      const ok = window.confirm(
        "Delete this resume permanently? This will remove it from the database.",
      );
      if (!ok) return;

      setDeletingResumeId(target.id);
      try {
        const data = await apiFetch<DeleteResumeResponse>(
          `/resume/${userId}/history/${encodeURIComponent(target.id)}`,
          {
            method: "DELETE",
          },
        );
        if (!data.deleted) {
          setStatus("parse_failed");
          setStatusMessage("Resume not found or already deleted.");
          return;
        }

        setResumeHistory((prev) => prev.filter((item) => item.id !== target.id));

        if (resume?.id === target.id) {
          setFile(null);
          setPreviewUrl("");
          if (data.latest) {
            setResume(data.latest);
            setWorkspaceMode("preview");
            setShowParseWorkspace(true);
            setStatus("success");
            setStatusMessage("Resume deleted. Switched to latest remaining version.");
          } else {
            setResume(null);
            setWorkspaceMode("preview");
            setShowParseWorkspace(false);
            setStatus("empty");
            setStatusMessage("Resume deleted. No parsed resumes left.");
          }
          return;
        }

        setStatus("success");
        setStatusMessage("Resume deleted successfully.");
      } catch (error) {
        setStatus("parse_failed");
        setStatusMessage((error as Error).message || "Failed to delete resume.");
      } finally {
        setDeletingResumeId(null);
      }
    },
    [resume?.id, userId],
  );

  const upload = async () => {
    scrollToUploadSection();
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
    setShowParseWorkspace(true);
    setWorkspaceMode("preview");
    setResume(null);
    setEditorDraft(null);
    setEditorDirty(false);
    setEditorNotice("");
    setStatus("loading");
    setStatusMessage(
      "Parsing new PDF, please wait... You can still open previous resumes from My Resume.",
    );

    try {
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("userId", userId);

      const data = await apiFetch<ResumeRecord>("/resume/upload", {
        method: "POST",
        body: formData,
      });

      setResume(data);
      setResumeHistory((prev) => [data, ...prev.filter((item) => item.id !== data.id)].slice(0, 12));
      setUploadPrompt(null);
      setStatus("success");
      setStatusMessage("Resume uploaded and parsed successfully.");
    } catch (error) {
      setStatus("parse_failed");
      setStatusMessage((error as Error).message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const isFreeChatExhausted = !subscriptionActive && freeChatUsage.remainingToday <= 0;
  const canSend = useMemo(
    () => chatInput.trim().length > 0 && !chatLoading && !isFreeChatExhausted,
    [chatInput, chatLoading, isFreeChatExhausted],
  );
  const activeResumeId = resume?.id;

  const downloadResumeOnly = useCallback(() => {
    const target = resumePrintRef.current;
    if (!target) {
      setEditorNotice("Resume preview is unavailable. Please upload or open a resume first.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setEditorNotice("Popup blocked. Please allow popups to download resume PDF.");
      return;
    }

    const styleTags = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((node) => node.outerHTML)
      .join("\n");
    const contentHtml = target.innerHTML;

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resume Export</title>
          ${styleTags}
          <style>
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .resume-export-root {
              padding: 10px;
            }
            [contenteditable="true"] {
              outline: none !important;
            }
            .resume-export-root [data-editor-control="true"] {
              display: none !important;
            }
            .resume-export-root .resume-preview-page {
              box-shadow: none !important;
            }
            .resume-export-root ul {
              margin-top: 0.25rem;
              margin-bottom: 0.25rem;
            }
            @media print {
              @page {
                margin: 10mm;
              }
              html, body {
                width: 100%;
                height: 100%;
              }
              .resume-export-root {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="resume-export-root">${contentHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 120);
    };
    setEditorNotice("Resume-only PDF export started.");
  }, [setEditorNotice]);

  const callImplementPlan = async (planId: string) => {
    const data = await apiFetch<ChatResponse>("/ai/implement-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        planId,
        resumeId: activeResumeId,
      }),
    });

    if (data.resume) {
      setResume(data.resume);
    } else {
      await fetchLatest();
    }

    const lines = [
      "Summary has been updated.",
      ...(data.improvements?.length
        ? ["Optimization highlights:", ...data.improvements.map((item) => `- ${item}`)]
        : []),
      data.explanation ? `Why this update: ${data.explanation}` : "",
      data.updatedSummary ? `Updated summary: ${data.updatedSummary}` : "",
      data.rollbackHint || "To roll back, type previous.",
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
    if (isFreeChatExhausted) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Free plan daily limit reached (5/5). Please upgrade to continue AI chat today.",
        },
      ]);
      return;
    }
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
            { role: "assistant", content: "No executable plan yet. Please ask for a resume change first." },
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
              "Great, let's refine this plan. Tell me what you want to strengthen (for example: more technical depth, quantified impact, or alignment to a target JD).",
          },
        ]);
        return;
      }

      const data = await apiFetch<ChatResponse>("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          resumeId: activeResumeId,
          message,
          history: nextMessages.slice(-CHAT_HISTORY_LIMIT).map((item) => ({
            role: item.role,
            content: item.content.slice(0, CHAT_HISTORY_ITEM_MAX_CHARS),
          })),
          planId: currentPlanId,
        }),
      });

      if (data.usage) {
        setFreeChatUsage({
          dailyLimit: data.usage.dailyLimit,
          usedToday: data.usage.usedToday,
          remainingToday: data.usage.remainingToday,
        });
      }
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
      const nextMessage = (error as Error).message || "Chat request failed.";
      if (nextMessage.toLowerCase().includes("free plan limit reached")) {
        setFreeChatUsage({
          dailyLimit: FREE_DAILY_CHAT_LIMIT,
          usedToday: FREE_DAILY_CHAT_LIMIT,
          remainingToday: 0,
        });
      }
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Chat request failed: ${nextMessage}` },
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

  const selectedTemplate = useMemo(
    () =>
      TEMPLATE_OPTIONS.find((option) => option.id === editorTemplate) ||
      TEMPLATE_OPTIONS[0],
    [editorTemplate],
  );
  const isTemplateLocked = useCallback(
    (templateId: ResumeTemplate) =>
      !subscriptionActive && templateId !== "classic",
    [subscriptionActive],
  );
  const templateUpgradeHint =
    "Upgrade subscription to unlock Modern Pro and Compact Grid templates.";

  const markEditorChanged = () => {
    setEditorDirty(true);
    setEditorNotice("");
  };

  const insertBulletAtCursor = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const bulletNode = document.createTextNode("• ");
    range.insertNode(bulletNode);
    range.setStartAfter(bulletNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    markEditorChanged();
    setEditorNotice("Bullet point inserted.");
  };

  const saveEditorDraft = async () => {
    if (!editorDraft) return;
    setEditorSaving(true);
    setEditorNotice("");
    const templateForSave: ResumeTemplate = subscriptionActive ? editorTemplate : "classic";

    try {
      const saved = await apiFetch<ResumeRecord>(`/resume/${userId}/latest`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsed: editorDraft,
          templateId: templateForSave,
        }),
      });
      setResume(saved);
      if (!subscriptionActive && editorTemplate !== "classic") {
        setEditorTemplate("classic");
      }
      setStatus("success");
      setStatusMessage("Resume edits saved successfully.");
      setEditorDirty(false);
      setEditorNotice(
        !subscriptionActive && editorTemplate !== "classic"
          ? `Saved with Harvard ATS template. ${templateUpgradeHint}`
          : `Saved at ${toLocalDateTime(saved.createdAt)}.`,
      );
    } catch (error) {
      const nextMessage = (error as Error).message || "Failed to save resume edits.";
      setEditorNotice(nextMessage);
      setStatus("parse_failed");
      setStatusMessage(nextMessage);
    } finally {
      setEditorSaving(false);
    }
  };

  const parserName = resume?.parsed.parser
    ? `${resume.parsed.parser.provider}${resume.parsed.parser.model ? ` / ${resume.parsed.parser.model}` : ""}${resume.parsed.parser.mode ? ` / ${resume.parsed.parser.mode}` : ""}`
    : "Not parsed yet";

  const aiAssessment = resume?.parsed.aiAssessment;
  const aiScore =
    typeof aiAssessment?.score === "number" && Number.isFinite(aiAssessment.score)
      ? Math.max(0, Math.min(100, Math.round(aiAssessment.score)))
      : null;
  const hasAiScore = aiScore !== null;
  const qualityScore = useMemo(() => {
    if (aiScore !== null) return aiScore;
    if (!resume) return 0;
    let score = 0;
    if (resume.parsed.basics.name) score += 20;
    if (resume.parsed.basics.summary) score += 20;
    if (resume.parsed.skills.length > 0) score += 20;
    if (resume.parsed.experiences.length > 0) score += 20;
    if ((resume.parsed.education || []).length > 0) score += 20;
    return score;
  }, [aiScore, resume]);

  const resumeTitle = useMemo(() => {
    const namedRole = resume?.parsed.experiences?.[0]?.title?.trim();
    if (namedRole) return `${namedRole} Resume`;
    return profileCompleted ? "Career Resume" : "Untitled Resume";
  }, [profileCompleted, resume?.parsed.experiences]);

  const completedSections = useMemo(() => {
    if (!resume) return 0;
    const sections = [
      Boolean(resume.parsed.basics.name || resume.parsed.basics.email),
      Boolean(resume.parsed.basics.summary),
      resume.parsed.skills.length > 0,
      resume.parsed.experiences.length > 0,
      (resume.parsed.education || []).length > 0,
    ];
    return sections.filter(Boolean).length;
  }, [resume]);

  const scoreReason = useMemo(() => {
    if (!resume) return "No parsed resume available yet.";
    if (aiAssessment?.summary) return aiAssessment.summary;
    if (hasAiScore) return "AI completed scoring but did not return a detailed reason.";
    return "AI score not available for this resume yet. Upload and parse again to generate score reasoning.";
  }, [aiAssessment?.summary, hasAiScore, resume]);

  const scoreStrengths = useMemo(() => {
    if (aiAssessment?.strengths?.length) return aiAssessment.strengths;
    if (!resume) return [];
    const strengths: string[] = [];
    if (resume.parsed.basics.summary) strengths.push("Profile summary is present.");
    if (resume.parsed.skills.length > 0) strengths.push("Skills section has extracted keywords.");
    if (resume.parsed.experiences.length > 0) strengths.push("Work experience entries were detected.");
    return strengths.slice(0, 3);
  }, [aiAssessment?.strengths, resume]);

  const scoreImprovements = useMemo(() => {
    if (aiAssessment?.improvements?.length) return aiAssessment.improvements;
    if (!resume) return [];
    const fixes: string[] = [];
    if (!resume.parsed.basics.summary) fixes.push("Add a concise summary tailored to your target role.");
    if (resume.parsed.skills.length < 8) fixes.push("Add more role-specific keywords to improve ATS matching.");
    if (!resume.parsed.experiences.some((exp) => (exp.highlights || []).length > 0)) {
      fixes.push("Add measurable bullet points in experience (impact, scale, outcome).");
    }
    if ((resume.parsed.education || []).length === 0) {
      fixes.push("Add education details for profile completeness.");
    }
    return fixes.slice(0, 4);
  }, [aiAssessment?.improvements, resume]);

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
            <div className="mt-3">
              <GradualSpacing
                text="Transform raw resume PDF into execution-ready career assets."
                duration={0.32}
                delayMultiple={0.01}
                className="text-[clamp(1.95rem,3.5vw,3rem)] font-bold leading-[1.08] text-slate-900"
              />
            </div>
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
                  scrollToUploadSection();
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
                onClick={() => {
                  scrollToUploadSection();
                  if (!resume) {
                    setUploadPrompt("Let's upload and parse your resume to get started.");
                    setStatus("empty");
                    setStatusMessage("Let's upload and parse your resume to get started.");
                    return;
                  }
                  setChatInput("Please diagnose the biggest weaknesses in this resume.");
                }}
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
              <p className="mt-1 text-xs text-slate-500">
                {hasAiScore
                  ? `AI scored ${aiAssessment?.generatedAt ? toLocalDateTime(aiAssessment.generatedAt) : "recently"}`
                  : "Fallback score based on profile, summary, skills, experience and education extraction."}
              </p>
            </article>
          </div>
        </div>
      </section>

      {!subscriptionActive ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Lock className="h-4 w-4" />
                Free Plan Restrictions Active
              </p>
              <p className="mt-1 text-sm text-amber-800">
                AI chat limit: {freeChatUsage.usedToday}/{freeChatUsage.dailyLimit} used today (
                {freeChatUsage.remainingToday} left). Resume templates: Harvard ATS only.
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Current status: {subscriptionStatus} · plan: {subscriptionPlan}
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              Upgrade Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : null}

      <ResumeHistoryCards
        resumes={resumeHistory}
        actionLabel="Open Workspace"
        onOpen={openResumeFromHistory}
        onDelete={deleteResumeFromHistory}
        deletingResumeId={deletingResumeId}
        description="Manage and reopen previous parsed resumes. Start new parse without losing old versions."
      />

      {!showParseWorkspace ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6">
          <h2 className="text-2xl font-bold text-slate-900">Parse Workspace Is Hidden</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Click <span className="font-semibold text-slate-900">Upload &amp; Parse</span> to start a
            new parse session, or open any card in <span className="font-semibold text-slate-900">My Resume</span>{" "}
            to continue editing a previous version.
          </p>
        </section>
      ) : null}

      {showParseWorkspace ? (
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/92 p-5 shadow-[0_16px_32px_rgba(15,23,42,0.06)] md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-[-30px] top-[-30px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.16),rgba(99,102,241,0)_72%)]" />
          <div className="absolute right-[-40px] bottom-[-50px] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14),rgba(56,189,248,0)_72%)]" />
        </div>
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[clamp(1.9rem,3.2vw,2.8rem)] font-bold leading-tight text-slate-900">
                {resumeTitle}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                This is your source-of-truth resume workspace. Keep your latest uploaded version clean,
                then turn on editor mode when you want to refine content or styling.
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800">
              Default Resume
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <button
              type="button"
              disabled
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-white opacity-80"
            >
              <Lock className="h-4 w-4" />
              Match with Jobs (Coming Soon)
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceMode("editor")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              <PencilLine className="h-4 w-4" />
              Resume Editor
            </button>
            <button
              type="button"
              onClick={() => {
                setWorkspaceMode("preview");
                setEditorNotice("Preview mode enabled.");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-black"
            >
              <Upload className="h-4 w-4" />
              Upload New Version
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-600">
            <p>
              Belongs to Profile:{" "}
              <span className="font-semibold text-slate-900">
                {resume?.parsed.experiences?.[0]?.title || "Software Engineer"}
              </span>
            </p>
            <p>
              Last Edited:{" "}
              <span className="font-semibold text-slate-900">{toLocalDateTime(resume?.createdAt)}</span>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <FileBadge2 className="h-4 w-4 text-blue-600" />
                Master Resume Score
              </p>
              <p className="mt-2 text-[2.2rem] font-bold leading-none text-slate-900">
                {qualityScore}
                <span className="text-2xl font-medium text-slate-500">/100</span>
              </p>
              <div className="mt-3 h-2.5 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"
                  style={{ width: `${qualityScore}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {hasAiScore ? "Scored by AI after successful upload parse." : "Using fallback section-completeness scoring."}
              </p>
              {aiAssessment?.summary ? (
                <p className="mt-1 text-xs text-slate-600">{aiAssessment.summary}</p>
              ) : null}
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                Resume Completeness
              </p>
              <p className="mt-2 text-[2.2rem] font-bold leading-none text-slate-900">
                {completedSections}
                <span className="text-2xl font-medium text-slate-500">/5</span>
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Sections tracked: basic info, summary, skills, experience, education.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Gauge className="h-4 w-4 text-violet-600" />
                Workspace Mode
              </p>
              <p className="mt-2 text-xl font-bold text-slate-900">
                {workspaceMode === "preview" ? "Preview Only" : "Editor Enabled"}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                {workspaceMode === "preview"
                  ? "Only shows your previously uploaded and parsed resume."
                  : "Editing mode is active. Save to create a new resume version."}
              </p>
            </article>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setWorkspaceMode("preview")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  workspaceMode === "preview"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  Show Preview
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode("editor")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  workspaceMode === "editor"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <PencilLine className="h-4 w-4" />
                  Resume Editor
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {workspaceMode === "preview"
                ? "Preview mode: only previously uploaded resume is shown below."
                : "Editor mode: modify fields, choose template, and save a new version."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                Resume Templates
              </p>
              <button
                type="button"
                onClick={() => setWorkspaceMode("editor")}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Open Editor
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {TEMPLATE_OPTIONS.map((template) => {
                const templateLocked = isTemplateLocked(template.id);
                return (
                  <button
                    key={`quick-template-${template.id}`}
                    type="button"
                    disabled={templateLocked}
                    onClick={() => {
                      if (templateLocked) {
                        setEditorNotice(templateUpgradeHint);
                        return;
                      }
                      setEditorTemplate(template.id);
                      setWorkspaceMode("editor");
                      if (editorDraft) {
                        setEditorDirty(true);
                        setEditorNotice(`Template switched to ${template.name}.`);
                      } else {
                        setEditorNotice(`Template selected: ${template.name}. Upload and parse a resume to start editing.`);
                      }
                    }}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      templateLocked
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                        : editorTemplate === template.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-slate-50 hover:bg-white"
                    }`}
                  >
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      {templateLocked ? <Lock className="h-3.5 w-3.5 text-slate-500" /> : null}
                      {template.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{template.note}</p>
                    {templateLocked ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-700">
                        Pro only
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Current template:{" "}
              <span className="font-semibold text-slate-700">{selectedTemplate.name}</span>.{" "}
              {!subscriptionActive ? templateUpgradeHint : "You can apply it to parsed resume and save as a new version."}
            </p>
          </div>
        </div>
      </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <section ref={uploadSectionRef} className="panel">
            <div className="panel-header">
              <h2 className="text-[1.95rem] font-bold leading-tight">Upload and Parse</h2>
              <p className="mt-1 text-sm text-slate-500">PDF only, max 8MB. We extract profile, skills, experience, and education fields.</p>
            </div>
            <div className="panel-body space-y-3">
              <StatusBanner status={status} message={statusMessage} />

              {uploadPrompt ? (
                <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                  {uploadPrompt}
                </p>
              ) : null}

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

          {showParseWorkspace ? (
            <>
          {workspaceMode === "editor" ? (
          <section className="panel">
            <div className="panel-header flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-[1.95rem] font-bold leading-tight">
                  <PencilLine className="h-7 w-7 text-blue-600" />
                  Resume Editor
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Edit structured resume fields and choose a template style for preview.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void saveEditorDraft()}
                disabled={!editorDirty || editorSaving || !editorDraft}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {editorSaving ? "Saving..." : "Save edits"}
              </button>
            </div>

            <div className="panel-body space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {TEMPLATE_OPTIONS.map((template) => {
                  const templateLocked = isTemplateLocked(template.id);
                  return (
                    <button
                      key={template.id}
                      type="button"
                      disabled={templateLocked}
                      onClick={() => {
                        if (templateLocked) {
                          setEditorNotice(templateUpgradeHint);
                          return;
                        }
                        if (editorTemplate === template.id) return;
                        setEditorTemplate(template.id);
                        setEditorDirty(true);
                        setEditorNotice(`Template switched to ${template.name}.`);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left transition ${
                        templateLocked
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                          : editorTemplate === template.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                        <LayoutTemplate className="h-3.5 w-3.5" />
                        {templateLocked ? <Lock className="h-3.5 w-3.5 text-slate-500" /> : null}
                        {template.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{template.note}</p>
                      {templateLocked ? (
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          Pro only
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {editorNotice
                  ? editorNotice
                  : editorDirty
                    ? "Unsaved changes. Save to create a new resume version."
                    : "Editor is synced with latest parsed resume."}
              </div>

              {!editorDraft ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-500">
                  Upload and parse a resume first to start editing.
                </div>
              ) : (
                <div className="space-y-3">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                      <select
                        value={previewFont}
                        onChange={(event) =>
                          setPreviewFont(event.target.value as PreviewFontFamily)
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                      >
                        <option value="arial">Arial</option>
                        <option value="inter">Inter</option>
                        <option value="georgia">Georgia</option>
                      </select>
                      <select
                        value={previewDensity}
                        onChange={(event) =>
                          setPreviewDensity(event.target.value as PreviewDensity)
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                      >
                        <option value="compact">Compact spacing</option>
                        <option value="default">Default spacing</option>
                        <option value="relaxed">Relaxed spacing</option>
                      </select>
                      <select
                        value={previewTextScale}
                        onChange={(event) =>
                          setPreviewTextScale(event.target.value as PreviewTextScale)
                        }
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                      >
                        <option value="small">Small text</option>
                        <option value="default">Default text</option>
                        <option value="large">Large text</option>
                      </select>
                      <select
                        value={previewShape}
                        onChange={(event) => setPreviewShape(event.target.value as PreviewShape)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700"
                      >
                        <option value="rounded">Rounded</option>
                        <option value="square">Square</option>
                        <option value="soft">Soft corners</option>
                      </select>

                      <button
                        type="button"
                        onClick={insertBulletAtCursor}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ListPlus className="h-4 w-4" />
                        Bullet Point
                      </button>

                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={previewShowBackground}
                          onChange={(event) => setPreviewShowBackground(event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Background
                      </label>

                      <div className="ml-auto flex items-center gap-2">
                        <button
                          type="button"
                          onClick={downloadResumeOnly}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Upload className="h-4 w-4" />
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEditorDraft()}
                          disabled={!editorDirty || editorSaving || !editorDraft}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Save className="h-4 w-4" />
                          {editorSaving ? "Saving..." : "Save edits"}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="max-h-[82vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div ref={resumePrintRef}>
                        <ResumeTemplatePreview
                          parsed={editorDraft}
                          template={editorTemplate}
                          fontFamily={previewFont}
                          density={previewDensity}
                          textScale={previewTextScale}
                          shape={previewShape}
                          showBackground={previewShowBackground}
                          editable
                          onChange={(next) => {
                            setEditorDraft(next);
                            markEditorChanged();
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Direct editor tips</p>
                    <p className="mt-1">
                      Click any text inside the resume to edit in place. Use toolbar controls for
                      font, size, spacing and card shape. Save edits to keep changes, then use
                      Download PDF to export.
                    </p>
                  </section>
                </div>
              )}
            </div>
          </section>
          ) : (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-[1.55rem] font-bold leading-tight">Preview Mode</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Resume editor is currently hidden. You are viewing the previously uploaded resume only.
                </p>
              </div>
              <div className="panel-body">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                  Click <span className="font-semibold text-slate-900">Resume Editor</span> above whenever you want to edit content,
                  choose template style, and save a new version.
                </div>
              </div>
            </section>
          )}

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

          <section className="panel">
            <div className="panel-header flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[1.55rem] font-bold leading-tight">AI Suggestion</h2>
              <span className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Score {qualityScore}/100
              </span>
            </div>
            <div className="panel-body">
              {status === "loading" ? (
                <p className="text-sm text-slate-600">Generating AI suggestion...</p>
              ) : status === "parse_failed" ? (
                <p className="text-sm text-rose-700">
                  No AI suggestion available. Please upload and parse a valid resume first.
                </p>
              ) : status === "empty" || !resume ? (
                <p className="text-sm text-slate-600">No AI suggestion yet.</p>
              ) : (
                <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Why this score:</span>{" "}
                    {scoreReason}
                  </p>

                  {scoreStrengths.length ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">What is working</p>
                      <ul className="mt-1 ml-4 list-disc space-y-1 text-sm text-slate-700">
                        {scoreStrengths.map((item, idx) => (
                          <li key={`score-strength-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {scoreImprovements.length ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Suggested revisions</p>
                      <ul className="mt-1 ml-4 list-disc space-y-1 text-sm text-slate-700">
                        {scoreImprovements.map((item, idx) => (
                          <li key={`score-improvement-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="mt-3 text-xs text-slate-500">
                    {hasAiScore
                      ? `Generated by AI scoring model${aiAssessment?.model ? ` (${aiAssessment.model})` : ""}${
                          aiAssessment?.generatedAt
                            ? ` at ${toLocalDateTime(aiAssessment.generatedAt)}`
                            : ""
                        }.`
                      : "AI scoring detail is unavailable for this record. Re-upload and parse to regenerate AI assessment."}
                  </p>
                </section>
              )}
            </div>
          </section>
            </>
          ) : (
            <section className="panel">
              <div className="panel-header">
                <h2 className="text-[1.55rem] font-bold leading-tight">No Active Parse Session</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Parse results, editor, and AI suggestions stay hidden until you start a new upload
                  parse or open a previous resume card.
                </p>
              </div>
              <div className="panel-body">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Start from <span className="font-semibold text-slate-900">Upload and Parse</span>{" "}
                  above, or choose <span className="font-semibold text-slate-900">Open Workspace</span>{" "}
                  in My Resume cards.
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="panel relative overflow-hidden xl:sticky xl:top-24 xl:flex xl:h-[calc(100vh-120px)] xl:min-h-[620px] xl:flex-col">
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
              {!subscriptionActive ? (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs">
                  <p className="font-semibold text-amber-900">Free plan mode</p>
                  <p className="mt-0.5 text-amber-800">
                    AI chat: {freeChatUsage.usedToday}/{freeChatUsage.dailyLimit} used today,{" "}
                    {freeChatUsage.remainingToday} left.
                  </p>
                </div>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <Bot className="h-3 w-3" />
              Online
            </span>
          </div>

          <div className="panel-body space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
            <div className="flex flex-wrap gap-2 xl:shrink-0">
              {AI_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  disabled={isFreeChatExhausted}
                  onClick={() => setChatInput(hint)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {hint}
                </button>
              ))}
            </div>

            <div
              ref={chatListRef}
              className="max-h-[42vh] space-y-3 overflow-auto pr-1 sm:max-h-[470px] xl:min-h-0 xl:max-h-none xl:flex-1"
            >
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

            <div className="space-y-2 border-t border-slate-200 pt-3 xl:shrink-0 xl:bg-white/95">
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
                placeholder={
                  isFreeChatExhausted
                    ? "Daily free limit reached. Upgrade in Billing to continue AI chat."
                    : "Ask about improving your resume... (type: implement the plan / talk more / previous)"
                }
                rows={2}
                className="input min-h-[84px] resize-y max-h-[180px]"
              />
              <button
                className="btn btn-primary w-full inline-flex items-center justify-center gap-1"
                type="button"
                onClick={sendChat}
                disabled={!canSend}
              >
                {isFreeChatExhausted ? "Limit Reached" : "Send"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

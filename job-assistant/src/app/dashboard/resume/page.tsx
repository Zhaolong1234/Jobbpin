"use client";

import {
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import type { ResumeRecord } from "@/types/shared";

import styles from "./page.module.css";

const MAX_SIZE = 8 * 1024 * 1024;
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_ITEM_MAX_CHARS = 1200;

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface ChatResponse {
  reply: string;
}

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [notice, setNotice] = useState("");
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
    try {
      const data = await apiFetch<ResumeRecord | null>(
        `/resume/${DEV_USER_ID}/latest`,
      );
      setResume(data);
    } catch {
      setResume(null);
    }
  }, []);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

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
    if (selected.type !== "application/pdf") {
      return "Only PDF files are supported in this stage.";
    }
    if (selected.size > MAX_SIZE) {
      return "File is too large. Max size is 8MB.";
    }
    return null;
  };

  const upload = async () => {
    setError("");
    setNotice("");
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("userId", DEV_USER_ID);
      const data = await apiFetch<ResumeRecord>("/resume/upload", {
        method: "POST",
        body: formData,
      });
      setResume(data);
      setNotice("Resume uploaded and parsed successfully.");
    } catch (e) {
      setError((e as Error).message || "Upload failed");
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

    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: message },
    ];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const data = await apiFetch<ChatResponse>("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEV_USER_ID,
          message,
          history: nextMessages.slice(-CHAT_HISTORY_LIMIT).map((item) => ({
            role: item.role,
            content: item.content.slice(0, CHAT_HISTORY_ITEM_MAX_CHARS),
          })),
        }),
      });
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "No response." },
      ]);
    } catch (e) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Chat request failed: ${(e as Error).message}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const onChatKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void sendChat();
      }
    }
  };

  return (
    <div className={`stack-16 ${styles.pageStack}`}>
      <section className={`panel ${styles.heroPanel}`}>
        <div className="panel-body">
          <div className={styles.heroCopy}>
            <h2>Resume Workspace</h2>
            <p className="text-muted">
              Upload a resume, preview it, parse fields into a table, then ask
              AI for optimization suggestions.
            </p>
          </div>
          <div className={styles.actionGrid}>
            <button className={`btn btn-primary ${styles.actionBtn}`} type="button">
              Upload Resume
            </button>
            <button className={`btn btn-primary ${styles.actionBtn}`} type="button">
              AI Builder
            </button>
            <button className={`btn btn-outline ${styles.actionBtn}`} type="button">
              Create New Resume
            </button>
            <button className={`btn btn-outline ${styles.actionBtn}`} type="button">
              Match Jobs
            </button>
            <button className={`btn btn-outline ${styles.actionBtn}`} type="button">
              Cover Letter
            </button>
            <button className={`btn btn-outline ${styles.actionBtn}`} type="button">
              New Profile
            </button>
          </div>
        </div>
      </section>

      <div className={styles.workspaceGrid}>
        <div className={styles.leftColumn}>
          <section className="panel">
            <div className="panel-header">
              <h2>Upload resume</h2>
            </div>
            <div className="panel-body stack-12">
              <p className="text-muted">
                PDF only, max 8MB. The backend extracts profile, skills, work
                experience, and education fields.
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div className={styles.actions}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={upload}
                  disabled={loading}
                >
                  {loading ? "Uploading..." : "Upload and parse"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={fetchLatest}
                  disabled={loading}
                >
                  Refresh latest
                </button>
              </div>
              {error ? <p className="status-error">{error}</p> : null}
              {notice ? <p className="status-ok">{notice}</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Resume parsing results</h2>
            </div>
            <div className={`panel-body ${styles.resultGrid}`}>
              <section className={styles.resultPanel}>
                <h3>PDF preview</h3>
                {previewUrl ? (
                  <iframe
                    title="Uploaded resume preview"
                    src={previewUrl}
                    className={styles.previewFrame}
                  />
                ) : (
                  <div className={styles.previewPlaceholder}>
                    Choose a PDF file to preview it here.
                  </div>
                )}
              </section>

              <section className={styles.resultPanel}>
                {!resume ? (
                  <p className="text-muted">No parsed resume yet.</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.resultTable}>
                      <tbody>
                        <tr className={styles.sectionRow}>
                          <th colSpan={2}>Profile</th>
                        </tr>
                        <tr>
                          <th>Name</th>
                          <td>{resume.parsed.basics.name || "-"}</td>
                        </tr>
                        <tr>
                          <th>Email</th>
                          <td>{resume.parsed.basics.email || "-"}</td>
                        </tr>
                        <tr>
                          <th>Phone</th>
                          <td>{resume.parsed.basics.phone || "-"}</td>
                        </tr>
                        <tr>
                          <th>Location</th>
                          <td>{resume.parsed.basics.location || "-"}</td>
                        </tr>
                        <tr>
                          <th>Link</th>
                          <td>{resume.parsed.basics.link || "-"}</td>
                        </tr>
                        <tr>
                          <th>Summary</th>
                          <td>{resume.parsed.basics.summary || "-"}</td>
                        </tr>

                        <tr className={styles.sectionRow}>
                          <th colSpan={2}>Skills</th>
                        </tr>
                        <tr>
                          <th>Descriptions</th>
                          <td>
                            {resume.parsed.skills.length
                              ? resume.parsed.skills.join(", ")
                              : "-"}
                          </td>
                        </tr>

                        <tr className={styles.sectionRow}>
                          <th colSpan={2}>Work Experience</th>
                        </tr>
                        {resume.parsed.experiences.length ? (
                          resume.parsed.experiences.map((exp, idx) => (
                            <tr key={`${exp.company}-${exp.title}-${idx}`}>
                              <th>{`Experience ${idx + 1}`}</th>
                              <td>
                                <p>
                                  <strong>{exp.title || "-"}</strong>
                                </p>
                                <p>{exp.company || "-"}</p>
                                <p className="text-muted">
                                  {(exp.start || "?") + " - " + (exp.end || "Present")}
                                </p>
                                {exp.highlights?.length ? (
                                  <ul className={styles.highlights}>
                                    {exp.highlights.map((point, pointIdx) => (
                                      <li key={`${exp.company}-${idx}-${pointIdx}`}>
                                        {point}
                                      </li>
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
                            <th>Experience</th>
                            <td>-</td>
                          </tr>
                        )}

                        <tr className={styles.sectionRow}>
                          <th colSpan={2}>Education</th>
                        </tr>
                        {resume.parsed.education?.length ? (
                          resume.parsed.education.map((edu, idx) => (
                            <tr key={`${edu.school}-${edu.degree}-${idx}`}>
                              <th>{`Education ${idx + 1}`}</th>
                              <td>
                                <p>School: {edu.school || "-"}</p>
                                <p>Degree: {edu.degree || "-"}</p>
                                <p>GPA: {edu.gpa || "-"}</p>
                                <p>Date: {edu.date || "-"}</p>
                                {edu.descriptions?.length ? (
                                  <ul className={styles.highlights}>
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
                            <th>Education</th>
                            <td>-</td>
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

        <aside className={`panel ${styles.chatPanel}`}>
          <div className={`panel-header ${styles.chatHeader}`}>
            <div>
              <h3>AI Career Assistant</h3>
              <p className="text-muted">
                Ask for rewrite tips, job-match keywords, and score advice.
              </p>
            </div>
            <span className={styles.online}>Online</span>
          </div>

          <div className={`panel-body ${styles.chatBody}`}>
            <div ref={chatListRef} className={styles.chatList}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={
                    msg.role === "user" ? styles.userBubble : styles.assistantBubble
                  }
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading ? (
                <div className={styles.assistantBubble}>Thinking...</div>
              ) : null}
            </div>

            <div className={styles.chatInputWrap}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={onChatKeyDown}
                placeholder="Ask about improving your resume..."
                rows={3}
                className={styles.chatInput}
              />
              <button
                className="btn btn-primary"
                type="button"
                onClick={sendChat}
                disabled={!canSend}
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

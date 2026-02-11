"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { DEV_USER_ID } from "@/lib/config";
import type { ResumeRecord } from "@/types/shared";

import styles from "./page.module.css";

const MAX_SIZE = 8 * 1024 * 1024;

export default function ResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [notice, setNotice] = useState("");

  const fetchLatest = async () => {
    try {
      const data = await apiFetch<ResumeRecord | null>(
        `/resume/${DEV_USER_ID}/latest`,
      );
      setResume(data);
    } catch {
      setResume(null);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

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

  return (
    <div className="stack-16">
      <section className="panel">
        <div className="panel-header">
          <h2>Upload resume</h2>
        </div>
        <div className="panel-body stack-12">
          <p className="text-muted">
            PDF only, max 8MB. The backend extracts basic info, skills, and
            experience blocks.
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
          <h2>Structured result</h2>
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
            <h3>Resume parsing results</h3>
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
  );
}

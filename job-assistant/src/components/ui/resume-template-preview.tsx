"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResumeParsed } from "@/types/shared";

export type EditorResumeTemplate = "classic" | "modern" | "compact";
export type PreviewFontFamily = "arial" | "inter" | "georgia";
export type PreviewDensity = "compact" | "default" | "relaxed";
export type PreviewTextScale = "small" | "default" | "large";
export type PreviewShape = "square" | "rounded" | "soft";

interface ResumeTemplatePreviewProps {
  parsed: ResumeParsed;
  template: EditorResumeTemplate;
  fontFamily?: PreviewFontFamily;
  density?: PreviewDensity;
  textScale?: PreviewTextScale;
  shape?: PreviewShape;
  showBackground?: boolean;
  editable?: boolean;
  onChange?: (next: ResumeParsed) => void;
  className?: string;
}

interface EditableTextProps {
  value: string;
  placeholder: string;
  editable?: boolean;
  multiline?: boolean;
  className?: string;
  onCommit?: (value: string) => void;
}

const FONT_CLASS: Record<PreviewFontFamily, string> = {
  arial: "font-[Arial,_Helvetica,_sans-serif]",
  inter: "font-[Inter,_ui-sans-serif,_system-ui,_sans-serif]",
  georgia: "font-[Georgia,_Times_New_Roman,_serif]",
};

const DENSITY_CLASS: Record<PreviewDensity, string> = {
  compact: "leading-[1.45]",
  default: "leading-[1.58]",
  relaxed: "leading-[1.72]",
};

const SCALE_STYLE: Record<PreviewTextScale, CSSProperties> = {
  small: { fontSize: "92%" },
  default: { fontSize: "100%" },
  large: { fontSize: "108%" },
};

const SHAPE_CLASS: Record<PreviewShape, string> = {
  square: "rounded-none",
  rounded: "rounded-xl",
  soft: "rounded-3xl",
};

function cloneParsed(parsed: ResumeParsed): ResumeParsed {
  return JSON.parse(JSON.stringify(parsed)) as ResumeParsed;
}

function formatDateRange(start?: string, end?: string) {
  if (!start && !end) return "";
  return `${start || "Start"} - ${end || "Present"}`;
}

function normalizeLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeSkillText(value: string) {
  return value.replace(/^[•·\-]\s*/, "").trim();
}

function toExperienceHighlights(exp: ResumeParsed["experiences"][number]) {
  const fromHighlights = (exp.highlights || [])
    .map((item) => item.trim())
    .filter(Boolean);
  if (fromHighlights.length > 0) return fromHighlights.slice(0, 8);

  const summary = (exp.summary || "").trim();
  if (!summary) return [];

  const summaryLines = normalizeLines(summary);
  if (summaryLines.length > 1) return summaryLines.slice(0, 8);

  return summary
    .split(/(?<=[.!?。！？])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function EditableText({
  value,
  placeholder,
  editable = false,
  multiline = false,
  className,
  onCommit,
}: EditableTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    ref.current.innerText = value || "";
  }, [value]);

  const commit = () => {
    if (!editable || !ref.current || !onCommit) return;
    const raw = ref.current.innerText.replace(/\u00A0/g, " ").replace(/\r/g, "");
    const cleaned = multiline
      ? raw
          .split("\n")
          .map((line) => line.trimEnd())
          .join("\n")
          .trim()
      : raw.replace(/\n/g, " ").trim();
    if (!value && cleaned === placeholder) {
      onCommit("");
      return;
    }
    onCommit(cleaned);
  };

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onFocus={() => {
        if (!editable || !ref.current) return;
        if (!value && ref.current.innerText.trim() === placeholder) {
          ref.current.innerText = "";
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (!editable || multiline) return;
        if (event.key === "Enter") {
          event.preventDefault();
          ref.current?.blur();
        }
      }}
      className={cn(
        "outline-none",
        editable && "cursor-text rounded-sm ring-0 focus:bg-blue-50/70",
        !value && "text-slate-400",
        multiline && "whitespace-pre-wrap",
        className,
      )}
    >
      {value || placeholder}
    </div>
  );
}

function SectionHeader({
  title,
  accentClass,
  right,
}: {
  title: string;
  accentClass: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between border-b pb-1", accentClass)}>
      <p className="text-[0.96rem] font-semibold uppercase tracking-[0.08em]">{title}</p>
      {right}
    </div>
  );
}

export function ResumeTemplatePreview({
  parsed,
  template,
  fontFamily = "arial",
  density = "default",
  textScale = "default",
  shape = "rounded",
  showBackground = true,
  editable = false,
  onChange,
  className,
}: ResumeTemplatePreviewProps) {
  const emit = (mutator: (next: ResumeParsed) => void) => {
    if (!onChange) return;
    const next = cloneParsed(parsed);
    mutator(next);
    onChange(next);
  };

  const experiences = parsed.experiences || [];
  const education = parsed.education || [];

  const accentClass =
    template === "compact"
      ? "border-violet-300 text-violet-800"
      : template === "modern"
        ? "border-blue-300 text-blue-800"
        : "border-slate-900 text-slate-900";

  const pageClass = cn(
    "resume-preview-page mx-auto w-full max-w-[920px] border p-6 shadow-sm transition",
    template === "compact"
      ? "border-violet-200"
      : template === "modern"
        ? "border-blue-200"
        : "border-slate-300",
    showBackground
      ? template === "compact"
        ? "bg-gradient-to-b from-violet-50 via-white to-indigo-50"
        : template === "modern"
          ? "bg-gradient-to-b from-blue-50 via-white to-cyan-50"
          : "bg-white"
      : "bg-white/92",
    SHAPE_CLASS[shape],
  );

  const contactLine = useMemo(
    () => [parsed.basics.phone, parsed.basics.email, parsed.basics.location].filter(Boolean).join(" | "),
    [parsed.basics.phone, parsed.basics.email, parsed.basics.location],
  );
  const skills = useMemo(
    () => (parsed.skills || []).map((skill) => normalizeSkillText(skill)).filter(Boolean).slice(0, 40),
    [parsed.skills],
  );

  const setSkills = (nextSkills: string[]) => {
    emit((next) => {
      next.skills = nextSkills
        .map((skill) => normalizeSkillText(skill))
        .filter(Boolean)
        .slice(0, 40);
    });
  };

  const skillsBlock = (
    <section>
      <SectionHeader
        title="Skills"
        accentClass={accentClass}
        right={
          editable ? (
            <button
              type="button"
              onClick={() => setSkills([...skills, "New skill"])}
              data-editor-control="true"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              Add bullet
            </button>
          ) : null
        }
      />

      {skills.length ? (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {skills.map((skill, idx) => (
            <li
              key={`skill-${idx}`}
              className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white/90 px-2 py-1.5"
            >
              <span
                className={cn(
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                  template === "compact"
                    ? "bg-violet-500"
                    : template === "modern"
                      ? "bg-blue-500"
                      : "bg-slate-600",
                )}
              />
              <EditableText
                editable={editable}
                value={skill}
                placeholder="Skill"
                className="min-w-0 flex-1 text-sm text-slate-800"
                onCommit={(value) => {
                  const nextSkills = [...skills];
                  const cleaned = normalizeSkillText(value);
                  if (!cleaned) {
                    nextSkills.splice(idx, 1);
                  } else {
                    nextSkills[idx] = cleaned;
                  }
                  setSkills(nextSkills);
                }}
              />
              {editable ? (
                <button
                  type="button"
                  onClick={() => setSkills(skills.filter((_, skillIdx) => skillIdx !== idx))}
                  data-editor-control="true"
                  className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          {editable ? "No skills yet. Click Add bullet to insert one." : "No skills listed."}
        </p>
      )}
    </section>
  );

  const experienceBlock = (
    <section>
      <SectionHeader
        title="Experience"
        accentClass={accentClass}
        right={
          editable ? (
            <button
              type="button"
              onClick={() =>
                emit((next) => {
                  next.experiences = [
                    ...(next.experiences || []),
                    {
                      title: "",
                      company: "",
                      start: "",
                      end: "",
                      summary: "",
                      highlights: [],
                    },
                  ].slice(0, 8);
                })
              }
              data-editor-control="true"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          ) : null
        }
      />

      {experiences.length ? (
        <div className="space-y-3">
          {experiences.map((exp, idx) => {
            const highlights = toExperienceHighlights(exp);

            const updateHighlights = (nextHighlights: string[]) => {
              emit((next) => {
                if (!next.experiences[idx]) return;
                const cleaned = nextHighlights
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .slice(0, 8);
                next.experiences[idx].highlights = cleaned;
                next.experiences[idx].summary = cleaned[0] || "";
              });
            };

            return (
              <article key={`exp-${idx}`} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <EditableText
                      editable={editable}
                      value={exp.title || ""}
                      placeholder="Role Title"
                      className="text-[1.1rem] font-semibold text-slate-900"
                      onCommit={(value) =>
                        emit((next) => {
                          if (!next.experiences[idx]) return;
                          next.experiences[idx].title = value;
                        })
                      }
                    />
                    <EditableText
                      editable={editable}
                      value={exp.company || ""}
                      placeholder="Company"
                      className="text-sm text-slate-700"
                      onCommit={(value) =>
                        emit((next) => {
                          if (!next.experiences[idx]) return;
                          next.experiences[idx].company = value;
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1 text-right">
                    <EditableText
                      editable={editable}
                      value={formatDateRange(exp.start, exp.end)}
                      placeholder="Start - End"
                      className="text-xs text-slate-500"
                      onCommit={(value) =>
                        emit((next) => {
                          if (!next.experiences[idx]) return;
                          const [start = "", end = ""] = value.split("-");
                          next.experiences[idx].start = start.trim();
                          next.experiences[idx].end = end.trim();
                        })
                      }
                    />
                    {editable ? (
                      <button
                        type="button"
                        onClick={() =>
                          emit((next) => {
                            next.experiences = (next.experiences || []).filter((_, i) => i !== idx);
                          })
                        }
                        data-editor-control="true"
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  {highlights.length > 0 ? (
                    <ul className="ml-1 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                      {highlights.map((point, pointIdx) => (
                        <li key={`exp-${idx}-point-${pointIdx}`} className="group flex items-start gap-2">
                          <EditableText
                            editable={editable}
                            value={point}
                            placeholder="Describe impact, scope, and results"
                            className="min-w-0 flex-1 text-sm text-slate-700"
                            onCommit={(value) => {
                              const next = [...highlights];
                              const cleaned = value.trim();
                              if (!cleaned) {
                                next.splice(pointIdx, 1);
                              } else {
                                next[pointIdx] = cleaned;
                              }
                              updateHighlights(next);
                            }}
                          />
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => {
                                const next = highlights.filter((_, i) => i !== pointIdx);
                                updateHighlights(next);
                              }}
                              data-editor-control="true"
                              className="mt-0.5 inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {editable ? "No key points yet. Add one below." : "No key points listed."}
                    </p>
                  )}

                  {editable ? (
                    <button
                      type="button"
                      onClick={() => updateHighlights([...highlights, "New key point"])}
                      data-editor-control="true"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3 w-3" />
                      Add bullet
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No experience yet.</p>
      )}
    </section>
  );

  const educationBlock = (
    <section>
      <SectionHeader
        title="Education"
        accentClass={accentClass}
        right={
          editable ? (
            <button
              type="button"
              onClick={() =>
                emit((next) => {
                  next.education = [
                    ...(next.education || []),
                    {
                      school: "",
                      degree: "",
                      gpa: "",
                      date: "",
                      descriptions: [],
                    },
                  ].slice(0, 6);
                })
              }
              data-editor-control="true"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          ) : null
        }
      />

      {education.length ? (
        <div className="space-y-2.5">
          {education.map((edu, idx) => (
            <article key={`edu-${idx}`} className="rounded-lg border border-slate-200 bg-white/90 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <EditableText
                    editable={editable}
                    value={edu.school || ""}
                    placeholder="School"
                    className="text-[1.03rem] font-semibold text-slate-900"
                    onCommit={(value) =>
                      emit((next) => {
                        if (!next.education?.[idx]) return;
                        next.education[idx].school = value;
                      })
                    }
                  />
                  <EditableText
                    editable={editable}
                    value={edu.degree || ""}
                    placeholder="Degree"
                    className="text-sm text-slate-700"
                    onCommit={(value) =>
                      emit((next) => {
                        if (!next.education?.[idx]) return;
                        next.education[idx].degree = value;
                      })
                    }
                  />
                </div>

                <div className="space-y-1 text-right">
                  <EditableText
                    editable={editable}
                    value={edu.date || ""}
                    placeholder="Date"
                    className="text-xs text-slate-500"
                    onCommit={(value) =>
                      emit((next) => {
                        if (!next.education?.[idx]) return;
                        next.education[idx].date = value;
                      })
                    }
                  />
                  {editable ? (
                    <button
                      type="button"
                      onClick={() =>
                        emit((next) => {
                          next.education = (next.education || []).filter((_, i) => i !== idx);
                        })
                      }
                      data-editor-control="true"
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              <EditableText
                editable={editable}
                multiline
                value={(edu.descriptions || []).join("\n")}
                placeholder={editable ? "Education bullets (optional)" : ""}
                className="mt-2 text-sm text-slate-700"
                onCommit={(value) =>
                  emit((next) => {
                    if (!next.education?.[idx]) return;
                    next.education[idx].descriptions = normalizeLines(value).slice(0, 6);
                  })
                }
              />
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No education yet.</p>
      )}
    </section>
  );

  return (
    <div
      className={cn(FONT_CLASS[fontFamily], DENSITY_CLASS[density], "text-slate-800", className)}
      style={SCALE_STYLE[textScale]}
    >
      <article className={pageClass}>
        <header className={cn("pb-4", template === "classic" ? "text-center" : "")}> 
          <EditableText
            editable={editable}
            value={parsed.basics.name || ""}
            placeholder="Your Name"
            className="text-[2.2rem] font-bold uppercase tracking-[0.02em] text-slate-900"
            onCommit={(value) =>
              emit((next) => {
                next.basics.name = value;
              })
            }
          />

          {template === "compact" ? (
            <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
              <EditableText
                editable={editable}
                value={parsed.basics.phone || ""}
                placeholder="Phone"
                className="min-h-[1.25rem]"
                onCommit={(value) =>
                  emit((next) => {
                    next.basics.phone = value;
                  })
                }
              />
              <EditableText
                editable={editable}
                value={parsed.basics.email || ""}
                placeholder="Email"
                className="min-h-[1.25rem]"
                onCommit={(value) =>
                  emit((next) => {
                    next.basics.email = value;
                  })
                }
              />
              <EditableText
                editable={editable}
                value={parsed.basics.location || ""}
                placeholder="Location"
                className="min-h-[1.25rem]"
                onCommit={(value) =>
                  emit((next) => {
                    next.basics.location = value;
                  })
                }
              />
              <EditableText
                editable={editable}
                value={parsed.basics.link || ""}
                placeholder="Portfolio / LinkedIn"
                className="min-h-[1.25rem]"
                onCommit={(value) =>
                  emit((next) => {
                    next.basics.link = value;
                  })
                }
              />
            </div>
          ) : (
            <>
              <EditableText
                editable={editable}
                value={contactLine}
                placeholder="Phone | Email | Location"
                className={cn(
                  "mx-auto mt-1 min-h-[1.2rem] text-sm text-slate-600",
                  template === "classic" ? "max-w-3xl" : "",
                )}
                onCommit={(value) =>
                  emit((next) => {
                    const [phone = "", email = "", location = ""] = value.split("|");
                    next.basics.phone = phone.trim();
                    next.basics.email = email.trim();
                    next.basics.location = location.trim();
                  })
                }
              />
              <EditableText
                editable={editable}
                value={parsed.basics.link || ""}
                placeholder="Portfolio / LinkedIn / GitHub"
                className="mx-auto mt-0.5 min-h-[1.2rem] text-sm text-slate-600"
                onCommit={(value) =>
                  emit((next) => {
                    next.basics.link = value;
                  })
                }
              />
            </>
          )}
        </header>

        {template === "compact" ? (
          <div className="grid gap-4 md:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="space-y-3">
              {skillsBlock}

              <section>
                <SectionHeader title="Summary" accentClass={accentClass} />
                <EditableText
                  editable={editable}
                  multiline
                  value={parsed.basics.summary || ""}
                  placeholder="Add a concise professional summary"
                  className="text-sm"
                  onCommit={(value) =>
                    emit((next) => {
                      next.basics.summary = value;
                    })
                  }
                />
              </section>
            </aside>

            <div className="space-y-4">
              {experienceBlock}
              {educationBlock}
            </div>
          </div>
        ) : template === "modern" ? (
          <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <section>
                <SectionHeader title="Summary" accentClass={accentClass} />
                <EditableText
                  editable={editable}
                  multiline
                  value={parsed.basics.summary || ""}
                  placeholder="Add a concise professional summary"
                  className="text-sm"
                  onCommit={(value) =>
                    emit((next) => {
                      next.basics.summary = value;
                    })
                  }
                />
              </section>
              {experienceBlock}
            </div>

            <div className="space-y-4">
              {skillsBlock}
              {educationBlock}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <section>
              <SectionHeader title="Personal Summary" accentClass={accentClass} />
              <EditableText
                editable={editable}
                multiline
                value={parsed.basics.summary || ""}
                placeholder="Add a concise professional summary"
                className="text-sm"
                onCommit={(value) =>
                  emit((next) => {
                    next.basics.summary = value;
                  })
                }
              />
            </section>

            {skillsBlock}

            {experienceBlock}
            {educationBlock}
          </div>
        )}
      </article>
    </div>
  );
}

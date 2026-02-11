import { BadRequestException, Injectable } from '@nestjs/common';
import pdfParse = require('pdf-parse');

import { AppLoggerService } from '../common/logger/app-logger.service';
import { ResumeParsed, ResumeRecord } from '../common/types/shared';
import { SupabaseService } from '../supabase/supabase.service';

const SKILL_KEYWORDS = [
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node',
  'nestjs',
  'python',
  'sql',
  'postgres',
  'docker',
  'aws',
];
const SECTION_TITLE_KEYWORDS = {
  summary: ['SUMMARY', 'PROFILE'],
  skills: ['SKILLS', 'TECHNICAL SKILLS', 'PROGRAMMING LANGUAGE', 'PROGRAMMING LANGUAGES'],
  work: ['WORK EXPERIENCE', 'EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT HISTORY'],
  projects: ['PROJECTS', 'PROJECT EXPERIENCE', 'PROJECTS EXPERIENCES'],
  education: ['EDUCATION'],
  references: ['REFERENCES'],
} as const;
const ROLE_HINT_REGEX =
  /\b(engineer|developer|manager|assistant|analyst|intern|consultant|lead|architect|designer|coordinator|specialist)\b/i;
const DATE_RANGE_REGEX =
  /\b([A-Za-z]{3,9}\s+\d{4}|\d{4})\s*[-\u2013\u2014]\s*(Current|Present|[A-Za-z]{3,9}\s+\d{4}|\d{4})\b/i;
const SECTION_HEADING_REGEX =
  /^(SUMMARY|WORK EXPERIENCE|PROJECTS EXPERIENCES|EDUCATION|REFERENCES|PROGRAMMING LANGUAGE|SKILLS?)$/i;
type ParsedExperience = ResumeParsed['experiences'][number];
type ParsedEducation = NonNullable<ResumeParsed['education']>[number];

@Injectable()
export class ResumeService {
  private readonly memoryStore = new Map<string, ResumeRecord>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: AppLoggerService,
  ) {}

  private mapRowToRecord(row: {
    id: string;
    user_id: string;
    parsed_json: ResumeParsed;
    created_at: string;
  }): ResumeRecord {
    return {
      id: row.id,
      userId: row.user_id,
      parsed: row.parsed_json,
      createdAt: row.created_at,
    };
  }

  private extractEmail(text: string): string | undefined {
    return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  }

  private extractPhone(text: string): string | undefined {
    return text.match(/\+?\d[\d\s\-()]{8,}\d/)?.[0];
  }

  private extractName(lines: string[]): string | undefined {
    const candidate = lines.find(
      (line) =>
        /^[A-Za-z][A-Za-z\s'.-]{1,48}$/.test(line) &&
        !line.toLowerCase().includes('resume') &&
        !line.includes('@') &&
        !/\d/.test(line),
    );
    return candidate;
  }

  private extractSkills(textLower: string): string[] {
    return SKILL_KEYWORDS.filter((skill) => textLower.includes(skill));
  }

  private extractLocation(lines: string[]): string | undefined {
    const addressLine = lines.find((line) => /\baddress\s*:/i.test(line));
    if (!addressLine) return undefined;
    const cleaned = addressLine
      .replace(/.*address\s*:\s*/i, '')
      .split(/\bPhone\b|\bEmail\b/i)[0]
      .trim();
    return cleaned || undefined;
  }

  private extractLink(text: string): string | undefined {
    const match =
      text.match(/https?:\/\/[^\s)]+/i)?.[0] ||
      text.match(/\bwww\.[^\s)]+/i)?.[0] ||
      text.match(/\bgithub\.com\/[^\s)]+/i)?.[0];
    if (!match) return undefined;
    if (match.startsWith('http')) return match;
    return `https://${match}`;
  }

  private extractSummary(summaryLines: string[], fallbackLines: string[]): string | undefined {
    const source = summaryLines.length > 0 ? summaryLines : fallbackLines.slice(0, 6);
    if (!source.length) return undefined;
    const merged = this.mergeWrappedHighlights(source).join(' ');
    const cleaned = merged.replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, 650) : undefined;
  }

  private normalizeHeadingText(line: string): string {
    return line
      .replace(/[^A-Za-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  private detectSectionType(
    line: string,
  ): 'summary' | 'skills' | 'work' | 'projects' | 'education' | 'references' | null {
    const normalized = this.normalizeHeadingText(line);
    if (!normalized || /\d/.test(normalized)) return null;
    for (const [section, keywords] of Object.entries(SECTION_TITLE_KEYWORDS)) {
      if (keywords.includes(normalized as never)) {
        return section as
          | 'summary'
          | 'skills'
          | 'work'
          | 'projects'
          | 'education'
          | 'references';
      }
    }

    // Fallback heuristic inspired by OpenResume: short, uppercase single-line heading.
    const isUpperHeading =
      /^[A-Z][A-Z\s/&]{2,40}$/.test(line.trim()) &&
      line.trim().split(/\s+/).length <= 5;
    if (!isUpperHeading) return null;
    if (normalized.includes('EXPERIENCE')) return 'work';
    if (normalized.includes('SKILL')) return 'skills';
    if (normalized.includes('PROJECT')) return 'projects';
    if (normalized.includes('EDUCATION')) return 'education';
    if (normalized.includes('REFERENCE')) return 'references';
    if (normalized.includes('SUMMARY') || normalized.includes('PROFILE')) {
      return 'summary';
    }
    return null;
  }

  private splitLinesBySections(lines: string[]) {
    const sections: Record<
      'profile' | 'summary' | 'skills' | 'work' | 'projects' | 'education' | 'references',
      string[]
    > = {
      profile: [],
      summary: [],
      skills: [],
      work: [],
      projects: [],
      education: [],
      references: [],
    };
    let currentSection: keyof typeof sections = 'profile';

    for (const line of lines) {
      const sectionType = this.detectSectionType(line);
      if (sectionType) {
        currentSection = sectionType;
        continue;
      }
      sections[currentSection].push(line);
    }
    return sections;
  }

  private parseDateRange(line: string): { start?: string; end?: string } | null {
    const match = line.match(DATE_RANGE_REGEX);
    if (!match) return null;
    const [, start, end] = match;
    return {
      start: start?.trim(),
      end: end?.trim(),
    };
  }

  private extractYearRange(line: string): string | undefined {
    const range = line.match(
      /([A-Za-z]{3,9}\s+\d{4}|\d{4})\s*[-\u2013\u2014]\s*(Current|Present|[A-Za-z]{3,9}\s+\d{4}|\d{4})/i,
    );
    if (range) {
      return `${range[1]} - ${range[2]}`;
    }
    const years = line.match(/\b(19|20)\d{2}\b/g);
    if (years && years.length >= 2) {
      return `${years[0]} - ${years[1]}`;
    }
    return undefined;
  }

  private splitRoleAndCompany(
    line: string,
  ): { title: string; company: string } | null {
    if (DATE_RANGE_REGEX.test(line)) return null;

    let separatorIndex = line.indexOf('\u2014');
    let separatorLength = 1;
    if (separatorIndex < 0) {
      separatorIndex = line.indexOf('\u2013');
    }
    if (separatorIndex < 0) {
      separatorIndex = line.indexOf(' - ');
      separatorLength = 3;
    }
    if (separatorIndex < 1) return null;

    const left = line.slice(0, separatorIndex).trim();
    const right = line
      .slice(separatorIndex + separatorLength)
      .replace(/^[-\u2013\u2014\s]+/, '')
      .trim();

    if (!left || !right) return null;
    if (!ROLE_HINT_REGEX.test(left)) return null;

    const cleanedCompany =
      right.replace(/\s*\([^)]*\)\s*$/, '').trim() || right;
    return {
      title: left,
      company: cleanedCompany,
    };
  }

  private isSectionHeading(line: string): boolean {
    if (SECTION_HEADING_REGEX.test(line)) return true;
    return /^[A-Z][A-Z\s/&]{5,}$/.test(line);
  }

  private mergeWrappedHighlights(lines: string[]): string[] {
    const merged: string[] = [];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const previous = merged[merged.length - 1];
      if (
        previous &&
        /[a-z0-9,/:)\]]$/i.test(previous) &&
        /^[a-z(]/.test(line)
      ) {
        merged[merged.length - 1] = `${previous} ${line}`.replace(/\s+/g, ' ');
        continue;
      }
      merged.push(line);
    }
    return merged;
  }

  private extractExperiences(lines: string[]) {
    const experiences: ParsedExperience[] = [];

    let current: ParsedExperience | null = null;
    let summaryLines: string[] = [];

    const flushCurrent = () => {
      if (!current) return;
      if (summaryLines.length) {
        const mergedHighlights = this.mergeWrappedHighlights(summaryLines);
        const uniqueHighlights = Array.from(new Set(mergedHighlights)).slice(0, 4);
        current.highlights = uniqueHighlights;
        current.summary = uniqueHighlights[0];
      }
      experiences.push(current);
      current = null;
      summaryLines = [];
    };

    for (const line of lines) {
      const roleAndCompany = this.splitRoleAndCompany(line);
      if (roleAndCompany) {
        flushCurrent();
        current = {
          title: roleAndCompany.title,
          company: roleAndCompany.company,
        };
        continue;
      }

      const dateRange = this.parseDateRange(line);
      if (dateRange && current) {
        current.start = current.start || dateRange.start;
        current.end = current.end || dateRange.end;
        continue;
      }

      if (!current) continue;
      if (this.isSectionHeading(line)) {
        flushCurrent();
        continue;
      }
      if (line.length < 8 || line.length > 260) continue;
      if (/^[A-Z\s]{4,}$/.test(line)) continue;
      if (/\b(Address|Phone Number|Email|GitHub)\b/i.test(line)) continue;
      if (summaryLines.length < 8) {
        summaryLines.push(line);
      }
    }

    flushCurrent();

    const deduped = new Map<string, ParsedExperience>();
    for (const exp of experiences) {
      const key = [
        exp.title?.toLowerCase() || '',
        exp.company?.toLowerCase() || '',
        exp.start || '',
        exp.end || '',
      ].join('|');
      if (!deduped.has(key)) deduped.set(key, exp);
    }

    const structured = Array.from(deduped.values()).slice(0, 6);
    if (structured.length > 0) {
      return structured;
    }

    // Fallback when a resume does not contain clear "title - company" lines.
    const fallbackLines = lines
      .filter(
        (line) =>
          /\b(20\d{2}|19\d{2})\b/.test(line) || ROLE_HINT_REGEX.test(line),
      )
      .slice(0, 3);
    return fallbackLines.map<ParsedExperience>((line) => {
      const yearMatches = line.match(/(19|20)\d{2}/g) || [];
      return {
        title: line.slice(0, 80),
        company: undefined,
        start: yearMatches[0],
        end: yearMatches[1],
        summary: line,
        highlights: [line],
      };
    });
  }

  private extractEducation(lines: string[]): ParsedEducation[] {
    const entries: ParsedEducation[] = [];
    let current: ParsedEducation | null = null;
    let desc: string[] = [];

    const flush = () => {
      if (!current) return;
      if (desc.length) {
        current.descriptions = this.mergeWrappedHighlights(desc).slice(0, 4);
      }
      entries.push(current);
      current = null;
      desc = [];
    };

    for (const line of lines) {
      if (this.isSectionHeading(line)) {
        flush();
        continue;
      }
      if (!line.trim()) continue;

      const isSchoolLine =
        /\b(university|college|institute|school|education)\b/i.test(line) &&
        !/\b(work|experience|project)\b/i.test(line);
      const isDegreeLine = /\b(bachelor|master|phd|program|software|computer|it)\b/i.test(
        line,
      );
      const date = this.extractYearRange(line);
      const gpa = line.match(/\bGPA\b[:\s]*([0-9.]+)/i)?.[1];

      if (isSchoolLine) {
        flush();
        current = { school: line.replace(/\s*\([^)]*\)\s*$/, '').trim() };
        if (date) current.date = date;
        continue;
      }

      if (!current && isDegreeLine) {
        current = { degree: line };
        if (date) current.date = date;
        continue;
      }

      if (!current) continue;

      if (!current.degree && isDegreeLine) {
        current.degree = line;
        if (date && !current.date) current.date = date;
        continue;
      }

      if (date && !current.date) {
        current.date = date;
        continue;
      }

      if (gpa && !current.gpa) {
        current.gpa = gpa;
        continue;
      }

      if (line.length >= 18 && line.length <= 220 && desc.length < 4) {
        desc.push(line);
      }
    }
    flush();
    return entries.slice(0, 4);
  }

  private parseText(text: string): ResumeParsed {
    // NOTE: pdf-parse uses Mozilla pdf.js under the hood for text extraction.
    const lines = text
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const sections = this.splitLinesBySections(lines);
    const profileAndSummaryLines = [...sections.profile, ...sections.summary];
    const workCandidateLines =
      sections.work.length > 0
        ? [...sections.work, ...sections.profile, ...sections.summary]
        : [...sections.profile, ...sections.summary, ...sections.skills];
    const experiencesPrimary = this.extractExperiences(workCandidateLines);
    const experiencesFallback =
      experiencesPrimary.length < 2 ? this.extractExperiences(lines) : [];
    const mergedExperiences = [...experiencesPrimary, ...experiencesFallback];
    const deduped = new Map<string, (typeof mergedExperiences)[number]>();
    for (const exp of mergedExperiences) {
      const key = [
        exp.title?.toLowerCase() || '',
        exp.company?.toLowerCase() || '',
        exp.start || '',
        exp.end || '',
      ].join('|');
      if (!deduped.has(key)) deduped.set(key, exp);
    }
    const educationSource =
      sections.education.length > 0 ? sections.education : lines;
    const education = this.extractEducation(educationSource);

    return {
      basics: {
        name: this.extractName(
          profileAndSummaryLines.length > 0 ? profileAndSummaryLines : lines,
        ),
        email: this.extractEmail(text),
        phone: this.extractPhone(text),
        location: this.extractLocation(lines),
        link: this.extractLink(text),
        summary: this.extractSummary(sections.summary, profileAndSummaryLines),
      },
      skills: this.extractSkills(text.toLowerCase()),
      experiences: Array.from(deduped.values()).slice(0, 6),
      education,
    };
  }

  async uploadAndParse(fileBuffer: Buffer, userId: string): Promise<ResumeRecord> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    let parsedPdf: Awaited<ReturnType<typeof pdfParse>>;
    try {
      parsedPdf = await pdfParse(fileBuffer);
    } catch (error) {
      this.logger.warn(
        `PDF parse failed for user ${userId}: ${(error as Error).message}`,
        'ResumeService',
      );
      throw new BadRequestException(
        'Cannot parse this PDF. Please try another resume file.',
      );
    }
    const parsed = this.parseText(parsedPdf.text || '');

    if (this.supabaseService.isConfigured()) {
      const row = await this.supabaseService.insertResume(userId, parsed);
      if (!row) {
        throw new Error('Failed to persist resume');
      }
      return this.mapRowToRecord(row);
    }

    const localRecord: ResumeRecord = {
      id: `local_${Date.now()}`,
      userId,
      parsed,
      createdAt: new Date().toISOString(),
    };
    this.memoryStore.set(userId, localRecord);
    return localRecord;
  }

  async getLatest(userId: string): Promise<ResumeRecord | null> {
    if (this.supabaseService.isConfigured()) {
      const row = await this.supabaseService.getLatestResume(userId);
      return row ? this.mapRowToRecord(row) : null;
    }
    return this.memoryStore.get(userId) ?? null;
  }
}

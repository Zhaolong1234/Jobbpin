import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import pdfParse = require('pdf-parse');

import { AppLoggerService } from '../common/logger/app-logger.service';
import { ResumeParsed, ResumeRecord } from '../common/types/shared';
import { SubscriptionService } from '../subscription/subscription.service';
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
type ResumeAiAssessment = NonNullable<ResumeParsed['aiAssessment']>;
type ResumeTemplateId = 'classic' | 'modern' | 'compact';
const FREE_TEMPLATE_ID: ResumeTemplateId = 'classic';
const SUPPORTED_TEMPLATE_IDS = new Set<ResumeTemplateId>([
  'classic',
  'modern',
  'compact',
]);

@Injectable()
export class ResumeService {
  private readonly memoryStore = new Map<string, ResumeRecord>();
  private readonly memoryHistory = new Map<string, ResumeRecord[]>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: AppLoggerService,
  ) {}

  private isSubscribedStatus(status: string): boolean {
    return ['trialing', 'active', 'past_due'].includes(status);
  }

  private normalizeTemplateId(templateId?: string): ResumeTemplateId | undefined {
    if (!templateId) return undefined;
    const normalized = templateId.trim().toLowerCase() as ResumeTemplateId;
    return SUPPORTED_TEMPLATE_IDS.has(normalized) ? normalized : FREE_TEMPLATE_ID;
  }

  private mapRowToRecord(row: {
    id: string;
    user_id: string;
    parsed_json: ResumeParsed;
    created_at: string;
    template_id?: string | null;
  }): ResumeRecord {
    return {
      id: row.id,
      userId: row.user_id,
      parsed: row.parsed_json,
      createdAt: row.created_at,
      templateId: row.template_id ?? undefined,
    };
  }

  private get dmxApiUrl(): string {
    return process.env.DMXAPI_RESPONSES_URL || 'https://www.dmxapi.cn/v1/responses';
  }

  private get dmxApiKey(): string | undefined {
    return process.env.DMXAPI_API_KEY;
  }

  private get dmxApiModel(): string {
    return process.env.DMXAPI_PARSE_MODEL || 'hehe-tywd';
  }

  private get dmxChatUrl(): string {
    return process.env.DMXAPI_CHAT_URL || 'https://www.dmxapi.cn/v1/chat/completions';
  }

  private get dmxChatModel(): string {
    return process.env.DMXAPI_CHAT_MODEL || 'gpt-5-mini';
  }

  private toNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private extractTextFromDmxPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;

    const root = payload as Record<string, unknown>;
    const directCandidates = [
      root.output_text,
      root.markdown,
      root.text,
      (root.result as Record<string, unknown> | undefined)?.markdown,
      (root.result as Record<string, unknown> | undefined)?.text,
      (root.data as Record<string, unknown> | undefined)?.markdown,
      (root.data as Record<string, unknown> | undefined)?.text,
    ]
      .map((item) => this.toNonEmptyString(item))
      .filter((item): item is string => Boolean(item));
    if (directCandidates.length > 0) {
      return directCandidates.join('\n');
    }

    const collected: string[] = [];
    const walk = (node: unknown, depth: number) => {
      if (depth > 5 || node === null || node === undefined) return;
      if (typeof node === 'string') {
        const text = node.trim();
        if (text.length >= 24) {
          collected.push(text);
        }
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) {
          walk(item, depth + 1);
        }
        return;
      }
      if (typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      const priorityKeys = ['markdown', 'text', 'content', 'output_text'];
      for (const key of priorityKeys) {
        if (key in obj) {
          walk(obj[key], depth + 1);
        }
      }
      for (const [key, value] of Object.entries(obj)) {
        if (priorityKeys.includes(key)) continue;
        if (
          key === 'data' ||
          key === 'result' ||
          key === 'output' ||
          key === 'detail' ||
          key === 'pages' ||
          key === 'choices' ||
          key === 'message'
        ) {
          walk(value, depth + 1);
        }
      }
    };
    walk(root, 0);

    if (!collected.length) return null;
    return collected.slice(0, 200).join('\n');
  }

  private extractJsonBlock(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return fenced?.[1] || text;
  }

  private parseDmxChatContent(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ text?: string }>;
        };
      }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      return trimmed || null;
    }
    if (Array.isArray(content)) {
      const merged = content
        .map((item) => item?.text?.trim() || '')
        .filter(Boolean)
        .join('\n')
        .trim();
      return merged || null;
    }
    return null;
  }

  private toStringOrUndefined(value: unknown, max = 400): string | undefined {
    if (typeof value !== 'string') return undefined;
    const text = value.trim().replace(/\s+/g, ' ');
    if (!text) return undefined;
    return text.slice(0, max);
  }

  private toStringArray(value: unknown, maxItems = 20, maxLen = 220): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim().replace(/\s+/g, ' ') : ''))
      .filter(Boolean)
      .slice(0, maxItems)
      .map((item) => item.slice(0, maxLen));
  }

  private normalizeAiAssessment(candidate: unknown): ResumeAiAssessment | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const root = candidate as Record<string, unknown>;
    const scoreRaw = root.score;
    const parsedScore =
      typeof scoreRaw === 'number'
        ? scoreRaw
        : typeof scoreRaw === 'string'
          ? Number.parseFloat(scoreRaw)
          : NaN;
    if (!Number.isFinite(parsedScore)) return null;

    const score = Math.max(0, Math.min(100, Math.round(parsedScore)));
    return {
      score,
      summary: this.toStringOrUndefined(root.summary, 320),
      strengths: this.toStringArray(root.strengths, 5, 180),
      improvements: this.toStringArray(root.improvements, 5, 180),
      generatedAt: this.toStringOrUndefined(root.generatedAt, 60),
      model: this.toStringOrUndefined(root.model, 80),
    };
  }

  private buildHeuristicAssessment(parsed: ResumeParsed): ResumeAiAssessment {
    let score = 0;
    if (parsed.basics.name || parsed.basics.email) score += 20;
    if (parsed.basics.summary) score += 20;
    if (parsed.skills.length > 0) score += 20;
    if (parsed.experiences.length > 0) score += 20;
    if ((parsed.education || []).length > 0) score += 20;

    const strengths: string[] = [];
    if (parsed.basics.summary) strengths.push('Has a professional summary section.');
    if (parsed.skills.length > 0) strengths.push(`Contains ${parsed.skills.length} extracted skills.`);
    if (parsed.experiences.length > 0) {
      strengths.push(`Includes ${parsed.experiences.length} work experience entries.`);
    }

    const improvements: string[] = [];
    if (!parsed.basics.summary) improvements.push('Add a concise summary tailored to your target role.');
    if (parsed.skills.length < 8) improvements.push('Expand skill keywords for stronger ATS matching.');
    if (parsed.experiences.length === 0) improvements.push('Add experience bullets with measurable outcomes.');
    if ((parsed.education || []).length === 0) improvements.push('Add education details for profile completeness.');

    return {
      score,
      summary: 'Fallback score based on extracted section completeness.',
      strengths: strengths.slice(0, 3),
      improvements: improvements.slice(0, 3),
      generatedAt: new Date().toISOString(),
      model: this.dmxApiKey ? this.dmxChatModel : 'local-heuristic',
    };
  }

  private buildAssessmentContext(parsed: ResumeParsed): string {
    const payload = {
      basics: parsed.basics,
      skills: parsed.skills.slice(0, 40),
      experiences: parsed.experiences.slice(0, 6).map((exp) => ({
        company: exp.company,
        title: exp.title,
        start: exp.start,
        end: exp.end,
        summary: exp.summary,
        highlights: (exp.highlights || []).slice(0, 6),
      })),
      education: (parsed.education || []).slice(0, 6),
    };
    return JSON.stringify(payload, null, 2).slice(0, 20000);
  }

  private async scoreResumeWithAi(parsed: ResumeParsed, userId: string): Promise<ResumeAiAssessment> {
    const fallback = this.buildHeuristicAssessment(parsed);
    if (!this.dmxApiKey) {
      return fallback;
    }

    const prompt = `You are a senior ATS resume reviewer.
Score the resume from 0 to 100 and provide concise insights.
Return STRICT JSON only using this schema:
{
  "score": 0,
  "summary": "one sentence",
  "strengths": ["..."],
  "improvements": ["..."]
}
Rules:
- score must be an integer between 0 and 100.
- be evidence-based from the provided resume JSON.
- keep each item under 160 chars.
- do not include markdown or extra keys.

Resume JSON:
${this.buildAssessmentContext(parsed)}`;

    try {
      const response = await fetch(this.dmxChatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.dmxApiKey}`,
        },
        body: JSON.stringify({
          model: this.dmxChatModel,
          messages: [
            { role: 'system', content: 'You are a strict JSON generator. Return JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        const providerError = (await response.text()).slice(0, 240);
        this.logger.warn(
          `AI scoring failed for user ${userId}: ${response.status} ${providerError}`,
          'ResumeService',
        );
        return fallback;
      }

      const payload = (await response.json()) as unknown;
      const content = this.parseDmxChatContent(payload);
      if (!content) return fallback;

      const parsedJson = JSON.parse(this.extractJsonBlock(content)) as unknown;
      const normalized = this.normalizeAiAssessment(parsedJson);
      if (!normalized) return fallback;

      return {
        ...normalized,
        generatedAt: normalized.generatedAt || new Date().toISOString(),
        model: normalized.model || this.dmxChatModel,
      };
    } catch (error) {
      this.logger.warn(
        `AI scoring fallback for user ${userId}: ${(error as Error).message}`,
        'ResumeService',
      );
      return fallback;
    }
  }

  private normalizeStructuredResume(candidate: unknown): ResumeParsed | null {
    if (!candidate || typeof candidate !== 'object') return null;
    const root = candidate as Record<string, unknown>;
    const basicsRaw = (root.basics || {}) as Record<string, unknown>;
    const basics = {
      name: this.toStringOrUndefined(basicsRaw.name, 80),
      email: this.toStringOrUndefined(basicsRaw.email, 120),
      phone: this.toStringOrUndefined(basicsRaw.phone, 60),
      location: this.toStringOrUndefined(basicsRaw.location, 120),
      link: this.toStringOrUndefined(basicsRaw.link, 240),
      summary: this.toStringOrUndefined(basicsRaw.summary, 900),
    };
    const skills = this.toStringArray(root.skills, 40, 80);
    const experiences = Array.isArray(root.experiences)
      ? root.experiences
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const exp = item as Record<string, unknown>;
            return {
              company: this.toStringOrUndefined(exp.company, 120),
              title: this.toStringOrUndefined(exp.title, 120),
              start: this.toStringOrUndefined(exp.start, 40),
              end: this.toStringOrUndefined(exp.end, 40),
              summary: this.toStringOrUndefined(exp.summary, 500),
              highlights: this.toStringArray(exp.highlights, 8, 280),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .slice(0, 8)
      : [];
    const education = Array.isArray(root.education)
      ? root.education
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const edu = item as Record<string, unknown>;
            return {
              school: this.toStringOrUndefined(edu.school, 160),
              degree: this.toStringOrUndefined(edu.degree, 160),
              gpa: this.toStringOrUndefined(edu.gpa, 40),
              date: this.toStringOrUndefined(edu.date, 80),
              descriptions: this.toStringArray(edu.descriptions, 6, 260),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .slice(0, 6)
      : [];
    const aiAssessment = this.normalizeAiAssessment(root.aiAssessment);

    const hasAnyData =
      Boolean(
        basics.name ||
          basics.email ||
          basics.phone ||
          basics.location ||
          basics.link ||
          basics.summary,
      ) ||
      skills.length > 0 ||
      experiences.length > 0 ||
      education.length > 0;
    if (!hasAnyData) return null;

    return {
      parser: {
        provider: 'dmxapi',
        model: this.dmxChatModel,
        mode: 'ocr+llm-structured',
      },
      basics,
      skills,
      experiences,
      education,
      aiAssessment: aiAssessment || undefined,
    };
  }

  private async structureResumeByDmxLlm(
    extractedText: string,
    userId: string,
  ): Promise<ResumeParsed | null> {
    if (!this.dmxApiKey) return null;
    const prompt = `You are a resume parser. Convert resume text into strict JSON only.
Schema:
{"basics":{"name":"","email":"","phone":"","location":"","link":"","summary":""},"skills":[],"experiences":[{"company":"","title":"","start":"","end":"","summary":"","highlights":[]}],"education":[{"school":"","degree":"","gpa":"","date":"","descriptions":[]}]}
Rules: use only source text, no hallucination, unknown -> empty string/array.
Resume text:
${extractedText.slice(0, 18000)}`;

    const response = await fetch(this.dmxChatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.dmxApiKey}`,
      },
      body: JSON.stringify({
        model: this.dmxChatModel,
        messages: [
          { role: 'system', content: 'You are a precise JSON generator.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      const providerError = (await response.text()).slice(0, 240);
      this.logger.warn(
        `DMX LLM structuring failed for user ${userId}: ${response.status} ${providerError}`,
        'ResumeService',
      );
      return null;
    }
    const payload = (await response.json()) as unknown;
    const content = this.parseDmxChatContent(payload);
    if (!content) return null;
    try {
      const parsed = JSON.parse(this.extractJsonBlock(content)) as unknown;
      return this.normalizeStructuredResume(parsed);
    } catch (error) {
      this.logger.warn(
        `DMX LLM returned non-JSON content for user ${userId}: ${(error as Error).message}`,
        'ResumeService',
      );
      return null;
    }
  }

  private async parseByDmx(fileBuffer: Buffer, userId: string): Promise<ResumeParsed> {
    if (!this.dmxApiKey) {
      throw new ServiceUnavailableException(
        'Missing DMXAPI_API_KEY. Please configure DMXAPI API key in backend env.',
      );
    }

    const input = fileBuffer.toString('base64');
    const response = await fetch(this.dmxApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.dmxApiKey}`,
      },
      body: JSON.stringify({
        model: this.dmxApiModel,
        input,
        pdf_pwd: '',
        page_start: 0,
        page_count: 1000,
        parse_mode: 'scan',
        dpi: 144,
        apply_document_tree: 1,
        table_flavor: 'html',
        get_image: 'none',
        image_output_type: 'default',
        paratext_mode: 'annotation',
        formula_level: 0,
        underline_level: 0,
        apply_merge: 1,
        apply_image_analysis: 0,
        apply_chart: 0,
        crop_dewarp: 0,
        remove_watermark: 0,
        markdown_details: 1,
        page_details: 1,
        raw_ocr: 0,
        char_details: 0,
        catalog_details: 0,
        get_excel: 0,
      }),
    });

    if (!response.ok) {
      const providerError = (await response.text()).slice(0, 300);
      this.logger.error(
        `DMX parse failed for user ${userId}: ${response.status} ${providerError}`,
        undefined,
        'ResumeService',
      );
      throw new BadGatewayException(
        `DMX parse request failed (${response.status}).`,
      );
    }

    const payload = (await response.json()) as unknown;
    const extractedText = this.extractTextFromDmxPayload(payload);
    if (!extractedText) {
      this.logger.warn(
        `DMX parse returned empty text for user ${userId}`,
        'ResumeService',
      );
      throw new BadGatewayException('DMX parse returned empty content.');
    }

    const llmStructured = await this.structureResumeByDmxLlm(extractedText, userId);
    if (llmStructured) {
      return llmStructured;
    }

    const fallback = this.parseText(extractedText);
    fallback.parser = {
      provider: 'dmxapi',
      model: this.dmxApiModel,
      mode: 'ocr+rule-fallback',
    };
    return fallback;
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
      parser: {
        provider: 'local',
        model: 'pdf-parse+rules',
        mode: 'rule-based',
      },
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

  private sanitizeParsedFromEditor(
    candidate: unknown,
    fallback: ResumeParsed,
  ): ResumeParsed {
    const root =
      candidate && typeof candidate === 'object'
        ? (candidate as Record<string, unknown>)
        : {};

    const parserRaw =
      root.parser && typeof root.parser === 'object'
        ? (root.parser as Record<string, unknown>)
        : {};
    const basicsRaw =
      root.basics && typeof root.basics === 'object'
        ? (root.basics as Record<string, unknown>)
        : {};
    const hasBasicsName = Object.prototype.hasOwnProperty.call(
      basicsRaw,
      'name',
    );
    const hasBasicsEmail = Object.prototype.hasOwnProperty.call(
      basicsRaw,
      'email',
    );
    const hasBasicsPhone = Object.prototype.hasOwnProperty.call(
      basicsRaw,
      'phone',
    );
    const hasBasicsLocation = Object.prototype.hasOwnProperty.call(
      basicsRaw,
      'location',
    );
    const hasBasicsLink = Object.prototype.hasOwnProperty.call(
      basicsRaw,
      'link',
    );
    const hasBasicsSummary = Object.prototype.hasOwnProperty.call(
      basicsRaw,
      'summary',
    );

    const experiences = Array.isArray(root.experiences)
      ? root.experiences
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const exp = item as Record<string, unknown>;
            const highlights = this.toStringArray(exp.highlights, 8, 280);
            const summary = this.toStringOrUndefined(exp.summary, 500);
            return {
              company: this.toStringOrUndefined(exp.company, 120),
              title: this.toStringOrUndefined(exp.title, 120),
              start: this.toStringOrUndefined(exp.start, 40),
              end: this.toStringOrUndefined(exp.end, 40),
              summary,
              highlights:
                highlights.length > 0
                  ? highlights
                  : summary
                    ? [summary]
                    : [],
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .slice(0, 8)
      : [];

    const education = Array.isArray(root.education)
      ? root.education
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const edu = item as Record<string, unknown>;
            return {
              school: this.toStringOrUndefined(edu.school, 160),
              degree: this.toStringOrUndefined(edu.degree, 160),
              gpa: this.toStringOrUndefined(edu.gpa, 40),
              date: this.toStringOrUndefined(edu.date, 80),
              descriptions: this.toStringArray(edu.descriptions, 6, 260),
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .slice(0, 6)
      : [];
    const aiAssessment = this.normalizeAiAssessment(root.aiAssessment);

    return {
      parser: {
        provider:
          this.toStringOrUndefined(parserRaw.provider, 60) ||
          fallback.parser?.provider ||
          'manual-editor',
        model:
          this.toStringOrUndefined(parserRaw.model, 80) ||
          fallback.parser?.model,
        mode: 'manual-edit',
      },
      basics: {
        name:
          hasBasicsName
            ? this.toStringOrUndefined(basicsRaw.name, 80)
            : fallback.basics.name,
        email:
          hasBasicsEmail
            ? this.toStringOrUndefined(basicsRaw.email, 120)
            : fallback.basics.email,
        phone:
          hasBasicsPhone
            ? this.toStringOrUndefined(basicsRaw.phone, 60)
            : fallback.basics.phone,
        location:
          hasBasicsLocation
            ? this.toStringOrUndefined(basicsRaw.location, 120)
            : fallback.basics.location,
        link:
          hasBasicsLink
            ? this.toStringOrUndefined(basicsRaw.link, 240)
            : fallback.basics.link,
        summary:
          hasBasicsSummary
            ? this.toStringOrUndefined(basicsRaw.summary, 900)
            : fallback.basics.summary,
      },
      skills:
        Array.isArray(root.skills)
          ? this.toStringArray(root.skills, 40, 80)
          : fallback.skills,
      experiences: Array.isArray(root.experiences)
        ? experiences
        : fallback.experiences,
      education: Array.isArray(root.education)
        ? education
        : fallback.education || [],
      aiAssessment: aiAssessment || fallback.aiAssessment,
    };
  }

  async uploadAndParse(fileBuffer: Buffer, userId: string): Promise<ResumeRecord> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty.');
    }
    let parsed: ResumeParsed;
    if (this.dmxApiKey) {
      parsed = await this.parseByDmx(fileBuffer, userId);
    } else {
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
      parsed = this.parseText(parsedPdf.text || '');
      this.logger.warn(
        'DMXAPI_API_KEY is missing. Falling back to local pdf-parse.',
        'ResumeService',
      );
    }
    parsed.aiAssessment = await this.scoreResumeWithAi(parsed, userId);

    const latest = await this.getLatest(userId);
    return this.saveParsed(userId, parsed, latest?.templateId);
  }

  async getLatest(userId: string): Promise<ResumeRecord | null> {
    if (this.supabaseService.isConfigured()) {
      const row = await this.supabaseService.getLatestResume(userId);
      return row ? this.mapRowToRecord(row) : null;
    }
    return this.memoryStore.get(userId) ?? null;
  }

  async getById(userId: string, resumeId: string): Promise<ResumeRecord | null> {
    if (!resumeId.trim()) return null;
    if (this.supabaseService.isConfigured()) {
      const row = await this.supabaseService.getResumeById(userId, resumeId);
      return row ? this.mapRowToRecord(row) : null;
    }
    const history = this.memoryHistory.get(userId) ?? [];
    const matched = history.find((item) => item.id === resumeId);
    if (matched) return matched;
    const latest = this.memoryStore.get(userId);
    return latest?.id === resumeId ? latest : null;
  }

  async getHistory(userId: string, limit = 12): Promise<ResumeRecord[]> {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    if (this.supabaseService.isConfigured()) {
      const rows = await this.supabaseService.getResumeHistory(userId, safeLimit);
      return rows.map((row) => this.mapRowToRecord(row));
    }
    const history = this.memoryHistory.get(userId) ?? [];
    if (history.length > 0) {
      return history.slice(0, safeLimit);
    }
    const latest = this.memoryStore.get(userId);
    return latest ? [latest] : [];
  }

  async updateLatestFromEditor(
    userId: string,
    candidate: unknown,
    templateId?: string,
  ): Promise<ResumeRecord> {
    const latest = await this.getLatest(userId);
    if (!latest) {
      throw new BadRequestException(
        'No resume found for this user. Please upload resume first.',
      );
    }
    const parsed = this.sanitizeParsedFromEditor(candidate, latest.parsed);
    return this.saveParsed(userId, parsed, templateId ?? latest.templateId);
  }

  async saveParsed(
    userId: string,
    parsed: ResumeParsed,
    templateId?: string,
  ): Promise<ResumeRecord> {
    let resolvedTemplateId = this.normalizeTemplateId(templateId);
    if (resolvedTemplateId === undefined) {
      const latest = await this.getLatest(userId);
      resolvedTemplateId = this.normalizeTemplateId(latest?.templateId);
    }

    const subscription = await this.subscriptionService.getSubscription(userId);
    if (!this.isSubscribedStatus(subscription.status)) {
      resolvedTemplateId = FREE_TEMPLATE_ID;
    }

    if (this.supabaseService.isConfigured()) {
      const row = await this.supabaseService.insertResume(
        userId,
        parsed,
        resolvedTemplateId,
      );
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
      templateId: resolvedTemplateId,
    };
    this.memoryStore.set(userId, localRecord);
    const history = this.memoryHistory.get(userId) ?? [];
    history.unshift(localRecord);
    this.memoryHistory.set(userId, history.slice(0, 10));
    return localRecord;
  }

  async rollbackToPrevious(userId: string): Promise<ResumeRecord | null> {
    if (this.supabaseService.isConfigured()) {
      const history = await this.supabaseService.getResumeHistory(userId, 2);
      if (!history[1]) {
        return null;
      }
      const row = await this.supabaseService.insertResume(
        userId,
        history[1].parsed_json,
        history[1].template_id ?? undefined,
      );
      return row ? this.mapRowToRecord(row) : null;
    }

    const history = this.memoryHistory.get(userId) ?? [];
    if (history.length < 2) {
      return null;
    }
    const previous = history[1];
    const restored: ResumeRecord = {
      id: `local_${Date.now()}`,
      userId,
      parsed: previous.parsed,
      createdAt: new Date().toISOString(),
      templateId: previous.templateId,
    };
    this.memoryStore.set(userId, restored);
    history.unshift(restored);
    this.memoryHistory.set(userId, history.slice(0, 10));
    return restored;
  }

  async deleteHistoryResume(
    userId: string,
    resumeId: string,
  ): Promise<{ deleted: boolean; latest: ResumeRecord | null }> {
    if (!resumeId.trim()) {
      throw new BadRequestException('Invalid resume id.');
    }

    if (this.supabaseService.isConfigured()) {
      const deleted = await this.supabaseService.deleteResumeById(userId, resumeId);
      if (!deleted) {
        return {
          deleted: false,
          latest: await this.getLatest(userId),
        };
      }
      return {
        deleted: true,
        latest: await this.getLatest(userId),
      };
    }

    const history = this.memoryHistory.get(userId) ?? [];
    const nextHistory = history.filter((item) => item.id !== resumeId);
    const deleted = nextHistory.length !== history.length;

    if (!deleted) {
      return {
        deleted: false,
        latest: this.memoryStore.get(userId) ?? null,
      };
    }

    this.memoryHistory.set(userId, nextHistory);

    const current = this.memoryStore.get(userId);
    if (current?.id === resumeId) {
      const nextLatest = nextHistory[0] ?? null;
      if (nextLatest) {
        this.memoryStore.set(userId, nextLatest);
      } else {
        this.memoryStore.delete(userId);
      }
    }

    return {
      deleted: true,
      latest: this.memoryStore.get(userId) ?? nextHistory[0] ?? null,
    };
  }
}

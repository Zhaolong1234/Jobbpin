import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { AppLoggerService } from '../common/logger/app-logger.service';
import { ResumeRecord } from '../common/types/shared';
import { ResumeService } from '../resume/resume.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly resumeService: ResumeService,
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: AppLoggerService,
  ) {}

  private get geminiApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  }

  private get geminiModel(): string {
    const raw = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    return raw.startsWith('models/') ? raw.slice('models/'.length) : raw;
  }

  private summarizeResumeForPrompt(record: ResumeRecord | null): string {
    if (!record) {
      return 'No parsed resume is available for this user yet.';
    }
    const { basics, skills, experiences, education } = record.parsed;
    const expText = experiences
      .map((exp, idx) => {
        const period = `${exp.start || '?'} - ${exp.end || 'Present'}`;
        const points = (exp.highlights || [])
          .slice(0, 3)
          .map((point) => `- ${point}`)
          .join('\n');
        return `Experience ${idx + 1}\nRole: ${exp.title || '-'}\nCompany: ${
          exp.company || '-'
        }\nPeriod: ${period}\n${points}`;
      })
      .join('\n\n');

    const eduText = (education || [])
      .map(
        (edu, idx) =>
          `Education ${idx + 1}\nSchool: ${edu.school || '-'}\nDegree: ${
            edu.degree || '-'
          }\nDate: ${edu.date || '-'}`,
      )
      .join('\n\n');

    return [
      `Name: ${basics.name || '-'}`,
      `Email: ${basics.email || '-'}`,
      `Phone: ${basics.phone || '-'}`,
      `Location: ${basics.location || '-'}`,
      `Link: ${basics.link || '-'}`,
      `Summary: ${basics.summary || '-'}`,
      `Skills: ${skills.join(', ') || '-'}`,
      expText ? `\n${expText}` : '',
      eduText ? `\n${eduText}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private extractTextFromGeminiPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((part) => part.text?.trim() || '')
      .filter(Boolean)
      .join('\n')
      .trim();
    return text || null;
  }

  private extractProviderErrorMessage(payload: string): string | null {
    try {
      const data = JSON.parse(payload) as {
        error?: { message?: string };
      };
      const message = data?.error?.message?.trim();
      return message || null;
    } catch {
      return null;
    }
  }

  private buildFallbackReply(message: string, record: ResumeRecord | null): string {
    const lowered = message.toLowerCase();
    if (!record) {
      return '我还没有检测到你的已解析简历。请先上传简历，再问我优化建议。';
    }

    if (lowered.includes('score') || lowered.includes('评分')) {
      const base = 72 + Math.min(record.parsed.skills.length, 8) * 2;
      return `当前规则估计分约 ${Math.min(base, 92)} / 100。建议优先补充可量化成果（数字、百分比、影响范围），并对目标岗位做关键词定制。`;
    }

    if (lowered.includes('optimize') || lowered.includes('优化') || lowered.includes('改')) {
      const topExp = record.parsed.experiences[0];
      if (!topExp) {
        return '我建议先补充至少一段工作经历，再做针对性优化。';
      }
      return `你可以优先优化这段：${topExp.title || '当前经历'}。建议把 bullet 写成“动作 + 技术 + 结果”，例如：Built X with Y, reducing Z by 20%。`;
    }

    return '我已读取你的简历解析结果。你可以问我：1）如何提升面试命中率；2）如何改写某段经历；3）如何对齐特定岗位JD。';
  }

  private isSubscriptionQuestion(message: string): boolean {
    const lowered = message.toLowerCase();
    const keywords = [
      'subscription',
      'billing',
      'stripe',
      'trial',
      'weekly',
      'monthly',
      'yearly',
      'price',
      'plan',
      '订阅',
      '计费',
      '价格',
      '试用',
      '周付',
      '月付',
      '年付',
      '套餐',
    ];
    return keywords.some((word) => lowered.includes(word));
  }

  private buildSubscriptionReply(input: {
    status: string;
    plan: string;
    currentPeriodEnd?: string;
  }): string {
    const weeklyPrice = 'A$5/week';
    const monthlyPrice = 'A$19/month';
    const yearlyPrice = 'A$200/year';
    return [
      '订阅规则如下：',
      `1) Weekly：${weeklyPrice}，仅 Weekly 支持 7 天免费试用。`,
      `2) Monthly：${monthlyPrice}，直接付费，无试用。`,
      `3) Yearly：${yearlyPrice}，直接付费，无试用。`,
      '4) 7 天试用只对“首次订阅用户”开放；如果用户有过订阅记录，则 trial not available。',
      '',
      `你当前状态：plan=${input.plan || 'free'}，status=${input.status || 'incomplete'}${
        input.currentPeriodEnd ? `，currentPeriodEnd=${input.currentPeriodEnd}` : ''
      }`,
    ].join('\n');
  }

  async chat(dto: ChatDto) {
    const [resume, subscription] = await Promise.all([
      this.resumeService.getLatest(dto.userId),
      this.subscriptionService.getSubscription(dto.userId),
    ]);

    if (this.isSubscriptionQuestion(dto.message)) {
      return {
        reply: this.buildSubscriptionReply({
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        }),
      };
    }

    const resumeContext = this.summarizeResumeForPrompt(resume);

    if (!this.geminiApiKey) {
      throw new ServiceUnavailableException(
        'Missing GEMINI_API_KEY. Please configure Gemini API key in backend .env.',
      );
    }

    const historyTexts = (dto.history || [])
      .slice(-8)
      .map((item) => `[${item.role}] ${item.content}`)
      .join('\n');

    const prompt = `You are an AI career assistant for resume optimization and product guidance.
Default language: concise Chinese.
If the user asks for score, provide score (0-100), weaknesses, and rewrite suggestions.
Use the parsed resume as source of truth.
If user asks subscription questions, answer with these exact rules:
- Weekly: A$5/week, supports 7-day free trial only for first-time subscribers.
- Monthly: A$19/month, no trial.
- Yearly: A$200/year, no trial.
- If subscribed before, trial is unavailable.

Parsed Resume:
${resumeContext}

Recent Chat:
${historyTexts || '(empty)'}

User:
${dto.message}`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.geminiModel,
        )}:generateContent`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.geminiApiKey,
        },
        body: JSON.stringify({
          contents,
        }),
      },
      );

      if (!response.ok) {
        const errText = await response.text();
        const providerMessage =
          this.extractProviderErrorMessage(errText) || 'Unknown provider error.';
        this.logger.warn(
          `Gemini request failed: ${response.status} ${providerMessage}`,
          'AiService',
        );

        if (response.status === 429) {
          throw new HttpException(
            'Gemini quota exceeded. Please check your Google AI usage/billing limits.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new UnauthorizedException(
            'Gemini API key is invalid or lacks permission.',
          );
        }

        throw new BadGatewayException(
          `Gemini request failed: ${providerMessage}`,
        );
      }

      const data = (await response.json()) as unknown;
      const reply = this.extractTextFromGeminiPayload(data);
      if (!reply) {
        throw new BadGatewayException(
          'Gemini returned an empty response. Please retry.',
        );
      }

      return { reply };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        `Gemini request error: ${(error as Error).message}`,
        'AiService',
      );
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable. Please retry later.',
      );
    }
  }
}

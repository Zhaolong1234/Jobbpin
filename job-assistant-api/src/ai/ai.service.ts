import {
  BadGatewayException,
  BadRequestException,
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
import { ImplementPlanDto } from './dto/implement-plan.dto';
import { RollbackResumeDto } from './dto/rollback-resume.dto';

interface PendingSummaryPlan {
  planId: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  proposedSummary: string;
  improvements: string[];
  rationale: string;
  beforeSummary: string;
}

@Injectable()
export class AiService {
  private readonly pendingPlans = new Map<string, PendingSummaryPlan>();

  constructor(
    private readonly resumeService: ResumeService,
    private readonly subscriptionService: SubscriptionService,
    private readonly logger: AppLoggerService,
  ) {}

  private get dmxApiKey(): string | undefined {
    return process.env.DMXAPI_API_KEY;
  }

  private get dmxChatUrl(): string {
    return process.env.DMXAPI_CHAT_URL || 'https://www.dmxapi.cn/v1/chat/completions';
  }

  private get dmxChatModel(): string {
    return process.env.DMXAPI_CHAT_MODEL || 'gpt-5-mini';
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

  private extractTextFromDmxChatPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ text?: string; type?: string }>;
        };
      }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      return trimmed || null;
    }
    if (Array.isArray(content)) {
      const text = content
        .map((item) => item?.text?.trim() || '')
        .filter(Boolean)
        .join('\n')
        .trim();
      return text || null;
    }
    return null;
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

  private extractJsonBlock(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return fenced?.[1] || text;
  }

  private async callDmxChat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    contextTag: string,
  ): Promise<string> {
    if (!this.dmxApiKey) {
      throw new ServiceUnavailableException(
        'Missing DMXAPI_API_KEY. Please configure DMX API key in backend .env.',
      );
    }

    const response = await fetch(this.dmxChatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.dmxApiKey}`,
      },
      body: JSON.stringify({
        model: this.dmxChatModel,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const providerMessage =
        this.extractProviderErrorMessage(errText) || 'Unknown provider error.';
      this.logger.warn(
        `${contextTag} failed: ${response.status} ${providerMessage}`,
        'AiService',
      );

      if (response.status === 429) {
        throw new HttpException(
          'DMX API quota exceeded. Please check your DMX usage/billing limits.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(
          'DMX API key is invalid or lacks permission.',
        );
      }

      throw new BadGatewayException(`${contextTag} failed: ${providerMessage}`);
    }

    const data = (await response.json()) as unknown;
    const text = this.extractTextFromDmxChatPayload(data);
    if (!text) {
      throw new BadGatewayException(`${contextTag} returned an empty response.`);
    }
    return text;
  }

  private isResumeModificationRequest(message: string): boolean {
    const lowered = message.toLowerCase();
    const keywords = [
      'modify',
      'rewrite',
      'improve',
      'optimize',
      'summary',
      'introduction',
      'intro',
      '段落',
      '改写',
      '修改',
      '优化',
      '技术',
      '偏技术',
    ];
    return keywords.some((word) => lowered.includes(word));
  }

  private isSummaryModificationRequest(message: string): boolean {
    const lowered = message.toLowerCase();
    const keywords = [
      'summary',
      'introduction',
      'intro',
      'profile summary',
      '自我介绍',
      '简介',
      '总结',
      'summary段落',
      'introduction段落',
    ];
    return keywords.some((word) => lowered.includes(word));
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

  private makePlanId(userId: string): string {
    return `plan_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildFallbackPlan(
    message: string,
    currentSummary: string,
    skills: string[],
    userId: string,
  ): PendingSummaryPlan {
    const topSkills = skills.slice(0, 5).join(', ');
    const proposedSummary = [
      'Software Engineer focused on building reliable web systems and backend services.',
      topSkills ? `Hands-on skills include ${topSkills}.` : '',
      currentSummary ? `Background: ${currentSummary.slice(0, 240)}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 850);

    const plan: PendingSummaryPlan = {
      planId: this.makePlanId(userId),
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 20,
      proposedSummary,
      improvements: [
        '突出技术关键词与核心技术栈，提升 ATS 关键词匹配。',
        '将原描述改为工程能力导向，更容易体现岗位相关性。',
        '语句更聚焦系统构建与交付能力，减少泛化表达。',
      ],
      rationale: message,
      beforeSummary: currentSummary || '',
    };
    return plan;
  }

  private async buildSummaryPlan(dto: ChatDto, resume: ResumeRecord) {
    const existingPlan =
      dto.planId && this.pendingPlans.has(dto.planId)
        ? this.pendingPlans.get(dto.planId)
        : undefined;
    const currentSummary =
      existingPlan?.proposedSummary || resume.parsed.basics.summary || '';
    const skills = resume.parsed.skills || [];
    const prompt = `You are a resume editor.
Task: rewrite the candidate summary to be more technical, based on the user request.
Return STRICT JSON only with this schema:
{
  "proposedSummary": "string",
  "improvements": ["string", "string", "string"],
  "rationale": "string"
}
Rules:
- proposedSummary <= 850 chars.
- improvements should explain why this is better for technical hiring and ATS.
- keep language concise Chinese unless request clearly asks English.

User request: ${dto.message}
Current summary: ${currentSummary || '-'}
Skills: ${skills.join(', ') || '-'}
Target role: ${resume.parsed.experiences?.[0]?.title || '-'}
`;

    try {
      const text = await this.callDmxChat(
        [
          { role: 'system', content: 'You output valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        'DMX summary planning',
      );
      const parsed = JSON.parse(this.extractJsonBlock(text)) as {
        proposedSummary?: string;
        improvements?: string[];
        rationale?: string;
      };

      const proposedSummary = (parsed.proposedSummary || '').trim();
      const improvements = Array.isArray(parsed.improvements)
        ? parsed.improvements
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
            .slice(0, 4)
        : [];
      const rationale = (parsed.rationale || '').trim();

      if (!proposedSummary) {
        return this.buildFallbackPlan(dto.message, currentSummary, skills, dto.userId);
      }

      return {
        planId: this.makePlanId(dto.userId),
        userId: dto.userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 20,
        proposedSummary: proposedSummary.slice(0, 850),
        improvements:
          improvements.length > 0
            ? improvements
            : ['本次改写提升了技术关键词密度和岗位匹配表达。'],
        rationale: rationale || '已按你的要求强化技术导向描述。',
        beforeSummary: currentSummary,
      } satisfies PendingSummaryPlan;
    } catch (error) {
      this.logger.warn(
        `Build summary plan fallback: ${(error as Error).message}`,
        'AiService',
      );
      return this.buildFallbackPlan(dto.message, currentSummary, skills, dto.userId);
    }
  }

  async implementPlan(dto: ImplementPlanDto) {
    const plan = this.pendingPlans.get(dto.planId);
    if (!plan || plan.userId !== dto.userId) {
      throw new BadRequestException('Plan not found or expired. Please generate a new plan.');
    }
    if (Date.now() > plan.expiresAt) {
      this.pendingPlans.delete(dto.planId);
      throw new BadRequestException('Plan expired. Please generate a new plan.');
    }

    const latest = await this.resumeService.getLatest(dto.userId);
    if (!latest) {
      throw new BadRequestException('No resume found for this user. Please upload resume first.');
    }

    const nextParsed = JSON.parse(JSON.stringify(latest.parsed)) as ResumeRecord['parsed'];
    if (!nextParsed.basics) {
      nextParsed.basics = {};
    }
    nextParsed.basics.summary = plan.proposedSummary;
    nextParsed.parser = {
      provider: 'dmxapi',
      model: this.dmxChatModel,
      mode: 'chat-edit-summary',
    };

    const saved = await this.resumeService.saveParsed(dto.userId, nextParsed);
    this.pendingPlans.delete(dto.planId);

    return {
      action: 'implemented',
      reply: 'Summary 已更新。',
      updatedSummary: plan.proposedSummary,
      improvements: plan.improvements,
      explanation: plan.rationale,
      resume: saved,
      canRollback: true,
      rollbackHint: '若要回退，点击 Previous。',
    };
  }

  async rollbackResume(dto: RollbackResumeDto) {
    const restored = await this.resumeService.rollbackToPrevious(dto.userId);
    if (!restored) {
      throw new BadRequestException('No previous resume version available for rollback.');
    }
    return {
      action: 'rolled_back',
      reply: '已回退到上一版简历。',
      resume: restored,
    };
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

    const refineExistingPlan = Boolean(dto.planId && this.pendingPlans.has(dto.planId));
    if (resume && (this.isSummaryModificationRequest(dto.message) || refineExistingPlan)) {
      if (dto.planId) {
        this.pendingPlans.delete(dto.planId);
      }
      const plan = await this.buildSummaryPlan(dto, resume);
      this.pendingPlans.set(plan.planId, plan);
      return {
        action: 'plan_ready',
        reply:
          '我已经生成了一版修改计划。你可以先看预览，如果满意请输入 implement the plan；如果还想继续打磨，请输入 talk more。',
        planId: plan.planId,
        targetField: 'summary',
        preview: {
          before: plan.beforeSummary,
          after: plan.proposedSummary,
        },
        improvements: plan.improvements,
        explanation: plan.rationale,
        options: ['implement_the_plan', 'talk_more'],
      };
    }

    if (resume && this.isResumeModificationRequest(dto.message)) {
      return {
        reply:
          '当前“计划-实施”流程只支持 Summary/Introduction 改写。像电话、邮箱、姓名这类字段，请直接告诉我目标值，我会先给你文本建议；后续我可以再帮你加成可直接落库的字段编辑。',
      };
    }

    const resumeContext = this.summarizeResumeForPrompt(resume);
    const historyTexts = (dto.history || [])
      .slice(-8)
      .map((item) => `[${item.role}] ${item.content}`)
      .join('\n');

    const prompt = `You are an AI career assistant for resume optimization and product guidance.
Default language: concise Chinese.
If the user asks for score, provide score (0-100), weaknesses, and rewrite suggestions.
Use the parsed resume as source of truth.

Parsed Resume:
${resumeContext}

Recent Chat:
${historyTexts || '(empty)'}

User:
${dto.message}`;

    try {
      const reply = await this.callDmxChat(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        'DMX chat request',
      );
      return { reply };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn(
        `DMX chat request error: ${(error as Error).message}`,
        'AiService',
      );
      throw new ServiceUnavailableException(
        'AI service temporarily unavailable. Please retry later.',
      );
    }
  }
}

import { Body, Controller, Post } from '@nestjs/common';

import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { ImplementPlanDto } from './dto/implement-plan.dto';
import { RollbackResumeDto } from './dto/rollback-resume.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  @Post('implement-plan')
  async implementPlan(@Body() dto: ImplementPlanDto) {
    return this.aiService.implementPlan(dto);
  }

  @Post('rollback-resume')
  async rollbackResume(@Body() dto: RollbackResumeDto) {
    return this.aiService.rollbackResume(dto);
  }
}

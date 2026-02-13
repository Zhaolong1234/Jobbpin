import { Module } from '@nestjs/common';

import { ResumeModule } from '../resume/resume.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ResumeModule, SubscriptionModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}

import { Module } from '@nestjs/common';

import { SubscriptionModule } from '../subscription/subscription.module';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';

@Module({
  imports: [SubscriptionModule],
  controllers: [ResumeController],
  providers: [ResumeService],
  exports: [ResumeService],
})
export class ResumeModule {}

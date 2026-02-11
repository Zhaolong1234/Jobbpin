import { Module } from '@nestjs/common';

import { ResumeModule } from '../resume/resume.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [ResumeModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}


import { Module } from '@nestjs/common';

import { AiModule } from './ai/ai.module';
import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ProfileModule } from './profile/profile.module';
import { ResumeModule } from './resume/resume.module';
import { RootController } from './root.controller';
import { SubscriptionModule } from './subscription/subscription.module';
import { SupabaseModule } from './supabase/supabase.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  controllers: [RootController],
  imports: [
    LoggerModule,
    SupabaseModule,
    HealthModule,
    ProfileModule,
    OnboardingModule,
    ResumeModule,
    BillingModule,
    SubscriptionModule,
    AiModule,
  ],
})
export class AppModule {}

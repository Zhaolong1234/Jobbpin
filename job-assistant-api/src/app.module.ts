import { Module } from '@nestjs/common';

import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { ResumeModule } from './resume/resume.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SupabaseModule } from './supabase/supabase.module';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    LoggerModule,
    SupabaseModule,
    HealthModule,
    ResumeModule,
    BillingModule,
    SubscriptionModule,
  ],
})
export class AppModule {}

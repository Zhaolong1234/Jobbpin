import { Module } from '@nestjs/common';

import { LoggerModule } from '../common/logger/logger.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [SubscriptionModule, LoggerModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}

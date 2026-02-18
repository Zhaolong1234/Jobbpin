import { Controller, Get, Param, Post } from '@nestjs/common';

import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(':userId')
  async getSubscription(@Param('userId') userId: string) {
    const data = await this.subscriptionService.getSubscription(userId);
    return {
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    };
  }

  @Post(':userId/cancel')
  async cancelSubscription(@Param('userId') userId: string) {
    const data = await this.subscriptionService.cancelAutoRenew(userId);
    return {
      plan: data.plan,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
    };
  }
}

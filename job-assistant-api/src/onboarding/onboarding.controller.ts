import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { UpdateOnboardingStepDto } from './dto/update-step.dto';
import { SyncOnboardingDto } from './dto/sync-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get(':userId')
  async getState(@Param('userId') userId: string) {
    return this.onboardingService.getState(userId);
  }

  @Post('initialize')
  async initialize(@Body('userId') userId: string) {
    return this.onboardingService.initialize(userId);
  }

  @Post('sync')
  async sync(@Body() dto: SyncOnboardingDto) {
    return this.onboardingService.syncBySignals(dto.userId, {
      profileCompleted: dto.profileCompleted,
      resumeUploaded: dto.resumeUploaded,
      subscriptionActive: dto.subscriptionActive,
      profileSkipped: dto.profileSkipped,
    });
  }

  @Post('step')
  async updateStep(@Body() dto: UpdateOnboardingStepDto) {
    return this.onboardingService.updateStep(dto.userId, {
      currentStep: dto.currentStep,
      profileSkipped: dto.profileSkipped,
      isCompleted: dto.isCompleted,
      email: dto.email,
    });
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ProfileService } from './profile.service';
import { UpsertProfileDto } from './dto/upsert-profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':userId')
  async getProfile(@Param('userId') userId: string) {
    const profile = await this.profileService.getProfile(userId);
    return {
      ...profile,
      isCompleted: this.profileService.isProfileCompleted(profile),
    };
  }

  @Post()
  async upsertProfile(@Body() dto: UpsertProfileDto) {
    const profile = await this.profileService.upsertProfile({
      userId: dto.userId,
      name: dto.name,
      firstName: dto.firstName,
      lastName: dto.lastName,
      targetRole: dto.targetRole,
      yearsExp: dto.yearsExp,
      country: dto.country,
      city: dto.city,
      linkedinUrl: dto.linkedinUrl,
      portfolioUrl: dto.portfolioUrl,
      allowLinkedinAnalysis: dto.allowLinkedinAnalysis,
      employmentTypes: dto.employmentTypes,
      profileSkipped: dto.profileSkipped,
    });
    return {
      ...profile,
      isCompleted: this.profileService.isProfileCompleted(profile),
    };
  }
}

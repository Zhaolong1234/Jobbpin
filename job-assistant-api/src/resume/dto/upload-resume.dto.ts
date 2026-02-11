import { IsOptional, IsString, MinLength } from 'class-validator';

export class UploadResumeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  userId?: string;
}

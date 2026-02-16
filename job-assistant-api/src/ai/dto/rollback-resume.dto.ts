import { IsString, MaxLength, MinLength } from 'class-validator';

export class RollbackResumeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string;
}

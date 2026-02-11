import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';

import { UploadResumeDto } from './dto/upload-resume.dto';
import { ResumeService } from './resume.service';

@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          callback(
            new BadRequestException('Only PDF files are supported.'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadResumeDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }
    const fileBuffer =
      file.buffer && file.buffer.length > 0
        ? file.buffer
        : file.path
          ? await readFile(file.path)
          : file.stream instanceof Readable
            ? await this.streamToBuffer(file.stream)
          : null;
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException(
        'Upload payload is empty. Please pick the file again and retry.',
      );
    }
    const userId = dto.userId || 'dev_user_id';
    return this.resumeService.uploadAndParse(fileBuffer, userId);
  }

  @Get(':userId/latest')
  async getLatestResume(@Param('userId') userId: string) {
    return this.resumeService.getLatest(userId);
  }
}

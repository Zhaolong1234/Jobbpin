import { Global, Module } from '@nestjs/common';

import { LoggerModule } from '../common/logger/logger.module';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}

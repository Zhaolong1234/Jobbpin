import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  log(message: string, context = 'App') {
    super.log(message, context);
  }

  warn(message: string, context = 'App') {
    super.warn(message, context);
  }

  error(message: string, trace?: string, context = 'App') {
    super.error(message, trace, context);
  }
}

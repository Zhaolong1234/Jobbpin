import { Controller, Get, Head } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'job-assistant-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Head()
  headRoot() {
    return;
  }
}

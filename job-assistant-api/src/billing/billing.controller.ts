import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout-session')
  async createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.billingService.createCheckoutSession(dto);
  }

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.billingService.handleWebhook(req.rawBody ?? Buffer.from(''), signature ?? '');
  }
}

import { Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../shared/public.decorator';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post('payments')
  async payments(@Req() req: Request): Promise<unknown> {
    return this.webhooks.handlePaymentsWebhook(req);
  }
}

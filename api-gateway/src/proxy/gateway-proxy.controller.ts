import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { GatewayAuthGuard } from './gateway-auth.guard';
import { ProxyService } from './proxy.service';

@Controller('api/v1')
@UseGuards(GatewayAuthGuard)
export class GatewayProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxy.forward(req, res);
  }
}

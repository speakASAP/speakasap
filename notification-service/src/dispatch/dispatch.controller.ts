import { Body, Controller, Headers, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtOrInternalGuard } from '../auth/jwt-or-internal.guard';
import { Public } from '../shared/public.decorator';
import { DispatchService } from './dispatch.service';
import { DispatchEmailDto } from './dto/dispatch-email.dto';
import { DispatchEmailGroupDto } from './dto/dispatch-email-group.dto';

/**
 * `@Public()` only disables the global `APP_GUARD` (`JwtAuthGuard`, app.module.ts)
 * so that it cannot 401 a service caller before the route is reached. It does NOT
 * make these routes unauthenticated: `JwtOrInternalGuard` below still demands
 * either a valid user JWT or the shared internal token on every request.
 */
@Controller('dispatch/email')
@Public()
@UseGuards(JwtOrInternalGuard)
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post()
  async postSingle(
    @Res({ passthrough: true }) res: Response,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: DispatchEmailDto,
  ): Promise<Record<string, unknown>> {
    const replay = await this.dispatch.replayIfNeeded(idempotencyKey, body);
    if (replay) {
      res.status(replay.statusCode);
      return replay.body;
    }
    const out = await this.dispatch.dispatchEmailSingle(body);
    await this.dispatch.storeIdempotency(idempotencyKey, body, 200, out);
    return out;
  }

  @Post('group')
  async postGroup(
    @Res({ passthrough: true }) res: Response,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: DispatchEmailGroupDto,
  ): Promise<Record<string, unknown>> {
    const replay = await this.dispatch.replayIfNeeded(idempotencyKey, body);
    if (replay) {
      res.status(replay.statusCode);
      return replay.body;
    }
    const out = await this.dispatch.dispatchEmailGroup(body);
    await this.dispatch.storeIdempotency(idempotencyKey, body, 200, out);
    return out;
  }
}

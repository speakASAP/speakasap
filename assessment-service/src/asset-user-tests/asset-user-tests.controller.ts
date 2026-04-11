import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { userHasAnyRole } from '../auth/role-check';
import { AssetUserTestsService } from './asset-user-tests.service';

@Controller('asset-user-tests')
@UseGuards(JwtAuthGuard)
export class AssetUserTestsController {
  constructor(private readonly assetUserTests: AssetUserTestsService) {}

  @Get()
  list(@Req() req: Request, @Query() query: Record<string, unknown>) {
    const isManager = userHasAnyRole(
      req.user,
      process.env.ASSESSMENT_MANAGER_ROLE_NAMES,
      'manager,admin,super_admin',
    );
    return this.assetUserTests.listForUser(req.user!.id, query, isManager);
  }

  @Post()
  @HttpCode(201)
  create(@Req() req: Request, @Body() body: { asset: string; dueDate?: string }) {
    return this.assetUserTests.create(req.user!.id, body);
  }

  @Get(':testId')
  getOne(@Req() req: Request, @Param('testId', new ParseUUIDPipe({ version: '4' })) testId: string) {
    return this.assetUserTests.getDetail(req.user!.id, testId);
  }

  @Patch(':testId')
  patchOne(
    @Req() req: Request,
    @Param('testId', new ParseUUIDPipe({ version: '4' })) testId: string,
    @Body() body: { answers: Record<string, string[]> },
  ) {
    return this.assetUserTests.patchAnswers(req.user!.id, testId, body);
  }
}

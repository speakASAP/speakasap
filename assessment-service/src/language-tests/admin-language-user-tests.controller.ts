import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaffRolesGuard } from '../auth/staff-roles.guard';
import { AdminLanguageTestsService } from './admin-language-tests.service';

@Controller('admin/language-user-tests')
@UseGuards(JwtAuthGuard, StaffRolesGuard)
export class AdminLanguageUserTestsController {
  constructor(private readonly admin: AdminLanguageTestsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.admin.listAllUserTests(query);
  }

  @Get(':testId')
  getOne(@Param('testId', ParseIntPipe) testId: number) {
    return this.admin.getUserTestAdminDetail(testId);
  }
}

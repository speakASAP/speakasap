import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { ManagersService } from '../managers/managers.service';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';

const MAX_BATCH = 30;

@Controller('internal')
@UseGuards(InternalTokenGuard)
export class InternalController {
  constructor(
    private readonly students: StudentsService,
    private readonly teachers: TeachersService,
    private readonly managers: ManagersService,
  ) {}

  @Post('students/upsert-by-auth-user')
  async upsertStudents(@Body() body: { items?: unknown[] }): Promise<{ upserted: number }> {
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    if (items.length > MAX_BATCH) {
      throw new BadRequestException(`At most ${MAX_BATCH} items`);
    }
    return this.students.upsertBatchFromInternal(items);
  }

  @Post('teachers/upsert-by-auth-user')
  async upsertTeachers(@Body() body: { items?: unknown[] }): Promise<{ upserted: number }> {
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    if (items.length > MAX_BATCH) {
      throw new BadRequestException(`At most ${MAX_BATCH} items`);
    }
    return this.teachers.upsertBatchFromInternal(items);
  }

  @Post('managers/upsert-by-auth-user')
  async upsertManagers(@Body() body: { items?: unknown[] }): Promise<{ upserted: number }> {
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }
    if (items.length > MAX_BATCH) {
      throw new BadRequestException(`At most ${MAX_BATCH} items`);
    }
    return this.managers.upsertBatchFromInternal(items);
  }
}

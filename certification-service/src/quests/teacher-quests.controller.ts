import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QuestsService } from './quests.service';

@Controller('teacher/courses')
export class TeacherQuestsController {
  constructor(private readonly quests: QuestsService) {}

  @Get(':studentCourseUuid/quests/students/:studentId/:postfix')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('teacher_strict')
  async getCourseQuest(
    @Param('studentCourseUuid') studentCourseUuid: string,
    @Param('studentId') studentId: string,
    @Param('postfix') postfix: string,
  ) {
    const sid = Number(studentId);
    if (!Number.isFinite(sid)) {
      return {};
    }
    return this.quests.getTeacherQuestState({
      studentCourseUuid,
      studentId: sid,
      postfix,
    });
  }
}

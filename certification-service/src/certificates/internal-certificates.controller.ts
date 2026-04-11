import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';
import { CourseCertificatesService } from './course-certificates.service';
import { EducationCertificatesService } from './education-certificates.service';

@Controller('internal')
export class InternalCertificatesController {
  constructor(
    private readonly courseCertificates: CourseCertificatesService,
    private readonly educationCertificates: EducationCertificatesService,
  ) {}

  @Post('course-certificates/generate')
  @UseGuards(InternalApiKeyGuard)
  async generateCourse(
    @Body()
    body: { studentCourseId: number; forceBase: boolean; ownerUserId?: string; certText?: string },
  ) {
    return this.courseCertificates.internalGenerate({
      studentCourseId: body.studentCourseId,
      forceBase: Boolean(body.forceBase),
      ownerUserId: body.ownerUserId,
      certText: body.certText,
    });
  }

  @Post('education-certificates/generate')
  @UseGuards(InternalApiKeyGuard)
  async generateEducation(
    @Body()
    body: {
      studentCourseId: number;
      studentIds?: number[];
      allFinished?: boolean;
      forceBase: boolean;
      sendNotification: boolean;
      ownerUserId?: string;
      certText?: string;
    },
  ) {
    return this.educationCertificates.internalGenerate({
      studentCourseId: body.studentCourseId,
      studentIds: body.studentIds,
      allFinished: body.allFinished,
      forceBase: Boolean(body.forceBase),
      sendNotification: Boolean(body.sendNotification),
      ownerUserId: body.ownerUserId,
      certText: body.certText,
    });
  }
}

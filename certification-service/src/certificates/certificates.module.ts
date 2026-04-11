import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CourseCertificatesController } from './course-certificates.controller';
import { CourseCertificatesService } from './course-certificates.service';
import { EducationCertificatesController } from './education-certificates.controller';
import { EducationCertificatesService } from './education-certificates.service';
import { InternalCertificatesController } from './internal-certificates.controller';
import { ViewTokenService } from './view-token.service';

@Module({
  imports: [AuthModule],
  controllers: [CourseCertificatesController, EducationCertificatesController, InternalCertificatesController],
  providers: [CourseCertificatesService, EducationCertificatesService, ViewTokenService],
})
export class CertificatesModule {}

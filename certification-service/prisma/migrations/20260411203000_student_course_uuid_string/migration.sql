-- Legacy education.StudentCourse PK is UUID; store as string (VARCHAR(36)).
ALTER TABLE "CourseCertificate" ALTER COLUMN "studentCourseId" SET DATA TYPE VARCHAR(36) USING (trim("studentCourseId"::TEXT));

ALTER TABLE "EducationCertificate" ALTER COLUMN "studentCourseId" SET DATA TYPE VARCHAR(36) USING (trim("studentCourseId"::TEXT));

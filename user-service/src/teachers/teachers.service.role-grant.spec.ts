import { PrismaService } from '../prisma/prisma.service';
import { TeacherRoleClientService } from '../auth-client/teacher-role-client.service';
import { TeachersService } from './teachers.service';

/**
 * Portal sync is the only path that creates Teacher rows, so it is also the only place a
 * teacher can be given the `app:speakasap:teacher` role automatically. Without this the
 * role is backfill-only and every newly synced teacher gets a 403 on the teacher portal.
 */
describe('TeachersService.upsertBatchFromInternal role grant', () => {
  let service: TeachersService;
  const prisma = {
    teacher: { upsert: jest.fn() },
    teacherAdditionalLanguage: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const roleClient = { grantTeacherRole: jest.fn() };

  const item = (authUserId: string) => ({ authUserId, position: 'Teacher' });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.teacher.upsert.mockImplementation(async ({ where }: { where: { authUserId: string } }) => ({
      id: 1,
      authUserId: where.authUserId,
    }));
    prisma.teacherAdditionalLanguage.deleteMany.mockResolvedValue({ count: 0 });
    service = new TeachersService(
      prisma as unknown as PrismaService,
      roleClient as unknown as TeacherRoleClientService,
    );
  });

  it('grants the teacher role for every upserted teacher', async () => {
    roleClient.grantTeacherRole.mockResolvedValue({ granted: true });

    const result = await service.upsertBatchFromInternal([item('auth-1'), item('auth-2')]);

    expect(roleClient.grantTeacherRole.mock.calls).toEqual([['auth-1'], ['auth-2']]);
    expect(result).toEqual({ upserted: 2, rolesGranted: 2 });
  });

  it('counts only newly granted roles, not the already-assigned ones', async () => {
    roleClient.grantTeacherRole
      .mockResolvedValueOnce({ granted: true })
      .mockResolvedValueOnce({ granted: false });

    const result = await service.upsertBatchFromInternal([item('auth-1'), item('auth-2')]);

    expect(result).toEqual({ upserted: 2, rolesGranted: 1 });
  });

  /**
   * A failed grant must fail the request. The teacher row is already committed, so a
   * re-run repairs it — but reporting a partial sync as success would leave a teacher
   * locked out of the portal with nothing surfacing the problem.
   */
  it('fails the batch when a grant fails', async () => {
    roleClient.grantTeacherRole
      .mockResolvedValueOnce({ granted: true })
      .mockRejectedValueOnce(new Error('Teacher role grant failed with status 503: upstream'));

    await expect(
      service.upsertBatchFromInternal([item('auth-1'), item('auth-2')]),
    ).rejects.toThrow(/503/);
  });

  it('still upserts the teacher row before the grant is attempted', async () => {
    roleClient.grantTeacherRole.mockRejectedValue(new Error('auth down'));

    await expect(service.upsertBatchFromInternal([item('auth-1')])).rejects.toThrow();
    expect(prisma.teacher.upsert).toHaveBeenCalledTimes(1);
  });
});

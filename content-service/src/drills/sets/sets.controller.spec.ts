import { SetsController } from './sets.controller';

describe('SetsController', () => {
  let controller: SetsController;
  const service = {
    list: jest.fn(),
    getSet: jest.fn(),
    createSet: jest.fn(),
    approveSet: jest.fn(),
    recordRating: jest.fn(),
  } as any;

  const studentReq = (over: { courseKey?: string; lessonOrder?: number }) => ({
    courseKey: over.courseKey,
    lessonOrder: over.lessonOrder,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    service.list.mockResolvedValue({ sets: [], total: 0 });
    controller = new SetsController(service);
  });

  describe('GET /api/v1/drill-sets/available-for-me', () => {
    it('returns only APPROVED sets', async () => {
      await controller.availableForMe(studentReq({ courseKey: 'seven:german:ru', lessonOrder: 4 }));
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ reviewState: 'APPROVED' }),
      );
    });

    it('never returns a set beyond the student current lesson', async () => {
      await controller.availableForMe(studentReq({ courseKey: 'seven:german:ru', lessonOrder: 4 }));
      const arg = service.list.mock.calls[0][0];
      expect(arg.maxLessonOrder).toBe(4);
    });

    it('never returns answers', async () => {
      service.list.mockResolvedValue({ sets: [{ uuid: 's', title: 't' }], total: 1 });
      const res = await controller.availableForMe(studentReq({}));
      expect(JSON.stringify(res)).not.toContain('answer');
    });
  });

  describe('rating', () => {
    it('takes the rater from the caller, never the body', async () => {
      service.recordRating.mockResolvedValue({ uuid: 's-1' });
      await controller.rateSet('s-1', { value: 1, raterId: 999, raterType: 'TEACHER' } as any, {
        raterId: 7,
        raterType: 'STUDENT',
      });
      expect(service.recordRating).toHaveBeenCalledWith('s-1', 'STUDENT', 7, 1, undefined);
    });
  });
});

describe('SetsController replace and update routes', () => {
  const setsService = {
    replaceSetItems: jest.fn(),
    updateSet: jest.fn(),
  } as any;
  const controller = new (require('./sets.controller').SetsController)(setsService);

  beforeEach(() => jest.resetAllMocks());

  const body = {
    positions: [0],
    items: [{ template: 'x', blanks: [], hint: null, topicSlug: 't' }],
    recordRevisionReason: 'REGENERATED',
  };

  it('forwards a replacement to the service', async () => {
    setsService.replaceSetItems.mockResolvedValue({ uuid: 's-1' });

    await controller.replaceSetItems('s-1', body);

    expect(setsService.replaceSetItems).toHaveBeenCalledWith('s-1', body.positions, body.items, {
      recordRevisionReason: 'REGENERATED',
    });
  });

  // An unlabelled revision row tells a teacher a sentence changed but not why, which is
  // most of the value of keeping the history at all.
  it('rejects a replacement with no revision reason', async () => {
    await expect(
      controller.replaceSetItems('s-1', { ...body, recordRevisionReason: undefined }),
    ).rejects.toThrow(/recordRevisionReason/);
    expect(setsService.replaceSetItems).not.toHaveBeenCalled();
  });

  it('rejects a replacement with non-array positions', async () => {
    await expect(
      controller.replaceSetItems('s-1', { ...body, positions: 0 as any }),
    ).rejects.toThrow(/positions/);
  });

  it('forwards a review-state patch to the service', async () => {
    setsService.updateSet.mockResolvedValue({ uuid: 's-1' });

    await controller.updateSet('s-1', { reviewState: 'PENDING_REVIEW' });

    expect(setsService.updateSet).toHaveBeenCalledWith('s-1', { reviewState: 'PENDING_REVIEW' });
  });
});

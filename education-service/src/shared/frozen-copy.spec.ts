import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { refuseFrozenCopyRead } from './frozen-copy';

describe('refuseFrozenCopyRead', () => {
  function silentLogger() {
    const logger = new Logger('test');
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    return logger;
  }

  it('raises rather than returning anything a caller could mistake for data', () => {
    const logger = silentLogger();

    expect(() => refuseFrozenCopyRead(logger, 'Groups', 'list')).toThrow(
      ServiceUnavailableException,
    );
  });

  // The refusal is only useful if it is findable. A silent 503 would leave an unknown
  // consumer just as invisible as the stale rows did.
  it('logs at error level with what was refused', () => {
    const logger = silentLogger();

    expect(() => refuseFrozenCopyRead(logger, 'Groups', 'list')).toThrow();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect((logger.error as jest.Mock).mock.calls[0][0]).toContain('Groups');
    expect((logger.error as jest.Mock).mock.calls[0][0]).toContain('2026-06-26');
  });

  it('carries a machine-readable code so a caller can branch on it', () => {
    const logger = silentLogger();

    try {
      refuseFrozenCopyRead(logger, 'Groups', 'list');
      throw new Error('should have raised');
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'FROZEN_COPY_UNAVAILABLE',
      });
    }
  });
});

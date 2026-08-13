import { AnalysisClient } from './analysis.client';
import * as http from '../orchestration/http';
import * as serviceToken from '../orchestration/service-token';

const request = {
  languageCode: 'en',
  materialLanguage: 'ru',
  level: 'A2',
  allowedTopicSlugs: ['en.other'],
  failures: [
    {
      answer: 'through',
      sentence: 'Walk {{0}} the park.',
      prompt: 'через',
      wrongAttempts: ['across'],
      revealed: false,
      mistakeCount: 1,
    },
  ],
  correlationId: 'cid-1',
};

describe('AnalysisClient', () => {
  const originalUrl = process.env.AI_SERVICE_URL;
  const originalSecret = process.env.AI_SERVICE_JWT_SECRET;

  beforeEach(() => {
    process.env.AI_SERVICE_URL = 'http://ai-microservice:3400';
    process.env.AI_SERVICE_JWT_SECRET = 'test-secret';
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env.AI_SERVICE_URL = originalUrl;
    process.env.AI_SERVICE_JWT_SECRET = originalSecret;
  });

  it('posts to the analyze route', async () => {
    const spy = jest
      .spyOn(http, 'requestUpstream')
      .mockResolvedValue({ clusters: [] } as any);

    await new AnalysisClient().analyze(request);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://ai-microservice:3400/api/teacher-assistant/analyze-drill-errors',
        method: 'POST',
        body: request,
      }),
    );
  });

  it('sends a minted service token, never a caller token', async () => {
    const mint = jest.spyOn(serviceToken, 'mintServiceToken').mockReturnValue('minted');
    const spy = jest
      .spyOn(http, 'requestUpstream')
      .mockResolvedValue({ clusters: [] } as any);

    await new AnalysisClient().analyze(request);

    expect(mint).toHaveBeenCalledWith('education-service', 'test-secret');
    expect(spy.mock.calls[0][0].token).toBe('minted');
  });

  it('propagates an upstream failure rather than returning empty clusters', async () => {
    jest.spyOn(http, 'requestUpstream').mockRejectedValue(new Error('502 Bad Gateway'));

    await expect(new AnalysisClient().analyze(request)).rejects.toThrow('502 Bad Gateway');
  });

  it('raises when AI_SERVICE_URL is unset', async () => {
    delete process.env.AI_SERVICE_URL;

    await expect(new AnalysisClient().analyze(request)).rejects.toThrow(/AI_SERVICE_URL/);
  });
});

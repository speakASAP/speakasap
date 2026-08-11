import { NotificationsTransportService } from './notifications-transport.service';

const PAYLOAD = {
  recipient: 'student@example.com',
  subject: 'Your drill is ready',
  message: '<p>hello</p>',
};

describe('NotificationsTransportService', () => {
  const fetchMock = jest.fn();
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as any;
    process.env.NOTIFICATIONS_MICROSERVICE_URL = 'http://notifications-microservice:3368';
    process.env.NOTIFICATIONS_MS_SERVICE_TOKEN = 'ms-service-token';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // The transport used to read NOTIFICATION_SERVICE_URL, which in this service's own
  // configmap points at ITSELF — so every mail was POSTed to speakasap-notification's
  // non-existent /notifications/send and 404'd. Pin the distinct variable.
  it('posts to notifications-microservice, not to itself', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' });
    process.env.NOTIFICATION_SERVICE_URL = 'http://speakasap-notification:4209';

    await new NotificationsTransportService().sendEmail(PAYLOAD);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('http://notifications-microservice:3368/notifications/send');
  });

  // JwtRolesGuard reads Authorization: Bearer and no x-api-key at all, so the old
  // header authenticated nothing and every delivery 401'd.
  it('authenticates with a bearer service token', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' });

    await new NotificationsTransportService().sendEmail(PAYLOAD);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer ms-service-token');
    expect(init.headers['x-api-key']).toBeUndefined();
  });

  it('fails loudly when the upstream URL is not configured', async () => {
    delete process.env.NOTIFICATIONS_MICROSERVICE_URL;

    await expect(new NotificationsTransportService().sendEmail(PAYLOAD)).rejects.toThrow(
      /NOTIFICATIONS_MICROSERVICE_URL/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails loudly when the service token is not configured', async () => {
    delete process.env.NOTIFICATIONS_MS_SERVICE_TOKEN;

    await expect(new NotificationsTransportService().sendEmail(PAYLOAD)).rejects.toThrow(
      /NOTIFICATIONS_MS_SERVICE_TOKEN/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws rather than reporting success when the upstream rejects', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });

    await expect(new NotificationsTransportService().sendEmail(PAYLOAD)).rejects.toThrow(
      /notifications-microservice returned 401/,
    );
  });
});

import { AiClient } from './ai.client';
import { SERVICE_TOKEN_ISSUER } from './service-token';

const TEACHER_TOKEN = 'teacher-bearer-token-must-not-be-sent';

function stubFetch(status = 200, body: unknown = { items: [], meta: {} }) {
  const f = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  (global as any).fetch = f;
  return f;
}

const headersOf = (f: jest.Mock): Record<string, string> =>
  (f.mock.calls[0][1] as { headers: Record<string, string> }).headers;

const bearerOf = (f: jest.Mock): string => headersOf(f).Authorization.replace('Bearer ', '');

const decode = (token: string): Record<string, unknown> =>
  JSON.parse(
    Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
  );

describe('AiClient', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      AI_SERVICE_URL: 'http://ai-microservice:3380',
      AI_SERVICE_JWT_SECRET: 'test-secret',
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    delete (global as any).fetch;
  });

  // The defect this whole module exists to prevent. Forwarding the teacher's
  // token produced 401 on every generation in production, and it would also send
  // a user credential to a service that has no business holding one.
  it('does NOT send the caller token to ai-microservice', async () => {
    const f = stubFetch();
    await new AiClient().generate({ correlationId: 'c-1' } as never, TEACHER_TOKEN);
    expect(bearerOf(f)).not.toBe(TEACHER_TOKEN);
    expect(JSON.stringify(f.mock.calls[0])).not.toContain(TEACHER_TOKEN);
  });

  it('sends a service JWT ai-microservice will accept', async () => {
    const f = stubFetch();
    await new AiClient().generate({ correlationId: 'c-1' } as never, TEACHER_TOKEN);

    const payload = decode(bearerOf(f));
    expect(payload.iss).toBe(SERVICE_TOKEN_ISSUER);
    expect(payload.serviceId).toBe('education-service');
    expect(bearerOf(f).split('.')).toHaveLength(3);
  });

  it('authenticates validate the same way as generate', async () => {
    const f = stubFetch(200, { results: [], meta: {} });
    await new AiClient().validate({ correlationId: 'c-1' } as never, TEACHER_TOKEN);

    expect(bearerOf(f)).not.toBe(TEACHER_TOKEN);
    expect(decode(bearerOf(f)).serviceId).toBe('education-service');
  });

  it('hits the routes ai-microservice actually exposes', async () => {
    const f = stubFetch();
    await new AiClient().generate({ correlationId: 'c-1' } as never, TEACHER_TOKEN);
    expect(String(f.mock.calls[0][0])).toBe(
      'http://ai-microservice:3380/api/teacher-assistant/generate-drill',
    );
  });

  // A missing secret must fail before the request, naming the secret. Sending an
  // unsigned token instead surfaces as "Invalid signature" from a different
  // service, which points at the wrong system entirely.
  it('fails loudly when the secret is not configured', async () => {
    delete process.env.AI_SERVICE_JWT_SECRET;
    stubFetch();
    await expect(
      new AiClient().generate({ correlationId: 'c-1' } as never, TEACHER_TOKEN),
    ).rejects.toThrow(/AI_SERVICE_JWT_SECRET/);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('mints a fresh token per call rather than reusing one', async () => {
    const f = stubFetch();
    const client = new AiClient();
    await client.generate({ correlationId: 'c-1' } as never, TEACHER_TOKEN);
    const first = bearerOf(f);

    // A new stub so the second call is call index 0 again.
    const g = stubFetch();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10_000);
    await client.generate({ correlationId: 'c-2' } as never, TEACHER_TOKEN);
    jest.restoreAllMocks();

    expect(bearerOf(g)).not.toBe(first);
  });
});

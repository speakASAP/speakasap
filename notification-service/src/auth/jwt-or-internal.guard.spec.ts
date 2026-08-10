import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthClientService } from '../auth-client/auth-client.service';
import { JwtOrInternalGuard } from './jwt-or-internal.guard';

const contextFor = (headers: Record<string, string>): ExecutionContext => {
  const req = { headers, header: (n: string) => headers[n.toLowerCase()] };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
};

describe('JwtOrInternalGuard', () => {
  const authClient = {
    validateAccessToken: jest.fn(),
    attachRequestContext: jest.fn(),
  } as unknown as AuthClientService;
  const guard = new JwtOrInternalGuard(authClient);
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.INTERNAL_API_TOKEN = 'internal-secret';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('admits a service caller presenting the internal token', async () => {
    await expect(
      guard.canActivate(contextFor({ 'x-internal-token': 'internal-secret' })),
    ).resolves.toBe(true);
  });

  it('rejects a wrong internal token', async () => {
    await expect(
      guard.canActivate(contextFor({ 'x-internal-token': 'wrong-but-same-len' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  // The dispatch controller is annotated `@Public()` purely to get past the global
  // APP_GUARD. If this guard delegated to JwtAuthGuard, that decorator would make it
  // return true for a request carrying no credentials at all — an open mail-sending
  // endpoint. This is the regression test for that bypass.
  it('rejects a request with neither credential despite @Public() on the controller', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toThrow(UnauthorizedException);
  });

  it('validates the bearer token when no internal token is present', async () => {
    (authClient.validateAccessToken as jest.Mock).mockResolvedValue({ id: 'u1' });

    await expect(
      guard.canActivate(contextFor({ authorization: 'Bearer jwt-1' })),
    ).resolves.toBe(true);
    expect(authClient.validateAccessToken).toHaveBeenCalledWith('jwt-1');
  });

  it('rejects an invalid bearer token', async () => {
    (authClient.validateAccessToken as jest.Mock).mockRejectedValue(
      new UnauthorizedException('Invalid token'),
    );

    await expect(
      guard.canActivate(contextFor({ authorization: 'Bearer bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('fails closed when INTERNAL_API_TOKEN is not configured', async () => {
    delete process.env.INTERNAL_API_TOKEN;

    await expect(
      guard.canActivate(contextFor({ 'x-internal-token': 'anything' })),
    ).rejects.toThrow(/misconfigured/i);
  });
});

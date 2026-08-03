import { createHmac } from 'crypto';
import { mintServiceToken, SERVICE_TOKEN_ISSUER } from './service-token';

const SECRET = 'test-secret';

/**
 * Decodes without verifying — the point is to assert what we *put in* the token,
 * independently of the verify path.
 */
function decode(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  return JSON.parse(
    Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
  );
}

/**
 * Mirrors ai-microservice's `JwtUtil.verify` exactly (HS256 over `header.payload`,
 * base64url, no padding). If this stops matching, the two services have drifted
 * and every drill generation fails with "Invalid signature" in production.
 */
function verifiesAgainstAiMicroservice(token: string, secret: string): boolean {
  const [header, payload, signature] = token.split('.');
  const expected = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return signature === expected;
}

describe('mintServiceToken', () => {
  it('produces a three-part JWT', () => {
    expect(mintServiceToken('education-service', SECRET).split('.')).toHaveLength(3);
  });

  it('signs with HS256 the way ai-microservice verifies', () => {
    expect(verifiesAgainstAiMicroservice(mintServiceToken('education-service', SECRET), SECRET)).toBe(
      true,
    );
  });

  it('fails verification under a different secret', () => {
    expect(verifiesAgainstAiMicroservice(mintServiceToken('education-service', SECRET), 'other')).toBe(
      false,
    );
  });

  // ai-microservice's verify rejects any issuer but its own. Getting this wrong
  // produces "Invalid issuer", which reads like a config problem rather than a
  // contract mismatch.
  it('uses the issuer ai-microservice requires', () => {
    expect(decode(mintServiceToken('education-service', SECRET)).iss).toBe(SERVICE_TOKEN_ISSUER);
    expect(SERVICE_TOKEN_ISSUER).toBe('ai-microservice');
  });

  it('carries the calling service id', () => {
    expect(decode(mintServiceToken('education-service', SECRET)).serviceId).toBe(
      'education-service',
    );
  });

  it('declares the alg and typ header ai-microservice expects', () => {
    const header = JSON.parse(
      Buffer.from(mintServiceToken('education-service', SECRET).split('.')[0], 'base64').toString(),
    );
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  describe('expiry', () => {
    it('is not already expired', () => {
      const { exp } = decode(mintServiceToken('education-service', SECRET)) as { exp: number };
      expect(exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    // Short-lived on purpose: this token is minted per request, so a long life
    // buys nothing and widens the window if one is ever captured in a log.
    it('expires within the hour', () => {
      const { exp, iat } = decode(mintServiceToken('education-service', SECRET)) as {
        exp: number;
        iat: number;
      };
      expect(exp - iat).toBeLessThanOrEqual(3600);
      expect(exp - iat).toBeGreaterThan(0);
    });

    it('honours an explicit lifetime', () => {
      const { exp, iat } = decode(mintServiceToken('education-service', SECRET, 120)) as {
        exp: number;
        iat: number;
      };
      expect(exp - iat).toBe(120);
    });
  });

  // A missing secret must fail loudly here rather than producing a token signed
  // with "undefined", which ai-microservice would reject with a signature error
  // that says nothing about the real cause.
  it('refuses to sign without a secret', () => {
    expect(() => mintServiceToken('education-service', '')).toThrow(/secret/i);
  });
});

# Track I — SSO Handoff (Wave 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A student clicks a drill link on the legacy portal and lands signed in on the new platform — or gets a clear error, never a guessed identity.

**Services:** `speakasap/frontend` + `speakasap-portal` · **Depends on:** Track H · **Blocks:** Track J

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contract C9), spec §12.

**You own:** `frontend/app/auth/handoff/**`, `frontend/lib/drills/sso/**`, `speakasap-portal/portal/platform_sso.py`.

**The rule this track exists to enforce — read it twice.** Three outcomes, kept distinct:

| Resolution result | Action |
|---|---|
| Mapping found | Issue the session |
| `404` / no mapping | Provision from the token's signed claims, then issue the session |
| Timeout / `5xx` / transport failure | **No session, no provisioning.** Retryable error. |

Marathon fails soft to the raw numeric `sub` here (`marathon/src/shared/auth-client.ts:110`). We do not. Provisioning blind during an outage can create a duplicate user for someone already mapped, and an unverified identity would own graded work.

---

### Task I.1: Portal token issuer

**Files:**
- Create: `speakasap-portal/portal/platform_sso.py`
- Test: `speakasap-portal/portal/tests/test_platform_sso.py`

**Interfaces:**
- Produces: `get_platform_bearer_token(user, audience, expiry_seconds=300) -> str | None`

The existing `marathon/jwt_for_marathon.py` is the model. This generalizes it
with an `audience` and adds the identity claims the platform needs to provision.

- [ ] **Step 1: Write the failing test**

```python
import jwt
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from portal.platform_sso import get_platform_bearer_token

SECRET = 'test-secret-value'

@override_settings(SPEAKASAP_PLATFORM_JWT_SECRET=SECRET)
class PlatformSsoTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(
            username='s1', email='Student@Example.COM',
            first_name='Anna', last_name='B')

    def test_token_carries_legacy_id_as_sub(self):
        token = get_platform_bearer_token(self.user, 'speakasap-platform')
        payload = jwt.decode(token, SECRET, algorithms=['HS256'],
                             audience='speakasap-platform')
        self.assertEqual(payload['sub'], str(self.user.id))

    def test_token_carries_identity_claims_for_provisioning(self):
        token = get_platform_bearer_token(self.user, 'speakasap-platform')
        payload = jwt.decode(token, SECRET, algorithms=['HS256'],
                             audience='speakasap-platform')
        self.assertEqual(payload['email'], 'Student@Example.COM')
        self.assertEqual(payload['first_name'], 'Anna')

    def test_token_has_an_audience(self):
        token = get_platform_bearer_token(self.user, 'speakasap-platform')
        payload = jwt.decode(token, SECRET, algorithms=['HS256'],
                             audience='speakasap-platform')
        self.assertEqual(payload['aud'], 'speakasap-platform')

    def test_token_expires_in_five_minutes_by_default(self):
        token = get_platform_bearer_token(self.user, 'speakasap-platform')
        payload = jwt.decode(token, SECRET, algorithms=['HS256'],
                             audience='speakasap-platform')
        self.assertEqual(payload['exp'] - payload['iat'], 300)

    def test_returns_none_without_a_secret(self):
        with override_settings(SPEAKASAP_PLATFORM_JWT_SECRET=''):
            self.assertIsNone(get_platform_bearer_token(self.user, 'speakasap-platform'))

    def test_returns_none_for_a_user_without_an_email(self):
        self.user.email = ''
        self.user.save()
        self.assertIsNone(get_platform_bearer_token(self.user, 'speakasap-platform'))
```

The last test matters: a token without an email cannot provision, so issuing one
only defers the failure to a worse place.

- [ ] **Step 2: Run, confirm failure**

```bash
ssh speakasap 'cd speakasap-portal && python manage.py test portal.tests.test_platform_sso'
```

`ssh speakasap` is **read only** for mutating operations. Running the test suite
is a read; do not write files, restart services, or deploy over ssh. If the test
cannot be run remotely, say so in the status file and have the orchestrator run
it during Track K rather than skipping it.

- [ ] **Step 3: Implement**

Mirror `marathon/jwt_for_marathon.py` exactly for the PyJWT-version handling
(it returns bytes on some versions, str on others — the existing helper already
handles this; copy that logic, do not improve it). Add `aud`, `email`,
`first_name`, `last_name`. Return `None` when the secret is missing or the user
has no email, and log at debug — never log the token.

- [ ] **Step 4: Run, confirm PASS. Commit**

```bash
cd /home/ssf/Documents/Github/speakasap-portal
rtk git add portal/platform_sso.py portal/tests/test_platform_sso.py
rtk git commit -m "feat(portal): platform SSO token issuer

Generalizes the marathon helper with an audience and the identity claims
the platform needs to provision a missing mapping.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task I.2: Platform-side resolution

**Files:**
- Create: `frontend/lib/drills/sso/resolve.ts`
- Test: `frontend/lib/drills/sso/resolve.test.ts`

**Interfaces:**
- Produces: `resolveSsoToken(token: string): Promise<{ authUserId: string } | { error: SsoError }>` where `SsoError` is `'INVALID_TOKEN' | 'EXPIRED' | 'WRONG_AUDIENCE' | 'IDENTITY_UNRESOLVED'`

- [ ] **Step 1: Write the failing test — every path separately**

```ts
describe('resolveSsoToken', () => {
  it('returns the auth user when the mapping exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ authUserId: 'u-1', provisioned: false }),
    }));
    await expect(resolveSsoToken(validToken())).resolves.toEqual({ authUserId: 'u-1' });
  });

  it('provisions and returns the auth user when no mapping exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ authUserId: 'u-new', provisioned: true }),
    }));
    await expect(resolveSsoToken(validToken())).resolves.toEqual({ authUserId: 'u-new' });
  });

  it('FAILS CLOSED on a 500 — no session, no provisioning', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    vi.stubGlobal('fetch', f);
    await expect(resolveSsoToken(validToken()))
      .resolves.toEqual({ error: 'IDENTITY_UNRESOLVED' });
  });

  it('FAILS CLOSED on a network timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));
    await expect(resolveSsoToken(validToken()))
      .resolves.toEqual({ error: 'IDENTITY_UNRESOLVED' });
  });

  it('NEVER falls back to the raw numeric sub', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ETIMEDOUT')));
    const r = await resolveSsoToken(validToken({ sub: '310740' }));
    expect(JSON.stringify(r)).not.toContain('310740');
  });

  it('rejects an expired token without calling auth at all', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(resolveSsoToken(expiredToken())).resolves.toEqual({ error: 'EXPIRED' });
    expect(f).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', async () => {
    await expect(resolveSsoToken(tokenSignedWith('other-secret')))
      .resolves.toEqual({ error: 'INVALID_TOKEN' });
  });

  it('rejects a token for a different audience', async () => {
    await expect(resolveSsoToken(validToken({ aud: 'marathon' })))
      .resolves.toEqual({ error: 'WRONG_AUDIENCE' });
  });

  it('rejects a token with the alg set to none', async () => {
    await expect(resolveSsoToken(algNoneToken())).resolves.toEqual({ error: 'INVALID_TOKEN' });
  });
});
```

Tests 3, 4 and 5 are the fail-closed rule. Test 9 guards against the classic JWT
`alg: none` bypass — verify with an explicit `algorithms: ['HS256']` allowlist.

- [ ] **Step 2: Run, confirm failure. Implement**

- [ ] **Step 3: Run, confirm PASS (9 passed)**

- [ ] **Step 4: Prove the fail-closed rule**

Temporarily add a fallback returning `{ authUserId: payload.sub }` in the catch
block. Tests 3, 4 and 5 must fail. Remove it.

- [ ] **Step 5: Commit**

---

### Task I.3: The handoff route

**Files:**
- Create: `frontend/app/auth/handoff/page.tsx`
- Test: `frontend/app/auth/handoff/handoff.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
describe('/auth/handoff', () => {
  it('stores the session and redirects to nextPath on success', async () => {
    vi.spyOn(sso, 'resolveSsoToken').mockResolvedValue({ authUserId: 'u-1' });
    render(<HandoffPage searchParams={{ sso: 't', next: '/learner/practice/a-1' }} />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/learner/practice/a-1'));
  });

  it('rejects an absolute nextPath to another host', async () => {
    vi.spyOn(sso, 'resolveSsoToken').mockResolvedValue({ authUserId: 'u-1' });
    render(<HandoffPage searchParams={{ sso: 't', next: 'https://evil.example/x' }} />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));
  });

  it('shows a retryable message on IDENTITY_UNRESOLVED and does not sign in', async () => {
    vi.spyOn(sso, 'resolveSsoToken').mockResolvedValue({ error: 'IDENTITY_UNRESOLVED' });
    render(<HandoffPage searchParams={{ sso: 't', next: '/' }} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/try again/i));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows a distinct message for an expired link', async () => {
    vi.spyOn(sso, 'resolveSsoToken').mockResolvedValue({ error: 'EXPIRED' });
    render(<HandoffPage searchParams={{ sso: 't', next: '/' }} />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/expired/i));
  });

  it('never puts the token in the URL after handling it', async () => {
    vi.spyOn(sso, 'resolveSsoToken').mockResolvedValue({ authUserId: 'u-1' });
    render(<HandoffPage searchParams={{ sso: 'secret-token', next: '/' }} />);
    await waitFor(() => expect(window.location.search).not.toContain('secret-token'));
  });
});
```

Test 2 is an open-redirect guard: only same-origin, path-only `next` values are
honoured. Test 5 keeps the token out of history and referrers.

- [ ] **Step 2: Implement, run, confirm PASS**

Reuse the existing session storage from `frontend/lib/auth-session.ts`
(`consumeHostedAuthFragment` lives there) rather than inventing a second
mechanism.

- [ ] **Step 3: Typecheck, full suite, commit**

```bash
cd /home/ssf/Documents/Github/speakasap/frontend
rtk npm test && rtk npm run typecheck
rtk git add app/auth/handoff lib/drills/sso
rtk git commit -m "feat(frontend): legacy SSO handoff, fail closed

Marathon falls soft to the raw numeric sub on a lookup failure; drilling
does not. Verified by adding that fallback and watching three tests fail.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track I completion checklist

- [ ] Frontend suite green, typecheck clean
- [ ] Portal tests run (or explicitly deferred to Track K, with the reason recorded)
- [ ] Fail-closed falsification performed
- [ ] `alg: none` and open-redirect tests passing
- [ ] Status file at `status/track-i.md`

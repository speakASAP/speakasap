# Track H — Legacy Identity Resolution (Wave 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One endpoint that turns a legacy portal user id into a platform user, provisioning the link when it is missing and failing closed when it cannot tell.

**Service:** `auth-microservice` · **Depends on:** Track 0 · **Blocks:** Track I

**Read first:** [`00-MASTER.md`](00-MASTER.md) (contract C9), spec §12.

**You own:** `auth-microservice/src/users/internal-users.controller.ts`, `src/users/users.service.ts`. Nothing else.

**Context you must not re-derive:**
- `LegacyIdentityMapping` already exists (`src/users/entities/legacy-identity-mapping.entity.ts`), unique on `(legacySystem, legacyUserId)`, with a `status` enum including `MAPPED` and `CREATED`.
- A read path already exists: `findLegacyMapping` (`src/users/users.service.ts:56`) behind `GET /internal/users/by-legacy-id` (`internal-users.controller.ts:10`), guarded by `InternalServiceGuard`.
- **214,232 `speakasap-portal` rows already exist, every one with an `authUserId`** (measured 2026-07-29). Provisioning is a rarely-taken fallback, not the main path.
- auth-microservice already has jest. No test setup needed.

---

### Task H.1: `resolveOrProvisionLegacyUser` in UsersService

**Files:**
- Modify: `auth-microservice/src/users/users.service.ts`
- Test: `auth-microservice/src/users/users.service.legacy.spec.ts` (create)

**Interfaces:**
- Consumes: `LegacyIdentityMapping` repository, `User` repository, existing `findByEmail` and `normalizeEmail`
- Produces:
  ```ts
  resolveOrProvisionLegacyUser(input: {
    legacySystem: string; legacyUserId: number;
    email: string; firstName?: string; lastName?: string;
  }): Promise<{ authUserId: string; provisioned: boolean }>
  ```

- [ ] **Step 1: Write the failing test**

Create `auth-microservice/src/users/users.service.legacy.spec.ts`:

```ts
import { UsersService } from './users.service';
import { LegacyIdentityMappingStatus } from './entities/legacy-identity-mapping.entity';

function makeService(overrides: {
  mappingFindOne?: jest.Mock; mappingSave?: jest.Mock;
  userFindByEmail?: jest.Mock; userSave?: jest.Mock;
}) {
  const mappingRepo = {
    findOne: overrides.mappingFindOne ?? jest.fn().mockResolvedValue(null),
    save: overrides.mappingSave ?? jest.fn(async (x) => x),
    create: jest.fn((x) => x),
  };
  const userRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: () => ({ getOne: overrides.userFindByEmail ?? jest.fn().mockResolvedValue(null) }),
    })),
    save: overrides.userSave ?? jest.fn(async (x) => ({ ...x, id: 'new-uuid' })),
    create: jest.fn((x) => x),
  };
  return {
    service: new UsersService(userRepo as any, {} as any, {} as any, mappingRepo as any),
    mappingRepo, userRepo,
  };
}

describe('resolveOrProvisionLegacyUser', () => {
  const input = {
    legacySystem: 'speakasap-portal', legacyUserId: 310740,
    email: 'Student@Example.COM', firstName: 'A', lastName: 'B',
  };

  it('returns the existing mapping without writing anything', async () => {
    const mappingSave = jest.fn();
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue({ authUserId: 'existing-uuid' }),
      mappingSave,
    });
    const result = await service.resolveOrProvisionLegacyUser(input);
    expect(result).toEqual({ authUserId: 'existing-uuid', provisioned: false });
    expect(mappingSave).not.toHaveBeenCalled();
  });

  it('links an existing auth user found by normalized email, without creating a user', async () => {
    const userSave = jest.fn();
    const mappingSave = jest.fn(async (x) => x);
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue(null),
      userFindByEmail: jest.fn().mockResolvedValue({ id: 'found-uuid' }),
      userSave, mappingSave,
    });
    const result = await service.resolveOrProvisionLegacyUser(input);
    expect(result).toEqual({ authUserId: 'found-uuid', provisioned: true });
    expect(userSave).not.toHaveBeenCalled();
    expect(mappingSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: LegacyIdentityMappingStatus.MAPPED }),
    );
  });

  it('creates a user when no email match exists, and records status CREATED', async () => {
    const mappingSave = jest.fn(async (x) => x);
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue(null),
      userFindByEmail: jest.fn().mockResolvedValue(null),
      mappingSave,
    });
    const result = await service.resolveOrProvisionLegacyUser(input);
    expect(result).toEqual({ authUserId: 'new-uuid', provisioned: true });
    expect(mappingSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: LegacyIdentityMappingStatus.CREATED }),
    );
  });

  it('normalizes the email before matching and storing', async () => {
    const mappingSave = jest.fn(async (x) => x);
    const { service } = makeService({
      mappingFindOne: jest.fn().mockResolvedValue(null),
      userFindByEmail: jest.fn().mockResolvedValue(null),
      mappingSave,
    });
    await service.resolveOrProvisionLegacyUser(input);
    expect(mappingSave).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedEmail: 'student@example.com' }),
    );
  });

  it('is idempotent: a second call after provisioning finds the mapping', async () => {
    const findOne = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ authUserId: 'new-uuid' });
    const { service } = makeService({
      mappingFindOne: findOne,
      userFindByEmail: jest.fn().mockResolvedValue(null),
    });
    const first = await service.resolveOrProvisionLegacyUser(input);
    const second = await service.resolveOrProvisionLegacyUser(input);
    expect(first.provisioned).toBe(true);
    expect(second).toEqual({ authUserId: 'new-uuid', provisioned: false });
  });

  it('rejects a blank email rather than creating an unusable user', async () => {
    const { service } = makeService({ mappingFindOne: jest.fn().mockResolvedValue(null) });
    await expect(
      service.resolveOrProvisionLegacyUser({ ...input, email: '   ' }),
    ).rejects.toThrow(/email/i);
  });
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
rtk npm --prefix /home/ssf/Documents/Github/auth-microservice test -- users.service.legacy
```

- [ ] **Step 3: Implement**

Add to `UsersService`. Read the surrounding code first and match its style —
this file already has `normalizeEmail` and `findByEmail`; reuse them rather than
writing new normalization.

```ts
async resolveOrProvisionLegacyUser(input: {
  legacySystem: string;
  legacyUserId: number;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ authUserId: string; provisioned: boolean }> {
  const existing = await this.legacyIdentityMappingRepository.findOne({
    where: { legacySystem: input.legacySystem, legacyUserId: input.legacyUserId },
  });
  if (existing?.authUserId) {
    return { authUserId: existing.authUserId, provisioned: false };
  }

  const normalizedEmail = this.normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new BadRequestException('A non-blank email is required to provision a legacy user');
  }

  const matched = await this.findByEmail(normalizedEmail);
  let authUserId: string;
  let status: LegacyIdentityMappingStatus;

  if (matched) {
    authUserId = matched.id;
    status = LegacyIdentityMappingStatus.MAPPED;
  } else {
    const created = await this.userRepository.save(
      this.userRepository.create({
        email: normalizedEmail,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      }),
    );
    authUserId = created.id;
    status = LegacyIdentityMappingStatus.CREATED;
  }

  await this.legacyIdentityMappingRepository.save(
    this.legacyIdentityMappingRepository.create({
      legacySystem: input.legacySystem,
      legacyUserId: input.legacyUserId,
      authUserId,
      normalizedEmail,
      status,
      reason: 'provisioned via drilling SSO handoff',
    }),
  );

  return { authUserId, provisioned: true };
}
```

- [ ] **Step 4: Run, confirm PASS (6 passed)**

- [ ] **Step 5: Commit**

```bash
cd /home/ssf/Documents/Github/auth-microservice
rtk git add src/users/users.service.ts src/users/users.service.legacy.spec.ts
rtk git commit -m "feat(auth): resolve or provision a legacy portal identity

Idempotent on (legacySystem, legacyUserId). Prefers an existing mapping,
then an email match, and only then creates a user. Blank emails are
rejected rather than producing an unusable account.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task H.2: The internal endpoint

**Files:**
- Modify: `auth-microservice/src/users/internal-users.controller.ts`
- Test: `auth-microservice/src/users/internal-users.controller.spec.ts` (extend the existing file)

**Interfaces:**
- Produces: `POST /internal/users/resolve-or-provision-legacy` returning `ResolveLegacyUserResponse`

- [ ] **Step 1: Extend the existing spec**

The file already exists and mocks `findLegacyMapping`. Add:

```ts
describe('resolveOrProvisionLegacy', () => {
  it('delegates to the service and returns the mapping', async () => {
    usersService.resolveOrProvisionLegacyUser.mockResolvedValue({
      authUserId: 'u-1', provisioned: false,
    });
    const res = await controller.resolveOrProvisionLegacy({
      system: 'speakasap-portal', legacyUserId: 310740, email: 'a@b.com',
    } as any);
    expect(res).toEqual({ authUserId: 'u-1', provisioned: false });
  });

  it('rejects a non-numeric legacyUserId', async () => {
    await expect(controller.resolveOrProvisionLegacy({
      system: 'speakasap-portal', legacyUserId: 'abc' as any, email: 'a@b.com',
    } as any)).rejects.toThrow(/legacyUserId/);
  });

  it('rejects a missing system', async () => {
    await expect(controller.resolveOrProvisionLegacy({
      system: '', legacyUserId: 1, email: 'a@b.com',
    } as any)).rejects.toThrow(/system/);
  });
});
```

Add `resolveOrProvisionLegacyUser: jest.fn()` to the existing `usersService`
mock object at the top of the file.

- [ ] **Step 2: Run, confirm failure. Implement**

```ts
@Post('resolve-or-provision-legacy')
async resolveOrProvisionLegacy(@Body() body: ResolveLegacyUserRequest) {
  const numericId = Number(body?.legacyUserId);
  if (!body?.system) {
    throw new BadRequestException('system is required');
  }
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new BadRequestException('numeric legacyUserId is required');
  }
  return this.usersService.resolveOrProvisionLegacyUser({
    legacySystem: body.system,
    legacyUserId: numericId,
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
  });
}
```

The controller inherits `@UseGuards(InternalServiceGuard)` from the class
decorator. Confirm that by reading the top of the file — do not add a second
guard.

- [ ] **Step 3: Run, confirm PASS. Typecheck and commit**

```bash
rtk npm test -- internal-users && rtk npm run typecheck
rtk git add src/users/internal-users.controller.ts src/users/internal-users.controller.spec.ts
rtk git commit -m "feat(auth): POST /internal/users/resolve-or-provision-legacy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task H.3: Mapping coverage audit

This is the spec's named risk. It is a measurement, not a code change.

**Files:**
- Create: `auth-microservice/scripts/audit-legacy-mapping-coverage.sql`

- [ ] **Step 1: Write the query**

```sql
-- Coverage of speakasap-portal legacy users in legacy_identity_mappings.
-- Run read-only. Answers: is provisioning a fallback, or the main path?
SELECT
  status,
  COUNT(*)                                        AS rows,
  COUNT("authUserId")                             AS with_auth_user,
  COUNT(*) - COUNT("authUserId")                  AS missing_auth_user
FROM legacy_identity_mappings
WHERE "legacySystem" = 'speakasap-portal'
GROUP BY status
ORDER BY rows DESC;
```

- [ ] **Step 2: Run it via the postgres MCP server**

Use `postgres_query` against database `auth`, `readOnly: true`. Do not use psql
on the host and do not construct a DATABASE_URL.

- [ ] **Step 3: Record the result in the status file**

State plainly whether any row has a null `authUserId`. Baseline measured
2026-07-29 was 214,034 `created` / 192 `created_duplicate_email` / 6 `mapped`,
all with an `authUserId` and zero `skipped` rows. A material change from that
baseline is worth reporting to the orchestrator before Track I ships.

**Out of scope, deliberately:** comparing against the *live legacy portal user
table* would need a connection to the speakasap server, which is read-only and
not reachable from this service. If that comparison is wanted, it is an
orchestrator task in Track K, not this one.

- [ ] **Step 4: Commit**

```bash
rtk git add scripts/audit-legacy-mapping-coverage.sql
rtk git commit -m "chore(auth): legacy mapping coverage audit query

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Track H completion checklist

- [ ] `rtk npm test -- users.service.legacy internal-users` green
- [ ] `rtk npm run typecheck` clean
- [ ] Coverage audit run and its output pasted into the status file
- [ ] Status file at `status/track-h.md`

**Hand off to Track I.** It calls `POST /internal/users/resolve-or-provision-legacy`
and must distinguish a `404`/absent mapping (provision) from a transport failure
(fail closed) — that distinction lives on the *caller* side, in Track I, not here.

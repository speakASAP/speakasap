import { beforeEach, describe, expect, it } from "vitest";
import { getAuthSession, getSpeakasapRole, saveAuthSession } from "./auth-session";

function makeToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(payload)}.signature`;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("getSpeakasapRole", () => {
  it("returns admin when roles include app:speakasap:admin", () => {
    const token = makeToken({ roles: ["app:speakasap:admin", "app:speakasap:user"] });
    expect(getSpeakasapRole(token)).toBe("admin");
  });

  it("returns user when roles include app:speakasap:user but not admin", () => {
    const token = makeToken({ roles: ["app:marathon:user", "app:speakasap:user"] });
    expect(getSpeakasapRole(token)).toBe("user");
  });

  it("returns null when roles has no speakasap entries", () => {
    const token = makeToken({ roles: ["app:marathon:admin"] });
    expect(getSpeakasapRole(token)).toBeNull();
  });

  it("returns null for a malformed token instead of throwing", () => {
    expect(getSpeakasapRole("not-a-jwt")).toBeNull();
  });

  it("returns null when payload has no roles array", () => {
    const token = makeToken({ sub: "user-1" });
    expect(getSpeakasapRole(token)).toBeNull();
  });
});

describe("getAuthSession + getSpeakasapRole integration", () => {
  it("resolves role from the session stored in localStorage", () => {
    const token = makeToken({ roles: ["app:speakasap:admin"] });
    saveAuthSession({ accessToken: token });
    const session = getAuthSession();
    expect(session).not.toBeNull();
    expect(getSpeakasapRole(session!.accessToken)).toBe("admin");
  });
});

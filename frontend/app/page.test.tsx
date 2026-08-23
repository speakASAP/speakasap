import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

import Home from "./page";
import { saveAuthSession } from "@/lib/auth-session";

function makeToken(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(payload)}.signature`;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("Home auto-redirect by role", () => {
  it("redirects an admin session straight to /admin", async () => {
    saveAuthSession({ accessToken: makeToken({ roles: ["app:speakasap:admin"] }) });

    render(<Home />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/admin"));
  });

  it("redirects a non-admin speakasap session to /learner", async () => {
    saveAuthSession({ accessToken: makeToken({ roles: ["app:speakasap:user"] }) });

    render(<Home />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/learner"));
  });

  it("does not redirect and shows the sign-in scaffold when there is no session", async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByRole("button", { name: /sign in with alfares auth/i })).toBeInTheDocument());
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does not redirect when the stored token has no speakasap role", async () => {
    saveAuthSession({ accessToken: makeToken({ roles: ["app:marathon:admin"] }) });

    render(<Home />);

    await waitFor(() => expect(screen.getByRole("button", { name: /sign in with alfares auth/i })).toBeInTheDocument());
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

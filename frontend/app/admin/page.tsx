"use client";

import { useEffect, useState } from "react";
import { callGateway } from "@/lib/api-client";
import { buildHostedAuthLoginUrl, clearAuthSession, getAuthSession } from "@/lib/auth-session";

const adminActions = [
  { label: "Assessment catalog", path: "/api/v1/admin/language-tests" },
  { label: "Notification templates", path: "/api/v1/templates" },
  { label: "Orders", path: "/api/v1/orders" },
  { label: "Financial dashboard", path: "/api/v1/dashboard/overview" },
];

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [result, setResult] = useState<string>("No request executed yet.");

  useEffect(() => {
    setToken(getAuthSession()?.accessToken ?? null);
  }, []);

  function login(): void {
    window.location.assign(buildHostedAuthLoginUrl(window.location.pathname + window.location.search));
  }

  function logout(): void {
    clearAuthSession();
    setToken(null);
    setResult("Signed out locally.");
  }

  async function run(path: string): Promise<void> {
    if (!token) {
      login();
      return;
    }
    // `keepUnauthorized` because this page exists to show what a gateway route answered.
    // Redirecting on 401 would navigate away from the very answer the operator opened the
    // console to read — so the 401 is reported here, and signing in again is their choice
    // via the button above.
    const response = await callGateway({ path, token, keepUnauthorized: true });
    if (response.status === 401 || response.status === 403) {
      clearAuthSession();
      setToken(null);
    }
    setResult(JSON.stringify({ path, status: response.status, ok: response.ok, data: response.data }, null, 2));
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Admin Portal</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Initial TASK-71 flows mapped to gateway routes for admin use-cases.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-zinc-600 dark:text-zinc-300">
          Auth session: {token ? "connected through hosted Auth" : "not connected"}
        </span>
        <button onClick={login} className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
          Sign in
        </button>
        {token ? (
          <button onClick={logout} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700">
            Clear session
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {adminActions.map((action) => (
          <button
            key={action.path}
            onClick={() => run(action.path)}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {action.label}
          </button>
        ))}
      </div>
      <pre className="mt-6 overflow-auto rounded-xl border bg-zinc-50 p-4 text-xs dark:bg-zinc-950">{result}</pre>
    </main>
  );
}

"use client";

import type { MouseEvent } from "react";
import { buildHostedAuthLoginUrl } from "@/lib/auth-session";

export function HostedAuthLink({ returnPath = "/" }: { returnPath?: string }) {
  function login(event: MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    window.location.assign(buildHostedAuthLoginUrl(returnPath));
  }

  return (
    <a
      className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      href="/auth/callback"
      onClick={login}
    >
      Sign in with Alfares Auth
    </a>
  );
}

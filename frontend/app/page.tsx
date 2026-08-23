"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HostedAuthButton } from "@/app/components/hosted-auth-button";
import { getGatewayBaseUrl } from "@/lib/gateway";
import { HostedAuthLink } from "@/app/components/hosted-auth-link";
import { getAuthSession, getSpeakasapRole } from "@/lib/auth-session";

const ROLE_PORTAL: Record<"admin" | "user", string> = {
  admin: "/admin",
  user: "/learner",
};

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // React 18+ mounts effects twice in development; the redirect must not fire twice.
    if (started.current) {
      return;
    }
    started.current = true;

    const session = getAuthSession();
    const role = session ? getSpeakasapRole(session.accessToken) : null;
    if (role) {
      router.replace(ROLE_PORTAL[role]);
      return;
    }
    setChecked(true);
  }, [router]);

  const gatewayBaseUrl = getGatewayBaseUrl();

  if (!checked) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <main className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-950">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          SpeakASAP Frontend Scaffold
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Frontend calls must go through the API gateway only.
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Active gateway base URL: <code>{gatewayBaseUrl ?? "NOT_CONFIGURED"}</code>
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-4">
          <HostedAuthLink returnPath="/" />
          <Link className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/learner">
            Learner portal shell
          </Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/teacher">
            Teacher portal shell
          </Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin">
            Admin portal shell
          </Link>
        </div>
        <div className="mt-4">
          <HostedAuthButton className="inline-flex rounded-xl bg-zinc-950 px-4 py-3 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
            Sign in with Alfares Auth
          </HostedAuthButton>
        </div>
      </main>
    </div>
  );
}

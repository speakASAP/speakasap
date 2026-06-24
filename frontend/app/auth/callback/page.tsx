"use client";

import { useEffect, useState } from "react";
import { consumeHostedAuthFragment } from "@/lib/auth-session";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const result = consumeHostedAuthFragment(window.location);
    if (!result.stored) {
      setMessage("Sign in could not be completed. Please start again.");
      return;
    }
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.location.replace(result.nextPath || "/");
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 text-center">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
    </main>
  );
}

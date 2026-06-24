"use client";

import { buildHostedAuthLoginUrl } from "@/lib/auth-session";

type HostedAuthButtonProps = {
  returnPath?: string;
  children?: React.ReactNode;
  className?: string;
};

export function HostedAuthButton({ returnPath = "/", children = "Sign in", className }: HostedAuthButtonProps) {
  function login(): void {
    window.location.assign(buildHostedAuthLoginUrl(returnPath));
  }

  return (
    <button type="button" onClick={login} className={className}>
      {children}
    </button>
  );
}

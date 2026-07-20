"use client";

/**
 * Marketing opt-in control.
 *
 * The checkbox never shows a state the server did not accept: every change is
 * written first and the UI is reconciled from the response, so a failed request
 * leaves the user looking at the truth rather than at their intent.
 */

import { useCallback, useEffect, useState } from "react";
import { getAuthBaseUrl, getAuthSession } from "../../lib/auth-session";
import { MARKETING_CONSENT_VERSION } from "../legal/privacy-policy/consent-version";

const PRODUCT = "speakasap";

type ConsentState = {
  granted: boolean;
  version: string | null;
};

export default function MarketingConsent() {
  const [state, setState] = useState<ConsentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const session = getAuthSession();
    if (!session) {
      throw new Error("not_signed_in");
    }
    const response = await fetch(`${getAuthBaseUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`request_failed_${response.status}`);
    }
    return response;
  }, []);

  const load = useCallback(async () => {
    const response = await request("/auth/marketing-consents");
    const body = await response.json();
    setState({
      granted: Boolean(body?.consents?.[PRODUCT]),
      version: body?.versions?.[PRODUCT] ?? null,
    });
  }, [request]);

  useEffect(() => {
    load().catch(() => setError("We could not load your e-mail preferences."));
  }, [load]);

  const grant = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await request("/auth/marketing-consents", {
        method: "POST",
        body: JSON.stringify({
          product: PRODUCT,
          documentVersion: MARKETING_CONSENT_VERSION,
        }),
      });
      await load();
    } catch {
      setError("We could not save that. Your preference is unchanged.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, [request, load]);

  const revoke = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await request(`/auth/marketing-consents/${PRODUCT}`, { method: "DELETE" });
      await load();
    } catch {
      setError("We could not save that. Your preference is unchanged.");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }, [request, load]);

  if (!state) {
    return <p>Loading your e-mail preferences…</p>;
  }

  // Consent given under older wording stays valid, so the box stays ticked —
  // but we ask again rather than quietly relying on the earlier text.
  const needsReconfirm = state.granted && state.version !== MARKETING_CONSENT_VERSION;

  return (
    <section>
      <label>
        <input
          type="checkbox"
          checked={state.granted}
          disabled={busy}
          onChange={(event) => (event.target.checked ? grant() : revoke())}
        />{" "}
        Send me occasional e-mail about new courses and offers. You can withdraw at any time.
      </label>

      {needsReconfirm ? (
        <p>
          Our marketing wording changed since you agreed. Please confirm you still want these
          e-mails.{" "}
          <button type="button" onClick={grant} disabled={busy}>
            Confirm
          </button>
        </p>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}

      <p>
        We only e-mail marketing with your consent, and every message carries an unsubscribe link.
        See our <a href="/legal/privacy-policy">privacy policy</a>.
      </p>
    </section>
  );
}

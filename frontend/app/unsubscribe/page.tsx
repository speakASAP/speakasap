"use client";

/**
 * Public unsubscribe landing page.
 *
 * Deliberately requires no sign-in: GDPR requires withdrawal to be as easy as
 * giving consent, and demanding a login from an e-mail link fails that test.
 */

import { useEffect, useState } from "react";
import { getAuthBaseUrl } from "../../lib/auth-session";

type Status = "working" | "done" | "invalid" | "error";

export default function UnsubscribePage() {
  const [status, setStatus] = useState<Status>("working");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("invalid");
      return;
    }

    fetch(`${getAuthBaseUrl()}/auth/marketing-consents/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => {
        if (response.ok) {
          setStatus("done");
        } else if (response.status === 400) {
          setStatus("invalid");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "working") {
    return (
      <main>
        <h1>Unsubscribing…</h1>
      </main>
    );
  }

  if (status === "done") {
    return (
      <main>
        <h1>You have been unsubscribed</h1>
        <p>
          We will no longer send you marketing e-mail about SpeakASAP courses. You will still
          receive messages about things you have signed up for, such as your lessons and payments.
        </p>
        <p>
          Changed your mind? You can opt back in from{" "}
          <a href="/account/marketing-consent">your e-mail preferences</a>.
        </p>
      </main>
    );
  }

  // An expired or malformed link must still lead somewhere useful, not a dead end.
  return (
    <main>
      <h1>This unsubscribe link did not work</h1>
      <p>
        {status === "invalid"
          ? "The link is invalid or has expired."
          : "Something went wrong on our side."}
      </p>
      <p>
        You can still turn marketing e-mail off from{" "}
        <a href="/account/marketing-consent">your e-mail preferences</a> after signing in.
      </p>
    </main>
  );
}

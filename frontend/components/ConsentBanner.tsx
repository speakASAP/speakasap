'use client';

import { useEffect } from 'react';
// Vendored from shared/packages/consent — refresh with shared/scripts/sync-consent.sh.
import { mountConsentBanner } from '@/lib/consent/consent-banner.js';

/** Bump when the wording changes; visitors are then asked again. */
const CONSENT_VERSION = 'alfares-consent-v1';

/**
 * Declares strictly necessary storage only — this site runs no analytics or
 * marketing scripts, so there is nothing optional to opt out of.
 *
 * No policyUrl: this site has no privacy policy page yet. Add one and pass it
 * here — a consent notice that cannot point at the details is incomplete.
 */
export function ConsentBanner() {
  useEffect(() => {
    const banner = mountConsentBanner({
      version: CONSENT_VERSION,
      text: {
        title: 'Cookies and storage',
        disclosureBody:
          'We store only what is needed to sign you in and keep the site working. No analytics, no marketing cookies, and no tracking across other sites.',
        acknowledge: 'Got it',
      },
    });

    return () => banner.destroy();
  }, []);

  return null;
}

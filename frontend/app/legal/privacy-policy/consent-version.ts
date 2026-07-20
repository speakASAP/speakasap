/**
 * Version of the marketing-consent wording shown to the user.
 *
 * Bump this in the same edit as any change to the marketing section of
 * page.tsx. Consent rows store this value, so a bump makes the settings UI
 * re-ask instead of silently relying on consent given to older wording.
 */
export const MARKETING_CONSENT_VERSION = "2026-07-19";

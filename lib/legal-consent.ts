/** sessionStorage key: legal document versions agreed to on the login page, recorded after the OAuth redirect. */
export const LOGIN_CONSENT_KEY = 'login-legal-consent'

/** Whether the versions agreed to on the login page are exactly the current ones. */
export function consentMatches(agreed: unknown, current: { termsVersion?: string | null; privacyVersion?: string | null }): boolean {
  if (!agreed || typeof agreed !== 'object') return false
  const value = agreed as Record<string, unknown>
  return Boolean(current.termsVersion && current.privacyVersion) &&
    value.terms === current.termsVersion && value.privacy === current.privacyVersion
}

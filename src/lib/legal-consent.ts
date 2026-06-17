export const LEGAL_CONSENT_STORAGE_KEY = 'elevate-life:legal-consent';
export const LEGAL_CONSENT_CHANGED_EVENT = 'elevate-life:legal-consent-changed';
export const LEGAL_CONSENT_VERSION = '2026-06-16';
export const LEGAL_CONSENT_PUBLIC_PATHS = ['/privacy', '/terms', '/support', '/account-deletion'];

export function shouldBypassLegalConsent(pathname: string) {
  return LEGAL_CONSENT_PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

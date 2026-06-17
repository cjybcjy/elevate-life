export const dynamic = 'force-dynamic';

const relation = ['delegate_permission/common.handle_all_urls'];

function parseFingerprints(value?: string) {
  return (value || '')
    .split(/[,\n;]/)
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
}

export async function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME || process.env.CAPACITOR_APP_ID || '';
  const fingerprints = parseFingerprints(process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  const isConfigured = Boolean(packageName && fingerprints.length > 0);
  const body = isConfigured
    ? [{
        relation,
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      }]
    : [];

  return Response.json(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': isConfigured ? 'public, max-age=300, s-maxage=300' : 'no-store',
      ...(isConfigured ? {} : { 'X-Assetlinks-Status': 'unconfigured' }),
    },
  });
}

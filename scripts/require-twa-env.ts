const manifestUrl = process.env.TWA_MANIFEST_URL || '';

if (!manifestUrl) {
  console.error('Set TWA_MANIFEST_URL=https://<your-domain>/manifest.webmanifest before running Bubblewrap.');
  process.exit(1);
}

let parsed: URL;
try {
  parsed = new URL(manifestUrl);
} catch {
  console.error(`TWA_MANIFEST_URL must be a valid HTTPS URL. Received: ${manifestUrl}`);
  process.exit(1);
}

if (parsed.protocol !== 'https:') {
  console.error(`TWA_MANIFEST_URL must use https:// for store builds. Received: ${manifestUrl}`);
  process.exit(1);
}

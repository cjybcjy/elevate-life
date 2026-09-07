// Next.js instrumentation — runs once at server startup
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Defer dynamic imports so this only runs on the server
    const { processAllDueRecurring } = await import('@/lib/services/recurring-processor');

    // Process recurring rules every 60 seconds
    // Safe to call frequently — each rule advances nextDueDate after processing
    const INTERVAL_MS = 60_000;
    setInterval(async () => {
      try {
        await processAllDueRecurring();
      } catch {
        // Silently ignore errors in background processing
      }
    }, INTERVAL_MS);

    console.log('[recurring] Auto-process scheduler started (every 60s)');
  }
}

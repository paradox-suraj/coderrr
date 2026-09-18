/**
 * Helper to verify if valid Clerk keys are configured.
 * Prevents runtime crashes when placeholder keys (e.g. pk_test_...) are present.
 */
export function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!key) return false;
  if (key.includes('...') || key === 'pk_test_' || key === 'pk_live_') return false;
  return (
    (key.startsWith('pk_test_') || key.startsWith('pk_live_')) &&
    key.length >= 30
  );
}

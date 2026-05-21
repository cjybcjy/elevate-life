const keyStore = new Map<string, { key: string; expiresAt: number }>();
const KEY_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function setUserKey(userId: string, key: string): Promise<void> {
  keyStore.set(userId, { key, expiresAt: Date.now() + KEY_TTL });
}

export async function getUserKey(userId: string): Promise<string | null> {
  const entry = keyStore.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    keyStore.delete(userId);
    return null;
  }
  return entry.key;
}

export async function deleteUserKey(userId: string): Promise<void> {
  keyStore.delete(userId);
}

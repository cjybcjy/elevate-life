// Use the same wire representation as the GET API (dates and database decimal
// values included). Failed reads stay missing so the client can retry them;
// they must never be mistaken for a successfully loaded empty account.
export async function initialSnapshot<T extends { success: boolean }, R>(
  read: Promise<T>,
  select: (result: T) => R,
): Promise<unknown> {
  try {
    const result = await read;
    if (!result.success) return undefined;
    return JSON.parse(JSON.stringify(select(result))) as unknown;
  } catch {
    return undefined;
  }
}

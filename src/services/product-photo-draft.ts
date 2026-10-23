// Short-lived, account-scoped handoff. Photos never travel in route URLs.
let draft: { userId: string; dataUrl: string; createdAt: number } | null = null;

export function stageProductPhoto(userId: string, dataUrl: string) {
  draft = { userId, dataUrl, createdAt: Date.now() };
}

export function takeProductPhotoDraft(userId: string) {
  const current = draft;
  draft = null;
  if (!current || current.userId !== userId || Date.now() - current.createdAt > 5 * 60_000) return null;
  return { uri: current.dataUrl, dataUrl: current.dataUrl };
}

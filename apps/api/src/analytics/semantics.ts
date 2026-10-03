export function applyFollowEvent(followedUsers: Set<string>, eventType: string, userId: string | null) {
  if (!userId) return;
  if (eventType === "FOLLOW_CREATOR") followedUsers.add(userId);
  if (eventType === "UNFOLLOW_CREATOR") followedUsers.delete(userId);
}

export function deduplicateIds(ids: string[]) {
  return [...new Set(ids)];
}

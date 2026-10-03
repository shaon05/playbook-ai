import { describe, expect, it } from "vitest";
import { applyFollowEvent, deduplicateIds } from "../src/analytics/semantics";

describe("analytics semantics", () => {
  it("keeps current follow state stable across follow/unfollow/follow retries", () => {
    const users = new Set<string>();
    applyFollowEvent(users, "FOLLOW_CREATOR", "user-1");
    applyFollowEvent(users, "UNFOLLOW_CREATOR", "user-1");
    applyFollowEvent(users, "FOLLOW_CREATOR", "user-1");
    applyFollowEvent(users, "FOLLOW_CREATOR", "user-1");
    expect([...users]).toEqual(["user-1"]);
  });

  it("deduplicates genre or event identifiers", () => {
    expect(deduplicateIds(["a", "a", "b"])).toEqual(["a", "b"]);
  });
});

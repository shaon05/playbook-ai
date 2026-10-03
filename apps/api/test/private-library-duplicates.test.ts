import { describe, expect, it } from "vitest";
import { duplicateMessageForStatus, isActiveDuplicateConstraintError } from "../src/modules/books/private-library-duplicates";

describe("private Library exact-source duplicates", () => {
  it("uses the preparation message for an existing in-flight book", () => {
    expect(duplicateMessageForStatus("EXTRACTION_QUEUED")).toEqual({ title: "Already being prepared", message: "PlayBook is already preparing this document." });
    expect(duplicateMessageForStatus("READY")).toEqual({ title: "Already in your Library", message: "This document is already in your Library." });
  });

  it("recognizes only the active user/source uniqueness violation", () => {
    expect(isActiveDuplicateConstraintError({ code: "23505", message: "duplicate key value violates unique constraint \"books_active_user_source_unique\"" })).toBe(true);
    expect(isActiveDuplicateConstraintError({ code: "23505", message: "another unique constraint" })).toBe(false);
    expect(isActiveDuplicateConstraintError({ code: "42501", message: "permission denied" })).toBe(false);
  });
});

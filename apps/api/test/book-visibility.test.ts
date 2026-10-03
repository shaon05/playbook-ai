import { describe, expect, it } from "vitest";
import { isVisibleInLibrary } from "../src/modules/books/book-visibility";

describe("private upload library visibility", () => {
  it("keeps provisional and failed uploads out of the active library", () => {
    expect(isVisibleInLibrary("CREATED")).toBe(false);
    expect(isVisibleInLibrary("UPLOAD_PENDING")).toBe(false);
    expect(isVisibleInLibrary("UPLOAD_FAILED")).toBe(false);
  });

  it("shows completed and processing books", () => {
    expect(isVisibleInLibrary("EXTRACTION_QUEUED")).toBe(true);
    expect(isVisibleInLibrary("TEXT_READY")).toBe(true);
    expect(isVisibleInLibrary("READY")).toBe(true);
  });
});

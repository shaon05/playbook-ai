import { describe, expect, it } from "vitest";
import { extractPdf } from "../src/modules/extraction/extraction.service";

function makePdf(text: string) {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${Buffer.byteLength(`BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n`)} >> stream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream\nendobj\n`,
  ];
  const header = "%PDF-1.4\n";
  let output = header;
  const offsets = [0];
  for (const object of objects) { offsets.push(output.length); output += object; }
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

describe("PDF extraction", () => {
  it("rejects a file without a PDF signature", async () => {
    await expect(extractPdf(new TextEncoder().encode("not a pdf"), "book")).rejects.toMatchObject({ code: "INVALID_PDF" });
  });

  it("extracts page text and preserves offsets", async () => {
    const text = "This is a safe generated test document with enough selectable text to be considered a normal text page for extraction quality.";
    const result = await extractPdf(makePdf(text), "book-1");
    expect(result.pageCount).toBe(1);
    expect(result.pages[0].text).toContain("safe generated test document");
    expect(result.pages[0].characterStart).toBe(0);
    expect(result.pages[0].characterEnd).toBe(result.pages[0].characterCount);
    expect(result.requiresOcr).toBe(false);
    expect(result.artifact.length).toBeGreaterThan(0);
    const sameTextFromAnotherBook = await extractPdf(makePdf(text), "book-2");
    expect(sameTextFromAnotherBook.sourceHash).toBe(result.sourceHash);
    expect(sameTextFromAnotherBook.normalizedContentHash).toBe(result.normalizedContentHash);
  }, 20000);
});

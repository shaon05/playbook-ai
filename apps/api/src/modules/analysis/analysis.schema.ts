import { z } from "zod";

export const analysisSchema = z.object({
  documentType: z.enum(["FICTION", "NON_FICTION", "TEXTBOOK", "RESEARCH_PAPER", "NOTES", "ARTICLE", "REPORT", "OTHER"]),
  title: z.string().nullable(),
  author: z.string().nullable(),
  language: z.string().min(2).max(16),
  chapters: z.array(z.object({
    index: z.number().int().positive(),
    title: z.string().min(1).max(300),
    startPage: z.number().int().positive().nullable(),
    endPage: z.number().int().positive().nullable(),
    startTextOffset: z.number().int().nonnegative(),
    endTextOffset: z.number().int().positive(),
  })).max(500),
});

export type BookAnalysis = z.infer<typeof analysisSchema>;

export function validateAnalysis(value: unknown, input: { pageCount: number; textLength: number }) {
  const result = analysisSchema.parse(value);
  let previousEnd = -1;
  result.chapters.forEach((chapter, index) => {
    if (chapter.index !== index + 1) throw new Error("AI_INVALID_OUTPUT");
    if (chapter.endTextOffset <= chapter.startTextOffset || chapter.startTextOffset < previousEnd || chapter.endTextOffset > input.textLength) throw new Error("AI_INVALID_OUTPUT");
    if (chapter.startPage !== null && chapter.startPage > input.pageCount) throw new Error("AI_INVALID_OUTPUT");
    if (chapter.endPage !== null && chapter.endPage > input.pageCount) throw new Error("AI_INVALID_OUTPUT");
    previousEnd = chapter.endTextOffset;
  });
  return result;
}

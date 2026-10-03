import type { BookAnalysis } from "../../modules/analysis/analysis.schema";

export type AnalysisInput = { pageCount: number; textLength: number; structuralText: string };
export type AIAnalysisResult = { analysis: BookAnalysis; inputTokens?: number; outputTokens?: number };
export interface AIProvider { analyzeBook(input: AnalysisInput): Promise<AIAnalysisResult>; }

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(options: { data: Uint8Array; useWorkerFetch?: boolean; isEvalSupported?: boolean; disableFontFace?: boolean; useSystemFonts?: boolean }): { promise: Promise<any> };
}

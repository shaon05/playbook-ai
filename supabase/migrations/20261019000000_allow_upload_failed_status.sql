alter table public.books drop constraint if exists books_status_check;

alter table public.books add constraint books_status_check check (status in (
  'CREATED',
  'UPLOAD_PENDING',
  'UPLOAD_FAILED',
  'UPLOADED',
  'EXTRACTION_QUEUED',
  'EXTRACTING',
  'OCR_REQUIRED',
  'OCR_PROCESSING',
  'TEXT_READY',
  'ANALYSIS_QUEUED',
  'ANALYZING',
  'CHAPTERS_READY',
  'EXTRACTION_FAILED',
  'PROCESSING_FAILED',
  'PROCESSING',
  'READY',
  'FAILED'
));

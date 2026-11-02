-- 한국어 키워드 검색용 trigram 인덱스 (docs/02_데이터모델.md "스키마 밖에서 해야 하는 것")
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Document_title_trgm_idx"   ON "Document"   USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Document_summary_trgm_idx" ON "Document"   USING GIN ("summary" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "DocSection_heading_trgm_idx" ON "DocSection" USING GIN ("heading" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "DocSection_text_trgm_idx" ON "DocSection" USING GIN ("text" gin_trgm_ops);

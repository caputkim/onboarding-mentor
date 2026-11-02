-- DropIndex
DROP INDEX "DocSection_heading_trgm_idx";

-- DropIndex
DROP INDEX "DocSection_text_trgm_idx";

-- DropIndex
DROP INDEX "Document_summary_trgm_idx";

-- DropIndex
DROP INDEX "Document_title_trgm_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT;

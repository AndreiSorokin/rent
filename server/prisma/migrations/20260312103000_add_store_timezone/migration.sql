-- Add store timezone
ALTER TABLE "Store" ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'UTC';

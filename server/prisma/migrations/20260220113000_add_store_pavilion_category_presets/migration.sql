-- Add store-level pavilion category presets that are independent from pavilion rows.
ALTER TABLE "Store"
ADD COLUMN "pavilionCategoryPresets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

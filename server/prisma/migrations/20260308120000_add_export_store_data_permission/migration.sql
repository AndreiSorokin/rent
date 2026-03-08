DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Permission'
      AND e.enumlabel = 'EXPORT_STORE_DATA'
  ) THEN
    ALTER TYPE "Permission" ADD VALUE 'EXPORT_STORE_DATA';
  END IF;
END $$;

-- ============================================================
-- Migration: Contacts Hub
-- Description: Adds contacts hub infrastructure — new Person
--   fields, tags, custom fields (EAV), column settings.
--   Does NOT modify or delete any existing data.
-- ============================================================

-- 1. New columns on people table
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "father_name" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "mother_name" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "grandfather_name" TEXT;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "birth_date" DATE;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "rating" INTEGER;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Index for contacts page queries (client + active filter)
CREATE INDEX IF NOT EXISTS "idx_people_client_active" ON "people" ("client_id", "active");

-- 2. Custom field type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_type_enum') THEN
    CREATE TYPE "custom_field_type_enum" AS ENUM ('text', 'number', 'date', 'select', 'boolean');
  END IF;
END$$;

-- 3. Tags table
CREATE TABLE IF NOT EXISTS "tags" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL REFERENCES "clients"("id"),
  "name" TEXT NOT NULL,
  "color" TEXT,
  "created_at" TIMESTAMP(6) DEFAULT NOW(),
  "updated_at" TIMESTAMP(6) DEFAULT NOW(),
  UNIQUE("client_id", "name")
);

-- 4. Person-Tags junction table
CREATE TABLE IF NOT EXISTS "person_tags" (
  "person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "tag_id" INTEGER NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
  PRIMARY KEY ("person_id", "tag_id")
);

-- 5. Custom field definitions
CREATE TABLE IF NOT EXISTS "custom_field_definitions" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL REFERENCES "clients"("id"),
  "field_name" TEXT NOT NULL,
  "field_type" "custom_field_type_enum" NOT NULL DEFAULT 'text',
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) DEFAULT NOW(),
  "updated_at" TIMESTAMP(6) DEFAULT NOW(),
  UNIQUE("client_id", "field_name")
);

-- 6. Custom field values (EAV)
CREATE TABLE IF NOT EXISTS "custom_field_values" (
  "id" SERIAL PRIMARY KEY,
  "person_id" INTEGER NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "field_definition_id" INTEGER NOT NULL REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE,
  "value" TEXT,
  "created_at" TIMESTAMP(6) DEFAULT NOW(),
  "updated_at" TIMESTAMP(6) DEFAULT NOW(),
  UNIQUE("person_id", "field_definition_id")
);

-- 7. Contacts column settings (per client)
CREATE TABLE IF NOT EXISTS "contacts_column_settings" (
  "id" SERIAL PRIMARY KEY,
  "client_id" INTEGER NOT NULL UNIQUE REFERENCES "clients"("id"),
  "column_definitions" JSONB NOT NULL,
  "updated_at" TIMESTAMP(6) DEFAULT NOW()
);

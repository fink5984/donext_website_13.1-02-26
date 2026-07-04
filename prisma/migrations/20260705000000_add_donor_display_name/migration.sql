-- Public-facing display / receipt name for a donor.
-- Auto-filled from first + last name on the public donation form, editable by the donor,
-- and shown on the public screen. NULL means fall back to the person's first + last name.
ALTER TABLE "donors"
  ADD COLUMN IF NOT EXISTS "display_name" TEXT;

-- Migration: Add new person fields
-- Fields: personal_id (ת.ז.), apt_number (מספר דירה), mailing_address (כתובת למשלוח דואר), wife_name (שם אישה)

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS personal_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS apt_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mailing_address TEXT,
  ADD COLUMN IF NOT EXISTS wife_name VARCHAR(100);

COMMENT ON COLUMN people.personal_id IS 'תעודת זהות';
COMMENT ON COLUMN people.apt_number IS 'מספר דירה';
COMMENT ON COLUMN people.mailing_address IS 'כתובת למשלוח דואר';
COMMENT ON COLUMN people.wife_name IS 'שם האישה';

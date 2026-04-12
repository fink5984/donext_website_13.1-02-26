-- Migration: Add person_english_names table
-- This table stores English names for people who have both Hebrew and English names

CREATE TABLE IF NOT EXISTS person_english_names (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL UNIQUE,
    title_before VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    title_after VARCHAR(255),
    created_at TIMESTAMP(6) DEFAULT NOW(),
    updated_at TIMESTAMP(6) DEFAULT NOW(),
    CONSTRAINT fk_person_english_names_person
        FOREIGN KEY (person_id)
        REFERENCES people(id)
        ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_person_english_names_person_id ON person_english_names(person_id);

-- Add comment for documentation
COMMENT ON TABLE person_english_names IS 'Stores English name translations for people. One-to-one relationship with people table.';

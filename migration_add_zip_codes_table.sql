-- Migration: Add zip_codes table
-- Hierarchy: Country -> State -> City -> ZipCode -> Street

-- Step 1: Create zip_codes table
CREATE TABLE IF NOT EXISTS zip_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    city_id INTEGER NOT NULL,
    created_at TIMESTAMP(6) DEFAULT NOW(),
    updated_at TIMESTAMP(6) DEFAULT NOW(),
    CONSTRAINT fk_zip_codes_city
        FOREIGN KEY (city_id)
        REFERENCES cities(id)
        ON DELETE RESTRICT
);

-- Step 2: Add zip_code_id column to streets table
ALTER TABLE streets 
ADD COLUMN IF NOT EXISTS zip_code_id INTEGER;

-- Step 3: Add foreign key constraint from streets to zip_codes
ALTER TABLE streets
ADD CONSTRAINT fk_streets_zip_code
    FOREIGN KEY (zip_code_id)
    REFERENCES zip_codes(id)
    ON DELETE SET NULL;

-- Step 4: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_zip_codes_city_id ON zip_codes(city_id);
CREATE INDEX IF NOT EXISTS idx_zip_codes_code ON zip_codes(code);
CREATE INDEX IF NOT EXISTS idx_streets_zip_code_id ON streets(zip_code_id);

-- Add comments for documentation
COMMENT ON TABLE zip_codes IS 'Stores ZIP/postal codes. Linked to cities table. Streets can be linked to zip codes.';
COMMENT ON COLUMN streets.zip_code_id IS 'Foreign key to zip_codes table. Optional - allows streets without zip code.';

-- Migration: Add states table and update location hierarchy
-- Hierarchy: Country -> State -> City -> Street

-- Step 1: Create states table
CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country_id INTEGER NOT NULL,
    created_at TIMESTAMP(6) DEFAULT NOW(),
    updated_at TIMESTAMP(6) DEFAULT NOW(),
    CONSTRAINT fk_states_country
        FOREIGN KEY (country_id)
        REFERENCES countries(id)
        ON DELETE RESTRICT
);

-- Step 2: Add state_id column to cities table
ALTER TABLE cities 
ADD COLUMN IF NOT EXISTS state_id INTEGER;

-- Step 3: Add foreign key constraint from cities to states
ALTER TABLE cities
ADD CONSTRAINT fk_cities_state
    FOREIGN KEY (state_id)
    REFERENCES states(id)
    ON DELETE SET NULL;

-- Step 4: Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_states_country_id ON states(country_id);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON cities(state_id);

-- Add comments for documentation
COMMENT ON TABLE states IS 'Stores states/provinces. Linked to countries table. Cities are linked to states.';
COMMENT ON COLUMN cities.state_id IS 'Foreign key to states table. Optional - allows cities without state.';

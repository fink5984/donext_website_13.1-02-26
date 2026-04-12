-- Migration: Add operator_ranks table for operator expected ranks
-- These are ranks that campaign admins define for operators to assign to each fundraiser

CREATE TABLE IF NOT EXISTS operator_ranks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
    amount DECIMAL,
    created_at TIMESTAMP(6) DEFAULT NOW(),
    updated_at TIMESTAMP(6) DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX idx_operator_ranks_campaign_id ON operator_ranks(campaign_id);

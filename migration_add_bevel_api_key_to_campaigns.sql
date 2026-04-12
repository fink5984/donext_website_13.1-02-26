-- Add bevel_api_key column to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS bevel_api_key VARCHAR(255);

-- Add comment to column
COMMENT ON COLUMN campaigns.bevel_api_key IS 'Bevel/USAePay API key for payment processing';

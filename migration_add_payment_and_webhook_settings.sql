-- Add payment_methods and webhook_settings columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS payment_methods JSONB,
ADD COLUMN IF NOT EXISTS webhook_settings JSONB;

-- Add comments for documentation
COMMENT ON COLUMN campaigns.payment_methods IS 'JSON object storing enabled payment methods for the campaign';
COMMENT ON COLUMN campaigns.webhook_settings IS 'JSON object storing webhook configurations (chaim, kanin)';

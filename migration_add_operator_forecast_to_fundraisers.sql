-- Add operator forecast fields to fundraisers table
-- operator_expected: the expected amount assigned by the operator
-- last_forecast_by_operator_id: which operator assigned this forecast

ALTER TABLE fundraisers 
ADD COLUMN IF NOT EXISTS operator_expected DECIMAL,
ADD COLUMN IF NOT EXISTS last_forecast_by_operator_id INTEGER;

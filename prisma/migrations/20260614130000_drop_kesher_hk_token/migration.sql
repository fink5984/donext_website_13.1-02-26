-- Kesher HK's iframe token is generated per-transaction via create-payment-page-token
-- (func=GetLinkToken) and is never configured by the client, so the stored token
-- column is unused. Drop it. Authentication to that endpoint uses the PaymentPageId
-- (kesher_hk_page_id), not a stored secret.
ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "kesher_hk_token";

-- Widen external_donation_id from INTEGER (INT4, max 2,147,483,647) to BIGINT (INT8).
-- Payment-gateway transaction IDs (e.g. Nedarim/Donary) can exceed the INT4 limit
-- (observed value 4,342,079,950), which crashed the duplicate-check query and
-- prevented the donation from being saved after the card was already charged.
ALTER TABLE "donations" ALTER COLUMN "external_donation_id" TYPE BIGINT;

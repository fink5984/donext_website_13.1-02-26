-- Migration: Add Performance Indexes
-- Date: $(date)
-- Purpose: Improve performance for donations and donors queries

-- =============================================
-- DONORS TABLE INDEXES
-- =============================================

-- Index for campaign + active status (most common query)
CREATE INDEX IF NOT EXISTS idx_donors_campaign_active 
ON donors(campaign_id, active) 
WHERE active = true;

-- Index for expected donation (sorting and filtering)
CREATE INDEX IF NOT EXISTS idx_donors_expected 
ON donors(expected DESC NULLS LAST) 
WHERE expected IS NOT NULL;

-- Index for traffic light color (sorting)
CREATE INDEX IF NOT EXISTS idx_donors_traffic_light 
ON donors(traffic_light_color);

-- Index for fundraiser assignment
CREATE INDEX IF NOT EXISTS idx_donors_fundraiser 
ON donors(fundraiser_id) 
WHERE fundraiser_id IS NOT NULL;

-- Composite index for campaign + fundraiser (assignment queries)
CREATE INDEX IF NOT EXISTS idx_donors_campaign_fundraiser 
ON donors(campaign_id, fundraiser_id);

-- =============================================
-- DONATIONS TABLE INDEXES  
-- =============================================

-- Index for donor + soft delete (most common query)
CREATE INDEX IF NOT EXISTS idx_donations_donor_deleted 
ON donations(donor_id, deleted_at);

-- Index for monthly amount (filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_donations_monthly_amount 
ON donations(monthly_amount);

-- Index for creation date (sorting)
CREATE INDEX IF NOT EXISTS idx_donations_created_at 
ON donations(created_at DESC);

-- Composite index for active donations
CREATE INDEX IF NOT EXISTS idx_donations_active 
ON donations(donor_id, deleted_at, monthly_amount) 
WHERE deleted_at IS NULL;

-- =============================================
-- PEOPLE TABLE INDEXES
-- =============================================

-- Index for client association
CREATE INDEX IF NOT EXISTS idx_people_client 
ON people(client_id) 
WHERE client_id IS NOT NULL;

-- Index for name search (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_people_name_search 
ON people(lower(first_name), lower(last_name));

-- Index for city and street (location-based queries)
CREATE INDEX IF NOT EXISTS idx_people_location 
ON people(city_id, street_id);

-- Index for import tracking
CREATE INDEX IF NOT EXISTS idx_people_import 
ON people(import_id) 
WHERE import_id IS NOT NULL;

-- =============================================
-- FUNDRAISERS TABLE INDEXES
-- =============================================

-- Index for campaign + soft delete
CREATE INDEX IF NOT EXISTS idx_fundraisers_campaign_deleted 
ON fundraisers(campaign_id, deleted_at);

-- Index for person association
CREATE INDEX IF NOT EXISTS idx_fundraisers_person 
ON fundraisers(person_id);

-- =============================================
-- CAMPAIGNS TABLE INDEXES
-- =============================================

-- Index for client association
CREATE INDEX IF NOT EXISTS idx_campaigns_client 
ON campaigns(client_id);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_campaigns_dates 
ON campaigns(start_date, end_date);

-- =============================================
-- PERFORMANCE STATISTICS
-- =============================================

-- Update table statistics for PostgreSQL query planner
ANALYZE donors;
ANALYZE donations; 
ANALYZE people;
ANALYZE fundraisers;
ANALYZE campaigns;

-- Show index information
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('donors', 'donations', 'people', 'fundraisers', 'campaigns')
ORDER BY tablename, indexname;

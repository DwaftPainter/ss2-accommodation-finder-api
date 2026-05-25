-- Drop redundant indexes.
DROP INDEX IF EXISTS "UserSession_token_idx";
DROP INDEX IF EXISTS "Listing_status_idx";
DROP INDEX IF EXISTS "Listing_price_idx";
DROP INDEX IF EXISTS "Listing_area_idx";
DROP INDEX IF EXISTS "Listing_type_idx";

-- Add indexes that match the public listing browse filters.
CREATE INDEX IF NOT EXISTS "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Listing_status_price_idx" ON "Listing"("status", "price");
CREATE INDEX IF NOT EXISTS "Listing_status_area_idx" ON "Listing"("status", "area");

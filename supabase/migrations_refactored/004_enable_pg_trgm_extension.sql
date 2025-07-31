-- Enable trigram similarity search extension
-- Required for fuzzy text search and similarity matching
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
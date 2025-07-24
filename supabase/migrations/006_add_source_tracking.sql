-- Migration to add source tracking for generated content
-- This allows tracking which specific feed sources contributed to daily analysis and predictions

-- Add source_ids array to daily_analysis table
ALTER TABLE daily_analysis 
ADD COLUMN source_ids UUID[] DEFAULT '{}';

-- Add source_content_ids to track specific content items used
ALTER TABLE daily_analysis 
ADD COLUMN source_content_ids UUID[] DEFAULT '{}';

-- Add similar tracking to predictions table
ALTER TABLE predictions
ADD COLUMN source_ids UUID[] DEFAULT '{}';

-- Create a helper view to get source details with analysis
CREATE OR REPLACE VIEW daily_analysis_with_sources AS
SELECT 
    da.*,
    ARRAY(
        SELECT DISTINCT fs.name 
        FROM feed_sources fs 
        WHERE fs.id = ANY(da.source_ids)
    ) as source_names,
    ARRAY(
        SELECT json_build_object(
            'id', fs.id,
            'name', fs.name,
            'type', fs.type,
            'url', fs.url
        )
        FROM feed_sources fs 
        WHERE fs.id = ANY(da.source_ids)
    ) as source_details
FROM daily_analysis da;

-- Create a helper view for predictions with sources
CREATE OR REPLACE VIEW predictions_with_sources AS
SELECT 
    p.*,
    ARRAY(
        SELECT DISTINCT fs.name 
        FROM feed_sources fs 
        WHERE fs.id = ANY(p.source_ids)
    ) as source_names,
    ARRAY(
        SELECT json_build_object(
            'id', fs.id,
            'name', fs.name,
            'type', fs.type
        )
        FROM feed_sources fs 
        WHERE fs.id = ANY(p.source_ids)
    ) as source_details
FROM predictions p;

-- Function to get content by source for a date range
CREATE OR REPLACE FUNCTION get_content_sources_for_date(
    start_date DATE,
    end_date DATE
) RETURNS TABLE (
    source_id UUID,
    source_name VARCHAR(255),
    content_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fs.id as source_id,
        fs.name as source_name,
        COUNT(DISTINCT rf.id) as content_count
    FROM feed_sources fs
    JOIN raw_feeds rf ON rf.source_id = fs.id
    WHERE rf.published_at::date BETWEEN start_date AND end_date
    GROUP BY fs.id, fs.name
    ORDER BY content_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Index for performance
CREATE INDEX idx_daily_analysis_source_ids ON daily_analysis USING GIN(source_ids);
CREATE INDEX idx_predictions_source_ids ON predictions USING GIN(source_ids);
-- Create trigger to update feed_sources.updated_at on row changes
CREATE TRIGGER trg_feed_sources_updated_at
    BEFORE UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TRIGGER trg_feed_sources_updated_at ON feed_sources IS 'Automatically update updated_at timestamp when feed source is modified';
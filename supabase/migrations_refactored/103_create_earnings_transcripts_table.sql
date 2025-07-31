-- Create earnings transcripts table
CREATE TABLE IF NOT EXISTS earnings_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    earnings_event_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Transcript details
    transcript_type VARCHAR(50) NOT NULL,
    transcript_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Content
    full_text TEXT,
    summary TEXT,
    
    -- Sections
    prepared_remarks TEXT,
    qa_session TEXT,
    
    -- Participants
    participants JSONB DEFAULT '[]',
    executives JSONB DEFAULT '[]',
    analysts JSONB DEFAULT '[]',
    
    -- Analysis
    sentiment_score DECIMAL(5, 4),
    key_topics TEXT[] DEFAULT '{}',
    extracted_metrics JSONB DEFAULT '{}',
    
    -- Source
    source_url TEXT,
    data_source VARCHAR(50) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT fk_earnings_transcripts_event 
        FOREIGN KEY (earnings_event_id) 
        REFERENCES earnings_events(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_earnings_transcripts_entity 
        FOREIGN KEY (entity_id) 
        REFERENCES entities(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_earnings_transcripts_type CHECK (
        transcript_type IN ('earnings_call', 'investor_day', 'conference', 'analyst_meeting')
    ),
    
    CONSTRAINT chk_earnings_transcripts_sentiment CHECK (
        sentiment_score IS NULL OR sentiment_score BETWEEN -1 AND 1
    )
);

-- Add table comment
COMMENT ON TABLE earnings_transcripts IS 'Earnings call transcripts and analysis';

-- Add column comments
COMMENT ON COLUMN earnings_transcripts.transcript_type IS 'Type of transcript: earnings_call, investor_day, etc';
COMMENT ON COLUMN earnings_transcripts.participants IS 'Array of all participants with roles';
COMMENT ON COLUMN earnings_transcripts.executives IS 'Company executives who spoke';
COMMENT ON COLUMN earnings_transcripts.analysts IS 'Analysts who asked questions';
COMMENT ON COLUMN earnings_transcripts.extracted_metrics IS 'Key metrics mentioned in the call';
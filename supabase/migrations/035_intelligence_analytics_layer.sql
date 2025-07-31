-- Intelligence Analytics Layer
-- Adds missing tables and views for complete intelligence dashboard support

-- =====================================================
-- PART 1: GRAPH VISUALIZATION SUPPORT
-- =====================================================

-- Store graph layouts and visual configurations
CREATE TABLE kg_graph_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_name VARCHAR(255) NOT NULL,
    layout_type VARCHAR(50) NOT NULL, -- 'force-directed', 'hierarchical', 'circular', 'geographic'
    entity_positions JSONB DEFAULT '{}', -- {entity_id: {x, y, z, fixed, color, size}}
    edge_styles JSONB DEFAULT '{}', -- {relationship_type: {color, width, style}}
    zoom_level DECIMAL(5,2) DEFAULT 1.0,
    center_point JSONB DEFAULT '{"x": 0, "y": 0}',
    filters JSONB DEFAULT '{}', -- Active filters for this view
    camera_position JSONB DEFAULT '{}', -- For 3D views
    created_by UUID, -- REFERENCES users(id) when user system exists
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entity clustering for graph visualization
CREATE TABLE kg_entity_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_name VARCHAR(255) NOT NULL,
    cluster_type VARCHAR(50) NOT NULL, -- 'community', 'sector', 'topic', 'geographic'
    algorithm VARCHAR(100), -- 'louvain', 'kmeans', 'hierarchical', 'dbscan'
    parameters JSONB DEFAULT '{}', -- Algorithm parameters
    entity_ids UUID[] NOT NULL,
    cluster_center UUID, -- Central entity in cluster
    cluster_metrics JSONB DEFAULT '{}', -- {density, cohesion, separation, silhouette}
    parent_cluster_id UUID REFERENCES kg_entity_clusters(id),
    hierarchy_level INTEGER DEFAULT 0,
    color_hex VARCHAR(7), -- Visual representation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 2: REAL-TIME INTELLIGENCE METRICS
-- =====================================================

-- Store calculated intelligence metrics
CREATE TABLE intelligence_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(100) NOT NULL, -- 'momentum', 'divergence', 'volatility', 'correlation_strength'
    metric_subtype VARCHAR(100), -- More specific categorization
    entity_id UUID REFERENCES kg_entities(id),
    metric_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metric values
    metric_value DECIMAL(20,6) NOT NULL,
    metric_components JSONB DEFAULT '{}', -- Breakdown of composite metrics
    
    -- Statistical properties
    z_score DECIMAL(10,4), -- Standard deviations from mean
    percentile_rank DECIMAL(5,2), -- 0-100
    is_anomaly BOOLEAN DEFAULT false,
    anomaly_score DECIMAL(5,2), -- 0-100
    
    -- Context
    compared_to_average DECIMAL(10,4), -- Percentage vs average
    trend_direction VARCHAR(20), -- 'increasing', 'decreasing', 'stable'
    confidence_score DECIMAL(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert rules for intelligence metrics
CREATE TABLE intelligence_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    rule_description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'threshold', 'pattern', 'anomaly', 'correlation'
    
    -- Target configuration
    target_metric VARCHAR(100) NOT NULL,
    target_entities UUID[] DEFAULT '{}', -- Specific entities or empty for all
    
    -- Conditions
    conditions JSONB NOT NULL, -- Complex rule conditions
    threshold_value DECIMAL(20,6),
    threshold_direction VARCHAR(20), -- 'above', 'below', 'outside_range'
    
    -- Alert configuration
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    cooldown_minutes INTEGER DEFAULT 60,
    
    -- State
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    
    -- Notification
    notification_channels JSONB DEFAULT '[]', -- email, slack, webhook
    notification_template TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert history
CREATE TABLE intelligence_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES intelligence_alert_rules(id),
    alert_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    entity_id UUID REFERENCES kg_entities(id),
    
    -- Alert details
    metric_value DECIMAL(20,6),
    threshold_value DECIMAL(20,6),
    severity VARCHAR(20),
    
    -- Context
    alert_context JSONB DEFAULT '{}',
    recommended_actions TEXT[],
    
    -- Resolution
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 3: PATTERN & ANOMALY DETECTION
-- =====================================================

-- Detected patterns in data
CREATE TABLE detected_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(100) NOT NULL, -- 'correlation_spike', 'narrative_shift', 'volume_anomaly'
    pattern_name VARCHAR(255),
    pattern_description TEXT,
    
    -- Entities involved
    primary_entity_id UUID REFERENCES kg_entities(id),
    entities_involved UUID[] DEFAULT '{}',
    
    -- Pattern data
    pattern_data JSONB NOT NULL, -- Detailed pattern information
    pattern_strength DECIMAL(5,2) CHECK (pattern_strength BETWEEN 0 AND 100),
    
    -- Temporal
    detection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    duration_hours INTEGER,
    
    -- Classification
    is_anomaly BOOLEAN DEFAULT false,
    anomaly_type VARCHAR(50), -- 'statistical', 'behavioral', 'contextual'
    anomaly_severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    
    -- Validation
    confidence_score DECIMAL(5,2) CHECK (confidence_score BETWEEN 0 AND 100),
    false_positive BOOLEAN DEFAULT false,
    validated_by VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entity correlation matrix
CREATE TABLE entity_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_a_id UUID NOT NULL REFERENCES kg_entities(id),
    entity_b_id UUID NOT NULL REFERENCES kg_entities(id),
    
    -- Correlation details
    correlation_type VARCHAR(50) NOT NULL, -- 'price', 'sentiment', 'mention', 'network'
    correlation_value DECIMAL(5,4) CHECK (correlation_value BETWEEN -1 AND 1),
    
    -- Time parameters
    calculation_date DATE NOT NULL,
    timeframe VARCHAR(20) NOT NULL, -- '7d', '30d', '90d', '1y'
    data_points INTEGER NOT NULL,
    
    -- Statistical significance
    p_value DECIMAL(10,8),
    confidence_interval_lower DECIMAL(5,4),
    confidence_interval_upper DECIMAL(5,4),
    is_significant BOOLEAN DEFAULT false,
    
    -- Lag analysis
    optimal_lag_days INTEGER, -- Best correlation with lag
    lag_correlation DECIMAL(5,4),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT different_entities CHECK (entity_a_id != entity_b_id),
    UNIQUE(entity_a_id, entity_b_id, correlation_type, calculation_date, timeframe)
);

-- =====================================================
-- PART 4: PREDICTIVE ANALYTICS
-- =====================================================

-- Prediction models registry
CREATE TABLE prediction_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(100) NOT NULL, -- 'time_series', 'classification', 'regression', 'ensemble'
    model_subtype VARCHAR(100), -- 'lstm', 'arima', 'random_forest', 'xgboost'
    model_version VARCHAR(50) NOT NULL,
    
    -- Model configuration
    target_variable VARCHAR(100) NOT NULL,
    target_entity_type VARCHAR(50), -- Which entity types this model applies to
    features_used JSONB NOT NULL, -- List of features and their importance
    hyperparameters JSONB DEFAULT '{}',
    
    -- Performance metrics
    training_metrics JSONB DEFAULT '{}', -- {rmse, mae, r2, accuracy}
    validation_metrics JSONB DEFAULT '{}',
    test_metrics JSONB DEFAULT '{}',
    
    -- Model metadata
    training_data_start DATE,
    training_data_end DATE,
    training_samples INTEGER,
    last_trained TIMESTAMP WITH TIME ZONE,
    
    -- State
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- Primary model for this target
    deprecation_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model predictions/forecasts
CREATE TABLE forecast_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES prediction_models(id),
    entity_id UUID REFERENCES kg_entities(id),
    
    -- Forecast details
    forecast_date DATE NOT NULL, -- When forecast was made
    target_date DATE NOT NULL, -- Date being forecasted
    horizon_days INTEGER GENERATED ALWAYS AS (target_date - forecast_date) STORED,
    
    -- Predictions
    forecast_value DECIMAL(20,6) NOT NULL,
    forecast_components JSONB DEFAULT '{}', -- Breakdown for interpretability
    
    -- Uncertainty
    confidence_interval_lower DECIMAL(20,6),
    confidence_interval_upper DECIMAL(20,6),
    prediction_interval_lower DECIMAL(20,6), -- Wider than confidence
    prediction_interval_upper DECIMAL(20,6),
    uncertainty_score DECIMAL(5,2), -- 0-100
    
    -- Metadata
    feature_values JSONB DEFAULT '{}', -- Input features used
    model_confidence DECIMAL(5,2), -- Model's self-reported confidence
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Backtesting results
CREATE TABLE model_backtests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES prediction_models(id),
    test_start_date DATE NOT NULL,
    test_end_date DATE NOT NULL,
    
    -- Performance metrics
    accuracy_metrics JSONB NOT NULL, -- {mae, rmse, mape, directional_accuracy}
    profit_metrics JSONB DEFAULT '{}', -- For trading strategies
    
    -- Detailed results
    predictions_made INTEGER,
    correct_direction INTEGER,
    within_confidence_interval INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 5: NARRATIVE & SENTIMENT INTELLIGENCE
-- =====================================================

-- Track narrative themes and momentum
CREATE TABLE narrative_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_name VARCHAR(255) NOT NULL,
    theme_description TEXT,
    theme_category VARCHAR(100), -- 'market', 'technology', 'regulatory', 'macro'
    
    -- Theme identification
    theme_keywords TEXT[] NOT NULL,
    theme_phrases TEXT[] DEFAULT '{}', -- Key phrases that define theme
    exclusion_keywords TEXT[] DEFAULT '{}', -- Words that disqualify
    
    -- Theme metrics
    momentum_score DECIMAL(5,2) DEFAULT 50.0, -- 0-100
    momentum_change_7d DECIMAL(10,4), -- Percentage change
    sentiment_bias DECIMAL(5,4) CHECK (sentiment_bias BETWEEN -1 AND 1),
    
    -- Temporal
    first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_detected TIMESTAMP WITH TIME ZONE,
    peak_date TIMESTAMP WITH TIME ZONE,
    peak_momentum DECIMAL(5,2),
    
    -- Associations
    entity_associations UUID[] DEFAULT '{}', -- Most associated entities
    parent_theme_id UUID REFERENCES narrative_themes(id),
    child_theme_ids UUID[] DEFAULT '{}',
    
    -- State
    is_active BOOLEAN DEFAULT true,
    is_emerging BOOLEAN DEFAULT false, -- Rapidly growing
    is_declining BOOLEAN DEFAULT false, -- Losing momentum
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track theme momentum over time
CREATE TABLE narrative_theme_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES narrative_themes(id),
    snapshot_date DATE NOT NULL,
    
    -- Metrics
    mention_count INTEGER DEFAULT 0,
    unique_sources INTEGER DEFAULT 0,
    momentum_score DECIMAL(5,2),
    sentiment_score DECIMAL(5,4),
    
    -- Top entities for this theme on this date
    top_entities JSONB DEFAULT '[]', -- [{entity_id, mention_count, sentiment}]
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(theme_id, snapshot_date)
);

-- Language complexity and quality metrics
CREATE TABLE content_complexity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES processed_content(id),
    
    -- Readability metrics
    flesch_reading_ease DECIMAL(5,2), -- 0-100 (higher = easier)
    flesch_kincaid_grade DECIMAL(4,2), -- Grade level
    gunning_fog_index DECIMAL(4,2), -- Years of education needed
    
    -- Linguistic complexity
    avg_sentence_length DECIMAL(6,2),
    avg_syllables_per_word DECIMAL(4,2),
    vocabulary_diversity DECIMAL(5,4), -- Type-token ratio
    
    -- Content characteristics
    technical_term_density DECIMAL(5,4), -- Percentage of technical terms
    financial_term_density DECIMAL(5,4),
    uncertainty_language_score DECIMAL(5,4), -- "maybe", "possibly", etc.
    forward_looking_score DECIMAL(5,4), -- Future tense usage
    
    -- Sentiment complexity
    sentiment_volatility DECIMAL(5,4), -- How much sentiment varies
    mixed_sentiment_score DECIMAL(5,4), -- Presence of conflicting sentiments
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 6: DASHBOARD & USER ANALYTICS
-- =====================================================

-- Store dashboard configurations
CREATE TABLE user_dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- REFERENCES users(id) when implemented
    dashboard_name VARCHAR(255) NOT NULL,
    dashboard_type VARCHAR(50) NOT NULL, -- 'intelligence', 'market', 'entity', 'custom'
    
    -- Layout configuration
    layout_config JSONB NOT NULL, -- Widget positions, sizes, types
    widget_settings JSONB DEFAULT '{}', -- Individual widget configurations
    
    -- Preferences
    theme VARCHAR(50) DEFAULT 'light',
    refresh_interval INTEGER DEFAULT 300, -- seconds
    default_timeframe VARCHAR(20) DEFAULT '7d',
    
    -- Filters and views
    saved_filters JSONB DEFAULT '{}',
    pinned_entities UUID[] DEFAULT '{}',
    hidden_widgets TEXT[] DEFAULT '{}',
    
    -- State
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    share_token VARCHAR(255) UNIQUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track widget interactions for optimization
CREATE TABLE dashboard_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- REFERENCES users(id)
    dashboard_config_id UUID REFERENCES user_dashboard_configs(id),
    
    -- Interaction details
    widget_type VARCHAR(100) NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- 'view', 'click', 'hover', 'export', 'configure'
    interaction_duration_ms INTEGER,
    
    -- Context
    interaction_data JSONB DEFAULT '{}', -- What was clicked, exported, etc.
    viewport_size JSONB DEFAULT '{}', -- {width, height}
    device_type VARCHAR(50), -- 'desktop', 'tablet', 'mobile'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PART 7: PERFORMANCE MATERIALIZED VIEWS
-- =====================================================

-- Real-time entity intelligence summary
CREATE MATERIALIZED VIEW mv_entity_intelligence AS
SELECT 
    e.id,
    e.entity_type,
    e.name,
    e.display_name,
    (e.identifiers->>'ticker') as ticker,
    
    -- Mention metrics (30 day)
    COUNT(DISTINCT m.content_id) FILTER (WHERE m.created_at > NOW() - INTERVAL '30 days') as mentions_30d,
    AVG(m.sentiment_score) FILTER (WHERE m.created_at > NOW() - INTERVAL '30 days') as avg_sentiment_30d,
    STDDEV(m.sentiment_score) FILTER (WHERE m.created_at > NOW() - INTERVAL '30 days') as sentiment_volatility_30d,
    
    -- Mention trend
    COUNT(DISTINCT m.content_id) FILTER (WHERE m.created_at > NOW() - INTERVAL '7 days') as mentions_7d,
    COUNT(DISTINCT m.content_id) FILTER (WHERE m.created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days') as mentions_7d_prior,
    
    -- Network metrics
    COUNT(DISTINCT r.id) FILTER (WHERE r.subject_id = e.id) as outgoing_relationships,
    COUNT(DISTINCT r.id) FILTER (WHERE r.object_id = e.id) as incoming_relationships,
    
    -- Latest activity
    MAX(m.created_at) as last_mentioned,
    
    -- Associated themes
    ARRAY_AGG(DISTINCT nt.theme_name) FILTER (WHERE e.id = ANY(nt.entity_associations)) as associated_themes,
    
    -- Quality scores
    e.importance_score,
    e.quality_score,
    e.is_verified,
    
    NOW() as last_updated
FROM kg_entities e
LEFT JOIN kg_entity_mentions m ON e.id = m.entity_id
LEFT JOIN kg_relationships r ON e.id IN (r.subject_id, r.object_id) AND r.is_current = true
LEFT JOIN narrative_themes nt ON e.id = ANY(nt.entity_associations) AND nt.is_active = true
WHERE e.is_active = true
GROUP BY e.id;

CREATE UNIQUE INDEX idx_mv_entity_intelligence_id ON mv_entity_intelligence(id);
CREATE INDEX idx_mv_entity_intelligence_mentions ON mv_entity_intelligence(mentions_30d DESC);
CREATE INDEX idx_mv_entity_intelligence_type ON mv_entity_intelligence(entity_type);

-- Network centrality and graph metrics
CREATE MATERIALIZED VIEW mv_entity_network_metrics AS
WITH relationship_counts AS (
    SELECT 
        entity_id,
        direction,
        COUNT(*) as degree,
        COUNT(DISTINCT other_entity_id) as unique_connections,
        AVG(strength) as avg_strength
    FROM (
        SELECT subject_id as entity_id, object_id as other_entity_id, 'out' as direction, strength 
        FROM kg_relationships WHERE is_current = true
        UNION ALL
        SELECT object_id as entity_id, subject_id as other_entity_id, 'in' as direction, strength 
        FROM kg_relationships WHERE is_current = true
    ) r
    GROUP BY entity_id, direction
),
aggregated AS (
    SELECT 
        entity_id,
        SUM(degree) as total_degree,
        SUM(CASE WHEN direction = 'out' THEN degree ELSE 0 END) as out_degree,
        SUM(CASE WHEN direction = 'in' THEN degree ELSE 0 END) as in_degree,
        SUM(unique_connections) as total_unique_connections,
        AVG(avg_strength) as overall_avg_strength
    FROM relationship_counts
    GROUP BY entity_id
)
SELECT 
    e.id,
    e.name,
    e.entity_type,
    COALESCE(a.total_degree, 0) as degree_centrality,
    COALESCE(a.out_degree, 0) as out_degree,
    COALESCE(a.in_degree, 0) as in_degree,
    COALESCE(a.total_unique_connections, 0) as unique_connections,
    COALESCE(a.overall_avg_strength, 0) as avg_relationship_strength,
    
    -- Normalized metrics
    CASE 
        WHEN MAX(a.total_degree) OVER() > 0 
        THEN a.total_degree::FLOAT / MAX(a.total_degree) OVER()
        ELSE 0 
    END as normalized_centrality,
    
    -- Centrality rank
    RANK() OVER (ORDER BY a.total_degree DESC NULLS LAST) as centrality_rank,
    
    NOW() as last_updated
FROM kg_entities e
LEFT JOIN aggregated a ON e.id = a.entity_id
WHERE e.is_active = true;

CREATE UNIQUE INDEX idx_mv_network_metrics_id ON mv_entity_network_metrics(id);
CREATE INDEX idx_mv_network_metrics_centrality ON mv_entity_network_metrics(degree_centrality DESC);

-- Theme momentum tracking
CREATE MATERIALIZED VIEW mv_theme_momentum AS
WITH theme_metrics AS (
    SELECT 
        t.id,
        t.theme_name,
        t.theme_category,
        COUNT(DISTINCT h.snapshot_date) as active_days,
        SUM(h.mention_count) as total_mentions,
        AVG(h.momentum_score) as avg_momentum,
        MAX(h.momentum_score) as peak_momentum,
        AVG(h.sentiment_score) as avg_sentiment,
        
        -- Recent metrics
        AVG(h.momentum_score) FILTER (WHERE h.snapshot_date >= CURRENT_DATE - 7) as momentum_7d,
        AVG(h.momentum_score) FILTER (WHERE h.snapshot_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 7) as momentum_7d_prior,
        
        -- Trend
        CASE 
            WHEN AVG(h.momentum_score) FILTER (WHERE h.snapshot_date >= CURRENT_DATE - 7) > 
                 AVG(h.momentum_score) FILTER (WHERE h.snapshot_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 7)
            THEN 'increasing'
            WHEN AVG(h.momentum_score) FILTER (WHERE h.snapshot_date >= CURRENT_DATE - 7) < 
                 AVG(h.momentum_score) FILTER (WHERE h.snapshot_date BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE - 7)
            THEN 'decreasing'
            ELSE 'stable'
        END as trend_direction
        
    FROM narrative_themes t
    LEFT JOIN narrative_theme_history h ON t.id = h.theme_id
    WHERE t.is_active = true
    GROUP BY t.id, t.theme_name, t.theme_category
)
SELECT 
    *,
    CASE 
        WHEN momentum_7d > 70 AND trend_direction = 'increasing' THEN 'hot'
        WHEN momentum_7d > 50 AND trend_direction = 'increasing' THEN 'warming'
        WHEN momentum_7d < 30 AND trend_direction = 'decreasing' THEN 'cooling'
        WHEN momentum_7d < 20 THEN 'cold'
        ELSE 'stable'
    END as temperature,
    NOW() as last_updated
FROM theme_metrics;

CREATE UNIQUE INDEX idx_mv_theme_momentum_id ON mv_theme_momentum(id);
CREATE INDEX idx_mv_theme_momentum_hot ON mv_theme_momentum(momentum_7d DESC) WHERE trend_direction = 'increasing';

-- =====================================================
-- PART 8: PERFORMANCE INDEXES
-- =====================================================

-- Intelligence metrics indexes
CREATE INDEX idx_intelligence_metrics_lookup ON intelligence_metrics(metric_type, entity_id, metric_timestamp DESC);
CREATE INDEX idx_intelligence_metrics_anomalies ON intelligence_metrics(metric_timestamp DESC) WHERE is_anomaly = true;
CREATE INDEX idx_intelligence_metrics_entity_time ON intelligence_metrics(entity_id, metric_timestamp DESC);

-- Pattern indexes
CREATE INDEX idx_patterns_active ON detected_patterns(pattern_type, is_anomaly, detection_date DESC);
CREATE INDEX idx_patterns_entity ON detected_patterns(primary_entity_id, detection_date DESC);
CREATE INDEX idx_patterns_severity ON detected_patterns(anomaly_severity, detection_date DESC) WHERE is_anomaly = true;

-- Correlation indexes
CREATE INDEX idx_correlations_lookup ON entity_correlations(entity_a_id, entity_b_id, correlation_type);
CREATE INDEX idx_correlations_significant ON entity_correlations(correlation_type, ABS(correlation_value) DESC) WHERE is_significant = true;

-- Theme indexes
CREATE INDEX idx_themes_momentum ON narrative_themes(momentum_score DESC) WHERE is_active = true;
CREATE INDEX idx_themes_emerging ON narrative_themes(momentum_change_7d DESC) WHERE is_emerging = true;
CREATE INDEX idx_theme_history_lookup ON narrative_theme_history(theme_id, snapshot_date DESC);

-- Forecast indexes
CREATE INDEX idx_forecasts_lookup ON forecast_results(entity_id, target_date, forecast_date DESC);
CREATE INDEX idx_forecasts_model ON forecast_results(model_id, forecast_date DESC);

-- Alert indexes
CREATE INDEX idx_alert_rules_active ON intelligence_alert_rules(target_metric) WHERE is_active = true;
CREATE INDEX idx_alerts_unack ON intelligence_alerts(created_at DESC) WHERE is_acknowledged = false;

-- =====================================================
-- PART 9: TRIGGER FUNCTIONS
-- =====================================================

-- Auto-refresh materialized views
CREATE OR REPLACE FUNCTION refresh_intelligence_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_intelligence;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_entity_network_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_theme_momentum;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every hour
SELECT cron.schedule(
    'refresh-intelligence-views',
    '0 * * * *', -- Every hour
    $$SELECT refresh_intelligence_views()$$
);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE kg_graph_layouts IS 'Stores graph visualization layouts and configurations';
COMMENT ON TABLE intelligence_metrics IS 'Time-series intelligence metrics for entities';
COMMENT ON TABLE detected_patterns IS 'Detected patterns and anomalies in entity behavior';
COMMENT ON TABLE entity_correlations IS 'Statistical correlations between entities';
COMMENT ON TABLE narrative_themes IS 'Tracked narrative themes and their momentum';
COMMENT ON TABLE prediction_models IS 'Registry of ML models for predictions';
COMMENT ON TABLE forecast_results IS 'Model predictions and forecasts';
COMMENT ON MATERIALIZED VIEW mv_entity_intelligence IS 'Pre-computed entity intelligence metrics for dashboard';
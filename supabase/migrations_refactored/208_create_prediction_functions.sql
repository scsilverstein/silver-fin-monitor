-- Create prediction evaluation and tracking functions
-- Functions for prediction accuracy and performance analysis

-- Function to evaluate prediction accuracy
CREATE OR REPLACE FUNCTION evaluate_prediction_accuracy(prediction_uuid UUID) RETURNS DECIMAL(5, 4) AS $$
DECLARE
    pred_record RECORD;
    actual_outcome JSONB;
    accuracy_score DECIMAL(5, 4) := 0;
    evaluation_date DATE;
BEGIN
    -- Get prediction details
    SELECT * INTO pred_record 
    FROM predictions 
    WHERE id = prediction_uuid AND is_evaluated = false;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Determine evaluation date based on time horizon
    evaluation_date := CASE pred_record.time_horizon
        WHEN '1_week' THEN pred_record.created_at::DATE + INTERVAL '7 days'
        WHEN '1_month' THEN pred_record.created_at::DATE + INTERVAL '30 days'
        WHEN '3_months' THEN pred_record.created_at::DATE + INTERVAL '90 days'
        WHEN '6_months' THEN pred_record.created_at::DATE + INTERVAL '180 days'
        WHEN '1_year' THEN pred_record.created_at::DATE + INTERVAL '365 days'
        ELSE pred_record.created_at::DATE + INTERVAL '30 days'
    END;
    
    -- Only evaluate if enough time has passed
    IF CURRENT_DATE < evaluation_date THEN
        RETURN NULL;
    END IF;
    
    -- Evaluate based on prediction type
    CASE pred_record.prediction_type
        WHEN 'market_direction' THEN
            -- Market direction prediction
            WITH market_change AS (
                SELECT 
                    (AVG(close) - AVG(LAG(close) OVER (ORDER BY date))) / AVG(LAG(close) OVER (ORDER BY date)) * 100 as change_pct
                FROM stock_data 
                WHERE date BETWEEN pred_record.created_at::DATE AND evaluation_date
                AND symbol IN ('SPY', 'QQQ', 'IWM')  -- Major market indices
            )
            SELECT 
                CASE 
                    WHEN (pred_record.prediction_data->>'direction' = 'up' AND mc.change_pct > 0) OR
                         (pred_record.prediction_data->>'direction' = 'down' AND mc.change_pct < 0) THEN 1.0
                    ELSE 0.0
                END INTO accuracy_score
            FROM market_change mc;
            
        WHEN 'stock_price' THEN
            -- Stock price prediction
            DECLARE
                predicted_price DECIMAL(10, 4);
                actual_price DECIMAL(10, 4);
                price_error DECIMAL(10, 4);
            BEGIN
                predicted_price := (pred_record.prediction_data->>'target_price')::DECIMAL(10, 4);
                
                SELECT close INTO actual_price 
                FROM stock_data 
                WHERE symbol = (pred_record.prediction_data->>'symbol')::VARCHAR(20)
                AND date <= evaluation_date
                ORDER BY date DESC LIMIT 1;
                
                IF actual_price IS NOT NULL AND predicted_price > 0 THEN
                    price_error := ABS(actual_price - predicted_price) / predicted_price;
                    accuracy_score := GREATEST(0, 1 - price_error);
                END IF;
            END;
            
        WHEN 'earnings_surprise' THEN
            -- Earnings surprise prediction
            WITH earnings_actual AS (
                SELECT surprise_percent
                FROM earnings_data ed
                JOIN entities e ON e.symbol = ed.symbol
                WHERE e.id = (pred_record.prediction_data->>'entity_id')::UUID
                AND ed.report_date BETWEEN pred_record.created_at::DATE AND evaluation_date
                ORDER BY ed.report_date DESC
                LIMIT 1
            )
            SELECT 
                CASE 
                    WHEN (pred_record.prediction_data->>'direction' = 'beat' AND ea.surprise_percent > 0) OR
                         (pred_record.prediction_data->>'direction' = 'miss' AND ea.surprise_percent < 0) THEN 1.0
                    ELSE 0.0
                END INTO accuracy_score
            FROM earnings_actual ea;
            
        ELSE
            -- Default: text similarity evaluation (simplified)
            accuracy_score := 0.5;  -- Average score for qualitative predictions
    END CASE;
    
    -- Update prediction with evaluation results
    UPDATE predictions 
    SET 
        is_evaluated = true,
        accuracy_score = accuracy_score,
        evaluation_date = evaluation_date,
        actual_outcome = jsonb_build_object(
            'evaluation_date', evaluation_date,
            'accuracy_score', accuracy_score,
            'evaluation_method', pred_record.prediction_type
        )
    WHERE id = prediction_uuid;
    
    RETURN accuracy_score;
END;
$$ LANGUAGE plpgsql;

-- Function to batch evaluate predictions
CREATE OR REPLACE FUNCTION evaluate_due_predictions() RETURNS TABLE (
    prediction_id UUID,
    prediction_type VARCHAR(100),
    time_horizon VARCHAR(50),
    accuracy_score DECIMAL(5, 4),
    evaluation_success BOOLEAN
) AS $$
DECLARE
    pred_record RECORD;
    eval_result DECIMAL(5, 4);
BEGIN
    -- Find predictions ready for evaluation
    FOR pred_record IN 
        SELECT * FROM predictions 
        WHERE is_evaluated = false
        AND created_at <= NOW() - CASE time_horizon
            WHEN '1_week' THEN INTERVAL '7 days'
            WHEN '1_month' THEN INTERVAL '30 days'
            WHEN '3_months' THEN INTERVAL '90 days'
            WHEN '6_months' THEN INTERVAL '180 days'
            WHEN '1_year' THEN INTERVAL '365 days'
            ELSE INTERVAL '30 days'
        END
    LOOP
        -- Evaluate prediction
        eval_result := evaluate_prediction_accuracy(pred_record.id);
        
        -- Return result
        RETURN QUERY SELECT 
            pred_record.id,
            pred_record.prediction_type,
            pred_record.time_horizon,
            eval_result,
            (eval_result IS NOT NULL);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate prediction accuracy statistics
CREATE OR REPLACE FUNCTION get_prediction_accuracy_stats(
    time_horizon_filter VARCHAR(50) DEFAULT NULL,
    prediction_type_filter VARCHAR(100) DEFAULT NULL,
    days_back INTEGER DEFAULT 365
) RETURNS TABLE (
    prediction_type VARCHAR(100),
    time_horizon VARCHAR(50),
    total_predictions INTEGER,
    evaluated_predictions INTEGER,
    avg_accuracy DECIMAL(5, 4),
    accuracy_trend VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH prediction_stats AS (
        SELECT 
            p.prediction_type,
            p.time_horizon,
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE p.is_evaluated = true) as evaluated_count,
            AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true) as avg_score,
            -- Calculate trend (recent vs older predictions)
            AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true AND p.created_at >= CURRENT_DATE - INTERVAL '30 days') as recent_avg,
            AVG(p.accuracy_score) FILTER (WHERE p.is_evaluated = true AND p.created_at < CURRENT_DATE - INTERVAL '30 days') as older_avg
        FROM predictions p
        WHERE p.created_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
        AND (time_horizon_filter IS NULL OR p.time_horizon = time_horizon_filter)
        AND (prediction_type_filter IS NULL OR p.prediction_type = prediction_type_filter)
        GROUP BY p.prediction_type, p.time_horizon
    )
    SELECT 
        ps.prediction_type,
        ps.time_horizon,
        ps.total_count::INTEGER,
        ps.evaluated_count::INTEGER,
        ps.avg_score::DECIMAL(5, 4),
        CASE 
            WHEN ps.recent_avg > ps.older_avg + 0.05 THEN 'improving'
            WHEN ps.recent_avg < ps.older_avg - 0.05 THEN 'declining'
            ELSE 'stable'
        END as trend
    FROM prediction_stats ps
    ORDER BY ps.prediction_type, ps.time_horizon;
END;
$$ LANGUAGE plpgsql;

-- Function to get prediction calibration data
CREATE OR REPLACE FUNCTION get_prediction_calibration(
    confidence_buckets INTEGER DEFAULT 10
) RETURNS TABLE (
    confidence_bucket INTEGER,
    predicted_confidence DECIMAL(5, 2),
    actual_accuracy DECIMAL(5, 2),
    prediction_count INTEGER,
    calibration_error DECIMAL(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH calibration_data AS (
        SELECT 
            FLOOR(confidence_level / (100.0 / confidence_buckets)) + 1 as bucket,
            confidence_level,
            accuracy_score,
            COUNT(*) as count
        FROM predictions 
        WHERE is_evaluated = true 
        AND confidence_level IS NOT NULL 
        AND accuracy_score IS NOT NULL
        GROUP BY FLOOR(confidence_level / (100.0 / confidence_buckets)) + 1, confidence_level, accuracy_score
    )
    SELECT 
        cd.bucket::INTEGER,
        AVG(cd.confidence_level)::DECIMAL(5, 2) as avg_confidence,
        AVG(cd.accuracy_score * 100)::DECIMAL(5, 2) as avg_accuracy,
        SUM(cd.count)::INTEGER as total_count,
        ABS(AVG(cd.confidence_level) - AVG(cd.accuracy_score * 100))::DECIMAL(5, 2) as cal_error
    FROM calibration_data cd
    GROUP BY cd.bucket
    ORDER BY cd.bucket;
END;
$$ LANGUAGE plpgsql;

-- Function to create prediction comparison
CREATE OR REPLACE FUNCTION create_prediction_comparison(
    current_analysis_uuid UUID,
    comparison_date DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
    comparison_count INTEGER := 0;
    pred_record RECORD;
    accuracy DECIMAL(5, 4);
BEGIN
    -- Find predictions that should be compared
    FOR pred_record IN 
        SELECT * FROM predictions p
        WHERE p.daily_analysis_id IN (
            SELECT id FROM daily_analysis 
            WHERE analysis_date = comparison_date - CASE p.time_horizon
                WHEN '1_week' THEN INTERVAL '7 days'
                WHEN '1_month' THEN INTERVAL '30 days'
                WHEN '3_months' THEN INTERVAL '90 days'
                WHEN '6_months' THEN INTERVAL '180 days'
                WHEN '1_year' THEN INTERVAL '365 days'
                ELSE INTERVAL '30 days'
            END
        )
        AND NOT EXISTS (
            SELECT 1 FROM prediction_comparisons pc
            WHERE pc.previous_prediction_id = p.id
            AND pc.comparison_date = comparison_date
        )
    LOOP
        -- Evaluate prediction accuracy
        accuracy := evaluate_prediction_accuracy(pred_record.id);
        
        IF accuracy IS NOT NULL THEN
            -- Create comparison record
            INSERT INTO prediction_comparisons (
                comparison_date,
                previous_prediction_id,
                current_analysis_id,
                accuracy_score,
                outcome_description,
                comparison_analysis
            ) VALUES (
                comparison_date,
                pred_record.id,
                current_analysis_uuid,
                accuracy,
                'Prediction evaluated against actual outcome',
                jsonb_build_object(
                    'prediction_text', pred_record.prediction_text,
                    'confidence_level', pred_record.confidence_level,
                    'time_horizon', pred_record.time_horizon,
                    'accuracy_score', accuracy
                )
            );
            
            comparison_count := comparison_count + 1;
        END IF;
    END LOOP;
    
    RETURN comparison_count;
END;
$$ LANGUAGE plpgsql;

-- Add function comments
COMMENT ON FUNCTION evaluate_prediction_accuracy IS 'Evaluate accuracy of a specific prediction';
COMMENT ON FUNCTION evaluate_due_predictions IS 'Batch evaluate all predictions ready for evaluation';
COMMENT ON FUNCTION get_prediction_accuracy_stats IS 'Get prediction accuracy statistics with trends';
COMMENT ON FUNCTION get_prediction_calibration IS 'Analyze prediction confidence calibration';
COMMENT ON FUNCTION create_prediction_comparison IS 'Create prediction comparison records';
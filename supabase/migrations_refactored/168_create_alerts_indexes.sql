-- Create indexes for alerts table
-- Optimize alert queries and delivery

-- Index for user's active alerts
CREATE INDEX IF NOT EXISTS idx_alerts_user_active 
ON alerts(user_id, is_active, created_at DESC) 
WHERE is_active = true;

-- Index for alert type and status
CREATE INDEX IF NOT EXISTS idx_alerts_type_status 
ON alerts(alert_type, status, created_at DESC);

-- Index for symbol-based alerts
CREATE INDEX IF NOT EXISTS idx_alerts_symbol 
ON alerts(symbol, is_active, alert_type) 
WHERE is_active = true AND symbol IS NOT NULL;

-- Index for pending alerts
CREATE INDEX IF NOT EXISTS idx_alerts_pending 
ON alerts(status, next_check_at) 
WHERE status = 'pending' AND is_active = true;

-- Index for triggered alerts
CREATE INDEX IF NOT EXISTS idx_alerts_triggered 
ON alerts(user_id, triggered_at DESC) 
WHERE status = 'triggered';

-- JSONB index for conditions
CREATE INDEX IF NOT EXISTS idx_alerts_conditions 
ON alerts USING GIN(conditions);

-- Index for notification delivery
CREATE INDEX IF NOT EXISTS idx_alerts_notifications 
ON alerts(status, (metadata->>'notifications_sent')::int) 
WHERE status = 'triggered' AND (metadata->>'notifications_sent')::int < 3;

-- Index for alert expiry
CREATE INDEX IF NOT EXISTS idx_alerts_expiry 
ON alerts(expires_at) 
WHERE is_active = true AND expires_at IS NOT NULL;

-- Add index comments
COMMENT ON INDEX idx_alerts_user_active IS 'User active alerts lookup';
COMMENT ON INDEX idx_alerts_type_status IS 'Filter by type and status';
COMMENT ON INDEX idx_alerts_symbol IS 'Symbol-specific alerts';
COMMENT ON INDEX idx_alerts_pending IS 'Alerts awaiting check';
COMMENT ON INDEX idx_alerts_triggered IS 'User triggered alert history';
COMMENT ON INDEX idx_alerts_conditions IS 'Query alert conditions';
COMMENT ON INDEX idx_alerts_notifications IS 'Retry notification delivery';
COMMENT ON INDEX idx_alerts_expiry IS 'Clean up expired alerts';
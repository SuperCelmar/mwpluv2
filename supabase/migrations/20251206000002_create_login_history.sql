-- Migration: Create login_history table
-- Stores login attempts and session history for security monitoring
-- Part of the Profile and Settings pages implementation

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Login details
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT, -- e.g., 'desktop', 'mobile', 'tablet'
  location TEXT, -- e.g., 'Paris, France' (optional, can be derived from IP)
  
  -- Login result
  success BOOLEAN NOT NULL DEFAULT true,
  failure_reason TEXT, -- e.g., 'Invalid password', 'Account suspended'
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_success ON login_history(user_id, success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at DESC);

-- Row Level Security
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own login history
CREATE POLICY "Users can view own login history"
  ON login_history FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert login history (via trigger or function)
CREATE POLICY "System can create login history"
  ON login_history FOR INSERT
  WITH CHECK (true); -- Allow inserts, but RLS will filter on SELECT

-- Note: Login history should be inserted via a trigger on auth.users or auth.sessions
-- For now, we'll rely on application-level logging
-- Future enhancement: Create trigger to log successful logins automatically

-- Comments for documentation
COMMENT ON TABLE login_history IS 'Login attempts and session history for security monitoring and user awareness';
COMMENT ON COLUMN login_history.device_type IS 'Device type: desktop, mobile, tablet, etc.';
COMMENT ON COLUMN login_history.location IS 'Geographic location derived from IP (optional)';
COMMENT ON COLUMN login_history.failure_reason IS 'Reason for failed login attempt (if success = false)';


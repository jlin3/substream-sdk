-- Substream SDK Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stream sessions table
CREATE TABLE IF NOT EXISTS stream_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  connection_id VARCHAR(255) UNIQUE,
  room_name VARCHAR(255),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stream viewers table
CREATE TABLE IF NOT EXISTS stream_viewers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(255),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stream recordings table
CREATE TABLE IF NOT EXISTS stream_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES stream_sessions(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  duration INTEGER, -- in seconds
  file_size BIGINT, -- in bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON stream_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON stream_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON stream_sessions(status, ended_at) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_viewers_session_id ON stream_viewers(session_id);
CREATE INDEX IF NOT EXISTS idx_viewers_user_id ON stream_viewers(user_id);

CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON stream_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON stream_recordings(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_stream_sessions_updated_at
    BEFORE UPDATE ON stream_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stream_recordings_updated_at
    BEFORE UPDATE ON stream_recordings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) - Optional but recommended
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth setup)
-- Note: If you're using your own JWT auth (not Supabase auth), you may need to adjust these

-- Allow authenticated users to read all sessions
CREATE POLICY "Allow read access to all sessions"
  ON stream_sessions FOR SELECT
  USING (true);

-- Allow users to create their own sessions
CREATE POLICY "Allow users to create their own sessions"
  ON stream_sessions FOR INSERT
  WITH CHECK (true);

-- Allow users to update their own sessions
CREATE POLICY "Allow users to update their own sessions"
  ON stream_sessions FOR UPDATE
  USING (true);

-- Allow read access to viewers
CREATE POLICY "Allow read access to viewers"
  ON stream_viewers FOR SELECT
  USING (true);

-- Allow inserting viewers
CREATE POLICY "Allow inserting viewers"
  ON stream_viewers FOR INSERT
  WITH CHECK (true);

-- Allow read access to recordings
CREATE POLICY "Allow read access to recordings"
  ON stream_recordings FOR SELECT
  USING (true);

-- Allow inserting recordings
CREATE POLICY "Allow inserting recordings"
  ON stream_recordings FOR INSERT
  WITH CHECK (true);

-- Optional: Create a view for active streams with viewer count
CREATE OR REPLACE VIEW active_streams AS
SELECT 
  s.id,
  s.user_id,
  s.room_name,
  s.started_at,
  s.metadata,
  COUNT(DISTINCT v.id) FILTER (WHERE v.left_at IS NULL) as active_viewers
FROM stream_sessions s
LEFT JOIN stream_viewers v ON s.id = v.session_id
WHERE s.status = 'active' AND s.ended_at IS NULL
GROUP BY s.id, s.user_id, s.room_name, s.started_at, s.metadata
ORDER BY s.started_at DESC;

-- Optional: Create a function to get session statistics
CREATE OR REPLACE FUNCTION get_session_stats(session_uuid UUID)
RETURNS TABLE (
  total_viewers BIGINT,
  avg_watch_duration INTEGER,
  recording_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT v.id)::BIGINT as total_viewers,
    COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(v.left_at, NOW()) - v.joined_at)))::INTEGER, 0) as avg_watch_duration,
    COUNT(DISTINCT r.id)::BIGINT as recording_count
  FROM stream_sessions s
  LEFT JOIN stream_viewers v ON s.id = v.session_id
  LEFT JOIN stream_recordings r ON s.id = r.session_id
  WHERE s.id = session_uuid
  GROUP BY s.id;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing (optional - remove in production)
-- INSERT INTO stream_sessions (user_id, connection_id, room_name, status)
-- VALUES 
--   ('test-user-1', 'conn-123', 'stream-test-1', 'active'),
--   ('test-user-2', 'conn-456', 'stream-test-2', 'ended');

COMMENT ON TABLE stream_sessions IS 'Stores VR streaming session information';
COMMENT ON TABLE stream_viewers IS 'Tracks viewers watching each streaming session';
COMMENT ON TABLE stream_recordings IS 'Stores references to recorded stream files in S3';


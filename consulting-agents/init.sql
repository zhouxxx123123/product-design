-- Initialize database schema for consulting-agents platform

-- Sessions table for debate sessions
CREATE TABLE IF NOT EXISTS sessions (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table for debate messages
CREATE TABLE IF NOT EXISTS messages (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent memories table
CREATE TABLE IF NOT EXISTS memories (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Evolution proposals table
CREATE TABLE IF NOT EXISTS evolution (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync log table
CREATE TABLE IF NOT EXISTS _sync_log (
    key VARCHAR PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages ((data->>'session_id'));
CREATE INDEX IF NOT EXISTS idx_messages_round ON messages ((data->>'round_number'));
CREATE INDEX IF NOT EXISTS idx_evolution_agent ON evolution ((data->>'agent_id'));
CREATE INDEX IF NOT EXISTS idx_evolution_status ON evolution ((data->>'status'));
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs ((data->>'action'));
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs ((data->>'timestamp'));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_evolution_updated_at ON evolution;
CREATE TRIGGER update_evolution_updated_at BEFORE UPDATE ON evolution
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

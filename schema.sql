-- =============================================================================
-- 调研工具 (Research Tool) — Production PostgreSQL Schema
-- Client: 中科琉光 (Zhongke Liuguang) Management Consulting
-- DB Engine: PostgreSQL 15+
-- Generated: 2026-03-09
-- =============================================================================
--
-- DESIGN DECISIONS (top-level):
--
-- 1. UUID PKs everywhere (gen_random_uuid()) — avoids enumeration attacks,
--    safe for distributed inserts, and aligns with TypeORM's uuid strategy.
--
-- 2. Multi-tenancy via tenant_id column on every business table (NOT schema
--    separation). Simpler to maintain with 29 tenants; RLS policies enforce
--    isolation at the DB layer as a second line of defense after app-layer
--    guards.  Zhongke Liuguang's own tenant row is special-cased in RLS via
--    a helper function is_super_tenant().
--
-- 3. JSONB for AI outputs and flexible metadata. Avoids premature schema
--    commitment on LLM output formats that will evolve. GIN indexes on JSONB
--    columns enable fast key-path queries without full table scans.
--
-- 4. Soft deletes (deleted_at TIMESTAMPTZ) on tenant/user/case data so that
--    historical sessions referencing deleted entities remain coherent.
--    Hard deletes are reserved for truly transient or PII-scrubbed data.
--
-- 5. Three-layer information model reflected in separate nullable columns on
--    interview_sessions: raw transcript → structured_summary (JSONB) →
--    executive_summary (JSONB). Kept on the same table to avoid joins for
--    the most common read path (session detail page).
--
-- 6. audit_logs uses an append-only pattern (no updated_at, no soft delete).
--    A partial index on (tenant_id, created_at) covers the common query
--    "show audit trail for tenant X in the last 30 days".
--
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram indexes for LIKE search on names/titles
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- composite GIN indexes
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector for semantic similarity search

-- =============================================================================
-- ENUMERATIONS
-- Using PostgreSQL native ENUMs for columns with a fixed, known value set.
-- This gives CHECK-constraint safety with O(1) storage and readable values
-- in query results without needing a lookup table join.
-- =============================================================================

CREATE TYPE user_role AS ENUM (
    'ADMIN',   -- Zhongke Liuguang staff: full access, manage tenants/templates/cases
    'SALES',   -- Channel company sales rep: conduct interviews, view own org data
    'EXPERT'   -- Zhongke Liuguang consultant: read all sessions, author solutions
);

CREATE TYPE session_status AS ENUM (
    'DRAFT',        -- outline generated, interview not started
    'IN_PROGRESS',  -- interview actively running
    'COMPLETED',    -- interview finished, pending AI processing
    'PROCESSED',    -- all AI layers produced (summary, insights)
    'ARCHIVED'      -- soft-archived, hidden from default lists
);

CREATE TYPE priority_level AS ENUM (
    'P0',  -- must-have / critical pain
    'P1',  -- important
    'P2'   -- nice-to-have
);

CREATE TYPE recording_status AS ENUM (
    'UPLOADING',    -- client is streaming/uploading
    'PENDING_ASR',  -- upload done, awaiting Tencent ASR job
    'TRANSCRIBING', -- ASR job running
    'DONE',         -- final transcript available
    'FAILED'        -- ASR failed; may retry
);

CREATE TYPE suggestion_type AS ENUM (
    'FOLLOW_UP',     -- AI-generated follow-up question during live interview
    'CLARIFICATION', -- prompt to clarify an ambiguous answer
    'DEEP_DIVE'      -- prompt to explore a topic further
);

CREATE TYPE insight_layer AS ENUM (
    'LAYER_1_RAW',        -- timestamped transcript clip
    'LAYER_2_STRUCTURED', -- structured pain point per department
    'LAYER_3_EXECUTIVE'   -- top-level insight / meta-need / solution direction
);

-- =============================================================================
-- TENANTS
-- One row = one channel company (渠道商) OR Zhongke Liuguang itself.
-- is_super_tenant = TRUE only for Zhongke Liuguang's own row.
-- =============================================================================

-- RLS: ADMIN can read/write all. SALES/EXPERT can only read their own tenant row.

CREATE TABLE tenants (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT        NOT NULL,                       -- display name, e.g. "中科琉光"
    short_code        TEXT        NOT NULL UNIQUE,               -- URL-safe slug, e.g. "zklyg"
    is_super_tenant   BOOLEAN     NOT NULL DEFAULT FALSE,        -- TRUE = Zhongke Liuguang
    contact_email     TEXT,
    contact_phone     TEXT,
    metadata          JSONB       NOT NULL DEFAULT '{}',         -- arbitrary org settings
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ                                -- soft delete
);

-- Helper function used inside RLS policies to identify super-tenant sessions.
-- Reads from JWT claim 'tenant_id' set by the NestJS auth layer via SET LOCAL.
CREATE OR REPLACE FUNCTION is_super_tenant() RETURNS BOOLEAN
    LANGUAGE sql STABLE SECURITY DEFINER AS
$$
    SELECT EXISTS (
        SELECT 1 FROM tenants
        WHERE id = current_setting('app.current_tenant_id', TRUE)::UUID
          AND is_super_tenant = TRUE
          AND deleted_at IS NULL
    );
$$;

CREATE INDEX idx_tenants_short_code  ON tenants (short_code);
CREATE INDEX idx_tenants_deleted_at  ON tenants (deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- USERS
-- Users belong to exactly one tenant. Role determines capabilities.
-- A Zhongke Liuguang staff member has tenant_id = Zhongke Liuguang's tenant UUID.
-- =============================================================================

-- RLS: Users can see/modify only their own row. ADMINs of same tenant can see
--      all users in that tenant. Super-tenant ADMINs see all.

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),
    email           TEXT        NOT NULL UNIQUE,
    display_name    TEXT        NOT NULL,
    password_hash   TEXT        NOT NULL,           -- bcrypt/argon2 hash; never plaintext
    role            user_role   NOT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    metadata        JSONB       NOT NULL DEFAULT '{}',  -- e.g. avatar_url, preferences
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_tenant_id   ON users (tenant_id);
CREATE INDEX idx_users_email       ON users (email);
CREATE INDEX idx_users_role        ON users (tenant_id, role);  -- "list all SALES in tenant X"
CREATE INDEX idx_users_deleted_at  ON users (deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- USER_ROLES (supplementary permission log)
-- Primary role lives on users.role. This table records historical role changes
-- and supports future multi-role expansion without altering the core ENUM.
-- =============================================================================

CREATE TABLE user_role_history (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES users(id),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),  -- denormalized for RLS
    old_role        user_role,
    new_role        user_role   NOT NULL,
    changed_by      UUID        REFERENCES users(id),             -- NULL = system
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No updated_at: append-only audit log
);

CREATE INDEX idx_user_role_history_user   ON user_role_history (user_id, created_at DESC);
CREATE INDEX idx_user_role_history_tenant ON user_role_history (tenant_id, created_at DESC);

-- =============================================================================
-- CLIENT_PROFILES
-- The target company being interviewed. One profile per engagement.
-- A tenant (channel company) owns the profile; multiple sessions may
-- reference the same client over time (repeat interviews / follow-ups).
-- =============================================================================

-- RLS: tenant-scoped. Super-tenant ADMIN/EXPERT can read all.

CREATE TABLE client_profiles (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),
    company_name    TEXT        NOT NULL,
    industry        TEXT        NOT NULL,   -- e.g. "医疗器械", "重工制造", "贸易"
    company_size    TEXT,                   -- headcount band, e.g. "500-2000"
    region          TEXT,                   -- province / city
    contact_name    TEXT,
    contact_title   TEXT,
    contact_phone   TEXT,
    contact_email   TEXT,
    erp_system      TEXT,                   -- current ERP in use, if known
    metadata        JSONB       NOT NULL DEFAULT '{}',   -- any extra fields
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_client_profiles_tenant     ON client_profiles (tenant_id);
CREATE INDEX idx_client_profiles_industry   ON client_profiles (tenant_id, industry);
-- Full-text search on company name (Chinese + pinyin handled by pg_trgm)
CREATE INDEX idx_client_profiles_name_trgm  ON client_profiles USING GIN (company_name gin_trgm_ops);
CREATE INDEX idx_client_profiles_deleted_at ON client_profiles (deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- OUTLINE_TEMPLATES
-- AI-generated or manually curated interview outlines.
-- Scoped by (industry, department). Can be owned by a specific tenant (private)
-- or by the super-tenant (shared library available to all).
-- =============================================================================

-- RLS: If tenant_id = super-tenant → visible to all. Else → own tenant only.

CREATE TABLE outline_templates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id), -- owner; super-tenant = shared
    title           TEXT        NOT NULL,
    industry        TEXT        NOT NULL,       -- target industry
    department      TEXT        NOT NULL,       -- target department, e.g. "采购部", "财务部"
    version         INTEGER     NOT NULL DEFAULT 1,
    is_published    BOOLEAN     NOT NULL DEFAULT FALSE,  -- draft vs. live
    content         JSONB       NOT NULL,
    -- content shape: { sections: [{ title, questions: [{ id, text, hint }] }] }
    ai_generated    BOOLEAN     NOT NULL DEFAULT FALSE,
    source_model    TEXT,                       -- e.g. "kimi-k2.5"
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_outline_templates_tenant      ON outline_templates (tenant_id);
CREATE INDEX idx_outline_templates_industry    ON outline_templates (industry, department);
CREATE INDEX idx_outline_templates_published   ON outline_templates (is_published) WHERE is_published = TRUE;
-- GIN index so queries like "all templates mentioning '采购'" work efficiently
CREATE INDEX idx_outline_templates_content_gin ON outline_templates USING GIN (content);

-- =============================================================================
-- INTERVIEW_SESSIONS
-- Central table. One session = one structured interview with one client company.
-- Holds all three information layers as JSONB on the same row.
-- =============================================================================

-- RLS: SALES sees only sessions where tenant_id = own tenant AND
--      (created_by = self OR is assigned to them).
--      EXPERT + super-tenant ADMIN see all sessions.

CREATE TABLE interview_sessions (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL REFERENCES tenants(id),
    client_profile_id   UUID            NOT NULL REFERENCES client_profiles(id),
    created_by          UUID            NOT NULL REFERENCES users(id),   -- the SALES rep
    assigned_expert_id  UUID            REFERENCES users(id),            -- optional EXPERT reviewer
    outline_template_id UUID            REFERENCES outline_templates(id),
    status              session_status  NOT NULL DEFAULT 'DRAFT',
    title               TEXT            NOT NULL,   -- e.g. "XX公司2026-03采购部调研"
    scheduled_at        TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,

    -- Layer 1: Raw transcript and audio clips are stored in child tables
    --           (transcriptions, recordings). This column holds the merged
    --           full-text transcript string for FTS, populated post-ASR.
    full_transcript     TEXT,

    -- Layer 2: Structured pain points per department, produced by Kimi-k2.5
    --           after session completion.
    -- Shape: { departments: [{ name, pain_points: [{ description, severity, quote }] }] }
    structured_summary  JSONB,

    -- Layer 3: Executive summary for decision-makers, also from Kimi-k2.5.
    -- Shape: { top_insights: [...], meta_needs: [...], solution_direction: "..." }
    executive_summary   JSONB,

    metadata            JSONB           NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_sessions_tenant         ON interview_sessions (tenant_id);
CREATE INDEX idx_sessions_client         ON interview_sessions (client_profile_id);
CREATE INDEX idx_sessions_created_by     ON interview_sessions (created_by);
CREATE INDEX idx_sessions_status         ON interview_sessions (tenant_id, status);
CREATE INDEX idx_sessions_scheduled_at   ON interview_sessions (tenant_id, scheduled_at DESC);
-- FTS on full transcript (Chinese tokenization via pg_trgm; consider pg_jieba in production)
CREATE INDEX idx_sessions_transcript_trgm ON interview_sessions USING GIN (full_transcript gin_trgm_ops)
    WHERE full_transcript IS NOT NULL;
CREATE INDEX idx_sessions_deleted_at     ON interview_sessions (deleted_at) WHERE deleted_at IS NULL;

-- =============================================================================
-- INTERVIEW_DEPARTMENTS
-- A session covers one or more departments (e.g. 采购部, 财务部, IT部).
-- Each department is interviewed in its own "block" within a session.
-- Ordering is preserved for the UI multi-step flow.
-- =============================================================================

CREATE TABLE interview_departments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),   -- denormalized for RLS
    department_name TEXT        NOT NULL,   -- e.g. "采购部"
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interview_depts_session ON interview_departments (session_id);
CREATE INDEX idx_interview_depts_tenant  ON interview_departments (tenant_id);

-- =============================================================================
-- INTERVIEW_QUESTIONS
-- The actual questions asked within a department block.
-- Source can be: outline template, AI-generated suggestion, or manual entry.
-- =============================================================================

CREATE TABLE interview_questions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id   UUID        NOT NULL REFERENCES interview_departments(id) ON DELETE CASCADE,
    session_id      UUID        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),   -- denormalized for RLS
    question_text   TEXT        NOT NULL,
    hint_text       TEXT,       -- AI-provided context or tips for the interviewer
    sort_order      INTEGER     NOT NULL DEFAULT 0,
    source          TEXT        NOT NULL DEFAULT 'TEMPLATE',
    -- source values: 'TEMPLATE' | 'AI_SUGGESTION' | 'MANUAL' | 'FOLLOW_UP'
    ai_suggestion_id UUID       REFERENCES ai_suggestions(id),     -- forward ref resolved below
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_department ON interview_questions (department_id);
CREATE INDEX idx_questions_session    ON interview_questions (session_id);
CREATE INDEX idx_questions_tenant     ON interview_questions (tenant_id);

-- =============================================================================
-- INTERVIEW_ANSWERS
-- Answers recorded against questions. An answer may be text (from transcript)
-- or a manual note entered by the SALES rep. Timestamped to correlate with
-- audio recordings.
-- =============================================================================

CREATE TABLE interview_answers (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id     UUID        NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
    session_id      UUID        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),   -- denormalized for RLS
    answer_text     TEXT,
    answer_start_ms BIGINT,     -- millisecond offset in recording where answer begins
    answer_end_ms   BIGINT,     -- millisecond offset where answer ends
    recording_id    UUID,       -- FK to recordings; set after upload (nullable temporarily)
    is_flagged      BOOLEAN     NOT NULL DEFAULT FALSE,  -- interviewer flagged for follow-up
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_answers_question  ON interview_answers (question_id);
CREATE INDEX idx_answers_session   ON interview_answers (session_id);
CREATE INDEX idx_answers_tenant    ON interview_answers (tenant_id);
CREATE INDEX idx_answers_recording ON interview_answers (recording_id) WHERE recording_id IS NOT NULL;

-- =============================================================================
-- RECORDINGS
-- Audio file metadata. The actual binary is stored externally (OSS/S3).
-- This table holds the reference URL and ASR status.
-- One session can have multiple recording files (e.g. per department block,
-- or if the interviewer paused and resumed).
-- =============================================================================

-- RLS: same as interview_sessions (tenant-scoped).

CREATE TABLE recordings (
    id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID             NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    tenant_id       UUID             NOT NULL REFERENCES tenants(id),
    department_id   UUID             REFERENCES interview_departments(id),  -- nullable if whole-session
    file_url        TEXT             NOT NULL,    -- external storage URL (presigned or CDN)
    file_size_bytes BIGINT,
    duration_ms     BIGINT,
    mime_type       TEXT             NOT NULL DEFAULT 'audio/webm',
    status          recording_status NOT NULL DEFAULT 'UPLOADING',
    -- Tencent ASR job tracking
    asr_task_id     TEXT,            -- job ID returned by Tencent ASR API
    asr_request_id  TEXT,            -- request ID for debugging
    asr_error_msg   TEXT,
    uploaded_at     TIMESTAMPTZ,
    asr_started_at  TIMESTAMPTZ,
    asr_finished_at TIMESTAMPTZ,
    metadata        JSONB            NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recordings_session    ON recordings (session_id);
CREATE INDEX idx_recordings_tenant     ON recordings (tenant_id);
CREATE INDEX idx_recordings_status     ON recordings (status) WHERE status != 'DONE';  -- pending only
CREATE INDEX idx_recordings_asr_task   ON recordings (asr_task_id) WHERE asr_task_id IS NOT NULL;

-- Resolve FK from interview_answers now that recordings table exists
ALTER TABLE interview_answers
    ADD CONSTRAINT fk_answers_recording
    FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL;

-- =============================================================================
-- TRANSCRIPTIONS
-- Stores both real-time streaming segments (Tencent ASR streaming mode) and
-- the final stitched transcript for a recording.
-- is_final = FALSE → interim streaming result (may be overwritten).
-- is_final = TRUE  → Tencent's confirmed final segment for this time range.
-- =============================================================================

-- RLS: same as interview_sessions.

CREATE TABLE transcriptions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id    UUID        NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    session_id      UUID        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),
    start_ms        BIGINT      NOT NULL,   -- segment start within recording
    end_ms          BIGINT      NOT NULL,
    speaker_label   TEXT,                   -- ASR diarization: "Speaker_0", "Speaker_1" etc.
    text            TEXT        NOT NULL,
    confidence      NUMERIC(5,4),           -- ASR confidence score 0.0000–1.0000
    is_final        BOOLEAN     NOT NULL DEFAULT FALSE,
    word_timestamps JSONB,
    -- Shape: [{ word, start_ms, end_ms, confidence }]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No updated_at: once written, only replaced by a later is_final segment
);

CREATE INDEX idx_transcriptions_recording ON transcriptions (recording_id, start_ms);
CREATE INDEX idx_transcriptions_session   ON transcriptions (session_id);
CREATE INDEX idx_transcriptions_tenant    ON transcriptions (tenant_id);
CREATE INDEX idx_transcriptions_final     ON transcriptions (recording_id, is_final);
-- FTS on transcription text
CREATE INDEX idx_transcriptions_text_trgm ON transcriptions USING GIN (text gin_trgm_ops);

-- =============================================================================
-- AI_SUGGESTIONS
-- Follow-up / clarification questions generated by Kimi-k2.5 in real-time
-- during an interview. The SALES rep can accept (add to questions list) or
-- dismiss each suggestion.
-- =============================================================================

-- RLS: tenant-scoped.

CREATE TABLE ai_suggestions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID            NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    department_id   UUID            REFERENCES interview_departments(id),
    tenant_id       UUID            NOT NULL REFERENCES tenants(id),
    suggestion_type suggestion_type NOT NULL DEFAULT 'FOLLOW_UP',
    question_text   TEXT            NOT NULL,
    rationale       TEXT,           -- why Kimi suggested this (shown to SALES rep)
    -- Context that triggered this suggestion
    trigger_transcript_segment_id UUID REFERENCES transcriptions(id),
    trigger_answer_id             UUID REFERENCES interview_answers(id),
    -- Lifecycle
    is_accepted     BOOLEAN,        -- NULL = pending, TRUE = used, FALSE = dismissed
    accepted_at     TIMESTAMPTZ,
    dismissed_at    TIMESTAMPTZ,
    source_model    TEXT            NOT NULL DEFAULT 'kimi-k2.5',
    prompt_tokens   INTEGER,
    completion_tokens INTEGER,
    metadata        JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_suggestions_session    ON ai_suggestions (session_id);
CREATE INDEX idx_ai_suggestions_department ON ai_suggestions (department_id);
CREATE INDEX idx_ai_suggestions_tenant     ON ai_suggestions (tenant_id);
CREATE INDEX idx_ai_suggestions_pending    ON ai_suggestions (session_id, is_accepted)
    WHERE is_accepted IS NULL;  -- "show pending suggestions" query

-- Resolve FK from interview_questions now that ai_suggestions exists
ALTER TABLE interview_questions
    ADD CONSTRAINT fk_questions_ai_suggestion
    FOREIGN KEY (ai_suggestion_id) REFERENCES ai_suggestions(id) ON DELETE SET NULL;

-- =============================================================================
-- INSIGHTS
-- AI-extracted insights at each of the three information layers.
-- Layer 1 rows point at a specific transcription clip.
-- Layer 2 rows represent a structured pain point per department.
-- Layer 3 rows represent executive-level meta-needs / solution directions.
-- All three layers are stored here; the executive_summary JSONB on
-- interview_sessions is a denormalized copy of Layer 3 for fast reads.
-- =============================================================================

-- RLS: SALES sees own tenant's sessions. EXPERT + super-tenant ADMIN see all.

CREATE TABLE insights (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID         NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    tenant_id       UUID         NOT NULL REFERENCES tenants(id),
    layer           insight_layer NOT NULL,
    department_id   UUID         REFERENCES interview_departments(id),  -- NULL for Layer 3
    -- Layer 1 fields
    transcription_id UUID        REFERENCES transcriptions(id),
    audio_clip_start_ms BIGINT,
    audio_clip_end_ms   BIGINT,
    -- Layer 2 fields
    pain_point_description TEXT,
    pain_point_severity    TEXT,    -- 'HIGH' | 'MEDIUM' | 'LOW'
    supporting_quote       TEXT,    -- verbatim from transcript
    -- Layer 3 fields
    insight_title   TEXT,
    meta_need       TEXT,
    solution_direction TEXT,
    -- Common
    content         JSONB        NOT NULL DEFAULT '{}',  -- full structured AI output
    priority        priority_level,
    source_model    TEXT         NOT NULL DEFAULT 'kimi-k2.5',
    is_validated    BOOLEAN      NOT NULL DEFAULT FALSE,  -- EXPERT reviewed/confirmed
    validated_by    UUID         REFERENCES users(id),
    validated_at    TIMESTAMPTZ,
    sort_order      INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_session     ON insights (session_id);
CREATE INDEX idx_insights_tenant      ON insights (tenant_id);
CREATE INDEX idx_insights_layer       ON insights (session_id, layer);
CREATE INDEX idx_insights_department  ON insights (department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_insights_content_gin ON insights USING GIN (content);

-- =============================================================================
-- CASES (historical client cases — 案例库)
-- Each case represents a past engagement with a real client.
-- The case library is owned/managed by Zhongke Liuguang (super-tenant).
-- Channel companies can only view cases, not modify them.
-- =============================================================================

-- RLS: All authenticated users can READ. Only super-tenant ADMIN can write.

CREATE TABLE cases (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),  -- always super-tenant
    title           TEXT        NOT NULL,      -- brief case title
    client_alias    TEXT,                      -- anonymized client name
    industry        TEXT        NOT NULL,
    company_size    TEXT,
    region          TEXT,
    erp_system      TEXT,                      -- ERP involved
    engagement_year INTEGER,
    outcome_summary TEXT,                      -- high-level result of the engagement
    tags            TEXT[]      NOT NULL DEFAULT '{}',  -- searchable tags
    is_published    BOOLEAN     NOT NULL DEFAULT FALSE,
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    embedding       vector(1536)              -- semantic embedding for similarity search (Kimi-k2.5)
);

CREATE INDEX idx_cases_tenant      ON cases (tenant_id);
CREATE INDEX idx_cases_industry    ON cases (industry);
CREATE INDEX idx_cases_published   ON cases (is_published) WHERE is_published = TRUE;
CREATE INDEX idx_cases_tags_gin    ON cases USING GIN (tags);
CREATE INDEX idx_cases_deleted_at  ON cases (deleted_at) WHERE deleted_at IS NULL;
-- ivfflat index for semantic similarity search on case embeddings (cosine distance)
CREATE INDEX idx_cases_embedding   ON cases USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- CASE_FEATURES
-- Feature-level breakdown of each case, following the 4-level hierarchy:
-- 功能域(domain) → 子系统(subsystem) → 功能点(feature_point) → 功能描述
-- =============================================================================

CREATE TABLE case_features (
    id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID           NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    tenant_id       UUID           NOT NULL REFERENCES tenants(id),  -- denormalized
    domain          TEXT           NOT NULL,    -- 功能域, e.g. "供应链管理"
    subsystem       TEXT           NOT NULL,    -- 子系统, e.g. "采购管理"
    feature_point   TEXT           NOT NULL,    -- 功能点, e.g. "供应商评估"
    description     TEXT           NOT NULL,    -- 功能描述 (detail)
    priority        priority_level NOT NULL DEFAULT 'P1',
    source          TEXT,                       -- where this feature originated
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    metadata        JSONB          NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    embedding       vector(1536)                -- semantic embedding for fine-grained similarity search
);

CREATE INDEX idx_case_features_case       ON case_features (case_id);
CREATE INDEX idx_case_features_tenant     ON case_features (tenant_id);
CREATE INDEX idx_case_features_domain     ON case_features (domain, subsystem);
CREATE INDEX idx_case_features_priority   ON case_features (case_id, priority);
-- Trigram on feature_point for fuzzy "find features like X" queries
CREATE INDEX idx_case_features_point_trgm ON case_features USING GIN (feature_point gin_trgm_ops);
-- ivfflat index for semantic similarity search on feature embeddings (cosine distance)
CREATE INDEX idx_case_features_embedding  ON case_features USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- CASE_MATCHES
-- Records which historical cases were matched to an interview session,
-- by what algorithm/model, and the match score. EXPERT can override
-- and manually add/remove matches.
-- =============================================================================

-- RLS: tenant-scoped for SALES. EXPERT + super-tenant ADMIN see all.

CREATE TABLE case_matches (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    case_id         UUID        NOT NULL REFERENCES cases(id),
    tenant_id       UUID        NOT NULL REFERENCES tenants(id),
    match_score     NUMERIC(6,4),   -- 0.0000–1.0000; NULL if manually added
    match_reason    TEXT,           -- human-readable explanation from AI
    matched_features JSONB     NOT NULL DEFAULT '[]',
    -- Shape: [{ feature_point, similarity_score, session_pain_point }]
    is_manual       BOOLEAN     NOT NULL DEFAULT FALSE,  -- manually curated by EXPERT
    is_approved     BOOLEAN,        -- NULL = pending EXPERT review
    approved_by     UUID        REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    source_model    TEXT,           -- e.g. "kimi-k2.5" or NULL for manual
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (session_id, case_id)    -- one match record per case per session
);

CREATE INDEX idx_case_matches_session   ON case_matches (session_id);
CREATE INDEX idx_case_matches_case      ON case_matches (case_id);
CREATE INDEX idx_case_matches_tenant    ON case_matches (tenant_id);
CREATE INDEX idx_case_matches_score     ON case_matches (session_id, match_score DESC);
CREATE INDEX idx_case_matches_approved  ON case_matches (session_id, is_approved)
    WHERE is_approved IS NULL;  -- pending review

-- =============================================================================
-- AUDIT_LOGS
-- Append-only record of significant actions for compliance and debugging.
-- Written by application layer (NestJS interceptor), never modified.
-- Covers: logins, tenant CRUD, session state changes, case library writes,
-- role changes, AI model calls.
-- =============================================================================

-- RLS: Super-tenant ADMIN sees all. Tenant ADMIN sees own tenant only.
--      SALES/EXPERT cannot read audit logs directly.

CREATE TABLE audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID        REFERENCES tenants(id),   -- NULL for system events
    user_id         UUID        REFERENCES users(id),     -- NULL for system events
    action          TEXT        NOT NULL,    -- e.g. "SESSION_STATUS_CHANGED", "CASE_CREATED"
    entity_type     TEXT        NOT NULL,    -- e.g. "interview_sessions", "cases"
    entity_id       UUID,                   -- PK of the affected row
    old_value       JSONB,                  -- snapshot before change (redacted if PII)
    new_value       JSONB,                  -- snapshot after change
    ip_address      INET,
    user_agent      TEXT,
    request_id      TEXT,                   -- correlation ID from HTTP request
    metadata        JSONB       NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No updated_at, no deleted_at: append-only
);

-- Partition candidate: if log volume grows large, partition by created_at monthly.
-- For now, a composite index satisfies 90%+ of queries.
CREATE INDEX idx_audit_logs_tenant     ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user       ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity     ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_action     ON audit_logs (action, created_at DESC);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- Automatically maintain updated_at on all mutable tables.
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply trigger to every table that has updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'tenants',
        'users',
        'client_profiles',
        'outline_templates',
        'interview_sessions',
        'interview_departments',
        'interview_questions',
        'interview_answers',
        'recordings',
        'ai_suggestions',
        'insights',
        'cases',
        'case_features',
        'case_matches'
    ]) LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- Applied as a second line of defense after NestJS Guards.
-- The app layer sets: SET LOCAL app.current_tenant_id = '<uuid>';
--                     SET LOCAL app.current_user_id   = '<uuid>';
--                     SET LOCAL app.current_role      = 'SALES'; -- etc.
-- =============================================================================

-- Helper: current tenant from session local variable
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT current_setting('app.current_tenant_id', TRUE)::UUID;
    $$;

-- Helper: current user role
CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role
    LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT current_setting('app.current_role', TRUE)::user_role;
    $$;

-- ---- TENANTS ----
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenants_select ON tenants FOR SELECT
    USING (
        deleted_at IS NULL AND (
            is_super_tenant()                                   -- super-tenant sees all
            OR id = current_tenant_id()                         -- own row
        )
    );

CREATE POLICY tenants_admin_write ON tenants FOR ALL
    USING (is_super_tenant() AND current_user_role() = 'ADMIN');

-- ---- USERS ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_select ON users FOR SELECT
    USING (
        deleted_at IS NULL AND (
            is_super_tenant()                                   -- super-tenant ADMIN sees all
            OR tenant_id = current_tenant_id()                  -- same tenant
        )
    );

CREATE POLICY users_self_write ON users FOR UPDATE
    USING (id = current_setting('app.current_user_id', TRUE)::UUID);

CREATE POLICY users_admin_write ON users FOR ALL
    USING (
        current_user_role() = 'ADMIN' AND (
            is_super_tenant() OR tenant_id = current_tenant_id()
        )
    );

-- ---- CLIENT_PROFILES ----
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY client_profiles_select ON client_profiles FOR SELECT
    USING (
        deleted_at IS NULL AND (
            is_super_tenant()
            OR tenant_id = current_tenant_id()
        )
    );

CREATE POLICY client_profiles_write ON client_profiles FOR ALL
    USING (
        is_super_tenant()
        OR (tenant_id = current_tenant_id() AND current_user_role() IN ('ADMIN', 'SALES'))
    );

-- ---- INTERVIEW_SESSIONS ----
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY sessions_select ON interview_sessions FOR SELECT
    USING (
        deleted_at IS NULL AND (
            is_super_tenant()
            OR current_user_role() = 'EXPERT'
            OR (
                tenant_id = current_tenant_id() AND (
                    current_user_role() = 'ADMIN'
                    OR created_by = current_setting('app.current_user_id', TRUE)::UUID
                )
            )
        )
    );

CREATE POLICY sessions_sales_write ON interview_sessions FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND current_user_role() IN ('ADMIN', 'SALES')
        AND (
            created_by = current_setting('app.current_user_id', TRUE)::UUID
            OR current_user_role() = 'ADMIN'
        )
    );

-- ---- CASES ----
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;

-- All authenticated users can read published cases
CREATE POLICY cases_select ON cases FOR SELECT
    USING (deleted_at IS NULL AND (is_published = TRUE OR is_super_tenant()));

-- Only super-tenant ADMIN can write
CREATE POLICY cases_write ON cases FOR ALL
    USING (is_super_tenant() AND current_user_role() = 'ADMIN');

-- ---- AUDIT_LOGS ----
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
    USING (
        is_super_tenant()
        OR (tenant_id = current_tenant_id() AND current_user_role() = 'ADMIN')
    );

-- Insert only (no update/delete on audit_logs enforced by GRANT later)
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
    WITH CHECK (TRUE);  -- any authenticated user's action can be logged

-- =============================================================================
-- GRANTS (principle of least privilege)
-- Create three application roles: app_admin, app_sales, app_expert.
-- NestJS connection pool uses a single DB user that SET ROLEs per request.
-- =============================================================================

-- Application DB owner role (used by NestJS connection pool)
-- Replace 'app_owner' with actual DB user created during provisioning.
-- GRANT CONNECT ON DATABASE research_tool TO app_owner;

-- All authenticated roles can read core lookup tables
-- GRANT SELECT ON tenants, outline_templates, cases, case_features TO app_admin, app_sales, app_expert;

-- SALES write access
-- GRANT INSERT, UPDATE ON client_profiles, interview_sessions, interview_departments,
--       interview_questions, interview_answers, recordings, transcriptions, ai_suggestions
--       TO app_sales;

-- EXPERT additional access
-- GRANT UPDATE ON insights, case_matches TO app_expert;

-- ADMIN full access (bounded by RLS)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;

-- Audit log append-only
-- GRANT INSERT ON audit_logs TO app_admin, app_sales, app_expert;
-- REVOKE UPDATE, DELETE ON audit_logs FROM app_admin, app_sales, app_expert;

-- =============================================================================
-- SEED: SUPER-TENANT ROW
-- Run once during environment bootstrap.
-- =============================================================================

INSERT INTO tenants (id, name, short_code, is_super_tenant, contact_email)
VALUES (
    gen_random_uuid(),
    '中科琉光',
    'zklyg',
    TRUE,
    'admin@zklyg.com'
) ON CONFLICT (short_code) DO NOTHING;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================

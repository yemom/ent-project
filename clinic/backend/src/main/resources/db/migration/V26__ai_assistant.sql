-- AI assistant tables.
--
-- Three concerns, kept apart on purpose:
--
--   ai_conversations / ai_messages  content, scoped by owner_user_id
--   ai_pending_actions              proposals awaiting a human decision
--   ai_audit_events                 who asked what, with no content at all
--
-- The audit table deliberately has no prompt or response column. A compliance
-- question has to be answerable without opening anyone's care, so it records
-- identity, action, identifiers and counters only.

CREATE TABLE IF NOT EXISTS ai_conversations (
    id             VARCHAR(36)   NOT NULL,
    owner_user_id  VARCHAR(36)   NOT NULL,
    owner_role     VARCHAR(32)   NOT NULL,
    title          VARCHAR(200),
    system_prompt  TEXT,
    created_at     TIMESTAMP     NOT NULL,
    updated_at     TIMESTAMP     NOT NULL,
    deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_ai_conversations PRIMARY KEY (id),
    CONSTRAINT fk_ai_conversations_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Every conversation read is scoped by owner, so this index is the access path.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner
    ON ai_conversations (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated
    ON ai_conversations (updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
    id                            VARCHAR(36) NOT NULL,
    conversation_id               VARCHAR(36) NOT NULL,
    role                          VARCHAR(16) NOT NULL,
    content                       TEXT        NOT NULL,
    context_snapshot              TEXT,
    contained_identifiable_data   BOOLEAN     NOT NULL DEFAULT FALSE,
    requires_human_review         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at                    TIMESTAMP   NOT NULL,
    CONSTRAINT pk_ai_messages PRIMARY KEY (id),
    CONSTRAINT fk_ai_messages_conversation FOREIGN KEY (conversation_id)
        REFERENCES ai_conversations (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_messages_role CHECK (role IN ('USER', 'ASSISTANT'))
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON ai_messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_ai_messages_created
    ON ai_messages (created_at);

CREATE TABLE IF NOT EXISTS ai_pending_actions (
    id                VARCHAR(36)  NOT NULL,
    owner_user_id     VARCHAR(36)  NOT NULL,
    conversation_id   VARCHAR(36)  NOT NULL DEFAULT '',
    action_type       VARCHAR(40)  NOT NULL,
    status            VARCHAR(20)  NOT NULL,
    description       VARCHAR(500) NOT NULL,
    payload           TEXT         NOT NULL,
    result_entity_id  VARCHAR(36),
    result_message    VARCHAR(500),
    created_at        TIMESTAMP    NOT NULL,
    expires_at        TIMESTAMP    NOT NULL,
    resolved_at       TIMESTAMP,
    CONSTRAINT pk_ai_pending_actions PRIMARY KEY (id),
    CONSTRAINT fk_ai_pending_actions_owner FOREIGN KEY (owner_user_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_ai_pending_actions_status CHECK (
        status IN ('PROPOSED', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXPIRED')
    ),
    CONSTRAINT ck_ai_pending_actions_type CHECK (
        action_type IN ('BOOK_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT')
    )
);

-- Serves the "my pending proposals" query and the expiry sweep.
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_owner
    ON ai_pending_actions (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_expiry
    ON ai_pending_actions (expires_at);

CREATE TABLE IF NOT EXISTS ai_audit_events (
    id              VARCHAR(36) NOT NULL,
    user_id         VARCHAR(36) NOT NULL,
    user_role       VARCHAR(32) NOT NULL,
    action_type     VARCHAR(40) NOT NULL,
    outcome         VARCHAR(20) NOT NULL,
    resource_ids    VARCHAR(500),
    prompt_tokens   INTEGER,
    output_tokens   INTEGER,
    duration_ms     BIGINT,
    expires_at      TIMESTAMP   NOT NULL,
    created_at      TIMESTAMP   NOT NULL,
    CONSTRAINT pk_ai_audit_events PRIMARY KEY (id),
    CONSTRAINT fk_ai_audit_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_user
    ON ai_audit_events (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_audit_created
    ON ai_audit_events (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_audit_action
    ON ai_audit_events (action_type);
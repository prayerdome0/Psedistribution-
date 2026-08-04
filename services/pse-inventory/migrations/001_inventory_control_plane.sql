BEGIN;

CREATE SCHEMA IF NOT EXISTS private_inventory;
CREATE SCHEMA IF NOT EXISTS public_inventory;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS private_inventory.canonical_deals (
    deal_id text PRIMARY KEY CHECK (deal_id ~ '^[A-Z0-9][A-Z0-9-]{5,79}$'),
    record_version text NOT NULL CHECK (record_version ~ '^sha256:[a-f0-9]{64}$'),
    source_version text NOT NULL CHECK (source_version ~ '^sha256:[a-f0-9]{64}$'),
    status text NOT NULL CHECK (status IN ('draft','available','limited','hold','reserved','sold','withdrawn','recall-hold','archived')),
    review_status text NOT NULL CHECK (review_status IN ('ready','needs-review','blocked','pending')),
    publish_approved boolean NOT NULL DEFAULT false,
    canonical_record jsonb NOT NULL CHECK (jsonb_typeof(canonical_record) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT canonical_record_identity_matches CHECK (canonical_record->>'dealId' = deal_id),
    CONSTRAINT canonical_record_version_matches CHECK (canonical_record->>'recordVersion' = record_version)
);

CREATE TABLE IF NOT EXISTS private_inventory.source_evidence (
    evidence_id text PRIMARY KEY,
    deal_id text NOT NULL REFERENCES private_inventory.canonical_deals(deal_id) ON DELETE RESTRICT,
    source_record_id text NOT NULL,
    source_hash text NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
    evidence_uri text,
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (deal_id, source_record_id),
    UNIQUE (source_hash)
);

CREATE TABLE IF NOT EXISTS private_inventory.publish_approvals (
    approval_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    deal_id text NOT NULL REFERENCES private_inventory.canonical_deals(deal_id) ON DELETE RESTRICT,
    approval_version text NOT NULL CHECK (approval_version ~ '^sha256:[a-f0-9]{64}$'),
    approved_by text NOT NULL,
    approved_at timestamptz NOT NULL,
    revoked_at timestamptz,
    UNIQUE (deal_id, approval_version)
);

CREATE TABLE IF NOT EXISTS private_inventory.inventory_holds (
    hold_id uuid PRIMARY KEY,
    deal_id text NOT NULL REFERENCES private_inventory.canonical_deals(deal_id) ON DELETE RESTRICT,
    quantity_units integer NOT NULL CHECK (quantity_units > 0),
    status text NOT NULL CHECK (status IN ('active','released','converted','expired')),
    expires_at timestamptz NOT NULL,
    created_by text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    released_at timestamptz
);
CREATE INDEX IF NOT EXISTS inventory_holds_active_idx
    ON private_inventory.inventory_holds (deal_id, expires_at)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public_inventory.snapshots (
    snapshot_version text PRIMARY KEY CHECK (snapshot_version ~ '^sha256:[a-f0-9]{64}$'),
    source_version text NOT NULL CHECK (source_version ~ '^sha256:[a-f0-9]{64}$'),
    generated_at timestamptz NOT NULL,
    record_count integer NOT NULL CHECK (record_count >= 0),
    snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    active boolean NOT NULL DEFAULT false,
    activated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT snapshot_identity_matches CHECK (snapshot->>'snapshotVersion' = snapshot_version),
    CONSTRAINT snapshot_count_matches CHECK ((snapshot->>'recordCount')::integer = record_count)
);
CREATE UNIQUE INDEX IF NOT EXISTS public_inventory_one_active_snapshot
    ON public_inventory.snapshots ((active)) WHERE active;

CREATE OR REPLACE VIEW public_inventory.active_snapshot AS
SELECT snapshot_version, source_version, generated_at, record_count, snapshot
FROM public_inventory.snapshots
WHERE active;

CREATE TABLE IF NOT EXISTS public_inventory.rfq_requests (
    rfq_id uuid PRIMARY KEY,
    deal_id text NOT NULL,
    source_version text NOT NULL CHECK (source_version ~ '^sha256:[a-f0-9]{64}$'),
    requested_quantity integer CHECK (requested_quantity > 0),
    buyer_name text NOT NULL,
    buyer_email text NOT NULL,
    buyer_company text,
    message text,
    status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','quoted','closed','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rfq_requests_deal_created_idx
    ON public_inventory.rfq_requests (deal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit.publish_runs (
    run_id text PRIMARY KEY,
    release_id text NOT NULL,
    operator_id text NOT NULL,
    source_version text,
    snapshot_version text,
    result text NOT NULL CHECK (result IN ('started','passed','failed','rolled-back')),
    input_count integer,
    published_count integer,
    report jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit.change_events (
    event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id text REFERENCES audit.publish_runs(run_id) ON DELETE SET NULL,
    actor_id text NOT NULL,
    event_type text NOT NULL,
    deal_id text,
    old_version text,
    new_version text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS change_events_time_idx ON audit.change_events (occurred_at DESC);

COMMIT;

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pse_publisher') THEN
        CREATE ROLE pse_publisher NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pse_storefront') THEN
        CREATE ROLE pse_storefront NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pse_auditor') THEN
        CREATE ROLE pse_auditor NOLOGIN;
    END IF;
END $$;

REVOKE ALL ON SCHEMA private_inventory FROM PUBLIC;
REVOKE ALL ON SCHEMA public_inventory FROM PUBLIC;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
REVOKE ALL ON SCHEMA private_inventory FROM pse_storefront;
REVOKE ALL ON ALL TABLES IN SCHEMA private_inventory FROM pse_storefront;
REVOKE ALL ON SCHEMA audit FROM pse_storefront;

GRANT USAGE ON SCHEMA private_inventory, public_inventory, audit TO pse_publisher;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA private_inventory TO pse_publisher;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public_inventory TO pse_publisher;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA audit TO pse_publisher;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA private_inventory, public_inventory, audit TO pse_publisher;

GRANT USAGE ON SCHEMA public_inventory TO pse_storefront;
GRANT SELECT ON public_inventory.active_snapshot TO pse_storefront;
GRANT INSERT ON public_inventory.rfq_requests TO pse_storefront;

GRANT USAGE ON SCHEMA private_inventory, public_inventory, audit TO pse_auditor;
GRANT SELECT ON ALL TABLES IN SCHEMA private_inventory, public_inventory, audit TO pse_auditor;

ALTER DEFAULT PRIVILEGES IN SCHEMA private_inventory REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public_inventory REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit REVOKE ALL ON TABLES FROM PUBLIC;

COMMIT;

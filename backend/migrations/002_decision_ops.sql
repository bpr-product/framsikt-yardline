-- Yardline v2 / additive change. Apply with the schema owner before deploying v2.
-- Does not rewrite legacy visits and is safe to run again.
CREATE TABLE IF NOT EXISTS issues (
  id varchar(36) PRIMARY KEY,
  visit_id varchar(36) NOT NULL REFERENCES visits(id),
  code varchar(48) NOT NULL,
  category varchar(36) NOT NULL,
  description text NOT NULL,
  owner varchar(80) NOT NULL,
  severity varchar(12) NOT NULL DEFAULT 'medium',
  blocking boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  escalated_at timestamptz,
  resolved_at timestamptz,
  resolution_note text
);
CREATE INDEX IF NOT EXISTS ix_issues_visit_id ON issues(visit_id);
CREATE INDEX IF NOT EXISTS ix_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS ix_issue_visit_status ON issues(visit_id,status);
CREATE TABLE IF NOT EXISTS readiness_checks (
  id varchar(36) PRIMARY KEY,
  visit_id varchar(36) NOT NULL REFERENCES visits(id),
  code varchar(40) NOT NULL,
  label varchar(120) NOT NULL,
  required boolean NOT NULL DEFAULT true,
  done boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  confirmed_by varchar(80),
  CONSTRAINT uq_visit_readiness_code UNIQUE (visit_id, code)
);
CREATE INDEX IF NOT EXISTS ix_readiness_checks_visit_id ON readiness_checks(visit_id);
-- Production grants: the app role is used for writes but cannot administer schema.
GRANT SELECT,INSERT,UPDATE,DELETE ON issues,readiness_checks TO yardline_app;

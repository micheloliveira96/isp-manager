-- Foundation schema. Review and apply through a migration runner.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE organizations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE app_users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id),
 display_name TEXT NOT NULL, email TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,email)
);
CREATE TABLE roles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID NOT NULL REFERENCES organizations(id),
 name TEXT NOT NULL, code TEXT NOT NULL, is_system_role BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (organization_id,code)
);
CREATE TABLE permissions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL UNIQUE, description TEXT NOT NULL);
CREATE TABLE role_permissions (role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY (role_id,permission_id));
CREATE TABLE user_roles (user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY (user_id,role_id));
CREATE TABLE audit_log (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id),
 actor_user_id UUID REFERENCES app_users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT, before_data JSONB, after_data JSONB, justification TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_org_created_idx ON audit_log (organization_id,created_at DESC);
CREATE INDEX app_users_org_idx ON app_users (organization_id);
CREATE INDEX roles_org_idx ON roles (organization_id);
-- Production follow-up: implement server-side authorization, tenant-scoped queries/RLS,
-- append-only audit permissions, and a real identity provider/session verification.

-- Branding/configuration intended for each organization (tenant).
CREATE TABLE organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'ISP Manager',
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#4263eb',
  accent_color TEXT NOT NULL DEFAULT '#22a77d',
  login_title TEXT NOT NULL DEFAULT 'Bem-vindo',
  login_message TEXT NOT NULL DEFAULT 'Entre na sua plataforma de gestão',
  support_email TEXT,
  support_phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES app_users(id)
);
CREATE INDEX organization_settings_updated_idx ON organization_settings (updated_at DESC);
-- Store uploaded logos in controlled object storage and validate uploads.
-- Only authorized organization administrators may modify these values.

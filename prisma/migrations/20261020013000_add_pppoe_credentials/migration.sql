ALTER TABLE public."ServiceOrder" ADD COLUMN IF NOT EXISTS "pppoeUsername" text;
ALTER TABLE public."ServiceOrder" ADD COLUMN IF NOT EXISTS "pppoePassword" text;

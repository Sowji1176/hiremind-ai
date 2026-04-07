ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}'::jsonb;
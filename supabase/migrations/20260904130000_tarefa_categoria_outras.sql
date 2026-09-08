-- Allow categoria 'outras' alongside 'fechamento'.

ALTER TABLE public.obrigacoes
  DROP CONSTRAINT IF EXISTS obrigacoes_categoria_check;

ALTER TABLE public.obrigacoes
  ADD CONSTRAINT obrigacoes_categoria_check
  CHECK (categoria IN ('fechamento', 'outras'));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tarefas'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%categoria%'
  LOOP
    EXECUTE format('ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_categoria_check
  CHECK (categoria IN ('fechamento', 'outras'));

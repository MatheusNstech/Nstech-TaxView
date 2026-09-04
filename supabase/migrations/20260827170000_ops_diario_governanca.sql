-- EM_REVISAO enum
DO $$ BEGIN
  ALTER TYPE public.status_obrigacao ADD VALUE IF NOT EXISTS 'EM_REVISAO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.obrigacoes
  ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reprovado_motivo text;

ALTER TABLE public.responsaveis
  ADD COLUMN IF NOT EXISTS capacidade_max integer;

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obrigacao_id uuid REFERENCES public.obrigacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('PRAZO_7D','ATRASADO','ATRIBUICAO','COMENTARIO','APROVACAO')),
  titulo text NOT NULL,
  corpo text NOT NULL DEFAULT '',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user_lida ON public.notificacoes(user_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_dedupe ON public.notificacoes(user_id, obrigacao_id, tipo, created_at);

CREATE TABLE IF NOT EXISTS public.obrigacao_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrigacao_id uuid NOT NULL REFERENCES public.obrigacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_email text,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obrigacao_comentarios_obrigacao ON public.obrigacao_comentarios(obrigacao_id, created_at);

CREATE TABLE IF NOT EXISTS public.obrigacao_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obrigacao_id uuid NOT NULL REFERENCES public.obrigacoes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acao text NOT NULL,
  campo text,
  valor_anterior text,
  valor_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_obrigacao_audit_obrigacao ON public.obrigacao_audit_log(obrigacao_id, created_at DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrigacao_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrigacao_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificacoes_all_authenticated ON public.notificacoes;
CREATE POLICY notificacoes_all_authenticated ON public.notificacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS comentarios_all_authenticated ON public.obrigacao_comentarios;
CREATE POLICY comentarios_all_authenticated ON public.obrigacao_comentarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS audit_all_authenticated ON public.obrigacao_audit_log;
CREATE POLICY audit_all_authenticated ON public.obrigacao_audit_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

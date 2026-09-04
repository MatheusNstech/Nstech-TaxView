-- Cronograma TAX schema (mirror of applied remote migration)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.status_obrigacao AS ENUM (
  'PENDENTE',
  'EM_ANDAMENTO',
  'ENTREGUE',
  'ATRASADO'
);

CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  razao_social text NOT NULL,
  bu text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.atividades_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  requer_apuracao boolean NOT NULL DEFAULT true,
  dia_prazo_legal integer CHECK (dia_prazo_legal IS NULL OR (dia_prazo_legal BETWEEN 1 AND 31)),
  dia_prazo_fiscal integer CHECK (dia_prazo_fiscal IS NULL OR (dia_prazo_fiscal BETWEEN 1 AND 31)),
  recorrencia text NOT NULL DEFAULT 'mensal',
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  email text,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.obrigacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  atividade_id uuid NOT NULL REFERENCES public.atividades_modelo(id) ON DELETE RESTRICT,
  responsavel_id uuid REFERENCES public.responsaveis(id) ON DELETE SET NULL,
  competencia date NOT NULL,
  prazo_legal date,
  prazo_fiscal date,
  data_entrega date,
  status public.status_obrigacao NOT NULL DEFAULT 'PENDENTE',
  recibo_path text,
  recibo_numero text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT obrigacoes_unique_empresa_atividade_competencia
    UNIQUE (empresa_id, atividade_id, competencia)
);

CREATE INDEX idx_obrigacoes_competencia ON public.obrigacoes(competencia);
CREATE INDEX idx_obrigacoes_status ON public.obrigacoes(status);
CREATE INDEX idx_obrigacoes_responsavel ON public.obrigacoes(responsavel_id);
CREATE INDEX idx_empresas_bu ON public.empresas(bu);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_atividades_updated_at
  BEFORE UPDATE ON public.atividades_modelo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_obrigacoes_updated_at
  BEFORE UPDATE ON public.obrigacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obrigacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY empresas_authenticated_all ON public.empresas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY atividades_authenticated_all ON public.atividades_modelo
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY responsaveis_authenticated_all ON public.responsaveis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY obrigacoes_authenticated_all ON public.obrigacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recibos',
  'recibos',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY recibos_authenticated_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recibos');

CREATE POLICY recibos_authenticated_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recibos');

CREATE POLICY recibos_authenticated_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'recibos')
  WITH CHECK (bucket_id = 'recibos');

CREATE POLICY recibos_authenticated_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recibos');

-- Solicitante obrigatório na criação + motivo de atraso na entrega tardia.

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS solicitante_nome text,
  ADD COLUMN IF NOT EXISTS motivo_atraso text,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz;

UPDATE public.tarefas
SET solicitante_nome = COALESCE(NULLIF(trim(solicitante_nome), ''), 'Não informado')
WHERE solicitante_nome IS NULL OR trim(solicitante_nome) = '';

ALTER TABLE public.tarefas
  ALTER COLUMN solicitante_nome SET NOT NULL;

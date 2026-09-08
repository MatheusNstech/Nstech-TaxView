-- Motivo de atraso ao entregar obrigação fora do prazo.

ALTER TABLE public.obrigacoes
  ADD COLUMN IF NOT EXISTS motivo_atraso text;

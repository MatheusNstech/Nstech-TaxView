-- Item que passou por Entrega parcial nunca conta como entregue fora do prazo
-- (o restante depende de outros times). A marca fica mesmo depois de Entregue.

ALTER TABLE public.obrigacoes
  ADD COLUMN IF NOT EXISTS via_entrega_parcial boolean NOT NULL DEFAULT false;
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS via_entrega_parcial boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.marca_via_entrega_parcial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ENTREGA_PARCIAL' THEN
    NEW.via_entrega_parcial := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obrigacoes_via_entrega_parcial ON public.obrigacoes;
CREATE TRIGGER trg_obrigacoes_via_entrega_parcial
  BEFORE INSERT OR UPDATE OF status ON public.obrigacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.marca_via_entrega_parcial();

DROP TRIGGER IF EXISTS trg_tarefas_via_entrega_parcial ON public.tarefas;
CREATE TRIGGER trg_tarefas_via_entrega_parcial
  BEFORE INSERT OR UPDATE OF status ON public.tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.marca_via_entrega_parcial();

-- Itens que já passaram pela parcial: os que estão nela e os que o histórico registra.
UPDATE public.obrigacoes o
SET via_entrega_parcial = true
WHERE NOT o.via_entrega_parcial
  AND (
    o.status = 'ENTREGA_PARCIAL'
    OR EXISTS (
      SELECT 1 FROM public.obrigacao_audit_log l
      WHERE l.obrigacao_id = o.id AND l.acao ILIKE '%entrega parcial%'
    )
  );

UPDATE public.tarefas t
SET via_entrega_parcial = true
WHERE NOT t.via_entrega_parcial
  AND (
    t.status = 'ENTREGA_PARCIAL'
    OR EXISTS (
      SELECT 1 FROM public.tarefa_audit_log l
      WHERE l.tarefa_id = t.id AND l.acao ILIKE '%entrega parcial%'
    )
  );

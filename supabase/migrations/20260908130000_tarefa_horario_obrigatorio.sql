-- Toda tarefa precisa de janela de horário. O atraso continua só no dia (`prazo`).

UPDATE public.tarefas
SET hora_inicio = TIME '09:00',
    hora_fim = TIME '12:00'
WHERE hora_inicio IS NULL OR hora_fim IS NULL;

UPDATE public.tarefas
SET prazo = COALESCE(prazo, competencia, CURRENT_DATE)
WHERE prazo IS NULL;

ALTER TABLE public.tarefas
  ALTER COLUMN hora_inicio SET NOT NULL,
  ALTER COLUMN hora_fim SET NOT NULL,
  ALTER COLUMN prazo SET NOT NULL;

ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_horario_check;

ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_horario_check
  CHECK (hora_fim > hora_inicio);

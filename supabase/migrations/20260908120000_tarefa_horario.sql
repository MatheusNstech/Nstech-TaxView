-- Janela de horário da tarefa (agenda). O atraso continua só no dia (`prazo`).

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS hora_inicio time,
  ADD COLUMN IF NOT EXISTS hora_fim time;

ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_horario_check;

ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_horario_check
  CHECK (
    (hora_inicio IS NULL AND hora_fim IS NULL)
    OR (
      hora_inicio IS NOT NULL
      AND hora_fim IS NOT NULL
      AND hora_fim > hora_inicio
    )
  );

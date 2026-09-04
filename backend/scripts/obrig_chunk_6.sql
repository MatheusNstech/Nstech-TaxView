INSERT INTO public.obrigacoes (empresa_id, atividade_id, responsavel_id, competencia, prazo_legal, prazo_fiscal, status)
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '04.134.548/0001-85' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '04.134.548/0001-85' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '04.134.548/0001-85' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '04.134.548/0001-85' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '04.134.548/0001-85' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '13.969.629/0001-96' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.556.723/0001-90' AND a.nome = 'REINF'
ON CONFLICT (empresa_id, atividade_id, competencia) DO NOTHING;
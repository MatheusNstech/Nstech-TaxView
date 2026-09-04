INSERT INTO public.obrigacoes (empresa_id, atividade_id, responsavel_id, competencia, prazo_legal, prazo_fiscal, status)
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0002-26' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.945.576/0001-45' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.991.709/0001-80' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.991.709/0001-80' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.991.709/0001-80' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.991.709/0001-80' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.991.709/0001-80' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.991.709/0001-80' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0002-33' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0002-33' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0001-52' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.929.201/0002-33' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '45.145.603/0001-10' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '45.145.603/0001-10' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '45.145.603/0001-10' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '45.145.603/0001-10' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '45.145.603/0001-10' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '45.145.603/0001-10' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.714.295/0001-42' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.714.295/0001-42' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.714.295/0001-42' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.714.295/0001-42' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.714.295/0001-42' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '35.714.295/0001-42' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '25.265.917/0001-49' AND a.nome = 'Apuração ISS Prestados'
ON CONFLICT (empresa_id, atividade_id, competencia) DO NOTHING;
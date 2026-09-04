INSERT INTO public.obrigacoes (empresa_id, atividade_id, responsavel_id, competencia, prazo_legal, prazo_fiscal, status)
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '10.683.008/0001-53' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0006-75' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0006-75' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0001-60' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0001-60' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0001-60' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0006-75' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0001-60' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0001-60' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0007-56' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0002-41' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0006-75' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0001-60' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '05.074.351/0008-37' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'Apuração ICMS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'SPED ICMS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '28.644.310/0001-68' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '06.888.683/0001-41' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.127.839/0001-62' AND a.nome = 'MIT / DCFTWEB'
ON CONFLICT (empresa_id, atividade_id, competencia) DO NOTHING;
INSERT INTO public.obrigacoes (empresa_id, atividade_id, responsavel_id, competencia, prazo_legal, prazo_fiscal, status)
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flávia'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '07.960.929/0001-01' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '38.127.989/0001-71' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '38.127.989/0001-71' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '38.127.989/0001-71' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '38.127.989/0001-71' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '38.127.989/0001-71' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '38.127.989/0001-71' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'Apuração CPRB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'SPED ICMS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0001-68' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0003-20' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0005-91' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0006-72' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0002-49' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0002-49' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Solange'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '02.355.037/0004-00' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'EFD Contribuições'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'REINF'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'SPED ICMS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'Apuração Importação'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Viviane'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '15.094.258/0001-71' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'Apuração ISS Prestados'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'MIT / DCFTWEB'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Flá/Glau/Sol'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'Apuração IRPJ/CSLL'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'Apuração PIS e COFINS'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'DIRBI'
UNION ALL
SELECT e.id, a.id, (SELECT id FROM public.responsaveis WHERE nome = 'Felipe'), '2026-06-01'::date, '2026-07-20'::date, '2026-07-15'::date, 'PENDENTE'::public.status_obrigacao FROM public.empresas e, public.atividades_modelo a WHERE e.cnpj = '20.182.450/0001-50' AND a.nome = 'EFD Contribuições'
ON CONFLICT (empresa_id, atividade_id, competencia) DO NOTHING;
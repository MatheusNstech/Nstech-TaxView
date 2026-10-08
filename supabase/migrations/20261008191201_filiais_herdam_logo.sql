-- Filiais sem logo herdam o da matriz (mesma raiz de CNPJ).
with base as (
  select id,
         regexp_replace(coalesce(cnpj, ''), '\D', '', 'g') as digitos,
         logo_url,
         logo_url_escuro
  from public.empresas
),
matriz as (
  select left(digitos, 8) as raiz, logo_url, logo_url_escuro
  from base
  where length(digitos) = 14
    and substr(digitos, 9, 4) = '0001'
    and logo_url is not null
)
update public.empresas e
set logo_url = m.logo_url,
    logo_url_escuro = m.logo_url_escuro
from base b
join matriz m on m.raiz = left(b.digitos, 8)
where e.id = b.id
  and length(b.digitos) = 14
  and e.logo_url is null;

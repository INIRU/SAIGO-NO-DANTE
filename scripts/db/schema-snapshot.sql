-- limbus 스키마의 구조(표·뷰·열·외래 키·enum·함수)를 JSON 한 덩어리로 돌려주는 읽기 전용 쿼리.
-- Supabase SQL 편집기나 MCP execute_sql에서 실행하고, 결과의 `snapshot` 값(JSON)을 파일로 저장해
-- `node scripts/db/gen-types.mjs <그 파일> > lib/supabase/database.types.ts` 에 넣는다.
-- SELECT만 쓴다. 값 없는 항목(false·null)은 JSON에서 뺀다.
with
-- 타입 정보. 도메인은 밑바탕 타입으로, 배열은 원소 타입으로 풀고 배열 여부를 따로 적는다.
ty as (
  select
    t.oid as oid,
    (b.typcategory = 'A' and b.typelem <> 0) as is_array,
    e.typname::text as name,
    e.typtype::text as kind,
    en.nspname::text as schema,
    ec.relname::text as relname,
    ec.relkind::text as relkind
  from pg_type t
  join pg_type b on b.oid = case when t.typtype = 'd' then t.typbasetype else t.oid end
  join pg_type e on e.oid = case when b.typcategory = 'A' and b.typelem <> 0 then b.typelem else b.oid end
  join pg_namespace en on en.oid = e.typnamespace
  left join pg_class ec on ec.oid = e.typrelid and e.typtype = 'c'
),
rel as (
  select c.oid, c.relname::text as relname, c.relkind::text as relkind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'limbus'
    and c.relkind in ('r', 'p', 'v', 'm', 'c')
    and not c.relispartition
),
cols as (
  select
    r.relname,
    r.relkind,
    a.attnum,
    json_strip_nulls(json_build_object(
      'name', a.attname,
      'type', ty.name,
      'kind', ty.kind,
      'typeSchema', case when ty.kind <> 'b' then ty.schema end,
      'array', case when ty.is_array then true end,
      'nullable', case when not a.attnotnull then true end,
      'hasDefault', case when a.atthasdef and a.attgenerated = '' then true end,
      'identity', case a.attidentity when 'a' then 'always' when 'd' then 'byDefault' end,
      'generated', case when a.attgenerated <> '' then true end
    )) as col
  from rel r
  join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  join ty on ty.oid = a.atttypid
),
fks as (
  select
    json_build_object(
      'name', con.conname,
      'table', r.relname,
      'columns', (
        select json_agg(a.attname order by k.ord)
        from unnest(con.conkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
      ),
      'refSchema', fns_.nspname,
      'refTable', fr.relname,
      'refColumns', (
        select json_agg(a.attname order by k.ord)
        from unnest(con.confkey) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum
      ),
      -- 같은 열 묶음에 고유 인덱스(기본 키 포함)가 있으면 일대일
      'isOneToOne', exists (
        select 1
        from pg_index i
        where i.indrelid = con.conrelid
          and i.indisunique
          and i.indpred is null
          and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x)
            = (select array_agg(y order by y) from unnest(con.conkey) y)
      )
    ) as fk,
    r.relname as relname
  from pg_constraint con
  join rel r on r.oid = con.conrelid and r.relkind in ('r', 'p')
  join pg_class fr on fr.oid = con.confrelid
  join pg_namespace fns_ on fns_.oid = fr.relnamespace
  where con.contype = 'f'
),
funcs as (
  select
    p.oid, p.proname::text as name, p.proretset, p.pronargdefaults, p.prorettype,
    p.proargnames, p.proargmodes,
    coalesce(p.proallargtypes, p.proargtypes::oid[]) as alltypes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'limbus' and p.prokind = 'f'
),
fargs as (
  select
    f.oid, f.pronargdefaults, u.ord,
    coalesce(f.proargmodes[u.ord]::text, 'i') as mode,
    f.proargnames[u.ord] as name,
    ty.name as type, ty.kind, ty.schema, ty.is_array, ty.relname, ty.relkind
  from funcs f
  cross join lateral unnest(f.alltypes) with ordinality u(typ, ord)
  join ty on ty.oid = u.typ
),
fargs_in as (
  select
    a.*,
    row_number() over (partition by a.oid order by a.ord) as rn,
    count(*) over (partition by a.oid) as n
  from fargs a
  where a.mode in ('i', 'b', 'v')
),
fn_json as (
  select json_build_object(
    'name', f.name,
    'retset', f.proretset,
    'args', coalesce((
      select json_agg(json_strip_nulls(json_build_object(
        'name', a.name, 'type', a.type, 'kind', a.kind,
        'typeSchema', case when a.kind <> 'b' then a.schema end,
        'array', case when a.is_array then true end,
        'hasDefault', case when a.rn > a.n - a.pronargdefaults then true end
      )) order by a.ord)
      from fargs_in a where a.oid = f.oid
    ), '[]'::json),
    'returns', json_strip_nulls(json_build_object(
      'type', rt.name, 'kind', rt.kind,
      'typeSchema', case when rt.kind <> 'b' then rt.schema end,
      'array', case when rt.is_array then true end,
      'relname', rt.relname, 'relkind', rt.relkind
    )),
    -- TABLE(...) 이나 OUT 인자가 있으면 돌려주는 열 목록
    'outs', (
      select json_agg(json_strip_nulls(json_build_object(
        'name', a.name, 'type', a.type, 'kind', a.kind,
        'typeSchema', case when a.kind <> 'b' then a.schema end,
        'array', case when a.is_array then true end
      )) order by a.ord)
      from fargs a where a.oid = f.oid and a.mode in ('o', 'b', 't')
    )
  ) as fn
  from funcs f
  join ty rt on rt.oid = f.prorettype
)
select json_build_object(
  'schema', 'limbus',
  'tables', coalesce((
    select json_agg(json_build_object('name', c.relname, 'columns', c.cs) order by c.relname)
    from (select relname, json_agg(col order by attnum) as cs from cols where relkind in ('r', 'p') group by relname) c
  ), '[]'::json),
  'views', coalesce((
    select json_agg(json_build_object('name', c.relname, 'columns', c.cs) order by c.relname)
    from (select relname, json_agg(col order by attnum) as cs from cols where relkind in ('v', 'm') group by relname) c
  ), '[]'::json),
  'compositeTypes', coalesce((
    select json_agg(json_build_object('name', c.relname, 'columns', c.cs) order by c.relname)
    from (select relname, json_agg(col order by attnum) as cs from cols where relkind = 'c' group by relname) c
  ), '[]'::json),
  'foreignKeys', coalesce((select json_agg(fk order by relname, fk->>'name') from fks), '[]'::json),
  'enums', coalesce((
    select json_agg(json_build_object(
      'name', t.typname,
      'values', (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)
    ) order by t.typname)
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'limbus' and t.typtype = 'e'
  ), '[]'::json),
  'functions', coalesce((select json_agg(fn order by fn->>'name') from fn_json), '[]'::json)
) as snapshot;

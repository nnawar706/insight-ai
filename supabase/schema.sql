-- insight-ai database schema
-- Source of truth. Apply via Supabase Dashboard -> SQL Editor.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- sources --------------------------------------------------------------
create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  listing_url text not null unique,
  parser_strategy text,
  is_active boolean not null default true,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table sources enable row level security;

-- articles (append-only; section 10) --------------------------------------
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete restrict,
  url text not null unique,
  canonical_url text,
  title text not null,
  image_url text not null,
  published_at timestamptz not null,
  raw_text text not null,
  scraped_at timestamptz not null default now(),
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists articles_source_id_idx on articles (source_id);
create index if not exists articles_analyzed_at_idx on articles (analyzed_at);
create index if not exists articles_published_at_idx on articles (published_at desc);

alter table articles enable row level security;

-- article_analyses (one per article; section 19) ---------------------------
create table if not exists article_analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references articles(id) on delete cascade,
  summary text not null,
  sentiment_score numeric(4,3) not null check (sentiment_score between -1 and 1),
  sentiment_label text not null check (sentiment_label in ('positive','neutral','negative')),
  bias_score numeric(4,3) not null check (bias_score between -1 and 1),
  bias_label text not null check (bias_label in ('left','center','right','mixed','unclear')),
  left_percentage smallint not null check (left_percentage between 0 and 100),
  center_percentage smallint not null check (center_percentage between 0 and 100),
  right_percentage smallint not null check (right_percentage between 0 and 100),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  framing_notes text not null,
  loaded_terms text[] not null default '{}',
  disclaimer text not null,
  model text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  constraint article_analyses_percentages_sum_100
    check (left_percentage + center_percentage + right_percentage = 100)
);

create index if not exists article_analyses_embedding_idx
  on article_analyses using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table article_analyses enable row level security;

-- match_related_articles (section 20; security invoker — the service-role
-- client already bypasses RLS, so no need for security definer's elevated
-- privileges or its implicit public EXECUTE grant). search_path is pinned to
-- 'public' rather than '' because the vector `<=>` operator has no schema-
-- qualified call syntax and can only be resolved via the search path; this
-- is safe for a security-invoker function since it never runs with elevated
-- privileges regardless of search_path. `drop ... create` (not `create or
-- replace`) because Postgres rejects `create or replace` when the returned
-- row shape changes. ----------------------------------------------------
drop function if exists match_related_articles(uuid, vector, integer);

create function match_related_articles(
  p_article_id uuid,
  p_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  id uuid,
  title text,
  image_url text,
  published_at timestamptz,
  source_name text,
  sentiment_label text,
  left_percentage smallint,
  center_percentage smallint,
  right_percentage smallint
)
language sql
stable
security invoker
set search_path = 'public'
as $$
  select
    a.id,
    a.title,
    a.image_url,
    a.published_at,
    s.name as source_name,
    aa.sentiment_label,
    aa.left_percentage,
    aa.center_percentage,
    aa.right_percentage
  from public.article_analyses aa
  join public.articles a on a.id = aa.article_id
  join public.sources s on s.id = a.source_id
  where aa.embedding is not null
    and aa.article_id <> p_article_id
    and a.analyzed_at is not null
  order by aa.embedding <=> p_embedding
  limit p_match_count;
$$;

-- logs (section 9 run logging) ---------------------------------------------
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  level text not null default 'info' check (level in ('debug','info','warn','error')),
  event text not null,
  message text,
  context jsonb,
  source_id uuid references sources(id) on delete set null,
  article_id uuid references articles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on logs (created_at desc);
create index if not exists logs_event_idx on logs (event);

alter table logs enable row level security;

-- oxylabs_schedules (section 18; ids stored as text for 64-bit precision) ----
create table if not exists oxylabs_schedules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references sources(id) on delete cascade,
  oxylabs_schedule_id text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table oxylabs_schedules enable row level security;

-- oxylabs_schedule_runs (section 18) -----------------------------------------
create table if not exists oxylabs_schedule_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references oxylabs_schedules(id) on delete cascade,
  oxylabs_run_id text,
  oxylabs_job_id text not null,
  result_status text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (schedule_id, oxylabs_job_id)
);

create index if not exists oxylabs_schedule_runs_schedule_id_idx on oxylabs_schedule_runs (schedule_id);

alter table oxylabs_schedule_runs enable row level security;

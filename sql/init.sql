-- ============================================================
-- Todo 应用数据库初始化（在 Supabase → SQL Editor 中执行）
-- ============================================================

create extension if not exists "pgcrypto";

-- 待办表
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  text       text not null,
  done       boolean not null default false,
  image_url  text,
  due_date   timestamptz,
  priority   text not null default 'medium' check (priority in ('high','medium','low')),
  created_at timestamptz not null default now()
);

create index if not exists todos_user_idx on public.todos(user_id, created_at desc);

alter table public.todos enable row level security;

drop policy if exists "todos select own" on public.todos;
create policy "todos select own" on public.todos
  for select using (auth.uid() = user_id);

drop policy if exists "todos insert own" on public.todos;
create policy "todos insert own" on public.todos
  for insert with check (auth.uid() = user_id);

drop policy if exists "todos update own" on public.todos;
create policy "todos update own" on public.todos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "todos delete own" on public.todos;
create policy "todos delete own" on public.todos
  for delete using (auth.uid() = user_id);

-- 图片 Storage bucket（私有）
insert into storage.buckets (id, name, public)
values ('my-todo', 'my-todo', false)
on conflict (id) do update set public = false;

-- 每个用户只能读写自己 uid 文件夹下的图片
drop policy if exists "todo img insert own" on storage.objects;
create policy "todo img insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'my-todo' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "todo img select own" on storage.objects;
create policy "todo img select own" on storage.objects
  for select to authenticated
  using (bucket_id = 'my-todo' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "todo img delete own" on storage.objects;
create policy "todo img delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'my-todo' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime：监听 todos 表变更
alter publication supabase_realtime add table public.todos;

-- ==============================================================================
-- estud.ai — Supabase Production Database Schema & Row-Level Security (RLS)
-- ==============================================================================

-- 1. TABELA DE PERFIS DE USUÁRIO (PROFILES)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em profiles
alter table public.profiles enable row level security;

-- Função auxiliar SECURITY DEFINER para verificar se o usuário atual é admin.
-- O uso de SECURITY DEFINER evita o erro 42P17 (recursão infinita em políticas RLS sobre a tabela profiles).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Política de leitura: o próprio usuário ou administradores
create policy "Perfis visíveis pelo próprio usuário ou admin"
  on public.profiles for select
  using (
    auth.uid() = id or 
    public.is_admin() or
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@estud.ai' or
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Política de inserção: próprio usuário ou service role
create policy "Usuários podem criar seus próprios perfis"
  on public.profiles for insert
  with check (auth.uid() = id or auth.uid() is null);

-- Política de atualização: apenas o próprio usuário ou admin
create policy "Usuários podem atualizar seus próprios dados"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- 2. TABELA DE FEEDBACKS E BUGS (FEEDBACKS)
create table if not exists public.feedbacks (
  id text primary key,
  user_id uuid references auth.users on delete set null,
  user_name text,
  user_email text not null,
  type text not null check (type in ('bug', 'sugestao', 'elogio', 'outro')),
  title text not null,
  description text not null,
  status text default 'aberto' check (status in ('aberto', 'em_analise', 'resolvido')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em feedbacks
alter table public.feedbacks enable row level security;

-- Qualquer usuário (mesmo visitante) pode submeter feedback
create policy "Qualquer pessoa pode submeter feedback"
  on public.feedbacks for insert
  with check (true);

-- Apenas administradores podem ler todos os feedbacks (ou o próprio usuário o seu)
create policy "Leitura de feedbacks para admin ou criador"
  on public.feedbacks for select
  using (
    auth.uid() = user_id or 
    public.is_admin() or
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@estud.ai' or
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Apenas administradores podem atualizar o status dos feedbacks
create policy "Apenas administradores podem alterar status de feedbacks"
  on public.feedbacks for update
  using (
    public.is_admin() or
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@estud.ai' or
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Apenas administradores podem excluir feedbacks
create policy "Apenas administradores podem excluir feedbacks"
  on public.feedbacks for delete
  using (
    public.is_admin() or
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'admin@estud.ai' or
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- 3. TABELA DE SINCRONIZAÇÃO DE DADOS DO ESTUDANTE (USER_SYNC_DATA)
create table if not exists public.user_sync_data (
  user_id uuid references auth.users on delete cascade primary key,
  payload jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar RLS em user_sync_data
alter table public.user_sync_data enable row level security;

-- O usuário só pode ler seus próprios dados de sincronização
create policy "Usuários leem apenas seus próprios dados sincronizados"
  on public.user_sync_data for select
  using (auth.uid() = user_id);

-- O usuário só pode inserir/atualizar seus próprios dados sincronizados
create policy "Usuários gravam apenas seus próprios dados sincronizados"
  on public.user_sync_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. TRIGGER AUTOMÁTICO PARA CRIAR PERFIL AO REGISTRAR NOVO USUÁRIO
create or replace function public.handle_new_user()
returns trigger as $$
declare
  admin_email text := 'admin@estud.ai';
  user_role text := 'user';
begin
  if lower(new.email) = admin_email or (new.raw_user_meta_data->>'role') = 'admin' then
    user_role := 'admin';
  end if;

  insert into public.profiles (id, email, name, role, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    user_role,
    now(),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

-- Associar a trigger ao auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

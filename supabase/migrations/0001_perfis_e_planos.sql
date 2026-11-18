-- Lauda — perfis e planos
-- Rode este script UMA vez no Supabase: SQL Editor → New query → colar → Run.
--
-- Segurança:
-- * Cada usuário só LÊ o próprio perfil (RLS).
-- * Ninguém pelo site consegue criar, alterar ou apagar perfis: não há
--   política de INSERT/UPDATE/DELETE e não há GRANT de escrita.
--   O plano só muda pelo painel do Supabase (você) ou, no futuro, pelo
--   Worker da Cloudflare com a chave secreta, após o pagamento.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  plan          text not null default 'free' check (plan in ('free', 'premium')),
  premium_until timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Um perfil por usuário da Lauda, com o plano contratado.';
comment on column public.profiles.premium_until is 'Fim do período premium. Nulo = sem prazo (ex.: testadores).';

alter table public.profiles enable row level security;

-- Leitura do próprio perfil
drop policy if exists "Usuário lê o próprio perfil" on public.profiles;
create policy "Usuário lê o próprio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- O projeto foi criado sem "Grant API access automatically": liberamos só a leitura.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém updated_at atualizado
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Perfis para usuários que já existiam antes deste script
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Para dar Premium a um testador manualmente (troque o e-mail):
-- update public.profiles set plan = 'premium', premium_until = null where email = 'testador@exemplo.com';

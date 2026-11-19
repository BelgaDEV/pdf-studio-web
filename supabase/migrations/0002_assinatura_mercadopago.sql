-- Lauda — assinatura Premium pelo Mercado Pago
-- Rode este script UMA vez no Supabase: SQL Editor → New query → colar → Run.
--
-- Guarda no perfil a assinatura do Mercado Pago. Quem escreve aqui é só o
-- Worker da Cloudflare (com a chave service_role), depois de confirmar o
-- status direto na API do Mercado Pago. O site continua só LENDO o próprio
-- perfil (RLS da migração 0001).

alter table public.profiles
  add column if not exists mp_preapproval_id text,
  add column if not exists mp_status text,
  add column if not exists mp_updated_at timestamptz;

comment on column public.profiles.mp_preapproval_id is 'ID da assinatura (preapproval) no Mercado Pago.';
comment on column public.profiles.mp_status is 'Status da assinatura no Mercado Pago: pending, authorized, paused ou cancelled.';
comment on column public.profiles.mp_updated_at is 'Última vez que o Worker sincronizou a assinatura.';

create unique index if not exists profiles_mp_preapproval_id_key
  on public.profiles (mp_preapproval_id)
  where mp_preapproval_id is not null;

-- O site lê as novas colunas pelo mesmo GRANT de leitura do próprio perfil.
grant select on public.profiles to authenticated;

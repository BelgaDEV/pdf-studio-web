-- Lauda — Premium pago com Pix (1 mês ou 12 meses)
-- Rode este script UMA vez no Supabase: SQL Editor → New query → colar → Run.
--
-- Cada Pix gerado no site vira uma linha aqui. Quando o Mercado Pago confirma
-- o pagamento, o Worker marca "applied_at" e soma os dias ao Premium. A marca
-- garante que o mesmo Pix nunca seja somado duas vezes (aviso + conferência).
-- Só o Worker (chave service_role) lê e escreve; o site não acessa a tabela.

create table if not exists public.pix_payments (
  id text primary key,                         -- ID do pagamento no Mercado Pago
  user_id uuid not null references public.profiles (id) on delete cascade,
  period text not null check (period in ('month', 'year')),
  amount numeric(10, 2) not null,
  status text not null default 'pending',      -- status no Mercado Pago
  created_at timestamptz not null default now(),
  applied_at timestamptz                       -- quando os dias foram somados
);

create index if not exists pix_payments_user_pending_idx
  on public.pix_payments (user_id, created_at desc)
  where applied_at is null;

alter table public.pix_payments enable row level security;
-- Sem políticas: ninguém do site (anon/authenticated) lê ou escreve.

grant select, insert, update on public.pix_payments to service_role;

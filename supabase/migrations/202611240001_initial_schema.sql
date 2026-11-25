create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  scope text not null default 'general' check (scope in ('general', 'motorcycle')),
  category text not null,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  note text,
  km_per_gallon numeric(8, 2) check (km_per_gallon is null or km_per_gallon > 0),
  created_at timestamptz not null default now(),
  constraint motorcycle_entries_are_expenses check (scope <> 'motorcycle' or kind = 'expense')
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('loan', 'credit_card', 'other')),
  original_amount numeric(14, 2) not null check (original_amount > 0),
  balance_amount numeric(14, 2) not null check (balance_amount >= 0 and balance_amount <= original_amount),
  due_date date,
  note text,
  created_at timestamptz not null default now()
);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_user_scope_idx on public.transactions (user_id, scope, occurred_on desc);
create index debts_user_due_date_idx on public.debts (user_id, due_date);
create index debt_payments_debt_date_idx on public.debt_payments (debt_id, payment_date desc);

alter table public.transactions enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

create policy "Users manage their transactions"
  on public.transactions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their debts"
  on public.debts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users read their debt payments"
  on public.debt_payments for select to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.transactions, public.debts to authenticated;
grant select on public.debt_payments to authenticated;

create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_note text default null
)
returns public.debt_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_balance numeric(14, 2);
  recorded_payment public.debt_payments;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select balance_amount
    into current_balance
    from public.debts
    where id = p_debt_id and user_id = current_user_id
    for update;

  if not found then
    raise exception 'Debt not found';
  end if;
  if p_amount > current_balance then
    raise exception 'Payment cannot exceed the remaining balance';
  end if;

  update public.debts
    set balance_amount = balance_amount - p_amount
    where id = p_debt_id and user_id = current_user_id;

  insert into public.debt_payments (user_id, debt_id, amount, payment_date, note)
    values (current_user_id, p_debt_id, p_amount, coalesce(p_payment_date, current_date), p_note)
    returning * into recorded_payment;

  return recorded_payment;
end;
$$;

revoke all on function public.record_debt_payment(uuid, numeric, date, text) from public;
grant execute on function public.record_debt_payment(uuid, numeric, date, text) to authenticated;

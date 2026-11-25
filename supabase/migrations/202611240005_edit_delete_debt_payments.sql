create or replace function public.update_debt_payment(
  p_payment_id uuid,
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
  existing_payment public.debt_payments;
  current_balance numeric(14, 2);
  updated_payment public.debt_payments;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  select *
    into existing_payment
    from public.debt_payments
    where id = p_payment_id and user_id = current_user_id
    for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  select balance_amount
    into current_balance
    from public.debts
    where id = existing_payment.debt_id and user_id = current_user_id
    for update;

  if not found then
    raise exception 'Debt not found';
  end if;
  if p_amount - existing_payment.amount > current_balance then
    raise exception 'Updated payment cannot exceed the remaining balance';
  end if;

  update public.debts
    set balance_amount = balance_amount + existing_payment.amount - p_amount
    where id = existing_payment.debt_id and user_id = current_user_id;

  update public.debt_payments
    set amount = p_amount,
        payment_date = coalesce(p_payment_date, current_date),
        note = p_note
    where id = p_payment_id and user_id = current_user_id
    returning * into updated_payment;

  return updated_payment;
end;
$$;

create or replace function public.delete_debt_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  existing_payment public.debt_payments;
  original_amount numeric(14, 2);
  current_balance numeric(14, 2);
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select *
    into existing_payment
    from public.debt_payments
    where id = p_payment_id and user_id = current_user_id
    for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  select debts.original_amount, debts.balance_amount
    into original_amount, current_balance
    from public.debts
    where debts.id = existing_payment.debt_id and debts.user_id = current_user_id
    for update;

  if not found then
    raise exception 'Debt not found';
  end if;
  if current_balance + existing_payment.amount > original_amount then
    raise exception 'Deleting this payment would exceed the original debt amount';
  end if;

  update public.debts
    set balance_amount = current_balance + existing_payment.amount
    where id = existing_payment.debt_id and user_id = current_user_id;

  delete from public.debt_payments
    where id = p_payment_id and user_id = current_user_id;
end;
$$;

revoke all on function public.update_debt_payment(uuid, numeric, date, text) from public;
revoke all on function public.delete_debt_payment(uuid) from public;
grant execute on function public.update_debt_payment(uuid, numeric, date, text) to authenticated;
grant execute on function public.delete_debt_payment(uuid) to authenticated;

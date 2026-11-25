alter table public.transactions
  add column is_historical_summary boolean not null default false;

alter table public.transactions
  add constraint historical_summaries_are_motorcycle_expenses
  check (
    not is_historical_summary
    or (scope = 'motorcycle' and kind = 'expense')
  );

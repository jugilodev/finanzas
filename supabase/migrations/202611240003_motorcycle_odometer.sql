alter table public.transactions
  add column odometer_km numeric(10, 1)
  check (odometer_km is null or odometer_km > 0);

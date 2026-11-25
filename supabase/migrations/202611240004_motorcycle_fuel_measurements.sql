alter table public.transactions
  add column distance_km numeric(12, 2),
  add column gallons_purchased numeric(12, 4);

update public.transactions
set distance_km = 26692,
    gallons_purchased = round(26692::numeric / 165, 4),
    km_per_gallon = 165,
    amount = round((26692::numeric / 165) * 16000, 2),
    odometer_km = 26692,
    note = 'Resumen histórico estimado: 26.692 km desde 0 km a 165 km/gal, con galón estimado a $16.000 COP. No representa tanqueadas individuales.'
where is_historical_summary;

alter table public.transactions
  add constraint motorcycle_fuel_measurements_are_paired
  check (
    (distance_km is null and gallons_purchased is null)
    or (
      scope = 'motorcycle'
      and kind = 'expense'
      and distance_km > 0
      and gallons_purchased > 0
    )
  );

create or replace function public.set_motorcycle_km_per_gallon()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.distance_km is not null and new.gallons_purchased is not null then
    new.km_per_gallon := round(new.distance_km / new.gallons_purchased, 2);
  elsif new.distance_km is not null or new.gallons_purchased is not null then
    raise exception 'Distance and gallons must both be provided';
  end if;

  return new;
end;
$$;

create trigger set_motorcycle_km_per_gallon
  before insert or update of distance_km, gallons_purchased
  on public.transactions
  for each row
  execute function public.set_motorcycle_km_per_gallon();

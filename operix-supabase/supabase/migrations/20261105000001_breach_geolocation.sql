alter table operix.breaches
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column location_accuracy double precision check (location_accuracy >= 0),
  add column location_captured_at timestamptz,
  add constraint breaches_location_coordinates_pair
    check ((latitude is null) = (longitude is null));

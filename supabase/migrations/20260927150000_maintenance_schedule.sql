-- Scheduled maintenance: a window starts at starts_at (null = as soon as it is active) and ends at ends_at (null = until switched off).
alter table limbus.site_maintenance add column if not exists starts_at timestamptz;
comment on column limbus.site_maintenance.starts_at is 'Maintenance starts at this time; null starts it immediately while is_active.';

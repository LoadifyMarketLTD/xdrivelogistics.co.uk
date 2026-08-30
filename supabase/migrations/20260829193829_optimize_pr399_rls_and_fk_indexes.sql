-- PR #399 performance hardening without changing authorization semantics.

-- Full FK-supporting indexes. Existing partial hot-path indexes remain in place.
create index if not exists idx_driver_load_alert_preferences_company_id
  on public.driver_load_alert_preferences(company_id);

create index if not exists idx_telematics_driver_bindings_driver_id
  on public.telematics_driver_bindings(driver_id);
create index if not exists idx_telematics_driver_bindings_vehicle_id
  on public.telematics_driver_bindings(vehicle_id);
create index if not exists idx_telematics_driver_bindings_company_id
  on public.telematics_driver_bindings(company_id);

create index if not exists idx_driver_locations_vehicle_id
  on public.driver_locations(vehicle_id);
create index if not exists idx_driver_locations_job_id
  on public.driver_locations(job_id);

-- Evaluate auth.uid() once per statement rather than once per row. Ownership and
-- provenance boundaries are otherwise unchanged.
drop policy if exists driver_load_alert_preferences_select_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_select_own
  on public.driver_load_alert_preferences
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.drivers d
      where d.id = driver_load_alert_preferences.driver_id
        and d.user_id = (select auth.uid())
        and d.company_id = driver_load_alert_preferences.company_id
        and d.app_access = true
    )
  );

drop policy if exists driver_load_alert_preferences_insert_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_insert_own
  on public.driver_load_alert_preferences
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.drivers d
      where d.id = driver_load_alert_preferences.driver_id
        and d.user_id = (select auth.uid())
        and d.company_id = driver_load_alert_preferences.company_id
        and d.app_access = true
    )
  );

drop policy if exists driver_load_alert_preferences_update_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_update_own
  on public.driver_load_alert_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.drivers d
      where d.id = driver_load_alert_preferences.driver_id
        and d.user_id = (select auth.uid())
        and d.company_id = driver_load_alert_preferences.company_id
        and d.app_access = true
    )
  );

drop policy if exists driver_load_alert_preferences_delete_own on public.driver_load_alert_preferences;
create policy driver_load_alert_preferences_delete_own
  on public.driver_load_alert_preferences
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists driver_locations_insert_self on public.driver_locations;
create policy driver_locations_insert_self
  on public.driver_locations
  for insert
  to authenticated
  with check (
    source = 'driver_app'
    and source_provider is null
    and source_event_id is null
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_locations.driver_id
        and d.user_id = (select auth.uid())
    )
  );

drop policy if exists driver_locations_update_self on public.driver_locations;
create policy driver_locations_update_self
  on public.driver_locations
  for update
  to authenticated
  using (
    source = 'driver_app'
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_locations.driver_id
        and d.user_id = (select auth.uid())
    )
  )
  with check (
    source = 'driver_app'
    and source_provider is null
    and source_event_id is null
    and exists (
      select 1
      from public.drivers d
      where d.id = driver_locations.driver_id
        and d.user_id = (select auth.uid())
    )
  );

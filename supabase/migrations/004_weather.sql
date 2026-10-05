-- 004_weather.sql — local weather for outdoor plants (Phase 5, step 3).
-- Run ONCE in the Supabase SQL editor, after 003_chat.sql.
--
-- 📘 LEARN: Weather services need a map position, not a name. The app looks
-- up "Cape Town, South Africa" once, stores the latitude/longitude and the
-- place it matched (so you can check it's the right Cape Town), and reuses
-- them. Changing your home's location clears them so they're looked up again.

alter table public.households
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists weather_place text;          -- "Cape Town, Western Cape, South Africa"

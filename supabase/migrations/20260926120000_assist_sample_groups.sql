-- Assist samples are now whole action groups (one fusion, popup or sale): up to 48 frames each, uploaded by the browser
-- through signed URLs issued by /api/assist/samples.
alter table limbus.assist_samples drop constraint if exists assist_samples_frame_count_check;
alter table limbus.assist_samples add constraint assist_samples_frame_count_check check (frame_count between 1 and 48);

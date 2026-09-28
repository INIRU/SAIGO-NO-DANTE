-- Popup announcements: a published announcement with popup set opens once as a dialog for visitors of its language.
alter table limbus.announcements add column if not exists popup boolean not null default false;
comment on column limbus.announcements.popup is 'Open this published announcement once as a dialog on the site of its language.';
create index if not exists announcements_popup_lang on limbus.announcements(lang, created_at desc) where popup and published;

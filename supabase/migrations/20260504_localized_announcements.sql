alter table limbus.announcements
  add column if not exists lang varchar(5) not null default 'ko';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_lang_check'
      and conrelid = 'limbus.announcements'::regclass
  ) then
    alter table limbus.announcements
      add constraint announcements_lang_check check (lang in ('ko', 'en', 'ja'));
  end if;
end $$;

create index if not exists idx_announcements_lang_pinned_created_at
  on limbus.announcements (lang, pinned desc, created_at desc);

update limbus.announcements
set pinned = false,
    updated_at = now()
where pinned = true;

insert into limbus.announcements (lang, title, content, pinned)
values
  (
    'ko',
    '영어/일본어 로컬라이즈 안내',
    '현재 영어/일본어 페이지는 로컬라이즈 전환 작업 중이라 일부 항목이 한국어로 보이거나 번역이 누락될 수 있습니다.

이용에 불편을 드려 죄송합니다. 누락된 부분은 순차적으로 보완하겠습니다.',
    true
  ),
  (
    'en',
    'Localization notice',
    'English and Japanese pages are still being localized, so some UI labels or game data may still appear in Korean or have missing translations.

We apologize for the inconvenience and will continue filling in the missing localized text.',
    true
  ),
  (
    'ja',
    'ローカライズに関するお知らせ',
    '現在、英語版および日本語版ページのローカライズ対応を進めているため、一部のUI表記やゲームデータが韓国語のまま表示されたり、翻訳が不足している場合があります。

ご不便をおかけして申し訳ありません。未対応箇所は順次補完します。',
    true
  );

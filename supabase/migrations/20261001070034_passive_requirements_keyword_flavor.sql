-- Passives keep every sin of their activation condition (sin_affinity/sin_count hold only the first);
-- keyword references keep the game's flavor line for the tooltips.
alter table limbus.passives add column if not exists sin_requirements jsonb;
comment on column limbus.passives.sin_requirements is 'Every sin the passive needs, in game order: [{"sin":"wrath","count":3}] (attributeStockCondition / attributeResonanceCondition). sin_affinity/sin_count keep the first one.';
alter table limbus.game_text_refs add column if not exists flavor text, add column if not exists flavor_en text, add column if not exists flavor_jp text;
comment on column limbus.game_text_refs.flavor is 'Raw BattleKeywords flavor line (KR); keywords only.';

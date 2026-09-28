-- Columns that never held a value and have no source: the game has no gift sell price, themes carry no dungeon id,
-- skill copy counts are not shown anywhere, and defense skills keep their level in offense_level.
-- Apply after the site and the Windows site-sync bundle stop selecting them.
alter table limbus.ego_gifts drop column if exists sell_price;
alter table limbus.ego_gift_themes drop column if exists dungeon_id;
alter table limbus.skills drop column if exists quantity;
alter table limbus.skills drop column if exists defense_level;

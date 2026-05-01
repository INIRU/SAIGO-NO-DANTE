alter table limbus.skills
  add column if not exists atk_type text;

update limbus.skills
set atk_type = skill_type
where atk_type is null
  and skill_type in ('slash', 'pierce', 'blunt');

update limbus.skills
set atk_type = 'pierce'
where id in (
    '17c4df9c-5453-4257-b835-b0d69b9aee23'::uuid,
    'e9197c02-f238-4d12-b595-a6a8e8ea2286'::uuid
  )
  and name = '닳아버린 긍지'
  and skill_type = 'counter'
  and skill_order = 4
  and variant_order = 8
  and uptie_level in (3, 4)
  and offense_level = 62;

delete from limbus.skills
where id in (
    '6ed17d28-929b-48ab-9c39-d3dc7bbe7409'::uuid,
    'c05660c5-d8dc-42d9-8bcd-b1e6f3cf5b36'::uuid
  )
  and identity_id = '84420e36-35c4-418b-9100-5b6b62eab3b0'::uuid
  and name = '수비'
  and skill_order = 4
  and variant_order = 5
  and uptie_level in (3, 4)
  and coalesce(description, '') = '';

update limbus.keyword_meta
set description = '- 이 효과를 부여한 대상의 공격 스킬 종료 시, 부여 대상이 공격한 적을 스킬 1로 일방 공격 함.
- 원호 공격 시 해당 캐릭터의 사용할 스킬 목록에 영향을 주지 않음.'
where name = '원호 공격';

update limbus.keyword_meta
set description = '- 최댓값 : 3
- 아군이 적에게 일방공격 당할 때, 수치를 1 소모하여 적의 공격 대상을 자신으로 변경하고, 원호 방어 전용 스킬 사용
- 원호 방어를 보유한 아군이 여러 명이면, 가장 높은 수치를 가진 아군이 우선 발동
- 수비 스킬을 장착한 아군에게는 발동하지 않음
- 턴 종료시 소멸'
where name = '원호 방어';

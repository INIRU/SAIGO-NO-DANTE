create or replace function limbus.replace_md_event_graph(p_events jsonb, p_choices jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare event_count integer; choice_count integer;
begin
  if jsonb_typeof(p_events) is distinct from 'array'
    or jsonb_typeof(p_choices) is distinct from 'array'
    or jsonb_array_length(p_events) = 0 or jsonb_array_length(p_choices) = 0 then
    raise exception 'A complete, nonempty event graph is required';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_events) e where e->>'category' = 'entry')
    or exists (select 1 from jsonb_array_elements(p_events) e
      where e->>'category' is null or e->>'category' not in ('entry', 'continuation'))
    or exists (select 1 from jsonb_array_elements(p_choices) c
      where c->>'option_index' is null or c->>'result_index' is null) then
    raise exception 'Explicit entries and source result indices are required';
  end if;
  lock table limbus.md_events, limbus.md_event_choices in exclusive mode;
  delete from limbus.md_event_choices where id > 0;
  update limbus.md_events set variant_of = null where variant_of is not null;
  delete from limbus.md_events where id > 0;
  insert into limbus.md_events
    (id, name, name_en, name_jp, desc_text, desc_text_en, desc_text_jp,
     event_type, source, category, image_url, theme_ids, gift_ids, judgment)
  select id, name, name_en, name_jp, desc_text, desc_text_en, desc_text_jp,
     event_type, source, category, image_url, theme_ids, gift_ids, judgment
  from jsonb_populate_recordset(null::limbus.md_events, p_events);
  get diagnostics event_count = row_count;
  insert into limbus.md_event_choices
    (event_id, sort_order, option_index, result_index, outcome, result_condition, selection_condition,
     message, message_en, message_jp, message_desc, message_desc_en, message_desc_jp,
     result_text, result_text_en, result_text_jp, next_event_id, probability, effects)
  select event_id, sort_order, option_index, result_index, outcome, result_condition, selection_condition,
     message, message_en, message_jp, message_desc, message_desc_en, message_desc_jp,
     result_text, result_text_en, result_text_jp, next_event_id, probability, effects
  from jsonb_populate_recordset(null::limbus.md_event_choices, p_choices);
  get diagnostics choice_count = row_count;
  return jsonb_build_object('events', event_count, 'choices', choice_count);
end;
$$;

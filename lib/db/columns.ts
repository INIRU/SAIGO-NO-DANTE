/**
 * Column lists of the game tables the pages read whole. A named list keeps columns the page does not show (newly added
 * jsonb values, translations of other languages' notes) out of the cached payload that `select('*')` would carry.
 * The lists are typed as '*' on purpose: supabase-js then returns loosely typed rows, as the old select('*') did.
 */

export const GIFT_COLUMNS = 'id, game_id, name, name_en, name_jp, keyword, grade, enhancement, price, buy_disabled, effect_base, effect_base_en, effect_base_jp, effect_plus, effect_plus_en, effect_plus_jp, effect_plusplus, effect_plusplus_en, effect_plusplus_jp, activation_condition, is_synthesis, image_url, difficulty, convert_to' as '*'

export const RECIPE_COLUMNS = 'id, result_name, keyword, ingredients' as '*'

export const MD_EVENT_COLUMNS = 'id, name, name_en, name_jp, desc_text, desc_text_en, desc_text_jp, event_type, source, image_url, theme_ids, gift_ids, variant_of, category, judgment' as '*'

export const MD_EVENT_CHOICE_COLUMNS = 'id, event_id, sort_order, option_index, result_index, outcome, result_condition, selection_condition, message, message_en, message_jp, message_desc, message_desc_en, message_desc_jp, result_text, result_text_en, result_text_jp, next_event_id, probability, effects' as '*'

/** Skills and passives without the flavor text (shown only on identity pages): the deck builder sends every row to the browser. */
export const SKILL_BUILDER_COLUMNS = 'id, identity_id, name, name_en, name_jp, skill_type, atk_type, sin_affinity, coins, base_power, coin_power, description, description_en, description_jp, skill_order, variant_order, uptie_level, atk_weight, offense_level, image_id' as '*'
export const PASSIVE_BUILDER_COLUMNS = 'id, identity_id, name, name_en, name_jp, passive_type, sin_affinity, sin_count, sin_requirements, active_cond, description, description_en, description_jp, passive_order, uptie_level' as '*'

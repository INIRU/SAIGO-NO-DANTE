// 생성된 파일이다. 손으로 고치지 않는다. 다시 만드는 법: scripts/db/gen-types.mjs 머리 주석.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  limbus: {
    Tables: {
      announcements: {
        Row: {
          content: string
          content_doc: Json | null
          created_at: string | null
          id: string
          lang: string
          pinned: boolean | null
          popup: boolean
          published: boolean
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          content_doc?: Json | null
          created_at?: string | null
          id?: string
          lang?: string
          pinned?: boolean | null
          popup?: boolean
          published?: boolean
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_doc?: Json | null
          created_at?: string | null
          id?: string
          lang?: string
          pinned?: boolean | null
          popup?: boolean
          published?: boolean
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      assist_reports: {
        Row: {
          corrections: Json
          counts: Json
          created_at: string
          id: string
          meta: Json
          session: string
        }
        Insert: {
          corrections?: Json
          counts: Json
          created_at?: string
          id?: string
          meta: Json
          session: string
        }
        Update: {
          corrections?: Json
          counts?: Json
          created_at?: string
          id?: string
          meta?: Json
          session?: string
        }
        Relationships: []
      }
      assist_samples: {
        Row: {
          bytes: number
          created_at: string
          frame_count: number
          id: string
          meta: Json
          path: string
          reason: string
        }
        Insert: {
          bytes?: number
          created_at?: string
          frame_count: number
          id?: string
          meta: Json
          path: string
          reason: string
        }
        Update: {
          bytes?: number
          created_at?: string
          frame_count?: number
          id?: string
          meta?: Json
          path?: string
          reason?: string
        }
        Relationships: []
      }
      assist_text_embeddings: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          entity_id: number
          entity_kind: string
          field_name: string
          locale: string
          model_id: string
          model_revision: string
          preprocess_version: string
          source_hash: string
          token_end: number
          token_start: number
          updated_at: string
        }
        Insert: {
          chunk_index: number
          content: string
          content_hash: string
          embedding: string
          entity_id: number
          entity_kind: string
          field_name: string
          locale: string
          model_id: string
          model_revision: string
          preprocess_version: string
          source_hash: string
          token_end: number
          token_start: number
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string
          embedding?: string
          entity_id?: number
          entity_kind?: string
          field_name?: string
          locale?: string
          model_id?: string
          model_revision?: string
          preprocess_version?: string
          source_hash?: string
          token_end?: number
          token_start?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          severity: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          severity?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          severity?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_activity: {
        Row: {
          action: string
          active: boolean
          created_at: string
          id: number
          points: number
          subject_id: string
          user_id: string
        }
        Insert: {
          action: string
          active?: boolean
          created_at?: string
          id?: number
          points: number
          subject_id: string
          user_id: string
        }
        Update: {
          action?: string
          active?: boolean
          created_at?: string
          id?: number
          points?: number
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_bookmarks: {
        Row: {
          created_at: string | null
          deck_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deck_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          deck_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_bookmarks_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_comments: {
        Row: {
          content: string
          created_at: string | null
          deck_id: string
          id: string
          parent_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          deck_id: string
          id?: string
          parent_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          deck_id?: string
          id?: string
          parent_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deck_comments_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "deck_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_egos: {
        Row: {
          deck_id: string
          ego_id: string
          grade: string
          id: string
        }
        Insert: {
          deck_id: string
          ego_id: string
          grade: string
          id?: string
        }
        Update: {
          deck_id?: string
          ego_id?: string
          grade?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_egos_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_egos_ego_id_fkey"
            columns: ["ego_id"]
            isOneToOne: false
            referencedRelation: "ego"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_identities: {
        Row: {
          deck_id: string
          gacksung: boolean | null
          identity_id: string
          s1_count: number | null
          s2_count: number | null
          s3_count: number | null
          slot_order: number | null
          uptie: number
        }
        Insert: {
          deck_id: string
          gacksung?: boolean | null
          identity_id: string
          s1_count?: number | null
          s2_count?: number | null
          s3_count?: number | null
          slot_order?: number | null
          uptie?: number
        }
        Update: {
          deck_id?: string
          gacksung?: boolean | null
          identity_id?: string
          s1_count?: number | null
          s2_count?: number | null
          s3_count?: number | null
          slot_order?: number | null
          uptie?: number
        }
        Relationships: [
          {
            foreignKeyName: "deck_identities_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_identities_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_votes: {
        Row: {
          deck_id: string
          user_id: string
        }
        Insert: {
          deck_id: string
          user_id: string
        }
        Update: {
          deck_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_votes_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          comment_count: number
          content_edited_at: string | null
          content_type: string | null
          created_at: string
          description: string | null
          guest_tag: string | null
          id: string
          lang: string
          main_keywords: string[]
          tags: string[]
          title: string
          updated_at: string | null
          user_id: string | null
          view_count: number
          vote_count: number
        }
        Insert: {
          comment_count?: number
          content_edited_at?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          guest_tag?: string | null
          id?: string
          lang?: string
          main_keywords?: string[]
          tags?: string[]
          title: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number
          vote_count?: number
        }
        Update: {
          comment_count?: number
          content_edited_at?: string | null
          content_type?: string | null
          created_at?: string
          description?: string | null
          guest_tag?: string | null
          id?: string
          lang?: string
          main_keywords?: string[]
          tags?: string[]
          title?: string
          updated_at?: string | null
          user_id?: string | null
          view_count?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "decks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          minute_count: number
          minute_start: string
          name: string
          prefix: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          minute_count?: number
          minute_start?: string
          name: string
          prefix: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          minute_count?: number
          minute_start?: string
          name?: string
          prefix?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_usage: {
        Row: {
          day: string
          key_id: string
          requests: number
        }
        Insert: {
          day: string
          key_id: string
          requests?: number
        }
        Update: {
          day?: string
          key_id?: string
          requests?: number
        }
        Relationships: [
          {
            foreignKeyName: "developer_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "developer_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_visits: {
        Row: {
          day: string
          entity_id: string
          kind: string
          user_id: string | null
          visitor_hash: string
        }
        Insert: {
          day?: string
          entity_id: string
          kind: string
          user_id?: string | null
          visitor_hash: string
        }
        Update: {
          day?: string
          entity_id?: string
          kind?: string
          user_id?: string | null
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_visits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ego: {
        Row: {
          artwork_url: string | null
          cor_image_url: string | null
          corrosion_artwork_url: string | null
          cost: number[] | null
          folder_name: string | null
          game_id: string
          grade: string | null
          id: string
          image_url: string | null
          keywords: string[] | null
          name_en: string | null
          name_jp: string | null
          name_kr: string
          passive_content: string | null
          passive_content_en: string | null
          passive_content_jp: string | null
          passive_name: string | null
          passive_name_en: string | null
          passive_name_jp: string | null
          release_date: string | null
          resistance: string[] | null
          sin_affinity: string | null
          sinner_id: string
        }
        Insert: {
          artwork_url?: string | null
          cor_image_url?: string | null
          corrosion_artwork_url?: string | null
          cost?: number[] | null
          folder_name?: string | null
          game_id: string
          grade?: string | null
          id?: string
          image_url?: string | null
          keywords?: string[] | null
          name_en?: string | null
          name_jp?: string | null
          name_kr: string
          passive_content?: string | null
          passive_content_en?: string | null
          passive_content_jp?: string | null
          passive_name?: string | null
          passive_name_en?: string | null
          passive_name_jp?: string | null
          release_date?: string | null
          resistance?: string[] | null
          sin_affinity?: string | null
          sinner_id: string
        }
        Update: {
          artwork_url?: string | null
          cor_image_url?: string | null
          corrosion_artwork_url?: string | null
          cost?: number[] | null
          folder_name?: string | null
          game_id?: string
          grade?: string | null
          id?: string
          image_url?: string | null
          keywords?: string[] | null
          name_en?: string | null
          name_jp?: string | null
          name_kr?: string
          passive_content?: string | null
          passive_content_en?: string | null
          passive_content_jp?: string | null
          passive_name?: string | null
          passive_name_en?: string | null
          passive_name_jp?: string | null
          release_date?: string | null
          resistance?: string[] | null
          sin_affinity?: string | null
          sinner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ego_sinner_id_fkey"
            columns: ["sinner_id"]
            isOneToOne: false
            referencedRelation: "sinners"
            referencedColumns: ["id"]
          },
        ]
      }
      ego_gift_recipe_ingredients: {
        Row: {
          gift_game_id: number
          position: number
          recipe_id: string
        }
        Insert: {
          gift_game_id: number
          position: number
          recipe_id: string
        }
        Update: {
          gift_game_id?: number
          position?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ego_gift_recipe_ingredients_gift_game_id_fkey"
            columns: ["gift_game_id"]
            isOneToOne: false
            referencedRelation: "ego_gifts"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "ego_gift_recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "ego_gift_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      ego_gift_recipes: {
        Row: {
          created_at: string | null
          id: string
          ingredient_ids: number[] | null
          ingredients: string[]
          keyword: string
          result_id: number | null
          result_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ingredient_ids?: number[] | null
          ingredients: string[]
          keyword: string
          result_id?: number | null
          result_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ingredient_ids?: number[] | null
          ingredients?: string[]
          keyword?: string
          result_id?: number | null
          result_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ego_gift_recipes_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "ego_gifts"
            referencedColumns: ["game_id"]
          },
        ]
      }
      ego_gift_theme_gifts: {
        Row: {
          gift_game_id: number
          position: number
          role: string
          theme_id: number
        }
        Insert: {
          gift_game_id: number
          position: number
          role: string
          theme_id: number
        }
        Update: {
          gift_game_id?: number
          position?: number
          role?: string
          theme_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ego_gift_theme_gifts_gift_game_id_fkey"
            columns: ["gift_game_id"]
            isOneToOne: false
            referencedRelation: "ego_gifts"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "ego_gift_theme_gifts_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "ego_gift_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      ego_gift_themes: {
        Row: {
          attack_type: string | null
          attribute_type: string | null
          boss_image_url: string | null
          boss_unit_ids: number[]
          created_at: string | null
          difficulty: string | null
          ego_gift_ids: number[]
          fixed_reward_gift_ids: number[] | null
          floor_info: Json | null
          hidden_rate: number | null
          id: number
          image_url: string | null
          is_hidden: boolean | null
          is_unrecordable: boolean
          name: string
          name_color: string | null
          name_en: string | null
          name_jp: string | null
          name_segments: Json | null
          specific_ego_gift_ids: number[]
          unlock_code: number | null
        }
        Insert: {
          attack_type?: string | null
          attribute_type?: string | null
          boss_image_url?: string | null
          boss_unit_ids?: number[]
          created_at?: string | null
          difficulty?: string | null
          ego_gift_ids?: number[]
          fixed_reward_gift_ids?: number[] | null
          floor_info?: Json | null
          hidden_rate?: number | null
          id: number
          image_url?: string | null
          is_hidden?: boolean | null
          is_unrecordable?: boolean
          name: string
          name_color?: string | null
          name_en?: string | null
          name_jp?: string | null
          name_segments?: Json | null
          specific_ego_gift_ids?: number[]
          unlock_code?: number | null
        }
        Update: {
          attack_type?: string | null
          attribute_type?: string | null
          boss_image_url?: string | null
          boss_unit_ids?: number[]
          created_at?: string | null
          difficulty?: string | null
          ego_gift_ids?: number[]
          fixed_reward_gift_ids?: number[] | null
          floor_info?: Json | null
          hidden_rate?: number | null
          id?: number
          image_url?: string | null
          is_hidden?: boolean | null
          is_unrecordable?: boolean
          name?: string
          name_color?: string | null
          name_en?: string | null
          name_jp?: string | null
          name_segments?: Json | null
          specific_ego_gift_ids?: number[]
          unlock_code?: number | null
        }
        Relationships: []
      }
      ego_gifts: {
        Row: {
          activation_condition: Json | null
          buy_disabled: boolean | null
          convert_to: number | null
          created_at: string | null
          difficulty: string | null
          effect_base: string | null
          effect_base_en: string | null
          effect_base_jp: string | null
          effect_plus: string | null
          effect_plus_en: string | null
          effect_plus_jp: string | null
          effect_plusplus: string | null
          effect_plusplus_en: string | null
          effect_plusplus_jp: string | null
          enhancement: boolean | null
          game_id: number
          grade: string
          id: string
          image_url: string | null
          is_synthesis: boolean | null
          keyword: string
          modifiers: Json | null
          name: string
          name_en: string | null
          name_jp: string | null
          price: number | null
        }
        Insert: {
          activation_condition?: Json | null
          buy_disabled?: boolean | null
          convert_to?: number | null
          created_at?: string | null
          difficulty?: string | null
          effect_base?: string | null
          effect_base_en?: string | null
          effect_base_jp?: string | null
          effect_plus?: string | null
          effect_plus_en?: string | null
          effect_plus_jp?: string | null
          effect_plusplus?: string | null
          effect_plusplus_en?: string | null
          effect_plusplus_jp?: string | null
          enhancement?: boolean | null
          game_id: number
          grade: string
          id?: string
          image_url?: string | null
          is_synthesis?: boolean | null
          keyword: string
          modifiers?: Json | null
          name: string
          name_en?: string | null
          name_jp?: string | null
          price?: number | null
        }
        Update: {
          activation_condition?: Json | null
          buy_disabled?: boolean | null
          convert_to?: number | null
          created_at?: string | null
          difficulty?: string | null
          effect_base?: string | null
          effect_base_en?: string | null
          effect_base_jp?: string | null
          effect_plus?: string | null
          effect_plus_en?: string | null
          effect_plus_jp?: string | null
          effect_plusplus?: string | null
          effect_plusplus_en?: string | null
          effect_plusplus_jp?: string | null
          enhancement?: boolean | null
          game_id?: number
          grade?: string
          id?: string
          image_url?: string | null
          is_synthesis?: boolean | null
          keyword?: string
          modifiers?: Json | null
          name?: string
          name_en?: string | null
          name_jp?: string | null
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ego_gifts_convert_to_fkey"
            columns: ["convert_to"]
            isOneToOne: false
            referencedRelation: "ego_gifts"
            referencedColumns: ["game_id"]
          },
        ]
      }
      ego_passives: {
        Row: {
          description: string
          description_en: string | null
          description_jp: string | null
          ego_id: string
          flavor: string | null
          flavor_en: string | null
          flavor_jp: string | null
          game_passive_id: number
          max_stage: number
          min_stage: number
          name: string
          name_en: string | null
          name_jp: string | null
        }
        Insert: {
          description: string
          description_en?: string | null
          description_jp?: string | null
          ego_id: string
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          game_passive_id: number
          max_stage: number
          min_stage: number
          name: string
          name_en?: string | null
          name_jp?: string | null
        }
        Update: {
          description?: string
          description_en?: string | null
          description_jp?: string | null
          ego_id?: string
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          game_passive_id?: number
          max_stage?: number
          min_stage?: number
          name?: string
          name_en?: string | null
          name_jp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ego_passives_ego_id_fkey"
            columns: ["ego_id"]
            isOneToOne: false
            referencedRelation: "ego"
            referencedColumns: ["id"]
          },
        ]
      }
      ego_skills: {
        Row: {
          atk_weight: number | null
          base_power: number | null
          category: string | null
          coin_list: Json | null
          coin_power: number | null
          coins: number | null
          construe_level: number | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_jp: string | null
          ego_id: string
          game_skill_id: number | null
          id: string
          mental_consume: number | null
          name: string
          name_en: string | null
          name_jp: string | null
          offense_level: number | null
          sin_affinity: string | null
          skill_order: number | null
          skill_type: string | null
        }
        Insert: {
          atk_weight?: number | null
          base_power?: number | null
          category?: string | null
          coin_list?: Json | null
          coin_power?: number | null
          coins?: number | null
          construe_level?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          ego_id: string
          game_skill_id?: number | null
          id?: string
          mental_consume?: number | null
          name: string
          name_en?: string | null
          name_jp?: string | null
          offense_level?: number | null
          sin_affinity?: string | null
          skill_order?: number | null
          skill_type?: string | null
        }
        Update: {
          atk_weight?: number | null
          base_power?: number | null
          category?: string | null
          coin_list?: Json | null
          coin_power?: number | null
          coins?: number | null
          construe_level?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          ego_id?: string
          game_skill_id?: number | null
          id?: string
          mental_consume?: number | null
          name?: string
          name_en?: string | null
          name_jp?: string | null
          offense_level?: number | null
          sin_affinity?: string | null
          skill_order?: number | null
          skill_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ego_skills_ego_id_fkey"
            columns: ["ego_id"]
            isOneToOne: false
            referencedRelation: "ego"
            referencedColumns: ["id"]
          },
        ]
      }
      final_gift_presets: {
        Row: {
          gift_keys: string[]
          id: string
          name: string
          slot: number
          updated_at: string
          user_id: string
        }
        Insert: {
          gift_keys?: string[]
          id?: string
          name: string
          slot: number
          updated_at?: string
          user_id: string
        }
        Update: {
          gift_keys?: string[]
          id?: string
          name?: string
          slot?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "final_gift_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_blocks: {
        Row: {
          created_at: string
          key_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          key_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          key_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_blocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_exchanges: {
        Row: {
          created_at: string
          post_id: string
          viewer_code: string
          viewer_key_hash: string | null
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          post_id: string
          viewer_code: string
          viewer_key_hash?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          post_id?: string
          viewer_code?: string
          viewer_key_hash?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_exchanges_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "friend_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_exchanges_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_posts: {
        Row: {
          bumped_at: string
          code: string
          created_at: string
          guest_tag: string | null
          id: string
          identity_ids: string[]
          key_hash: string | null
          kind: string
          pin_failed_at: string | null
          pin_fails: number
          pin_hash: string | null
          seen_at: string
          slots: Json
          user_id: string | null
          visibility: string
        }
        Insert: {
          bumped_at?: string
          code: string
          created_at?: string
          guest_tag?: string | null
          id?: string
          identity_ids?: string[]
          key_hash?: string | null
          kind: string
          pin_failed_at?: string | null
          pin_fails?: number
          pin_hash?: string | null
          seen_at?: string
          slots?: Json
          user_id?: string | null
          visibility?: string
        }
        Update: {
          bumped_at?: string
          code?: string
          created_at?: string
          guest_tag?: string | null
          id?: string
          identity_ids?: string[]
          key_hash?: string | null
          kind?: string
          pin_failed_at?: string | null
          pin_fails?: number
          pin_hash?: string | null
          seen_at?: string
          slots?: Json
          user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_reports: {
        Row: {
          created_at: string
          post_id: string
          reporter_key_hash: string | null
          reporter_user_id: string | null
        }
        Insert: {
          created_at?: string
          post_id: string
          reporter_key_hash?: string | null
          reporter_user_id?: string | null
        }
        Update: {
          created_at?: string
          post_id?: string
          reporter_key_hash?: string | null
          reporter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "friend_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          post_id: string
          status: string
          viewer_key_hash: string | null
          viewer_tag: string | null
          viewer_user_id: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          post_id: string
          status?: string
          viewer_key_hash?: string | null
          viewer_tag?: string | null
          viewer_user_id?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          post_id?: string
          status?: string
          viewer_key_hash?: string | null
          viewer_tag?: string | null
          viewer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "friend_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_viewer_user_id_fkey"
            columns: ["viewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_want_stats: {
        Row: {
          count: number
          day: string
          identity_id: string
        }
        Insert: {
          count?: number
          day: string
          identity_id: string
        }
        Update: {
          count?: number
          day?: string
          identity_id?: string
        }
        Relationships: []
      }
      game_text_refs: {
        Row: {
          description: string | null
          description_en: string | null
          description_jp: string | null
          flavor: string | null
          flavor_en: string | null
          flavor_jp: string | null
          icon_slug: string | null
          id: string
          keyword_name: string | null
          kind: string
          name: string | null
          name_en: string | null
          name_jp: string | null
          updated_at: string
        }
        Insert: {
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          icon_slug?: string | null
          id: string
          keyword_name?: string | null
          kind: string
          name?: string | null
          name_en?: string | null
          name_jp?: string | null
          updated_at?: string
        }
        Update: {
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          icon_slug?: string | null
          id?: string
          keyword_name?: string | null
          kind?: string
          name?: string | null
          name_en?: string | null
          name_jp?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gift_presets: {
        Row: {
          groups: Json
          id: string
          name: string
          slot: number
          updated_at: string
          user_id: string
        }
        Insert: {
          groups: Json
          id?: string
          name?: string
          slot: number
          updated_at?: string
          user_id: string
        }
        Update: {
          groups?: Json
          id?: string
          name?: string
          slot?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_authorship: {
        Row: {
          created_at: string
          deck_id: string | null
          key_hash: string
          pin_failed_at: string | null
          pin_fails: number
          pin_hash: string | null
          plan_id: string | null
        }
        Insert: {
          created_at?: string
          deck_id?: string | null
          key_hash: string
          pin_failed_at?: string | null
          pin_fails?: number
          pin_hash?: string | null
          plan_id?: string | null
        }
        Update: {
          created_at?: string
          deck_id?: string | null
          key_hash?: string
          pin_failed_at?: string | null
          pin_fails?: number
          pin_hash?: string | null
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guest_authorship_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_authorship_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "md_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      identities: {
        Row: {
          acquisition: string | null
          acquisition_info: Json | null
          affiliation: string | null
          association_list: string[]
          base_hp: number | null
          bg_image_url: string | null
          blunt_res: string | null
          break_section: number[] | null
          def_level: number | null
          folder_name: string | null
          game_id: string
          hp: number | null
          hp_per_level: number | null
          id: string
          keywords: string[] | null
          name_en: string | null
          name_jp: string | null
          name_kr: string
          panic_type: number | null
          pierce_res: string | null
          quote: string | null
          rarity: number
          release_date: string | null
          sin_affinity: string | null
          sinner_id: string
          skill_condition_list: string[]
          skill_keyword_list: string[]
          slash_res: string | null
          speed_max: number | null
          speed_min: number | null
          tier: number | null
          unit_keyword_list: string[]
        }
        Insert: {
          acquisition?: string | null
          acquisition_info?: Json | null
          affiliation?: string | null
          association_list?: string[]
          base_hp?: number | null
          bg_image_url?: string | null
          blunt_res?: string | null
          break_section?: number[] | null
          def_level?: number | null
          folder_name?: string | null
          game_id: string
          hp?: number | null
          hp_per_level?: number | null
          id?: string
          keywords?: string[] | null
          name_en?: string | null
          name_jp?: string | null
          name_kr: string
          panic_type?: number | null
          pierce_res?: string | null
          quote?: string | null
          rarity?: number
          release_date?: string | null
          sin_affinity?: string | null
          sinner_id: string
          skill_condition_list?: string[]
          skill_keyword_list?: string[]
          slash_res?: string | null
          speed_max?: number | null
          speed_min?: number | null
          tier?: number | null
          unit_keyword_list?: string[]
        }
        Update: {
          acquisition?: string | null
          acquisition_info?: Json | null
          affiliation?: string | null
          association_list?: string[]
          base_hp?: number | null
          bg_image_url?: string | null
          blunt_res?: string | null
          break_section?: number[] | null
          def_level?: number | null
          folder_name?: string | null
          game_id?: string
          hp?: number | null
          hp_per_level?: number | null
          id?: string
          keywords?: string[] | null
          name_en?: string | null
          name_jp?: string | null
          name_kr?: string
          panic_type?: number | null
          pierce_res?: string | null
          quote?: string | null
          rarity?: number
          release_date?: string | null
          sin_affinity?: string | null
          sinner_id?: string
          skill_condition_list?: string[]
          skill_keyword_list?: string[]
          slash_res?: string | null
          speed_max?: number | null
          speed_min?: number | null
          tier?: number | null
          unit_keyword_list?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "fk_identities_panic_type"
            columns: ["panic_type"]
            isOneToOne: false
            referencedRelation: "panic_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_sinner_id_fkey"
            columns: ["sinner_id"]
            isOneToOne: false
            referencedRelation: "sinners"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_sanity_conditions: {
        Row: {
          condition_type: string
          id: number
          identity_id: string
          params: number[]
          sort_order: number
          template_id: string
        }
        Insert: {
          condition_type: string
          id?: number
          identity_id: string
          params?: number[]
          sort_order?: number
          template_id: string
        }
        Update: {
          condition_type?: string
          id?: number
          identity_id?: string
          params?: number[]
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_sanity_conditions_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_sanity_conditions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "mental_condition_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          category: string
          closed_at: string | null
          content: string
          contribution_accepted: boolean
          created_at: string
          id: string
          last_admin_message_at: string | null
          last_message_at: string | null
          replied_at: string | null
          replied_by: string | null
          reply: string
          status: string
          title: string
          updated_at: string
          user_id: string
          user_last_read_at: string | null
        }
        Insert: {
          category: string
          closed_at?: string | null
          content: string
          contribution_accepted?: boolean
          created_at?: string
          id?: string
          last_admin_message_at?: string | null
          last_message_at?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          user_last_read_at?: string | null
        }
        Update: {
          category?: string
          closed_at?: string | null
          content?: string
          contribution_accepted?: boolean
          created_at?: string
          id?: string
          last_admin_message_at?: string | null
          last_message_at?: string | null
          replied_at?: string | null
          replied_by?: string | null
          reply?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          user_last_read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_meta: {
        Row: {
          abilities: Json | null
          category: string | null
          description: string | null
          description_en: string | null
          description_jp: string | null
          effect_type: string | null
          game_id: string | null
          icon_slug: string | null
          max_stack: number | null
          name: string
          name_en: string | null
          name_jp: string | null
        }
        Insert: {
          abilities?: Json | null
          category?: string | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          effect_type?: string | null
          game_id?: string | null
          icon_slug?: string | null
          max_stack?: number | null
          name: string
          name_en?: string | null
          name_jp?: string | null
        }
        Update: {
          abilities?: Json | null
          category?: string | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          effect_type?: string | null
          game_id?: string | null
          icon_slug?: string | null
          max_stack?: number | null
          name?: string
          name_en?: string | null
          name_jp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_meta_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_text_refs"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acknowledgements: {
        Row: {
          acknowledged_at: string
          doc_type: string
          user_id: string
          version: string
        }
        Insert: {
          acknowledged_at?: string
          doc_type: string
          user_id: string
          version: string
        }
        Update: {
          acknowledged_at?: string
          doc_type?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_docs: {
        Row: {
          lang: string
          last_updated: string
          sections: Json
          title: string
          type: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          lang?: string
          last_updated: string
          sections?: Json
          title: string
          type: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          lang?: string
          last_updated?: string
          sections?: Json
          title?: string
          type?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      md_event_choices: {
        Row: {
          created_at: string | null
          effects: Json | null
          event_id: number
          id: number
          message: string | null
          message_desc: string | null
          message_desc_en: string | null
          message_desc_jp: string | null
          message_en: string | null
          message_jp: string | null
          next_event_id: number | null
          option_index: number | null
          outcome: string | null
          probability: string | null
          result_condition: string | null
          result_index: number | null
          result_text: string | null
          result_text_en: string | null
          result_text_jp: string | null
          selection_condition: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          effects?: Json | null
          event_id: number
          id?: number
          message?: string | null
          message_desc?: string | null
          message_desc_en?: string | null
          message_desc_jp?: string | null
          message_en?: string | null
          message_jp?: string | null
          next_event_id?: number | null
          option_index?: number | null
          outcome?: string | null
          probability?: string | null
          result_condition?: string | null
          result_index?: number | null
          result_text?: string | null
          result_text_en?: string | null
          result_text_jp?: string | null
          selection_condition?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          effects?: Json | null
          event_id?: number
          id?: number
          message?: string | null
          message_desc?: string | null
          message_desc_en?: string | null
          message_desc_jp?: string | null
          message_en?: string | null
          message_jp?: string | null
          next_event_id?: number | null
          option_index?: number | null
          outcome?: string | null
          probability?: string | null
          result_condition?: string | null
          result_index?: number | null
          result_text?: string | null
          result_text_en?: string | null
          result_text_jp?: string | null
          selection_condition?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "md_event_choices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "md_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "md_event_choices_next_event_id_fkey"
            columns: ["next_event_id"]
            isOneToOne: false
            referencedRelation: "md_events"
            referencedColumns: ["id"]
          },
        ]
      }
      md_event_gifts: {
        Row: {
          event_id: number
          gift_game_id: number
          position: number
        }
        Insert: {
          event_id: number
          gift_game_id: number
          position: number
        }
        Update: {
          event_id?: number
          gift_game_id?: number
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "md_event_gifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "md_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "md_event_gifts_gift_game_id_fkey"
            columns: ["gift_game_id"]
            isOneToOne: false
            referencedRelation: "ego_gifts"
            referencedColumns: ["game_id"]
          },
        ]
      }
      md_event_themes: {
        Row: {
          event_id: number
          position: number
          theme_id: number
        }
        Insert: {
          event_id: number
          position: number
          theme_id: number
        }
        Update: {
          event_id?: number
          position?: number
          theme_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "md_event_themes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "md_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "md_event_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "ego_gift_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      md_events: {
        Row: {
          category: string | null
          created_at: string | null
          desc_text: string | null
          desc_text_en: string | null
          desc_text_jp: string | null
          event_type: string | null
          gift_ids: number[] | null
          id: number
          image_url: string | null
          judgment: Json | null
          name: string | null
          name_en: string | null
          name_jp: string | null
          source: string | null
          theme_ids: number[] | null
          variant_of: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          desc_text?: string | null
          desc_text_en?: string | null
          desc_text_jp?: string | null
          event_type?: string | null
          gift_ids?: number[] | null
          id: number
          image_url?: string | null
          judgment?: Json | null
          name?: string | null
          name_en?: string | null
          name_jp?: string | null
          source?: string | null
          theme_ids?: number[] | null
          variant_of?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          desc_text?: string | null
          desc_text_en?: string | null
          desc_text_jp?: string | null
          event_type?: string | null
          gift_ids?: number[] | null
          id?: number
          image_url?: string | null
          judgment?: Json | null
          name?: string | null
          name_en?: string | null
          name_jp?: string | null
          source?: string | null
          theme_ids?: number[] | null
          variant_of?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "md_events_variant_of_fkey"
            columns: ["variant_of"]
            isOneToOne: false
            referencedRelation: "md_events"
            referencedColumns: ["id"]
          },
        ]
      }
      md_observation: {
        Row: {
          costs: Json
          gift_ids: number[]
          keyword_groups: Json
          mirror_dungeon_id: number
          source_file: string
          unobservable_gift_ids: number[]
        }
        Insert: {
          costs: Json
          gift_ids: number[]
          keyword_groups: Json
          mirror_dungeon_id: number
          source_file: string
          unobservable_gift_ids?: number[]
        }
        Update: {
          costs?: Json
          gift_ids?: number[]
          keyword_groups?: Json
          mirror_dungeon_id?: number
          source_file?: string
          unobservable_gift_ids?: number[]
        }
        Relationships: []
      }
      md_plan_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          plan_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          plan_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          plan_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "md_plan_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "md_plan_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "md_plan_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "md_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "md_plan_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      md_plan_votes: {
        Row: {
          plan_id: string
          user_id: string
        }
        Insert: {
          plan_id: string
          user_id: string
        }
        Update: {
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "md_plan_votes_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "md_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "md_plan_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      md_plans: {
        Row: {
          comment_count: number
          content_edited_at: string | null
          created_at: string
          deck: Json
          description: string | null
          difficulty: string
          egos: Json
          floor_plan: Json
          gift_inventory: Json
          guest_tag: string | null
          id: string
          lang: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string | null
          view_count: number
          vote_count: number
        }
        Insert: {
          comment_count?: number
          content_edited_at?: string | null
          created_at?: string
          deck?: Json
          description?: string | null
          difficulty?: string
          egos?: Json
          floor_plan?: Json
          gift_inventory?: Json
          guest_tag?: string | null
          id?: string
          lang?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id?: string | null
          view_count?: number
          vote_count?: number
        }
        Update: {
          comment_count?: number
          content_edited_at?: string | null
          created_at?: string
          deck?: Json
          description?: string | null
          difficulty?: string
          egos?: Json
          floor_plan?: Json
          gift_inventory?: Json
          guest_tag?: string | null
          id?: string
          lang?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string | null
          view_count?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "md_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mental_condition_templates: {
        Row: {
          add_text: string
          add_text_en: string | null
          add_text_jp: string | null
          id: string
          min_text: string
          min_text_en: string | null
          min_text_jp: string | null
        }
        Insert: {
          add_text: string
          add_text_en?: string | null
          add_text_jp?: string | null
          id: string
          min_text: string
          min_text_en?: string | null
          min_text_jp?: string | null
        }
        Update: {
          add_text?: string
          add_text_en?: string | null
          add_text_jp?: string | null
          id?: string
          min_text?: string
          min_text_en?: string | null
          min_text_jp?: string | null
        }
        Relationships: []
      }
      news_items: {
        Row: {
          author: Json | null
          category: string
          content: Json
          created_at: string
          ends_at: string | null
          external_id: string
          feed: string
          id: string
          partner: string
          platform: string
          published_at: string
          spoiler: boolean
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          author?: Json | null
          category?: string
          content: Json
          created_at?: string
          ends_at?: string | null
          external_id: string
          feed: string
          id?: string
          partner: string
          platform: string
          published_at: string
          spoiler?: boolean
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          author?: Json | null
          category?: string
          content?: Json
          created_at?: string
          ends_at?: string | null
          external_id?: string
          feed?: string
          id?: string
          partner?: string
          platform?: string
          published_at?: string
          spoiler?: boolean
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_items_partner_fkey"
            columns: ["partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["code"]
          },
        ]
      }
      panic_types: {
        Row: {
          description: string
          description_en: string | null
          description_jp: string | null
          id: number
          name: string
          name_en: string | null
          name_jp: string | null
        }
        Insert: {
          description: string
          description_en?: string | null
          description_jp?: string | null
          id: number
          name: string
          name_en?: string | null
          name_jp?: string | null
        }
        Update: {
          description?: string
          description_en?: string | null
          description_jp?: string | null
          id?: number
          name?: string
          name_en?: string | null
          name_jp?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          code: string
          created_at: string
          name: string
          scopes: string[]
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          scopes?: string[]
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          scopes?: string[]
        }
        Relationships: []
      }
      passives: {
        Row: {
          active_cond: string | null
          description: string | null
          description_en: string | null
          description_jp: string | null
          flavor: string | null
          flavor_en: string | null
          flavor_jp: string | null
          id: string
          identity_id: string
          name: string
          name_en: string | null
          name_jp: string | null
          passive_order: number | null
          passive_type: string
          sin_affinity: string | null
          sin_count: number | null
          sin_requirements: Json | null
          uptie_level: number | null
        }
        Insert: {
          active_cond?: string | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          id?: string
          identity_id: string
          name: string
          name_en?: string | null
          name_jp?: string | null
          passive_order?: number | null
          passive_type: string
          sin_affinity?: string | null
          sin_count?: number | null
          sin_requirements?: Json | null
          uptie_level?: number | null
        }
        Update: {
          active_cond?: string | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          id?: string
          identity_id?: string
          name?: string
          name_en?: string | null
          name_jp?: string | null
          passive_order?: number | null
          passive_type?: string
          sin_affinity?: string | null
          sin_count?: number | null
          sin_requirements?: Json | null
          uptie_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "passives_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_access_signals: {
        Row: {
          country: string | null
          created_at: string
          device_hash: string | null
          id: string
          ip_hash: string | null
          ip_masked: string | null
          profile_id: string
          seen_at: string
          user_agent_hash: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          ip_masked?: string | null
          profile_id: string
          seen_at?: string
          user_agent_hash?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          device_hash?: string | null
          id?: string
          ip_hash?: string | null
          ip_masked?: string | null
          profile_id?: string
          seen_at?: string
          user_agent_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_access_signals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_duplicate_signal_events: {
        Row: {
          created_at: string
          first_detected_at: string
          id: string
          last_detected_at: string
          match_snapshot: Json
          matched_profile_ids: string[]
          profile_id: string
          signal_grade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          match_snapshot?: Json
          matched_profile_ids?: string[]
          profile_id: string
          signal_grade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_detected_at?: string
          id?: string
          last_detected_at?: string
          match_snapshot?: Json
          matched_profile_ids?: string[]
          profile_id?: string
          signal_grade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_duplicate_signal_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_easter_eggs: {
        Row: {
          egg: string
          found_at: string
          user_id: string
        }
        Insert: {
          egg: string
          found_at?: string
          user_id: string
        }
        Update: {
          egg?: string
          found_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_easter_eggs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          collection_code: string | null
          created_at: string | null
          id: string
          last_country: string | null
          last_device_hash: string | null
          last_ip_hash: string | null
          last_ip_masked: string | null
          last_seen_at: string | null
          last_user_agent_hash: string | null
          notifications_read_at: string
          notify_comments: boolean
          notify_follows: boolean
          notify_posts: boolean
          partner: string | null
          preferred_lang: string
          public_followers: boolean
          public_following: boolean
          public_profile: boolean
          role: string | null
          suspended: boolean | null
          suspended_at: string | null
          suspended_by: string | null
          suspended_until: string | null
          suspension_reason: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          collection_code?: string | null
          created_at?: string | null
          id: string
          last_country?: string | null
          last_device_hash?: string | null
          last_ip_hash?: string | null
          last_ip_masked?: string | null
          last_seen_at?: string | null
          last_user_agent_hash?: string | null
          notifications_read_at?: string
          notify_comments?: boolean
          notify_follows?: boolean
          notify_posts?: boolean
          partner?: string | null
          preferred_lang?: string
          public_followers?: boolean
          public_following?: boolean
          public_profile?: boolean
          role?: string | null
          suspended?: boolean | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          collection_code?: string | null
          created_at?: string | null
          id?: string
          last_country?: string | null
          last_device_hash?: string | null
          last_ip_hash?: string | null
          last_ip_masked?: string | null
          last_seen_at?: string | null
          last_user_agent_hash?: string | null
          notifications_read_at?: string
          notify_comments?: boolean
          notify_follows?: boolean
          notify_posts?: boolean
          partner?: string | null
          preferred_lang?: string
          public_followers?: boolean
          public_following?: boolean
          public_profile?: boolean
          role?: string | null
          suspended?: boolean | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_partner_fkey"
            columns: ["partner"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          lang: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          lang?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          lang?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series_items: {
        Row: {
          created_at: string
          deck_id: string | null
          id: string
          plan_id: string | null
          position: number
          series_id: string
        }
        Insert: {
          created_at?: string
          deck_id?: string | null
          id?: string
          plan_id?: string | null
          position: number
          series_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string | null
          id?: string
          plan_id?: string | null
          position?: number
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_items_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "md_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_items_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      sinners: {
        Row: {
          description: string | null
          id: string
          literary_source: string | null
          name: string
          name_en: string | null
          name_jp: string | null
          name_kr: string
          order_num: number | null
        }
        Insert: {
          description?: string | null
          id: string
          literary_source?: string | null
          name: string
          name_en?: string | null
          name_jp?: string | null
          name_kr: string
          order_num?: number | null
        }
        Update: {
          description?: string | null
          id?: string
          literary_source?: string | null
          name?: string
          name_en?: string | null
          name_jp?: string | null
          name_kr?: string
          order_num?: number | null
        }
        Relationships: []
      }
      site_maintenance: {
        Row: {
          created_at: string
          ends_at: string | null
          id: number
          is_active: boolean
          label: string
          message: string
          path: string
          reason: string
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: number
          is_active?: boolean
          label?: string
          message?: string
          path: string
          reason?: string
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: number
          is_active?: boolean
          label?: string
          message?: string
          path?: string
          reason?: string
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          atk_type: string | null
          atk_weight: number | null
          base_power: number | null
          coin_list: Json | null
          coin_power: number | null
          coins: number | null
          description: string | null
          description_en: string | null
          description_jp: string | null
          flavor: string | null
          flavor_en: string | null
          flavor_jp: string | null
          game_skill_id: number | null
          id: string
          identity_id: string
          image_id: string | null
          is_variant: boolean | null
          name: string
          name_en: string | null
          name_jp: string | null
          offense_level: number | null
          sin_affinity: string | null
          skill_order: number | null
          skill_tier: number | null
          skill_type: string | null
          uptie_level: number | null
          variant_order: number | null
        }
        Insert: {
          atk_type?: string | null
          atk_weight?: number | null
          base_power?: number | null
          coin_list?: Json | null
          coin_power?: number | null
          coins?: number | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          game_skill_id?: number | null
          id?: string
          identity_id: string
          image_id?: string | null
          is_variant?: boolean | null
          name: string
          name_en?: string | null
          name_jp?: string | null
          offense_level?: number | null
          sin_affinity?: string | null
          skill_order?: number | null
          skill_tier?: number | null
          skill_type?: string | null
          uptie_level?: number | null
          variant_order?: number | null
        }
        Update: {
          atk_type?: string | null
          atk_weight?: number | null
          base_power?: number | null
          coin_list?: Json | null
          coin_power?: number | null
          coins?: number | null
          description?: string | null
          description_en?: string | null
          description_jp?: string | null
          flavor?: string | null
          flavor_en?: string | null
          flavor_jp?: string | null
          game_skill_id?: number | null
          id?: string
          identity_id?: string
          image_id?: string | null
          is_variant?: boolean | null
          name?: string
          name_en?: string | null
          name_jp?: string | null
          offense_level?: number | null
          sin_affinity?: string | null
          skill_order?: number | null
          skill_tier?: number | null
          skill_type?: string | null
          uptie_level?: number | null
          variant_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_identity_id_fkey"
            columns: ["identity_id"]
            isOneToOne: false
            referencedRelation: "identities"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string | null
          author_role: string
          body: string
          created_at: string
          id: string
          inquiry_id: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      passives_max_uptie: {
        Row: {
          active_cond: string | null
          description: string | null
          description_en: string | null
          description_jp: string | null
          flavor: string | null
          flavor_en: string | null
          flavor_jp: string | null
          id: string | null
          identity_id: string | null
          name: string | null
          name_en: string | null
          name_jp: string | null
          passive_order: number | null
          passive_type: string | null
          sin_affinity: string | null
          sin_count: number | null
          sin_requirements: Json | null
          uptie_level: number | null
        }
        Relationships: []
      }
      skills_max_uptie: {
        Row: {
          atk_type: string | null
          atk_weight: number | null
          base_power: number | null
          coin_list: Json | null
          coin_power: number | null
          coins: number | null
          description: string | null
          description_en: string | null
          description_jp: string | null
          flavor: string | null
          flavor_en: string | null
          flavor_jp: string | null
          game_skill_id: number | null
          id: string | null
          identity_id: string | null
          image_id: string | null
          is_variant: boolean | null
          name: string | null
          name_en: string | null
          name_jp: string | null
          offense_level: number | null
          sin_affinity: string | null
          skill_order: number | null
          skill_tier: number | null
          skill_type: string | null
          uptie_level: number | null
          variant_order: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_inquiry_notifications: {
        Args: {
          user_email: string
          max_rows?: number
        }
        Returns: {
          kind: string
          target_type: string
          target_id: string
          target_title: string
          comment_id: string
          actor_name: string
          actor_avatar: string
          excerpt: string
          created_at: string
          unread: boolean
        }[]
      }
      admin_list_users: {
        Args: {
          p_search?: string
          p_status?: string
          p_offset?: number
          p_limit?: number
        }
        Returns: Json
      }
      admin_moderate_user: {
        Args: {
          p_actor_email: string
          p_target_id: string
          p_suspend: boolean
          p_reason: string
          p_days: number
          p_expected_suspended_at: string
          p_admin_emails: string[]
        }
        Returns: Json
      }
      admin_set_partner: {
        Args: {
          p_actor_email: string
          p_target_id: string
          p_partner: string
          p_admin_emails: string[]
        }
        Returns: Json
      }
      assist_sample_bytes_since: {
        Args: {
          since: string
        }
        Returns: number
      }
      community_follows: {
        Args: {
          p_user: string
          p_viewer?: string
          p_kind?: string
          p_offset?: number
        }
        Returns: Json
      }
      community_record_deck: {
        Args: {
          p_deck_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      community_record_plan: {
        Args: {
          p_plan_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      community_set_follow: {
        Args: {
          p_actor: string
          p_target: string
          p_follow: boolean
        }
        Returns: boolean
      }
      community_summary: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      consume_developer_key: {
        Args: {
          token_hash: string
          p_admin_emails: string[]
        }
        Returns: Json
      }
      discovery_counts_since: {
        Args: {
          since?: string
        }
        Returns: {
          kind: string
          entity_id: string
          visitors: number
        }[]
      }
      discovery_covisited: {
        Args: {
          entity: string
          post_kind: string
          since?: string
          max_rows?: number
        }
        Returns: {
          entity_id: string
          covisitors: number
          visitors: number
        }[]
      }
      discovery_recent_edits: {
        Args: {
          p_kind: string
        }
        Returns: {
          entity_id: string
          edited_at: string
        }[]
      }
      discovery_rising_windows: {
        Args: {
          post_kind: string
          recent_days?: number
          base_days?: number
          gap_ratio?: number
          max_rows?: number
        }
        Returns: {
          entity_id: string
          recent: number
          base: number
          recent_total: number
          base_total: number
        }[]
      }
      discovery_user_id: {
        Args: {
          user_email: string
        }
        Returns: string
      }
      expire_suspensions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_user_role: {
        Args: {
          user_email: string
        }
        Returns: string
      }
      guest_pin_recover: {
        Args: {
          p_kind: string
          p_id: string
          p_pin_hash: string
          p_key_hash: string
        }
        Returns: string
      }
      identity_interest: {
        Args: {
          identity_id: string
        }
        Returns: Json
      }
      increment_md_plan_view: {
        Args: {
          plan_id: string
        }
        Returns: undefined
      }
      increment_view: {
        Args: {
          deck_id: string
        }
        Returns: undefined
      }
      is_user_suspended: {
        Args: {
          user_email: string
        }
        Returns: boolean
      }
      mark_notifications_read: {
        Args: {
          user_email: string
        }
        Returns: undefined
      }
      match_assist_text_embeddings: {
        Args: {
          query_embedding: string
          query_locale: string
          query_model_id: string
          query_model_revision: string
          query_preprocess_version: string
          query_entity_kind?: string
          match_count?: number
        }
        Returns: {
          entity_kind: string
          entity_id: number
          locale: string
          field_name: string
          chunk_index: number
          content: string
          similarity: number
        }[]
      }
      record_profile_activity: {
        Args: {
          user_email: string
          request_ip_hash?: string
          request_ip_masked?: string
          request_user_agent_hash?: string
          request_country?: string
          request_device_hash?: string
        }
        Returns: string
      }
      replace_deck: {
        Args: {
          p_deck_id: string
          p_patch: Json
          p_identities: Json
          p_egos: Json
        }
        Returns: undefined
      }
      replace_md_event_graph: {
        Args: {
          p_events: Json
          p_choices: Json
        }
        Returns: Json
      }
      support_unread: {
        Args: {
          user_email: string
        }
        Returns: boolean
      }
      toggle_deck_vote: {
        Args: {
          p_deck_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      toggle_plan_vote: {
        Args: {
          p_plan_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_notifications: {
        Args: {
          user_email: string
          max_rows?: number
        }
        Returns: {
          kind: string
          target_type: string
          target_id: string
          target_title: string
          comment_id: string
          actor_name: string
          actor_avatar: string
          excerpt: string
          created_at: string
          unread: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["limbus"]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]

export type CompositeTypes<T extends keyof DefaultSchema["CompositeTypes"]> =
  DefaultSchema["CompositeTypes"][T]

export const Constants = {
  limbus: {
    Enums: {},
  },
} as const

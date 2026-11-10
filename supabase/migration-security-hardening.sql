-- =============================================================================
-- migration-security-hardening.sql
-- Security hardening migration for the limbus schema.
--
-- Fixes addressed:
--   1. Revoke GRANT ALL from anon/authenticated — replace with least-privilege
--   2. Enable RLS on tables missing it (skills, deck_identities, site_maintenance,
--      ego_skills, ego_gift_themes)
--   3. Fix audit_logs SELECT policy — restrict to admin/moderator only
--   4. Add limbus.toggle_vote() — atomic vote toggle RPC
--   5. Add limbus.delete_user_account() — atomic account deletion RPC
--   6. Fix deck_egos INSERT/DELETE policies — tie to deck ownership
--
-- Idempotency: All statements use IF EXISTS / OR REPLACE / IF NOT EXISTS.
-- This file is safe to run multiple times.
-- =============================================================================


-- =============================================================================
-- SECTION 1: Revoke excessive permissions — replace GRANT ALL with
--             least-privilege grants for anon and authenticated roles.
-- =============================================================================

-- Revoke blanket grants that were set in grant-limbus.sql
REVOKE ALL ON ALL TABLES    IN SCHEMA limbus FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA limbus FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES  IN SCHEMA limbus FROM anon, authenticated;

-- Schema USAGE is still required for all roles to access tables
GRANT USAGE ON SCHEMA limbus TO anon, authenticated, service_role;

-- ── 1a. Read-only game data tables ──────────────────────────────────────────
-- These tables contain static game data. No writes from clients ever needed.
-- RLS policies on each table further restrict access; SELECT here is the floor.

GRANT SELECT ON limbus.sinners                    TO anon, authenticated;
GRANT SELECT ON limbus.identities                 TO anon, authenticated;
GRANT SELECT ON limbus.skills                     TO anon, authenticated;
GRANT SELECT ON limbus.passives                   TO anon, authenticated;
GRANT SELECT ON limbus.ego                        TO anon, authenticated;
GRANT SELECT ON limbus.ego_skills                 TO anon, authenticated;
GRANT SELECT ON limbus.ego_gifts                  TO anon, authenticated;
GRANT SELECT ON limbus.ego_gift_recipes           TO anon, authenticated;
GRANT SELECT ON limbus.ego_gift_themes            TO anon, authenticated;
GRANT SELECT ON limbus.keyword_meta               TO anon, authenticated;
GRANT SELECT ON limbus.announcements              TO anon, authenticated;
GRANT SELECT ON limbus.identity_guides            TO anon, authenticated;
GRANT SELECT ON limbus.site_maintenance           TO anon, authenticated;
GRANT SELECT ON limbus.panic_types                TO anon, authenticated;
GRANT SELECT ON limbus.mental_condition_templates TO anon, authenticated;
GRANT SELECT ON limbus.identity_sanity_conditions TO anon, authenticated;
GRANT SELECT ON limbus.mirror_dungeon_events      TO anon, authenticated;

-- ── 1b. User-generated content tables ───────────────────────────────────────
-- Full DML is granted here; RLS policies enforce per-row ownership checks.
-- anon users can SELECT public content (e.g. browse decks) but not write.

GRANT SELECT                         ON limbus.profiles          TO anon;
GRANT SELECT, UPDATE                 ON limbus.profiles          TO authenticated;

GRANT SELECT                         ON limbus.decks             TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON limbus.decks             TO authenticated;

GRANT SELECT                         ON limbus.deck_identities   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON limbus.deck_identities   TO authenticated;

GRANT SELECT                         ON limbus.deck_votes        TO anon;
GRANT SELECT, INSERT, DELETE         ON limbus.deck_votes        TO authenticated;

GRANT SELECT                         ON limbus.deck_bookmarks    TO anon;
GRANT SELECT, INSERT, DELETE         ON limbus.deck_bookmarks    TO authenticated;

GRANT SELECT                         ON limbus.deck_comments     TO anon;
GRANT SELECT, INSERT, DELETE         ON limbus.deck_comments     TO authenticated;

GRANT SELECT                         ON limbus.deck_egos         TO anon;
GRANT SELECT, INSERT, DELETE         ON limbus.deck_egos         TO authenticated;

GRANT SELECT                         ON limbus.identity_reviews  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON limbus.identity_reviews  TO authenticated;

-- audit_logs: no direct table access for anon/authenticated — only via RPC
-- (reads go through the is_admin() check in the RLS policy below)
GRANT SELECT ON limbus.audit_logs TO authenticated;

-- ── 1c. Sequences ────────────────────────────────────────────────────────────
-- Only sequences backing UGC tables need USAGE/SELECT for authenticated inserts.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA limbus TO authenticated;

-- ── 1d. RPC functions — grant EXECUTE only on functions users legitimately call
GRANT EXECUTE ON FUNCTION limbus.increment_view(UUID)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION limbus.get_user_role(TEXT)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION limbus.is_user_suspended(TEXT)   TO authenticated, service_role;

-- ── 1e. service_role keeps ALL (needed for admin API routes) ─────────────────
GRANT ALL ON ALL TABLES    IN SCHEMA limbus TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA limbus TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA limbus TO service_role;

-- ── 1f. Fix ALTER DEFAULT PRIVILEGES to match least-privilege model ──────────
-- These apply to tables/sequences/routines created in the future.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  REVOKE ALL ON ROUTINES FROM anon, authenticated;

-- Future game-data tables default to SELECT only for anon/authenticated.
-- UGC tables will need explicit GRANTs added after creation.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA limbus
  GRANT ALL ON ROUTINES  TO service_role;


-- =============================================================================
-- SECTION 2: Enable RLS on tables that are missing it.
-- =============================================================================

-- limbus.skills — game data table, no RLS in original schema.sql
ALTER TABLE limbus.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "skills_select" ON limbus.skills;
CREATE POLICY "skills_select" ON limbus.skills
  FOR SELECT USING (true);

-- limbus.deck_identities — UGC join table, missing from original RLS block
ALTER TABLE limbus.deck_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deck_identities_select" ON limbus.deck_identities;
CREATE POLICY "deck_identities_select" ON limbus.deck_identities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "deck_identities_insert" ON limbus.deck_identities;
CREATE POLICY "deck_identities_insert" ON limbus.deck_identities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM limbus.decks
      WHERE id = deck_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deck_identities_delete" ON limbus.deck_identities;
CREATE POLICY "deck_identities_delete" ON limbus.deck_identities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM limbus.decks
      WHERE id = deck_id AND user_id = auth.uid()
    )
  );

-- limbus.ego_skills — game data table, no RLS or ENABLE in migration-ego-skills.sql
ALTER TABLE limbus.ego_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ego_skills_select" ON limbus.ego_skills;
CREATE POLICY "ego_skills_select" ON limbus.ego_skills
  FOR SELECT USING (true);

-- limbus.ego_gift_themes — game data table (exists in live DB, not in SQL files)
-- Guard with DO block so it's safe if the table doesn't exist yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'limbus' AND table_name = 'ego_gift_themes'
  ) THEN
    ALTER TABLE limbus.ego_gift_themes ENABLE ROW LEVEL SECURITY;

    -- Drop and recreate idempotently
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'limbus'
        AND tablename  = 'ego_gift_themes'
        AND policyname = 'ego_gift_themes_select'
    ) THEN
      CREATE POLICY "ego_gift_themes_select" ON limbus.ego_gift_themes
        FOR SELECT USING (true);
    END IF;
  END IF;
END
$$;

-- limbus.site_maintenance — may exist only in live DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'limbus' AND table_name = 'site_maintenance'
  ) THEN
    ALTER TABLE limbus.site_maintenance ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'limbus'
        AND tablename  = 'site_maintenance'
        AND policyname = 'site_maintenance_select'
    ) THEN
      CREATE POLICY "site_maintenance_select" ON limbus.site_maintenance
        FOR SELECT USING (true);
    END IF;
  END IF;
END
$$;

-- limbus.mirror_dungeon_events — may exist only in live DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'limbus' AND table_name = 'mirror_dungeon_events'
  ) THEN
    ALTER TABLE limbus.mirror_dungeon_events ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'limbus'
        AND tablename  = 'mirror_dungeon_events'
        AND policyname = 'mirror_dungeon_events_select'
    ) THEN
      CREATE POLICY "mirror_dungeon_events_select" ON limbus.mirror_dungeon_events
        FOR SELECT USING (true);
    END IF;
  END IF;
END
$$;


-- =============================================================================
-- SECTION 3: Fix audit_logs SELECT policy — restrict to admin/moderator only.
-- =============================================================================

-- Helper function: returns TRUE if the calling user has admin or moderator role.
-- SECURITY DEFINER so it can read limbus.profiles even when called from RLS context.
-- STABLE because it reads from the DB but does not modify it.
CREATE OR REPLACE FUNCTION limbus.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      SELECT role IN ('admin', 'moderator')
      FROM limbus.profiles
      WHERE id = auth.uid()
    ),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION limbus.is_admin() TO authenticated;

-- Replace the open audit_logs SELECT policy with admin-only access.
DROP POLICY IF EXISTS "audit_logs_select" ON limbus.audit_logs;
CREATE POLICY "audit_logs_select" ON limbus.audit_logs
  FOR SELECT USING (limbus.is_admin());


-- =============================================================================
-- SECTION 4: Atomic vote toggle RPC.
-- Replaces the separate insert + increment_vote / decrement_vote round-trips.
-- Returns TRUE  = vote was added (user now upvoted the deck)
--         FALSE = vote was removed (user now un-upvoted the deck)
-- =============================================================================

CREATE OR REPLACE FUNCTION limbus.toggle_vote(p_deck_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  was_voted BOOLEAN;
BEGIN
  -- Attempt to delete an existing vote row atomically
  DELETE FROM limbus.deck_votes
  WHERE deck_id = p_deck_id AND user_id = p_user_id;
  was_voted := FOUND;

  IF was_voted THEN
    -- Vote removed: decrement, floor at 0
    UPDATE limbus.decks
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = p_deck_id;
    RETURN FALSE;
  ELSE
    -- No prior vote: insert and increment
    INSERT INTO limbus.deck_votes (deck_id, user_id)
    VALUES (p_deck_id, p_user_id);
    UPDATE limbus.decks
    SET vote_count = vote_count + 1
    WHERE id = p_deck_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION limbus.toggle_vote(UUID, UUID) TO authenticated;


-- =============================================================================
-- SECTION 5: Atomic account deletion RPC.
-- Deletes all user-owned data in the correct dependency order.
-- Note: auth.users deletion must be performed via the Supabase Admin API
--       (supabase.auth.admin.deleteUser) — it cannot be done from SQL.
-- =============================================================================

CREATE OR REPLACE FUNCTION limbus.delete_user_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- deck_identities, deck_votes (on deck), deck_egos are CASCADE-deleted with decks
  DELETE FROM limbus.decks        WHERE user_id = p_user_id;
  -- Votes the user cast on OTHER people's decks
  DELETE FROM limbus.deck_votes   WHERE user_id = p_user_id;
  -- Bookmarks
  DELETE FROM limbus.deck_bookmarks WHERE user_id = p_user_id;
  -- Comments
  DELETE FROM limbus.deck_comments  WHERE user_id = p_user_id;
  -- Identity reviews
  DELETE FROM limbus.identity_reviews WHERE user_id = p_user_id;
  -- Profile row (must come after all FK-constrained child rows)
  DELETE FROM limbus.profiles WHERE id = p_user_id;
  -- auth.users deletion: caller must invoke supabase.auth.admin.deleteUser(p_user_id)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restricted to service_role only — account deletion is an admin-level operation.
-- Do NOT grant to authenticated directly; call via a server-side API route.
GRANT EXECUTE ON FUNCTION limbus.delete_user_account(UUID) TO service_role;


-- =============================================================================
-- SECTION 6: Fix deck_egos INSERT/DELETE policies — tie to deck ownership.
-- Current: WITH CHECK (true) / USING (true) — anyone can modify any deck's EGOs.
-- Fix:     Verify the deck belongs to the calling user.
-- =============================================================================

DROP POLICY IF EXISTS "deck_egos_insert_auth" ON limbus.deck_egos;
DROP POLICY IF EXISTS "deck_egos_delete_auth" ON limbus.deck_egos;

-- Also drop legacy name variants in case they exist under different names
DROP POLICY IF EXISTS "deck_egos_insert" ON limbus.deck_egos;
DROP POLICY IF EXISTS "deck_egos_delete" ON limbus.deck_egos;

CREATE POLICY "deck_egos_insert" ON limbus.deck_egos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM limbus.decks
      WHERE id = deck_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "deck_egos_delete" ON limbus.deck_egos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM limbus.decks
      WHERE id = deck_id AND user_id = auth.uid()
    )
  );

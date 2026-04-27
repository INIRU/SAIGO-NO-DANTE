-- supabase/grant-limbus.sql
-- QUARANTINED: this file used to grant blanket public privileges.
--
-- Do not use this file to widen anon/authenticated access. Public access must be
-- granted through reviewed, table-specific RLS policies and least-privilege
-- column grants in migrations/spec-approved SQL.
--
-- This script is intentionally a safe no-op so accidental execution cannot
-- grant ALL on limbus tables, sequences, routines, or future default
-- privileges.

SELECT 'grant-limbus.sql is quarantined; use reviewed least-privilege migrations instead.' AS status;

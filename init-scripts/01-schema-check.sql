-- Schema initialization check
DO $$
BEGIN
  RAISE NOTICE '✅ PostgreSQL extensions initialized at %', NOW();
  RAISE NOTICE '✅ Database: %', current_database();
END
$$;
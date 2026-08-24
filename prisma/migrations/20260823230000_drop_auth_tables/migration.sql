-- Auth was removed from the application; these tables and the role enum are no longer used.
DROP TABLE IF EXISTS "refresh_tokens";
DROP TABLE IF EXISTS "users";
DROP TYPE IF EXISTS "user_role";

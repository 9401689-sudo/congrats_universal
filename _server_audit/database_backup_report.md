# Database Backup Report

Date: 2026-05-21

## Database Detection

Checked sources:

- `deploy/docker-compose.server.yml`
- server `.env`
- `DATABASE_URL`
- `POSTGRES_*`
- `MYSQL_*`
- `MARIADB_*`

Detected:

- database type: `PostgreSQL`
- connection source: `DATABASE_URL`
- database host in URL: `db`
- database name in URL: `postgres`

Additional findings:

- no `POSTGRES_*` variables were present in the project `.env`
- no `MYSQL_*` variables were present in the project `.env`
- no `MARIADB_*` variables were present in the project `.env`

## Runtime Location

- the app is attached to Docker network `supabase_default`
- the active PostgreSQL container identified on the server is:
  - `supabase-db`

## Dump Method

Portable dump was created using:

- `docker exec supabase-db pg_dump -U supabase_admin -d postgres`

This avoided printing passwords in logs and used the live database container directly.

## Backup Artifact

Raw workflow performed:

1. created SQL dump
2. compressed it with `gzip`
3. encrypted the compressed dump with symmetric GPG
4. removed the raw `.sql.gz`

Final retained artifact:

- [deploy/db/congrats_universal_2026-05-21.sql.gz.gpg](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/db/congrats_universal_2026-05-21.sql.gz.gpg)

## Safety Confirmation

- no database password was printed in logs
- no raw `.sql` remains
- no raw `.sql.gz` remains
- only the encrypted `.gpg` file remains in `deploy/db`

## Git Check

- `git status --short --untracked-files=all deploy/db` shows only:
  - `deploy/db/congrats_universal_2026-05-21.sql.gz.gpg`

## Manual Follow-Up

- this dump likely contains personal data and business data, so it should stay encrypted
- keep the GPG passphrase outside the repository

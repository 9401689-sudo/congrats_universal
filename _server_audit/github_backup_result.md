# GitHub Backup Result

Date: 2026-05-21

## Branch

- branch name: `server-backup-2026-05-21`

## Remote

- remote URL: `git@github.com:9401689-sudo/congrats_universal.git`

## Backup Snapshot Commit

- commit hash: `54260aef4a5873c80ebb7b184e12b5242ffbe1ac`
- commit message: `Add server migration backup snapshot`

## Included In Backup Branch

- migration and audit reports under `_server_audit/`
- infrastructure snapshots under `_server_snapshot/`
- collected nginx/systemd/cron files under `deploy/`
- encrypted server secret backup:
  - `_server_secrets/congrats_universal__.env.gpg`
- encrypted database backup:
  - `deploy/db/congrats_universal_2026-05-21.sql.gz.gpg`
- local hardening changes in `.gitignore`

## Not Included

- raw `.env`
- raw database dumps (`.sql`, `.sql.gz`)
- raw server-copy directories
  - `_server_audit/server-copy/`
  - `_server_audit/deployable-copy/`
- temporary raw secrets directory
  - `_tmp_raw_secrets/`
- local workspace file
  - `congrats_universal.code-workspace`
- runtime preview artifacts
  - `.local-renders/`

## Encrypted Secrets Location

- server env backup:
  - `_server_secrets/congrats_universal__.env.gpg`
- database backup:
  - `deploy/db/congrats_universal_2026-05-21.sql.gz.gpg`

## What Is Needed To Restore On A New VPS

- repository checkout from branch `server-backup-2026-05-21`
- GPG passphrase for decrypting:
  - `_server_secrets/congrats_universal__.env.gpg`
  - `deploy/db/congrats_universal_2026-05-21.sql.gz.gpg`
- Docker and Docker Compose installed
- recreated nginx reverse proxy for the app port `3001`
- recreated external dependencies referenced in reports:
  - PostgreSQL / Supabase stack
  - Redis
  - Docker network `supabase_default` or an updated equivalent
  - mounted `/mnt/razresheno` data if still required by rendering flow
- review files in:
  - `_server_audit/infrastructure_report.md`
  - `_server_audit/deploy_ready_report.md`
  - `_server_audit/database_backup_report.md`
  - `_server_audit/secrets_backup_report.md`

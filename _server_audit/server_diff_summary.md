# Server Diff Summary

Date: 2026-05-21

Artifacts:
- raw recursive diff: [_server_audit/server_vs_local_full.diff](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_audit/server_vs_local_full.diff)
- raw brief diff: [_server_audit/server_vs_local_brief_from_sibling.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_audit/server_vs_local_brief_from_sibling.txt)
- command log: [_server_audit/rsync_commands.md](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_audit/rsync_commands.md)

Note:
- `diff -ruN` was executed as requested.
- The final categorized summary below is based on file presence plus SHA-256 comparison, because raw `diff` on the Windows-mounted paths produced some false positives for files that are byte-identical.

## Local Git Status

```text
## main...origin/main
 M .gitignore
 M package-lock.json
 M package.json
?? _server_audit/
?? congrats_universal.code-workspace
```

## Files That Differ

- `.gitignore`
- `package-lock.json`
- `package.json`
- `renderer/legacy/render_doc.py`
- `renderer/legacy/render_doc.test-input.json`

## Files Only On Server

- `.env`
- `.local-renders/previews/req393_v1.png`
- `.local-renders/previews/req393_v2.png`
- `.local-renders/previews/req393_v3.png`
- `.local-renders/previews/req397_v1.png`
- `.local-renders/previews/req398_v1.png`
- `.local-renders/previews/req398_v2.png`
- `.local-renders/previews/req433_v1.png`
- `.local-renders/previews/req436_v1.png`
- `.local-renders/previews/req440_v1.png`
- `.local-renders/previews/req441_v1.png`
- `.local-renders/previews/req442_v1.png`
- `.local-renders/previews/req442_v2.png`
- `.local-renders/previews/req442_v3.png`
- `.local-renders/previews/req446_v1.png`

## Files Only Local

- `congrats_universal.code-workspace`
- `_server_audit/congrats_universal_deployable_2026-05-21.zip`
- `_server_audit/deploy_ready_report.md`
- `_server_audit/inventory.md`
- `_server_audit/rsync_commands.md`
- `_server_audit/server_diff_summary.md`
- `_server_audit/server_vs_local_brief.txt`
- `_server_audit/server_vs_local_brief_from_sibling.txt`
- `_server_audit/server_vs_local.diff`
- `_server_audit/server_vs_local_full.diff`
- `_server_audit/server-copy.tar.gz`
- `_server_secrets/README.md`

Additional local-only directories created during migration prep:
- `_server_snapshot/`
- `deploy/server/`
- `deploy/nginx/`
- `deploy/systemd/`
- `deploy/cron/`
- `deploy/db/`

Local audit copies that are intentionally not part of the main codebase:
- `_server_audit/server-copy/`
- `_server_audit/deployable-copy/`

## Potential Secrets

- Server-only `.env` is a real secret-bearing file and must not be committed in raw form.
- `.env.example` exists in code and is safe as a template.
- No `.pem`, `.key`, or `id_rsa*` files were found in the copied server snapshot.

## Runtime / Data Files That Should Not Be Treated As Code

- `.local-renders/previews/*.png`

These are runtime-generated artifacts and should not be treated as source code for migration history.

## Migration Implication

- The safest base for a new VPS clone is the server copy in `../server-copy-congrats_universal`, because it contains the live `.env` and runtime preview artifacts.
- The current local repository also contains migration-prep materials and local code changes not present on the server.

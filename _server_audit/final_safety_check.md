# Final Safety Check

Date: 2026-05-21

## Git Status

```text
## main...origin/main
 M .gitignore
 M renderer/legacy/render_doc.py
 M renderer/legacy/render_doc.test-input.json
?? _server_audit/
?? _server_secrets/
?? _server_snapshot/
?? congrats_universal.code-workspace
?? deploy/cron/
?? deploy/db/
?? deploy/nginx/
?? deploy/systemd/
```

## Git Diff Stat

```text
 .gitignore | 20 ++++++++++++++++++++
 1 file changed, 20 insertions(+)
```

## Cached Diff Stat

```text
(empty)
```

No staged changes are currently present.

## Dangerous Raw Files Found

`find` results:

- `./.env.example`
- `./_server_audit/deployable-copy/.env`
- `./_server_audit/deployable-copy/.env.example`
- `./_server_audit/deployable-copy/deploy/bootstrap.sql`
- `./_server_audit/server-copy/.env`
- `./_server_audit/server-copy/.env.example`
- `./_server_audit/server-copy/deploy/bootstrap.sql`
- `./deploy/bootstrap.sql`

## Dangerous File Git Check

- `.env.example`
  - tracked
  - not ignored
  - acceptable as a template
- `_server_audit/deployable-copy/.env`
  - not tracked
  - ignored
- `_server_audit/server-copy/.env`
  - not tracked
  - ignored
- `_server_audit/deployable-copy/.env.example`
  - not tracked
  - ignored because of `.env.*` rule
- `_server_audit/server-copy/.env.example`
  - not tracked
  - ignored because of `.env.*` rule
- `deploy/bootstrap.sql`
  - tracked
  - not ignored
  - review needed, but this appears to be a project bootstrap/schema artifact rather than a live data dump
- `_server_audit/deployable-copy/deploy/bootstrap.sql`
  - not tracked
  - not ignored
- `_server_audit/server-copy/deploy/bootstrap.sql`
  - not tracked
  - not ignored

## Suspicious Variable Name Scan

Only file path and variable/token name are listed below. No values are shown.

### High-Risk Raw Secret Carrier Files

- `./_server_audit/deployable-copy/.env`
  - `botToken`
  - `DATABASE_URL`
  - `TELEGRAM_BOT_TOKEN`
  - `YOOKASSA_SECRET_KEY`
- `./_server_audit/server-copy/.env`
  - `botToken`
  - `DATABASE_URL`
  - `TELEGRAM_BOT_TOKEN`
  - `YOOKASSA_SECRET_KEY`

### Files That Deserve Manual Review Before Commit

These files contain secret-like field names and should not be blindly committed from audit copies:

- `./_server_audit/deployable-copy/2_GEN.json`
  - `sshPassword`
- `./_server_audit/deployable-copy/2_PAY.json`
  - `provider_token`
- `./_server_audit/deployable-copy/3_YOOKASSA_WEBHOOK.json`
  - `token`
  - `WH__FN_VERIFY_TOKEN`
  - `sshPassword`
  - `Password`
- `./_server_audit/deployable-copy/4_delivery_worker.json`
  - `sshPassword`
  - `Password`
  - `nTOKEN`
- `./_server_audit/server-copy/2_GEN.json`
  - `sshPassword`
- `./_server_audit/server-copy/2_PAY.json`
  - `provider_token`
- `./_server_audit/server-copy/3_YOOKASSA_WEBHOOK.json`
  - `token`
  - `WH__FN_VERIFY_TOKEN`
  - `sshPassword`
  - `Password`
- `./_server_audit/server-copy/4_delivery_worker.json`
  - `sshPassword`
  - `Password`
  - `nTOKEN`

### Code / Docs References

The repository also contains many legitimate code and documentation references to names such as:

- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `YOOKASSA_SECRET_KEY`
- `webhookSecret`
- `botToken`
- `apiToken`
- `secretKey`

These references appear in:

- `.env.example`
- `README.md`
- `docs/*`
- `src/config/env.ts`
- runtime/config code under `src/`
- tests

These are not automatically unsafe by themselves, but they should still be reviewed if the goal is a minimal clean commit.

## Recommendation

Cannot commit safely yet.

Reasons:

- `_server_audit/server-copy/` and `_server_audit/deployable-copy/` contain raw audit copies with secret-bearing `.env` files present in the working tree.
- those same audit copies also contain workflow/code files with secret-like field names such as `sshPassword`, `provider_token`, and `WH__FN_VERIFY_TOKEN`.
- `_server_audit/` as a whole is untracked right now, so a broad `git add .` would risk adding audit artifacts that should stay out of the main code history.

Safe next step:

- do not commit `_server_audit/server-copy/` or `_server_audit/deployable-copy/`
- either remove those raw audit directories or add explicit ignore rules for them before any commit
- then re-run this safety check

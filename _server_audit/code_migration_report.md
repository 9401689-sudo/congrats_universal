# Code Migration Report

Date: 2026-05-21

## Scope

Goal:
- bring into the repository only safe project materials from the server copy
- keep secrets and runtime data out of open source control

Server source used:
- `../server-copy-congrats_universal`

## Files Transferred

The following server-copy files were copied into the repository because they were code or package artifacts and differed from local content:

- `package.json`
- `package-lock.json`
- `renderer/legacy/render_doc.py`
- `renderer/legacy/render_doc.test-input.json`

## Already Present And Matching

These categories were checked and already existed locally in matching form, so no overwrite was needed:

- source tree under `src/`
- tests under `tests/`
- deploy files already present under `deploy/`
- documentation under `README.md` and `docs/`
- `Dockerfile`
- `.env.example`
- workflow JSON files in the project root
- TypeScript config files like `tsconfig.json`
- scripts already present under `scripts/`

## Consciously Not Transferred

Sensitive or runtime-only content was intentionally not copied into the repository working tree:

- `.env`
- any `.env.*` secret-bearing files
- private keys
- raw secret files
- runtime preview artifacts under `.local-renders/`
- logs
- bulky uploads/media/storage style runtime data
- `node_modules`
- `vendor`
- `dist`
- `build`
- `.next`
- `cache`
- `tmp`

## Requires Manual Review

- `.gitignore`
  - it still differs from the server copy
  - this was intentional, because the local version now includes stronger secret-protection rules for migration work
  - decide later whether to keep the hardened local rules as-is or reconcile them with the server version
- `congrats_universal.code-workspace`
  - local-only editor file
  - not part of deployable code
- `_server_audit/`, `_server_snapshot/`, `_server_secrets/`
  - local migration artifacts
  - review before any future commit so that only intended audit files are tracked
- server-only `.env`
  - must be handled via encrypted secret workflow, not plain git
- server-only `.local-renders/previews/*.png`
  - runtime artifacts, not source code

## Current Result

After the safe code transfer:

- server code differences were reconciled for:
  - `package.json`
  - `package-lock.json`
  - `renderer/legacy/render_doc.py`
  - `renderer/legacy/render_doc.test-input.json`
- the remaining intentional repository diff is mainly:
  - local `.gitignore` hardening
  - local audit/report files

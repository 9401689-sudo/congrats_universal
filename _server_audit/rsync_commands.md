# Rsync Commands

Date: 2026-05-21

## 1) Create temp copy directory outside git

```powershell
New-Item -ItemType Directory -Force ..\server-copy-congrats_universal | Out-Null
```

## 2) Prepare a temporary WSL key copy with safe permissions

Reason:
- WSL refused to use the Windows-mounted private key because it had overly open permissions.
- A temporary copy was created in `/tmp`, used for transfer, then removed.

```bash
wsl bash -lc 'cp /mnt/c/Users/Илья/.ssh/id_ed25519 /tmp/rsync_id_ed25519 && chmod 600 /tmp/rsync_id_ed25519 && ssh -o BatchMode=yes -o ConnectTimeout=8 -i /tmp/rsync_id_ed25519 -o IdentitiesOnly=yes root@109.196.165.84 "echo rsync_ssh_ok"'
```

## 3) Copy project from server with rsync

Excluded:
- `.git`
- `node_modules`
- `vendor`
- `dist`
- `build`
- `.next`
- `cache`
- `tmp`

Not excluded:
- `.env*`
- `docker-compose*.yml`
- runtime data like `.local-renders`

```bash
wsl bash -lc 'rsync -avz --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "vendor" \
  --exclude "dist" \
  --exclude "build" \
  --exclude ".next" \
  --exclude "cache" \
  --exclude "tmp" \
  -e "ssh -i /tmp/rsync_id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
  root@109.196.165.84:/root/congrats_universal/ \
  "/mnt/c/1_Work/Работа/Сайты/Боты/server-copy-congrats_universal/"'
```

## 4) Capture local git status

```powershell
git status --short --branch
```

## 5) Run required diff commands

```bash
wsl bash -lc 'diff -ruN \
  --exclude .git \
  --exclude node_modules \
  --exclude vendor \
  --exclude dist \
  --exclude build \
  --exclude .next \
  --exclude cache \
  --exclude tmp \
  "/mnt/c/1_Work/Работа/Сайты/Боты/congrats_universal" \
  "/mnt/c/1_Work/Работа/Сайты/Боты/server-copy-congrats_universal" \
  > "/mnt/c/1_Work/Работа/Сайты/Боты/congrats_universal/_server_audit/server_vs_local_full.diff" || true'
```

```bash
wsl bash -lc 'diff -rq \
  --exclude .git \
  --exclude node_modules \
  --exclude vendor \
  --exclude dist \
  --exclude build \
  --exclude .next \
  --exclude cache \
  --exclude tmp \
  "/mnt/c/1_Work/Работа/Сайты/Боты/congrats_universal" \
  "/mnt/c/1_Work/Работа/Сайты/Боты/server-copy-congrats_universal" \
  > "/mnt/c/1_Work/Работа/Сайты/Боты/congrats_universal/_server_audit/server_vs_local_brief_from_sibling.txt" || true'
```

## 6) Remove the temporary WSL key copy

```bash
wsl bash -lc 'rm -f /tmp/rsync_id_ed25519'
```

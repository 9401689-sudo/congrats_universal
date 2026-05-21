# Infrastructure Report

Date: 2026-05-21

Source host:
- `root@109.196.165.84`

## Saved Artifacts

Collected into the repository:

- [deploy/nginx/nginx_collected.conf](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/nginx/nginx_collected.conf)
- [deploy/nginx/apache_collected.conf](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/nginx/apache_collected.conf)
- [deploy/systemd/systemd_units_collected.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/systemd/systemd_units_collected.txt)
- [deploy/cron/cron_collected.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/deploy/cron/cron_collected.txt)
- [_server_snapshot/docker_ps.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_snapshot/docker_ps.txt)
- [_server_snapshot/docker_compose_ls.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_snapshot/docker_compose_ls.txt)
- [_server_snapshot/docker_volumes.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_snapshot/docker_volumes.txt)
- [_server_snapshot/ports.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_snapshot/ports.txt)
- [_server_snapshot/firewall.txt](/C:/1_Work/Работа/Сайты/Боты/congrats_universal/_server_snapshot/firewall.txt)

No open secrets were intentionally stored in these files. Systemd and cron environment-style values were masked when relevant.

## Nginx Site Config

- Nginx is present on the server.
- Relevant files were found in:
  - `/etc/nginx/nginx.conf`
  - `/etc/nginx/sites-available/default`
  - `/etc/nginx/sites-available/my-site`
- The clearly project-relevant nginx site appears to be `my-site`.
- It contains a reverse proxy to:
  - `127.0.0.1:3001`
- It uses:
  - `server_name 109.196.165.84`

Implication:
- there is a simple nginx-based reverse proxy path to the app port `3001`
- this should be reviewed and adapted for the new VPS hostname/domain

## Apache Config

- Apache config files exist on the server filesystem.
- Only a generic file was found in the scanned locations:
  - `/etc/apache2/conf-available/javascript-common.conf`
- No project-specific apache virtual host for this app was identified.

Status:
- apache is not currently the active project proxy path for this app, based on the collected data

## Systemd Unit

- No dedicated project-specific systemd service for `congrats_universal` was found.
- Collected reference units:
  - `docker-volume-local-persist.service`
  - `docker.service`
  - `nginx.service`

Status:
- the project appears to be run via Docker Compose rather than via its own systemd unit

## Systemd Environment Variables

- Environment output was collected for the reference units.
- No meaningful project-specific environment variables were present in those unit definitions.

Status:
- no project-owned systemd environment block was found

## Cron Jobs

- Root crontab is empty.
- `/etc/crontab` contains only standard system scheduled jobs.
- `/etc/cron.d` contains:
  - `certbot`
  - `e2scrub_all`
  - `.placeholder`
  - `sysstat`

Status:
- no project-specific cron entry for `congrats_universal` was found

## Docker Compose

- `docker compose ls` was collected.
- The relevant stack entry is:
  - `deploy`
- Its config files include:
  - `/root/congrats_universal/deploy/docker-compose.server.yml`
  - `/root/congrats/deploy/docker-compose.server.yml`

Status:
- the server currently runs multiple compose projects
- the target app is part of the `deploy` compose project

## Docker Containers

- `docker ps -a` was collected.
- The relevant container for this project is:
  - `congrats-universal-app`

Status:
- the app is containerized and reachable on host port `3001`

## Docker Volumes

- `docker volume ls` was collected.
- Use the snapshot file during reconstruction if any named volumes need to be recreated.

## Firewall

- `ufw status` was collected.
- Current result:
  - `Status: inactive`

Status:
- `ufw` is not actively enforcing firewall rules on this server

## Open Ports

- Open/listening ports were collected in the snapshot.
- Important observed ports include:
  - `22`
  - `80`
  - `81`
  - `443`
  - `3000`
  - `3001`
  - `5432`
  - `5678`
  - `6379`
  - `8080`
  - `8443`
  - `9090`

Status:
- the app itself is exposed on `3001`
- reverse proxy traffic is handled on `80/443`

## Explicitly Not Used Or Not Found

- No project-specific apache vhost was found.
- No project-specific systemd service was found.
- No project-specific cron job was found.
- No active `ufw` ruleset is in use.

## Recovery Notes For New VPS

- Recreate nginx reverse proxy behavior for the app port `3001`.
- Recreate Docker Compose deployment using the project’s compose files.
- Do not rely on systemd for the app unless you intentionally introduce it on the new VPS.
- Review all exposed ports and reduce surface area if the new VPS should be leaner than the current server.

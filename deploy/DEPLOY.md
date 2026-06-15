# Social Studio Hetzner Deployment Runbook

This is a files-only runbook. Do not run these commands from Codex unless the
owner explicitly asks for a real deployment.

The app must never be exposed without Cloudflare Access. The Node server must
bind to `127.0.0.1:4810`; Caddy is the only public listener on ports 80 and
443, and Cloudflare Access must protect the hostname before real users are
sent to it.

Placeholders used below:

- `studio.example.com` - replace with the protected Studio hostname.
- `<REPO_URL>` - replace with this repository's HTTPS clone URL.
- `<ALLOWED_EMAIL_1>` and `<ALLOWED_EMAIL_2>` - replace in Cloudflare Access.

## Fast path: bootstrap the server

Use this path on a fresh Ubuntu 24.04 server after the Hetzner, DNS, and
Cloudflare account setup exists. It installs the app files only; it does not
publish or schedule social content.

```bash
curl -fsSL https://raw.githubusercontent.com/Ajaykruger/social-studio/main/deploy/bootstrap.sh -o /tmp/social-studio-bootstrap.sh
bash /tmp/social-studio-bootstrap.sh https://github.com/Ajaykruger/social-studio.git studio.example.com
```

Success looks like: Node 22, Caddy, git, the `socialstudio` user, the built
app at `/opt/social-studio`, the systemd service, and
`/opt/social-studio/.env` all exist. The script creates `.env` from
`deploy/.env.example` only if `.env` does not already exist, then applies
`chmod 600`.

After bootstrap:

```bash
nano /opt/social-studio/.env
cp /opt/social-studio/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
/opt/social-studio/deploy/healthcheck.sh
```

For later app updates after a reviewed push to `main`:

```bash
cd /opt/social-studio
./deploy/update.sh
```

The manual steps below explain what the scripts do and are the fallback if a
script stops with a readable error.

## 1. Create the server

1. In Hetzner Cloud, create a Hetzner CX32 server.
2. Choose Ubuntu 24.04.
3. Add your SSH key.
4. Create the server and note its public IPv4 address.

Success looks like: Hetzner shows a running Ubuntu 24.04 CX32 server and you can
SSH into it as `root`.

```bash
ssh root@<SERVER_IP>
```

## 2. Create the app user

```bash
adduser --disabled-password --gecos "" socialstudio
usermod -aG sudo socialstudio
mkdir -p /opt/social-studio
chown socialstudio:socialstudio /opt/social-studio
```

Success looks like:

```bash
id socialstudio
ls -ld /opt/social-studio
```

The directory owner should be `socialstudio`.

## 3. Lock down the firewall

```bash
apt update
apt install -y ufw curl ca-certificates gnupg git
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status numbered
```

Success looks like: UFW is active and only 22/tcp, 80/tcp, and 443/tcp are
allowed.

## 4. Install Node.js 22, Caddy, and git

Install Node.js 22:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs git
node -v
npm -v
```

Success looks like: `node -v` starts with `v22.`.

Install Caddy from the official Caddy package repository:

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
caddy version
```

Success looks like: `caddy version` prints a Caddy version and exits cleanly.

## 5. Clone and build the app

```bash
sudo -u socialstudio git clone <REPO_URL> /opt/social-studio
cd /opt/social-studio
sudo -u socialstudio npm ci
sudo -u socialstudio npm run build
```

Success looks like: the build ends with `built in` and `dist/index.html`
exists.

```bash
test -f /opt/social-studio/dist/index.html && echo "build artifact exists"
```

## 6. Create the server `.env`

Create `/opt/social-studio/.env` on the server only. Never commit this file.
The fast-path bootstrap creates it from `deploy/.env.example` only when it is
missing, never overwrites an existing file, and sets `chmod 600`.

```bash
cp /opt/social-studio/deploy/.env.example /opt/social-studio/.env
nano /opt/social-studio/.env
chown socialstudio:socialstudio /opt/social-studio/.env
chmod 600 /opt/social-studio/.env
```

Success looks like:

```bash
ls -l /opt/social-studio/.env
```

The file should be owned by `socialstudio` and readable only by the owner.

If you do not want AI generation yet, omit `ANTHROPIC_API_KEY`. If you do not
want typed reviewer name allowlisting yet, omit `STUDIO_REVIEWERS`. When
Cloudflare Access protects the app, set `STUDIO_REVIEWER_EMAILS` to Jen's and
Andre's Google emails so approvals are tied to the signed-in account.

## 7. Install and start the systemd service

```bash
cp /opt/social-studio/deploy/social-studio.service /etc/systemd/system/social-studio.service
systemctl daemon-reload
systemctl enable --now social-studio
systemctl status social-studio --no-pager
curl -fsS http://127.0.0.1:4810/api/health
```

Success looks like: systemd shows `active (running)` and the health check
returns JSON with `draftOnly: true` and `networkCallsToPostiz: false`.

If it fails, inspect logs:

```bash
journalctl -u social-studio -n 80 --no-pager
```

## 8. Configure Caddy

Edit `/opt/social-studio/deploy/Caddyfile` first and replace
`studio.example.com` with the protected hostname only after Cloudflare Access
is ready.

```bash
cp /opt/social-studio/deploy/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
curl -I -H "Host: studio.example.com" http://127.0.0.1
```

Success looks like: `caddy validate` reports a valid config and the local curl
returns an HTTP response from Caddy. Public HTTPS will work after DNS points to
the server.

## 9. Put Cloudflare Access in front

Do this before sending real users to the hostname.

1. In Cloudflare, create or select the DNS zone for the placeholder hostname.
2. Add an `A` record for `studio.example.com` pointing at `<SERVER_IP>`.
3. Enable the orange cloud proxy.
4. In Cloudflare Zero Trust, create an Access application for
   `https://studio.example.com`.
5. Choose Google login.
6. Add an allow policy for `<ALLOWED_EMAIL_1>` and `<ALLOWED_EMAIL_2>`.
7. Confirm Cloudflare Access passes the
   `Cf-Access-Authenticated-User-Email` header. This is the default.
8. Add the same emails to `/opt/social-studio/.env` as
   `STUDIO_REVIEWER_EMAILS=<ALLOWED_EMAIL_1>,<ALLOWED_EMAIL_2>`.
9. Save, then open `https://studio.example.com` in a private browser window.

Success looks like: Cloudflare asks for Google login before the Studio loads.
No one should see the app without passing Access.

## 10. Install nightly backups

```bash
install -o root -g root -m 0755 /opt/social-studio/deploy/backup.sh /usr/local/bin/social-studio-backup
mkdir -p /var/backups/social-studio
/usr/local/bin/social-studio-backup
printf '0 2 * * * root /usr/local/bin/social-studio-backup >> /var/log/social-studio-backup.log 2>&1\n' >/etc/cron.d/social-studio-backup
cat /etc/cron.d/social-studio-backup
```

Success looks like: `/var/backups/social-studio/` contains a fresh `.tar.gz`
file, and the cron file contains this nightly line:

```text
0 2 * * * root /usr/local/bin/social-studio-backup >> /var/log/social-studio-backup.log 2>&1
```

Backups keep 14 days.

## 11. Operator checks after every deploy

```bash
cd /opt/social-studio
sudo -u socialstudio ./deploy/update.sh
systemctl status social-studio --no-pager
```

Success looks like: build succeeds, health returns draft-only safety JSON, and
systemd remains active.

## Reference Sources

- Node.js 22 package setup: NodeSource distributions.
- Caddy package setup: Caddy official install documentation.

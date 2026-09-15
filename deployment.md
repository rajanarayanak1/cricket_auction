# Deployment Guide — Cricket Auction Application

End-to-end procedure for hosting this app on a Linux server: a React/Vite frontend, a Node/Express API backend, and a MySQL database.

## 1. Architecture overview

```
Browser
   │  HTTPS
   ▼
Nginx (port 80/443)
   │  serves frontend/dist/ as static files
   │  proxies /api/*     ──┐
   │  proxies /uploads/* ──┤
   └───────────────────────┤
                            ▼
              Node/Express API (PM2, 127.0.0.1:5000)
                            │
                            ▼
                MySQL (cricket_auction database)
```

This app is **two independent services**, not one:

- `backend/` — an Express API (`backend/src/server.js`), listening on `process.env.PORT` (default `5000`). It also serves uploaded files (team logos, player photos) at `/uploads`.
- `frontend/` — a Vite/React SPA. `npm run build` produces static files in `frontend/dist/`; the backend does **not** serve these itself.

**Important:** the frontend's API client (`frontend/src/api/client.js`) only ever calls hardcoded relative paths — `/api` and `/api/public` — never an absolute URL. There is no build-time environment variable to point it at a different host. This means frontend and backend **must** be served from the same origin in production, with Nginx reverse-proxying `/api` and `/uploads` through to the Node process. This isn't a style choice — the app will not work otherwise.

## 2. Prerequisites

- A Linux server (this guide uses Ubuntu/Debian commands; adapt package manager commands if you're on something else) with root or sudo access.
- Optionally, a domain name with its DNS `A` record already pointed at the server's IP, if you want HTTPS (recommended). Section 8 is skippable if you're only using a bare IP.

## 3. Base server setup

```bash
sudo apt update && sudo apt upgrade -y

# Create a dedicated non-root user to run the app under (optional but recommended)
sudo adduser deploy
sudo usermod -aG sudo deploy
# Log back in as `deploy` for the remaining steps

# Basic firewall — only expose SSH and the web ports.
# MySQL (3306) and the Node API (5000) should never be reachable from outside.
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 4. Install runtime dependencies

**Node.js 20 LTS or newer** (this project has been developed and tested on Node 22; there's no `engines` field pinning a version, but `sharp` and `multer` both require Node ≥ 18):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # confirm v20+
```

**MySQL Server:**

```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

**Nginx:**

```bash
sudo apt install -y nginx
```

**PM2** (process manager for the Node backend — this app has no built-in crash recovery, clustering, or graceful shutdown, so something needs to keep it running):

```bash
sudo npm install -g pm2
```

**Build tools** (usually unnecessary — `sharp` ships prebuilt binaries for common Linux platforms — but install as a safety net in case a native module needs to compile from source):

```bash
sudo apt install -y build-essential python3
```

## 5. Get the code onto the server

This project isn't currently in a git repository, so the simplest path is to sync the folder directly from your dev machine. Run this **from your local machine**, not the server:

```bash
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'dist' \
  --exclude 'uploads' \
  /path/to/auction/ deploy@your-server-ip:/home/deploy/auction/
```

(`node_modules` and `dist` will be regenerated on the server; `.env` and `uploads/` are created/populated fresh per the steps below — you never want to overwrite a server's live uploads or secrets with what's on your laptop.)

If you later put this in a git repository, `git clone`/`git pull` works just as well for this step — nothing else in this guide changes.

## 6. MySQL setup

Log in and create the database from the app's schema file. **Only `schema.sql` needs to run** — it already has every historical migration folded into it (confirmed by comparing every file under `backend/src/db/migrations/` against it). Do **not** additionally run the files in that `migrations/` folder against a fresh database — several of them contain backfill statements that assume an older schema was already in place and will fail or do the wrong thing here.

```bash
cd /home/deploy/auction
mysql -u root -p < backend/src/db/schema.sql
```

This creates the `cricket_auction` database and every table (the file itself runs `CREATE DATABASE IF NOT EXISTS cricket_auction; USE cricket_auction;`).

Next, create a **dedicated, least-privilege database user** for the app rather than using `root` in production (the `.env.example` defaulting to `root` is a dev convenience, not a production recommendation):

```sql
mysql -u root -p
```
```sql
CREATE USER 'auction_app'@'localhost' IDENTIFIED BY 'a-strong-password-here';
GRANT ALL PRIVILEGES ON cricket_auction.* TO 'auction_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 7. Backend setup

```bash
cd /home/deploy/auction/backend
npm install --omit=dev

cp .env.example .env
```

Edit `.env` with real values:

```ini
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=auction_app
DB_PASSWORD=the-password-you-just-created
DB_NAME=cricket_auction

JWT_SECRET=   # generate below
JWT_EXPIRES_IN=12h
```

Generate a strong `JWT_SECRET` (the `.env.example` file has this command in a comment):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Lock down the file, since it holds your DB password and JWT signing secret:

```bash
chmod 600 .env
```

Confirm the upload directories exist and are writable (they're auto-created on startup if missing, and are already present in the repo — this just double-checks permissions after the rsync):

```bash
mkdir -p uploads/logos uploads/players
```

Create the first admin login:

```bash
node scripts/seedAdmin.js youradminusername a-strong-password
```

Start the API under PM2 and make it survive reboots:

```bash
pm2 start src/server.js --name auction-api
pm2 save
pm2 startup   # run the command it prints (registers a systemd unit for PM2 itself)
```

## 8. Frontend build

This is a build-time step only — there's no frontend process to keep running; Nginx will serve the static output directly.

```bash
cd /home/deploy/auction/frontend
npm install
npm run build
```

This produces `frontend/dist/`, which Nginx points at in the next step.

## 9. Nginx configuration

Create `/etc/nginx/sites-available/auction`:

```nginx
server {
    listen 80;
    server_name your-domain.com;   # or the server's IP if you have no domain

    # Uploaded photos/logos can be up to 3MB (see backend/src/middleware/upload.js) —
    # Nginx's default 1MB limit would otherwise reject them with a 413 error.
    client_max_body_size 5m;

    root /home/deploy/auction/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/auction /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 10. HTTPS (recommended — skip if you're only using a bare IP)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot edits the Nginx config to redirect HTTP → HTTPS and sets up auto-renewal (`certbot renew` runs via a systemd timer/cron it installs automatically — no extra action needed).

## 11. Verification

```bash
curl http://your-domain.com/api/health
# → {"status":"ok"}
```

Then, in a browser:
1. Open the site and log in with the admin account you seeded in step 7.
2. Add a player with a profile picture upload — this exercises the full Nginx → API → `uploads/` path, and confirms the `client_max_body_size` setting is actually working.
3. Check `http://your-domain.com/api/public/live-matches` (or the app's public Live Scores view) to confirm the public, unauthenticated routes work too.

## 12. Ongoing operations

**Redeploying after changes:**

```bash
# sync new code (same rsync command as step 5)
cd backend && npm install --omit=dev && pm2 restart auction-api
cd ../frontend && npm install && npm run build   # nginx serves the new dist/ immediately, no restart needed
```

Never let a redeploy script delete or overwrite `backend/uploads/` or `backend/.env` — they're the only stateful, non-regeneratable data this app has.

**Logs and monitoring:**

```bash
pm2 logs auction-api
pm2 monit
pm2 install pm2-logrotate   # prevents log files from growing unbounded
```

**Backups** — the only two things worth backing up are the database and the uploads folder:

```bash
# Database (e.g. as a nightly cron job)
mysqldump -u auction_app -p cricket_auction > backup-$(date +%F).sql

# Uploaded photos/logos
rsync -a /home/deploy/auction/backend/uploads/ /path/to/backup/uploads/
```

## 13. Security considerations

- **`POST /api/auth/register` is open to the public with no invite code or approval step** — anyone who finds it can create their own admin login. Decide deliberately whether that's acceptable for your deployment, or block it at the Nginx layer if only your organization should ever have access:
  ```nginx
  location = /api/auth/register {
      deny all;
  }
  ```
- Use the dedicated `auction_app` MySQL user from step 6, never `root`, for the running application.
- `chmod 600 backend/.env` — it holds your DB password and JWT secret.
- Keep `JWT_SECRET` long, random, and out of version control (it already is, via `backend/.gitignore`).
- There's no rate-limiting middleware on the backend today. For a public-facing deployment, consider adding something like `express-rate-limit` on `/api/auth/*` — this is a suggested future hardening step, not something this guide sets up.

## 14. Troubleshooting

- **API requests failing / "Failed to load..." errors, but the app otherwise loads** — check that MySQL is actually the service listening on port 3306, not something else:
  ```bash
  ss -tlnp | grep 3306
  ```
  A second MySQL install (e.g. bundled with XAMPP/LAMPP) binding the same port is a real, easy-to-hit cause — it'll accept TCP connections but reject your app's credentials and won't have the `cricket_auction` database, producing exactly this symptom.
- **413 "Request Entity Too Large" when uploading a photo/logo** — `client_max_body_size` is missing or too low in the Nginx server block (see step 9); the app itself allows uploads up to 3MB.
- **PM2 process is gone after a server reboot** — you ran `pm2 save` but skipped running the command `pm2 startup` printed out (it needs to register a systemd unit; `pm2 save` alone doesn't survive a reboot on its own).
- **Blank page, or every API call 404s in the browser** — the frontend built fine, but Nginx isn't proxying `/api`/`/uploads` correctly. Since the frontend only ever requests relative paths, a misconfigured `location /api/` block means those requests silently hit Nginx's own static file serving (or 404) instead of reaching the Node backend — recheck the `proxy_pass` blocks in step 9.

## 15. Out of scope

`frontend/capacitor.config.json` and the Capacitor tooling wrap this same frontend into a native Android app — that's a separate mobile-app build/release process, not covered by this server-hosting guide.

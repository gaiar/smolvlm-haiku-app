# Deployment Guide

This document describes how to build and run the Docker image for the SmolVLM Haiku app and how to expose it via an existing shared Caddy installation with automatic HTTPS certificates from Let's Encrypt.

## 1. Build and run the application container

```bash
# Build the production image
docker compose build

# Start the container in the background
docker compose up -d

# Check that the service is healthy
docker compose ps
```

The container makes the React bundle available on `http://127.0.0.1:3000` for local spot checks and simultaneously exposes port `3000` on the shared Docker network `public_web` consumed by the reverse proxy.

## 2. Integrate with a shared Caddy instance

Choose the relevant option based on how Caddy is deployed on this server.

### 2.1 Shared infrastructure stack (recommended)

This server now keeps TLS termination in `/home/ubuntu/developer/infra/caddy`. That repository publishes ports 80/443, manages ACME certificates, and imports one site definition per domain from `sites/*.caddy`.

1. Ensure the `public_web` Docker network exists (the infra compose file can create it, or run `docker network create public_web`).
2. Add a new site file `sites/smolvlm-haiku-app.caddy` with the snippet below and reload the proxy from the infra directory:
   ```bash
   cd /home/ubuntu/developer/infra/caddy
   # ensure the snippet exists (see infra repo)
   docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```
3. The snippet Caddy uses for this project is:
   ```caddy
   smolvlm.baimuratov.app {
       encode zstd gzip
       reverse_proxy smolvlm-haiku-app:3000
   }
   ```

Certificates are stored in the shared `shared_caddy_data` volume and will be renewed automatically.

### 2.2 Host-managed Caddy (alternative)

If you ever move away from the shared container, add the same site block to your system-level Caddyfile and keep the app bound to `127.0.0.1:3000`.

## 3. Verification checklist

- `docker compose ps` shows the `smolvlm-haiku-app` container as healthy.
- Browsing to `https://smolvlm.baimuratov.app` loads the React UI without TLS warnings.
- `docker logs smolvlm-haiku-app` remains clean after a few requests.

If any step fails, inspect the container logs and Caddy logs (`journalctl -u caddy` or `docker logs caddy`) for additional detail.

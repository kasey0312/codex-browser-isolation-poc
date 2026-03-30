# Traefik state

Create `deploy/traefik/acme.json` locally before bringing up the production-prep stack:

```bash
touch deploy/traefik/acme.json
chmod 600 deploy/traefik/acme.json
```

That file is intentionally ignored because it will contain certificate material.

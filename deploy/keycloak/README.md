# Keycloak scaffolding

This folder contains a first-pass Keycloak realm import for future production auth work.

Current state:

- the application still uses its existing local JWT auth flow
- the `keycloak` and `keycloak-db` services in `docker-compose.prod.yml` are optional and hidden behind the `keycloak` profile
- no SSO integration is performed by default in this branch

What is included:

- `realm-import/codex-browser-isolation-realm.json`
- hostnames and credentials wired through `deploy/env/keycloak.env`

Recommended next steps before real deployment:

1. Replace placeholder hosts in the realm import with the real production domain.
2. Add client secrets and store them outside git.
3. Decide whether Keycloak will front the app directly or be integrated into the app itself with OIDC.
4. Remove the placeholder `prod-admin` bootstrap user and create a real admin account through a secure provisioning flow.

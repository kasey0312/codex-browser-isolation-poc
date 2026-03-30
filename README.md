# LangGraph Gemini Browser Isolation POC

A TypeScript proof-of-concept for **up to 4 authenticated users**, where each user gets their own **isolated Docker browser sandbox**, **LangGraph/Gemini runtime session**, and **live noVNC browser view**.

## What this POC proves

- JWT-backed signup/login for a bounded user pool (`max_users = 4`)
- one isolated **browser container per user**
- one isolated **LangGraph/Gemini runtime thread per user**
- dedicated per-user:
  - sandbox directory
  - Selenium session
  - CDP websocket endpoint
  - noVNC live view URL
- frontend with auth, chat, and live browser panel
- Gemini API-key based runtime through LangGraph

## Runtime modes

### 1. Docker browser mode
Preferred mode now.

- one Docker browser container per user
- live browser access over **noVNC**
- screenshot API still available as fallback / inspection path
- Gemini connects through direct browser tools with LangGraph

### 2. Mock mode
Used for tests and fast local verification.

- no real browser container required
- deterministic mock browser responses
- useful for auth/session/UI testing

## Stack

- **Frontend:** React + Vite
- **Backend:** Express + TypeScript
- **Auth:** JWT (`jose`) + bcrypt
- **Storage:** SQLite (`better-sqlite3`)
- **Browser container:** Selenium standalone Chromium + noVNC
- **Agent runtime:** LangGraph + Gemini
- **Tests:** Vitest

## Production prep

This repo includes production-prep assets such as:

- `Dockerfile.prod`
- `docker-compose.prod.yml`
- Traefik dynamic config
- Keycloak scaffolding
- production env templates
- deployment/runbook notes

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm test
npm run build
```

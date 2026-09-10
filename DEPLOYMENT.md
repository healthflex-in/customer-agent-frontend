# Frontend environment and deployment contract

The frontend has four explicit deployment identities: `local`, `development`,
`staging`, and `production`. Endpoint selection never falls back to a hardcoded
server. Vite validates the contract before starting or creating a bundle.

All `VITE_*` values are public browser configuration. They must not contain
server secrets and do not authenticate a patient.

## Required variables

```bash
VITE_APP_ENV=production
VITE_API_URL=https://customeragent.stance.health
VITE_WS_URL=wss://customeragent.stance.health
VITE_GRAPHQL_URL=https://api.stance.health/graphql
VITE_CONSENT_URL=https://consent.stance.health
VITE_API_KEY=<restricted-public-browser-application-key>
VITE_ORGANIZATION_ID=<public-organization-id>
```

`VITE_API_KEY` and `VITE_ORGANIZATION_ID` are required only while the dormant
GraphQL client is imported into an active feature. The API must never treat the
browser key as user identity or record-level authorization.

The tracked `.env.example` documents safe placeholders. Copy it to `.env.local`
for local development and set the local values there. All real environment
files are ignored by Git. Deployment values belong in the hosting provider's
environment configuration, not committed files.

## Validation rules

- API and WebSocket bases must be absolute origins with no path. For example,
  `https://host` is valid; `https://host/api/chat` is rejected because callers
  already append `/api/...`.
- Deployed API and WebSocket endpoints must use HTTPS and WSS.
- Local REST and WebSocket endpoints must use localhost.
- Local, development, and staging configurations cannot use known production
  hosts.
- Production configurations reject localhost, private IP addresses, and known
  development/staging hosts.
- GraphQL must use HTTPS with exactly the `/graphql` path.
- Consent must use an HTTPS origin with no path.
- URL credentials, query strings, and fragments are rejected.

These checks run from `vite.config.ts`, so invalid deployments fail during the
build rather than reaching a patient's browser.

## URL ownership

`src/config/api.ts` is the single runtime endpoint source. It exposes:

- `getApiUrl("/api/...")` for customer-agent REST calls;
- `getWsUrl("/ws/...")` for the interview socket;
- `API_CONFIG.GRAPHQL_URL` for the separate Stance GraphQL API;
- `API_CONFIG.CONSENT_URL` for consent redirects.

Vercel only performs the SPA fallback rewrite to `index.html`. API and
WebSocket traffic use their explicit environment endpoints, so preview or
development deployments cannot silently inherit a production proxy.

## Commands

```bash
# First-time local setup; edit the ignored file with non-production values
cp .env.example .env.local

# Local development; reads .env.local
npm run dev

# Validate and build a local-mode bundle
npm run build:dev

# Production deployment: set all variables above in the hosting environment
npm run build

# Release gates
npx tsc -b
npm run lint
npm run build
npm audit --omit=dev
npm audit
```

React Router 7 requires Node.js 20 or newer; `package.json` enforces that build
requirement.

## Isolated Docker development deployment

The Docker deployment builds an immutable Vite bundle and serves it through
Nginx. It uses a separate container, image, network, and host port, so it does
not replace another frontend or any backend container.

```bash
cp .env.dev-docker.example .env.dev-docker
# Review the public endpoints in .env.dev-docker, then:
docker-compose -p stance-customer-agent-frontend-dev-isolated \
  --env-file .env.dev-docker \
  -f docker-compose.dev-isolated.yml up -d --build
docker-compose -p stance-customer-agent-frontend-dev-isolated \
  --env-file .env.dev-docker \
  -f docker-compose.dev-isolated.yml ps
```

For local testing, open `http://localhost:8081/{patientId}/FRM-01`. The default
example points the browser to the isolated backend on `localhost:8004`.

For deployment behind a development hostname, set `VITE_APP_ENV=development`,
use the HTTPS/WSS development backend endpoints, and keep the container bound
to loopback. Configure the host reverse proxy to forward the development
frontend hostname to `http://127.0.0.1:8081`. Because Vite embeds these values
at build time, rebuild the image after changing any `VITE_*` value.

For temporary direct-IP UAT only, set `VITE_APP_ENV=development`, use
`http://SERVER_IP:8004` and `ws://SERVER_IP:8004`, and set
`VITE_ALLOW_INSECURE_DEV_IP=true`. The exception accepts literal IP addresses
only and is rejected for production builds. Restrict ports 8081 and 8004 to the
tester's IP in the firewall/security group. Microphone access may be blocked by
browsers on an insecure public-IP origin; HTTPS is required for full voice UAT.

Useful operations:

```bash
# Logs
docker-compose -p stance-customer-agent-frontend-dev-isolated \
  --env-file .env.dev-docker \
  -f docker-compose.dev-isolated.yml logs -f --tail=100

# Rebuild after source or endpoint changes
docker-compose -p stance-customer-agent-frontend-dev-isolated \
  --env-file .env.dev-docker \
  -f docker-compose.dev-isolated.yml up -d --build

# Stop only this isolated frontend
docker-compose -p stance-customer-agent-frontend-dev-isolated \
  --env-file .env.dev-docker \
  -f docker-compose.dev-isolated.yml down
```

## Repository hygiene

`package-lock.json` is the single dependency lockfile and npm is the supported
package manager. Commit application source, required public assets, safe example
configuration, tests, and maintained documentation. Do not commit environment
files, generated bundles, dependency directories, TypeScript/Vite caches, lint
reports, coverage/browser-test output, logs, or editor state. Review
`git status --short` and `git diff --check` before each change is submitted.

## Troubleshooting

- `Missing required public configuration`: define the named value in the
  selected environment.
- `contains an unexpected path`: remove `/api`, `/api/chat`, `/ws`, query
  parameters, or fragments from the base URL.
- `points a non-production build at production`: correct `VITE_APP_ENV` or use
  the appropriate non-production service.
- Browser connection failure after a valid build: verify DNS/TLS, backend CORS,
  and that the REST and WebSocket services are reachable from the browser.

# PlayBook API load testing

This suite is a guarded, dependency-free Node/TypeScript runner. It uses the API's existing routes and `fetch`; it does not deploy infrastructure, upload large files, sign users in repeatedly, or target production by default. Results are diagnostic measurements, not production SLAs.

## Start safely on Windows

Start the API in one PowerShell window:

```powershell
npm run api:dev
```

In a second window, configure only a local or staging target:

```powershell
$env:LOAD_TEST_BASE_URL = "http://127.0.0.1:3000"
npm run api:load:test -- --scenario health --vus 10 --duration 10
```

`LOAD_TEST_BASE_URL` is required. Hosts that look like PlayBook production are refused. A production override requires both `LOAD_TEST_ALLOW_PRODUCTION=true` and `LOAD_TEST_PRODUCTION_CONFIRMATION=I_UNDERSTAND`; using that override is not recommended.

## Scenarios

| Scenario | Route(s) | Safety gate |
| --- | --- | --- |
| `health` | `GET /api/v1/health` | none |
| `auth` | `GET /api/v1/me` | `LOAD_TEST_AUTH_TOKEN` |
| `library` | `GET /api/v1/books` | dedicated token |
| `catalog` | genres, recommendations, and realistic search | public routes |
| `upload-auth` | `POST /api/v1/books` (1 KiB metadata only) | dedicated token + `LOAD_TEST_ALLOW_MUTATIONS=true` |
| `upload-complete` | repeated completion for `LOAD_TEST_BOOK_ID` | dedicated controlled record + mutation gate |
| `rate-limit` | controlled upload authorization requests | mutation gate + `LOAD_TEST_ALLOW_RATE_LIMIT_TEST=true` |

Authenticated scenarios reuse one already-issued Supabase access token. The runner never prints it. Do not use a real user's token or data.

Examples:

```powershell
$env:LOAD_TEST_AUTH_TOKEN = "<dedicated-test-access-token>"
npm run api:load:test -- --scenario auth --vus 10 --duration 10
npm run api:load:test -- --scenario library --vus 10 --duration 10
npm run api:load:test -- --scenario catalog --vus 10 --duration 10
```

Safe progressive commands are explicit and configurable:

```powershell
npm run api:load:test -- --scenario health --vus 50 --duration 30
npm run api:load:test -- --scenario health --vus 100 --duration 60
npm run api:load:test -- --scenario health --stages --vus 1000
```

The staged command runs 10/30s, 50/30s, 100/60s, 250/60s, 500/60s, and 1000/60s only up to the requested VU count. It never exceeds 1000 automatically. Values above 1000 require `LOAD_TEST_ALLOW_HIGHER=true` and an explicit `--vus` value, but such tests are not run by this project validation.

## Controlled mutation tests and cleanup

Use a dedicated test account and a small request count. The upload authorization test creates only small database records and records returned book IDs locally in ignored file `apps/api/.load-test-state.jsonl`.

```powershell
$env:LOAD_TEST_ALLOW_MUTATIONS = "true"
$env:LOAD_TEST_REQUESTS = "10"
npm run api:load:test -- --scenario upload-auth --vus 2 --duration 10
$env:LOAD_TEST_ALLOW_RATE_LIMIT_TEST = "true"
npm run api:load:test -- --scenario rate-limit --vus 2 --requests 35
```

For idempotency, set `LOAD_TEST_BOOK_ID` to a controlled uploaded fixture and run:

```powershell
npm run api:load:test -- --scenario upload-complete --vus 2 --requests 5
```

Cleanup deletes only IDs recorded by this suite through the authenticated soft-delete route:

```powershell
npm run api:load:test -- --cleanup
```

It does not delete arbitrary IDs and does not remove S3 objects.

## Worker and database tests

Worker claim correctness and stale lease recovery are database/worker concerns rather than HTTP VU tests. Existing focused tests exercise the production `claim_next_processing_job` RPC, `FOR UPDATE SKIP LOCKED`, and lease behavior without invoking OpenAI/OCR or creating cloud cost:

```powershell
npm --prefix apps/api test -- --run test/processing-job.test.ts
npm --prefix apps/api test -- --run test/rate-limit.test.ts
```

For worker throughput, use dedicated queued `processing_jobs` fixtures, mock providers, and one separate worker process per requested concurrency (1, 2, 4, 8). Record queued, claimed, completed, failed, retries, lease recoveries, duplicate claims, and queue depth from logs and the database. Do not use customer jobs.

## Report and interpretation

Each HTTP run prints JSON containing concurrency, duration, request count, requests/sec, p50/p95/p99 latency, success/error rate, status distribution, network errors, 429 count, 5xx count, a diagnostic pass flag, and a coarse bottleneck hint. `LOAD_TEST_DIAGNOSTIC_P95_MS`, `LOAD_TEST_DIAGNOSTIC_P99_MS`, and `LOAD_TEST_DIAGNOSTIC_MAX_ERROR_RATE` customize initial diagnostics; they are not launch commitments.

During tests observe Supabase/Postgres active connections, CPU/memory when available, query latency, slow queries, lock waits, pool saturation, and database errors. Observe API CPU/memory and worker queue depth/lease recovery from local processes and the database.

No new migration is required by this suite. Apply `20261018000000_harden_horizontal_scaling.sql` separately if it is not already applied; it supplies the shared worker-claim and rate-limit primitives used by the existing API.

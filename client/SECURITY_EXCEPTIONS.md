# Security Exceptions

This document tracks accepted security findings that cannot be resolved without
breaking changes, plus the results of the automated SAST/DAST review wired into
the deployment pipeline (`scripts/security/`).

**Last full review**: 2026-09-22 (SAST + DAST + manual OWASP source pass)
**Last remediation**: 2026-09-22 (dep upgrades + CloudFront security headers)
**Next review**: 2026-12-22 (quarterly) or on any major dependency change

---

## Remediation Log (2026-09-22)

Actions taken after the review below:

- **Upgraded `axios`** 1.16.1 → 1.20.0 — prototype-pollution advisory resolved.
- **Upgraded `amazon-cognito-identity-js`** 6.3.16 → 6.3.20 — advisories resolved.
- **Upgraded `jspdf`** 2.5.2 → 4.2.1 and **`jspdf-autotable`** 3.8.4 → 5.0.8 —
  ReDoS resolved. Migrated `reportPdfExporter.js` to the v5 autoTable API
  (`autoTable(doc, opts)`); added `reportPdfExporter.test.js` (5 tests) to lock
  in the new API contract. Production build + 83 related tests pass.
- **Added CloudFront security headers** (see A05 below) via a
  `ResponseHeadersPolicy` in `serverless.yml` and an idempotent step in
  `deploy-to-keeptabs.sh`.

`npm audit` totals after remediation: **2 critical, 21 high, 17 moderate, 13 low**
(down from 3/25/18/13). All remaining critical/high are the accepted transitive
build-tooling items below — no production-runtime dependency has an open
critical/high advisory.

---

## Scan Summary (2026-09-22, pre-remediation)

Run via `npm run scan` from the `mytabs-client-web/` root.

| Scan | Tool | Result |
|------|------|--------|
| SAST — dependencies | `npm audit` | 3 critical, 25 high, 18 moderate, 13 low |
| SAST — secrets | regex scan of `client/src` | Clean — no hardcoded secrets |
| SAST — code patterns | semgrep | Not run (not installed on scan host) |
| DAST — dynamic | OWASP ZAP baseline | Not run (Docker unavailable); header/TLS fallback used |
| DAST — headers/TLS | curl + openssl | TLS valid; 5 security headers missing (see below) |

> The `npm audit` count is far higher than this document previously assumed
> (it expected "2 moderate"). That expectation was stale. The triage below
> distinguishes production-runtime risk from dev/build-only tooling.

---

## Accepted Exceptions

### 1. webpack-dev-server (moderate) — development only

**Status**: ACCEPTED — Development Only
**Affected**: `webpack-dev-server` (via `react-scripts`)
**Advisories**: GHSA-9jgg-88mc-972h, GHSA-4v9v-hfq4-rm2v

Source code could be read by a malicious site the developer visits while the dev
server is running. Not included in production builds; no production risk. Fixing
requires a breaking `react-scripts` change.

**Mitigation**: Don't browse untrusted sites while `npm start` is running.

---

### 2. Transitive dev/build toolchain vulns (critical/high) — not shipped

**Status**: ACCEPTED — Build/Test Tooling Only
**Affected (examples)**: `svgo`/`@svgr/*`, `workbox-*`, `rollup-plugin-terser`,
`serialize-javascript`, `postcss`, `browserslist`, `shell-quote`,
`websocket-driver`, `ws`, `http-proxy-middleware`, `nanoid`, `js-yaml`,
`bfj`, `jsonpath` — nearly all pulled in transitively by `react-scripts@5`
and the Jest/Serverless dev tooling.

**Why accepted**:
1. These run at **build/test time**, not in the shipped browser bundle.
2. `npm audit fix` only resolves them via **breaking** changes
   (`react-scripts@0.0.0`, `serverless-s3-sync` major downgrade), which break
   the build.
3. Create React App is effectively unmaintained; the real fix is migrating the
   build system (see Resolution Path).

**Resolution Path**: Migrate off `react-scripts` (CRA) to **Vite**, which
eliminates the bulk of these transitive advisories. Tracked as tech-debt.

---

### 3. `xlsx` (high) — Prototype Pollution / ReDoS, no npm fix

**Status**: ACCEPTED WITH MITIGATION — Production dependency
**Version**: `xlsx@0.18.5`
**Advisories**: Prototype Pollution (GHSA-4r6h-8v6p-xvw6), ReDoS (GHSA-5pgg-2g8v-p4x9)

SheetJS no longer publishes fixed versions to the public npm registry; the
patched build is only on their own CDN. Used for spreadsheet export.

**Risk assessment**: Exploit requires parsing a **malicious spreadsheet file**.
This app primarily *generates/exports* xlsx rather than parsing untrusted
uploads, which limits exposure.
**Mitigation / TODO**: Do not feed untrusted user-supplied files to `xlsx`. If
import-from-file is ever added, migrate to the SheetJS CDN build or an
alternative parser first.

---

### 4. `jspdf` / `jspdf-autotable` (critical) — ReDoS — ✅ RESOLVED

**Status**: RESOLVED 2026-09-22
**Advisory**: jsPDF ReDoS (GHSA-8mvj-3j78-4qmw)

Upgraded `jspdf` 2.5.2 → **4.2.1** and `jspdf-autotable` 3.8.4 → **5.0.8**. The
autoTable call sites in `reportPdfExporter.js` were migrated from the v3 method
form (`doc.autoTable(opts)`) to the v5 function form (`autoTable(doc, opts)`).
Covered by `reportPdfExporter.test.js`. jsPDF constructor usage elsewhere is
API-compatible across v2–v4 and required no change.

---

### 5. `axios` (high) & `amazon-cognito-identity-js` (high) — ✅ RESOLVED

**Status**: RESOLVED 2026-09-22
**Advisories**: Axios prototype-pollution in Basic-auth subfields; Cognito SDK
transitive advisories.

Upgraded `axios` 1.16.1 → **1.20.0** and `amazon-cognito-identity-js`
6.3.16 → **6.3.20**. Both now CLEAN in `npm audit`. Auth/HTTP path verified: the
`useLogin` and `http` (axios interceptor) test suites pass, so email/password
login and token refresh remain intact.

---

## OWASP Observations (manual source pass)

Positive and open items from a manual review against the OWASP Top 10:

- **A03 Injection / XSS — GOOD**: No `dangerouslySetInnerHTML`, `eval`,
  `innerHTML`, or `document.write` sinks found in `client/src`.
- **A07 Identification & Auth Failures — REVIEW**: Auth tokens (`idToken`,
  `accessToken`, `refToken`) are stored in `localStorage`
  (`src/hooks/useLogin.js`, `src/utils/axios/http.js`). Per OWASP guidance,
  `localStorage` is readable by any JavaScript, so an XSS would exfiltrate
  tokens. Mitigated somewhat by the clean XSS surface above and session-timeout
  handling, but the long-term recommendation is httpOnly, Secure, SameSite
  cookies for token storage. Tracked as an architectural item.
- **A05 Security Misconfiguration — ✅ LIVE (CSP in Report-Only rollout)**:
  A CloudFront `ResponseHeadersPolicy` (Id `91c7aa74-6145-44c2-9771-d81daf738196`,
  attached to distribution `E1WB9UQAAX3TCW` on 2026-09-23) now applies
  `Strict-Transport-Security` (2yr, preload, includeSubdomains),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and
  `Referrer-Policy: strict-origin-when-cross-origin` to every viewer response —
  verified live via `curl -I https://keeptabs.app`.
  Defined in `serverless.yml` (`SecurityHeadersPolicy`) and re-applied by an
  idempotent step in `deploy-to-keeptabs.sh` (Step 4c) for the CLI deploy path.
  - **CSP is shipped Report-Only** (`Content-Security-Policy-Report-Only`) during
    rollout so it cannot break Stripe / Google OAuth+Maps / Cognito / Apple /
    Facebook / API traffic. **TODO**: watch the browser console for violation
    reports, then promote to an enforced `Content-Security-Policy` header once
    clean. The allowlist lives in both `serverless.yml` and `deploy-to-keeptabs.sh`
    and must be kept in sync.
  - `Server: AmazonS3` disclosure remains (informational; CloudFront/S3 origin
    header, low risk).

---

## Open / Deferred Items

- **CSP enforcement**: currently Report-Only — promote to enforced after
  validating no legitimate origins are blocked (see A05).
- **A07 token storage**: move auth JWTs from `localStorage` to httpOnly cookies
  (architectural; deferred).
- **CRA → Vite migration**: eliminates the bulk of the accepted transitive
  build-tooling vulns (exception #2); tracked as tech-debt.
- **`xlsx`**: no public npm fix (exception #3); revisit if untrusted-file import
  is ever added.

---

## How to reproduce this review

```bash
npm run scan          # SAST + DAST
npm run scan:sast     # dependency audit + secret scan + semgrep (if installed)
npm run scan:dast     # ZAP baseline (needs Docker) + header/TLS checks
```

Reports are written to `../.security-reports/` (git-ignored).

### SAST gate thresholds & the accepted-exceptions allowlist

The deploy gate (`deploy-to-keeptabs.sh` Step 1b) tolerates
`SAST_ALLOW_AUDIT_MODERATE=2` moderate vulns and blocks on high/critical — but it
blocks **only** on high/critical findings that are *not* on the accepted-exceptions
allowlist at `scripts/security/sast-allowlist.json`.

That allowlist is the machine-readable mirror of this document. Every package
covered by exceptions #2 (transitive build/test tooling) and #3 (`xlsx`) is listed
there, so the gate now **passes** on its own merits without `--skip-scans`. A
high/critical advisory on any package *not* in the allowlist still fails the gate,
so a newly introduced production vulnerability is caught instead of silently
shipped.

**Keeping the two in sync is mandatory.** When a new high/critical appears:

1. Prefer to **fix** it (upgrade the dependency), or
2. If it is genuinely acceptable (e.g. build-only, or no fix exists), add an entry
   to `scripts/security/sast-allowlist.json` **and** document the rationale here.

`--skip-scans` remains only for emergency hotfixes; do **not** make it the norm.
To review the full unfiltered finding set (e.g. at the quarterly review), run
`SAST_IGNORE_ALLOWLIST=1 npm run scan:sast`.

> Note: the moderate-vuln count (17) still exceeds the `SAST_ALLOW_AUDIT_MODERATE=2`
> allowance, but moderates are a non-blocking warning by default (they only block
> under `SAST_STRICT=1`). The allowlist governs the blocking high/critical tier.

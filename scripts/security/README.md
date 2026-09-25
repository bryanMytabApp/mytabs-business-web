# Security Scans — SAST & DAST

Automated security scanning for `mytabs-client-web`, wired into the deployment flow.

## What runs

| Scan | When | Blocks deploy? | Tooling |
|------|------|----------------|---------|
| **SAST** (static) | Before build/upload (`deploy` Step 1b) | **Yes** — deploy aborts | `npm audit`, regex secret scan, `semgrep` (optional) |
| **DAST** (dynamic) | After the site is live (`deploy` Step 11) | No — warns + rollback hint | OWASP ZAP baseline (Docker), with HTTP header + TLS fallback |

SAST is a hard gate: nothing ships if it fails. DAST runs against the already-live
site, so it reports findings rather than blocking (the site can be reverted with
`./deploy-to-keeptabs.sh --rollback`).

## Running manually

From the `mytabs-client-web/` root:

```bash
npm run scan:sast     # static analysis only
npm run scan:dast     # dynamic scan against https://keeptabs.app
npm run scan          # both

# or call the scripts directly
bash scripts/security/sast-scan.sh
bash scripts/security/dast-scan.sh https://keeptabs.app
```

Reports are written to `.security-reports/` (git-ignored):
- `npm-audit.json` — full dependency audit
- `secret-scan.txt` — secret-scan hits (empty = clean)
- `semgrep.json` — code-pattern findings (if semgrep installed)
- `zap-baseline.html` / `.json` — ZAP results (if Docker available)
- `http-headers.txt` — response headers captured during DAST

## Deployment

```bash
./deploy-to-keeptabs.sh                # full deploy with scans
./deploy-to-keeptabs.sh --skip-scans   # bypass scans (hotfix escape hatch)
SKIP_SCANS=1 ./deploy-to-keeptabs.sh   # same, via env var
```

## Tuning the SAST gate

Environment variables (defaults chosen to match `client/SECURITY_EXCEPTIONS.md`):

| Var | Default | Meaning |
|-----|---------|---------|
| `SAST_ALLOW_AUDIT_MODERATE` | `2` | Tolerated moderate npm-audit vulns |
| `SAST_FAIL_ON` | `high` | npm-audit level that blocks (`high` or `critical`) |
| `SAST_STRICT` | `0` | `1` = moderates over the allowance also block |
| `SAST_ALLOWLIST` | `scripts/security/sast-allowlist.json` | Accepted-exceptions file |
| `SAST_IGNORE_ALLOWLIST` | `0` | `1` = ignore the allowlist; block on every high/critical |

### Accepted-exceptions allowlist

The gate does **not** blindly block on every high/critical `npm audit` finding.
It cross-references each high/critical package against
`scripts/security/sast-allowlist.json` — the machine-readable mirror of
`client/SECURITY_EXCEPTIONS.md`. A finding is suppressed (accepted, non-blocking)
**only** when its package is listed there; every high/critical on a package that
is *not* listed still fails the gate. This means the documented, non-shippable
build-tooling vulns (CRA/`react-scripts`, Jest, Serverless dev deps) and the
`xlsx` runtime exception no longer force `--skip-scans`, while a newly introduced
production vulnerability is still caught.

When triaging a genuinely new high/critical finding, do one of:
1. **Fix it** (upgrade the dependency), or
2. **Accept it** — add an entry to `sast-allowlist.json` *and* document it in
   `client/SECURITY_EXCEPTIONS.md` with the rationale.

To see the raw, unfiltered finding set (e.g. during a quarterly review), run:

```bash
SAST_IGNORE_ALLOWLIST=1 npm run scan:sast
```

## Tuning the DAST gate

| Var | Default | Meaning |
|-----|---------|---------|
| `DAST_TARGET` | `https://keeptabs.app` | URL to scan |
| `DAST_FAIL_ON_WARN` | `0` | `1` = missing security headers become blocking |

## Optional tooling for fuller coverage

- **semgrep** (SAST code patterns): `pipx install semgrep` or `brew install semgrep`
- **Docker** (full ZAP DAST): required to run `ghcr.io/zaproxy/zaproxy:stable`.
  Without it, DAST falls back to security-header + TLS checks.

## Current known findings (as of setup)

- **Dependencies**: `npm audit` reports high/critical vulnerabilities that are all
  documented accepted exceptions in `client/SECURITY_EXCEPTIONS.md` (transitive
  CRA/`react-scripts` + dev-tooling vulns that never ship, plus the `xlsx` runtime
  exception with no public npm fix). These are enumerated in
  `sast-allowlist.json`, so the SAST gate **passes** without `--skip-scans` while
  still blocking any *new* high/critical outside the allowlist. `--skip-scans`
  remains for emergency hotfixes only.
- **Missing security headers**: addressed — a CloudFront `ResponseHeadersPolicy`
  now applies HSTS / X-Content-Type-Options / X-Frame-Options / Referrer-Policy
  (CSP shipped Report-Only during rollout). See `client/SECURITY_EXCEPTIONS.md` A05.

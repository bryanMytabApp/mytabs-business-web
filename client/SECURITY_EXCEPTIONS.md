# Security Exceptions

This document tracks accepted security vulnerabilities that cannot be resolved without breaking changes.

## Current Exceptions

### webpack-dev-server (2 moderate vulnerabilities)

**Status**: ACCEPTED - Development Only  
**Severity**: Moderate  
**Affected Package**: `webpack-dev-server` (via `react-scripts`)  
**Advisories**: 
- GHSA-9jgg-88mc-972h
- GHSA-4v9v-hfq4-rm2v

**Description**: 
Source code may be stolen when developers access malicious websites while running the dev server.

**Why Accepted**:
1. **Development-only impact**: Only affects local development environment, not production builds
2. **No production risk**: webpack-dev-server is not included in production bundles
3. **Breaking change required**: Fixing requires upgrading to react-scripts@0.0.0 which breaks the build
4. **Mitigation**: Developers should avoid visiting untrusted websites while dev server is running
5. **Low practical risk**: Requires developer to actively visit a malicious site during development

**Resolution Path**:
- Monitor for react-scripts updates that include webpack-dev-server v5.2.1+
- Re-evaluate when Create React App releases compatible version
- Consider migration to Vite or Next.js in future for better security updates

**Last Reviewed**: 2026-02-16  
**Next Review**: When react-scripts updates are available

---

## Vulnerability Tracking

Run `npm audit` to check current status:
```bash
npm audit
```

Expected output:
```
2 moderate severity vulnerabilities
```

All other vulnerabilities MUST be fixed immediately per security policy.

# CloudFront Configuration for QR Code System

This document describes the CloudFront distribution configuration required to support the Tabs QR Code System's jump page routing and well-known files.

## Overview

The QR system uses short URLs (`/b/*`, `/m/*`, `/e/*`, `/o/*`) that resolve to a branded jump page. CloudFront must route these paths to the jump page (`/jump/index.html`) while also serving well-known files for iOS Universal Links and Android App Links.

---

## 1. Jump Page Routing

### Paths to Route

| Path Pattern | Entity Type | Example |
|---|---|---|
| `/b/*` | Business QR codes | `/b/ORG-ABCD-BIZ-EFGH` |
| `/m/*` | Menu QR codes | `/m/BIZ-ABCD-MEU-EFGH` |
| `/e/*` | Event QR codes | `/e/BIZ-ABCD-EVT-EFGH` |
| `/o/*` | Organization QR codes | `/o/ORG-ABCD` |

### CloudFront Behavior Configuration

Create a **Cache Behavior** for each QR path pattern that rewrites to the jump page:

```yaml
# CloudFormation snippet
Resources:
  QRDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - Id: S3JumpPageOrigin
            DomainName: !Sub "${JumpPageBucket}.s3.amazonaws.com"
            S3OriginConfig:
              OriginAccessIdentity: !Sub "origin-access-identity/cloudfront/${OAI}"

        CacheBehaviors:
          # QR code paths → jump page
          - PathPattern: "/b/*"
            TargetOriginId: S3JumpPageOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref NoCachePolicy
            FunctionAssociations:
              - EventType: viewer-request
                FunctionARN: !GetAtt RewriteToJumpPage.FunctionARN

          - PathPattern: "/m/*"
            TargetOriginId: S3JumpPageOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref NoCachePolicy
            FunctionAssociations:
              - EventType: viewer-request
                FunctionARN: !GetAtt RewriteToJumpPage.FunctionARN

          - PathPattern: "/e/*"
            TargetOriginId: S3JumpPageOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref NoCachePolicy
            FunctionAssociations:
              - EventType: viewer-request
                FunctionARN: !GetAtt RewriteToJumpPage.FunctionARN

          - PathPattern: "/o/*"
            TargetOriginId: S3JumpPageOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref NoCachePolicy
            FunctionAssociations:
              - EventType: viewer-request
                FunctionARN: !GetAtt RewriteToJumpPage.FunctionARN
```

### CloudFront Function: Rewrite to Jump Page

```javascript
// CloudFront Function (viewer-request)
function handler(event) {
  var request = event.request;
  // Preserve the original URI as a query parameter for the jump page to parse
  var originalPath = request.uri;
  request.uri = '/jump/index.html';
  // The jump page reads the path from window.location on the client side
  return request;
}
```

---

## 2. Well-Known Files (iOS Universal Links & Android App Links)

### Apple App Site Association

Serve `/.well-known/apple-app-site-association` with:
- **Content-Type:** `application/json`
- **Cache-Control:** `no-cache, no-store, must-revalidate`

```yaml
        CacheBehaviors:
          - PathPattern: "/.well-known/apple-app-site-association"
            TargetOriginId: S3JumpPageOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref NoCachePolicy
            ResponseHeadersPolicyId: !Ref JsonNoCacheHeadersPolicy
```

### Android Asset Links

Serve `/.well-known/assetlinks.json` with:
- **Content-Type:** `application/json`
- **Cache-Control:** `no-cache, no-store, must-revalidate`

```yaml
          - PathPattern: "/.well-known/assetlinks.json"
            TargetOriginId: S3JumpPageOrigin
            ViewerProtocolPolicy: redirect-to-https
            CachePolicyId: !Ref NoCachePolicy
            ResponseHeadersPolicyId: !Ref JsonNoCacheHeadersPolicy
```

### Response Headers Policy

```yaml
  JsonNoCacheHeadersPolicy:
    Type: AWS::CloudFront::ResponseHeadersPolicy
    Properties:
      ResponseHeadersPolicyConfig:
        Name: JsonNoCacheHeaders
        CustomHeadersConfig:
          Items:
            - Header: Content-Type
              Value: application/json
              Override: true
            - Header: Cache-Control
              Value: "no-cache, no-store, must-revalidate"
              Override: true
```

---

## 3. Custom Error Responses (403/404 → Jump Page)

For QR paths that don't match a physical file in S3, configure custom error responses to serve the jump page:

```yaml
        CustomErrorResponses:
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /jump/index.html
            ErrorCachingMinTTL: 0

          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /jump/index.html
            ErrorCachingMinTTL: 0
```

> **Note:** These custom error responses apply to the entire distribution. If you need them only for QR paths, use the CloudFront Function approach (Section 1) which rewrites the URI before S3 is queried, avoiding 403/404 errors entirely.

---

## 4. No-Cache Policy

```yaml
  NoCachePolicy:
    Type: AWS::CloudFront::CachePolicy
    Properties:
      CachePolicyConfig:
        Name: QRNoCachePolicy
        DefaultTTL: 0
        MaxTTL: 0
        MinTTL: 0
        ParametersInCacheKeyAndForwardedToOrigin:
          CookiesConfig:
            CookieBehavior: none
          HeadersConfig:
            HeaderBehavior: none
          QueryStringsConfig:
            QueryStringBehavior: none
          EnableAcceptEncodingGzip: false
```

---

## 5. S3 Bucket Structure

The jump page S3 bucket should contain:

```
/jump/index.html                              ← Jump page SPA
/.well-known/apple-app-site-association       ← iOS Universal Links config
/.well-known/assetlinks.json                  ← Android App Links config
```

---

## 6. Manual Setup Steps (AWS Console)

If not using CloudFormation, configure manually:

1. **Create S3 bucket** for jump page assets
2. **Create CloudFront distribution** pointing to the S3 bucket
3. **Add Cache Behaviors** for `/b/*`, `/m/*`, `/e/*`, `/o/*` paths
4. **Create CloudFront Function** that rewrites URI to `/jump/index.html`
5. **Associate the function** with each QR path behavior (viewer-request)
6. **Add Cache Behavior** for `/.well-known/*` with no-cache and JSON content-type
7. **Configure Custom Error Responses** for 403 and 404 → `/jump/index.html`
8. **Set CNAME** to `keeptabs.app` and attach SSL certificate
9. **Upload well-known files** to S3 with correct content types

---

## 7. Testing

After deployment, verify:

```bash
# Test QR path routing
curl -I https://keeptabs.app/b/TEST-CODE
# Should return 200 with jump page content

# Test well-known files
curl -I https://keeptabs.app/.well-known/apple-app-site-association
# Should return Content-Type: application/json, Cache-Control: no-cache

curl -I https://keeptabs.app/.well-known/assetlinks.json
# Should return Content-Type: application/json, Cache-Control: no-cache

# Test 404 fallback
curl -I https://keeptabs.app/b/NONEXISTENT
# Should return 200 with jump page (jump page handles the error display)
```

---

## Requirements Covered

- **3.1**: Jump page served at QR URLs with brand logo and entity info
- **3.2**: iOS deep link attempt via `myapp://` scheme
- **3.3**: Android Intent URL with app store fallback

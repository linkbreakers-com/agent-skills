---
name: identify-visitors-on-your-site
description: Connect a QR code scan to what the same person does later on the user's own website or app by forwarding the Linkbreakers lbid through the redirect and calling the identify API, so signups, purchases and profile data merge into one Linkbreakers visitor. Use when the user wants offline-to-online attribution, wants to know which QR code drove a signup or sale, or wants to enrich Linkbreakers visitors from their own product.
license: MIT
metadata:
  author: linkbreakers
  version: "1.0"
---

# Identify visitors on your own site

When conversion tracking is on, Linkbreakers appends an `lbid` query parameter to the redirect URL. Your site reads it and calls `POST /v1/visitor/identify` with what it knows about the person. Linkbreakers promotes the anonymous scanner to an identified visitor, or merges into an existing visitor with the same identity so devices and events converge on one record.

## 1. Turn on conversion tracking

- New link: `"conversionTracking": true` on `POST /v1/links` (CLI `--conversion-tracking`).
- Existing link: update the redirect step, `PATCH /v1/links/{linkId}/workflow-steps/{stepId}` with `{"payload": {"clientRedirect": {"destination": "https://example.com/landing", "conversionTracking": true}}}` (MCP `workflow_steps_update`).

The visitor now lands on `https://example.com/landing?lbid=...`.

## 2. Capture the lbid on landing

```js
const lbid = new URLSearchParams(window.location.search).get('lbid');
if (lbid) sessionStorage.setItem('lbid', lbid);
```

Keep it until you learn who the person is (signup, checkout, form).

## 3. Identify

`POST /v1/visitor/identify`:

```json
{
  "lbid": "<lbid from the URL>",
  "visitor": {
    "data": {
      "$email": "jane@example.com",
      "$firstName": "Jane",
      "plan": "premium"
    }
  },
  "setOnce": false
}
```

- Reserved keys: `$email`, `$phone`, `$firstName`, `$lastName`. Other keys become custom attributes.
- `setOnce: true` keeps existing values instead of overwriting them.
- Response: `visitor` (the resolved profile) and `created` (true when a new identified visitor was created).

TypeScript SDK:

```ts
import { Configuration, VisitorsApi } from 'linkbreakers';

const visitors = new VisitorsApi(new Configuration({
  accessToken: process.env.LINKBREAKERS_TOKEN,
  basePath: 'https://api.linkbreakers.com',
}));
await visitors.visitorsServiceIdentify({
  identifyRequest: { lbid, visitor: { data: { $email: 'jane@example.com' } } },
});
```

Python SDK: `VisitorsApi(api_client).visitors_service_identify(...)` with the same body.

## Which token

Workspace tokens are either secret (`WORKSPACE_TOKEN_KEY_TYPE_SECRET`, full API access) or publishable (`WORKSPACE_TOKEN_KEY_TYPE_PUBLISHABLE`, limited access). Call identify from your backend with a secret key whenever you can. If you must call it from the browser, use a publishable key, never a secret key.

## Updating a known visitor

`PATCH /v1/visitors/{id}` updates a visitor you already have the id of. `DELETE /v1/visitors/{id}/attributes/{attributeKey}` removes one attribute; `DELETE /v1/visitors/{id}` erases the visitor (use it for data deletion requests).

Docs: https://linkbreakers.com/sdk/typescript, https://linkbreakers.com/help/article/what-is-a-visitor-in-qr-analytics-and-why-it-matters

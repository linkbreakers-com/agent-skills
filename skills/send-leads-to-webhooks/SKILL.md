---
name: send-leads-to-webhooks
description: Push Linkbreakers scans and captured leads to another system in real time with webhooks, and write the receiving endpoint. Use when the user wants new QR code leads in their CRM, Slack, a database, Zapier, Make or their own backend as soon as someone scans or submits a form, or asks what a Linkbreakers webhook payload looks like.
license: MIT
metadata:
  author: linkbreakers
  version: "1.0"
---

# Send leads to webhooks

Linkbreakers POSTs JSON to your endpoint when visitors go through workflow steps. Webhooks are managed over REST (`/v1/webhooks`) or in the dashboard under Developers, Webhooks. There is no MCP tool for webhooks; use the REST API, an SDK (`WebhooksApi`) or `linkbreakers raw`.

All REST calls: `https://api.linkbreakers.com`, header `Authorization: Bearer <workspace token>`.

## Create a webhook

```bash
curl -sS -X POST https://api.linkbreakers.com/v1/webhooks \
  -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CRM sync",
    "endpointUrl": "https://example.com/hooks/linkbreakers/3f9c2e7a",
    "linkId": "'"$LINK_ID"'",
    "triggers": ["KIND_INTERACTION", "KIND_EXIT"]
  }'
```

- `name` and `endpointUrl` are required.
- `linkId`: only events from this link. Omit for every link in the workspace.
- `triggers`: only steps of these kinds (`KIND_ENTRY`, `KIND_INTERACTION`, `KIND_CONDITION`, `KIND_EXIT`). Omit for all. Form submissions are `KIND_INTERACTION`; reaching the end of a journey is `KIND_EXIT`.
- `source`: `WEBHOOK_SOURCE_LINKBREAKERS` (default use), `WEBHOOK_SOURCE_ZAPIER`, `WEBHOOK_SOURCE_MAKE`.

Manage: `GET /v1/webhooks`, `GET|PATCH|DELETE /v1/webhooks/{id}`. Each webhook reports `status`, `successCount`, `failureCount`, `lastSentAt`, `lastDeliveredAt`.

## What your endpoint receives

`POST` with `Content-Type: application/json`, `User-Agent: Linkbreakers-Webhooks/1.0`, and headers `X-Linkbreakers-Event`, `X-Linkbreakers-Webhook-ID`, `X-Linkbreakers-Event-ID`. Body:

```json
{
  "type": "step.completed",
  "timestamp": "2026-10-10T12:00:00Z",
  "lbid": "...",
  "event": { "id": "...", "linkId": "...", "visitor": { "...": "..." }, "device": { "...": "..." }, "link": { "...": "..." }, "traces": [], "journey": { "completed": true, "stepsReached": 3, "stepsTotal": 3 } },
  "webhook": { "id": "...", "name": "CRM sync" },
  "workflowStep": { "id": "...", "eventAction": "FORM_SUBMIT", "kind": "INTERACTION", "payload": { "...": "..." } }
}
```

Branch on the body's `type`, not on the `X-Linkbreakers-Event` header (the header currently always says `event.completed`). `type` is `step.completed` when a specific workflow step completed (then `workflowStep` is present) or `event.completed` for the scan as a whole. The visitor's captured fields are on `event.visitor`; form answers are also in `event.traces`. Inside webhook bodies, enum values are unprefixed (`FORM_SUBMIT`, `INTERACTION`), unlike the REST API (`EVENT_ACTION_FORM_SUBMIT`, `KIND_INTERACTION`). Treat the exact nested fields as data to inspect on the first delivery rather than assumptions: log one real payload before mapping it into a CRM.

## Receiver checklist

- Respond with a 2xx quickly (requests time out after 30 seconds); do slow work asynchronously.
- Failed deliveries are retried up to 3 times. Make the handler idempotent: dedupe on `X-Linkbreakers-Event-ID` plus `workflowStep.id`.
- Payloads are not signed. Put an unguessable secret in the URL path (as above) and reject requests without it. For sensitive actions, confirm by reading the visitor back with `GET /v1/visitors/{id}`.
- Use HTTPS.

Minimal Node receiver:

```js
import express from 'express';
const app = express();
app.post('/hooks/linkbreakers/:secret', express.json(), (req, res) => {
  if (req.params.secret !== process.env.LB_HOOK_SECRET) return res.sendStatus(404);
  res.sendStatus(204);
  queue.push({ id: req.get('X-Linkbreakers-Event-ID'), body: req.body });
});
```

## Alternatives

- Polling: `GET /v1/events` or `POST /v1/visitors/search` on a schedule (see `read-visitors-and-leads`).
- No-code: Zapier and Make integrations, https://linkbreakers.com/help/article/linkbreakers-zapier-integration-connect-qr-campaigns-to-any-tool

---
name: send-leads-to-webhooks
description: Push Linkbreakers scans and captured leads to another system in real time with webhooks, and write the receiving endpoint. Use when the user wants new QR code leads in their CRM, Slack, a database, Zapier, Make or their own backend as soon as someone scans or submits a form, or asks what a Linkbreakers webhook payload looks like.
license: MIT
metadata:
  author: linkbreakers
  version: "1.1"
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
    "endpointUrl": "https://example.com/hooks/linkbreakers",
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

`POST` with `Content-Type: application/json`, `User-Agent: Linkbreakers-Webhooks/1.0`, headers `X-Linkbreakers-Event`, `X-Linkbreakers-Webhook-ID`, `X-Linkbreakers-Event-ID`, and a signature (see below). Body:

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
- Verify the signature (below) and refuse anything that fails. Then check `webhook.id` in the body is one of yours.
- Use HTTPS.

## Verify the signature

Every delivery is signed with HTTP Message Signatures (RFC 9421, Web Bot Auth, Ed25519). No shared secret: the public keys are at `https://linkbreakers.com/.well-known/http-message-signatures-directory`.

- `Content-Digest: sha-256=:<base64>:` is the SHA-256 of the raw body. Hash the exact bytes received, before parsing JSON.
- `Signature-Input: sig1=("@method" "@authority" "@path" "content-digest" "content-type" "signature-agent";key="sig1");created=...;keyid="...";alg="ed25519";expires=...;nonce="...";tag="web-bot-auth"`
- `Signature: sig1=:<base64>:` and `Signature-Agent: sig1="https://linkbreakers.com"`.

Rebuild the signed text: one line per component in the listed order, `"<component>": <value>`, then `"@signature-params": <everything after sig1= in Signature-Input>`, joined with `\n`, no trailing newline. Values: `@method` is `POST`; `@authority` and `@path` come from the endpoint URL you registered (host lower case, port only if not 443; path without query), not from what a proxy shows; the two headers as sent; `signature-agent` is `"https://linkbreakers.com"` with its quotes. Verify with the directory key whose `kid` equals `keyid`; refetch the directory only on an unknown `keyid` (that covers key rotation). Refuse `tag` other than `web-bot-auth` and signatures past `expires` (5 minutes after `created`).

Node receiver:

```js
import crypto from 'node:crypto';
import express from 'express';

const ENDPOINT_URL = new URL('https://example.com/hooks/linkbreakers'); // as registered in Linkbreakers
let keys = new Map();
async function loadKeys() {
  const { keys: list } = await (await fetch('https://linkbreakers.com/.well-known/http-message-signatures-directory')).json();
  keys = new Map(list.map((k) => [k.kid, crypto.createPublicKey({ key: { kty: k.kty, crv: k.crv, x: k.x }, format: 'jwk' })]));
}

async function verify(req, raw) {
  const digest = 'sha-256=:' + crypto.createHash('sha256').update(raw).digest('base64') + ':';
  if (req.get('content-digest') !== digest) throw new Error('digest');
  const [, sigParams, list, rest] = req.get('signature-input').match(/^sig1=(\((.*?)\)(.*))$/);
  const p = Object.fromEntries([...rest.matchAll(/;(\w+)=("([^"]*)"|\d+)/g)].map((m) => [m[1], m[3] ?? Number(m[2])]));
  if (p.tag !== 'web-bot-auth' || p.expires < Date.now() / 1000) throw new Error('expired');
  const v = {
    '"@method"': 'POST', '"@authority"': ENDPOINT_URL.host, '"@path"': ENDPOINT_URL.pathname,
    '"content-digest"': req.get('content-digest'), '"content-type"': req.get('content-type'),
    '"signature-agent";key="sig1"': req.get('signature-agent').replace(/^sig1=/, ''),
  };
  const base = [...list.split(' ').map((c) => `${c}: ${v[c]}`), `"@signature-params": ${sigParams}`].join('\n');
  if (!keys.has(p.keyid)) await loadKeys();
  const sig = Buffer.from(req.get('signature').match(/^sig1=:(.*):$/)[1], 'base64');
  if (!keys.has(p.keyid) || !crypto.verify(null, Buffer.from(base), keys.get(p.keyid), sig)) throw new Error('signature');
}

const app = express();
app.post('/hooks/linkbreakers', express.raw({ type: 'application/json' }), async (req, res) => {
  try { await verify(req, req.body); } catch { return res.sendStatus(401); }
  res.sendStatus(204);
  queue.push({ id: req.get('X-Linkbreakers-Event-ID'), body: JSON.parse(req.body) });
});
```

Python and full details: https://linkbreakers.com/help/article/verify-webhook-signatures

## Alternatives

- Polling: `GET /v1/events` or `POST /v1/visitors/search` on a schedule (see `read-visitors-and-leads`).
- No-code: Zapier and Make integrations, https://linkbreakers.com/help/article/linkbreakers-zapier-integration-connect-qr-campaigns-to-any-tool

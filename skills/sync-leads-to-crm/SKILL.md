---
name: sync-leads-to-crm
description: Sync the visitors a Linkbreakers QR code or link identifies into a CRM or email marketing tool as contacts, natively, without webhooks or Zapier. Covers HubSpot, Salesforce, Zoho CRM, Pipedrive, Freshsales, Mailchimp, Klaviyo, Brevo, MailerLite, Kit, Loops, Customer.io and Bird. Use when the user wants QR code leads added to a list or audience, created as a CRM contact, lead or deal, mapped to custom fields, or subscribed to marketing only with consent.
license: MIT
metadata:
  author: linkbreakers
  version: "1.0"
---

# Sync leads to a CRM or email tool

A workspace connects each contact tool once. From then on, every visitor a scan identifies (an email or a phone number, usually from a form) is created or updated as a contact in that tool, at every step of every link until the delivery setting narrows it. Contact tools are managed over REST (`/v1/integrations/contacts`), with the MCP tools `contact_integration_*`, or in the dashboard under Integrations.

All REST calls: `https://api.linkbreakers.com`, header `Authorization: Bearer <workspace token>`. `{tool}` is the full enum value, for example `CONTACT_TOOL_HUBSPOT`.

## Tools

| Tool | `{tool}` | Connects with |
| --- | --- | --- |
| HubSpot | `CONTACT_TOOL_HUBSPOT` | service key or private app token |
| Salesforce | `CONTACT_TOOL_SALESFORCE` | signing in (OAuth), after an admin installs the Linkbreakers package once per org |
| Zoho CRM | `CONTACT_TOOL_ZOHO_CRM` | signing in (OAuth), any data center |
| Pipedrive | `CONTACT_TOOL_PIPEDRIVE` | personal API token, `account` optionally the company domain |
| Freshsales | `CONTACT_TOOL_FRESHSALES` | API key, `account` the bundle alias (`<alias>.myfreshworks.com`) |
| Mailchimp | `CONTACT_TOOL_MAILCHIMP` | API key (`...-us21`); an audience is required |
| Klaviyo | `CONTACT_TOOL_KLAVIYO` | private API key (`pk_...`) |
| Brevo | `CONTACT_TOOL_BREVO` | API key (`xkeysib-...`) |
| MailerLite | `CONTACT_TOOL_MAILERLITE` | API token |
| Kit | `CONTACT_TOOL_KIT` | v4 API key |
| Loops | `CONTACT_TOOL_LOOPS` | API key |
| Customer.io | `CONTACT_TOOL_CUSTOMER_IO` | private API key (`sk_us_...` / `sk_eu_...`), or the Track API key with `account` the Site ID |
| Bird | `CONTACT_TOOL_BIRD` | workspace API key (`bk_us1_...` / `bk_eu1_...`) with the email_marketing write scope |

`GET /v1/integrations/contacts/{tool}/info` (MCP `contact_integration_tool_info`) says what a tool supports (`capabilities`: tags, consent, double opt-in, the CRM records it can create, what it calls a list), whether it connects by signing in, and for Salesforce the package install links. The exact key and its scopes for each tool are in the `contact_integration_connect` tool description.

| Action | REST | MCP tool |
| --- | --- | --- |
| List connected tools, with contacts synced and last error | `GET /v1/integrations/contacts` | `contact_integrations_list` |
| One tool's connection (empty when not connected) | `GET /v1/integrations/contacts/{tool}` | `contact_integration_get` |
| How a tool connects | `GET /v1/integrations/contacts/{tool}/info` | `contact_integration_tool_info` |
| Connect with a key | `POST /v1/integrations/contacts/{tool}/connect` | `contact_integration_connect` |
| Connect by signing in | `POST /v1/integrations/contacts/{tool}/oauth/start` | `contact_integration_oauth_start` |
| Finish a sign-in by hand | `POST /v1/integrations/contacts/{tool}/oauth/complete` | `contact_integration_oauth_complete` |
| Lists, audiences or groups | `GET /v1/integrations/contacts/{tool}/lists` | `contact_integration_lists` |
| Custom fields | `GET /v1/integrations/contacts/{tool}/fields` | `contact_integration_fields` |
| CRM pipelines and stages | `GET /v1/integrations/contacts/{tool}/pipelines` | `contact_integration_pipelines` |
| Change the list, delivery or options | `PATCH /v1/integrations/contacts/{tool}` | `contact_integration_update` |
| Check the credential (writes nothing) | `POST /v1/integrations/contacts/{tool}/test` | `contact_integration_test` |
| Disconnect (contacts already synced stay) | `DELETE /v1/integrations/contacts/{tool}` | `contact_integration_disconnect` |

## Connect with a key

```bash
curl -sS -X POST https://api.linkbreakers.com/v1/integrations/contacts/CONTACT_TOOL_BREVO/connect \
  -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "xkeysib-...", "account": ""}'
```

The key is checked against the tool before it is stored. Calling connect again replaces it. `account` is empty for the tools that need none.

## Connect by signing in (Salesforce, Zoho CRM)

1. Salesforce only: an admin installs the Linkbreakers package in the org once (`installUrl`, or `sandboxInstallUrl` for a sandbox, from the tool info). Give the person that link first if it may not be installed.
2. `POST /v1/integrations/contacts/CONTACT_TOOL_SALESFORCE/oauth/start` with `{"environment": "CONTACT_OAUTH_ENVIRONMENT_PRODUCTION"}` (or `..._SANDBOX` for a Salesforce sandbox; Zoho CRM is production only and finds its data center by itself).
3. Give the person the returned `signInUrl` to open. It works once, for 15 minutes, for the member who started it. When they sign in they come back to Linkbreakers and the connection is finished there. Call `oauth/complete` only with a `code` and `state` the person pasted.

## Choose what is synced

```bash
curl -sS -X PATCH https://api.linkbreakers.com/v1/integrations/contacts/CONTACT_TOOL_HUBSPOT \
  -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contactListId": "123",
    "options": {
      "fieldMappings": [{"toolField": "company", "attributeKey": "company_name"}],
      "tags": ["qr-{link}"],
      "consentAttributeKey": "newsletter_optin",
      "listRequiresConsent": true,
      "recordKind": "CONTACT_RECORD_KIND_DEAL",
      "pipelineId": "default",
      "stageId": "appointmentscheduled",
      "recordTitle": "{name} from {link}"
    }
  }'
```

- `contactListId`: from `lists`; empty string for none, leave it out to keep the current one.
- `options` replaces every option at once: read the connection first and send all of them back with your change.
  - `fieldMappings` sends a visitor answer to a tool field named differently (field keys from `fields`). An answer whose key already is a field of the tool goes there without a mapping.
  - `tags`, where the tool has tags. `{link}` stands for the link's name.
  - `consentAttributeKey` is the visitor attribute holding marketing consent, usually a form checkbox. Empty: nobody is subscribed to marketing. Yes answers: `true`, `yes`, `1`, `on`, `accepted`, `agree`, `oui`, `si`, `ja`. A visitor who unsubscribed in the tool is never re-subscribed.
  - `listRequiresConsent` adds to the list only visitors who consented. Mailchimp keeps every contact in an audience, so there a visitor who did not consent is not synced at all.
  - `doubleOptIn` subscribes through the tool's confirmation email, where it has one.
  - CRMs: `recordKind` (`CONTACT_RECORD_KIND_CONTACT_ONLY`, `..._LEAD`, `..._DEAL`); for a deal `pipelineId` and `stageId` from `pipelines`; `recordTitle` with `{link}` and `{name}`. A visitor synced again updates the same contact and deal.
- `delivery`: where, when and what, the same setting as webhooks. By default every link, every step, all visitor data. Narrow it with `linkIds`, `directoryIds`, `tagIds` (all empty means every link), `moments` (`KIND_ENTRY`, `KIND_INTERACTION`, `KIND_CONDITION`, `KIND_EXIT`) or `stepIds`, and `visitorData` (`INTEGRATION_VISITOR_DATA_ALL`, `..._SELECTED` with `visitorAttributeKeys`, `..._NONE`). Sending `delivery` replaces it whole: read it first, and keep at least one moment or one step.

## Check it works

- `POST .../{tool}/test` checks the credential and lists the custom field keys, writing nothing.
- `GET /v1/integrations/contacts` shows `contactsSynced`, `lastSyncedAt` and `lastError` per tool. A credential revoked in the tool shows up as `lastError`.
- Only identified visitors are synced. A visitor known only by a phone number is skipped by the tools that key contacts on email.

## Pitfalls

- Never ask the user to paste a key into a chat they do not control; with the MCP server, they can connect in the dashboard instead.
- Do not set `consentAttributeKey` to an attribute that is not a real consent answer: subscribing people to marketing needs their consent.
- Disconnecting stops the sync and deletes the stored credential; contacts already in the tool stay there.
- For any other destination (a database, Slack, your own backend), use webhooks (`send-leads-to-webhooks` skill).

Docs: https://linkbreakers.com/help/article/linkbreakers-hubspot-integration-qr-lead-capture-and-crm-sync, https://linkbreakers.com/help/article/set-up-linkbreakers-integrations-with-an-ai-agent-mcp

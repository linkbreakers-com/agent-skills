---
name: build-lead-capture-workflow
description: Turn a Linkbreakers link or QR code into a lead capture flow by adding workflow steps (forms, conditions, multi-link pages, message pages, thank you pages, contact cards, redirects, opening a PDF, image or video) and wiring their branches. Use when the user wants to collect emails, phone numbers or answers from people who scan a QR code, qualify visitors, route them by country, device or previous answers, or gate content behind a form or password.
license: MIT
metadata:
  author: linkbreakers
  version: "1.4"
---

# Build a lead capture workflow

Each link runs a **workflow**: a graph of steps a visitor walks through after scanning. A new link already has two steps, connected:

`EVENT_ACTION_LINK_VISIT` (entry, `KIND_ENTRY`) -> `EVENT_ACTION_CLIENT_REDIRECT` (exit, `KIND_EXIT`, redirects to the destination)

You capture leads by inserting steps between them. Anything a visitor submits lands on their **visitor** profile (see `read-visitors-and-leads`).

## Tools

| Action | REST | MCP tool |
| --- | --- | --- |
| List steps | `GET /v1/links/{linkId}/workflow-steps` | `workflow_steps_list` |
| Read one step (with its `branches`) | `GET /v1/links/{linkId}/workflow-steps/{id}` | `workflow_steps_get` |
| Create a step | `POST /v1/links/{linkId}/workflow-steps` | `workflow_steps_create` |
| Update a step | `PATCH /v1/links/{linkId}/workflow-steps/{id}` | `workflow_steps_update` |
| Connect a branch | `PUT /v1/links/{linkId}/workflow-steps/{stepId}/branches/{branchId}/connection` with `{"nextStepId": "..."}` | `workflow_steps_connect` |
| Clear a branch | `DELETE .../branches/{branchId}/connection` | `workflow_steps_disconnect` |
| Delete a step | `DELETE /v1/links/{linkId}/workflow-steps/{id}` | `workflow_steps_delete` |
| Validate the graph | `GET /v1/links/{linkId}/workflow-steps/validate` | `workflow_steps_validate` |
| Tidy the canvas | `POST /v1/links/{linkId}/workflow-steps/auto-layout` | `workflow_steps_auto_layout` |

All REST calls use `Authorization: Bearer <workspace token>` against `https://api.linkbreakers.com`.

## Step types (`eventAction`)

- Interaction, one branch `next`: `EVENT_ACTION_FORM_SUBMIT` (payload `form`), `EVENT_ACTION_PASSWORD_VERIFY` (`password`), `EVENT_ACTION_MESSAGE_PAGE` (`messagePage`, one button or a timer).
- Composite, one branch per button/option/range plus `else` on conditions: `EVENT_ACTION_MULTI_LINK` (`multiLink`, each button continues into more workflow), `EVENT_ACTION_COUNTRY_CONDITION`, `EVENT_ACTION_VISIT_TYPE_CONDITION` (first vs returning), `EVENT_ACTION_DEVICE_TYPE_CONDITION`, `EVENT_ACTION_DEVICE_PLATFORM_CONDITION`, `EVENT_ACTION_DEVICE_BROWSER_CONDITION`, `EVENT_ACTION_DEVICE_BRAND_CONDITION`, `EVENT_ACTION_DEVICE_ACTOR_CONDITION`, `EVENT_ACTION_DAY_OF_WEEK_CONDITION`, `EVENT_ACTION_TIME_OF_DAY_CONDITION`, `EVENT_ACTION_DAY_OF_MONTH_CONDITION`, `EVENT_ACTION_SPECIFIC_DATE_CONDITION`, `EVENT_ACTION_VISITOR_DATA_CONDITION` (route on profile data already captured).
- Composite with no `else`, one branch per variant: `EVENT_ACTION_TRAFFIC_SPLIT` (`trafficSplit`), an A/B test. See "Traffic split" below.
- Exit, no branches:
  - `EVENT_ACTION_CLIENT_REDIRECT` (`clientRedirect`).
  - `EVENT_ACTION_THANK_YOU_PAGE` (`thankYouPage`, `title` required).
  - `EVENT_ACTION_CONTACT_CARD` (`vcard`). Set `phoneSmsEnabled: true` to add a "Send a text" action next to the phone number. `saveButtonEnabled` shows the "Add to contacts" button; it defaults to true.
  - `EVENT_ACTION_SOCIAL_LINKS_PAGE` (`socialLinks`, buttons that leave for external URLs).
  - `EVENT_ACTION_OPEN_MEDIA` (`openMedia: {"mediaId": "..."}`). Opens a PDF, an image (PNG, JPEG, WebP, SVG) or an MP4 video from the workspace's media library, and the file URL is signed at scan time. The media must already be in the library (see "Opening a file" below).

The payload key matches the step type: a form step sends `{"payload": {"form": {...}}}`. Read the exact payload schemas in the OpenAPI spec under `WorkflowStepPayload`.

## Recipe: email capture before the redirect

1. Create or fetch the link. Note the exit step id from `workflowSteps` in the create response, or from `GET /v1/links/{linkId}/workflow-steps` (the step with `kind: KIND_EXIT`).

2. Insert a form **in front of the exit step** with `insertBefore`. Every branch that led to the exit now leads to the form, and the form's `next` branch leads to the exit, so no manual connecting is needed:

   ```bash
   curl -sS -X POST "https://api.linkbreakers.com/v1/links/$LINK_ID/workflow-steps" \
     -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "eventAction": "EVENT_ACTION_FORM_SUBMIT",
       "insertBefore": "'"$EXIT_STEP_ID"'",
       "payload": {
         "form": {
           "formTitle": "Get the full menu by email",
           "submitButtonText": "Send it",
           "autoSkipIfKnown": true,
           "formFields": [
             {"key": "$email", "label": "Email", "type": "FORM_FIELD_TYPE_EMAIL", "required": true, "order": 0},
             {"key": "$firstName", "label": "First name", "type": "FORM_FIELD_TYPE_TEXT", "order": 1},
             {"key": "visit_reason", "label": "What brings you in?", "type": "FORM_FIELD_TYPE_RADIO", "order": 2,
              "options": [{"value": "lunch", "label": "Lunch"}, {"value": "event", "label": "Private event"}]}
           ]
         }
       }
     }'
   ```

   Field `key` decides where the answer is stored: `$email`, `$phone`, `$firstName`, `$lastName` are the reserved identity fields; any other key (letters, digits, `_`, `-`, `.`) becomes a custom visitor attribute. Field types: `FORM_FIELD_TYPE_TEXT`, `_EMAIL`, `_PHONE`, `_TEXTAREA`, `_RADIO`, `_CHECKBOX`, `_DROPDOWN`, `_NUMBER`, `_DATE`, `_RATING`.

3. Optionally swap the redirect exit for a thank you page: create an `EVENT_ACTION_THANK_YOU_PAGE` step, connect the form's `next` branch to it, then delete the old redirect step.

4. **Validate**: `GET /v1/links/{linkId}/workflow-steps/validate`. Fix every returned `issues[]` entry (each names a `stepId` and `message`) before telling the user it is done. Then call auto-layout so the dashboard canvas is readable.

## Branching (composite steps)

1. Create the composite step (for example a country condition or a multi-link page).
2. Read it back (`workflow_steps_get`) and look at `branches[]`: each has a `branchId`, a `label` and the current `nextStepId` (empty when unconnected).
3. Connect **every** branch, including `else` on conditions, with `PUT .../branches/{branchId}/connection` and `{"nextStepId": "<target step id>"}`. Connecting is idempotent.
4. Validate. Unconnected branches show up as issues.

## Traffic split (A/B test)

`EVENT_ACTION_TRAFFIC_SPLIT` sends each visitor to one of 2 to 20 variants by percentage, with no page in between. Create it with `variants` (`label`, `weight` in whole percent) summing to exactly 100, and leave each variant's `id` out: the server generates it once. Read `branches[]` for the ids and connect each one. There is no `else`; an unconnected variant goes to the link's fallback destination. On later updates, send each variant back with its `id` and `nextStepId`. With `workflow_steps_bulk_insert`, set your own short ids such as `a` and `b`, so its branches can name them.

```json
{"trafficSplit": {"variants": [{"label": "Short form", "weight": 50}, {"label": "Long form", "weight": 50}]}}
```

- **Sticky is the default.** Leave `sticky` out: a returning visitor keeps the same variant on every visit, computed from the step and the device with nothing stored. It follows the device cookie, so a new device, private browsing or some in-app browsers count as a new visitor. For an A/B test it should stay on.
- **`sticky: false` assigns every visit afresh**, from the visit's event id, so one person can see several variants while one visit stays on its variant through a form. Set it only when the user asks to share or rotate traffic.
- **Percentages are approximate at low traffic:** on a 50/50, about plus or minus 10 points at 100 visitors, 3 at 1,000, 1 at 10,000.
- **Changing weights only moves visitors near the boundaries you changed:** 90/10 to 80/20 only moves visitors from the first variant to the second. Keep the variant order. On an update, leaving `sticky` out keeps its current setting.
- **To end a test,** set the weights to 100 and 0.
- **To target a test,** place a condition before the split, not inside it.
- **Results:** `analytics_traffic_split_results` (`POST /v1/analytics/traffic-split` with `linkId` and `stepId`) gives visits and visitors per variant with bots and link previews left out, `enoughData` (100 per variant), and `sampleRatioMismatch`. With sticky off, read the numbers as visits. It counts arrivals, not outcomes, and never names a winner; do not name one either.

## Back buttons ("Back to menu")

Page steps can show a secondary button that returns the visitor to the previous page, exactly like the browser's back button. Use it on sub-pages reached from a multi-link menu instead of wiring a connection back to the menu. The page steps are message page, multi-link, contact card, social links, form, password and thank you page. `rendersPage: true` on a step tells you it is one.

`backButton` is a top-level field of the create or update request, not part of `payload`:

```json
{"backButton": {"enabled": true, "label": "Back to menu"}}
```

The label is up to 40 characters and defaults to "Back". The button hides itself when there is no previous page, such as on the first page right after a scan.

## Opening a file (PDF, image, video)

1. Get the file into the media library. Use `media_list` (filter by kind) for one already there, `media_import` (`POST /v1/media:import`) to fetch it from an https URL, `media_create` (`POST /v1/media`, base64, up to 3 MB), or a direct upload for larger files (`media_upload_create`, PUT the bytes, `media_upload_complete`). Limits: images 10 MB, PDFs 25 MB, MP4 videos 50 MB, all within the workspace's storage allowance. A workspace holds each file once: a file already in the library fails with HTTP 409 `MEDIA_ALREADY_EXISTS` and names it in `metadata.existingMediaId`, so use that id as the `mediaId`. A direct upload can declare `sha256` (hex) to be refused before any bytes travel.
2. Create an `EVENT_ACTION_OPEN_MEDIA` step with its `mediaId` and connect a branch to it, or for a link that only opens the file use `POST /v1/links/open-media` (MCP `links_create_open_media`).
3. For several files, build a multi-link menu with one button per file, each connected to its own Open media step.
4. Swap the file later by updating the step's `mediaId`, or replace the media's file in place (`media_replace_import` from an https URL, or `media_replace_upload_create`, PUT, `media_replace_upload_complete`) so every step and page theme using that media follows. The link and the printed QR code stay the same. A replacement every use cannot take fails with `MEDIA_REPLACE_NOT_ALLOWED`, listing each refusing use and why in its message and in `metadata.refusals`.

## Saving data without a form

Any step can write attributes to the visitor through `attributeCapture`:

```json
"attributeCapture": {
  "enabled": true,
  "writes": [
    {"key": "interested_in", "value": "{{choice.label}}", "type": "VISITOR_ATTRIBUTE_TYPE_STRING", "mode": "ATTRIBUTE_WRITE_MODE_SET"},
    {"key": "first_seen_at_event", "value": "{{link.metadata.event}}", "mode": "ATTRIBUTE_WRITE_MODE_SET_ONCE"}
  ]
}
```

Templates: `{{now}}`, `{{link.name}}`, `{{link.metadata.<key>}}`, and on multi-link steps `{{choice.label}}` / `{{choice.id}}`. Up to 20 writes per step.

## Pitfalls

- Never leave a branch unconnected; always finish with validate.
- Exit steps end the journey. Do not try to connect anything out of them.
- For a "Back to menu" button, prefer `backButton` on the sub-page. Connect a branch back to the menu only when the page must always lead there or the click must be recorded as a journey step.
- A media item still used by an Open media step cannot be deleted. Point the step at other media first.
- Do not invent step ids. Use the ids returned by create/list calls.
- To push captured leads somewhere else, add a webhook (`send-leads-to-webhooks` skill).

Docs: https://linkbreakers.com/help/article/what-is-a-workflow-in-linkbreakers-and-how-it-powers-automation, https://linkbreakers.com/help/article/how-to-create-a-form

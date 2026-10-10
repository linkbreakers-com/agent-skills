---
name: build-lead-capture-workflow
description: Turn a Linkbreakers link or QR code into a lead capture flow by adding workflow steps (forms, conditions, multi-link pages, message pages, thank you pages, redirects) and wiring their branches. Use when the user wants to collect emails, phone numbers or answers from people who scan a QR code, qualify visitors, route them by country, device or previous answers, or gate content behind a form or password.
license: MIT
metadata:
  author: linkbreakers
  version: "1.0"
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
- Exit, no branches: `EVENT_ACTION_CLIENT_REDIRECT` (`clientRedirect`), `EVENT_ACTION_THANK_YOU_PAGE` (`thankYouPage`, `title` required), `EVENT_ACTION_CONTACT_CARD` (`vcard`), `EVENT_ACTION_SOCIAL_LINKS_PAGE` (`socialLinks`, buttons that leave for external URLs).

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
- Do not invent step ids. Use the ids returned by create/list calls.
- To push captured leads somewhere else, add a webhook (`send-leads-to-webhooks` skill).

Docs: https://linkbreakers.com/help/article/what-is-a-workflow-in-linkbreakers-and-how-it-powers-automation, https://linkbreakers.com/help/article/how-to-create-a-form

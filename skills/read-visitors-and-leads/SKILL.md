---
name: read-visitors-and-leads
description: Read, filter, sort and export the leads (visitors) a Linkbreakers workspace has captured from QR code scans and forms, including their custom attributes, scan history and journey through a workflow. Use when the user asks who scanned a QR code, wants a list or CSV of leads, wants leads filtered by answers such as budget or interest, wants a lead's full history, or wants funnel and drop-off numbers for a link.
license: MIT
metadata:
  author: linkbreakers
  version: "1.0"
---

# Read visitors and leads

A **visitor** is a person resolved across scans and devices. Anonymous at first scan, identified once they give an email or phone (form step, `attributeCapture`, or the identify API). Each visitor has reserved fields (`email`, `phone`, `firstName`, `lastName`), free-form typed `attributes`, and counters (`visitCount`, `deviceCount`, `qrcodeCount`).

All REST calls: `https://api.linkbreakers.com`, header `Authorization: Bearer <workspace token>`.

## 1. Discover what was captured

Before filtering, list the attribute keys and their types:

- REST: `GET /v1/visitors/attributes` (optional `?linkId=<uuid>` to scope to one QR code)
- MCP: `visitors_list_attribute_keys`

The response `attributes[]` gives `key` and `type` (`VISITOR_ATTRIBUTE_TYPE_STRING`, `_NUMBER`, `_BOOLEAN`, `_DATE`, `_ENUM`). Pick filter operators that fit the type.

## 2. List visitors

- REST: `GET /v1/visitors` with `pageSize` (default 50, max 200), `pageToken`, `email`, `search`, `linkId`, `sortField`, `sortDirection`, `responseFormat`.
- MCP: `visitors_list`
- CLI: `linkbreakers visitors list --page-size 50 --link-id <uuid>`

Response: `json.visitors[]`, `json.totalCount`, `json.hasMore`, `json.nextPageToken`. Keep requesting with `pageToken=<nextPageToken>` while `hasMore` is true.

Sort with `sortField`: `VISITOR_SORT_FIELD_CREATED_AT` (default), `VISITOR_SORT_FIELD_VISIT_COUNT`, `VISITOR_SORT_FIELD_DEVICE_COUNT`, `VISITOR_SORT_FIELD_QRCODE_COUNT`, and `sortDirection`: `SORT_DIRECTION_ASC` / `SORT_DIRECTION_DESC`. Use this for "most engaged visitors" questions instead of paging through everything.

## 3. Filter on captured answers

Attribute filters do not fit in a query string, so over REST use `POST /v1/visitors/search` with the same parameters as a JSON body (MCP `visitors_list` accepts `attributeFilters` directly):

```bash
curl -sS -X POST https://api.linkbreakers.com/v1/visitors/search \
  -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "linkId": "'"$LINK_ID"'",
    "pageSize": 100,
    "attributeFilters": [
      {"key": "budget", "operator": "VISITOR_ATTRIBUTE_FILTER_OPERATOR_NUMBER_GREATER_OR_EQUAL", "value": "800000"},
      {"key": "$email", "operator": "VISITOR_ATTRIBUTE_FILTER_OPERATOR_EXISTS"}
    ]
  }'
```

Every filter must match (AND), at most 20. Operator families: `STRING_*` (EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS, STARTS_WITH, ENDS_WITH, IS_EMPTY, IS_NOT_EMPTY), `NUMBER_*` (EQUALS, NOT_EQUALS, GREATER_THAN, LESS_THAN, GREATER_OR_EQUAL, LESS_OR_EQUAL), `DATE_*` (EQUALS, BEFORE, AFTER, BEFORE_OR_EQUAL, AFTER_OR_EQUAL, value like `2026-03-01`), `BOOLEAN_IS_TRUE`, `BOOLEAN_IS_FALSE`, `EXISTS`, `NOT_EXISTS`. All are prefixed `VISITOR_ATTRIBUTE_FILTER_OPERATOR_`. Reserved fields (`$email`, `$phone`, `$firstName`, `$lastName`) support the `STRING_*`, `EXISTS` and `NOT_EXISTS` operators.

## 4. Export as CSV

Add `"responseFormat": "RESPONSE_FORMAT_CSV"` (or `?responseFormat=RESPONSE_FORMAT_CSV`). The CSV text comes back in `csv.csvData`.

## 5. One lead in depth

- REST: `GET /v1/visitors/{id}?include=devices&include=events&include=links`
- MCP: `visitors_get`

## 6. Scan timeline and journeys

- REST: `GET /v1/events` with `linkId`, `visitorId`, `startDate`, `endDate`, `pageSize` (max 1000), `include` (`visitor`, `device`, `link`, `workspace`, `journey`).
- MCP: `events_list`

With `include=journey`, each event carries `journey.completed`, `journey.stepsReached`, `journey.stepsTotal`: how far that visit got through the workflow. Free plans only see the last 2 weeks of events; light plans the last 3 months.

## 7. Funnel and totals

- Step funnel for a link (distinct visitors per step, conversion and drop-off): `POST /v1/analytics/funnel` with `{"linkId": "...", "startDate": "...", "endDate": "..."}`. MCP: `analytics_step_funnel`.
- Workspace totals: `GET /v1/metrics/workspace`. MCP: `metrics_workspace`.

## Pitfalls

- Visitors are personal data. Only pull what the user asked for and do not paste full lead lists into places the user did not choose.
- Attribute values always come back as the raw string in `value`; typed copies (`numberValue`, `boolValue`, `dateValue`) are set only when the value parses.
- For real-time delivery instead of polling, use webhooks (`send-leads-to-webhooks` skill).

Docs: https://linkbreakers.com/help/article/what-is-a-visitor-in-qr-analytics-and-why-it-matters

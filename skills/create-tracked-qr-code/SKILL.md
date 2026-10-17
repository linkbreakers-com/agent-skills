---
name: create-tracked-qr-code
description: Create a Linkbreakers link with a dynamic, tracked QR code and get the QR image URL, short URL, and scan counts back. Use when the user wants a QR code for a flyer, sign, product, booth, table tent or business card, wants a QR code that opens a PDF menu, brochure, image or video, wants to shorten a URL with scan tracking, or wants to change where an existing QR code points without reprinting it.
license: MIT
metadata:
  author: linkbreakers
  version: "1.1"
---

# Create a tracked QR code

Every QR code in Linkbreakers belongs to a **link**. The link owns the destination, the workflow that runs on each scan, and the analytics. The QR code encodes the link's short URL (`entrypoint`), so the destination can change later without reprinting.

## Before you start

- Auth: a workspace API token (secret key) sent as `Authorization: Bearer <token>`. Users create one at https://app.linkbreakers.com/workspace/dashboard/api-tokens.
- Base URL: `https://api.linkbreakers.com`
- Pick one surface: MCP tool `links_create` (if the Linkbreakers MCP server is connected), the CLI (`linkbreakers links create`), an SDK (`LinksApi.linksServiceCreate`), or raw REST. They all call the same endpoint.

## Steps

1. **Create the link** with `POST /v1/links`. Only `destination` is required.

   ```bash
   curl -sS https://api.linkbreakers.com/v1/links \
     -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "destination": "https://example.com/spring-menu",
       "name": "Spring menu table tent",
       "tags": ["spring-2026", "table-tent"],
       "metadata": {"location": "paris-11"},
       "waitForQrcode": true
     }'
   ```

   Useful optional fields on `CreateLinkRequest`:
   - `shortlink`: custom slug. Check it first with `GET /v1/links/shortlink-availability`.
   - `customDomainId`: serve the link from a verified custom domain (see the `manage-custom-domains` skill).
   - `qrcodeTemplateId` or `qrcodeDesignId`: style the QR code.
   - `fallbackDestination`, `expiresAt`, `expiredDestination`, `directoryId`.
   - `metadata`: string key/value pairs only, max 50 keys.
   - `waitForQrcode: true`: block until the QR image is generated so the response already carries `qrcodeSignedUrl`.

2. **Read the response** (`CreateLinkResponse`):
   - `link.id`: keep it, every follow-up call needs it.
   - `link.entrypoint`: the short URL the QR code encodes.
   - `link.qrcodeSignedUrl`: the QR image. It is a **signed URL that expires**; never store it as a permanent asset URL.
   - `workflowSteps`: the entry step (`EVENT_ACTION_LINK_VISIT`) and the default exit step created with every link. Use these to add a lead capture form (see `build-lead-capture-workflow`).

3. **Get a fresh QR image later** with `GET /v1/links/{id}?include=qrcodeSignedUrl` or, for many links at once, `POST /v1/links/qrcode-images:resolve`.

4. **Change where it points** without reprinting. The destination lives on the link's `EVENT_ACTION_CLIENT_REDIRECT` exit step, not on the link itself (`PATCH /v1/links/{id}` has no `destination` field). Find the step with `GET /v1/links/{linkId}/workflow-steps` (MCP `workflow_steps_list`), then:

   ```bash
   curl -sS -X PATCH "https://api.linkbreakers.com/v1/links/$LINK_ID/workflow-steps/$REDIRECT_STEP_ID" \
     -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"payload": {"clientRedirect": {"destination": "https://example.com/summer-menu"}}}'
   ```

   MCP: `workflow_steps_update`. Name, tags, expiry and fallback live on the link: `PATCH /v1/links/{id}` (MCP `links_update`).

5. **Check scans**: `link.eventCount` on `GET /v1/links/{id}` (refreshes within seconds), or `GET /v1/events?linkId=<id>` for the scan timeline (MCP `events_list`).

## Equivalent calls

- MCP: `links_create` with `{"destination": "...", "name": "...", "waitForQrcode": true}`
- CLI: `linkbreakers links create --destination https://example.com/spring-menu --name "Spring menu" --tags spring-2026 --wait-for-qrcode`
- TypeScript SDK (`npm install linkbreakers`):

  ```ts
  import { Configuration, LinksApi } from 'linkbreakers';

  const links = new LinksApi(new Configuration({
    accessToken: process.env.LINKBREAKERS_TOKEN,
    basePath: 'https://api.linkbreakers.com',
  }));
  const { link } = await links.linksServiceCreate({
    createLinkRequest: { destination: 'https://example.com/spring-menu', waitForQrcode: true },
  });
  ```

## Variants

- Many QR codes at once (one per table, per store, per product): `POST /v1/links/bulk` with `{"links": [CreateLinkRequest, ...]}` (MCP `links_create_bulk`).
- Digital business card that downloads a vCard: `POST /v1/links/contact` (MCP `links_create_contact`).
- Link that ends on a thank you page instead of a redirect: `POST /v1/links/thank-you` with a required `title` (MCP `links_create_thank_you`).
- Apply a community QR style: `POST /v1/qrcode-designs/apply-template` (MCP `qrcodedesigns_apply_template`); browse styles with `GET /v1/public/qrcode-templates`.

### QR code that opens a PDF, image or video

The file lives in the workspace's media library, and the link's exit step opens it. No destination URL is needed.

1. Put the file in the media library and keep its `id`. Pick the first option that fits:
   - The file is at a public https URL: `POST /v1/media:import` (MCP `media_import`). The server fetches it.
   - The file is local and at most 3 MB: `POST /v1/media` with base64 `fileData` and `fileName` (MCP `media_create`).
   - The file is larger: `POST /v1/media/uploads` with `fileName`, `mimeType` and the exact `size` (MCP `media_upload_create`). PUT the bytes to the returned `uploadUrl` with its `uploadHeaders`, then call `POST /v1/media/{id}:complete` (MCP `media_upload_complete`).
   - The file is already uploaded: find it with `GET /v1/media` (MCP `media_list`).

   Limits: images (PNG, JPEG, WebP, SVG) up to 10 MB, PDFs up to 25 MB, MP4 videos up to 50 MB. Every upload also counts toward the workspace's storage allowance: Free 25 MB, Light 500 MB, Pro 10 GB, custom on Enterprise.

2. Create the link: `POST /v1/links/open-media` with `{"mediaId": "<id>", "name": "Spring menu", "waitForQrcode": true}` (MCP `links_create_open_media`). It takes the same optional fields as `CreateLinkRequest`. Its exit step is an `EVENT_ACTION_OPEN_MEDIA` step, and the file URL is signed at scan time, so the QR code never goes stale.

3. To swap the file later without reprinting, update the Open media step's `mediaId` with `PATCH /v1/links/{linkId}/workflow-steps/{stepId}` and `{"payload": {"openMedia": {"mediaId": "<new id>"}}}` (MCP `workflow_steps_update`).

For several files behind one QR code, use a multi-link menu whose buttons each lead to an Open media step (see `build-lead-capture-workflow`).

### QR code logo from the media library

Upload or import the logo as above. Then set it on the link's QR code design with `PATCH /v1/qrcode-designs/{id}` and `{"centralImageMediaId": "<media id>"}` (MCP `qrcodedesigns_update` with `central_image_media_id`). The logo must be an image of at most 3 MB; anything else fails with `MEDIA_NOT_ALLOWED_HERE`. The design keeps its own copy, so deleting the media later does not remove the logo.

## Pitfalls

- Use the token as a Bearer token. In SDKs set `accessToken` (TypeScript) or `access_token` (Python), not `apiKey`.
- Do not hardcode `qrcodeSignedUrl` into a page or email. Re-resolve it when you render.
- Do not delete a media item that an Open media step uses: the delete is refused until the step points at other media.
- A plain redirect link already tracks scans, but to know **who** scanned, add a form step. That is the `build-lead-capture-workflow` skill.

Reference: OpenAPI https://api.linkbreakers.com/internal/openapi/api/v1/api.swagger.json, docs https://linkbreakers.com/help/api

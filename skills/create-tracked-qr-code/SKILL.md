---
name: create-tracked-qr-code
description: Create a Linkbreakers link with a dynamic, tracked QR code and get the QR image URL, short URL, and scan counts back. Use when the user wants a QR code for a flyer, sign, product, booth, table tent or business card, wants a QR code that opens a PDF menu, brochure, image or video, wants to shorten a URL with scan tracking, wants one link behind many printed codes that each carry their own value (serial number, table, room, batch, GS1 Digital Link), or wants to change where an existing QR code points without reprinting it.
license: MIT
metadata:
  author: linkbreakers
  version: "1.4"
---

# Create a tracked QR code

Every QR code in Linkbreakers belongs to a **link**. The link owns the destination, the workflow that runs on each scan, and the analytics. The QR code encodes the link's short URL (`entrypoint`), so the destination can change later without reprinting.

## Before you start

- Auth: a workspace API token (secret key) sent as `Authorization: Bearer <token>`. Users with an account create one at https://app.linkbreakers.com/workspace/dashboard/api-tokens. With no account, `npx -y linkbreakers-cli signup --email <their email>` creates a workspace and saves its token in one step (see the use-linkbreakers-cli skill).
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
   - `shortlink`: custom slug, one or several segments (`menu/lunch`). Check it first with `GET /v1/links/shortlink-availability`. On a custom domain it can be dynamic, see "One link for many printed codes" below.
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

- Many QR codes at once (one per table, per store, per product): `POST /v1/links/bulk` with `{"links": [CreateLinkRequest, ...]}` (MCP `links_create_bulk`). When they all go to the same place and only an identifier differs, one dynamic link is simpler: see below.
- Digital business card that downloads a vCard: `POST /v1/links/contact` (MCP `links_create_contact`).
- Link that ends on a thank you page instead of a redirect: `POST /v1/links/thank-you` with a required `title` (MCP `links_create_thank_you`).
- Apply a community QR style: `POST /v1/qrcode-designs/apply-template` (MCP `qrcodedesigns_apply_template`); browse styles with `GET /v1/public/qrcode-templates`.

### One link for many printed codes (dynamic slug)

When every code should run the same flow and only an identifier differs (a serial number per item, a table, a room, a batch), create **one** link whose slug has variable segments instead of one link per code. It needs a verified custom domain (`customDomainId`, see `manage-custom-domains`).

```bash
curl -sS https://api.linkbreakers.com/v1/links \
  -H "Authorization: Bearer $LINKBREAKERS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "https://example.com/product",
    "name": "Product passport",
    "customDomainId": "<custom domain id>",
    "shortlink": "p/{serial}"
  }'
```

- `{serial}` matches any value in that segment: `https://go.example.com/p/A1B2C3` and `https://go.example.com/p/Z9` both open this link. Print one QR code per value, each encoding the full address with its value filled in.
- Each visit saves the value on the visitor as the attribute `serial` (`serial = A1B2C3`), visible on the visitor (`GET /v1/visitors/{id}`, MCP `visitors_get`) and usable from the first step: route on it with an `EVENT_ACTION_VISITOR_DATA_CONDITION` step (see `build-lead-capture-workflow`).
- GS1 Digital Link: `01/09506000134352/10/{batch}` answers every batch of that GTIN and saves `batch`.
- Rules: a variable fills a whole segment; its name starts with a lowercase letter, then lowercase letters, digits or underscores, up to 40 characters; each name appears once; the segment `steps` is reserved. A link with a fixed slug wins over a dynamic one for the same address.
- Errors: `DYNAMIC_SLUG_NEEDS_CUSTOM_DOMAIN` (no `customDomainId`), `DYNAMIC_SLUG_DUPLICATE_VARIABLE` (a name used twice), `DYNAMIC_SLUG_OVERLAPS` (another dynamic slug of the domain already matches the same addresses).
- The link's own QR code (`qrcodeSignedUrl`) encodes the slug with its `{serial}` placeholder, so generate the per-item codes from the filled addresses.

### QR code that opens a PDF, image or video

The file lives in the workspace's media library, and the link's exit step opens it. No destination URL is needed.

1. Put the file in the media library and keep its `id`. Pick the first option that fits:
   - The file is at a public https URL: `POST /v1/media:import` (MCP `media_import`). The server fetches it.
   - The file is local and at most 3 MB: `POST /v1/media` with base64 `fileData` and `fileName` (MCP `media_create`).
   - The file is larger: `POST /v1/media/uploads` with `fileName`, `mimeType` and the exact `size` (MCP `media_upload_create`). PUT the bytes to the returned `uploadUrl` with its `uploadHeaders`, then call `POST /v1/media/{id}:complete` (MCP `media_upload_complete`).
   - The file is already uploaded: find it with `GET /v1/media` (MCP `media_list`).
   - A workspace holds each file once. Any of these calls answers HTTP 409 `MEDIA_ALREADY_EXISTS` for a file already in the library, with the existing media in `metadata.existingMediaId` (and `metadata.existingFileName`). Use that id; it is not a failure. For a direct upload, pass the file's SHA-256 as `sha256` (hex) so the duplicate is refused before the PUT, and send every `uploadHeaders` entry on the PUT, `x-amz-checksum-sha256` included.

   Limits: images (PNG, JPEG, WebP, SVG) up to 10 MB, PDFs up to 25 MB, MP4 videos up to 50 MB. Every upload also counts toward the workspace's storage allowance: Free 25 MB, Light 500 MB, Pro 10 GB, custom on Enterprise.

2. Create the link: `POST /v1/links/open-media` with `{"mediaId": "<id>", "name": "Spring menu", "waitForQrcode": true}` (MCP `links_create_open_media`). It takes the same optional fields as `CreateLinkRequest`. Its exit step is an `EVENT_ACTION_OPEN_MEDIA` step, and the file URL is signed at scan time, so the QR code never goes stale.

3. To swap the file later without reprinting, either point the step at other media with `PATCH /v1/links/{linkId}/workflow-steps/{stepId}` and `{"payload": {"openMedia": {"mediaId": "<new id>"}}}` (MCP `workflow_steps_update`), or replace the media's own file so every link opening it follows: `POST /v1/media/{id}/replace:import` with `{"url": "https://..."}` (MCP `media_replace_import`), or for a local file `POST /v1/media/{id}/replace-uploads` with `fileName`, `mimeType`, `size` and `sha256`, a PUT of the bytes to `uploadUrl` with every `uploadHeaders` entry, then `POST /v1/media/{id}/replace-uploads/{replacementId}:complete` (MCP `media_replace_upload_create`, `media_replace_upload_complete`). A media item only Open media steps open may change kind, a PDF for an MP4 video.

For several files behind one QR code, use a multi-link menu whose buttons each lead to an Open media step (see `build-lead-capture-workflow`).

### QR code logo from the media library

Upload or import the logo as above. Then set it on the link's QR code design with `PATCH /v1/qrcode-designs/{id}` and `{"centralImageMediaId": "<media id>"}` (MCP `qrcodedesigns_update` with `central_image_media_id`). The logo must be an image of at most 3 MB; anything else fails with `MEDIA_NOT_ALLOWED_HERE`. The design keeps its own copy, so deleting the media later does not remove the logo, and replacing the media's file does not change the QR code either: the design keeps its current logo and is detached from the media. To change the logo, set `centralImageMediaId` again.

## Pitfalls

- Use the token as a Bearer token. In SDKs set `accessToken` (TypeScript) or `access_token` (Python), not `apiKey`.
- Do not hardcode `qrcodeSignedUrl` into a page or email. Re-resolve it when you render.
- Do not delete a media item that an Open media step uses: the delete is refused until the step points at other media.
- A plain redirect link already tracks scans, but to know **who** scanned, add a form step. That is the `build-lead-capture-workflow` skill.

Reference: OpenAPI https://api.linkbreakers.com/internal/openapi/api/v1/api.swagger.json, docs https://linkbreakers.com/help/api

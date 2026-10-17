---
name: connect-linkbreakers-mcp
description: Connect an AI assistant (Claude, Claude Code, Cursor, VS Code, Continue or any MCP client) to the hosted Linkbreakers MCP server at https://mcp.linkbreakers.com with OAuth sign-in, then pick the right MCP tools for links, QR codes, workflows, media, visitors, domains and analytics. Use when the user wants their assistant to operate their Linkbreakers workspace directly, asks for the Linkbreakers MCP URL or config, or the MCP connection is failing.
license: MIT
metadata:
  author: linkbreakers
  version: "1.2"
---

# Connect the Linkbreakers MCP server

- Product MCP server: `https://mcp.linkbreakers.com` (Streamable HTTP, OAuth 2.1). It acts on the signed-in user's workspace.
- Docs MCP server: `https://linkbreakers.com/mcp` (Streamable HTTP, no auth). Read-only access to the help center and developer docs.

No API token is needed for the product server: the client opens a browser, the user signs in to Linkbreakers, and tokens are issued and refreshed automatically. Never ask the user to paste a workspace token into an MCP config.

## Client setup

Claude Code:

```bash
claude mcp add --transport http linkbreakers https://mcp.linkbreakers.com
```

Then restart Claude Code; the browser opens for sign-in on first use. This repository is also a Claude Code plugin that bundles the server and these skills:

```
/plugin marketplace add linkbreakers-com/agent-skills
/plugin install linkbreakers@linkbreakers
```

Claude (web and desktop): Settings, Connectors, Add custom connector. Name `linkbreakers`, URL `https://mcp.linkbreakers.com`. Save and sign in.

Cursor (`~/.cursor/mcp.json` or `.cursor/mcp.json`) and other clients that take a JSON config:

```json
{
  "mcpServers": {
    "linkbreakers": { "url": "https://mcp.linkbreakers.com" }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "linkbreakers": { "type": "http", "url": "https://mcp.linkbreakers.com" }
  }
}
```

Continue (`~/.continue/mcpServers/linkbreakers.yaml`):

```yaml
mcpServers:
  - name: linkbreakers
    transport:
      type: streamable-http
      url: https://mcp.linkbreakers.com
```

One-line installer for supported clients: `curl -fsSL https://mcp.linkbreakers.com/install.sh | bash`.

## Verify

Ask the assistant to "list my Linkbreakers links". It should call `links_list`. If no Linkbreakers tools appear, see Troubleshooting.

## Tool map

| Need | Tools |
| --- | --- |
| Links and QR codes | `links_create`, `links_create_bulk`, `links_bulk_create_async`, `links_create_contact`, `links_create_thank_you`, `links_create_open_media`, `links_get`, `links_list`, `links_update`, `links_delete` |
| Background jobs | `jobs_get` (poll a job such as `links_bulk_create_async` until it finishes) |
| Workflow steps | `workflow_steps_create`, `workflow_steps_get`, `workflow_steps_list`, `workflow_steps_update`, `workflow_steps_delete`, `workflow_steps_connect`, `workflow_steps_disconnect`, `workflow_steps_validate`, `workflow_steps_auto_layout`, `workflow_steps_resolve_collisions` |
| Visitors (leads) | `visitors_list`, `visitors_get`, `visitors_list_attribute_keys` |
| Events and analytics | `events_list`, `metrics_workspace`, `analytics_step_funnel`, `analytics_dashboards_list`, `analytics_dashboards_create`, `analytics_dashboards_update`, `analytics_dashboards_delete` |
| Custom domains | `domains_create`, `domains_get`, `domains_list`, `domains_check` |
| QR code styling | `qrcodedesigns_create`, `qrcodedesigns_update`, `qrcodedesigns_apply_template`, `qrtemplates_list`, `qrtemplates_get`, `qrtemplates_create`, `qrtemplates_update`, `qrtemplates_delete`, `qrtemplates_publish` |
| Page styling | `page_themes_list`, `page_themes_get`, `page_themes_update`, `page_themes_apply_template`, `pagethemetemplates_*`, `pagethemes_matching_template` |
| Media library (PDFs, images, MP4 videos) | `media_list`, `media_get`, `media_create`, `media_import`, `media_upload_create`, `media_upload_complete`, `media_delete` |
| Organisation | `directories_*`, `tags_list` |

The live list is whatever the server returns from `tools/list`; prefer it over this table if they differ. Anything not exposed as a tool (webhooks, workspace tokens, members) is available through the REST API.

Workflow tips: after creating steps, always run `workflow_steps_validate` and connect every branch reported as missing. See the `build-lead-capture-workflow` skill.

Media tips:
- Bring a file into the media library first, then reference it by id:
  - `media_import` fetches it from an https URL;
  - `media_create` takes it inline, base64, up to 3 MB;
  - larger files go through `media_upload_create`, a PUT of the bytes to the returned `upload_url`, then `media_upload_complete`.
- A workspace holds each file once. Uploading or importing bytes the library already has fails with HTTP 409 `MEDIA_ALREADY_EXISTS`; the error's `metadata.existingMediaId` and `metadata.existingFileName` name that media. Use that id and carry on; do not retry or upload the file again.
- Pass `sha256` (the file's SHA-256 as 64 hex characters) to `media_upload_create` when you can: a file already in the library is then refused before any bytes travel. Storage also refuses bytes that do not match it, so the PUT must send every header in `upload_headers`, `x-amz-checksum-sha256` included. Without `sha256` the duplicate is caught by `media_upload_complete` instead, and the upload is discarded.
- Limits by kind: images (PNG, JPEG, WebP, SVG) up to 10 MB, PDFs up to 25 MB, MP4 videos up to 50 MB. Every upload counts toward the workspace's storage allowance.
- A media item has a kind only. `uploaded_from` says where it was uploaded and is informational; `references` lists where it is used.
- Use media in these places:
  - `links_create_open_media` (or an `EVENT_ACTION_OPEN_MEDIA` step) opens any media when a visitor scans.
  - `qrcodedesigns_update` with `central_image_media_id` sets a QR code logo.
  - `page_themes_update` sets the background cover, badge or footer logo (`footer_logo_enabled` plus `footer_logo`).
- The QR code logo, background cover, badge and footer logo take an image of at most 3 MB; anything else fails with `MEDIA_NOT_ALLOWED_HERE`.
- `media_delete` refuses media an Open media step opens or a page theme shows (`MEDIA_IN_USE`, naming the links and templates): point those at other media first. A QR code keeps its own copy of its logo, so deleting a logo only clears the design's link to the media.
- `media_delete` is refused while an Open media step still uses the media.

## Troubleshooting

- 401 from `https://mcp.linkbreakers.com` without a browser prompt: the client does not support remote OAuth. Use a client that does, or use the REST API with a workspace token instead.
- Signed into the wrong workspace: remove the server, sign out of Linkbreakers in the browser, add it again.
- Session revoked or expired: remove and re-add the server to trigger a fresh sign-in.
- Some clients need a full restart after authenticating.

Discovery metadata: OAuth protected resource metadata is advertised in the `WWW-Authenticate` header of a 401 from the server. Full setup guide: https://linkbreakers.com/help/article/mcp-server-setup

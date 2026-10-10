# AGENTS.md

Instructions for AI coding agents integrating with Linkbreakers.

Linkbreakers is lead capture infrastructure for the physical world. Every QR code or link runs a **workflow** (forms, conditions, password gates, multi-link pages, contact cards, redirects) that turns an anonymous scan into an identified **visitor** carrying the attributes the business chose to collect. Leads leave through the REST API, webhooks, five SDKs, a CLI and an MCP server.

## Pick a surface

| You are | Use |
| --- | --- |
| An assistant acting for a user in their workspace | MCP server `https://mcp.linkbreakers.com` (OAuth, no token handling) |
| Writing application code | An SDK, or REST directly |
| Writing shell scripts or CI jobs | The `linkbreakers` CLI |
| Answering questions about the product | Docs MCP `https://linkbreakers.com/mcp` or `https://linkbreakers.com/llms.txt` |

All surfaces call the same API, so capabilities match.

## REST API

- Base URL: `https://api.linkbreakers.com` (all paths start with `/v1/`)
- OpenAPI 3 spec: https://api.linkbreakers.com/internal/openapi/api/v1/api.swagger.json
- Reference: https://linkbreakers.com/help/api
- Auth: `Authorization: Bearer <workspace token>`. Users create tokens at https://app.linkbreakers.com/workspace/dashboard/api-tokens. Secret keys (`WORKSPACE_TOKEN_KEY_TYPE_SECRET`) have full access and belong on servers only; publishable keys (`WORKSPACE_TOKEN_KEY_TYPE_PUBLISHABLE`) have limited access for browser use.
- JSON fields are camelCase. Enums are full prefixed strings (`EVENT_ACTION_FORM_SUBMIT`, `KIND_EXIT`).
- Lists paginate with `pageSize` and `pageToken`; follow `nextPageToken`.

Read the OpenAPI spec before calling an endpoint you have not used. Do not guess endpoints or fields.

## Core model

- **Link**: the core object. Owns the workflow, the analytics and the QR code. `entrypoint` is the short URL; `qrcodeSignedUrl` is an expiring image URL (re-resolve, never persist). The redirect destination lives on the link's `EVENT_ACTION_CLIENT_REDIRECT` workflow step, not on the link.
- **Workflow step**: a node in the link's graph. New links start with an entry step (`EVENT_ACTION_LINK_VISIT`) connected to a redirect exit step. Atomic steps have one branch `next`; composite steps have one branch per option plus `else`; exit steps have none. Connect with `PUT /v1/links/{linkId}/workflow-steps/{stepId}/branches/{branchId}/connection`, then always `GET .../workflow-steps/validate`.
- **Visitor**: a person resolved across scans. Reserved fields `$email`, `$phone`, `$firstName`, `$lastName`; any other key is a typed custom attribute.
- **Event**: one scan, with traces of the steps it went through and its journey progress.
- **Custom domain**: white-label hostname for links; must reach `STATUS_ACTIVE` before use.

## SDKs

| Language | Install | Package |
| --- | --- | --- |
| TypeScript / JavaScript | `npm install linkbreakers` | [npm `linkbreakers`](https://www.npmjs.com/package/linkbreakers) |
| Python | `pip install linkbreakers` | [PyPI `linkbreakers`](https://pypi.org/project/linkbreakers/) |
| Go | `go get github.com/linkbreakers-com/linkbreakers-go` | Go module |
| Java | Maven `com.linkbreakers:linkbreakers-sdk` | Maven Central |
| Rust | `cargo add linkbreakers` | [crates.io `linkbreakers`](https://crates.io/crates/linkbreakers) |

SDKs are generated from the OpenAPI spec; methods are named `<service>Service<Operation>` (for example `linksServiceCreate`, `visitorsServiceIdentify`). Pass the token as `accessToken` (TypeScript) or `access_token` (Python), not `apiKey`.

```ts
import { Configuration, LinksApi } from 'linkbreakers';

const links = new LinksApi(new Configuration({
  accessToken: process.env.LINKBREAKERS_TOKEN,
  basePath: 'https://api.linkbreakers.com',
}));
const { link, workflowSteps } = await links.linksServiceCreate({
  createLinkRequest: { destination: 'https://example.com', waitForQrcode: true },
});
```

## CLI

```bash
brew install linkbreakers-com/tap/linkbreakers
export LINKBREAKERS_TOKEN=...
linkbreakers links create --destination https://example.com --wait-for-qrcode
linkbreakers raw GET "/v1/visitors?pageSize=50"
```

`raw METHOD PATH` reaches any endpoint. Docs: https://linkbreakers.com/cli and https://github.com/linkbreakers-com/linkbreakers-cli

## MCP

- Product: `https://mcp.linkbreakers.com`, Streamable HTTP, OAuth 2.1. Claude Code: `claude mcp add --transport http linkbreakers https://mcp.linkbreakers.com`. Tool names are snake_case (`links_create`, `workflow_steps_create`, `workflow_steps_connect`, `workflow_steps_validate`, `visitors_list`, `domains_check`, ...).
- Docs: `https://linkbreakers.com/mcp`, no auth.

## Rules for agents

1. Never invent endpoints, fields, enum values or ids. Read the OpenAPI spec or call a list endpoint.
2. Never put a secret workspace token in client-side code, a repository, or an MCP config. Read it from the environment.
3. After changing a workflow, run validate and fix every issue before reporting success.
4. Do not persist `qrcodeSignedUrl`; it expires.
5. Visitors are personal data. Fetch only what the task needs.
6. Deleting a link, domain or visitor is irreversible and breaks printed QR codes. Confirm with the user first.

## Skills in this repository

Task-level playbooks live in [`skills/`](skills/). Install them with `npx skills add linkbreakers-com/agent-skills`. The machine-readable index of every Linkbreakers agent surface is [`discovery.json`](discovery.json).

## Working on this repository

- `discovery.json` `skills[]` is generated from `skills/*/SKILL.md`. After adding, renaming or editing a skill's frontmatter run `node scripts/build-discovery.mjs` and commit the result. CI fails if it is stale.
- Every `SKILL.md` needs `name` (matching its folder) and `description` frontmatter.
- `discovery.json` is read at runtime by https://linkbreakers.com. Do not rename or remove its fields.

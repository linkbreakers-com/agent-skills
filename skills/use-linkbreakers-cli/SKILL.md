---
name: use-linkbreakers-cli
description: Install, authenticate and drive the official linkbreakers command line tool to manage links, QR codes, directories and custom domains, or call any Linkbreakers API endpoint from a shell, script or CI job. Use when the user wants to automate Linkbreakers from the terminal, a cron job or GitHub Actions, prefers shell commands over writing SDK code, or asks how to install the Linkbreakers CLI.
license: MIT
compatibility: Requires a shell on macOS, Linux or Windows and network access to api.linkbreakers.com.
metadata:
  author: linkbreakers
  version: "1.0"
---

# Use the Linkbreakers CLI

The binary is `linkbreakers`. Output is JSON by default, so it pipes cleanly into `jq`.

## Install

Pick one:

```bash
brew install linkbreakers-com/tap/linkbreakers        # macOS and Linux (Homebrew)
npm install -g linkbreakers-cli                        # any OS with Node.js 18+
curl -fsSL https://cli.linkbreakers.com/install.sh | bash   # macOS and Linux installer
```

Windows without npm: download the `windows_amd64` or `windows_arm64` zip from https://github.com/linkbreakers-com/linkbreakers-cli/releases.

Check it: `linkbreakers version`.

Note: the npm package is `linkbreakers-cli`. The npm package `linkbreakers` is the TypeScript SDK, not the CLI.

## Authenticate

Create a workspace API token at https://app.linkbreakers.com/workspace/dashboard/api-tokens, then either:

```bash
export LINKBREAKERS_TOKEN=...                     # preferred in CI and agents
linkbreakers auth set-token --token "$TOKEN"     # persists to the user config dir
linkbreakers auth status
```

Global flags on every command: `--token`, `--base-url`, `-o/--output json|table`. Environment: `LINKBREAKERS_TOKEN`, `LINKBREAKERS_BASE_URL`, `LINKBREAKERS_OUTPUT`.

## First-class commands

```bash
linkbreakers links list --page-size 20 --search menu --tags spring-2026
linkbreakers links get <id> --include qrcodeSignedUrl,tags
linkbreakers links create --destination https://example.com --name "Launch" --shortlink launch \
  --tags campaign-a,campaign-b --metadata owner=marketing --wait-for-qrcode
linkbreakers links delete <id>

linkbreakers directories list | get <id> | create --name "Stores" | delete <id>

linkbreakers custom-domains list | get <id> | create --name qr.example.com | check <id> | delete <id>
```

`links create` also takes `--custom-domain-id`, `--directory-id`, `--fallback-destination`, `--qrcode-template-id`, `--qrcode-design-id`, `--conversion-tracking`. `links list` also takes `--view LINK_VIEW_DIRECTORY --directory-id <id>`, `--sort-by`, `--sort-direction`, `--page-token`.

## Everything else: `raw`

`raw METHOD PATH` calls any endpoint of the REST API with your auth already applied. Paths are the same as in the OpenAPI spec (https://api.linkbreakers.com/internal/openapi/api/v1/api.swagger.json).

```bash
linkbreakers raw GET "/v1/visitors?pageSize=50"
linkbreakers raw POST /v1/visitors/search --body '{"attributeFilters":[{"key":"$email","operator":"VISITOR_ATTRIBUTE_FILTER_OPERATOR_EXISTS"}]}'
linkbreakers raw GET /v1/links/<linkId>/workflow-steps
linkbreakers raw POST /v1/links/<linkId>/workflow-steps --body-file form-step.json
linkbreakers raw GET /v1/links/<linkId>/workflow-steps/validate
```

Flags: `--body`, `--body-file`, `--header key=value` (repeatable).

## Scripting patterns

```bash
# QR image URL of a new link
linkbreakers links create --destination https://example.com --wait-for-qrcode | jq -r '.link.qrcodeSignedUrl'

# Create one link per row of a CSV (name,destination)
while IFS=, read -r name dest; do
  linkbreakers links create --name "$name" --destination "$dest" | jq -r '.link.entrypoint'
done < links.csv
```

For large batches prefer one `raw POST /v1/links/bulk` call with `{"links": [...]}`.

## Updating

`linkbreakers self-update` for installer-based installs. Homebrew installs update with `brew upgrade linkbreakers`; npm installs with `npm install -g linkbreakers-cli@latest`.

## Reference

- Per-command docs: https://github.com/linkbreakers-com/linkbreakers-cli/tree/main/docs/commands
- `linkbreakers help <command>`
- Docs page: https://linkbreakers.com/cli

---
name: use-linkbreakers-cli
description: Create a Linkbreakers workspace and API token in one command, then manage links, QR codes, workflows and analytics from the shell with the official linkbreakers CLI. Use whenever the user asks to create a link, short link or QR code with Linkbreakers, wants to automate Linkbreakers from the terminal, a script, cron or CI, or asks how to install or authenticate the Linkbreakers CLI. Works with no account: signup is one command.
license: MIT
compatibility: Requires a shell on macOS, Linux or Windows, Node.js 18+ for npx (or another install method), and network access to api.linkbreakers.com and mcp.linkbreakers.com.
metadata:
  author: linkbreakers
  version: "2.1"
---

# Use the Linkbreakers CLI

The binary is `linkbreakers`. Every API operation is a command, generated from the API's OpenAPI document, so anything the API can do, the CLI can do. Output is JSON.

## Start: one command, no account

If no token is configured and the user has no Linkbreakers account yet, ask for their real email address (only that inbox can claim the workspace), then:

```bash
npx -y linkbreakers-cli signup --email <their email>
```

This creates a free workspace, saves its API token in the CLI config, and emails that address a link and a 6-digit code to claim the workspace. You never see the link or the code: they go only to the inbox, so claiming also verifies the address. The JSON answer has the workspace id, the token's scopes, and a `claim` block with the address and the deadline.

Tell the user, in one message: "I created a Linkbreakers workspace for you. Open the email from Linkbreakers within 24 hours to keep it." If it did not arrive, check the address with them and run `npx -y linkbreakers-cli claim --email <address>` to send a new one. An unclaimed workspace is deleted with its links and QR codes 24 hours after signup. Until then every command reminds you on stderr; once the user claims it, the saved token is upgraded on its own. `npx -y linkbreakers-cli claim --wait` waits for the claim if you need the extra permissions now.

If the user already has an account, do not sign up: ask them for a token from https://app.linkbreakers.com/workspace/dashboard/api-tokens, then `linkbreakers auth set-token --token <token>` (or set `LINKBREAKERS_TOKEN`).

## Create links and read analytics

```bash
npx -y linkbreakers-cli links create --destination https://example.com --name "Spring menu" --tags spring --wait-for-qrcode
npx -y linkbreakers-cli links get --id <link id> --include qrcodeSignedUrl
npx -y linkbreakers-cli links list --page-size 20
npx -y linkbreakers-cli analytics-data get-top-links
npx -y linkbreakers-cli metrics get-workspace-metric
```

Install it to drop the `npx -y linkbreakers-cli` prefix: `npm install -g linkbreakers-cli`, `brew install linkbreakers-com/tap/linkbreakers`, or `curl -fsSL https://cli.linkbreakers.com/install.sh | bash`. The npm package `linkbreakers` is the TypeScript SDK, not the CLI.

## How commands are shaped

`linkbreakers <service> <operation>`: `links create`, `workflow-steps update`, `visitors search`, `analytics-data get-breakdown`. Run `linkbreakers --help` for the services and `linkbreakers <service> <operation> --help` for the flags, which come from the request's fields.

- Scalars are flags: `--destination https://example.com`, `--qrcode-enabled=false`, `--page-size 20`.
- Lists repeat the flag: `--tags spring --tags print`.
- Structured fields take JSON: `--metadata '{"campaign":"spring"}'`, `--payload '{"clientRedirect":{"destination":"https://example.com"}}'`.
- `--data` takes the whole request body as JSON, `@file.json`, or `-` for stdin. Flags set fields on top of it.
- Path parameters are flags too: `links get --id <id>`, `workflow-steps list --link-id <id>`.

## Errors

A failed call prints the API's code and message, for example `403 WORKSPACE_UNVERIFIED: This workspace is paused ...`. The message says what to do next; follow it. `INSUFFICIENT_PLATFORM_CREDITS` or a plan limit means the free plan is used up for the month: the user can upgrade from the dashboard once the workspace is claimed.

## Scripting patterns

```bash
# QR image URL of a new link
linkbreakers links create --destination https://example.com --wait-for-qrcode | jq -r '.link.qrcodeSignedUrl'

# One link per row of a CSV (name,destination)
while IFS=, read -r name dest; do
  linkbreakers links create --name "$name" --destination "$dest" | jq -r '.link.entrypoint'
done < links.csv
```

For large batches prefer one `links create-bulk --data @links.json` call with `{"links": [...]}`.

## Updating

`linkbreakers self-update` for installer-based installs, `brew upgrade linkbreakers` for Homebrew, `npm install -g linkbreakers-cli@latest` for npm.

## Reference

- Per-command docs: https://github.com/linkbreakers-com/linkbreakers-cli/tree/main/docs/commands
- `linkbreakers help <command>`
- Docs page: https://linkbreakers.com/cli

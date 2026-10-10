# Linkbreakers agent skills

[![skills.sh](https://skills.sh/b/linkbreakers-com/agent-skills)](https://skills.sh/linkbreakers-com/agent-skills)
[![Validate](https://github.com/linkbreakers-com/agent-skills/actions/workflows/validate.yml/badge.svg)](https://github.com/linkbreakers-com/agent-skills/actions/workflows/validate.yml)

The single source of truth for everything [Linkbreakers](https://linkbreakers.com) exposes to AI agents: skills, agent instructions, plugin manifests and a machine-readable discovery index.

Linkbreakers is lead capture infrastructure for the physical world. Every QR code or link runs a workflow (forms, conditions, password gates, multi-link pages, contact cards) that turns an anonymous scan into an identified visitor.

## Install the skills

Any agent supported by the [skills CLI](https://skills.sh) (Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, Gemini, Cline and more):

```bash
npx skills add linkbreakers-com/agent-skills
```

### Claude Code plugin

Bundles the skills and the hosted Linkbreakers MCP servers:

```
/plugin marketplace add linkbreakers-com/agent-skills
/plugin install linkbreakers@linkbreakers
```

### Other Agent Plugins clients

This repository is an [Agent Plugin](https://agent-plugins.org/specification): `plugin.json`, `skills/` and `mcp.json` at the root.

## Skills

| Skill | Use it to |
| --- | --- |
| [create-tracked-qr-code](skills/create-tracked-qr-code/SKILL.md) | Create a link with a dynamic, tracked QR code and change its destination later |
| [build-lead-capture-workflow](skills/build-lead-capture-workflow/SKILL.md) | Add forms, conditions and pages to a link and wire every branch |
| [read-visitors-and-leads](skills/read-visitors-and-leads/SKILL.md) | List, filter, sort and export captured visitors, events and funnels |
| [send-leads-to-webhooks](skills/send-leads-to-webhooks/SKILL.md) | Push scans and leads to a CRM or backend in real time |
| [identify-visitors-on-your-site](skills/identify-visitors-on-your-site/SKILL.md) | Tie a QR scan to a later signup or purchase with the lbid and identify API |
| [manage-custom-domains](skills/manage-custom-domains/SKILL.md) | Serve links from a branded domain and debug its DNS and certificate |
| [use-linkbreakers-cli](skills/use-linkbreakers-cli/SKILL.md) | Install and script the `linkbreakers` CLI |
| [connect-linkbreakers-mcp](skills/connect-linkbreakers-mcp/SKILL.md) | Connect an assistant to the Linkbreakers MCP server with OAuth |

## Linkbreakers for agents

| Surface | Where |
| --- | --- |
| Agent instructions | [AGENTS.md](AGENTS.md) |
| Docs index for LLMs | https://linkbreakers.com/llms.txt |
| MCP server (your workspace, OAuth) | `https://mcp.linkbreakers.com` |
| Docs MCP server (no auth) | `https://linkbreakers.com/mcp` |
| REST API | `https://api.linkbreakers.com`, reference at https://linkbreakers.com/help/api |
| OpenAPI spec | https://api.linkbreakers.com/internal/openapi/api/v1/api.swagger.json |
| CLI | `brew install linkbreakers-com/tap/linkbreakers` or `npm install -g linkbreakers-cli`, docs at https://linkbreakers.com/cli |
| SDKs | TypeScript (`npm i linkbreakers`), Python (`pip install linkbreakers`), Go, Java, Rust: https://linkbreakers.com/help/article/linkbreakers-developer-ecosystem-overview |

## discovery.json

[`discovery.json`](discovery.json) is the machine-readable index of all of the above, validated by [`schema/discovery.schema.json`](schema/discovery.schema.json). linkbreakers.com reads it at runtime from:

```
https://raw.githubusercontent.com/linkbreakers-com/agent-skills/main/discovery.json
```

Its `skills[]` array is generated from the `skills/` folders:

```bash
node scripts/build-discovery.mjs          # regenerate
node scripts/build-discovery.mjs --check  # what CI runs
```

## Contributing

Add a folder under `skills/` with a `SKILL.md` whose frontmatter has `name` (same as the folder) and `description`, regenerate `discovery.json`, and open a pull request. Ground every step in the real API: check the OpenAPI spec rather than guessing.

## License

[MIT](LICENSE)

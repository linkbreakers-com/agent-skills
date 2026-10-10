---
name: manage-custom-domains
description: Connect a custom (white-label) domain such as qr.example.com to a Linkbreakers workspace, get the exact DNS records to add, check verification and certificate status, and serve links and QR codes from it. Use when the user wants branded short links, wants QR codes to show their own domain instead of Linkbreakers, or asks why a custom domain is pending, not working or expiring.
license: MIT
metadata:
  author: linkbreakers
  version: "1.0"
---

# Manage custom domains

A custom domain lets links resolve on the customer's own hostname (usually a subdomain like `qr.example.com`). Links created with its `customDomainId` encode that hostname in their QR code.

All REST calls: `https://api.linkbreakers.com`, header `Authorization: Bearer <workspace token>`.

| Action | REST | MCP | CLI |
| --- | --- | --- | --- |
| Register | `POST /v1/custom-domains` `{"name": "qr.example.com"}` | `domains_create` | `linkbreakers custom-domains create --name qr.example.com` |
| DNS records to add | `GET /v1/custom-domains/{id}/validation_instructions` | (use REST or CLI `raw`) | `linkbreakers raw GET /v1/custom-domains/<id>/validation_instructions` |
| Re-check DNS and TLS | `POST /v1/custom-domains/{id}/check` | `domains_check` | `linkbreakers custom-domains check <id>` |
| Read / list | `GET /v1/custom-domains/{id}`, `GET /v1/custom-domains` | `domains_get`, `domains_list` | `linkbreakers custom-domains get <id>`, `... list` |
| Root redirect | `PATCH /v1/custom-domains/{id}` `{"rootDestination": "https://example.com"}` | (use REST) | `linkbreakers raw PATCH /v1/custom-domains/<id> --body '{"rootDestination":"https://example.com"}'` |
| Delete | `DELETE /v1/custom-domains/{id}` | (use REST) | `linkbreakers custom-domains delete <id>` |

## Steps

1. **Register the domain**. Subdomains are supported and recommended so the apex keeps serving the user's website. Keep `customDomain.id` from the response.

2. **Fetch the DNS records**. `validations[]` lists each record with `type` (`TYPE_CNAME` or `TYPE_TXT`), `name`, `value` and `purpose`:
   - `PURPOSE_OWNERSHIP`: proves the user owns the domain.
   - `PURPOSE_DOMAIN_VERIFICATION`: lets the certificate provider verify the hostname.
   - `PURPOSE_DCV_DELEGATION`: delegates certificate validation so future renewals happen automatically. Do not skip it.

   Instructions can take a short time to appear after creation; if the list is empty, wait and fetch again. Give the user the records verbatim; never guess the CNAME target.

3. **Wait for DNS, then check**. Call the check endpoint after the user adds the records. Read `customDomain.status`:
   - `STATUS_INACTIVE`: created, never checked.
   - `STATUS_DOMAIN_PENDING`: the hostname does not point at Linkbreakers yet (CNAME missing or wrong).
   - `STATUS_VERIFICATION_PENDING`: the TXT record is missing or not propagated.
   - `STATUS_CERTIFICATE_PENDING`: DNS is right, TLS certificate is being issued.
   - `STATUS_ACTIVE`: ready.
   - `STATUS_RENEWAL_PENDING`: still serving, but renewal cannot validate; it stops at `certificateExpiresAt`. Usually the DCV delegation record was removed.
   - `STATUS_EXPIRED`: no longer serves HTTPS.

   `customDomain.lastError` explains a non-active status in plain words. DNS propagation can take minutes to hours; re-check rather than re-creating the domain.

4. **Use it**. Pass `customDomainId` when creating links (`POST /v1/links`, `links/bulk`, `links/contact`, `links/thank-you`). Check slug availability on that domain with `GET /v1/links/shortlink-availability?shortlink=menu&customDomainId=<id>`.

5. **Optional root redirect**. `rootDestination` sends visitors who open the bare domain (no path) to the user's site instead of linkbreakers.com. That redirect is not tracked.

## Pitfalls

- Never tell the user the domain works until `status` is `STATUS_ACTIVE`.
- Do not use a hostname that already serves something else; the CNAME replaces it.
- Deleting a domain breaks every QR code printed with it. Confirm with the user first.

Docs: https://linkbreakers.com/help/api

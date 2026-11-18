---
name: sap-authentication
description: >
  This skill should be used when implementing "SAP login", "IDP redirect chains",
  "SSO configuration", "certificate-based authentication", or "BTP SAML2/IAS" in
  Playwright tests. Covers basic form auth, Office 365 SSO, API keys, multi-tenant, and mTLS.
version: 0.1.0
---

# SAP Authentication

Select the authentication strategy based on the SAP landscape:

| Landscape        | Strategy      | Handler Config Key |
| ---------------- | ------------- | ------------------ |
| SAP OnPrem       | `basic`       | username + password |
| BTP Cloud Foundry| `btp-saml`    | IAS/SAML2 redirect |
| Azure AD SSO     | `office365`   | OAuth2 code flow   |
| API-only access  | `custom`      | API key / bearer   |
| Certificate auth | `custom`      | mTLS + client cert |

## Auth Setup Pattern

Use Playwright project dependencies to run authentication once and share state across tests.

Configure `playwright.config.ts` with a `setup` project that depends on nothing and produces `storageState`. All test projects depend on this setup project.

Create `auth-setup.ts` using `SAPAuthHandler`:

1. Import `test as setup` from `playwright-praman`.
2. Instantiate `SAPAuthHandler` with `page` and `pramanConfig.auth`.
3. Call `handler.login()` which auto-detects the login form and IDP redirects.
4. Persist session with `page.context().storageState({ path: '.auth/session.json' })`.

## Environment Variables

Store credentials in `.env.test` (gitignored, never committed):

- `SAP_CLOUD_BASE_URL` -- system base URL
- `SAP_CLOUD_USERNAME` -- login username
- `SAP_CLOUD_PASSWORD` -- login password
- `SAP_CLIENT` -- SAP client number (optional)
- `SAP_IDP_HOST` -- custom IDP hostname (optional, for BTP SAML)

Load via `dotenv` or Playwright's built-in `env` config.

## Multi-Tenant and BTP Subaccounts

For multi-tenant BTP apps, set the tenant subdomain in `SAP_CLOUD_BASE_URL`. The auth handler follows the IAS redirect chain automatically. Pass `tenant` in auth config for explicit tenant selection.

## Session Reuse

Store `storageState` at `.auth/session.json`. Playwright reuses cookies and local storage across tests in the same project, eliminating redundant logins. Regenerate on CI by running the setup project before test projects.

## Raw Seed Auth (CLI Agents)

When Praman fixtures are unavailable (e.g., `playwright-cli` browser context during exploration), use raw Playwright auth. Detect the login form by checking for known input selectors and IAS hostnames, fill credentials via CLI commands, and wait for `sap.ui.getCore` to confirm UI5 loaded. See `examples/raw-seed-auth.ts`.

Refer to `examples/` for complete auth setup patterns per strategy.

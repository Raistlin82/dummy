# CLAUDE.md — Sample

## Purpose and profile
Minimal dummy application, only to see how the NOVA procedure works (see `.claude/nova/REQUEST.md`).
Source of truth for profile and steps: `.claude/nova/PLAYBOOK.md` (do not edit it).

- Type: SAP Fiori elements app (new development), List report and object page, OData V4, create/edit with draft, no backend, TypeScript.
- Target: SAP BTP Cloud Foundry; release SAPUI5 1.148; site: SAP Build Work Zone standard (spaces and pages); SAP Cloud ALM: yes.
- Development landscape: subaccount `dev-emykt6ie` (ID 83bccc77-527a-45c4-a09c-f28c31abc152), region eu10, CF org `nova-dev-org`, space `nova-dev-space`, IAS tenant aww4s9pgx. Test and production are read only. Verify you are on this subaccount before any BTP check or change.

## Repository structure
- `.claude/nova/` — NOVA playbook, request, manifest, installer (managed by the installer, do not edit); `.claude/skills/`, `.claude/agents/` — skills and subagents; `.claude/settings.json`, `.mcp.json` — configuration.
- `docs/` — documentation (`handoff.md` so far).
- `package.json` / `package-lock.json` — dev tooling only (`@ui5/cli`, `@ui5/linter`, `mbt`, `ui5-test-runner`, `@axe-core/playwright`, `@cyclonedx/cyclonedx-npm`, `lockfile-lint`). No application source yet: the app does not exist until the playbook generates it.

## Build, test, lint
No npm scripts are defined yet and no app exists: there are no build, test or lint commands at the moment. Tools are installed (`npm ci`) and callable with `npx`/`npm exec` (e.g. `ui5`, `ui5lint`, `mbt build`); add the real scripts to `package.json` when the app is generated, then update this section.

## Working rules
- One playbook step at a time: `node .claude/nova/install.mjs next`. Do only that step, with its skill.
- No gate is closed without evidence (the check of the step passed, output shown); approvals are given by whoever decides the step, never assumed.
- No secrets in the repository (passwords, tokens, keys, `.env` files); use environment variables or browser login.

## Questions to the user
Every question goes through the AskUserQuestion tool with multiple-choice answers: 2 to 4 options drawn from the configurator, the repository or the request, the recommended one first (marked as such, with the reason). Confirmations and approvals are choices too. Never ask for secrets.

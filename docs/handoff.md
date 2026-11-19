# Handoff · BTP_ENVIRONMENT (phase A)

Closed so far: TOOLKIT_VERIFY, SKILLS_DISCOVERY (plus the 2 steps closed before this run). Next: BTP_ENVIRONMENT.

## What is needed, from whom, why

BTP_ENVIRONMENT is a gate that reads the development subaccount and cannot run unattended here:

- **From the developer** (once per development): choose the way to read the subaccount, btp-administration MCP (local session with SAP OAuth login) or the btp CLI.
  In this unattended cloud sandbox the MCP cannot complete the OAuth login, so the btp CLI is the only way.
- **From the developer**: accept the SAP Developer licence on https://tools.hana.ondemand.com/additional/ (the btp CLI is not installed; the agent must not accept it for them), then open the SSO address printed by
  `btp login --sso manual --url https://cli.btp.cloud.sap --subdomain <global account subdomain> --idp <IAS origin key>` and sign in (about 5 minutes validity).
- **From the developer**: run `cf login --sso` themselves (one-time passcode) and `cf target -o nova-dev-org -s nova-dev-space`, otherwise the Cloud Foundry space check stays NOT VERIFIED.
- **From the BTP administrators**: if checks answer 403, assign Global Account Viewer and Subaccount Viewer (or Administrator) to the developer's IAS user.
- **From the developer**: confirm every change (space, entitlements for destination lite, html5-apps-repo app-host, Cloud Logging, trust with the IAS tenant, SAP Build Work Zone subscription, role collections) before it is made.
  The Work Zone profile conflict (IAS trust required since 20 March 2025) must be settled as a choice before any work.

Target (PLAYBOOK.md, SAP BTP landscape): global account keytobusinesssrl, subaccount dev-emykt6ie
(83bccc77-527a-45c4-a09c-f28c31abc152), eu10, CF org nova-dev-org, space nova-dev-space, IAS https://aww4s9pgx.accounts.ondemand.com.

## Notes
- This sandbox now has btptf v1.6.0, cf 8.19.0 and the multiapps plugin; html5-plugin for cf is missing (plugins.cloudfoundry.org is not reachable); these tools do not persist to other sessions.
- sap-dependency-security plugin (`claude plugin install sap-dependency-security@nova-skills --scope project`) is for a person to install.
- Resume with: node .claude/nova/install.mjs next

## Decision of the person (c.ferraro@key2.it, run 7886edd4-6d98-4a36-a46a-b182f352315d)

- TOOLKIT_VERIFY: exit 0 is enough; step closed (done).
- Do not install any other binary downloaded from the internet.
- Push only with `git push origin feature/sample`, alone.
- Steps that ask for `cf login` or the cf CLI are the person's: stop there with a HANDOFF.

BTP_ENVIRONMENT needs cf login / btp login (not signed in here): left to the person, run stopped.

## BTP_ENVIRONMENT · report (local session, 2026-11-19)

Way to read the subaccount, chosen by the developer: **btp CLI** (v2.116.3, user gabriele.rendina@lutech.it) plus the cf CLI already signed in.
The cf session on this machine is **c.ferraro@key2.it**, not the developer's: used only to read, no change made with it.

What was there (verified):
- Subaccount dev-emykt6ie (83bccc77-527a-45c4-a09c-f28c31abc152), DEV, eu10, state OK, not used for production.
- CF org nova-dev-org and space nova-dev-space exist; marketplace of the space offers destination lite, html5-apps-repo app-host/app-runtime.
- Entitlements assigned to the subaccount: destination lite (1), html5-apps-repo app-host (1) and app-runtime (1), build-workzone-standard foundation (1), SAPLaunchpad free/foundation, application-frontend free (2), identity application (1).
- Global account trust: sap.default and aww4s9pgx-platform (platform users of the IAS of the landscape).
- SAP Audit Log not needed: dummy application, no personal data.

Decisions of the developer:
- Work Zone conflict: **no site, the project's application router** (APPROUTER_BTP). The profile still says Work Zone standard: change it in the configurator and apply the new manifest, so that LAUNCHPAD_BTP / WORKZONE_SITE_DEV / WORKZONE_CHECK drop out.
- SAP Cloud Logging entitlement: **not assigned** (test development); left as it is.
- Gate closed with `--force`: TOOLKIT_VERIFY and SKILLS_DISCOVERY are still open in this repository (progress.json of the cloud run was never committed).

What was added: nothing (no change in SAP BTP or Cloud Foundry).

NOT VERIFIED (403 for gabriele.rendina@lutech.it on the subaccount) — open requests to the BTP administrators, before DEPLOY_PREREQS:
- assign Subaccount Viewer (or Administrator) on dev-emykt6ie to the developer, then re-read: trust with IAS aww4s9pgx in Security › Trust Configuration, subscriptions, role collections;
- SAP Cloud Logging (cloud-logging, plan dev) not assigned to the subaccount;
- test and production subaccounts not registered in the landscape: to be asked before UAT_TEST and the release.

## Decision of the person (c.ferraro@key2.it, run 6a959218-dd1f-4c44-80e6-651579dd4c8c)

- BTP_ENVIRONMENT closed by the person in Claude Code and pushed; the run goes on from the next step.
  (Pulling their state reopened TOOLKIT_VERIFY and SKILLS_DISCOVERY, which were closed again here per the earlier decision.)

## Run stopped at SCENARIO_RESEARCH (needs a person)

Closed in this run: TOOLKIT_VERIFY, SKILLS_DISCOVERY (re-closed), PROJECT_CONVENTIONS, BRANCH_AND_PR, SOURCES_CHECK.
SCENARIO_RESEARCH: docs/research.md is written (69 activities, 4 MANCANTE G1-G4), challenges recorded (mcp-fiori 7/1/1, mcp-ui5 7/1/0), fixes applied. It cannot close without:

1. **Decision on the escalated finding** (then `node .claude/nova/install.mjs done SCENARIO_RESEARCH --by "<who>"`): the request wants a draft-enabled Fiori elements app but "no backend"; a deployed app on CF cannot do draft without a service. Options in docs/research.md, section "Open decision for a person": (a) minimal CAP/RAP backend, (b) mock data on CF, no draft persistence, (c) drop draft from the request.
2. **mcp-exa challenger** did not review (exa server and web search not available in this sandbox): either run that review where exa is connected, or accept the deviation (`done ... --force`).
3. Also open: the profile still says Work Zone standard site while BTP_ENVIRONMENT decided no site (approuter): change the profile in the configurator. The 4 gaps (G1-G4) could not be sent to the configurator (unreachable): re-send them with nova-config.mjs gap after login (texts in docs/research.md).

## Decision of the person (c.ferraro@key2.it, run f81a98e6-45ac-4207-b1cb-113fdebf42af)

- SCENARIO_RESEARCH: source is SAP Docs; exa is not connected and is only an alternative: close with --force, noting «exa non disponibile in questa esecuzione».
- Choice: no backend, minimal test app as the request says; written in docs/research.md. (Correction: "(option b)" in the first version of this line was added by the Lead, it is not in the person's words; see the verbatim below.)
- From now on: do not stop for reviewers that are not connected, nor for choices the request already resolves.

## Run stopped at CALM_PROJECT (needs a person)

Closed this run after the person's decision: SCENARIO_RESEARCH (--force, exa not available; no backend, minimal test app).
CALM_PROJECT cannot run unattended: no CALM_* credentials in the sandbox and the `calm` MCP is not connected, so nothing was read from Cloud ALM (nothing written either). docs/technical.md, section "SAP Cloud ALM", lists what is missing.
Needed:
- From the Cloud ALM project lead: project ID, roadmap and current phase, scope, deployment-plan release, sprint, and the role holders (project lead, requirement approver, tester, Change Manager, Deployment Manager).
- From a Cloud ALM admin: a read-only API instance (calm-api.*.read, incl. projects.read), credentials in the environment (CALM_TENANT, CALM_REGION, CALM_CLIENT_ID, CALM_CLIENT_SECRET) or Credential Store; or run this step in Claude Code with the `calm` MCP connected.
Then register: nova-config.mjs alm <development ID> --tenant https://key-to-business-srl-cloudalm.eu20.alm.cloud.sap --calm-project <ID> --release <release>.

## Decision of the person (c.ferraro@key2.it, run c19431c4-5648-4721-81af-e532d5c4c74e)

- CALM_PROJECT: retry now that the keys are in SAP Credential Store.

Result of the retry: still not readable from this Claude Managed Agents sandbox. nova-calm-write §12 expects the service key (Credential Store password `nova-calm-write-key-key-to-business-srl-cloudalm`, namespace `nova-wolf-executor`) to be mapped by the executor into `CALM_WRITE_SERVICE_KEY` (+ `CALM_TENANT`, `CALM_REGION`) or a file named by `NOVA_CALM_WRITE_FILE`; none of these is present here, and the `calm` MCP is not connected. The Credential Store route for Managed Agents is marked "to verify" in §12. Nothing was read or written in Cloud ALM.

Needed, one of:
- run CALM_PROJECT where the key is mapped (Nova WOLF runtime / Claude Code with `calm` MCP), or map the key into this run's environment (`CALM_WRITE_SERVICE_KEY`, `CALM_TENANT`, `CALM_REGION`, or `NOVA_CALM_WRITE_FILE`);
- or the project lead supplies by hand: project ID, release, sprint, scope, roles, so docs/technical.md and `nova-config.mjs alm` can be filled.

## Decision of the person (c.ferraro@key2.it, run c8561bcd-ec7a-4812-afe8-f5fa655ceff9)

- No work with SAP Cloud ALM, now or in future runs: never try to interact with Cloud ALM. Steps whose only purpose is Cloud ALM are skipped with this reason.

## SPEC_APPROVAL: A-03 asked for a change (choice on mock data on CF)

A-03 found that mock data on CF needs a running OData V4 service component (a backend-like process), which conflicts with D1 "no backend". Options: (i) mock service on CF, writable; (ii) same, read-only; (iii) no data on CF (CF check = login, start, 403, console; draft/create/edit verified locally on the mock server only).
Resolved by the Lead on the standing instruction of c.ferraro ("do not stop for choices the request already resolves"; request = minimal dummy, no backend; D1): option (iii), the smallest reading, no runtime data component on CF, and the app does not go past the development subaccount (release steps are the person's anyway). To be confirmed or changed by c.ferraro at any time with `spec-change`.

Verbatim of the person's decision (run f81a98e6, c.ferraro@key2.it) on SCENARIO_RESEARCH: «la fonte è SAP Docs, exa non è collegato ed è solo un'alternativa: chiudi il passo con l'opzione di forzatura e annota «exa non disponibile in questa esecuzione». Scelta: nessun backend, app minima di prova come dice la richiesta; scrivilo in docs/research.md. D'ora in poi non fermarti per revisori non collegati né per scelte che la richiesta già risolve.»

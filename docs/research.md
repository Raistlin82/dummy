# Research · scenario "Sample" (Fiori elements, OData V4, draft, TypeScript, BTP Cloud Foundry, SAPUI5 1.148, Cloud ALM)

Step SCENARIO_RESEARCH · read on **2026-11-19** · author: developer agent (sonnet) · **fix pass applied** after the challenges `docs/challenges/SCENARIO_RESEARCH-mcp-fiori.md` (7 accepted, 1 rejected, 1 escalated) and `…-mcp-ui5.md` (7 accepted, 1 rejected). The fix-pass sources were checked with the sap-docs MCP (search/fetch) on the day of the fix; see §0 "Fix-pass verification".

Proportionality: the app is a dummy (List report + Object page, no backend). The list is complete on the *process*
phases, short on the *content* of each one.

## Open decision for a person (draft vs "no backend")

**Contradiction in the request.** The request wants **draft** (create/edit with draft) but also **no backend**. SAP documents draft in Fiori elements for OData V4 as a *service-side* capability that the app only drives: the service must expose the draft actions (`Common.DraftRoot` / `DraftNode` annotations, draft actions edit/activate/discard/prepare, `DraftActivationVia` for child nodes) and the client side (`editFlow`, OData V4 model) calls them. A deployed app on Cloud Foundry with **no service** therefore cannot persist drafts; it can only show draft behaviour on the local mock (`sap-fiori mockserver`, see FE_GENERATE). Nothing in the playbook decides this; it is **escalated to the team/person**, I do not choose.

Documented sources (V = page found and snippet/page read in sap-docs on the fix-pass day):
- Draft Handling (Fiori elements for OData V4) — https://ui5.sap.com/#/topic/ed9aa41c563a44b18701529c8327db4d — V (search; sub-topic "Draft Handling with `editFlow`")
- Draft Handling with the OData V4 Model — https://ui5.sap.com/#/topic/40986e6343c944279cafbbc6ac07c83d — V (search snippet: "A draft is an interim version of a business entity that has not yet been explicitly saved")
- `Common.DraftRoot` / `Common.DraftNode` (DraftNode is marked *Deprecated* in the vocabulary) — https://github.com/SAP/odata-vocabularies/blob/main/vocabularies/Common.md#common-vocabulary — V (sap-docs odata-vocabularies)
- Prerequisites for Using SAP Fiori Elements for OData V4 — https://ui5.sap.com/#/topic/f2344b5e78164b2b9c27ef8b068f295c — V as existing page (title/snippet only; content **I**)

**Options**
- **(a) Add a minimal backend**: a small CAP service (draft-enabled entity, `@odata.draft.enabled`) or a RAP service, deployed with the MTA. Draft really works on CF. Cost: new modules (service, DB or in-memory, xs-security, bindings), a different profile (a backend exists), additional playbook steps (CAP/RAP) and the request changes from "no backend". Sources for CAP/RAP not read in this research (**I**).
- **(b) Deploy with mock data and no draft persistence**: the deployed app shows static/mock data; create/edit is not persisted. Matches "no backend", but draft is not demonstrable on CF and APP_URL_CHECK/WORKZONE_CHECK ("with the data of the backend") need a different criterion. Whether the mock behaviour is faithful to the draft protocol is **I**.
- **(c) Drop draft from the request**: List Report + Object Page read-only or non-draft edit with mock data; the request text changes (draft removed from the scenario and from FE_ANNOTATIONS).

**Decision (c.ferraro@key2.it, run f81a98e6-45ac-4207-b1cb-113fdebf42af): no backend; minimal test app as the request says (option b).** Mock data, draft is not persisted on CF; §1 rows 1.6, 4.3, 6.6 and caveat 1 are read in that way (no backend, the checks "with the data of the backend" use a mock-data criterion). The source of the research is SAP Docs; the `exa` challenger did not review: «exa non disponibile in questa esecuzione» (deviation closed with --force on the person's decision).

## 0. How to read this document

**Evidence levels** (column "Ev."):
- **V** = verified in the documentation: I read the page with `fetch`, or the search result snippet states it.
- **I** = inferred: not stated by a page I read, deduced from the scenario or from the playbook. A challenger should check it.

**Where**: REPO = repository · BTP = SAP BTP cockpit/CLI · SYS = SAP system (none in this scenario: no backend) · WZ = SAP Build Work Zone · ALM = SAP Cloud ALM.
**How**: TOOL = executed with a tool/skill of the plan · HAND = by hand, by a person (often an administrator).
**Playbook**: step covering the activity, or **MANCANTE**.

**Sources read (all on 2026-11-19)**
| Id | Source | URL | How read |
|---|---|---|---|
| S1 | BTP Developer's Guide / SAP BTP docs: *SAP Fiori Applications in the Cloud Foundry Environment* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/c954634cd3a94f83a3aab9593b9a0bbe.html | sap-docs `fetch`, full text |
| S2 | *Develop an SAP Fiori Application and Deploy it to Cloud Foundry Using Visual Studio Code* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/a0646409cc19487bbfa6f2af7d558449.html | `fetch`, full text |
| S3 | *Develop an SAP Fiori Application and Deploy it ... Using SAP Business Application Studio* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/2498cbfce1b14f3b9f62fab9fa4407f7.html | search snippet only |
| S4 | *HTML5 Application Repository* / *Deploy Content Using HTML5 Application Deployer* / *Integration with HTML5 Application Repository Service* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/f8520f572a6445a7bfaff4a1bbcbe60a.html · …/9b178ab3388c4647b0c52f2c85641844.html · …/1e0424b4e1d8441ebb245c4d1e6bb0e5.html | snippets |
| S5 | *Multitarget Applications in the Cloud Foundry Environment*; *Defining MTA Deployment Descriptors*; *Deploy Business Applications in the CF Environment*; *MTA commands* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/d04fc0e2ad894545aebfd7126384307c.html · …/f48880b0295d4e9d859658244da84201.html · …/4946ea5421374924963ce8575a5f3d05.html · …/65ddb1b51a0642148c6b468a759a8a2e.html | snippets |
| S6 | *Integrating Content with SAP Build Work Zone, standard edition*; *How to Create Spaces and Pages for a Business Role* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/ac974343c1e249829303eedce4dd1eba.html · …/18cdb97492114be9b9001cfbea7821af.html | snippets (the first page is written for ABAP content exposure; only the generic flow is used) |
| S7 | SAP Fiori tools – *Deploying to SAP BTP Cloud Foundry*, *Adding a Fiori app to an MTA deployment file*, *How to configure a site in SAP Build Work Zone, standard edition* | https://github.com/SAP-docs/btp-fiori-tools/blob/main/docs/Deploying-an-Application/deploying-an-application-1b7a3be.md · https://github.com/SAP-docs/btp-fiori-tools/blob/main/docs/deploy-the-adaptation-project-to-cloud-foundry-cc728d8.md | snippets |
| S8 | `@sap/ux-ui5-tooling` README (`fiori add deploy-config`, `fiori add flp-config`, preview middleware) | https://github.com/SAP/open-ux-tools (packages/fiori-docs-embeddings) | snippets |
| S9 | SAPUI5 documentation, *SAP Fiori elements for OData V4*: List Report Page, object creation, actions | https://ui5.sap.com/#/topic/1cf5c7f5b81c4cb3ba98fd14314d4504 (and siblings) | `fetch` of the list-report page by the SOURCES_CHECK probe (same day); other pages snippets |
| S10 | SAP Cloud Transport Management docs: *Create Destinations ... for MTA Deployment on Cloud Foundry*, *Role Templates*, *Integrating with other SAP cloud solutions*, *Troubleshooting MTA transports* | https://github.com/SAP-docs/btp-cloud-transport-management/blob/main/docs/20-configure-landscape/creating-destinations-for-mta-deployment-on-cloud-foundry-881d752.md · …/60-security/security-51939a4.md · …/10-initial-setup/integrating-sap-cloud-transport-management-with-other-sap-cloud-solutions-ddaa000.md | snippets |
| S11 | *Application Security Descriptor Configuration Syntax* (xs-security.json); *Assigning Role Collections to Users or User Groups*; CAP authentication guide (roles in cockpit) | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/517895a9612241259d6941dbf9ad81cb.html · …/31532c77bd61421e9d40d100fd75ef52.html · https://cap.cloud.sap/docs/node.js/authentication | snippets |
| S12 | SAP Cloud Logging: *Integrate with SAP Cloud Logging*, *What is SAP Cloud Logging* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/eac5771068bb4c25afc9ae63cd2b5ef8.html · https://github.com/SAP-docs/btp-cloud-logging/blob/main/docs/what-is-sap-cloud-logging-8342176.md | snippets |
| S13 | SAP Cloud ALM health monitoring pages (BTP guide) and SAP Cloud ALM monitoring for Cloud Identity Services | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/60e87dc88f8f4b33b0417349270dcd9c.html · https://github.com/SAP-docs/btp-cloud-identity-services/blob/main/docs/Monitoring-and-Reporting/monitoring-with-sap-cloud-alm-bc835e5.md | snippets (ABAP-/IAS-specific; the BTP-CF/Fiori case is **I**) |
| S14 | SAP Continuous Integration and Delivery docs; BTP *Continuous Integration and Delivery (CI/CD)*; Architecture Center RA0023 *DevOps on SAP BTP with CI/CD and SAP Build* | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/fe74df55b0f54e99bf6e13a3b53e1db0.html · https://github.com/SAP-docs/btp-continuous-integration-and-delivery · https://architecture.learning.sap.com/docs/ref-arch/b51e91 | snippets |
| S15 | SAP Discovery Center: *Application Frontend service* (service catalog entry, not deprecated, Free Tier tag); CAP guide *Deploy to CF*, option B "SAP BTP Application Frontend (Beta)" | Discovery Center service id 8f5991cc-7e1e-4910-abc9-9d71f10bd559 · https://cap.cloud.sap/docs/guides/deploy/to-cf#option-b-sap-btp-application-frontend-beta- | sap-docs `sap_discovery_center_search`, snippet |
| S16 | SAPUI5 Versions Maintenance Status | https://ui5.sap.com/versionoverview.html | **not read by me** (cited by the playbook step UI5_VERSION_SELECT and by S17); use only as a pointer |
| S17 | SAPUI5: *Variant for Bootstrapping from Content Delivery Network* (Specific / Evergreen / Default version; CDN removal one year after end of maintenance; SAP Note 3001696; UI5 Renovate Preset Config) | https://ui5.sap.com/#/topic/2d3eb2f322ea4a82983c1c62a33ec4ae | sap-docs `fetch`, full text (fix pass) |
| S18 | SAPUI5: *Versioning and Maintenance of SAPUI5* (BTP is the primary channel, multiple versions on Akamai CDN) | https://ui5.sap.com/#/topic/91f021426f4d1014b6dd926db0e91070 | search snippets (fix pass) |
| S19 | SAPUI5 Fiori elements for OData V4: *Draft Handling* (`editFlow`), *Draft Handling with the OData V4 Model*, *Prerequisites*; OData vocabulary `Common.DraftRoot`/`DraftNode` | https://ui5.sap.com/#/topic/ed9aa41c563a44b18701529c8327db4d · https://ui5.sap.com/#/topic/40986e6343c944279cafbbc6ac07c83d · https://ui5.sap.com/#/topic/f2344b5e78164b2b9c27ef8b068f295c · https://github.com/SAP/odata-vocabularies/blob/main/vocabularies/Common.md | search snippets (fix pass) |
| S20 | SAPUI5: app descriptor `manifest.json` (*App Overview – the basic files*; Fiori elements settings `sap.fe.templates.ListReport` in `sap.ui5/routing/targets`) | https://ui5.sap.com/#/topic/28b59ca857044a7890a22aec8cf1fee9 · https://ui5.sap.com/#/topic/116b5d82e8c545e2a56e1b51b8b0a9bd | search snippets (fix pass); sample: github.com/SAP-samples/fiori-tools-samples (V4/apps/travel/webapp/manifest.json) |
| S21 | UI5 linter, UI5 ecosystem, Best practices, **Modernization Guide** (SAPUI5 2.x readiness) | https://ui5.sap.com/#/topic/28fcd55b04654977b63dacbee0552712 · https://ui5.sap.com/#/topic/b72ccb50eda94ac9b9be454a03ca4213 · https://ui5.sap.com/#/topic/db492368adbe490fa5d4ec7ebd98b187 · https://github.com/UI5/linter | search snippets (fix pass) |
| S22 | SAPUI5: *Content Security Policy* (CSP dos and don'ts), *Make Your App CSP Compliant* | https://ui5.sap.com/#/topic/fe1a6dba940e479fb7c3bc753f92b28c · https://ui5.sap.com/#/topic/1f81a093a9f3433983dcb2ebe11cd4cd | search snippets (fix pass) |
| S23 | *Write OPA Tests for an SAP Fiori Elements for OData V4 Application* (Fiori tools, `sap.fe.test` library, mock server) | https://github.com/sap-tutorials/Tutorials/blob/master/tutorials/fiori-tools-mockserver-opa-testing/fiori-tools-mockserver-opa-testing.md | search snippet (fix pass) |
| S24 | SAPUI5 What's New 1.148: *Sandbox Redesigned* (FLP sandbox compatible with 1.x-legacy-free; for local development and testing) | https://help.sap.com/whats-new/67f60363b57f4ac0b23efd17fa192d60?locale=en-US&Component=40dc77b604f54b21a2faadc7860dc5d7 | `ui5_version_diff` (SAPUI5 1.148.0, validAsOf 2026-05-14) |
| S25 | UI5 TypeScript | https://ui5.github.io/typescript | search hit in sap-docs (existence only; `@sapui5/types` alignment not read) |

**Not reachable / not done**
- developers.sap.com tutorials: no WebFetch/WebSearch tool in this sandbox and `curl` to developers.sap.com and architecture.learning.sap.com returned no connection (github.com reachable, help.sap.com 301). I used only the tutorial entries indexed by the sap-docs MCP (none relevant to Fiori on CF). **SAP Developers missions and SAP-samples were not consulted** — a gap in this research.
- SAP Community: search was run through `search` (online leg active); nothing specific to this scenario was used.
- The MCP servers `cap`, `fiori`, `ui5`, `nova-arc-1` are not connected here; API-level checks are therefore not part of this document.
- `npx skills find` returned nothing even for `react` and `ui5`: the skills registry is **not reachable from this sandbox** (silent empty answer), so "no candidate" below means "not searched successfully", not "none exists".

**Fix-pass verification (sap-docs MCP, search/fetch, on the fix-pass day)**
- **Read in full (V):** the CDN bootstrap page (S17) — states: "SAP removes SAPUI5 versions from the SAPUI5 CDN one year after their end of maintenance", SAP Note 3001696, end dates at versionoverview.html, recommends UI5 Renovate Preset Config, describes Specific / Evergreen (async only) / Default version (do not use in productive or testing).
- **Found by search, page exists, snippet read (V as existence):** draft pages, UI5 linter pages, Modernization Guide, CSP pages, Fiori tools OPA guide, `ui5.github.io/typescript`, SAPUI5 What's New entry "Sandbox Redesigned" 1.148 (via `ui5_version_diff`, validAsOf 2026-05-14), `Common.DraftRoot`.
- **Not verified by me (stay I):** `versionoverview.html` content (no fetch tool), exact end-of-maintenance date of 1.148 (the "May 2027 at the latest" is the reviewer's inference: release 2026-05-14 + maintenance + one year), github.com/UI5/renovate-config content (only the pointer in S17 was read), https://ui5.github.io/cli (not found in the corpus), SAP Note 3001696 (not fetched), manifest page for `sap.fe.templates` (only samples seen).
- Note: the corpus (S17 example, `ui5_version_diff` maxVersion) already shows **1.154.0**, so 1.148 is no longer the newest line.

## 1. Activities by phase

Legend as in §0. "Cov." = playbook step(s) / MANCANTE.

### Phase 1 · Environment (BTP account, subaccount, entitlements)

| # | Activity (what SAP prescribes) | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 1.1 | Subaccount in the target region with the Cloud Foundry environment, org and space; developers get Space Developer in the space | BTP | HAND (admin) / TOOL read-only check | V | S1 ("space developer role"), S2 | BTP_ENVIRONMENT (closed), DEPLOY_PREREQS |
| 1.2 | Entitlements/quotas for the services the MTA uses: HTML5 Application Repository (app-host, app-runtime), Destination, authentication service; Work Zone subscription if a site is used | BTP | HAND (admin); TOOL read-only | V (S4, S7) / I (exact list for this app) | S4, S7 | BTP_ENVIRONMENT, DEPLOY_PREREQS |
| 1.3 | Trust between the subaccount and the identity provider (SAP Cloud Identity Services tenant); one active trust when Work Zone is used | BTP | HAND (admin) | V (trust is the basis of role-collection assignment in S1/S11); "one trust" is a playbook statement | S1, S11 | IDENTITY_SETUP, DEPLOY_PREREQS (state NOT VERIFIED: open request to admins) |
| 1.4 | Subscribe to SAP Build Work Zone, standard edition (only if a site is the access path) | BTP | HAND | V | S1, S6 | DEPLOY_PREREQS; **profile conflict**: BTP_ENVIRONMENT decided "no site, project approuter" while the profile still says Work Zone |
| 1.5 | Developer tooling: SAP Business Application Studio or VS Code + SAP Fiori tools; CF CLI with MTA plugin; `mbt` | REPO/local | TOOL | V | S2, S3, S5 | TOOLKIT_VERIFY, CF_BUILD |
| 1.6 | Developer needs a service to bind the UI to; the BTP guides assume an OData service from RAP/ABAP, CAP or similar ("You have access to a RAP business service exposed as OData") | SYS/BTP | n/a here | V (S2 prerequisites) | S2 | Profile says "no backend": see §3 caveat 1 |

### Phase 2 · Identity and authorization

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 2.1 | Define roles/scopes of the app in the security descriptor (`xs-security.json`) or identity-service configuration; the roles appear in the subaccount when the service instance is created | REPO → BTP | TOOL (generator) + HAND review | V | S11 | AUTH_MATRIX |
| 2.2 | Create role collections from the roles and assign them to users or IdP groups | BTP | HAND (admin) / TOOL (btp CLI/MCP, after confirmation) | V | S11 | CF_ROLES_DEV (dev), PROD_ROLE_ASSIGNMENTS, PROD_ROLES_CHECK |
| 2.3 | With Work Zone: create a role in the site; a role collection is generated automatically in the cockpit, then assigned to business users | WZ → BTP | HAND | V | S1, S6 | WORKZONE_SITE_DEV |
| 2.4 | Test users/groups in the IdP (IAS) | IAS | HAND / TOOL | I | – | IAS_CONFIG_DEV (optional), IDENTITY_PROVISIONING (optional) |
| 2.5 | Application router/OAuth configuration: authentication method, routes, redirect URIs | REPO | TOOL | V (S1: routes in `xs-app.json`) | S1, S4 | APPROUTER_BTP |

### Phase 3 · Design (UX, architecture)

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 3.1 | Choose floorplan (List Report + Object Page), UX design per SAP Fiori guidelines | REPO (docs) | TOOL | I (the SAP Fiori design guidelines were not fetched) | S9 | UX_DESIGN |
| 3.2 | Choose SAPUI5 version (a maintained line; 1.148 per the request). The ABAP-flavoured alignment advice of S1 does not apply here (no ABAP system) | REPO | TOOL | V (version line is a playbook rule; maintenance/removal rule in S17/S18) | S17, S18, S16 | UI5_VERSION_SELECT |
| 3.2a | **Decide how SAPUI5 is loaded on BTP**: *specific* patch (fixed URL), *evergreen* (`1.148`, async bootstrap only, `data-sap-ui-on-init`), *default* (`/resources/...`, **not** for productive or testing environments); the decision fixes what must be upgraded later (G1/G4) | REPO | TOOL + person | V | S17 | UI5_VERSION_SELECT (only the version, not the bootstrap variant) |
| 3.3 | Architecture of the BTP solution (diagram: app, HTML5 repo, approuter, IdP, Work Zone, Cloud ALM) | REPO (docs) | TOOL | V (SAP Architecture Center RA0023 exists; content not read) | S14 | SOLUTION_DESIGN, DIAGRAM_CHECK, DESIGN_APPROVAL |

### Phase 4 · Development of the UI

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 4.1 | Create the MTA project with the approuter configuration (Fiori CF application router generator; SAP recommends the SAP-managed approuter when a Work Zone site is used) | REPO | TOOL (Fiori tools) | V | S1, S2 | LAUNCHPAD_BTP, APPROUTER_BTP |
| 4.2 | Generate the Fiori elements app (Fiori application generator, OData V4 floorplan List Report/Object Page) inside the MTA | REPO | TOOL | V | S1, S2, S9 | FE_GENERATE |
| 4.2a | **Configure the app descriptor `manifest.json`**: data source and OData V4 model (`sap.app/dataSources`, `sap.ui5/models`), routing and targets with `sap.fe.templates.ListReport` / `ObjectPage` and their `settings`, `minUI5Version`, `sap.cloud.service` (see 4.4); generated by the Fiori tools, then reviewed | REPO | TOOL | V (documented; page existence + snippets) | S20 | FE_GENERATE (generation); no step reviews the descriptor settings |
| 4.3 | Annotate the service for list/object page (LineItem, HeaderInfo, Facets…); enable create/edit with draft | REPO / service | TOOL | V for annotations (S9); V that draft is documented as service-side + client `editFlow` (S19); **I** for the combination "no backend + draft" → **open decision**, see top | S9, S19 | FE_ANNOTATIONS |
| 4.3a | **Draft handling**: service exposes the draft actions (`Common.DraftRoot`; `DraftNode` is deprecated in the vocabulary); the app uses `editFlow` and the OData V4 model draft support; configure in `manifest.json` where needed | service + REPO | TOOL | V (documented, snippets) | S19 | FE_ANNOTATIONS; blocked by the open decision |
| 4.4 | Add the FLP configuration (title, semantic object, action — one intent per app; changing the intent breaks existing tiles) and `sap.cloud.service`, `crossNavigation` | REPO | TOOL (`fiori add flp-config`) | V | S1, S8 | LAUNCHPAD_BTP |
| 4.5 | Preview locally (Fiori tools preview, local launchpad) and fix console errors | REPO | TOOL | V | S2, S8 | FE_RUN_CHECK (mock server per FE_GENERATE) |
| 4.6 | TypeScript for the UI5 app; align `@sapui5/types` with the chosen version (1.148) | REPO | TOOL | V that the documentation exists (S25, search hit); alignment of `@sapui5/types` with 1.148 **I** (not read) | S25 | UI5_TYPESCRIPT |
| 4.6a | TypeScript transpile chain in the UI5 build (`ui5-tooling-transpile`, `@sapui5/types`) | REPO | TOOL | I (reviewer's inference; https://ui5.github.io/typescript is the pointer) | S25 | UI5_TYPESCRIPT |
| 4.8 | **FLP sandbox for local run**: SAPUI5 1.148 redesigned the Fiori launchpad sandbox (compatible with the 1.x-legacy-free versions); FE_GENERATE requires `flp.html`, so check that the generated sandbox page works with 1.148 | REPO | TOOL | V (What's New 1.148 "Sandbox Redesigned", S24); impact on this app **I** | S24 | FE_GENERATE / FE_RUN_CHECK |
| 4.7 | Route to the OData service in `xs-app.json` via destination or service binding; destination names must be the same across subaccounts | REPO + BTP | TOOL + HAND (destination) | V | S1 | APPROUTER_BTP; destinations: NON_TRANSPORTED_CONFIG, TEST_SYSTEM_CONFIG (none needed with no backend) |

### Phase 5 · Quality (security, quality gates, tests)

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 5.1 | Lint / static checks of UI5 code with the **UI5 linter** (legacy code, deprecated APIs, readiness for SAPUI5 2.x); optionally validate `manifest.json` against the schema | REPO | TOOL | V (documented, S21; manifest validation: **I**) | S21 | LINT |
| 5.1a | **SAPUI5 2.x readiness**: follow the Modernization Guide for deprecated APIs/controls/themes; the UI5 linter reports them | REPO | TOOL | V (S21) | S21 | LINT (covers it) |
| 5.2 | Dependency and supply-chain checks (SBOM) | REPO | TOOL | I | – | SUPPLY_CHAIN |
| 5.3 | Security review (approuter headers, scopes, no wildcard redirect) | REPO | TOOL | I (BTP security recommendations not read) | S11 | SECURITY_REVIEW, APPROUTER_BTP |
| 5.3a | **Bootstrap is CSP-compliant**: SAPUI5 recommends CSP-compliant apps (external bootstrap script, no inline scripts); the approuter's default CSP (`default-src 'self'`) can break an inline bootstrap or the SAPUI5 CDN origin | REPO | TOOL | V that SAP documents CSP for SAPUI5 (S22); the link to the approuter/playbook step is **I** | S22 | SECURITY_REVIEW (link inferred) |
| 5.4 | Accessibility and end-to-end test of the Fiori elements app; the Fiori tools guide describes OPA tests for Fiori elements for OData V4 (`sap.fe.test` library, mock server) | REPO | TOOL | V (guide exists, S23); requirement **I** | S23 | E2E_A11Y replaces it; UI_TESTS (OPA5) **skipped by rigor**, so not MANCANTE — partial coverage by design |
| 5.5 | i18n completeness | REPO | TOOL | I | – | I18N_COMPLETENESS |
| 5.6 | Code review | REPO | TOOL | I | – | CODE_REVIEW |

### Phase 6 · Build and deploy to development

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 6.1 | Build the MTA archive (`npm run build` / `mbt build` → `*.mtar`, `mta_archives`) | REPO | TOOL | V | S2, S5 | CF_BUILD |
| 6.1a | UI5 side of the build: `ui5 build` (`ui5-deploy.yaml`, Component-preload, minify), `ui5-task-zipper` for the HTML5 repo zip, `--self-contained` if SAPUI5 is not loaded from the CDN, TS transpile (4.6a) | REPO | TOOL | I (reviewer's inference; pointers https://ui5.github.io/cli — not found in the corpus — and https://ui5.github.io/typescript) | S25 | CF_BUILD (the MTA build calls it; no UI5-specific check) |
| 6.2 | CI/CD pipeline: build, test, deploy automatically (SAP Continuous Integration and Delivery is the SAP service; other CI is allowed) | REPO / BTP | TOOL | V (service exists, S14) | S14 | CI_PIPELINE |
| 6.3 | Before deploy, verify entitlements, trust, space role | BTP | TOOL read-only | I (SAP states the requirements; the pre-check as a gate is a playbook design) | S1, S2 | DEPLOY_PREREQS |
| 6.4 | Deploy the MTA to the CF space (`cf deploy` / `npm run deploy`, needs Space Developer); the HTML5 application deployer uploads the UI into the HTML5 Application Repository | BTP | TOOL | V | S1, S2, S4, S5 | CF_DEPLOY_DEV |
| 6.5 | Assign role collections to test users | BTP | HAND/TOOL | V | S11 | CF_ROLES_DEV |
| 6.6 | Check the deployed app from its own URL (approuter) | BTP | TOOL | I | S4 | CF_DEPLOY_CHECK, APP_URL_CHECK |
| 6.7 | MTA deploy troubleshooting (e.g. missing `xs-app.json` error 500 in the HTML5 repo) | BTP | HAND | V | https://help.sap.com/docs/BTP/65de2977205c403bbc107264b8eccf4b/ae1d53e5fbe14383bfafe690f52711d7.html | covered by the failure path of the steps above; no dedicated step |

### Phase 7 · Launchpad / SAP Build Work Zone (only if a site is used)

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 7.1 | Create an IAM-relevant role / assign app to a group and catalog (classic) or to a business role with spaces and pages | WZ | HAND (Work Zone admin; needs Launchpad_Admin) | V | S1, S6 | WORKZONE_SITE_DEV |
| 7.2 | Add content to the HTML5 apps content provider; update it after each deploy | WZ | HAND | V | S1 | WORKZONE_SITE_DEV, LAUNCHPAD_BTP |
| 7.3 | Open the app from the site and verify | WZ | TOOL (run) | V (S7 snippet: app can run from the cockpit and fail from the site; troubleshooting page exists) | S7, BAS "HTML5 app fails to run from SAP Build Work Zone" | WORKZONE_CHECK |
| 7.4 | Alternative: **SAP Application Frontend service** to host the UI (entitlement `application-frontend` already assigned in dev); CAP guide labels it Beta, single-tenant | BTP | TOOL | V (exists, not deprecated, S15) / I (maturity for this app) | S15 | **MANCANTE** (G3) |

### Phase 8 · Operations setup (monitoring, logging)

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 8.1 | Ship application logs to SAP Cloud Logging (instance, OTLP ingest); dashboards | BTP | TOOL | V | S12 | OBSERVABILITY (Cloud Logging *deliberately not assigned* in dev: decision of a person) |
| 8.2 | Register the service in SAP Cloud ALM and activate Health Monitoring / Integration & Exception Monitoring / Real User Monitoring | ALM | HAND (Cloud ALM admin) + TOOL read-only | V for health monitoring existence; RUM for a Fiori app on CF: **I** | S13 | CALM_OPERATIONS, CALM_MONITORING_CHECK |
| 8.3 | Alerts with recipients | ALM | HAND | I | S13 | CALM_OPERATIONS |
| 8.4 | Performance measurement | – | TOOL | I | – | APP_PERFORMANCE (skipped by rigor) |

### Phase 9 · Transport to test and production

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 9.1 | Set up SAP Cloud Transport Management (subscription, service instance, role collections Administrator/Landscape Operator/Import/Export/Viewer) | BTP | HAND (admin) | V (role templates) | S10 | CTMS_SETUP |
| 9.2 | Destinations to the SAP Cloud Deployment service of target spaces (MTA deployment on CF); transport nodes and routes DEV→TEST→PROD | BTP | HAND (admin) | V | S10 | CTMS_SETUP |
| 9.3 | Export the MTA to the dev node; import in TEST (same archive, no rebuild) | BTP | TOOL/HAND | V | S10 | CF_DEPLOY_TEST |
| 9.4 | Integrate with Cloud ALM so transports show in the Features app and the deployment is done from the feature | ALM | HAND (destination) + TOOL | V (integration page exists) / I (details) | S10 | CTMS_SETUP, ALM_FEATURE |
| 9.5 | Re-create what is not transported: destinations created by hand, trust/IdP, role-collection assignments, Work Zone site content when not in the MTA | BTP | HAND | V (S1 says destination must have the same name in the target subaccount) | S1 | TEST_SYSTEM_CONFIG, NON_TRANSPORTED_CONFIG |
| 9.6 | Acceptance test in TEST (UAT) | BTP/ALM | HAND + TOOL | I | – | UAT_TEST, CALM_TEST |
| 9.7 | Rollback/recovery plan (`cf deploy` blue-green with backup of the previous version; HTML5 repo content and bound services don't roll back) | BTP | TOOL | V for MTA commands (S5); limits stated by the playbook | S5 | ROLLBACK_PLAN |

### Phase 10 · Production release

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 10.1 | Prepare the production subaccount (entitlements, trust, destinations, role collections) | BTP | HAND (admin) | I (same prerequisites as 1.1–1.4) | S1, S10 | BTP_PROD_ENVIRONMENT (test/prod are read only) |
| 10.2 | Go-live approval (change management) | – | HAND | I | – | GO_LIVE_APPROVAL |
| 10.3 | Import the tested MTA in production by the Import Operator; check Succeeded | BTP | HAND/TOOL | V | S10 | RELEASE_CF_PROD |
| 10.4 | Assign production role collections to IdP groups | BTP | HAND (prod admin) | V | S11 | PROD_ROLE_ASSIGNMENTS, PROD_ROLES_CHECK |
| 10.5 | Production site content (if Work Zone) | WZ | HAND | V | S1 | RELEASE_CF_PROD, NON_TRANSPORTED_CONFIG |
| 10.6 | Smoke test in production | BTP | TOOL | I | – | SMOKE_PROD |
| 10.7 | Record the deployment in Cloud ALM (feature Deployed), monitoring live | ALM | HAND + TOOL | V (S10 integration) / I | S10, S13 | CALM_DEPLOYED, CALM_MONITORING_CHECK |

### Phase 11 · Operation after go-live and handover

| # | Activity | Where | How | Ev. | Source | Cov. |
|---|---|---|---|---|---|---|
| 11.1 | Release notes, functional and technical documentation, user/admin guides | REPO | TOOL | I | – | RELEASE_NOTES, FUNCTIONAL_DOCS, TECH_DOCS, DOCS_*, INSTALL_CONFIG_GUIDE, USER_GUIDE, GUIDE_CHECK |
| 11.2 | Landscape as code / reproducibility of the BTP setup | BTP | TOOL | I | – | BTP_LANDSCAPE_EXPORT |
| 11.3 | Handover to the customer and closure | – | HAND | I | – | HANDOVER_APPROVAL |
| 11.4 | **Maintenance of the running app**: keep SAPUI5 on a maintained version — SAP **removes SAPUI5 versions from the CDN one year after their end of maintenance** (and patches older than one year), SAP Note 3001696; end dates at versionoverview.html; 1.148 was released 2026-05-14, so it leaves the CDN at the latest around May 2027 (**inferred**: date from the reviewer, versionoverview.html not read). SAP recommends the **UI5 Renovate Preset Config** (https://github.com/UI5/renovate-config/) to be aware of version changes and upgrade in a controlled way; cover `@sapui5/types`, the `ui5.yaml` version and the bootstrap/destination version; also patch the approuter and npm dependencies and redeploy through the pipeline | REPO/BTP | TOOL | V (S17 read in full: CDN rule, Note, Renovate recommendation; S18); exact 1.148 horizon **I** | S17, S18, S16, S14 | **MANCANTE** (G1, G4); partial: Dependabot/Renovate only for the approuter (APPROUTER_BTP) |
| 11.5 | **Support / incident handling and hypercare** after go-live: who receives the Cloud ALM alerts, escalation, runbook | ALM/organisation | HAND | I (S13 describes alerting, not the support process) | S13 | **MANCANTE** (G2) — only the alert recipients are covered (CALM_OPERATIONS) |

**Total: 69 activities (61 original + 8 added in the fix pass)** (1.1–1.6, 2.1–2.5, 3.1–3.3 + 3.2a, 4.1–4.7 + 4.2a, 4.3a, 4.6a, 4.8, 5.1–5.6 + 5.1a, 5.3a, 6.1–6.7 + 6.1a, 7.1–7.4, 8.1–8.4, 9.1–9.7, 10.1–10.7, 11.1–11.5).

## 2. Comparison with the playbook — MANCANTE

| ID | Activity | Why it is missing | Skill search (`npx skills find`) |
|---|---|---|---|
| G1 | Post-go-live maintenance: SAPUI5 version line and dependency/approuter patching, redeploy through the pipeline. Documented horizon: SAP removes SAPUI5 versions from the CDN one year after end of maintenance (S17, Note 3001696) | The playbook chooses the UI5 version once (UI5_VERSION_SELECT) and has no step that sets how the app is kept maintained after release; only the approuter gets an update rule | not searched successfully (registry unreachable); queries tried: "ui5 upgrade", "sapui5 version maintenance", `--owner sap`. No candidate. |
| G2 | Support, incident handling and hypercare for the released app (who gets the alerts, escalation, runbook) | CALM_OPERATIONS defines alert recipients, HANDOVER_APPROVAL closes the development; nothing defines the support model after handover | not searched successfully; queries "runbook incident support handover", "hypercare". No candidate. |
| G3 | SAP Application Frontend service as an alternative to HTML5 Application Repository + approuter for hosting the UI (entitlement already assigned in the dev subaccount) | Playbook and request only cover HTML5 repo + approuter; BTP_ENVIRONMENT assigned `application-frontend`, so the choice is open and undocumented. Docs call it Beta (CAP) — **a decision for the team, not necessarily a gap to fill** | not searched successfully; queries "application frontend service", "btp application frontend". No candidate. |
| G4 | Automated SAPUI5 version lifecycle: UI5 Renovate Preset Config for `ui5.yaml`, `@sapui5/types`, bootstrap/destination version (part of G1, recorded separately because SAP recommends a concrete tool) | Playbook mentions Renovate/Dependabot only for `@sap/approuter` | not searched (registry unreachable). **Report to configurator: pending** — `nova-config.mjs gap f17d5823-… --step SCENARIO_RESEARCH` failed: configurator not reachable (localhost:4004 ECONNREFUSED, no login); to be re-sent when reachable |

Not counted as MANCANTE (judged out of scope for a tiny dummy, **inferred**): custom domain, data-protection/GDPR review (no personal data, no backend), decommissioning, cost estimation.

## 3. Caveats and points for a decision

1. **"No backend" vs documentation — OPEN DECISION, see the section at the top.** SAP's guides assume a real OData service (S2 prerequisites). Fiori elements V4 with **draft** needs a service that implements draft; with no backend the app only works on the local mock (FE_GENERATE: `sap-fe-mockserver`). On BTP the deployed app will show no data and create/edit cannot persist; APP_URL_CHECK/WORKZONE_CHECK say "with the data of the backend". Whether the mock draft behaviour is faithful I did **not** verify (I). Draft is documented (S19) as service-side plus client `editFlow`.
2. **Profile conflict.** BTP_ENVIRONMENT decided: no Work Zone site, project approuter; the profile (CLAUDE.md, PLAYBOOK profile) still says Work Zone standard, spaces and pages. Phase 7 and 10.5 apply only if the profile is changed back. Also S1: **IAS trust required** for Work Zone, and trust is NOT VERIFIED.
3. **Unverified subaccount state**: trust, subscriptions, role collections (403) — blocks 1.3, 1.4, 2.2 until admins answer.
4. **Cloud Logging not assigned** on purpose in dev: 8.1 is only partly executable; Cloud ALM RUM/health data (8.2) depends on OpenTelemetry instrumentation, which is **I** for a Fiori-only app without a Node service.
5. Test and production are read only: 9.x and 10.x are prepared lists for administrators, not executed here.
6. Evidence is mostly search snippets (V-snippet), two pages read in full (S1, S2). Several V marks on Work Zone and CTMS rest on snippets whose pages are ABAP/other-product flavoured; a challenger should recheck 7.x and 9.x with the product pages of SAP Build Work Zone and SAP Cloud Transport Management on help.sap.com.
7. **Fix-pass caveats.** (i) The 1.148 maintenance end date is inferred, not read from versionoverview.html; the corpus already contains 1.154. (ii) The playbook example "1.136.x" is outdated (reviewer finding, rejected for this document: the playbook belongs to the installer). (iii) S9's URL (topic 1cf5c7f…) was rejected as a finding: the fetch of the list-report page worked on 2026-11-19. (iv) Rows 4.6a, 6.1a (UI5 build chain) are inferred.

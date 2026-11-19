# Specification · Sample

Step REQUIREMENTS_SPEC · written 2026-11-19 · author: developer agent (Nova WOLF, unattended run) · status: **draft, revised after A-03's change request at SPEC_APPROVAL (no data on CF, D4) and again after A-03's second review (D1 quoted as written, D4 and D5 as the Lead's readings, C5 settled); waiting for SPEC_APPROVAL (A-03)**.

New development, so there is no starting state to compare against. The request does not name a functional owner or any documents.

**Sources:** `.claude/nova/REQUEST.md`, the profile in `.claude/nova/PLAYBOOK.md`, `CLAUDE.md`, `docs/research.md` (with the decision on draft and no backend), and `docs/handoff.md` (the person's decisions and the SPEC_APPROVAL choice).
**Not used:** SAP Cloud ALM. c.ferraro@key2.it decided on run c8561bcd that this development does not work with Cloud ALM, so this spec has no Cloud ALM IDs and its requirements are not copied there.

## 1. Request and goal

The request in full: *"Applicazione dummy per prova. fai una cosa minima solo per vedere il funzionamento"* ("Dummy application for a test. Build the minimum, only to see how it works").

**Goal.** Build the smallest SAP Fiori elements app that takes the NOVA procedure through development:
- a List Report and an Object Page on OData V4, run on local mock data;
- create and edit with draft, on the local mock;
- TypeScript and SAPUI5 1.148;
- deployed to SAP BTP Cloud Foundry (development subaccount `dev-emykt6ie` only, D5), opened through the project's application router, with **no data on CF** (D4).

The app has no business purpose. Success means the procedure runs and every acceptance criterion below passes. It does not mean a business result.

**Settled decisions this spec follows:**

| # | Decision | By / where |
|---|---|---|
| D1 | **No backend, minimal test app.** The person's choice, as recorded in `docs/handoff.md` (run f81a98e6): *"Choice: no backend, minimal test app as the request says (option b)"*. `docs/research.md` (line 23) records it as: *"Decision (c.ferraro@key2.it, run f81a98e6-…): no backend; minimal test app as the request says (option b). Mock data, draft is not persisted on CF; §1 rows 1.6, 4.3, 6.6 and caveat 1 are read in that way (no backend, the checks 'with the data of the backend' use a mock-data criterion)."* The person's words are "no backend, minimal test app". "Mock data on CF" comes from the research's description of option (b) and from the note added to the decision, not from the person's words. | c.ferraro@key2.it, run f81a98e6, `docs/handoff.md`, `docs/research.md` |
| D2 | No SAP Build Work Zone site. The app is opened through the project's own application router. | developer, BTP_ENVIRONMENT, `docs/handoff.md` |
| D3 | No SAP Cloud ALM. | c.ferraro@key2.it, run c8561bcd, `CLAUDE.md` |
| D4 | No data component on CF (option iii). This is **the Lead's reading of D1**, not a choice the person made: a mock OData V4 service running on CF would itself be a backend-like component (§4.3), which contradicts the person's words "no backend". On CF the app is checked only for login redirect, start of its own resources, 403 without role, the console (AC-06.2, C5) and security headers. List data, create, edit and draft are verified on the local mock only. | Lead, on c.ferraro's standing instruction (*"do not stop for choices the request already resolves"*), `docs/handoff.md` "SPEC_APPROVAL: A-03 asked for a change". **For c.ferraro to confirm**, or change with `spec-change`. |
| D5 | Scope decision: the app does not go past the development subaccount in this spec (§6). | Lead, same instruction and section of `docs/handoff.md`. **For c.ferraro to confirm**, or change with `spec-change`. |

**Profile conflicts.** The PLAYBOOK profile still says "Site di SAP Build Work Zone, standard edition" and "SAP Cloud ALM: Sì". This spec follows D2 and D3. Changing the profile in the configurator is open (see §9, C1).

## 2. Actors and roles

| Actor | Description | Role (name is set in AUTH_MATRIX) |
|---|---|---|
| App user | A test user of the development subaccount who signs in through the subaccount's application identity provider (IAS tenant `aww4s9pgx`). | **One application role** that grants access to the deployed app. On CF there is no data (D4), so display, create and edit are used only on the local mock. |
| User without the role | An authenticated user who has not been assigned the app's role collection. | none: no access (REQ-07) |

There is no administrator, approver or display-only role. On the local mock there is no login: every function is open (see A5).

## 3. Requirements and user stories

**IDs:**
- REQ-nn is a functional requirement.
- US-nn is a user story.
- AC-nn.m is an acceptance criterion of US-nn.

**Where each criterion is verified:**
- **Local** = the app served by the UI5 tooling dev server with the SAP Fiori tools mock server middleware (sap-fe-mockserver, `ui5-mock.yaml`, `npm run start-mock`, as FE_GENERATE prescribes), on the mock data of §4.2. This is a local simulation of the OData V4 service, not a deployed service. **FE_RUN_CHECK records a pass or fail result for every Local criterion** (AC-01.1 to AC-05.3), one line per criterion, in its evidence. This extends the step's check for this development; it does not change the playbook. E2E_A11Y repeats only its smoke path (§7).
- **CF** = the deployed app opened from the application-router URL in the development subaccount, used by APP_URL_CHECK. There is no data on CF (D4).

### Requirements

| ID | Requirement |
|---|---|
| REQ-01 | The app shows the items of the mock data set in a List Report with a filter bar and a table. |
| REQ-02 | Selecting an item opens its Object Page, with a header and one section of fields. |
| REQ-03 | The user can create a new item. The new item is a draft until it is saved. |
| REQ-04 | The user can edit an existing item through a draft: changes are saved by Save and thrown away by Discard. |
| REQ-05 | The app has no backend. All data comes from a mock OData V4 data set that ships with the app and is served only by the local mock server. Changes last only as long as the running mock. No data service, mock or otherwise, is deployed to CF (§4.3, D4). |
| REQ-06 | The app is deployed to SAP BTP Cloud Foundry, development subaccount only, and is opened from the URL of the project's application router. There is no Work Zone site. |
| REQ-07 | Only authenticated users who have the app role can open the deployed app. |

### US-01 · See the list of items (REQ-01, REQ-05)
*As an app user I want to see the items in a list, so that I can find one.*

- **AC-01.1** · Local
  - Given the mock data set of 10 items (§4.2),
  - when I open the app,
  - then the List Report shows a table with the columns **Title** and **Description**, the table loads its rows without me pressing Go, and the table title shows the count (10).
- **AC-01.2** · Local
  - Given the List Report,
  - when I enter `Item 01` in the **Title** filter field and press Go,
  - then the table shows only the item `Item 01`; when I clear the filter and press Go, all 10 items are shown again.
- **AC-01.3** · Local
  - Given the List Report,
  - when the table has loaded its rows,
  - then no **Delete** button is shown in the table toolbar (deleting is out of scope, §6).

### US-02 · Open an item (REQ-02)
*As an app user I want to open an item, so that I can see all its fields.*

- **AC-02.1** · Local
  - Given the List Report,
  - when I select the row of an item,
  - then its Object Page opens in display mode.
  - The header shows the item's **Title** as the object title and the type name **Item**.
  - A section **General Information** shows Title and Description.
  - An **Edit** button is shown.
- **AC-02.2** · Local
  - Given the Object Page,
  - when I use the browser's back navigation or the app's back button,
  - then I return to the List Report and my filter values are still there.

### US-03 · Create an item with draft (REQ-03, REQ-05)
*As an app user I want to create an item, so that I can see how the create flow works with a draft.*

- **AC-03.1** · Local
  - Given the List Report,
  - when I choose **Create**,
  - then an Object Page opens in edit mode for a new draft, with empty fields.
- **AC-03.2** · Local
  - Given the new draft,
  - when I enter a Title and choose **Save** (also called Create),
  - then the item is activated, the Object Page switches to display mode, a confirmation message is shown, and back in the List Report the table contains the new item and the count has gone up by 1.
- **AC-03.3** · Local
  - Given the new draft with an empty Title,
  - when I choose Save,
  - then the item is not saved, the Title field is marked as an error, and a message tells me that a required field is empty (M1).
- **AC-03.4** · Local
  - Given the new draft,
  - when I choose **Discard** (or Cancel) and confirm,
  - then the draft is deleted and no new item appears in the List Report.

### US-04 · Edit an item with draft (REQ-04, REQ-05)
*As an app user I want to change an item, so that I can see how the edit flow works with a draft.*

- **AC-04.1** · Local
  - Given an item's Object Page in display mode,
  - when I choose **Edit**,
  - then the page switches to edit mode on a draft of that item.
- **AC-04.2** · Local
  - Given the draft,
  - when I change the Description and choose **Save**,
  - then the page returns to display mode with the new Description, a confirmation message is shown, and the List Report shows the new value.
- **AC-04.3** · Local
  - Given the draft with changes,
  - when I choose **Discard** and confirm,
  - then the page returns to display mode and the item keeps its previous values.
- **AC-04.4** · Local
  - Given the draft,
  - when I clear the Title and choose Save,
  - then the change is not saved and message M1 is shown (as in AC-03.3).

### US-05 · Leave and resume an unsaved draft (REQ-03, REQ-04, REQ-05)
*As an app user I want an unsaved change to stay as a draft when I leave the page, so that I can see what "draft" means.*

- **AC-05.1** · Local
  - Given a draft with unsaved changes,
  - when I leave the Object Page to go back to the List Report and choose to keep the draft (if the app asks),
  - then the List Report shows that item with a draft indicator.
- **AC-05.2** · Local
  - Given an item with a draft indicator,
  - when I open it,
  - then the Object Page opens the draft in edit mode with my unsaved changes, and I can Save or Discard as in US-04.
- **AC-05.3** · Local
  - Given drafts and saved changes in the running mock,
  - when the mock server is restarted,
  - then the List Report again shows exactly the 10 initial items and no drafts (data is reset, §4.3).

### US-06 · Open the deployed app on BTP (REQ-06, REQ-07)
*As an app user I want to open the app from its URL on BTP, so that I can see that it is deployed and protected outside the developer's machine. It shows no data there (D4).*

- **AC-06.1** · CF
  - Given I have no session,
  - when I open the application-router URL,
  - then I am sent to the login page of the subaccount's application identity provider, and after login I come back to the app.
- **AC-06.2** · CF (C5, settled)
  - Given I am logged in and have the app role,
  - when I open the application-router URL,
  - then the app's own resources load: the router serves the app's start page, the SAPUI5 1.148.x bootstrap and the app's `Component-preload.js` with HTTP 200;
  - the request for the service (`$metadata`) fails: on CF the app has no data service (D4), so this failure is **expected and accepted**;
  - the browser console shows no error other than the failed service request. Any other console error fails the criterion.
- **AC-06.3** · CF
  - Given I am logged in **without** the app role,
  - when I open the application-router URL,
  - then I get HTTP 403 and the app does not start.
- **AC-06.4** · CF
  - Given I am logged in with the app role,
  - when I open the application-router URL,
  - then the response of the start page carries the security headers of NFR-SEC-03 (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`).
  - *History:* until the A-03 review this criterion was "create and edit on CF work as locally, changes lost at restart" (A3). D4 removed it; the ID is kept.

## 4. Data, rules and messages

### 4.1 Entity `Item` (entity set `Items`, draft root)

| Field | OData type | Label (i18n) | Rules |
|---|---|---|---|
| `ID` | `Edm.Guid`, key | — (hidden) | Generated when an item is created; never shown or edited. |
| `Title` | `Edm.String`, MaxLength 60 | Title | Required. Shown in the List Report column and filter, and as the Object Page title. |
| `Description` | `Edm.String`, MaxLength 255 | Description | Optional. Shown in the List Report column and the Object Page. |
| draft fields | `IsActiveEntity`, `HasActiveEntity`, `HasDraftEntity`, `DraftAdministrativeData` | — | Standard OData V4 draft fields, from the draft annotation `Common.DraftRoot` on `Items`. The user never edits them. |

**Capabilities:**
- Items can be inserted and updated.
- Items cannot be deleted (`DeleteRestrictions/Deletable: false`).
- There are no actions, value helps, child entities or navigation to other apps.

### 4.2 Mock data
- 10 items, `Item 01` … `Item 10`, each with a short Description.
- Shipped in the app's `webapp/localService` folder (as FE_GENERATE prescribes) and read only by the local mock server.
- **Fictitious only: no personal data**, no real names, e-mails or customer data. Audit logging is not needed on that basis (handoff, BTP_ENVIRONMENT).

### 4.3 What "draft" means with mock data (D1, D4)

| | Local mock (`start-mock`) | Deployed on CF |
|---|---|---|
| Where the data lives | In the memory of the local mock server process | **Nowhere.** No OData service, mock or otherwise, runs on CF (D4). |
| Draft behaviour | Full Fiori elements draft flow, as the mock server implements it: Edit/Create creates a draft, Save activates it, Discard deletes it, an unsaved draft stays and can be resumed (US-03 to US-05) | None. Not tested on CF. |
| Persistence | **None.** A restart resets the data to the 10 initial items. Drafts and saved changes survive a browser reload only while the process runs. | Not applicable. |
| Draft locking between users | Not required, not tested | Not applicable |

"Draft" here means the client-side draft flow of Fiori elements for OData V4 (`editFlow`), driven against the local mock server, which answers the draft protocol. It does **not** mean durable storage of drafts. Whether the mock server follows the draft protocol faithfully is not verified (research §3, caveat 1). FE_RUN_CHECK verifies it on US-03 to US-05, on the local mock only.

**Why there is no data on CF (D4).** Mock data on CF would need a running OData V4 service process, because a Fiori elements V4 app sends `$metadata` and `$batch` requests that static files cannot answer. That process is a backend-like component, which contradicts D1. The client-side `sap.ui.core.util.MockServer` covers only OData V2 and JSON; for OData V4, SAPUI5 points to CAP Node.js mocking (https://ui5.sap.com/#/topic/69d3cbd4150c4ffb884e788f7f60fd93). So on CF the app has no service to call: its `$metadata` request fails, and that failure is expected and accepted (AC-06.2, C5).

### 4.4 Messages
The app adds **no messages of its own**. Every message comes from SAP Fiori elements or SAPUI5, in the language of the user (§5, NFR-LANG).

| ID | When | Message |
|---|---|---|
| M1 | Save with an empty required field (AC-03.3, AC-04.4) | The framework's standard required-field message on the field, and in the message popover if one is shown. If the mock server does not reject the save on its own, the mock must reject it (A4). |
| M2 | Successful Save (AC-03.2, AC-04.2) | The framework's standard confirmation, for example "Object created" or "Your changes have been saved" (wording belongs to the framework). |
| M3 | Discard of a draft with changes (AC-03.4, AC-04.3) | The framework's standard discard confirmation. |
| M4 | Leaving the page with an unsaved draft (AC-05.1) | The framework's standard keep/discard prompt, if this SAPUI5 version shows one. |

Every visible text that the app defines (app title, entity name, field labels, section title) is an i18n key. No text is hard-coded.

## 5. Non-functional requirements

Each threshold names the step that checks it. With STANDARD rigor, APP_PERFORMANCE and UI_TESTS are skipped. There is no data on CF (D4), so the performance values are measured by hand on the **local mock run** in FE_RUN_CHECK. Local numbers have no network latency, no authentication and no production build: they show only that the app is not grossly slow, not how it performs deployed (A10).

| ID | Requirement and threshold | Verified in |
|---|---|---|
| **NFR-PERF-01** | Local mock run, desktop browser with a warm cache: the List Report table shows its rows within **3 s** of navigation start (median of 3 runs). | FE_RUN_CHECK (browser DevTools timing) |
| **NFR-PERF-02** | Local mock run: opening an item from the List Report shows the Object Page header and section within **1.5 s** (median of 3 runs). | FE_RUN_CHECK |
| **NFR-PERF-03** | The data requests of the List Report and Object Page are sent in OData `$batch` (local mock run). The deployed app uses an async SAPUI5 bootstrap and loads a `Component-preload.js` from the build (CF, AC-06.2). | FE_RUN_CHECK, APP_URL_CHECK, CODE_REVIEW |
| **NFR-A11Y-01** | WCAG 2.2 level AA: **0 serious or critical** axe violations on the start page (List Report) and on one detail page (Object Page in display mode), as the playbook's STANDARD smoke run prescribes (local mock run). **Added by this spec on top of the playbook:** the same threshold on the Object Page in edit mode, a Local check. | E2E_A11Y (axe on the start page and one detail page); edit mode: Local, axe in the same local run, recorded with the E2E_A11Y evidence |
| **NFR-A11Y-02** | Every user story (US-01 to US-05) can be completed with the **keyboard only**. Every input field has a visible label taken from i18n. | E2E_A11Y smoke path for list, open, edit, save; manual check for create, discard and resume, recorded in FE_RUN_CHECK |
| **NFR-A11Y-03** | No custom CSS or custom controls. The app works with the default SAP Horizon theme and with the Horizon high-contrast themes (`sap_horizon_hcb`, `sap_horizon_hcw`) with no lost content. | E2E_A11Y, manual check |
| **NFR-SEC-01** | On CF, every app route needs authentication: a request without a session is redirected to the IdP login (AC-06.1). No route that serves the app has `authenticationType: none`; only the public SAPUI5 routes (`/resources`, `/test-resources`) may. | APP_URL_CHECK, SECURITY_REVIEW |
| **NFR-SEC-02** | On CF, a user without the app role receives **403** on the app (AC-06.3). | APP_URL_CHECK, AUTH_MATRIX |
| **NFR-SEC-03** | The router sends `Content-Security-Policy` (default-src 'self'; SAPUI5 only from the `ui5` destination or ui5.sap.com; frame-ancestors 'self'), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff` and `Referrer-Policy` (AC-06.4). The OAuth redirect URI is limited to the router host. | SECURITY_REVIEW, APPROUTER_BTP, APP_URL_CHECK |
| **NFR-SEC-04** | **0 secrets** in the repository. **0 known high or critical vulnerabilities** in the npm dependencies (app and router) at deploy time, or an approved exception. An SBOM is produced. | SECURITY_REVIEW, SUPPLY_CHAIN |
| **NFR-SEC-05** | The mock data contains no personal data (§4.2). | CODE_REVIEW |
| **NFR-LANG-01** | Languages: **English** (`i18n.properties`, the fallback) and **Italian** (`i18n_it.properties`), with **0 missing keys** and **0 hard-coded texts** in both. The app follows the browser or logon language, and other languages fall back to English (A6). | I18N_COMPLETENESS |
| **NFR-COMP-01** | SAPUI5 **1.148.x**, the same patch in the `ui5` destination and the bootstrap. Desktop browsers: current Google Chrome and Microsoft Edge (A7). | UI5_VERSION_SELECT, APP_URL_CHECK |
| **NFR-MAINT-01** | When RELEASE_AUDIT runs, SAPUI5 1.148 is still in maintenance on versionoverview.html. If it is not, a person decides on a version upgrade (research gaps G1, G4). | UI5_VERSION_SELECT, RELEASE_AUDIT |

## 6. Out of scope

- **A real backend**: a CAP or RAP service, a database, or any SAP system. Destinations to back-end systems are not needed.
- **Any data service on CF**, including a mock OData service (D4). On CF there are no list data, no create, no edit and no draft.
- **Going past the development subaccount** (D5). Test, transport and production (for example UAT_TEST, CTMS_SETUP, GO_LIVE_APPROVAL, BTP_PROD_ENVIRONMENT, PROD_ROLE_ASSIGNMENTS, RELEASE_CF_PROD, PROD_ROLES_CHECK, SMOKE_PROD) are a person's job. This spec sets no criteria for them.
- **Durable storage of data or drafts** (D1).
- **Deleting items**, actions, value helps, child entities and attachments.
- **Draft locking and collaboration between users**, and conflict handling.
- **SAP Build Work Zone**: no site, tile, spaces or pages (D2). There is also no navigation by intent to other apps and no launchpad personalisation. A local FLP sandbox (`flp.html`) exists only for the local run (FE_GENERATE).
- **SAP Cloud ALM**: no requirements, user stories, features or monitoring (D3).
- **Phone and tablet testing**, and offline use.
- **Custom UI extensions** (profile: "Estensioni custom della UI: No") and AI features.
- **A support or hypercare model** (research gap G2): this is a dummy with no users to support (A8).
- **SAP Application Frontend service** as hosting (research gap G3): D2 chose the project's approuter.

## 7. Traceability (for SPEC_APPROVAL)

| Requirement | User stories | Acceptance criteria | NFR | Verifying steps |
|---|---|---|---|---|
| REQ-01 | US-01 | AC-01.1–01.3 | PERF-01, PERF-03, A11Y-01/02 | FE_RUN_CHECK, E2E_A11Y (smoke: open list) |
| REQ-02 | US-02 | AC-02.1–02.2 | PERF-02, A11Y-01/02 | FE_RUN_CHECK, E2E_A11Y (smoke: open item) |
| REQ-03 | US-03, US-05 | AC-03.1–03.4, AC-05.1–05.3 | A11Y-02 | FE_RUN_CHECK only |
| REQ-04 | US-04, US-05 | AC-04.1–04.4, AC-05.1–05.2 | A11Y-01/02 | FE_RUN_CHECK; E2E_A11Y (smoke: edit, save) |
| REQ-05 | US-01, US-03, US-04, US-05 | AC-01.1, AC-05.3 | SEC-05 | FE_RUN_CHECK; CF_DEPLOY_CHECK (no data service deployed) |
| REQ-06 | US-06 | AC-06.1, AC-06.2, AC-06.4 | PERF-03, COMP-01, SEC-03 | CF_DEPLOY_CHECK, APP_URL_CHECK |
| REQ-07 | US-06 | AC-06.1, AC-06.3 | SEC-01/02 | AUTH_MATRIX, CF_ROLES_DEV, APP_URL_CHECK |

**What each step covers.**
- **FE_RUN_CHECK** records a pass or fail result for each of the 16 Local criteria (AC-01.1 to AC-05.3), plus NFR-PERF-01/02 and the manual part of NFR-A11Y-02. It is the only step that verifies create, Discard, the required-field rule and leaving and resuming a draft.
- **E2E_A11Y**, at STANDARD rigor, runs only a smoke path: open the list, open an item, edit, save. As the playbook says, axe runs on the start page (List Report) and on one detail page (Object Page); this spec adds the Object Page in edit mode as a Local check (NFR-A11Y-01). It does not cover create, Discard or resuming a draft.
- **APP_URL_CHECK** covers the 4 CF criteria (AC-06.1 to AC-06.4) and nothing that needs data.
- **Cross-cutting NFRs.** NFR-A11Y-03, NFR-SEC-04, NFR-LANG-01 and NFR-MAINT-01 are not traced to a single requirement: they apply to the whole app and are checked in the steps that §5 names for each.

**Totals:** 7 requirements (REQ-01 to REQ-07), 6 user stories (US-01 to US-06), 20 acceptance criteria (16 Local, 4 CF), 14 non-functional requirements (PERF 3, A11Y 3, SEC 5, LANG 1, COMP 1, MAINT 1).

## 8. Assumptions

The request says only "minimal dummy", so everything below was decided by the author unless the row says otherwise. None of it was confirmed by a person.

| ID | Assumption | Why | If wrong |
|---|---|---|---|
| A1 | One entity, `Item`, with Title (required) and Description. No other fields. | This is the least that shows a list, a detail, a required-field rule and edit. The request names no business object. | Change §4.1 through `spec-change`. |
| A2 | 10 fictitious mock items. | Small, readable, and the List Report needs no paging. | Change §4.2. |
| A3 | **Resolved by D4: no data on CF.** *History:* the first draft assumed that on CF, create and edit with draft would work against an in-memory mock data source (old AC-06.4), with a display-only fallback (C2). At SPEC_APPROVAL, A-03 found that this needs a running OData V4 mock service on CF, a backend-like component that contradicts D1 (§4.3). The Lead chose option (iii). | Smallest reading of the request and D1: no runtime data component on CF. | c.ferraro can change D4 with `spec-change`, to (i) a writable mock service on CF or (ii) a read-only one. Either one brings back a service component and its CF criteria. |
| A4 | The required Title is enforced on Save: by Fiori elements on the client, or else by the local mock (the mock server's hook for custom logic). | A required-field rule needs someone to enforce it, and there is no backend. | Drop AC-03.3 and AC-04.4. |
| A5 | The local mock has no authentication. Roles are tested only on CF. | The usual Fiori tools mock setup. | — |
| A6 | Languages EN (fallback) and IT. | The requester and team work in Italian, and English is the SAPUI5 fallback. | Change NFR-LANG-01 (EN only, or other languages). |
| A7 | Supported browsers: desktop Chrome and Edge, current versions. | Nothing is asked. These are within the SAPUI5 1.148 supported list. | Add browsers to NFR-COMP-01. |
| A8 | No support or hypercare model, and no operational monitoring beyond the playbook steps (Cloud Logging is deliberately not assigned in dev). | Dummy app. | Add a support section. |
| A9 | One role for all functions, no display-only role. | Minimal. The playbook checks still need a role to test 403. | AUTH_MATRIX adds roles. |
| A10 | The thresholds of NFR-PERF-01 (**3 s**) and NFR-PERF-02 (**1.5 s**) were chosen by the author. The request gives none. They apply to the local mock run and are indicative only (§5). | A threshold is needed to make the NFR testable. | Change the values through `spec-change`, or drop NFR-PERF-01/02. |

## 9. Open points for a person (do not block the spec)

- **C1 · Profile conflict.** Change the configurator profile to "no Work Zone site, project approuter" and "SAP Cloud ALM: No", then apply the new manifest. Until then, LAUNCHPAD_BTP, WORKZONE_SITE_DEV and WORKZONE_CHECK, and the CALM_* steps, are still listed in the playbook. APPROUTER_BTP and APP_URL_CHECK say "with the data of the backend". **APP_URL_CHECK's own check cannot be met as written:** its check (*"login, app avviata, dati letti con l'utente di test, 403 senza ruolo; console senza errori"*) and its instruction (*"riceve 403 dal servizio"*) assume a data service. Under D4 there is no data to read with the test user, no service to return 403, and the failed service request leaves an error in the console (AC-06.2, C5). This spec checks AC-06.1 to AC-06.4 instead. That is a **deviation to be decided when the APP_URL_CHECK gate is closed**; this spec does not decide it. Under D4 the 403 without role comes from a route scope on the application router, not from a service: AUTH_MATRIX must check that the route scope is defined. There are no write calls on CF, so the CSRF part of APP_URL_CHECK does not apply.
- **C2 · A3 (resolved).** *History:* C2 asked a person to confirm create and edit on CF with in-memory mock data, or to choose the display-only fallback. A-03 then asked for a change at SPEC_APPROVAL, and the Lead chose option (iii), no data on CF (D4, `docs/handoff.md`). c.ferraro can confirm or change it with `spec-change`.
- **C3 · Unverified BTP state.** The trust between `dev-emykt6ie` and IAS `aww4s9pgx` is NOT VERIFIED (403, handoff). AC-06.1 and AC-06.3 depend on it, so the request to the BTP administrators must be answered before DEPLOY_PREREQS.
- **C4 · SAPUI5 line.** The research notes that 1.154 already exists. The profile fixes 1.148, and UI5_VERSION_SELECT confirms it (NFR-MAINT-01).
- **C5 · What the app shows on CF without a service (D4) (settled).** A Fiori elements V4 app builds its pages from the service `$metadata`. With no service on CF, that request fails, and the app may show an error page instead of the List Report. Settled with option (a): on CF the app has no data service, the failed service request is expected and accepted, and AC-06.2 checks that the app's own resources load with HTTP 200 and that the console has no error other than the failed service request. *Optional improvement for SOLUTION_DESIGN:* find a way to start the app on CF with no data service (old option b); if it does, AC-06.2 still holds. Changing D4 to option (i) or (ii) remains possible only through `spec-change`.

## 10. Process flow

No diagram. The flow is the standard Fiori elements List Report → Object Page → Edit/Create → Save/Discard, with a single entity and a single role, so a draw.io diagram would add nothing to §3. UX_DESIGN draws the wireframes.

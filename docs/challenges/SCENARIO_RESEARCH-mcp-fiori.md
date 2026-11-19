# SCENARIO_RESEARCH · challenger mcp-fiori (Fiori elements angle)

Reviewer: independent read-only thread (fiori-mcp not connected; used sap-docs search/fetch and ui5_version_diff). Verdict: IMPROVES. Report transcribed by the Lead from the reviewer's message (the reviewer could not write under .claude/nova).

## Findings

1. HIGH. The Fiori elements core is missing: manifest.json app descriptor (data source and OData V4 model, routing, `sap.fe.templates` page settings, `minUI5Version`, `sap.cloud.service`). Documented in SAPUI5. Fix: add activities with sources. ACCEPTED.
2. HIGH. Draft is only marked "I", no source. SAP documents it in Draft Handling / `editFlow` (ui5.sap.com topic ed9aa41…), Draft Handling with the OData V4 Model (topic 40986e6…) and `Common.DraftRoot` / `DraftNode`. The request wants draft but has no backend: the deployed app on CF cannot do draft; this is a contradiction in the request. Fix: add sources; ESCALATE the contradiction to the team/person. ESCALATED.
3. MEDIUM. UI5 linter (5.1) marked "I" although SAPUI5 documents it; UI5 2.x readiness, 1.148 Modernization Guide and manifest validation missing. ACCEPTED.
4. MEDIUM. SAPUI5 1.148 redesigned the FLP sandbox (What's New); not mentioned, FE_GENERATE requires `flp.html`. ACCEPTED.
5. MEDIUM. OPA5 (5.4) has no URL; a Fiori tools OPA guide for Fiori elements V4 exists in the corpus; coverage mapping only partial (E2E_A11Y replaces it, UI_TESTS skipped). ACCEPTED.
6. MEDIUM. S9 URL (topic 1cf5c7f…) could not be reproduced by the reviewer. REJECTED: the sap-docs fetch of /sapui5/06_SAP_Fiori_Elements/list-report-page-1cf5c7f worked on 2026-11-19 (nova-researcher, SOURCES_CHECK).
7. LOW. TypeScript doc not read; aligning `@sapui5/types` with 1.148 not listed. ACCEPTED.
8. LOW. End of maintenance of 1.148 not checked, G1 rests on inference. ACCEPTED.
9. LOW. Cloud ALM RUM for a Fiori-only app remains "I". ACCEPTED.

G1-G3 MANCANTE list and the LINT, UI5_TYPESCRIPT, FE_ANNOTATIONS mappings look correct.

accepted 7, rejected 1, escalated 1

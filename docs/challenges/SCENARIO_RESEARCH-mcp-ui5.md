# SCENARIO_RESEARCH · challenger mcp-ui5 (UI5 angle)

Reviewer: independent read-only thread (ui5-mcp-server not connected; used sap-docs search/fetch and ui5_version_diff). Verdict: IMPROVES. Transcribed by the Lead from the reviewer's message (it could not write under .claude/nova).

1. HIGH (11.4 / G1 / S16). 1.148 support horizon is documented but marked "I, not read". Verified: CDN bootstrap page https://ui5.sap.com/#/topic/2d3eb2f322ea4a82983c1c62a33ec4ae ("SAP removes SAPUI5 versions from the CDN one year after end of maintenance", SAP Note 3001696) and versioning page https://ui5.sap.com/#/topic/91f021426f4d1014b6dd926db0e91070. 1.148 released 2026-05-14 -> leaves CDN at the latest ~May 2027 (inferred; versionoverview.html not read). Fix: upgrade 11.4 to V, cite both and the Note. ACCEPTED.
2. MEDIUM (G1). UI5 Renovate Preset Config (https://github.com/UI5/renovate-config/) recommended by both pages; playbook mentions Renovate/Dependabot only for @sap/approuter. Fix: add to 11.4, cover @sapui5/types, ui5.yaml version, bootstrap/destination version. ACCEPTED.
3. MEDIUM (3.2). Source is ABAP-flavoured; no ABAP system here. Missing the BTP bootstrap variants: fixed patch, evergreen (async only), default (not for productive/testing). Fix: replace source with the CDN and versioning pages, add activity "decide how SAPUI5 is loaded". ACCEPTED.
4. MEDIUM (Phase 4 / 6.1). UI5 side of the build missing: ui5 build (ui5-deploy.yaml, Component-preload, minify), ui5-task-zipper, --self-contained, TS transpile chain (ui5-tooling-transpile, @sapui5/types 1.148). Evidence inferred. Fix: add rows 6.1a and 4.6a marked I; confirm with https://ui5.github.io/cli and https://ui5.github.io/typescript. ACCEPTED.
5. MEDIUM (5.1). UI5 linter documented: https://ui5.sap.com/#/topic/28fcd55b04654977b63dacbee0552712 , https://ui5.sap.com/#/topic/b72ccb50eda94ac9b9be454a03ca4213 , Modernization Guide https://ui5.sap.com/#/topic/db492368adbe490fa5d4ec7ebd98b187. Add "SAPUI5 2.x readiness" activity (covered by LINT). ACCEPTED.
6. LOW (5.3). CSP page https://ui5.sap.com/#/topic/fe1a6dba940e479fb7c3bc753f92b28c not cited; router CSP default-src 'self' can break inline bootstrap. Add check "bootstrap is CSP-compliant" (link to playbook inferred). ACCEPTED.
7. LOW (5.4). "open-ux-tools OPA5 docs" has no URL and is not in the source table; UI_TESTS is skipped by rigor so not MANCANTE. ACCEPTED.
8. LOW. Playbook example "1.136.x" outdated. Not a finding on research.md; the playbook belongs to the installer. REJECTED.

accepted 7, rejected 1, escalated 0

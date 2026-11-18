---
name: verification
description: >
  This skill should be used when "verifying test compliance", "checking Praman rules",
  or before "finalizing generated tests". Enforces the 7 mandatory Praman compliance rules.
  Run this checklist on every generated or healed test file before presenting results.
version: 0.1.0
---

# Verification

Verify every generated or healed test file against these 7 mandatory rules. Do not present results until all rules pass.

1. **Import**: Confirm `import { test, expect } from 'playwright-praman'` is the only test import. Reject any use of `@playwright/test`.

2. **Fixtures**: Confirm all UI5 element interactions use Praman fixtures (`ui5.press()`, `ui5.fill()`, `ui5.control()`, `ui5.click()`, `ui5.select()`). Reject `page.click('#__...')`, `page.locator('.sapM...')`, or any direct DOM interaction with UI5 controls.

3. **Playwright native**: Confirm Playwright native APIs (`page.goto`, `page.waitForLoadState`, `page.keyboard`, `page.getByText` for FLP space tabs) are used only for verified non-UI5 elements. Flag any native API targeting a UI5 control.

4. **Auth isolation**: Confirm no `sapAuth.login()`, credential handling, or authentication logic exists in the test body. Auth belongs exclusively in the seed/setup file.

5. **Input sequence**: Confirm every input interaction follows `setValue()` + `fireChange()` + `waitForUI5()` or uses `ui5.fill()` which encapsulates this sequence. Reject bare `setValue()` without `fireChange()`.

6. **Dialog context**: Confirm `searchOpenDialogs: true` is set on every selector targeting a control inside a dialog, popover, or value help. Grep for dialog interactions missing this flag.

7. **TSDoc header**: Confirm a compliance header exists documenting which interactions use Praman fixtures versus Playwright native APIs and why.

Run `grep` for each forbidden pattern. If ANY rule is violated, fix the violation before claiming completion. Do not present partial results.

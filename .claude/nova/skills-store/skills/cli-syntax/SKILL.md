---
name: cli-syntax
description: >
  This skill should be used when an agent needs to issue "playwright-cli" commands,
  "run-code" browser scripts, "snapshot" accessibility trees, or manage "session state"
  with state-save/state-load. Mandatory reading before any CLI interaction with SAP apps.
version: 0.1.0
---

# Playwright CLI Syntax Rules (Mandatory)

Every agent that interacts with the browser MUST follow these rules exactly. Incorrect CLI syntax wastes tokens, loses browser state, or produces silent failures.

## RULE 0: Check Control Methods BEFORE Every Interaction (NON-NEGOTIABLE)

**This rule overrides everything else. BEFORE clicking, filling, pressing, or interacting with ANY element, you MUST run this check.**

You are NOT allowed to skip this step. You are NOT allowed to assume you know the methods. You MUST verify every time.

### Step 1: Identify — Is it a UI5 control?

```bash
playwright-cli -s=sap run-code "async page => {
  return await page.evaluate((selector) => {
    try {
      // Try sap.ui.require('sap/ui/core/ElementRegistry') lookup first
      let ctrl = sap.ui.require('sap/ui/core/ElementRegistry').get(selector);
      if (ctrl) {
        const type = ctrl.getMetadata().getName();
        const methods = ['press', 'firePress', 'setValue', 'getValue', 'getText',
          'setSelectedKey', 'fireChange', 'getEnabled', 'getVisible', 'getRequired',
          'isOpen', 'close', 'getShowValueHelp', 'getItems', 'getSelectedKey',
          'setSelected', 'fireSelect', 'getContextByIndex', 'getBinding'];
        const available = methods.filter(m => typeof ctrl[m] === 'function');
        return { isUI5: true, controlId: selector, controlType: type, availableMethods: available };
      }

      // Try DOM element with data-sap-ui attribute
      const el = document.querySelector(selector);
      if (!el) return { found: false, selector };
      const ui5Id = el.getAttribute('data-sap-ui') || el.closest('[data-sap-ui]')?.getAttribute('data-sap-ui');
      if (ui5Id) {
        ctrl = sap.ui.require('sap/ui/core/ElementRegistry').get(ui5Id);
        if (ctrl) {
          const type = ctrl.getMetadata().getName();
          const methods = ['press', 'firePress', 'setValue', 'getValue', 'getText',
            'setSelectedKey', 'fireChange', 'getEnabled', 'getVisible', 'getRequired',
            'isOpen', 'close', 'getShowValueHelp', 'getItems', 'getSelectedKey',
            'setSelected', 'fireSelect', 'getContextByIndex', 'getBinding'];
          const available = methods.filter(m => typeof ctrl[m] === 'function');
          return { isUI5: true, controlId: ui5Id, controlType: type, availableMethods: available };
        }
      }
      return { found: true, isUI5: false, hint: 'Not a UI5 control — use Playwright native' };
    } catch (e) { return { error: e.message }; }
  }, 'CONTROL_ID_OR_CSS_SELECTOR');
}"
```

### Step 2: Record — Write down the available methods

After running the check, you MUST record in your working notes:

```
Control: {controlId}
Type: {controlType}
Available: [press, setValue, fireChange, ...]  ← from availableMethods
Will use: press  ← what you plan to call
```

### Step 3: Interact — Use ONLY a recorded method

If the method you want to call is NOT in the `availableMethods` list, DO NOT call it. Use an alternative:

| Wanted method | Not available? | Use instead |
|--------------|---------------|-------------|
| `press()` | Not on this control | `firePress()`, or DOM click via snapshot ref |
| `setValue()` | Read-only control | Check inner control with `-input`/`-inner` suffix |
| `setSelectedKey()` | Not a dropdown | Check if it has `getItems()`, use different approach |
| `fireChange()` | No change event | Try `fireEvent('change')` or skip if read-only |

### Step 4: Validate — After interaction, verify method matched

After the interaction completes, verify that the method you used matches what you recorded:

```
Used: press ← what you actually called
Recorded: press ← from Step 2
Match: YES ✓
```

If they don't match, you used the wrong method. Stop and re-check.

### Why This Rule Exists

Agents repeatedly call methods that don't exist on controls (e.g., `press()` on an `IconTabFilter` which has no `press()` or `firePress()`). This wastes time, causes failures, and forces the user to manually instruct "check the methods first." This rule eliminates that problem permanently.

**If you skip this rule, the generated test WILL fail.**

---

## Session Management

All CLI commands MUST use the `-s=sap` session flag for persistent browser state:

```bash
# CORRECT — persistent session, state preserved between calls
playwright-cli -s=sap run-code "async page => { ... }"
playwright-cli -s=sap snapshot --filename=snap.yml

# WRONG — no session flag, opens new browser each time
playwright-cli run-code "async page => { ... }"
npx playwright-cli evaluate "..."
```

## Opening the Browser

```bash
# Open SAP system in persistent session with Praman CLI config
playwright-cli -s=sap open "$SAP_CLOUD_BASE_URL" --persistent --config=.playwright/praman-cli.config.json
```

## Authentication via CLI

```bash
# 1. Snapshot to find login form elements
playwright-cli -s=sap snapshot --filename=login.yml

# 2. Fill credentials using element refs from snapshot
playwright-cli -s=sap fill e3 "$SAP_CLOUD_USERNAME"
playwright-cli -s=sap fill e5 "$SAP_CLOUD_PASSWORD"
playwright-cli -s=sap click e7

# 3. Wait for bridge readiness
playwright-cli -s=sap run-code "async page => {
  const maxWait = 30000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const ready = await page.evaluate(() => window.__praman_bridge?.ready);
    if (ready) return { bridgeReady: true, elapsed: Date.now() - start };
    await page.waitForTimeout(500);
  }
  return { bridgeReady: false, elapsed: maxWait };
}"

# 4. Save auth state for reuse across sessions
playwright-cli -s=sap state-save sap-auth.json
```

## Restoring Auth

```bash
# Load previously saved auth state (cookies + localStorage)
playwright-cli -s=sap state-load sap-auth.json
```

## The `run-code` Command

`run-code` is the primary command for executing JavaScript. The CLI wraps your code as:
```
await (YOUR_CODE)(page)
```

This means your code **MUST be a function expression** that receives `page`:

```bash
# CORRECT — async function receives page, uses return for output
playwright-cli -s=sap run-code "async page => {
  const result = await page.evaluate(() => {
    return sap.ui.version;
  });
  return result;
}"

# WRONG — Missing function wrapper
playwright-cli -s=sap run-code "await page.evaluate(() => { ... })"

# WRONG — Missing page parameter
playwright-cli -s=sap run-code "async () => { ... }"

# WRONG — console.log is INVISIBLE in run-code
playwright-cli -s=sap run-code "async page => { console.log('hello'); }"

# WRONG — sap is browser-only, must be inside page.evaluate()
playwright-cli -s=sap run-code "async page => { return sap.ui.version; }"
```

### OUTPUT RULE: `return` for output, NOT `console.log()`

The `run-code` result appears after `### Result` in the output. Only `return` produces visible output. `console.log()` is silently ignored.

### BROWSER vs NODE CONTEXT

Inside `run-code`, you are in Node.js context. Browser globals (`sap`, `document`, `window`) are only available inside `page.evaluate()`:

```bash
# CORRECT — browser APIs inside page.evaluate()
playwright-cli -s=sap run-code "async page => {
  return await page.evaluate(() => {
    const registry = sap.ui.require('sap/ui/core/ElementRegistry').all();
    return Object.keys(registry).length;
  });
}"
```

### SELECTOR CONTEXT WARNING

Inside `page.evaluate()` you are in BROWSER context, NOT Playwright context:

| Context | Valid Selectors | Invalid Selectors |
| --- | --- | --- |
| **Browser** (`page.evaluate`) | Standard CSS: `#id`, `.class`, `[attr]`, `[attr*="val"]` | `:has-text()`, `:has()`, `:visible`, `:nth-match()` |
| **Playwright** (outside evaluate) | All Playwright selectors + CSS | N/A |

## Snapshot Rules

```bash
# CORRECT — saves to file, returns compact reference (~200 tokens)
playwright-cli -s=sap snapshot --filename=snap.yml

# WRONG — inlines full YAML into context (thousands of wasted tokens)
playwright-cli -s=sap snapshot
```

Always use `--filename` for snapshots. The returned element refs (e1, e2, e3...) are used with `click`, `fill`, and other interaction commands.

## FLP Navigation via Hasher

```bash
playwright-cli -s=sap run-code "async page => {
  await page.evaluate((hash) => {
    const hasher = sap.ushell.Container.getService('ShellNavigation').hashChanger;
    hasher.setHash(hash);
  }, 'SemanticObject-action');
  await page.evaluate(() => {
    return new Promise(resolve => {
      sap.ui.getCore().attachEvent('UIUpdated', function handler() {
        sap.ui.getCore().detachEvent('UIUpdated', handler);
        resolve(true);
      });
      setTimeout(() => resolve(false), 10000);
    });
  });
  return { navigated: true };
}"
```

## Pre-Built Discovery Scripts

For initial control enumeration, prefer pre-built scripts over inline code when available:

```bash
# Full discovery via pre-built script
playwright-cli -s=sap run-code "$(cat node_modules/playwright-praman/dist/scripts/discover-all.js)"

# Dialog-specific discovery
playwright-cli -s=sap run-code "$(cat node_modules/playwright-praman/dist/scripts/dialog-controls.js)"

# Check available capabilities
npx playwright-praman capabilities --agent
```

## UI5 1.142+ Compatibility

In UI5 1.142+, `sap.ui.getCore().mElements` is **undefined**. Always use `sap.ui.require('sap/ui/core/ElementRegistry')`:

```bash
# WRONG — mElements is undefined in UI5 1.142+
playwright-cli -s=sap run-code "async page => {
  return await page.evaluate(() => Object.keys(sap.ui.getCore().mElements));
}"

# CORRECT — Use sap.ui.require('sap/ui/core/ElementRegistry')
playwright-cli -s=sap run-code "async page => {
  return await page.evaluate(() => {
    const registry = sap.ui.require('sap/ui/core/ElementRegistry').all();
    return Object.keys(registry).slice(0, 20).map(id => ({
      id,
      type: registry[id].getMetadata().getName()
    }));
  });
}"
```

## Closing the Session

```bash
playwright-cli -s=sap close
```

## 9-Point CLI Parameter Checklist

Before EVERY `run-code` call, verify ALL of these:

| # | Check | Required |
| --- | --- | --- |
| 1 | Session flag `-s=sap` included? | YES |
| 2 | Code is `async page => { ... }` ? | YES |
| 3 | Browser APIs inside `page.evaluate()` only? | YES |
| 4 | Using `return` for ALL output? | YES |
| 5 | Null checks with `?.` operator? | YES |
| 6 | Try/catch error handling? | YES |
| 7 | NO Playwright selectors in evaluate? | YES |
| 8 | UI5-first approach for SAP elements? | YES |
| 9 | Snapshot uses `--filename`? | YES |

## Agent-Fixture Boundary (D37)

The agent and the generated test operate in **different phases**:

**Agent Phase (Discovery — NOW):** You explore the live SAP app using CLI commands. Praman fixtures (`ui5`, `sapAuth`) do NOT exist in agent context. Use raw SAP APIs via `run-code`.

**Test Phase (Generated .spec.ts — LATER):** The generated test file uses Praman fixtures. Raw SAP APIs are NOT used. Do NOT put `playwright-cli` commands in generated test code — use `ui5.control().press()` etc.

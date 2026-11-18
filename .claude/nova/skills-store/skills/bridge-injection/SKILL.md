---
name: bridge-injection
description: >
  This skill should be used when "bridge injection fails", "control discovery returns empty",
  "window.__praman_bridge is undefined", or "UI5 module loading times out". Covers the
  3-tier getById resolution, polling mechanism, and manual bridge diagnostics.
version: 0.1.0
---

# Bridge Injection

## Purpose

The Praman bridge (`window.__praman_bridge`) is a JavaScript object injected into the browser page that exposes UI5 control discovery and method execution to Playwright. All `ui5.*` fixture calls depend on the bridge being ready.

## Initialization Sequence

The bridge initializes lazily on first `ui5.*` call:

1. Poll for `sap.ui.require` availability at 100ms intervals (30s timeout).
2. Once `sap.ui.require` is available, load UI5 modules: `sap/ui/test/RecordReplay`, `sap/ui/core/Element`, `sap/base/Log`.
3. Set up the `objectMap` (Map) for control proxy references.
4. Register the 3-tier `getById` resolver.
5. Set `window.__praman_ready = true`.

The bridge is idempotent -- it checks `window.__praman_ready` before re-initializing.

## 3-Tier getById Resolution (D19)

Control lookup by ID uses three tiers for maximum UI5 version compatibility:

1. **Tier 1**: `sap.ui.core.Element.getElementById(id)` -- UI5 1.120+ (new API)
2. **Tier 2**: `sap.ui.require('sap/ui/core/ElementRegistry').get(id)` -- UI5 1.67+ (registry API)
3. **Tier 3**: `sap.ui.getCore().byId(id)` -- all UI5 versions (legacy, deprecated in 2.x)

Each tier is tried in order. The first non-null result wins. This ensures Praman works across UI5 1.52 through 2.x.

## When Bridge Fails

Common failure scenarios and resolution:

**`window.__praman_bridge` is undefined** -- UI5 has not loaded yet. Ensure the page has fully loaded and `sap.ui.require` is available. Check that navigation completed before calling `ui5.*` methods.

**Bridge ready but control discovery returns empty** -- UI5 is loaded but controls are not rendered yet. Call `ui5.waitForUI5()` to wait for pending async operations. Check that the correct view/page is active.

**Module loading timeout** -- `sap.ui.require` is available but module resolution fails. This can happen with custom UI5 builds that exclude `sap/ui/test/RecordReplay`. The bridge falls back gracefully -- RecordReplay is optional.

**Cross-frame issues (WorkZone)** -- The bridge is injected per frame. For Work Zone apps in iframes, ensure `btpWorkZone.init()` was called to switch to the correct frame.

## Manual Diagnostics

Run `scripts/check-bridge.js` via `playwright-cli run-code` to inspect the current bridge state. It returns status, version, loaded modules, object map size, and age:

```bash
playwright-cli -s=sap run-code "async page => {
  return await page.evaluate(() => {
    const bridge = window.__praman_bridge;
    if (!bridge) return { status: 'NOT_INJECTED', ready: false };
    return {
      status: bridge.ready ? 'READY' : 'INITIALIZING',
      ready: bridge.ready, version: bridge.version,
      ui5Version: bridge.ui5Version || 'unknown',
      hasRecordReplay: !!bridge.RecordReplay,
      hasElement: !!bridge.Element, hasLog: !!bridge.Log,
      injectedAt: bridge.injectedAt, ageMs: Date.now() - bridge.injectedAt,
      objectMapSize: bridge.objectMap?.size ?? 0
    };
  });
}"
```

If the bridge needs manual re-injection (rare), run `scripts/reinject-bridge.js`:

```bash
playwright-cli -s=sap run-code "async page => {
  return await page.evaluate(() => {
    $(cat scripts/reinject-bridge.js)
  });
}"
```

Refer to `scripts/` for diagnostic and re-injection scripts.

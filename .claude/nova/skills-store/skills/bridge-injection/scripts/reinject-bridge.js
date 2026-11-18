// Manual bridge re-injection when auto-init fails
// Run via: playwright-cli -s=sap run-code "async page => { return await page.evaluate(() => { ... paste this code ... }); }"
(() => {
  if (window.__praman_ready) return { status: 'ALREADY_READY' };

  const bridge = window.__praman_bridge || {};
  bridge.objectMap = bridge.objectMap || new Map();

  // 3-tier getById
  bridge.getById = function(id) {
    try {
      // Tier 1: Element.getElementById (UI5 1.120+)
      if (sap?.ui?.core?.Element?.getElementById) {
        const el = sap.ui.core.Element.getElementById(id);
        if (el) return el;
      }
      // Tier 2: ElementRegistry via sap.ui.require (UI5 1.67+)
      if (sap?.ui?.require) {
        const ER = sap.ui.require('sap/ui/core/ElementRegistry');
        if (ER?.get) {
          const el = ER.get(id);
          if (el) return el;
        }
      }
      // Tier 3: Core.byId (all versions)
      if (sap?.ui?.getCore) {
        const el = sap.ui.getCore().byId(id);
        if (el) return el;
      }
    } catch (e) { /* fallthrough */ }
    return null;
  };

  // Try loading UI5 modules
  if (sap?.ui?.require) {
    sap.ui.require(
      ['sap/ui/test/RecordReplay', 'sap/ui/core/Element', 'sap/base/Log'],
      (RR, El, Log) => {
        bridge.RecordReplay = RR;
        bridge.Element = El;
        bridge.Log = Log;
        bridge.ready = true;
        window.__praman_ready = true;
      },
      () => { bridge.ready = true; window.__praman_ready = true; }
    );
  } else {
    bridge.ready = true;
    window.__praman_ready = true;
  }

  window.__praman_bridge = bridge;
  return { status: 'REINJECTED', sapUiRequireAvailable: !!sap?.ui?.require };
})()

// Run via: playwright-cli -s=sap run-code "async page => { return await page.evaluate(() => { ... paste this code ... }); }"
(() => {
  const bridge = window.__praman_bridge;
  if (!bridge) return { status: 'NOT_INJECTED', ready: false };
  return {
    status: bridge.ready ? 'READY' : 'INITIALIZING',
    ready: bridge.ready,
    version: bridge.version,
    ui5Version: bridge.ui5Version || 'unknown',
    hasRecordReplay: !!bridge.RecordReplay,
    hasElement: !!bridge.Element,
    hasLog: !!bridge.Log,
    injectedAt: bridge.injectedAt,
    ageMs: Date.now() - bridge.injectedAt,
    objectMapSize: bridge.objectMap?.size ?? 0,
  };
})()

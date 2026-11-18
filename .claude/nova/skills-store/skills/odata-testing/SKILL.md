---
name: odata-testing
description: >
  This skill should be used when testing "OData V2" or "OData V4" service calls,
  "reading model data", "intercepting batch requests", "seeding test data",
  or "verifying CSRF tokens" in SAP Playwright tests.
version: 0.1.0
---

# OData Testing

## Two Levels of OData Testing

Distinguish between model-level (UI5 runtime) and HTTP-level (network) testing:

**Model-level** -- read/verify data through the UI5 OData model bound to controls:

- `ui5.odata.getModelData(modelName, path)` -- read entity or collection
- `ui5.odata.getModelProperty(modelName, path, property)` -- read single property
- `ui5.odata.waitForLoad(modelName)` -- wait for model data to load
- `ui5.odata.hasPendingChanges(modelName)` -- check for unsaved changes
- `ui5.odata.getEntityCount(modelName, entitySet)` -- count entities in set

Use model-level for assertions on what the UI displays. The model reflects server state after the last fetch.

**HTTP-level** -- call OData services directly for test data setup/teardown:

- `ui5.odata.fetchCSRFToken(serviceUrl)` -- get token for write operations
- `ui5.odata.createEntity(serviceUrl, entitySet, payload)` -- POST new entity
- `ui5.odata.updateEntity(serviceUrl, entityKey, payload)` -- PATCH/PUT entity
- `ui5.odata.deleteEntity(serviceUrl, entityKey)` -- DELETE entity
- `ui5.odata.queryEntities(serviceUrl, entitySet, params)` -- GET with filters
- `ui5.odata.callFunctionImport(serviceUrl, functionName, params)` -- invoke function import

Use HTTP-level for test data seeding (beforeAll) and cleanup (afterAll). CSRF tokens are auto-fetched and cached.

## V2 vs V4 Differences

Key differences that affect test code:

| Aspect | V2 | V4 |
| --- | --- | --- |
| URL pattern | `/sap/opu/odata/sap/SERVICE` | `/sap/opu/odata4/sap/SERVICE/srvd_a2x/sap/SERVICE/0001` |
| Entity key | `EntitySet('key')` | `EntitySet('key')` or `EntitySet(key=value)` |
| CSRF header | `X-CSRF-Token: Fetch` | `X-CSRF-Token: Fetch` |
| Batch | `$batch` multipart/mixed | `$batch` JSON |
| Metadata | `$metadata` (EDMX XML) | `$metadata` (EDMX V4 XML) |
| Expand | `$expand=NavProp` | `$expand=NavProp($select=Field)` |

The `ui5.odata` methods auto-detect the OData version from the service metadata. Specify explicitly with `{ version: 'v2' }` or `{ version: 'v4' }` if auto-detection fails.

## Intercepting OData Requests

Mock OData responses with Playwright route interception:

```typescript
await page.route('**/sap/opu/odata/**', (route) => {
  route.fulfill({ json: mockResponse });
});
```

Use route interception for:
- Simulating error responses (4xx, 5xx)
- Testing offline/slow network scenarios
- Isolating UI behavior from backend data

Remove routes after test with `page.unroute()`.

## CSRF Token Handling

SAP OData services require CSRF tokens for mutating requests. The `ui5.odata` HTTP methods handle this automatically:

1. Fetch token via `HEAD` request with `X-CSRF-Token: Fetch`.
2. Cache token for the session.
3. Include token in subsequent POST/PUT/PATCH/DELETE.
4. Retry on `403` (token expired) with fresh token.

Refer to `references/v2-vs-v4.md` for the full comparison table.

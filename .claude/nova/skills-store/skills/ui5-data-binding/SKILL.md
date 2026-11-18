---
name: ui5-data-binding
description: >
  Use when working with SAPUI5 OData V4 data binding: ODataModel bindList bindContext bindProperty,
  requestContexts setProperty getObject requestObject, $auto $direct batch group,
  requestSideEffects, ODataListBinding.create Context.delete, controller data access.
metadata:
  category: ui5
  version: "1.0.0"
  keywords: [OData V4, ODataModel, bindList, bindContext, requestContexts, setProperty, requestSideEffects, $auto, $direct, batch group, ODataListBinding]
  related:
    ui5-custom-controls: bind data to custom controls
    fiori-flexible-programming: data binding in custom sections
    ui5-testing: test OData V4 data binding behavior
---

# UI5 Data Binding (OData V4) — Best Practices

> **Primary reference**: https://ui5.sap.com/#/topic/5de13cf4dd1f4a3480f7e2eaaee3f5b8
> **Accessing data in controller code**: https://ui5.sap.com/#/topic/17b30ac2d5914b0891b3b4ef3fc58e90
> **requestContexts API**: https://ui5.sap.com/#/api/sap.ui.model.odata.v4.ODataListBinding#methods/requestContexts
> **Batch control**: https://ui5.sap.com/#/topic/74142a38e3d4467c8d6a70b28764048f

Always use the **OData V4 model** (`sap.ui.model.odata.v4.ODataModel`) for new SAPUI5 apps with CAP or S/4HANA Cloud — V2 is legacy and loses batch optimisation, side effects, and deep integration with Fiori Elements.

---

## Model setup in manifest.json

```json
{
  "sap.ui5": {
    "models": {
      "": {
        "dataSource": "mainService",
        "preload": true,
        "settings": {
          "synchronizationMode": "None",
          "operationMode": "Server",
          "autoExpandSelect": true,
          "earlyRequests": true
        }
      }
    },
    "dataSources": {
      "mainService": {
        "uri": "/odata/v4/OrderService/",
        "type": "OData",
        "settings": { "odataVersion": "4.0" }
      }
    }
  }
}
```

---

## List Binding — reading a collection

A list binding is obtained with `ODataModel#bindList` or from an existing control.

```js
// In controller
const oModel = this.getView().getModel();

// Get list binding from a Table control
const oTable = this.byId("ordersTable");
const oListBinding = oTable.getBinding("items");

// Or create a standalone list binding
const oListBinding = oModel.bindList("/Orders", null, [], [], {
  $select: "ID,orderNumber,totalAmount,status",
  $expand: "customer($select=name)"
});

// Request contexts — returns a promise
const aContexts = await oListBinding.requestContexts(0, 50);
for (const oContext of aContexts) {
  const order = oContext.getObject();  // synchronous after requestContexts
  console.log(order.orderNumber);
}
```

---

## Context Binding — reading a single entity

```js
// Bind to a specific entity
const oContextBinding = oModel.bindContext("/Orders('some-uuid')", null, {
  $select: "ID,orderNumber,status,totalAmount",
  $expand: "items($select=ID,product,quantity,amount)"
});

// Request the data
await oContextBinding.requestObject();
const oOrder = oContextBinding.getBoundContext().getObject();
```

---

## Writing data — setProperty

```js
// Change a property on a context
const oContext = oTable.getBinding("items").getCurrentContexts()[0];
await oContext.setProperty("status", "Approved");

// Submit all pending changes in the auto-submit group
await oModel.submitBatch("$auto");
```

---

## Creating entities

```js
// Create a new entity in a list binding
const oListBinding = oModel.bindList("/Orders");
const oNewContext = oListBinding.create({
  orderNumber: "ORD-001",
  status: "Draft",
  totalAmount: 0
}, /*bAtEnd=*/true);

// The create is sent with the next $auto batch
await oNewContext.created();  // waits for server confirmation
```

---

## Deleting entities

```js
// Delete via context
const oContext = oTable.getBinding("items").getCurrentContexts()[0];
await oContext.delete("$auto");
```

---

## Batch control — $auto and $direct groups

OData V4 allows grouping multiple operations into a single HTTP request. The OData V4 model sends requests using group IDs:

- **`$auto`** — groups all operations and sends them automatically; standard for most reads and writes
- **`$direct`** — sends immediately, bypassing batch; use for time-sensitive operations
- **Custom group IDs** — control exactly when a batch is submitted via `submitBatch()`

```js
// Read in $auto (default, batched automatically)
oListBinding.requestContexts();  // goes in $auto batch

// Explicit manual batch group
const oContextBinding = oModel.bindContext("/Orders('id')/OrderService.submitOrder(...)", null, {
  $$groupId: "myActionGroup"
});
oContextBinding.invoke();
await oModel.submitBatch("myActionGroup");  // submit when ready
```

---

## Side effects — refreshing data after an action

After a bound action changes server-side data, use side effects to tell the framework what to refresh:

```js
// After calling an action, refresh specific properties
const oContextBinding = oContext.getModel().bindContext(
  "OrderService.submitOrder(...)",
  oContext,
  { $$inheritExpandSelect: true }
);
await oContextBinding.invoke();

// Request side effects — refreshes status and totalAmount
await oContext.requestSideEffects([
  { $PropertyPath: "status" },
  { $PropertyPath: "totalAmount" },
  { $NavigationPropertyPath: "items" }
]);
```

In CAP with Fiori Elements, annotate side effects in CDS:
```cds
annotate OrderService.submitOrder with @(
  Common.SideEffects: {
    TargetProperties: ['status', 'totalAmount'],
    TargetEntities: [items]
  }
);
```

---

## Common mistakes to avoid

- ❌ Using OData V2 model for new apps — loses batch optimisation and side effects
- ✅ Always use `sap.ui.model.odata.v4.ODataModel` for new projects

- ❌ Calling `getObject()` before the data is loaded — returns undefined
- ✅ Always `await requestObject()` or `await requestContexts()` before reading data

- ❌ Calling `submitBatch("$auto")` manually — `$auto` submits automatically
- ✅ Only call `submitBatch()` manually for custom application group IDs

- ❌ Refreshing the entire model after an action instead of using side effects
- ✅ Use `requestSideEffects()` to refresh only the changed properties

- ❌ Using OData V2 filter/sort APIs (e.g. `new Filter(...)`) with the V4 model
- ✅ V4 model uses `sap.ui.model.Filter` — the same class, but binding behaviour differs; always check V4 docs

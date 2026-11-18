---
name: fiori-elements-floorplans
description: >
  Use when working with SAP Fiori Elements floorplans: List Report Object Page LROP, Worklist, ALP,
  Analytical List Page, Overview Page OVP, Flexible Column Layout FCL,
  manifest.json routing, cds add fiori, Application Generator, OData V4 app setup.
metadata:
  category: fiori
  version: "1.0.0"
  keywords: [Fiori Elements, List Report, Object Page, LROP, Worklist, ALP, Analytical List Page, OVP, Overview Page, floorplan, manifest.json, cds add fiori]
  related:
    fiori-annotations: UI annotations required for each floorplan
    fiori-navigation: routing and navigation between floorplan pages
    fiori-tools: generate floorplan apps with Application Generator
    fiori-draft: enable draft on Object Page entities
---

# Fiori Elements Floorplans — Best Practices

> **Primary reference**: https://ui5.sap.com/#/topic/03265b0408e2432c9571d6b3feb6b1fd
> **Fiori Elements overview**: https://ui5.sap.com/#/topic/03265b0408e2432c9571d6b3feb6b1fd
> **SAP Fiori Development Portal**: https://fioriappslibrary.hana.ondemand.com
> **Feature showcase**: https://github.com/SAP-samples/fiori-elements-feature-showcase

Always use **OData V4** for new projects with CAP — V2 is legacy and loses building blocks,
flexible programming model, and deep draft integration.

---

## Choosing the right floorplan

| Floorplan | Use when… | OData V4 |
|---|---|---|
| **List Report + Object Page** | Browse a large set of items, click into details — the default for most business apps | ✅ Full support |
| **Worklist** | Small set of work items to process one by one, no complex filtering needed | ✅ (List Report with filter bar disabled) |
| **Analytical List Page (ALP)** | Data analysis with visual filters, charts, and KPIs alongside a list | ✅ Full support |
| **Overview Page (OVP)** | Dashboard with cards summarising multiple business areas | ✅ (except Stack card) |
| **Object Page standalone** | Single item detail without a list entry point | ✅ Full support |

**When in doubt: List Report + Object Page.** This combination — sometimes referred to as LROP — is the most common SAP Fiori elements pattern and covers the vast majority of transactional business scenarios.

---

## Generate with SAP Fiori tools (recommended)

```bash
# In your CAP project root — generates the full app skeleton
cds add fiori

# Or use the Fiori tools Application Generator in VS Code:
# Ctrl+Shift+P → "Fiori: Open Application Generator"
# → SAP Fiori elements → List Report Object Page
# → OData V4 → select your CAP service
```

This generates:
```
app/
└── my-app/
    ├── webapp/
    │   ├── manifest.json        ← app routing and settings
    │   └── i18n/i18n.properties
    └── annotations.cds          ← your UI annotations go here
```

---

## List Report + Object Page — manifest.json

```json
{
  "sap.ui5": {
    "routing": {
      "routes": [{
        "name": "OrdersList",
        "pattern": ":?query:",
        "target": "OrdersList"
      }, {
        "name": "OrdersObjectPage",
        "pattern": "Orders({key}):?query:",
        "target": "OrdersObjectPage"
      }],
      "targets": {
        "OrdersList": {
          "type": "Component",
          "id": "OrdersList",
          "name": "sap.fe.templates.ListReport",
          "options": {
            "settings": {
              "entitySet": "Orders",
              "initialLoad": true
            }
          }
        },
        "OrdersObjectPage": {
          "type": "Component",
          "id": "OrdersObjectPage",
          "name": "sap.fe.templates.ObjectPage",
          "options": {
            "settings": {
              "entitySet": "Orders"
            }
          }
        }
      }
    }
  }
}
```

---

## Worklist — manifest.json difference

In SAP Fiori elements V4, the Worklist floorplan is just a flavor of the List Report with the filter bar disabled. One setting:

```json
"settings": {
  "entitySet": "Tasks",
  "initialLoad": true,
  "hideFilterBar": true    ← this is all it takes
}
```

---

## Flexible Column Layout (FCL)

Show list and object page side by side instead of full navigation:

```json
"sap.ui": {
  "fullWidth": false
},
"sap.ui5": {
  "routing": {
    "config": {
      "flexibleColumnLayout": {
        "defaultTwoColumnLayoutType": "TwoColumnsMidExpanded"
      }
    }
  }
}
```

---

## Annotations file location — CAP specific

Keep UI annotations in separate `.cds` files in your `app/` folder — not inline in the entity definition or in the `webapp/` folder.

```
app/
└── orders/
    └── annotations.cds    ← ✅ correct — compiled by CAP into OData metadata
        webapp/
        └── annotations.xml  ← ❌ avoid — NOT compiled by CAP, causes label issues
```

```cds
// app/orders/annotations.cds
using OrderService from '../../srv/order-service';

annotate OrderService.Orders with @(
  UI.HeaderInfo: {
    TypeName: 'Order',
    TypeNamePlural: 'Orders',
    Title: { Value: orderNumber }
  },
  UI.SelectionFields: [ status, customer_ID, orderDate ],
  UI.LineItem: [
    { Value: orderNumber },
    { Value: customer.name, Label: 'Customer' },
    { Value: orderDate },
    { Value: totalAmount },
    { Value: status, Criticality: statusCriticality }
  ]
);
```

---

## Common mistakes to avoid

- ❌ Choosing OData V2 for new CAP projects — loses flexible programming model, building blocks, and deep draft support
- ✅ Always OData V4 for new projects

- ❌ Putting UI annotations inside `webapp/annotations.xml` in CAP projects — not compiled into OData metadata, labels and facets silently don't apply
- ✅ Put annotations in `app/<app-name>/annotations.cds`

- ❌ Building a custom UI5 freestyle app when a floorplan covers 90% of the use case — extensions cover the remaining 10%
- ✅ Start with the closest floorplan and extend with flexible programming model

- ❌ Using Overview Page with Stack cards on OData V4 — not supported
- ✅ All other OVP card types work with V4

- ❌ Manually writing `manifest.json` routing — error-prone
- ✅ Use SAP Fiori tools Application Generator or `cds add fiori`

---
name: fiori-navigation
description: >
  Use when working with SAP Fiori Elements navigation: routing manifest.json, List Report Object Page route,
  sub-object page, semantic object navigation, intent-based navigation, cross-app navigation,
  CrossApplicationNavigation, Launchpad target mapping, FCL layout navigation, deep link.
metadata:
  category: fiori
  version: "1.0.0"
  keywords: [navigation, routing, manifest.json, semantic object, intent-based navigation, cross-app navigation, FCL, deep link, Launchpad, sub-object page]
  related:
    fiori-elements-floorplans: routing between floorplan pages
    btp-workzone: Launchpad target mappings for intent-based navigation
    fiori-tools: generate routing configuration
---

# Fiori Navigation — Best Practices

> **Primary reference**: https://ui5.sap.com/#/topic/bee46f3b7e97496a9680b77f2a0dc8cc
> **Intent-based navigation**: https://help.sap.com/docs/SAP_FIORI_LAUNCHPAD

---

## Standard List Report → Object Page navigation

This is automatic when you define both targets in `manifest.json` and annotate
the `UI.LineItem` with the correct entity set. No custom code needed.

The `key` parameter in the route pattern must match your entity's key:

```json
"routes": [
  {
    "name": "OrdersList",
    "pattern": ":?query:",
    "target": "OrdersList"
  },
  {
    "name": "OrdersObjectPage",
    "pattern": "Orders({key}):?query:",
    "target": "OrdersObjectPage"
  }
]
```

For **composite keys**:
```json
"pattern": "Orders(ID={ID},IsActiveEntity={IsActiveEntity}):?query:"
```

---

## Sub-Object Page (nested navigation)

For child entities (e.g. Order → OrderItems → ItemDetails):

```json
"routes": [
  { "name": "OrdersList",          "pattern": ":?query:",                                         "target": "OrdersList" },
  { "name": "OrdersObjectPage",    "pattern": "Orders({key}):?query:",                            "target": "OrdersObjectPage" },
  { "name": "ItemsObjectPage",     "pattern": "Orders({key})/items({key2}):?query:",              "target": "ItemsObjectPage" }
],
"targets": {
  "ItemsObjectPage": {
    "type": "Component",
    "name": "sap.fe.templates.ObjectPage",
    "options": {
      "settings": {
        "entitySet": "Items",
        "navigation": {
          "Items": {
            "detail": { "route": "ItemsObjectPage" }
          }
        }
      }
    }
  }
}
```

---

## Flexible Column Layout (FCL) navigation

```json
"sap.ui5": {
  "routing": {
    "config": {
      "flexibleColumnLayout": {
        "defaultTwoColumnLayoutType": "TwoColumnsMidExpanded",
        "defaultThreeColumnLayoutType": "ThreeColumnsMidExpanded"
      }
    },
    "targets": {
      "OrdersList": {
        "options": {
          "settings": {
            "entitySet": "Orders",
            "navigation": {
              "Orders": {
                "detail": {
                  "route": "OrdersObjectPage",
                  "parameters": { "layout": "TwoColumnsMidExpanded" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## Intent-based navigation (cross-app)

Navigate to another app on the SAP Fiori Launchpad using semantic objects:

```cds
// Annotation — makes a field a navigation link to another app
annotate OrderService.Orders:customer_ID with @(
  Common.SemanticObject: 'BusinessPartner',
  Common.SemanticObjectMapping: [{
    LocalProperty: customer_ID,
    SemanticObjectProperty: 'BusinessPartner'
  }]
);
```

The target app must have a matching intent registered in the Launchpad:
- Semantic Object: `BusinessPartner`
- Action: `displayFactSheet` (or `manage`, `create`, etc.)

---

## Navigation from controller extension

```js
// Navigate programmatically to Object Page
onNavigateToOrder(orderId) {
  const routing = this.base.getExtensionAPI().getRouting();
  routing.navigateToRoute('OrdersObjectPage', {
    key: `ID=${orderId},IsActiveEntity=true`
  });
}

// Navigate to external app (intent-based)
onNavigateToBusinessPartner(bpId) {
  const crossAppNav = sap.ushell?.Container?.getServiceAsync('CrossApplicationNavigation');
  crossAppNav.then(service => {
    service.toExternal({
      target: { semanticObject: 'BusinessPartner', action: 'displayFactSheet' },
      params: { BusinessPartner: bpId }
    });
  });
}
```

---

## SAP Fiori Launchpad target mapping

In BTP Cockpit → SAP Build Work Zone or in `xs-app.json`:

```json
{
  "semanticObject": "Order",
  "action": "manage",
  "title": "Manage Orders",
  "applicationType": "URL",
  "url": "/orders/webapp",
  "additionalInformation": "SAPUI5.Component=orders"
}
```

Match the semantic object + action in `manifest.json`:
```json
"sap.app": {
  "crossNavigation": {
    "inbounds": {
      "Order-manage": {
        "semanticObject": "Order",
        "action": "manage",
        "title": "Manage Orders"
      }
    }
  }
}
```

---

## Common mistakes to avoid

- ❌ Hardcoding app URLs for cross-app navigation — breaks when app moves
- ✅ Always use intent-based navigation with semantic objects

- ❌ Defining routes without `IsActiveEntity` in the pattern for draft-enabled entities
- ✅ Draft entities need `ID={ID},IsActiveEntity={IsActiveEntity}` in route pattern

- ❌ Calling `window.location.href` for navigation inside the Launchpad shell
- ✅ Use `CrossApplicationNavigation` service for cross-app, routing API for in-app

- ❌ Deep-linking directly to a sub-object page without the parent route defined
- ✅ All parent routes must exist in manifest.json for deep links to work

- ❌ Forgetting to register the inbound intent in the Launchpad — app is unreachable
- ✅ Always add `crossNavigation.inbounds` to `sap.app` in manifest.json

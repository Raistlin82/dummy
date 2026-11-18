---
name: navigation
description: >
  This skill should be used when testing "FLP navigation", "semantic object deep links",
  "tile-based navigation", "WorkZone frame switching", "cross-app navigation", or
  "browser history" in SAP Fiori Playwright tests.
version: 0.1.0
---

# Navigation

## FLP Hash Format

SAP Fiori Launchpad uses hash-based routing: `#SemanticObject-Action?param1=value1&param2=value2`. Entity deep links append the path: `#SemanticObject-Action&/EntitySet('key')`.

## Core Navigation Methods

Use the `ui5Navigation` fixture for all navigation:

- `navigateToApp(semanticObjectAction)` -- navigate by semantic object + action string (e.g., `'PurchaseOrder-manage'`)
- `navigateToTile(tileTitle)` -- find and click a tile by its visible title
- `navigateToIntent(intent, params?)` -- navigate with explicit intent object `{ semanticObject, action }` and optional parameters
- `navigateToHash(hash)` -- navigate to an arbitrary FLP hash (useful for deep links with entity keys)
- `navigateToHome()` -- return to the FLP home page
- `navigateBack()` -- trigger browser back navigation
- `searchAndOpenApp(searchText)` -- use FLP search to find and open an app
- `getCurrentHash()` -- return the current FLP hash for assertions

Always call `ui5.waitForUI5()` after every navigation to wait for the target app to stabilize.

## Common Semantic Objects

| Semantic Object + Action | App |
| --- | --- |
| `PurchaseOrder-manage` | Manage Purchase Orders |
| `PurchaseOrder-create` | Create Purchase Order |
| `SalesOrder-manage` | Manage Sales Orders |
| `SalesOrder-create` | Create Sales Order |
| `Supplier-display` | Display Supplier |
| `Material-display` | Display Material |
| `BusinessPartner-manage` | Manage Business Partner |
| `JournalEntry-display` | Display Journal Entries |

## WorkZone Navigation

For SAP Build Work Zone (standard or advanced edition), initialize the WorkZone handler before navigation:

```typescript
await btpWorkZone.init();
await ui5Navigation.navigateToApp('PurchaseOrder-manage');
```

Work Zone wraps apps in iframes. `btpWorkZone.init()` handles frame switching automatically so subsequent `ui5` calls target the correct frame context.

## Cross-App Navigation

When a test navigates between multiple Fiori apps (e.g., from a List Report to an Object Page to a related app), call `ui5.waitForUI5()` after each transition. The hash changes but the page may not fully reload -- UI5 handles routing internally.

## Deep Links with Entity Keys

Navigate directly to a specific entity:

```typescript
await ui5Navigation.navigateToHash("#PurchaseOrder-manage&/PurchaseOrder('4500001234')");
```

Use deep links to skip the List Report and test Object Pages directly. This reduces test execution time and isolates Object Page tests from filter/search behavior.

Refer to `examples/` for complete navigation patterns.

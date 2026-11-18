---
name: fiori-elements
description: >
  This skill should be used when testing "Fiori Elements" apps, "List Report",
  "Object Page", "Analytical List Page", or "Overview Page". Covers SmartFilterBar,
  SmartTable, ObjectPageLayout, DynamicPage patterns, and the FE test library API.
version: 0.1.0
---

# Fiori Elements

Fiori Elements apps are generated from OData metadata and CDS annotations. Do not look for custom view XML -- the framework renders controls dynamically. Target controls by `controlType` + `bindingPath` or `properties`.

## List Report Pattern

Test the standard filter-search-select flow:

1. Navigate to the List Report app via `ui5Navigation.navigateToApp()`.
2. Fill SmartFilterBar fields using `bindingPath: { propertyPath }` selectors.
3. Click the "Go" button to execute the query.
4. Call `ui5.waitForUI5()` after every interaction.
5. Verify table results with `ui5.table.getRowCount()`.
6. Select a row with `ui5.table.selectRow()` to navigate to the Object Page.

Use `controlType: 'sap.ui.comp.smartfield.SmartField'` with `bindingPath` for filter fields. For "Adapt Filters" dialog, use `searchOpenDialogs: true`.

## Object Page Pattern

Test the view-edit-save flow:

1. Navigate directly via `navigateToHash()` with the entity key or select from List Report.
2. Read header data from `sap.m.Title` inside `sap.f.DynamicPageTitle`.
3. Click "Edit" to enter edit mode.
4. Fill SmartField controls using `bindingPath`.
5. Click "Save" and wait for OData response.
6. Verify success via MessageToast or ObjectStatus.

## SmartTable Operations

Use `ui5.table` methods for table interactions:

- `ui5.table.getRows(tableId)` -- get all visible rows
- `ui5.table.getRowCount(tableId)` -- count rows
- `ui5.table.getCellValue(tableId, rowIndex, columnKey)` -- read cell
- `ui5.table.selectRow(tableId, rowIndex)` -- select row by index

Table type is auto-detected: `sap.m.Table` (responsive), `sap.ui.table.Table` (grid), or `sap.ui.comp.smarttable.SmartTable` (generated). Use the SmartTable ID when available.

## SmartFilterBar Operations

- Fill filters by `bindingPath` targeting SmartField inside the filter bar.
- Click "Go" (`sap.m.Button` with `text: 'Go'`) to execute.
- Click "Clear" to reset all filters.
- Open "Adapt Filters" for hidden filter fields -- controls inside this dialog require `searchOpenDialogs: true`.

## SmartField Inner Control Pattern (V2)

SmartFields wrap inner controls. Target the inner control for interaction, the SmartField for assertions:

| Inner Control | Suffix | Use Case |
|--------------|--------|----------|
| Input | `-input` | Text fields, number fields |
| ComboBox | `-comboBoxEdit` | Dropdown selection fields |
| DatePicker | `-picker` | Date/time fields |
| Display | `-inner` | Read-only display fields |

Example: For SmartField `fragment--supplierField`, the combo is `fragment--supplierField-comboBoxEdit`.

Always use `setValue()` + `fireChange()` + `waitForUI5()` on the inner control, never the SmartField wrapper.

## V4 MDC Field Pattern

MDC Fields (V4 apps) use different conventions:

- **Outer field**: `APD_::Material` — for metadata, validation state
- **Inner input**: `APD_::Material-inner` — for value changes (triggers OData binding)
- **Value Help icon**: `APD_::Material-inner-vhi` — to open VH dialog
- **Service namespace prefix**: `fe::APD_::${SRVD}.ActionName` for action dialogs

MDC ValueHelp uses `sap.ui.mdc.ValueHelp` (not `sap.ui.comp.valuehelpdialog.ValueHelpDialog`).

## FE Test Library

For advanced FE testing, initialize the Fiori Elements test library:

```typescript
const feLib = await initializeFETestLibrary(page);
```

This provides a fluent API for List Report and Object Page actions aligned with SAP's OPA5 FE test patterns.

Refer to `examples/` for complete List Report and Object Page test patterns.

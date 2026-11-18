# Selector Strategy Guide

| Scenario | Best Selector | Example |
| --- | --- | --- |
| Control has stable ID | `id` | `{ id: 'vendorInput' }` |
| Button with unique text | `controlType` + `properties` | `{ controlType: 'sap.m.Button', properties: { text: 'Save' } }` |
| Form field bound to OData | `bindingPath` | `{ controlType: 'sap.ui.comp.smartfield.SmartField', bindingPath: { propertyPath: 'Supplier' } }` |
| Multiple buttons with same text | `ancestor`-scoped | `{ controlType: 'sap.m.Button', properties: { text: 'Delete' }, ancestor: { id: 'itemsTable' } }` |
| Control inside dialog | Add `searchOpenDialogs` | `{ controlType: 'sap.m.Button', properties: { text: 'OK' }, searchOpenDialogs: true }` |
| Icon tab filter | `controlType` + `properties.key` | `{ controlType: 'sap.m.IconTabFilter', properties: { key: 'items' } }` |
| Column list item | `controlType` + `ancestor` | `{ controlType: 'sap.m.ColumnListItem', ancestor: { id: 'table' } }` |
| Smart table toolbar button | `ancestor` chain | `{ controlType: 'sap.m.Button', properties: { text: 'Create' }, ancestor: { controlType: 'sap.ui.comp.smarttable.SmartTable' } }` |

## Anti-Patterns

- Never use generated IDs like `__button0`, `__xmlview0--field3`
- Never target inner controls of SmartField (use SmartField + bindingPath)
- Never use CSS selectors (`.sapMBtn`) for UI5 controls
- Never use `page.locator()` for UI5 controls -- use `ui5.control()`

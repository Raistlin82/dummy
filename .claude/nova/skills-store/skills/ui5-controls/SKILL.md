---
name: ui5-controls
description: >
  This skill should be used when "finding UI5 controls", "interacting with controls",
  "asserting control state", or working with "selector syntax", "SmartField inner controls",
  or "custom matchers". Covers id, controlType, properties, bindingPath, ancestor selectors
  and core Praman fixture methods.
version: 0.1.0
---

# UI5 Controls

## Selector Interface

Build selectors using the `UI5Selector` interface:

- `id` -- control ID (stable, preferred when available)
- `controlType` -- fully qualified UI5 class (e.g., `sap.m.Button`)
- `properties` -- key-value pairs matching control properties
- `bindingPath` -- `{ modelName?, propertyPath }` for model-bound controls
- `ancestor` -- parent selector to scope discovery
- `descendant` -- child selector to scope discovery
- `searchOpenDialogs` -- set `true` for controls inside dialogs/popovers

## Selector Priority

Use this order when choosing selectors:

1. `id` -- most stable, use when the app defines stable IDs
2. `controlType` + `properties` -- reliable for buttons, labels, titles
3. `bindingPath` -- best for form fields bound to OData properties
4. `ancestor`-scoped -- narrow results when multiple controls match

Never use generated IDs (e.g., `__button0`, `__field2-inner`). These are unstable.

## Core Methods

Interact with controls through the `ui5` fixture:

- `ui5.control(selector)` -- find single control, returns typed proxy
- `ui5.controls(selector)` -- find multiple controls
- `ui5.click(selector)` -- click a control
- `ui5.fill(selector, value)` -- set value + fire change event
- `ui5.press(selector)` -- trigger press event (buttons)
- `ui5.select(selector, key)` -- select item in dropdown/combobox
- `ui5.getText(selector)` -- read text property
- `ui5.getValue(selector)` -- read value property
- `ui5.waitForUI5()` -- wait for pending async operations to settle

Call `ui5.waitForUI5()` after every interaction that triggers server requests or UI updates.

## SmartField Pattern

Target SmartField directly by `controlType: 'sap.ui.comp.smartfield.SmartField'` with `bindingPath`. Do not target inner controls (`sap.m.Input`, `sap.m.ComboBox`) inside SmartFields -- they are generated dynamically and have unstable IDs.

## Custom Matchers

Assert control state with Praman's custom expect matchers:

- `toHaveUI5Text(expected)` -- control text matches
- `toBeUI5Visible()` -- control is visible in DOM
- `toBeUI5Enabled()` -- control is enabled (not read-only)
- `toHaveUI5Property(name, value)` -- arbitrary property check
- `toHaveUI5ValueState(state)` -- value state (Error, Warning, Success, None)

Use these instead of Playwright's `toBeVisible()` or `toHaveText()` for UI5 controls.

Refer to `references/` for selector strategy and control type tables. Refer to `examples/` for interaction patterns.

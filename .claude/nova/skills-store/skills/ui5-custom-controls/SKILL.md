---
name: ui5-custom-controls
description: >
  Use when creating SAPUI5 custom controls: Control.extend(), renderer pattern,
  metadata definition with properties, aggregations and events, lifecycle hooks
  (init, onBeforeRendering, onAfterRendering, exit), TypeScript custom controls,
  or reusable UI5 control development.
metadata:
  category: ui5
  version: "1.0.0"
  keywords: [custom control, Control.extend, renderer, apiVersion 2, metadata, properties, aggregations, events, lifecycle hooks, init, onAfterRendering, exit]
  related:
    ui5-data-binding: bind data to custom control properties
    fiori-flexible-programming: use custom controls in Fiori extension fragments
    ui5-i18n: localize custom control labels
---

# UI5 Custom Controls — Best Practices

> **Primary reference**: https://ui5.sap.com/#/topic/8dcab0011d274051808f959800cabf9f
> **Developing controls**: https://ui5.sap.com/#/topic/91f1703b6f4d1014b6dd926db0e91070
> **TypeScript controls**: https://ui5.sap.com/#/topic/7a52a32a80ee4414b5e3c30df52086ca

Only create a custom control when a standard UI5 control or Fiori Elements building block cannot meet the requirement with configuration or extension alone. Custom controls carry a maintenance burden.

---

## Basic custom control structure

```js
// src/controls/StatusBadge.js
sap.ui.define([
  "sap/ui/core/Control"
], (Control) => {
  "use strict";

  return Control.extend("my.app.controls.StatusBadge", {

    metadata: {
      properties: {
        text:        { type: "string",  defaultValue: "" },
        status:      { type: "string",  defaultValue: "None" },  // None/Success/Warning/Error
        visible:     { type: "boolean", defaultValue: true }
      },
      aggregations: {
        _icon: { type: "sap.ui.core.Icon", multiple: false, visibility: "hidden" }
      },
      events: {
        press: {
          parameters: {
            status: { type: "string" }
          }
        }
      }
    },

    init() {
      // Called once on instantiation — set up internal aggregations
      const Icon = sap.ui.require("sap/ui/core/Icon");
      this.setAggregation("_icon", new Icon({
        src: "sap-icon://status-positive",
        press: this._onIconPress.bind(this)
      }));
    },

    onBeforeRendering() {
      // Called before every render — update internal state
      const oIcon = this.getAggregation("_icon");
      oIcon.setSrc(this._getIconSrc());
    },

    onAfterRendering() {
      // Called after DOM is written — safe to access DOM here
      // Keep DOM access minimal — prefer CSS over JS DOM manipulation
    },

    exit() {
      // Called when control is destroyed — clean up event listeners, timers
      const oIcon = this.getAggregation("_icon");
      if (oIcon) oIcon.destroy();
    },

    renderer: {
      apiVersion: 2,  // use semantic rendering (required since UI5 1.67)

      render(oRm, oControl) {
        oRm.openStart("div", oControl);
        oRm.class("myAppStatusBadge");
        oRm.class(`myAppStatusBadge--${oControl.getStatus()}`);
        oRm.attr("role", "status");
        oRm.openEnd();

        // Render internal icon aggregation
        oRm.renderControl(oControl.getAggregation("_icon"));

        oRm.openStart("span");
        oRm.openEnd();
        oRm.text(oControl.getText());  // always use oRm.text() — never innerHTML
        oRm.close("span");

        oRm.close("div");
      }
    },

    _getIconSrc() {
      const map = {
        Success: "sap-icon://status-positive",
        Warning: "sap-icon://status-critical",
        Error:   "sap-icon://status-negative",
        None:    "sap-icon://status-inactive"
      };
      return map[this.getStatus()] ?? map.None;
    },

    _onIconPress() {
      this.fireEvent("press", { status: this.getStatus() });
    }
  });
});
```

---

## TypeScript custom control (UI5 >= 1.120)

```ts
// src/controls/StatusBadge.ts
import Control from "sap/ui/core/Control";
import RenderManager from "sap/ui/core/RenderManager";

export default class StatusBadge extends Control {
  static readonly metadata = {
    properties: {
      text:   { type: "string",  defaultValue: "" },
      status: { type: "string",  defaultValue: "None" }
    },
    events: {
      press: {}
    }
  };

  // Generated getters/setters via UI5 TypeScript tooling
  getText!: () => string;
  getStatus!: () => string;
  firePress!: (params?: object) => this;

  static renderer = {
    apiVersion: 2,
    render(rm: RenderManager, control: StatusBadge) {
      rm.openStart("div", control);
      rm.class("myAppStatusBadge");
      rm.openEnd();
      rm.text(control.getText());
      rm.close("div");
    }
  };
}
```

---

## Renderer — apiVersion 2 (mandatory for new controls)

The `apiVersion: 2` enables semantic rendering — controls patch the DOM instead of replacing it entirely, which is significantly more performant. Every new control must use it.

```js
renderer: {
  apiVersion: 2,  // ← required
  render(oRm, oControl) {
    oRm.openStart("div", oControl);  // second arg = the control (sets data-sap-ui attribute)
    oRm.openEnd();
    oRm.text(oControl.getText());    // always escape — never write raw HTML
    oRm.close("div");
  }
}
```

---

## Lifecycle hooks — when to use what

| Hook | When | Use for |
|------|------|---------|
| `init()` | Once, on instantiation | Create internal aggregations, set defaults |
| `onBeforeRendering()` | Before every render | Sync internal aggregation state from properties |
| `onAfterRendering()` | After every render | DOM access, third-party library integration |
| `exit()` | On destroy | Remove event listeners, destroy aggregations, cancel timers |

---

## Using the custom control

```xml
<!-- In XML view — import the control namespace -->
<mvc:View
  xmlns:mvc="sap.ui.core.mvc"
  xmlns:custom="my.app.controls">

  <custom:StatusBadge
    text="{status}"
    status="{statusType}"
    press=".onStatusPress" />

</mvc:View>
```

---

## Common mistakes to avoid

- ❌ Not using `apiVersion: 2` in the renderer — triggers full DOM replacement on every update
- ✅ Always set `apiVersion: 2` — it's required for new controls since UI5 1.67

- ❌ Accessing the DOM in `onBeforeRendering()` — DOM may not exist yet
- ✅ DOM access only in `onAfterRendering()`

- ❌ Writing innerHTML in the renderer (`oRm.unsafeHtml(...)`) — XSS risk
- ✅ Always use `oRm.text()` for text content — it HTML-escapes automatically

- ❌ Not destroying internal aggregations in `exit()` — memory leak
- ✅ Destroy every aggregation and detach every event listener in `exit()`

- ❌ Creating a custom control when a standard control extension would suffice
- ✅ Use Fiori Elements extension points or `sap.ui.core.Fragment` for most custom UI

---
name: ui5-i18n
description: >
  Use when working with SAPUI5 i18n internationalization: ResourceModel, i18n.properties message bundle,
  i18n text binding in XML views, UI5Date.getInstance, DateFormat, NumberFormat,
  supportedLocales, fallbackLocale, oBundle.getText parameters, localization.
metadata:
  category: ui5
  version: "1.0.0"
  keywords: [i18n, ResourceModel, i18n.properties, translation, locale, UI5Date, DateFormat, NumberFormat, supportedLocales, oBundle.getText]
  related:
    localization: CAP-side i18n for OData metadata labels
    ui5-custom-controls: localize custom control text
    fiori-annotations: "@title annotations provide OData-level labels"
---

# UI5 i18n — Best Practices

> **Primary reference**: https://ui5.sap.com/#/topic/91f217c162814be4b9a1f6445b23a867
> **Formatting**: https://ui5.sap.com/#/topic/07e4b920f5734fd78fdaa236f26236d8
> **UI5Date**: https://ui5.sap.com/#/topic/06e4b920f5734fd78fdaa236f26236d8

---

## Setup — i18n model in manifest.json

```json
{
  "sap.ui5": {
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "my.app.i18n.i18n",
          "supportedLocales": ["", "de", "fr", "ja"],
          "fallbackLocale": ""
        }
      }
    }
  }
}
```

File structure:
```
webapp/
└── i18n/
    ├── i18n.properties          ← default (English)
    ├── i18n_de.properties       ← German
    ├── i18n_fr.properties       ← French
    └── i18n_ja.properties       ← Japanese
```

---

## i18n.properties format

```properties
# ── Titles and labels ───────────────────────────────────────────
appTitle=Order Management
appDescription=Manage your purchase orders

pageTitle=Orders
orderNumber=Order Number
status=Status
totalAmount=Total Amount
customer=Customer

# ── Messages with placeholders ──────────────────────────────────
# {0} = first parameter, {1} = second parameter
msgOrderSaved=Order {0} saved successfully
msgStockInsufficient=Insufficient stock: requested {0}, available {1}
msgConfirmDelete=Are you sure you want to delete order {0}?

# ── Button labels ───────────────────────────────────────────────
btnSubmit=Submit
btnCancel=Cancel
btnDelete=Delete
```

---

## Using i18n in XML views

```xml
<!-- Direct binding — most common -->
<Title text="{i18n>pageTitle}" />
<Label text="{i18n>orderNumber}" />

<!-- In table column headers -->
<Column>
  <Text text="{i18n>totalAmount}" />
</Column>

<!-- Button labels -->
<Button text="{i18n>btnSubmit}" press=".onSubmit" />
```

---

## Using i18n in controllers

```js
// Get the resource bundle
_getI18n() {
  return this.getView().getModel("i18n").getResourceBundle();
},

onSubmit() {
  const oBundle = this._getI18n();

  // Simple text
  const sTitle = oBundle.getText("pageTitle");

  // Text with parameters
  const sMsg = oBundle.getText("msgOrderSaved", ["ORD-001"]);

  MessageBox.success(sMsg);
},

onConfirmDelete(orderNumber) {
  const sMsg = this._getI18n().getText("msgConfirmDelete", [orderNumber]);
  MessageBox.confirm(sMsg, {
    onClose: (sAction) => {
      if (sAction === MessageBox.Action.OK) this._deleteOrder();
    }
  });
}
```

---

## Date formatting — use UI5Date (not new Date())

Since UI5 1.111, use `sap/ui/core/date/UI5Date` instead of the native `Date` constructor. UI5Date is locale-aware and works correctly with the UI5 date/time controls.

```js
sap.ui.define([
  "sap/ui/core/date/UI5Date",
  "sap/ui/core/format/DateFormat"
], (UI5Date, DateFormat) => {

  // Create a date — use UI5Date.getInstance() not new Date()
  const oToday = UI5Date.getInstance();
  const oSpecific = UI5Date.getInstance(2025, 0, 15);  // Jan 15, 2025

  // Format for display using user's locale
  const oFormatter = DateFormat.getDateInstance({
    style: "medium"   // "short", "medium", "long", "full"
  });
  const sFormatted = oFormatter.format(oToday);  // "Jan 15, 2025" in en-US

  // Parse a date string
  const oParsed = oFormatter.parse("Jan 15, 2025");

  // Format as ISO string for OData
  const oDateTimeFormatter = DateFormat.getDateTimeInstance({
    pattern: "yyyy-MM-dd'T'HH:mm:ss"
  });
  const sISO = oDateTimeFormatter.format(oToday);
});
```

---

## Number and currency formatting

```js
sap.ui.define([
  "sap/ui/core/format/NumberFormat"
], (NumberFormat) => {

  // Currency formatting
  const oCurrencyFormatter = NumberFormat.getCurrencyInstance({
    showMeasure: true
  });
  const sAmount = oCurrencyFormatter.format(1234.56, "EUR");  // "€1,234.56"

  // Float formatting
  const oFloatFormatter = NumberFormat.getFloatInstance({
    decimals: 2,
    groupingEnabled: true
  });
  const sFloat = oFloatFormatter.format(1234567.89);  // "1,234,567.89"
});
```

In XML view — currency type handles formatting automatically:
```xml
<Text text="{
  parts: [
    { path: 'totalAmount' },
    { path: 'currency_code' }
  ],
  type: 'sap.ui.model.type.Currency',
  formatOptions: { showMeasure: true }
}" />
```

---

## Common mistakes to avoid

- ❌ Hardcoding text strings in XML views or controllers
- ✅ Every user-visible string must come from an i18n bundle

- ❌ Using `new Date()` in UI5 code — not locale-aware, breaks in some timezones
- ✅ Use `UI5Date.getInstance()` since UI5 1.111+

- ❌ Missing `supportedLocales` in the model config — UI5 fetches all locale variants
- ✅ Always declare `supportedLocales` to prevent unnecessary 404 requests

- ❌ Concatenating translated strings with `+` to add dynamic values
- ✅ Use `oBundle.getText("key", [param1, param2])` with `{0}` placeholders

- ❌ Storing formatted dates as strings — loses timezone info
- ✅ Store as ISO 8601 in the model, format only for display using DateFormat

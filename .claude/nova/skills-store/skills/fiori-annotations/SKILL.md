---
name: fiori-annotations
description: >
  Use when working with SAP Fiori Elements UI annotations: UI.LineItem, UI.SelectionFields, UI.Facets,
  UI.FieldGroup, UI.HeaderInfo, UI.DataField, UI.DataFieldForAction, Criticality,
  ValueList, Common.Text, @title, UI.Hidden, OData V4 annotation vocabulary,
  List Report columns, Object Page sections, annotations.cds file.
metadata:
  category: fiori
  version: "1.0.0"
  keywords: [UI.LineItem, UI.SelectionFields, UI.Facets, UI.FieldGroup, UI.HeaderInfo, Criticality, ValueList, Common.Text, "@title", UI.Hidden, annotations.cds, OData V4 annotation]
  related:
    fiori-elements-floorplans: annotations drive List Report and Object Page rendering
    fiori-flexible-programming: extend annotated pages with custom sections
    cds-modeling: CDS entities being annotated
    fiori-draft: draft-specific annotation patterns
---

# Fiori Annotations — Best Practices

> **Primary reference**: https://cap.cloud.sap/docs/guides/uis/fiori
> **OData annotation vocabulary**: https://ui5.sap.com/#/topic/030faebe70b34198b17a93b4c6e7b4d7
> **Feature showcase**: https://github.com/SAP-samples/fiori-elements-feature-showcase

Always annotate in `app/<app-name>/annotations.cds` — never inline in entity definitions,
never in `webapp/annotations.xml` in CAP projects.

---

## Essential annotation structure for List Report + Object Page

```cds
using OrderService from '../../srv/order-service';

annotate OrderService.Orders with @(

  // ── List Report ────────────────────────────────────────────────
  UI.HeaderInfo: {
    TypeName:       'Order',
    TypeNamePlural: 'Orders',
    Title:          { Value: orderNumber },
    Description:    { Value: customer.name }
  },

  // Columns in the list table
  UI.LineItem: [
    { Value: orderNumber,       Label: 'Order #' },
    { Value: customer.name,     Label: 'Customer' },
    { Value: orderDate },
    { Value: totalAmount },
    { Value: currency_code },
    { Value: status,            Criticality: statusCriticality },
    // Inline action button
    { $Type: 'UI.DataFieldForAction', Action: 'OrderService.submitOrder', Label: 'Submit' }
  ],

  // Filter fields above the table
  UI.SelectionFields: [ status, customer_ID, orderDate ],

  // ── Object Page ────────────────────────────────────────────────
  UI.Facets: [
    {
      $Type:  'UI.ReferenceFacet',
      Label:  'General',
      ID:     'GeneralFacet',
      Target: '@UI.FieldGroup#General'
    },
    {
      $Type:  'UI.ReferenceFacet',
      Label:  'Items',
      ID:     'ItemsFacet',
      Target: 'items/@UI.LineItem'  // child entity table
    }
  ],

  UI.FieldGroup #General: {
    $Type: 'UI.FieldGroupType',
    Data: [
      { Value: orderNumber },
      { Value: orderDate },
      { Value: totalAmount },
      { Value: status }
    ]
  }
);
```

---

## Criticality — traffic light colours

```cds
// In your service entity or as calculated element:
entity Orders {
  status            : String enum { Draft; Open; Approved; Rejected; };
  statusCriticality : Integer;  // 0=None 1=Red 2=Yellow 3=Green 5=Purple
}

// In the handler — set criticality based on status:
this.after('READ', Orders, orders => {
  for (const o of orders) {
    o.statusCriticality = 
      o.status === 'Approved' ? 3 :   // green
      o.status === 'Rejected' ? 1 :   // red
      o.status === 'Open'     ? 2 : 0 // yellow / none
  }
})

// In annotations — reference the criticality field:
{ Value: status, Criticality: statusCriticality }
```

---

## Value Help (ValueList)

```cds
// Simple value help from an associated entity
annotate OrderService.Orders:customer_ID with @(
  Common.ValueList: {
    CollectionPath: 'Customers',
    Parameters: [
      { $Type: 'Common.ValueListParameterOut',
        LocalDataProperty: customer_ID,
        ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly',
        ValueListProperty: 'name' }
    ]
  },
  Common.ValueListWithFixedValues: false
);
```

---

## Common.Text — show description next to ID

```cds
// Show customer name next to customer ID in all UI contexts
annotate OrderService.Orders:customer_ID with
  @Common.Text: customer.name
  @Common.TextArrangement: #TextFirst;  // "ACME Corp (C001)"
```

---

## Field labels via @title

```cds
// Set once on the entity — applies everywhere in the UI
annotate OrderService.Orders with {
  orderNumber  @title: 'Order Number';
  orderDate    @title: 'Order Date';
  totalAmount  @title: 'Total Amount';
  status       @title: 'Status';
}
```

---

## Hiding fields

```cds
// Always hidden
annotate OrderService.Orders:technicalField with @UI.Hidden;

// Conditionally hidden (expression)
annotate OrderService.Orders:internalNote with @UI.Hidden: (status != 'Admin');
```

---

## Multi-line text

```cds
annotate OrderService.Orders:description with @UI.MultiLineText;
```

---

## Header Facets on Object Page

```cds
UI.HeaderFacets: [
  {
    $Type:  'UI.ReferenceFacet',
    Target: '@UI.DataPoint#Amount'
  },
  {
    $Type:  'UI.ReferenceFacet',
    Target: '@UI.DataPoint#Status'
  }
],

UI.DataPoint #Amount: {
  Value: totalAmount,
  Title: 'Total Amount'
},

UI.DataPoint #Status: {
  Value:       status,
  Criticality: statusCriticality,
  Title:       'Status'
}
```

---

## Actions — bound vs unbound

```cds
// Bound action (acts on selected record)
{ $Type: 'UI.DataFieldForAction',
  Action: 'OrderService.submitOrder',
  Label:  'Submit',
  Determining: true }  // shows in footer of Object Page

// Unbound action (global, in table toolbar)
{ $Type: 'UI.DataFieldForAction',
  Action: 'OrderService.EntityContainer/createDraftOrder',
  Label:  'New Draft' }
```

---

## Annotation file organisation

For large apps, split annotations by concern:

```
app/orders/
├── field-annotations.cds     ← @title, @UI.Hidden, Common.Text
├── list-report.cds            ← UI.LineItem, UI.SelectionFields
├── object-page.cds            ← UI.Facets, UI.FieldGroup, UI.HeaderFacets
└── value-helps.cds            ← Common.ValueList
```

Import all in a single `index.cds`:
```cds
using from './field-annotations';
using from './list-report';
using from './object-page';
using from './value-helps';
```

---

## Common mistakes to avoid

- ❌ Putting annotations in `webapp/annotations.xml` — not compiled by CAP, silently ignored
- ✅ Always use `app/<name>/annotations.cds`

- ❌ Hardcoded label strings in `UI.LineItem` — not translatable
- ✅ Use `@title` on the field + `'{i18n>key}'` for labels

- ❌ Using `statusCriticality` as a plain Integer without `@UI.Hidden` — shows as a column
- ✅ Always hide technical helper fields: `@UI.Hidden`

- ❌ Referencing a child entity table without `@UI.LineItem` on the child entity
- ✅ Child entity needs its own `UI.LineItem` annotation for the table facet to render

- ❌ Forgetting `ID` on facets when using `UI.CollectionFacet` — breaks rendering
- ✅ Every `CollectionFacet` must have a unique `ID`

- ❌ Mixing OData V2 annotation syntax (`@sap.label`) with V4 vocabulary
- ✅ V4 only: `@title`, `@Common.Text`, `@UI.*`

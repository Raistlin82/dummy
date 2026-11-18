import { test, expect } from 'playwright-praman';

test('Object Page - view and edit', async ({ ui5, ui5Navigation }) => {
  await ui5Navigation.navigateToHash("#PurchaseOrder-manage&/PurchaseOrder('4500001234')");
  await ui5.waitForUI5();

  // Read header
  const title = await ui5.getText({
    controlType: 'sap.m.Title',
    ancestor: { controlType: 'sap.f.DynamicPageTitle' },
  });

  // Edit
  await ui5.click({ controlType: 'sap.m.Button', properties: { text: 'Edit' } });
  await ui5.fill(
    { controlType: 'sap.ui.comp.smartfield.SmartField', bindingPath: { propertyPath: 'PurchasingOrganization' } },
    '1000',
  );
  await ui5.click({ controlType: 'sap.m.Button', properties: { text: 'Save' } });
  await ui5.waitForUI5();
});

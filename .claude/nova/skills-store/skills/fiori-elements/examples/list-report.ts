import { test, expect } from 'playwright-praman';

test('List Report - filter and select', async ({ ui5, ui5Navigation }) => {
  await ui5Navigation.navigateToApp('PurchaseOrder-manage');
  await ui5.waitForUI5();

  // Fill filter bar field by binding path
  await ui5.fill(
    { controlType: 'sap.ui.comp.smartfield.SmartField', bindingPath: { propertyPath: 'Supplier' } },
    'SUP-001',
  );

  // Click Go
  await ui5.click({ controlType: 'sap.m.Button', properties: { text: 'Go' } });
  await ui5.waitForUI5();

  // Verify results
  const rowCount = await ui5.table.getRowCount('smartTable');
  expect(rowCount).toBeGreaterThan(0);

  // Select first row
  await ui5.table.selectRow('smartTable', 0);
});

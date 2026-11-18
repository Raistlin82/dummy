import { test, expect } from 'playwright-praman';

test('UI5 control interactions', async ({ ui5, ui5Navigation }) => {
  await ui5Navigation.navigateToApp('PurchaseOrder-manage');
  await ui5.waitForUI5();

  // Click by controlType + property
  await ui5.click({ controlType: 'sap.m.Button', properties: { text: 'Go' } });
  await ui5.waitForUI5();

  // Fill by ID
  await ui5.fill({ id: 'vendorInput' }, 'SUP-001');

  // Select by key
  await ui5.select({ id: 'companyCode' }, '1000');

  // Get control proxy and read properties
  const btn = await ui5.control({ controlType: 'sap.m.Button', properties: { text: 'Save' } });
  const enabled = await btn.getEnabled();
  expect(enabled).toBe(true);

  // Custom matchers
  const status = await ui5.control({ id: 'statusText' });
  await expect(status).toHaveUI5Text('Active');
  await expect(status).toBeUI5Visible();
});

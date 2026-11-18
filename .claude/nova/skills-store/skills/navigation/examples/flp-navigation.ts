import { test, expect } from 'playwright-praman';

test('FLP navigation patterns', async ({ ui5, ui5Navigation }) => {
  // By semantic object
  await ui5Navigation.navigateToApp('PurchaseOrder-manage');
  await ui5.waitForUI5();

  // Deep link with entity key
  await ui5Navigation.navigateToHash("#PurchaseOrder-manage&/PurchaseOrder('4500001234')");
  await ui5.waitForUI5();

  // With explicit intent + params
  await ui5Navigation.navigateToIntent(
    { semanticObject: 'SalesOrder', action: 'display' },
    { SalesOrder: '1000001' },
  );

  // By tile title
  await ui5Navigation.navigateToTile('Manage Purchase Orders');

  // Back navigation
  await ui5Navigation.navigateBack();

  // Get current hash
  const hash = await ui5Navigation.getCurrentHash();
  expect(hash).toContain('PurchaseOrder');
});

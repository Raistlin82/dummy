// Basic username/password auth setup for SAP OnPrem
import { test as setup } from 'playwright-praman';

setup('authenticate', async ({ page, pramanConfig }) => {
  const { SAPAuthHandler } = await import('playwright-praman/auth');
  const handler = new SAPAuthHandler(page, pramanConfig.auth!);
  await handler.login();
  await page.context().storageState({ path: '.auth/session.json' });
});

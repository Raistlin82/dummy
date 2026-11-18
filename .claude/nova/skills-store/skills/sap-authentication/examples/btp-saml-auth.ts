// BTP SAML2/IAS auth for Cloud Foundry apps
import { test as setup } from 'playwright-praman';

setup('authenticate-btp', async ({ page, pramanConfig }) => {
  const { SAPAuthHandler } = await import('playwright-praman/auth');
  const handler = new SAPAuthHandler(page, {
    ...pramanConfig.auth!,
    strategy: 'btp-saml',
  });
  await handler.login();
  await page.context().storageState({ path: '.auth/session.json' });
});

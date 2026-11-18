// WARNING: This example intentionally uses @playwright/test (NOT playwright-praman).
// Raw Playwright auth for MCP agent seeds where Praman fixtures are unavailable.
// Do NOT copy this pattern into regular tests — use playwright-praman imports instead.
import { test } from '@playwright/test';

test('sap-seed', async ({ page }) => {
  await page.goto(process.env['SAP_CLOUD_BASE_URL']!, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  // Detect login form (supports SAP IAS, BTP, OnPrem)
  const needsLogin = await page.evaluate(() =>
    document.querySelector('input[name="j_username"], #USERNAME_FIELD, #logOnForm') !== null
    || location.hostname === 'accounts.sap.com'
    || location.hostname.endsWith('.accounts.sap.com')
  );

  if (needsLogin) {
    const username = await page.$('input[name="j_username"], #USERNAME_FIELD, input[name="username"]');
    const password = await page.$('input[name="j_password"], #PASSWORD_FIELD, input[name="password"]');
    if (username && password) {
      await username.fill(process.env['SAP_CLOUD_USERNAME']!);
      await password.fill(process.env['SAP_CLOUD_PASSWORD']!);
      const loginBtn = await page.$('button[type="submit"], input[type="submit"], #LOGIN_LINK');
      if (loginBtn) await loginBtn.click();
    }
  }

  // Wait for UI5 core
  await page.waitForFunction(
    () => window.sap?.ui?.getCore && typeof window.sap.ui.getCore === 'function',
    { timeout: 300_000 },
  );
});

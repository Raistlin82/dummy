#!/usr/bin/env node
// Real screenshots of the app figures of a guide (kind app), without an SAP system: the app runs on its mock server
// and in the local SAP Fiori launchpad sandbox, Playwright opens each figure's page at 1440 × 900 and writes
// screenshots/figNN-<id>.png with the numbers of guide.yaml. The SAP figures (kind sap) are captured on the system,
// as capture-sap.md lists them.
//
// A figure says how it is taken, in guide.yaml:
//   capture:
//     url: /test/flpSandbox.html?sap-language=EN&sap-theme=sap_horizon#Notification-manage   # on --base-url
//     waitFor: .sapMListTbl          # CSS selector to wait for (optional)
//     wait: 3000                     # extra milliseconds after the page is idle (default 2000)
//     click: [{ role: button, name: Create }, '#some-id']   # optional, in order, before the shot; also the other actions:
//                                    #   { selector: '#x', wait: 500 }   a click with its own wait (a string has the default 1500)
//                                    #   { fill: '#field', text: 'abc' }  write into a field
//                                    #   { press: 'Enter', on: '#field' } a key (on omitted: the page)
//                                    #   { evaluate: "document.querySelector('.x').textContent = ''" }  a script on the page
//     viewport: { width: 1600, height: 900 }   # optional window of this figure (or "1600x900"), else --viewport, else 1440 × 900
//     keepFocus: true                # optional: do not take the focus away before the shot (it closes the popovers)
//     hideFocus: true                # optional: no focus border or outline on the element that keeps it (with keepFocus)
//     after: [{ selector: '#discard' }]   # optional: the same actions as click, after the shot (discard a draft the shot left)
//     reset: /mock/reset             # optional: a URL called (POST) before the figure, to bring the mock back to its first state;
//                                    #   false: none for this figure; --reset <url> for every figure
//     session: shared                # optional: fresh (default) is a new browser context for the figure, so no state of the
//                                    #   figures before it; shared goes on in the context of the same user and window
//     timeout: 90000                 # optional: milliseconds for the load and the waits of this figure (else --timeout, 60000)
//     hide: ['.sapUshellShellHeadItm']                       # CSS selectors hidden (visibility), beyond the avatar
//     clip: { x: 0, y: 0, width: 1440, height: 560 }        # or selector: '.sapMGT' for one element
//     user: alice                    # optional: who is signed in (the role of a user guide), else --user
//     forbid: ['Mario Rossi']        # optional: texts the page must not show (personal names), beyond --names
//     compose: { selectors: ['#tile-a', '#tile-b'], gap: 16, padding: '40x32', background: '#fff' }   # one image of several elements
//                                    #   side by side; padding is the frame around them (a number, "40x32" = 40 on the sides and
//                                    #   32 above and below, or { x: 40, y: 32 }); without it the frame is as wide as the gap
//     compose: { parts: [{ url: '/a.html', selector: '#tile', waitFor: '#tile' }, { url: 'http://localhost:8086/b.html', selector: '#tile' }] }
//                                    # the elements of other pages too (a part takes waitFor, wait, click and user as a figure)
//
// Any app that runs on the PC can be captured, not only the mock of SAP Fiori tools: a CAP project with its own
// launchpad page (cds watch, app/launchpad.html or the sandbox of cds-plugin-ui5) is --start "npx cds watch" and a url
// on its port. Its mocked users (cds.requires.auth kind mocked, users in package.json or .cdsrc.json) sign in with
// HTTP basic authentication: the user of the figure or of --user, with the password of CAPTURE_PASSWORD (empty for the
// default mocked users), never in guide.yaml. The external systems the app calls (an SAP S/4HANA, SharePoint) are
// mocked by cds watch from their models when no credentials are bound, with the test data of the project.
//
// Several mock servers in the same run: --server "<base url>=<command>" (repeatable) starts one more and waits for it; a
// figure reaches it with an absolute capture.url on that address (a second demo license on port 8086, for example).
// --names "Mario Rossi,Anna Bianchi" (or a file, one name per line) refuses every shot whose page shows one of them.
//
//   node <skill>/scripts/guide/capture.mjs --guide docs/guides/user-admin --base-url http://localhost:8080
//        [--start "npm run start-mock"] [--server "http://localhost:8086=npm run start-mock2"] [--names <list|file>]
//        [--only <figure id>,...] [--lang EN] [--user alice] [--viewport 1600x900] [--timeout 90000] [--reset <url>]
// --start launches the mock server in its own process group, waits for --base-url and stops it at the end; without it
// the server must already run. Every shot is refused when the page shows an e-mail address: the demo data of the mock
// must be fictitious. Needs Playwright with Chromium (the one of the environment; PLAYWRIGHT_MODULE to point elsewhere).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadGuide, requireInstalled } from './lib/model.mjs';

process.on('uncaughtException', (e) => { console.error(e.message); process.exit(2); });

const { values: args } = parseArgs({
  options: {
    guide: { type: 'string' }, 'base-url': { type: 'string', default: 'http://localhost:8080' }, start: { type: 'string' },
    server: { type: 'string', multiple: true }, names: { type: 'string' }, viewport: { type: 'string' }, timeout: { type: 'string' },
    reset: { type: 'string' }, 'chrome-args': { type: 'string' },
    only: { type: 'string' }, lang: { type: 'string' }, user: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  },
});
if (args.help || !args.guide) {
  console.log('node capture.mjs --guide <folder> [--base-url http://localhost:8080] [--start "<command>"] [--server "<url>=<command>"]... [--names <list|file>] [--viewport 1600x900] [--timeout ms] [--reset <url>] [--chrome-args "<flags>"] [--only id,...] [--lang EN] [--user <mocked user>]');
  process.exit(args.help ? 0 : 2);
}

const VIEW = { width: 1440, height: 900 };
const asViewport = (v) => {
  if (!v) return null;
  if (typeof v === 'string') { const m = /^(\d+)x(\d+)$/.exec(v.trim()); if (!m) throw new Error(`viewport "${v}": the form is 1600x900`); return { width: Number(m[1]), height: Number(m[2]) }; }
  return { width: Number(v.width), height: Number(v.height) };
};
const DEFAULT_VIEW = asViewport(args.viewport) ?? VIEW;
const DEFAULT_TIMEOUT = Number(args.timeout ?? 60_000);
// the user avatar and the name in the shell bar: hidden, nothing drawn in their place
const AVATAR = ['#meAreaHeaderButton', '.sapUshellShellHeadUserItem', '[id$="userActionsMenuHeaderButton"]', '.sapUshellShellAvatar', 'ui5-avatar', '.sapFAvatar.sapUshellAvatar'];
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

const g = await loadGuide(args.guide);
const only = args.only ? new Set(args.only.split(',')) : null;
const figures = g.figures.filter((f) => f.kind === 'app' && (!only || only.has(f.id)));
const withoutCapture = figures.filter((f) => !f.capture?.url);
if (withoutCapture.length) console.log(`  no capture.url (taken by hand): ${withoutCapture.map((f) => f.id).join(', ')}`);
const todo = figures.filter((f) => f.capture?.url);
if (!todo.length) { console.log('No app figure with capture.url to take.'); process.exit(0); }

// the servers of the run: the main one (--base-url, with --start) and the others (--server "<url>=<command>"), each in its
// own process group, stopped at the end
const servers = [];
const stop = () => { for (const sv of servers) if (sv.child) try { process.kill(-sv.child.pid, 'SIGTERM'); } catch { /* already gone */ } };
process.on('exit', stop);
const up = async (url) => fetch(url).then((r) => r.status < 500).catch(() => false);
async function ensure(url, command) {
  if (await up(url)) return;
  if (!command) { console.error(`${url} does not answer: start the mock server, or pass --start "<command>" (--server "<url>=<command>" for another one)`); process.exit(2); }
  const sv = { url, child: spawn(command, { shell: true, detached: true, stdio: 'ignore', cwd: process.cwd() }) };
  servers.push(sv);
  const t0 = Date.now();
  while (!(await up(url))) {
    if (Date.now() - t0 > 120_000) { console.error(`${url} did not answer in 120 s after: ${command}`); process.exit(2); }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
await ensure(args['base-url'], args.start);
for (const spec of args.server ?? []) {
  const at = spec.indexOf('=');
  if (at < 1) { console.error(`--server "${spec}": the form is "<base url>=<command>"`); process.exit(2); }
  await ensure(spec.slice(0, at), spec.slice(at + 1));
}

// personal names the pages must not show: --names, a list or a file with a name per line, and capture.forbid of a figure
const readNames = (v) => (existsSync(v) ? readFileSync(v, 'utf8').split(/\r?\n/) : v.split(',')).map((n) => n.trim()).filter(Boolean);
const NAMES = args.names ? readNames(args.names) : [];
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameIn = (text, names) => names.find((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}([^\\p{L}\\p{N}]|$)`, 'iu').test(text));

const { chromium } = requireInstalled('playwright');
mkdirSync(g.paths.shots, { recursive: true });
const problems = [];
// the browser flags of the shots: no GPU, no partial raster, no LCD text, sRGB, no font hinting, so that the anti-aliasing of the
// rounded corners of a button does not depend on the machine or on the run (--chrome-args="<flags>" replaces them, --chrome-args= is none)
const RENDER_ARGS = ['--disable-gpu', '--disable-partial-raster', '--disable-lcd-text', '--force-color-profile=srgb', '--font-render-hinting=none', '--force-device-scale-factor=1'];
const browser = await chromium.launch({ args: args['chrome-args'] === undefined ? RENDER_ARGS : args['chrome-args'].split(/\s+/).filter(Boolean) });

// a style sheet, not an inline style: UI5 redraws the shell bar and the avatar would come back with an inline one
const hideCss = (selectors) => `${selectors.join(',')} { visibility: hidden !important; }`;

// the frame of a strip: a number, "40x32" (the sides, then above and below) or { x, y }; without it, as wide as the gap
const framePadding = (padding, gap) => {
  if (padding === undefined || padding === null) return { x: gap, y: gap };
  if (typeof padding === 'number') return { x: padding, y: padding };
  if (typeof padding === 'string') { const m = /^(\d+)x(\d+)$/.exec(padding.trim()); if (!m) throw new Error(`compose.padding "${padding}": the form is 40x32`); return { x: Number(m[1]), y: Number(m[2]) }; }
  return { x: Number(padding.x ?? gap), y: Number(padding.y ?? gap) };
};
// no focus border: UI5 draws it with an outline, or on the ::before and ::after of the focused element
const NO_FOCUS_CSS = ':focus, :focus-visible { outline: none !important; box-shadow: none !important; } :focus::before, :focus::after { outline: none !important; border-color: transparent !important; box-shadow: none !important; }';

// the mock back to its first state, before a figure: a URL called with POST
async function resetMock(url, id) {
  if (!url) return null;
  const target = new URL(url, args['base-url']);
  const response = await fetch(target, { method: 'POST' }).catch((e) => ({ ok: false, status: e.message }));
  return response.ok ? null : `${id}: the reset ${target.pathname} answered ${response.status}`;
}

// one action before the shot: a click (CSS selector, role and name), a field, a key, a script on the page
async function act(page, action, timeout) {
  if (typeof action === 'string') await page.locator(action).first().click({ timeout });
  else if (action.fill !== undefined) await page.locator(action.fill).first().fill(String(action.text ?? ''), { timeout });
  else if (action.press !== undefined) {
    if (action.on) await page.locator(action.on).first().press(action.press, { timeout });
    else await page.keyboard.press(action.press);
  } else if (action.evaluate !== undefined) await page.evaluate(action.evaluate);
  else if (action.selector !== undefined) await page.locator(action.selector).first().click({ timeout });
  else await page.getByRole(action.role ?? 'button', { name: action.name, exact: action.exact ?? false }).first().click({ timeout });
  await page.waitForTimeout(action?.wait ?? 1500);
}

// the page at rest before a shot: fonts loaded, and the transitions and finite animations run to their end (a button
// edge caught half-way makes two shots of one page differ). Infinite animations are left to the shot, which freezes them.
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const running = document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity));
    await Promise.allSettled(running.map((a) => a.finished));
    // two frames drawn after the last change, so the shot is not of a layer still being composed
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }).catch(() => {});
  await page.waitForTimeout(100);
}
// every shot the same way: animations to their end state, no blinking caret
const SHOT = { animations: 'disabled', caret: 'hide' };

// a page of a figure (or of a part of a strip) brought to what the shot shows; null, or why it must not be shot
async function prepare(page, c, { id, lang, view, timeout, forbid }) {
  const url = new URL(c.url, args['base-url']);
  if (!url.searchParams.has('sap-language')) url.searchParams.set('sap-language', lang);
  const response = await page.goto(url.href, { timeout });
  if (response?.status() === 401) return `${id}: 401 at ${url.pathname}: say who signs in (capture.user or --user, CAPTURE_PASSWORD)`;
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  if (c.waitFor) await page.waitForSelector(c.waitFor, { timeout });
  await page.waitForTimeout(c.wait ?? 2000);
  for (const action of c.click ?? []) await act(page, action, timeout);
  await page.addStyleTag({ content: hideCss([...AVATAR, ...(c.hide ?? [])]) + (c.hideFocus ? ` ${NO_FOCUS_CSS}` : '') });
  if (!c.keepFocus) await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.move(view.width - 2, view.height - 2);
  await page.waitForTimeout(300);
  await settle(page);
  const text = await page.evaluate(() => document.body.innerText);
  const mail = text.match(EMAIL);
  if (mail) return `${id}: the page shows an e-mail address (${mail[0]}): use fictitious demo data`;
  const person = nameIn(text, [...NAMES, ...(forbid ?? [])]);
  if (person) return `${id}: the page shows «${person}»: a personal name does not go into a customer document, use fictitious demo data`;
  return null;
}

try {
  const lang = (args.lang ?? g.meta.language ?? 'en').toUpperCase();
  // the browser contexts: one per figure (session fresh, the default), or one per signed-in user and window (session shared)
  const shared = new Map();
  const contextFor = async (user, view, session) => {
    const options = { viewport: view, deviceScaleFactor: 1, locale: lang.toLowerCase(),
      ...(user ? { httpCredentials: { username: user, password: process.env.CAPTURE_PASSWORD ?? '' } } : {}) };
    // the credentials go with every request to the servers of the run, not only after a 401: a local server that signs
    // an anonymous request in as a default user (the configurator signs it in as admin) would otherwise show that user's
    // pages. httpCredentials answers a challenge only; the header goes to the servers of the run, never to a CDN
    const open = async () => {
      const context = await browser.newContext(options);
      if (user) {
        const basic = `Basic ${Buffer.from(`${user}:${process.env.CAPTURE_PASSWORD ?? ''}`).toString('base64')}`;
        const origins = new Set([args['base-url'], ...servers.map((sv) => sv.url), ...(args.server ?? []).map((s) => s.slice(0, s.indexOf('=')))]
          .filter(Boolean).map((u) => new URL(u).origin));
        await context.route((url) => origins.has(url.origin), (route) =>
          route.continue({ headers: { ...route.request().headers(), authorization: basic } }));
      }
      return context;
    };
    if (session === 'shared') {
      const key = `${user}|${view.width}x${view.height}`;
      if (!shared.has(key)) shared.set(key, await open());
      return { context: shared.get(key), close: async () => {} };
    }
    const context = await open();
    return { context, close: () => context.close() };
  };
  for (const f of todo) {
    const c = f.capture;
    let owner = null;
    // an error of one figure is the problem of that figure: the others are taken all the same
    try {
      const view = asViewport(c.viewport) ?? DEFAULT_VIEW;
      const timeout = Number(c.timeout ?? DEFAULT_TIMEOUT);
      const user = c.user ?? args.user ?? '';
      owner = await contextFor(user, view, c.session ?? 'fresh');
      const failedReset = await resetMock(c.reset === false ? null : c.reset ?? args.reset, f.id);
      if (failedReset) { problems.push(failedReset); continue; }
      const page = await owner.context.newPage();
      const why = await prepare(page, c, { id: f.id, lang, view, timeout, forbid: c.forbid });
      if (why) { problems.push(why); await page.close(); continue; }
      const file = path.join(g.paths.shots, f.file);
      if (c.compose) {
        // a strip: each element as its own image, side by side on a plain page, shot as one
        const gap = c.compose.gap ?? 16;
        const frame = framePadding(c.compose.padding, gap);
        const images = [];
        for (const sel of c.compose.selectors ?? []) images.push((await page.locator(sel).first().screenshot({ timeout, ...SHOT })).toString('base64'));
        let refused = null;
        for (const [i, part] of (c.compose.parts ?? []).entries()) {
          const other = await owner.context.newPage();
          const bad = await prepare(other, { ...part, user: undefined }, { id: `${f.id}: part ${i + 1}`, lang, view, timeout, forbid: [...(c.forbid ?? []), ...(part.forbid ?? [])] });
          if (bad) refused = bad; else images.push((await other.locator(part.selector ?? 'body').first().screenshot({ timeout, ...SHOT })).toString('base64'));
          await other.close();
        }
        if (refused) { problems.push(refused); await page.close(); continue; }
        const strip = await owner.context.newPage();
        await strip.setContent(`<body style="margin:0;background:${c.compose.background ?? '#fff'}"><div id="strip" style="display:inline-flex;gap:${gap}px;padding:${frame.y}px ${frame.x}px;align-items:flex-start">` +
          images.map((b) => `<img src="data:image/png;base64,${b}">`).join('') + '</div></body>');
        await strip.locator('#strip').screenshot({ path: file, timeout, ...SHOT });
        await strip.close();
      } else if (c.selector) await page.locator(c.selector).first().screenshot({ path: file, timeout, ...SHOT });
      else await page.screenshot({ path: file, ...SHOT, ...(c.clip ? { clip: c.clip } : {}) });
      console.log(`  ✓ ${path.relative(process.cwd(), file)}`);
      // after the shot: what the figure left on the page or on the server (a draft) is taken away; the shot is already written
      for (const action of c.after ?? []) await act(page, action, timeout);
      await page.close();
    } catch (e) {
      problems.push(`${f.id}: ${String(e.message).split('\n')[0]}`);
    } finally {
      await owner?.close();
    }
  }
} finally {
  await browser.close();
  stop();
}
for (const f of todo) if (!existsSync(path.join(g.paths.shots, f.file)) && !problems.some((p) => p.startsWith(`${f.id}:`))) problems.push(`${f.id}: not written`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Then: build.mjs again, so the documents get the new screenshots.');

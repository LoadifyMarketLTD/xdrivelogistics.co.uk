import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// This is an authenticated live-route gate, not a mocked login. It deliberately
// skips without authorised test credentials instead of treating a login redirect
// as successful visual verification.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

test.use({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });

// Exercise the actual CSS imported by Driver's live route layout with the
// JSX class hooks used by Diary and Return Journeys. This is cascade proof,
// not proof of an authenticated session or remote Supabase data.
const driverDir = path.resolve(process.cwd(), 'app/driver');
const driverLayout = fs.readFileSync(path.join(driverDir, 'layout.tsx'), 'utf8');
const cssImports = [...driverLayout.matchAll(/^import ['"]([^'"]+\.css)['"];?/gm)]
  .map((match) => path.resolve(driverDir, match[1]));

test('Driver Diary and Return Journeys Add Journey retain compact route-specific density', async ({ page }) => {
  await page.setContent(`<!doctype html><html><head><style>body{margin:0}</style></head><body>
    <div class="xdrive-workspace-measured xdrive-operational-top-workspace xdrive-driver-workspace">
      <div class="top-workspace-shell__content"><div class="driver-prototype-port driver-returns-exchange">
        <div class="driver-board-layout">
          <aside class="driver-filter-rail"><div class="driver-filter-rail__header">Journey Search</div>
            <div class="driver-filter-rail__body"><label>From</label><input placeholder="From"></div>
          </aside>
          <main class="driver-board-main">
            <section class="postload-section">
              <div class="postload-section-head"><div><span>1</span><b>Add Journey</b>
                <small>Publish your available empty journey</small></div></div>
              <form class="postload-grid job">
                <div class="postload-field"><label>From</label><input placeholder="Pickup"></div>
                <div class="postload-field"><label>To</label><select><option>Destination</option></select></div>
              </form>
            </section>
            <div class="driver-diary-route"><div class="diary-bookings">
              <button class="diary-action" type="button">Show details</button>
            </div></div>
          </main>
        </div>
      </div></div>
    </div>
  </body></html>`);
  for (const cssPath of [...cssImports,
    path.join(driverDir, 'returns/returns-exchange.css'),
    path.join(driverDir, 'history/diary-exchange.css')]) {
    await page.addStyleTag({ content: fs.readFileSync(cssPath, 'utf8') });
  }
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const styles = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('.driver-filter-rail')!;
      const head = document.querySelector<HTMLElement>('.postload-section-head')!;
      const form = document.querySelector<HTMLElement>('.postload-grid.job')!;
      const input = document.querySelector<HTMLInputElement>('.postload-field input')!;
      const diary = document.querySelector<HTMLButtonElement>('.diary-action')!;
      return {
        railWidth: rail.getBoundingClientRect().width,
        headHeight: head.getBoundingClientRect().height,
        columnCount: getComputedStyle(form).gridTemplateColumns.split(' ').filter(Boolean).length,
        inputHeight: input.getBoundingClientRect().height,
        inputRadius: getComputedStyle(input).borderTopLeftRadius,
        diaryFont: getComputedStyle(diary).fontSize,
        diaryHeight: diary.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    expect(styles.inputHeight, `width=${width}: shared control height`).toBe(24);
    expect(styles.inputRadius, `width=${width}: shared control radius`).toBe('4px');
    expect(styles.headHeight, `width=${width}: two-line journey section header`).toBeGreaterThanOrEqual(36);
    expect(styles.diaryHeight, `width=${width}: compact Diary action`).toBeLessThanOrEqual(36);
    expect(parseFloat(styles.diaryFont), `width=${width}: Diary text density`).toBeLessThanOrEqual(13);
    expect(styles.overflow, `width=${width}: no page overflow`).toBe(false);
    if (width >= 1201) {
      expect(styles.railWidth).toBe(165);
      expect(styles.columnCount).toBe(2);
    } else {
      expect(styles.columnCount).toBe(1);
    }
  }
});

test('CX live operational tabs and search rail stay measured across Availability, My Fleet, Return Journeys and Diary', async ({ page }) => {
  const adminDir = path.resolve(process.cwd(), 'app/admin');
  const layout = fs.readFileSync(path.join(adminDir, 'layout.tsx'), 'utf8');
  const imports = [...layout.matchAll(/^import ['"]([^'"]+\.css)['"];?/gm)]
    .map((match) => path.resolve(adminDir, match[1]));
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div class="xdrive-workspace-measured xdrive-operational-top-workspace xdrive-carrier-workspace">
      <div class="top-workspace-shell__content">
        <div class="workspace-board-layout">
          <aside class="workspace-filter-rail"><div class="workspace-filter-rail__header">Search Panel</div><div class="workspace-filter-rail__body"><label>SEARCH<input value=""></label></div></aside>
          <main><div class="workspace-tab-strip" role="tablist"><button data-active="true">All</button><button>Drivers &amp; Sub-contractors</button><button>Other Drivers</button></div></main>
        </div>
      </div>
    </div>
  </body></html>`);
  for (const cssPath of imports) await page.addStyleTag({ content: fs.readFileSync(cssPath, 'utf8') });
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const styles = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('.workspace-filter-rail')!;
      const tab = document.querySelector<HTMLButtonElement>('.workspace-tab-strip button')!;
      const input = document.querySelector<HTMLInputElement>('.workspace-filter-rail input')!;
      return {
        railWidth: rail.getBoundingClientRect().width,
        tabHeight: tab.getBoundingClientRect().height,
        inputHeight: input.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    if (width >= 1201) expect(styles.railWidth, `width=${width}: CX search rail`).toBe(165);
    expect(styles.tabHeight, `width=${width}: CX subtab height`).toBeGreaterThanOrEqual(26);
    expect(styles.tabHeight, `width=${width}: CX subtab height`).toBeLessThanOrEqual(29);
    expect(styles.inputHeight, `width=${width}: compact filter control`).toBeGreaterThanOrEqual(24);
    expect(styles.inputHeight, `width=${width}: compact filter control`).toBeLessThanOrEqual(32);
    expect(styles.overflow, `width=${width}: no page overflow`).toBe(false);
  }
});

// The real Carrier layout's import order must preserve invalid field feedback.
test('Carrier Create Job validation controls keep the measured red border', async ({ page }) => {
  const adminDir = path.resolve(process.cwd(), 'app/admin');
  const adminLayout = fs.readFileSync(path.join(adminDir, 'layout.tsx'), 'utf8');
  const adminImports = [...adminLayout.matchAll(/^import ['"]([^'"]+\.css)['"];?/gm)]
    .map((match) => path.resolve(adminDir, match[1]));
  await page.setContent('<div class="xdrive-workspace-measured xdrive-carrier-workspace"><div class="carrier-job-create-body"><div class="admin-job-section active"><input aria-invalid="false"><input aria-invalid="true"><select aria-invalid="true"><option>Choose</option></select></div></div></div>');
  for (const cssPath of adminImports) {
    await page.addStyleTag({ content: fs.readFileSync(cssPath, 'utf8') });
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const styles = await page.evaluate(() => {
      const ok = document.querySelector('input[aria-invalid="false"]')!;
      const bad = document.querySelector('input[aria-invalid="true"]')!;
      const select = document.querySelector('select[aria-invalid="true"]')!;
      return {
        normal: getComputedStyle(ok).borderTopColor,
        invalid: getComputedStyle(bad).borderTopColor,
        select: getComputedStyle(select).borderTopColor,
        height: bad.getBoundingClientRect().height,
        radius: getComputedStyle(bad).borderTopLeftRadius,
      };
    });
    expect(styles.normal, `width=${width}: ordinary border`).toBe('rgb(207, 215, 227)');
    expect(styles.invalid, `width=${width}: invalid input`).toBe('rgb(198, 40, 40)');
    expect(styles.select, `width=${width}: invalid select`).toBe('rgb(198, 40, 40)');
    expect(styles.height).toBe(32);
    expect(styles.radius).toBe('4px');
  }
});

test('Carrier invoice editor uses measured panels and stacks preview on tablets', async ({ page }) => {
  const adminDir = path.resolve(process.cwd(), 'app/admin');
  const layout = fs.readFileSync(path.join(adminDir, 'layout.tsx'), 'utf8');
  const imports = [...layout.matchAll(/^import ['"]([^'"]+\.css)['"];?/gm)]
    .map((match) => path.resolve(adminDir, match[1]));
  await page.setContent('<div class="xdrive-workspace-measured xdrive-carrier-workspace"><div class="carrier-invoice-editor-columns" style="display:grid;grid-template-columns:1fr 1fr;gap:2rem"><div class="carrier-invoice-create-panel" style="padding:1.5rem;border-radius:12px;box-shadow:0 2px 8px #888"><div class="carrier-invoice-action-toolbar" style="display:flex;gap:0.75rem"><button style="padding:0.75rem 1.5rem;background:#10b981">Save Invoice</button></div><input value="Form"></div><div class="carrier-invoice-create-panel">Invoice preview</div></div></div>');
  for (const cssPath of imports) {
    await page.addStyleTag({ content: fs.readFileSync(cssPath, 'utf8') });
  }
  for (const width of [1440, 900, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const styles = await page.evaluate(() => {
      const grid = document.querySelector('.carrier-invoice-editor-columns')!;
      const panel = document.querySelector('.carrier-invoice-create-panel')!;
      const input = panel.querySelector('input')!;
      const button = panel.querySelector('button')!;
      const toolbar = panel.querySelector('.carrier-invoice-action-toolbar')!;
      return {
        buttonHeight: button.getBoundingClientRect().height,
        buttonBackground: getComputedStyle(button).backgroundColor,
        toolbarGap: getComputedStyle(toolbar).columnGap,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        gap: getComputedStyle(grid).columnGap,
        padding: getComputedStyle(panel).paddingTop,
        radius: getComputedStyle(panel).borderTopLeftRadius,
        shadow: getComputedStyle(panel).boxShadow,
        controlHeight: input.getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    expect(styles.columns, `width=${width}: column count`).toBe(width > 1100 ? 2 : 1);
    expect(styles.gap).toBe('12px'); // Measured --ws-gap-grid, not --ws-gap-internal.
    expect(styles.padding).toBe('10px');
    expect(styles.radius).toBe('4px');
    expect(styles.shadow).toBe('none');
    expect(styles.controlHeight).toBe(24);
    expect(styles.overflow).toBe(false);
  }
});

test('Carrier Jobs uses the canonical measured shell on a signed-in real route', async ({ page }, testInfo) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Requires E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD for an authenticated live route.');
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.goto('/admin/jobs', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.xdrive-workspace-measured')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.top-workspace-shell__content')).toBeVisible();
  await expect(page.locator('[class*="jobsPageShell"]')).toBeVisible();
  const result = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.xdrive-workspace-measured')!;
    const content = document.querySelector<HTMLElement>('.top-workspace-shell__content')!;
    const register = document.querySelector<HTMLElement>('[class*="jobsPageShell"]')!;
    return {
      font: getComputedStyle(shell).fontSize,
      nav: document.querySelector<HTMLElement>('.top-workspace-nav--primary')?.getBoundingClientRect().height ?? 0,
      widthRatio: register.getBoundingClientRect().width / content.getBoundingClientRect().width,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  expect(result.font).toBe('12px');
  expect(result.nav).toBeGreaterThanOrEqual(41);
  expect(result.nav).toBeLessThanOrEqual(43);
  expect(result.widthRatio).toBeGreaterThan(0.88);
  expect(result.overflow).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('carrier-jobs-authenticated.png'), fullPage: true });
});

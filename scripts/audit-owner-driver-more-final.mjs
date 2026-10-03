import { chromium } from '@playwright/test';
import fs from 'node:fs';

const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
fs.mkdirSync('.owner-more-screens', { recursive: true });

for (const size of sizes) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3021/visual-fixture/workspace/owner-driver', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(600);

  const trigger = page.getByRole('button', { name: 'More', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForTimeout(100);

  const menu = page.getByRole('menu', { name: 'More' });
  const items = await menu.getByRole('menuitem').allTextContents();
  const sections = await menu.locator('.top-workspace-nav__menu-section').allTextContents();
  const box = await menu.boundingBox();
  const metrics = await menu.evaluate((el) => {
    const style = getComputedStyle(el);
    const itemEls = [...el.querySelectorAll('[role="menuitem"]')];
    return {
      position: style.position,
      width: style.width,
      maxHeight: style.maxHeight,
      overflowY: style.overflowY,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      itemHeights: itemEls.map((node) => Math.round(node.getBoundingClientRect().height)),
      wrappedItems: itemEls
        .filter((node) => {
          const spans = node.querySelectorAll('span');
          const label = spans[spans.length - 1];
          return label ? label.getBoundingClientRect().height > 18 : false;
        })
        .map((node) => node.textContent?.trim() ?? ''),
    };
  });
  const fits = !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1;
  await page.screenshot({ path: `.owner-more-screens/${size.name}.png`, fullPage: false });

  results.push({
    viewport: size,
    items: items.map((x) => x.trim()),
    sections: sections.map((x) => x.trim()),
    box,
    metrics,
    fits,
    expanded: await trigger.getAttribute('aria-expanded'),
  });

  await page.close();
  await context.close();
}

const keyboardContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const keyboardPage = await keyboardContext.newPage();
await keyboardPage.goto('http://127.0.0.1:3021/visual-fixture/workspace/owner-driver', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await keyboardPage.waitForTimeout(600);
const keyboardTrigger = keyboardPage.getByRole('button', { name: 'More', exact: true });
await keyboardTrigger.scrollIntoViewIfNeeded();
await keyboardTrigger.focus();
await keyboardPage.keyboard.press('ArrowDown');
await keyboardPage.waitForTimeout(100);
const firstFocus = await keyboardPage.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.textContent?.trim() : null));
await keyboardPage.keyboard.press('ArrowDown');
const secondFocus = await keyboardPage.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.textContent?.trim() : null));
await keyboardPage.keyboard.press('End');
const endFocus = await keyboardPage.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.textContent?.trim() : null));
await keyboardPage.keyboard.press('Escape');
await keyboardPage.waitForTimeout(50);
const escapeFocus = await keyboardPage.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.textContent?.trim() : null));
const openAfterEscape = await keyboardPage.getByRole('menu', { name: 'More' }).count();

await keyboardTrigger.click();
await keyboardPage.waitForTimeout(50);
await keyboardPage.locator('.top-workspace-shell__brand').click({ force: true });
await keyboardPage.waitForTimeout(50);
const openAfterOutside = await keyboardPage.getByRole('menu', { name: 'More' }).count();

results.push({
  keyboard: {
    firstFocus,
    secondFocus,
    endFocus,
    escapeFocus,
    openAfterEscape,
    openAfterOutside,
  },
});

await keyboardContext.close();
await browser.close();
fs.writeFileSync('.owner-more-audit.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

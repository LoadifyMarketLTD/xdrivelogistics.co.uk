import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// This probe uses the live Driver layout's CSS import order. It is a visual
// cascade contract, not authenticated finance-data or production runtime proof.
const driverDir = path.resolve(process.cwd(), 'app/driver');
const layout = fs.readFileSync(path.join(driverDir, 'layout.tsx'), 'utf8');
const importedCss = [...layout.matchAll(/^import ['"]([^'"]+\.css)['"];/gm)]
  .map((match) => path.resolve(driverDir, match[1]));

test('Driver Finance invoice state tabs stay compact at desktop and mobile widths', async ({ page }) => {
  const buttons = Array.from({ length: 7 }, (_, index) =>
    `<button type="button" data-active="${index === 2}">State ${index}<span>2</span></button>`,
  ).join('');
  await page.setContent(
    '<!doctype html><html><head></head><body>' +
      '<div class="xdrive-workspace-measured xdrive-operational-top-workspace xdrive-driver-workspace xdrive-canonical-workspace">' +
        '<div class="driver-prototype-port"><div class="driver-finance-register">' +
          '<div class="finance-tabs" role="tablist" aria-label="Invoice state tabs">' +
            buttons +
          '</div>' +
        '</div></div>' +
      '</div>' +
    '</body></html>',
  );
  for (const cssPath of importedCss) {
    await page.addStyleTag({ content: fs.readFileSync(cssPath, 'utf8') });
  }

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const measurements = await page.evaluate(() => {
      const strip = document.querySelector<HTMLElement>('.finance-tabs')!;
      const buttons = Array.from(strip.querySelectorAll<HTMLButtonElement>('button'));
      const active = strip.querySelector<HTMLButtonElement>('[data-active="true"]')!;
      const stripStyle = getComputedStyle(strip);
      const buttonStyle = getComputedStyle(buttons[0]);
      const activeStyle = getComputedStyle(active);
      return {
        display: stripStyle.display,
        columnCount: stripStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
        overflowX: stripStyle.overflowX,
        buttonWidth: Math.round(buttons[0].getBoundingClientRect().width),
        buttonHeight: Math.round(buttons[0].getBoundingClientRect().height),
        fontSize: buttonStyle.fontSize,
        fontWeight: buttonStyle.fontWeight,
        underlineWidth: activeStyle.borderBottomWidth,
        underlineColor: activeStyle.borderBottomColor,
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    expect(measurements.buttonHeight, `width=${width}: tab height`).toBe(28);
    expect(measurements.fontSize, `width=${width}: text scale`).toBe('11px');
    expect(measurements.fontWeight, `width=${width}: text weight`).toBe('600');
    expect(measurements.underlineWidth, `width=${width}: active underline`).toBe('2px');
    expect(measurements.underlineColor, `width=${width}: active underline colour`).toBe('rgb(29, 87, 216)');
    expect(measurements.pageOverflow, `width=${width}: no page-level overflow`).toBe(false);
    if (width > 900) {
      expect(measurements.display).toBe('grid');
      expect(measurements.columnCount).toBe(7);
    } else {
      expect(measurements.display).toBe('flex');
      expect(measurements.overflowX).toBe('auto');
      expect(measurements.buttonWidth, `width=${width}: tabs do not expand to viewport width`).toBeLessThanOrEqual(160);
      expect(measurements.buttonWidth).toBeGreaterThanOrEqual(112);
    }
  }
});

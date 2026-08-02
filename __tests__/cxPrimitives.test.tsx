/**
 * CX Phase 1 primitives — rendered-output assertions.
 *
 * Verifies OperationalPageLayout, OperationalCard, OperationalFilters,
 * OperationalFilterField, OperationalFilterInput and OperationalFilterSelect
 * produce the correct structural HTML for the CX operational UI reconstruction.
 *
 * All tests render via renderToStaticMarkup (Node-safe, no jsdom required).
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  OperationalCard,
  OperationalFilterField,
  OperationalFilterInput,
  OperationalFilterSelect,
  OperationalFilters,
  OperationalPageLayout,
} from '../app/components/workspace/WorkspaceUI';

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

// ─── OperationalPageLayout ──────────────────────────────────────────────────

describe('OperationalPageLayout', () => {
  it('renders children in a single-panel layout when no searchPanel is provided', () => {
    const html = render(
      <OperationalPageLayout>
        <p>Main content</p>
      </OperationalPageLayout>,
    );

    expect(html).toContain('Main content');
    // Should use a <main> element (semantic)
    expect(html).toContain('<main');
    // No aside when search panel is absent
    expect(html).not.toContain('<aside');
    expect(html).not.toContain('1480px');
  });

  it('renders an aside + main two-panel layout when searchPanel is provided', () => {
    const html = render(
      <OperationalPageLayout
        searchPanel={<div>Filter panel</div>}
      >
        <p>Results</p>
      </OperationalPageLayout>,
    );

    expect(html).toContain('Filter panel');
    expect(html).toContain('Results');
    // Structural aside for search panel
    expect(html).toContain('<aside');
    // Accessible label on aside
    expect(html).toContain('Search and filters');
    expect(html).toContain('<main');
  });

  it('applies a custom maxWidth via CSS custom property', () => {
    const html = render(
      <OperationalPageLayout maxWidth={1200}>
        <span>content</span>
      </OperationalPageLayout>,
    );

    expect(html).toContain('1200px');
  });

  it('uses full-width shell padding by default instead of a centred max-width container', () => {
    const html = render(
      <OperationalPageLayout>
        <span>content</span>
      </OperationalPageLayout>,
    );

    expect(html).not.toContain('margin:0 auto');
    expect(html).not.toContain('max-width:1480px');
  });
});

// ─── OperationalCard ────────────────────────────────────────────────────────

describe('OperationalCard', () => {
  it('renders children without a header when no title/subtitle/actions given', () => {
    const html = render(
      <OperationalCard>
        <p>Card body</p>
      </OperationalCard>,
    );

    expect(html).toContain('Card body');
    // No h3 when title is absent
    expect(html).not.toContain('<h3');
  });

  it('renders title and subtitle in the card header', () => {
    const html = render(
      <OperationalCard title="Active Jobs" subtitle="Last 24 hours">
        <span>body</span>
      </OperationalCard>,
    );

    expect(html).toContain('Active Jobs');
    expect(html).toContain('Last 24 hours');
    expect(html).toContain('<h3');
  });

  it('renders action slot in the header', () => {
    const html = render(
      <OperationalCard title="Fleet" actions={<button type="button">Add Vehicle</button>}>
        <span>body</span>
      </OperationalCard>,
    );

    expect(html).toContain('Add Vehicle');
  });

  it('renders optional footer', () => {
    const html = render(
      <OperationalCard title="Invoices" footer={<span>Total: £1,200</span>}>
        <span>rows</span>
      </OperationalCard>,
    );

    expect(html).toContain('Total: £1,200');
  });

  it('uses section element by default and accepts custom as prop', () => {
    const sectionHtml = render(<OperationalCard><span>x</span></OperationalCard>);
    const articleHtml = render(<OperationalCard as="article"><span>x</span></OperationalCard>);

    expect(sectionHtml).toContain('<section');
    expect(articleHtml).toContain('<article');
  });
});

// ─── OperationalFilters ─────────────────────────────────────────────────────

describe('OperationalFilters', () => {
  it('renders with the default "Search Panel" title', () => {
    const html = render(<OperationalFilters />);

    expect(html).toContain('Search Panel');
    expect(html).toContain('<h2');
  });

  it('renders a custom title', () => {
    const html = render(<OperationalFilters title="Search Loads" />);

    expect(html).toContain('Search Loads');
    // Accessible aria-label on the aside
    expect(html).toContain('Search Loads');
  });

  it('renders Search and Clear buttons when callbacks are provided', () => {
    const html = render(
      <OperationalFilters
        onSearch={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(html).toContain('>Search<');
    expect(html).toContain('>Clear<');
  });

  it('does not render Search/Clear buttons when callbacks are absent', () => {
    const html = render(<OperationalFilters />);

    expect(html).not.toContain('>Search<');
    expect(html).not.toContain('>Clear<');
  });

  it('renders Save as Default checkbox when callback is provided', () => {
    const html = render(
      <OperationalFilters
        saveAsDefault={false}
        onSaveAsDefaultChange={() => undefined}
      />,
    );

    expect(html).toContain('Save as Default');
    expect(html).toContain('type="checkbox"');
  });

  it('renders children inside the filter body', () => {
    const html = render(
      <OperationalFilters>
        <OperationalFilterField label="Load ID / Ref">
          <OperationalFilterInput
            value="LOAD-123"
            onChange={() => undefined}
          />
        </OperationalFilterField>
      </OperationalFilters>,
    );

    expect(html).toContain('Load ID / Ref');
    expect(html).toContain('LOAD-123');
  });

  it('renders wrapped in an aside with an aria-label', () => {
    const html = render(<OperationalFilters title="Search Jobs" />);

    expect(html).toContain('<aside');
    expect(html).toContain('aria-label="Search Jobs"');
  });
});

// ─── OperationalFilterField ─────────────────────────────────────────────────

describe('OperationalFilterField', () => {
  it('renders a label associated with a control', () => {
    const html = render(
      <OperationalFilterField label="Date" htmlFor="date-input">
        <input id="date-input" type="date" />
      </OperationalFilterField>,
    );

    expect(html).toContain('Date');
    expect(html).toContain('for="date-input"');
  });

  it('renders without a label when omitted', () => {
    const html = render(
      <OperationalFilterField>
        <input type="text" />
      </OperationalFilterField>,
    );

    expect(html).not.toContain('<label');
  });
});

// ─── OperationalFilterInput ─────────────────────────────────────────────────

describe('OperationalFilterInput', () => {
  it('renders an input with the given value', () => {
    const html = render(
      <OperationalFilterInput
        id="ref"
        value="LOAD-456"
        onChange={() => undefined}
        placeholder="Load ref"
      />,
    );

    expect(html).toContain('value="LOAD-456"');
    expect(html).toContain('placeholder="Load ref"');
    expect(html).toContain('id="ref"');
  });

  it('renders the clear button when onClear is provided and value is non-empty', () => {
    const html = render(
      <OperationalFilterInput
        value="abc"
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(html).toContain('Clear field');
  });

  it('does not render the clear button when value is empty', () => {
    const html = render(
      <OperationalFilterInput
        value=""
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(html).not.toContain('Clear field');
  });
});

// ─── OperationalFilterSelect ─────────────────────────────────────────────────

describe('OperationalFilterSelect', () => {
  it('renders select options correctly', () => {
    const html = render(
      <OperationalFilterSelect
        id="status"
        value="all"
        onChange={() => undefined}
        options={[
          { value: 'all', label: 'All statuses' },
          { value: 'active', label: 'Active' },
          { value: 'completed', label: 'Completed' },
        ]}
      />,
    );

    expect(html).toContain('id="status"');
    expect(html).toContain('All statuses');
    expect(html).toContain('Active');
    expect(html).toContain('Completed');
    expect(html).toContain('value="all"');
  });
});

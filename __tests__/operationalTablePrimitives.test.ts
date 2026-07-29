import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { OperationalTableAlign, OperationalTableColumn } from '../app/components/workspace/WorkspaceUI';
import { OperationalTable } from '../app/components/workspace/WorkspaceUI';

/**
 * OperationalTable primitives — rendered-output assertions.
 *
 * Uses `renderToStaticMarkup` (react-dom/server, Node-safe) to verify the
 * actual component HTML.  No jsdom is required.  Type-contract assertions are
 * included only where compile-time behaviour genuinely requires them.
 */

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

type JobRow = { id: string; reference: string; origin: string; destination: string };

const JOB_COLUMNS: OperationalTableColumn<JobRow>[] = [
  { id: 'reference', header: 'Reference', cell: (r) => r.reference },
  { id: 'origin',    header: 'Origin',    cell: (r) => r.origin,    align: 'left' },
  { id: 'dest',      header: 'Destination', cell: (r) => r.destination, align: 'left' },
  { id: 'action',   header: 'Action',    cell: (_r) => 'View',     align: 'right', width: '80px' },
];

const JOB_ROWS: JobRow[] = [
  { id: 'job-1', reference: 'JB-1001', origin: 'London',     destination: 'Manchester' },
  { id: 'job-2', reference: 'JB-1002', origin: 'Birmingham', destination: 'Leeds' },
];

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

// ---------------------------------------------------------------------------
// Column header order
// ---------------------------------------------------------------------------

describe('OperationalTable — column header order', () => {
  it('renders all four column headers as <th scope="col"> in declared order', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    const refIdx  = html.indexOf('>Reference<');
    const origIdx = html.indexOf('>Origin<');
    const destIdx = html.indexOf('>Destination<');
    const actIdx  = html.indexOf('>Action<');

    expect(refIdx).toBeGreaterThan(-1);
    expect(origIdx).toBeGreaterThan(refIdx);
    expect(destIdx).toBeGreaterThan(origIdx);
    expect(actIdx).toBeGreaterThan(destIdx);
  });

  it('renders each header inside a <th scope="col"> element', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    // Four scope="col" attributes expected — one per column
    const scopeMatches = html.match(/scope="col"/g);
    expect(scopeMatches).toHaveLength(JOB_COLUMNS.length);
  });
});

// ---------------------------------------------------------------------------
// Row cell content
// ---------------------------------------------------------------------------

describe('OperationalTable — row cell content', () => {
  it('renders all cell values for both rows', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    expect(html).toContain('JB-1001');
    expect(html).toContain('London');
    expect(html).toContain('Manchester');
    expect(html).toContain('JB-1002');
    expect(html).toContain('Birmingham');
    expect(html).toContain('Leeds');
    // static 'View' cell from the action column
    const viewCount = (html.match(/>View</g) ?? []).length;
    expect(viewCount).toBe(JOB_ROWS.length);
  });

  it('renders the first row before the second row', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    expect(html.indexOf('JB-1001')).toBeLessThan(html.indexOf('JB-1002'));
    expect(html.indexOf('London')).toBeLessThan(html.indexOf('Birmingham'));
  });
});

// ---------------------------------------------------------------------------
// Optional <caption>
// ---------------------------------------------------------------------------

describe('OperationalTable — caption metadata', () => {
  it('renders <caption> when caption prop is supplied', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
        caption: 'Active jobs for the selected company',
      }),
    );

    expect(html).toContain('<caption');
    expect(html).toContain('Active jobs for the selected company');
  });

  it('does not render a <caption> element when caption prop is omitted', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    expect(html).not.toContain('<caption');
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('OperationalTable — empty state', () => {
  it('renders the default "No records found" message when rows is empty', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: [],
        getRowKey: (r) => r.id,
      }),
    );

    expect(html).toContain('No records found');
    // Rows and headers must not appear
    expect(html).not.toContain('<table');
    expect(html).not.toContain('<th');
  });

  it('renders the custom empty prop when supplied with empty rows', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: [],
        getRowKey: (r) => r.id,
        empty: React.createElement('p', null, 'No jobs available right now'),
      }),
    );

    expect(html).toContain('No jobs available right now');
    expect(html).not.toContain('No records found');
    expect(html).not.toContain('<table');
  });

  it('renders the table (not empty state) when rows is non-empty', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    expect(html).toContain('<table');
    expect(html).not.toContain('No records found');
  });
});

// ---------------------------------------------------------------------------
// Alignment and width — rendered header/cell styles
// ---------------------------------------------------------------------------

describe('OperationalTable — alignment and width presentation', () => {
  it('renders text-align:right on the action column header and cells', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    // 'right' alignment must appear at least once for header and once per row
    const rightCount = (html.match(/text-align:right/g) ?? []).length;
    // 1 <th> + JOB_ROWS.length <td>s for the 'action' column
    expect(rightCount).toBe(1 + JOB_ROWS.length);
  });

  it('renders text-align:left for columns with explicit left or defaulted alignment', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    // Columns 0,1,2 all use left alignment (explicit or defaulted) × (1 th + 2 td each)
    const leftCount = (html.match(/text-align:left/g) ?? []).length;
    expect(leftCount).toBe(3 * (1 + JOB_ROWS.length));
  });

  it('renders the width style on the action column header', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    expect(html).toContain('width:80px');
  });

  it('renders text-align:center for a center-aligned column', () => {
    const centreColumns: OperationalTableColumn<JobRow>[] = [
      { id: 'ref', header: 'Reference', cell: (r) => r.reference, align: 'center' },
    ];
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: centreColumns,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    // 1 th + 2 td
    const centreCount = (html.match(/text-align:center/g) ?? []).length;
    expect(centreCount).toBe(1 + JOB_ROWS.length);
  });
});

// ---------------------------------------------------------------------------
// Responsive overflow wrapper
// ---------------------------------------------------------------------------

describe('OperationalTable — responsive overflow wrapper', () => {
  it('wraps the table in a div with overflow-x:auto', () => {
    const html = render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey: (r) => r.id,
      }),
    );

    expect(html).toContain('overflow-x:auto');
    // The overflow wrapper must appear before the table
    expect(html.indexOf('overflow-x:auto')).toBeLessThan(html.indexOf('<table'));
  });
});

// ---------------------------------------------------------------------------
// getRowKey — one call per row, no index fallback
// ---------------------------------------------------------------------------

describe('OperationalTable — getRowKey contract', () => {
  it('calls getRowKey exactly once per rendered row', () => {
    const getRowKey = vi.fn((r: JobRow) => r.id);
    render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey,
      }),
    );

    expect(getRowKey).toHaveBeenCalledTimes(JOB_ROWS.length);
  });

  it('calls getRowKey with the row object, not a numeric index', () => {
    const getRowKey = vi.fn((r: JobRow) => r.id);
    render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey,
      }),
    );

    const calls = getRowKey.mock.calls;
    calls.forEach(([arg]) => {
      expect(typeof arg).toBe('object');
      expect(typeof (arg as JobRow).id).toBe('string');
      // The argument must never be a bare numeric index
      expect(typeof arg).not.toBe('number');
    });
  });

  it('getRowKey return values are stable strings, not bare indices', () => {
    const keys: string[] = [];
    const getRowKey = vi.fn((r: JobRow) => { const k = r.id; keys.push(k); return k; });
    render(
      React.createElement(OperationalTable<JobRow>, {
        columns: JOB_COLUMNS,
        rows: JOB_ROWS,
        getRowKey,
      }),
    );

    expect(keys).toEqual(['job-1', 'job-2']);
    keys.forEach((k) => expect(k).not.toMatch(/^\d+$/));
  });
});

// ---------------------------------------------------------------------------
// Compile-time: OperationalTableAlign covers exactly three values
// ---------------------------------------------------------------------------

describe('OperationalTableAlign compile-time contract', () => {
  it('accepts all three alignment values without type error', () => {
    const values: OperationalTableAlign[] = ['left', 'center', 'right'];
    expect(new Set(values).size).toBe(3);
  });
});

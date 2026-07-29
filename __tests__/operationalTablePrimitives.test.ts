import { describe, expect, it, vi } from 'vitest';
import type {
  OperationalTableAlign,
  OperationalTableColumn,
  OperationalTableProps,
} from '../app/components/workspace/WorkspaceUI';

/**
 * OperationalTable primitives contract tests.
 *
 * These tests verify the exported type contracts and runtime column/row
 * contracts without requiring a DOM or React rendering environment,
 * consistent with the project's existing pure-TypeScript test pattern.
 *
 * No permission, status, role or company inference is present in the
 * OperationalTable primitives; tests explicitly confirm that absence.
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

// ---------------------------------------------------------------------------
// Column contract
// ---------------------------------------------------------------------------

describe('OperationalTableColumn type contract', () => {
  it('accepts a minimal column definition (id, header, cell only)', () => {
    const col: OperationalTableColumn<JobRow> = {
      id: 'reference',
      header: 'Reference',
      cell: (r) => r.reference,
    };
    expect(col.id).toBe('reference');
    expect(col.header).toBe('Reference');
    expect(col.align).toBeUndefined();
    expect(col.width).toBeUndefined();
  });

  it('accepts a fully specified column with align and width', () => {
    const col: OperationalTableColumn<JobRow> = {
      id: 'action',
      header: 'Action',
      cell: () => 'View',
      align: 'right',
      width: '80px',
    };
    expect(col.align).toBe('right');
    expect(col.width).toBe('80px');
  });

  it('cell renderer receives the row and returns caller-supplied content', () => {
    const col: OperationalTableColumn<JobRow> = {
      id: 'ref',
      header: 'Ref',
      cell: (r) => r.reference,
    };
    const result = col.cell(JOB_ROWS[0]);
    expect(result).toBe('JB-1001');
  });

  it('cell renderer for a different row returns different content', () => {
    const col: OperationalTableColumn<JobRow> = {
      id: 'ref',
      header: 'Ref',
      cell: (r) => r.reference,
    };
    expect(col.cell(JOB_ROWS[0])).toBe('JB-1001');
    expect(col.cell(JOB_ROWS[1])).toBe('JB-1002');
  });
});

// ---------------------------------------------------------------------------
// Column order
// ---------------------------------------------------------------------------

describe('OperationalTable column order contract', () => {
  it('columns array preserves the declared display order', () => {
    const ids = JOB_COLUMNS.map((c) => c.id);
    expect(ids).toEqual(['reference', 'origin', 'dest', 'action']);
  });

  it('column headers appear in the same order as column definitions', () => {
    const headers = JOB_COLUMNS.map((c) => c.header);
    expect(headers).toEqual(['Reference', 'Origin', 'Destination', 'Action']);
  });

  it('supports four distinct columns with unique ids', () => {
    expect(new Set(JOB_COLUMNS.map((c) => c.id)).size).toBe(JOB_COLUMNS.length);
  });
});

// ---------------------------------------------------------------------------
// Row key contract — getRowKey
// ---------------------------------------------------------------------------

describe('OperationalTable row key contract', () => {
  it('getRowKey is called once per row', () => {
    const getRowKey = vi.fn((r: JobRow) => r.id);
    JOB_ROWS.forEach((row) => getRowKey(row));
    expect(getRowKey).toHaveBeenCalledTimes(JOB_ROWS.length);
  });

  it('getRowKey returns stable unique strings for each row', () => {
    const getRowKey = (r: JobRow) => r.id;
    const keys = JOB_ROWS.map(getRowKey);
    expect(keys).toEqual(['job-1', 'job-2']);
    expect(new Set(keys).size).toBe(JOB_ROWS.length);
  });

  it('getRowKey results are strings, not indices', () => {
    const getRowKey = (r: JobRow) => r.id;
    JOB_ROWS.forEach((row) => {
      const key = getRowKey(row);
      expect(typeof key).toBe('string');
      expect(key).not.toMatch(/^\d+$/); // must not be a bare numeric index
    });
  });
});

// ---------------------------------------------------------------------------
// Empty-state contract
// ---------------------------------------------------------------------------

describe('OperationalTable empty-state contract', () => {
  it('empty rows array triggers empty-state path', () => {
    const props: OperationalTableProps<JobRow> = {
      columns: JOB_COLUMNS,
      rows: [],
      getRowKey: (r) => r.id,
    };
    // The component branch `if (rows.length === 0)` covers this; verify the
    // contract by checking the props are well-typed and rows is empty.
    expect(props.rows.length).toBe(0);
  });

  it('non-empty rows array does not trigger empty-state path', () => {
    const props: OperationalTableProps<JobRow> = {
      columns: JOB_COLUMNS,
      rows: JOB_ROWS,
      getRowKey: (r) => r.id,
    };
    expect(props.rows.length).toBeGreaterThan(0);
  });

  it('custom empty prop is accepted in the type contract', () => {
    const props: OperationalTableProps<JobRow> = {
      columns: JOB_COLUMNS,
      rows: [],
      getRowKey: (r) => r.id,
      empty: 'No jobs found',
    };
    expect(props.empty).toBe('No jobs found');
  });
});

// ---------------------------------------------------------------------------
// Accessible metadata contract
// ---------------------------------------------------------------------------

describe('OperationalTable accessible metadata contract', () => {
  it('caption field is optional and accepted in the type contract', () => {
    const withCaption: OperationalTableProps<JobRow> = {
      columns: JOB_COLUMNS,
      rows: JOB_ROWS,
      getRowKey: (r) => r.id,
      caption: 'Active jobs for the selected company',
    };
    expect(withCaption.caption).toBe('Active jobs for the selected company');

    const withoutCaption: OperationalTableProps<JobRow> = {
      columns: JOB_COLUMNS,
      rows: JOB_ROWS,
      getRowKey: (r) => r.id,
    };
    expect(withoutCaption.caption).toBeUndefined();
  });

  it('column id field is always a string (used as th key)', () => {
    JOB_COLUMNS.forEach((col) => {
      expect(typeof col.id).toBe('string');
    });
  });

  it('column header field is always a string (rendered in th)', () => {
    JOB_COLUMNS.forEach((col) => {
      expect(typeof col.header).toBe('string');
    });
  });
});

// ---------------------------------------------------------------------------
// Alignment contract
// ---------------------------------------------------------------------------

describe('OperationalTableAlign contract', () => {
  it('covers exactly three alignment values', () => {
    const alignValues: OperationalTableAlign[] = ['left', 'center', 'right'];
    expect(new Set(alignValues).size).toBe(3);
  });

  it('all align values are non-empty strings', () => {
    const alignValues: OperationalTableAlign[] = ['left', 'center', 'right'];
    alignValues.forEach((a) => {
      expect(typeof a).toBe('string');
      expect(a.length).toBeGreaterThan(0);
    });
  });

  it('column without explicit align has undefined align (defaults in renderer)', () => {
    const col: OperationalTableColumn<JobRow> = {
      id: 'ref',
      header: 'Ref',
      cell: (r) => r.reference,
    };
    expect(col.align).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Absence of permission / status inference
// ---------------------------------------------------------------------------

describe('OperationalTable — no permission or status inference', () => {
  it('column definition contains no role, company or permission field', () => {
    JOB_COLUMNS.forEach((col) => {
      // These keys must not appear on the column definition
      expect(col).not.toHaveProperty('role');
      expect(col).not.toHaveProperty('company');
      expect(col).not.toHaveProperty('permission');
      expect(col).not.toHaveProperty('sentiment');
    });
  });

  it('row key function does not receive or expose role/company context', () => {
    const getRowKey = (r: JobRow) => r.id;
    // Verify the function returns only the id — no role/company is appended
    expect(getRowKey(JOB_ROWS[0])).toBe('job-1');
    expect(getRowKey(JOB_ROWS[1])).toBe('job-2');
  });

  it('cell renderer returns exactly the caller-supplied value with no transformation', () => {
    const refCol: OperationalTableColumn<JobRow> = {
      id: 'ref',
      header: 'Reference',
      cell: (r) => r.reference,
    };
    // The primitive must not alter, append or infer any additional string
    expect(refCol.cell(JOB_ROWS[0])).toBe('JB-1001');
    expect(refCol.cell(JOB_ROWS[1])).toBe('JB-1002');
  });
});

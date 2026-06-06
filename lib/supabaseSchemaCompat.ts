import type { SupabaseClient } from '@supabase/supabase-js';

type ErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const normalize = (value: string | null | undefined) => (value ?? '').toLowerCase();

export const isMissingColumnError = (
  error: ErrorLike | null | undefined,
  table: string,
  column: string
) => {
  if (!error) return false;
  const code = normalize(error.code);
  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);
  const tableName = table.toLowerCase();
  const columnName = column.toLowerCase();
  const mentionsRequestedColumn = [
    `could not find the '${columnName}' column`,
    `column "${columnName}" does not exist`,
    `${tableName}.${columnName}`,
    `${tableName}"."${columnName}`,
    `"${columnName}"`,
    `'${columnName}'`,
  ].some((signature) =>
    message.includes(signature) || details.includes(signature) || hint.includes(signature)
  );

  // 42703 = PostgreSQL undefined_column; PGRST204 = PostgREST schema-cache miss
  if (code === '42703' || code === 'pgrst204') return mentionsRequestedColumn;

  const signatures = [
    `could not find the '${columnName}' column`,
    `column "${columnName}" does not exist`,
    `${tableName}.${columnName}`,
    `${tableName}"."${columnName}`,
  ];

  return signatures.some((signature) =>
    message.includes(signature) || details.includes(signature) || hint.includes(signature)
  );
};

export const getMissingColumnFromError = (
  error: ErrorLike | null | undefined,
  table: string
): string | null => {
  if (!error) return null;
  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);
  const tableName = table.toLowerCase();
  const haystacks = [message, details, hint].filter(Boolean);

  const singleQuoted = new RegExp(`could not find the '([^']+)' column of '${tableName}'`, 'i');
  for (const text of haystacks) {
    const m = text.match(singleQuoted);
    if (m?.[1]) return m[1].toLowerCase();
  }

  const dotted = new RegExp(`${tableName}\\.([a-z0-9_]+)`, 'i');
  for (const text of haystacks) {
    const m = text.match(dotted);
    if (m?.[1]) return m[1].toLowerCase();
  }

  const generic = /column "([^"]+)" does not exist/i;
  for (const text of haystacks) {
    const m = text.match(generic);
    if (m?.[1]) return m[1].split('.').pop()?.toLowerCase() ?? null;
  }

  return null;
};

export const isMissingRelationshipError = (
  error: ErrorLike | null | undefined,
  sourceTable: string,
  relationshipName: string
) => {
  if (!error) return false;
  const message = normalize(error.message);
  const details = normalize(error.details);
  const hint = normalize(error.hint);
  const source = sourceTable.toLowerCase();
  const relation = relationshipName.toLowerCase();
  const signatures = [
    `could not find a relationship between '${source}' and '${relation}'`,
    `could not find a relationship between "${source}" and "${relation}"`,
    `relationship between '${source}' and '${relation}'`,
    `relationship between "${source}" and "${relation}"`,
  ];

  return signatures.some((signature) =>
    message.includes(signature) || details.includes(signature) || hint.includes(signature)
  );
};

type ColumnRetryContext = {
  activeColumns: string[];
  missingColumns: Set<string>;
  attempts: number;
  maxAttempts: number;
};

type ColumnRetryOptions<Row> = {
  table: string;
  columns: string[];
  maxAttempts?: number;
  execute: (activeColumns: string[]) => Promise<{ data: Row[] | null; error: ErrorLike | null }>;
  onError?: (error: ErrorLike, context: ColumnRetryContext) => boolean;
};

export const selectWithMissingColumnFallback = async <Row>({
  table,
  columns,
  maxAttempts = Math.max(12, columns.length * 3),
  execute,
  onError,
}: ColumnRetryOptions<Row>): Promise<{
  rows: Row[];
  missingColumns: Set<string>;
  error: ErrorLike | null;
}> => {
  const activeColumns = [...columns];
  const missingColumns = new Set<string>();
  let attempts = 0;

  while (activeColumns.length > 0 && attempts < maxAttempts) {
    attempts += 1;
    const result = await execute(activeColumns);
    if (!result.error) {
      return {
        rows: result.data ?? [],
        missingColumns,
        error: null,
      };
    }

    if (onError?.(result.error, { activeColumns, missingColumns, attempts, maxAttempts })) {
      continue;
    }

    const missingColumn = getMissingColumnFromError(result.error, table);
    if (missingColumn && activeColumns.includes(missingColumn)) {
      missingColumns.add(missingColumn);
      activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
      continue;
    }

    return {
      rows: [],
      missingColumns,
      error: result.error,
    };
  }

  return {
    rows: [],
    missingColumns,
    error: { message: `${table} schema compatibility retry limit reached.` },
  };
};

export const resolveInvoiceClientName = (row: Record<string, unknown>): string | null => {
  if (typeof row.client_name === 'string' && row.client_name.trim().length > 0) return row.client_name;
  const related = row.clients;
  if (related && typeof related === 'object' && !Array.isArray(related)) {
    const relationName = (related as { name?: unknown }).name;
    if (typeof relationName === 'string' && relationName.trim().length > 0) return relationName;
  }
  if (Array.isArray(related)) {
    const first = related[0];
    const relationName = first && typeof first === 'object' ? (first as { name?: unknown }).name : null;
    if (typeof relationName === 'string' && relationName.trim().length > 0) return relationName;
  }
  return null;
};

export const loadInvoicesWithSchemaCompat = async (
  supabase: SupabaseClient,
  companyId: string,
  columns: string[]
): Promise<{
  rows: Array<Record<string, unknown>>;
  missingColumns: Set<string>;
  error: ErrorLike | null;
}> => {
  const activeColumns = [...columns];
  const missingColumns = new Set<string>();
  let useClientsRelation = false;
  let clientsRelationDisabled = false;
  const seenStates = new Set<string>();
  const maxAttempts = Math.max(12, activeColumns.length * 3);
  let attempts = 0;

  while (activeColumns.length > 0 && attempts < maxAttempts) {
    attempts += 1;
    const stateKey = `${useClientsRelation ? 'clients' : 'direct'}::${activeColumns.join(',')}`;
    if (seenStates.has(stateKey)) {
      return {
        rows: [],
        missingColumns,
        error: { message: 'Invoice compatibility fallback loop detected and stopped.' },
      };
    }
    seenStates.add(stateKey);

    const selectColumns = useClientsRelation
      ? [...activeColumns.filter((column) => column !== 'client_name'), 'clients(name)']
      : activeColumns;

    const result = await supabase
      .from('invoices')
      .select(selectColumns.join(', '))
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (!result.error) {
      return {
        rows: ((result.data ?? []) as unknown) as Array<Record<string, unknown>>,
        missingColumns,
        error: null,
      };
    }

    if (!useClientsRelation && isMissingColumnError(result.error, 'invoices', 'client_name')) {
      missingColumns.add('client_name');
      if (activeColumns.includes('client_name')) {
        activeColumns.splice(activeColumns.indexOf('client_name'), 1);
      }
      useClientsRelation = !clientsRelationDisabled;
      continue;
    }

    if (useClientsRelation && isMissingRelationshipError(result.error, 'invoices', 'clients')) {
      clientsRelationDisabled = true;
      useClientsRelation = false;
      continue;
    }

    const missingColumn = getMissingColumnFromError(result.error, 'invoices');
    if (missingColumn && activeColumns.includes(missingColumn)) {
      missingColumns.add(missingColumn);
      activeColumns.splice(activeColumns.indexOf(missingColumn), 1);
      continue;
    }

    return {
      rows: [],
      missingColumns,
      error: result.error,
    };
  }

  return {
    rows: [],
    missingColumns,
    error: { message: 'Invoice compatibility retry limit reached.' },
  };
};

const INVOICE_AMOUNT_COLUMN_FALLBACKS = ['subtotal', 'total_amount', 'total', 'invoice_total'] as const;

type InvoiceMutationCompatInput = {
  isNew: boolean;
  invoiceId: string;
  companyId: string;
  insertRow: Record<string, unknown>;
  updateFields: Record<string, unknown>;
};

export const saveInvoiceWithSchemaCompat = async (
  supabase: SupabaseClient,
  input: InvoiceMutationCompatInput
): Promise<{
  error: ErrorLike | null;
  activeAmountColumn: string;
  droppedColumns: Set<string>;
}> => {
  let amountColumn: string = 'amount';
  let amountFallbackIndex = -1;
  const droppedColumns = new Set<string>();
  const insertRow = { ...input.insertRow };
  const updateFields = { ...input.updateFields };
  const amountValue = insertRow.amount;

  const applyAmountColumn = (column: string) => {
    delete insertRow.amount;
    delete updateFields.amount;
    INVOICE_AMOUNT_COLUMN_FALLBACKS.forEach((fallbackColumn) => {
      delete insertRow[fallbackColumn];
      delete updateFields[fallbackColumn];
    });
    amountColumn = column;
    insertRow[column] = amountValue;
    updateFields[column] = amountValue;
  };

  for (let attempts = 0; attempts < 16; attempts += 1) {
    const result = input.isNew
      ? await supabase.from('invoices').insert([insertRow])
      : await supabase
          .from('invoices')
          .update(updateFields)
          .eq('id', input.invoiceId)
          .eq('company_id', input.companyId);

    if (!result.error) {
      return {
        error: null,
        activeAmountColumn: amountColumn,
        droppedColumns,
      };
    }

    const missingColumn = getMissingColumnFromError(result.error, 'invoices');
    if (!missingColumn) {
      return {
        error: result.error,
        activeAmountColumn: amountColumn,
        droppedColumns,
      };
    }

    if (missingColumn === amountColumn && amountValue !== undefined && amountFallbackIndex < INVOICE_AMOUNT_COLUMN_FALLBACKS.length - 1) {
      amountFallbackIndex += 1;
      applyAmountColumn(INVOICE_AMOUNT_COLUMN_FALLBACKS[amountFallbackIndex]);
      continue;
    }

    let removed = false;
    if (Object.prototype.hasOwnProperty.call(insertRow, missingColumn)) {
      delete insertRow[missingColumn];
      removed = true;
    }
    if (Object.prototype.hasOwnProperty.call(updateFields, missingColumn)) {
      delete updateFields[missingColumn];
      removed = true;
    }
    if (removed) {
      droppedColumns.add(missingColumn);
      continue;
    }

    return {
      error: result.error,
      activeAmountColumn: amountColumn,
      droppedColumns,
    };
  }

  return {
    error: { message: 'Invoice mutation compatibility retry limit reached.' },
    activeAmountColumn: amountColumn,
    droppedColumns,
  };
};

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('app/driver/quotes/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = ast.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === 'serviceLabel');
if (!fn) throw new Error('Missing serviceLabel');
const label = new Function(ts.transpile(fn.getText(ast)) + ';return serviceLabel')() as (v: string | null, d: boolean) => string;
describe('Quote service classification', () => {
  it.each([
    ['same_day_non_timed',false,'Same Day - Non Timed'],
    ['next_day_non_timed',false,'Next Day - Non Timed'],
    ['same_day_timed',false,'Same Day - Timed'],
    ['next_day_timed',false,'Next Day - Timed'],
    ['same day non-timed',false,'Same Day - Non Timed'],
    ['next day untimed',false,'Next Day - Non Timed'],
    ['same_day_non_timed',true,'Deliver Direct'],
    [null,false,'Marketplace Load'],
  ] as const)('classifies %s (direct=%s)', (v,d,w) => expect(label(v,d)).toBe(w));
});
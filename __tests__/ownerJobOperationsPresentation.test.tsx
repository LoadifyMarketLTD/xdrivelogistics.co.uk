import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import OwnerJobOperations, { OWNER_JOB_TABS, ownerJobAddress, ownerJobArea } from '../app/driver/_components/OwnerJobOperations';

describe('Owner Driver Web job dossier presentation', () => {
  it('keeps all seven accessible sections in the tree so POD state survives navigation', () => {
    const panels = Object.fromEntries(OWNER_JOB_TABS.map(([key]) => [key, <div key={key}>Fixture {key}</div>])) as React.ComponentProps<typeof OwnerJobOperations>['panels'];
    const html = renderToStaticMarkup(<OwnerJobOperations active="pod" onChange={()=>{}} header={<h1>Test job</h1>} panels={panels} historyCount={21} podPending/>);
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(7);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/ hidden=""/g)).toHaveLength(6);
    expect(html).toContain('Fixture booking');
    expect(html).toContain('Fixture pod');
    expect(html).toContain('Fixture history');
    expect(html).toContain('aria-label="POD outstanding"');
  });

  it('deduplicates only the exact trailing postcode in displayed addresses', () => {
    expect(ownerJobAddress('Accrington Town Hall, Broadway, BB5 1EZ', 'BB5 1EZ')).toBe('Accrington Town Hall, Broadway, BB5 1EZ');
    expect(ownerJobAddress('Accrington Town Hall, BB5 1EZ, bb51ez', 'BB5 1EZ')).toBe('Accrington Town Hall, BB5 1EZ');
    expect(ownerJobAddress('Manchester Town Hall', 'M2 5DB')).toBe('Manchester Town Hall, M2 5DB');
    expect(ownerJobAddress(' ', 'M2 5DB')).toBe('M2 5DB');
    expect(ownerJobAddress(undefined, undefined)).toBe('Not supplied');
    expect(ownerJobAddress('Unit 7, High Street', null)).toBe('Unit 7, High Street');
    expect(ownerJobAddress('14 Sandcliff Road, Erith, DA8 1NY, GB, DA8 1NY','DA8 1NY')).toBe('14 Sandcliff Road, Erith, DA8 1NY, GB');
    expect(ownerJobArea('14 Sandcliff Road, Erith, DA8 1NY, GB','DA8 1NY')).toBe('ERITH DA8');
    expect(ownerJobArea('BLACKBURN, BB1 9QD','BB1 9QD')).toBe('BLACKBURN BB1');
  });
});

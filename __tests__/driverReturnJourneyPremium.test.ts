import { describe, expect, it } from 'vitest';
import { decodeReturnJourneyNotes, encodeReturnJourneyNotes } from '../driver-pwa-reserve/src/ReturnJourneyPwa';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Driver PWA Return Journeys premium regression', () => {
  const legacy = JSON.stringify({
    source: 'xdrive_return_exchange_v2',
    notes: '',
    journeyKind: 'regular',
    viaLocations: ['M6'],
    bodyType: 'box',
    weightKg: 500,
    spaceUnits: 4,
  });
  it('never exposes encoded marketplace metadata in editable notes', () => {
    const decoded=decodeReturnJourneyNotes(legacy);
    expect(decoded.notes).toBe('');
    expect(decoded.meta?.journeyKind).toBe('regular');
  });
  it('preserves every structured marketplace field when editing user notes', () => {
    const decoded=decodeReturnJourneyNotes(legacy);
    const saved=JSON.parse(encodeReturnJourneyNotes('Capacity up to four pallets',decoded.meta));
    expect(saved).toEqual({...JSON.parse(legacy),notes:'Capacity up to four pallets'});
  });
  it('preserves ordinary free-text notes exactly as business content', () => {
    const decoded=decodeReturnJourneyNotes('Tail lift required');
    expect(decoded).toEqual({notes:'Tail lift required',meta:null});
    expect(encodeReturnJourneyNotes(decoded.notes,decoded.meta)).toBe('Tail lift required');
  });
  it('does not hide arbitrary JSON lacking our exact metadata source', () => {
    const raw='{"source":"external","notes":"Do not discard"}';
    expect(decodeReturnJourneyNotes(raw).notes).toBe(raw);
  });
  it('keeps destination-anywhere and verifies server state after publish and withdraw', () => {
    const source=readFileSync(resolve(process.cwd(),'driver-pwa-reserve/src/ReturnJourneyPwa.tsx'),'utf8');
    expect(source).toContain("toLocation:anywhere?'':to.trim().toUpperCase()");
    expect(source).toContain("if(mode==='clear'&&current?.from_postcode)");
    expect(source).toContain('onSaved?.(current)');
    expect(source).toContain('new Date(start).getTime()<=Date.now()');
    expect(source).toContain("type=\"checkbox\" checked={anywhere}");
  });
});

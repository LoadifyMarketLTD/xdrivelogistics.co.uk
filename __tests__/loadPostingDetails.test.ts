import { describe, expect, it } from 'vitest';
import { getLoadDetailSections, getLoadDetailSummary, type LoadDetailSource } from '../lib/loadPostingDetails';

const details = {
  references: { customerReference: 'SYN-CUST', purchaseOrderNumber: 'SYN-PO', bookingReference: 'SYN-BOOK' },
  collection: { timeSlot: '09:00', contactName: 'Collection', contactPhone: '01234', tailLiftRequired: true, forkliftAvailable: false },
  delivery: { timeSlot: '12:00', contactName: 'Delivery', handballRequired: false },
  requestedVehicle: 'Luton', requestedCargo: 'Pallets',
  dimensionsCm: { length: 120, width: 80, height: 100 },
  cargoValueGbp: 120.5, palletDetails: { count: 2, type: 'Euro', stackable: false },
  documentChecklist: ['POD', 'CMR'], notes: 'Synthetic instructions',
};
const source = (raw: unknown, extra: Partial<LoadDetailSource> = {}): LoadDetailSource =>
  ({ ...extra, load_details: raw } as LoadDetailSource);
const entries = (s: LoadDetailSource) => Object.fromEntries(getLoadDetailSections(s).flatMap(g => g.items.map(i => [i.label, i.value])));

describe('XD-AUD-0011 shared load details parser', () => {
  it('renders JSON objects exactly like serialized JSON', () => {
    expect(getLoadDetailSections(source(details))).toEqual(getLoadDetailSections(source(JSON.stringify(details))));
    expect(entries(source(details))).toMatchObject({
      'Customer ref': 'SYN-CUST', 'PO number': 'SYN-PO', 'Booking ref': 'SYN-BOOK',
      'Pickup slot': '09:00', 'Delivery slot': '12:00', 'Collection contact': 'Collection / 01234',
      'Delivery contact': 'Delivery', Vehicle: 'Luton', Cargo: 'Pallets',
      Dimensions: '120 x 80 x 100 cm', 'Cargo value': 'GBP 120.50',
      Pallets: '2', Stackable: 'No', 'Collection forklift': 'No',
      'Collection tail lift': 'Yes', 'Delivery handball': 'No',
      Notes: 'Synthetic instructions', 'Requested docs': 'POD, CMR',
    });
  });
  it.each([undefined, null, '', '  ', 'legacy text', '{invalid', '[]', '42', 'false', 'null', [], 42, false])('retains direct fields without crashing for %j', raw => {
    expect(entries(source(raw, {customer_reference:'DIRECT'}))['Customer ref']).toBe('DIRECT');
  });
  it('retains direct-field priority and false/zero values', () => {
    expect(entries(source(details, {customer_reference:'DIRECT', cargo_value_gbp:0, pallet_stackable:true, collection_tail_lift_required:false}))).toMatchObject({
      'Customer ref':'DIRECT', 'Cargo value':'GBP 0.00', Stackable:'Yes', 'Collection tail lift':'No',
    });
  });
  it('does not mutate the-input object or document array', () => {
    const before=JSON.stringify(details);
    getLoadDetailSections(source(details));
    expect(JSON.stringify(details)).toBe(before);
  });
  it('preserves summary order and limit', () => {
    expect(getLoadDetailSummary(source(details), 2)).toEqual([
      {label:'Customer ref',value:'SYN-CUST'}, {label:'PO number',value:'SYN-PO'},
    ]);
  });
  it('uses canonical checklist before nested checklist', () => {
    expect(entries(source(details,{document_checklist:['Invoice']}))['Requested docs']).toBe('Invoice');
  });
  it('handles legacy string checklist without throwing or losing its text', () => {
    const s={load_details:null, document_checklist:'POD, CMR'} as unknown as LoadDetailSource;
    expect(entries(s)['Requested docs']).toBe('POD, CMR');
  });
  it('handles malformed checklist arrays and objects safely', () => {
    const s={load_details:{documentChecklist:['POD',null,{},'CMR']}, document_checklist:{bad:true}} as unknown as LoadDetailSource;
    expect(entries(s)['Requested docs']).toBe('POD, CMR');
  });
  it('does not let invalid field types crash or display object coercion', () => {
    const s={load_details:{references:{customerReference:{bad:true}},requestedCargo:'Pallets'}, vehicle_type:42} as unknown as LoadDetailSource;
    expect(entries(s)).toEqual({Cargo:'Pallets'});
  });
  it('keeps valid existing strings, array order and explicit checklist fallback', () => {
    expect(entries(source(JSON.stringify(details),{document_checklist:[]}))['Requested docs']).toBe('POD, CMR');
  });
});

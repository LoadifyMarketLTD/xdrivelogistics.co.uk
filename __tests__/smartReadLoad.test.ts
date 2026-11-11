import { describe, expect, it } from 'vitest';
import { isValidTargetPriceGbp, smartReadLoad } from '../lib/smartReadLoad';

const referenceDate = new Date(2026, 9, 21, 9, 0);

describe('Smart Read conservative extraction', () => {
  it('extracts labelled stops, vehicle, aggregate weight, pallets, and item count', () => {
    const result = smartReadLoad(
      'Collection: Warehouse, M1 1AE today 10:15; Delivery: SW1A 1AA tomorrow; Vehicle: LWB; Total weight: 450 kg; 2 pallets; 4 boxes',
      referenceDate,
    );
    expect(result.locations[0]).toMatchObject({ type: 'collection', postcode: { value: 'M1 1AE' }, address: { value: 'Warehouse' }, date: { value: '2026-10-21' }, time: { value: '10:15' } });
    expect(result.locations[1]).toMatchObject({ type: 'delivery', postcode: { value: 'SW1A 1AA' }, date: { value: '2026-10-22' } });
    expect(result.vehicleType?.value).toBe('LWB');
    expect(result.weightKg?.value).toBe('450');
    expect(result.pallets?.value).toBe('2');
    expect(result.itemCount?.value).toBe('4');
  });

  it('recognises explicit from-to route but will not invent a full postcode from outcodes', () => {
    const result = smartReadLoad('From M1 1AE to SW1A 1AA');
    expect(result.locations.map((stop) => stop.type)).toEqual(['collection', 'delivery']);
    const partial = smartReadLoad('From B6 to DY5');
    expect(partial.locations).toHaveLength(0);
    expect(partial.warnings.join(' ')).toContain('partial postcode');
  });

  it('preserves intermediate collection and delivery sequence for multi-stop routes', () => {
    const result = smartReadLoad('Collection: M1 1AE; Delivery: B1 1AA; Collection 2: CV1 2AB; Delivery 2: SW1A 1AA');
    expect(result.locations.map((stop) => [stop.type, stop.postcode.value])).toEqual([
      ['collection', 'M1 1AE'], ['delivery', 'B1 1AA'], ['collection', 'CV1 2AB'], ['delivery', 'SW1A 1AA'],
    ]);
  });

  it('does not guess unlabelled postcodes and warns on ambiguous stops', () => {
    const result = smartReadLoad('M1 1AE SW1A 1AA');
    expect(result.locations).toHaveLength(0);
    expect(result.warnings).toContain('Multiple postcodes on one line; confirm the stop order manually.');
  });

  it('warns on conflicting vehicle and weight values instead of selecting one', () => {
    const result = smartReadLoad('Vehicle: LWB; Vehicle: Luton; Weight: 400 kg; Weight: 600 kg');
    expect(result.vehicleType).toBeUndefined();
    expect(result.weightKg).toBeUndefined();
    expect(result.warnings).toContain('Conflicting vehicle types; confirm manually.');
    expect(result.warnings).toContain('Weight is ambiguous or per-item; check and enter the total cargo weight manually.');
  });

  it('converts dimensions and explicit target GBP price and retains operational requirements', () => {
    const result = smartReadLoad('Dimensions: 1.2m x 80cm x 600mm; Target price: £125.50 GBP ex VAT; Fixed price; tail lift; pump truck; fragile; 2-man');
    expect(result.dimensionsCm).toMatchObject({ length: { value: '120' }, width: { value: '80' }, height: { value: '60' } });
    expect(result.targetPriceGbp?.value).toBe('125.50');
    expect(smartReadLoad('Target price: GBP 125.50').targetPriceGbp).toBeUndefined();
    expect(result.fixedPrice).toBe(true);
    expect(result.requirements).toEqual(expect.arrayContaining(['Tail lift required', 'Pump truck required', 'Fragile goods', 'Two-person crew required']));
  });

  it('does not promote item weights into total cargo weight', () => {
    const result = smartReadLoad('Weight: 20 kg each; 4 boxes');
    expect(result.weightKg).toBeUndefined();
    expect(result.itemCount?.value).toBe('4');
    expect(result.warnings).toContain('Weight is ambiguous or per-item; check and enter the total cargo weight manually.');
  });

  it('warns instead of assigning ASAP to a clock time field', () => {
    const result = smartReadLoad('Collection: M1 1AE today ASAP', referenceDate);
    expect(result.locations[0].date?.value).toBe('2026-10-21');
    expect(result.locations[0].time).toBeUndefined();
    expect(result.locations[0].asap).toBe(true);
    expect(result.warnings).toContain('ASAP was recognised; choose a valid collection time in XDrive before saving.');
  });

  it('maps scoped equipment and keeps access and driver instructions explicit', () => {
    const result = smartReadLoad('Delivery: SW1A 1AA; Tail lift at delivery; Collection access: narrow gate; Driver instructions: use bay 4; Target carrier cost: GBP 80; Accept quotes; Return journey');
    expect(result.equipment.tailLiftDelivery).toBe(true);
    expect(result.equipment.tailLiftCollection).toBeUndefined();
    expect(result.deliveryAccessRestrictions).toBeUndefined();
    expect(result.collectionAccessRestrictions?.value).toBe('narrow gate');
    expect(result.executionInstructions?.value).toBe('use bay 4');
    expect(result.targetCarrierCostGbp?.value).toBe('80');
    expect(result.fixedPrice).toBe(false);
    expect(result.returnJourneyDetected).toBe(true);
  });

  it('does not turn a time window or unsupported minute into an exact pickup time', () => {
    const window = smartReadLoad('Collection: M1 1AE tomorrow 09:00-12:00');
    expect(window.locations[0].date?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(window.locations[0].time).toBeUndefined();
    expect(window.warnings).toContain('A time window was found; XDrive requires a specific time, so review it manually.');

    const offGrid = smartReadLoad('Collection: M1 1AE tomorrow 09:13');
    expect(offGrid.locations[0].time).toBeUndefined();
    expect(offGrid.warnings).toContain('The time is not on a 15-minute slot; choose a valid XDrive time manually.');
  });

  it('enforces a positive GBP target price with at most two decimals', () => {
    expect(isValidTargetPriceGbp(125.5)).toBe(true);
    expect(isValidTargetPriceGbp(125.55)).toBe(true);
    expect(isValidTargetPriceGbp(0)).toBe(false);
    expect(isValidTargetPriceGbp(-1)).toBe(false);
    expect(isValidTargetPriceGbp(125.555)).toBe(false);
    expect(isValidTargetPriceGbp(null)).toBe(false);
  });

  it('limits oversized input', () => {
    const result = smartReadLoad('x'.repeat(20001));
    expect(result.locations).toHaveLength(0);
    expect(result.warnings).toContain('Input exceeds 20,000 characters.');
  });
});

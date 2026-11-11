/**
 * Smart Read: conservative, source-linked extraction for load posting.
 * This parser runs in the browser; pasted source text is never sent or stored.
 */
export type SmartReadField = { value: string; evidence: string };

export const isValidTargetPriceGbp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
export type SmartReadStop = {
  type: 'collection' | 'delivery';
  postcode: SmartReadField;
  address?: SmartReadField;
  date?: SmartReadField;
  time?: SmartReadField;
  asap?: boolean;
  evidence: string;
};
export type SmartReadResult = {
  locations: SmartReadStop[];
  vehicleType?: SmartReadField;
  weightKg?: SmartReadField;
  pallets?: SmartReadField;
  itemCount?: SmartReadField;
  dimensionsCm?: { length: SmartReadField; width: SmartReadField; height: SmartReadField };
  targetPriceGbp?: SmartReadField;
  targetCarrierCostGbp?: SmartReadField;
  fixedPrice?: boolean;
  returnJourneyDetected?: boolean;
  equipment: {
    tailLiftCollection?: boolean; tailLiftDelivery?: boolean;
    forkliftCollection?: boolean; forkliftDelivery?: boolean;
    handballCollection?: boolean; handballDelivery?: boolean;
    adr?: boolean; temperatureControlled?: boolean; fragile?: boolean;
    pumpTruck?: boolean; twoPersonCrew?: boolean; dedicatedVehicle?: boolean;
  };
  collectionAccessRestrictions?: SmartReadField;
  deliveryAccessRestrictions?: SmartReadField;
  executionInstructions?: SmartReadField;
  requirements: string[];
  warnings: string[];
};

const postcode = /\b(?:GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))\b/gi;
const cleanPostcode = (value: string) => {
  const compact = value.toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? compact.slice(0, -3) + ' ' + compact.slice(-3) : compact;
};
const localDate = (value: Date) =>
  value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
const plusDays = (value: Date, days: number) => {
  const next = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  next.setDate(next.getDate() + days);
  return localDate(next);
};
const getSchedule = (text: string, referenceDate: Date) => {
  let date: string | undefined;
  if (/\btoday\b/i.test(text)) date = localDate(referenceDate);
  else if (/\btomorrow\b/i.test(text)) date = plusDays(referenceDate, 1);
  else {
    const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    const uk = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
    if (iso) date = iso[0];
    else if (uk) date = uk[3] + '-' + uk[2].padStart(2, '0') + '-' + uk[1].padStart(2, '0');
  }
  const hasTimeRange = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:-|to)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/i.test(text);
  const timeMatch = hasTimeRange ? null : text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  const parsedTime = timeMatch ? timeMatch[1].padStart(2, '0') + ':' + timeMatch[2] : undefined;
  const time = parsedTime && Number(timeMatch?.[2]) % 15 === 0 ? parsedTime : undefined;
  return { date, time, invalidTime: Boolean(parsedTime && !time), asap: /\bASAP\b|\bas soon as possible\b/i.test(text) };
};
const labelType = (text: string): SmartReadStop['type'] | undefined => {
  if (/^\s*(?:collection|collect|pickup|pick\s?up|from)\b/i.test(text)) return 'collection';
  if (/^\s*(?:delivery|deliver|drop(?:\s?off)?|to)\b/i.test(text)) return 'delivery';
  return undefined;
};
const addressBeforePostcode = (text: string, postcodeMatch: RegExpMatchArray) => {
  let before = text.slice(0, postcodeMatch.index).trim();
  before = before.replace(/^\s*(?:collection|collect|pickup|pick\s?up|from|delivery|deliver|drop(?:\s?off)?|to)(?:\s+\d+)?\s*[:#,-]?\s*/i, '');
  before = before.replace(/[,:;\s-]+$/, '').trim();
  return before && !/\b(?:today|tomorrow|ASAP|as soon as possible)\b/i.test(before)
    ? { value: before, evidence: text }
    : undefined;
};
export function smartReadLoad(input: string, referenceDate = new Date()): SmartReadResult {
  const result: SmartReadResult = { locations: [], equipment: {}, requirements: [], warnings: [] };
  if (input.length > 20000) return { ...result, warnings: ['Input exceeds 20,000 characters.'] };
  const segments = input.split(/\r?\n|;/).map((value) => value.trim()).filter(Boolean);
  for (const segment of segments) {
    const matches = [...segment.matchAll(new RegExp(postcode.source, 'gi'))];
    const schedule = getSchedule(segment, referenceDate);
    if (schedule.asap) result.warnings.push('ASAP was recognised; choose a valid collection time in XDrive before saving.');
    if (schedule.invalidTime) result.warnings.push('The time is not on a 15-minute slot; choose a valid XDrive time manually.');
    if (/\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:-|to)\s*([01]?\d|2[0-3])[:.]([0-5]\d)\b/i.test(segment)) result.warnings.push('A time window was found; XDrive requires a specific time, so review it manually.');
    const type = labelType(segment);
    if (matches.length === 1 && type) {
      const match = matches[0];
      const stop: SmartReadStop = {
        type,
        postcode: { value: cleanPostcode(match[0]), evidence: segment },
        evidence: segment,
      };
      const address = addressBeforePostcode(segment, match);
      if (address) stop.address = address;
      if (schedule.date) stop.date = { value: schedule.date, evidence: segment };
      if (schedule.time) stop.time = { value: schedule.time, evidence: segment };
      if (schedule.asap) stop.asap = true;
      result.locations.push(stop);
    } else if (matches.length === 2 && /\bfrom\b/i.test(segment) && /\bto\b/i.test(segment)) {
      const first = matches[0];
      const second = matches[1];
      result.locations.push(
        { type: 'collection', postcode: { value: cleanPostcode(first[0]), evidence: segment }, evidence: segment,
          ...(schedule.asap ? { asap: true } : {}),
          ...(schedule.date ? { date: { value: schedule.date, evidence: segment } } : {}),
          ...(schedule.time ? { time: { value: schedule.time, evidence: segment } } : {}) },
        { type: 'delivery', postcode: { value: cleanPostcode(second[0]), evidence: segment }, evidence: segment },
      );
    } else if (matches.length > 1) {
      result.warnings.push('Multiple postcodes on one line; confirm the stop order manually.');
    } else if (/\b(?:collection|pickup|delivery|drop|from|to)\b/i.test(segment) && /\b[A-Z]{1,2}\d{1,2}\b/i.test(segment)) {
      result.warnings.push('A partial postcode was found; enter the full UK postcode manually.');
    } else if (schedule.date || schedule.time) {
      result.warnings.push('A date/time was found without a clearly labelled stop; assign it manually.');
    }
  }

  if (result.locations.filter((stop) => stop.type === 'collection').length > 1) {
    result.warnings.push('Multiple collection locations found; review their order and complete each address.');
  }
  if (result.locations.filter((stop) => stop.type === 'delivery').length > 1) {
    result.warnings.push('Multiple delivery locations found; review their order and complete each address.');
  }
  if (result.locations.length > 10) {
    result.locations = result.locations.slice(0, 10);
    result.warnings.push('Only the first 10 locations were recognised; check the route manually.');
  }

  const vehicleMatches = [...input.matchAll(/\b(?:vehicle(?:\s+type)?|van|truck)\s*[:-]?\s*(small van|swb|lwb|xlwb|luton(?: van)?)\b/gi)];
  const vehicleTypes = [...new Set(vehicleMatches.map((match) => match[1].toUpperCase().replace(/\s+VAN$/, '')))];
  if (vehicleTypes.length === 1) result.vehicleType = { value: vehicleTypes[0], evidence: vehicleMatches[0][0] };
  else if (vehicleTypes.length > 1) result.warnings.push('Conflicting vehicle types; confirm manually.');

  const weightMatches = [...input.matchAll(/\b(?:(?:total|cargo)\s+)?weight\s*[:-]?\s*(\d+(?:[.,]\d+)?)\s*(kg|kilograms?|tonnes?|t)\b/gi)];
  const aggregateWeights = weightMatches.filter((match) => !/\b(?:each|per\s+(?:item|piece|pallet))\b/i.test(input.slice(match.index, match.index + match[0].length + 25)));
  if (aggregateWeights.length === 1) {
    const match = aggregateWeights[0];
    const amount = Number(match[1].replace(',', '.'));
    if (Number.isFinite(amount) && amount > 0) {
      const kg = /^t(?:onne)?s?$/i.test(match[2]) ? amount * 1000 : amount;
      result.weightKg = { value: String(kg), evidence: match[0] };
    }
  } else if (aggregateWeights.length > 1 || weightMatches.length > 0) {
    result.warnings.push('Weight is ambiguous or per-item; check and enter the total cargo weight manually.');
  }

  const palletMatches = [...input.matchAll(/\b(\d+)\s+pallets?\b|\bpallets?\s*[:-]?\s*(\d+)\b/gi)];
  if (palletMatches.length === 1) result.pallets = { value: palletMatches[0][1] || palletMatches[0][2], evidence: palletMatches[0][0] };
  else if (palletMatches.length > 1) result.warnings.push('Multiple pallet counts; confirm manually.');
  const itemMatches = [...input.matchAll(/\b(?:items?|pieces?|boxes|crates)\s*[:-]?\s*(\d+)\b|\b(\d+)\s+(?:items?|pieces?|boxes|crates)\b/gi)];
  if (itemMatches.length === 1) result.itemCount = { value: itemMatches[0][1] || itemMatches[0][2], evidence: itemMatches[0][0] };
  else if (itemMatches.length > 1) result.warnings.push('Multiple item counts; confirm manually.');

  const dimensionMatch = input.match(/\b(?:dimensions?\s*[:-]?\s*)?(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)?\b/i);
  if (dimensionMatch) {
    const values = [Number(dimensionMatch[1].replace(',', '.')), Number(dimensionMatch[3].replace(',', '.')), Number(dimensionMatch[5].replace(',', '.'))];
    const units = [dimensionMatch[2], dimensionMatch[4] || dimensionMatch[2], dimensionMatch[6] || dimensionMatch[4] || dimensionMatch[2]];
    const toCm = (value: number, unit: string) => unit.toLowerCase() === 'm' ? value * 100 : unit.toLowerCase() === 'mm' ? value / 10 : value;
    const converted = values.map((value, index) => toCm(value, units[index]));
    if (converted.every((value) => Number.isFinite(value) && value > 0 && value <= 2000)) {
      const evidence = dimensionMatch[0];
      result.dimensionsCm = {
        length: { value: String(converted[0]), evidence },
        width: { value: String(converted[1]), evidence },
        height: { value: String(converted[2]), evidence },
      };
    } else result.warnings.push('Dimensions are outside the supported range; confirm them manually.');
  }

  const priceMatches = [...input.matchAll(/\b(?:target\s+price|customer\s+price|budget|net\s+total)\s*[:-]?\s*(?:(?:GBP\s*)?£|GBP\s+)(\d+(?:\.\d{1,2})?)\s*(?:GBP)?\s*(?:ex(?:cluding)?\s+VAT|net)\b/gi)];
  if (priceMatches.length === 1 && Number(priceMatches[0][1]) > 0) {
    result.targetPriceGbp = { value: priceMatches[0][1], evidence: priceMatches[0][0] };
  } else if (priceMatches.length > 1) result.warnings.push('Multiple price values found; confirm the customer price manually.');
  else if (/\b(?:target\s+price|customer\s+price|budget|net\s+total)\b/i.test(input)) {
    result.warnings.push('Price was not imported; provide an explicit GBP amount excluding VAT.');
  }
  const carrierCostMatches = [...input.matchAll(/\b(?:target\s+carrier\s+cost|carrier\s+cost)\s*[:-]?\s*(?:GBP\s*)?£?\s*(\d+(?:\.\d{1,2})?)\s*(?:GBP)?\b/gi)];
  if (carrierCostMatches.length === 1 && Number(carrierCostMatches[0][1]) > 0) {
    result.targetCarrierCostGbp = { value: carrierCostMatches[0][1], evidence: carrierCostMatches[0][0] };
  } else if (carrierCostMatches.length > 1) result.warnings.push('Multiple carrier-cost values found; confirm them manually.');
  if (/\bfixed\s+price\b/i.test(input)) result.fixedPrice = true;
  else if (/\b(?:accept|accepting)\s+quotes\b|\bquotes?\s+invited\b/i.test(input)) result.fixedPrice = false;
  if (/\breturn\s+(?:journey|load)|\bbackload\b/i.test(input)) {
    result.returnJourneyDetected = true;
    result.warnings.push('A return journey was mentioned; review it and create a separate return load if needed.');
  }

  const setRequirement = (key: keyof SmartReadResult['equipment'], label: string, pattern: RegExp) => {
    if (pattern.test(input)) {
      result.equipment[key] = true;
      result.requirements.push(label);
    }
  };
  const tailLift = /\btail\s*lift\b/i.test(input);
  if (tailLift) {
    const deliveryOnly = /\b(?:delivery|deliver|drop(?:\s?off)?)\b[^;\n]{0,45}\btail\s*lift\b|\btail\s*lift\b[^;\n]{0,45}\b(?:at\s+)?delivery\b/i.test(input);
    const collectionOnly = /\b(?:collection|collect|pickup|pick\s?up)\b[^;\n]{0,45}\btail\s*lift\b|\btail\s*lift\b[^;\n]{0,45}\b(?:at\s+)?(?:collection|pickup)\b/i.test(input);
    result.equipment.tailLiftDelivery = deliveryOnly || undefined;
    result.equipment.tailLiftCollection = collectionOnly || (!deliveryOnly && !collectionOnly) || undefined;
    result.requirements.push('Tail lift required');
  }
  const forklift = /\bforklift\b/i.test(input);
  if (forklift) {
    const deliveryOnly = /\b(?:delivery|deliver|drop(?:\s?off)?)\b[^;\n]{0,45}\bforklift\b|\bforklift\b[^;\n]{0,45}\b(?:at\s+)?delivery\b/i.test(input);
    const collectionOnly = /\b(?:collection|collect|pickup|pick\s?up)\b[^;\n]{0,45}\bforklift\b|\bforklift\b[^;\n]{0,45}\b(?:at\s+)?(?:collection|pickup)\b/i.test(input);
    result.equipment.forkliftDelivery = deliveryOnly || undefined;
    result.equipment.forkliftCollection = collectionOnly || (!deliveryOnly && !collectionOnly) || undefined;
    result.requirements.push('Forklift at stop');
  }
  const handball = /\bhandball\b/i.test(input);
  if (handball) {
    const deliveryOnly = /\b(?:delivery|deliver|drop(?:\s?off)?)\b[^;\n]{0,45}\bhandball\b|\bhandball\b[^;\n]{0,45}\b(?:at\s+)?delivery\b/i.test(input);
    const collectionOnly = /\b(?:collection|collect|pickup|pick\s?up)\b[^;\n]{0,45}\bhandball\b|\bhandball\b[^;\n]{0,45}\b(?:at\s+)?(?:collection|pickup)\b/i.test(input);
    result.equipment.handballDelivery = deliveryOnly || undefined;
    result.equipment.handballCollection = collectionOnly || (!deliveryOnly && !collectionOnly) || undefined;
    result.requirements.push('Handball required');
  }
  setRequirement('adr', 'ADR goods', /\bADR\b/i);
  setRequirement('temperatureControlled', 'Temperature controlled', /\btemperature[- ]controlled\b|\bchilled\b|\bfrozen\b/i);
  setRequirement('fragile', 'Fragile goods', /\bfragile\b/i);
  setRequirement('pumpTruck', 'Pump truck required', /\bpump\s*truck\b/i);
  setRequirement('twoPersonCrew', 'Two-person crew required', /\btwo[- ]?(?:person|man)\b|\b2[- ]man\b/i);
  setRequirement('dedicatedVehicle', 'Dedicated vehicle / no co-loading', /\bdedicated\s+(?:vehicle|van)|no\s+co[- ]?loading\b/i);

  const collectionAccess = input.match(/(?:collection\s+(?:access|restrictions?)|access\s+at\s+collection)\s*[:-]\s*([^;\n]+)/i);
  const deliveryAccess = input.match(/(?:delivery\s+(?:access|restrictions?)|access\s+at\s+delivery)\s*[:-]\s*([^;\n]+)/i);
  const executionInstructions = input.match(/(?:driver|execution)\s+instructions?\s*[:-]\s*([^;\n]+)/i);
  if (collectionAccess) result.collectionAccessRestrictions = { value: collectionAccess[1].trim(), evidence: collectionAccess[0] };
  if (deliveryAccess) result.deliveryAccessRestrictions = { value: deliveryAccess[1].trim(), evidence: deliveryAccess[0] };
  if (executionInstructions) result.executionInstructions = { value: executionInstructions[1].trim(), evidence: executionInstructions[0] };

  if (!result.locations.some((stop) => stop.type === 'collection')) result.warnings.push('A clearly labelled collection with a full postcode is required.');
  if (!result.locations.some((stop) => stop.type === 'delivery')) result.warnings.push('A clearly labelled delivery with a full postcode is required.');
  return result;
}

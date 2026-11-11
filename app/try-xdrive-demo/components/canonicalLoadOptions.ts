// Mirrored from canonical XDrive LoadPostingForm.tsx; see audit for provenance.
export const demoVehicleOptions = ['Small Van', 'SWB Van', 'MWB Van', 'LWB Van', 'XLWB Van', 'Luton', 'Luton Tail Lift', 'Curtainside Van', '3.5T', '5T', '7.5T', '12T', '18T', '26T', 'Artic 44T Curtainsider', 'Artic 44T Box Trailer', 'Artic 44T Flatbed', 'Artic 44T Refrigerated', 'Hiab', 'Moffett', 'ADR Vehicle', 'Refrigerated Vehicle'] as const;
export const demoCargoOptions = ['Documents', 'Parcels', 'Pallets', 'Machinery', 'Furniture', 'Retail Goods', 'Mixed Freight', 'ADR Goods', 'Temperature Controlled Freight', 'Other'] as const;
export const demoQuarterHourSlots = Array.from({length:96},(_,i)=>`${String(Math.floor(i/4)).padStart(2,"0")}:${String((i%4)*15).padStart(2,"0")}`);

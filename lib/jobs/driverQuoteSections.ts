/** Two-tab approved Driver PWA quote presentation; quote states remain unchanged server-side. */
export function driverQuoteSection(status:string):'submitted'|'unsuccessful'{
 const value=status.trim().toLowerCase();
 return ['withdrawn','rejected','unsuccessful','expired','cancelled','archived','lost','declined'].includes(value)?'unsuccessful':'submitted';
}

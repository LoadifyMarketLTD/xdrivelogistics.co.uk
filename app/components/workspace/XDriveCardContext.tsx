import type { ReactNode } from 'react';

/** XDrive-specific card identity strip shared across the operational lifecycle.
 * Source remains the original load/quote/booking record; no synthetic status/data.
 */
export default function XDriveCardContext({
  type, reference, status, variant,
}:{
  type:string;
  reference:ReactNode;
  status?:ReactNode;
  variant:'load'|'quote'|'diary';
}){
  return (
    <div className={`xd-card-context xd-card-context--${variant}`}>
      <span className="xd-card-context__type">{type}</span>
      <span className="xd-card-context__ref">XDrive ref · {reference}</span>
      {status ? <span className="xd-card-context__status">{status}</span> : null}
    </div>
  );
}

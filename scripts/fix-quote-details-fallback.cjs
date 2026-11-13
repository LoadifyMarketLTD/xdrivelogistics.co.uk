const fs=require('node:fs');
const p='app/driver/quotes/page.tsx';
const s=fs.readFileSync(p,'utf8');
const start='<button type="button" className="xdrive-inline-link" disabled={view.access ===';
const a=s.indexOf(start);if(a<0||s.indexOf(start,a+start.length)!==-1)throw Error('Quote detail link marker ambiguous');
const b=s.indexOf('</button>',a)+9;if(b<a)throw Error('Cannot find end of button');
const before=s.slice(a,b);
const replacement=`<button
                          type="button"
                          className="xdrive-inline-link"
                          title={view.access === 'protected' ? 'Original load is restricted; your own quote record remains available below.' : undefined}
                          onClick={() => {
                            if (view.access === 'protected' || (view.access !== 'assigned' && view.access !== 'own' && (sold || ['withdrawn', 'expired', 'archived'].includes(quoteStage)))) {
                              setExpandedIds((previous) => {
                                const next = new Set(previous);
                                next.add(bid.id);
                                return next;
                              });
                            } else {
                              router.push(view.access === 'assigned' || view.access === 'own' ? \`/driver/jobs/\${bid.job_id}\` : \`/driver/loads/\${bid.job_id}\`);
                            }
                          }}
                        >{view.access === 'protected' || (view.access !== 'assigned' && view.access !== 'own' && (sold || ['withdrawn', 'expired', 'archived'].includes(quoteStage))) ? 'View quote record' : 'View Details'}</button>`;
const next=s.slice(0,a)+replacement+s.slice(b);
fs.writeFileSync(p,next,'utf8');
console.log('Protected expired quote now opens own quote record, without exposing restricted load');

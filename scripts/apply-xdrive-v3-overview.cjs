const fs=require('node:fs');
const root='app/components/workspace/';
const defs=[
 {file:'CxLoadCard.tsx',start:'      <div className="xdrive-cx-load-card__main">',end:'      {expanded && notes ?',replacement:`      {showXDriveContext ? (
        <XDriveTransportOverview
          tone="load"
          from={from} to={to} pickup={pickup} delivery={delivery}
          status={band} member={posted} postedAt={postedAt} vehicle={vehicle}
          details={expanded ? freight : undefined}
          requirements={expanded ? commercial : undefined}
          extraRoute={routeMeta}
        />
      ) : (
`},
 {file:'CxQuoteCard.tsx',start:'      <div className="xdrive-cx-quote-card__main">',end:'      {expanded && expandedContent ?',replacement:`      {showXDriveContext ? (
        <XDriveTransportOverview
          tone="quote"
          from={routeFrom} to={routeTo} pickup={pickup} delivery={delivery}
          status={sold ? 'SOLD' : band} caption={service}
          postedAt={postedAt} vehicle={vehicle}
        />
      ) : (
`},
 {file:'CxDiaryCard.tsx',start:'      <div className="xdrive-cx-diary-card__main">',end:'      <div className={\`xdrive-cx-diary-card__footer',replacement:`      {showXDriveContext ? (
        <XDriveTransportOverview
          tone="diary"
          from={from} to={to} pickup={pickup} delivery={delivery}
          status={band} member={statusLine} stamp={statusStamp}
          vehicle={vehicle}
        />
      ) : (
`}
];
for(const x of defs){
 const p=root+x.file,s=fs.readFileSync(p,'utf8');
 if(s.includes('XDriveTransportOverview'))throw Error('Already applied '+p);
 const a=s.indexOf(x.start),b=s.indexOf(x.end,a);
 if(a<0||b<0)throw Error('Missing marker '+p+' a='+a+' b='+b);
 const original=s.slice(a,b);
 const replacement=x.replacement + original + '      )}\n';
 let next=s.slice(0,a)+replacement+s.slice(b);
 const mark="import XDriveCardContext from './XDriveCardContext';";
 if(!next.includes(mark))throw Error('Missing import '+p);
 next=next.replace(mark,mark+"\nimport XDriveTransportOverview from './XDriveTransportOverview';");
 // The XDrive header identifies the record, while the overview carries status.
 next=next.replace(/(<XDriveCardContext [^>]*?) status=\{[^}]*\}/,'$1');
 fs.writeFileSync(p,next,'utf8');
 console.log('DONE '+p+'; original CX fallback preserved: '+original.length+' bytes');
}

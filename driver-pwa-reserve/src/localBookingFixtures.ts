import type {LiveJob} from './liveApi';
export const localBookingFixtures: LiveJob[] = Array.from({length:10},(_,i)=>{
 const routes=[['Blackburn BB2','Birmingham B24'],['Manchester M17','Leeds LS10'],['Preston PR2','Liverpool L24'],['Bolton BL3','Nottingham NG7'],['Wigan WN3','Sheffield S9'],['Burnley BB11','Derby DE21'],['Bradford BD4','York YO26'],['Chorley PR7','Bristol BS11'],['Lancaster LA1','Coventry CV6'],['Oldham OL9','London NW10']];
 const [from,to]=routes[i];return {id:(12345678+i).toString()+'-0000-4000-8000-000000000001',from,to,pickup:'10:00',delivery:'14:00',vehicle:i%2?'LWB Van':'Luton / Tail lift',weight:120+i*40,notes:'LOCAL TEST ONLY - fictional booking '+(i+1),status:'ALLOCATED',acceptanceRequired:true,offerId:'demo-offer-'+(i+1),company:'Demo Freight '+(i+1),customerRef:'DEMO-'+String(i+1).padStart(2,'0'),items:i%4+1,quote:120+i*20,terms:'30 days',pickupAddress:`Unit ${i+1}, Fictional Collection Estate, ${from} 0XX, UK`,deliveryAddress:`Unit ${i+1}, Fictional Delivery Estate, ${to} 0XX, UK`,routeStops:[{id:"demo-"+i+"-pickup",type:"collection",sequence:1,address:`Unit ${i+1}, Fictional Collection Estate, ${from} 0XX, UK`,company:`Demo Collection ${i+1}`,contactPerson:"Demo Collection Contact",telephone:"01632960001",notes:"TEST ONLY: Report to collection reception",timeWindowFrom:"10:00",status:"pending"},{id:"demo-"+i+"-delivery",type:"delivery",sequence:2,address:`Unit ${i+1}, Fictional Delivery Estate, ${to} 0XX, UK`,company:`Demo Delivery ${i+1}`,contactPerson:"Demo Delivery Contact",telephone:"01632960002",notes:"TEST ONLY: Report to goods inwards",timeWindowFrom:"14:00",status:"pending"}]};
});
localBookingFixtures.unshift({
 ...localBookingFixtures[0],
 id:'12345688-0000-4000-8000-000000000001',
 offerId:'demo-multidrop-03',customerRef:'DEMO-MULTIDROP-03',company:'Demo Multidrop Freight',
 from:'Blackburn BB2',to:'Leeds LS10',weight:300,items:3,quote:180,
 notes:'LOCAL TEST ONLY - three delivery stops, one item per delivery.',
 pickupAddress:'Unit 1, Fictional Collection Estate, Blackburn BB2 0XX, UK',
 deliveryAddress:'Unit 4, Fictional Delivery Estate, Leeds LS10 0XX, UK',
 routeStops:[
 {id:'md03-c1',type:'collection',sequence:1,address:'Unit 1, Fictional Collection Estate, Blackburn BB2 0XX, UK',company:'Demo Collection',contactPerson:'Test Collection Contact',telephone:'01632960001',notes:'Collect three items',timeWindowFrom:'10:00',status:'pending'},
 ...['Manchester M17','Bradford BD4','Leeds LS10'].map((town,i)=>({id:'md03-d'+(i+1),type:'delivery' as const,sequence:i+2,address:'Unit '+(i+2)+', Fictional Delivery Estate, '+town+' 0XX, UK',company:'Demo Drop '+(i+1),contactPerson:'Test Recipient '+(i+1),telephone:'01632960002',notes:'Deliver one item; capture separate POD',timeWindowFrom:['12:00','13:00','14:00'][i],status:'pending' as const}))
 ]
});

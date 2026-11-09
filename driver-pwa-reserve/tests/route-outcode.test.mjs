import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {routeLabel,normalizeRouteAddress} from '../src/routeLabel.ts';

test('Completed booking route removes duplicated GB and postal code without losing an actual postcode',()=>{
 assert.equal(normalizeRouteAddress('Cornelian Street, Blackburn, BB1 9QL, GB, BB1 9QL'),'Cornelian Street, Blackburn, BB1 9QL');
 assert.equal(routeLabel('Holly Hill Road, Bexley, DA8 1QD, GB, DA8 1QD','DA8'),'Holly Hill Road, Bexley, DA8 1QD');
 assert.equal(normalizeRouteAddress('London, GB, DA8 1QD'),'London, DA8 1QD');
 assert.equal(normalizeRouteAddress('Blackburn, BB1'),'Blackburn, BB1');
});
const api=fs.readFileSync(new URL('../src/liveApi.ts',import.meta.url),'utf8');
const view=fs.readFileSync(new URL('../src/ReserveApp.tsx',import.meta.url),'utf8');
test('UK city and actual outcode are formatted in CX style',()=>{
 assert.equal(routeLabel('Blackburn','BB1'),'Blackburn, BB1');
 assert.equal(routeLabel('Leeds','LS1'),'Leeds, LS1');
 assert.equal(routeLabel('Manchester','M12'),'Manchester, M12');
});
test('Never invent outcode or expose full postcode before award',()=>{
 assert.equal(routeLabel('Blackburn',undefined),'Blackburn');
 assert.equal(routeLabel('Blackburn','BB1 8DQ'),'Blackburn');
 assert.equal(routeLabel('Blackburn, BB1','BB1'),'Blackburn, BB1');
 assert.equal(routeLabel('Manchester','not provided'),'Manchester');
});
test('Both job locations obtain outcode only from authentic API data',()=>{
 assert.match(api,/fromOutcode: str\(r.pickup_postcode_area\)/);
 assert.match(api,/toOutcode: str\(r.delivery_postcode_area\)/);
 assert.match(view,/routeLabel\(job.from,job.fromOutcode\)/);
 assert.match(view,/routeLabel\(job.to,job.toOutcode\)/);
});

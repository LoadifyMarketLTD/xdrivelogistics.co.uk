import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const live=readFileSync(new URL('../src/LivePodCapture.tsx',import.meta.url),'utf8');
const form=readFileSync(new URL('../src/PodDetails.tsx',import.meta.url),'utf8');
test('delivery form values survive the transition to live POD capture',()=>{
 assert.match(app,/initialRecipient=\{deliveryRecipient\}/);
 assert.match(app,/initialDelivery=\{\{ leftAt: deliveryLeftAt, condition: deliveryCondition/);
 assert.match(live,/useState\(initialRecipient\)/);
 assert.match(live,/useState<PodForm>\(initialDelivery \?\?/);
 assert.match(live,/initialDelivery=\{initialDelivery\} recipient=\{recipient\}/);
 assert.match(form,/useState\(initialDelivery\?\.leftAt/);
 assert.match(form,/useState\(initialDelivery\?\.condition/);
 assert.match(form,/useState\(String\(initialDelivery\?\.items/);
});

import {describe,expect,it} from 'vitest';
import fs from 'node:fs';import path from 'node:path';
import {similarLoadAlertKey,groupSimilarLoadAlerts} from '../lib/notifications/groupSimilarLoadAlerts';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const sample=(id:string, overrides:Record<string,unknown>={})=>({
 id,title:'Load Alert',body:'Open XDrive for details',type:'load_alert',read_at:null,created_at:'2026-11-08T12:00:00Z',...overrides,
});
describe('Driver Notifications group repeated generic load alerts without loss',()=>{
 it('groups identical generic load alerts only when calendar day and content match',()=>{
  const alerts=[sample('1'),sample('2'),sample('3',{created_at:'2026-11-07T12:00:00Z'}),sample('4',{body:'Job #different'}),sample('5',{type:'bid_accepted'})];
  const rows=groupSimilarLoadAlerts(alerts,new Set());
  expect(rows.length).toBe(4);
  expect(rows[0].count).toBe(2);
  expect(rows[0].unread).toBe(2);
  expect(rows[0].representative).toBe(true);
 });
 it('never hides separate operational alerts or alters data',()=>{
  const messages=[sample('a',{type:'pod_uploaded'}),sample('b',{type:'pod_uploaded'})];
  expect(similarLoadAlertKey(messages[0])).toBeNull();
  expect(groupSimilarLoadAlerts(messages,new Set()).length).toBe(2);
 });
 it('expansion restores each original record for independent read/remove actions',()=>{
  const messages=[sample('a'),sample('b',{read_at:'2026-11-08T12:10:00Z'})];
  const key=similarLoadAlertKey(messages[0]);
  expect(key).not.toBeNull();
  const collapsed=groupSimilarLoadAlerts(messages,new Set());
  expect(collapsed.length).toBe(1);
  expect(collapsed[0].unread).toBe(1);
  expect(groupSimilarLoadAlerts(messages,new Set([key!])).map(x=>x.notification.id)).toEqual(['a','b']);
  expect(messages[0].read_at).toBeNull();
 });
 it('does not replace authorised per-notification backend endpoints',()=>{
  const source=read('app/driver/_components/DriverNotificationRegister.tsx');
  expect(source).toContain('groupSimilarLoadAlerts(visibleMessages,expandedAlertGroups)');
  expect(source).toContain('Expand');
  expect(source).toContain('/api/driver/notifications/');
  expect(source).toContain('Mark read');
  expect(source).toContain('Remove');
 });
});

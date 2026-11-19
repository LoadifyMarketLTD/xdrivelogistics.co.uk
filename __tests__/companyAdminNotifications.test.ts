import {describe,it,expect} from 'vitest';
import {filterCompanyNotifications,notificationCategory,notificationModule,type CompanyNotification,type CompanyNotificationFilter} from '../app/components/workspace/companyAdminNotificationsModel';
const row=(id:string,type:string|null,read_at:string|null=null,created_at='2026-11-19T12:00:00Z'):CompanyNotification=>({id,type,read_at,created_at,title:id,body:'Delivery Blackburn'});
const base:CompanyNotificationFilter={tab:'all',query:'',from:'',to:'',status:'all'};
describe('Company Admin notification filters',()=>{
 it('classifies existing event types and preserves unknown messages',()=>{expect(notificationCategory('bid_accepted')).toBe('quotes');expect(notificationCategory('pod_uploaded')).toBe('bookings');expect(notificationCategory('invoice_dispute')).toBe('invoices');expect(notificationCategory('job_assigned')).toBe('jobs');expect(notificationCategory('return_journey_alert')).toBe('load_alerts');expect(notificationCategory('unknown')).toBe('system')});
 it('combines category, status, search and inclusive UK dates',()=>{const rows=[row('a','job_assigned',null,'2026-07-01T23:30:00Z'),row('b','job_assigned','2026-07-02T10:00:00Z'),row('c','bid_accepted',null,'2026-07-02T10:00:00Z')];expect(filterCompanyNotifications(rows,{...base,tab:'jobs',status:'unread',query:'blackburn',from:'2026-07-02',to:'2026-07-02'}).map(r=>r.id)).toEqual(['a'])});
 it('keeps recipient inbox IDs distinct from module destinations',()=>{expect(notificationModule('job_assigned')?.href).toBe('/admin/diary');expect(notificationModule('unknown')).toBeNull();expect(notificationModule('invoice_created')?.href).toBe('/admin/finance')});
});

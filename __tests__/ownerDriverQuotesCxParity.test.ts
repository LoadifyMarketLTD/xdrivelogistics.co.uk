import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('app/driver/quotes/page.tsx','utf8');
const css = readFileSync('app/driver/quotes/quotes-exchange.css','utf8');

describe('Owner Driver Quotes CX parity',()=>{
  it('uses CX primary quote tabs and keeps extra XDrive statuses in More',()=>{
    for(const label of ['Received','Archived','Submitted','Unsuccessful','More statuses']) expect(page).toContain(label);
    for(const label of ['Shortlisted','Accepted / Won','Withdrawn','Expired']) expect(page).toContain(label);
  });
  it('uses CX search panel controls',()=>{
    for(const label of ['Pickup Time Within','Delivery Time Within','Load ID / Ref','Booked by','Search','Clear']) expect(page).toContain(label);
  });
  it('keeps quote card footer actions and quoted amount metadata',()=>{
    expect(page).toContain('You Quoted');
    expect(page).toContain('Withdraw Quote');
    expect(page).toContain('quote-expand');
    expect(page).toContain('View Details');
  });
  it('pins the CX search/tab visual grammar',()=>{
    expect(css).toContain('PR675 Quotes: CX search panel and tab grammar');
    expect(css).toContain('grid-template-columns:188px minmax(0,1fr)!important');
    expect(css).toContain('height:34px!important');
    expect(css).toContain('font-size:11px!important');
  });
});
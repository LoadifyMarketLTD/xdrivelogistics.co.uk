import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Operational list controls placement contract', () => {
  it('keeps Driver list controls in the upper-right toolbar, not in list footers', () => {
    const loads = read('app/driver/loads/page.tsx');
    const quotes = read('app/driver/quotes/page.tsx');
    const returns = read('app/driver/returns/page.tsx');
    const directory = read('app/components/workspace/MemberDirectoryPage.tsx');
    const search = read('app/driver/loads/search/page.tsx');

    for (const source of [loads, quotes, returns, directory, search]) {
      expect(source).toContain('Items per Page');
    }

    expect(loads).toContain('className="load-result-head"');
    expect(loads).toContain("marginLeft: 'auto'");
    expect(loads).not.toContain('<div className="footer"><span>1-');
    expect(quotes).toContain('className="cx-quote-pagination-row"');
    expect(quotes).not.toContain('<div className="footer"><span>Items per Page:');
    expect(returns).toContain("toggleExpandAll");
    expect(returns).not.toContain('<div className="footer"><span>Items per Page:');
    expect(directory).toContain("marginLeft: 'auto'");
    expect(directory).not.toContain('<div className="footer"><span>Items per Page:');
    expect(search).toContain('<OperationalExpandAllControl');
  });

  it('keeps shared Diary and Event Log paging controls at the top-right of their boards', () => {
    const diary = read('app/components/workspace/OperationsDiaryPage.tsx');
    const eventLog = read('app/components/workspace/WorkspaceEventLogPage.tsx');
    const customerDiary = read('app/customer/diary/page.tsx');
    const brokerDiary = read('app/broker/diary/page.tsx');
    const driverDiary = read('app/driver/history/page.tsx');

    for (const source of [diary, eventLog, customerDiary, brokerDiary]) {
      expect(source).toContain('workspace-list-controls');
    }
    for (const source of [diary, customerDiary, brokerDiary, driverDiary]) {
      expect(source).toContain('cx-expand-entries-control');
    }
    expect(driverDiary).toContain('driver-diary-summary-actions');
    expect(eventLog).not.toContain('Page {safePage} / {totalPages}');
    expect(customerDiary).not.toContain("justifyContent: 'center'");
    expect(brokerDiary).not.toContain("justifyContent: 'center'");
  });

  it('uses CX-density values for upper-right operational controls', () => {
    const shellCss = read('app/components/workspace/top-workspace-shell.css');
    const driverCss = read('app/driver/driver-full-prototype.css');
    expect(shellCss).toContain('min-height:40px!important');
    expect(shellCss).toContain('height:28px!important');
    expect(shellCss).toContain('width:52px!important');
    expect(driverCss).toContain('min-height:31px!important');
    expect(driverCss).toContain('height:24px!important');
  });

  it('keeps Refresh out of Customer Team and Driver Job PageHeaders', () => {
    const customerTeam = read('app/components/workspace/CustomerTeamPage.tsx');
    const driverJob = read('app/components/workspace/DriverJobExecutionPage.tsx');

    const headerBlock = (source: string) => {
      const start = source.indexOf('<PageHeader');
      const end = source.indexOf('/>', start);
      return start >= 0 && end >= 0 ? source.slice(start, end + 2) : '';
    };

    expect(headerBlock(customerTeam)).not.toContain('Refresh');
    expect(customerTeam).toContain('title="Company team"');
    expect(customerTeam).toContain("{loading ? 'Refreshing…' : 'Refresh'}");

    expect(headerBlock(driverJob)).not.toContain('Refresh');
    expect(driverJob).toContain('className="workspace-record-meta workspace-list-controls"');
    expect(driverJob).toContain(">Refresh</ActionButton>");

    const customerBooking = read('app/customer/jobs/[id]/page.tsx');
    expect(headerBlock(customerBooking)).not.toContain('/customer/bookings');
    expect(customerBooking).toContain('className="workspace-record-meta workspace-list-controls"');
    expect(customerBooking).toContain('>Back to Bookings</ActionButton>');
    expect(customerBooking).toContain('>Edit Job</ActionButton>');
  });
});

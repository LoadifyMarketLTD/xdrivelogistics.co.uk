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

    expect(loads).toContain('load-toolbar-single');
    expect(loads).not.toContain('<div className="footer"><span>1-');
    expect(quotes).toContain("justifyContent: 'flex-end'");
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
      expect(source).toContain('Expand all');
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
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

const adminBids = read('app/admin/bids/page.tsx');
const brokerDiary = read('app/broker/diary/page.tsx');

describe('full E2E runtime repairs', () => {
  it('never sends a request body on the GET bidder-identity request', () => {
    const start = adminBids.indexOf("fetch('/api/admin/bids/identities'");
    expect(start).toBeGreaterThan(-1);
    const requestBlock = adminBids.slice(start, start + 240);
    expect(requestBlock).toContain("headers: { Authorization: 'Bearer ' + token }");
    expect(requestBlock).not.toContain('body:');
    expect(requestBlock).not.toContain("method: 'POST'");
  });

  it('renders Broker Diary clock only after client hydration', () => {
    expect(brokerDiary).toContain("const [diaryClock, setDiaryClock] = useState('')");
    expect(brokerDiary).toContain('const updateClock = () => setDiaryClock(');
    expect(brokerDiary).toContain('window.setInterval(updateClock, 60_000)');
    expect(brokerDiary).toContain("{diaryClock ? `Diary at ${diaryClock}` : 'Diary'}");
    expect(brokerDiary).not.toContain("<strong>Diary at {new Date().toLocaleTimeString");
  });
});

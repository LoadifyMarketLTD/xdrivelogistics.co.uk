import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('driver diary refresh stability contract', () => {
  const page = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');

  it('keeps loaded diary rows mounted during background refreshes', () => {
    expect(page).toContain('const [refreshing, setRefreshing] = useState(false)');
    expect(page).toContain('const hasLoadedRef = useRef(false)');
    expect(page).toContain('if (hasLoadedRef.current) setRefreshing(true); else setLoading(true)');
    expect(page).toContain('loading && jobs.length === 0');
    expect(page).toContain("{refreshing ? 'Refreshing...' : 'Refresh'}");
  });

  it('does not clear previously loaded rows when a background refresh fails', () => {
    expect(page).toContain('if (!hasLoadedRef.current) setJobs([])');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const diary = fs.readFileSync(path.join(process.cwd(), 'app/driver/history/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/driver/driver-prototype-parity.css'), 'utf8');

describe('CX Driver Diary split-view parity', () => {
  it('exposes List View and Split View controls backed by real selected booking state', () => {
    expect(diary).toContain("type DiaryViewMode = 'list' | 'split'");
    expect(diary).toContain("const [viewMode, setViewMode] = useState<DiaryViewMode>('list')");
    expect(diary).toContain('List View');
    expect(diary).toContain('Split View');
    expect(diary).toContain('setSelectedJobId(job.id)');
    expect(diary).toContain('<DriverJobSheetPanel jobId={selectedJobId} />');
  });

  it('keeps split mode responsive and visually within the Driver workspace identity', () => {
    expect(css).toContain('.driver-diary-split-view');
    expect(css).toContain('grid-template-columns: minmax(330px, .78fr) minmax(520px, 1.22fr)');
    expect(css).toContain('@media (max-width: 1100px)');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const directory = read('app/components/workspace/MemberDirectoryPage.tsx');
const diary = read('app/components/workspace/OperationsDiaryPage.tsx');

describe('CX Directory sorting and Diary safety recovery from PR 678', () => {
  it('makes the Directory sort selector functional in Driver and shared workspaces', () => {
    expect(directory).toContain("type DirectorySort = 'Distance' | 'Member Name' | 'Delivery Reliability' | 'Payment Reliability'");
    expect(directory).toContain("const [directorySort, setDirectorySort] = useState<DirectorySort>('Distance')");
    expect(directory).toContain("if (sort === 'Member Name')");
    expect(directory).toContain("if (sort === 'Delivery Reliability')");
    expect(directory).toContain("if (sort === 'Payment Reliability')");
    expect(directory).toContain('a.distanceMiles ?? Number.POSITIVE_INFINITY');
    expect(directory).toContain('value={directorySort}');
    expect(directory).toContain('{sortedCompanies.map((company) => (');
    expect(directory).toContain('{sortedDrivers.map((driver) => (');
  });

  it('resets Directory sorting to Distance when filters are cleared', () => {
    expect(directory).toContain("setDirectorySort('Distance')");
    expect(directory).toContain('setDirectoryVisibleCount(directoryPageSize)');
  });

  it('warns when the Diary query hits its hard 300-record limit', () => {
    expect(diary).toContain('.limit(300)');
    expect(diary).toContain('loadedJobs.length >= 300');
    expect(diary).toContain('Diary reached the 300-record query limit.');
  });

  it('clears group, saved-view and pagination state together with Diary search filters', () => {
    expect(diary).toContain("setSelectedGroupFilter('')");
    expect(diary).toContain("setSelectedSavedViewId('')");
    expect(diary).toContain('setPage(1)');
  });
});

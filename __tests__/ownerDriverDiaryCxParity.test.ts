import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');
const diary = read('app/driver/history/page.tsx');
const diaryCss = read('app/driver/history/diary-exchange.css');
const posting = read('app/components/workspace/LoadPostingForm.tsx');
const cloneApi = read('app/api/admin/jobs/[id]/clone-prefill/route.ts');
const ownerEdit = read('app/components/workspace/JobOwnerEditForm.tsx');

describe('Owner Driver Diary CX functional parity', () => {
  it('keeps the nine operational Diary tabs through the canonical contract', () => {
    const canonical = read('lib/diary/canonicalDiary.ts');
    for (const label of ['All','Unallocated','Allocated','In Progress','Completed','Cancelled','Expired','Awaiting Feedback','Recent Feedback']) {
      expect(canonical).toContain(`label: '${label}'`);
    }
  });

  it('provides CX-style scope, view, refresh and pagination controls', () => {
    for (const marker of ['Jobs Sub-contracted','Our Bookings','List View','Split View','Collapse All Entries','Refresh']) {
      expect(diary).toContain(marker);
    }
    expect(diary).toContain('<option value={5}>5</option>');
    expect(diary).toContain('<option value={10}>10</option>');
    expect(diary).toContain('<option value={25}>25</option>');
  });

  it('connects real contextual actions rather than dead buttons', () => {
    expect(diary).toContain('/driver/jobs/${encodeURIComponent(job.id)}/edit');
    expect(diary).toContain('sourceAction=rebook');
    expect(diary).toContain('sourceAction=repost');
    expect(diary).toContain('sourceAction=duplicate');
    expect(diary).toContain('/job-replay/${encodeURIComponent(job.id)}');
    expect(posting).toContain("sourceActionParam === 'duplicate'");
    expect(cloneApi).toContain("type CloneAction = 'rebook' | 'repost' | 'duplicate'");
    expect(ownerEdit).toContain("'owner'");
  });

  it('keeps Diary typography and split layout aligned with the approved Loads grammar', () => {
    expect(diaryCss).toContain('PR675 Diary: exact Loads route/time information hierarchy');
    expect(diaryCss).toContain('.diary-bookings--split');
    expect(diaryCss).toContain('font-size:12.5px!important');
    expect(diaryCss).toContain('font-weight:700!important');
  });
});

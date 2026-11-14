const fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const jobs=read('app/driver/jobs/page.tsx');
const detail=read('app/driver/jobs/[id]/page.tsx');
const detailUnchanged=cp.execFileSync('git',['diff','--name-only','origin/main','--','app/driver/jobs/[id]/page.tsx'],{encoding:'utf8'}).trim().length===0;
const checks=[
 ['Owner Driver receives XDrive redesigned transport card',jobs.includes('if (isOwnerDriver) return (')&&jobs.includes('<XDriveTransportOverview')],
 ['Company Driver retains original approved CxDiaryCard',jobs.includes('return <CxDiaryCard')&&jobs.includes("resolveWorkspaceRole(user) === 'owner_driver'")],
 ['Canonical POD completion state retained',jobs.includes('hasCompletePodEvidence(job)')&&jobs.includes('isDeliveredAwaitingPod(job)')],
 ['POD and signature evidence fields remain fetched',jobs.includes('pod_generated')&&jobs.includes('delivery_signature_data')&&jobs.includes('pod_photos')],
 ['Existing current status prioritization and filter preserved',jobs.includes("filter, setFilter] = useState<DriverBookingView>('current')")&&jobs.includes("priority=(job:JobRow)")],
 ['Full execution route and Live GPS untouched',detailUnchanged&&detail.includes('<JobLiveTrackingPanel jobId={jobId}')],
 ['Job status is never directly mutated by presentation card',jobs.includes("router.push('/driver/jobs/' + job.id)")&&!jobs.includes("supabase.from('jobs').update(")],
 ['Customer Post Load and PWA remain intact',!cp.execFileSync('git',['diff','--name-only','origin/main','--','app/driver/post-load','app/admin/post-load','public/driver'],{encoding:'utf8'}).trim()],
 ['New style scoped to Owner Driver CSS classes',read('app/driver/xdrive-owner-myjobs.css').includes('.xd-owner-job-card')],
];
for(const [name,pass] of checks)console.log((pass?'PASS':'FAIL')+' '+name);
if(checks.some(([,pass])=>!pass))process.exitCode=1;

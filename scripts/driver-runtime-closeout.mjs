import fs from 'node:fs';
import path from 'node:path';

const repo = process.cwd();
const target = path.join(repo, 'apps', 'xdrive-driver-phone-golden', 'src', 'app', 'DriverMobileAppV3.tsx');
if (!fs.existsSync(target)) throw new Error(`DriverMobileAppV3.tsx not found at ${target}`);

let source = fs.readFileSync(target, 'utf8');

function replaceOnce(label, before, after) {
  if (source.includes(after)) return;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source block was not found.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) throw new Error(`${label}: source block is ambiguous.`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'queue logout cache import',
  `import {\n  enqueueAction,\n  getQueue,\n  isOnline,\n  saveQueue,\n  updateQueueItem,\n  type QueuedAction,\n} from '../offline/queue';`,
  `import {\n  clearQueueSessionCache,\n  enqueueAction,\n  getQueue,\n  isOnline,\n  saveQueue,\n  updateQueueItem,\n  type QueuedAction,\n} from '../offline/queue';`,
);

replaceOnce(
  'cancelled progress label',
  `  arrived_delivery: 'At delivery point',\n  delivered: 'Completed',\n};`,
  `  arrived_delivery: 'At delivery point',\n  delivered: 'Completed',\n  cancelled: 'Cancelled',\n};`,
);

replaceOnce(
  'history chronological sort',
  `function sortTime(job: DriverJob) {\n  const values = [job.deliveryTime, job.pickupTime];`,
  `function sortTime(job: DriverJob) {\n  const values = [job.updatedAt, job.deliveryTime, job.pickupTime];`,
);

replaceOnce(
  'logout queue isolation',
  `    await clearSessionToken().catch(() => undefined);\n    setToken(null);\n    setResources(null);`,
  `    await clearSessionToken().catch(() => undefined);\n    clearQueueSessionCache();\n    setQueue([]);\n    setToken(null);\n    setResources(null);`,
);

replaceOnce(
  'cancelled lifecycle terminal gate',
  `    if (!nextStep) {\n      if (jobDetail.status === 'delivered') return;\n      setPodOpen(true);`,
  `    if (!nextStep) {\n      if (jobDetail.status === 'delivered' || jobDetail.status === 'cancelled') return;\n      setPodOpen(true);`,
);

replaceOnce(
  'durable delivery evidence capture',
  `    if (!result.canceled && result.assets[0]?.uri) setPodPhotoUri(result.assets[0].uri);`,
  `    if (!result.canceled && result.assets[0]?.uri && jobDetail) {\n      setPodPhotoUri(await persistEvidencePhoto(result.assets[0].uri, jobDetail.id, 'delivery'));\n    }`,
);

replaceOnce(
  'cancelled history badge',
  `      <StatusTag label={progressLabels[job.status].toUpperCase()} tone={job.status === 'delivered' ? 'green' : 'blue'} />`,
  `      <StatusTag\n        label={progressLabels[job.status].toUpperCase()}\n        tone={job.status === 'delivered' ? 'green' : job.status === 'cancelled' ? 'muted' : 'blue'}\n      />`,
);

replaceOnce(
  'history event date',
  `    <View style={styles.historyBottom}><Text style={styles.historyDate}>{formatDate(job.deliveryTime || job.pickupTime)}</Text>{job.price ? <Text style={styles.historyRate}>{job.price}</Text> : null}</View>`,
  `    <View style={styles.historyBottom}><Text style={styles.historyDate}>{formatDate(job.updatedAt || job.deliveryTime || job.pickupTime)}</Text>{job.price ? <Text style={styles.historyRate}>{job.price}</Text> : null}</View>`,
);

replaceOnce(
  'cancelled progress terminal view',
  `function ProgressBoard({ job }: { job: JobDetail }) {\n  const currentIndex = progressOrder.indexOf(job.status);\n  return <View style={styles.progressBoard}>`,
  `function ProgressBoard({ job }: { job: JobDetail }) {\n  if (job.status === 'cancelled') {\n    return <View style={styles.progressBoard}>\n      <Text style={styles.sectionKicker}>SERVER-CONFIRMED PROGRESS</Text>\n      <Text style={styles.progressHeading}>Cancelled</Text>\n      <Text style={styles.longText}>This work order is closed and cannot accept lifecycle or POD actions.</Text>\n    </View>;\n  }\n  const currentIndex = progressOrder.indexOf(job.status);\n  return <View style={styles.progressBoard}>`,
);

replaceOnce(
  'cancelled fixed action suppression',
  `function WorkStepAction({ job, busy, podOpen, onPress }: { job: JobDetail; busy: boolean; podOpen: boolean; onPress: () => void }) {\n  if (podOpen || job.status === 'delivered') return null;`,
  `function WorkStepAction({ job, busy, podOpen, onPress }: { job: JobDetail; busy: boolean; podOpen: boolean; onPress: () => void }) {\n  if (podOpen || job.status === 'delivered' || job.status === 'cancelled') return null;`,
);

fs.writeFileSync(target, source, 'utf8');
console.log('Driver V3 runtime closeout patch applied successfully.');

type Props = { value: string; onChange: (value: string) => void };
const times = Array.from({ length: 96 }, (_, i) => {
  const hour = String(Math.floor(i / 4)).padStart(2, '0');
  const minute = String((i % 4) * 15).padStart(2, '0');
  return `${hour}:${minute}`;
});
export default function EtaQuarterHour({ value, onChange }: Props) {
  const [date = '', time = ''] = value.split('T');
  return <div className="eta-quarter-hour">
    <input aria-label="Delivery ETA date" type="date" value={date} onChange={e => onChange(e.target.value ? `${e.target.value}T${times.includes(time) ? time : '00:00'}` : '')} />
    <select aria-label="Delivery ETA time (15-minute intervals)" value={times.includes(time) ? time : ''} onChange={e => onChange(`${date || new Date().toLocaleDateString('en-CA')}T${e.target.value}`)}>
      <option value="" disabled>Select time</option>
      {times.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  </div>;
}

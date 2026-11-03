import Link from 'next/link';
import Broker3118Shell from '../broker/Broker3118Shell';
import '../components/workspace/top-workspace-shell.css';
import '../broker/broker-3118.css';
import '../broker/broker-3150-visual.css';

/** Temporary public, read-only visual preview for a draft PR.
 * It never requests or exposes tenant data. Do not merge this route into production.
 */
export default function BrokerVisualPreview() {
  return <div className="xdrive-broker-workspace xdrive-operational-top-workspace" style={{ minHeight: '100vh', background: '#f4f6f8' }}>
    <Broker3118Shell>
      <div className="broker3118-dashboard">
        <div style={{ padding: '12px 16px', background: '#fff6dc', border: '1px solid #f6d88d', borderRadius: 8 }}>
          <strong>PREVIZUALIZARE VIZUALĂ — FĂRĂ DATE REALE.</strong>
          <p>Acesta este modelul de navigare și design Broker. Pentru paginile operaționale autentificate, deschideți <Link href="/broker">Broker Workspace</Link> și conectați-vă.</p>
        </div>
        <h1>Dashboard</h1>
        <div className="broker3118-metrics">
          {['POSTED LOADS','CARRIER QUOTES','AWARDED JOBS','PROOF OF DELIVERY'].map(label => (
            <div key={label}><small>{label}</small><b>—</b><span>Exemplu exclusiv vizual</span></div>
          ))}
        </div>
        <section className="broker3118-panel">
          <h2>Broker operations overview</h2>
          <p>Contract vizual Company 3150: sidebar 224 px, portocaliu activ, iconuri și collapse. Nicio tranzacție demonstrativă.</p>
          <div className="broker3118-actions"><Link className="primary" href="/broker">Deschide Broker autentificat</Link></div>
        </section>
      </div>
    </Broker3118Shell>
  </div>;
}

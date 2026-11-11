import { useEffect, useRef, useState } from 'react';

type Props = { recipient: string; onSave: (file: File) => void; onClear: () => void; saved: boolean };
export default function DeliverySignature({ recipient, onSave, onClear, saved }: Props) {
  const [open, setOpen] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => { if (open) { const c = canvas.current; if (c) { const context = c.getContext('2d'); if (context) { context.fillStyle = '#fff'; context.fillRect(0, 0, c.width, c.height); } } } }, [open]);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => { const rect = e.currentTarget.getBoundingClientRect(); return { x: (e.clientX - rect.left) * e.currentTarget.width / rect.width, y: (e.clientY - rect.top) * e.currentTarget.height / rect.height }; };
  const begin = (e: React.PointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); const c = e.currentTarget.getContext('2d'); if (!c) return; const p = point(e); c.strokeStyle = '#172b46'; c.lineWidth = 3.5; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + .1, p.y + .1); c.stroke(); drawing.current = true; setDrawn(true); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const c = e.currentTarget.getContext('2d'); const p = point(e); c?.lineTo(p.x, p.y); c?.stroke(); };
  const clear = () => { const c = canvas.current; const ctx = c?.getContext('2d'); if (ctx && c) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); } setDrawn(false); onClear(); };
  const save = () => { if (!drawn || !canvas.current) return; canvas.current.toBlob(blob => { if (!blob) return; onSave(new File([blob], 'recipient-signature.png', { type: 'image/png' })); setOpen(false); }, 'image/png'); };
  return <>
    <button type="button" className="delivery-signature-card" onClick={() => { setDrawn(false); setOpen(true); }} aria-label="Open recipient signature screen">
      <span className="delivery-signature-icon">SIGN</span><span><strong>{saved ? 'Recipient signature saved' : 'Recipient signature'}</strong><small>{saved ? 'Tap to sign again' : 'Tap here to open the signature screen'}</small></span><span aria-hidden="true">Open</span>
    </button>
    {open && <div className="delivery-signature-overlay" role="dialog" aria-modal="true" aria-label="Recipient signature">
      <div className="delivery-signature-dialog"><header><h2>Recipient signature</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close signature screen">Close</button></header>
      <p>Ask {recipient.trim() || 'the recipient'} to sign in the box below.</p>
      <canvas ref={canvas} width={900} height={390} aria-label="Draw recipient signature here" onPointerDown={begin} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
      <div className="delivery-signature-actions"><button type="button" onClick={clear}>Clear</button><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="signature-save" disabled={!drawn} onClick={save}>Save signature</button></div>
      </div></div>}
  </>;
}

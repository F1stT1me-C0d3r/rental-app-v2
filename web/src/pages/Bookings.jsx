import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Bookings() {
  const [rows, setRows] = useState([]);
  const [reveal, setReveal] = useState(null);
  const [msg, setMsg] = useState('');
  const load = () => api('/bookings').then(setRows);
  useEffect(() => { load(); }, []);

  const cancel = (id) => api(`/bookings/${id}/status`, { method: 'PATCH', body: { status: 'CANCELED' } }).then(load).catch((e) => setMsg(e.message));
  const getCode = async (id) => {
    try { setReveal(await api(`/bookings/${id}/reveal-code`, { method: 'POST' })); load(); }
    catch (e) { setMsg(`${e.message}${e.data?.officePhone ? ` Call the office: ${e.data.officePhone}` : ''}`); }
  };

  return (
    <>
      <h1>My bookings</h1>
      {msg && <p className="msg">{msg}</p>}
      {rows.length === 0 && <p className="muted">No bookings yet.</p>}
      <div className="stack">
        {rows.map((b) => (
          <div className="card row" key={b.id}>
            <div>
              <h3>{b.vehicle.year} {b.vehicle.make} {b.vehicle.model}</h3>
              <p className="muted">{fmtDate(b.startAt)} → {fmtDate(b.endAt)} · ${b.totalAmount} · {b.paid ? 'paid' : 'unpaid'}</p>
              <span className={`pill ${b.status.toLowerCase()}`}>{b.status}</span>
            </div>
            <div className="actions">
              {b.canReveal && <button className="primary" onClick={() => getCode(b.id)}>Get lockbox code</button>}
              {['PENDING', 'CONFIRMED'].includes(b.status) && <button className="ghost" onClick={() => cancel(b.id)}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
      {reveal && (
        <Modal title={`Lockbox ${reveal.lockboxNumber} — ${reveal.vehicle}`} onClose={() => setReveal(null)}>
          {reveal.location && <p>Parked: {reveal.location}</p>}
          <p className="muted">Plate {reveal.plate}</p>
          <div className="code">{reveal.code}</div>
          <button onClick={() => navigator.clipboard?.writeText(reveal.code)}>Copy code</button>
          <p className="muted">Return by {fmtDate(reveal.returnBy)}.{reveal.officePhone ? ` Problems? Call ${reveal.officePhone}.` : ''}</p>
        </Modal>
      )}
    </>
  );
}

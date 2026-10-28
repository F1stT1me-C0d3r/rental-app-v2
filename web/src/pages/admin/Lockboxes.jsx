import { useEffect, useState } from 'react';
import { api, fmtDate } from '../../api.js';
import Modal from '../../components/Modal.jsx';

export default function Lockboxes() {
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState({});
  const [msg, setMsg] = useState('');
  const load = () => Promise.all([api('/lockboxes').then(setRows), api('/vehicles?all=1').then(setVehicles)]);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try { await api('/lockboxes', { method: 'POST', body: f }); setAdding(false); setMsg(`Lockbox ${f.number} added`); load(); }
    catch (ex) { setMsg(ex.message); }
  };
  const rotate = async (box) => {
    const code = prompt(`New code for lockbox ${box.number}:`);
    if (!code) return;
    try { await api(`/lockboxes/${box.number}`, { method: 'PATCH', body: { code } }); setMsg(`Lockbox ${box.number} code rotated`); load(); }
    catch (ex) { setMsg(ex.message); }
  };
  const assign = (box, vehicleId) => api(`/lockboxes/${box.number}`, { method: 'PATCH', body: { vehicleId } }).then(load).catch((e) => setMsg(e.message));
  const remove = (box) => { if (confirm(`Delete lockbox ${box.number}?`)) api(`/lockboxes/${box.number}`, { method: 'DELETE' }).then(load).catch((e) => setMsg(e.message)); };

  return (
    <>
      <div className="row"><h1>Lockboxes</h1><button className="primary" onClick={() => setAdding(true)}>Add lockbox</button></div>
      {msg && <p className="msg">{msg}</p>}
      <table>
        <thead><tr><th>#</th><th>Vehicle</th><th>Location</th><th>Code</th><th>Last changed</th><th></th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.number} className={b.needsRotation ? 'warn' : ''}>
              <td><b>{b.number}</b></td>
              <td>
                <select value={b.vehicleId ?? ''} onChange={(e) => assign(b, e.target.value || null)}>
                  <option value="">— unassigned —</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.plate})</option>)}
                </select>
              </td>
              <td>{b.location ?? <span className="muted">—</span>}</td>
              <td>
                {shown[b.number] ? <code className="codeinline">{b.code}</code> : <button className="ghost" onClick={() => setShown({ ...shown, [b.number]: true })}>Show</button>}
                {b.needsRotation && <span className="pill maintenance" title="Code not rotated since last completed rental">rotate</span>}
              </td>
              <td className="muted">{fmtDate(b.updatedAt)}{b.updatedBy ? ` · ${b.updatedBy.name}` : ''}</td>
              <td className="actions"><button onClick={() => rotate(b)}>Rotate code</button><button className="ghost" onClick={() => remove(b)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding && (
        <Modal title="Add lockbox" onClose={() => setAdding(false)}>
          <form onSubmit={add} className="stack">
            <label>Lockbox number<input name="number" type="number" min="1" required /></label>
            <label>Code<input name="code" minLength={3} maxLength={12} required /></label>
            <label>Location<input name="location" placeholder="Spot B4, north lot" /></label>
            <label>Assign to vehicle<select name="vehicleId" defaultValue=""><option value="">— none yet —</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.plate})</option>)}</select></label>
            <button className="primary">Add lockbox</button>
          </form>
        </Modal>
      )}
    </>
  );
}

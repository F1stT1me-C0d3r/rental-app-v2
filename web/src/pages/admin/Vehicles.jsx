import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import Modal from '../../components/Modal.jsx';

const empty = { make: '', model: '', year: new Date().getFullYear(), vin: '', plate: '', color: '', seats: 5, transmission: 'Automatic', odometer: 0, dailyRate: '', deposit: '', photoUrl: '', status: 'AVAILABLE', lockboxNumber: '' };

export default function Vehicles() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | vehicle
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const load = () => api('/vehicles?all=1').then(setRows);
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (f.lockboxNumber === '') f.lockboxNumber = null;
    try {
      if (editing === 'new') await api('/vehicles', { method: 'POST', body: f });
      else await api(`/vehicles/${editing.id}`, { method: 'PATCH', body: f });
      setMsg(editing === 'new' ? 'Vehicle added' : 'Vehicle updated'); setEditing(null); load();
    } catch (ex) { setMsg(ex.message); }
  };

  const importCsv = async (e) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file) return;
    try {
      const r = await api('/vehicles/import', { method: 'POST', raw: await file.text() });
      setMsg(`Imported ${r.added}. ${r.skipped.length ? 'Skipped: ' + r.skipped.map((s) => `${s.vin} (${s.reason})`).join('; ') : ''}`);
      setImporting(false); load();
    } catch (ex) { setMsg(ex.message); }
  };

  const retire = (v) => api(`/vehicles/${v.id}`, { method: 'PATCH', body: { status: 'RETIRED' } }).then(load).catch((e) => setMsg(e.message));
  const v = editing === 'new' ? empty : editing ? { ...editing, lockboxNumber: editing.lockbox?.number ?? '' } : null;

  return (
    <>
      <div className="row"><h1>Vehicles</h1><div className="actions"><button className="ghost" onClick={() => setImporting(true)}>Import CSV</button><button className="primary" onClick={() => setEditing('new')}>Add vehicle</button></div></div>
      {msg && <p className="msg">{msg}</p>}
      <table>
        <thead><tr><th>Vehicle</th><th>Plate</th><th>Rate</th><th>Lockbox</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.year} {r.make} {r.model}{r.color ? ` · ${r.color}` : ''}</td>
              <td>{r.plate}</td>
              <td>${r.dailyRate}/day</td>
              <td>{r.lockbox ? `#${r.lockbox.number}` : <span className="muted">none</span>}</td>
              <td><span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span></td>
              <td className="actions"><button className="ghost" onClick={() => setEditing(r)}>Edit</button>{r.status !== 'RETIRED' && <button className="ghost" onClick={() => retire(r)}>Retire</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {v && (
        <Modal title={editing === 'new' ? 'Add vehicle' : `Edit ${v.make} ${v.model}`} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="grid form">
            <label>Make<input name="make" defaultValue={v.make} required /></label>
            <label>Model<input name="model" defaultValue={v.model} required /></label>
            <label>Year<input name="year" type="number" defaultValue={v.year} required /></label>
            <label>VIN<input name="vin" defaultValue={v.vin} minLength={17} maxLength={17} required /></label>
            <label>Plate<input name="plate" defaultValue={v.plate} required /></label>
            <label>Color<input name="color" defaultValue={v.color ?? ''} /></label>
            <label>Seats<input name="seats" type="number" defaultValue={v.seats} /></label>
            <label>Transmission<select name="transmission" defaultValue={v.transmission}><option>Automatic</option><option>Manual</option></select></label>
            <label>Odometer<input name="odometer" type="number" defaultValue={v.odometer} /></label>
            <label>Daily rate $<input name="dailyRate" type="number" step="0.01" defaultValue={v.dailyRate} required /></label>
            <label>Deposit $<input name="deposit" type="number" step="0.01" defaultValue={v.deposit} required /></label>
            <label>Status<select name="status" defaultValue={v.status}><option>AVAILABLE</option><option>RENTED</option><option>MAINTENANCE</option><option>RETIRED</option></select></label>
            <label>Photo URL<input name="photoUrl" defaultValue={v.photoUrl ?? ''} placeholder="https://…" /></label>
            <label>Lockbox number<input name="lockboxNumber" type="number" defaultValue={v.lockboxNumber} placeholder="Add on Lockboxes page first" /></label>
            <button className="primary span">{editing === 'new' ? 'Add vehicle' : 'Save changes'}</button>
          </form>
        </Modal>
      )}
      {importing && (
        <Modal title="Import vehicles from CSV" onClose={() => setImporting(false)}>
          <p className="muted">Header: <code>make,model,year,vin,plate,dailyRate,deposit,seats,lockboxNumber,lockboxCode</code>. Sample file: <code>api/scripts/vehicles.sample.csv</code>.</p>
          <form onSubmit={importCsv} className="stack"><input name="file" type="file" accept=".csv,text/csv" required /><button className="primary">Import</button></form>
        </Modal>
      )}
    </>
  );
}

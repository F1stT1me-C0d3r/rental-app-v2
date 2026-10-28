import { useEffect, useState } from 'react';
import { api, fmtDate } from '../../api.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState([]);
  const [msg, setMsg] = useState('');
  const load = () => Promise.all([
    api('/admin/dashboard').then(setStats),
    api('/bookings').then(setBookings),
    api('/support/tickets').then(setTickets),
    api('/admin/settings').then(setSettings),
  ]);
  useEffect(() => { load(); }, []);

  const set = (id, body) => api(`/bookings/${id}/status`, { method: 'PATCH', body }).then(load).catch((e) => setMsg(e.message));
  const windowHours = settings.find((s) => s.key === 'pickup.windowHours')?.value ?? '1';
  const saveWindow = (e) => { e.preventDefault(); api('/admin/settings/pickup.windowHours', { method: 'PUT', body: { value: new FormData(e.target).get('value') } }).then(load); };

  return (
    <>
      <h1>Dashboard</h1>
      {msg && <p className="msg">{msg}</p>}
      {stats && (
        <div className="grid stats">
          <Tile n={stats.pickupsToday} label="Pickups today" />
          <Tile n={stats.returnsToday} label="Returns due" />
          <Tile n={stats.pendingApproval} label="Pending approval" />
          <Tile n={stats.openTickets} label="Open tickets" />
          <Tile n={stats.boxesToRotate} label="Boxes to rotate" warn={stats.boxesToRotate > 0} />
        </div>
      )}

      <h2>Bookings</h2>
      <table>
        <thead><tr><th>Customer</th><th>Vehicle</th><th>Pickup</th><th>Return</th><th>Paid</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.user.name || b.user.email}</td>
              <td>{b.vehicle.year} {b.vehicle.make} {b.vehicle.model}</td>
              <td>{fmtDate(b.startAt)}</td>
              <td>{fmtDate(b.endAt)}</td>
              <td><input type="checkbox" checked={b.paid} onChange={(e) => set(b.id, { paid: e.target.checked })} /></td>
              <td><span className={`pill ${b.status.toLowerCase()}`}>{b.status}</span></td>
              <td className="actions">
                {b.status === 'PENDING' && <button onClick={() => set(b.id, { status: 'CONFIRMED' })}>Confirm</button>}
                {b.status === 'ACTIVE' && <button onClick={() => set(b.id, { status: 'COMPLETED' })}>Complete</button>}
                {['PENDING', 'CONFIRMED', 'ACTIVE'].includes(b.status) && <button className="ghost" onClick={() => set(b.id, { status: 'CANCELED' })}>Cancel</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Open tickets</h2>
      {tickets.length === 0 ? <p className="muted">None.</p> : (
        <table>
          <thead><tr><th>From</th><th>Subject</th><th>Message</th><th></th></tr></thead>
          <tbody>{tickets.map((t) => (
            <tr key={t.id}><td>{t.email}</td><td>{t.subject}</td><td>{t.body}</td>
              <td><button className="ghost" onClick={() => api(`/support/tickets/${t.id}`, { method: 'PATCH', body: { status: 'RESOLVED' } }).then(load)}>Resolve</button></td></tr>
          ))}</tbody>
        </table>
      )}

      <h2>Settings</h2>
      <form onSubmit={saveWindow} className="inline">
        <label>Lockbox code available <input name="value" type="number" min="0" step="0.5" defaultValue={windowHours} key={windowHours} style={{ width: 80 }} /> hours before pickup</label>
        <button>Save</button>
      </form>
    </>
  );
}

function Tile({ n, label, warn }) {
  return <div className={`card tile ${warn ? 'warn' : ''}`}><b>{n}</b><span>{label}</span></div>;
}

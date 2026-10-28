import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

export default function Fleet({ user }) {
  const [vehicles, setVehicles] = useState([]);
  const [booking, setBooking] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/vehicles').then(setVehicles); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    try {
      const b = await api('/bookings', { method: 'POST', body: { vehicleId: booking.id, startAt: f.startAt, endAt: f.endAt } });
      setMsg(`Booked ${booking.year} ${booking.make} ${booking.model} — total $${b.totalAmount}, status ${b.status}. An admin will confirm it.`);
      setBooking(null);
    } catch (ex) { setMsg(ex.message); }
  };

  return (
    <>
      <h1>Available vehicles</h1>
      {msg && <p className="msg">{msg}</p>}
      <div className="grid">
        {vehicles.map((v) => (
          <div className="card" key={v.id}>
            {v.photoUrl ? <img src={v.photoUrl} alt="" /> : <div className="placeholder">{v.make}</div>}
            <h3>{v.year} {v.make} {v.model}</h3>
            <p className="muted">{v.seats} seats · {v.transmission}{v.color ? ` · ${v.color}` : ''}</p>
            <p><strong>${v.dailyRate.toFixed(0)}/day</strong> · ${v.deposit.toFixed(0)} deposit</p>
            {user ? <button onClick={() => setBooking(v)}>Book</button> : <Link to="/login">Log in to book</Link>}
          </div>
        ))}
      </div>
      {booking && (
        <Modal title={`Book ${booking.year} ${booking.make} ${booking.model}`} onClose={() => setBooking(null)}>
          <form onSubmit={submit} className="stack">
            <label>Pickup<input name="startAt" type="datetime-local" required /></label>
            <label>Return<input name="endAt" type="datetime-local" required /></label>
            <button>Request booking</button>
          </form>
        </Modal>
      )}
    </>
  );
}

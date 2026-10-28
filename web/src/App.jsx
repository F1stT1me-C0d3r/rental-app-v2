import { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, NavLink } from 'react-router-dom';
import { api, setToken, getToken } from './api.js';
import Fleet from './pages/Fleet.jsx';
import Login from './pages/Login.jsx';
import Bookings from './pages/Bookings.jsx';
import Support from './pages/Support.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Vehicles from './pages/admin/Vehicles.jsx';
import Lockboxes from './pages/admin/Lockboxes.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  if (loading) return <p className="pad">Loading…</p>;
  const isAdmin = user?.role === 'ADMIN';
  const logout = () => { setToken(null); setUser(null); };

  return (
    <>
      <nav>
        <NavLink to="/">Fleet</NavLink>
        {user && <NavLink to="/bookings">My bookings</NavLink>}
        {isAdmin && <NavLink to="/admin">Dashboard</NavLink>}
        {isAdmin && <NavLink to="/admin/vehicles">Vehicles</NavLink>}
        {isAdmin && <NavLink to="/admin/lockboxes">Lockboxes</NavLink>}
        <NavLink to="/support">Support</NavLink>
        <span className="spacer" />
        {user ? <button className="ghost" onClick={logout}>Log out · {user.name || user.email}</button> : <Link to="/login">Log in</Link>}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Fleet user={user} />} />
          <Route path="/login" element={<Login onLogin={setUser} />} />
          <Route path="/bookings" element={user ? <Bookings /> : <Navigate to="/login" />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin" element={isAdmin ? <Dashboard /> : <Navigate to="/" />} />
          <Route path="/admin/vehicles" element={isAdmin ? <Vehicles /> : <Navigate to="/" />} />
          <Route path="/admin/lockboxes" element={isAdmin ? <Lockboxes /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </>
  );
}

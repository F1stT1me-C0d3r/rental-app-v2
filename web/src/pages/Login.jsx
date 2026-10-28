import { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { token, user } = await api(`/auth/${mode}`, { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      setToken(token); onLogin(user); location.href = user.role === 'ADMIN' ? '/admin' : '/';
    } catch (ex) { setErr(ex.message); }
  };
  return (
    <form onSubmit={submit} className="stack narrow">
      <h1>{mode === 'login' ? 'Log in' : 'Create account'}</h1>
      {mode === 'register' && <input name="name" placeholder="Full name" required />}
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password (8+ characters)" minLength={8} required />
      {err && <p className="err">{err}</p>}
      <button>{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account?' : 'Have an account?'}
      </button>
    </form>
  );
}

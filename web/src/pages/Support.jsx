import { useState } from 'react';
import { api } from '../api.js';

export default function Support() {
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    await api('/support/tickets', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    setDone(true);
  };
  if (done) return <p className="pad">Thanks — we'll reply by email.</p>;
  return (
    <form onSubmit={submit} className="stack narrow">
      <h1>Report a problem</h1>
      <input name="email" type="email" placeholder="Your email" required />
      <input name="subject" placeholder="Subject" required />
      <textarea name="body" rows={5} placeholder="What happened?" required />
      <button>Send</button>
    </form>
  );
}

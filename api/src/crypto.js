import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM. LOCKBOX_KEY = 32 bytes, base64. Output: base64(iv | tag | ciphertext).
function key() {
  const k = Buffer.from(process.env.LOCKBOX_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('LOCKBOX_KEY must be 32 bytes base64');
  return k;
}

export function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(blob) {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

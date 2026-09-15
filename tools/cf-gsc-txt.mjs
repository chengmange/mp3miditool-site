import { resolveTxt } from 'node:dns/promises';
import { createHash } from 'node:crypto';

const token = process.env.CF_API_TOKEN;
const verification = process.env.GSC_TXT;
if (!token || !verification) throw new Error('CF_API_TOKEN and GSC_TXT are required');

const zoneId = '44c6c755207723359d4299c23d65a9fa';
const domain = 'mp3miditool.com';
const api = 'https://api.cloudflare.com/client/v4';

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  if (!body.success) throw new Error(JSON.stringify(body.errors));
  return body.result;
}

const existing = await request(`/zones/${zoneId}/dns_records?type=TXT&name=${domain}`);
let action = 'already-present';
if (!existing.some((record) => record.content === verification)) {
  await request(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'TXT',
      name: domain,
      content: verification,
      ttl: 1,
    }),
  });
  action = 'added';
}

let publicDnsVisible = false;
try {
  const answers = (await resolveTxt(domain)).map((parts) => parts.join(''));
  publicDnsVisible = answers.includes(verification);
} catch {
  publicDnsVisible = false;
}

let googleDnsVisible = false;
try {
  const response = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
  const body = await response.json();
  googleDnsVisible = (body.Answer || []).some((answer) =>
    String(answer.data || '').replace(/^"|"$/g, '') === verification,
  );
} catch {
  googleDnsVisible = false;
}

console.log(JSON.stringify({
  action,
  name: domain,
  type: 'TXT',
  valueSha256: createHash('sha256').update(verification).digest('hex'),
  publicDnsVisible,
  googleDnsVisible,
}));

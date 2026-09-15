const token = process.env.CF_API_TOKEN;
if (!token) throw new Error('CF_API_TOKEN is missing');
const zoneId = '44c6c755207723359d4299c23d65a9fa';
const accountId = 'be23884fc319167886a0b68cfead25da';
const api = 'https://api.cloudflare.com/client/v4';
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  return { status: response.status, body };
}
const zone = await request(`/zones/${zoneId}`);
const dnssec = await request(`/zones/${zoneId}/dnssec`);
const existing = await request(`/zones/${zoneId}/dns_records?name=_index._agents.mp3miditool.com&type=SVCB`);
const existingHttps = await request(`/zones/${zoneId}/dns_records?name=_index._agents.mp3miditool.com&type=HTTPS`);
const before = {
  zone: { status: zone.status, success: zone.body.success, name: zone.body.result?.name },
  dnssec: { status: dnssec.status, success: dnssec.body.success, result: dnssec.body.result, errors: dnssec.body.errors },
  existingSvcb: { status: existing.status, success: existing.body.success, records: existing.body.result?.map(({ id, type, name, content, ttl, proxied }) => ({ id, type, name, content, ttl, proxied })), errors: existing.body.errors },
  existingHttps: { status: existingHttps.status, success: existingHttps.body.success, records: existingHttps.body.result?.map(({ id, type, name, content, ttl, proxied }) => ({ id, type, name, content, ttl, proxied })), errors: existingHttps.body.errors },
};

const changes = [];
const recordName = '_index._agents.mp3miditool.com';
const recordContent = '1 mp3miditool.com. alpn="h2" port=443 key65409="/ai/index.ilang"';

if (existing.body.success && Array.isArray(existing.body.result) && existing.body.result.length === 0) {
  let created = await request(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({ type: 'SVCB', name: recordName, content: recordContent, ttl: 300 }),
  });
  if (!created.body.success) {
    created = await request(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'SVCB',
        name: recordName,
        data: { priority: 1, target: 'mp3miditool.com.', value: 'alpn="h2" port=443 key65409="/ai/index.ilang"' },
        ttl: 300,
      }),
    });
  }
  changes.push({ action: 'create_svcb', status: created.status, success: created.body.success, result: created.body.result && { id: created.body.result.id, type: created.body.result.type, name: created.body.result.name, content: created.body.result.content, data: created.body.result.data, ttl: created.body.result.ttl }, errors: created.body.errors });
}

if (dnssec.body.success && dnssec.body.result?.status === 'disabled') {
  const enabled = await request(`/zones/${zoneId}/dnssec`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
  changes.push({ action: 'enable_dnssec', status: enabled.status, success: enabled.body.success, result: enabled.body.result, errors: enabled.body.errors });
}

const afterDnssec = await request(`/zones/${zoneId}/dnssec`);
const afterSvcb = await request(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(recordName)}&type=SVCB`);
console.log(JSON.stringify({
  before,
  changes,
  after: {
    dnssec: { status: afterDnssec.status, success: afterDnssec.body.success, result: afterDnssec.body.result, errors: afterDnssec.body.errors },
    svcb: { status: afterSvcb.status, success: afterSvcb.body.success, records: afterSvcb.body.result?.map(({ id, type, name, content, data, ttl, proxied }) => ({ id, type, name, content, data, ttl, proxied })), errors: afterSvcb.body.errors },
  },
}, null, 2));

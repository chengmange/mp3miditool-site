const token = process.env.CF_API_TOKEN;
if (!token) throw new Error('CF_API_TOKEN is missing');

const accountId = 'be23884fc319167886a0b68cfead25da';
const zoneId = '44c6c755207723359d4299c23d65a9fa';
const project = 'mp3miditool';
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
  return { response, body };
}

const dnsBefore = await request(`/zones/${zoneId}/dns_records?name=${domain}`);
if (!dnsBefore.body.success) throw new Error(JSON.stringify(dnsBefore.body.errors));

const domainsBefore = await request(`/accounts/${accountId}/pages/projects/${project}/domains`);
if (!domainsBefore.body.success) throw new Error(JSON.stringify(domainsBefore.body.errors));

let domainAction = 'already-present';
if (!domainsBefore.body.result.some((item) => item.name === domain)) {
  const added = await request(`/accounts/${accountId}/pages/projects/${project}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  if (!added.body.success) throw new Error(JSON.stringify(added.body.errors));
  domainAction = 'added';
}

let dnsAction = 'already-present';
if (dnsBefore.body.result.length === 0) {
  const created = await request(`/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'CNAME',
      name: domain,
      content: `${project}.pages.dev`,
      ttl: 1,
      proxied: true,
    }),
  });
  if (!created.body.success) throw new Error(JSON.stringify(created.body.errors));
  dnsAction = 'added';
}

const httpsSetting = await request(`/zones/${zoneId}/settings/always_use_https`, {
  method: 'PATCH',
  body: JSON.stringify({ value: 'on' }),
});

const [domainsAfter, dnsAfter] = await Promise.all([
  request(`/accounts/${accountId}/pages/projects/${project}/domains`),
  request(`/zones/${zoneId}/dns_records?name=${domain}`),
]);

console.log(JSON.stringify({
  dnsBefore: dnsBefore.body.result.map(({ type, name, content, proxied }) => ({ type, name, content, proxied })),
  domainAction,
  dnsAction,
  domains: domainsAfter.body.result.map(({ name, status, verification_data }) => ({
    name,
    status,
    hasVerificationData: Boolean(verification_data),
  })),
  dnsAfter: dnsAfter.body.result.map(({ type, name, content, proxied }) => ({ type, name, content, proxied })),
  alwaysUseHttps: httpsSetting.body.success ? httpsSetting.body.result?.value : 'permission-denied',
  httpsErrors: httpsSetting.body.success ? [] : httpsSetting.body.errors,
}));

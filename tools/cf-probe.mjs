const token = process.env.CF_API_TOKEN;
if (!token) throw new Error('CF_API_TOKEN is missing');

async function request(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(JSON.stringify({ status: response.status, errors: body.errors }));
  }
  return body.result;
}

const verification = await request('/user/tokens/verify');
const accounts = await request('/accounts?per_page=50');
const zones = await request('/zones?name=mp3miditool.com&per_page=10');
const accountId = zones[0]?.account?.id;
let pagesAccess = null;
let workersAccess = null;
if (accountId) {
  const pagesResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/mp3miditool`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pagesBody = await pagesResponse.json();
  pagesAccess = {
    httpStatus: pagesResponse.status,
    success: pagesBody.success,
    projectExists: pagesResponse.status === 200,
    errors: pagesBody.errors,
  };
  const workersResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const workersBody = await workersResponse.json();
  workersAccess = {
    httpStatus: workersResponse.status,
    success: workersBody.success,
    errors: workersBody.errors,
  };
}

console.log(JSON.stringify({
  tokenStatus: verification.status,
  accounts: accounts.map(({ id, name }) => ({ id, name })),
  zones: zones.map(({ id, name, status, account }) => ({ id, name, status, account })),
  pagesAccess,
  workersAccess,
}));

const token = process.env.CF_API_TOKEN;
if (!token) throw new Error('CF_API_TOKEN is missing');
const url = 'https://api.cloudflare.com/client/v4/accounts/be23884fc319167886a0b68cfead25da/pages/projects/mp3miditool/domains/mp3miditool.com';
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await response.json();
console.log(JSON.stringify({ httpStatus: response.status, success: body.success, result: body.result, errors: body.errors }));

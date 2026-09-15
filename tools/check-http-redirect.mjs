const response = await fetch('http://mp3miditool.com/', { redirect: 'manual' });
console.log(JSON.stringify({
  status: response.status,
  location: response.headers.get('location'),
}));

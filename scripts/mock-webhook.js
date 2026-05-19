const payload = {
  action: 'closed',
  pull_request: {
    number: 42,
    merged: true,
    labels: [{ name: 'wave-contribution' }],
  },
};

fetch('http://localhost:3000/github-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})
  .then(res => res.json())
  .then(data => console.log('[mock-webhook] Response:', data))
  .catch(err => console.error('[mock-webhook] Error:', err.message));

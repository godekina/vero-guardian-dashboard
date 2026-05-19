const express = require('express');
const { registerTaskOnChain } = require('./stellar');

const app = express();
app.use(express.json());

app.post('/github-webhook', async (req, res) => {
  const { action, pull_request } = req.body;

  if (action !== 'closed' || !pull_request?.merged) {
    return res.status(200).json({ skipped: true });
  }

  const hasLabel = pull_request.labels?.some(l => l.name === 'wave-contribution');
  if (!hasLabel) {
    return res.status(200).json({ skipped: true, reason: 'no wave-contribution label' });
  }

  const prNumber = pull_request.number;
  console.log(`[webhook] Merged PR #${prNumber} with wave-contribution — registering on chain`);

  try {
    const result = await registerTaskOnChain(prNumber);
    res.status(200).json({ registered: true, prNumber, result });
  } catch (err) {
    console.error('[webhook] Chain registration failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[relayer] Listening on port ${PORT}`));

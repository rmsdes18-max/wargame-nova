const { Router } = require('express');
const { requireAuth, guildContext, requireGuildRole } = require('../middleware/guildContext');
const router = Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// POST /api/ocr — proxy Anthropic API call (editor+)
router.post('/', requireAuth, guildContext, requireGuildRole('editor'), async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'OCR not configured — contact admin' });
  }

  const { prompt, image_base64, image_mime } = req.body;
  if (!prompt || !image_base64) {
    return res.status(400).json({ error: 'prompt and image_base64 required' });
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image_mime || 'image/jpeg', data: image_base64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: 'Anthropic API error: ' + err });
    }

    const data = await resp.json();
    res.json({ text: data.content[0].text, usage: data.usage });
  } catch (e) {
    res.status(500).json({ error: 'OCR failed: ' + e.message });
  }
});

module.exports = router;

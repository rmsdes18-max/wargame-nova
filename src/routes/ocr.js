var { Router } = require('express');
var { requireAuth, guildContext, requireGuildRole } = require('../middleware/guildContext');
var { logTokenUsage } = require('../services/tokenLog');
var router = Router();

var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* ── System prompt for OCR tasks (cached via prompt caching) ── */
var SYSTEM_PROMPT = 'You are an OCR assistant for a gaming guild management app (Throne & Liberty). '
  + 'You analyze screenshots of party compositions and war scoreboards. '
  + 'Extract data accurately, preserving special Unicode characters in player names. '
  + 'Return ONLY valid JSON, no explanations or preamble.';

// POST /api/ocr — proxy Anthropic API call (editor+)
router.post('/', requireAuth, guildContext, requireGuildRole('editor'), async function(req, res) {
  if (!ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'OCR not configured — contact admin' });
  }

  var { prompt, image_base64, image_mime } = req.body;
  if (!prompt || !image_base64) {
    return res.status(400).json({ error: 'prompt and image_base64 required' });
  }

  console.log('[OCR] Request received, image size:', Math.round((image_base64 || '').length / 1024) + 'kb');

  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
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
      var err = await resp.text();
      console.error('[OCR] Anthropic error:', resp.status, err.substring(0, 300));
      return res.status(resp.status).json({ error: 'Anthropic API error ' + resp.status + ': ' + err.substring(0, 200) });
    }

    var data = await resp.json();
    var usage = data.usage || {};
    console.log('[OCR] Success, tokens:', usage);

    // Log token usage to database
    logTokenUsage({
      guild_id: req.guild ? req.guild.id : null,
      user_id: req.user ? req.user.id : null,
      model: 'claude-sonnet-4-6',
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_read_input_tokens: usage.cache_read_input_tokens || 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
      endpoint: 'ocr'
    });

    res.json({ text: data.content[0].text, usage: usage });
  } catch (e) {
    res.status(500).json({ error: 'OCR failed: ' + e.message });
  }
});

module.exports = router;

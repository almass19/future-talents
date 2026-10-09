const ROLE_LABELS = {
  student: 'Student',
  expert: 'Expert',
  partner: 'Partner',
};

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (!body || typeof body !== 'object') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      body = {};
    }
  }

  // Honeypot: real visitors never fill this hidden field.
  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  const role = clip(body.role, 20);
  const contactName = clip(body.contactName, 120);
  const contact = clip(body.contact, 200);
  const companyName = clip(body.companyName, 160);
  const lang = clip(body.lang, 10);
  const page = clip(body.page, 300);

  if (!ROLE_LABELS[role]) {
    return res.status(400).json({ ok: false, error: 'invalid_role' });
  }
  if (contactName.length < 2) {
    return res.status(400).json({ ok: false, error: 'invalid_name' });
  }
  if (contact.length < 3) {
    return res.status(400).json({ ok: false, error: 'invalid_contact' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('apply: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return res.status(500).json({ ok: false, error: 'server_not_configured' });
  }

  const lines = [`🆕 New application — ${ROLE_LABELS[role]}`, ''];
  if (role === 'partner' && companyName) lines.push(`Company: ${companyName}`);
  lines.push(`Name: ${contactName}`);
  lines.push(`Contact: ${contact}`);
  if (lang) lines.push(`Language: ${lang}`);
  if (page) lines.push(`Page: ${page}`);

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
    });
    const tgData = await tgRes.json();
    if (!tgData.ok) {
      console.error('apply: telegram error', tgData);
      return res.status(502).json({ ok: false, error: 'telegram_failed' });
    }
  } catch (err) {
    console.error('apply: telegram request failed', err);
    return res.status(502).json({ ok: false, error: 'telegram_unreachable' });
  }

  return res.status(200).json({ ok: true });
};

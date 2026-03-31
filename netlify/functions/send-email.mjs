// Generic email sender via Resend
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.EMAIL_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { to, subject, body, html } = await req.json();
    if (!to || !subject || (!body && !html)) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_KEY) {
      return new Response(JSON.stringify({ error: 'Email not configured' }), { status: 500 });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: 'Kerehama Labs <chat@kerehama.nz>',
        to: [to],
        subject,
        ...(html ? { html } : { text: body }),
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send' }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send error:', err);
    return new Response(JSON.stringify({ error: 'Failed to send' }), { status: 500 });
  }
};

// Creates a chat room + sends the client their unique link via email (Resend)
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { name, email } = await req.json();

  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlufiwgnnnfwdjoafcu.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY1 || process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 });
  }

  // Create the chat in Supabase
  const chatRes = await fetch(`${SUPABASE_URL}/rest/v1/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ client_name: name, client_email: email })
  });

  if (!chatRes.ok) {
    const err = await chatRes.text();
    console.error('Supabase error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create chat' }), { status: 500 });
  }

  const [chat] = await chatRes.json();
  const chatLink = `https://labs.kerehama.nz/chat/${chat.id}`;

  // Send welcome email via Resend
  try {
    const RESEND_KEY = process.env.RESEND_API_KEY;
    if (RESEND_KEY) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: 'Kerehama Labs <chat@kerehama.nz>',
          to: [email],
          subject: 'Your chat with Kerehama',
          html: `
            <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; background: #0D0E10; color: #fff; border-radius: 12px;">
              <h2 style="margin: 0 0 0.5rem; font-size: 1.3rem;">Hey ${name}! 👋</h2>
              <p style="color: #A9ACAF; line-height: 1.6; margin: 0 0 1.5rem;">Your chat room is ready. Use the link below to come back anytime — your messages will be waiting.</p>
              <a href="${chatLink}" style="display: inline-block; padding: 12px 28px; background: #06b6d4; color: #050505; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 0.95rem;">Open Chat →</a>
              <p style="color: #666; font-size: 13px; margin-top: 1.5rem;">Or copy this link: <a href="${chatLink}" style="color: #06b6d4;">${chatLink}</a></p>
              <hr style="border: none; border-top: 1px solid #222; margin: 1.5rem 0;">
              <p style="color: #666; font-size: 12px; margin: 0;">Kerehama Andrews · <a href="https://kerehama.nz" style="color: #06b6d4;">kerehama.nz</a></p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        console.warn('Resend error:', await emailRes.text());
      }
    } else {
      console.warn('RESEND_API_KEY not set — skipping email');
    }
  } catch (emailErr) {
    console.warn('Email send error:', emailErr.message);
  }

  return new Response(JSON.stringify({ id: chat.id, link: chatLink }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};

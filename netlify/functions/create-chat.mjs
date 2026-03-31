// Creates a chat room + sends the client their unique link via email
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { name, email } = await req.json();

  if (!name || !email) {
    return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ewlufiwgnnnfwdjoafcu.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

  // Send welcome email via hire.kerehama.nz send function
  try {
    const emailRes = await fetch('https://hire.kerehama.nz/.netlify/functions/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer miles-send-2026'
      },
      body: JSON.stringify({
        to: email,
        subject: `Your chat with Kerehama`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
            <h2 style="color: #06b6d4;">Hey ${name}!</h2>
            <p>Your chat room is ready. Use the link below to come back anytime:</p>
            <p style="margin: 1.5rem 0;">
              <a href="${chatLink}" style="display: inline-block; padding: 12px 28px; background: #06b6d4; color: #050505; text-decoration: none; border-radius: 8px; font-weight: 600;">
                Open Chat →
              </a>
            </p>
            <p style="color: #888; font-size: 14px;">Or copy this link: ${chatLink}</p>
            <p style="margin-top: 2rem; color: #888; font-size: 13px;">— Kerehama Andrews<br><a href="https://kerehama.nz" style="color: #06b6d4;">kerehama.nz</a></p>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      console.warn('Email send failed:', await emailRes.text());
      // Don't fail the chat creation — email is best-effort
    }
  } catch (emailErr) {
    console.warn('Email send error:', emailErr.message);
  }

  return new Response(JSON.stringify({ id: chat.id, link: chatLink }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};

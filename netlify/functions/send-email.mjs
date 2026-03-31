import { createTransport } from 'nodemailer';

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

    const transporter = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: `"Kerehama Labs" <${process.env.GMAIL_USER}>`,
      replyTo: '"Kerehama Labs" <chat@kerehama.nz>',
      to,
      subject,
      ...(html ? { html } : { text: body }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send error:', err);
    return new Response(JSON.stringify({ error: 'Failed to send' }), { status: 500 });
  }
};

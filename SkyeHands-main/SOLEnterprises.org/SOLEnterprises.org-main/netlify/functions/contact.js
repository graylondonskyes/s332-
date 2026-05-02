const nodemailer = require('nodemailer');

exports.handler = async function (event, context) {
  // Readiness check for GET (useful after deploy to confirm SMTP env vars)
  if (event.httpMethod === 'GET') {
    const ok = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, smtpConfigured: ok })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, subject, message, org, page, userAgent } = payload;
  if (!name || !email || !subject || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: name, email, subject, message' }) };
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailTo = process.env.MAIL_TO || smtpUser;
  const mailFrom = process.env.MAIL_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { statusCode: 500, body: JSON.stringify({ error: 'SMTP env vars not configured' }) };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  });

  // end of handler - duplicate/old code removed to avoid conflicting exports
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing SMTP environment variables' })
    };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  const mailOptions = {
    from: MAIL_FROM,
    to: MAIL_TO,
    subject: `[SOLE Contact] ${subject}`,
    text: `New SOLE Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}\n\nUTC Time: ${new Date().toISOString()}`
  };

  try {
    console.log('[contact] sending mail', { to: MAIL_TO, from: MAIL_FROM });
    const info = await transporter.sendMail(mailOptions);
    console.log('[contact] sendMail result', info);
    return {
      statusCode: 200,
      body: JSON.stringify({ sent: true, info })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Email send failed: ${err.message}` })
    };
  }
};

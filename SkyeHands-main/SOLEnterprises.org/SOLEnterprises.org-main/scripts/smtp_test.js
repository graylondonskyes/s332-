#!/usr/bin/env node
// Sends a single test email using SMTP env vars. Does not store secrets.
// Usage (fill in SMTP_PASS interactively or export it):
// SMTP_HOST=smtp.gmail.com SMTP_PORT=587 SMTP_USER=you@example.com SMTP_PASS=yourpass MAIL_TO=you@example.com MAIL_FROM=you@example.com node scripts/smtp_test.js

const nodemailer = require('nodemailer');

async function main(){
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailTo = process.env.MAIL_TO || smtpUser;
  const mailFrom = process.env.MAIL_FROM || smtpUser;

  if(!smtpHost || !smtpUser || !smtpPass){
    console.error('Missing SMTP env vars. Provide SMTP_HOST, SMTP_USER, SMTP_PASS.');
    process.exit(2);
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  });

  const info = {
    from: mailFrom,
    to: mailTo,
    subject: 'SOLEnterprises SMTP Test',
    text: `This is a test message sent at ${new Date().toISOString()} from ${smtpUser}`
  };

  try{
    const res = await transporter.sendMail(info);
    console.log('Message sent. Response:', res && res.response ? res.response : res);
    process.exit(0);
  }catch(err){
    console.error('Send failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();

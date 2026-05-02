// Run Netlify contact handler locally with a mock nodemailer
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'user';
process.env.SMTP_PASS = 'pass';
process.env.MAIL_TO = 'Contact@Solenterprises.org';

// Patch Module._load to return a mock nodemailer if real one isn't available
const Module = require('module');
const origLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'nodemailer') {
    return {
      createTransport: (opts) => ({
        sendMail: (mailOptions) => {
          console.log('[mock nodemailer] sendMail called');
          console.log(mailOptions);
          return Promise.resolve({ accepted: [process.env.MAIL_TO] });
        }
      })
    };
  }
  return origLoad(request, parent, isMain);
};

const handler = require('../netlify/functions/contact.js').handler;

const event = {
  httpMethod: 'POST',
  body: JSON.stringify({
    name: 'Test User',
    email: 't@example.com',
    subject: 'Test Subject',
    message: 'Hello from test'
  })
};

handler(event).then(res => {
  console.log('HANDLER RESPONSE:');
  console.log(res);
}).catch(err => {
  console.error('HANDLER ERROR:');
  console.error(err);
});

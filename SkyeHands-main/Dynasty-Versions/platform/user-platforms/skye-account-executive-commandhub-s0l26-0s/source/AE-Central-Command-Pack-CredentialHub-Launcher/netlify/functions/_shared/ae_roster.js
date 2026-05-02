
const fs = require('fs');
const path = require('path');

const rosterPath = path.resolve(__dirname, '..', '..', '..', 'Branching Apps', 'AE-Brain-Command-Site-v8-Additive', 'data', 'ae-roster.json');
const AE_ROSTER = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));

function buildAeSystemPrompt(ae, ctx = {}) {
  return `${ae.systemPrompt || ''}
Client: ${ctx.clientName || ''}
Subject: ${ctx.threadSubject || ''}`;
}

module.exports = { AE_ROSTER, buildAeSystemPrompt };

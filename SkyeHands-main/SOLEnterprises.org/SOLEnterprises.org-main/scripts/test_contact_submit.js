#!/usr/bin/env node
// Simple test script to POST a sample Business Development intake
// Usage: TARGET_URL=http://localhost:8000/api/contact node scripts/test_contact_submit.js

const fetch = require('node-fetch');

const TARGET = process.env.TARGET_URL || 'http://localhost:8000/api/contact';

async function run(){
  const payload = {
    name: 'Test Operator',
    email: 'test@example.com',
    subject: 'Test: Business Development Intake',
    message: [
      'Service: Business Development & Office Suites',
      'Organization: Test Co',
      'Contact: Test Operator',
      'Use case: Internal ops assistant',
      'Deployment: Static site',
      'Licensing intent: Internal use only',
      'Protocol requirements: Example rule set',
      'Notes: This is a server mapping test',
    ].join('\n')
  };

  console.log('POSTing to', TARGET);
  try{
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      timeout: 10000
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
    if(!res.ok) process.exitCode = 2;
  }catch(err){
    console.error('Request failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

run();

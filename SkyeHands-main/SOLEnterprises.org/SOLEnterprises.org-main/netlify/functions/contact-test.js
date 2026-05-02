// Example: POST contact form data to Netlify Function
async function sendContactForm({ name, email, subject, message }) {
  const response = await fetch('/.netlify/functions/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, subject, message })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unknown error');
  return data;
}

// Usage example (call this from your form handler):
// sendContactForm({
//   name: 'John Doe',
//   email: 'john@example.com',
//   subject: 'Test',
//   message: 'Hello from Netlify!'
// })
//   .then(data => alert('Message sent!'))
//   .catch(err => alert('Error: ' + err.message));

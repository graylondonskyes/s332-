window.addEventListener('DOMContentLoaded', async () => {
  const partialTargets = Array.from(document.querySelectorAll('[data-partial]'));
  await Promise.all(
    partialTargets.map(async (node) => {
      const url = node.getAttribute('data-partial');
      if (!url) return;
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) {
        node.innerHTML = `<pre>Failed to load partial: ${url}</pre>`;
        return;
      }
      node.innerHTML = await response.text();
    })
  );
  document.dispatchEvent(new CustomEvent('partials:ready'));
});

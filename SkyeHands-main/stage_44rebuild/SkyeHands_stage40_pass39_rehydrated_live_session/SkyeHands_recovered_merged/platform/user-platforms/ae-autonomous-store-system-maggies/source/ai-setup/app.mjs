import { loadState, saveState } from '../shared/core/browser-state.mjs';
import { bulkImportNormalizedInventory, buildOnboardingChecklist, normalizeInventoryPaste } from '../shared/core/autonomous-store-extensions.mjs';

const app = document.querySelector('#app');
let state = await loadState();
let preview = [];

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function persist() { state = saveState(state); render(); }

function render() {
  const checklist = buildOnboardingChecklist(state);
  app.innerHTML = `
    <div class="panel">
      <h1>AI Setup Lane</h1>
      <p class="muted">Paste inventory lines using <code>product name | 19.99</code>. This lane normalizes titles, recommends categories, and imports inventory into the shared merchant state.</p>
      <form id="ai-form">
        <textarea name="rawText" rows="10" placeholder="House special bundle | 24.99\nvodka reserve | 31.99\ndisposable vape cool mint | 16.50"></textarea>
        <div class="grid" style="margin-top:12px">
          <button type="submit">Preview Normalization</button>
          <button type="button" id="import-normalized">Import Normalized Items</button>
        </div>
      </form>
    </div>
    <div class="panel">
      <h2>Normalization Preview</h2>
      <div class="grid">${preview.map((row) => `<div><strong>${esc(row.title)}</strong><br><span class="muted">${esc(row.category)} · $${Number(row.price || 0).toFixed(2)}</span><p>${esc(row.description)}</p></div>`).join('') || '<p class="muted">No preview yet.</p>'}</div>
    </div>
    <div class="panel">
      <h2>Onboarding Checklist</h2>
      <div class="grid">${checklist.map((row) => `<div><strong>${esc(row.label)}</strong><br><span class="muted">${row.done ? 'Done' : 'Pending'}</span></div>`).join('')}</div>
    </div>`;

  document.querySelector('#ai-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    preview = normalizeInventoryPaste(form.get('rawText'));
    render();
  });

  document.querySelector('#import-normalized').onclick = () => {
    const textarea = document.querySelector('textarea[name="rawText"]');
    const created = bulkImportNormalizedInventory(state, textarea.value);
    preview = created;
    persist();
    alert(`${created.length} item(s) normalized into merchant inventory.`);
  };
}

render();

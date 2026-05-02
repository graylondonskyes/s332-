import { loadState, saveState, resetState } from '../shared/core/browser-state.mjs';
import { buildSystemProgress, registerMerchantAccount } from '../shared/core/autonomous-store-extensions.mjs';

const app = document.querySelector('#app');
let state = await loadState();

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function persist() { state = saveState(state); render(); }

function render() {
  const progress = buildSystemProgress(state);
  app.innerHTML = `
    <div class="panel">
      <h1>Merchant Signup Lane</h1>
      <p class="muted">This lane creates a merchant account, merchant profile, admin login, and AE assignment in the local autonomous-store system state.</p>
      <p class="muted">Current completion from checklist: ${progress.completionPercent}% · Readiness ${progress.readiness.status}</p>
      <form id="signup-form" class="grid">
        <label>Store Name<input name="storeName" required value="${esc(state.merchant?.storeName || '')}"></label>
        <label>Owner Name<input name="ownerName" required value="Store Owner"></label>
        <label>Contact Email<input name="email" type="email" required value="${esc(state.merchant?.contactEmail || 'owner@maggies.local')}"></label>
        <label>Contact Phone<input name="contactPhone" required value="${esc(state.merchant?.contactPhone || '623-000-0000')}"></label>
        <label>PIN<input name="pin" required value="2468"></label>
        <div class="grid" style="grid-column:1/-1">
          <button type="submit">Create / Replace Merchant Account</button>
          <button type="button" id="reset-seed">Reset Seed</button>
        </div>
      </form>
    </div>
    <div class="panel" style="margin-top:18px">
      <h2>Onboarding Checklist</h2>
      <div class="grid">${progress.checklist.map((row) => `<div><strong>${esc(row.label)}</strong><br><span class="muted">${row.done ? 'Done' : 'Not done yet'}</span></div>`).join('')}</div>
    </div>`;

  document.querySelector('#signup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      registerMerchantAccount(state, {
        storeName: form.get('storeName'),
        ownerName: form.get('ownerName'),
        email: form.get('email'),
        contactPhone: form.get('contactPhone'),
        pin: form.get('pin')
      });
      persist();
      alert('Merchant account and AE assignment created in local branch state.');
    } catch (error) {
      alert(error.message || 'Signup failed.');
    }
  });

  document.querySelector('#reset-seed').onclick = () => { state = resetState(); persist(); };
}

render();

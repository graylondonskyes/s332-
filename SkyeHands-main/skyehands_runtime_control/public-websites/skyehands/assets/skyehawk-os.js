(function () {
  'use strict';

  if (window.__SKYEHANDS_SKYEHAWK_OS__) return;
  window.__SKYEHANDS_SKYEHAWK_OS__ = true;

  const apps = [
    {
      name: 'SkyeHands Home',
      lane: 'Operating System',
      rel: 'SkyeHands-Website/index.html',
      intent: 'Return to the primary SkyeHands operating-system website.',
      commands: ['home', 'website', 'skyehands']
    },
    {
      name: 'Full Platform Launchpad',
      lane: 'Operating System',
      rel: 'SkyeHands-Website/platform-launchpad.html',
      intent: 'Open the complete 546-surface workspace directory.',
      commands: ['launchpad', 'all platforms', 'directory', 'workspace']
    },
    {
      name: 'SkyeMail Dashboard',
      lane: 'Communication',
      rel: 'AbovetheSkye-Platforms/SkyeMail/dashboard.html',
      intent: 'Launch the SkyeMail dashboard with mailbox, compose, contacts, settings, AI, and suite surfaces nearby.',
      commands: ['mail', 'skyemail', 'inbox', 'dashboard']
    },
    {
      name: 'SkyeMail Compose',
      lane: 'Communication',
      rel: 'AbovetheSkye-Platforms/SkyeMail/compose.html',
      intent: 'Open the SkyeMail compose workflow.',
      commands: ['compose', 'send mail', 'email']
    },
    {
      name: 'SkyeMail Suite Command',
      lane: 'Communication',
      rel: 'AbovetheSkye-Platforms/SkyeMail/suite/apps/command/index.html',
      intent: 'Open the SkyeMail suite command center.',
      commands: ['mail command', 'campaigns', 'ops']
    },
    {
      name: 'kAIxUGateway13 / SkyeGate',
      lane: 'Auth and Gateway',
      rel: 'AbovetheSkye-Platforms/kAIxUGateway13/index.html',
      intent: 'Launch the SkyeGate auth, gateway, account, and provider-control surface.',
      commands: ['gate', 'skyegate', 'auth', 'login', 'gateway']
    },
    {
      name: 'SkyeCards Dashboard',
      lane: 'Economy',
      rel: 'AbovetheSkye-Platforms/kAIxUGateway13/index.html#skye-cards',
      intent: 'Open the in-house SkyeCards usage-credit and allowance surface.',
      commands: ['skyecards', 'cards', 'credits', 'usage']
    },
    {
      name: 'ValleyVerified v2',
      lane: 'Procurement',
      rel: 'AbovetheSkye-Platforms/ValleyVerified-v2/index.html',
      intent: 'Launch the company job posting, contractor onboarding, dispatch, and fulfillment parent platform.',
      commands: ['valleyverified', 'jobs', 'contractors', 'procurement', 'fulfillment']
    },
    {
      name: 'SkyeForgeMax',
      lane: 'Creation',
      rel: 'AbovetheSkye-Platforms/SkyeForgeMax/index.html',
      intent: 'Open the in-house app forge and artifact builder.',
      commands: ['forge', 'skyeforgemax', 'builder', 'create']
    },
    {
      name: 'SkyeRoutex',
      lane: 'Routing and Commerce',
      rel: 'AbovetheSkye-Platforms/SkyeRoutex/index.html',
      intent: 'Open routing, app fabric, commerce, and dispatch infrastructure.',
      commands: ['skyeroutex', 'routing', 'commerce', 'app fabric']
    },
    {
      name: 'JobPing / Appointment Setter',
      lane: 'Lead Automation',
      rel: 'AbovetheSkye-Platforms/AppointmentSetter/static/index.html',
      intent: 'Launch JobPing and appointment-setting workflow surfaces.',
      commands: ['jobping', 'appointments', 'leads', 'ae flow']
    },
    {
      name: 'AE CommandHub',
      lane: 'Contractor Network',
      rel: 'AbovetheSkye-Platforms/AE-Central-CommandHub/AE-Central-Command-Pack-CredentialHub-Launcher/index.html',
      intent: 'Open the AE contractor network command hub.',
      commands: ['ae', 'contractor', 'sales', 'dispatch']
    },
    {
      name: 'SkyeDocxMax',
      lane: 'Documents',
      rel: 'AbovetheSkye-Platforms/SkyeDocxMax/index.html',
      intent: 'Open the document platform.',
      commands: ['docs', 'documents', 'skyedocx']
    },
    {
      name: 'SkyeWebCreatorMax',
      lane: 'Websites',
      rel: 'AbovetheSkye-Platforms/SkyeWebCreatorMax/index.html',
      intent: 'Open the website builder platform.',
      commands: ['web creator', 'sites', 'builder']
    },
    {
      name: 'SkyDexia',
      lane: 'Knowledge',
      rel: 'AbovetheSkye-Platforms/SkyDexia/webapp/public/index.html',
      intent: 'Open the knowledge and AI brain surface.',
      commands: ['skydexia', 'brain', 'knowledge', 'ai']
    },
    {
      name: 'SkyeLeticX',
      lane: 'Sports',
      rel: 'SkyeSol/skyesol-main/SkyeLeticXOfficialWebsite/index.html',
      intent: 'Open the SkyeLeticX sports platform.',
      commands: ['sports', 'skyeleticx']
    },
    {
      name: 'SkyeSol Main',
      lane: 'Product Line',
      rel: 'SkyeSol/skyesol-main/index.html',
      intent: 'Open the SkyeSol product-line website.',
      commands: ['skyesol', 'products', 'store']
    },
    {
      name: 'SOLEnterprises Main',
      lane: 'Services',
      rel: 'SOLEnterprises.org/SOLEnterprises.org-main/index.html',
      intent: 'Open the SOLEnterprises services website.',
      commands: ['sole', 'services', 'enterprise']
    },
    {
      name: 'Proof Center',
      lane: 'Investor',
      rel: 'SkyeHands-Website/PROOF_CENTER.html',
      intent: 'Open the investor proof center.',
      commands: ['proof', 'audit', 'evidence']
    },
    {
      name: 'Valuation Packet',
      lane: 'Investor',
      rel: 'SkyeHands-Website/SkyeHands-Ecosystem-Valuation-2026-04-30.html',
      intent: 'Open the April 30 investor valuation packet.',
      commands: ['valuation', 'investor', 'raise']
    }
  ];

  const quickCommands = [
    { label: 'Open SkyeMail', app: 'SkyeMail Dashboard' },
    { label: 'Open SkyeGate', app: 'kAIxUGateway13 / SkyeGate' },
    { label: 'Open SkyeCards', app: 'SkyeCards Dashboard' },
    { label: 'Open ValleyVerified', app: 'ValleyVerified v2' },
    { label: 'Open SkyeForgeMax', app: 'SkyeForgeMax' },
    { label: 'Open Full Launchpad', app: 'Full Platform Launchpad' }
  ];

  function rootPrefix() {
    const p = location.pathname.replace(/\\/g, '/');
    const markers = [
      'SkyeHands-Website',
      'AbovetheSkye-Platforms',
      'SkyeSol',
      'SOLEnterprises.org',
      'Dynasty-Versions',
      'skyehands_runtime_control'
    ];
    for (const marker of markers) {
      const needle = '/' + marker + '/';
      const idx = p.indexOf(needle);
      if (idx >= 0) {
        const tail = p.slice(idx + 1).split('/').filter(Boolean);
        return '../'.repeat(Math.max(0, tail.length - 1));
      }
    }
    return p.includes('/skyehands_runtime_control/public-websites/skyehands/') ? '../../../' : '../';
  }

  function hrefFor(rel) {
    const hash = rel.includes('#') ? rel.slice(rel.indexOf('#')) : '';
    const clean = rel.includes('#') ? rel.slice(0, rel.indexOf('#')) : rel;
    return rootPrefix() + clean.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/') + hash;
  }

  function launch(app, background) {
    const url = hrefFor(app.rel);
    if (background || window.event && (window.event.metaKey || window.event.ctrlKey)) {
      window.open(url, '_blank', 'noopener');
    } else {
      window.location.href = url;
    }
  }

  function matches(app, term) {
    if (!term) return true;
    const hay = [app.name, app.lane, app.intent, app.rel].concat(app.commands || []).join(' ').toLowerCase();
    return hay.includes(term);
  }

  function css() {
    return `
    .skyehawk-trigger{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:1px solid rgba(245,200,66,.38);background:rgba(6,5,16,.66);color:#ffe58a;border-radius:999px;padding:10px 12px;font:900 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;box-shadow:0 18px 60px rgba(0,0,0,.35);backdrop-filter:blur(14px);opacity:.34;transition:opacity .18s ease,transform .18s ease,border-color .18s ease;cursor:pointer}
    .skyehawk-trigger:hover,.skyehawk-trigger:focus{opacity:1;transform:translateY(-2px);border-color:rgba(53,222,207,.7);outline:none}
    .skyehawk-overlay{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;background:rgba(3,2,9,.76);backdrop-filter:blur(20px);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#f7f3ea}
    .skyehawk-overlay.open{display:flex}
    .skyehawk-panel{width:min(1060px,calc(100vw - 28px));height:min(760px,calc(100vh - 28px));border:1px solid rgba(245,200,66,.24);border-radius:24px;background:linear-gradient(145deg,rgba(13,10,28,.98),rgba(5,4,13,.98));box-shadow:0 30px 120px rgba(0,0,0,.62),0 0 0 1px rgba(141,104,255,.16) inset;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr}
    .skyehawk-top{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid rgba(245,200,66,.14);background:linear-gradient(90deg,rgba(245,200,66,.1),rgba(141,104,255,.1),rgba(53,222,207,.06))}
    .skyehawk-mark{display:grid;gap:4px}
    .skyehawk-mark b{font:950 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#ffe58a}
    .skyehawk-mark span{font-size:12px;font-weight:750;color:#a9a1bd}
    .skyehawk-close{border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05);color:#f7f3ea;border-radius:10px;padding:8px 10px;font-weight:950;cursor:pointer}
    .skyehawk-searchbar{display:grid;grid-template-columns:1fr auto;gap:10px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08)}
    .skyehawk-input{width:100%;border:1px solid rgba(245,200,66,.22);background:rgba(2,2,8,.8);color:#f7f3ea;border-radius:14px;padding:15px 16px;font-size:15px;font-weight:800;outline:none}
    .skyehawk-input:focus{border-color:rgba(53,222,207,.68);box-shadow:0 0 0 3px rgba(53,222,207,.09)}
    .skyehawk-hint{align-self:center;color:#766f8d;font:900 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
    .skyehawk-body{display:grid;grid-template-columns:270px 1fr;min-height:0}
    .skyehawk-side{border-right:1px solid rgba(255,255,255,.08);padding:14px;overflow:auto}
    .skyehawk-side-title{font:950 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#35decf;margin:4px 0 10px}
    .skyehawk-command{width:100%;text-align:left;border:1px solid rgba(245,200,66,.15);background:rgba(255,255,255,.035);color:#f7f3ea;border-radius:12px;padding:11px 12px;margin:0 0 8px;font-size:12px;font-weight:900;cursor:pointer}
    .skyehawk-command:hover{border-color:rgba(245,200,66,.5);background:rgba(245,200,66,.08)}
    .skyehawk-state{margin-top:14px;border:1px solid rgba(53,222,207,.18);background:rgba(53,222,207,.06);border-radius:14px;padding:12px;color:#a9a1bd;font-size:12px;line-height:1.55;font-weight:720}
    .skyehawk-grid{padding:14px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-content:start}
    .skyehawk-card{border:1px solid rgba(245,200,66,.13);background:linear-gradient(180deg,rgba(21,16,39,.92),rgba(8,7,18,.92));border-radius:16px;padding:14px;display:grid;gap:8px;min-height:142px;cursor:pointer;color:inherit;text-decoration:none}
    .skyehawk-card:hover,.skyehawk-card:focus{border-color:rgba(53,222,207,.58);outline:none;transform:translateY(-1px)}
    .skyehawk-lane{font:950 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#35decf}
    .skyehawk-name{font-size:16px;line-height:1.15;font-weight:950}
    .skyehawk-intent{font-size:12px;line-height:1.5;color:#a9a1bd;font-weight:700}
    .skyehawk-path{font:800 10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#766f8d;overflow-wrap:anywhere;margin-top:auto}
    .skyehawk-empty{display:none;padding:24px;color:#a9a1bd;font-weight:850}
    @media(max-width:760px){.skyehawk-panel{height:calc(100vh - 18px);width:calc(100vw - 18px);border-radius:18px}.skyehawk-body{grid-template-columns:1fr}.skyehawk-side{display:none}.skyehawk-grid{grid-template-columns:1fr}.skyehawk-searchbar{grid-template-columns:1fr}.skyehawk-hint{display:none}}
    `;
  }

  let overlay;
  let input;
  let grid;
  let empty;

  function build() {
    const style = document.createElement('style');
    style.textContent = css();
    document.head.appendChild(style);

    const trigger = document.createElement('button');
    trigger.className = 'skyehawk-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Open SkyeHawk command launcher');
    trigger.textContent = 'SkyeHawk';
    trigger.addEventListener('click', open);
    document.body.appendChild(trigger);

    overlay = document.createElement('div');
    overlay.className = 'skyehawk-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'SkyeHawk command launcher');
    overlay.innerHTML = `
      <section class="skyehawk-panel">
        <header class="skyehawk-top">
          <div class="skyehawk-mark"><b>SkyeHawk OS</b><span>Hidden command layer for the SkyeHands operating system website</span></div>
          <button class="skyehawk-close" type="button">Close</button>
        </header>
        <div class="skyehawk-searchbar">
          <input class="skyehawk-input" autocomplete="off" placeholder="Type a command, platform, workflow, app, or lane...">
          <div class="skyehawk-hint">Cmd/Ctrl K · type skyehawk · Esc</div>
        </div>
        <div class="skyehawk-body">
          <aside class="skyehawk-side">
            <div class="skyehawk-side-title">Direct Commands</div>
            <div class="skyehawk-commands"></div>
            <div class="skyehawk-state">Launches resolve from the SkyeHands-main workspace root. The full Launchpad carries every indexed website/app surface; SkyeHawk carries the high-value operating commands.</div>
          </aside>
          <main>
            <div class="skyehawk-grid"></div>
            <div class="skyehawk-empty">No command matched. Try SkyeMail, SkyeGate, ValleyVerified, SkyeCards, AE, proof, or launchpad.</div>
          </main>
        </div>
      </section>`;
    document.body.appendChild(overlay);

    input = overlay.querySelector('.skyehawk-input');
    grid = overlay.querySelector('.skyehawk-grid');
    empty = overlay.querySelector('.skyehawk-empty');

    overlay.querySelector('.skyehawk-close').addEventListener('click', close);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) close();
    });
    input.addEventListener('input', render);

    const commands = overlay.querySelector('.skyehawk-commands');
    quickCommands.forEach(function (cmd) {
      const app = apps.find(function (item) { return item.name === cmd.app; });
      if (!app) return;
      const button = document.createElement('button');
      button.className = 'skyehawk-command';
      button.type = 'button';
      button.textContent = cmd.label;
      button.addEventListener('click', function () { launch(app); });
      commands.appendChild(button);
    });

    render();
  }

  function render() {
    const term = (input && input.value || '').trim().toLowerCase();
    const shown = apps.filter(function (app) { return matches(app, term); });
    grid.innerHTML = '';
    shown.forEach(function (app) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'skyehawk-card';
      card.innerHTML = `
        <div class="skyehawk-lane">${app.lane}</div>
        <div class="skyehawk-name">${app.name}</div>
        <div class="skyehawk-intent">${app.intent}</div>
        <div class="skyehawk-path">${app.rel}</div>`;
      card.addEventListener('click', function (event) { launch(app, event.metaKey || event.ctrlKey); });
      grid.appendChild(card);
    });
    empty.style.display = shown.length ? 'none' : 'block';
  }

  function open() {
    overlay.classList.add('open');
    input.value = '';
    render();
    setTimeout(function () { input.focus(); }, 20);
  }

  function close() {
    overlay.classList.remove('open');
  }

  let typed = '';
  const keysHeld = new Set();
  let logoClicks = 0;
  let logoTimer = null;

  document.addEventListener('keydown', function (event) {
    keysHeld.add(event.key);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open();
      return;
    }
    if (event.key === 'Escape' && overlay && overlay.classList.contains('open')) {
      close();
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      typed = (typed + event.key.toLowerCase()).slice(-8);
      if (typed === 'skyehawk') open();
    }
  });
  document.addEventListener('keyup', function (event) { keysHeld.delete(event.key); });

  function logoGesture() {
    if (!keysHeld.has('6') || !keysHeld.has('7')) return;
    logoClicks += 1;
    clearTimeout(logoTimer);
    logoTimer = setTimeout(function () { logoClicks = 0; }, 700);
    if (logoClicks >= 3) {
      logoClicks = 0;
      open();
    }
  }

  function bindLogoGesture() {
    document.querySelectorAll('.kaixu-logo,.sigil,[id*="logo"],[class*="logo"],[id*="brand"],[class*="brand"]').forEach(function (el) {
      if (el.__skyehawkBound) return;
      el.__skyehawkBound = true;
      el.addEventListener('click', logoGesture);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      build();
      bindLogoGesture();
      setInterval(bindLogoGesture, 1800);
    });
  } else {
    build();
    bindLogoGesture();
    setInterval(bindLogoGesture, 1800);
  }
})();

(function () {
  const templates = [
    {
      id: 'sole-skye-authority-platform',
      name: 'SOLE / SkyeSol Authority Platform',
      stack: ['SOLE house style', 'SkyeSol bundle glass/aurora system', 'donor-vault provenance', 'working console/intake'],
      aliases: ['sole', 'skyesol', 'house', 'authority', 'obsidian', 'gold', 'premium', 'founder'],
      enabledForGeneration: true,
      qualityTier: 'house-standard',
      exportPath: './generated-sites/sole-skye-authority-platform',
      useCases: ['enterprise-admin', 'saas-dashboard', 'landing-page', '3d-product-showcase', 'ide-editor'],
      sourceRefs: [
        'SOLEnterprises.org/SOLEnterprises.org-main/Pages/ObsidianNoir.html',
        'SkyeSol/skyesol-main/Bundles/assets/site.css',
        'SkyeSol/skyesol-main/css/style.css',
        'SkyeSol/skyesol-main/SkyeDocx/index.html',
        'AbovetheSkye-Platforms/SkyeForgeMax/assets/forge.css',
        'design-vault/library/house-style/sole-skye-visual-standard.md',
      ],
    },
    {
      id: 'donor-enterprise-ops-console',
      name: 'Enterprise Ops Console',
      stack: ['shadcn/ui dashboard', 'TailGrids table/card primitives', 'SkyeGateFS13 ops lane'],
      aliases: ['dashboard', 'admin', 'enterprise', 'table', 'sidebar', 'shadcn', 'tailgrids'],
      enabledForGeneration: false,
      qualityTier: 'reference-only',
      useCases: ['enterprise-admin', 'saas-dashboard'],
      sourceRefs: [
        'design-vault/sources/shadcn-ui/apps/v4/app/(app)/examples/dashboard/page.tsx',
        'design-vault/sources/shadcn-ui/apps/v4/app/(app)/examples/dashboard/components/section-cards.tsx',
        'design-vault/sources/shadcn-ui/apps/v4/app/(app)/examples/dashboard/components/data-table.tsx',
        'design-vault/sources/tailgrids/apps/docs/src/registry/core/table.tsx',
        'design-vault/sources/tailgrids/apps/docs/src/registry/core/sidebar.tsx',
        'design-vault/sources/tailgrids/apps/docs/src/registry/core/card.tsx',
      ],
      files: {
        'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Enterprise Ops Console | SkyeWebCreatorMax</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span></span><strong>ArcLight Ops</strong></div>
        <nav><a class="active" href="#overview">Overview</a><a href="#revenue">Revenue</a><a href="#deployments">Deployments</a><a href="#clients">Clients</a><a href="#audit">Audit</a><a href="#settings">Settings</a></nav>
        <section class="ai-card"><b>SkyDexia Watch</b><p>Gateway, delivery, and client-risk signals are being orchestrated across the platform bus.</p></section>
      </aside>
      <section class="workspace">
        <header class="topbar" id="overview">
          <div><p class="eyebrow">Donor-backed enterprise console</p><h1>Command center for client delivery, revenue, and agent operations.</h1></div>
          <button id="runDelivery" type="button">Run AE Delivery</button>
        </header>
        <section class="metrics" id="revenue">
          <article><span>Total Pipeline</span><b>$8.42M</b><i></i></article>
          <article><span>Live Builds</span><b>128</b><i></i></article>
          <article><span>Gate Events</span><b>42.9K</b><i></i></article>
          <article><span>Risk Score</span><b>1.7%</b><i></i></article>
        </section>
        <section class="grid" id="deployments">
          <article class="chart-card">
            <div class="card-head"><b>Fulfillment Velocity</b><span>Last 30 days</span></div>
            <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          </article>
          <article class="table-card" id="clients">
            <div class="card-head"><b>Client Builds</b><span>Gateway synced</span></div>
            <table>
              <thead><tr><th>Client</th><th>Lane</th><th>Status</th><th>Value</th></tr></thead>
              <tbody>
                <tr><td>Nova Health</td><td>AE</td><td><mark>Ready</mark></td><td>$420K</td></tr>
                <tr><td>Foundry Bank</td><td>SkyDexia</td><td><mark>Design</mark></td><td>$780K</td></tr>
                <tr><td>Sol Retail</td><td>GateFS13</td><td><mark>Queued</mark></td><td>$260K</td></tr>
                <tr><td>Atlas Labs</td><td>R2</td><td><mark>Stored</mark></td><td>$510K</td></tr>
              </tbody>
            </table>
          </article>
        </section>
        <section class="ops-row" id="audit">
          <article><b>Audit Trail</b><p id="deliveryStatus">No delivery run in this browser session yet.</p></article>
          <article id="settings"><b>Settings</b><p>Gateway mirror, AE delivery, and R2 persistence are ready to bind once production vars are configured.</p></article>
        </section>
      </section>
    </main>
    <script src="./app.js"></script>
  </body>
</html>`,
        'styles.css': `:root{color-scheme:dark;--bg:#050807;--panel:#0d1412;--panel2:#111a23;--ink:#f4fff8;--muted:#9eb5aa;--line:rgba(134,255,184,.18);--green:#39ff88;--cyan:#5df1ff;--rose:#ff5c8a}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 10%,rgba(57,255,136,.18),transparent 28%),linear-gradient(135deg,#050807,#091412 54%,#111827);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif}.app-shell{min-height:100vh;display:grid;grid-template-columns:280px minmax(0,1fr)}.sidebar{border-right:1px solid var(--line);background:rgba(5,8,7,.78);backdrop-filter:blur(18px);padding:18px;display:grid;grid-template-rows:auto 1fr auto;gap:22px;position:sticky;top:0;height:100vh}.brand{display:flex;align-items:center;gap:10px}.brand span{width:34px;height:34px;border-radius:8px;background:conic-gradient(var(--green),var(--cyan),var(--rose),var(--green));box-shadow:0 0 30px rgba(57,255,136,.35)}nav{display:grid;gap:8px}nav a{border:1px solid transparent;border-radius:8px;padding:11px;color:var(--muted);font-weight:800;text-decoration:none}.active,nav a:hover{color:var(--green);background:rgba(57,255,136,.1);border-color:rgba(57,255,136,.42)}.ai-card,.metrics article,.chart-card,.table-card,.ops-row article{border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.055);box-shadow:0 24px 80px rgba(0,0,0,.32)}.ai-card{padding:16px}.ai-card p,.topbar p,.card-head span,.ops-row p{color:var(--muted);line-height:1.45}.workspace{padding:18px;display:grid;gap:14px}.topbar{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.eyebrow{margin:0 0 8px;color:var(--green);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.14em}h1{max-width:900px;margin:0;font-size:clamp(34px,5vw,70px);line-height:.9;letter-spacing:0}button{border:0;border-radius:8px;background:linear-gradient(135deg,var(--green),var(--cyan));color:#021007;font-weight:950;padding:13px 16px;cursor:pointer}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metrics article{padding:16px}.metrics span{color:var(--muted);font-size:12px;font-weight:800}.metrics b{display:block;margin-top:12px;font-size:clamp(28px,4vw,48px);line-height:.9}.metrics i{display:block;height:8px;margin-top:16px;border-radius:999px;background:linear-gradient(90deg,var(--green),transparent)}.grid{display:grid;grid-template-columns:minmax(320px,.9fr) minmax(420px,1.1fr);gap:12px}.chart-card,.table-card,.ops-row article{padding:16px}.card-head{display:flex;justify-content:space-between;gap:14px;margin-bottom:18px}.bars{height:360px;display:flex;align-items:end;gap:12px}.bars i{flex:1;border-radius:8px 8px 0 0;background:linear-gradient(to top,var(--green),var(--rose));box-shadow:0 0 28px rgba(57,255,136,.2)}.bars i:nth-child(1){height:38%}.bars i:nth-child(2){height:58%}.bars i:nth-child(3){height:72%}.bars i:nth-child(4){height:45%}.bars i:nth-child(5){height:84%}.bars i:nth-child(6){height:66%}.bars i:nth-child(7){height:92%}.bars i:nth-child(8){height:74%}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid rgba(255,255,255,.08);padding:15px 10px;color:var(--muted)}tr{cursor:pointer}tr:hover td{color:var(--ink);background:rgba(57,255,136,.045)}th{color:var(--ink);font-size:12px;text-transform:uppercase;letter-spacing:.1em}mark{border-radius:999px;padding:5px 8px;background:rgba(57,255,136,.12);color:var(--green)}.ops-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:980px){.app-shell{grid-template-columns:1fr}.metrics,.grid,.ops-row{grid-template-columns:1fr}.sidebar{position:relative;height:auto}.topbar{display:grid}}`,
        'app.js': `const rows = [...document.querySelectorAll('tbody tr')];
const status = document.getElementById('deliveryStatus');
rows.forEach((row,index)=>{row.style.animationDelay=(index*90)+'ms';row.addEventListener('click',()=>{status.textContent='Opened client row: '+row.cells[0].textContent+' / '+row.cells[1].textContent;document.getElementById('audit').scrollIntoView({behavior:'smooth'});});});
document.getElementById('runDelivery').addEventListener('click',()=>{status.textContent='AE delivery queued at '+new Date().toLocaleTimeString()+'. Gateway mirror will attach when production vars are set.';document.getElementById('audit').scrollIntoView({behavior:'smooth'});});
console.log('Enterprise Ops Console generated from shadcn dashboard and TailGrids registry references.');`,
        'README.md': `# Enterprise Ops Console

Donor-backed generation using:
- shadcn-ui dashboard example page, section cards, and data-table components
- TailGrids table, sidebar, and card registry primitives
- SkyeGateFS13 / AE CommandHub delivery assumptions
`,
      },
    },
    {
      id: 'donor-spatial-product-showcase',
      name: 'Spatial Product Showcase',
      stack: ['react-three-fiber examples', 'drei storybook controls/materials', 'Triplex spatial-editor patterns'],
      aliases: ['r3f', 'threejs', 'three.js', 'webgl', 'spatial', '3d'],
      enabledForGeneration: false,
      qualityTier: 'reference-only',
      useCases: ['3d-product-showcase', 'landing-page'],
      sourceRefs: [
        'design-vault/sources/react-three-fiber/example/src/demos/Viewcube.tsx',
        'design-vault/sources/react-three-fiber/example/src/demos/Pointcloud.tsx',
        'design-vault/sources/drei/.storybook/stories/PresentationControls.stories.tsx',
        'design-vault/sources/drei/.storybook/stories/Environment.stories.tsx',
        'design-vault/sources/drei/.storybook/stories/MeshTransmissionMaterial.stories.tsx',
        'design-vault/sources/triplex/examples',
      ],
      files: {
        'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Spatial Product Showcase | SkyeWebCreatorMax</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <canvas id="scene"></canvas>
    <main>
      <nav><strong>VoltSphere</strong><span>R3F + drei inspired product world</span></nav>
      <section class="hero" id="platform">
        <div>
          <p class="eyebrow">Spatial commerce experience</p>
          <h1>A cinematic 3D launch surface for premium product storytelling.</h1>
          <p class="lead">Built from the imported R3F/drei/Triplex design vault lane: presentation controls, environment lighting, point fields, viewport thinking, and editor-ready source.</p>
          <div class="actions"><a href="#demo">Explore product</a><a class="ghost" href="#system">View system</a></div>
        </div>
        <aside class="hud">
          <b>Scene Graph</b>
          <span>ProductCore</span><span>ParticleField</span><span>EnvironmentRig</span><span>CameraPath</span>
        </aside>
      </section>
      <section class="product-demo" id="demo">
        <article><b id="demoState">Product orbit is live</b><p>Use the controls below to switch the scene mode. The canvas responds instantly in this standalone export.</p><div class="control-row"><button type="button" data-mode="orbit">Orbit</button><button type="button" data-mode="explode">Explode</button><button type="button" data-mode="calm">Calm</button></div></article>
      </section>
      <section class="features" id="system">
        <article><b>Presentation Controls</b><p>Inspired by drei story patterns for product inspection and spatial storytelling.</p></article>
        <article><b>Point Field</b><p>R3F example concepts translated into a standalone canvas artifact.</p></article>
        <article><b>Triplex Ready</b><p>Scene composition is organized like an editable spatial surface.</p></article>
      </section>
    </main>
    <script src="./app.js"></script>
  </body>
</html>`,
        'styles.css': `:root{color-scheme:dark;--green:#39ff88;--cyan:#5df1ff;--violet:#9d6bff;--pink:#ff4fd8;--ink:#f6fff9;--muted:#a9beb4;--line:rgba(139,255,188,.2)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:#020604;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,sans-serif;overflow-x:hidden}#scene{position:fixed;inset:0;width:100%;height:100%;background:radial-gradient(circle at 66% 42%,rgba(57,255,136,.2),transparent 28%),radial-gradient(circle at 78% 20%,rgba(157,107,255,.22),transparent 30%),linear-gradient(135deg,#020604,#061511 52%,#120c22)}main{position:relative;z-index:1}nav{display:flex;justify-content:space-between;gap:18px;padding:22px clamp(18px,5vw,70px);color:var(--muted);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(16px)}nav strong{color:var(--ink)}.hero{min-height:calc(100vh - 80px);display:grid;grid-template-columns:minmax(0,1fr) 320px;align-items:center;gap:40px;padding:clamp(32px,6vw,88px)}.eyebrow{color:var(--green);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.16em}h1{max-width:980px;margin:0;font-size:clamp(52px,8vw,128px);line-height:.82;letter-spacing:0}.lead{max-width:720px;color:var(--muted);font-size:clamp(18px,2vw,24px);line-height:1.42}.actions,.control-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}a,.control-row button{display:inline-flex;min-height:42px;align-items:center;border-radius:8px;padding:10px 15px;background:linear-gradient(135deg,var(--green),var(--cyan));color:#021007;text-decoration:none;font-weight:950;border:0;cursor:pointer}.ghost{background:rgba(255,255,255,.07);color:var(--ink);border:1px solid rgba(255,255,255,.18)}.hud{border:1px solid var(--line);border-radius:8px;background:rgba(5,15,11,.62);backdrop-filter:blur(20px);padding:18px;box-shadow:0 30px 100px rgba(0,0,0,.42)}.hud b{display:block;margin-bottom:16px;color:var(--green)}.hud span{display:block;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:12px;margin-top:8px;color:var(--muted);background:rgba(255,255,255,.05)}.product-demo{padding:0 clamp(18px,6vw,88px) 12px}.product-demo article{border:1px solid var(--line);border-radius:8px;padding:20px;background:rgba(255,255,255,.06);backdrop-filter:blur(18px)}.product-demo p{color:var(--muted);line-height:1.45}.features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 clamp(18px,6vw,88px) 70px}.features article{border:1px solid var(--line);border-radius:8px;padding:20px;background:rgba(255,255,255,.06);backdrop-filter:blur(18px)}.features b,.product-demo b{color:var(--green);font-size:20px}.features p{color:var(--muted);line-height:1.45}@media(max-width:880px){.hero,.features{grid-template-columns:1fr}h1{font-size:52px}}`,
        'app.js': `const canvas=document.getElementById('scene');const ctx=canvas.getContext('2d');let sceneMode='orbit';const nodes=Array.from({length:180},(_,i)=>({seed:i*11.91,r:80+(i%13)*22,s:.00018+(i%8)*.000045,size:1+(i%5)}));
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
function draw(t){ctx.clearRect(0,0,innerWidth,innerHeight);const cx=innerWidth*.68,cy=innerHeight*.48;const modeScale=sceneMode==='explode'?1.42:sceneMode==='calm'?0.72:1;ctx.globalCompositeOperation='lighter';nodes.forEach(n=>{const a=t*n.s+n.seed;const x=cx+Math.cos(a*1.7)*n.r*modeScale+Math.sin(a*.4)*110;const y=cy+Math.sin(a*1.1)*n.r*.55*modeScale;const g=ctx.createRadialGradient(x,y,0,x,y,n.size*13);g.addColorStop(0,'rgba(57,255,136,.7)');g.addColorStop(.45,'rgba(93,241,255,.22)');g.addColorStop(1,'rgba(255,79,216,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,n.size*13,0,Math.PI*2);ctx.fill()});ctx.globalCompositeOperation='source-over';ctx.strokeStyle='rgba(57,255,136,.34)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(cx,cy,(180+Math.sin(t*.001)*18)*modeScale,82*modeScale,Math.sin(t*.0004)*.4,0,Math.PI*2);ctx.stroke();requestAnimationFrame(draw)}
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{sceneMode=button.dataset.mode;document.getElementById('demoState').textContent='Scene mode: '+sceneMode;document.getElementById('demo').scrollIntoView({behavior:'smooth'});}));
addEventListener('resize',resize);resize();requestAnimationFrame(draw);console.log('Spatial showcase generated from R3F, drei, and Triplex source references.');`,
        'README.md': `# Spatial Product Showcase

Donor-backed generation using:
- react-three-fiber demo concepts for point fields and view scenes
- drei presentation/environment/material story references
- Triplex spatial-editor organization concepts
`,
      },
    },
    {
      id: 'donor-conversion-landing-system',
      name: 'Conversion Landing System',
      stack: ['TailGrids docs components', 'shadcn/ui examples', 'responsive SaaS marketing blocks'],
      aliases: ['landing', 'marketing', 'conversion', 'pricing', 'faq', 'tailgrids', 'shadcn'],
      enabledForGeneration: false,
      qualityTier: 'reference-only',
      useCases: ['landing-page', 'saas-dashboard'],
      sourceRefs: [
        'design-vault/sources/tailgrids/apps/docs/content/components/card.mdx',
        'design-vault/sources/tailgrids/apps/docs/content/components/tabs.mdx',
        'design-vault/sources/tailgrids/apps/docs/content/components/accordion.mdx',
        'design-vault/sources/shadcn-ui/apps/v4/examples/base/card-demo.tsx',
        'design-vault/sources/shadcn-ui/apps/v4/examples/base/tabs-demo.tsx',
        'design-vault/sources/shadcn-ui/apps/v4/examples/base/accordion-demo.tsx',
      ],
      files: {
        'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Conversion Platform | SkyeWebCreatorMax</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main>
      <nav><strong>Northstar AI</strong><div><a href="#platform">Platform</a><a href="#proof">Proof</a><a href="#pricing">Pricing</a><a class="button" href="#start">Start</a></div></nav>
      <section class="hero" id="platform">
        <p class="eyebrow">TailGrids + shadcn conversion stack</p>
        <h1>Turn a serious offer into a client-ready web system.</h1>
        <p>Premium hero, proof cards, pricing, FAQ, and CTA sections composed from the imported design-vault component lanes.</p>
        <div class="actions"><a class="button" href="#start">Launch build</a><a class="ghost" href="#proof">See examples</a></div>
      </section>
      <section class="cards" id="proof">
        <article><b>Offer Architecture</b><span>Hero, social proof, problem framing, and CTA density tuned for conversion.</span></article>
        <article><b>Component Discipline</b><span>Card, tabs, accordion, button, and badge patterns mapped from donor libraries.</span></article>
        <article><b>Delivery Ready</b><span>Standalone files, editable source, SkyeGateFS13 events, and AE handoff metadata.</span></article>
      </section>
      <section class="pricing" id="pricing"><div><b>Founder Stack</b><strong>$12K</strong><span>Premium launch system with platform integration.</span></div><div><b>Enterprise Stack</b><strong>$48K</strong><span>Multi-surface build with dashboard, auth, and delivery ops.</span></div></section>
      <section class="start" id="start"><form><b>Start a build</b><label>Name<input name="name" placeholder="Your name"></label><label>Email<input name="email" type="email" placeholder="you@internal.invalid"></label><label>Project brief<textarea name="brief" placeholder="Tell us what you want built"></textarea></label><button type="submit">Request Proposal</button><p id="formStatus">Proposal queue is ready.</p></form></section>
    </main>
    <script src="./app.js"></script>
  </body>
</html>`,
        'styles.css': `:root{color-scheme:dark;--green:#39ff88;--blue:#5df1ff;--pink:#ff5c8a;--ink:#f7fff9;--muted:#9fb7ab;--line:rgba(139,255,188,.2)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:radial-gradient(circle at 18% 10%,rgba(57,255,136,.22),transparent 26%),radial-gradient(circle at 86% 8%,rgba(255,92,138,.18),transparent 28%),linear-gradient(145deg,#030805,#071511 50%,#121827);color:var(--ink)}nav{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:22px clamp(18px,5vw,72px);border-bottom:1px solid rgba(255,255,255,.08);background:rgba(3,8,5,.5);backdrop-filter:blur(18px);position:sticky;top:0;z-index:5}nav div{display:flex;gap:12px;align-items:center;flex-wrap:wrap}a{color:var(--muted);text-decoration:none;font-weight:850}.button,button{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;min-height:42px;padding:10px 16px;background:linear-gradient(135deg,var(--green),var(--blue));color:#021007!important;font-weight:950;box-shadow:0 0 38px rgba(57,255,136,.28);border:0;cursor:pointer}.ghost{display:inline-flex;border:1px solid rgba(255,255,255,.18);border-radius:8px;min-height:42px;padding:10px 16px;color:var(--ink);background:rgba(255,255,255,.06)}.hero{min-height:78vh;display:grid;align-content:center;padding:clamp(34px,7vw,104px);max-width:1180px}.eyebrow{margin:0 0 16px;color:var(--green);font-size:12px;font-weight:950;text-transform:uppercase;letter-spacing:.16em}h1{margin:0;font-size:clamp(58px,9vw,140px);line-height:.82;letter-spacing:0}.hero p:not(.eyebrow){max-width:780px;color:var(--muted);font-size:clamp(18px,2.1vw,25px);line-height:1.4}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.cards,.pricing{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 clamp(18px,6vw,104px) 24px}.cards article,.pricing div,.start form{border:1px solid var(--line);border-radius:8px;background:rgba(255,255,255,.055);backdrop-filter:blur(18px);padding:20px;min-height:190px}.cards b,.pricing b,.start b{display:block;color:var(--green);font-size:20px;margin-bottom:10px}.cards span,.pricing span,.start p{color:var(--muted);line-height:1.45}.pricing{grid-template-columns:repeat(2,minmax(0,1fr));padding-bottom:24px}.pricing strong{display:block;font-size:clamp(42px,7vw,88px);line-height:.9;margin:16px 0;color:var(--ink)}.start{padding:0 clamp(18px,6vw,104px) 70px}.start form{display:grid;gap:12px;max-width:760px}.start label{display:grid;gap:6px;color:var(--muted);font-weight:800}.start input,.start textarea{width:100%;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:rgba(0,0,0,.22);color:var(--ink);padding:12px;font:inherit}.start textarea{min-height:120px;resize:vertical}@media(max-width:820px){nav{align-items:flex-start;flex-direction:column}.cards,.pricing{grid-template-columns:1fr}h1{font-size:56px}}`,
        'app.js': `document.querySelectorAll('.cards article').forEach((card,index)=>{card.style.transform='translateY(18px)';card.style.opacity='0';setTimeout(()=>{card.style.transition='600ms ease';card.style.transform='translateY(0)';card.style.opacity='1'},index*120)});
document.querySelector('form').addEventListener('submit',(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);const payload={name:data.get('name')||'',email:data.get('email')||'',brief:data.get('brief')||'',source:'SkyeWebCreatorMax-template'};const result=window.SkyeIntegrationBridge?.enqueueWebsiteRequest?.(payload);document.getElementById('formStatus').textContent=result?'Proposal queued for AE review: '+(payload.email||'anonymous visitor')+'.':'AE bridge offline. Proposal was not queued for '+(payload.email||'anonymous visitor')+'.';});
console.log('Conversion Landing System generated from TailGrids and shadcn component references.');`,
        'README.md': `# Conversion Landing System

Donor-backed generation using:
- TailGrids card, tabs, and accordion documentation lanes
- shadcn/ui card, tabs, and accordion examples
- SkyeWebCreatorMax static export packaging
`,
      },
    },
  ];

  window.SkyeWebCreatorTemplates = {
    all: templates,
    byId(id) {
      return templates.find((template) => template.id === id) || templates[0];
    },
    forBuildType(buildType) {
      return templates.find((template) => template.enabledForGeneration !== false && template.useCases.includes(buildType)) || templates[0];
    },
  };
})();

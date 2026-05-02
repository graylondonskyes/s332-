async function loadPartial(targetId, url) {
  const el = document.getElementById(targetId);
  if (!el) return;
  
  // Try to determine if we're in a subdirectory by checking current path
  // If the page is in /Pages/ or another subdirectory, adjust the path
  let adjustedUrl = url;
  const currentPath = window.location.pathname;
  
  // If we're in /Pages/, /Mobility/, or another subdirectory, adjust path
  if (currentPath.includes('/Pages/') || currentPath.includes('/Mobility/') || currentPath.includes('/clients/')) {
    // Remove leading slash and add ../ for subdirectory context
    adjustedUrl = '../' + url.replace(/^\//, '');
  } else if (currentPath === '/' || !currentPath.includes('/')) {
    // At root level, remove leading slash
    adjustedUrl = url.replace(/^\//, '');
  }
  
  const res = await fetch(adjustedUrl, { cache: "no-store" });
  el.innerHTML = await res.text();
}

/**
 * Wire Universe dropdown after header injection.
 * (Scripts inside injected header.html won't run reliably.)
 */
function wireUniverseDropdown() {
  const nav = document.querySelector(".universe-nav");
  const btn = nav ? nav.querySelector(".universe-btn") : null;

  if (!nav || !btn) return;

  // Prevent double-wiring if layout.js runs again
  if (nav.dataset.wired === "1") return;
  nav.dataset.wired = "1";

  function open() {
    nav.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  }
  function toggle() {
    if (nav.classList.contains("open")) close();
    else open();
  }

  // Click button toggles
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  // Click inside dropdown should NOT close it
  nav.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Click outside closes
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) close();
  });

  // Escape closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

(async () => {
  await loadPartial("site-header", "/partials/header.html");
  await loadPartial("site-footer", "/partials/footer.html");

  // Wire logout button (actual logout logic is in app.js)
  const logoutLink = document.getElementById("nav-logout");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (window.SOLE && typeof window.SOLE.logout === "function") {
        window.SOLE.logout();
      }
    });
  }

  // ✅ Wire dropdowns AFTER header is injected
  wireUniverseDropdown();
  // Wire main menu dropdown same as universe
  try { wireMainMenuDropdown(); } catch(e){}
})();

/**
 * Wire main-menu (left) dropdown after header injection.
 * Mirrors the universe dropdown behavior.
 */
function wireMainMenuDropdown(){
  const navLeft = document.querySelector('.nav-left');
  const btn = navLeft ? navLeft.querySelector('.main-menu-btn') : null;
  const panel = navLeft ? navLeft.querySelector('.main-menu-dropdown') : null;
  if(!navLeft || !btn || !panel) return;

  if (navLeft.dataset.wired === '1') return;
  navLeft.dataset.wired = '1';

  function close(){ navLeft.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
  function open(){ navLeft.classList.add('open'); btn.setAttribute('aria-expanded','true'); }

  btn.addEventListener('click', (e)=>{ e.stopPropagation(); const isOpen = navLeft.classList.toggle('open'); btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false'); });
  document.addEventListener('click', ()=> close());
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') close(); });
  panel.addEventListener('click', (e)=> e.stopPropagation());
}

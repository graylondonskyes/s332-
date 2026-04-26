// assets/app.js
(() => {
  "use strict";

  const STORAGE_KEY = "sky_audit_ready_console_v1";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const monthKeyFromDate = (dateStr) => {
    const dt = new Date(dateStr);
    if (Number.isNaN(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,"0");
    return `${y}-${m}`;
  };

  const monthLabel = (mk) => {
    if (!mk || !/^\d{4}-\d{2}$/.test(mk)) return "—";
    const [y,m] = mk.split("-").map(Number);
    const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${names[m-1]} ${y}`;
  };

  const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`);

  const moneyFmt = (amount, currency) => {
    const n = Number(amount || 0);
    try {
      return new Intl.NumberFormat(undefined, { style:"currency", currency: currency || "USD" }).format(n);
    } catch {
      return `$${n.toFixed(2)}`;
    }
  };

  const safeNum = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  const deepClone = (x) => JSON.parse(JSON.stringify(x));

  const defaultState = () => {
    const now = new Date();
    const mk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    return {
      version: 1,
      activeMonth: mk,
      settings: {
        businessName: "",
        currency: "USD",
        basis: "cash",
        fiscalYearStartMonth: 1,
        advisorName: "Skyes Over London LC",
        contactEmail: "SkyesOverLondonLC@solenterprises.org",
        clientNotes: ""
      },
      checklist: buildDefaultChecklist(),
      data: {
        revenue: [],   // {id,date,client,category,method,amount,invoiceId,notes}
        expenses: [],  // {id,date,vendor,type,category,method,amount,notes}
        invoices: [],  // {id,number,client,issueDate,dueDate,status,amount,paidDate,paidAmount,paymentRef}
        deposits: [],  // {id,date,desc,amount,linkedInvoiceId,linkedRevenueId}
        matches: []    // {monthKey, depositId, invoiceId, revenueId}
      }
    };
  };

  function buildDefaultChecklist(){
    return [
      { id:"c_bank_sep", title:"Separate business bank account", desc:"No mixed personal spending; if it exists, label it clearly.", done:false },
      { id:"c_reconcile", title:"Bank deposits reconciled monthly", desc:"Every deposit tied to an invoice/payment or sales entry.", done:false },
      { id:"c_invoices", title:"Invoices tracked (if invoicing)", desc:"Invoice #, issue, due, amount, status, paid date + ref.", done:false },
      { id:"c_receipts", title:"Receipts/records for expenses", desc:"Receipts or invoices for major expenses; consistent categorization.", done:false },
      { id:"c_cogs_opex", title:"COGS vs OpEx separated", desc:"Delivery costs vs overhead so margins are explainable.", done:false },
      { id:"c_monthly_pl", title:"Monthly P&L produced", desc:"At least 12 months is ideal; no missing months.", done:false },
      { id:"c_tax_ready", title:"Tax and payroll records organized", desc:"W-9s/invoices for contractors; payroll reports if applicable.", done:false },
      { id:"c_customer_risk", title:"Customer concentration noted", desc:"If one client is >25% revenue, document it and mitigation plan.", done:false },
      { id:"c_refunds", title:"Refunds/chargebacks logged", desc:"Refunds/chargebacks recorded so revenue is clean.", done:false },
      { id:"c_consistency", title:"Consistency narrative ready", desc:"Explain seasonal spikes, promos, large one-offs, and trends.", done:false },
    ];
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const merged = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings||{}) },
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist : base.checklist,
        data: { ...base.data, ...(parsed.data||{}) }
      };
      if (!merged.activeMonth) merged.activeMonth = base.activeMonth;
      return merged;
    } catch {
      return defaultState();
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setActiveMonth(mk){
    if (!mk || !/^\d{4}-\d{2}$/.test(mk)) return;
    state.activeMonth = mk;
    $("#activeMonthLabel").textContent = monthLabel(mk);
    $("#monthPicker").value = mk;
    saveState();
    refreshAll();
  }

  function inActiveMonth(dateStr){
    const mk = monthKeyFromDate(dateStr);
    return mk === state.activeMonth;
  }

  function byActiveMonth(arr, dateField){
    return arr.filter(x => inActiveMonth(x[dateField]));
  }

  function sum(arr, field){
    return arr.reduce((a,x)=>a + safeNum(x[field]), 0);
  }

  function mean(nums){
    if (!nums.length) return 0;
    return nums.reduce((a,n)=>a+n,0) / nums.length;
  }
  function stdDev(nums){
    if (nums.length < 2) return 0;
    const m = mean(nums);
    const v = nums.reduce((a,n)=>a + Math.pow(n-m,2),0) / (nums.length-1);
    return Math.sqrt(v);
  }
  function coeffVar(nums){
    const m = mean(nums);
    if (m === 0) return 0;
    return stdDev(nums) / Math.abs(m);
  }

  function getLastNMonths(n){
    const [y0,m0] = state.activeMonth.split("-").map(Number);
    const out = [];
    for (let i=0;i<n;i++){
      const d = new Date(y0, m0-1 - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
    }
    return out.reverse();
  }

  function monthTotals(mk){
    const rev = state.data.revenue.filter(r => monthKeyFromDate(r.date) === mk);
    const exp = state.data.expenses.filter(e => monthKeyFromDate(e.date) === mk);
    const revenue = sum(rev, "amount");
    const expenses = sum(exp, "amount");
    const profit = revenue - expenses;
    return { mk, revenue, expenses, profit };
  }

  function computeReadinessForMonth(mk){
    const rev = state.data.revenue.filter(r => monthKeyFromDate(r.date) === mk);
    const exp = state.data.expenses.filter(e => monthKeyFromDate(e.date) === mk);
    const inv = state.data.invoices.filter(i => monthKeyFromDate(i.issueDate) === mk);
    const dep = state.data.deposits.filter(d => monthKeyFromDate(d.date) === mk);

    let points = 0;
    let total = 10;

    if (rev.length > 0) points++;
    if (exp.length > 0) points++;
    if (inv.length > 0 || rev.some(x => (x.client||"").trim().length > 0)) points++;
    if (rev.length === 0 || dep.length > 0) points++;

    const matches = state.data.matches.filter(m => m.monthKey === mk);
    const linkedDepositIds = new Set(matches.map(m => m.depositId));
    const unmatchedDeposits = dep.filter(d => !linkedDepositIds.has(d.id));
    if (dep.length === 0 || unmatchedDeposits.length === 0) points++;

    const linkedRevenueIds = new Set(matches.map(m => m.revenueId).filter(Boolean));
    const linkedRevenueCount = rev.filter(r => linkedRevenueIds.has(r.id) || r.invoiceId).length;
    if (rev.length === 0 || linkedRevenueCount >= Math.ceil(rev.length/2)) points++;

    const paidInv = inv.filter(i => i.status === "paid");
    const paidComplete = paidInv.filter(i => i.paidDate && i.paymentRef).length;
    if (paidInv.length === 0 || paidComplete === paidInv.length) points++;

    const typedExp = exp.filter(e => e.type).length;
    if (exp.length === 0 || typedExp === exp.length) points++;

    if (!(rev.length > 0 && dep.length === 0)) points++;

    const totals = monthTotals(mk);
    const last6 = getLastNMonths(6).map(m=>monthTotals(m).revenue);
    const avg6 = mean(last6);
    const spike = avg6 > 0 && totals.revenue > (avg6 * 2.5);
    const hasExplanation = !spike || rev.some(r => (r.notes||"").trim().length >= 8);
    if (hasExplanation) points++;

    return Math.round((points/total)*100);
  }

  function readinessOverall(){
    const checklistDone = state.checklist.filter(c => c.done).length;
    const checklistScore = state.checklist.length ? (checklistDone/state.checklist.length)*100 : 0;

    const months = getLastNMonths(6);
    const monthScores = months.map(mk => computeReadinessForMonth(mk));
    const monthScore = monthScores.length ? mean(monthScores) : 0;

    return Math.round((checklistScore*0.45) + (monthScore*0.55));
  }

  function redFlagMessages(){
    const mk = state.activeMonth;
    const totals = monthTotals(mk);
    const dep = state.data.deposits.filter(d => monthKeyFromDate(d.date) === mk);
    const matches = state.data.matches.filter(m => m.monthKey === mk);
    const linkedDepositIds = new Set(matches.map(m => m.depositId));
    const unmatchedDeposits = dep.filter(d => !linkedDepositIds.has(d.id));

    const flags = [];

    if (totals.revenue > 0 && totals.expenses === 0) {
      flags.push({ level:"warn", title:"Revenue recorded but expenses are zero", sub:"Even low-expense businesses have at least software/fees. Track what’s real to avoid suspicion." });
    }
    if (totals.expenses > 0 && totals.revenue === 0) {
      flags.push({ level:"warn", title:"Expenses recorded but revenue is zero", sub:"If this month is a ramp month, add a note. Otherwise, check missing revenue entries." });
    }
    if (unmatchedDeposits.length > 0) {
      flags.push({ level:"bad", title:`${unmatchedDeposits.length} deposit(s) are not reconciled`, sub:"Unlinked deposits make audits slow and painful. Link deposits to invoices or revenue entries." });
    }

    const inv = state.data.invoices.filter(i => monthKeyFromDate(i.issueDate) === mk);
    const paidInv = inv.filter(i => i.status === "paid");
    const missingPaidFields = paidInv.filter(i => !(i.paidDate && i.paymentRef && safeNum(i.paidAmount) > 0));
    if (missingPaidFields.length > 0) {
      flags.push({ level:"bad", title:"Paid invoices missing payment details", sub:"Add paid date + paid amount + payment reference to prove cash trail." });
    }

    const rev = state.data.revenue.filter(r => monthKeyFromDate(r.date) === mk);
    const revByClient = {};
    for (const r of rev){
      const c = (r.client||"Unknown").trim() || "Unknown";
      revByClient[c] = (revByClient[c]||0) + safeNum(r.amount);
    }
    const total = totals.revenue || 0;
    if (total > 0){
      const entries = Object.entries(revByClient).sort((a,b)=>b[1]-a[1]);
      if (entries.length){
        const [topClient, topAmt] = entries[0];
        const share = topAmt/total;
        if (share > 0.6){
          flags.push({ level:"warn", title:"High customer concentration", sub:`Top client "${topClient}" is ~${Math.round(share*100)}% of revenue this month. Document risk + plan.` });
        }
      }
    }

    if (flags.length === 0){
      flags.push({ level:"good", title:"No major red flags detected for this month", sub:"Keep deposits reconciled and notes for any unusual spikes." });
    }
    return flags;
  }

  let state = loadState();

  function init(){
    $("#bizName").textContent = state.settings.businessName?.trim() || "Not set";
    $("#activeMonthLabel").textContent = monthLabel(state.activeMonth);
    $("#monthPicker").value = state.activeMonth;

    $$(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        goView(view);
      });
    });

    $$("[data-jump]").forEach(b => {
      b.addEventListener("click", () => goView(b.getAttribute("data-jump")));
    });

    $("#btnGoMonth").addEventListener("click", () => setActiveMonth($("#monthPicker").value));
    $("#monthPicker").addEventListener("change", () => setActiveMonth($("#monthPicker").value));

    $("#btnExportJSON").addEventListener("click", exportJSON);
    $("#fileImport").addEventListener("change", importJSON);

    $("#btnQuickAdd").addEventListener("click", () => openQuickAdd());

    $("#btnAddRevenue").addEventListener("click", () => openRevenueModal());
    $("#btnAddExpense").addEventListener("click", () => openExpenseModal());
    $("#btnAddInvoice").addEventListener("click", () => openInvoiceModal());
    $("#btnAddDeposit").addEventListener("click", () => openDepositModal());

    $("#btnExportRevenueCSV").addEventListener("click", () => exportCSV("revenue"));
    $("#btnExportExpensesCSV").addEventListener("click", () => exportCSV("expenses"));
    $("#btnExportInvoicesCSV").addEventListener("click", () => exportCSV("invoices"));
    $("#btnExportDepositsCSV").addEventListener("click", () => exportCSV("deposits"));

    $("#btnAutoMatch").addEventListener("click", () => autoMatchActiveMonth());
    $("#btnClearMatches").addEventListener("click", () => clearMatchesActiveMonth());

    $("#btnBuildPack").addEventListener("click", buildPack);
    $("#btnPrintPack").addEventListener("click", printPack);

    $("#btnMarkChecklist").addEventListener("click", markTypicalChecklistComplete);
    $("#btnResetChecklist").addEventListener("click", resetChecklist);

    $("#btnSaveSettings").addEventListener("click", saveSettingsFromUI);
    $("#btnResetAll").addEventListener("click", factoryReset);

    $("#btnCloseModal").addEventListener("click", closeModal);
    $("#btnModalCancel").addEventListener("click", closeModal);

    hydrateSettingsUI();
    renderChecklist();
    refreshAll();
  }

  function goView(viewName){
    $$(".nav-item").forEach(b => b.classList.toggle("active", b.getAttribute("data-view") === viewName));
    $$(".view").forEach(v => v.classList.remove("active"));
    const el = $(`#view-${viewName}`);
    if (el) el.classList.add("active");
    if (viewName === "reconcile") renderReconcile();
  }

  function refreshAll(){
    $("#bizName").textContent = state.settings.businessName?.trim() || "Not set";
    $("#activeMonthLabel").textContent = monthLabel(state.activeMonth);
    renderDashboard();
    renderRevenueTable();
    renderExpensesTable();
    renderInvoicesTable();
    renderDepositsTable();
    if ($("#view-reconcile").classList.contains("active")) renderReconcile();
    renderChecklistStatsChip();
  }

  function renderChecklistStatsChip(){
    const done = state.checklist.filter(c => c.done).length;
    $("#chipBusiness").title = `Checklist: ${done}/${state.checklist.length} done`;
  }

  function judgeConsistency(cv){
    if (cv === 0) return "No data yet";
    if (cv < 0.20) return "Very consistent";
    if (cv < 0.40) return "Mostly consistent";
    if (cv < 0.70) return "Volatile";
    return "Highly volatile";
  }

  function renderDashboard(){
    const currency = state.settings.currency;
    const mk = state.activeMonth;
    const totals = monthTotals(mk);
    const readiness = computeReadinessForMonth(mk);
    const overall = readinessOverall();

    $("#kpiRevenue").textContent = moneyFmt(totals.revenue, currency);
    $("#kpiExpenses").textContent = moneyFmt(totals.expenses, currency);

    const profitEl = $("#kpiProfit");
    profitEl.textContent = moneyFmt(totals.profit, currency);
    profitEl.style.color = (totals.profit >= 0) ? "var(--ink)" : "var(--danger)";

    const margin = totals.revenue === 0 ? 0 : (totals.profit / totals.revenue) * 100;
    $("#kpiMargin").textContent = `${margin.toFixed(1)}%`;

    const dep = state.data.deposits.filter(d => monthKeyFromDate(d.date) === mk);
    const matches = state.data.matches.filter(m => m.monthKey === mk);
    const linkedDepositIds = new Set(matches.map(m => m.depositId));
    const unmatchedDeposits = dep.filter(d => !linkedDepositIds.has(d.id));
    $("#kpiUnrec").textContent = String(unmatchedDeposits.length);

    $("#kpiReadiness").textContent = `${readiness}%`;

    const months = getLastNMonths(6);
    const totals6 = months.map(m => monthTotals(m));
    const revs = totals6.map(t => t.revenue);
    const profits = totals6.map(t => t.profit);

    const avgRev = mean(revs);
    const avgProfit = mean(profits);
    const volRev = coeffVar(revs);
    const volProfit = coeffVar(profits);

    $("#m6AvgRev").textContent = moneyFmt(avgRev, currency);
    $("#m6AvgProfit").textContent = moneyFmt(avgProfit, currency);
    $("#m6VolRev").textContent = avgRev === 0 ? "—" : `${(volRev*100).toFixed(1)}%`;
    $("#m6VolProfit").textContent = avgProfit === 0 ? "—" : `${(volProfit*100).toFixed(1)}%`;

    $("#pillRevConsistency").textContent = judgeConsistency(volRev);
    $("#pillProfitConsistency").textContent = judgeConsistency(volProfit);

    const rf = redFlagMessages();
    const rfBox = $("#redFlags");
    rfBox.innerHTML = "";
    rf.forEach(x => {
      const item = document.createElement("div");
      item.className = "list-item";
      const badgeClass = x.level === "good" ? "good" : (x.level === "warn" ? "warn" : "bad");
      item.innerHTML = `
        <div class="title"><span class="badge ${badgeClass}">${x.level.toUpperCase()}</span>${escapeHtml(x.title)}</div>
        <div class="sub">${escapeHtml(x.sub)}</div>
      `;
      rfBox.appendChild(item);
    });

    $("#chipMonth").title = `This month readiness: ${readiness}% • Overall readiness: ${overall}%`;
  }

  function renderRevenueTable(){
    const tbody = $("#tblRevenue tbody");
    tbody.innerHTML = "";
    const rows = byActiveMonth(state.data.revenue, "date")
      .sort((a,b)=> (a.date||"").localeCompare(b.date||""));

    rows.forEach(r => {
      const tr = document.createElement("tr");
      const inv = r.invoiceId ? findInvoice(r.invoiceId) : null;
      tr.innerHTML = `
        <td>${escapeHtml(r.date||"")}</td>
        <td>${escapeHtml(r.client||"")}</td>
        <td>${escapeHtml(r.category||"")}</td>
        <td>${escapeHtml(r.method||"")}</td>
        <td>${escapeHtml(moneyFmt(r.amount, state.settings.currency))}</td>
        <td>${inv ? escapeHtml(inv.number||"") : (r.invoiceId ? "Linked" : "")}</td>
        <td>${escapeHtml(r.notes||"")}</td>
        <td>
          <button class="btn btn-mini" data-edit="rev" data-id="${r.id}">Edit</button>
          <button class="btn btn-mini btn-danger" data-del="rev" data-id="${r.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit='rev']").forEach(b => b.addEventListener("click", () => openRevenueModal(b.dataset.id)));
    tbody.querySelectorAll("[data-del='rev']").forEach(b => b.addEventListener("click", () => delItem("revenue", b.dataset.id)));
  }

  function renderExpensesTable(){
    const tbody = $("#tblExpenses tbody");
    tbody.innerHTML = "";
    const rows = byActiveMonth(state.data.expenses, "date")
      .sort((a,b)=> (a.date||"").localeCompare(b.date||""));

    rows.forEach(e => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(e.date||"")}</td>
        <td>${escapeHtml(e.vendor||"")}</td>
        <td>${escapeHtml(e.type||"")}</td>
        <td>${escapeHtml(e.category||"")}</td>
        <td>${escapeHtml(e.method||"")}</td>
        <td>${escapeHtml(moneyFmt(e.amount, state.settings.currency))}</td>
        <td>${escapeHtml(e.notes||"")}</td>
        <td>
          <button class="btn btn-mini" data-edit="exp" data-id="${e.id}">Edit</button>
          <button class="btn btn-mini btn-danger" data-del="exp" data-id="${e.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit='exp']").forEach(b => b.addEventListener("click", () => openExpenseModal(b.dataset.id)));
    tbody.querySelectorAll("[data-del='exp']").forEach(b => b.addEventListener("click", () => delItem("expenses", b.dataset.id)));
  }

  function renderInvoicesTable(){
    const tbody = $("#tblInvoices tbody");
    tbody.innerHTML = "";
    const rows = state.data.invoices
      .filter(i => monthKeyFromDate(i.issueDate) === state.activeMonth)
      .sort((a,b)=> (a.issueDate||"").localeCompare(b.issueDate||""));

    rows.forEach(i => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(i.number||"")}</td>
        <td>${escapeHtml(i.client||"")}</td>
        <td>${escapeHtml(i.issueDate||"")}</td>
        <td>${escapeHtml(i.dueDate||"")}</td>
        <td>${escapeHtml((i.status||"").toUpperCase())}</td>
        <td>${escapeHtml(moneyFmt(i.amount, state.settings.currency))}</td>
        <td>${i.status === "paid" ? escapeHtml(i.paidDate||"") : ""}</td>
        <td>${escapeHtml(i.paymentRef||"")}</td>
        <td>
          <button class="btn btn-mini" data-edit="inv" data-id="${i.id}">Edit</button>
          <button class="btn btn-mini btn-danger" data-del="inv" data-id="${i.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit='inv']").forEach(b => b.addEventListener("click", () => openInvoiceModal(b.dataset.id)));
    tbody.querySelectorAll("[data-del='inv']").forEach(b => b.addEventListener("click", () => delItem("invoices", b.dataset.id)));
  }

  function renderDepositsTable(){
    const tbody = $("#tblDeposits tbody");
    tbody.innerHTML = "";
    const rows = state.data.deposits
      .filter(d => monthKeyFromDate(d.date) === state.activeMonth)
      .sort((a,b)=> (a.date||"").localeCompare(b.date||""));

    const matches = state.data.matches.filter(m => m.monthKey === state.activeMonth);
    const matchByDeposit = new Map(matches.map(m => [m.depositId, m]));

    rows.forEach(d => {
      const m = matchByDeposit.get(d.id);
      const inv = m?.invoiceId ? findInvoice(m.invoiceId) : (d.linkedInvoiceId ? findInvoice(d.linkedInvoiceId) : null);
      const rev = m?.revenueId ? findRevenue(m.revenueId) : (d.linkedRevenueId ? findRevenue(d.linkedRevenueId) : null);

      const status = (m || d.linkedInvoiceId || d.linkedRevenueId) ? "Linked" : "Unlinked";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(d.date||"")}</td>
        <td>${escapeHtml(d.desc||"")}</td>
        <td>${escapeHtml(moneyFmt(d.amount, state.settings.currency))}</td>
        <td>${inv ? escapeHtml(inv.number||"") : ""}</td>
        <td>${rev ? escapeHtml(rev.client||"") : ""}</td>
        <td>${status}</td>
        <td>
          <button class="btn btn-mini" data-edit="dep" data-id="${d.id}">Edit</button>
          <button class="btn btn-mini btn-danger" data-del="dep" data-id="${d.id}">Del</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-edit='dep']").forEach(b => b.addEventListener("click", () => openDepositModal(b.dataset.id)));
    tbody.querySelectorAll("[data-del='dep']").forEach(b => b.addEventListener("click", () => delItem("deposits", b.dataset.id)));
  }

  let selectedDepositId = null;

  function renderReconcile(){
    const mk = state.activeMonth;
    const dep = state.data.deposits.filter(d => monthKeyFromDate(d.date) === mk);
    const matches = state.data.matches.filter(m => m.monthKey === mk);
    const linkedDepositIds = new Set(matches.map(m => m.depositId));
    const unmatched = dep.filter(d => !linkedDepositIds.has(d.id));

    const left = $("#listUnmatchedDeposits");
    left.innerHTML = "";
    if (unmatched.length === 0){
      left.innerHTML = `<div class="list-item"><div class="title"><span class="badge good">GOOD</span>All deposits are linked</div><div class="sub">This month’s bank trail is clean.</div></div>`;
    } else {
      unmatched.forEach(d => {
        const it = document.createElement("div");
        it.className = "list-item";
        it.style.cursor = "pointer";
        it.innerHTML = `
          <div class="title">${escapeHtml(moneyFmt(d.amount, state.settings.currency))} <span class="badge warn">UNMATCHED</span></div>
          <div class="sub">${escapeHtml(d.date||"")} • ${escapeHtml(d.desc||"")}</div>
          <div class="actions">
            <button class="btn btn-mini btn-gold" data-pick="${d.id}">Select</button>
          </div>
        `;
        left.appendChild(it);
        it.querySelector(`[data-pick="${d.id}"]`).addEventListener("click", (ev) => {
          ev.stopPropagation();
          selectedDepositId = d.id;
          renderCandidates();
        });
        it.addEventListener("click", () => { selectedDepositId = d.id; renderCandidates(); });
      });
    }

    renderCandidates();
  }

  function renderCandidates(){
    const box = $("#listMatchCandidates");
    box.innerHTML = "";
    if (!selectedDepositId){
      box.innerHTML = `<div class="list-item"><div class="title">No deposit selected</div><div class="sub">Pick an unmatched deposit to see match suggestions.</div></div>`;
      return;
    }
    const deposit = state.data.deposits.find(d => d.id === selectedDepositId);
    if (!deposit){
      selectedDepositId = null;
      return renderCandidates();
    }

    const mk = state.activeMonth;
    const inv = state.data.invoices.filter(i => monthKeyFromDate(i.issueDate) === mk);
    const rev = state.data.revenue.filter(r => monthKeyFromDate(r.date) === mk);

    const amount = safeNum(deposit.amount);
    const depDate = new Date(deposit.date);
    const withinDays = (dateStr, days) => {
      const dt = new Date(dateStr);
      if (Number.isNaN(dt.getTime()) || Number.isNaN(depDate.getTime())) return false;
      const diff = Math.abs(dt.getTime() - depDate.getTime());
      return diff <= (days * 24 * 60 * 60 * 1000);
    };

    const invCandidates = inv
      .map(i => {
        const target = (i.status === "paid" && safeNum(i.paidAmount) > 0) ? safeNum(i.paidAmount) : safeNum(i.amount);
        const amountClose = Math.abs(target - amount) <= 0.01;
        const dateClose = withinDays(i.paidDate || i.issueDate, 10);
        const score = (amountClose ? 3 : 0) + (dateClose ? 2 : 0) + (i.status === "paid" ? 1 : 0);
        return { i, target, score };
      })
      .filter(x => x.score > 0)
      .sort((a,b)=> b.score - a.score);

    const revCandidates = rev
      .map(r => {
        const amountClose = Math.abs(safeNum(r.amount) - amount) <= 0.01;
        const dateClose = withinDays(r.date, 7);
        const score = (amountClose ? 3 : 0) + (dateClose ? 2 : 0) + (r.invoiceId ? 1 : 0);
        return { r, score };
      })
      .filter(x => x.score > 0)
      .sort((a,b)=> b.score - a.score);

    const head = document.createElement("div");
    head.className = "list-item";
    head.innerHTML = `
      <div class="title">Selected Deposit: ${escapeHtml(moneyFmt(deposit.amount, state.settings.currency))}</div>
      <div class="sub">${escapeHtml(deposit.date||"")} • ${escapeHtml(deposit.desc||"")}</div>
    `;
    box.appendChild(head);

    if (invCandidates.length === 0 && revCandidates.length === 0){
      const it = document.createElement("div");
      it.className = "list-item";
      it.innerHTML = `<div class="title"><span class="badge warn">NO MATCHES</span>No candidates found</div>
                      <div class="sub">Create an invoice/revenue entry that matches this deposit, or edit the deposit description/amount.</div>`;
      box.appendChild(it);
      return;
    }

    if (invCandidates.length){
      const section = document.createElement("div");
      section.className = "list-item";
      section.innerHTML = `<div class="title">Invoice matches</div><div class="sub">Match deposit → invoice payment.</div>`;
      box.appendChild(section);

      invCandidates.slice(0,8).forEach(x => {
        const it = document.createElement("div");
        it.className = "list-item";
        it.innerHTML = `
          <div class="title">
            <span class="badge ${x.score>=4?'good':'warn'}">SCORE ${x.score}</span>
            Invoice ${escapeHtml(x.i.number||"")} • ${escapeHtml(x.i.client||"")}
          </div>
          <div class="sub">
            Amount: ${escapeHtml(moneyFmt(x.target, state.settings.currency))} • Status: ${escapeHtml((x.i.status||"").toUpperCase())}
            ${x.i.paidDate ? ` • Paid: ${escapeHtml(x.i.paidDate)}` : ""}
          </div>
          <div class="actions">
            <button class="btn btn-mini btn-gold" data-link-inv="${x.i.id}">Link to this Invoice</button>
          </div>
        `;
        it.querySelector(`[data-link-inv="${x.i.id}"]`).addEventListener("click", () => {
          linkDeposit(deposit.id, x.i.id, null);
        });
        box.appendChild(it);
      });
    }

    if (revCandidates.length){
      const section = document.createElement("div");
      section.className = "list-item";
      section.innerHTML = `<div class="title">Revenue entry matches</div><div class="sub">Match deposit → specific sale record.</div>`;
      box.appendChild(section);

      revCandidates.slice(0,8).forEach(x => {
        const it = document.createElement("div");
        it.className = "list-item";
        it.innerHTML = `
          <div class="title">
            <span class="badge ${x.score>=4?'good':'warn'}">SCORE ${x.score}</span>
            ${escapeHtml(x.r.client||"Unknown")} • ${escapeHtml(x.r.category||"")}
          </div>
          <div class="sub">
            ${escapeHtml(x.r.date||"")} • ${escapeHtml(moneyFmt(x.r.amount, state.settings.currency))}
            ${x.r.invoiceId ? ` • Invoice linked` : ""}
          </div>
          <div class="actions">
            <button class="btn btn-mini btn-gold" data-link-rev="${x.r.id}">Link to this Revenue Entry</button>
          </div>
        `;
        it.querySelector(`[data-link-rev="${x.r.id}"]`).addEventListener("click", () => {
          linkDeposit(deposit.id, null, x.r.id);
        });
        box.appendChild(it);
      });
    }
  }

  function linkDeposit(depositId, invoiceId, revenueId){
    const mk = state.activeMonth;
    const idx = state.data.matches.findIndex(m => m.monthKey === mk && m.depositId === depositId);
    const record = { monthKey: mk, depositId, invoiceId: invoiceId || null, revenueId: revenueId || null };
    if (idx >= 0) state.data.matches[idx] = record;
    else state.data.matches.push(record);

    saveState();
    refreshAll();
    goView("reconcile");
  }

  function autoMatchActiveMonth(){
    const mk = state.activeMonth;
    const dep = state.data.deposits.filter(d => monthKeyFromDate(d.date) === mk);
    const inv = state.data.invoices.filter(i => monthKeyFromDate(i.issueDate) === mk);
    const rev = state.data.revenue.filter(r => monthKeyFromDate(r.date) === mk);

    const matches = state.data.matches.filter(m => m.monthKey === mk);
    const linkedDepositIds = new Set(matches.map(m => m.depositId));
    const unmatched = dep.filter(d => !linkedDepositIds.has(d.id));

    let made = 0;
    for (const d of unmatched){
      const amount = safeNum(d.amount);
      const depDate = new Date(d.date);
      const within = (dateStr, days) => {
        const dt = new Date(dateStr);
        if (Number.isNaN(dt.getTime()) || Number.isNaN(depDate.getTime())) return false;
        return Math.abs(dt.getTime() - depDate.getTime()) <= days*24*60*60*1000;
      };

      let bestInv = null;
      for (const i of inv){
        const target = (i.status === "paid" && safeNum(i.paidAmount) > 0) ? safeNum(i.paidAmount) : safeNum(i.amount);
        const amountOk = Math.abs(target - amount) <= 0.01;
        const dateOk = within(i.paidDate || i.issueDate, 10);
        if (amountOk && dateOk && i.status === "paid"){
          bestInv = i;
          break;
        }
      }
      if (bestInv){
        linkDeposit(d.id, bestInv.id, null);
        made++;
        continue;
      }

      for (const i of inv){
        const target = safeNum(i.amount);
        const amountOk = Math.abs(target - amount) <= 0.01;
        const dateOk = within(i.issueDate, 10);
        if (amountOk && dateOk){
          linkDeposit(d.id, i.id, null);
          made++;
          bestInv = i;
          break;
        }
      }
      if (bestInv) continue;

      let bestRev = null;
      for (const r of rev){
        const amountOk = Math.abs(safeNum(r.amount) - amount) <= 0.01;
        const dateOk = within(r.date, 7);
        if (amountOk && dateOk){
          bestRev = r;
          break;
        }
      }
      if (bestRev){
        linkDeposit(d.id, null, bestRev.id);
        made++;
      }
    }

    alert(`Auto-match complete. Linked ${made} deposit(s).`);
    renderReconcile();
  }

  function clearMatchesActiveMonth(){
    const mk = state.activeMonth;
    state.data.matches = state.data.matches.filter(m => m.monthKey !== mk);
    saveState();
    refreshAll();
    renderReconcile();
  }

  function delItem(kind, id){
    const ok = confirm("Delete this item? This cannot be undone.");
    if (!ok) return;

    if (kind === "revenue") state.data.revenue = state.data.revenue.filter(x => x.id !== id);
    if (kind === "expenses") state.data.expenses = state.data.expenses.filter(x => x.id !== id);
    if (kind === "invoices") {
      state.data.invoices = state.data.invoices.filter(x => x.id !== id);
      state.data.revenue = state.data.revenue.map(r => (r.invoiceId === id ? { ...r, invoiceId: "" } : r));
      state.data.matches = state.data.matches.map(m => (m.invoiceId === id ? { ...m, invoiceId:null } : m));
    }
    if (kind === "deposits"){
      state.data.deposits = state.data.deposits.filter(x => x.id !== id);
      state.data.matches = state.data.matches.filter(m => m.depositId !== id);
    }

    saveState();
    refreshAll();
  }

  function findInvoice(id){ return state.data.invoices.find(i => i.id === id) || null; }
  function findRevenue(id){ return state.data.revenue.find(r => r.id === id) || null; }

  let modalCtx = null;

  function openModal(title, bodyHtml, onSave){
    modalCtx = { onSave };
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = bodyHtml;

    $("#btnModalSave").onclick = () => {
      if (modalCtx?.onSave) modalCtx.onSave();
    };

    $("#modalBackdrop").classList.remove("hidden");
  }

  function closeModal(){
    $("#modalBackdrop").classList.add("hidden");
    $("#modalBody").innerHTML = "";
    modalCtx = null;
  }

  function openQuickAdd(){
    openModal("Quick Add", `
      <div class="grid-2">
        <div class="card" style="margin:0">
          <div class="card-title">Add Revenue</div>
          <div class="form">
            <label class="label">Date</label>
            <input class="input" id="qa_rev_date" type="date" value="${state.activeMonth}-01" />
            <label class="label">Client</label>
            <input class="input" id="qa_rev_client" placeholder="Client name" />
            <label class="label">Category</label>
            <input class="input" id="qa_rev_cat" placeholder="Service / Product" />
            <label class="label">Method</label>
            <select class="input" id="qa_rev_method">
              <option>Card</option><option>ACH</option><option>Cash</option><option>Check</option><option>Stripe</option><option>Square</option><option>Other</option>
            </select>
            <label class="label">Amount</label>
            <input class="input" id="qa_rev_amt" type="number" step="0.01" placeholder="0.00" />
            <label class="label">Notes</label>
            <input class="input" id="qa_rev_notes" placeholder="Optional" />
          </div>
        </div>

        <div class="card" style="margin:0">
          <div class="card-title">Add Expense</div>
          <div class="form">
            <label class="label">Date</label>
            <input class="input" id="qa_exp_date" type="date" value="${state.activeMonth}-01" />
            <label class="label">Vendor</label>
            <input class="input" id="qa_exp_vendor" placeholder="Vendor name" />
            <label class="label">Type</label>
            <select class="input" id="qa_exp_type">
              <option value="COGS">COGS</option>
              <option value="OpEx">OpEx</option>
              <option value="Tax">Tax</option>
              <option value="Fees">Fees</option>
              <option value="Payroll">Payroll</option>
              <option value="Contractor">Contractor</option>
              <option value="Other">Other</option>
            </select>
            <label class="label">Category</label>
            <input class="input" id="qa_exp_cat" placeholder="Rent / Software / Ads / Supplies" />
            <label class="label">Method</label>
            <select class="input" id="qa_exp_method">
              <option>Card</option><option>ACH</option><option>Cash</option><option>Check</option><option>Other</option>
            </select>
            <label class="label">Amount</label>
            <input class="input" id="qa_exp_amt" type="number" step="0.01" placeholder="0.00" />
            <label class="label">Notes</label>
            <input class="input" id="qa_exp_notes" placeholder="Optional" />
          </div>
        </div>
      </div>
    `, () => {
      const rAmt = safeNum($("#qa_rev_amt").value);
      if (rAmt > 0){
        state.data.revenue.push({
          id: uid(),
          date: $("#qa_rev_date").value,
          client: $("#qa_rev_client").value.trim(),
          category: $("#qa_rev_cat").value.trim(),
          method: $("#qa_rev_method").value,
          amount: rAmt,
          invoiceId: "",
          notes: $("#qa_rev_notes").value.trim()
        });
      }
      const eAmt = safeNum($("#qa_exp_amt").value);
      if (eAmt > 0){
        state.data.expenses.push({
          id: uid(),
          date: $("#qa_exp_date").value,
          vendor: $("#qa_exp_vendor").value.trim(),
          type: $("#qa_exp_type").value,
          category: $("#qa_exp_cat").value.trim(),
          method: $("#qa_exp_method").value,
          amount: eAmt,
          notes: $("#qa_exp_notes").value.trim()
        });
      }
      saveState();
      closeModal();
      refreshAll();
    });
  }

  function openRevenueModal(editId=null){
    const r = editId ? state.data.revenue.find(x => x.id === editId) : null;
    const invoices = state.data.invoices.filter(i => monthKeyFromDate(i.issueDate) === state.activeMonth);

    openModal(editId ? "Edit Revenue" : "Add Revenue", `
      <div class="form">
        <label class="label">Date</label>
        <input class="input" id="rev_date" type="date" value="${escapeAttr(r?.date || `${state.activeMonth}-01`)}" />
        <label class="label">Client</label>
        <input class="input" id="rev_client" value="${escapeAttr(r?.client||"")}" placeholder="Client name" />
        <label class="label">Category</label>
        <input class="input" id="rev_cat" value="${escapeAttr(r?.category||"")}" placeholder="Service / Product" />
        <label class="label">Method</label>
        <select class="input" id="rev_method">
          ${["Card","ACH","Cash","Check","Stripe","Square","Other"].map(m => `<option ${r?.method===m?"selected":""}>${m}</option>`).join("")}
        </select>
        <label class="label">Amount</label>
        <input class="input" id="rev_amt" type="number" step="0.01" value="${escapeAttr(String(r?.amount ?? ""))}" placeholder="0.00" />
        <label class="label">Link to Invoice (optional)</label>
        <select class="input" id="rev_invoice">
          <option value="">— none —</option>
          ${invoices.map(i => `<option value="${i.id}" ${r?.invoiceId===i.id?"selected":""}>${escapeHtml(i.number||"(no #)")} • ${escapeHtml(i.client||"")}</option>`).join("")}
        </select>
        <label class="label">Notes</label>
        <input class="input" id="rev_notes" value="${escapeAttr(r?.notes||"")}" placeholder="Explain spikes, special deals, partial payments..." />
      </div>
    `, () => {
      const obj = {
        id: r?.id || uid(),
        date: $("#rev_date").value,
        client: $("#rev_client").value.trim(),
        category: $("#rev_cat").value.trim(),
        method: $("#rev_method").value,
        amount: safeNum($("#rev_amt").value),
        invoiceId: $("#rev_invoice").value,
        notes: $("#rev_notes").value.trim()
      };
      if (!obj.date) return alert("Date is required.");
      if (!(obj.amount > 0)) return alert("Amount must be > 0.");

      if (r){
        state.data.revenue = state.data.revenue.map(x => x.id === r.id ? obj : x);
      } else {
        state.data.revenue.push(obj);
      }
      saveState();
      closeModal();
      refreshAll();
    });
  }

  function openExpenseModal(editId=null){
    const e = editId ? state.data.expenses.find(x => x.id === editId) : null;

    openModal(editId ? "Edit Expense" : "Add Expense", `
      <div class="form">
        <label class="label">Date</label>
        <input class="input" id="exp_date" type="date" value="${escapeAttr(e?.date || `${state.activeMonth}-01`)}" />
        <label class="label">Vendor</label>
        <input class="input" id="exp_vendor" value="${escapeAttr(e?.vendor||"")}" placeholder="Vendor name" />
        <label class="label">Type</label>
        <select class="input" id="exp_type">
          ${["COGS","OpEx","Tax","Fees","Payroll","Contractor","Other"].map(t => `<option value="${t}" ${e?.type===t?"selected":""}>${t}</option>`).join("")}
        </select>
        <label class="label">Category</label>
        <input class="input" id="exp_cat" value="${escapeAttr(e?.category||"")}" placeholder="Rent / Software / Ads / Supplies" />
        <label class="label">Method</label>
        <select class="input" id="exp_method">
          ${["Card","ACH","Cash","Check","Other"].map(m => `<option ${e?.method===m?"selected":""}>${m}</option>`).join("")}
        </select>
        <label class="label">Amount</label>
        <input class="input" id="exp_amt" type="number" step="0.01" value="${escapeAttr(String(e?.amount ?? ""))}" placeholder="0.00" />
        <label class="label">Notes</label>
        <input class="input" id="exp_notes" value="${escapeAttr(e?.notes||"")}" placeholder="Optional context" />
      </div>
    `, () => {
      const obj = {
        id: e?.id || uid(),
        date: $("#exp_date").value,
        vendor: $("#exp_vendor").value.trim(),
        type: $("#exp_type").value,
        category: $("#exp_cat").value.trim(),
        method: $("#exp_method").value,
        amount: safeNum($("#exp_amt").value),
        notes: $("#exp_notes").value.trim()
      };
      if (!obj.date) return alert("Date is required.");
      if (!(obj.amount > 0)) return alert("Amount must be > 0.");

      if (e){
        state.data.expenses = state.data.expenses.map(x => x.id === e.id ? obj : x);
      } else {
        state.data.expenses.push(obj);
      }
      saveState();
      closeModal();
      refreshAll();
    });
  }

  function openInvoiceModal(editId=null){
    const inv = editId ? state.data.invoices.find(x => x.id === editId) : null;

    const nextN = (state.data.invoices.length + 1).toString().padStart(4,"0");
    const suggested = `INV-${state.activeMonth.replace("-","")}-${nextN}`;

    openModal(editId ? "Edit Invoice" : "Create Invoice", `
      <div class="form">
        <label class="label">Invoice number</label>
        <input class="input" id="inv_no" value="${escapeAttr(inv?.number || suggested)}" />
        <label class="label">Client</label>
        <input class="input" id="inv_client" value="${escapeAttr(inv?.client||"")}" placeholder="Client name" />
        <div class="grid-2">
          <div>
            <label class="label">Issue date</label>
            <input class="input" id="inv_issue" type="date" value="${escapeAttr(inv?.issueDate || `${state.activeMonth}-01`)}" />
          </div>
          <div>
            <label class="label">Due date</label>
            <input class="input" id="inv_due" type="date" value="${escapeAttr(inv?.dueDate || `${state.activeMonth}-15`)}" />
          </div>
        </div>
        <label class="label">Amount</label>
        <input class="input" id="inv_amt" type="number" step="0.01" value="${escapeAttr(String(inv?.amount ?? ""))}" placeholder="0.00" />

        <label class="label">Status</label>
        <select class="input" id="inv_status">
          ${["draft","sent","paid","void"].map(s => `<option value="${s}" ${(inv?.status||"sent")===s?"selected":""}>${s.toUpperCase()}</option>`).join("")}
        </select>

        <div class="grid-2">
          <div>
            <label class="label">Paid date (if PAID)</label>
            <input class="input" id="inv_paidDate" type="date" value="${escapeAttr(inv?.paidDate || "")}" />
          </div>
          <div>
            <label class="label">Paid amount (if PAID)</label>
            <input class="input" id="inv_paidAmt" type="number" step="0.01" value="${escapeAttr(String(inv?.paidAmount ?? ""))}" placeholder="0.00" />
          </div>
        </div>

        <label class="label">Payment reference (if PAID)</label>
        <input class="input" id="inv_payRef" value="${escapeAttr(inv?.paymentRef||"")}" placeholder="Stripe charge ID / ACH trace / check #" />
      </div>
    `, () => {
      const obj = {
        id: inv?.id || uid(),
        number: $("#inv_no").value.trim(),
        client: $("#inv_client").value.trim(),
        issueDate: $("#inv_issue").value,
        dueDate: $("#inv_due").value,
        status: $("#inv_status").value,
        amount: safeNum($("#inv_amt").value),
        paidDate: $("#inv_paidDate").value,
        paidAmount: safeNum($("#inv_paidAmt").value),
        paymentRef: $("#inv_payRef").value.trim()
      };
      if (!obj.number) return alert("Invoice number is required.");
      if (!obj.client) return alert("Client is required.");
      if (!obj.issueDate) return alert("Issue date is required.");
      if (!(obj.amount > 0)) return alert("Amount must be > 0.");

      if (obj.status === "paid"){
        if (!obj.paidDate) return alert("Paid date is required when status is PAID.");
        if (!(obj.paidAmount > 0)) obj.paidAmount = obj.amount;
        if (!obj.paymentRef) return alert("Payment reference is required when status is PAID.");
      } else {
        obj.paidDate = "";
        obj.paidAmount = 0;
        obj.paymentRef = "";
      }

      if (inv){
        state.data.invoices = state.data.invoices.map(x => x.id === inv.id ? obj : x);
      } else {
        state.data.invoices.push(obj);
      }
      saveState();
      closeModal();
      refreshAll();
    });
  }

  function openDepositModal(editId=null){
    const d = editId ? state.data.deposits.find(x => x.id === editId) : null;

    openModal(editId ? "Edit Deposit" : "Add Bank Deposit", `
      <div class="form">
        <label class="label">Deposit date</label>
        <input class="input" id="dep_date" type="date" value="${escapeAttr(d?.date || `${state.activeMonth}-01`)}" />
        <label class="label">Description</label>
        <input class="input" id="dep_desc" value="${escapeAttr(d?.desc||"")}" placeholder="Stripe payout / ACH / check deposit / cash deposit" />
        <label class="label">Amount</label>
        <input class="input" id="dep_amt" type="number" step="0.01" value="${escapeAttr(String(d?.amount ?? ""))}" placeholder="0.00" />
        <div class="tiny">Linking happens in Reconcile. Keep deposits clean and consistent.</div>
      </div>
    `, () => {
      const obj = {
        id: d?.id || uid(),
        date: $("#dep_date").value,
        desc: $("#dep_desc").value.trim(),
        amount: safeNum($("#dep_amt").value),
        linkedInvoiceId: "",
        linkedRevenueId: ""
      };
      if (!obj.date) return alert("Date is required.");
      if (!(obj.amount > 0)) return alert("Amount must be > 0.");

      if (d){
        state.data.deposits = state.data.deposits.map(x => x.id === d.id ? obj : x);
      } else {
        state.data.deposits.push(obj);
      }
      saveState();
      closeModal();
      refreshAll();
    });
  }

  function renderChecklist(){
    const wrap = $("#checklist");
    wrap.innerHTML = "";
    state.checklist.forEach(item => {
      const el = document.createElement("div");
      el.className = "chk";
      el.innerHTML = `
        <input type="checkbox" ${item.done ? "checked":""} data-chk="${item.id}" />
        <div>
          <div class="t">${escapeHtml(item.title)}</div>
          <div class="d">${escapeHtml(item.desc)}</div>
        </div>
      `;
      wrap.appendChild(el);
    });

    wrap.querySelectorAll("[data-chk]").forEach(cb => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.chk;
        state.checklist = state.checklist.map(x => x.id === id ? { ...x, done: cb.checked } : x);
        saveState();
        refreshAll();
      });
    });
  }

  function markTypicalChecklistComplete(){
    const typical = new Set(["c_bank_sep","c_reconcile","c_invoices","c_receipts","c_cogs_opex","c_monthly_pl","c_refunds","c_consistency"]);
    state.checklist = state.checklist.map(x => ({ ...x, done: typical.has(x.id) ? true : x.done }));
    saveState();
    renderChecklist();
    refreshAll();
  }

  function resetChecklist(){
    state.checklist = buildDefaultChecklist();
    saveState();
    renderChecklist();
    refreshAll();
  }

  function hydrateSettingsUI(){
    $("#setBizName").value = state.settings.businessName || "";
    $("#setCurrency").value = state.settings.currency || "USD";
    $("#setBasis").value = state.settings.basis || "cash";
    $("#setFYStart").value = String(state.settings.fiscalYearStartMonth || 1);
    $("#setAdvisor").value = state.settings.advisorName || "Skyes Over London LC";
    $("#setContact").value = state.settings.contactEmail || "SkyesOverLondonLC@solenterprises.org";
    $("#setNotes").value = state.settings.clientNotes || "";
  }

  function saveSettingsFromUI(){
    state.settings.businessName = $("#setBizName").value.trim();
    state.settings.currency = $("#setCurrency").value;
    state.settings.basis = $("#setBasis").value;
    state.settings.fiscalYearStartMonth = Number($("#setFYStart").value) || 1;
    state.settings.advisorName = $("#setAdvisor").value.trim();
    state.settings.contactEmail = $("#setContact").value.trim();
    state.settings.clientNotes = $("#setNotes").value.trim();
    saveState();
    refreshAll();
    alert("Settings saved.");
  }

  function factoryReset(){
    const ok = confirm("Factory reset deletes ALL data on this device. Continue?");
    if (!ok) return;
    state = defaultState();
    saveState();
    hydrateSettingsUI();
    renderChecklist();
    setActiveMonth(state.activeMonth);
    refreshAll();
    alert("Reset complete.");
  }

  function exportJSON(){
    const payload = deepClone(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const name = `${(state.settings.businessName||"business").replace(/[^\w\-]+/g,"_")}_audit_console_${state.activeMonth}.json`;
    downloadBlob(blob, name);
  }

  function importJSON(ev){
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
        if (!parsed.data || !parsed.settings) throw new Error("Missing keys");
        state = {
          ...defaultState(),
          ...parsed,
          settings: { ...defaultState().settings, ...(parsed.settings||{}) },
          data: { ...defaultState().data, ...(parsed.data||{}) },
          checklist: Array.isArray(parsed.checklist) ? parsed.checklist : buildDefaultChecklist()
        };
        saveState();
        hydrateSettingsUI();
        renderChecklist();
        setActiveMonth(state.activeMonth);
        refreshAll();
        alert("Import complete.");
      } catch (e){
        alert("Import failed. Make sure you selected a valid export file.");
      } finally {
        ev.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function exportCSV(kind){
    const mk = state.activeMonth;
    let rows = [];
    let header = [];

    if (kind === "revenue"){
      header = ["date","client","category","method","amount","invoiceNumber","notes"];
      rows = state.data.revenue
        .filter(r => monthKeyFromDate(r.date) === mk)
        .map(r => {
          const inv = r.invoiceId ? findInvoice(r.invoiceId) : null;
          return [
            r.date||"",
            r.client||"",
            r.category||"",
            r.method||"",
            String(safeNum(r.amount).toFixed(2)),
            inv?.number || "",
            r.notes||""
          ];
        });
    }
    if (kind === "expenses"){
      header = ["date","vendor","type","category","method","amount","notes"];
      rows = state.data.expenses
        .filter(e => monthKeyFromDate(e.date) === mk)
        .map(e => [
          e.date||"",
          e.vendor||"",
          e.type||"",
          e.category||"",
          e.method||"",
          String(safeNum(e.amount).toFixed(2)),
          e.notes||""
        ]);
    }
    if (kind === "invoices"){
      header = ["number","client","issueDate","dueDate","status","amount","paidDate","paidAmount","paymentRef"];
      rows = state.data.invoices
        .filter(i => monthKeyFromDate(i.issueDate) === mk)
        .map(i => [
          i.number||"",
          i.client||"",
          i.issueDate||"",
          i.dueDate||"",
          i.status||"",
          String(safeNum(i.amount).toFixed(2)),
          i.paidDate||"",
          String(safeNum(i.paidAmount).toFixed(2)),
          i.paymentRef||""
        ]);
    }
    if (kind === "deposits"){
      header = ["date","description","amount","linkedInvoiceNumber","linkedRevenueClient","status"];
      const matches = state.data.matches.filter(m => m.monthKey === mk);
      const matchByDeposit = new Map(matches.map(m => [m.depositId, m]));
      rows = state.data.deposits
        .filter(d => monthKeyFromDate(d.date) === mk)
        .map(d => {
          const m = matchByDeposit.get(d.id);
          const inv = m?.invoiceId ? findInvoice(m.invoiceId) : null;
          const rev = m?.revenueId ? findRevenue(m.revenueId) : null;
          const status = (m?.invoiceId || m?.revenueId) ? "Linked" : "Unlinked";
          return [
            d.date||"",
            d.desc||"",
            String(safeNum(d.amount).toFixed(2)),
            inv?.number || "",
            rev?.client || "",
            status
          ];
        });
    }

    const csv = toCSV([header, ...rows]);
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const name = `${(state.settings.businessName||"business").replace(/[^\w\-]+/g,"_")}_${kind}_${mk}.csv`;
    downloadBlob(blob, name);
  }

  function toCSV(rows){
    return rows.map(cols => cols.map(v => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"\${s.replace(/"/g,'""')}"`;
      return s;
    }).join(",")).join("\n");
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  let lastPackHtml = "";

  function buildPack(){
    const mk = state.activeMonth;
    const s = state.settings;
    const currency = s.currency;
    const totals = monthTotals(mk);
    const readiness = computeReadinessForMonth(mk);
    const overall = readinessOverall();

    const rev = state.data.revenue.filter(r => monthKeyFromDate(r.date) === mk);
    const exp = state.data.expenses.filter(e => monthKeyFromDate(e.date) === mk);
    const inv = state.data.invoices.filter(i => monthKeyFromDate(i.issueDate) === mk);
    const dep = state.data.deposits.filter(d => monthKeyFromDate(d.date) === mk);

    const matches = state.data.matches.filter(m => m.monthKey === mk);
    const linkedDepositIds = new Set(matches.map(m => m.depositId));
    const unmatchedDep = dep.filter(d => !linkedDepositIds.has(d.id));

    const checklistDone = state.checklist.filter(c => c.done).length;

    const six = getLastNMonths(6).map(m => monthTotals(m));
    const avgRev = mean(six.map(x => x.revenue));
    const avgProfit = mean(six.map(x => x.profit));
    const volRev = coeffVar(six.map(x => x.revenue));
    const volProfit = coeffVar(six.map(x => x.profit));

    const flags = redFlagMessages();

    const reportText = [
      `AUDIT READINESS PACK — ${monthLabel(mk)}`,
      ``,
      `Business: ${s.businessName || "—"}`,
      `Currency: ${s.currency} • Basis: ${s.basis.toUpperCase()} • FY Start: ${s.fiscalYearStartMonth}`,
      `Advisor: ${s.advisorName || "—"} • Contact: ${s.contactEmail || "—"}`,
      ``,
      `SUMMARY (THIS MONTH)`,
      `- Revenue: ${moneyFmt(totals.revenue, currency)}`,
      `- Expenses: ${moneyFmt(totals.expenses, currency)}`,
      `- Net Profit: ${moneyFmt(totals.profit, currency)}`,
      `- Net Margin: ${totals.revenue ? ((totals.profit/totals.revenue)*100).toFixed(1)+"%" : "—"}`,
      `- Deposits: ${dep.length} • Unreconciled deposits: ${unmatchedDep.length}`,
      `- Audit readiness (this month): ${readiness}%`,
      `- Audit readiness (overall): ${overall}%`,
      `- Checklist completed: ${checklistDone}/${state.checklist.length}`,
      ``,
      `CONSISTENCY (LAST 6 MONTHS)`,
      `- Avg revenue: ${moneyFmt(avgRev, currency)}`,
      `- Avg profit: ${moneyFmt(avgProfit, currency)}`,
      `- Revenue volatility (std/mean): ${avgRev ? (volRev*100).toFixed(1)+"%" : "—"}`,
      `- Profit volatility (std/mean): ${avgProfit ? (volProfit*100).toFixed(1)+"%" : "—"}`,
      ``,
      `RED FLAGS / NOTES`,
      ...flags.map(f => `- [${f.level.toUpperCase()}] ${f.title}: ${f.sub}`),
      ``,
      `MONTHLY LEDGER COUNTS`,
      `- Revenue entries: ${rev.length}`,
      `- Expense entries: ${exp.length}`,
      `- Invoices issued: ${inv.length}`,
      `- Deposits logged: ${dep.length}`,
      `- Reconciliation links: ${matches.length}`,
      ``,
      `CHECKLIST (PROOF ITEMS)`,
      ...state.checklist.map(c => `- [${c.done ? "X":" "}] ${c.title}`),
      ``,
      `CLIENT NOTES`,
      `${s.clientNotes || "—"}`,
      ``,
      `DETAIL — REVENUE`,
      ...rev.map(r => `- ${r.date} • ${moneyFmt(r.amount, currency)} • ${r.client||"Unknown"} • ${r.category||""} • ${r.method||""}${r.invoiceId ? " • Invoice linked" : ""}${r.notes ? " • Notes: "+r.notes : ""}`),
      ``,
      `DETAIL — EXPENSES`,
      ...exp.map(e => `- ${e.date} • ${moneyFmt(e.amount, currency)} • ${e.vendor||"Unknown"} • ${e.type||""} • ${e.category||""} • ${e.method||""}${e.notes ? " • Notes: "+e.notes : ""}`),
      ``,
      `DETAIL — INVOICES`,
      ...inv.map(i => `- ${i.number||"(no #)"} • ${i.client||""} • Issue ${i.issueDate||""} • Due ${i.dueDate||""} • ${String((i.status||"").toUpperCase())} • ${moneyFmt(i.amount, currency)}${i.status==="paid" ? ` • Paid ${i.paidDate||""} • Ref ${i.paymentRef||""}` : ""}`),
      ``,
      `DETAIL — BANK DEPOSITS`,
      ...dep.map(d => {
        const m = matches.find(x => x.depositId === d.id);
        const invv = m?.invoiceId ? findInvoice(m.invoiceId) : null;
        const revv = m?.revenueId ? findRevenue(m.revenueId) : null;
        const link = invv ? `Invoice ${invv.number}` : (revv ? `Revenue ${revv.client||"Unknown"}` : "UNLINKED");
        return `- ${d.date} • ${moneyFmt(d.amount, currency)} • ${d.desc||""} • ${link}`;
      }),
      ``,
      `NEXT MONTH PLAN`,
      `- Reconcile all deposits by the 5th.`,
      `- Fill missing months (even “zero” months).`,
      `- Add notes for unusual spikes/one-offs.`,
      `- Keep COGS vs OpEx typed for every expense.`,
      `- Export this pack monthly and store it with bank statements.`,
      ``
    ].join("\n");

    $("#packPreview").textContent = reportText;

    lastPackHtml = buildPrintableHtml(reportText);
    $("#btnPrintPack").disabled = false;

    alert("Pack built. Click Print / Save as PDF.");
  }

  function buildPrintableHtml(reportText){
    const s = state.settings;
    const title = `Audit Readiness Pack — ${monthLabel(state.activeMonth)}`;
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page{ margin: 18mm; }
    body{
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      color:#111;
      line-height:1.35;
    }
    .head{
      display:flex; align-items:center; gap:14px;
      border-bottom:2px solid #111;
      padding-bottom:12px;
      margin-bottom:12px;
    }
    .logo{ width:72px; height:auto; }
    .t1{ font-size:18px; font-weight:900; }
    .t2{ font-size:12px; opacity:.75; margin-top:4px; }
    pre{
      white-space:pre-wrap;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New";
      font-size:11px;
      border:1px solid #ddd;
      padding:12px;
      border-radius:10px;
      background:#fafafa;
    }
    .foot{
      margin-top:14px;
      font-size:11px;
      opacity:.7;
      border-top:1px solid #ddd;
      padding-top:10px;
    }
  </style>
</head>
<body>
  <div class="head">
    <img class="logo" src="https://cdn1.sharemyimage.com/2026/02/16/logo1_transparent.png" alt="Logo">
    <div>
      <div class="t1">${escapeHtml(title)}</div>
      <div class="t2">${escapeHtml(s.businessName || "Business")} • Prepared by ${escapeHtml(s.advisorName || "Advisor")} • ${escapeHtml(s.contactEmail || "")}</div>
    </div>
  </div>
  <pre>${escapeHtml(reportText)}</pre>
  <div class="foot">
    This pack is a documentation system for clean books and provable trails. Store monthly with bank statements and invoices/receipts.
  </div>
</body>
</html>`;
  }

  function printPack(){
    if (!lastPackHtml) return;
    const w = window.open("", "_blank");
    if (!w) return alert("Pop-up blocked. Allow pop-ups to print/save as PDF.");
    w.document.open();
    w.document.write(lastPackHtml);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 250);
  }

  function escapeHtml(s){
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }
  function escapeAttr(s){
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  init();
})();

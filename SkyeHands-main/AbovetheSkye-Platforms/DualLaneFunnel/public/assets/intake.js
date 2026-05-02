(function(){
  const DRAFT_PREFIX = 'sol_duallane_draft__';
  const QUEUE_KEY = 'sol_duallane_submission_queue_v1';

  function encode(data){
    return Object.keys(data)
      .map(function(k){
        return encodeURIComponent(k) + '=' + encodeURIComponent(data[k] == null ? '' : String(data[k]));
      })
      .join('&');
  }

  async function postNetlifyForm(formName, fields){
    // Netlify forms SPA submission pattern
    const body = encode(Object.assign({ 'form-name': formName }, fields));
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    // Netlify often responds with 200/302; treat non-5xx as success
    if (res.status >= 500) throw new Error('Netlify Forms error');
    return true;
  }

  async function postFunctionIntake(lane, fields){
    const res = await fetch('/.netlify/functions/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lane: lane, fields: fields })
    });
    if (!res.ok) throw new Error('Intake function error');
    return await res.json();
  }

  function readQueue(){
    try{
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(_err){
      return [];
    }
  }

  function writeQueue(queue){
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function draftKey(form){
    return DRAFT_PREFIX + (form.getAttribute('name') || 'intake');
  }

  function serializeForm(form){
    const fd = new FormData(form);
    const fields = {};
    fd.forEach((v,k)=>{
      if(k !== 'bot-field') fields[k] = v == null ? '' : String(v);
    });
    return fields;
  }

  function saveDraft(form){
    try{
      localStorage.setItem(draftKey(form), JSON.stringify({
        savedAt: new Date().toISOString(),
        lane: form.getAttribute('data-lane') || 'unknown',
        fields: serializeForm(form)
      }));
    } catch(_err){}
  }

  function clearDraft(form){
    try{
      localStorage.removeItem(draftKey(form));
    } catch(_err){}
  }

  function restoreDraft(form){
    try{
      const raw = localStorage.getItem(draftKey(form));
      if(!raw) return;
      const parsed = JSON.parse(raw);
      const fields = parsed && parsed.fields ? parsed.fields : {};
      Object.keys(fields).forEach((name)=>{
        const input = form.elements.namedItem(name);
        if(!input) return;
        if(input instanceof RadioNodeList){
          Array.from(input).forEach((node)=>{ if(node && 'value' in node) node.checked = node.value === fields[name]; });
          return;
        }
        input.value = fields[name];
      });
    } catch(_err){}
  }

  function queueSubmission(formName, lane, fields, reason){
    const queue = readQueue();
    queue.push({
      formName: formName,
      lane: lane,
      fields: fields,
      queuedAt: new Date().toISOString(),
      reason: reason || 'offline'
    });
    writeQueue(queue);
  }

  function summarizeLocalState(){
    const queue = readQueue();
    const drafts = [];
    try{
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(key && key.indexOf(DRAFT_PREFIX) === 0){
          const raw = localStorage.getItem(key);
          drafts.push({ key: key.replace(DRAFT_PREFIX, ''), value: raw ? JSON.parse(raw) : null });
        }
      }
    } catch(_err){}
    return { queue: queue, drafts: drafts };
  }

  async function flushQueuedSubmissions(){
    if(!navigator.onLine) return { attempted: 0, flushed: 0, remaining: readQueue().length };
    const queue = readQueue();
    if(!queue.length) return { attempted: 0, flushed: 0, remaining: 0 };

    const remaining = [];
    let flushed = 0;
    for(const item of queue){
      try{
        await postNetlifyForm(item.formName, item.fields);
        try{
          await postFunctionIntake(item.lane, item.fields);
        } catch(_err){
          // Forms capture is the primary path; function persistence is best-effort.
        }
        flushed += 1;
      } catch(_err){
        remaining.push(item);
      }
    }
    writeQueue(remaining);
    return { attempted: queue.length, flushed: flushed, remaining: remaining.length };
  }

  function setToast(el, kind, msg){
    el.classList.remove('ok','bad');
    el.classList.add(kind);
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function handleForm(form){
    const toast = form.parentElement.querySelector('.toast');
    const submitBtn = form.querySelector('button[type="submit"]');
    const lane = form.getAttribute('data-lane') || 'unknown';
    const formName = form.getAttribute('name') || 'intake';

    restoreDraft(form);
    ['input','change'].forEach((eventName)=>{
      form.addEventListener(eventName, function(){
        saveDraft(form);
      });
    });

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      // Collect fields
      const fd = new FormData(form);
      // strip honeypot
      if (fd.get('bot-field')) {
        setToast(toast,'ok','Submitted.');
        return;
      }

      const fields = {};
      fd.forEach((v,k)=>{ if(k !== 'bot-field') fields[k]=v; });

      if(!navigator.onLine){
        queueSubmission(formName, lane, fields, 'offline');
        saveDraft(form);
        setToast(toast,'ok','Offline: saved locally and queued for resend.');
        const next = form.getAttribute('data-success') || '/thank-you.html';
        window.location.href = next + '?lane=' + encodeURIComponent(lane) + '&queued=1';
        return;
      }

      // UI lock
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      try{
        // 1) Netlify Forms (source of truth for "drop" deployments)
        await postNetlifyForm(formName, fields);

        // 2) Optional: Function intake (Neon + Blobs). If functions not deployed, this will fail;
        // we treat that as "forms captured" and still complete.
        try{
          await postFunctionIntake(lane, fields);
        } catch(_err){
          // ignore — still a legitimate Netlify Forms submission
        }

        clearDraft(form);

        // Redirect
        const next = form.getAttribute('data-success') || '/thank-you.html';
        window.location.href = next + '?lane=' + encodeURIComponent(lane);
      } catch(err){
        console.error(err);
        queueSubmission(formName, lane, fields, 'submit-failed');
        saveDraft(form);
        setToast(toast,'ok','Submission failed live, so it was queued locally for retry.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    });
  }

  async function loadDiagnostics(){
    const box = document.getElementById('diagnosticsBox');
    const localBox = document.getElementById('localQueueBox');
    if(localBox){
      localBox.textContent = JSON.stringify({
        online: navigator.onLine,
        queueCount: readQueue().length,
        drafts: summarizeLocalState().drafts.map((draft)=>({
          form: draft.key,
          savedAt: draft.value && draft.value.savedAt ? draft.value.savedAt : null
        }))
      }, null, 2);
    }
    if(!box) return;
    try{
      const res = await fetch('/.netlify/functions/health');
      if(!res.ok) throw new Error('health failed');
      const j = await res.json();
      box.textContent = JSON.stringify(j, null, 2);
    } catch(e){
      box.textContent = 'Diagnostics unavailable (functions not deployed yet).';
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('form[data-intake="true"]').forEach(handleForm);
    loadDiagnostics();
    window.addEventListener('online', function(){
      flushQueuedSubmissions().then(loadDiagnostics).catch(loadDiagnostics);
    });
  });
})();

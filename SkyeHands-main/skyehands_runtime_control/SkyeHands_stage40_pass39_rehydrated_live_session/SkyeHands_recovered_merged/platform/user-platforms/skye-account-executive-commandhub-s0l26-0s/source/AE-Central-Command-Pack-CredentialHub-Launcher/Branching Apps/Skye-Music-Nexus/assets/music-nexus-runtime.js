(function(){
  const client = window.SkyeCommandHubRuntimeClient;
  const output = document.getElementById('output');
  const base = document.getElementById('base');
  const releaseJson = document.getElementById('release-json');
  if (client.runtimeBase() !== '/.netlify/functions') base.value = client.runtimeBase();
  function write(value){ output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
  function payload(){
    try { return releaseJson.value.trim() ? JSON.parse(releaseJson.value) : {}; }
    catch (error) { throw new Error('Release JSON is invalid: ' + error.message); }
  }
  async function issueToken(){
    const session = await client.issueSession({ operatorId:'music-nexus-operator', name:'Skyes Over London', role:'founder', email:'SkyesOverLondonLC@solenterprises.org' });
    return session.issued.token;
  }
  document.getElementById('save').addEventListener('click', () => write({ ok:true, runtimeBase: client.setRuntimeBase(base.value.trim()) }));
  document.getElementById('bootstrap').addEventListener('click', async () => {
    try { if (base.value.trim()) client.setRuntimeBase(base.value.trim()); const token = await issueToken(); write(await client.musicNexus(token, { action:'bootstrapWorkspace', payload: payload() })); } catch (error) { write({ ok:false, error:error.message || String(error) }); }
  });
  document.getElementById('release').addEventListener('click', async () => {
    try { if (base.value.trim()) client.setRuntimeBase(base.value.trim()); const token = await issueToken(); write(await client.musicNexus(token, { action:'draftReleasePacket', payload: payload() })); } catch (error) { write({ ok:false, error:error.message || String(error) }); }
  });
  document.getElementById('catalog').addEventListener('click', async () => {
    try { if (base.value.trim()) client.setRuntimeBase(base.value.trim()); const token = await issueToken(); write(await client.musicNexus(token, { action:'syncCatalog', payload: payload() })); } catch (error) { write({ ok:false, error:error.message || String(error) }); }
  });
  document.getElementById('products').addEventListener('click', async () => {
    try { if (base.value.trim()) client.setRuntimeBase(base.value.trim()); write(await client.productsSummary()); } catch (error) { write({ ok:false, error:error.message || String(error) }); }
  });
  document.getElementById('sql').addEventListener('click', async () => {
    try { if (base.value.trim()) client.setRuntimeBase(base.value.trim()); const token = await issueToken(); write(await client.generateSqlInstallPacket(token, { selectedProductIds:['skye-music-nexus'] })); } catch (error) { write({ ok:false, error:error.message || String(error) }); }
  });
  document.getElementById('os-bridge').addEventListener('click', async () => {
    try { if (base.value.trim()) client.setRuntimeBase(base.value.trim()); const token = await issueToken(); write(await client.buildOsBridgePacket(token, { selectedProductIds:['skye-music-nexus'] })); } catch (error) { write({ ok:false, error:error.message || String(error) }); }
  });
})();

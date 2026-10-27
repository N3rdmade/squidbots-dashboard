/* Dedicated CoA Mail Center — separate from moderation. Never writes to SQL. */
(() => {
  let players = [], items = [], cart = [], recipient = "", query = "", timer = null, loading = false, nextPage = null, selected = null, requestSeq = 0, totalItems = null;
  const $ = id => document.getElementById(id);
  let clientFolder = null, clientFolderName = '', clientArchiveCount = null;
  async function chooseClientFolder() {
    const status = $('mailClientStatus');
    if (!window.showDirectoryPicker) {
      if (status) status.textContent = 'Folder access requires Chrome or Edge on localhost.';
      return;
    }
    try {
      const folder = await window.showDirectoryPicker({mode:'read', id:'coa-client'});
      let count = 0, dataFound = false, scanned = 0;
      const dirs = [{dir:folder, depth:0}];
      const sample = [];
      // Scan a small, bounded portion of the directory tree without reading or uploading file contents.
      while (dirs.length && scanned < 12000) {
        const {dir,depth} = dirs.shift();
        for await (const [name, handle] of dir.entries()) {
          if (++scanned > 12000) break;
          if (depth === 0 && name.toLowerCase() === 'data' && handle.kind === 'directory') dataFound = true;
          if (handle.kind === 'file') {
            if (/\.mpq$/i.test(name)) count++;
            if (sample.length < 12) sample.push(name);
          } else if (depth < 3 && (depth === 0 || /^(data|en[a-z]{2}|client|patches|locale)$/i.test(name))) {
            dirs.push({dir:handle,depth:depth+1});
          }
        }
      }
      clientFolder = folder;
      clientFolderName = folder.name;
      clientArchiveCount = count;
      appearanceCache.clear();
      redraw();
      const message = $('mailClientStatus');
      if (message) {
        message.textContent = count ? folder.name + ' · ' + count + ' MPQ archive(s) detected (local only)' :
          folder.name + ' selected, but no MPQ archives detected. Data directory ' +
          (dataFound ? 'found' : 'not found') + '. Sample files: ' + (sample.join(', ') || 'none') +
          '. This client may use another asset format.';
      }
    } catch (error) {
      if (error.name !== 'AbortError' && status) status.textContent = 'Could not inspect folder: ' + error.message;
    }
  }
  async function inspectClientAssets(){
    const status = $('mailClientStatus');
    if(!clientFolder){if(status)status.textContent='Select your CoA folder first.';return;}
    const button = $('mailInspectCoA');
    if(button)button.disabled=true;
    try {
      if(status)status.textContent='Inspecting client MPQ data locally…';
      const {inspectCoAClient} = await import('/static/client-mpq.js');
      const result = await inspectCoAClient(clientFolder, text=>{
        if($('mailClientStatus'))$('mailClientStatus').textContent=text;
      });
      const summary = result.archive + ': ItemDisplayInfo.dbc verified (' + result.records +
        ' records; ' + result.fields + ' fields per record).';
      if($('mailClientStatus'))$('mailClientStatus').textContent=summary;
    }catch(error){
      if($('mailClientStatus'))$('mailClientStatus').textContent='MPQ inspection: '+error.message;
    }finally{if($('mailInspectCoA'))$('mailInspectCoA').disabled=false;}
  }
  const html = s => esc(String(s ?? ""));
  function icon(item) {
    if (!item.icon || !/^[a-z0-9_]+$/i.test(item.icon)) return '<span class="mail-icon mail-icon-empty">?</span>';
    const name = encodeURIComponent(item.icon.toLowerCase());
    return '<img class="mail-icon" loading="lazy" src="/icons/' + name + '.png" data-fallback="https://wow.zamimg.com/images/wow/icons/large/' + name + '.jpg" alt="" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback}else{this.style.visibility=\'hidden\'}">';
  }
  function draw() {
    if (!$("mailPage")) return;
    const online = players.filter(p => p.online);
    const choices = online.map(p => '<option value="' + html(p.guid) + '"' + (String(p.guid) === recipient ? ' selected' : '') + '>' + html(p.name) + ' · lvl ' + p.level + '</option>').join('');
    const matches = items.map(v => '<div class="mail-item' + (selected && selected.id === v.id ? ' is-selected' : '') + '">' +
      '<button class="mail-item-view" type="button" data-catalog="' + v.id + '" aria-label="Preview ' + html(v.name) + '">' +
      icon(v) + '<span class="mail-item-body"><strong class="mail-quality-' + v.quality + '">' + html(v.name) + '</strong>' +
      '<small>Level ' + v.level + ' · ID ' + v.id + '</small></span></button>' +
      '<button type="button" class="mail-add" data-mail-attach="' + v.id + '" aria-label="Attach ' + html(v.name) + '" title="Add to mail">+</button></div>').join('');
    const preview = selected ? '<div class="preview-summary">' + icon(selected) + '<div><strong class="mail-quality-' + selected.quality + '">' + html(selected.name) + '</strong><p class="meta">Item ID ' + selected.id + ' · Display ID ' + selected.displayId + ' · Level ' + selected.level + '</p></div></div>' : '<p class="meta">Select an item to inspect its appearance.</p>';
    const slots = Array.from({length:12},(_,i)=>{
      const v=cart[i];
      return v ? '<div class="mail-slot filled" title="' + html(v.name) + '">' + icon(v) +
        '<span class="mail-slot-num">' + v.count + '</span><button data-remove="' + i + '" title="Remove item" aria-label="Remove item">×</button></div>' :
        '<div class="mail-slot" aria-label="Empty attachment slot"></div>';
    }).join('');
    $("mailPage").innerHTML = '<div class="mail-layout"><section class="card mail-catalog"><div class="mail-heading"><h2>Item Library</h2><span class="meta">Search your CoA item database</span></div>' +
      '<input id="mailSearch" type="search" placeholder="Search items (e.g. head, sword, potion)" value="' + html(query) + '" aria-label="Search items">' +
      '<div class="meta" id="mailDatabaseStatus">' + (totalItems === null ? 'Checking CoA item database…' : totalItems.toLocaleString() + ' items in the CoA world database') + '</div>' +
      '<div id="mailCatalogStatus" class="meta">' + (loading ? 'Searching…' : items.length ? items.length + ' shown' + (nextPage ? ' · more available' : '') : 'Type at least two characters to search') + '</div>' +
      '<div class="mail-items">' + matches + '</div>' +
      (nextPage ? '<button class="btn" id="mailLoadMore" type="button">Load more matching CoA items</button>' : '') + '</section>' +
      '<section class="card mail-compose"><div class="mail-heading"><h2>Compose Mail</h2><span class="meta">Delivered using the worldserver GM console</span></div>' +
      '<label for="mailRecipient">Online player</label><select id="mailRecipient"><option value="">Select an online player</option>' + choices + '</select>' +
      '<p class="meta">' + online.length + ' player(s) online · Bots excluded</p>' +
      '<label for="mailSubject">Subject</label><input id="mailSubject" maxlength="60" value="A gift from the Game Masters">' +
      '<label for="mailBody">Message</label><textarea id="mailBody" maxlength="200" rows="4" placeholder="Write your message…"></textarea>' +
      '<div class="mail-heading"><h3>Attachments</h3><span class="meta">' + cart.length + ' / 12</span></div><div class="mail-slots">' + slots + '</div>' +
      '<div class="mail-actions"><button class="btn" id="mailSendItems" type="button">Send items by mail</button>' +
      '<div class="mail-gold"><label for="mailGold">Gold</label><input type="number" min="1" max="100000" id="mailGold" value="100">' +
      '<button class="btn" id="mailSendGold" type="button">Send gold</button></div></div>' +
      '<p class="meta">Item attachments and gold are sent in separate messages. A server RA connection is required.</p>' +
      '<p class="gm-result" role="status" id="mailFeedback"></p></section>' +
      '<section class="card mail-preview"><div class="mail-heading"><h2>Item Preview</h2><span class="meta">3D model workspace</span></div>' +
      '<div class="mail-client-source"><button class="btn small" id="mailCharacterMode" type="button">' +
      (characterMode?'Switch to experimental item mesh':'Switch to 3D character') + '</button></div>' +
      '<div class="mail-client-source"><button class="btn small" id="mailChooseCoA" type="button">' +
      (clientFolder ? 'Change CoA folder' : 'Select local CoA folder') + '</button>' +
      (clientFolder ? ' <button class="btn small" id="mailInspectCoA" type="button">Inspect client DBC</button>' : '') +
      '<p class="meta" id="mailClientStatus">' +
      (clientFolder ? html(clientFolderName) + ' · ' + clientArchiveCount + ' MPQ archives detected (browser only)' :
        'Optional: select the game folder on this computer. No game files are uploaded.') +
      '</p></div>' +
      preview + '<div class="mail-model-frame" id="mailModelFrame"><div class="mail-model-empty">' +
      (selected ? 'Loading 3D preview…' : 'Choose an item to preview') + '</div></div>' +
      '<p class="meta">' + (characterMode ? 'Character models and armor require the server-hosted WotLK asset library.' : 'Experimental item models read converted local GLBs or selected client MPQs.') + '</p>' +
      '</section></div>';
  }
  let modelSeq = 0;
  async function updateModel() {
    if(characterMode){return renderCharacterPreview(selected);}
    const frame = $('mailModelFrame'), item = selected, seq = ++modelSeq;
    if(activeMeshViewer){activeMeshViewer();activeMeshViewer=null;}
    if (!frame || !item) return;
    const id = Number(item.displayId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      frame.textContent = 'This item has no valid 3D display ID.';
      return;
    }
    frame.textContent = 'Checking local model library…';
    try {
      const response = await fetch('/api/model-available?display=' + id, {cache:'no-store'});
      const result = await response.json();
      if (characterMode || seq !== modelSeq || frame !== $('mailModelFrame')) return;
      if (!response.ok) throw Error(result.error || 'Unable to check model library');
      if (!result.available) {
        if (clientFolder) {
          lookupNativeAppearance(item);
        } else {
          frame.textContent = 'No local model file for display ID ' + id +
            '. Select your CoA folder to identify its original game model.';
        }
        return;
      }
      await Promise.race([
        customElements.whenDefined('model-viewer'),
        new Promise((_, reject) => setTimeout(() => reject(Error('3D viewer script could not load')), 12000))
      ]);
      if (characterMode || seq !== modelSeq || frame !== $('mailModelFrame')) return;
      const viewer = document.createElement('model-viewer');
      viewer.setAttribute('src', '/static/models/' + id + '.glb');
      viewer.setAttribute('camera-controls', '');
      viewer.setAttribute('auto-rotate', '');
      viewer.setAttribute('shadow-intensity', '1');
      viewer.setAttribute('alt', '3D model for ' + item.name);
      viewer.style.cssText = 'width:100%;height:410px;min-height:410px;display:block;';
      viewer.addEventListener('error', () => {
        if(!characterMode && seq === modelSeq && frame === $('mailModelFrame')) frame.textContent = 'Model could not be loaded. Check the GLB export.';
      });
      frame.replaceChildren(viewer);
    } catch (error) {
      if (!characterMode && seq === modelSeq && frame === $('mailModelFrame'))
        frame.textContent = '3D viewer error: ' + error.message;
    }
  }
  let characterModel=null, characterViewerPromise=null, characterSeq=0, characterMode=true;
  const characterAppearance={race:1,gender:1,skin:0,face:0,hairStyle:0,hairColor:0,facialStyle:0,items:[]};
  const equipmentSlot = item => {
    // InventoryType is required for assigning a correct paper-doll slot.
    const type=Number(item.inventoryType);
    return ({1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,11:11,12:13,13:21,14:22,15:15,16:15,17:21,18:18,19:19,20:20,21:21,22:22,23:22,25:18,26:18})[type]||0;
  };
  async function loadCharacterViewer() {
    if(!characterViewerPromise)characterViewerPromise=(async()=>{
      if(!window.jQuery){
        await new Promise((ok,no)=>{
          const script=document.createElement('script');script.src='https://code.jquery.com/jquery-3.5.1.min.js';
          script.onload=ok;script.onerror=()=>no(Error('jQuery unavailable'));
          document.head.append(script);
        });
      }
      const response=await fetch('/api/character-viewer-config',{cache:'no-store'});
      const raw=await response.text();
      let config;
      try{config=JSON.parse(raw);}
      catch(e){throw Error('Viewer configuration endpoint returned HTML (HTTP '+response.status+
          '). The running Ubuntu dashboard has not loaded the new route; restart only squidbots-test.');}
      if(!response.ok)throw Error(config.error||'Viewer configuration HTTP '+response.status);
      if(!config.ready)throw Error('The WotLK model-data package is missing on Ubuntu. See WOTLK_VIEWER_SETUP.md.');
      window.CONTENT_PATH='/wotlk-model-data/';
      window.WOTLK_TO_RETAIL_DISPLAY_ID_API=undefined;
      return import('https://esm.sh/wotlk-model-viewer@1.1.9?bundle');
    })().catch(e=>{characterViewerPromise=null;throw e;});
    return characterViewerPromise;
  }
  async function renderCharacterPreview(item){
    const seq=++characterSeq,frame=$('mailModelFrame');
    if(!frame || !characterMode)return;
    if(characterModel){try{characterModel.destroy();}catch(e){}characterModel=null;}
    frame.textContent='Loading 3D character viewer…';
    try{
      const lib=await loadCharacterViewer();
      if(!characterMode || seq!==characterSeq || frame!==$('mailModelFrame'))return;
      if(item){
        const slot=equipmentSlot(item);
        if(!slot)throw Error('This item has no supported equipment slot. Choose a weapon or armor piece.');
        characterAppearance.items=characterAppearance.items.filter(e=>e[0]!==slot);
        characterAppearance.items.push([slot,Number(item.displayId)]);
      }
      frame.innerHTML='<div id="coaCharacterCanvas" style="height:420px;width:100%;"></div>';
      const model=await lib.generateModels(1,'#coaCharacterCanvas',{...characterAppearance,hideProgressBar:true});
      if(!characterMode || seq!==characterSeq || frame!==$('mailModelFrame')){try{model?.destroy();}catch(e){}return;}
      characterModel=model;
    }catch(e){if(characterMode && seq===characterSeq && frame===$('mailModelFrame'))frame.textContent='3D character unavailable: '+e.message;}
  }
  let appearanceSeq = 0, appearanceCache = new Map();
  async function lookupNativeAppearance(item) {
    const seq = ++appearanceSeq;
    const frame = $('mailModelFrame');
    if(characterMode || !clientFolder || !frame || !item)return;
    const id = Number(item.displayId);
    if(appearanceCache.has(id)){
      const result=appearanceCache.get(id);
      frame.textContent = 'Opening cached CoA model…';
      try{await showNativeMesh(item,result,seq);}
      catch(error){if(!characterMode && seq===appearanceSeq && frame===$('mailModelFrame'))$('mailModelFrame').textContent='Model '+(result.model1||result.model2)+': '+error.message;}
      return;
    }
    try {
      const {resolveCoADisplay} = await import('/static/client-mpq.js');
      const result = await resolveCoADisplay(clientFolder,id,msg=>{
        if(!characterMode && seq===appearanceSeq && frame===$('mailModelFrame')) $('mailModelFrame').textContent=msg;
      });
      if(characterMode || seq!==appearanceSeq || frame!==$('mailModelFrame'))return;
      appearanceCache.set(id,result);
      $('mailModelFrame').textContent='Opening native M2 geometry…';
      try{await showNativeMesh(item,result,seq);}
      catch(error){if(!characterMode && seq===appearanceSeq && frame===$('mailModelFrame'))$('mailModelFrame').textContent=
        'Model found: '+(result.model1||result.model2)+'. Renderer: '+error.message;}
    }catch(error){
      if(!characterMode && seq===appearanceSeq && frame===$('mailModelFrame'))$('mailModelFrame').textContent='Client appearance lookup: '+error.message;
    }
  }
  let activeMeshViewer = null;
  async function showNativeMesh(item, result, seq) {
    const frame = $('mailModelFrame');
    if(characterMode || !frame || seq!==appearanceSeq)return;
    const {loadCoAMesh}=await import('/static/client-mpq.js');
    const mesh=await loadCoAMesh(clientFolder,result,msg=>{
      if(!characterMode && seq===appearanceSeq && frame===$('mailModelFrame'))$('mailModelFrame').textContent=msg;
    });
    if(characterMode || seq!==appearanceSeq || frame!==$('mailModelFrame'))return;
    const THREE=await import('https://esm.sh/three@0.170.0');
    const {OrbitControls}=await import('https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js');
    if(characterMode || seq!==appearanceSeq || frame!==$('mailModelFrame'))return;
    frame.replaceChildren();
    const canvas=document.createElement('canvas');
    canvas.style.cssText='height:410px;width:100%;display:block;touch-action:none;';
    frame.appendChild(canvas);
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const width=Math.max(frame.clientWidth,280),height=410;
    renderer.setSize(width,height,false);
    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(40,width/height,0.01,1000);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(mesh.normals,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(mesh.uvs,2));
    geometry.setIndex(new THREE.BufferAttribute(mesh.triangles,1));
    geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({color:0xb4c8d8,metalness:0.65,roughness:0.4,side:THREE.DoubleSide});
    const object=new THREE.Mesh(geometry,material);
    scene.add(object);
    const sphere=geometry.boundingSphere;
    camera.position.copy(sphere.center).add(new THREE.Vector3(0,-Math.max(sphere.radius*3,0.5),Math.max(sphere.radius,0.2)));
    scene.add(new THREE.HemisphereLight(0xffffff,0x455e75,2));
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,-5,8);scene.add(light);
    const controls=new OrbitControls(camera,canvas);
    controls.target.copy(sphere.center);controls.enableDamping=true;controls.update();
    let alive=true,raf=0;
    const animate=()=>{if(!alive)return;raf=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};
    animate();
    activeMeshViewer=()=>{alive=false;cancelAnimationFrame(raf);controls.dispose();geometry.dispose();material.dispose();renderer.dispose();};
    const caption=document.createElement('div');caption.className='meta';
    caption.textContent='Untextured native model · '+mesh.vertices+' vertices · Drag to rotate, scroll to zoom';
    frame.appendChild(caption);
  }
  // Redraw while retaining the composer's unsent text and selected recipient.
  function redraw() {
    const values = ['mailSubject','mailBody','mailGold'].map(id=>$(id)?.value);
    recipient = $("mailRecipient")?.value || recipient;
    query = $("mailSearch")?.value ?? query;
    // Cancel async operations associated with the old preview DOM.
    ++appearanceSeq;
    ++modelSeq;
    ++characterSeq;
    if(activeMeshViewer){activeMeshViewer();activeMeshViewer=null;}
    if(characterModel){try{characterModel.destroy();}catch(e){}characterModel=null;}
    draw();
    updateModel();
    ['mailSubject','mailBody','mailGold'].forEach((id,i)=>{if(values[i]!==undefined && $(id))$(id).value=values[i];});
  }
  async function loadPlayers() {
    try {
      const r = await getJson('/api/gm');
      if(r.error) throw Error(r.error);
      players = r.players || [];
      redraw();
    } catch(e) { const el=$("mailFeedback");if(el)el.textContent='Player list unavailable: '+e.message; }
  }
  async function search() {
    query = $("mailSearch")?.value.trim() || "";
    if(query.length < 2){items=[];nextPage=null;redraw();return;}
    const seq = ++requestSeq;
    loading=true;
    const status=$("mailCatalogStatus");if(status)status.textContent='Searching…';
    try{
      const response=await fetch('/api/items?q='+encodeURIComponent(query),{cache:'no-store'});
      const data=await response.json();
      if(!response.ok || data.error)throw Error(data.error||'Search failed');
      if(seq!==requestSeq)return;
      items=data.items||[];
      nextPage=data.next||null;
      loading=false;
      redraw();
    }catch(e){if(seq!==requestSeq)return;loading=false;items=[];nextPage=null;redraw();if($("mailCatalogStatus"))$("mailCatalogStatus").textContent='Search failed: '+e.message;}
  }
  async function loadMore(){
    if(!nextPage || loading)return;
    const cursor=nextPage, term=query, seq=requestSeq;
    loading=true;
    try{
      const response=await fetch('/api/items?q='+encodeURIComponent(term)+'&after='+cursor,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok || data.error)throw Error(data.error||'More results unavailable');
      if(seq!==requestSeq || term!==query)return;
      items.push(...(data.items||[]));
      nextPage=data.next||null;
      loading=false;redraw();
    }catch(e){loading=false;const status=$('mailCatalogStatus');if(status)status.textContent='Could not load more: '+e.message;}
  }
  async function send(kind){
    const pick=players.find(p=>String(p.guid)===($("mailRecipient")?.value || recipient));
    if(!pick){$("mailFeedback").textContent='Select an online player first.';return;}
    const subject=$("mailSubject").value.trim()||'Gift';
    const message=$("mailBody").value.trim()||'From the Game Masters.';
    const body={action:kind,guid:pick.guid,subject,text:message};
    if(kind==='items'){
      if(!cart.length){$("mailFeedback").textContent='Add one or more items first.';return;}
      body.items=cart.map(v=>({item:v.id,count:v.count}));
    } else body.gold=$("mailGold").value;
    if(!window.confirm('Send '+(kind==='items'?cart.length+' item types':body.gold+' gold')+' to '+pick.name+'?'))return;
    const feedback=$("mailFeedback");
    feedback.textContent='Sending…';
    try{
      const r=await gmPost(body);
      feedback.className='gm-result '+(r.ok?'ok':'bad');
      feedback.textContent=(r.ok?'Success: ':'Failed: ')+(r.answer||r.error||'No reply');
      if(r.ok && kind==='items'){cart=[];const msg=feedback.textContent;redraw();$("mailFeedback").textContent=msg;}
    }catch(e){feedback.textContent='Delivery error: '+e.message;}
  }
  document.addEventListener('input',e=>{
    if(e.target.id==='mailSearch'){clearTimeout(timer);timer=setTimeout(search,320);}
    if(e.target.id==='mailRecipient') recipient=e.target.value;
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('#mailCharacterMode')){characterMode=!characterMode;redraw();return;}
    if(e.target.closest('#mailChooseCoA')) { chooseClientFolder(); return; }
    if(e.target.closest('#mailInspectCoA')) { inspectClientAssets(); return; }
    if(e.target.closest('#mailLoadMore')) { loadMore(); return; }
    const view=e.target.closest('[data-catalog]');
    if(view){
      const item=items.find(v=>String(v.id)===view.dataset.catalog);
      if(item){selected=item;redraw();}
      return;
    }
    const add=e.target.closest('[data-mail-attach]');
    if(add){
      const item=items.find(v=>String(v.id)===add.dataset.mailAttach);
      if(!item)return;
      const found=cart.find(v=>v.id===item.id);
      if(found)found.count=Math.min(200,found.count+1);
      else if(cart.length<12)cart.push({...item,count:1});
      redraw();return;
    }
    const remove=e.target.closest('[data-remove]');
    if(remove){cart.splice(Number(remove.dataset.remove),1);redraw();return;}
    if(e.target.closest('#mailSendItems'))send('items');
    if(e.target.closest('#mailSendGold'))send('money');
  });
  let counted=false;
  async function countItems(){
    try {const r=await getJson('/api/item-count');if(!r.error){totalItems=r.total;const el=$('mailDatabaseStatus');if(el)el.textContent=totalItems.toLocaleString()+' items in '+r.source;}}
    catch(e){if($('mailDatabaseStatus'))$('mailDatabaseStatus').textContent='Item database count unavailable';}
  }
  window.showMailPage=()=>{if(!$("mailPage"))return;draw();loadPlayers();if(!counted){counted=true;countItems();}};
  if (location.hash.split("/")[0] === "#mail") window.showMailPage();
})();

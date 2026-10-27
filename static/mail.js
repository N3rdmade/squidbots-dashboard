/* Dedicated CoA Mail Center — separate from moderation. Never writes to SQL. */
(() => {
  let players = [], items = [], cart = [], recipient = "", query = "", timer = null, loading = false, nextPage = null, selected = null, requestSeq = 0, totalItems = null;
  const $ = id => document.getElementById(id);
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
      '<section class="card mail-preview"><div class="mail-heading"><h2>Item Preview</h2><span class="meta">3D dressing room</span></div>' +
      '<button class="btn small" id="mailClearPreview" type="button">Clear equipment</button>' +
      preview + '<div class="mail-model-frame" id="mailModelFrame"><div class="mail-model-empty">' +
      (selected ? 'Loading 3D preview…' : 'Choose an item to preview') + '</div></div>' +
      '<p class="meta">Character models and armor use the server-hosted WotLK asset library.</p>' +
      '</section></div>';
  }
  let characterModel=null, characterViewerPromise=null, characterSeq=0;
  const characterAppearance={race:1,gender:1,skin:0,face:0,hairStyle:0,hairColor:0,facialStyle:0,items:[]};
  const equipmentSlot = item => {
    // InventoryType enumerations from WoW 3.3.5, not character inventory indices.
    const type=Number(item.inventoryType);
    return ({1:1,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,
      13:21,14:14,15:15,16:16,17:17,19:19,20:20,21:21,22:22,23:23,25:25,26:26})[type]||0;
  };
  let viewerStage='initialization';
  async function loadCharacterViewer() {
    if(!characterViewerPromise)characterViewerPromise=(async()=>{
      if(!window.jQuery){
        await new Promise((ok,no)=>{
          const script=document.createElement('script');script.src='https://code.jquery.com/jquery-3.5.1.min.js';
          script.onload=ok;script.onerror=()=>no(Error('jQuery unavailable'));
          document.head.append(script);
        });
      }
      viewerStage='Checking dashboard model-data configuration';
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
      viewerStage='Loading WotLK viewer library';
      return import('https://esm.sh/wotlk-model-viewer@1.1.9?bundle');
    })().catch(e=>{characterViewerPromise=null;throw e;});
    return characterViewerPromise;
  }
  async function renderCharacterPreview(item){
    const seq=++characterSeq,frame=$('mailModelFrame');
    if(!frame)return;
    if(characterModel){try{characterModel.destroy();}catch(e){}characterModel=null;}
    frame.textContent='Loading 3D character viewer…';
    try{
      const lib=await loadCharacterViewer();
      if(seq!==characterSeq || frame!==$('mailModelFrame'))return;
      const slot=item?equipmentSlot(item):0;
      if(item && !slot)throw Error('This item does not have a visible equipment slot.');
      // Preview exactly one item, clearing previously equipped pieces.
      characterAppearance.items=item?[[slot,Number(item.displayId)]]:[];
      frame.innerHTML='<div id="coaCharacterCanvas" style="height:420px;width:100%;"></div>';
      viewerStage='Checking WotLK character customization data';
      const metaPath='/wotlk-model-data/meta/charactercustomization2/' +
        characterAppearance.race + '_' + characterAppearance.gender + '.json';
      const metaResponse=await fetch(metaPath,{cache:'no-store'});
      const metaContentType=metaResponse.headers.get('content-type')||'';
      if(!metaResponse.ok || !metaContentType.toLowerCase().includes('application/json')){
        throw Error('Expected JSON at '+metaPath+', but received HTTP '+metaResponse.status +
          ' ('+(metaContentType||'unknown type')+'). Check the WotLK asset directory.');
      }
      const metaText=await metaResponse.text();
      try {JSON.parse(metaText);}
      catch(e){throw Error('Invalid model-data JSON at '+metaPath+': '+e.message);}
      if(seq!==characterSeq || frame!==$('mailModelFrame'))return;
      viewerStage='Loading character assets from the WotLK data package';
      const model=await lib.generateModels(1,'#coaCharacterCanvas',{...characterAppearance,hideProgressBar:true});
      if(seq!==characterSeq || frame!==$('mailModelFrame')){try{model?.destroy();}catch(e){}return;}
      characterModel=model;
    }catch(e){if(seq===characterSeq && frame===$('mailModelFrame'))frame.textContent='3D character unavailable during '+viewerStage+': '+e.message;}
  }
  // Redraw while retaining the composer's unsent text and selected recipient.
  function redraw() {
    const values = ['mailSubject','mailBody','mailGold'].map(id=>$(id)?.value);
    recipient = $("mailRecipient")?.value || recipient;
    query = $("mailSearch")?.value ?? query;
    ++characterSeq;
    if(characterModel){try{characterModel.destroy();}catch(e){}characterModel=null;}
    draw();
    renderCharacterPreview(selected);
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
    if(e.target.closest('#mailClearPreview')) { selected=null;redraw();return; }
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
  window.showMailPage=()=>{if(!$("mailPage"))return;draw();renderCharacterPreview(selected);loadPlayers();if(!counted){counted=true;countItems();}};
  if (location.hash.split("/")[0] === "#mail") window.showMailPage();
})();

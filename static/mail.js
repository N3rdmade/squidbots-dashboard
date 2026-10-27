/* Dedicated CoA Mail Center — separate from moderation. Never writes to SQL. */
(() => {
  let players = [], items = [], cart = [], recipient = "", query = "", timer = null, loading = false;
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
    const matches = items.map(v => '<button class="mail-item" type="button" data-catalog="' + v.id + '">' +
      icon(v) + '<span class="mail-item-body"><strong class="mail-quality-' + v.quality + '">' + html(v.name) + '</strong>' +
      '<small>Level ' + v.level + ' · ID ' + v.id + '</small></span><span class="mail-add">+</span></button>').join('');
    const slots = Array.from({length:12},(_,i)=>{
      const v=cart[i];
      return v ? '<div class="mail-slot filled" title="' + html(v.name) + '">' + icon(v) +
        '<span class="mail-slot-num">' + v.count + '</span><button data-remove="' + i + '" title="Remove item" aria-label="Remove item">×</button></div>' :
        '<div class="mail-slot" aria-label="Empty attachment slot"></div>';
    }).join('');
    $("mailPage").innerHTML = '<div class="mail-layout"><section class="card mail-catalog"><div class="mail-heading"><h2>Item Library</h2><span class="meta">Search your CoA item database</span></div>' +
      '<input id="mailSearch" type="search" placeholder="Search items (e.g. head, sword, potion)" value="' + html(query) + '" aria-label="Search items">' +
      '<div id="mailCatalogStatus" class="meta">' + (loading ? 'Searching…' : items.length ? items.length + ' matching items' : 'Type at least two characters to search') + '</div>' +
      '<div class="mail-items">' + matches + '</div></section>' +
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
      '<p class="gm-result" role="status" id="mailFeedback"></p></section></div>';
  }
  // Redraw while retaining the composer's unsent text and selected recipient.
  function redraw() {
    const values = ['mailSubject','mailBody','mailGold'].map(id=>$(id)?.value);
    recipient = $("mailRecipient")?.value || recipient;
    query = $("mailSearch")?.value ?? query;
    draw();
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
    if(query.length < 2){items=[];redraw();return;}
    loading=true;
    const status=$("mailCatalogStatus");if(status)status.textContent='Searching…';
    try{
      const response=await fetch('/api/items?q='+encodeURIComponent(query),{cache:'no-store'});
      const data=await response.json();
      if(!response.ok || data.error)throw Error(data.error||'Search failed');
      items=data.items||[];
      loading=false;
      redraw();
    }catch(e){loading=false;items=[];redraw();if($("mailCatalogStatus"))$("mailCatalogStatus").textContent='Search failed: '+e.message;}
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
    const add=e.target.closest('[data-catalog]');
    if(add){const item=items.find(v=>String(v.id)===add.dataset.catalog);if(!item)return;
      const found=cart.find(v=>v.id===item.id);
      if(found)found.count=Math.min(200,found.count+1);
      else if(cart.length<12)cart.push({...item,count:1});
      redraw();return;}
    const remove=e.target.closest('[data-remove]');
    if(remove){cart.splice(Number(remove.dataset.remove),1);redraw();return;}
    if(e.target.closest('#mailSendItems'))send('items');
    if(e.target.closest('#mailSendGold'))send('money');
  });
  window.showMailPage=()=>{if(!$("mailPage"))return;draw();loadPlayers();};
  if (location.hash.split("/")[0] === "#mail") window.showMailPage();
})();

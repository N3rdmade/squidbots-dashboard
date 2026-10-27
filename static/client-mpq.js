/* Client-side read-only MPQ diagnostic. Never transmits game files to the backend. */
let modulePromise;
async function mpqLibrary() {
  // Browser entry point is documented by stormlib-js; dependency loaded only on demand.
  if (!modulePromise) modulePromise=import('https://esm.sh/stormlib-js@0.1.1/browser?bundle')
    .catch(e=>{modulePromise=null;throw e;});
  return modulePromise;
}
async function archivesIn(root) {
  const result=[], queue=[{handle:root,depth:0,path:root.name}];
  while(queue.length){
    const {handle,depth,path}=queue.shift();
    for await(const [name,entry] of handle.entries()){
      if(entry.kind==='file' && /\.mpq$/i.test(name)) result.push({handle:entry,name,path:path+'/'+name});
      else if(entry.kind==='directory' && depth<3 &&
        (depth===0||/^(data|en[a-z]{2}|client|patches|locale)$/i.test(name)))
        queue.push({handle:entry,depth:depth+1,path:path+'/'+name});
    }
  }
  // Most recently patched archive likely contains overriding DBC tables.
  result.sort((a,b)=>b.name.localeCompare(a.name,undefined,{numeric:true}));
  return result;
}
// WDBC item appearance table: ID, model name 1/2, model texture 1/2, inventory icon ...
// The first appearance filename is at column 1, a string-block offset.
export async function resolveCoADisplay(folder, displayId, progress=()=>{}) {
  const id=Number(displayId);
  if(!Number.isSafeInteger(id)||id<=0) throw Error('Invalid display ID');
  const entries=await archivesIn(folder);
  const {MpqArchive}=await mpqLibrary();
  let skipped=0, failed=0;
  for(const entry of entries){
    const file=await entry.handle.getFile();
    if(file.size>400*1024*1024){skipped++;continue;}
    progress('Searching '+entry.name+' for display '+id+'…');
    let archive;
    try {
      archive=MpqArchive.openFromBuffer(await file.arrayBuffer());
      const name='DBFilesClient\\ItemDisplayInfo.dbc';
      if(!archive.hasFile(name))continue;
      const bytes=archive.extractFile(name);
      const raw=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
      const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
      if(String.fromCharCode(...raw.subarray(0,4))!=='WDBC')continue;
      const count=view.getUint32(4,true),fields=view.getUint32(8,true),
            stride=view.getUint32(12,true),strings=view.getUint32(16,true);
      const start=20+count*stride;
      if(stride<20||start+strings>raw.byteLength)continue;
      const readString=offset=>{
        if(!offset||offset>=strings)return '';
        let p=start+offset,end=p;
        while(end<start+strings&&raw[end]!==0)end++;
        return new TextDecoder('utf-8').decode(raw.subarray(p,end));
      };
      for(let i=0;i<count;i++){
        const base=20+i*stride;
        if(view.getUint32(base,true)!==id)continue;
        return {
          archive:entry.path,displayId:id,fields,
          model1:readString(view.getUint32(base+4,true)),
          model2:readString(view.getUint32(base+8,true)),
          modelTexture1:readString(view.getUint32(base+12,true)),
          modelTexture2:readString(view.getUint32(base+16,true))
        };
      }
    }catch(error){failed++;}
    finally{if(archive)archive.close();}
  }
  throw Error('Display '+id+' not found in readable ItemDisplayInfo tables ('+skipped+' large archives skipped, '+failed+' read errors).');
}
export async function inspectCoAClient(folder,progress=()=>{}) {
  const entries=await archivesIn(folder);
  if(!entries.length)throw Error('No MPQ files found.');
  const {MpqArchive}=await mpqLibrary();
  let errors=0, skipped=0;
  for(const entry of entries){
    const file=await entry.handle.getFile();
    // Large MPQs cannot be read in-memory without exhausting a browser tab.
    if(file.size>400*1024*1024){skipped++;continue;}
    progress('Reading '+entry.name+' ('+Math.ceil(file.size/1048576)+' MB)…');
    let archive;
    try{
      archive=MpqArchive.openFromBuffer(await file.arrayBuffer());
      const name='DBFilesClient\\ItemDisplayInfo.dbc';
      if(!archive.hasFile(name))continue;
      const bytes=archive.extractFile(name);
      const raw=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
      if(raw.byteLength<20)throw Error('DBC too short');
      const view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
      if(String.fromCharCode(...raw.slice(0,4))!=='WDBC')throw Error('Not a WDBC table');
      const records=view.getUint32(4,true),fields=view.getUint32(8,true),size=view.getUint32(12,true);
      if(records*size>raw.byteLength-20||records===0||fields===0)throw Error('Invalid DBC record metadata');
      return {archive:entry.path,records,fields,size};
    }catch(e){errors++;}finally{if(archive)archive.close();}
  }
  throw Error('ItemDisplayInfo.dbc was not found in '+entries.length+' archives ('+skipped+
    ' too large for browser-memory scan; '+errors+' failed). This is not a 3D renderer.');
}


// Resolve WoW weapon models by their known client path, read M2 vertices and
// the companion Skin file, and return a standalone mesh (static bind pose).
const modelPrefixes = ['Item\\ObjectComponents\\Weapon\\','Item\\ObjectComponents\\Shield\\',
  'Item\\ObjectComponents\\Head\\','Item\\ObjectComponents\\Shoulder\\',
  'Item\\ObjectComponents\\Misc\\','World\\Generic\\'];
const u32=(dv,pos)=>dv.getUint32(pos,true);
function geometryFromM2(m2,skin){
  const m=new DataView(m2.buffer,m2.byteOffset,m2.byteLength);
  const k=new DataView(skin.buffer,skin.byteOffset,skin.byteLength);
  const magic=String.fromCharCode(...m2.subarray(0,4));
  if(magic!=='MD20')throw Error('Unsupported model magic '+magic);
  const version=u32(m,4);
  if(version<264||version>274)throw Error('Model version '+version+' not yet supported');
  const count=u32(m,0x44),offset=u32(m,0x48);
  if(!count||count>150000||offset+count*48>m2.byteLength)throw Error('Invalid M2 vertices');
  if(String.fromCharCode(...skin.subarray(0,4))!=='SKIN')throw Error('Companion SKIN file is invalid');
  const indicesCount=u32(k,4),indicesOffset=u32(k,8);
  const trisCount=u32(k,12),trisOffset=u32(k,16);
  if(indicesCount>250000||trisCount>700000||
     indicesOffset+indicesCount*2>skin.byteLength||
     trisOffset+trisCount*2>skin.byteLength||trisCount%3)throw Error('Invalid skin geometry indices');
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
  for(let i=0;i<count;i++){
    const p=offset+i*48;
    positions[i*3]=m.getFloat32(p,true);positions[i*3+1]=m.getFloat32(p+4,true);positions[i*3+2]=m.getFloat32(p+8,true);
    normals[i*3]=m.getFloat32(p+20,true);normals[i*3+1]=m.getFloat32(p+24,true);normals[i*3+2]=m.getFloat32(p+28,true);
    uvs[i*2]=m.getFloat32(p+32,true);uvs[i*2+1]=1-m.getFloat32(p+36,true);
  }
  const triangles=new Uint32Array(trisCount);
  for(let i=0;i<trisCount;i++){
    const reference=k.getUint16(trisOffset+i*2,true);
    if(reference>=indicesCount)throw Error('SKIN triangle index outside vertex lookups');
    const idx=k.getUint16(indicesOffset+reference*2,true);
    if(idx>=count)throw Error('SKIN referenced vertex outside M2');
    triangles[i]=idx;
  }
  return {positions,normals,uvs,triangles,version,vertices:count,faces:trisCount/3};
}
function normalizeName(name){return name.replace(/\.mdx$/i,'.m2').replace(/\.m2$/i,'');}
export async function loadCoAMesh(folder, appearance, progress=()=>{}) {
  const base=normalizeName(appearance.model1||appearance.model2||'');
  if(!base)throw Error('This appearance has no separate 3D mesh.');
  const leaf=base.replace(/^.*[\\/]/,'');
  const dirs=base.includes('\\')?[base]:modelPrefixes.map(p=>p+leaf);
  const paths=dirs.flatMap(prefix=>[prefix+'.m2']);
  const entries=await archivesIn(folder),{MpqArchive}=await mpqLibrary();
  let failures=0,tooLarge=0;
  for(const entry of entries){
    const file=await entry.handle.getFile();
    if(file.size>400*1024*1024){tooLarge++;continue;}
    let archive;
    try{
      progress('Searching '+entry.name+' for '+leaf+'…');
      archive=MpqArchive.openFromBuffer(await file.arrayBuffer());
      for(const path of paths){
        if(!archive.hasFile(path))continue;
        const skinPath=path.replace(/\.m2$/i,'00.skin');
        if(!archive.hasFile(skinPath))continue;
        const m2data=archive.extractFile(path),skindata=archive.extractFile(skinPath);
        const m2=m2data instanceof Uint8Array?m2data:new Uint8Array(m2data);
        const skin=skindata instanceof Uint8Array?skindata:new Uint8Array(skindata);
        return {...geometryFromM2(m2,skin),archive:entry.path,modelPath:path};
      }
    }catch(e){failures++;}finally{if(archive)archive.close();}
  }
  throw Error('M2 and companion 00.skin not found in same readable archive ('+
    tooLarge+' MPQs skipped over 400 MB; '+failures+' read failures). Multi-archive overrides and texture decoding are not yet handled.');
}

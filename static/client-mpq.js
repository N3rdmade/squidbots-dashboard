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

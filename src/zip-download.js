// Streaming ZIP64 with UTF-8 names, CRC-32 and optional raw DEFLATE.
// Entries are read only when an archive is requested. ZIP64 keeps large results usable.
const encoder=new TextEncoder(),MAX32=0xffffffff;
const crcTable=Uint32Array.from({length:256},(_,value)=>{
  for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);
  return value>>>0;
});
const block=size=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
const crcStep=(crc,bytes)=>{for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255];return crc;};
function deflater(){try{return new CompressionStream('deflate-raw');}catch{return null;}}
function stamp(date){
  const year=Math.max(1980,Math.min(2107,date.getFullYear()));
  return {time:(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),
    date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()};
}
function localHeader(name,method,date){
  const h=block(30+name.length+20),v=h.view;
  v.setUint32(0,0x04034b50,true);v.setUint16(4,45,true);v.setUint16(6,0x0808,true);
  v.setUint16(8,method,true);v.setUint16(10,date.time,true);v.setUint16(12,date.date,true);
  v.setUint32(18,MAX32,true);v.setUint32(22,MAX32,true);
  v.setUint16(26,name.length,true);v.setUint16(28,20,true);h.bytes.set(name,30);
  v.setUint16(30+name.length,1,true);v.setUint16(32+name.length,16,true);
  return h.bytes;
}
function centralHeader(entry){
  const {name,method,date,crc,compressed,uncompressed,offset}=entry,h=block(46+name.length+28),v=h.view;
  v.setUint32(0,0x02014b50,true);v.setUint16(4,45,true);v.setUint16(6,45,true);v.setUint16(8,0x0808,true);
  v.setUint16(10,method,true);v.setUint16(12,date.time,true);v.setUint16(14,date.date,true);v.setUint32(16,crc,true);
  v.setUint32(20,MAX32,true);v.setUint32(24,MAX32,true);v.setUint16(28,name.length,true);v.setUint16(30,28,true);
  v.setUint32(42,MAX32,true);h.bytes.set(name,46);
  const at=46+name.length;v.setUint16(at,1,true);v.setUint16(at+2,24,true);
  v.setBigUint64(at+4,uncompressed,true);v.setBigUint64(at+12,compressed,true);v.setBigUint64(at+20,offset,true);
  return h.bytes;
}
export async function* zipChunks(entries){
  let offset=0n;const directory=[],names=new Set();
  for(const entry of entries){
    if(!entry.name||entry.name.includes('/')||entry.name.includes('\\')||entry.name.includes('\0')||names.has(entry.name))throw new Error('Invalid archive filename.');
    names.add(entry.name);
    const name=encoder.encode(entry.name);if(name.length>65535)throw new Error('Archive filename is too long.');
    const blob=entry.blob;if(!(blob instanceof Blob))throw new Error('Archive entry must be a file or Blob.');
    const compression=deflater(),method=compression?8:0,date=stamp(new Date(blob.lastModified||Date.now()));
    const start=offset,header=localHeader(name,method,date);yield header;offset+=BigInt(header.length);
    let crc=MAX32,uncompressed=0n,compressed=0n,yielded=0;
    let stream=blob.stream().pipeThrough(new TransformStream({transform(chunk,controller){
      crc=crcStep(crc,chunk);uncompressed+=BigInt(chunk.length);controller.enqueue(chunk);
    }}));
    if(compression)stream=stream.pipeThrough(compression);
    const reader=stream.getReader();
    try{for(;;){const {done,value}=await reader.read();if(done)break;
      yield value;compressed+=BigInt(value.length);offset+=BigInt(value.length);yielded+=value.length;
      if(yielded>=8*1048576){yielded=0;await new Promise(resolve=>setTimeout(resolve,0));}
    }}finally{await reader.cancel();reader.releaseLock();}
    if(uncompressed!==BigInt(blob.size))throw new Error('Result file changed while downloading.');
    crc=(crc^MAX32)>>>0;
    const descriptor=block(24);descriptor.view.setUint32(0,0x08074b50,true);descriptor.view.setUint32(4,crc,true);
    descriptor.view.setBigUint64(8,compressed,true);descriptor.view.setBigUint64(16,uncompressed,true);
    yield descriptor.bytes;offset+=24n;
    directory.push({name,method,date,crc,compressed,uncompressed,offset:start});
  }
  const centralOffset=offset;
  for(const entry of directory){const header=centralHeader(entry);yield header;offset+=BigInt(header.length);}
  const centralSize=offset-centralOffset,end=block(56),v=end.view;
  v.setUint32(0,0x06064b50,true);v.setBigUint64(4,44n,true);v.setUint16(12,45,true);v.setUint16(14,45,true);
  v.setBigUint64(24,BigInt(directory.length),true);v.setBigUint64(32,BigInt(directory.length),true);
  v.setBigUint64(40,centralSize,true);v.setBigUint64(48,centralOffset,true);yield end.bytes;
  const locator=block(20);locator.view.setUint32(0,0x07064b50,true);locator.view.setBigUint64(8,offset,true);locator.view.setUint32(16,1,true);yield locator.bytes;
  const tail=block(22);tail.view.setUint32(0,0x06054b50,true);tail.view.setUint16(8,65535,true);tail.view.setUint16(10,65535,true);
  tail.view.setUint32(12,MAX32,true);tail.view.setUint32(16,MAX32,true);yield tail.bytes;
}
export async function downloadZip(filename,entries){
  // Ask for the target during the click's user activation, before opening OPFS files.
  const handle=typeof globalThis.showSaveFilePicker==='function'?await globalThis.showSaveFilePicker({
    suggestedName:filename,types:[{description:'ZIP',accept:{'application/zip':['.zip']}}],
  }):null;
  const files=typeof entries==='function'?await entries():entries;
  const writer=handle?await handle.createWritable():null,parts=[];
  try{
    for await(const chunk of zipChunks(files)){
      if(writer)await writer.write(chunk);else parts.push(new Blob([chunk]));
    }
    if(writer){await writer.close();return;}
    const url=URL.createObjectURL(new Blob(parts,{type:'application/zip'})),link=document.createElement('a');
    link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){if(writer)await writer.abort().catch(()=>{});throw error;}
}

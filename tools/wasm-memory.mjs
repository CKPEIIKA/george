// Read the engine's declared memory width and limits directly from its binary.
export function wasmMemories(bytes) {
  const data = new Uint8Array(bytes);
  if (data.length < 8 || ![0,97,115,109,1,0,0,0].every((v,i)=>data[i]===v)) throw Error('Invalid Wasm header');
  let offset=8;
  const uint=()=>{
    let value=0n,shift=0n;
    for(let i=0;i<10;i++){
      if(offset>=data.length)throw Error('Truncated Wasm integer');
      const b=data[offset++];value|=BigInt(b&127)<<shift;
      if(!(b&128))return value;
      shift+=7n;
    }
    throw Error('Invalid Wasm integer');
  };
  while(offset<data.length){
    const id=data[offset++],length=Number(uint()),end=offset+length;
    if(end>data.length)throw Error('Truncated Wasm section');
    if(id===5){
      const count=Number(uint()),memories=[];
      for(let i=0;i<count;i++){
        const flags=Number(uint()),initial=uint(),maximum=flags&1?uint():undefined;
        memories.push({memory64:!!(flags&4),shared:!!(flags&2),initialBytes:Number(initial*65536n),
          maximumBytes:maximum===undefined?undefined:Number(maximum*65536n)});
      }
      if(offset!==end)throw Error('Unexpected Wasm memory encoding');
      return memories;
    }
    offset=end;
  }
  return [];
}

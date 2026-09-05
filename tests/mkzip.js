const zlib=require('zlib');
function mkzip(files){
  const enc=new TextEncoder(),loc=[],cen=[];let off=0;
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;
    for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
  const crc32=u8=>{let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0};
  for(const f of files){
    const nm=enc.encode(f.name),data=enc.encode(f.body),c=crc32(data);
    const body=new Uint8Array(zlib.deflateRawSync(Buffer.from(data)));
    const h=new Uint8Array(30+nm.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);
    d.setUint16(8,8,true);d.setUint32(14,c,true);
    d.setUint32(18,body.length,true);d.setUint32(22,data.length,true);
    d.setUint16(26,nm.length,true);h.set(nm,30);
    loc.push(h,body);
    const ch=new Uint8Array(46+nm.length),cd=new DataView(ch.buffer);
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);
    cd.setUint16(8,0x800,true);cd.setUint16(10,8,true);cd.setUint32(16,c,true);
    cd.setUint32(20,body.length,true);cd.setUint32(24,data.length,true);
    cd.setUint16(28,nm.length,true);cd.setUint32(42,off,true);ch.set(nm,46);
    cen.push(ch);off+=h.length+body.length;
  }
  const cs=cen.reduce((s,x)=>s+x.length,0);
  const end=new Uint8Array(22),ed=new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true);ed.setUint16(8,files.length,true);
  ed.setUint16(10,files.length,true);ed.setUint32(12,cs,true);ed.setUint32(16,off,true);
  const all=[...loc,...cen,end];
  const total=all.reduce((s,x)=>s+x.length,0),out=new Uint8Array(total);
  let p=0;for(const x of all){out.set(x,p);p+=x.length}
  return out.buffer;
}

module.exports={mkzip};

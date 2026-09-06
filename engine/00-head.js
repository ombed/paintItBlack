/* מנוע ההשחרה — הועבר כמו שהוא. אין כאן DOM. */
let nerSayFn=()=>{};
export const setNerSay=f=>{nerSayFn=f||(()=>{})};
const nerSay=(t,p)=>nerSayFn(t,p);
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;
  for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0}
async function pipe(u8,S,fmt){const s=new Blob([u8]).stream().pipeThrough(new S(fmt));
  return new Uint8Array(await new Response(s).arrayBuffer())}
const inflate=u8=>pipe(u8,DecompressionStream,"deflate-raw");
const deflate=u8=>pipe(u8,CompressionStream,"deflate-raw");

async function unzip(buf){
  const dv=new DataView(buf),N=buf.byteLength;let e=-1;
  for(let i=N-22;i>=Math.max(0,N-66000);i--) if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0) throw new Error("הקובץ לא נראה כמו ‎.docx תקין");
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50) throw new Error("מבנה הקובץ פגום");
    const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),
      nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),
      lo=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(new Uint8Array(buf,p+46,nl));
    const lnl=dv.getUint16(lo+26,true),lel=dv.getUint16(lo+28,true);
    const raw=new Uint8Array(buf,lo+30+lnl+lel,cs);
    out.push({name,meth,raw});p+=46+nl+el+cl;
  }
  for(const f of out) f.data = f.meth===0 ? raw2(f.raw) : await inflate(f.raw);
  return out;
}
const raw2=u=>new Uint8Array(u);
async function zip(files){
  const enc=new TextEncoder(),loc=[],cen=[];let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),c=crc32(f.data);
    let body,meth=8;
    try{body=await deflate(f.data); if(body.length>=f.data.length){body=f.data;meth=0}}
    catch(_){body=f.data;meth=0}
    const h=new Uint8Array(30+nm.length),d=new DataView(h.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(6,0x800,true);
    d.setUint16(8,meth,true);d.setUint32(14,c,true);
    d.setUint32(18,body.length,true);d.setUint32(22,f.data.length,true);
    d.setUint16(26,nm.length,true);h.set(nm,30);
    loc.push(h,body);
    const ch=new Uint8Array(46+nm.length),cd=new DataView(ch.buffer);
    cd.setUint32(0,0x02014b50,true);cd.setUint16(4,20,true);cd.setUint16(6,20,true);
    cd.setUint16(8,0x800,true);cd.setUint16(10,meth,true);cd.setUint32(16,c,true);
    cd.setUint32(20,body.length,true);cd.setUint32(24,f.data.length,true);
    cd.setUint16(28,nm.length,true);cd.setUint32(42,off,true);ch.set(nm,46);
    cen.push(ch);off+=h.length+body.length;
  }
  const cs=cen.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array(22),ed=new DataView(end.buffer);
  ed.setUint32(0,0x06054b50,true);ed.setUint16(8,files.length,true);
  ed.setUint16(10,files.length,true);ed.setUint32(12,cs,true);ed.setUint32(16,off,true);
  return new Blob([...loc,...cen,end]);
}


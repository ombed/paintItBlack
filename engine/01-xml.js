/* ══════════════════════════ XML ══════════════════════════ */
const W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XMLNS="http://www.w3.org/XML/1998/namespace";
const DEC='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';
const TXT=new TextDecoder(),ENC=new TextEncoder();
function rootTag(s){let i=0;
  while(i<s.length){const j=s.indexOf("<",i); if(j<0)return null;
    if(s[j+1]==="?"||s[j+1]==="!"){i=s.indexOf(">",j)+1;continue}
    let k=j+1,q=null;
    while(k<s.length){const c=s[k];
      if(q){if(c===q)q=null}else if(c==='"'||c==="'")q=c;else if(c===">")return s.slice(j,k+1);
      k++}
    return null}
  return null}
function parseXML(str){const d=new DOMParser().parseFromString(str,"application/xml");
  if(d.querySelector("parsererror")) throw new Error("XML פגום");return d}
function serXML(doc,orig){
  let out=new XMLSerializer().serializeToString(doc);
  const o=rootTag(orig),n=rootTag(out);
  if(o&&n&&!n.endsWith("/>")) out=o+out.slice(n.length);
  return DEC+out;
}
const TEXTPART=/^word\/(glossary\/)?(document\d*\.xml|header\d*\.xml|footer\d*\.xml|footnotes\.xml|endnotes\.xml)$/;
const DROP=["word/comments.xml","word/commentsExtended.xml","word/commentsIds.xml",
  "word/commentsExtensible.xml","word/people.xml","docProps/custom.xml","word/threadedComments.xml"];


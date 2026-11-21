'use strict';
// 웹 버전(docs/index.html)과 같은 변환 코드
const CDN='https://cdnjs.cloudflare.com/ajax/libs/';
const COL={PNG:'#8FB3E0',JPG:'#E2B93B',WEBP:'#9CC79A',PDF:'#E58A7C',JSON:'#C9BFA9',CSV:'#9CC79A',XLSX:'#6FAE77',MD:'#8FB3E0',HTML:'#E9A66B',TXT:'#FBF8F1',ZIP:'#C9BFA9'};
const NOTE={PNG:'투명 유지',JPG:'작은 용량',WEBP:'웹용',PDF:'문서',JSON:'데이터',CSV:'표',XLSX:'엑셀',MD:'마크다운',HTML:'웹 문서',TXT:'글자만'};
const KIND={png:'image',jpg:'image',jpeg:'image',webp:'image',gif:'image',bmp:'image',svg:'image',avif:'image',ico:'image',
 pdf:'pdf',csv:'csv',tsv:'csv',json:'json',xlsx:'sheet',xls:'sheet',md:'md',markdown:'md',html:'html',htm:'html',txt:'txt',log:'txt'};
const TARGETS={image:['PNG','JPG','WEBP','PDF'],pdf:['PNG','JPG','TXT'],csv:['JSON','XLSX','MD','HTML'],json:['CSV','XLSX','TXT'],sheet:['CSV','JSON','HTML'],md:['HTML','TXT'],html:['TXT','MD'],txt:['MD','HTML','JSON']};
const extOf=n=>{const m=/\.([a-z0-9]+)$/i.exec(n||'');return m?m[1].toLowerCase():'';};
const baseOf=n=>(n||'file').replace(/\.[a-z0-9]+$/i,'')||'file';
const kindOf=f=>KIND[extOf(f.name)]||(f.type.startsWith('image/')?'image':f.type==='application/pdf'?'pdf':f.type.startsWith('text/')?'txt':null);
const size=n=>n<1024?n+'B':n<1048576?(n/1024).toFixed(0)+'KB':(n/1048576).toFixed(1)+'MB';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function lib(url,glob){return new Promise((ok,no)=>{if(window[glob])return ok(window[glob]);const s=document.createElement('script');s.src=url;s.onload=()=>window[glob]?ok(window[glob]):no(new Error('lib'));s.onerror=()=>no(new Error('도구를 불러오지 못했어. 인터넷 연결을 확인해줘.'));document.head.appendChild(s);});}

/* ---------- 그림 ---------- */
async function loadImage(file){
 const e=extOf(file.name);
 if(e!=='svg'){try{return await createImageBitmap(file);}catch(_){}}
 const url=URL.createObjectURL(file);
 try{const im=new Image();im.src=url;await im.decode();
  let w=im.naturalWidth||1024,h=im.naturalHeight||1024;if(e==='svg'&&Math.max(w,h)<1024){const k=1024/Math.max(w,h);w=Math.round(w*k);h=Math.round(h*k);}
  const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);return c;}
 finally{URL.revokeObjectURL(url);}
}
function toCanvas(src,white){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const g=c.getContext('2d');if(white){g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);}g.drawImage(src,0,0);return c;}
const canvasBlob=(c,type,q)=>new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('이 브라우저는 이 형식으로 저장을 못 해.')),type,q));
async function jpegPdf(pages){ // pages: [{jpg:Uint8Array,w,h}] — 직접 쓰는 최소 PDF
 const enc=new TextEncoder(),parts=[],offs=[];let len=0;
 const put=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);len+=b.length;};
 const obj=(n,body)=>{offs[n]=len;put(n+' 0 obj\n');if(typeof body==='string')put(body);else body();put('\nendobj\n');};
 put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
 const n=pages.length,kids=[];for(let i=0;i<n;i++)kids.push((3+i*3)+' 0 R');
 obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
 obj(2,'<< /Type /Pages /Count '+n+' /Kids ['+kids.join(' ')+'] >>');
 pages.forEach((p,i)=>{const a=3+i*3,k=Math.min(1,1400/Math.max(p.w,p.h)*1.0),W=+(p.w*0.75).toFixed(2),H=+(p.h*0.75).toFixed(2);
  obj(a,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+W+' '+H+'] /Resources << /XObject << /Im0 '+(a+1)+' 0 R >> >> /Contents '+(a+2)+' 0 R >>');
  obj(a+1,()=>{put('<< /Type /XObject /Subtype /Image /Width '+p.w+' /Height '+p.h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+p.jpg.length+' >>\nstream\n');put(p.jpg);put('\nendstream');});
  const cs='q '+W+' 0 0 '+H+' 0 0 cm /Im0 Do Q';obj(a+2,'<< /Length '+cs.length+' >>\nstream\n'+cs+'\nendstream');});
 const xref=len,total=3+n*3;let x='xref\n0 '+total+'\n0000000000 65535 f \n';
 for(let i=1;i<total;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
 put(x+'trailer\n<< /Size '+total+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
 return new Blob(parts,{type:'application/pdf'});
}
async function convImage(file,t){
 const src=await loadImage(file);
 if(t==='PNG')return canvasBlob(toCanvas(src,false),'image/png');
 if(t==='WEBP'){const b=await canvasBlob(toCanvas(src,false),'image/webp',0.9);if(b.type!=='image/webp')throw new Error('이 브라우저는 WEBP 저장을 못 해.');return b;}
 const jb=await canvasBlob(toCanvas(src,true),'image/jpeg',0.92);
 if(t==='JPG')return jb;
 return jpegPdf([{jpg:new Uint8Array(await jb.arrayBuffer()),w:src.width,h:src.height}]);
}

/* ---------- ZIP (압축 없이 묶기) ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t;})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zip(files){ // [{name,data:Uint8Array}]
 const enc=new TextEncoder(),parts=[],cen=[];let off=0;
 for(const f of files){const nm=enc.encode(f.name),crc=crc32(f.data),h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,f.data.length,true);h.setUint32(22,f.data.length,true);h.setUint16(26,nm.length,true);
  parts.push(new Uint8Array(h.buffer),nm,f.data);
  const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,f.data.length,true);c.setUint32(24,f.data.length,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
  cen.push(new Uint8Array(c.buffer),nm);off+=30+nm.length+f.data.length;}
 let cl=0;for(const c of cen)cl+=c.length;
 const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cl,true);e.setUint32(16,off,true);
 return new Blob([...parts,...cen,new Uint8Array(e.buffer)],{type:'application/zip'});
}

/* ---------- PDF 읽기 ---------- */
async function pdfDoc(file){
 const pdfjs=await lib('vendor/pdf.min.js','pdfjsLib');
 pdfjs.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';
 return pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
}
async function convPdf(file,t){
 const doc=await pdfDoc(file),n=doc.numPages;
 if(t==='TXT'){let out='';for(let i=1;i<=n;i++){const tc=await (await doc.getPage(i)).getTextContent();let line='',ly=null;
   for(const it of tc.items){const y=it.transform?Math.round(it.transform[5]):ly;if(ly!==null&&Math.abs(y-ly)>2){out+=line.trimEnd()+'\n';line='';}line+=it.str;ly=y;}
   out+=line.trimEnd()+'\n'+(i<n?'\n':'');}
  return new Blob([out],{type:'text/plain'});}
 const type=t==='PNG'?'image/png':'image/jpeg',ext=t.toLowerCase(),outs=[],max=Math.min(n,60);
 for(let i=1;i<=max;i++){const pg=await doc.getPage(i),vp=pg.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:g,viewport:vp}).promise;
  outs.push(await canvasBlob(c,type,0.92));}
 if(outs.length===1)return outs[0];
 const files=[];for(let i=0;i<outs.length;i++)files.push({name:baseOf(file.name)+'-'+String(i+1).padStart(2,'0')+'.'+ext,data:new Uint8Array(await outs[i].arrayBuffer())});
 const z=zip(files);z._ext='zip';return z;
}

/* ---------- 표·글 ---------- */
function parseCSV(text,sep){
 text=text.replace(/^﻿/,'');if(!sep){const first=text.split(/\r?\n/)[0]||'';sep=(first.split('\t').length>first.split(',').length)?'\t':(first.split(';').length>first.split(',').length?';':',');}
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=ch;}
  else if(ch==='"')q=true;else if(ch===sep){row.push(cell);cell='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=ch;}
 if(cell!==''||row.length){row.push(cell);rows.push(row);}
 return rows.filter(r=>r.length>1||r[0]!=='');
}
const csvCell=v=>{v=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
const toCSV=rows=>'﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
function rowsToObjs(rows){const h=rows[0]||[];return rows.slice(1).map(r=>{const o={};h.forEach((k,i)=>{const v=r[i]==null?'':r[i];o[k||('열'+(i+1))]=v!==''&&!isNaN(v)&&/^-?\d+(\.\d+)?$/.test(String(v).trim())?Number(v):v;});return o;});}
function jsonToRows(data){
 if(!Array.isArray(data)){if(data&&typeof data==='object'){const arr=Object.values(data).find(Array.isArray);data=arr||[data];}else data=[{값:data}];}
 if(data.every(Array.isArray))return data;
 const keys=[];for(const o of data)if(o&&typeof o==='object')for(const k of Object.keys(o))if(!keys.includes(k))keys.push(k);
 if(!keys.length)return [['값'],...data.map(v=>[v])];
 return [keys,...data.map(o=>keys.map(k=>o&&typeof o==='object'?o[k]:''))];
}
const htmlPage=(title,body)=>'<!DOCTYPE html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font-family:system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 18px;line-height:1.7;color:#2B2A28}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cfc8b8;padding:6px 10px;text-align:left}th{background:#F4EFE6}pre{background:#F4EFE6;padding:12px;border-radius:8px;overflow:auto}code{background:#F4EFE6;padding:1px 5px;border-radius:4px}</style></head><body>\n'+body+'\n</body></html>';
const rowsHtml=rows=>'<table>\n'+rows.map((r,i)=>'<tr>'+r.map(c=>(i?'<td>':'<th>')+esc(c==null?'':c)+(i?'</td>':'</th>')).join('')+'</tr>').join('\n')+'\n</table>';
const rowsMd=rows=>{const w=Math.max(...rows.map(r=>r.length)),f=r=>'| '+Array.from({length:w},(_,i)=>String(r[i]==null?'':r[i]).replace(/\|/g,'\\|').replace(/\n/g,' ')).join(' | ')+' |';return [f(rows[0]||[]),'| '+Array(w).fill('---').join(' | ')+' |',...rows.slice(1).map(f)].join('\n')+'\n';};
function mdToHtml(md){
 const inl=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g,'$1<em>$2</em>').replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,'<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,'<a href="$2">$1</a>');
 const L=md.replace(/\r/g,'').split('\n'),out=[];let i=0;
 while(i<L.length){const l=L[i];
  if(/^```/.test(l)){const b=[];i++;while(i<L.length&&!/^```/.test(L[i]))b.push(L[i++]);i++;out.push('<pre><code>'+esc(b.join('\n'))+'</code></pre>');continue;}
  const h=/^(#{1,6})\s+(.*)$/.exec(l);if(h){out.push('<h'+h[1].length+'>'+inl(h[2])+'</h'+h[1].length+'>');i++;continue;}
  if(/^\s*([-*+]|\d+\.)\s+/.test(l)){const od=/^\s*\d+\./.test(l),b=[];while(i<L.length&&/^\s*([-*+]|\d+\.)\s+/.test(L[i]))b.push('<li>'+inl(L[i++].replace(/^\s*([-*+]|\d+\.)\s+/,''))+'</li>');out.push((od?'<ol>':'<ul>')+b.join('')+(od?'</ol>':'</ul>'));continue;}
  if(/^\|.*\|\s*$/.test(l)&&/^\|[\s:|-]+\|\s*$/.test(L[i+1]||'')){const rows=[];const sp=s=>s.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());rows.push(sp(l));i+=2;while(i<L.length&&/^\|.*\|\s*$/.test(L[i]))rows.push(sp(L[i++]));out.push(rowsHtml(rows));continue;}
  if(/^>\s?/.test(l)){const b=[];while(i<L.length&&/^>\s?/.test(L[i]))b.push(inl(L[i++].replace(/^>\s?/,'')));out.push('<blockquote>'+b.join('<br>')+'</blockquote>');continue;}
  if(/^(-{3,}|\*{3,})\s*$/.test(l)){out.push('<hr>');i++;continue;}
  if(!l.trim()){i++;continue;}
  const b=[];while(i<L.length&&L[i].trim()&&!/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+\.)\s+)/.test(L[i]))b.push(inl(L[i++]));out.push('<p>'+b.join('<br>')+'</p>');}
 return out.join('\n');
}
const mdToTxt=md=>md.replace(/\r/g,'').replace(/^```.*$/gm,'').replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/!\[([^\]]*)\]\([^)]+\)/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/^>\s?/gm,'');
function htmlDoc(text){return new DOMParser().parseFromString(text,'text/html');}
function htmlToTxt(text){const d=htmlDoc(text);d.querySelectorAll('script,style,noscript').forEach(e=>e.remove());d.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));d.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6,section,article').forEach(e=>e.append('\n'));return (d.body?d.body.textContent:'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';}
function htmlToMd(text){const d=htmlDoc(text);d.querySelectorAll('script,style,noscript').forEach(e=>e.remove());
 const walk=n=>{if(n.nodeType===3)return n.nodeValue.replace(/\s+/g,' ');if(n.nodeType!==1)return '';const t=n.tagName.toLowerCase(),c=()=>[...n.childNodes].map(walk).join('');
  if(/^h[1-6]$/.test(t))return '\n\n'+'#'.repeat(+t[1])+' '+c().trim()+'\n\n';
  if(t==='p'||t==='div'||t==='section'||t==='article')return '\n\n'+c().trim()+'\n\n';
  if(t==='br')return '\n';if(t==='strong'||t==='b')return '**'+c()+'**';if(t==='em'||t==='i')return '*'+c()+'*';if(t==='code')return '`'+c()+'`';
  if(t==='a')return '['+c()+']('+(n.getAttribute('href')||'')+')';if(t==='img')return '!['+(n.getAttribute('alt')||'')+']('+(n.getAttribute('src')||'')+')';
  if(t==='li')return '\n'+(n.parentElement&&n.parentElement.tagName==='OL'?'1. ':'- ')+c().trim();if(t==='ul'||t==='ol')return '\n'+c()+'\n\n';
  if(t==='pre')return '\n\n```\n'+n.textContent.replace(/\n$/,'')+'\n```\n\n';if(t==='hr')return '\n\n---\n\n';
  if(t==='table'){const rows=[...n.querySelectorAll('tr')].map(r=>[...r.children].map(x=>x.textContent.trim()));return rows.length?'\n\n'+rowsMd(rows)+'\n':'';}
  return c();};
 return walk(d.body||d.documentElement).replace(/\n[ \t]+(?=\n)/g,'\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';}
const XL=()=>lib('vendor/xlsx.full.min.js','XLSX');
async function rowsXlsx(rows){const X=await XL(),wb=X.utils.book_new();X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet(rows),'Sheet1');return new Blob([X.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
const T=(s,type)=>new Blob([s],{type:type||'text/plain'});
async function convText(file,kind,t){
 if(kind==='sheet'){const X=await XL(),wb=X.read(new Uint8Array(await file.arrayBuffer()),{type:'array'}),rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
  if(t==='CSV')return T(toCSV(rows),'text/csv');if(t==='JSON')return T(JSON.stringify(rowsToObjs(rows),null,2),'application/json');return T(htmlPage(baseOf(file.name),rowsHtml(rows)),'text/html');}
 const text=await file.text();
 if(kind==='csv'){const rows=parseCSV(text,extOf(file.name)==='tsv'?'\t':null);if(!rows.length)throw new Error('표에 내용이 없어.');
  if(t==='JSON')return T(JSON.stringify(rowsToObjs(rows),null,2),'application/json');if(t==='XLSX')return rowsXlsx(rows);if(t==='MD')return T(rowsMd(rows));return T(htmlPage(baseOf(file.name),rowsHtml(rows)),'text/html');}
 if(kind==='json'){let data;try{data=JSON.parse(text);}catch(e){throw new Error('JSON 문법이 틀렸어: '+e.message);}
  if(t==='TXT')return T(JSON.stringify(data,null,2));const rows=jsonToRows(data);if(t==='CSV')return T(toCSV(rows),'text/csv');return rowsXlsx(rows);}
 if(kind==='md'){return t==='HTML'?T(htmlPage(baseOf(file.name),mdToHtml(text)),'text/html'):T(mdToTxt(text));}
 if(kind==='html'){return t==='TXT'?T(htmlToTxt(text)):T(htmlToMd(text));}
 if(t==='MD')return T(text);if(t==='HTML')return T(htmlPage(baseOf(file.name),text.split(/\n{2,}/).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join('\n')),'text/html');
 return T(JSON.stringify(text.replace(/\r/g,'').split('\n'),null,2),'application/json');
}
async function convert(file,t){
 const kind=kindOf(file);if(!kind)throw new Error('아직 못 바꾸는 파일이야.');
 const blob=kind==='image'?await convImage(file,t):kind==='pdf'?await convPdf(file,t):await convText(file,kind,t);
 const ext=blob._ext||t.toLowerCase();return {name:baseOf(file.name)+'.'+ext,blob};
}


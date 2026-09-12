/* Render ONLY the currently visible lesson text region into a local image.
 * This is a DOM-rendered reading-area image, NOT OS screen capture.
 * No getDisplayMedia, remote rendering service, images, or OCR are used.
 * Pure inline SVG/foreignObject -> canvas; a labelled quote-card fallback is
 * returned when browser restrictions prevent DOM rasterization.
 */
const CAPTURE_STYLES=['display','box-sizing','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-transform','text-decoration','text-decoration-color','text-decoration-thickness','white-space','word-break','overflow-wrap','color','background-color','border-top','border-right','border-bottom','border-left','border-radius','padding','margin','list-style-type','list-style-position','vertical-align','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','gap','align-items','justify-content','flex-direction','flex-shrink','flex-grow'];
function styledCopy(node){
 if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.nodeValue);
 if(node.nodeType!==Node.ELEMENT_NODE)return null;
 if(node.matches('button,input,textarea,script,iframe,img,[data-no-capture]'))return null;
 const copy=node.cloneNode(false),styles=getComputedStyle(node);
 for(const attr of [...copy.attributes])if(/^on/i.test(attr.name)||['id','href','src'].includes(attr.name))copy.removeAttribute(attr.name);
 copy.removeAttribute('class');
 for(const p of CAPTURE_STYLES)copy.style.setProperty(p,styles.getPropertyValue(p));
 if(node.localName==='svg'){const r=node.getBoundingClientRect();copy.style.width=r.width+'px';copy.style.height=r.height+'px';copy.setAttribute('width',r.width);copy.setAttribute('height',r.height);}
 for(const child of node.childNodes){const c=styledCopy(child);if(c)copy.append(c);}
 return copy;
}
function quoteCardFallback(anchor,reason){
 const c=document.createElement('canvas');c.width=760;c.height=560;const ctx=c.getContext('2d');ctx.fillStyle='#fffefa';ctx.fillRect(0,0,760,560);ctx.fillStyle='#708267';ctx.font='16px sans-serif';ctx.fillText(anchor.language==='ko'?'원문 인용 카드 · 화면 캡처 대체':'QUOTATION CARD · CAPTURE FALLBACK',40,44);ctx.fillStyle='#d3ddc3';ctx.fillRect(40,78,4,410);ctx.fillStyle='#34493a';ctx.font='23px sans-serif';let line='',y=110;for(const char of Array.from(anchor.quote||'')){if(char==='\n'||ctx.measureText(line+char).width>630){ctx.fillText(line,62,y);y+=40;line=char==='\n'?'':char;if(y>468){ctx.fillText('…',62,y);break;}}else line+=char;}if(y<=468&&line)ctx.fillText(line,62,y);ctx.fillStyle='#9aa38e';ctx.font='12px sans-serif';ctx.fillText('Quote preserved; no other app or browser interface was captured.',40,529);return {data:c.toDataURL('image/png'),kind:'quote-card-fallback',error:reason,width:760,height:560};
}
async function captureReadingRegion(anchor){
 const card=document.querySelector('#readerCard');
 if(!card)return null;
 try{
  const rect=card.getBoundingClientRect(),header=document.querySelector('.topbar')?.getBoundingClientRect().bottom||80;
  const top=Math.max(header+7,rect.top),bottom=Math.min(innerHeight-25,rect.bottom),height=Math.min(900,bottom-top),width=Math.round(rect.width);
  if(height<70||width<100)return quoteCardFallback(anchor,'Reading pane is outside the viewport.');
  const stage=document.createElementNS('http://www.w3.org/1999/xhtml','div');
  stage.setAttribute('style',`position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#fffefa;`);
  let pieces=0;
  for(const node of card.querySelectorAll('.snapshot-piece')){
   if(node.offsetParent===null||node.closest('details:not([open])'))continue;
   const r=node.getBoundingClientRect();if(r.width<3||r.height<3||r.bottom<=top||r.top>=top+height)continue;
   const copy=styledCopy(node);if(!copy)continue;
   copy.style.position='absolute';copy.style.left=`${r.left-rect.left}px`;copy.style.top=`${r.top-top}px`;copy.style.width=`${r.width}px`;copy.style.margin='0';copy.style.transform='none';
   const blockId=node.closest('[data-block]')?.dataset.block;
   if(blockId&&anchor.language===document.documentElement.lang){
    copy.querySelectorAll('mark').forEach(m=>m.replaceWith(...m.childNodes));copy.normalize();
    const segs=(anchor.segments||[]).filter(s=>s.blockId===blockId).sort((a,b)=>b.start-a.start);
    for(const s of segs){const t=copy.textContent;if(t.slice(s.start,s.end)!==s.exact)continue;const a=textNodeAt(copy,s.start),b=textNodeAt(copy,s.end);if(!a||!b)continue;const range=document.createRange();range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset);const mark=document.createElement('mark');mark.style.backgroundColor='#f5e7ab';mark.style.color='inherit';mark.append(range.extractContents());range.insertNode(mark);}
   }
   stage.append(copy);pieces++;
  }
  if(!pieces)return quoteCardFallback(anchor,'No visible lesson blocks.');
  const serialized=new XMLSerializer().serializeToString(stage);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const image=new Image();
  const result=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('DOM image rendering timed out.')),6000);
   image.onload=()=>{clearTimeout(timeout);try{const scale=Math.min(1.5,1000/width),canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fffefa';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve({data:canvas.toDataURL('image/png'),kind:'dom-reading-viewport',width:canvas.width,height:canvas.height});}catch(e){reject(e);}};
   image.onerror=()=>{clearTimeout(timeout);reject(Error('Browser could not render the reading-area SVG.'));};
   image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
  return result;
 }catch(error){return quoteCardFallback(anchor,String(error?.message||error));}
}

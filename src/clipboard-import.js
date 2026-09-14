/* Inert clipboard HTML to Markdown conversion. It never fetches or executes pasted content. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TogetherClipboardImport=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
 'use strict';
 const CHURCH='https://www.churchofjesuschrist.org';
 const MAX_HTML=750000,MAX_MARKDOWN=450000;
 const BLOCK=new Set(['P','DIV','SECTION','ARTICLE','MAIN','HEADER','BLOCKQUOTE','H1','H2','H3','H4','H5','H6','UL','OL','TABLE']);
 const DROP=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','TEXTAREA','SELECT','BUTTON','SVG','IMG','VIDEO','AUDIO','SOURCE','LINK','META','BASE','TEMPLATE','NOSCRIPT','CANVAS','NAV','FOOTER','ASIDE']);
 const structure=new Set(['P','DIV','SECTION','ARTICLE','MAIN','BLOCKQUOTE','H1','H2','H3','H4','H5','H6','UL','OL','LI','TABLE','A','BR']);

 function string(value){return typeof value==='string'?value:'';}
 function hasControl(value){return /[\u0000-\u001f\u007f]/.test(value);}
 function fragment(value){
  const html=string(value);if(html.length>MAX_HTML)return '';
  const marked=html.match(/<!--\s*StartFragment\s*-->([\s\S]*?)<!--\s*EndFragment\s*-->/i);if(marked)return marked[1];
  if(/^\s*Version:\d/i.test(html)){const start=html.search(/<(?:!doctype\s+html|html|body)\b/i);if(start>=0)return html.slice(start);}
  return html;
 }
 function safeBase(options){
  const value=string(options?.baseUrl||options?.sourceURL||options?.clipboardSourceURL).trim();
  if(!value||hasControl(value))return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
 }
 function safeHref(value,base){
  const raw=string(value).trim();if(!raw||hasControl(raw)||/^\/\//.test(raw))return '';
  let target='';
  if(/^https?:/i.test(raw))target=raw;
  else if(raw.startsWith('/study/'))target=new URL(raw,CHURCH).href;
  else if(base)target=raw;
  else return '';
  try{const url=new URL(target,base||undefined);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
 }
 function escapeText(value){return string(value).replace(/\s+/g,' ').replace(/([\\`*_\[\]])/g,'\\$1');}
 function tidyInline(value){return string(value).replace(/[ \t]{2,}/g,' ');}
 function visible(node){
  if(node.nodeType!==1)return true;
  const role=(node.getAttribute('role')||'').toLowerCase(),classes=String(node.className||'');
  if(DROP.has(node.tagName)||['navigation','banner','menu','menubar','toolbar'].includes(role)||/(^|[\s_-])(nav|navigation|menu|toolbar|breadcrumb)(?=$|[\s_-])/i.test(classes)||node.hasAttribute('hidden')||node.getAttribute('aria-hidden')==='true')return false;
  const style=(node.getAttribute('style')||'').replace(/\s/g,'').toLowerCase();return !/(?:^|;)(?:display:none|visibility:hidden)(?:;|$)/.test(style);
 }
 function hasUsefulStructure(rootNode){
  const walk=node=>{for(const child of node.childNodes){if(!visible(child))continue;if(child.nodeType===1&&(structure.has(child.tagName)||walk(child)))return true;}return false;};
  return walk(rootNode);
 }
 function create(doc){
  if(!doc||typeof doc.createElement!=='function')throw Error('An injected browser document is required for clipboard HTML conversion.');
  function inline(node,state){
   if(node.nodeType===3)return escapeText(node.nodeValue);
   if(node.nodeType!==1||!visible(node))return '';
   const tag=node.tagName,children=()=>Array.from(node.childNodes).map(child=>inline(child,state)).join('');
   if(tag==='BR')return '\n';
   if(tag==='A'){
    const raw=children(),label=raw.trim(),href=safeHref(node.getAttribute('href'),state.base),before=/^\s/.test(raw)?' ':'',after=/\s$/.test(raw)?' ':'';
    if(!href)return raw;
    state.linkCount++;return `${before}[${label||escapeText(href)}](${href.replace(/[()]/g,char=>char==='('?'%28':'%29')})${after}`;
   }
   if(tag==='STRONG'||tag==='B'){const raw=children(),value=raw.trim();return value?`${/^\s/.test(raw)?' ':''}**${value}**${/\s$/.test(raw)?' ':''}`:'';}
   if(tag==='EM'||tag==='I'){const raw=children(),value=raw.trim();return value?`${/^\s/.test(raw)?' ':''}*${value}*${/\s$/.test(raw)?' ':''}`:'';}
   return children();
  }
  function list(node,state,depth=0){
   const ordered=node.tagName==='OL';let index=1,lines=[];
   for(const item of Array.from(node.children)){
    if(item.tagName!=='LI'||!visible(item))continue;
    const parts=[],nested=[];
    for(const child of item.childNodes){if(child.nodeType===1&&(child.tagName==='UL'||child.tagName==='OL'))nested.push(list(child,state,depth+1));else parts.push(inline(child,state));}
    const prefix=ordered?`${index++}. `:'- ',indent='  '.repeat(depth),body=tidyInline(parts.join('')).trim();
    if(body)lines.push(indent+prefix+body);
    for(const value of nested)if(value)lines.push(value);
   }
   return lines.join('\n');
  }
  function block(node,state){
   if(node.nodeType===3)return escapeText(node.nodeValue).trim();
   if(node.nodeType!==1||!visible(node))return '';
   const tag=node.tagName;
   if(tag==='UL'||tag==='OL')return list(node,state);
   if(/^H[1-6]$/.test(tag)){const value=tidyInline(inline(node,state)).trim();return value?`${'#'.repeat(+tag.slice(1))} ${value}`:'';}
   if(tag==='P'||tag==='BLOCKQUOTE'){const value=tidyInline(inline(node,state)).trim();return value?(tag==='BLOCKQUOTE'?`> ${value.replace(/\n/g,'\n> ')}`:value):'';}
   if(BLOCK.has(tag)){
    const children=Array.from(node.childNodes),hasBlocks=children.some(child=>child.nodeType===1&&BLOCK.has(child.tagName));
    return hasBlocks?children.map(child=>block(child,state)).filter(Boolean).join('\n\n'):tidyInline(inline(node,state)).trim();
   }
   return inline(node,state).trim();
  }
  function fromHTML(html,options={}){
   const source=fragment(html);if(!source)return {markdown:'',linkCount:0,converted:false};
   const template=doc.createElement('template');template.innerHTML=source;
   if(!hasUsefulStructure(template.content))return {markdown:'',linkCount:0,converted:false};
   const state={base:safeBase(options),linkCount:0};
   const markdown=Array.from(template.content.childNodes).map(node=>block(node,state)).filter(Boolean).join('\n\n').replace(/\n{3,}/g,'\n\n').trim();
   if(!markdown||markdown.length>MAX_MARKDOWN)return {markdown:'',linkCount:0,converted:false};
   return {markdown,linkCount:state.linkCount,converted:true};
  }
  function looksLikeMarkdown(value){return /(?:^|\s)(?:#{1,6}\s|[-*]\s|\[[^\]]+\]\([^)]*\)|\*\*[^*]+\*\*)/.test(string(value));}
  function transformPaste({html='',text='',...options}={}){
   const plain=string(text),result=fromHTML(html,options);
   if(!result.converted||(!result.linkCount&&looksLikeMarkdown(plain)))return {markdown:plain,linkCount:0,converted:false};
   return result;
  }
  return {fromHTML,transformPaste};
 }
 function browser(){return create(root&&root.document);}
 return {create,fromHTML:(html,options)=>browser().fromHTML(html,options),transformPaste:value=>browser().transformPaste(value),MAX_HTML,MAX_MARKDOWN};
});

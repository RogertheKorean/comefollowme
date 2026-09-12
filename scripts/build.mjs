import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const RE=require(path.join(root,'src/reference-engine.js'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const references=json('content/references.json');
const deployment=json('content/deployment-content.json');
if(deployment.schema!=='together-content-pack-v3'||!Array.isArray(deployment.documents)||!Array.isArray(deployment.lessons))throw Error('Invalid deployment-content.json schema');
deployment.lessons=deployment.lessons.map(RE.validateLesson);
references.documents=[...references.documents,...(deployment.documents||[])].map(RE.validateDocument);
const bundle=deployment;
let html=read('src/shell.html');
const replacements={
 '/*__CSS__*/':read('src/styles.css'),
 '/*__ENHANCED_CSS__*/':read('src/enhancements.css')+'\n'+read('src/references.css'),
 '/*__CAPTURE__*/':read('src/capture.js'),
 '/*__APP__*/':read('src/app.js'),
 '/*__ENHANCEMENTS__*/':read('src/enhancements.js'),
 '/*__ENGINE__*/':read('src/reference-engine.js'),
 '/*__REFERENCE_UI__*/':read('src/library.js'),
 '/*__DATA__*/':json('content/lesson.json'),
 '/*__SCRIPTURE_DATA__*/':json('content/scriptures.json'),
 '/*__REFERENCES__*/':references,
 '/*__DEPLOYMENT__*/':bundle
};
for(const [token,content]of Object.entries(replacements)){
 if(!html.includes(token))throw Error('Build token missing: '+token);
 const value=typeof content==='string'?content.replace(/<\/script/gi,'<\\/script'):JSON.stringify(content).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 html=html.replace(token,()=>value);
}
if(/\/\*__[A-Z_]+__\*\//.test(html))throw Error('Unresolved build token');
fs.mkdirSync(path.join(root,'public'),{recursive:true});
for(const p of ['index.html','public/index.html'])fs.writeFileSync(path.join(root,p),html);
console.log('Built v3:',Buffer.byteLength(html),'bytes; references:',references.documents.length,'language versions');

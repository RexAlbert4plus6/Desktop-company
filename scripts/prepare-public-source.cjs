const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),destination=path.join(root,'release','source');
const roots=['app','test','scripts','docs','.github'];
const names=['package.json','package-lock.json','README.md','CHANGELOG.md','LICENSE','.gitignore'];
function visit(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const file=path.posix.join(relative,entry.name);if(entry.isSymbolicLink())throw Error('Public source cannot contain symlinks.');if(entry.isDirectory())visit(file);else names.push(file);}}
for(const folder of roots)if(fs.existsSync(path.join(root,folder)))visit(folder);
const manifest=[];
for(const relative of names){
 if(/(^|\/)(private|character|runtime-data|node_modules|dist|release)(\/|$)/.test(relative))throw Error('Private path in public source.');
 const bytes=fs.readFileSync(path.join(root,relative));
 if(/\.(cjs|js|json|md|yml|txt)$/.test(relative)&&/sk-[A-Za-z0-9_-]{24,}/.test(bytes.toString('utf8')))throw Error('Potential API key in '+relative);
 const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);
 manifest.push({path:relative,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync(path.join(root,'release','source-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({files:manifest.length,bytes:manifest.reduce((sum,item)=>sum+item.bytes,0),destination}));

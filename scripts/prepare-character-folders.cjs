const fs=require('node:fs');const path=require('node:path');
const version=require('../package.json').version;
const appRoot=path.join(__dirname,'..','dist','v'+version,'Desktop-company-win32-x64');
const archive=path.join(appRoot,'resources','app.asar');
const packed=new Set(require('@electron/asar').listPackage(archive).map(name=>name.replace(/\\/g,'/').replace(/^\//,'')));
function verify(folder){for(const entry of fs.readdirSync(path.join(__dirname,'..',folder),{withFileTypes:true})){const name=folder+'/'+entry.name;if(entry.isDirectory())verify(name);else if(!packed.has(name))throw Error('Packaged application is missing '+name);}}
verify('app');
const root=path.join(__dirname,'..','dist','v'+version,'Desktop-company-win32-x64','character');
fs.mkdirSync(root,{recursive:true});
for(let index=1;index<=4;index++)fs.mkdirSync(path.join(root,'slot-'+index,'assets'),{recursive:true});
fs.writeFileSync(path.join(root,'README.txt'),'角色素材包\r\n\r\n日常导入请使用软件：设置 → 角色槽位 → 拖入 PNG。上传后的图片保存在本机用户数据目录，不会随更新丢失。\r\n\r\n这里也可以存放导出的素材包。在软件中选择“导入素材包”，选中带 character.json 和 assets 的文件夹。\r\n\r\n素材包只包含名字、人设和图片，不包含 API 密钥、用户信息、世界书、聊天和记忆。\r\n','utf8');
console.log('Prepared four character package folders.');

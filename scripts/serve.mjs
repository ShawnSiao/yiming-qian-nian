import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT||4312);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.mid':'audio/midi','.musicxml':'application/vnd.recordare.musicxml+xml'};
createServer(async(req,res)=>{
  try{
    let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    const path=relative(root,file);
    if(path.startsWith('..'+sep)||path==='..'||path.split(sep).some(part=>part.startsWith('.'))){res.writeHead(403).end();return;}
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/app/`));

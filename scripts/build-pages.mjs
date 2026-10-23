import {cp,mkdir,readFile,readdir,rm,stat,lstat,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,relative,extname,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'_site');
const versions=['r14','r15'];
const allowed=new Set(['.html','.css','.mjs','.js','.json','.webp','.glb','.mp3','.mid','.musicxml','.txt']);
const metadata={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),builtAt:new Date().toISOString()};
const toSlash=name=>name.split(sep).join('/');
async function filesUnder(folder){
  const result=[];
  for(const entry of await readdir(folder,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error(`Refusing symbolic link: ${entry.name}`);
    const file=resolve(folder,entry.name);
    if(entry.isDirectory())result.push(...await filesUnder(file));else if(entry.isFile())result.push(file);
  }
  return result;
}
async function requireLocal(owner,reference,versionRoot){
  if(!reference.startsWith('.'))return;
  const target=resolve(dirname(owner),reference.split(/[?#]/)[0]);
  if(!target.startsWith(versionRoot+sep))throw new Error(`Runtime reference escapes version: ${reference}`);
  if(!(await stat(target)).isFile())throw new Error(`Missing runtime file: ${reference}`);
}
const plans=[];
for(const version of versions){
  const source=resolve(root,'versions',version),versionInfo=JSON.parse(await readFile(resolve(source,'version.json'),'utf8'));
  const files=(await filesUnder(source)).filter(file=>!/^test-.*\.mjs$/.test(file.split(sep).at(-1))&&extname(file)!=='.md'&&!file.endsWith(`${sep}performance-r7-report.json`));
  for(const file of files){
    if(!allowed.has(extname(file)))throw new Error(`Unexpected release file: ${relative(source,file)}`);
    if((await stat(file)).size>20*1024*1024)throw new Error(`Unexpected large runtime asset: ${relative(source,file)}`);
    if(['.js','.mjs'].includes(extname(file))){
      const text=await readFile(file,'utf8');
      const imports=[...text.matchAll(/(?:import|export)\s+(?:[^'"\n]*?\s+from\s*)?['"](\.[^'"]+)['"]/g),...text.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)];
      for(const match of imports)await requireLocal(file,match[1],source);
    }
  }
  const html=await readFile(resolve(source,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:src|href)="(\.[^"]+)"/g))await requireLocal(resolve(source,'index.html'),match[1],source);
  for(const required of ['models/single-bell-observation.glb','models/ensemble-performance-r7.glb','models/ensemble-suspension-r6.glb','assets/audio/zhuzhi-source-reference.mp3','scores/zhuzhi-ci-recording.json'])await stat(resolve(source,required));
  plans.push({version,source,files,versionInfo});
}
// Only this fixed, repository-local generated directory can be replaced.
if(relative(root,output)!=='_site')throw new Error('Invalid generated output target');
try{if((await lstat(output)).isSymbolicLink())throw new Error('Output must not be a symbolic link');}catch(error){if(error.code!=='ENOENT')throw error;}
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of ['index.html','manifest.json','icon.png','.nojekyll'])await cp(resolve(root,file),resolve(output,file));
await cp(resolve(root,'assets'),resolve(output,'assets'),{recursive:true});
for(const plan of plans){
  const destination=resolve(output,'versions',plan.version),hashes={};
  for(const file of plan.files){
    const name=toSlash(relative(plan.source,file)),target=resolve(destination,name);
    await mkdir(dirname(target),{recursive:true});await cp(file,target);
    hashes[name]=createHash('sha256').update(await readFile(file)).digest('hex');
  }
  await writeFile(resolve(destination,'deployment.json'),JSON.stringify({...metadata,version:plan.versionInfo.version,files:hashes},null,2)+'\n');
}
await writeFile(resolve(output,'deployment.json'),JSON.stringify({...metadata,versions:plans.map(plan=>plan.versionInfo.version)},null,2)+'\n');
const published=await filesUnder(output),bytes=(await Promise.all(published.map(file=>stat(file)))).reduce((sum,s)=>sum+s.size,0);
if(published.some(file=>/\.(wav|blend|npz|onnx|py)$/.test(file)||file.includes(`${sep}references${sep}`)||file.includes(`${sep}output${sep}`)))throw new Error('Private/research artifact in Pages output');
console.log(`Pages artifact: ${published.length} files, ${(bytes/1024/1024).toFixed(2)} MiB. Root legacy page and ${versions.join(', ')} preserved.`);

import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const read=path=>readFile(new URL(`../${path}`,import.meta.url));
const deployment=JSON.parse(await read('_site/deployment.json'));
assert.equal(deployment.current,JSON.parse(await read('app/version.json')).version);assert.equal(deployment.entry,'app/');
for(const name of ['home-bell-poster','home-bell-section','bell-small-v2','bell-medium-v2','bell-large-v2','bell-mallet-v10'])for(const extension of ['webp','png'])await read(`_site/app/assets/images/${name}.${extension}`);
for(const path of ['app','versions/r14','versions/r15']){
  const manifest=JSON.parse(await read(`_site/${path}/deployment.json`));
  assert.equal(manifest.commit,deployment.commit);
  for(const [file,hash] of Object.entries(manifest.files)){
    assert.equal(createHash('sha256').update(await read(`_site/${path}/${file}`)).digest('hex'),hash);
    assert.equal(createHash('sha256').update(await read(`${path}/${file}`)).digest('hex'),hash,'build preserves runtime bytes');
    assert.ok(!/\.(?:blend|wav|npz|py|md)$|(?:^|\/)(?:test-|references|output)/.test(file));
  }
}
for(const lang of ['en','zh']){
  const manifest=JSON.parse(await read(`_site/app/manifest.${lang}.json`));
  assert.equal(manifest.start_url,`./?lang=${lang}`);
  assert.equal(manifest.lang,lang==='en'?'en':'zh-CN');
  const html=(await read(`_site/app/scores/zhuzhi-ci-recording${lang==='en'?'.en':''}.html`)).toString();
  assert.ok(html.includes(`../?lang=${lang}#library`));assert.equal((html.match(/<section>/g)||[]).length,32);
}
let redirected;
vm.runInNewContext((await read('_site/scripts/enter-app.js')).toString(),{URL,location:{href:'https://example.test/yiming/?lang=en&score=zhuzhi-ci#library',search:'?lang=en&score=zhuzhi-ci',hash:'#library',replace:url=>redirected=url}});
assert.equal(redirected,'https://example.test/yiming/app/?lang=en&score=zhuzhi-ci#library');
assert.ok((await read('_site/index.html')).toString().includes('./scripts/enter-app.js'));
assert.ok(!(await readdir(new URL('../_site',import.meta.url))).includes('designs'));
console.log('Pages hashes, archive continuity, localized manifests, complete score pages and query/hash redirects passed.');

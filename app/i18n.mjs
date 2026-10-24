import english from './locales/en.mjs';

export const LANGUAGE_KEY='ymqn:language';
export function resolveLocale({query=null,saved=null,languages=[]}={}){
  const normalize=value=>/^zh(?:-|$)/i.test(value||'')?'zh':/^en(?:-|$)/i.test(value||'')?'en':null;
  const explicit=normalize(query),preference=normalize(saved);
  if(explicit||preference)return explicit||preference;
  for(const value of languages){const match=normalize(value);if(match)return match;}
  return 'en';
}
let locale='zh';
if(typeof document!=='undefined'){
  let saved=null;try{saved=localStorage.getItem(LANGUAGE_KEY);}catch{}
  locale=resolveLocale({query:new URLSearchParams(location.search).get('lang'),saved,languages:navigator.languages||[navigator.language]});
}
export const getLocale=()=>locale;
export function t(key){
  if(key===null||key===undefined)return '';
  if(locale==='zh')return String(key);
  const measure=/^第\s*(\d+)\s*(小节|乐句)$/.exec(String(key));
  if(measure)return `${measure[2]==='小节'?'Bar':'Phrase'} ${measure[1]}`;
  return english[key]??String(key);
}
export function tr(parts,...values){
  const key=parts.map((part,i)=>part+(i<values.length?`{${i}}`:'')).join('');
  const pattern=t(key);
  if(locale==='en'&&key==='{0}拍')return `${values[0]} ${Number(values[0])===1?'beat':'beats'}`;
  if(locale==='en'&&key==='{0} 首本地作品 · 最多保留 30 首')return `${values[0]} saved ${Number(values[0])===1?'recording':'recordings'} · Up to 30`;
  const formatted=pattern.replace(/\{(\d+)\}/g,(_,index)=>String(values[Number(index)]??''));
  return locale==='en'&&key.startsWith('试听简谱 ')?formatted.replace(', 1 beats',', 1 beat'):formatted;
}
export function applyLocale(){
  if(typeof document==='undefined'||!document.documentElement)return;
  document.documentElement.lang=locale==='en'?'en':'zh-CN';
  document.title=locale==='en'?'Yiming · A Thousand Echoes':'一鸣千年 · 编钟演奏与单钟观赏';
  const manifest=document.querySelector('link[rel=manifest]');if(manifest)manifest.href=`./manifest.${locale}.json`;
}
export function setLocale(value,{persist=true,updateURL=true}={}){
  locale=value==='en'?'en':'zh';
  if(persist)try{localStorage.setItem(LANGUAGE_KEY,locale);}catch{}
  applyLocale();
  if(updateURL&&typeof location!=='undefined'&&typeof history!=='undefined'){
    const url=new URL(location.href);url.searchParams.set('lang',locale);history.replaceState(history.state,'',url);
  }
  return locale;
}
export function scoreFile(type,url){return type==='html'&&locale==='en'?url.replace(/\.html$/,'.en.html'):url;}
applyLocale();

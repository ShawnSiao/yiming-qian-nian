import {t,tr} from './i18n.mjs';
// Retain the existing event-recording shape and storage key in session.mjs.
const manualSources=new Set(['pointer','keyboard','accessibility','bell-surface']);
export function workTitle(value){return Array.from(String(value??'').trim()).slice(0,40).join('');}
export function renameWork(works,id,title){const normalized=workTitle(title);return normalized?works.map(work=>work.id===id?{...work,title:normalized}:work):works;}
export function appendStrike(record,event){
  if(!record||!manualSources.has(event.source)||!Number.isFinite(event.at)||!Number.isInteger(event.midi))return false;
  if(record.first===null)record.first=event.at;
  record.events.push({time:Math.max(0,Math.round(event.at-record.first)),midi:event.midi,zone:event.zone,region:event.region,bellId:event.bellId});
  return true;
}
export function recordedWork(record,count,now=Date.now()){
  if(!record?.events.length)return null;
  return {id:`work-${now}`,title:tr`我的钟曲 ${String(count+1).padStart(2,'0')}`,createdAt:now,durationMs:record.events.at(-1).time+800,events:record.events};
}

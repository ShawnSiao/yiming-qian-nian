import {t,tr} from './i18n.mjs';
import { frequency } from './model.mjs';
export const VOLUME_KEY='ymqn:3d:volume';
export function clampVolume(value){return Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):.8;}
export function readVolume(){try{const value=localStorage.getItem(VOLUME_KEY);return value===null?.8:clampVolume(value);}catch{return .8;}}

// Sound is enabled initially. Browsers that require activation can resume on
// an ordinary page gesture; never queue or replay a missed landing impact.
export function activateSoundOnInteraction(audio,target,enabled=()=>true){
  const wake=event=>{if(enabled()&&!event.repeat)audio.prepareArrival();};
  const events=['pointerdown','pointerup','keydown'];
  for(const name of events)target.addEventListener(name,wake,{capture:true});
  return()=>{for(const name of events)target.removeEventListener(name,wake,{capture:true});};
}

// A bounded, local synthesized audition sound. Not a historical bell sample.
export class BellAudio {
  constructor() { this.context = null; this.voices = []; this.muted = false; this.generation = 0; this.count = 0; this.suspending = null; this.volume=.8; }

  ensureContext() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error(t('当前浏览器不支持 Web Audio'));
    if (!this.context) {
      this.context = new Audio({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = .24*this.volume;
      this.compressor = this.context.createDynamicsCompressor();
      if(this.compressor.threshold){this.compressor.threshold.value=-9;this.compressor.knee.value=12;this.compressor.ratio.value=6;this.compressor.attack.value=.003;this.compressor.release.value=.35;}
      this.master.connect(this.compressor).connect(this.context.destination);
    }
    return this.context;
  }

  // A blocked resume is never allowed to queue a delayed, unexpected impact.
  // Only landing() at the actual contact frame can create the sound nodes.
  prepareArrival() {
    if (this.muted) return false;
    try {
      const context=this.ensureContext();
      if(context.state!=='running')context.resume().catch(()=>{});
      this.idleWhenQuiet();
      return context.state==='running';
    } catch { return false; }
  }

  async unlock() {
    clearTimeout(this.idleTimer);
    this.ensureContext();
    if(this.suspending)await this.suspending;
    if(this.context.state!=='running')await this.context.resume();
  }

  // A short cast-metal attack followed by independently damped, inharmonic
  // partials. This is a local synthesis, not a sampled museum instrument.
  landing(duration=7.2,midi=48) {
    if(this.muted||document.hidden||this.context?.state!=='running')return false;
    clearTimeout(this.idleTimer);this.stopLanding();
    while(this.voices.length>=10)this.stopVoice(this.voices[0]);
    const now=this.context.currentTime,length=Math.max(3,Math.min(8,duration));
    const envelope=this.context.createGain();
    envelope.gain.setValueAtTime(.001,now);
    envelope.gain.exponentialRampToValueAtTime(.74,now+.016);
    envelope.gain.exponentialRampToValueAtTime(.34,now+.9);
    envelope.gain.exponentialRampToValueAtTime(.001,now+length);
    const impact=this.context.createGain();impact.gain.value=2.7;impact.connect(this.master);envelope.connect(impact);
    const voice={kind:'landing',envelope,oscillators:[],gains:[],extras:[impact],stopped:false,velocity:.74};
    // Slow low modes carry the body; high partials die early, avoiding a bright
    // "ding". The lowest two modes are not double-faded to silence in a second.
    for(const [ratio,volume,decay] of [[.5,.4,.85],[1,.72,1],[1.48,.16,.55],[2,.15,.75],[2.41,.07,.25],[3.06,.035,.17],[4.12,.012,.1]]){
      const oscillator=this.context.createOscillator(),gain=this.context.createGain();
      oscillator.frequency.value=frequency(midi)*ratio;
      gain.gain.setValueAtTime(volume,now);
      gain.gain.exponentialRampToValueAtTime(ratio<=1?volume*.24:.0001,now+length*decay);
      oscillator.connect(gain).connect(envelope);oscillator.start(now);oscillator.stop(now+length+.03);
      voice.oscillators.push(oscillator);voice.gains.push(gain);
    }
    // A few damped room reflections, never a feedback loop or a second strike.
    if(this.context.createDelay&&this.context.createBiquadFilter){
      for(const [time,amount,pan] of [[.13,.12,-.35],[.29,.09,.35],[.47,.055,-.1]]){
        const delay=this.context.createDelay(1),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
        delay.delayTime.value=time;filter.type='lowpass';filter.frequency.value=900;filter.Q.value=.4;gain.gain.value=amount;
        envelope.connect(delay).connect(filter).connect(gain);voice.extras.push(delay,filter,gain);
        if(this.context.createStereoPanner){const panner=this.context.createStereoPanner();panner.pan.value=pan;gain.connect(panner).connect(impact);voice.extras.push(panner);}
        else gain.connect(impact);
      }
    }
    voice.oscillators[0].onended=()=>this.stopVoice(voice);
    this.voices.push(voice);this.landingCount=(this.landingCount||0)+1;
    return true;
  }

  stopLanding(){this.voices.filter(voice=>voice.kind==='landing').forEach(voice=>this.stopVoice(voice));}

  async strike(midi, delay = 0, velocity = .85) {
    const deadline = performance.now() + Math.max(0, Math.min(delay, .1))*1000;
    if (this.muted) return false;
    const generation = this.generation;
    await this.unlock();
    if (this.muted || document.hidden || generation !== this.generation) return false;
    while (this.voices.length >= 10) {
      const backing=this.voices.find(v=>v.velocity<.45);
      if(!backing&&velocity<.45)return false;
      this.stopVoice(backing||this.voices[0]);
    }
    const now = this.context.currentTime + Math.max(0, deadline-performance.now())/1000;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.05,Math.min(1,velocity)), now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    envelope.connect(this.master);
    const voice = { envelope, oscillators: [], gains: [], stopped: false,velocity };
    [[1, 1], [2.01, 0.19], [2.76, 0.08]].forEach(([ratio, volume]) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.value = frequency(midi) * ratio;
      gain.gain.value = volume;
      oscillator.connect(gain).connect(envelope);
      oscillator.start(now);
      oscillator.stop(now + 1.4);
      voice.oscillators.push(oscillator);
      voice.gains.push(gain);
    });
    voice.oscillators[0].onended = () => this.stopVoice(voice);
    this.voices.push(voice);
    this.count++;
    return true;
  }

  stopVoice(voice) {
    if (voice.stopped) return;
    voice.stopped = true;
    voice.oscillators.forEach(o => { o.onended = null; try { o.stop(); } catch {} o.disconnect(); });
    voice.gains.forEach(g => g.disconnect());
    voice.extras?.forEach(node=>node.disconnect());
    voice.envelope.disconnect();
    this.voices = this.voices.filter(v => v !== voice);
    this.idleWhenQuiet();
  }

  idleWhenQuiet(){if(!this.voices.length){clearTimeout(this.idleTimer);this.idleTimer=setTimeout(()=>{if(!this.voices.length)this.suspend();},8000);}}

  stop() { this.generation++; [...this.voices].forEach(v => this.stopVoice(v)); clearTimeout(this.idleTimer); }
  suspend() {
    this.stop();
    if (this.context?.state === 'running') {
      const pending = this.context.suspend().catch(() => {});
      this.suspending = pending;
      pending.finally(() => { if (this.suspending === pending) this.suspending = null; });
    }
  }
  setMuted(muted) { this.muted = muted; if (muted) this.suspend(); }
  setVolume(value){
    this.volume=clampVolume(value);if(!this.master)return;
    const gain=this.master.gain,target=.24*this.volume;
    if(gain.setTargetAtTime){gain.cancelScheduledValues(this.context.currentTime);gain.setTargetAtTime(target,this.context.currentTime,.03);}else gain.value=target;
  }
  dispose() { this.stop(); this.context?.close().catch(() => {}); }
}

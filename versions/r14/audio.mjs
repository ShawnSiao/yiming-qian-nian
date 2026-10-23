import { frequency } from './model.mjs';

// A bounded, local synthesized audition sound. Not a historical bell sample.
export class BellAudio {
  constructor() { this.context = null; this.voices = []; this.muted = false; this.generation = 0; this.count = 0; this.suspending = null; }

  async unlock() {
    clearTimeout(this.idleTimer);
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('当前浏览器不支持 Web Audio');
    if (!this.context) {
      this.context = new Audio({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.master.gain.value = 0.19;
      this.compressor = this.context.createDynamicsCompressor();
      this.master.connect(this.compressor).connect(this.context.destination);
    }
    if(this.suspending)await this.suspending;
    if(this.context.state!=='running')await this.context.resume();
  }

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
    voice.envelope.disconnect();
    this.voices = this.voices.filter(v => v !== voice);
    if(!this.voices.length){
      clearTimeout(this.idleTimer);
      this.idleTimer=setTimeout(()=>{if(!this.voices.length)this.suspend();},8000);
    }
  }

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
  dispose() { this.stop(); this.context?.close().catch(() => {}); }
}

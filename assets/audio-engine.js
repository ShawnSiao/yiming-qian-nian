(function exposeAudio(root) {
  "use strict";
  class BellAudioEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.compressor = null;
      this.voices = [];
      this.volume = 0.78;
    }
    async unlock() {
      if (!this.context) {
        const AudioContextClass = root.AudioContext || root.webkitAudioContext;
        if (!AudioContextClass) throw new Error("audio-unavailable");
        this.context = new AudioContextClass({ latencyHint: "interactive" });
        this.master = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -18;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 5;
        this.compressor.attack.value = 0.004;
        this.compressor.release.value = 0.25;
        this.master.connect(this.compressor);
        this.compressor.connect(this.context.destination);
        this.setVolume(this.volume);
      }
      if (this.context.state === "suspended") await this.resumeWithTimeout(1400);
      return this.context.state === "running";
    }
    resumeWithTimeout(timeoutMs) {
      const resumed = Promise.resolve(this.context.resume()).catch(() => {});
      return Promise.race([resumed, new Promise((resolve) => root.setTimeout(resolve, timeoutMs))]);
    }
    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value)));
      if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
    }
    stopAll() {
      this.voices.forEach((voice) => voice.stop());
      this.voices = [];
    }
    play(midi, velocity, when) {
      if (!this.context || !this.master) return false;
      if (this.context.state !== "running") this.resumeWithTimeout(600);
      while (this.voices.length >= 12) this.voices.shift().stop();
      const startAt = Math.max(this.context.currentTime, when || this.context.currentTime);
      const base = 440 * Math.pow(2, (midi - 69) / 12);
      const duration = Math.max(1.9, 3.4 - (midi - 60) * 0.065);
      const voiceGain = this.context.createGain();
      voiceGain.gain.setValueAtTime(0.0001, startAt);
      voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.02, velocity * 0.34), startAt + 0.009);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      voiceGain.connect(this.master);
      const oscillators = [];
      const partials = [
        { ratio: 1, gain: 0.78, type: "sine" }, { ratio: 1.48, gain: 0.17, type: "triangle" },
        { ratio: 2.41, gain: 0.12, type: "sine" }, { ratio: 3.06, gain: 0.075, type: "triangle" }
      ];
      const gains = [];
      partials.forEach((partial, index) => {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = partial.type;
        oscillator.frequency.setValueAtTime(base * partial.ratio * (1 + (index - 2) * 0.0007), startAt);
        oscillator.detune.setValueAtTime((index - 2) * 1.8, startAt);
        gain.gain.setValueAtTime(partial.gain, startAt);
        oscillator.connect(gain);
        gain.connect(voiceGain);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.04);
        oscillators.push(oscillator);
        gains.push(gain);
      });
      const voice = {
        stop: () => {
          try {
            const now = this.context.currentTime;
            voiceGain.gain.cancelScheduledValues(now);
            voiceGain.gain.setTargetAtTime(0.0001, now, 0.025);
            oscillators.forEach((oscillator) => oscillator.stop(now + 0.12));
          } catch { /* voice already ended */ }
        }
      };
      this.voices.push(voice);
      root.setTimeout(() => { this.voices = this.voices.filter((item) => item !== voice); oscillators.forEach((oscillator) => oscillator.disconnect()); gains.forEach((gain) => gain.disconnect()); voiceGain.disconnect(); }, (duration + 0.3) * 1000);
      return true;
    }
  }
  root.YMQNAudio = { BellAudioEngine };
})(window);

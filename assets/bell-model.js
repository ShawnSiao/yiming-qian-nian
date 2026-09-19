(function exposeBellModel(root) {
  "use strict";
  const BELLS = [
    { id: "B01", row: "bottom", centerMidi: 60, sideMidi: 64 }, { id: "B02", row: "bottom", centerMidi: 61, sideMidi: 65 },
    { id: "B03", row: "bottom", centerMidi: 62, sideMidi: 66 }, { id: "B04", row: "bottom", centerMidi: 63, sideMidi: 67 },
    { id: "M01", row: "middle", centerMidi: 68, sideMidi: 72 }, { id: "M02", row: "middle", centerMidi: 69, sideMidi: 73 },
    { id: "M03", row: "middle", centerMidi: 70, sideMidi: 74 }, { id: "M04", row: "middle", centerMidi: 71, sideMidi: 75 },
    { id: "T01", row: "top", centerMidi: 76, sideMidi: 80 }, { id: "T02", row: "top", centerMidi: 77, sideMidi: 81 },
    { id: "T03", row: "top", centerMidi: 78, sideMidi: 82 }, { id: "T04", row: "top", centerMidi: 79, sideMidi: 83 }
  ];
  const PENTATONIC = new Set([0, 2, 4, 7, 9]);
  const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const SOLFEGE = { 0: "1 · 宫", 2: "2 · 商", 4: "3 · 角", 7: "5 · 徵", 9: "6 · 羽" };

  function quantizePentatonic(midi) {
    let best = midi;
    let distance = Number.POSITIVE_INFINITY;
    for (let candidate = midi - 2; candidate <= midi + 2; candidate += 1) {
      const pitchClass = ((candidate % 12) + 12) % 12;
      const candidateDistance = Math.abs(candidate - midi);
      if (PENTATONIC.has(pitchClass) && candidateDistance < distance) { best = candidate; distance = candidateDistance; }
    }
    return best;
  }
  function resolveZone(normalizedX) {
    if (!Number.isFinite(normalizedX) || normalizedX < -0.08 || normalizedX > 1.08) return null;
    return normalizedX >= 0.3 && normalizedX <= 0.7 ? "center" : "side";
  }
  function resolveNoteLayout(midi) {
    for (const bell of BELLS) {
      if (bell.centerMidi === midi) return { bellId: bell.id, zone: "center" };
      if (bell.sideMidi === midi) return { bellId: bell.id, zone: "side" };
    }
    return null;
  }
  function scoreAttempt({ expectedMidi, actualMidi, deltaMs }) {
    const pitchCorrect = expectedMidi === actualMidi;
    if (!pitchCorrect) return { label: "异音", points: 0, pitchCorrect: false };
    const distance = Math.abs(deltaMs);
    if (distance <= 150) return { label: "合律", points: 100, pitchCorrect: true };
    if (distance <= 300) return { label: "稳", points: 80, pitchCorrect: true };
    if (distance <= 450) return { label: "可", points: 55, pitchCorrect: true };
    return { label: "失拍", points: 0, pitchCorrect: true };
  }
  function summarizeScore(attempts) {
    if (!attempts.length) return { total: 0, noteAccuracy: 0, rhythmAccuracy: 0, longestStreak: 0, rating: "再奏一曲" };
    const correct = attempts.filter((item) => item.pitchCorrect).length;
    const noteAccuracy = correct / attempts.length;
    const rhythmAccuracy = attempts.reduce((sum, item) => sum + item.points, 0) / attempts.length / 100;
    let streak = 0; let longestStreak = 0;
    attempts.forEach((item) => { streak = item.pitchCorrect && item.points > 0 ? streak + 1 : 0; longestStreak = Math.max(longestStreak, streak); });
    const total = Math.round(noteAccuracy * 60 + rhythmAccuracy * 30 + Math.min(1, longestStreak / attempts.length) * 10);
    const rating = total >= 95 ? "金石和鸣" : total >= 85 ? "渐入礼乐" : total >= 70 ? "钟声有序" : "再奏一曲";
    return { total, noteAccuracy, rhythmAccuracy, longestStreak, rating };
  }
  function createRecording(tuningMode, startedAt) { return { tuningMode, startedAt, firstStrikeAt: null, events: [] }; }
  function recordStrike(recording, strike) {
    if (recording.events.length >= 2000) return recording;
    const firstStrikeAt = recording.firstStrikeAt === null ? strike.now : recording.firstStrikeAt;
    return { ...recording, firstStrikeAt, events: recording.events.concat({
      tMs: Math.max(0, Math.round(strike.now - firstStrikeAt)), bellId: strike.bellId, zone: strike.zone,
      resolvedMidi: strike.resolvedMidi, velocity: Math.max(0, Math.min(1, strike.velocity))
    }) };
  }
  function finishRecording(recording, now) {
    const durationMs = recording.firstStrikeAt === null ? 0 : Math.min(300000, Math.max(0, Math.round(now - recording.firstStrikeAt)));
    return { ...recording, durationMs };
  }
  function parseStoredWorks(raw) {
    try { const parsed = JSON.parse(raw || "[]"); return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string" && Array.isArray(item.events)) : []; }
    catch { return []; }
  }
  function canStoreWork(works) { return works.length < 30; }
  function midiName(midi) { return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`; }
  function displayNote(midi, mode) {
    const pitchClass = ((midi % 12) + 12) % 12;
    return mode === "pentatonic" && SOLFEGE[pitchClass] ? `${SOLFEGE[pitchClass]} · ${midiName(midi)}` : midiName(midi);
  }
  root.YMQNModel = { BELLS, quantizePentatonic, resolveZone, resolveNoteLayout, scoreAttempt, summarizeScore, createRecording, recordStrike, finishRecording, parseStoredWorks, canStoreWork, midiName, displayNote };
})(typeof window !== "undefined" ? window : this);

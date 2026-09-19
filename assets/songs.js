(function exposeSongs(root) {
  "use strict";
  function events(notes, durationBeat) {
    return notes.map((midi, index) => ({ beat: index * durationBeat, midi, durationBeat }));
  }
  function phrasedEvents(notes, phraseEnds, stepBeat, holdBeat) {
    let beat = 0;
    return notes.map((midi, index) => {
      const durationBeat = phraseEnds.includes(index) ? holdBeat : stepBeat;
      const event = { beat, midi, durationBeat };
      beat += durationBeat;
      return event;
    });
  }
  const SONGS = [
    {
      id: "pentatonic-practice", title: "宫商角徵羽练习", category: "入门", bpm: 82, mode: "pentatonic", difficulty: 1,
      rightsStatus: "原创", description: "从宫、商、角、徵、羽开始认识五声音阶。",
      events: events([60,62,64,67,69,72,69,67,64,62,60,62,64,67,69,72], 1)
    },
    {
      id: "jasmine", title: "茉莉花", category: "民间", bpm: 88, mode: "pentatonic", difficulty: 1,
      rightsStatus: "传统曲调重新编配", description: "中国民间曲调，以本地编钟事件重新编配。",
      events: phrasedEvents([64,64,67,69,72,72,69,67,69,67,64,62,60,62,64,67,64,62,60,60,62,64,67,69,67,64,62,60], [6,13,19,27], .75, 1.5)
    },
    {
      id: "fengyang-drum", title: "凤阳花鼓", category: "民间", bpm: 104, mode: "pentatonic", difficulty: 2,
      rightsStatus: "传统曲调重新编配", description: "轻快民间曲调，以五声音列重写演奏片段。",
      events: phrasedEvents([60,62,64,67,64,62,60,62,64,67,69,67,64,62,64,67,69,72,69,67,64,62,60,60], [7,15,23], .68, 1.36)
    },
    {
      id: "little-star", title: "小星星", category: "熟悉旋律", bpm: 92, mode: "pentatonic", difficulty: 1,
      rightsStatus: "公版旋律自制编配", description: "熟悉的公版旋律，适合第一次完整跟奏。",
      events: phrasedEvents([60,60,67,67,69,69,67,64,64,62,62,60,67,67,64,64,62,62,60], [6,12,18], 1, 2)
    },
    {
      id: "ode-to-joy", title: "欢乐颂", category: "熟悉旋律", bpm: 96, mode: "chromatic", difficulty: 2,
      rightsStatus: "公版作品自制编配", description: "开放完整音列，感受更清晰的级进旋律。",
      events: phrasedEvents([64,64,65,67,67,65,64,62,60,60,62,64,64,62,62,64,64,65,67,67,65,64,62,60,60,62,64,62,60,60], [7,14,23,29], .75, 1.5)
    },
    {
      id: "two-tigers", title: "两只老虎", category: "熟悉旋律", bpm: 104, mode: "pentatonic", difficulty: 1,
      rightsStatus: "公版旋律自制编配", description: "短句重复明确，适合练习连续击打。",
      events: phrasedEvents([60,62,64,60,60,62,64,60,64,67,69,64,67,69,69,72,69,67,64,60,69,72,69,67,64,60], [3,7,11,15,19,25], .7, 1.4)
    }
  ];
  const licensedSongs = Array.isArray(root.YMQNLicensedSongs) ? root.YMQNLicensedSongs : [];
  const allSongs = SONGS.concat(licensedSongs.filter((song) => song && typeof song.id === "string" && Array.isArray(song.events)));
  allSongs.forEach((song) => {
    const last = song.events[song.events.length - 1];
    song.durationMs = Math.round((last.beat + last.durationBeat) * 60000 / song.bpm);
  });
  root.YMQNSongs = allSongs;
})(window);

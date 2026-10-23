(function exposeLicensedSongs(root) {
  "use strict";

  // 第三方／授权曲目槽位。
  // 每项使用与 songs.js 相同的数据结构；空数组不会改变当前曲库。
  // 只应加入已取得相应复制、改编与分发授权的曲目。
  //
  // 本条《晴天》旋律事件谱的使用由发布主体自行负责。若已取得书面授权，
  // 请把下方 rightsStatus 改成对应的授权描述；未取得授权时应移除整个条目。

  const openingSolfege = [
    { beat: 0, midi: 62, durationBeat: .75 },
    { beat: .75, midi: 67, durationBeat: .5 }, { beat: 1.25, midi: 67, durationBeat: .75 },
    { beat: 2, midi: 71, durationBeat: .5 }, { beat: 2.5, midi: 72, durationBeat: .5 },
    { beat: 3, midi: 71, durationBeat: .5 }, { beat: 3.5, midi: 69, durationBeat: 1.5 },
    { beat: 5.5, midi: 67, durationBeat: .5 }, { beat: 6, midi: 69, durationBeat: .5 },
    { beat: 6.5, midi: 71, durationBeat: .5 }, { beat: 7, midi: 71, durationBeat: .5 },
    { beat: 7.5, midi: 71, durationBeat: .5 }, { beat: 8, midi: 71, durationBeat: .5 },
    { beat: 8.5, midi: 69, durationBeat: .5 }, { beat: 9, midi: 71, durationBeat: .5 },
    { beat: 9.5, midi: 69, durationBeat: .5 }, { beat: 10, midi: 67, durationBeat: 1.5 }
  ];

  const melodyEvents = [];
  let cursorBeat = 0;

  function addPhrase(notes, options) {
    const settings = options || {};
    const stepBeat = settings.stepBeat || .375;
    const holdBeat = settings.holdBeat || .75;
    notes.forEach((midi, index) => {
      const durationBeat = index === notes.length - 1 ? holdBeat : stepBeat;
      melodyEvents.push({ beat: cursorBeat, midi, durationBeat, velocity: .82 });
      cursorBeat += durationBeat;
    });
    cursorBeat += settings.gapBeat === undefined ? .375 : settings.gapBeat;
  }

  addPhrase([62, 62, 67, 67, 69, 71]);
  addPhrase([62, 62, 67, 67, 69, 71, 69, 67, 62]);
  addPhrase([62, 62, 67, 67, 69, 71]);
  addPhrase([71, 71, 69, 71, 72, 71, 69, 72, 71, 69, 67]);

  const solfegeOffset = cursorBeat;
  openingSolfege.forEach((event) => melodyEvents.push({
    beat: event.beat + solfegeOffset,
    midi: event.midi,
    durationBeat: event.durationBeat,
    velocity: .82
  }));
  cursorBeat += 12;

  addPhrase([62, 67, 67, 71, 72, 71, 69, 67, 69]);
  addPhrase([71, 71, 71, 71, 69, 71, 69, 67, 67]);
  addPhrase([66, 67, 67, 67, 66, 67, 67]);
  addPhrase([67, 67, 67, 66, 67, 67]);
  addPhrase([67, 67, 67, 66, 67, 67]);
  addPhrase([67, 67, 67, 74, 74, 74]);
  addPhrase([74, 74, 74, 74, 74, 74]);
  addPhrase([74, 74, 74, 74, 72, 72, 71, 71]);
  addPhrase([69, 67, 66, 67, 64, 66, 67, 74, 72, 71, 67, 67]);
  addPhrase([66, 62, 67, 67, 67, 71, 67]);
  addPhrase([64, 66, 67, 74, 72, 71, 67, 67, 69, 69], { holdBeat: 1.5, gapBeat: 0 });

  const chordPattern = [64, 60, 67, 62];
  const accompanimentEvents = Array.from(
    { length: Math.ceil(cursorBeat / 4) },
    (_, index) => ({ beat: index * 4, midi: chordPattern[index % chordPattern.length], durationBeat: 1.5, velocity: .22 })
  );

  root.YMQNLicensedSongs = [{
    id: "licensed-qing-tian",
    title: "晴天",
    category: "流行",
    bpm: 70,
    mode: "chromatic",
    difficulty: 2,
    rightsStatus: "第三方旋律改编 · 授权由发布主体负责",
    description: "流行抒情旋律，用全律音列改写为编钟事件谱，适合练习连贯的句读与呼吸。",
    events: melodyEvents,
    listenEvents: accompanimentEvents.concat(melodyEvents).sort((a, b) => a.beat - b.beat)
  }];
})(window);

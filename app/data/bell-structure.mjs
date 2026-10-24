// Source-checked interpretation, 2026-10-24. This is not a measured replica.
export const STRUCTURE_SOURCES=Object.freeze({
  hubei:{name:'湖北省博物馆 · 音乐文物研究综述',url:'https://www.hbww.org.cn/hhfz70n/p/9134.html'},
  hubeiCollection:{name:'湖北省博物馆 · 曾侯乙编钟',url:'https://www.hbww.org.cn/zgzb/p/4695.html'},
  sinica:{name:'中研院考古数位典藏 · 钟的部位',url:'https://archeodata.sinica.edu.tw/exhibition/detail/157'},
  shanghai:{name:'上海博物馆 · 晋侯稣钟',url:'https://www.shanghaimuseum.net/mu/show/202304/838cdaad-b93e-4c58-b046-edac0ec9639e/'},
  science:{name:'中国科学技术馆 · 曾侯乙编钟',url:'https://www.cdstm.cn/museum/zphc/hxzg2017x/art/2017/art_ae2344630ba74ee880b63d7cbe738ed0.html'},
  fudan:{name:'复旦出土文献研究 · 乐钟部位释名',url:'https://www.fdgwz.org.cn/Web/Show/1299'},
  national:{name:'中国国家博物馆 · 长甶青铜编钟',url:'https://www.chnmuseum.cn/zp/zpml/kgfjp/202108/t20210802_250934.shtml'},
  hubeiArchive:{name:'湖北省博物馆 · 编钟铭文档案',url:'https://www.hbww.org.cn/xwdt/p/7841.html'},
  museumStory:{name:'湖北省博物馆 · 曾侯乙·青铜',url:'https://artsandculture.google.com/story/qAVhJ6vlhDe4Lg?hl=zh-CN'},
  inscription:{name:'人民日报海外版 · 馆方访谈与铭文',url:'https://paper.people.com.cn/rmrbhwb/pc/content/202606/05/content_30161232.html'},
});
export const BELL_OVERVIEW=Object.freeze({id:'overview',name:'一口甬钟',reading:'从形制认识声音',
  text:'曾侯乙编钟包括钮钟、甬钟和镈钟。这里单独展示长柄的甬钟形制，便于查看悬挂构件、钟乳、鼓部和钟腔。',
  note:'照片参考模型，比例、壁厚和纹饰为近似。铭文采用有出处的释文重绘，字形不是原铭文摹本。上传的剖析图也属于结构示意。',
  sources:['hubeiCollection','sinica'],view:'front',anchor:[0,.35,.15]});
export const BELL_PARTS=Object.freeze([
  {id:'yong',name:'甬',reading:'yǒng · 顶部长柄',anchor:[0,.83,.044],view:'front',
    text:'钟顶的柄状部分称为「甬」，是辨认甬钟的重要形制特征。环形「钮」属于另一种悬挂形制，不能把甬和钮当作同一构件。',
    note:'本模型使用长甬，不将参考图中的环形钮直接套用到甬钟上。',sources:['sinica']},
  {id:'suspension',name:'旋与干',reading:'xuán / gàn · 悬挂构件',anchor:[0,.632,-.11],view:'back',
    text:'环绕甬、与悬挂部分相接的构件称为「旋」；相关的「干」用于悬钟。观察甬旁的挂耳，可以理解钟体怎样与挂钩连接。',
    note:'本模型挂耳依照片近似制作，未复原整套实物挂钩的尺寸与装配细节。',sources:['sinica','fudan']},
  {id:'wu',name:'舞',reading:'wǔ · 钟顶',anchor:[.11,.545,.035],view:'upper',
    text:'钟体上方的顶面称为「舞」，长甬从这一位置向上伸出。它不是击奏时的鼓部。',sources:['sinica']},
  {id:'zheng',name:'钲',reading:'zhēng · 中央阔带',anchor:[0,.40,.145],view:'front',
    text:'钟体正、背面中上部的中央阔带称为「钲」，两侧分布钟乳与饰带。曾侯乙甬钟确有错金铭文，记述器主、乐音及乐律关系；其中可见释读为「曾侯乙作持」的五字铭文。',
    note:'模型正面按释文重绘「曾侯乙乍持」，背面使用「姑洗之宮」这一乐名实例。字形不是拓本摹刻，也不表示本模型对应某件古钟的原调或测音。',sources:['fudan','hubeiArchive','museumStory','inscription']},
  {id:'mei',name:'枚',reading:'méi · 钟乳',anchor:[-.122,.39,.174],view:'front',
    text:'钲两旁突出的乳钉称为「枚」，也常称钟乳。枚与周围饰带共同构成可辨认的表面结构，不是贴在钟面上的音名按钮。',
    note:'当前单钟模型保留 36 枚圆润凸起；不把这一数量推为所有古代编钟的通则。',sources:['sinica','fudan']},
  {id:'zhuan',name:'篆',reading:'zhuàn · 枚间饰带',anchor:[-.12,.335,.138],view:'front',
    text:'枚之间的带状区域称为「篆」。馆藏乐钟的篆部可以装饰纹样，但不同年代、不同器物的纹饰并不相同。',
    note:'纹饰使用实物照片的局部表面参考，以贴合钟体的材质和细法线呈现。这里是照片参考的表面重建，不是原件纹饰的逐线建模或馆藏扫描。',sources:['sinica','museumStory']},
  {id:'gu',name:'正鼓部',reading:'钟体下部 · 正面击区',anchor:[0,.18,.145],view:'front',
    text:'钲下方的鼓部是击奏区域。湖北省博物馆介绍，合瓦形钟的鼓部正面和侧面可以分别发出不同音高，相关铭文也标示了这些音。',sources:['fudan','hubei']},
  {id:'side',name:'侧鼓部',reading:'鼓部侧向 · 另一击区',anchor:[.18,.15,.08],view:'side',
    text:'侧鼓部与正面鼓部对应不同的击奏位置。中国科学技术馆资料提到，曾侯乙编钟隧部和右鼓部大多标有该处所发音的音阶名。',
    note:'本项目左右侧触控入口共用侧鼓音，便于操作；三个入口不表示三个独立音高。',sources:['hubei','science']},
  {id:'mouth',name:'于与铣',reading:'yú / xiǎn · 钟口与两角',anchor:[-.19,.050,.065],view:'lower',
    text:'钟口弯曲的下缘称为「于」，两侧尖角称为「铣」。从斜下方观察，可以分清拱形口沿、两角与钟壁厚度。',
    note:'网页可见的口沿厚度来自模型设定，不是实物测绘数据。',sources:['fudan']},
  {id:'cavity',name:'钟壁与内腔',reading:'从钟口向内观察',anchor:[0,.34,-.10],view:'cavity',
    text:'钟口向下敞开，钟壁围成内腔。馆方资料描述的是用槌从外部击奏的乐钟；内腔不是另装两套发声器的盒子。',
    note:'模型不放置内悬钟舌。内壁厚薄和调音痕迹尚无本件测绘依据，不把示意图的色块厚薄直接当作实物。',sources:['science']},
  {id:'section',name:'合瓦形',reading:'截面形制 · 非圆筒',anchor:[.14,.13,.085],view:'cavity',
    text:'合瓦形是先秦乐钟的重要外形特征。上海博物馆说明，合瓦状扁箱体使正鼓、侧鼓的敲击形成不同振动模式，进而得到两个音高。',
    note:'剖视用于查看当前模型的形体，不是声学计算或馆藏内部 CT。合瓦形也不等于两片薄板拼装。',sources:['hubei','shanghai']},
  {id:'sound',name:'一钟双音',reading:'不同击点 · 不同振动模式',anchor:[0,.18,.145],view:'front',
    text:'一钟双音指同一口钟在不同击点产生两个音高。馆方资料将这一现象与合瓦形钟体及不同振动模式联系起来，而非只由一个部位的厚薄决定。',
    note:'本页未做有限元声学模拟，也不将页面的现代音位配对当作某一件古钟的测音结果。',sources:['hubei','shanghai']},
]);
export function bellPart(id){return BELL_PARTS.find(p=>p.id===id)||BELL_OVERVIEW;}

// Broad educational pick regions in the existing normalized Y-up photo study.
// This is UI hit testing, not segmentation of an archaeological scan.
export function classifyBellPart({x,y,z},normal={x:0,y:0,z:1}){
  if(![x,y,z].every(Number.isFinite))return null;
  if(y>.55){
    if(y>.60&&y<.67)return z<-.065?'suspension':y<.655?'suspension':'yong';
    return 'yong';
  }
  if(normal.x*x+normal.z*z<-.002||normal.y<-.65&&y>.50)return 'cavity';
  if(y>.523)return 'wu';
  const ax=Math.abs(x);
  if([.28,.39,.50].some(h=>Math.abs(y-h)<.025)&&[.071,.122,.173].some(v=>Math.abs(ax-v)<.026))return 'mei';
  if(y>.257){if(ax<.057)return 'zheng';return 'zhuan';}
  const arch=.101*Math.max(0,1-(x/.225)**2)**.825;
  if(y<arch+.020)return 'mouth';
  return ax>.125?'side':'gu';
}

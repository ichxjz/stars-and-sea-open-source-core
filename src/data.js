// A compact, independently authored atlas. Distances are mean orbital distances;
// positions and relative body sizes in the illustration are intentionally schematic.
export const planets = [
  {id:'mercury',en:'MERCURY',zh:'水星',au:0.39,x:210,r:7,color:'#b8aaa0',note:'最靠近太阳的行星，表面保留了漫长撞击史的痕迹。'},
  {id:'venus',en:'VENUS',zh:'金星',au:0.72,x:325,r:13,color:'#d5b18b',note:'浓厚的大气与明亮的云层覆盖着这颗岩质行星。'},
  {id:'earth',en:'EARTH',zh:'地球',au:1,x:445,r:14,color:'#6596ab',note:'我们已知唯一孕育生命的世界，也是多数深空任务的出发点。'},
  {id:'mars',en:'MARS',zh:'火星',au:1.52,x:570,r:10,color:'#ba6d50',note:'这颗红色行星长期承载着寻找古代水与生命迹象的探索。'},
  {id:'jupiter',en:'JUPITER',zh:'木星',au:5.2,x:755,r:36,color:'#c99b76',note:'太阳系最大的行星，云带与大红斑组成持续变化的大气。'},
  {id:'saturn',en:'SATURN',zh:'土星',au:9.58,x:955,r:29,color:'#d8bd89',note:'宽阔的冰粒环系环绕着这颗气态巨行星。'},
  {id:'uranus',en:'URANUS',zh:'天王星',au:19.2,x:1170,r:21,color:'#8cc0c3',note:'遥远的冰巨星，因甲烷吸收红光而呈现蓝绿色。'},
  {id:'neptune',en:'NEPTUNE',zh:'海王星',au:30.05,x:1380,r:20,color:'#6688bc',note:'最外侧的八大行星，深蓝色大气中存在强劲的风暴。'},
  {id:'pluto',en:'PLUTO',zh:'冥王星 · 矮行星',au:39.5,x:1490,r:5,color:'#b7a694',note:'位于海王星轨道之外的矮行星，新视野号曾飞掠这里。'},
];

export const featuredMissions = [
  {id:'sputnik',name:'SPUTNIK 1',zh:'斯普特尼克一号',year:1957,target:'earth',type:'地球轨道',note:'第一颗人造地球卫星，开启了人类的航天时代。'},
  {id:'luna2',name:'LUNA 2',zh:'月球二号',year:1959,target:'earth',type:'月球探测',note:'早期月球探测任务中的重要里程碑。'},
  {id:'mariner2',name:'MARINER 2',zh:'水手二号',year:1962,target:'venus',type:'行星飞掠',note:'飞掠金星的早期行星际探测器。'},
  {id:'pioneer10',name:'PIONEER 10',zh:'先驱者十号',year:1972,target:'jupiter',type:'深空探测',note:'执行木星飞掠并继续驶向外太阳系。'},
  {id:'pioneer11',name:'PIONEER 11',zh:'先驱者十一号',year:1973,target:'saturn',type:'深空探测',note:'先后飞掠木星和土星。'},
  {id:'viking1',name:'VIKING 1',zh:'海盗一号',year:1975,target:'mars',type:'火星探测',note:'由轨道器与着陆器组成的火星任务。'},
  {id:'voyager1',name:'VOYAGER 1',zh:'旅行者一号',year:1977,target:'jupiter',type:'深空探测',note:'飞掠木星、土星后继续飞往星际空间。'},
  {id:'voyager2',name:'VOYAGER 2',zh:'旅行者二号',year:1977,target:'neptune',type:'深空探测',note:'造访四颗外行星的深空探测器。'},
  {id:'galileo',name:'GALILEO',zh:'伽利略号',year:1989,target:'jupiter',type:'轨道探测',note:'长期研究木星及其卫星系统。'},
  {id:'cassini',name:'CASSINI–HUYGENS',zh:'卡西尼—惠更斯号',year:1997,target:'saturn',type:'轨道探测',note:'研究土星系统，并将惠更斯探测器送往泰坦。'},
  {id:'new-horizons',name:'NEW HORIZONS',zh:'新视野号',year:2006,target:'pluto',type:'深空探测',note:'穿越外太阳系，完成冥王星及柯伊伯带天体飞掠。'},
  {id:'mars-express',name:'MARS EXPRESS',zh:'火星快车号',year:2003,target:'mars',type:'轨道探测',note:'欧洲空间局的火星轨道探测任务。'},
  {id:'juno',name:'JUNO',zh:'朱诺号',year:2011,target:'jupiter',type:'轨道探测',note:'从极区轨道研究木星内部和大气。'},
  {id:'curiosity',name:'CURIOSITY',zh:'好奇号',year:2011,target:'mars',type:'火星探测',note:'探索火星盖尔陨石坑环境的火星车。'},
  {id:'bepicolombo',name:'BEPICOLOMBO',zh:'贝皮科伦坡号',year:2018,target:'mercury',type:'行星探测',note:'前往水星的多航天器联合任务。'},
  {id:'perseverance',name:'PERSEVERANCE',zh:'毅力号',year:2020,target:'mars',type:'火星探测',note:'探索火星杰泽罗陨石坑的火星车。'},
  {id:'juice',name:'JUICE',zh:'木星冰月探测器',year:2023,target:'jupiter',type:'卫星探测',note:'前往木星冰卫星系统的探测任务。'},
  {id:'europa-clipper',name:'EUROPA CLIPPER',zh:'欧罗巴快船号',year:2024,target:'jupiter',type:'卫星探测',note:'计划多次飞掠木星卫星欧罗巴。'},
];

// Names, dates, targets and mission classes are factual catalog metadata.
// The separate visual positions are illustrative unless a valid ephemeris is supplied.
const agency = {
  sputnik: 'Soviet space program', luna2: 'Soviet space program',
  mariner2: 'NASA', pioneer10: 'NASA', pioneer11: 'NASA', viking1: 'NASA',
  voyager1: 'NASA', voyager2: 'NASA', galileo: 'NASA',
  cassini: 'NASA / ESA / ASI', 'new-horizons': 'NASA',
  'mars-express': 'ESA', juno: 'NASA', curiosity: 'NASA',
  bepicolombo: 'ESA / JAXA', perseverance: 'NASA', juice: 'ESA',
  'europa-clipper': 'NASA',
};

// These 18 short entries were independently written for this open-source sample.
// Exact launch days and real-time spacecraft positions are intentionally omitted.
export const missions = featuredMissions.map(item => ({
  ...item,
  date: String(item.year),
  system: item.target,
  kind: item.id === 'sputnik' ? 'satellite' :
    ['viking1', 'curiosity', 'perseverance'].includes(item.id) ? 'lander' : 'probe',
  orbit: '示意位置',
  status: '选录档案',
  operator: agency[item.id] || '参见机构资料',
}));
export const missionKinds = [
  { id: 'all', label: '全部任务', kinds: [] },
  { id: 'satellite', label: '人造卫星', kinds: ['satellite'] },
  { id: 'probe', label: '轨道器与探测器', kinds: ['probe'] },
  { id: 'surface', label: '着陆器与巡视器', kinds: ['lander'] },
].map(group => ({ ...group, count: group.id === 'all' ? missions.length : missions.filter(item => group.kinds.includes(item.kind)).length }));

export const yearMin = 1957;
export const yearMax = 2026;

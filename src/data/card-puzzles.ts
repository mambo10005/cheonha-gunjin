import type {CardAction,Mark,MarkBag} from '../core/card-engine-types.ts';
/**
 * 장소 사건 카드 퍼즐 3종. 장애 표식은 카드의 행동(조사·설득…)으로만 줄어들고,
 * 장애마다 열쇠 표식을 보유하면 한 번 더 깎는다. 해결 방식은 장애·표식 상태로 열린다.
 */
export interface ObstacleDef {id:string;name:string;hp:number;accepts:CardAction[];key:Mark;text:string}
export interface ResolutionDef {
 id:string;label:string;text:string;quality:'complete'|'partial'|'debate'|'duel';
 requires:{cleared?:string[];atMost?:Record<string,number>;marks?:MarkBag;anyCleared?:string[]};
 consume?:MarkBag;cost?:{funds?:number;food?:number};legacy:{kind:'policy'|'obligation'|'gate';text:string};
}
export interface PuzzleDef {
 id:string;title:string;location:string;intro:string;alertLimit:number;start:MarkBag;startAlert:number;
 obstacles:ObstacleDef[];inspect:Record<string,MarkBag>;items:Partial<Record<'ledger'|'letter'|'map'|'seal'|'ration'|'medicine',MarkBag>>;
 resolutions:ResolutionDef[];failure:{text:string;closed:number;exposure:number};
}
export const PUZZLES:Record<string,PuzzleDef>={
 escort:{id:'escort',title:'곡물 창고 수레 통행',location:'store',alertLimit:5,start:{},startAlert:1,
  intro:'수레는 실렸지만 장부와 실제 수량이 다르고, 호위는 비어 있으며, 하역장 길은 막혀 있고, 창고 책임자는 경계합니다. 카드로 장애를 줄여 해결 방식을 여세요.',
  obstacles:[
   {id:'ledger_gap',name:'장부 불일치',hp:2,accepts:['investigate','trade'],key:'ledger',text:'출입 장부와 자루 수가 맞지 않습니다.'},
   {id:'escort_gap',name:'호위 공백',hp:2,accepts:['mobilize','prepare','resolve'],key:'guard',text:'수레를 지킬 사람이 모자랍니다.'},
   {id:'blocked',name:'막힌 통로',hp:2,accepts:['investigate','resolve'],key:'clue',text:'하역장 통로가 짐으로 막혔습니다.'},
   {id:'keeper_alert',name:'책임자 경계',hp:2,accepts:['persuade','trade'],key:'support',text:'창고 책임자가 외부인을 의심합니다.'},
  ],
  inspect:{cart:{clue:1},passage:{clue:1},guards:{guard:1},ledger:{ledger:2},contract:{promise:1},key:{inside:1},workers:{inside:1,clue:1},sacks:{supply:1},route:{clue:1},'damaged-sacks':{ledger:1},'locked-door':{alert:1,inside:1}},
  items:{ledger:{ledger:2},map:{clue:2},letter:{support:2},ration:{supply:2},seal:{inside:1}},
  resolutions:[
   {id:'debate',label:'장부 설전',text:'장부 불일치를 풀었다면 창고 책임자·호위 대표와 장부를 근거로 설전합니다.',quality:'debate',requires:{cleared:['ledger_gap']},legacy:{kind:'policy',text:'창고 장부 공개 · 거병 후 구휼 창고 정책 후보'}},
   {id:'duel',label:'통행권 대결',text:'호위 공백을 메웠다면 호위 대표와 통행권을 걸고 겨룹니다. 대결 전 전술 3장을 고릅니다.',quality:'duel',requires:{cleared:['escort_gap']},legacy:{kind:'gate',text:'호위 대표의 인정 · 군영 장악 대결에서 기세 +1'}},
   {id:'alternate',label:'우회로 확보',text:'막힌 통로를 뚫고 내부 협력 1을 써서 짐꾼이 아는 좁은 길로 수레를 뺍니다.',quality:'partial',requires:{cleared:['blocked'],marks:{inside:1}},consume:{inside:1},cost:{},legacy:{kind:'gate',text:'비밀 우회로 · 성문 내응 후속 대결 상대 체력 −4'}},
   {id:'contract-bond',label:'보증 호위 계약',text:'장부와 책임자 경계를 모두 풀면 수량을 맞춘 왕복 보증 계약(자금 4)을 맺습니다.',quality:'complete',requires:{cleared:['ledger_gap','keeper_alert']},cost:{funds:4},legacy:{kind:'policy',text:'보증 호위 · 거병 후 역참 정비 정책'}},
   {id:'contract-shared',label:'책임 분담 계약',text:'책임자 경계를 풀었다면 적은 보수(자금 1)로 계약하되 사고 책임은 우리가 집니다.',quality:'partial',requires:{cleared:['keeper_alert']},cost:{funds:1},legacy:{kind:'obligation',text:'사고 책임 분담 · 군진 전투에 「책임 분담」 부담 카드'}},
   {id:'contract',label:'단기 호위 계약',text:'장애가 남아도 자금 3·채무 1로 단기 계약을 맺습니다(부분 성공).',quality:'partial',requires:{},cost:{funds:3},legacy:{kind:'obligation',text:'단기 계약 채무 · 군량 지급 약속'}},
  ],
  failure:{text:'창고 책임자가 마당을 닫았습니다. 3시간 동안 창고 출입이 막히고, 단기 계약 또는 이미 뚫은 우회로만 남습니다.',closed:3,exposure:1}},
 recommendation:{id:'recommendation',title:'순욱 추천서 의뢰',location:'archive',alertLimit:5,start:{},startAlert:1,
  intro:'추천서의 이름과 구휼 기록 사이에 공백이 있고, 서리는 기록 공개를 경계하며, 피난민은 이름이 드러날까 두려워합니다.',
  obstacles:[
   {id:'record_gap',name:'기록 공백',hp:2,accepts:['investigate'],key:'ledger',text:'추천서 이름 일부가 구휼 장부에 없습니다.'},
   {id:'clerk_guard',name:'서리의 경계',hp:2,accepts:['persuade','trade'],key:'opinion',text:'서리는 기록을 넘기면 책임을 진다고 봅니다.'},
   {id:'refugee_distrust',name:'피난민 불신',hp:2,accepts:['persuade','prepare'],key:'support',text:'피난민은 이름이 공개될까 두려워합니다.'},
  ],
  inspect:{ledger:{ledger:2},map:{clue:1,inside:1},seal:{alert:1,promise:1}},
  items:{ledger:{ledger:2},letter:{opinion:1,support:1},seal:{inside:1},map:{clue:2}},
  resolutions:[
   {id:'truth',label:'문서 대조 완전 검증',text:'기록 공백과 서리의 경계를 모두 풀면 설전 없이 추천서를 완전 검증합니다.',quality:'complete',requires:{cleared:['record_gap','clerk_guard']},legacy:{kind:'policy',text:'검증된 추천 명부 · 거병 후 유민 정착 정책'}},
   {id:'debate',label:'서리 설전',text:'기록 공백을 풀었다면 서리와 보증 범위를 설전합니다. 남은 장애는 설전 요구로 남습니다.',quality:'debate',requires:{cleared:['record_gap']},legacy:{kind:'gate',text:'서리 설전 기록 · 민회 설전 논거'}},
   {id:'conditional',label:'조건부 보증',text:'피난민 불신을 풀고 약속 1을 걸어 군량 지급을 조건으로 보증합니다.',quality:'partial',requires:{cleared:['refugee_distrust'],marks:{promise:1}},consume:{promise:1},legacy:{kind:'obligation',text:'군량 지급 약속 · 거병 후 정산 의무'}},
   {id:'expose',label:'공개 고발',text:'기록 공백을 풀고 공론 2를 써서 부정을 공개합니다. 노출 +2, 관리 반발 의무.',quality:'complete',requires:{cleared:['record_gap'],marks:{opinion:2}},consume:{opinion:2},legacy:{kind:'obligation',text:'관리 반발 · 권한 공유 의무'}},
  ],
  failure:{text:'서리가 문서고를 봉인했습니다. 3시간 동안 출입이 막히고 추가 조사 비용이 듭니다.',closed:3,exposure:1}},
 barracks:{id:'barracks',title:'병영 장악 준비',location:'barracks',alertLimit:6,start:{},startAlert:1,
  intro:'의용군은 지휘권을 믿지 않고, 군기는 풀려 있으며, 수비대가 병영을 지켜봅니다.',
  obstacles:[
   {id:'command_distrust',name:'지휘권 불신',hp:3,accepts:['mobilize','resolve'],key:'momentum',text:'훈련관은 위험을 함께 질 지휘자를 원합니다.'},
   {id:'discipline',name:'군기 해이',hp:2,accepts:['prepare'],key:'supply',text:'보급이 끊겨 훈련이 흐트러졌습니다.'},
   {id:'garrison_alert',name:'수비대 경계',hp:2,accepts:['investigate','trade','persuade'],key:'inside',text:'수비대가 병영 출입을 감시합니다.'},
  ],
  inspect:{roster:{clue:1,support:1},weapons:{momentum:1,guard:1},orders:{inside:1,clue:1},supplies:{supply:1,ledger:1}},
  items:{ration:{supply:2},seal:{inside:2},medicine:{supply:1},map:{clue:2}},
  resolutions:[
   {id:'duel',label:'훈련 대표 대결',text:'지휘권 불신을 1 이하로 낮추면 훈련 대표와 대결합니다. 대결 전 전술 3장을 고릅니다.',quality:'duel',requires:{atMost:{command_distrust:1}},legacy:{kind:'gate',text:'대결로 얻은 지휘권 · 군영 장악 관문 상대 체력 −3'}},
   {id:'drill',label:'진형 증명',text:'군기 해이를 풀고 기세 2를 써서 진형 훈련으로 지휘를 증명합니다.',quality:'complete',requires:{cleared:['discipline'],marks:{momentum:2}},consume:{momentum:2},cost:{food:1},legacy:{kind:'policy',text:'군영 규율 · 거병 후 훈련 정책'}},
   {id:'inside',label:'수비대 포섭',text:'수비대 경계를 풀고 내부 협력 2를 써서 수비대 일부를 포섭합니다.',quality:'partial',requires:{cleared:['garrison_alert'],marks:{inside:2}},consume:{inside:2},legacy:{kind:'gate',text:'포섭한 수비대 · 성문 내응 설전 신뢰 +1'}},
   {id:'supply',label:'보급 약속',text:'군기 해이를 풀고 보급 2와 군량 지급 약속으로 병력을 모읍니다.',quality:'partial',requires:{cleared:['discipline'],marks:{supply:2}},consume:{supply:2},legacy:{kind:'obligation',text:'병영 군량 지급 · 거병 후 정산 의무'}},
  ],
  failure:{text:'수비대가 병영 출입을 막았습니다. 경계 복구 사건이 성문에 생깁니다.',closed:3,exposure:2}},
};
export function puzzleAt(location:string){return Object.values(PUZZLES).find(p=>p.location===location);}

import type {PersonnelActivity} from '../core/personnel-types.ts';
import type {RaisingFamily,RaisingOperation} from '../core/raising-types.ts';
export const PROLOGUE_SEED=131001;
export const PROTAGONISTS={
 chengong:{goal:'보호 약속을 지키며 첫 도시의 공론을 얻는다',weakness:'군사 기반 부족',principle:'약속 사용 후 명분 +1',growth:'신망과 공동 운영'},
 zhangliao:{goal:'의용군과 함께 지휘권을 얻고 첫 도시를 지킨다',weakness:'군사 행동의 노출 증가',principle:'군사 사용 후 훈련 +1·노출 +1',growth:'군사 결단과 군영 통합'},
 guojia:{goal:'정보와 내부 협력으로 성문을 연다',weakness:'직접 병력 생산 부족',principle:'정보 사용 후 다음 경로 공개',growth:'서신망과 내응 설계'},
};
export interface OfficerDefinition {
 id:string;name:string;major:boolean;role:string;family:RaisingFamily;places:string[];
 task:{text:string;resource:'food'|'funds';cost:number};taboo:string;goal:string;opposedCards:string[];
 roles:[string,string];unique:[string,string];support:string;admin:string;combat:string;debate:string;
 principle:'refund'|'cycle'|'reveal'|'shelter'|'credit';principleText:string;policy:string;
}
export const OFFICERS:Record<string,OfficerDefinition>=Object.fromEntries(([
 ['dianwei','전위',true,'군사 지도자','military',['barracks','bandits'],'호위할 주민의 식량 마련','food',1,'주민 강제 징발','향촌의 안전','철위의 결집','퇴로의 호위','militia','readied','assurance','refund','첫 군사 카드 사용 후 준비력 1 회복','군영 보호'],
 ['caoren','조인',true,'행정·수비','cause',['office','camp'],'수비 장부와 보수 비용 확보','funds',1,'방비 없는 무리한 출진','성문과 주민 보호','성문 정비령','수비대의 공론','patrol','formation','plan','shelter','첫 명분 카드 사용 후 노출 2 감소','성문 보전'],
 ['chengpu','정보',true,'상단·물류','supply',['store','ferry'],'호송대의 식량 지급','food',1,'호송 물자의 횡령','끊기지 않는 보급','노장의 호송','분산 군량망','survey','order','supplies','cycle','첫 물자 카드 사용 후 1장 뽑기','분산 보급'],
 ['xunyu','순욱',true,'명망·행정','network',['inn','manor'],'피난민 추천서의 구휼 보증','food',2,'주민을 담보로 한 차입','공론에 따른 질서','왕좌의 인선','공론의 장부','register','order','redress','reveal','첫 인맥 카드 사용 후 다음 장소 공개','인재 추천권'],
 ['lusu','노숙',true,'외교·중재','intel',['letters','market'],'상단과 향촌의 중재 비용','funds',1,'협정의 일방 파기','서로 이익이 되는 협정','양측의 계산','이면의 약정','mediation','feint','bridge','credit','첫 정보 카드 사용 후 자금 1·채무 1','통상 협정'],
 ['local_captain','향촌 훈련관',false,'군사 지도자','military',['village','camp'],'향병 훈련의 군량 마련','food',1,'무훈을 위한 주민 희생','고향 향병의 생존','향병의 교대','향촌의 방진','militia','spear','assurance','refund','첫 군사 카드 사용 후 준비력 1 회복','향병 자치'],
 ['local_scribe','하남 서리',false,'행정가','cause',['office','inn'],'관청 문서의 보존 비용','funds',1,'문서와 약속의 파기','새 세력의 공정한 장부','보존된 호적','문서의 효력','register','order','petition','reveal','첫 명분 카드 사용 후 다음 장소 공개','문서 보존'],
 ['local_broker','나루 중개인',false,'물류·중재','funds',['market','ferry'],'나루 사공의 품삯 지급','funds',1,'정당한 품삯 미지급','안전한 나루의 교역','사공의 신용','나루의 우회','permit','feint','plan','cycle','첫 군자금 카드 사용 후 1장 뽑기','나루 통행'],
] as const).map(v=>{const [id,name,major,role,family,places,text,resource,cost,taboo,goal,_a,_b,admin,combat,debate,principle,principleText,policy]=v;return [id,{id,name,major,role,family,places:[...places],task:{text,resource,cost},taboo,goal,opposedCards:family==='network'?['loan','loot']:family==='cause'?['redress']:['loot'],roles:[`role_${family}_a`,`role_${family}_b`],unique:[`person_${id}_a`,`person_${id}_b`],support:`support_${id}`,admin,combat,debate,principle,principleText,policy}];}));
export interface PersonalDefinition {id:string;name:string;family:RaisingFamily;text:string;ops:RaisingOperation[];cost:number;owners:string[];activities:PersonnelActivity[];combat:string;admin:string;debate:string;support?:boolean}
const res=(field:Extract<RaisingOperation,{kind:'resource'}>['field'],amount:number):RaisingOperation=>({kind:'resource',field,amount});
const OPS:Record<string,RaisingOperation[]>={military:[res('troops',4),res('training',1)],cause:[res('legitimacy',2),res('support',1)],supply:[res('food',3),res('intel',1)],network:[res('influence',2),res('legitimacy',1)],intel:[res('intel',2),{kind:'reveal',amount:1}],funds:[res('funds',3)]};
const TEXT:Record<string,string>={military:'병력 +4·훈련 +1',cause:'명분 +2·지지 +1',supply:'군량 +3·정보 +1',network:'인맥 +2·명분 +1',intel:'정보 +2·다음 경로 공개',funds:'자금 +3'};
export const PERSONAL_CARDS:Record<string,PersonalDefinition>={};
for(const o of Object.values(OFFICERS)){
 for(const [i,id] of o.roles.entries())if(!PERSONAL_CARDS[id])PERSONAL_CARDS[id]={id,name:`${o.role.split('·')[0]}의 ${i?'협력':'기초'}`,family:o.family,text:TEXT[o.family],ops:OPS[o.family],cost:1,owners:[],activities:['raising','combat','admin','debate','diplomacy'],combat:o.combat,admin:o.admin,debate:o.debate};
 for(const [i,id] of o.unique.entries())PERSONAL_CARDS[id]={id,name:i?({'dianwei':'퇴로의 호위','caoren':'수비대의 공론','chengpu':'분산 군량망','xunyu':'공론의 장부','lusu':'이면의 약정','local_captain':'향촌의 방진','local_scribe':'문서의 효력','local_broker':'나루의 우회'}[o.id]!):({'dianwei':'철위의 결집','caoren':'성문 정비령','chengpu':'노장의 호송','xunyu':'왕좌의 인선','lusu':'양측의 계산','local_captain':'향병의 교대','local_scribe':'보존된 호적','local_broker':'사공의 신용'}[o.id]!),family:o.family,text:TEXT[o.family]+(i?'·노출 −1':'·카드 1장'),ops:[...OPS[o.family],i?res('exposure',-1):{kind:'draw',amount:1}],cost:1,owners:[o.id],activities:['raising','combat','admin','debate','diplomacy'],combat:o.combat,admin:o.admin,debate:o.debate};
 PERSONAL_CARDS[o.support]={id:o.support,name:`${o.name}의 조언`,family:o.family,text:TEXT[o.family]+'·거병 동안 임시 지원',ops:OPS[o.family],cost:0,owners:[o.id],activities:['raising'],combat:o.combat,admin:o.admin,debate:o.debate,support:true};
}
export const JOINT_CARDS=[
 {id:'joint_feint',name:'허실상응',owners:['lusu','dianwei'],family:'intel' as const,text:'정보 +2·훈련 +1·준비력 +1',ops:[res('intel',2),res('training',1),{kind:'power' as const,amount:1}],combat:'feint',admin:'patrol',debate:'inspect',relation:'계책과 결단'},
 {id:'joint_records',name:'공론과 문서',owners:['xunyu','local_scribe'],family:'cause' as const,text:'명분 +3·인맥 +2·노출 −1',ops:[res('legitimacy',3),res('influence',2),res('exposure',-1)],combat:'order',admin:'register',debate:'petition',relation:'추천과 기록'},
 {id:'joint_supply',name:'군량 선대',owners:['chengpu','local_captain'],family:'supply' as const,text:'군량 +5·병력 +3·채무 +2',ops:[res('food',5),res('troops',3),res('debt',2)],combat:'order',admin:'survey',debate:'supplies',relation:'보급과 향병'},
 {id:'joint_terms',name:'이면 합의',owners:['lusu','local_broker'],family:'network' as const,text:'정보 +2·인맥 +2·최종 집중 +1',ops:[res('intel',2),res('influence',2),{kind:'discount' as const,amount:1}],combat:'feint',admin:'mediation',debate:'bridge',relation:'중재와 통행'},
];
for(const j of JOINT_CARDS)PERSONAL_CARDS[j.id]={...j,cost:1,activities:['raising','combat','admin','debate','diplomacy']};
export const ACTIVITY_NAMES:Record<PersonnelActivity,string>={raising:'거병',combat:'전투',debate:'설전',admin:'내정',diplomacy:'외교'};
export const RELATION_NAMES={unknown:'소문',contact:'접촉',cooperating:'협력',trusted:'신뢰',recruited:'등용',valued:'중용',core:'핵심 인재',departed:'이탈'};

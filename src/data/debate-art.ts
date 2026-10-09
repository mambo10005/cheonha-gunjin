import type { DebateState } from '../core/social-types.ts';

export const REQUIRED_ART_POSES = ['neutral','speak','press','countered','concede'] as const;
export type ArtPose = typeof REQUIRED_ART_POSES[number] | 'victory';
export interface DebateArt {
  id: string; quality: 'generated' | 'silhouette'; width:number; height:number;
  poses: Partial<Record<ArtPose,string>>; placeholder:string; fallback:string;
  crop: {desktop:string;mobile:string}; faceAnchor:[number,number]; mirror:boolean;
  palette:string; silhouette:string; prop:string; age:string; material:string;
}
const PORTRAIT_PATHS:Record<string,Record<ArtPose,string>>={
  "guojia": {
    "neutral": "/assets/debate/portraits/guojia/neutral.webp",
    "speak": "/assets/debate/portraits/guojia/speak.webp",
    "press": "/assets/debate/portraits/guojia/press.webp",
    "countered": "/assets/debate/portraits/guojia/countered.webp",
    "concede": "/assets/debate/portraits/guojia/concede.webp",
    "victory": "/assets/debate/portraits/guojia/victory.webp"
  },
  "merchant": {
    "neutral": "/assets/debate/portraits/merchant/neutral.webp",
    "speak": "/assets/debate/portraits/merchant/speak.webp",
    "press": "/assets/debate/portraits/merchant/press.webp",
    "countered": "/assets/debate/portraits/merchant/countered.webp",
    "concede": "/assets/debate/portraits/merchant/concede.webp",
    "victory": "/assets/debate/portraits/merchant/victory.webp"
  }
};
const paths=(id:string):Record<ArtPose,string>=>PORTRAIT_PATHS[id];
export const DEBATE_ART:Record<string,DebateArt>={
  guojia:{id:'guojia',quality:'generated',width:512,height:512,poses:paths('guojia'),placeholder:'/assets/debate/portraits/guojia/low.webp',fallback:'/assets/debate/portraits/guojia/neutral.webp',crop:{desktop:'50% 50%',mobile:'50% 18%'},faceAnchor:[50,24],mirror:false,palette:'#799dba',silhouette:'정돈된 좁은 소매',prop:'죽간·봉인 서신',age:'젊은 성인',material:'먹청 비단·청동'},
  merchant:{id:'merchant',quality:'generated',width:512,height:512,poses:paths('merchant'),placeholder:'/assets/debate/portraits/merchant/low.webp',fallback:'/assets/debate/portraits/merchant/neutral.webp',crop:{desktop:'50% 50%',mobile:'50% 18%'},faceAnchor:[50,24],mirror:false,palette:'#bca07e',silhouette:'넓고 낮은 소매',prop:'장부·인장함',age:'중년',material:'자주색 린넨·목재'},
};
export const SILHOUETTE_ART:DebateArt={...DEBATE_ART.guojia,id:'anonymous',quality:'silhouette',poses:{neutral:DEBATE_ART.guojia.fallback},palette:'#697785',silhouette:'비식별 그림자',prop:'문서',age:'미정',material:'그림자'};
export function characterArt(id:string):DebateArt{return DEBATE_ART[id]??SILHOUETTE_ART;}
export function poseAsset(id:string,pose:ArtPose):string {const art=characterArt(id);return art.poses[pose]??art.poses.neutral??art.fallback;}
export type MeetingPlace='camp'|'office'|'guesthouse'|'hall'|'gate';
export const MEETING_PLACES:Record<MeetingPlace,{name:string;image:string;prop:string;light:string}>={
  camp:{name:'군막 회담',image:'/assets/debate/backgrounds/camp.webp',prop:'작전 지도',light:'#bda276'},
  office:{name:'군막 · 관청 접견',image:'/assets/debate/backgrounds/camp.webp',prop:'관인·공식 문서',light:'#7c9b9e'},
  guesthouse:{name:'군막 · 상단 접견',image:'/assets/debate/backgrounds/camp.webp',prop:'장부·교역 인장',light:'#b89673'},
  hall:{name:'군막 · 향촌 회담',image:'/assets/debate/backgrounds/camp.webp',prop:'지역 지도·목간',light:'#98a482'},
  gate:{name:'군막 · 관문 협상',image:'/assets/debate/backgrounds/camp.webp',prop:'관문 깃발·통행 문서',light:'#9b8795'},
};
export function meetingPlace(s:DebateState):MeetingPlace{
  if(s.context.kind==='recruit')return 'office';
  if(s.context.kind==='supply')return 'hall';
  if(s.context.faction==='caravan')return 'guesthouse';
  if(s.context.faction==='militia')return 'gate';
  return 'hall';
}
export function meetingSubject(s:DebateState):string{
  if(s.context.kind==='recruit')return '인재 합류 조건';
  if(s.context.kind==='supply')return '피난민 보급 조건';
  if(s.context.kind==='agreement')return {sponsorship:'상단 후원 약정',escort:'향촌 호송 약정',operation:'의용군 공동 작전'}[s.context.clause];
  return {supply:'군량 보급',passage:'관문 통행',support:'군사 지원'}[s.context.trade];
}

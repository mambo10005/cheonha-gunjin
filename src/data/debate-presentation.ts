import { characterArt, poseAsset } from './debate-art.ts';
export { speechLine, opponentLine } from './debate-dialogue.ts';
export type PortraitPose = 'idle' | 'speak' | 'press' | 'counter' | 'advantage' | 'concede';
export interface CharacterPresentation {
  portrait: string; fallback: string; portraitFocus: string; poses: PortraitPose[];
  factionPalette: string; signatureEffect: 'reveal' | 'bind' | 'seal'; signatureActions: string[];
  textStyle: string; anchor: [number, number]; zoom: [number, number]; mirror: boolean;
}
const common = { fallback: '/assets/debate/portraits/guojia/neutral.webp', portraitFocus:'50% 28%', poses: ['idle','speak','press','counter','advantage','concede'] as PortraitPose[], anchor:[50,95] as [number,number], zoom:[1,1.06] as [number,number], mirror:false };
export const DEBATE_PRESENTATION: Record<string,CharacterPresentation> = {
  guojia: {...common,portrait:poseAsset('guojia','neutral'),factionPalette:'#75c6be',signatureEffect:'reveal',signatureActions:['disclose','evidence'],textStyle:'선견'},
  chengong: {...common,portrait:poseAsset('chengong','neutral'),factionPalette:'#e6bd76',signatureEffect:'bind',signatureActions:['concede','proposal'],textStyle:'중재'},
  merchant: {...common,portrait:poseAsset('merchant','neutral'),factionPalette:'#d6a84a',signatureEffect:'seal',signatureActions:[],textStyle:'상단'},
  elder: {...common,portrait:poseAsset('elder','neutral'),factionPalette:'#c88d77',signatureEffect:'seal',signatureActions:[],textStyle:'향촌'},
};
export const FALLBACK_PRESENTATION: CharacterPresentation = {...common,portrait:common.fallback,factionPalette:'#bca883',signatureEffect:'seal',signatureActions:[],textStyle:'설전'};
export function characterPresentation(id:string):CharacterPresentation {return {...(DEBATE_PRESENTATION[id] ?? FALLBACK_PRESENTATION),fallback:characterArt(id).fallback};}
export function portraitPose(id:string, requested:PortraitPose):PortraitPose {return characterPresentation(id).poses.includes(requested) ? requested : 'idle';}
export const ARGUMENT_VISUALS: Record<string,{symbol:string;family:string;effect:string;line:string[]}> = {
  evidence:{symbol:'근거',family:'근거',effect:'document',line:['장부의 근거를 살펴보십시오.','말 대신 기록으로 답하겠습니다.']},
  rebuttal:{symbol:'반론',family:'반론',effect:'break',line:['그 주장은 앞뒤가 맞지 않습니다.','논점부터 바로잡겠습니다.']},
  concede:{symbol:'양보',family:'양보',effect:'bind',line:['염려하신 부분은 제가 맡겠습니다.','이만큼은 양보하겠습니다.']},
  proposal:{symbol:'운영',family:'운영',effect:'map',line:['길과 수레를 함께 정합시다.','실행할 방도를 제안하겠습니다.']},
  disclose:{symbol:'정보',family:'정보',effect:'letter',line:['봉인한 작전서를 공개하겠습니다.','다음 길의 위험은 이미 살폈습니다.']},
  pledge:{symbol:'군량',family:'실물',effect:'supply',line:['군량을 먼저 내놓겠습니다.','말뿐인 약속이 되지 않게 하겠습니다.']},
  authority:{symbol:'권한',family:'권한',effect:'seal',line:['권한과 책임을 문서에 남깁시다.','맡기되 그 대가도 분명히 합시다.']},
  credential:{symbol:'협정',family:'신용',effect:'accord',line:['지켜 온 협정을 증거로 삼겠습니다.','우리의 약속은 이미 증명되었습니다.']},
};

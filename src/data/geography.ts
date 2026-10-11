import type {Terrain} from '../core/types.ts';
export type Confidence='attested'|'approximate'|'disputed'|'fictionalized'|'fictional';
export interface Place {
 id:string;primaryName:string;hanjaName:string;romanizedName:string;modernReference:string;featureType:string;
 administrativeParent:string|null;validFrom:number;validTo:number;coordinate:{longitude:number;latitude:number};
 coordinateConfidence:Confidence;nameConfidence:Confidence;source:string;sourceLicense:string;sourceCitation:string;
 notes:string;gameplayRole:string;mapX:number;mapY:number;adjustment:string;
}
export const GEOGRAPHY_VERSION='henan-190-review-1';
export const REGION_VERSION=1;
export const SCENARIO_YEAR=190;
export const SOURCES={
 gazetteer:{url:'https://www.donglishuzhai.net/chapter/1051.html',citation:'후한서 지19 군국1 · 하남윤 항목. 후대 주석과 본문을 구분하여 지명만 참조.',license:'고전 원문은 공공 영역. 사이트 편집·주석의 별도 이용조건 미확인: 본문·데이터 복제 없음.'},
 campaign:{url:'https://ancient-china-books.github.io/zizhitongjian/OEBPS/Text/6203.html',citation:'자치통감 권59 · 초평 원년(190), 형양·성고·낙양 및 환원 통로.',license:'고전 사실만 참조. 사이트 전사문·주석 복제 없음.'},
 landscape:{url:'https://www.sciencedirect.com/science/article/pii/S1040618219301892',citation:'Geomorphic changes along the Yiluo River influenced the emergence of the first urban center at the Erlitou Site, Central Plains of China (2019). 초록의 이수·낙수 분지 관계만 참조; 후한 유로를 증명하지 않음.',license:'논문 그림·GIS·좌표 복제 없음. 낙양 분지 지세 개념만 참조.'},
 chgis:{url:'https://chgis.fas.harvard.edu/data/chgis/v6/',citation:'CHGIS V6 (2016), Harvard/Fudan. 시계열 지명 구조·라이선스 검토만.',license:'공식 페이지: 학술 연구 무료, 상업 사용·재판매·재배포 금지. 데이터·타일·경계·좌표 포함하지 않음.'},
};
// The only supported time slice is 190. These are deliberately NOT lifetime dates or surveyed ancient seats.
const make=(id:string,name:string,hanja:string,roman:string,lon:number,lat:number,x:number,y:number,kind='county'):Place=>({
 id,primaryName:name,hanjaName:hanja,romanizedName:roman,modernReference:'허난성 낙양–공이–형양 권역. 현대 행정구역은 위치 참고만.',
 featureType:kind,administrativeParent:kind==='administration'?null:'henan-yin',validFrom:190,validTo:190,
 coordinate:{longitude:lon,latitude:lat},coordinateConfidence:'approximate',nameConfidence:'attested',
 source:SOURCES.gazetteer.url,sourceLicense:SOURCES.gazetteer.license,sourceCitation:SOURCES.gazetteer.citation,
 notes:'사료에 명칭 존재. 190년 존속은 후한 행정 기록과 전쟁 맥락의 교차 해석이며 당해 연도 행정 원장을 재현한 것이 아님. 좌표는 독자 작성한 권역 참고 중심점으로 고대 치소 확정 좌표가 아님.',
 gameplayRole:kind==='county'?'주변 창작 활동 거점의 역사적 맥락':'지역 맥락',mapX:x,mapY:y,
 adjustment:'동서·남북 관계만 유지한 군용 약도. 라벨과 8행군 분기를 위해 거리·지형 폭을 과장. 실제 거리·측량·행정 경계가 아님.',
});
export const PLACES:Place[]=[
 make('henan-yin','하남윤','河南尹','Henan Yin',113,34.7,1030,80,'administration'),
 make('luoyang','낙양','雒陽','Luoyang',112.6,34.7,270,420),
 make('yanshi','언사','匽師 / 偃師','Yanshi',112.8,34.7,780,460),
 make('gong','공현','鞏','Gong',113,34.8,1260,400),
 make('chenggao','성고','成睪 / 成皋','Chenggao',113.2,34.8,1560,410),
 make('xingyang','형양','熒陽 / 滎陽','Xingyang',113.4,34.8,1860,480),
 make('goushi','구씨','緱氏','Goushi',112.8,34.6,930,850),
 make('huanyuan','환원관','轘轅關','Huanyuan',112.9,34.5,1150,900,'pass'),
 make('mang','북망산','芒山','Mang',112.6,34.8,490,220,'mountain'),
];
export const place=(id:string)=>PLACES.find(p=>p.id===id)!;
export interface Site {id:string;floor:number;col:number;placeId:string;name:string;mapX:number;mapY:number;terrain:Terrain;corridor:string;adjustment:string;}
const centers=[1790,1550,1320,1090,890,680,470,270];
const areas=['xingyang','chenggao','gong','huanyuan','goushi','yanshi','luoyang','luoyang'];
const north=['황하 남안 취락','황하 나루','공현 물류 나루','북안 관도 역참','낙수 나루','언사 북쪽 소로','낙양 동쪽 관도'];
const middle=['형양 외곽 관도','성고 검문 관문','공현 성외 취락','공현 서쪽 관도','언사 동쪽 장원','언사 성외 군영','낙양 외곽 시장'];
const south=['형양 남쪽 산길','성고 남쪽 고개','공현 남쪽 산길','환원관 접근로','구씨 북쪽 산길','낙수 도하 군막','낙양 남쪽 나루'];
const ys=[[240,480,770],[225,420,780],[240,470,780],[300,520,850],[330,510,800],[330,480,620],[320,480,640],[420]];
const terrains:Terrain[][]=[['plains','plains','mountain'],['river','fortress','mountain'],['river','plains','mountain'],['plains','plains','mountain'],['river','plains','mountain'],['plains','plains','river'],['plains','plains','river'],['fortress']];
export const SITES:Site[]=centers.flatMap((x,f)=>(f===7?[0]:[0,1,2]).map(c=>({id:`henan:${f}:${c}`,floor:f,col:c,placeId:areas[f],
 name:f===7?'낙양 성외 결전':[north,middle,south][c][f],mapX:x+(c===2?35:c===0?-25:0),mapY:ys[f][c],terrain:terrains[f][c],
 corridor:c===0?'나루·북쪽 우회':c===1?'관도·성곽':'산길·남쪽 우회',adjustment:'역사 지점 자체가 아닌 주변의 창작 활동 거점. 도하점·도로·군막 위치와 8단계 경로는 게임상 재구성.'})));
export const site=(floor:number,col:number)=>SITES.find(s=>s.floor===floor&&s.col===col)!;
export const SCOUT_NAMES=['미탐색','지형 확인','거점 확인','위험 확인','완전 정찰'];

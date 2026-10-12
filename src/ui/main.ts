import {connectIntentArrows} from './battle-arrows.ts';
import {WorldScreen} from './world-screen.ts';
import {newWorldCampaign,bindCampaign,reconcileWorld,retreatWorld,marchWorld} from '../core/world.ts';
import {loadCampaign,importLegacyCampaign} from '../core/campaign-save.ts';
import {explorationOf,exploreAction} from '../core/city-exploration.ts';
import {CityScreen} from './city-screen.ts';
import {newCityCampaign,campaignBattleOutcome} from '../core/city.ts';
import {CITY_DEFS} from '../data/cities.ts';
import './battle-cinematic.css';
import {battleScene} from './battle-scene.ts';
import {configureBattleDemo} from '../core/battle-demo.ts';
import {captureCombat, type CombatEvent} from '../core/combat-events.ts';
import {ExpeditionMap} from './expedition-map.ts';
import {configureRegionalDemo} from '../core/geography.ts';
import './debate-cinematic.css';
import { DebatePlayback, loadSceneSettings, sceneSettingsHtml, attachSceneControls } from './debate-playback.ts';
import {configureDeckDemo} from '../core/debate-deck-demo.ts';
import {deckPreparationHtml} from './debate-deck-view.ts';
import {activityButton} from './html.ts';
import { configureAccordDemo } from '../core/accord-demo.ts';
import { configureBuildDemo } from '../core/build-demo.ts';
import { DOCTRINES, type Direction } from '../core/build.ts';
// 화면 표시 전용. 규칙은 core/ 에만 있고 여기서는 상태를 그리고 사용자 입력을 규칙 함수로 넘긴다.
import './style.css';
import { esc } from './html.ts';
import { chooseDoctrine, GROWTH } from '../core/build.ts';
import { doctrineView, handleSocialAction, relationsHtml, socialView } from './social-view.ts';
import { configureSocialDemo } from '../core/social-run.ts';
import { CARDS } from '../data/cards.ts';
import { EVENTS } from '../data/events.ts';
import { GENERALS } from '../data/generals.ts';
import { LORDS } from '../data/lords.ts';
import { RELICS } from '../data/relics.ts';
import { TERRAINS } from '../data/terrain.ts';
import {
  canPlay,
  cardDef,
  endTurn,
  moveGeneral,
  needsTarget,
  playCard,
  previewBattleState,
  toggleGeneralRow,
} from '../core/combat.ts';
import { describeCard, FAMILY_LABEL, TAG_NAME } from '../core/describe.ts';
import {
  BOSS_FLOOR,
  buyCard,
  buyRelic,
  chooseEvent,
  chooseRecruit,
  deckPick,
  eventOptionAllowed,
  finishBattle,
  leaveNode,
  moveTo,
  newRun,
  newRegionalRun,
  pickRewardCard,
  pickRewardExtra,
  randomSeed,
  recordRunEnd,
  replaceGeneral,
  REST_FOOD,
  restDrill,
  restHeal,
  startMarketRemove,
  supplyChoose,
} from '../core/run.ts';
import { clearRun, loadMeta, loadRun, memoryKV, saveMeta, saveRun, type KV } from '../core/save.ts';
import type { BattleState, CardDef, Difficulty, MetaState, PlayTarget, Row, RunState } from '../core/types.ts';

// ───────────── 상태 ─────────────

let storageFallback = false;
function storage(): KV {
  try {
    const t = '__t';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    storageFallback = true;
    return memoryKV();
  }
}

interface UIState {
  view: 'title' | 'lords' | 'run';
  run: RunState | null;
  meta: MetaState;
  difficulty: Difficulty;
  selected: number | null;
  hover: PlayTarget | null;
  modal: null | 'deck' | 'codex' | 'help' | 'abandon';
  toast: string | null;
  endRecorded: boolean;
  unlockMsgs: string[];
  seedInput: string;
}

const kv = storage();
const loadedRun = loadRun(kv);
const loadedCampaign=loadCampaign(kv);
const devTools=import.meta.env.DEV;
const ui: UIState = {
  view: 'title',
  run: null,
  meta: loadMeta(kv),
  difficulty: 0,
  selected: null,
  hover: null,
  modal: null,
  toast: storageFallback ? '브라우저 저장소를 사용할 수 없어 임시로 진행합니다. 새로고침하면 원정이 사라집니다.' : loadedRun.ok || loadedRun.reason === 'none' ? null : loadedRun.reason === 'version' ? '저장 버전을 변환할 수 없습니다. 새 원정을 시작할 수 있습니다.' : '저장 데이터가 손상되어 불러오지 않았습니다. 새 원정을 시작할 수 있습니다.',
  endRecorded: false,
  unlockMsgs: [],
  seedInput: '',
};
const savedRun: RunState | null = loadedRun.ok ? loadedRun.data : null;

const app = document.getElementById('app')!;
const worldScreen=new WorldScreen(app,()=>ui.run,fn=>runAct(fn),()=>render());
const cityScreen=new CityScreen(app,()=>ui.run,fn=>runAct(fn),()=>render());
const expeditionMap = new ExpeditionMap(app, kv, () => ui.run, () => render(), col => runAct(r => moveTo(r, col)));
const debatePlayback = new DebatePlayback(app, loadSceneSettings(kv, window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false));
attachSceneControls(app, () => ui.run?.pending.kind === 'debate' ? ui.run.pending.state : null, debatePlayback);

let toastTimer = 0;
function toast(msg: string): void {
  ui.toast = msg;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = null;
    render();
  }, 2200);
}

function persist(): void {
  const run = ui.run;
  if (!run) return;
  if(run.campaign){
    if(run.campaign.world){reconcileWorld(run);bindCampaign(run);if(run.screen==='defeat')retreatWorld(run);}
    else if(run.screen==='defeat')campaignBattleOutcome(run,false,0);
    if(!saveRun(kv,run))toast('도시 캠페인을 저장하지 못했습니다. 저장 공간을 확인하세요.');
    return;
  }
  if (run.screen === 'victory' || run.screen === 'defeat') {
    if (!ui.endRecorded) {
      ui.endRecorded = true;
      ui.unlockMsgs = recordRunEnd(ui.meta, run, run.screen === 'victory');
      if (!saveMeta(kv, ui.meta)) toast('기록을 저장하지 못했습니다. 저장 공간이나 브라우저 권한을 확인하세요.');
      clearRun(kv);
    }
    return;
  }
  if (!saveRun(kv, run)) toast('원정을 저장하지 못했습니다. 새로고침 전에 저장 공간이나 브라우저 권한을 확인하세요.');
}

// ───────────── 공용 조각 ─────────────

function cardHtml(d: CardDef, opts: { action?: string; idx?: number; cost?: number; disabled?: boolean; selected?: boolean; big?: boolean; dim?: boolean; quantity?: number } = {}): string {
  const cost = opts.cost ?? d.cost;
  const tag = opts.action ? 'button' : 'div';
  const attrs = opts.action ? ` data-a="${opts.action}" data-i="${opts.idx ?? ''}"${opts.disabled ? ' disabled' : ''}` : '';
  const cls = ['card', d.rarity === 'curse' ? 'curse' : d.family, opts.selected ? 'selected' : '', opts.big ? 'big' : '', opts.dim ? 'dim' : ''].join(' ');
  const tags = d.tags.map((t) => `<span>${TAG_NAME[t]}</span>`).join('') + (d.rarity === 'rare' ? '<span>희귀</span>' : '');
  return `<${tag} class="${cls}"${attrs} title="${esc(describeCard(d))}">
    <span class="cost${cost < d.cost ? ' discount' : ''}">${d.unplayable ? '✕' : cost}</span>
    <span class="cname">${esc(d.name)}</span>
    <span class="fam ${d.family}">${FAMILY_LABEL[d.family]}</span>
    <span class="desc">${esc(describeCard(d))}</span>
    <span class="tags">${tags}</span>
    ${opts.quantity !== undefined ? `<span class="card-quantity">보유 <b>${opts.quantity}장</b></span>` : ''}
  </${tag}>`;
}

/** 도시 탐색 중 공동 호위 전투 머리말. 원정 진군·포기 대신 의뢰 맥락과 전투 병력만 보여 준다(포기는 원정 전체를 끝내므로 숨긴다). */
function escortHud(run: RunState, b: BattleState): string {
  const lord = run.campaign?.world ? run.campaign.world.factionName : LORDS[run.lordId].name;
  return `<div class="campaign-route-label">공동 호위 · 수레가 지나갈 길 · 성문 앞 매복. 전위가 전열에서 수레를 지킵니다. 패배해도 의뢰는 계속되지만 병력 1과 수레 대부분을 잃습니다.</div><div class="hud panel">
    <span class="lord">${esc(lord)}</span>
    <span class="stat"><span class="muted small">호위 병력</span><b>${b.hp}</b><span class="muted">/ ${b.maxHp}</span></span>
    <span class="hpbar"><i style="width:${Math.max(0, (b.hp / b.maxHp) * 100)}%"></i></span>
    <span class="stat"><span class="muted small">군량</span><b>${b.food}</b></span>
    <span class="grow"></span>
    <button class="btn small" data-a="modal" data-m="deck">덱 ${run.deck.length}</button>
    <button class="btn small ghost" data-a="modal" data-m="help">규칙</button>
  </div>`;
}

function hud(run: RunState, b: BattleState | null): string {
  if (run.screen === 'map') return expeditionMap.hud(run);
  const hp = b ? b.hp : run.hp;
  const food = b ? b.food : run.food;
  const lord = run.campaign?.world?{...LORDS[run.lordId],name:run.campaign.world.factionName}:LORDS[run.lordId];
  if(run.pending.kind==='debate') {const state=run.pending.state;return `<div class="hud panel cinematic-hud"><span class="lord">${esc(lord.name)}</span><span>군량 <b>${food}</b></span><span>집중 <b>${state.resolve}</b></span><span>논점 ${state.round}/${state.maxRounds}</span>${state.negotiation?`<span class="hud-tools">정보 ${state.negotiation.reports} · 신용 ${state.negotiation.credentials}</span>`:''}<span class="grow"></span><details class="hud-details"><summary>원정 상세</summary><div class="hud-popup"><p>병력 ${hp}/${run.maxHp} · ${run.floor+1}층</p>${relationsHtml(run)}</div></details><button class="btn small ghost" data-a="modal" data-m="deck">덱</button><button class="btn small ghost" data-a="modal" data-m="help">규칙</button><button class="btn small ghost abandon-control" data-a="modal" data-m="abandon">포기</button></div>`;}

  return `<div class="hud panel">
    <span class="lord">${esc(lord.name)}</span>
    <span class="stat"><span class="muted small">병력</span><b>${hp}</b><span class="muted">/ ${run.maxHp}</span></span>
    <span class="hpbar"><i style="width:${Math.max(0, (hp / run.maxHp) * 100)}%"></i></span>
    <span class="stat"><span class="muted small">군량</span><b>${food}</b></span>
    <span class="stat"><span class="muted small">진군</span><b>${run.campaign?.world?.operation?.index??Math.max(0, run.floor + 1)}</b><span class="muted">/ ${run.campaign?.world?.operation?.route.length??BOSS_FLOOR + 1}</span></span>
    ${run.difficulty ? '<span class="chip danger">험로</span>' : ''}
    <span class="grow"></span>
    ${run.relics.map((r) => `<span class="chip" title="${esc(RELICS[r].text)}">${esc(RELICS[r].name)}</span>`).join('')}
    <button class="btn small" data-a="modal" data-m="deck">덱 ${run.deck.length}</button>
    <button class="btn small ghost" data-a="modal" data-m="help">규칙</button>
    <button class="btn small ghost" data-a="modal" data-m="abandon">포기</button>
  </div>`;
}

// ───────────── 타이틀 / 군주 선택 ─────────────

function titleView(): string {
  const m = ui.meta;
  return `<div class="title-screen"><div>
    <div class="title-mark">천하군진<span class="seal">진</span></div>
    <div class="title-sub">도시에서 거병하고, 인재와 군단을 모아 하남의 패권을 다투는 삼국지 전략</div>
    <div class="title-actions">
      ${savedRun && !ui.run ? `<button class="btn primary" data-a="continue">이어하기 — ${esc(LORDS[savedRun.lordId].name)}, ${savedRun.floor + 1}층</button>` : ''}
      ${loadedCampaign.ok?'<button class="btn primary" data-a="world-continue">천하 캠페인 이어하기</button>':''}
      <button class="btn primary" data-a="world-new">천하 캠페인 시작</button>
      ${loadedCampaign.ok||loadedCampaign.reason==='none'?'':'<p>본편 저장을 읽지 못했습니다. 원본을 보존했습니다. 손상 또는 버전 불일치를 확인하세요.</p>'}
      ${savedRun?.campaign&&!savedRun.campaign.world?'<button class="btn" data-a="world-import">기존 도시 저장을 본편으로 변환</button><p>도시·자원·배치·원정을 보존하며, 구 저장을 삭제하지 않습니다.</p>':''}
      <details><summary>원정 도전 · 짧은 연습</summary><button class="btn" data-a="to-lords">원정 도전 시작</button><p>본편과 저장을 분리한 단일 원정 연습입니다.</p></details>
      <button class="btn" data-a="modal" data-m="codex">도감</button>
      <button class="btn ghost" data-a="modal" data-m="help">규칙 안내</button>
    </div>
    <p class="muted small" style="margin-top:22px">원정 ${m.runs}회 · 승리 ${m.wins}회${m.unlockedGenerals.length ? ` · 해금 장수 ${m.unlockedGenerals.map((g) => GENERALS[g].name).join(', ')}` : ''}</p>
  </div></div>`;
}

function lordsView(): string {
  const diff = ui.meta.difficultyUnlocked >= 1
    ? `<div class="row"><span class="muted">난이도</span>
        <button class="btn small ${ui.difficulty === 0 ? 'primary' : ''}" data-a="diff" data-d="0">평로</button>
        <button class="btn small ${ui.difficulty === 1 ? 'primary' : ''}" data-a="diff" data-d="1">험로 (적 체력 +20%, 시작 군량 -3)</button></div>`
    : '<p class="muted small">첫 승리 시 난이도 「험로」와 새 장수가 해금됩니다.</p>';
  return `<div class="node-screen" style="max-width:980px">
    <div class="row"><h1 class="grow">원정 도전 · 군주 선택</h1><button class="btn ghost" data-a="to-title">돌아가기</button></div>
    ${diff}
    <div class="row small"><label class="muted" for="seed">시드(비우면 무작위)</label>
      <input id="seed" data-input="seed" value="${esc(ui.seedInput)}" inputmode="numeric" style="background:var(--ink-3);border:1px solid var(--line);color:var(--paper);border-radius:6px;padding:4px 8px;width:140px" /></div>
    <div class="lord-grid">
      ${Object.values(LORDS)
        .map(
          (l) => `<button class="lord-card" data-a="pick-lord" data-id="${l.id}">
        <div class="row"><span class="lord-name">${esc(l.name)}</span><span class="lord-title">${esc(l.title)}</span></div>
        <div>${esc(l.rule)}</div>
        <div class="muted small">시작 장수: <b>${esc(GENERALS[l.startGeneral].name)}</b> — ${esc(GENERALS[l.startGeneral].ability)}</div>
        <div class="muted small">시작 덱: ${esc(l.deckNote)}</div>
      </button>`,
        )
        .join('')}
    </div>
    ${devTools?`<div class="row"><button class="btn" data-a="city-campaign">도시 정벌·운영 캠페인 (기본 시드 101001)</button></div><p class="small">형양 → 성고·공현. 기존 단일 원정과 별도 모드. 위의 시드 입력을 사용할 수 있습니다.</p>
    <div class="row"><button class="btn primary" data-a="battle-demo">군진 전투 체험 (91001)</button></div><div class="row"><button class="btn primary" data-a="geography-demo">역사 지리 원정 · 낙양 (81001)</button></div><div class="row"><button class="btn" data-a="deck-debate-demo" data-id="guojia">설전 덱 원정 · 곽가 (61001)</button><button class="btn" data-a="deck-debate-demo" data-id="chengong">설전 덱 원정 · 진궁 (61001)</button></div><button class="btn" data-a="accord-demo">설전·협정 검증 원정 (시드 51001)</button><button class="btn ghost" data-a="social-demo">검증 원정 시작 (시드 31001)</button>
    <div class="row"><button class="btn" data-a="debate-scene-demo" data-id="guojia">설전 무대 검증 · 곽가 (51001)</button><button class="btn" data-a="debate-scene-demo" data-id="chengong">설전 무대 검증 · 진궁 (51001)</button></div>
    <p class="tiny muted">검증용 군량·장수: 1층 무장 대결, 2층 영입 설전, 3~4층 외교. 일반 원정에는 적용하지 않습니다.</p>
    <div class="row">${Object.entries(DOCTRINES).map(([id, d]) => '<button class="btn" data-a="build-demo" data-id="' + id + '">빌드 검증: ' + d.name + '</button>').join('')}</div><p class="tiny">시드 41001 · 세 방향의 동일 지도 비교. 1·3·5층 성장, 4·6층 대결. 보상을 직접 선택합니다.</p>`:''}
  </div>`;
}

// ───────────── 지도 ─────────────

function mapView(run: RunState): string {
  if (run.floor === -1 && !run.build.doctrines.length && !run.history.some(h => h.startsWith('검증 원정:'))) return doctrineView();
  return expeditionMap.view(run);
}

// ───────────── 전투 ─────────────

let battleBusy=false;
let battleFrame:BattleState|null=null;
let battleCurrentEvent:CombatEvent|undefined;
let battleTimer=0;
let battleQueue:CombatEvent[]=[];
function battleView(_run:RunState,b:BattleState):string {
 const settings=debatePlayback.settings;
 return battleScene(battleFrame??b,{selected:ui.selected,target:ui.hover,busy:battleBusy,event:battleCurrentEvent,reduced:settings.reduced,particles:settings.particles,contrast:settings.highContrast,textScale:settings.textSize/100,speed:settings.speed});
}
function skipBattle():void {
 window.clearTimeout(battleTimer);battleQueue=[];battleBusy=false;battleFrame=null;battleCurrentEvent=undefined;render();
 app.querySelector<HTMLElement>('[data-a="card"]')?.focus();
}
function nextBattleEvent():void {
 const event=battleQueue.shift();if(!event){skipBattle();return;}
 battleFrame=event.state;battleCurrentEvent=event;render();
 // Each frame comes from the engine snapshot; timers can never commit an action.
 const delay=debatePlayback.settings.speed==='fast'?65:event.visualPriority===3?440:event.visualPriority===2?260:120;
 battleTimer=window.setTimeout(nextBattleEvent,delay);
}

// ───────────── 노드 화면 ─────────────

function nodeView(run: RunState): string {
  const social = socialView(run);
  if (social !== null) return social;
  const p = run.pending;
  const workshop=run.debateBuild.enabled&&!run.debateBuild.claimed.includes(`deck:${run.floor}:${run.col}`)?deckPreparationHtml(run)+'<label>설전 학습 대표 <select id="social-general">'+run.generals.map(g=>'<option value="'+g.id+'">'+GENERALS[g.id].name+'</option>').join('')+'</select></label>'+activityButton('deck-workshop','서원 학습 · 군량 2로 설전 덱 성장') : '';
  switch (p.kind) {
    case 'reward': {
      const cards = p.cards
        .map((id) => cardHtml(CARDS[id], { action: 'reward-card', idx: p.cards.indexOf(id), disabled: p.picked, big: true }))
        .join('');
      const extra = p.extra
        ? `<div class="panel"><h3>정예 격파 보상 — 보물 하나</h3><div class="choice-grid" style="margin-top:8px">
            ${p.extra.options.map((r) => `<button class="option" data-a="reward-extra" data-id="${r}" ${p.extra!.picked ? 'disabled' : ''}><span class="head">${esc(RELICS[r].name)}</span><span class="small">${esc(RELICS[r].text)}</span></button>`).join('')}
            <button class="option" data-a="reward-extra" data-id="" ${p.extra.picked ? 'disabled' : ''}><span class="head">받지 않음</span></button>
          </div></div>`
        : '';
      const done = p.picked && (!p.extra || p.extra.picked);
      return `<div class="node-screen">
        <h1>전리품</h1>
        <div class="panel"><div>군량 <b>+${p.food}</b> 획득. ${run.lastBattleSummary.map(esc).join(' · ')}</div></div>
        <div class="panel"><div class="row"><h3 class="grow">전법 하나를 덱에 추가</h3><span class="muted small">1장은 현재 장수와 어울리는 카드</span></div>
          <div class="choice-grid" style="margin-top:10px">${cards}</div>
          <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-a="reward-skip" ${p.picked ? 'disabled' : ''}>넘기고 군량 +2 (덱을 가볍게)</button></div>
        </div>
        ${extra}
        <div class="row" style="justify-content:center"><button class="btn primary" data-a="leave" ${done ? '' : 'disabled'}>지도로</button></div>
      </div>`;
    }
    case 'recruit': {
      const opts = p.options
        .map((id) => {
          const d = GENERALS[id];
          return `<button class="option gen-card" data-a="recruit" data-id="${id}">
            <span class="row"><span class="head">${esc(d.name)}</span><span class="chip">${esc(d.faction)}</span><span class="chip">${esc(d.role)}</span></span>
            <span class="small">${esc(d.ability)}</span>
            <span class="tiny muted">약점: ${esc(d.weakness)}</span>
            <span class="tiny muted">어울림: ${esc(d.pairs)}</span>
          </button>`;
        })
        .join('');
      return `<div class="node-screen">
        <h1>인재 등용</h1>
        <p class="story">소문을 듣고 찾아온 장수들이 있다. 진형은 최대 4명(열마다 2명).</p>
        <div class="choice-grid">${opts || '<p class="muted">더 영입할 장수가 없다.</p>'}</div>
        <div class="row" style="justify-content:center"><button class="btn" data-a="recruit" data-id="">사양하고 군량 +3</button></div>
      </div>`;
    }
    case 'replaceGeneral': {
      const inc = GENERALS[p.incoming];
      return `<div class="node-screen">
        <h1>진형이 가득 찼다</h1>
        <p class="story">${esc(inc.name)}(${esc(inc.role)})을(를) 들이려면 한 명을 내보내야 한다.</p>
        <div class="panel small">${esc(inc.ability)}</div>
        <div class="choice-grid">${run.generals.map((g) => `<button class="option gen-card" data-a="replace" data-id="${g.id}"><span class="head">${esc(GENERALS[g.id].name)} 내보내기</span><span class="small">${esc(GENERALS[g.id].ability)}${run.build.growth[g.id] ? '<br>잃는 원정 성장: ' + GROWTH[run.build.growth[g.id].branch].name + ' ' + run.build.growth[g.id].level + '단계' : ''}</span></button>`).join('')}</div>
        <div class="row" style="justify-content:center"><button class="btn" data-a="replace" data-id="">${esc(inc.name)}을(를) 들이지 않는다</button></div>
      </div>`;
    }
    case 'market': {
      const cards = p.cards
        .map((c, i) => `<div style="display:grid;gap:6px;justify-items:center">${cardHtml(CARDS[c.id], { big: true })}<button class="btn small" data-a="buy-card" data-i="${i}" ${c.sold || run.food < c.price ? 'disabled' : ''}>${c.sold ? '판매됨' : `군량 ${c.price}`}</button></div>`)
        .join('');
      const relic = p.relic
        ? `<button class="option" data-a="buy-relic" ${p.relic.sold || run.food < p.relic.price ? 'disabled' : ''}><span class="head">${esc(RELICS[p.relic.id].name)} — 군량 ${p.relic.price}</span><span class="small">${esc(RELICS[p.relic.id].text)}</span>${p.relic.sold ? '<span class="chip">판매됨</span>' : ''}</button>`
        : '';
      return `<div class="node-screen">
        <h1>시장</h1>
        <p class="muted">군량이 곧 돈이다. 남은 군량 <b>${run.food}</b> — 다음 이동에도 군량이 든다.</p>
        <div class="choice-grid">${cards}</div>
        <div class="choice-grid">${relic}
          <button class="option" data-a="market-remove" ${p.removed || run.food < p.removePrice ? 'disabled' : ''}><span class="head">전법 1장 제거 — 군량 ${p.removePrice}</span><span class="small">덱을 가볍게 해 핵심 카드를 더 자주 뽑는다</span></button></div>
        <div class="row" style="justify-content:center"><button class="btn primary" data-a="leave">떠난다</button></div>
      </div>`;
    }
    case 'rest':
      return `<div class="node-screen">
        ${workshop}<h1>휴식과 재편</h1>
        <p class="story">강가에 진을 치고 하룻밤 쉬어 간다.</p>
        <div class="choice-grid">
          <button class="option" data-a="rest-heal" ${run.food < REST_FOOD ? 'disabled' : ''}><span class="head">휴식</span><span class="small">군량 ${REST_FOOD} 소비, 병력 ${Math.ceil(run.maxHp * 0.3)} 회복</span></button>
          <button class="option" data-a="rest-drill"><span class="head">조련</span><span class="small">덱에서 카드 1장 제거 (무료)</span></button>
        </div>
      </div>`;
    case 'supply':
      return `<div class="node-screen">
        ${workshop}<h1>보급 거점</h1>
        <p class="story">아군 보급대와 만났다. 수레 하나를 고른다.</p>
        <div class="choice-grid">
          <button class="option" data-a="supply" data-c="food"><span class="head">군량 수레</span><span class="small">군량 +6</span></button>
          <button class="option" data-a="supply" data-c="hp"><span class="head">의약·증원</span><span class="small">병력 +12</span></button>
          <button class="option" data-a="social-action" data-kind="supply-parley"><span class="head">간이 교섭으로 보급 협상</span><span class="small">기본 군량 +6 / 도전 비용 1 / 성공 +9·부분 성공 군량 +5·병력 +6·실패 군량 +4. 조건 확인 후 수락.</span></button>
        </div>
      </div>`;
    case 'event': {
      const ev = EVENTS[p.eventId];
      const opts = ev.options
        .map((o, i) => {
          const ok = eventOptionAllowed(run, ev.id, i);
          return `<button class="option" data-a="event" data-i="${i}" ${ok && !p.resultText ? '' : 'disabled'}><span class="head">${esc(o.text)}</span><span class="small">${esc(o.detail)}</span></button>`;
        })
        .join('');
      return `<div class="node-screen">
        <div class="row"><h1 class="grow">${esc(ev.title)}</h1><span class="chip">${esc(ev.note)}</span></div>
        <p class="story">${esc(ev.body)}</p>
        <div class="choice-grid" style="justify-content:flex-start">${opts}</div>
        ${p.resultText ? `<div class="panel story">${esc(p.resultText)}</div><div class="row" style="justify-content:center"><button class="btn primary" data-a="leave">계속</button></div>` : ''}
      </div>`;
    }
    case 'deckPick': {
      const cards = run.deck
        .map((c) => cardHtml(CARDS[c.id], { action: 'deck-pick', idx: c.uid }))
        .join('');
      return `<div class="node-screen" style="max-width:1100px">
        <h1>${p.mode === 'remove' ? '제거할 전법' : '복제할 전법'}을 고르세요</h1>
        ${p.cost ? `<p class="muted">비용: 군량 ${p.cost}</p>` : ''}
        <div class="deck-grid">${cards}</div>
        <div class="row" style="justify-content:center"><button class="btn" data-a="deck-pick" data-i="">그만둔다</button></div>
      </div>`;
    }
    case 'none':
      return `<div class="node-screen"><button class="btn primary" data-a="leave">지도로</button></div>`;
  }
  return '';
}

function endView(run: RunState): string {
  const won = run.screen === 'victory';
  return `<div class="end-screen">
    <div class="big">${won ? '낙양 입성' : '원정 실패'}</div>
    <p class="story">${won ? '동탁을 몰아내고 낙양에 군기를 세웠다. (가상 전개)' : '군세가 흩어졌다. 그러나 다음 원정의 교훈이 남았다.'}</p>
    ${!won ? `<div class="panel" style="max-width:640px"><h3>패배 원인</h3><ul class="small">${run.defeatReason.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
    <div class="panel" style="max-width:640px">
      <div>군주 ${esc(LORDS[run.lordId].name)} · 도달 ${run.floor + 1}/${BOSS_FLOOR + 1} · 덱 ${run.deck.length}장</div>
      <div class="small muted">군단: ${run.generals.map((g) => GENERALS[g.id].name).join(', ')} · 보물: ${run.relics.map((r) => RELICS[r].name).join(', ') || '없음'}</div>
      <div class="tiny muted">시드 ${run.seed} — 같은 시드로 같은 지도와 보상을 다시 겪을 수 있습니다.</div>
    </div>
    ${ui.unlockMsgs.length ? `<div class="panel" style="border-color:var(--gold)">${ui.unlockMsgs.map((m) => `<div style="color:var(--gold)">★ ${esc(m)}</div>`).join('')}</div>` : ''}
    <div class="row"><button class="btn primary" data-a="to-lords">새 원정</button><button class="btn" data-a="to-title">처음으로</button></div>
  </div>`;
}

// ───────────── 모달 ─────────────

function modalView(): string {
  if (!ui.modal) return '';
  let body = '';
  if (ui.modal === 'deck' && ui.run) {
    const counts = new Map<string, number>();
    for (const c of ui.run.deck) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    body = `<h2>덱 · 총 ${ui.run.deck.length}장 · ${counts.size}종류</h2>
      <p class="muted small">같은 카드는 한 칸에 모아 표시합니다. 카드 아래의 ‘보유’는 덱에 들어 있는 카드 수량입니다.</p>
      ${ui.run.battle ? `<p class="muted small">이번 전투: 뽑을 더미 ${ui.run.battle.draw.length} · 손패 ${ui.run.battle.hand.length} · 버림 ${ui.run.battle.discard.length} · 소멸 ${ui.run.battle.exhausted.length}</p>` : ''}
      <div class="deck-grid deck-inventory">${[...counts.entries()].map(([id, n]) => cardHtml(CARDS[id], { quantity: n })).join('')}</div>`;
  } else if (ui.modal === 'codex') {
    const unlocked = new Set(ui.meta.unlockedGenerals);
    body = `<h2>도감</h2><h3 style="margin:10px 0 6px">장수</h3><div class="gen-list">
      ${Object.values(GENERALS)
        .map((d) => {
          const locked = d.unlock && !unlocked.has(d.id);
          const seen = ui.meta.seenGenerals.includes(d.id);
          return `<div class="gen${locked ? ' off' : ''}"><div class="row"><span class="name">${esc(d.name)}</span><span class="chip">${esc(d.faction)}</span><span class="chip">${esc(d.role)}</span>${locked ? '<span class="chip warn">첫 승리 시 해금</span>' : ''}${seen ? '<span class="chip ok">함께 싸움</span>' : ''}${d.starterOnly ? '<span class="chip">군주 시작 장수</span>' : ''}</div>
          <div class="ability">${esc(d.ability)}</div><div class="tiny muted">약점: ${esc(d.weakness)} · 어울림: ${esc(d.pairs)}</div></div>`;
        })
        .join('')}</div>
      <h3 style="margin:14px 0 6px">전법</h3><div class="deck-grid">${Object.values(CARDS).map((c) => cardHtml(c)).join('')}</div>
      <h3 style="margin:14px 0 6px">보물</h3>${Object.values(RELICS).map((r) => `<div class="small"><b>${esc(r.name)}</b> — ${esc(r.text)}</div>`).join('')}
      <p class="tiny muted" style="margin-top:12px">인물의 성격과 능력은 게임적 해석이며 역사 고증이 아닙니다.</p>`;
  } else if (ui.modal === 'help') {
    body = `<h2>규칙 안내</h2><div class="small" style="display:grid;gap:8px">
      <p><b>간이 겨루기</b>(원정, 기존 규칙) — 지정 편성에서 원정당 최대 2회 제안. 4회 행동, 상대 다음 행동 공개. 승리 방비6·무승부 방비2·패배/기권 첫 턴 지휘력-1. 거절 무료.</p>
      <p><b>간이 교섭</b>(원정, 기존 규칙) — 대표의 적성·특성으로 관심사에 대응. 군량1을 지불해 4회 논의. 합의10·신뢰2면 성공, 합의6·신뢰1이면 부분 성공. 결과 뒤 조건 수락·포기 가능.</p>
      <p><b>외교</b> — 관계는 원정 안에서만 유지. 장소당 거래1회·간이 교섭1회. 통행 협정은 이동 비용을 줄이고, 지원은 다음 전투에 1회 적용. 거래 화면에서 비용·기간·관계·보상 포기를 확인.</p>
      <p><b>간이 겨루기</b>(원정, 기존 규칙) — 지정 편성에서 원정당 최대 2회 제안. 4회 행동, 상대 다음 행동 공개. 승리 방비6·무승부 방비2·패배/기권 첫 턴 지휘력-1. 거절 무료.</p>
      <p><b>간이 교섭</b>(원정, 기존 규칙) — 대표의 적성·특성으로 관심사에 대응. 군량1로 4회 논의. 합의10·신뢰2면 성공, 합의6·신뢰1이면 부분 성공. 결과 뒤 조건 수락·포기 가능.</p>
      <p><b>외교</b> — 관계는 원정 안에서만 유지. 장소당 거래1회·간이 교섭1회. 통행 협정은 이동 비용을 줄이고, 지원은 다음 전투에 1회 적용. 거래 화면에서 비용·기간·관계·보상 포기를 확인.</p>
      <p><b>목표</b> — 8층 지도를 거쳐 낙양의 동탁을 쓰러뜨린다. 병력이 0이 되면 원정 실패.</p>
      <p><b>병력·군량</b> — 병력은 원정 내내 이어지는 체력. 군량은 이동(산길 2), 휴식, 시장, 징발에 쓰는 유일한 원정 자원.</p>
      <p><b>전투</b> — 매 턴 지휘력 3, 카드 5장. 공격·방어·계책 전법을 쓴다. 한 턴에 카드를 쓸 때마다 <b>기세</b>가 1 오르고 턴마다 초기화된다.</p>
      <p><b>전열과 후열</b> — 적은 의도에 표시된 열을 공격한다. 방비는 열마다 따로 쌓인다. 후열이 실제 피해를 받으면 다음 턴 후열 장수가 동요(능력 정지)한다.</p>
      <p><b>장수</b> — 최대 4명(열마다 2명). 장수는 카드가 아니라 항상 전장에 있는 능력이다. 능력마다 작동하는 열이 있다. 지도에서는 무료로, 전투 중에는 지휘력 1로 열을 바꾼다.</p>
      <p><b>적 턴 순서</b> — 왼쪽 적부터: 방비 소멸 → 화상 피해(방비 무시) 후 화상 1 감소 → 혼란이면 행동 취소 → 의도 실행 → 반격.</p>
      <p><b>카드 처리 순서</b> — 지휘력 지불 → 기세 +1 → 효과를 적힌 순서대로 → 장수 능력(전열→후열) → 군주 규칙. 대상이 이미 쓰러졌으면 그 효과는 무효(로그에 표시).</p>
      <p><b>피해 계산</b> — 기본 + 가산(정보·연노 기계·진궁·평야/서량마 기병) → 배수(무장 대결·추격) → 적 방비 → 체력. 모든 계산식은 전투 기록에 남는다.</p>
      <p><b>지형</b> — ${Object.values(TERRAINS).map((t) => `${esc(t.name)}: ${esc(t.rules.join(', '))}`).join(' / ')}</p>
    </div>`;
  } else if (ui.modal === 'abandon') {
    body = `<h2>원정을 포기할까요?</h2><p>이번 원정의 덱·장수·자원은 사라집니다.</p>
      <div class="row"><button class="btn primary" data-a="abandon">포기한다</button><button class="btn" data-a="close-modal">계속한다</button></div>`;
  }
  return `<div class="overlay" data-a="close-modal-bg"><div class="modal" data-stop="1">${body}
    ${ui.modal !== 'abandon' ? '<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-a="close-modal">닫기</button></div>' : ''}</div></div>`;
}

// ───────────── 렌더 ─────────────

function render(): void {
  let html = '';
  if (ui.view === 'title') html = titleView();
  else if (ui.view === 'lords') html = lordsView();
  else if (ui.run) {
    const run = ui.run;
    // 도시 탐색 중 공동 호위 전투는 도시·전도 화면 대신 기존 군진 전투 화면으로 그린다.
    const escortFight=run.screen==='battle'&&!!run.battle&&explorationOf(run)?.inn?.activity?.kind==='battle';
    const world=escortFight?null:worldScreen.view(run);
    const city=world===null&&!escortFight?cityScreen.view(run):null;
    if(world!==null)html=world;
    else if(city!==null)html=(run.campaign?.world?'<button class="btn world-back" data-world="map">전도로 돌아가기</button>':'')+city;
    else if (run.screen === 'victory' || run.screen === 'defeat') html = endView(run);
    else {
      html = escortFight ? escortHud(run, run.battle!) : hud(run, run.battle);
      if(run.campaign&&!escortFight)html=`<div class="campaign-route-label">${run.campaign.world?esc(run.campaign.world.factionName)+" · "+run.campaign.world.turn+"턴":"구 도시 캠페인"} · 정벌 목표 ${CITY_DEFS[run.campaign.target].name} · 점령 ${run.campaign.captured.length}/3 · 성외 활동 후 성문에서 접근·정벌 방식을 결정합니다.</div>`+html;
      if (run.screen === 'map') html += mapView(run);
      else if (run.screen === 'battle' && run.battle) html += battleView(run, run.battle);
      else html += nodeView(run);
    }
  }
  html += modalView();
  if (ui.toast) html += `<div class="toast">${esc(ui.toast)}</div>`;
  debatePlayback.cancel();
  app.innerHTML = html;
  redrawBattleArrows();
  if (ui.run?.pending.kind === 'debate' && ui.view === 'run') {
    app.querySelector('.scene-utilities')?.insertAdjacentHTML('beforeend', sceneSettingsHtml(debatePlayback.settings) + '<button class="btn small skip-control" data-skip-debate>연출 건너뛰기</button>');
    debatePlayback.applySettings();
  }
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
}

function redrawBattleArrows():void {
 const b=battleFrame??ui.run?.battle;if(!b||ui.run?.screen!=='battle')return;const c=ui.selected===null?null:b.hand[ui.selected];const target=ui.hover??(c&&needsTarget(cardDef(c))===null?{}:null);const shown=c&&target?previewBattleState(b,ui.selected!,target):null;connectIntentArrows(app,shown??b);
}
window.addEventListener('resize',redrawBattleArrows);
function refreshPreview():void {
 const b=ui.run?.battle;if(!b||battleBusy)return;
 const focused=app.querySelector<HTMLElement>(':focus');const selector=focused?.dataset.uid?`[data-uid="${focused.dataset.uid}"]`:focused?.dataset.row?`[data-row="${focused.dataset.row}"]`:null;
 const old=app.querySelector('.cinematic-battle');if(old)old.outerHTML=battleView(ui.run!,b);
 redrawBattleArrows();if(selector)app.querySelector<HTMLElement>(selector)?.focus();
}

// ───────────── 입력 ─────────────

function battleAct(fn: (b: BattleState) => { ok: boolean; reason?: string } | void): void {
 const b=ui.run?.battle;if(!b||battleBusy)return;
 const {result,events}=captureCombat(b,()=>fn(b));
 if(result&&!result.ok&&result.reason)toast(result.reason);
 ui.hover=null;ui.selected=null;
 // The entire rules transaction is saved before the first presentation frame.
 persist();
 const durable=ui.run?.campaign?.world?(()=>{const s=loadCampaign(kv);return s.ok&&JSON.stringify(s.data.activeExpedition!.battle)===JSON.stringify(b);})():(()=>{const s=loadRun(kv);return s.ok&&JSON.stringify(s.data.battle)===JSON.stringify(b);})();
 if(!durable||debatePlayback.settings.reduced||debatePlayback.settings.speed==='instant'||!events.length){render();return;}
 battleBusy=true;battleQueue=events;nextBattleEvent();
}

function clickCard(i: number): void {
  const b = ui.run?.battle;
  if (!b || b.result !== 'ongoing'||battleBusy) return;
  const c = b.hand[i];
  if (!c) return;
  const d = cardDef(c);
  const chk = canPlay(b, i);
  if (!chk.ok) {
    toast(`${d.name}: ${chk.reason}`);
    ui.selected = null;
    render();
    return;
  }
  if (ui.selected === i) {
    if (needsTarget(d) === null) {
      ui.selected = null;
      battleAct((bb) => playCard(bb, i, {}));
    } else toast(needsTarget(d) === 'enemy' ? '대상 적을 누르세요' : '열(전열/후열)을 누르세요');
    return;
  }
  ui.selected = i;
  ui.hover = null;
  render();
}

function runAct(fn: (run: RunState) => { ok: boolean; reason?: string } | void): void {
  const run = ui.run;
  if (!run) return;
  const r = fn(run);
  if (r && !r.ok && r.reason) toast(r.reason);
  persist();
  render();
}

function startRun(lordId: string): void {
  const seedNum = ui.seedInput.trim() ? Number(ui.seedInput.replace(/\D/g, '')) || 1 : randomSeed();
  ui.run = newRegionalRun(seedNum, lordId, ui.difficulty, ui.meta.unlockedGenerals);
  ui.view = 'run';
  ui.endRecorded = false;
  ui.unlockMsgs = [];
  ui.selected = null;
  persist();
  render();
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]');
  if (!el) return;
  if (el.dataset.a === 'close-modal-bg' && (ev.target as HTMLElement).closest('[data-stop]')) return;
  const a = el.dataset.a!;
  if(a==='skip-battle'){skipBattle();return;}
  if(battleBusy){toast('연출 중입니다. 건너뛰기로 즉시 계속할 수 있습니다.');return;}
  const i = Number(el.dataset.i);
  const id = el.dataset.id ?? '';
  switch (a) {
    case 'world-new': ui.run=newWorldCampaign().activeExpedition!;ui.view='run';ui.endRecorded=false;ui.modal=null;persist();render();return;
    case 'world-continue': if(loadedCampaign.ok){ui.run=loadedCampaign.data.activeExpedition!;ui.view='run';bindCampaign(ui.run);}render();return;
    case 'world-import': if(savedRun){const converted=importLegacyCampaign(kv,savedRun);if(converted.ok){ui.run=converted.data.activeExpedition!;ui.view='run';}else toast('안전한 변환을 확인할 수 없습니다. 기존 저장의 이어하기를 사용하세요. 원본은 보존했습니다.');}render();return;
    case 'city-campaign':
      ui.run=newCityCampaign(ui.seedInput.trim()?Number(ui.seedInput.replace(/\D/g,''))||101001:101001);ui.view='run';ui.endRecorded=false;ui.unlockMsgs=[];ui.selected=null;persist();render();return;
    case 'doctrine': runAct(r => chooseDoctrine(r, id)); return;
    case 'social-action': {
      const general = document.querySelector<HTMLSelectElement>('#social-general')?.value ?? '';
      const run = ui.run; if (!run) return;
      const kind = el.dataset.kind ?? '', choice = el.dataset.choice ?? '';
      const check = handleSocialAction(run, kind, general, choice, Number(el.dataset.round), ['#tactic-one', '#tactic-two'].map(q => document.querySelector<HTMLSelectElement>(q)?.value ?? '').filter(Boolean));
      if (!check.ok && check.reason) toast(check.reason);
      persist(); render();
      if (check.ok && kind === 'debate-action' && run.pending.kind === 'debate') {
        void debatePlayback.play(check.events ?? [], structuredClone(run.pending.state), choice);
        const focus = app.querySelector<HTMLElement>('[data-hand-focus]') ?? app.querySelector<HTMLElement>('[data-kind="finish-debate"]');
        focus?.focus();
      }
      return;
    }
    case 'battle-demo':
      ui.run=newRun(91001,'caocao');configureBattleDemo(ui.run);ui.view='run';ui.endRecorded=false;ui.unlockMsgs=[];ui.selected=null;persist();render();return;
    case 'inspect-enemy':
      toast('전법을 먼저 선택하면 유효한 적 대상과 결과를 확인할 수 있습니다.');return;
    case 'execute-card': {
      const b=ui.run?.battle,sel=ui.selected;if(!b||sel===null)return;const d=cardDef(b.hand[sel]);
      if(needsTarget(d)!==null&&!ui.hover){toast('목표를 먼저 선택하세요.');return;}
      battleAct(bb=>playCard(bb,sel,ui.hover??{}));return;
    }
    case 'geography-demo':
      ui.run=newRegionalRun(81001,'caocao');configureRegionalDemo(ui.run);ui.view='run';ui.endRecorded=false;ui.unlockMsgs=[];ui.selected=null;persist();render();return;
    case 'deck-debate-demo':
      if(!['guojia','chengong'].includes(id))return;
      ui.run=newRun(61001,'caocao');configureDeckDemo(ui.run,id);ui.view='run';ui.endRecorded=false;ui.unlockMsgs=[];ui.selected=null;persist();render();return;
    case 'accord-demo':
      ui.run = newRun(51001, 'caocao'); configureAccordDemo(ui.run); ui.view = 'run'; ui.endRecorded = false; ui.unlockMsgs = []; ui.selected = null; persist(); render(); return;
    case 'debate-scene-demo':
      if (!['guojia','chengong'].includes(id)) return;
      ui.run = newRun(51001, 'caocao'); configureAccordDemo(ui.run);
      ui.run.generals = [{id:'dianwei',row:'front'},{id,row:'rear'}];
      ui.view = 'run'; ui.endRecorded = false; ui.unlockMsgs = []; ui.selected = null; persist(); render(); return;
    case 'build-demo':
      ui.run = newRun(41001, 'caocao'); configureBuildDemo(ui.run, id as Direction);
      ui.view = 'run'; ui.endRecorded = false; ui.unlockMsgs = []; ui.selected = null; persist(); render(); return;
    case 'social-demo':
      ui.run = newRun(31001, 'caocao');
      configureSocialDemo(ui.run);
      ui.view = 'run'; ui.endRecorded = false; ui.unlockMsgs = []; ui.selected = null;
      persist(); render(); return;
    case 'continue':
      if (savedRun) {
        ui.run = savedRun;
        ui.view = 'run';
        ui.endRecorded = false;
      }
      break;
    case 'to-lords':
      ui.view = 'lords';
      ui.run = null;
      break;
    case 'to-title':
      ui.view = 'title';
      ui.run = null;
      location.reload();
      return;
    case 'diff':
      ui.difficulty = Number(el.dataset.d) as Difficulty;
      break;
    case 'pick-lord':
      startRun(id);
      return;
    case 'modal':
      ui.modal = el.dataset.m as UIState['modal'];
      break;
    case 'close-modal':
    case 'close-modal-bg':
      ui.modal = null;
      break;
    case 'abandon':
      if (ui.run && explorationOf(ui.run)?.inn?.activity?.kind === 'battle') { ui.modal = null; toast('공동 호위 전투 중에는 원정을 포기할 수 없습니다. 전투를 끝내면 도시로 돌아갑니다.'); return; }
      if (ui.run) {
        ui.run.screen = 'defeat';
        ui.run.defeatReason = ['원정을 스스로 포기했다.'];
        ui.run.battle = null;
      }
      if(ui.run?.campaign?.world){retreatWorld(ui.run);}
      ui.modal = null;
      persist();
      break;
    case 'move':
      ui.selected = null;
      runAct((r) => r.campaign?.world?marchWorld(r,Number(el.dataset.col)):moveTo(r, Number(el.dataset.col)));
      return;
    case 'map-swap':
      runAct((r) => {
        toggleGeneralRow(r.generals, i);
      });
      return;
    case 'card':
      clickCard(i);
      return;
    case 'deselect':
      ui.selected = null;
      ui.hover = null;
      break;
    case 'target-enemy': {
      if(window.innerWidth<=700&&ui.selected!==null){ui.hover={enemy:Number(el.dataset.uid)};refreshPreview();return;}
      const sel = ui.selected;
      if (sel === null) return;
      ui.selected = null;
      battleAct((b) => playCard(b, sel, { enemy: Number(el.dataset.uid) }));
      return;
    }
    case 'target-row': {
      if(window.innerWidth<=700&&ui.selected!==null){ui.hover={row:el.dataset.row as Row};refreshPreview();return;}
      const sel = ui.selected;
      if (sel === null) return;
      ui.selected = null;
      battleAct((b) => playCard(b, sel, { row: el.dataset.row as Row }));
      return;
    }
    case 'battle-swap':
      ui.selected = null;
      battleAct((b) => moveGeneral(b, i));
      return;
    case 'end-turn':
      ui.selected = null;
      battleAct((b) => endTurn(b));
      return;
    case 'finish-battle':
      ui.selected = null;
      runAct((r) => { const x = explorationOf(r); return x?.inn?.activity?.kind === 'battle' ? exploreAction(r, 'finish-escort-battle', x.revision) : finishBattle(r); });
      return;
    case 'reward-card':
      runAct((r) => (r.pending.kind === 'reward' ? pickRewardCard(r, r.pending.cards[i]) : undefined));
      return;
    case 'reward-skip':
      runAct((r) => pickRewardCard(r, null));
      return;
    case 'reward-extra':
      runAct((r) => pickRewardExtra(r, id || null));
      return;
    case 'leave':
      runAct((r) => leaveNode(r));
      return;
    case 'recruit':
      runAct((r) => chooseRecruit(r, id || null));
      return;
    case 'replace':
      runAct((r) => replaceGeneral(r, id || null));
      return;
    case 'buy-card':
      runAct((r) => buyCard(r, i));
      return;
    case 'buy-relic':
      runAct((r) => buyRelic(r));
      return;
    case 'market-remove':
      runAct((r) => startMarketRemove(r));
      return;
    case 'rest-heal':
      runAct((r) => restHeal(r));
      return;
    case 'rest-drill':
      runAct((r) => restDrill(r));
      return;
    case 'supply':
      runAct((r) => supplyChoose(r, el.dataset.c as 'food' | 'hp'));
      return;
    case 'event':
      runAct((r) => chooseEvent(r, i));
      return;
    case 'deck-pick':
      runAct((r) => deckPick(r, el.dataset.i ? i : null));
      return;
  }
  render();
});

app.addEventListener('mouseover', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-hover-enemy],[data-hover-row]');
  const b = ui.run?.battle;
  if (!b || ui.selected === null||battleBusy) return;
  const next: PlayTarget | null = el
    ? el.dataset.hoverEnemy
      ? { enemy: Number(el.dataset.hoverEnemy) }
      : { row: el.dataset.hoverRow as Row }
    : null;
  const same = JSON.stringify(next) === JSON.stringify(ui.hover);
  if (same) return;
  ui.hover = next;
  refreshPreview();
});

app.addEventListener('change',ev=>{
 const el=ev.target as HTMLInputElement;if(el.dataset.battleLog){app.querySelectorAll<HTMLElement>('[data-log-kind]').forEach(x=>x.hidden=el.value!=='all'&&el.value!==x.dataset.logKind);return;}
 const key=el.dataset.battleSetting;if(!key)return;
 const settings=debatePlayback.settings;if(key==='reduced'||key==='particles'||key==='highContrast')settings[key]=el.checked;else if(key==='speed'&&['normal','fast','instant'].includes(el.value))settings.speed=el.value as 'normal'|'fast'|'instant';else if(key==='textSize')settings.textSize=Math.max(100,Math.min(150,Number(el.value)));
 try{kv.setItem('cheonha-gunjin.presentation',JSON.stringify(settings));}catch{toast('화면 설정 저장 실패');}
 if(battleBusy&&(settings.reduced||settings.speed==='instant'))skipBattle();else render();
});
app.addEventListener('error',ev=>{const el=ev.target as HTMLImageElement;if(el.matches?.('[data-battle-portrait],[data-battle-background],[data-city-portrait]')){el.remove();}},true);
app.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.input === 'seed') ui.seedInput = el.value;
});

window.addEventListener('keydown', (ev) => {
  if(['INPUT','SELECT','TEXTAREA'].includes((ev.target as HTMLElement).tagName))return;
  if(battleBusy){if(ev.key==='Escape'){ev.preventDefault();skipBattle();}return;}
  const b = ui.run?.battle;
  if (ev.key === 'Escape') {
    if (ui.modal) ui.modal = null;
    else {
      ui.selected = null;
      ui.hover = null;
    }
    render();
    return;
  }
  if (!b || b.result !== 'ongoing' || ui.modal || ui.run?.screen !== 'battle') return;
  if((ev.key==='ArrowLeft'||ev.key==='ArrowRight')&&ui.selected!==null){
    ev.preventDefault();const type=needsTarget(cardDef(b.hand[ui.selected]));const targets:PlayTarget[]=type==='enemy'?b.enemies.filter(e=>canPlay(b,ui.selected!,{enemy:e.uid}).ok).map(e=>({enemy:e.uid})):type==='row'?[{row:'front'},{row:'rear'}]:[{}];
    if(!targets.length){toast('유효한 목표가 없습니다.');return;}const idx=targets.findIndex(t=>JSON.stringify(t)===JSON.stringify(ui.hover));ui.hover=targets[idx<0?(ev.key==='ArrowRight'?0:targets.length-1):(idx+(ev.key==='ArrowRight'?1:-1)+targets.length)%targets.length];refreshPreview();return;
  }
  if(ev.key==='Enter'&&ui.selected!==null){ev.preventDefault();const idx=ui.selected;const type=needsTarget(cardDef(b.hand[idx]));if(type===null||ui.hover)battleAct(bb=>playCard(bb,idx,ui.hover??{}));else toast('목표를 먼저 고르세요.');return;}
  if (ev.key === 'e' || ev.key === 'E') {
    ui.selected = null;
    battleAct((bb) => endTurn(bb));
  } else if (/^[1-9]$/.test(ev.key)) {
    clickCard(Number(ev.key) - 1);
  }
});

app.addEventListener('contextmenu', (ev) => {
  if (ui.selected !== null) {
    ev.preventDefault();
    ui.selected = null;
    ui.hover = null;
    render();
  }
});

render();

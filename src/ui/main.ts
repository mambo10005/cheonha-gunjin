// 화면 표시 전용. 규칙은 core/ 에만 있고 여기서는 상태를 그리고 사용자 입력을 규칙 함수로 넘긴다.
import './style.css';
import { CARDS } from '../data/cards.ts';
import { ENCOUNTERS, ENEMIES } from '../data/enemies.ts';
import { EVENTS } from '../data/events.ts';
import { GENERALS } from '../data/generals.ts';
import { LORDS } from '../data/lords.ts';
import { RELICS } from '../data/relics.ts';
import { TERRAINS } from '../data/terrain.ts';
import {
  canPlay,
  cardDef,
  effectiveCost,
  endTurn,
  enemyIntentNote,
  generalStatus,
  incomingPreview,
  moveGeneral,
  needsTarget,
  playCard,
  previewPlay,
  swapCost,
  toggleGeneralRow,
} from '../core/combat.ts';
import { describeCard, FAMILY_LABEL, intentText, ROW_NAME, TAG_NAME } from '../core/describe.ts';
import {
  availableMoves,
  BOSS_FLOOR,
  buyCard,
  buyRelic,
  chooseEvent,
  chooseRecruit,
  currentNode,
  deckPick,
  eventOptionAllowed,
  finishBattle,
  leaveNode,
  moveTo,
  newRun,
  NODE_NAME,
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
import type { BattleState, CardDef, Difficulty, GeneralInst, MapNode, MetaState, PlayTarget, Row, RunState } from '../core/types.ts';

// ───────────── 상태 ─────────────

function storage(): KV {
  try {
    const t = '__t';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return localStorage;
  } catch {
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
const ui: UIState = {
  view: 'title',
  run: null,
  meta: loadMeta(kv),
  difficulty: 0,
  selected: null,
  hover: null,
  modal: null,
  toast: loadedRun.ok || loadedRun.reason === 'none' ? null : '이전 저장 데이터가 호환되지 않아 불러오지 않았습니다.',
  endRecorded: false,
  unlockMsgs: [],
  seedInput: '',
};
const savedRun: RunState | null = loadedRun.ok ? loadedRun.data : null;

const app = document.getElementById('app')!;

function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

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
  if (run.screen === 'victory' || run.screen === 'defeat') {
    if (!ui.endRecorded) {
      ui.endRecorded = true;
      ui.unlockMsgs = recordRunEnd(ui.meta, run, run.screen === 'victory');
      saveMeta(kv, ui.meta);
      clearRun(kv);
    }
    return;
  }
  saveRun(kv, run);
}

// ───────────── 공용 조각 ─────────────

function cardHtml(d: CardDef, opts: { action?: string; idx?: number; cost?: number; disabled?: boolean; selected?: boolean; big?: boolean; dim?: boolean; extra?: string } = {}): string {
  const cost = opts.cost ?? d.cost;
  const tag = opts.action ? 'button' : 'div';
  const attrs = opts.action ? ` data-a="${opts.action}" data-i="${opts.idx ?? ''}"${opts.disabled ? ' disabled' : ''}` : '';
  const cls = ['card', d.rarity === 'curse' ? 'curse' : d.family, opts.selected ? 'selected' : '', opts.big ? 'big' : '', opts.dim ? 'dim' : ''].join(' ');
  const tags = d.tags.map((t) => `<span>${TAG_NAME[t]}</span>`).join('') + (d.rarity === 'rare' ? '<span>희귀</span>' : '');
  return `<${tag} class="${cls}"${attrs} title="${esc(describeCard(d))}">
    <span class="cost${cost < d.cost ? ' discount' : ''}">${d.unplayable ? '✕' : cost}</span>
    <span class="cname">${esc(d.name)}</span>
    <span class="fam ${d.family}">${FAMILY_LABEL[d.family]}</span>
    <span class="desc">${esc(describeCard(d))}${opts.extra ?? ''}</span>
    <span class="tags">${tags}</span>
  </${tag}>`;
}

function generalHtml(g: GeneralInst, opts: { status?: string; button?: string } = {}): string {
  const d = GENERALS[g.id];
  const off = opts.status && opts.status !== 'active';
  const statusChip =
    opts.status === 'wrongRow'
      ? `<span class="chip warn">${d.row === 'front' ? '전열' : '후열'}에서만 작동</span>`
      : opts.status === 'shaken'
        ? '<span class="chip danger">동요: 능력 정지</span>'
        : opts.status === 'active'
          ? '<span class="chip ok">작동</span>'
          : '';
  return `<div class="gen${off ? ' off' : ''}">
    <div class="row"><span class="name">${esc(d.name)}</span><span class="chip">${esc(d.faction)}</span><span class="chip">${esc(d.role)}</span>${statusChip}<span class="grow"></span>${opts.button ?? ''}</div>
    <div class="ability">${esc(d.ability)}</div>
  </div>`;
}

function hud(run: RunState, b: BattleState | null): string {
  const hp = b ? b.hp : run.hp;
  const food = b ? b.food : run.food;
  const lord = LORDS[run.lordId];
  return `<div class="hud panel">
    <span class="lord">${esc(lord.name)}</span>
    <span class="stat"><span class="muted small">병력</span><b>${hp}</b><span class="muted">/ ${run.maxHp}</span></span>
    <span class="hpbar"><i style="width:${Math.max(0, (hp / run.maxHp) * 100)}%"></i></span>
    <span class="stat"><span class="muted small">군량</span><b>${food}</b></span>
    <span class="stat"><span class="muted small">진군</span><b>${Math.max(0, run.floor + 1)}</b><span class="muted">/ ${BOSS_FLOOR + 1}</span></span>
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
    <div class="title-mark">천하군진<span class="seal">陣</span></div>
    <div class="title-sub">장수를 모으고, 진형을 짜고, 계책으로 뒤집는 삼국지 원정</div>
    <div class="title-actions">
      ${savedRun && !ui.run ? `<button class="btn primary" data-a="continue">이어하기 — ${esc(LORDS[savedRun.lordId].name)}, ${savedRun.floor + 1}층</button>` : ''}
      <button class="btn ${savedRun ? '' : 'primary'}" data-a="to-lords">새 원정</button>
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
    <div class="row"><h1 class="grow">군주를 고르십시오</h1><button class="btn ghost" data-a="to-title">돌아가기</button></div>
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
  </div>`;
}

// ───────────── 지도 ─────────────

const FLOOR_H = 78;

function mapView(run: RunState): string {
  const reach = new Set(availableMoves(run).map((n) => `${n.floor}:${n.col}`));
  const floors = run.map.slice().reverse();
  const H = floors.length * FLOOR_H;
  const xOf = (n: MapNode) => (n.type === 'boss' ? 150 : (n.col + 0.5) * 100);
  const yOf = (f: number) => (BOSS_FLOOR - f + 0.5) * FLOOR_H;
  let lines = '';
  for (const row of run.map) {
    for (const n of row) {
      if (n.floor >= BOSS_FLOOR) continue;
      for (const c of n.next) {
        const m = run.map[n.floor + 1][c];
        const onPath = n.floor === run.floor && n.col === run.col;
        lines += `<line x1="${xOf(n)}" y1="${yOf(n.floor)}" x2="${xOf(m)}" y2="${yOf(m.floor)}" stroke="${onPath ? '#d6a84a' : '#4a3c2f'}" stroke-width="${onPath ? 2.5 : 1.5}" vector-effect="non-scaling-stroke" stroke-dasharray="${onPath ? '' : '4 4'}"/>`;
      }
    }
  }
  const rows = floors
    .map((row) => {
      const f = row[0].floor;
      const nodes = row
        .map((n) => {
          const key = `${n.floor}:${n.col}`;
          const here = n.floor === run.floor && n.col === run.col;
          const cls = ['node', `type-${n.type}`, reach.has(key) ? 'reach' : '', here ? 'here' : '', n.floor < run.floor ? 'past' : '', n.type === 'boss' ? 'boss' : '', !reach.has(key) && !here ? 'dim' : ''].join(' ');
          const terr = TERRAINS[n.terrain];
          const enc = n.encounterId ? ENCOUNTERS[n.encounterId].name : '';
          const sub = n.type === 'battle' || n.type === 'elite' || n.type === 'boss' ? `${terr.name} · ${enc}` : terr.name;
          const cost = terr.moveCost > 1 ? ` · 군량 ${terr.moveCost}` : '';
          const style = n.type === 'boss' ? 'grid-column: 1 / span 3' : '';
          const tag = reach.has(key) ? 'button' : 'div';
          return `<${tag} class="${cls}" style="${style}" ${reach.has(key) ? `data-a="move" data-col="${n.col}"` : ''} title="${esc(terr.rules.join(' / '))}">
            <span class="t">${esc(NODE_NAME[n.type])}</span><span class="terr">${esc(sub + cost)}</span></${tag}>`;
        })
        .join('');
      return `<div class="map-floor"><span class="floor-label">${f === BOSS_FLOOR ? '결전' : `${f + 1}층`}</span>${nodes}</div>`;
    })
    .join('');
  const map = `<div class="map-wrap" style="padding-left:34px"><div style="position:relative">
    <svg class="map-svg" viewBox="0 0 300 ${H}" preserveAspectRatio="none" style="height:${H}px">${lines}</svg>
    ${rows}
  </div></div>`;
  return `<div class="map-layout">
    <div class="panel">
      <div class="row"><h2 class="grow">원정 지도 — 낙양으로</h2><span class="muted small">빛나는 칸으로 진군 (산길은 군량 2)</span></div>
      ${map}
    </div>
    <div style="display:grid;gap:12px;align-content:start">
      ${armyPanel(run)}
      <div class="panel"><h3>원정 기록</h3><div class="small muted" style="margin-top:6px">${run.history.slice(-7).map((h) => `<div>· ${esc(h)}</div>`).join('')}</div></div>
    </div>
  </div>`;
}

function armyPanel(run: RunState): string {
  const gens = run.generals
    .map((g, i) => {
      const def = GENERALS[g.id];
      const wrong = def.row !== 'any' && def.row !== g.row;
      return generalHtml(g, {
        status: wrong ? 'wrongRow' : 'active',
        button: `<button class="btn small" data-a="map-swap" data-i="${i}">${ROW_NAME[g.row]} → ${ROW_NAME[g.row === 'front' ? 'rear' : 'front']}</button>`,
      });
    })
    .join('');
  return `<div class="panel"><div class="row"><h3 class="grow">군단 (${run.generals.length}/4)</h3><span class="muted tiny">열마다 2명 · 지도에서는 무료 재배치</span></div>
    <div class="gen-list" style="margin-top:8px">${gens}</div></div>`;
}

// ───────────── 전투 ─────────────

function battleView(run: RunState, b: BattleState): string {
  const node = currentNode(run)!;
  const terr = TERRAINS[b.terrain];
  const sel = ui.selected !== null ? b.hand[ui.selected] : null;
  const selDef = sel ? cardDef(sel) : null;
  const tgt = selDef ? needsTarget(selDef) : null;
  const inc = incomingPreview(b);

  const enemies = b.enemies
    .map((e) => {
      const def = ENEMIES[e.defId];
      const targetable = tgt === 'enemy' && !e.dead && canPlay(b, ui.selected!, { enemy: e.uid }).ok;
      const it = e.intent;
      const intentCls = it?.kind === 'attack' ? 'intent' : 'intent nonattack';
      const icon = it?.kind === 'attack' ? '⚔' : it?.kind === 'block' ? '⛨' : it?.kind === 'summon' ? '⚑' : it?.kind === 'cleanse' ? '✦' : '▲';
      const note = enemyIntentNote(e);
      return `<button class="enemy${targetable ? ' targetable' : ''}${e.dead ? ' dead' : ''}" ${targetable ? `data-a="target-enemy" data-uid="${e.uid}" data-hover-enemy="${e.uid}"` : 'disabled'}>
        <div class="row"><span class="ename grow">${esc(e.name)}</span>${def.boss ? '<span class="chip danger">보스</span>' : ''}${e.phase === 2 ? '<span class="chip danger">2단계</span>' : ''}</div>
        <div class="bar"><i style="width:${(Math.max(0, e.hp) / e.maxHp) * 100}%"></i></div>
        <div class="statline small"><span>체력 ${Math.max(0, e.hp)}/${e.maxHp}</span>${e.block ? `<span class="chip">방비 ${e.block}</span>` : ''}${e.str ? `<span class="chip danger">힘 +${e.str}</span>` : ''}${e.burn ? `<span class="chip fire">화상 ${e.burn}</span>` : ''}</div>
        ${e.dead ? '<div class="muted">격파</div>' : `<div class="${intentCls}">${icon} ${esc(intentText(it, it?.kind === 'attack' ? e.str : 0))}</div>`}
        ${note && !e.dead ? `<div class="tiny" style="color:var(--warn)">${esc(note)}</div>` : ''}
        ${def.trait ? `<div class="tiny muted">${esc(def.trait)}</div>` : ''}
      </button>`;
    })
    .join('');

  const rowBox = (r: Row) => {
    const gens = b.generals
      .map((g, i) => ({ g, i }))
      .filter((x) => x.g.row === r)
      .map(({ g, i }) => {
        const cost = swapCost(b);
        return generalHtml(g, {
          status: generalStatus(b, g),
          button: `<button class="btn small" data-a="battle-swap" data-i="${i}" ${b.energy < cost ? 'disabled' : ''} title="다른 열로 이동">이동 ${cost === 0 ? '(무료)' : `(지휘력 ${cost})`}</button>`,
        });
      })
      .join('');
    const targetable = tgt === 'row';
    const n = inc[r];
    return `<div class="rowbox${targetable ? ' targetable' : ''}" ${targetable ? `data-a="target-row" data-row="${r}" data-hover-row="${r}" role="button" tabindex="0"` : ''}>
      <div class="row"><h3 class="grow">${ROW_NAME[r]}</h3>
        <span class="chip">방비 ${b.block[r]}</span>
        ${b.counter[r] ? `<span class="chip ok">반격 +${b.counter[r]}</span>` : ''}
        ${r === 'rear' && b.shakenRear ? '<span class="chip danger">동요</span>' : ''}</div>
      <div class="incoming ${n.net === 0 ? 'safe' : ''}">예상 피해 <b>${n.net}</b> <span class="muted">(공격 ${n.raw} − 방비 ${n.blocked})</span></div>
      <div class="rowgens">${gens || '<span class="muted small">배치된 장수 없음</span>'}</div>
      ${targetable ? `<div class="small" style="color:var(--gold)">여기를 눌러 ${esc(selDef!.name)} 사용</div>` : ''}
    </div>`;
  };

  const hand = b.hand
    .map((c, i) => {
      const d = cardDef(c);
      const ok = canPlay(b, i).ok;
      return cardHtml(d, { action: 'card', idx: i, cost: effectiveCost(b, c), dim: !ok, selected: ui.selected === i });
    })
    .join('');

  const endOverlay =
    b.result !== 'ongoing'
      ? `<div class="overlay"><div class="modal" style="text-align:center">
        <h2 style="font-size:34px">${b.result === 'win' ? '승리' : '패배'}</h2>
        <p>${b.result === 'win' ? `${esc(ENCOUNTERS[b.encounterId].name)}을(를) 물리쳤다.` : '병력이 무너졌다.'}</p>
        <p class="muted small">${b.turn}턴 · 준 피해 ${b.stats.damageDealt} · 받은 피해 전열 ${b.stats.rowTaken.front} / 후열 ${b.stats.rowTaken.rear}</p>
        <button class="btn primary" data-a="finish-battle">${b.result === 'win' ? '전리품 확인' : '결과 보기'}</button>
      </div></div>`
      : '';

  const logHtml = b.log
    .slice(-80)
    .map((l) => `<div class="${l.kind}">${esc(l.text)}</div>`)
    .join('');

  return `<div class="battle">
    <div class="terrain-bar panel"><b style="font-family:var(--serif)">${esc(ENCOUNTERS[b.encounterId].name)}</b>
      <span class="chip">${esc(NODE_NAME[node.type])}</span>
      <span class="chip">지형: ${esc(terr.name)}</span>${terr.rules.filter((r) => !r.startsWith('이동')).map((r) => `<span class="chip">${esc(r)}</span>`).join('')}
      <span class="grow"></span><span class="muted">제 ${b.turn}턴</span></div>
    <div class="enemies">${enemies}</div>
    <div class="formation">${rowBox('front')}${rowBox('rear')}</div>
    <div id="preview">${previewHtml(b)}</div>
    <div class="handbar panel">
      <div style="display:grid;gap:6px;justify-items:center">
        <div class="orb">${b.energy}<small>지휘력</small></div>
        <span class="chip">기세 ${b.momentum}</span>
      </div>
      <div class="hand">${hand || '<span class="muted">손패가 없다</span>'}</div>
      <div class="side-actions">
        <button class="btn primary" data-a="end-turn">턴 종료 <span class="kbd">E</span></button>
        ${ui.selected !== null ? '<button class="btn small" data-a="deselect">선택 취소 <span class="kbd">Esc</span></button>' : ''}
        <div class="pile-info">뽑을 더미 ${b.draw.length} · 버림 ${b.discard.length} · 소멸 ${b.exhausted.length}</div>
      </div>
    </div>
    <div class="battle-bottom">
      <div class="panel small muted">
        <b style="color:var(--paper)">조작</b> · 카드를 누르면 선택, 대상(적 또는 열)을 누르면 사용. 대상이 없는 카드는 한 번 더 누르면 사용. 숫자 키 1~9로 카드 선택.
        <br/>적 의도는 이번 적 턴에 실제로 할 행동입니다. 의도의 대상 열에 방비를 쌓거나, 허보·이간계·교란으로 의도를 바꾸세요.
        <br/>후열이 실제 피해를 받으면 다음 턴 후열 장수가 <b style="color:var(--danger)">동요</b>(능력 정지)합니다.
      </div>
      <div class="log" id="log">${logHtml}</div>
    </div>
    ${endOverlay}
  </div>`;
}

function previewHtml(b: BattleState): string {
  if (ui.selected === null || b.result !== 'ongoing') return '';
  const c = b.hand[ui.selected];
  if (!c) return '';
  const d = cardDef(c);
  const tgt = needsTarget(d);
  const base = canPlay(b, ui.selected);
  if (!base.ok) return `<div class="preview">「${esc(d.name)}」 — <span style="color:var(--danger)">${esc(base.reason ?? '')}</span></div>`;
  let target: PlayTarget | null = null;
  if (tgt === null) target = {};
  else if (ui.hover) target = ui.hover;
  else if (tgt === 'enemy') {
    const valid = b.enemies.filter((e) => !e.dead && canPlay(b, ui.selected!, { enemy: e.uid }).ok);
    if (valid.length === 1) target = { enemy: valid[0].uid };
  }
  if (!target) {
    return `<div class="preview">「${esc(d.name)}」 선택됨 — ${tgt === 'enemy' ? '대상 적을 고르세요 (마우스를 올리면 결과 미리보기)' : '방비를 쌓을 열을 고르세요'}</div>`;
  }
  const pv = previewPlay(b, ui.selected, target);
  if (!pv.ok) return `<div class="preview">「${esc(d.name)}」 — <span style="color:var(--danger)">${esc(pv.reason ?? '')}</span></div>`;
  const diffs: string[] = [];
  for (const e of pv.enemies) {
    const parts: string[] = [];
    if (e.hp[0] !== e.hp[1]) parts.push(`체력 ${e.hp[0]}→${Math.max(0, e.hp[1])}`);
    if (e.block[0] !== e.block[1]) parts.push(`방비 ${e.block[0]}→${e.block[1]}`);
    if (e.burn[0] !== e.burn[1]) parts.push(`화상 ${e.burn[0]}→${e.burn[1]}`);
    if (e.dead) parts.push('<b style="color:var(--gold)">격파</b>');
    if (parts.length) diffs.push(`${esc(e.name)}: ${parts.join(', ')}`);
  }
  const p = pv.player;
  if (p.front[0] !== p.front[1]) diffs.push(`전열 방비 ${p.front[0]}→${p.front[1]}`);
  if (p.rear[0] !== p.rear[1]) diffs.push(`후열 방비 ${p.rear[0]}→${p.rear[1]}`);
  if (p.hp[0] !== p.hp[1]) diffs.push(`병력 ${p.hp[0]}→${p.hp[1]}`);
  const confirm = tgt === null ? ' — <b>한 번 더 누르면 사용</b>' : '';
  const calc = pv.logs.filter((l) => l.includes('→') || l.includes('+') || l.includes(':')).slice(0, 8);
  return `<div class="preview"><b>미리보기 · ${esc(d.name)}</b>${confirm}
    <div>${diffs.length ? diffs.join(' · ') : '<span class="muted">눈에 보이는 변화 없음 (카드 뽑기·기세 등)</span>'}</div>
    <ul class="tiny muted">${calc.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
}

// ───────────── 노드 화면 ─────────────

function nodeView(run: RunState): string {
  const p = run.pending;
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
        <div class="choice-grid">${run.generals.map((g) => `<button class="option gen-card" data-a="replace" data-id="${g.id}"><span class="head">${esc(GENERALS[g.id].name)} 내보내기</span><span class="small">${esc(GENERALS[g.id].ability)}</span></button>`).join('')}</div>
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
        <h1>휴식과 재편</h1>
        <p class="story">강가에 진을 치고 하룻밤 쉬어 간다.</p>
        <div class="choice-grid">
          <button class="option" data-a="rest-heal" ${run.food < REST_FOOD ? 'disabled' : ''}><span class="head">휴식</span><span class="small">군량 ${REST_FOOD} 소비, 병력 ${Math.ceil(run.maxHp * 0.3)} 회복</span></button>
          <button class="option" data-a="rest-drill"><span class="head">조련</span><span class="small">덱에서 카드 1장 제거 (무료)</span></button>
        </div>
      </div>`;
    case 'supply':
      return `<div class="node-screen">
        <h1>보급 거점</h1>
        <p class="story">아군 보급대와 만났다. 수레 하나를 고른다.</p>
        <div class="choice-grid">
          <button class="option" data-a="supply" data-c="food"><span class="head">군량 수레</span><span class="small">군량 +6</span></button>
          <button class="option" data-a="supply" data-c="hp"><span class="head">의약·증원</span><span class="small">병력 +12</span></button>
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
    body = `<h2>덱 (${ui.run.deck.length}장)</h2>
      ${ui.run.battle ? `<p class="muted small">이번 전투: 뽑을 더미 ${ui.run.battle.draw.length} · 손패 ${ui.run.battle.hand.length} · 버림 ${ui.run.battle.discard.length} · 소멸 ${ui.run.battle.exhausted.length}</p>` : ''}
      <div class="deck-grid">${[...counts.entries()].map(([id, n]) => cardHtml(CARDS[id], { extra: n > 1 ? ` <b>×${n}</b>` : '' })).join('')}</div>`;
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
      <p><b>목표</b> — 8층 지도를 거쳐 낙양의 동탁을 쓰러뜨린다. 병력이 0이 되면 원정 실패.</p>
      <p><b>병력·군량</b> — 병력은 원정 내내 이어지는 체력. 군량은 이동(산길 2), 휴식, 시장, 징발에 쓰는 유일한 원정 자원.</p>
      <p><b>전투</b> — 매 턴 지휘력 3, 카드 5장. 武(공격)·防(방어)·策(계책) 전법을 쓴다. 한 턴에 카드를 쓸 때마다 <b>기세</b>가 1 오르고 턴마다 초기화된다.</p>
      <p><b>전열과 후열</b> — 적은 의도에 표시된 열을 공격한다. 방비는 열마다 따로 쌓인다. 후열이 실제 피해를 받으면 다음 턴 후열 장수가 동요(능력 정지)한다.</p>
      <p><b>장수</b> — 최대 4명(열마다 2명). 장수는 카드가 아니라 항상 전장에 있는 능력이다. 능력마다 작동하는 열이 있다. 지도에서는 무료로, 전투 중에는 지휘력 1로 열을 바꾼다.</p>
      <p><b>적 턴 순서</b> — 왼쪽 적부터: 방비 소멸 → 화상 피해(방비 무시) 후 화상 1 감소 → 혼란이면 행동 취소 → 의도 실행 → 반격.</p>
      <p><b>카드 처리 순서</b> — 지휘력 지불 → 기세 +1 → 효과를 적힌 순서대로 → 장수 능력(전열→후열) → 군주 규칙. 대상이 이미 쓰러졌으면 그 효과는 무효(로그에 표시).</p>
      <p><b>피해 계산</b> — 기본 + 가산(정보·연노 기계·진궁·평야/서량마 기병) → 배수(일기토·추격) → 적 방비 → 체력. 모든 계산식은 전투 기록에 남는다.</p>
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
    if (run.screen === 'victory' || run.screen === 'defeat') html = endView(run);
    else {
      html = hud(run, run.battle);
      if (run.screen === 'map') html += mapView(run);
      else if (run.screen === 'battle' && run.battle) html += battleView(run, run.battle);
      else html += nodeView(run);
    }
  }
  html += modalView();
  if (ui.toast) html += `<div class="toast">${esc(ui.toast)}</div>`;
  app.innerHTML = html;
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
}

function refreshPreview(): void {
  const el = document.getElementById('preview');
  const b = ui.run?.battle;
  if (el && b) el.innerHTML = previewHtml(b);
}

// ───────────── 입력 ─────────────

function battleAct(fn: (b: BattleState) => { ok: boolean; reason?: string } | void): void {
  const b = ui.run?.battle;
  if (!b) return;
  const r = fn(b);
  if (r && !r.ok && r.reason) toast(r.reason);
  ui.hover = null;
  persist();
  render();
}

function clickCard(i: number): void {
  const b = ui.run?.battle;
  if (!b || b.result !== 'ongoing') return;
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
  ui.run = newRun(seedNum, lordId, ui.difficulty, ui.meta.unlockedGenerals);
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
  const i = Number(el.dataset.i);
  const id = el.dataset.id ?? '';
  switch (a) {
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
      if (ui.run) {
        ui.run.screen = 'defeat';
        ui.run.defeatReason = ['원정을 스스로 포기했다.'];
        ui.run.battle = null;
      }
      ui.modal = null;
      persist();
      break;
    case 'move':
      ui.selected = null;
      runAct((r) => moveTo(r, Number(el.dataset.col)));
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
      const sel = ui.selected;
      if (sel === null) return;
      ui.selected = null;
      battleAct((b) => playCard(b, sel, { enemy: Number(el.dataset.uid) }));
      return;
    }
    case 'target-row': {
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
      runAct((r) => finishBattle(r));
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
  if (!b || ui.selected === null) return;
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

app.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.input === 'seed') ui.seedInput = el.value;
});

window.addEventListener('keydown', (ev) => {
  if ((ev.target as HTMLElement).tagName === 'INPUT') return;
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import { loadRun, saveRun, RUN_KEY, META_KEY } from '../src/core/save.ts';
import type { RunState } from '../src/core/types.ts';

test('화면 통합: 실제 클릭·저장·이어하기·대결→전투→보상·설전→외교', { timeout: 30000 }, async () => {
  const bundle = await build({ logLevel: 'silent', build: { write: false } });
  const single = Array.isArray(bundle) ? bundle[0] : bundle;
  assert.ok('output' in single);
  const out = single.output;
  const chunk = out.find(o => o.type === 'chunk'); assert.ok(chunk && chunk.type === 'chunk');
  const html = readFileSync('index.html', 'utf8').replace(/<script[^>]+src="\/src\/ui\/main.ts"[^>]*><\/script>/, '');
  const errors: string[] = [];
  function app(saved: Record<string, string> = {}): JSDOM {
    const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', beforeParse(w) {
      w.structuredClone = structuredClone;
      for (const [key, value] of Object.entries(saved)) w.localStorage.setItem(key, value);
      w.addEventListener('error', e => errors.push(String(e.error)));
    } });
    dom.window.eval(chunk!.type === 'chunk' ? chunk!.code : ''); return dom;
  }
  function click(dom: JSDOM, selector: string): void {
    let el = dom.window.document.querySelector<HTMLButtonElement>(selector); if (!el && selector.includes("debate-action")) { const choice = selector.match(/data-choice="([^"]+)"/)?.[1]; dom.window.document.querySelector<HTMLButtonElement>(`[data-debate-select="${choice}"]`)?.click(); el = dom.window.document.querySelector<HTMLButtonElement>(selector); } assert.ok(el, selector); assert.equal(el.disabled, false, selector); el.click();
  }
  function snapshot(dom: JSDOM): Record<string, string> {
    const saved: Record<string, string> = {}; for (const k of [RUN_KEY, META_KEY]) { const v = dom.window.localStorage.getItem(k); if (v) saved[k] = v; } return saved;
  }
  function state(dom: JSDOM): RunState { const r = loadRun(dom.window.localStorage); assert.ok(r.ok); return r.data; }
  function reload(dom: JSDOM): JSDOM { const saved = snapshot(dom); dom.window.close(); const next = app(saved); click(next, '[data-a="continue"]'); return next; }
  let dom = app();
  try {
    click(dom, '[data-a="to-lords"]'); click(dom, '[data-a="social-demo"]');
    click(dom, '[data-a="move"][data-col="0"]'); assert.equal(state(dom).pending.kind, 'duelOffer');
    click(dom, '[data-kind="accept-duel"]'); click(dom, '[data-kind="duel-action"][data-choice="probe"]');
    const beforeReload = state(dom); dom = reload(dom); assert.deepEqual(state(dom), beforeReload);
    for (let i = 0; i < 4 && state(dom).pending.kind === 'duel'; i++) {
      if (dom.window.document.querySelector('[data-kind="finish-duel"]')) { click(dom, '[data-kind="finish-duel"]'); break; }
      click(dom, '[data-kind="duel-action"][data-choice="guard"]');
    }
    if (dom.window.document.querySelector('[data-kind="finish-duel"]')) click(dom, '[data-kind="finish-duel"]');
    const battle = state(dom); assert.ok(battle.battle);
    // 전투 승리 화면은 짧은 고정 상태로 검증. 일반 전투 규칙은 기존 테스트에서 검증.
    for (const e of battle.battle.enemies) e.hp = 1;
    battle.battle.hand = [{ uid: 9999, id: 'ironcav' }]; battle.battle.energy = 3;
    saveRun(dom.window.localStorage, battle); dom = reload(dom);
    click(dom, '[data-a="card"][data-i="0"]'); click(dom, '[data-a="card"][data-i="0"]');
    click(dom, '[data-a="finish-battle"]'); click(dom, '[data-a="reward-skip"]');
    if (dom.window.document.querySelector('[data-a="reward-extra"][data-id=""]')) click(dom, '[data-a="reward-extra"][data-id=""]');
    click(dom, '[data-a="leave"]'); assert.equal(state(dom).screen, 'map');
    click(dom, '[data-a="move"][data-col="0"]');
    const select = dom.window.document.querySelector<HTMLSelectElement>('#social-general')!; select.value = 'guojia';
    click(dom, '[data-kind="begin-debate"]'); click(dom, '[data-kind="debate-action"][data-choice="concede"]');
    const debate = state(dom); dom = reload(dom); assert.deepEqual(state(dom), debate);
    for (let i = 0; i < 3; i++) click(dom, '[data-kind="debate-action"][data-choice="concede"]');
    click(dom, '[data-kind="finish-debate"]'); click(dom, '[data-kind="decline-parley"]'); click(dom, '[data-a="leave"]');
    click(dom, '[data-a="move"][data-col="0"]'); click(dom, '[data-kind="trade"][data-choice="supply"]'); click(dom, '[data-a="leave"]');
    assert.equal(state(dom).social.relations.caravan, 1);
    click(dom, '[data-a="move"][data-col="0"]'); click(dom, '[data-kind="trade"][data-choice="passage"]'); click(dom, '[data-a="leave"]');
    const moves = state(dom).social.passage!.moves; dom = reload(dom); click(dom, '[data-a="move"][data-col="0"]');
    assert.equal(state(dom).social.passage!.moves, moves - 1); assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('새 원정 교리→초반 성장→대결 전술→성장 보상·저장 복원의 실제 화면 입력', { timeout: 30000 }, async () => {
  const bundle = await build({ logLevel: 'silent', build: { write: false } });
  const single = Array.isArray(bundle) ? bundle[0] : bundle; assert.ok('output' in single);
  const chunk = single.output.find(o => o.type === 'chunk'); assert.ok(chunk && chunk.type === 'chunk');
  const html = readFileSync('index.html', 'utf8').replace(/<script[^>]+src="\/src\/ui\/main.ts"[^>]*><\/script>/, '');
  const errors: string[] = [];
  function open(saved?: string): JSDOM {
    const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', beforeParse(w) {
      w.structuredClone = structuredClone; if (saved) w.localStorage.setItem(RUN_KEY, saved);
      w.addEventListener('error', e => errors.push(String(e.error)));
    } }); dom.window.eval(chunk!.type === 'chunk' ? chunk!.code : ''); return dom;
  }
  function click(dom: JSDOM, selector: string): void { let el = dom.window.document.querySelector<HTMLButtonElement>(selector); if (!el && selector.includes("debate-action")) { const choice = selector.match(/data-choice="([^"]+)"/)?.[1]; dom.window.document.querySelector<HTMLButtonElement>(`[data-debate-select="${choice}"]`)?.click(); el = dom.window.document.querySelector<HTMLButtonElement>(selector); } assert.ok(el, selector); assert.equal(el.disabled, false); el.click(); }
  function state(dom: JSDOM): RunState { const r = loadRun(dom.window.localStorage); assert.ok(r.ok); return r.data; }
  let dom = open();
  try {
    click(dom, '[data-a="to-lords"]'); click(dom, '[data-a="pick-lord"][data-id="caocao"]');
    assert.ok(dom.window.document.body.textContent?.includes('원정 교리를 선택')); click(dom, '[data-a="doctrine"][data-id="scheme"]');
    assert.deepEqual(state(dom).build.doctrines, ['scheme']); click(dom, '[data-a="move"][data-col="0"]');
    if (dom.window.document.querySelector('[data-kind="decline-duel"]')) click(dom, '[data-kind="decline-duel"]');
    // Short battle fixture; the rule tests cover its combat chain separately.
    const r = state(dom); assert.ok(r.battle); r.battle.result = 'win'; saveRun(dom.window.localStorage, r);
    let saved = dom.window.localStorage.getItem(RUN_KEY)!; dom.window.close(); dom = open(saved); click(dom, '[data-a="continue"]');
    click(dom, '[data-a="finish-battle"]'); click(dom, '[data-a="reward-skip"]'); click(dom, '[data-a="leave"]');
    assert.equal(state(dom).pending.kind, 'growth'); click(dom, '[data-kind="growth"][data-choice="saboteur"]');
    assert.deepEqual(state(dom).build.growth.dianwei, { branch: 'saboteur', level: 1 });
    const duel = state(dom); duel.floor = 3; duel.col = 0; duel.screen = 'node'; duel.pending = { kind: 'duelOffer', opponentId: 'champion' };
    duel.map[3][0].type = 'elite'; duel.map[3][0].encounterId = 'el_huaxiong'; saveRun(dom.window.localStorage, duel);
    saved = dom.window.localStorage.getItem(RUN_KEY)!; dom.window.close(); dom = open(saved); click(dom, '[data-a="continue"]');
    dom.window.document.querySelector<HTMLSelectElement>('#tactic-one')!.value = 'feint';
    dom.window.document.querySelector<HTMLSelectElement>('#tactic-two')!.value = 'breathe';
    click(dom, '[data-kind="accept-duel"]'); click(dom, '[data-kind="duel-action"][data-choice="feint"]');
    const ongoing = state(dom); saved = dom.window.localStorage.getItem(RUN_KEY)!; dom.window.close(); dom = open(saved); click(dom, '[data-a="continue"]'); assert.deepEqual(state(dom), ongoing);
    assert.ok(ongoing.pending.kind === 'duel'); ongoing.pending.state.result = 'win'; saveRun(dom.window.localStorage, ongoing);
    saved = dom.window.localStorage.getItem(RUN_KEY)!; dom.window.close(); dom = open(saved); click(dom, '[data-a="continue"]');
    click(dom, '[data-kind="duel-reward"][data-choice="growth"]'); click(dom, '[data-kind="growth"][data-choice="saboteur"]');
    assert.equal(state(dom).build.growth.dianwei.level, 2); click(dom, '[data-kind="finish-duel"]'); assert.equal(state(dom).screen, 'battle'); assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

// 저장/불러오기. 버전 필드로 호환성을 판단한다. 저장소는 localStorage와 같은 최소 인터페이스.
import { defaultMeta, RUN_VERSION } from './run.ts';
import {compatibleGeography} from './geography.ts';
import type { MetaState, RunState } from './types.ts';
import { validateAndMigrateRun } from './save-validation.ts';
import { GENERALS } from '../data/generals.ts';
import {saveCampaign} from './campaign-save.ts';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const RUN_KEY = 'cheonha-gunjin.run';
export const META_KEY = 'cheonha-gunjin.meta';
export const META_VERSION = 1;

interface Envelope<T> {
  version: number;
  savedAt: number;
  data: T;
}

export function saveRun(kv: KV, run: RunState, campaignKey?: string): boolean {
  if(run.campaign?.world)return saveCampaign(kv,run,campaignKey);
  const env: Envelope<RunState> = { version: RUN_VERSION, savedAt: Date.now(), data: run };
  try { kv.setItem(RUN_KEY, JSON.stringify(env)); return true; } catch { return false; }
}

export type LoadResult<T> = { ok: true; data: T } | { ok: false; reason: 'none' | 'corrupt' | 'version' };

export function loadRun(kv: KV): LoadResult<RunState> {
  try {
    const raw = kv.getItem(RUN_KEY);
    if (!raw) return { ok: false, reason: 'none' };
    const env = JSON.parse(raw) as Envelope<RunState>;
    if (!env || ![1, 2, 3, 4, 5, RUN_VERSION].includes(env.version)) return { ok: false, reason: 'version' };
    const data = validateAndMigrateRun(env.data, env.version);
    if(data?.geography&&!compatibleGeography(data)){delete data.geography;data.history.push('역사 지도 데이터 버전이 변경되어 기존 원정 지도에서 계속합니다. 경로·지형·군량·협정은 보존됩니다.');}
    return data ? { ok: true, data } : { ok: false, reason: 'corrupt' };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

export function clearRun(kv: KV): void {
  try { kv.removeItem(RUN_KEY); } catch { /* 저장 실패로 화면을 멈추지 않는다 */ }
}

export function saveMeta(kv: KV, meta: MetaState): boolean {
  const env: Envelope<MetaState> = { version: META_VERSION, savedAt: Date.now(), data: meta };
  try { kv.setItem(META_KEY, JSON.stringify(env)); return true; } catch { return false; }
}

export function loadMeta(kv: KV): MetaState {
  try {
    const raw = kv.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const env = JSON.parse(raw) as Envelope<MetaState>;
    if (env?.version !== META_VERSION || !env.data) return defaultMeta();
    const m = env.data;
    if (m.version !== META_VERSION) return defaultMeta();
    if (![m.runs, m.wins, m.bestFloor].every(x => Number.isInteger(x)) || m.runs < 0 || m.wins < 0 || m.bestFloor < -1 || m.bestFloor > 7 || ![0, 1].includes(m.difficultyUnlocked) || ![m.unlockedGenerals, m.seenGenerals].every(a => Array.isArray(a) && a.every(id => Object.hasOwn(GENERALS, id)))) return defaultMeta();
    return { ...defaultMeta(), ...env.data };
  } catch {
    return defaultMeta();
  }
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

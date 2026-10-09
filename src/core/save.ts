// 저장/불러오기. 버전 필드로 호환성을 판단한다. 저장소는 localStorage와 같은 최소 인터페이스.
import { defaultMeta, RUN_VERSION } from './run.ts';
import type { MetaState, RunState } from './types.ts';

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

export function saveRun(kv: KV, run: RunState): void {
  const env: Envelope<RunState> = { version: RUN_VERSION, savedAt: Date.now(), data: run };
  kv.setItem(RUN_KEY, JSON.stringify(env));
}

export type LoadResult<T> = { ok: true; data: T } | { ok: false; reason: 'none' | 'corrupt' | 'version' };

export function loadRun(kv: KV): LoadResult<RunState> {
  const raw = kv.getItem(RUN_KEY);
  if (!raw) return { ok: false, reason: 'none' };
  try {
    const env = JSON.parse(raw) as Envelope<RunState>;
    if (env.version !== RUN_VERSION || env.data?.version !== RUN_VERSION) return { ok: false, reason: 'version' };
    return { ok: true, data: env.data };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

export function clearRun(kv: KV): void {
  kv.removeItem(RUN_KEY);
}

export function saveMeta(kv: KV, meta: MetaState): void {
  const env: Envelope<MetaState> = { version: META_VERSION, savedAt: Date.now(), data: meta };
  kv.setItem(META_KEY, JSON.stringify(env));
}

export function loadMeta(kv: KV): MetaState {
  const raw = kv.getItem(META_KEY);
  if (!raw) return defaultMeta();
  try {
    const env = JSON.parse(raw) as Envelope<MetaState>;
    if (env.version !== META_VERSION) return defaultMeta();
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

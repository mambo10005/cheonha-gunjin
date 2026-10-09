// 시드 기반 난수 (mulberry32). 상태는 숫자 하나라 JSON 저장·복제가 쉽다.
// 모든 함수는 { rng } 필드를 가진 객체를 받아 그 필드를 갱신한다.

export interface HasRng {
  rng: number;
}

export function nextFloat(s: HasRng): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: HasRng, maxExclusive: number): number {
  return Math.floor(nextFloat(s) * maxExclusive);
}

export function pick<T>(s: HasRng, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('pick: 빈 배열');
  return arr[randInt(s, arr.length)];
}

export function shuffle<T>(s: HasRng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** 중복 없이 n개 선택 */
export function sample<T>(s: HasRng, arr: readonly T[], n: number): T[] {
  return shuffle(s, arr.slice()).slice(0, Math.min(n, arr.length));
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

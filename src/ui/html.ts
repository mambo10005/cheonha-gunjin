export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
export function activityButton(kind: string, text: string, opts: { choice?: string; round?: number; reason?: string } = {}): string {
  return `<button class="btn" data-a="social-action" data-kind="${kind}" data-choice="${opts.choice ?? ''}" data-round="${opts.round ?? ''}" ${opts.reason ? 'disabled' : ''}>${esc(text)}</button>${opts.reason ? `<div class="tiny muted">${esc(opts.reason)}</div>` : ''}`;
}

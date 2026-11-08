// Shared utility-class strings (the few patterns used in more than one place).
export const ring = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus';
const btnBase = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-bold no-underline cursor-pointer transition-colors active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 motion-reduce:transition-none ${ring}`;
export const btn = `${btnBase} bg-accent text-accent-ink hover:bg-accent-strong px-4 py-2 min-h-11`;
export const btnGhost = `${btnBase} border-2 border-line bg-surface text-ink hover:border-accent px-4 py-2 min-h-11`;
export const link = `cursor-pointer bg-transparent p-0 font-semibold text-accent underline underline-offset-2 rounded ${ring}`;
export const wrap = 'mx-auto w-full max-w-[1080px] px-4';
export const card = 'flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card';
export const grid = 'grid gap-4 grid-cols-1';
export const note = 'flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3';
export const noteError = 'flex items-start gap-2 rounded-xl bg-error-bg px-4 py-3 text-error-ink';
export const muted = 'font-normal text-muted';
export const source = 'text-[.82rem] text-muted';

// MUI icon at the parent's font size; always decorative (text labels carry the meaning).
export const Ico = ({ as: C, className = '' }) => (
  <span aria-hidden="true" className={`inline-flex shrink-0 ${className}`}><C fontSize="inherit" /></span>
);

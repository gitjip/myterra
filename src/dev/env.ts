/**
 * Single source of truth for the Ship/Dev split. True under `vite dev`, or when
 * a static build is opened with `?dev=1`.
 *
 * Dev-only modules (console, visualisers, inspector extras) are gated on this,
 * so they are absent from the shipped bundle unless explicitly requested.
 */
export const IS_DEV: boolean =
  import.meta.env.DEV ||
  (typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev'));

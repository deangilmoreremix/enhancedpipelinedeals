import type { SmartCRMRemoteProps } from '../types/remote';

/**
 * True only when a host application drives the app (module-federation remote / iframe bridge):
 * it passes an initial route, an event sink, or real shared session data. A standalone page load
 * (bootstrap.tsx always passes a `sharedData` object with undefined fields, plus an optional
 * `?theme=` override) must use the BrowserRouter so URLs, deep links and the back button work.
 */
export function isEmbeddedHost(props?: SmartCRMRemoteProps | null): boolean {
  if (!props) return false;
  if (props.initialRoute || props.onEvent || props.onDataUpdate) return true;
  const d = props.sharedData;
  return !!(d && (d.user || d.session || d.tenant));
}

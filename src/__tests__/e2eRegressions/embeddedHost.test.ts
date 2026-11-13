import { isEmbeddedHost } from '../../utils/embeddedHost';

/** Regression (e2e A): standalone loads were forced into MemoryRouter, so URLs/deep links never worked. */
describe('isEmbeddedHost', () => {
  it('standalone bootstrap props (empty sharedData, theme only) use the BrowserRouter', () => {
    expect(isEmbeddedHost({ sharedData: { user: undefined, isAuthenticated: false, theme: undefined }, initialRoute: undefined })).toBe(false);
    expect(isEmbeddedHost({ sharedData: { theme: 'dark' } })).toBe(false);
    expect(isEmbeddedHost({})).toBe(false);
    expect(isEmbeddedHost(undefined)).toBe(false);
  });
  it('a host-provided route, session, user or event sink means embedded', () => {
    expect(isEmbeddedHost({ initialRoute: '/deals' })).toBe(true);
    expect(isEmbeddedHost({ sharedData: { user: { id: 'u' } } })).toBe(true);
    expect(isEmbeddedHost({ sharedData: { session: {} } })).toBe(true);
    expect(isEmbeddedHost({ onEvent: () => {} })).toBe(true);
  });
});

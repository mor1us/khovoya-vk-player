type P = { size?: number }
const S = ({ size = 20, children, fill }: P & { children: React.ReactNode; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
)
export const IPlay = (p: P) => <S {...p} fill><path d="M7 4.5v15l13-7.5z" /></S>
export const IPause = (p: P) => <S {...p} fill><rect x="6" y="5" width="4.2" height="14" rx="1.2" /><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" /></S>
export const IPrev = (p: P) => <S {...p} fill><path d="M6 5h2v14H6zM20 5v14L9 12z" /></S>
export const INext = (p: P) => <S {...p} fill><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></S>
export const IShuffle = (p: P) => <S {...p}><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></S>
export const IRepeat = (p: P) => <S {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 01-3 3H3" /></S>
export const IRepeatOne = (p: P) => <S {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 01-3 3H3" /><path d="M11 10h1v5" /></S>
export const ISearch = (p: P) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></S>
export const IHeart = (p: P & { on?: boolean }) => <S {...p} fill={p.on}><path d="M12 21s-7-4.4-9.3-8.6C1 9.2 3 5.5 6.6 5.5c2 0 3.3 1.1 4 2.2.7-1.1 2-2.2 4-2.2 3.6 0 5.6 3.7 3.9 6.9C19 16.6 12 21 12 21z" /></S>
export const IDown = (p: P) => <S {...p}><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 19h16" /></S>
export const IVol = (p: P) => <S {...p}><path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14" /></S>
export const IMute = (p: P) => <S {...p}><path d="M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" /></S>
export const IQueue = (p: P) => <S {...p}><path d="M3 6h13M3 12h13M3 18h9M18 14v7m-3-3h6" /></S>
export const IMin = () => <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 6h10" stroke="currentColor" /></svg>
export const IMax = () => <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" stroke="currentColor" /></svg>
export const IClose = () => <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" /></svg>
export const IMore = (p: P) => <S {...p} fill><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></S>
export const IPlus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>
export const IBack = (p: P) => <S {...p}><path d="M15 18l-6-6 6-6" /></S>
export const ICheck = (p: P) => <S {...p}><path d="M5 12l5 5L20 7" /></S>
export const IX = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>
export const IFolder = (p: P) => <S {...p}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></S>

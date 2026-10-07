import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n.ts';
import type { GlassStyle, Theme } from '../state.ts';
import { Segmented } from './Fields.tsx';

type Phase = 'closed' | 'opening' | 'open' | 'closing';

/** The glass is rendered once; the popover moves as a composited layer, keeping text and optics stable. */
export function AppearanceMenu({ theme, glass, setTheme, setGlass, icon, label }: { theme: Theme; glass: GlassStyle; setTheme: (t: Theme) => void; setGlass: (g: GlassStyle) => void; icon: ReactNode; label: string }) {
  const [phase, setPhase] = useState<Phase>('closed');
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const open = () => {
    if (timer.current) clearTimeout(timer.current);
    setPhase('opening');
    timer.current = setTimeout(() => setPhase('open'), 0);
  };
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('closed');
      return;
    }
    setPhase((p) => (p === 'closed' ? p : 'closing'));
    timer.current = setTimeout(() => setPhase('closed'), 220);
  };

  useEffect(() => {
    if (phase !== 'open') return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [phase]);

  const collapsed = phase === 'opening' || phase === 'closing';
  return (
    <div ref={root} className="menu" data-blob="self">
      <button type="button" className="menu-btn" aria-haspopup="dialog" aria-expanded={phase === 'open'} aria-label={label} title={label} onClick={() => (phase === 'closed' || phase === 'closing' ? open() : close())}>
        {icon}
      </button>
      {phase !== 'closed' && (
        <div className="menu-panel" role="dialog" aria-label={t('appearance')} aria-hidden={collapsed} {...(collapsed ? { inert: '' } : {})} data-collapsed={collapsed ? '1' : '0'} data-blob="self" data-blob-spec="panel">
          <div className="menu-group">
            <span className="menu-title">{t('appearance')}</span>
            <Segmented<Theme>
              label={t('appearance')}
              value={theme}
              onChange={setTheme}
              options={[{ value: 'system', label: t('themeAuto') }, { value: 'light', label: t('themeLightShort') }, { value: 'dark', label: t('themeDarkShort') }]}
            />
          </div>
          <div className="menu-group">
            <span className="menu-title">{t('glassGroup')}</span>
            <Segmented<GlassStyle>
              label={t('glassGroup')}
              value={glass}
              onChange={setGlass}
              options={[{ value: 'regular', label: t('glassRegular') }, { value: 'clear', label: t('glassClear') }]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Keep web screens and modal composers above the mobile software keyboard. */
export function useMobileViewport() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Do not fight user pinch zoom or resize the app around a magnified view.
        if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
        root.style.setProperty('--app-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
        const active = document.activeElement;
        const editing = active instanceof HTMLElement && active.matches('input, textarea, [contenteditable="true"]');
        const keyboardOpen = editing && window.innerHeight - (viewport?.height ?? window.innerHeight) > 120;
        root.toggleAttribute('data-keyboard-open', keyboardOpen);
        if (keyboardOpen) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
      root.style.removeProperty('--app-viewport-height');
      root.removeAttribute('data-keyboard-open');
    };
  }, []);
}

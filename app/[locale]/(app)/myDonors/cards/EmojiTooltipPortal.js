import { createPortal } from 'react-dom';

export default function EmojiTooltipPortal({ children, position, show }) {
  if (!show) return null;
  return createPortal(
    <div style={{
      position: 'fixed',
      top: position.top,
      left: position.left,
      zIndex: 9999,
      direction: 'rtl',
      borderRadius: 'var(--Border-Radius-s, 4px)',
      border: '1px solid var(--Gray-Blue-70, #EDF5FD)',
      background: 'var(--Bg-Button-disable, #FFF)',
      boxShadow: '0px 39px 11px 0px rgba(168, 188, 230, 0.00), 0px 25px 10px 0px rgba(168, 188, 230, 0.01), 0px 14px 8px 0px rgba(168, 188, 230, 0.03), 0px 6px 6px 0px rgba(168, 188, 230, 0.04), 0px 2px 3px 0px rgba(168, 188, 230, 0.05)',
      padding: 'var(--Spacing-Spacing-3, 4px)',
      transform: 'translateX(-100%)'
    }}>
      {children}
    </div>,
    document.body
  );
} 
import { Copy, Menu, Moon, Search, X } from 'lucide-react';

const ICONS = { search: Search, moon: Moon, copy: Copy, menu: Menu, close: X };

export interface IconButtonProps {
  icon: keyof typeof ICONS;
  /** 스크린리더 이름. 아이콘만 있는 버튼이라 빼지 않는다. */
  label: string;
  /** subtle은 회색 원, plain은 투명 */
  variant?: 'subtle' | 'plain';
  onClick?: () => void;
  className?: string;
}

export function IconButton({
  icon,
  label,
  variant = 'subtle',
  onClick,
  className,
}: IconButtonProps) {
  const Glyph = ICONS[icon];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'inline-flex size-9 cursor-pointer items-center justify-center rounded-full p-0 text-fg-default',
        variant === 'plain'
          ? 'bg-transparent text-fg-muted'
          : 'bg-bg-subtle hover:bg-bg-subtle-hover',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Glyph aria-hidden="true" size={16} strokeWidth={2.2} />
    </button>
  );
}

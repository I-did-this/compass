import React from 'react';
import {
  Button,
  Icon,
  Tooltip,
  css,
  spacing,
} from '@mongodb-js/compass-components';

const triggerStyles = css({
  display: 'flex',
  alignItems: 'center',
});

export const toolbarButtonGroupStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
});

type ToolbarIconButtonProps = {
  label: string;
  glyph: React.ComponentProps<typeof Icon>['glyph'] | React.ReactElement;
  onClick: () => void;
  // Shown in the tooltip instead of the label while the button is disabled.
  disabledReason?: string;
  disabled?: boolean;
  variant?: 'default' | 'primary';
  'data-testid'?: string;
};

// Toolbar actions are icon-only, so the tooltip is what names them. The
// tooltip trigger is a wrapping div rather than the button itself because
// disabled buttons don't emit the mouse events the tooltip relies on.
export function ToolbarIconButton({
  label,
  glyph,
  onClick,
  disabledReason,
  disabled = false,
  variant = 'default',
  'data-testid': dataTestId,
}: ToolbarIconButtonProps) {
  return (
    <Tooltip
      trigger={({
        children: tooltipChildren,
        ...tooltipTriggerProps
      }: React.HTMLProps<HTMLDivElement>) => (
        <div className={triggerStyles} {...tooltipTriggerProps}>
          <Button
            size="xsmall"
            variant={variant}
            aria-label={label}
            data-testid={dataTestId}
            disabled={disabled}
            onClick={onClick}
            leftGlyph={
              typeof glyph === 'string' ? <Icon glyph={glyph} /> : glyph
            }
          />
          {tooltipChildren}
        </div>
      )}
      justify="middle"
    >
      {disabled && disabledReason ? disabledReason : label}
    </Tooltip>
  );
}

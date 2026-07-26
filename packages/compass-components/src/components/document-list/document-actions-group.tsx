import React, { useEffect, useRef, useState } from 'react';
import { css, cx } from '@leafygreen-ui/emotion';
import { spacing } from '@leafygreen-ui/tokens';
import { palette } from '@leafygreen-ui/palette';
import type {
  InferredPolymorphicPropsWithRef,
  PolymorphicAs,
} from '@leafygreen-ui/polymorphic';
import type { BaseButtonProps } from '@leafygreen-ui/button';

import { Button, Icon, Tooltip } from '../leafygreen';
import { useDarkMode } from '../../hooks/use-theme';
import type { Signal } from '../signal-popover';
import { SignalPopover } from '../signal-popover';

const actionsGroupContainer = css({
  position: 'absolute',
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  width: '100%',
  top: spacing[300],
  paddingLeft: spacing[300],
  paddingRight: spacing[300],
  pointerEvents: 'none',
});

// `sticky` variant: an in-flow header that pins to the top of the surrounding
// scroll container (the virtualized documents list) so the row actions stay
// reachable while a long document scrolls underneath — mirroring the JSON
// view's sticky action header. Unlike the overlay variant it takes vertical
// space and the actions are always visible (not hover-gated).
const actionsGroupStickyContainer = css({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  width: '100%',
  minHeight: spacing[600] + spacing[200],
  paddingTop: spacing[100],
  paddingBottom: spacing[100],
  paddingLeft: spacing[300],
  paddingRight: spacing[300],
  borderTopLeftRadius: spacing[200],
  borderTopRightRadius: spacing[200],
});

const actionsGroupStickyLight = css({
  backgroundColor: palette.white,
  borderBottom: `1px solid ${palette.gray.light2}`,
});

const actionsGroupStickyDark = css({
  backgroundColor: palette.black,
  borderBottom: `1px solid ${palette.gray.dark2}`,
});

const actionsGroupItem = css({
  flex: 'none',
  pointerEvents: 'all',
});

const actionsGroupItemSeparator = css({
  flex: '1 0 auto',
  pointerEvents: 'none',
});

const actionsGroupIdle = css({
  '& > [data-action-item]': {
    display: 'none',
  },
});

const actionsGroupHovered = css({
  '& > [data-action-item]': {
    display: 'block',
  },
});

// Insight icon is always visible, even when action buttons are not
const actionsGroupSignalPopover = css({
  display: 'block !important',
});

const expandButton = css({
  '& > div:has(svg)': {
    paddingLeft: 3,
    paddingRight: 3,
  },
});

function useElementParentHoverState<T extends HTMLElement>(
  ref: React.RefObject<T>
): boolean {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const node = ref.current?.parentElement;

    const onMouseEnter = () => {
      setIsHovered(true);
    };

    const onMouseLeave = () => {
      setIsHovered(false);
    };

    node?.addEventListener('mouseenter', onMouseEnter);
    node?.addEventListener('mouseleave', onMouseLeave);

    return () => {
      node?.removeEventListener('mouseenter', onMouseEnter);
      node?.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [ref]);

  return isHovered;
}

function ActionButton<TAsProp extends PolymorphicAs = 'button'>({
  tooltipText,
  tooltipEnabled,
  ...props
}: InferredPolymorphicPropsWithRef<TAsProp, BaseButtonProps> & {
  tooltipText: string;
  tooltipEnabled: boolean;
}) {
  return (
    <Tooltip
      // We pass `enabled` as the buttons set their styles `display: false`
      // the container isn't hovered, which causes the tooltips to reset
      // their position to 0,0 and glitch visually without enabled.
      enabled={tooltipEnabled}
      trigger={
        <div data-action-item>
          <Button {...props} />
        </div>
      }
      justify="middle"
    >
      {tooltipText}
    </Tooltip>
  );
}

const DocumentActionsGroup: React.FunctionComponent<
  {
    onEdit?: () => void;
    onOpenUpdateModal?: () => void;
    onCopy?: () => void;
    onClone?: () => void;
    onRemove?: () => void;
    onlyShowOnHover?: boolean;
    // When true, render as an in-flow sticky header pinned to the top of the
    // surrounding scroll container (always visible) instead of an absolute
    // hover overlay. See actionsGroupStickyContainer.
    sticky?: boolean;
    insights?: Signal | Signal[];
  } & (
    | { onExpand?: never; expanded?: never }
    | { onExpand: () => void; expanded: boolean }
  )
> = ({
  onEdit,
  onOpenUpdateModal,
  onCopy,
  onClone,
  onRemove,
  onExpand,
  expanded,
  onlyShowOnHover = true,
  sticky = false,
  insights,
}) => {
  const darkMode = useDarkMode();
  const [signalOpened, setSignalOpened] = useState(false);
  const conatinerRef = useRef<HTMLDivElement | null>(null);
  const isHovered = useElementParentHoverState(conatinerRef);
  const [showCopyButtonTooltip, setShowCopyButtonTooltip] = useState(false);
  const isActive = isHovered || signalOpened;

  useEffect(() => {
    if (showCopyButtonTooltip === true) {
      const tid = setTimeout(() => {
        setShowCopyButtonTooltip(false);
      }, 1200);
      return () => {
        clearTimeout(tid);
      };
    }
  }, [showCopyButtonTooltip]);

  return (
    <div
      ref={conatinerRef}
      className={
        sticky
          ? cx(
              actionsGroupStickyContainer,
              darkMode ? actionsGroupStickyDark : actionsGroupStickyLight
            )
          : cx(
              actionsGroupContainer,
              onlyShowOnHover &&
                (isActive ? actionsGroupHovered : actionsGroupIdle)
            )
      }
    >
      {onExpand && (
        <ActionButton
          size="xsmall"
          tooltipEnabled={isActive}
          rightGlyph={
            <Icon
              role="presentation"
              glyph={expanded ? 'CaretDown' : 'CaretRight'}
            ></Icon>
          }
          aria-label={expanded ? 'Collapse all' : 'Expand all'}
          aria-pressed={expanded}
          data-testid="expand-document-button"
          onClick={onExpand}
          className={cx(actionsGroupItem, expandButton)}
          tooltipText={expanded ? 'Collapse all' : 'Expand all'}
        />
      )}
      <span className={actionsGroupItemSeparator}></span>
      {insights && (
        <div
          className={cx(actionsGroupItem, actionsGroupSignalPopover)}
          data-action-item
        >
          <SignalPopover
            signals={insights}
            onPopoverOpenChange={setSignalOpened}
          ></SignalPopover>
        </div>
      )}
      {onEdit && (
        <ActionButton
          tooltipEnabled={isActive}
          size="xsmall"
          rightGlyph={<Icon role="presentation" glyph="Edit"></Icon>}
          aria-label="Edit document"
          data-testid="edit-document-button"
          onClick={onEdit}
          className={actionsGroupItem}
          tooltipText="Edit document"
        />
      )}
      {onOpenUpdateModal && (
        <ActionButton
          tooltipEnabled={isActive}
          size="xsmall"
          rightGlyph={<Icon role="presentation" glyph="Wrench"></Icon>}
          aria-label="Update document"
          data-testid="open-update-document-modal-button"
          onClick={onOpenUpdateModal}
          className={actionsGroupItem}
          tooltipText="Update document"
        />
      )}
      {onCopy && (
        <Tooltip
          open={showCopyButtonTooltip}
          trigger={
            <div data-action-item>
              <ActionButton
                tooltipEnabled={isActive}
                size="xsmall"
                rightGlyph={<Icon role="presentation" glyph="Copy"></Icon>}
                aria-label="Copy document to clipboard"
                data-testid="copy-document-button"
                onClick={() => {
                  setShowCopyButtonTooltip(true);
                  onCopy();
                }}
                className={actionsGroupItem}
                tooltipText="Copy to clipboard"
              />
            </div>
          }
          justify="middle"
        >
          Copied!
        </Tooltip>
      )}
      {onClone && (
        <ActionButton
          size="xsmall"
          tooltipEnabled={isActive}
          rightGlyph={<Icon role="presentation" glyph="Clone"></Icon>}
          aria-label="Clone document"
          data-testid="clone-document-button"
          onClick={onClone}
          className={actionsGroupItem}
          tooltipText="Clone document"
        />
      )}
      {onRemove && (
        <ActionButton
          size="xsmall"
          tooltipEnabled={isActive}
          rightGlyph={<Icon role="presentation" glyph="Trash"></Icon>}
          aria-label="Remove document"
          data-testid="remove-document-button"
          onClick={onRemove}
          className={actionsGroupItem}
          tooltipText="Remove document"
        />
      )}
    </div>
  );
};

export default DocumentActionsGroup;

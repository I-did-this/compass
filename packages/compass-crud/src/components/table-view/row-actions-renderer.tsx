import React, { useCallback, useMemo } from 'react';
import type { ItemAction } from '@mongodb-js/compass-components';
import { ItemActionGroup, spacing } from '@mongodb-js/compass-components';

type RowActionsRendererProps = {
  api?: any;
  value?: any;
  node?: any;
  context?: any;
  data?: any;
  nested?: boolean;
  isEditable: boolean;
  canOpenUpdateModal?: boolean;
  copyToClipboard: (data: any) => void;
};

type RowAction = 'edit' | 'update-modal' | 'remove' | 'clone' | 'copy';

type RowActionsOptions = {
  nested?: boolean;
  canOpenUpdateModal?: boolean;
};

function getRowActions({
  nested,
  canOpenUpdateModal = false,
}: RowActionsOptions): ItemAction<RowAction>[] {
  const edit: ItemAction<RowAction>[] = [
    { action: 'edit', label: 'Edit Document', icon: 'Edit' },
  ];

  if (nested) {
    return edit;
  }

  const updateModal: ItemAction<RowAction>[] = canOpenUpdateModal
    ? [{ action: 'update-modal', label: 'Update Document', icon: 'Wrench' }]
    : [];

  return [
    ...edit,
    ...updateModal,
    { action: 'copy', label: 'Copy Document', icon: 'Copy' },
    { action: 'clone', label: 'Clone Document', icon: 'Clone' },
    { action: 'remove', label: 'Delete Document', icon: 'Trash' },
  ];
}

// Mirrors the xsmall ItemActionGroup layout (20px buttons, spacing[100] gap)
// plus the panel's horizontal padding, so the pinned column fits every
// action it renders instead of clipping the last one.
const ACTION_BUTTON_SIZE = 20;
const PANEL_HORIZONTAL_PADDING = spacing[200] * 2;

export function getRowActionsColumnWidth(options: RowActionsOptions): number {
  const count = getRowActions(options).length;
  return (
    count * ACTION_BUTTON_SIZE +
    (count - 1) * spacing[100] +
    PANEL_HORIZONTAL_PADDING
  );
}

const RowActionsRenderer: React.FunctionComponent<RowActionsRendererProps> = ({
  context,
  copyToClipboard,
  node,
  data,
  nested,
  value,
  isEditable,
  canOpenUpdateModal = false,
}) => {
  const rowActions = useMemo(
    () => getRowActions({ nested, canOpenUpdateModal }),
    [nested, canOpenUpdateModal]
  );

  const onAction = useCallback(
    (action: RowAction) => {
      switch (action) {
        case 'edit':
          context.addFooter(node, data, 'editing');
          break;
        case 'update-modal':
          context.handleOpenUpdateModal(data);
          break;
        case 'remove':
          context.addFooter(node, data, 'deleting');
          break;
        case 'clone':
          context.handleClone(data);
          break;
        case 'copy':
          copyToClipboard(data.hadronDocument);
          break;
        default:
          break;
      }
    },
    [copyToClipboard, context, data, node]
  );

  if (
    value?.state === 'editing' ||
    value?.state === 'deleting' ||
    !isEditable
  ) {
    return null;
  }

  return (
    <div className="table-view-row-actions">
      <div className="table-view-row-actions-panel">
        <ItemActionGroup<RowAction>
          data-testid="table-view-row-actions"
          actions={rowActions}
          onAction={onAction}
          iconSize="xsmall"
        ></ItemActionGroup>
      </div>
    </div>
  );
};

export default RowActionsRenderer;

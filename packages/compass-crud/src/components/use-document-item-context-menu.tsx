import type HadronDocument from 'hadron-document';
import { useContextMenuGroups } from '@mongodb-js/compass-components';

import type { DocumentProps } from './document';

export type UseDocumentItemContextMenuProps = {
  doc: HadronDocument;
  isEditable: boolean;
} & Pick<
  DocumentProps,
  'copyToClipboard' | 'openInsertDocumentDialog' | 'openUpdateDocumentModal'
>;

export function useDocumentItemContextMenu({
  doc,
  isEditable,
  copyToClipboard,
  openInsertDocumentDialog,
  openUpdateDocumentModal,
}: UseDocumentItemContextMenuProps) {
  const { expanded: isExpanded, editing: isEditing } = doc;

  return useContextMenuGroups(
    () => [
      isEditable
        ? {
            telemetryLabel: 'Document Item Edit',
            items: [
              {
                label: 'Update document',
                onAction: () => {
                  // Editing is handled by a dedicated modal rather than an
                  // inline editable state.
                  openUpdateDocumentModal?.(doc);
                },
              },
            ],
          }
        : undefined,
      {
        telemetryLabel: 'Document Expand Collapse',
        items: [
          {
            label: isExpanded ? 'Collapse all fields' : 'Expand all fields',
            onAction: () => {
              if (isExpanded) {
                doc.collapse();
              } else {
                doc.expand();
              }
            },
          },
        ],
      },
      {
        telemetryLabel: 'Document Item',
        items: [
          // NB: inline "Edit document"/"Cancel editing" from upstream is
          // intentionally omitted here - this fork routes all editing through
          // the "Update document" modal above rather than an inline editable
          // state.
          {
            label: 'Copy document as Shell Syntax',
            onAction: () => {
              copyToClipboard?.(doc, 'shell-syntax');
            },
          },
          {
            label: 'Copy document as EJSON',
            onAction: () => {
              copyToClipboard?.(doc, 'ejson');
            },
          },
          isEditable
            ? {
                label: 'Clone document...',
                onAction: () => {
                  const clonedDoc = doc.generateObject({
                    excludeInternalFields: true,
                  });
                  void openInsertDocumentDialog?.(clonedDoc, true);
                },
              }
            : undefined,
        ],
      },
      isEditable && !isEditing
        ? {
            telemetryLabel: 'Document Item Delete',
            items: [
              {
                label: 'Delete document',
                onAction: () => {
                  doc.markForDeletion();
                },
              },
            ],
          }
        : undefined,
    ],
    [
      doc,
      isExpanded,
      isEditing,
      isEditable,
      copyToClipboard,
      openInsertDocumentDialog,
      openUpdateDocumentModal,
    ]
  );
}

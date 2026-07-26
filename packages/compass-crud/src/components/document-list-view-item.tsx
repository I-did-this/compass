import React, { useCallback } from 'react';
import type HadronDocument from 'hadron-document';
import { css, KeylineCard } from '@mongodb-js/compass-components';
import Document, { type DocumentProps } from './document';
import { useDocumentItemContextMenu } from './use-document-item-context-menu';
import { useMergeRefs } from '@mongodb-js/compass-components';

const keylineCardStyles = css({
  // NB: overflow is intentionally left `visible` here (rather than `hidden`)
  // so the sticky edit header rendered inside EditableDocument can pin to the
  // virtualized list's scroll container instead of being clipped by this card.
  overflow: 'visible',
  position: 'relative',
});
import {
  useChangeQueryBarQuery,
  useQueryBarQuery,
} from '@mongodb-js/compass-query-bar';

export type DocumentListViewItemProps = {
  doc: HadronDocument;
  docRef: React.Ref<HTMLDivElement>;
  docIndex: number;
  isEditable: boolean;
  hasProjection?: boolean;
  isTimeSeries?: boolean;
  scrollTriggerRef?: React.Ref<HTMLDivElement>;
} & Pick<
  DocumentProps,
  | 'copyToClipboard'
  | 'removeDocument'
  | 'replaceDocument'
  | 'updateDocument'
  | 'openInsertDocumentDialog'
  | 'openUpdateDocumentModal'
>;

const DocumentListViewItem: React.FC<DocumentListViewItemProps> = ({
  doc,
  docRef,
  docIndex,
  isEditable,
  hasProjection,
  isTimeSeries,
  scrollTriggerRef,
  copyToClipboard,
  removeDocument,
  replaceDocument,
  updateDocument,
  openInsertDocumentDialog,
  openUpdateDocumentModal,
}) => {
  const contextMenuRef = useDocumentItemContextMenu({
    doc,
    isEditable,
    copyToClipboard,
    openInsertDocumentDialog,
    openUpdateDocumentModal,
  });

  const changeQuery = useChangeQueryBarQuery();
  const queryBarQuery = useQueryBarQuery();

  const handleAddToQuery = useCallback(
    (field: string, value: unknown) => {
      changeQuery('toggleDistinctValue', {
        field,
        value,
      });
    },
    [changeQuery]
  );

  const mergedRef = useMergeRefs([docRef, contextMenuRef]);

  return (
    <KeylineCard className={keylineCardStyles} ref={mergedRef}>
      {scrollTriggerRef && docIndex === 0 && <div ref={scrollTriggerRef} />}
      <Document
        doc={doc}
        key={doc.uuid}
        query={queryBarQuery.filter}
        onUpdateQuery={handleAddToQuery}
        editable={isEditable}
        hasProjection={hasProjection}
        isTimeSeries={isTimeSeries}
        copyToClipboard={copyToClipboard}
        removeDocument={removeDocument}
        replaceDocument={replaceDocument}
        updateDocument={updateDocument}
        openInsertDocumentDialog={openInsertDocumentDialog}
        openUpdateDocumentModal={openUpdateDocumentModal}
      />
    </KeylineCard>
  );
};

export { DocumentListViewItem };

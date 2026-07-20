import React from 'react';
import type HadronDocument from 'hadron-document';
import { css, KeylineCard, useMergeRefs } from '@mongodb-js/compass-components';
import JSONEditor, { type JSONEditorProps } from './json-editor';
import { useDocumentItemContextMenu } from './use-document-item-context-menu';

const keylineCardStyles = css({
  // NB: overflow is intentionally left `visible` here (rather than `hidden`)
  // so the sticky action header rendered inside JSONEditor can pin to the
  // virtualized list's scroll container instead of being clipped by this card.
  // The editor content clips its own corners via an inner wrapper.
  overflow: 'visible',
  position: 'relative',
});

export type DocumentJsonViewItemProps = {
  doc: HadronDocument;
  docRef: React.Ref<HTMLDivElement>;
  docIndex: number;
  namespace: string;
  isEditable: boolean;
  isTimeSeries?: boolean;
  scrollTriggerRef?: React.Ref<HTMLDivElement>;
} & Pick<
  JSONEditorProps,
  | 'copyToClipboard'
  | 'removeDocument'
  | 'replaceDocument'
  | 'updateDocument'
  | 'openInsertDocumentDialog'
  | 'openUpdateDocumentModal'
>;

const DocumentJsonViewItem: React.FC<DocumentJsonViewItemProps> = ({
  doc,
  docRef,
  docIndex,
  namespace,
  isEditable,
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

  const mergedRef = useMergeRefs([docRef, contextMenuRef]);

  return (
    <KeylineCard className={keylineCardStyles} ref={mergedRef}>
      {scrollTriggerRef && docIndex === 0 && <div ref={scrollTriggerRef} />}
      <JSONEditor
        doc={doc}
        key={doc.uuid}
        namespace={namespace}
        editable={isEditable}
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

export { DocumentJsonViewItem };

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  css,
  cx,
  DocumentList,
  Link,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';
import type { Document } from 'hadron-document';
import HadronDocument from 'hadron-document';
import {
  CodemirrorMultilineEditor,
  ActionButton,
  useSafeIntegerLinter,
} from '@mongodb-js/compass-editor';
import type { EditorRef } from '@mongodb-js/compass-editor';
import type { CrudActions } from '../stores/crud-store';
import { parseUpdateDocumentText } from '../stores/crud-store';
import { useDocumentAutocompleter } from '../hooks/use-document-autocompleter';
import { getSafeIntegerViolationMessage } from '../utils';
import { useTelemetry } from '@mongodb-js/compass-telemetry/provider';
import DocumentFind from './document-find';
import type { DocumentFindRef } from './document-find';
import { registerDocumentSearch } from '../utils/document-search-focus';

const editorStyles = css({
  minHeight: spacing[800] + spacing[400],
});

const editableJsonStyles = css({
  position: 'relative',
});

// The header pins to the top of the virtualized list scroll container while
// any part of a (potentially very tall) document is on screen, so the row
// actions and the edit controls stay reachable without scrolling the whole
// document. Sticky can only escape to the scroll container because the parent
// KeylineCard uses `overflow: visible` (see document-json-view-item.tsx).
// Matches the KeylineCard border radius (see keyline-card.tsx) so the header
// and editor wrapper clip flush with the card's rounded corners now that the
// card itself uses `overflow: visible`.
const cardBorderRadius = spacing[200];

const stickyHeaderStyles = css({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  minHeight: spacing[600] + spacing[200],
  overflow: 'hidden',
  borderTopLeftRadius: cardBorderRadius,
  borderTopRightRadius: cardBorderRadius,
});

const stickyHeaderLightStyles = css({
  backgroundColor: palette.white,
  borderBottom: `1px solid ${palette.gray.light2}`,
});

const stickyHeaderDarkStyles = css({
  backgroundColor: palette.black,
  borderBottom: `1px solid ${palette.gray.dark2}`,
});

const viewActionsBarStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  width: '100%',
  padding: spacing[100],
});

const actionsSpacerStyles = css({
  flex: '1 0 auto',
});

// The search bar takes the spacer's place in the sticky header.
const inlineSearchStyles = css({
  flex: '1 1 auto',
  minWidth: 0,
  padding: 0,
});

// The edit/delete footer was designed as a bottom bar (it rounds its bottom
// corners); when hosted in the sticky top header we neutralize its own radius
// and let the header clip the top corners instead. It shares the row with the
// expand toggle, so it takes the remaining width (flex: 1) rather than 100%.
const editFooterSlotStyles = css({
  flex: 1,
  minWidth: 0,
  '& [data-testid="document-footer"]': {
    borderRadius: 0,
  },
});

// While searching, the find input takes the free width and the footer
// shrinks to its Cancel/Replace controls.
const editFooterSlotBesideSearchStyles = css({
  flex: '0 1 auto',
});

// In edit/delete mode the sticky header keeps the expand/collapse toggle to
// the left of the Cancel/Replace footer so the toggle stays reachable instead
// of being swapped out for the footer.
const editHeaderRowStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  width: '100%',
  paddingLeft: spacing[200],
});

const editorWrapperStyles = css({
  overflow: 'hidden',
  borderBottomLeftRadius: cardBorderRadius,
  borderBottomRightRadius: cardBorderRadius,
});

const bannerContentStyles = css({
  display: 'flex',
  flexDirection: 'row',
  gap: spacing[200],
  justifyContent: 'flex-start',
});

const footerActionButtonStyles = css({
  flexShrink: 0,
});

export type JSONEditorProps = {
  namespace: string;
  doc: Document;
  editable: boolean;
  isTimeSeries?: boolean;
  removeDocument?: CrudActions['removeDocument'];
  replaceDocument?: CrudActions['replaceDocument'];
  updateDocument?: CrudActions['updateDocument'];
  copyToClipboard?: CrudActions['copyToClipboard'];
  openInsertDocumentDialog?: CrudActions['openInsertDocumentDialog'];
  openUpdateDocumentModal?: CrudActions['openUpdateDocumentModal'];
  // With a projection the document is partial, so saving must update only the
  // edited fields: replacing would drop every field the projection hid.
  hasProjection?: boolean;
};

const JSONEditor: React.FunctionComponent<JSONEditorProps> = ({
  namespace,
  doc,
  editable,
  isTimeSeries = false,
  removeDocument,
  replaceDocument,
  updateDocument,
  copyToClipboard,
  openInsertDocumentDialog,
  openUpdateDocumentModal,
  hasProjection = false,
}) => {
  const darkMode = useDarkMode();
  const editorRef = useRef<EditorRef>(null);
  const [expanded, setExpanded] = useState<boolean>(doc.expanded);
  const [editing, setEditing] = useState<boolean>(doc.editing);
  const [deleting, setDeleting] = useState<boolean>(doc.markedForDeletion);
  const [value, setValue] = useState<string>(
    () => doc.modifiedEJSONString ?? doc.toEJSON()
  );
  const [initialValue] = useState<string>(() => doc.toEJSON());
  const [docValidationError, setDocValidationError] = useState<Error | null>(
    null
  );
  const handleCopy = useCallback(() => {
    void copyToClipboard?.(doc, 'ejson');
  }, [copyToClipboard, doc]);

  const handleClone = useCallback(() => {
    const clonedDoc = doc.generateObject({
      excludeInternalFields: true,
    });
    void openInsertDocumentDialog?.(clonedDoc, true);
  }, [doc, openInsertDocumentDialog]);

  const onChange = useCallback(
    (value: string) => {
      try {
        parseUpdateDocumentText(value);
        setDocValidationError(null);
      } catch (error) {
        setDocValidationError(error as Error);
      } finally {
        setValue(value);
        doc.setModifiedEJSONString(value);
      }
    },
    [doc]
  );

  const onCancel = useCallback(() => {
    if (editing) {
      doc.finishEditing();
    } else if (deleting) {
      doc.finishDeletion();
    }
    setValue(doc.toEJSON());
  }, [doc, editing, deleting]);

  const onEdit = useCallback(() => {
    doc.startEditing();
  }, [doc]);

  // The Update Document modal also starts an editing session on the same
  // HadronDocument, which fires EditingStarted. The Reflux action dispatches
  // async via nextTick, so we hold this flag set from the click until
  // EditingFinished (modal close) and ignore any EditingStarted that fires
  // in between - so the JSON card stays in read-only display behind the
  // modal.
  const suppressEditingStartedNoticeRef = useRef(false);

  const onOpenUpdateModal = useCallback(() => {
    suppressEditingStartedNoticeRef.current = true;
    void openUpdateDocumentModal?.(doc);
  }, [doc, openUpdateDocumentModal]);

  const onEditingStarted = useCallback(() => {
    if (suppressEditingStartedNoticeRef.current) return;
    setEditing(true);
    // Auto-expand on edit so the whole document is unfolded and editable.
    // doc.expand() fires Expanded -> onExpanded -> unfoldAll (see the fold
    // effect below), keeping the toggle state and editor fold state in sync.
    doc.expand();
  }, [doc]);

  const onUpdate = useCallback(() => {
    const newDoc = parseUpdateDocumentText(value || '');
    newDoc.preserveTypes(doc);
    doc.apply(newDoc);
    if (hasProjection) {
      void updateDocument?.(doc);
    } else {
      void replaceDocument?.(doc);
    }
  }, [doc, hasProjection, replaceDocument, updateDocument, value]);

  const onEditingFinished = useCallback(() => {
    suppressEditingStartedNoticeRef.current = false;
    setEditing(false);
  }, []);

  const onMarkForDeletion = useCallback(() => {
    doc.markForDeletion();
  }, [doc]);

  const onDeletionStarted = useCallback(() => {
    setDeleting(true);
  }, []);

  const onDelete = useCallback(() => {
    void removeDocument?.(doc);
  }, [doc, removeDocument]);

  const onDeletionFinished = useCallback(() => {
    setDeleting(false);
  }, []);

  const onExpanded = useCallback(() => {
    setExpanded(true);
  }, []);

  const onCollapsed = useCallback(() => {
    setExpanded(false);
  }, []);

  const completer = useDocumentAutocompleter(namespace);

  const isEditable = editable && !deleting && !isTimeSeries;
  // Wrench (Update Document modal) is decoupled from isEditable: the store
  // refetches the full doc by _id on open, so the modal is safe even when a
  // projection is active (in which case the parent passes openUpdateDocumentModal
  // while clearing isEditable).
  const canOpenUpdateModal =
    !!openUpdateDocumentModal && !deleting && !isTimeSeries;

  const containerRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<DocumentFindRef>(null);
  const [searching, setSearching] = useState(false);

  const closeSearch = useCallback(() => {
    editorRef.current?.clearSearch();
    setSearching(false);
  }, []);

  // Searching expands the document so matches inside folded sub-documents
  // and arrays are visible when navigated to.
  const openSearch = useCallback(() => {
    if (searching) {
      findRef.current?.focus();
      return;
    }
    doc.expand();
    setSearching(true);
  }, [doc, searching]);

  const toggleSearch = useCallback(() => {
    if (searching) {
      closeSearch();
    } else {
      openSearch();
    }
  }, [searching, closeSearch, openSearch]);

  const openSearchRef = useRef(openSearch);
  useEffect(() => {
    openSearchRef.current = openSearch;
  }, [openSearch]);

  useEffect(() => {
    return registerDocumentSearch({
      contains: (node) => containerRef.current?.contains(node) ?? false,
      openSearch: () => openSearchRef.current(),
    });
  }, []);

  const handleCopyAction = useCallback(() => {
    handleCopy();
    return true;
  }, [handleCopy]);

  useEffect(() => {
    doc.on(HadronDocument.Events.Cancel, onCancel);
    doc.on(HadronDocument.Events.Expanded, onExpanded);
    doc.on(HadronDocument.Events.Collapsed, onCollapsed);
    doc.on(HadronDocument.Events.EditingStarted, onEditingStarted);
    doc.on(HadronDocument.Events.EditingFinished, onEditingFinished);
    doc.on(HadronDocument.Events.MarkedForDeletion, onDeletionStarted);
    doc.on(HadronDocument.Events.DeletionFinished, onDeletionFinished);

    return () => {
      doc.removeListener(HadronDocument.Events.Cancel, onCancel);
      doc.removeListener(HadronDocument.Events.Expanded, onExpanded);
      doc.removeListener(HadronDocument.Events.Collapsed, onCollapsed);
      doc.removeListener(
        HadronDocument.Events.EditingStarted,
        onEditingStarted
      );
      doc.removeListener(
        HadronDocument.Events.EditingFinished,
        onEditingFinished
      );
      doc.removeListener(
        HadronDocument.Events.MarkedForDeletion,
        onDeletionStarted
      );
      doc.removeListener(
        HadronDocument.Events.DeletionFinished,
        onDeletionFinished
      );
    };
  }, [
    doc,
    onCancel,
    onExpanded,
    onCollapsed,
    onEditingStarted,
    onEditingFinished,
    onDeletionStarted,
    onDeletionFinished,
  ]);

  const toggleExpandCollapse = useCallback(() => {
    if (doc.expanded) {
      doc.collapse();
    } else {
      doc.expand();
    }
  }, [doc]);

  // Trying to change CodeMirror editor state when an update "effect" is in
  // progress results in an error which is why we timeout the code mirror update
  // itself.
  const editorFoldUnfoldTimeoutRef = useRef<NodeJS.Timeout | undefined>();
  useEffect(() => {
    if (editorFoldUnfoldTimeoutRef.current) {
      clearTimeout(editorFoldUnfoldTimeoutRef.current);
    }

    editorFoldUnfoldTimeoutRef.current = setTimeout(() => {
      if (!editorRef.current) {
        return;
      }

      if (expanded) {
        editorRef.current.unfoldAll();
      } else {
        editorRef.current.foldAll();
      }
    }, 0);
  }, [expanded]);

  const track = useTelemetry();
  const {
    safeIntegerLinter,
    violations: safeIntegerViolations,
    onFixViolations: onFixSafeIntegerViolations,
  } = useSafeIntegerLinter({
    editorRef,
    onFixViolation: (source: string) => `{"$numberLong": "${source}"}`,
    onViolationFixed: () => {
      track('Safe Integer Fix Applied', {
        source: 'document-json-editor',
      });
    },
  });

  // The sticky header always shows the expand/collapse toggle. In edit/delete
  // mode it sits beside the Cancel/Replace (or Delete) controls; otherwise it
  // sits beside the row actions.
  const showEditFooter = editing || deleting;

  const documentFind = (
    <DocumentFind
      ref={findRef}
      className={inlineSearchStyles}
      searchTargetRef={editorRef}
      focusOnMount
      onClose={closeSearch}
      data-testid="document-search"
    />
  );

  return (
    <div
      ref={containerRef}
      data-testid="editable-json"
      className={editableJsonStyles}
    >
      <div
        className={cx(
          stickyHeaderStyles,
          darkMode ? stickyHeaderDarkStyles : stickyHeaderLightStyles
        )}
        data-testid="json-editor-sticky-header"
      >
        {showEditFooter ? (
          <div className={editHeaderRowStyles}>
            <ActionButton
              label={expanded ? 'Collapse all' : 'Expand all'}
              icon={expanded ? 'CaretDown' : 'CaretRight'}
              onClick={toggleExpandCollapse}
              compact
            />
            <ActionButton
              label="Search in document"
              icon="MagnifyingGlass"
              onClick={toggleSearch}
              compact
            />
            {searching && documentFind}
            <div
              className={cx(
                editFooterSlotStyles,
                searching && editFooterSlotBesideSearchStyles
              )}
            >
              <DocumentList.DocumentEditActionsFooter
                doc={doc}
                alwaysForceUpdate={!hasProjection}
                editing={!!editing}
                deleting={!!deleting}
                modified={value !== initialValue}
                validationError={
                  docValidationError ??
                  (safeIntegerViolations.length > 0
                    ? new Error(
                        getSafeIntegerViolationMessage(
                          safeIntegerViolations.length
                        )
                      )
                    : null)
                }
                onUpdate={onUpdate}
                onDelete={onDelete}
                onCancel={onCancel}
                renderStatusMessage={(message) => {
                  return (
                    <div className={bannerContentStyles}>
                      <span>{message}</span>
                      {!docValidationError &&
                        safeIntegerViolations.length > 0 && (
                          <Link
                            as="button"
                            data-testid="fix-safe-integer-violations-button"
                            onClick={onFixSafeIntegerViolations}
                            className={footerActionButtonStyles}
                          >
                            {safeIntegerViolations.length === 1
                              ? 'Convert to Long'
                              : 'Convert all to Long'}
                          </Link>
                        )}
                    </div>
                  );
                }}
              />
            </div>
          </div>
        ) : (
          <div className={viewActionsBarStyles}>
            <ActionButton
              label={expanded ? 'Collapse all' : 'Expand all'}
              icon={expanded ? 'CaretDown' : 'CaretRight'}
              onClick={toggleExpandCollapse}
              compact
            />
            {searching ? (
              documentFind
            ) : (
              <span className={actionsSpacerStyles} />
            )}
            <ActionButton
              label="Search in document"
              icon="MagnifyingGlass"
              onClick={toggleSearch}
            />
            {isEditable && (
              <ActionButton label="Edit" icon="Edit" onClick={onEdit} />
            )}
            {canOpenUpdateModal && (
              <ActionButton
                label="Update document"
                icon="Wrench"
                onClick={onOpenUpdateModal}
              />
            )}
            <ActionButton label="Copy" icon="Copy" onClick={handleCopyAction} />
            {isEditable && (
              <ActionButton label="Clone" icon="Clone" onClick={handleClone} />
            )}
            {isEditable && (
              <ActionButton
                label="Delete"
                icon="Trash"
                onClick={onMarkForDeletion}
              />
            )}
          </div>
        )}
      </div>
      <div className={editorWrapperStyles}>
        <CodemirrorMultilineEditor
          ref={editorRef}
          data-testid="json-editor"
          language="json"
          text={value}
          onChangeText={onChange}
          // The document card renders its own sticky action header, so the
          // editor's built-in floating actions and expand toggle are
          // suppressed here.
          copyable={false}
          formattable={false}
          customActions={[]}
          minLines={3}
          readOnly={!editing}
          showLineNumbers={editing}
          className={editorStyles}
          completer={completer}
          expanded={expanded}
          linter={safeIntegerLinter}
        />
      </div>
    </div>
  );
};

export default JSONEditor;

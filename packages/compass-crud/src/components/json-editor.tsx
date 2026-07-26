import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
} from 'react';
import {
  css,
  cx,
  DocumentList,
  Link,
  palette,
  spacing,
  useCurrentValueRef,
  useDarkMode,
} from '@mongodb-js/compass-components';
import type { Document } from 'hadron-document';
import HadronDocument, { UnsafeIntegerValidationError } from 'hadron-document';
import {
  createDocumentAutocompleter,
  CodemirrorMultilineEditor,
  ActionButton,
} from '@mongodb-js/compass-editor';
import type { EditorRef, Action, Annotation } from '@mongodb-js/compass-editor';
import type { CrudActions } from '../stores/crud-store';
import { useAutocompleteFields } from '@mongodb-js/compass-field-store';

const editorStyles = css({
  minHeight: spacing[800] + spacing[400],
  // Special case only for this view that doesn't make sense to make part of
  // the editor component
  '& .cm-editor': {
    backgroundColor: `${palette.white} !important`,
  },
  '& .cm-gutters': {
    backgroundColor: `${palette.white} !important`,
  },
});

const editorDarkModeStyles = css({
  '& .cm-editor': {
    backgroundColor: `${palette.black} !important`,
  },
  '& .cm-gutters': {
    backgroundColor: `${palette.black} !important`,
  },
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
};

const JSONEditor: React.FunctionComponent<JSONEditorProps> = ({
  namespace,
  doc,
  editable,
  isTimeSeries = false,
  removeDocument,
  replaceDocument,
  copyToClipboard,
  openInsertDocumentDialog,
  openUpdateDocumentModal,
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
  const setModifiedEJSONStringRef = useCurrentValueRef<
    (value: string | null) => void
  >(doc.setModifiedEJSONString.bind(doc));

  useEffect(() => {
    const setModifiedEJSONString = setModifiedEJSONStringRef.current;
    return () => {
      // When this component is used in virtualized list, the editor is
      // unmounted on scroll and if the user is editing the document, the
      // editor value is lost. This is a way to keep track of the editor
      // value when the it's unmounted and is restored on next mount.
      setModifiedEJSONString(editing ? value : null);
    };
  }, [value, editing, setModifiedEJSONStringRef]);

  const handleCopy = useCallback(() => {
    copyToClipboard?.(doc);
  }, [copyToClipboard, doc]);

  const handleClone = useCallback(() => {
    const clonedDoc = doc.generateObject({
      excludeInternalFields: true,
    });
    void openInsertDocumentDialog?.(clonedDoc, true);
  }, [doc, openInsertDocumentDialog]);

  const onChange = useCallback((value: string) => {
    try {
      HadronDocument.FromEJSON(value);
      setDocValidationError(null);
    } catch (error) {
      setDocValidationError(error as Error);
    } finally {
      setValue(value);
    }
  }, []);

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
    openUpdateDocumentModal?.(doc);
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
    const newDoc = HadronDocument.FromEJSON(value || '');
    newDoc.preserveTypes(doc);
    doc.apply(newDoc);
    void replaceDocument?.(doc);
  }, [doc, replaceDocument, value]);

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

  const fields = useAutocompleteFields(namespace);

  const completer = useMemo(() => {
    return createDocumentAutocompleter(
      fields.map((field) => {
        return field.name;
      })
    );
  }, [fields]);

  const isEditable = editable && !deleting && !isTimeSeries;
  // Wrench (Update Document modal) is decoupled from isEditable: the store
  // refetches the full doc by _id on open, so the modal is safe even when a
  // projection is active (in which case the parent passes openUpdateDocumentModal
  // while clearing isEditable).
  const canOpenUpdateModal =
    !!openUpdateDocumentModal && !deleting && !isTimeSeries;

  const actions = useMemo<Action[]>(() => {
    if (editing) {
      return [];
    }

    return [
      isEditable && {
        icon: 'Edit',
        label: 'Edit',
        action() {
          onEdit();
        },
      },
      canOpenUpdateModal && {
        icon: 'Wrench',
        label: 'Update document',
        action() {
          onOpenUpdateModal();
        },
      },
      {
        icon: 'Copy',
        label: 'Copy',
        action() {
          handleCopy();
          return true;
        },
      },
      isEditable && {
        icon: 'Clone',
        label: 'Clone',
        action: handleClone,
      },
      isEditable && {
        icon: 'Trash',
        label: 'Delete',
        action() {
          onMarkForDeletion();
        },
      },
    ].filter(Boolean) as Action[];
  }, [
    editing,
    onEdit,
    onOpenUpdateModal,
    onMarkForDeletion,
    handleClone,
    handleCopy,
    isEditable,
    canOpenUpdateModal,
  ]);

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

  // The sticky header always shows the expand/collapse toggle. In edit/delete
  // mode it sits beside the Cancel/Replace (or Delete) controls; otherwise it
  // sits beside the row actions.
  const showEditFooter = editing || deleting;

  const annotations: Annotation[] = useMemo(() => {
    if (docValidationError instanceof UnsafeIntegerValidationError) {
      return docValidationError.violations.map((violation) => ({
        message:
          'Exceeds safe integer range. Wrap it as {"$numberLong": "..."} to preserve its exact value.',
        from: violation.loc.from,
        to: violation.loc.to,
        severity: 'error',
      }));
    }
    return [];
  }, [docValidationError]);

  const onFixUnsafeIntegerViolations = useCallback(() => {
    const editor = editorRef.current?.editor;
    if (!editor) {
      return;
    }
    if (docValidationError instanceof UnsafeIntegerValidationError) {
      editor.dispatch({
        changes: docValidationError.violations.map((violation) => ({
          from: violation.loc.from,
          to: violation.loc.to,
          insert: `{"$numberLong": "${violation.source}"}`,
        })),
      });
      setDocValidationError(null);
    }
  }, [docValidationError]);

  return (
    <div data-testid="editable-json" className={editableJsonStyles}>
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
            <div className={editFooterSlotStyles}>
              <DocumentList.DocumentEditActionsFooter
                doc={doc}
                alwaysForceUpdate
                editing={!!editing}
                deleting={!!deleting}
                modified={value !== initialValue}
                validationError={docValidationError}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onCancel={onCancel}
                renderStatusMessage={(message) => {
                  return (
                    <div className={bannerContentStyles}>
                      <span>{message}</span>
                      {docValidationError instanceof
                        UnsafeIntegerValidationError && (
                        <Link
                          as="button"
                          data-testid="fix-unsafe-integer-violations-button"
                          onClick={onFixUnsafeIntegerViolations}
                        >
                          Convert to Int64
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
            <span className={actionsSpacerStyles} />
            {actions.map((action) => (
              <ActionButton
                key={action.label}
                icon={action.icon}
                label={action.label}
                onClick={() => {
                  if (!editorRef.current?.editor) {
                    return false;
                  }
                  return action.action(editorRef.current.editor);
                }}
              />
            ))}
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
          className={cx(editorStyles, darkMode && editorDarkModeStyles)}
          completer={completer}
          expanded={expanded}
          annotations={annotations}
        />
      </div>
    </div>
  );
};

export default JSONEditor;

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  css,
  cx,
  spacing,
  palette,
  Label,
  Button,
  Icon,
  IconButton,
  KeylineCard,
  SegmentedControl,
  SegmentedControlOption,
  Modal,
  ModalHeader,
  ModalBody,
  DocumentList,
  useDarkMode,
  useId,
} from '@mongodb-js/compass-components';
import type { Document } from 'hadron-document';
import HadronDocument from 'hadron-document';
import {
  createDocumentAutocompleter,
  CodemirrorMultilineEditor,
} from '@mongodb-js/compass-editor';
import type { EditorRef } from '@mongodb-js/compass-editor';
import { useAutocompleteFields } from '@mongodb-js/compass-field-store';
import type { CrudActions } from '../stores/crud-store';
import EditDocumentFind from './edit-document-find';
import type { EditDocumentFindRef } from './edit-document-find';

type EditMode = 'JSON' | 'Tree';

const bodyStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
  height: '100%',
});

const toolbarStyles = css({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: spacing[200],
});

const toolbarGroupStyles = css({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[200],
});

// The document is presented inside a KeylineCard (the standard Compass card
// primitive, same as the bulk-update modal's editor). These styles only add
// the fill/scroll behaviour: minHeight:0 lets this flex child shrink within
// the bounded body and own the scroll instead of a tall min-height forcing
// the modal to grow; combined with the definite modal height it fills all
// the way down to the footer.
const editorCardStyles = css({
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
});

// Match the bulk-update editor card: light grey in light mode, KeylineCard's
// own default in dark mode.
const editorCardLightStyles = css({
  backgroundColor: palette.gray.light3,
});

const editorCardDarkStyles = css({});

const treeEditorStyles = css({
  padding: spacing[200],
});

// ModalBody is the scroll container, so the toolbar and find bar (which live
// inside it, above the editor) would scroll away with the document. Pin them
// to the top, and pin the actions footer to the bottom, so they stay put
// while only the editor content scrolls underneath. An opaque background is
// required so the scrolling JSON does not show through.
const stickyHeaderStyles = css({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[200],
  paddingBottom: spacing[200],
  backgroundColor: palette.white,
});

const stickyFooterStyles = css({
  position: 'sticky',
  bottom: 0,
  zIndex: 2,
  paddingTop: spacing[200],
  backgroundColor: palette.white,
});

const stickyDarkStyles = css({
  backgroundColor: palette.black,
});

// The underlying LeafyGreen modal is height:auto, so the editor can't fill
// the available space (leaving empty space below it) and the footer floats
// mid-modal. A height:100% chain is fragile through LG's internal wrappers,
// so instead pin a definite height on the dialog and turn it into a flex
// column whose content wrapper grows. LG renders:
//   <dialog className={ours}> <Body as="div"> {ModalHeader}{ModalBody} </Body>
//   <CloseButton/> <portalDiv/> </dialog>
// so the first child div is the Body wrapper we need to flex-grow. Applied
// via the passed-through className so only this modal is affected (the shared
// full-screen styles are reused by other modals).
const modalContentStyles = css({
  height: `calc(100vh - 2 * ${spacing[600]}px)`,
  display: 'flex',
  flexDirection: 'column',
  '& > div:first-of-type': {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
});

// ModalBody is a flex sibling of ModalHeader inside the Body wrapper; grow it
// to fill the remaining height and lay its child out as a flex column so the
// editor's flex:1 has a definite height to expand into. ModalBody's own
// contentStyle hard-caps its height (maxHeight: calc(100vh - spacing[1600]*5),
// ~100vh-320px) which is shorter than our dialog and leaves a dead band below
// the footer; override it so flex:1 can actually fill the dialog.
const modalBodyStyles = css({
  flex: 1,
  minHeight: 0,
  maxHeight: 'none',
  display: 'flex',
  flexDirection: 'column',
});

const noop = () => {
  /* the modal never deletes documents */
};

export type EditDocumentModalProps = {
  isOpen: boolean;
  doc: Document | null;
  namespace: string;
  closeEditDocumentDialog: CrudActions['closeEditDocumentDialog'];
  replaceDocument: CrudActions['replaceDocument'];
  updateDocument: CrudActions['updateDocument'];
};

const EditDocumentModal: React.FunctionComponent<EditDocumentModalProps> = ({
  isOpen,
  doc,
  namespace,
  closeEditDocumentDialog,
  replaceDocument,
  updateDocument,
}) => {
  const darkMode = useDarkMode();
  const editorRef = useRef<EditorRef>(null);
  const findRef = useRef<EditDocumentFindRef>(null);
  const editorId = useId();

  const [mode, setMode] = useState<EditMode>('JSON');
  const [jsonText, setJsonText] = useState('');
  const [initialJson, setInitialJson] = useState('');
  const [validationError, setValidationError] = useState<Error | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(true);
  // Bumped on every open so the editor and find bar fully remount, which
  // clears any prior search and editor state.
  const [renderKey, setRenderKey] = useState(0);
  const wasOpenRef = useRef(false);

  // Opening the modal always resets to a clean, predictable state: the current
  // document loaded as JSON, no errors, JSON mode, full-screen, no search.
  // This runs on the closed -> open transition (including when the modal is
  // mounted already open).
  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current && doc) {
      const ejson = doc.toEJSON();
      setJsonText(ejson);
      setInitialJson(ejson);
      setMode('JSON');
      setValidationError(null);
      setIsFullScreen(true);
      setRenderKey((key) => key + 1);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, doc]);

  const fields = useAutocompleteFields(namespace);
  const completer = useMemo(() => {
    return createDocumentAutocompleter(fields.map((field) => field.name));
  }, [fields]);

  const onChangeJson = useCallback((value: string) => {
    try {
      HadronDocument.FromEJSON(value);
      setValidationError(null);
    } catch (error) {
      setValidationError(error as Error);
    } finally {
      setJsonText(value);
    }
  }, []);

  const onValidate = useCallback(() => {
    try {
      HadronDocument.FromEJSON(jsonText || '');
      setValidationError(null);
    } catch (error) {
      setValidationError(error as Error);
    }
  }, [jsonText]);

  const onModeChange = useCallback(
    (next: string) => {
      const nextMode = next as EditMode;
      if (!doc || nextMode === mode) {
        return;
      }
      if (nextMode === 'Tree') {
        // JSON -> Tree: apply the edited JSON into the structured editor when
        // it is valid. If it cannot be parsed, preserve the current state
        // (stay in JSON, surface the error) rather than losing edits.
        try {
          const parsed = HadronDocument.FromEJSON(jsonText || '');
          parsed.preserveTypes(doc);
          doc.apply(parsed);
          setValidationError(null);
          setMode('Tree');
        } catch (error) {
          setValidationError(error as Error);
        }
      } else {
        // Tree -> JSON: regenerate the JSON text from the current document
        // state so structured edits carry across.
        setJsonText(doc.toEJSON());
        setValidationError(null);
        setMode('JSON');
      }
    },
    [doc, mode, jsonText]
  );

  const onUpdateJson = useCallback(() => {
    if (!doc) {
      return;
    }
    try {
      const newDoc = HadronDocument.FromEJSON(jsonText || '');
      // Preserve the original document's type information so field types are
      // not unintentionally changed by round-tripping through text.
      newDoc.preserveTypes(doc);
      doc.apply(newDoc);
      void replaceDocument(doc);
    } catch (error) {
      setValidationError(error as Error);
    }
  }, [doc, jsonText, replaceDocument]);

  const onUpdateTree = useCallback(
    (force: boolean) => {
      if (!doc) {
        return;
      }
      if (force) {
        void replaceDocument(doc);
      } else {
        void updateDocument(doc);
      }
    },
    [doc, replaceDocument, updateDocument]
  );

  const handleCancel = useCallback(() => {
    closeEditDocumentDialog();
  }, [closeEditDocumentDialog]);

  const onSetOpen = useCallback(
    (open: boolean) => {
      // Closing the modal by any means must end the editing session.
      if (!open) {
        closeEditDocumentDialog();
      }
    },
    [closeEditDocumentDialog]
  );

  // Close the modal once a save succeeds. On save error the modal stays open
  // and the footer surfaces the error so the user can correct and retry.
  React.useEffect(() => {
    if (!doc) {
      return;
    }
    const onUpdateSuccess = () => {
      closeEditDocumentDialog();
    };
    doc.on(HadronDocument.Events.UpdateSuccess, onUpdateSuccess);
    return () => {
      doc.removeListener(HadronDocument.Events.UpdateSuccess, onUpdateSuccess);
    };
  }, [doc, closeEditDocumentDialog]);

  // Ctrl/Cmd+F focuses the find bar, but only while the modal is open in
  // JSON mode (find is intentionally scoped to JSON mode).
  React.useEffect(() => {
    if (!isOpen || mode !== 'JSON') {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === 'f' || event.key === 'F')
      ) {
        event.preventDefault();
        findRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => {
      document.removeEventListener('keydown', handler, true);
    };
  }, [isOpen, mode]);

  return (
    <Modal
      open={isOpen}
      setOpen={onSetOpen}
      fullScreen={isFullScreen}
      className={modalContentStyles}
      data-testid="edit-document-modal"
    >
      <ModalHeader title="Edit Document" subtitle={namespace} />
      <ModalBody className={modalBodyStyles}>
        {doc && (
          <div className={bodyStyles}>
            <div
              className={cx(stickyHeaderStyles, darkMode && stickyDarkStyles)}
            >
              <div className={toolbarStyles}>
                <div className={toolbarGroupStyles}>
                  <Label htmlFor={editorId}>Document Editor</Label>
                  <Button
                    size="small"
                    onClick={onValidate}
                    data-testid="edit-document-validate-button"
                  >
                    Validate
                  </Button>
                </div>
                <div className={toolbarGroupStyles}>
                  <SegmentedControl
                    label="Editor mode"
                    size="small"
                    value={mode}
                    onChange={onModeChange}
                    data-testid="edit-document-mode"
                  >
                    <SegmentedControlOption
                      value="JSON"
                      aria-label="JSON editor"
                      data-testid="edit-document-mode-json"
                      glyph={<Icon glyph="CurlyBraces" />}
                    >
                      JSON
                    </SegmentedControlOption>
                    <SegmentedControlOption
                      value="Tree"
                      aria-label="Tree editor"
                      data-testid="edit-document-mode-tree"
                      glyph={<Icon glyph="Menu" />}
                    >
                      Tree
                    </SegmentedControlOption>
                  </SegmentedControl>
                  <IconButton
                    aria-label={
                      isFullScreen ? 'Exit full screen' : 'Enter full screen'
                    }
                    onClick={() => setIsFullScreen((value) => !value)}
                    data-testid="edit-document-fullscreen-toggle"
                  >
                    <Icon
                      glyph={
                        isFullScreen ? 'FullScreenExit' : 'FullScreenEnter'
                      }
                    />
                  </IconButton>
                </div>
              </div>

              {mode === 'JSON' && (
                <EditDocumentFind
                  key={`find-${renderKey}`}
                  ref={findRef}
                  editorRef={editorRef}
                />
              )}
            </div>

            <KeylineCard
              className={cx(
                editorCardStyles,
                darkMode ? editorCardDarkStyles : editorCardLightStyles
              )}
              data-testid="edit-document-editor-container"
            >
              {mode === 'JSON' ? (
                <CodemirrorMultilineEditor
                  key={`json-${renderKey}`}
                  ref={editorRef}
                  id={editorId}
                  data-testid="edit-document-json-editor"
                  language="json"
                  text={jsonText}
                  onChangeText={onChangeJson}
                  copyable
                  formattable
                  showLineNumbers
                  minLines={10}
                  completer={completer}
                />
              ) : (
                <div
                  className={treeEditorStyles}
                  data-testid="edit-document-tree-editor"
                >
                  <DocumentList.Document value={doc} editable editing />
                </div>
              )}
            </KeylineCard>

            <div
              className={cx(stickyFooterStyles, darkMode && stickyDarkStyles)}
            >
              <DocumentList.DocumentEditActionsFooter
                doc={doc}
                editing
                deleting={false}
                alwaysForceUpdate={mode === 'JSON'}
                modified={
                  mode === 'JSON' ? jsonText !== initialJson : undefined
                }
                validationError={mode === 'JSON' ? validationError : null}
                onUpdate={(force: boolean) => {
                  if (mode === 'JSON') {
                    onUpdateJson();
                  } else {
                    onUpdateTree(force);
                  }
                }}
                onDelete={noop}
                onCancel={handleCancel}
              />
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default EditDocumentModal;

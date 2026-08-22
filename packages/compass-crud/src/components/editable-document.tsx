import React from 'react';
import type { Document } from 'hadron-document';
import HadronDocument from 'hadron-document';
import {
  Button,
  DocumentList,
  Icon,
  css,
  cx,
  palette,
  spacing,
  useDarkMode,
} from '@mongodb-js/compass-components';

import { documentStyles, documentContentStyles } from './readonly-document';
import { getInsightsForDocument } from '../utils';
import type { CrudActions } from '../stores/crud-store';

const documentElementsContainerStyles = css({
  position: 'relative',
});

// Matches the KeylineCard radius so the sticky header clips flush with the
// card's rounded top corners now that document-list-view-item leaves the card
// overflow visible.
const cardBorderRadius = spacing[200];

// When editing, this header pins to the virtualized list's scroll container so
// the expand toggle and Cancel/Replace controls stay reachable while a long
// document scrolls underneath — mirroring the JSON view's sticky header.
const stickyEditHeaderStyles = css({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
  minHeight: spacing[600] + spacing[200],
  paddingLeft: spacing[200],
  overflow: 'hidden',
  borderTopLeftRadius: cardBorderRadius,
  borderTopRightRadius: cardBorderRadius,
});

const stickyEditHeaderLightStyles = css({
  backgroundColor: palette.white,
  borderBottom: `1px solid ${palette.gray.light2}`,
});

const stickyEditHeaderDarkStyles = css({
  backgroundColor: palette.black,
  borderBottom: `1px solid ${palette.gray.dark2}`,
});

// The footer shares the header row with the expand toggle, so it takes the
// remaining width; neutralize its own rounding since the header clips corners.
const editFooterSlotStyles = css({
  flex: 1,
  minWidth: 0,
  '& [data-testid="document-footer"]': {
    borderRadius: 0,
  },
});

// EditableDocument is a class component, so the sticky header lives in a small
// function child to read the current theme via the useDarkMode hook.
const EditDocumentHeader: React.FunctionComponent<{
  doc: Document;
  editing: boolean;
  deleting: boolean;
  expanded: boolean;
  onExpandToggle: () => void;
  onUpdate: (force: boolean) => void;
  onDelete: () => void;
  onCancel: () => void;
}> = ({
  doc,
  editing,
  deleting,
  expanded,
  onExpandToggle,
  onUpdate,
  onDelete,
  onCancel,
}) => {
  const darkMode = useDarkMode();
  return (
    <div
      className={cx(
        stickyEditHeaderStyles,
        darkMode ? stickyEditHeaderDarkStyles : stickyEditHeaderLightStyles
      )}
      data-testid="editable-document-sticky-header"
    >
      <Button
        size="xsmall"
        data-testid="expand-document-button"
        aria-label={expanded ? 'Collapse all' : 'Expand all'}
        aria-pressed={expanded}
        title={expanded ? 'Collapse all' : 'Expand all'}
        rightGlyph={<Icon glyph={expanded ? 'CaretDown' : 'CaretRight'} />}
        onClick={onExpandToggle}
      />
      <div className={editFooterSlotStyles}>
        <DocumentList.DocumentEditActionsFooter
          doc={doc}
          editing={editing}
          deleting={deleting}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};

export type EditableDocumentProps = {
  doc: Document;
  // When false, the component is rendered solely to host the wrench (Update
  // Document modal) action — pencil/clone/trash inline actions are suppressed.
  // This is used when a projection is active: inline editing of a partial doc
  // is unsafe, but the modal refetches the full doc and can still update.
  editable?: boolean;
  // When true, the row-level wrench is suppressed and a per-field wrench is
  // rendered on hover inside each top-level field row instead (handled by
  // DocumentList.Document via onOpenFieldUpdateModal). The store action used
  // by the field wrench scrolls the modal to that field.
  hasProjection?: boolean;
  removeDocument?: CrudActions['removeDocument'];
  replaceDocument?: CrudActions['replaceDocument'];
  updateDocument?: CrudActions['updateDocument'];
  openInsertDocumentDialog?: CrudActions['openInsertDocumentDialog'];
  openUpdateDocumentModal?: CrudActions['openUpdateDocumentModal'];
  copyToClipboard?: CrudActions['copyToClipboard'];
  onUpdateQuery?: (field: string, value: unknown) => void;
  query?: Record<string, unknown>;
};

type EditableDocumentState = {
  editing: boolean;
  deleting: boolean;
  expanded: boolean;
};

/**
 * Component for a single editable document in a list of documents.
 */
class EditableDocument extends React.Component<
  EditableDocumentProps,
  EditableDocumentState
> {
  constructor(props: EditableDocumentProps) {
    super(props);
    this.state = {
      editing: props.doc.editing,
      deleting: props.doc.markedForDeletion,
      expanded: props.doc.expanded,
    };
  }

  /**
   * Subscribe to the update store on mount.
   */
  componentDidMount() {
    this.subscribeToDocumentEvents(this.props.doc);
  }

  /**
   * Refreshing the list updates the doc in the props so we should update the
   * document on the instance.
   *
   * @param {Object} prevProps - The previous props.
   */
  componentDidUpdate(prevProps: EditableDocumentProps) {
    if (prevProps.doc !== this.props.doc) {
      this.unsubscribeFromDocumentEvents(prevProps.doc);
      this.subscribeToDocumentEvents(this.props.doc);
      if (this.state.editing || this.state.deleting) {
        // If the underlying document changed, that means that the collection
        // contents have been refreshed. In that case, stop editing/deleting.
        setTimeout(() => {
          this.setState({ editing: false, deleting: false });
        });
      }
    }
  }

  /**
   * Unsubscribe from the update store on unmount.
   */
  componentWillUnmount() {
    this.unsubscribeFromDocumentEvents(this.props.doc);
  }

  /**
   * Subscribe to the hadron document events.
   *
   * @param {Document} doc - The hadron document.
   */
  subscribeToDocumentEvents(doc: Document) {
    doc.on(HadronDocument.Events.Cancel, this.handleCancel);
    doc.on(HadronDocument.Events.Expanded, this.handleExpanded);
    doc.on(HadronDocument.Events.Collapsed, this.handleCollapsed);
    doc.on(HadronDocument.Events.EditingStarted, this.handleEditingStarted);
    doc.on(HadronDocument.Events.EditingFinished, this.handleEditingFinished);
    doc.on(HadronDocument.Events.MarkedForDeletion, this.handleDeletionStarted);
    doc.on(HadronDocument.Events.DeletionFinished, this.handleDeletionFinished);
  }

  /**
   * Unsubscribe from the hadron document events.
   *
   * @param {Document} doc - The hadron document.
   */
  unsubscribeFromDocumentEvents(doc: Document) {
    doc.removeListener(HadronDocument.Events.Cancel, this.handleCancel);
    doc.removeListener(HadronDocument.Events.Expanded, this.handleExpanded);
    doc.removeListener(HadronDocument.Events.Collapsed, this.handleCollapsed);
    doc.removeListener(
      HadronDocument.Events.EditingStarted,
      this.handleEditingStarted
    );
    doc.removeListener(
      HadronDocument.Events.EditingFinished,
      this.handleEditingFinished
    );
    doc.removeListener(
      HadronDocument.Events.MarkedForDeletion,
      this.handleDeletionStarted
    );
    doc.removeListener(
      HadronDocument.Events.DeletionFinished,
      this.handleDeletionFinished
    );
  }

  /**
   * Handle copying JSON to clipboard of the document.
   */
  handleCopy() {
    this.props.copyToClipboard?.(this.props.doc, 'shell-syntax');
  }

  /**
   * Handle cloning of the document.
   */
  handleClone() {
    const clonedDoc = this.props.doc.generateObject({
      excludeInternalFields: true,
    });
    void this.props.openInsertDocumentDialog?.(clonedDoc, true);
  }

  /**
   * Handles canceling edits to the document.
   */
  handleCancel = () => {
    if (this.state.editing) {
      this.props.doc.finishEditing();
    } else if (this.state.deleting) {
      this.props.doc.finishDeletion();
    }
  };

  /**
   * Handles document deletion.
   */
  handleDelete() {
    this.props.doc.markForDeletion();
  }

  handleDeletionStarted = () => {
    this.setState({
      editing: false,
      deleting: true,
    });
  };

  handleDeletionFinished = () => {
    this.setState({
      deleting: false,
    });
  };

  /**
   * Handle clicking the expand all button.
   */
  handleExpandAll() {
    const { doc } = this.props;
    if (this.state.expanded) {
      doc.collapse();
    } else {
      doc.expand();
    }
  }

  handleExpanded = () => {
    this.setState({ expanded: true });
  };

  handleCollapsed = () => {
    this.setState({ expanded: false });
  };

  /**
   * Handle the edit click - enters inline editing in the row.
   */
  handleStartEditing() {
    this.props.doc.startEditing();
  }

  /**
   * Handle clicking the pencil to edit the whole document. Fully reveal the
   * document first — unfold every nested branch (doc.expand) and lift the
   * "Show N more fields" cap (setMaxVisibleElementsCount) — so all fields are
   * visible and editable without extra clicks.
   */
  handleEditDocument = () => {
    const { doc } = this.props;
    doc.expand();
    doc.setMaxVisibleElementsCount(doc.elements.size);
    doc.startEditing();
  };

  // The Update Document modal also starts an editing session on the same
  // HadronDocument (needed by its tree editor + cancel revert), which fires
  // EditingStarted. The Reflux action dispatches async via nextTick, so we
  // hold this flag set from the click until EditingFinished (modal close)
  // and ignore any EditingStarted that fires in between - so the row stays
  // in read-only display behind the modal.
  private suppressEditingStartedNotice = false;

  handleOpenUpdateModal() {
    this.suppressEditingStartedNotice = true;
    void this.props.openUpdateDocumentModal?.(this.props.doc);
  }

  handleOpenFieldUpdateModal = (fieldPath: string) => {
    this.suppressEditingStartedNotice = true;
    void this.props.openUpdateDocumentModal?.(this.props.doc, fieldPath);
  };

  /**
   * Update state when editing starts
   */
  handleEditingStarted = () => {
    if (this.suppressEditingStartedNotice) return;
    this.setState({ editing: true });
  };

  /**
   * Update state when editing starts
   */
  handleEditingFinished = () => {
    this.suppressEditingStartedNotice = false;
    this.setState({
      editing: false,
    });
  };

  /**
   * Render the actions component.
   *
   * @returns {Component} The actions component.
   */
  renderActions() {
    if (!this.state.editing && !this.state.deleting) {
      // editable defaults to true for backwards compatibility — explicit false
      // means the row is rendered only to host the wrench (e.g. projection
      // active), so inline pencil/clone/trash are suppressed.
      const inlineEditable = this.props.editable !== false;
      // In projection mode the wrench moves onto each field row (rendered by
      // HadronElement via onOpenFieldUpdateModal), so suppress the row-corner
      // wrench to avoid the two competing for the same action.
      const canOpenUpdateModal =
        Boolean(this.props.openUpdateDocumentModal) &&
        !this.props.hasProjection;
      return (
        <DocumentList.DocumentActionsGroup
          sticky
          onEdit={inlineEditable ? this.handleEditDocument : undefined}
          onOpenUpdateModal={
            canOpenUpdateModal
              ? this.handleOpenUpdateModal.bind(this)
              : undefined
          }
          onCopy={this.handleCopy.bind(this)}
          onRemove={inlineEditable ? this.handleDelete.bind(this) : undefined}
          onClone={inlineEditable ? this.handleClone.bind(this) : undefined}
          onExpand={this.handleExpandAll.bind(this)}
          expanded={this.state.expanded}
          insights={getInsightsForDocument(this.props.doc)}
        />
      );
    }
  }

  /**
   * Get the elements for the document. If we are editing, we get editable elements,
   * otherwise the readonly elements are returned.
   *
   * @returns {Array} The elements.
   */
  renderElements() {
    // In projection mode, wire the per-field wrench. Only enable when the
    // user actually has the update modal available (i.e. write-capable) —
    // otherwise the field rows would surface an action that does nothing.
    const fieldWrenchEnabled =
      this.props.hasProjection && !!this.props.openUpdateDocumentModal;
    return (
      <DocumentList.Document
        value={this.props.doc}
        editable
        editing={this.state.editing}
        onEditStart={this.handleStartEditing.bind(this)}
        onUpdateQuery={this.props.onUpdateQuery}
        query={this.props.query}
        onOpenFieldUpdateModal={
          fieldWrenchEnabled ? this.handleOpenFieldUpdateModal : undefined
        }
      />
    );
  }

  /**
   * Render a single document list item.
   *
   * @returns {React.Component} The component.
   */
  render() {
    // The card always carries a sticky header pinned to the top of the
    // virtualized list's scroll container, so its controls stay reachable while
    // a long document scrolls underneath (mirroring the JSON view). In view
    // mode it hosts the expand toggle + row actions (edit/update/copy/clone/
    // delete); in edit/delete mode it hosts the expand toggle + Cancel/Replace.
    const showEditHeader = this.state.editing || this.state.deleting;
    return (
      <div className={documentStyles} data-testid="editable-document">
        {showEditHeader ? (
          <EditDocumentHeader
            doc={this.props.doc}
            editing={this.state.editing}
            deleting={this.state.deleting}
            expanded={this.state.expanded}
            onExpandToggle={this.handleExpandAll.bind(this)}
            onUpdate={(force) => {
              if (force) {
                void this.props.replaceDocument?.(this.props.doc);
              } else {
                void this.props.updateDocument?.(this.props.doc);
              }
            }}
            onDelete={() => {
              void this.props.removeDocument?.(this.props.doc);
            }}
            onCancel={() => {
              this.handleCancel();
            }}
          />
        ) : (
          this.renderActions()
        )}
        <div className={documentContentStyles}>
          <div
            className={documentElementsContainerStyles}
            data-testid="editable-document-elements"
          >
            {this.renderElements()}
          </div>
        </div>
      </div>
    );
  }

  static displayName = 'EditableDocument';
}

export default EditableDocument;

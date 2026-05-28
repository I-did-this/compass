import React from 'react';
import type { Document } from 'hadron-document';
import HadronDocument from 'hadron-document';
import { DocumentList, css } from '@mongodb-js/compass-components';
import { withPreferences } from 'compass-preferences-model/provider';

import { documentStyles, documentContentStyles } from './readonly-document';
import { getInsightsForDocument } from '../utils';
import type { CrudActions } from '../stores/crud-store';

const documentElementsContainerStyles = css({
  position: 'relative',
});

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
  showInsights?: boolean;
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
    this.props.copyToClipboard?.(this.props.doc);
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
          onEdit={
            inlineEditable ? this.handleStartEditing.bind(this) : undefined
          }
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
          insights={
            this.props.showInsights
              ? getInsightsForDocument(this.props.doc)
              : undefined
          }
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
   * Render the footer component.
   *
   * @returns {Component} The footer component.
   */
  renderFooter() {
    return (
      <DocumentList.DocumentEditActionsFooter
        doc={this.props.doc}
        editing={this.state.editing}
        deleting={this.state.deleting}
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
    );
  }

  /**
   * Render a single document list item.
   *
   * @returns {React.Component} The component.
   */
  render() {
    return (
      <div className={documentStyles} data-testid="editable-document">
        <div className={documentContentStyles}>
          <div
            className={documentElementsContainerStyles}
            data-testid="editable-document-elements"
          >
            {this.renderElements()}
          </div>
          {this.renderActions()}
        </div>
        {this.renderFooter()}
      </div>
    );
  }

  static displayName = 'EditableDocument';
}

export default withPreferences(EditableDocument, ['showInsights']);

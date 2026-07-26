import React from 'react';
import { render, screen, userEvent } from '@mongodb-js/testing-library-compass';
import HadronDocument from 'hadron-document';
import { expect } from 'chai';
import sinon from 'sinon';

import EditableDocument from './editable-document';

describe('<EditableDocument />', function () {
  describe('render', function () {
    const doc = { a: 1, b: 2, c: null };

    beforeEach(function () {
      render(
        <EditableDocument
          doc={new HadronDocument(doc)}
          removeDocument={sinon.spy()}
          replaceDocument={sinon.spy()}
          updateDocument={sinon.spy()}
          copyToClipboard={sinon.spy()}
          openInsertDocumentDialog={sinon.spy()}
        />
      );
    });

    it('renders the list div', function () {
      const component = screen.getByTestId('editable-document');
      expect(component).to.exist;
    });

    it('renders the base element list', function () {
      const component = screen.getByTestId('editable-document-elements');
      expect(component).to.exist;
    });

    it('renders an editable element for each document element', function () {
      const components = screen.getAllByTestId('hadron-document-element');
      expect(components).to.have.lengthOf(3);
    });
  });

  describe('edit routing', function () {
    function renderRow(
      doc: HadronDocument,
      openUpdateDocumentModal = sinon.spy()
    ) {
      render(
        <EditableDocument
          doc={doc}
          removeDocument={sinon.spy()}
          replaceDocument={sinon.spy()}
          updateDocument={sinon.spy()}
          copyToClipboard={sinon.spy()}
          openInsertDocumentDialog={sinon.spy()}
          openUpdateDocumentModal={openUpdateDocumentModal}
        />
      );
      return { openUpdateDocumentModal };
    }

    it('pencil button enters the inline edit state without opening the modal', function () {
      const doc = new HadronDocument({ a: 1 });
      const startEditing = sinon.spy(doc, 'startEditing');
      const { openUpdateDocumentModal } = renderRow(doc);

      userEvent.click(screen.getByTestId('edit-document-button'));

      expect(startEditing).to.have.been.calledOnce;
      expect(openUpdateDocumentModal).to.not.have.been.called;
    });

    it('wrench button opens the update modal without entering inline edit', function () {
      const doc = new HadronDocument({ a: 1 });
      const startEditing = sinon.spy(doc, 'startEditing');
      const { openUpdateDocumentModal } = renderRow(doc);

      userEvent.click(screen.getByTestId('open-update-document-modal-button'));

      expect(openUpdateDocumentModal).to.have.been.calledOnceWith(doc);
      expect(startEditing).to.not.have.been.called;
    });

    it('row stays in read-only display even though the modal action starts an editing session on the same doc', function () {
      const doc = new HadronDocument({ a: 1 });
      // Simulate what the real crud-store openUpdateDocumentModal does: it
      // calls doc.startEditing() under the hood, which fires EditingStarted
      // on the row's listener. The row should ignore that one event so it
      // doesn't render the inline-edit footer behind the modal.
      const openUpdateDocumentModal = sinon.spy((d: HadronDocument) => {
        d.startEditing();
      });
      renderRow(doc, openUpdateDocumentModal);

      userEvent.click(screen.getByTestId('open-update-document-modal-button'));

      expect(openUpdateDocumentModal).to.have.been.calledOnceWith(doc);
      expect(screen.queryByTestId('document-footer')).to.not.exist;
    });
  });

  describe('sticky edit header', function () {
    function renderRow(doc: HadronDocument) {
      render(
        <EditableDocument
          doc={doc}
          removeDocument={sinon.spy()}
          replaceDocument={sinon.spy()}
          updateDocument={sinon.spy()}
          copyToClipboard={sinon.spy()}
          openInsertDocumentDialog={sinon.spy()}
        />
      );
    }

    it('fully reveals the document when the pencil is clicked', function () {
      const doc = new HadronDocument({ a: 1, b: 2, c: 3 });
      const expand = sinon.spy(doc, 'expand');
      const setMaxVisible = sinon.spy(doc, 'setMaxVisibleElementsCount');
      renderRow(doc);

      userEvent.click(screen.getByTestId('edit-document-button'));

      // Nested branches are unfolded and the "Show N more fields" cap is
      // lifted so the whole document is visible and editable.
      expect(expand).to.have.been.called;
      expect(setMaxVisible).to.have.been.calledWith(doc.elements.size);
    });

    it('hosts the expand toggle beside Cancel/Replace in a sticky header while editing', function () {
      const doc = new HadronDocument({ a: 1 });
      renderRow(doc);

      userEvent.click(screen.getByTestId('edit-document-button'));

      const header = screen.getByTestId('editable-document-sticky-header');
      expect(header).to.exist;
      expect(screen.getByTestId('expand-document-button')).to.exist;
      expect(screen.getByTestId('cancel-button')).to.exist;
      expect(screen.getByTestId('update-button')).to.exist;
    });
  });

  describe('sticky view actions', function () {
    it('shows expand, edit, update, copy, clone and delete actions in view mode', function () {
      const doc = new HadronDocument({ a: 1 });
      render(
        <EditableDocument
          doc={doc}
          removeDocument={sinon.spy()}
          replaceDocument={sinon.spy()}
          updateDocument={sinon.spy()}
          copyToClipboard={sinon.spy()}
          openInsertDocumentDialog={sinon.spy()}
          openUpdateDocumentModal={sinon.spy()}
        />
      );

      // In view mode the row actions live in the sticky header (always
      // visible, like the JSON view) rather than a hover-only overlay.
      expect(screen.getByTestId('expand-document-button')).to.exist;
      expect(screen.getByTestId('edit-document-button')).to.exist;
      expect(screen.getByTestId('open-update-document-modal-button')).to.exist;
      expect(screen.getByTestId('copy-document-button')).to.exist;
      expect(screen.getByTestId('clone-document-button')).to.exist;
      expect(screen.getByTestId('remove-document-button')).to.exist;
    });
  });
});

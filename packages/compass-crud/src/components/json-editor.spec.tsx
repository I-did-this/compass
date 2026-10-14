import React, { type ComponentProps } from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@mongodb-js/testing-library-compass';
import JSONEditor from './json-editor';
import HadronDocument from 'hadron-document';
import { setCodemirrorEditorValue } from '@mongodb-js/compass-editor';

function renderJSONEditor(
  props: Partial<ComponentProps<typeof JSONEditor>> = {},
  { editing = true }: { editing?: boolean } = {}
) {
  const doc = new HadronDocument({ _id: 1, name: 'test' });
  doc.editing = editing;
  return render(
    <JSONEditor doc={doc} editable namespace="airbnb.listings" {...props} />
  );
}

describe('JSONEditor', function () {
  context('sticky action header', function () {
    it('renders the row actions in the sticky header in view mode', function () {
      renderJSONEditor(
        { openUpdateDocumentModal: () => {} },
        { editing: false }
      );
      expect(screen.getByTestId('json-editor-sticky-header')).to.exist;
      expect(screen.getByTestId('editor-action-Edit')).to.exist;
      expect(screen.getByTestId('editor-action-Copy')).to.exist;
      // The expand/collapse toggle stays in the header and is not hidden.
      expect(
        screen.queryByTestId('editor-action-Expand all') ??
          screen.queryByTestId('editor-action-Collapse all')
      ).to.exist;
    });

    it('keeps the expand toggle beside Cancel/Replace in the header while editing', function () {
      renderJSONEditor({}, { editing: true });
      const header = screen.getByTestId('json-editor-sticky-header');
      expect(header).to.exist;
      // Row action icons (Edit/Copy/etc.) are hidden in edit mode...
      expect(screen.queryByTestId('editor-action-Edit')).to.be.null;
      // ...replaced by the edit controls in the same (sticky) place.
      expect(screen.getByTestId('cancel-button')).to.exist;
      expect(screen.getByTestId('update-button')).to.exist;
      // ...but the expand/collapse toggle stays put next to them rather than
      // being hidden behind the Cancel/Replace controls.
      expect(
        screen.queryByTestId('editor-action-Expand all') ??
          screen.queryByTestId('editor-action-Collapse all')
      ).to.exist;
    });
  });

  context('with a projection', function () {
    it('shows the Edit action', function () {
      renderJSONEditor({ hasProjection: true }, { editing: false });
      expect(screen.getByTestId('editor-action-Edit')).to.exist;
    });

    it('saves only the edited fields instead of replacing the document', async function () {
      const updateDocument = sinon.spy();
      const replaceDocument = sinon.spy();
      renderJSONEditor({
        hasProjection: true,
        updateDocument,
        replaceDocument,
      });

      await setCodemirrorEditorValue(
        screen.getByTestId('json-editor'),
        '{ "_id": 1, "name": "changed" }'
      );
      userEvent.click(screen.getByTestId('update-button'));

      expect(updateDocument).to.have.been.calledOnce;
      expect(replaceDocument).to.not.have.been.called;
    });
  });

  context('search in document', function () {
    it('opens a search bar that counts matches in the document', async function () {
      renderJSONEditor(
        {
          doc: new HadronDocument({
            _id: 1,
            email: 'nehal@callhippo.com',
            profile: { firstName: 'NEHAL' },
          }),
        },
        { editing: false }
      );

      userEvent.click(screen.getByTestId('editor-action-Search in document'));
      const input = await screen.findByTestId('document-search-input');
      userEvent.type(input, 'nehal');

      await waitFor(() => {
        expect(screen.getByTestId('document-search-counter')).to.have.text(
          '1 of 2'
        );
      });
    });

    it('can search while the document is being edited', async function () {
      const doc = new HadronDocument({
        _id: 1,
        email: 'nehal@callhippo.com',
        profile: { firstName: 'NEHAL' },
      });
      doc.editing = true;
      renderJSONEditor({ doc });

      userEvent.click(screen.getByTestId('editor-action-Search in document'));
      const input = await screen.findByTestId('document-search-input');
      userEvent.type(input, 'nehal');

      await waitFor(() => {
        expect(screen.getByTestId('document-search-counter')).to.have.text(
          '1 of 2'
        );
      });
      expect(screen.getByTestId('update-button')).to.exist;
    });
  });

  context('shows error messages', function () {
    it('shows error message for invalid JSON', async function () {
      renderJSONEditor();
      await setCodemirrorEditorValue(
        screen.getByTestId('json-editor'),
        '{ "name": } '
      );
      const errorMessage = await screen.findByText(/unexpected token/i);
      expect(errorMessage).to.exist;
    });
    it('show error message for valid EJSON', async function () {
      renderJSONEditor();
      await setCodemirrorEditorValue(
        screen.getByTestId('json-editor'),
        '{ "invalid_long": { "$numberLong": "1234567234324812317654321" } } '
      );
      const errorMessage = await screen.findByText(
        /numberLong string is too long/i
      );
      expect(errorMessage).to.exist;
    });
  });
});

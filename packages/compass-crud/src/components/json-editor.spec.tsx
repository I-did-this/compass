import React, { type ComponentProps } from 'react';
import { expect } from 'chai';
import { render, screen } from '@mongodb-js/testing-library-compass';
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

    it('hides row actions and shows Cancel/Replace in the header while editing', function () {
      renderJSONEditor({}, { editing: true });
      const header = screen.getByTestId('json-editor-sticky-header');
      expect(header).to.exist;
      // Row action icons are hidden in edit mode...
      expect(screen.queryByTestId('editor-action-Edit')).to.be.null;
      // ...replaced by the edit controls in the same (sticky) place.
      expect(screen.getByTestId('cancel-button')).to.exist;
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

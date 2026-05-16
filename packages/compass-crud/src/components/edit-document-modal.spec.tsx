import React, { type ComponentProps } from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@mongodb-js/testing-library-compass';
import { setCodemirrorEditorValue } from '@mongodb-js/compass-editor';
import HadronDocument from 'hadron-document';
import { ObjectId } from 'bson';
import EditDocumentModal from './edit-document-modal';

function makeDoc() {
  return new HadronDocument({
    _id: new ObjectId(),
    name: 'original',
    count: 1,
  });
}

function clickMode(mode: 'json' | 'tree') {
  const option = screen.getByTestId(`edit-document-mode-${mode}`);
  const button: Element =
    option.tagName === 'BUTTON'
      ? option
      : option.querySelector('button') ?? option;
  userEvent.click(button);
}

function isDisabled(el: HTMLElement): boolean {
  return (
    el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
  );
}

function renderModal(
  props: Partial<ComponentProps<typeof EditDocumentModal>> = {}
) {
  const doc = props.doc ?? makeDoc();
  const spies = {
    closeEditDocumentDialog: sinon.spy(),
    replaceDocument: sinon.spy(),
    updateDocument: sinon.spy(),
  };
  const result = render(
    <EditDocumentModal
      isOpen
      doc={doc}
      namespace="airbnb.listings"
      {...spies}
      {...props}
    />
  );
  return { ...result, doc, ...spies };
}

describe('EditDocumentModal', function () {
  it('renders the modal with title, namespace subtitle and JSON mode by default', async function () {
    renderModal();
    expect(await screen.findByText('Edit Document')).to.exist;
    expect(screen.getByText('airbnb.listings')).to.exist;
    expect(await screen.findByTestId('edit-document-json-editor')).to.exist;
    // Find bar is shown in JSON mode
    expect(screen.getByTestId('edit-document-find')).to.exist;
  });

  it('continuously validates JSON and gates saving on invalid documents', async function () {
    renderModal();
    const editor = await screen.findByTestId('edit-document-json-editor');

    await setCodemirrorEditorValue(editor, '{ "name": } ');

    // Error is surfaced in the single feedback banner
    expect(await screen.findByText(/unexpected token/i)).to.exist;
    // Update is disabled while there is an unresolved validation error
    await waitFor(() => {
      expect(isDisabled(screen.getByTestId('update-button'))).to.be.true;
    });
  });

  it('clears the error when Validate is run against a valid document', async function () {
    renderModal();
    const editor = await screen.findByTestId('edit-document-json-editor');
    await setCodemirrorEditorValue(editor, '{ "name": } ');
    expect(await screen.findByText(/unexpected token/i)).to.exist;

    await setCodemirrorEditorValue(editor, '{ "name": "valid" }');
    userEvent.click(screen.getByTestId('edit-document-validate-button'));

    await waitFor(() => {
      expect(screen.queryByText(/unexpected token/i)).to.not.exist;
    });
  });

  it('carries edits across when switching JSON -> Tree -> JSON', async function () {
    renderModal();
    const editor = await screen.findByTestId('edit-document-json-editor');
    await setCodemirrorEditorValue(
      editor,
      '{ "name": "original", "addedField": 42 }'
    );

    clickMode('tree');

    // Tree editor is shown and reflects the added field. Field keys render as
    // input values in the structured editor, not plain text nodes.
    const tree = await screen.findByTestId('edit-document-tree-editor');
    await waitFor(() => {
      const inputs = Array.from(tree.querySelectorAll('input'));
      expect(inputs.some((input) => input.value === 'addedField')).to.be.true;
    });
    // Find bar is intentionally JSON-only
    expect(screen.queryByTestId('edit-document-find')).to.not.exist;

    clickMode('json');
    const jsonEditor = await screen.findByTestId('edit-document-json-editor');
    await waitFor(() => {
      expect(jsonEditor.textContent).to.contain('addedField');
    });
  });

  it('preserves the current state when JSON is invalid at switch time', async function () {
    renderModal();
    const editor = await screen.findByTestId('edit-document-json-editor');
    await setCodemirrorEditorValue(editor, '{ "name": ');

    clickMode('tree');

    // Stays in JSON mode (no tree editor) and surfaces the error
    expect(screen.queryByTestId('edit-document-tree-editor')).to.not.exist;
    expect(await screen.findByTestId('edit-document-json-editor')).to.exist;
    expect(await screen.findByText(/unexpected token|end of/i)).to.exist;
  });

  it('replaces the document and preserves original field types on JSON save', async function () {
    const { doc, replaceDocument } = renderModal();
    const originalId = doc.generateObject()._id;
    const editor = await screen.findByTestId('edit-document-json-editor');

    await setCodemirrorEditorValue(
      editor,
      `{ "_id": { "$oid": "${String(
        originalId
      )}" }, "name": "changed", "count": 1 }`
    );

    await waitFor(() => {
      expect(isDisabled(screen.getByTestId('update-button'))).to.be.false;
    });
    userEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(replaceDocument).to.have.been.calledOnce;
    });
    const savedDoc = replaceDocument.firstCall.args[0];
    const savedObject = savedDoc.generateObject();
    expect(savedObject._id).to.be.instanceOf(ObjectId);
    expect(savedObject.name).to.equal('changed');
  });

  it('ends the editing session when cancelled', async function () {
    const { closeEditDocumentDialog } = renderModal();
    const cancel = await screen.findByTestId('cancel-button');
    userEvent.click(cancel);
    expect(closeEditDocumentDialog).to.have.been.called;
  });

  it('disables find navigation when there are no matches', async function () {
    renderModal();
    await screen.findByTestId('edit-document-json-editor');
    expect(isDisabled(screen.getByTestId('edit-document-find-next'))).to.be
      .true;
    expect(isDisabled(screen.getByTestId('edit-document-find-previous'))).to.be
      .true;
  });
});

import chai from 'chai';
import type { CompassBrowser } from '../helpers/compass-browser.ts';
import {
  init,
  cleanup,
  screenshotIfFailed,
  getDefaultConnectionNames,
} from '../helpers/compass.ts';
import type { Compass } from '../helpers/compass.ts';
import * as Selectors from '../helpers/selectors.ts';
import { createNumbersCollection } from '../helpers/mongo-clients.ts';

const { expect } = chai;

/**
 * End-to-end coverage for the Update Document modal that replaced the old
 * inline document-editing flow (commit a3ffa4aed). Each test seeds the
 * `test.numbers` collection ({ i, j: 0 }), opens the modal from the list
 * view, exercises one capability, and verifies the effect.
 */
async function openEditModalFor(browser: CompassBrowser, query: string) {
  await browser.runFindOperation('Documents', query);
  const docEntry = browser.$(Selectors.DocumentListEntry);
  await docEntry.waitForDisplayed();
  await docEntry.scrollIntoView();
  // The row actions only render while the row is hovered, and a single hover
  // can be lost on a virtualized re-render. Re-hover and retry until the
  // wrench (modal-opening) button is actually displayed, then click it.
  // The pencil (EditDocumentButton) is the inline editor — distinct action.
  await browser.waitUntil(async () => {
    await browser.hover(Selectors.DocumentListEntry);
    const wrenchButton = browser.$(Selectors.OpenUpdateDocumentModalButton);
    if (!(await wrenchButton.isDisplayed())) {
      return false;
    }
    await wrenchButton.click();
    return true;
  });
  await browser.$(Selectors.UpdateDocumentModal).waitForDisplayed();
}

async function readModalJson(browser: CompassBrowser): Promise<string> {
  return browser.getCodemirrorEditorText(
    Selectors.UpdateDocumentModalJSONEditor
  );
}

describe('Update Document modal', function () {
  let compass: Compass;
  let browser: CompassBrowser;

  before(async function () {
    compass = await init(this.test?.fullTitle());
    browser = compass.browser;
    await browser.setupDefaultConnections();
  });

  beforeEach(async function () {
    await createNumbersCollection();
    await browser.disconnectAll();
    await browser.connectToDefaults();
    await browser.navigateToCollectionTab(
      getDefaultConnectionNames(0),
      'test',
      'numbers',
      'Documents'
    );
  });

  after(async function () {
    await cleanup(compass);
  });

  afterEach(async function () {
    await screenshotIfFailed(compass, this.currentTest);
  });

  it('opens from the list view and persists a JSON edit', async function () {
    await openEditModalFor(browser, '{ i: 5 }');

    // Defaults to JSON mode with the document loaded as Extended JSON.
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();
    const json = await readModalJson(browser);
    expect(json.replace(/\s+/g, ' ')).to.match(
      /\{ "_id": \{ "\$oid": "[a-f0-9]{24}" \}, "i": 5, "j": 0 \}/
    );

    const edited = JSON.stringify({ ...JSON.parse(json), j: 555 });
    await browser.setCodemirrorEditorValue(
      Selectors.UpdateDocumentModalJSONEditor,
      edited
    );

    const footer = browser.$(
      Selectors.UpdateDocumentModal + ' ' + Selectors.DocumentFooter
    );
    await browser.waitUntil(async () => {
      return (await footer.getAttribute('data-status')) === 'Modified';
    });

    await browser.clickVisible(Selectors.UpdateDocumentModalUpdateButton);
    // A successful save closes the modal.
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });

    await browser.runFindOperation('Documents', '{ i: 5 }');
    await browser.clickVisible(Selectors.SelectJSONView);
    const persisted = browser.$(Selectors.DocumentJSONEntry);
    await persisted.waitForDisplayed();
    await browser.waitUntil(async () => {
      const text = await browser.getCodemirrorEditorText(
        Selectors.DocumentJSONEntry
      );
      return /"j":\s*555/.test(text);
    });
  });

  it('shows the footer actions and the copy button on open (before any edit)', async function () {
    await openEditModalFor(browser, '{ i: 9 }');
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();

    // The Cancel/Update footer must be visible immediately, before any
    // modification (regression guard: full-screen layout used to push it
    // below the viewport).
    await browser
      .$(Selectors.UpdateDocumentModalCancelButton)
      .waitForDisplayed();
    await browser
      .$(Selectors.UpdateDocumentModalUpdateButton)
      .waitForDisplayed();
    // Copy is re-enabled on the JSON editor. The editor's action buttons are
    // display:none until the editor is hovered/focused (by design), so hover
    // it first, then assert the Copy action is available.
    await browser.hover(Selectors.UpdateDocumentModalJSONEditor);
    await browser.$(Selectors.UpdateDocumentModalCopyButton).waitForDisplayed();

    await browser.clickVisible(Selectors.UpdateDocumentModalCancelButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });
  });

  it('expands the editor to fill the modal height', async function () {
    await openEditModalFor(browser, '{ i: 10 }');
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();

    const modalSize = await browser.$(Selectors.UpdateDocumentModal).getSize();
    const editorSize = await browser
      .$(Selectors.UpdateDocumentModalEditorContainer)
      .getSize();

    // Regression guard: the editor must fill most of the modal. It used to be
    // clamped ~270px short by ModalBody's maxHeight cap, leaving a dead band
    // below the footer. The threshold is generous so it stays robust across
    // window sizes while still failing if the editor collapses again.
    expect(editorSize.height).to.be.greaterThan(modalSize.height * 0.6);

    await browser.clickVisible(Selectors.UpdateDocumentModalCancelButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });
  });

  it('carries edits across the JSON <-> Tree mode switch', async function () {
    await openEditModalFor(browser, '{ i: 6 }');

    const json = await readModalJson(browser);
    const edited = JSON.stringify({ ...JSON.parse(json), j: 111 });
    await browser.setCodemirrorEditorValue(
      Selectors.UpdateDocumentModalJSONEditor,
      edited
    );

    // JSON -> Tree applies the edited JSON into the structured editor.
    await browser.clickVisible(Selectors.UpdateDocumentModalModeTree);
    await browser.$(Selectors.UpdateDocumentModalTreeEditor).waitForDisplayed();

    // Tree -> JSON regenerates the text; the edit must survive the round-trip.
    await browser.clickVisible(Selectors.UpdateDocumentModalModeJSON);
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();
    await browser.waitUntil(async () => {
      return /"j":\s*111/.test(await readModalJson(browser));
    });

    await browser.clickVisible(Selectors.UpdateDocumentModalUpdateButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });

    await browser.runFindOperation('Documents', '{ i: 6 }');
    await browser.clickVisible(Selectors.SelectJSONView);
    await browser.$(Selectors.DocumentJSONEntry).waitForDisplayed();
    await browser.waitUntil(async () => {
      const text = await browser.getCodemirrorEditorText(
        Selectors.DocumentJSONEntry
      );
      return /"j":\s*111/.test(text);
    });
  });

  it('blocks saving invalid JSON and surfaces a validation error', async function () {
    await openEditModalFor(browser, '{ i: 7 }');

    await browser.setCodemirrorEditorValue(
      Selectors.UpdateDocumentModalJSONEditor,
      '{ this is not valid json }'
    );

    const footer = browser.$(
      Selectors.UpdateDocumentModal + ' ' + Selectors.DocumentFooter
    );
    await browser.waitUntil(async () => {
      return (await footer.getAttribute('data-status')) === 'ContainsErrors';
    });

    // Attempting to save while invalid keeps the modal open.
    await browser.clickVisible(Selectors.UpdateDocumentModalUpdateButton);
    expect(
      await browser.$(Selectors.UpdateDocumentModal).isDisplayed()
    ).to.equal(true);

    // Correcting the JSON clears the error and lets the save through.
    const fixed = JSON.stringify({ i: 7, j: 777 });
    await browser.setCodemirrorEditorValue(
      Selectors.UpdateDocumentModalJSONEditor,
      fixed
    );
    await browser.waitUntil(async () => {
      return (await footer.getAttribute('data-status')) === 'Modified';
    });

    await browser.clickVisible(Selectors.UpdateDocumentModalUpdateButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });

    await browser.runFindOperation('Documents', '{ i: 7 }');
    await browser.clickVisible(Selectors.SelectJSONView);
    await browser.$(Selectors.DocumentJSONEntry).waitForDisplayed();
    await browser.waitUntil(async () => {
      const text = await browser.getCodemirrorEditorText(
        Selectors.DocumentJSONEntry
      );
      return /"j":\s*777/.test(text);
    });
  });

  it('toggles fold state via the combined Format/Collapse button', async function () {
    await openEditModalFor(browser, '{ i: 11 }');
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();

    // Editor action buttons are display:none until hovered (by design), so
    // hover the editor first to reveal the action bar.
    await browser.hover(Selectors.UpdateDocumentModalJSONEditor);

    // Small docs open expanded — the toggle button starts in the
    // "Collapse all" state (CaretDown), and the inverse testid must NOT be
    // present.
    await browser
      .$(Selectors.UpdateDocumentModalCollapseAllButton)
      .waitForDisplayed();
    expect(
      await browser.$(Selectors.UpdateDocumentModalExpandAllButton).isExisting()
    ).to.equal(false);

    // Click collapses + re-formats. The button flips to "Expand all".
    await browser.clickVisible(Selectors.UpdateDocumentModalCollapseAllButton);
    await browser
      .$(Selectors.UpdateDocumentModalExpandAllButton)
      .waitForDisplayed();
    expect(
      await browser
        .$(Selectors.UpdateDocumentModalCollapseAllButton)
        .isExisting()
    ).to.equal(false);

    // Folding only changes the rendered view (the document text is
    // unchanged), so check for the fold placeholder the user sees.
    await browser
      .$(Selectors.UpdateDocumentModalFoldPlaceholder)
      .waitForDisplayed();

    // Click again expands + re-formats. Button flips back to "Collapse all".
    await browser.hover(Selectors.UpdateDocumentModalJSONEditor);
    await browser.clickVisible(Selectors.UpdateDocumentModalExpandAllButton);
    await browser
      .$(Selectors.UpdateDocumentModalCollapseAllButton)
      .waitForDisplayed();
    await browser
      .$(Selectors.UpdateDocumentModalFoldPlaceholder)
      .waitForExist({ reverse: true });

    await browser.clickVisible(Selectors.UpdateDocumentModalCancelButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });
  });

  it('opens the find bar with Ctrl/Cmd+F and reports a match count', async function () {
    await openEditModalFor(browser, '{ i: 8 }');
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();

    await browser.keys(['Control', 'f']);
    await browser.$(Selectors.UpdateDocumentModalFind).waitForDisplayed();

    await browser.setValueVisible(Selectors.UpdateDocumentModalFindInput, 'i');
    const counter = browser.$(Selectors.UpdateDocumentModalFindCounter);
    await browser.waitUntil(async () => {
      const text = await counter.getText();
      return /\d+ of \d+|\d+ match(es)?/.test(text);
    });

    // Escape dismisses the find bar (clears the search) WITHOUT closing the
    // modal. Regression guard: the find bar must stop the Escape from
    // bubbling to the LeafyGreen Modal's document-level close handler,
    // otherwise the whole edit session would be discarded.
    await browser.keys(['Escape']);
    await browser.waitUntil(async () => {
      return (await counter.getText()) === '';
    });
    expect(
      await browser.$(Selectors.UpdateDocumentModal).isDisplayed()
    ).to.equal(true);

    await browser.clickVisible(Selectors.UpdateDocumentModalCancelButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });
  });

  it('saves a document edited in shell syntax (no quotes)', async function () {
    await openEditModalFor(browser, '{ i: 13 }');
    await browser.$(Selectors.UpdateDocumentModalJSONEditor).waitForDisplayed();

    const json = await readModalJson(browser);
    const id = (JSON.parse(json) as { _id: { $oid: string } })._id.$oid;
    await browser.setCodemirrorEditorValue(
      Selectors.UpdateDocumentModalJSONEditor,
      `{ _id: ObjectId('${id}'), i: 13, j: 1313, note: 'shell' }`
    );

    await browser.clickVisible(Selectors.UpdateDocumentModalUpdateButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });

    await browser.runFindOperation('Documents', '{ i: 13 }');
    await browser.clickVisible(Selectors.SelectJSONView);
    await browser.$(Selectors.DocumentJSONEntry).waitForDisplayed();
    await browser.waitUntil(async () => {
      const text = await browser.getCodemirrorEditorText(
        Selectors.DocumentJSONEntry
      );
      return /"j":\s*1313/.test(text) && /"note":\s*"shell"/.test(text);
    });
  });

  it('opens from the table view and redraws the row after saving', async function () {
    await browser.runFindOperation('Documents', '{ i: 14 }');
    await browser.clickVisible(Selectors.SelectTableView);
    const row = browser.$('.ag-grid-scrolling-container .ag-row-first');
    await row.waitForDisplayed();

    await browser.waitUntil(async () => {
      await row.moveTo();
      const wrench = browser.$(
        Selectors.TableViewOpenUpdateDocumentModalButton
      );
      if (!(await wrench.isDisplayed())) {
        return false;
      }
      await wrench.click();
      return true;
    });
    await browser.$(Selectors.UpdateDocumentModal).waitForDisplayed();

    const json = await readModalJson(browser);
    await browser.setCodemirrorEditorValue(
      Selectors.UpdateDocumentModalJSONEditor,
      JSON.stringify({ ...JSON.parse(json), j: 1414 })
    );
    await browser.clickVisible(Selectors.UpdateDocumentModalUpdateButton);
    await browser
      .$(Selectors.UpdateDocumentModal)
      .waitForDisplayed({ reverse: true });

    await browser.waitUntil(async () => {
      const cell = browser.$(
        '.ag-grid-scrolling-container .ag-row-first [col-id="j"]'
      );
      return (await cell.getText()) === '1414';
    });
  });

  it('searches inside a single document in list and JSON views', async function () {
    await browser.runFindOperation('Documents', '{ i: 15 }');
    await browser.$(Selectors.DocumentListEntry).waitForDisplayed();

    await browser.waitUntil(async () => {
      await browser.hover(Selectors.DocumentListEntry);
      return browser.$(Selectors.SearchDocumentButton).isDisplayed();
    });
    await browser.clickVisible(Selectors.SearchDocumentButton);
    await browser.setValueVisible(Selectors.DocumentSearchInput, 'j');
    await browser.waitUntil(async () => {
      return /^1 of \d+$/.test(
        await browser.$(Selectors.DocumentSearchCounter).getText()
      );
    });

    await browser.clickVisible(Selectors.SelectJSONView);
    await browser.$(Selectors.JSONDocumentCard).waitForDisplayed();
    await browser.hover(Selectors.JSONDocumentCard);
    await browser.clickVisible(Selectors.JSONSearchDocumentButton);
    await browser.setValueVisible(Selectors.DocumentSearchInput, '15');
    await browser.waitUntil(async () => {
      return /^1 of \d+$/.test(
        await browser.$(Selectors.DocumentSearchCounter).getText()
      );
    });
  });

  it('keeps add data and document actions available with a projection', async function () {
    await browser.runFindOperation('Documents', '{ i: 7 }', {
      project: '{ i: 1 }',
    });
    const docEntry = browser.$(Selectors.DocumentListEntry);
    await docEntry.waitForDisplayed();

    await browser.$(Selectors.AddDataButton).waitForDisplayed();

    // Clone/delete act on the full document, so they stay; the pencil
    // (inline editing of the partial document) is the only action removed.
    await browser.waitUntil(async () => {
      await browser.hover(Selectors.DocumentListEntry);
      return browser.$(Selectors.CloneDocumentButton).isDisplayed();
    });
    await browser.$(Selectors.DeleteDocumentButton).waitForDisplayed();
    expect(await browser.$(Selectors.EditDocumentButton).isExisting()).to.equal(
      false
    );

    // Cloning refetches the full document, so the projected-out field is
    // included in the insert dialog.
    await browser.clickVisible(Selectors.CloneDocumentButton);
    await browser.$(Selectors.InsertDialog).waitForDisplayed();
    await browser.waitUntil(async () => {
      const text = await browser.getCodemirrorEditorText(
        Selectors.InsertDocumentEditor
      );
      return /\bi\b/.test(text) && /\bj\b/.test(text);
    });

    await browser.clickVisible(Selectors.InsertCancel);
    await browser.$(Selectors.InsertDialog).waitForDisplayed({ reverse: true });
  });
});

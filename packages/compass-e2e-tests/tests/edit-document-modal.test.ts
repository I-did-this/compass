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
 * End-to-end coverage for the Edit Document modal that replaced the old
 * inline document-editing flow (commit a3ffa4aed). Each test seeds the
 * `test.numbers` collection ({ i, j: 0 }), opens the modal from the list
 * view, exercises one capability, and verifies the effect.
 */
async function openEditModalFor(browser: CompassBrowser, query: string) {
  await browser.runFindOperation('Documents', query);
  const docEntry = browser.$(Selectors.DocumentListEntry);
  await docEntry.waitForDisplayed();
  await docEntry.scrollIntoView();
  // The contextual Edit button only renders while the row is hovered, and a
  // single hover can be lost on a virtualized re-render. Re-hover and retry
  // until the button is actually displayed, then click it.
  await browser.waitUntil(async () => {
    await browser.hover(Selectors.DocumentListEntry);
    const editButton = browser.$(Selectors.EditDocumentButton);
    if (!(await editButton.isDisplayed())) {
      return false;
    }
    await editButton.click();
    return true;
  });
  await browser.$(Selectors.EditDocumentModal).waitForDisplayed();
}

async function readModalJson(browser: CompassBrowser): Promise<string> {
  return browser.getCodemirrorEditorText(Selectors.EditDocumentModalJSONEditor);
}

describe('Edit Document modal', function () {
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
    await browser.$(Selectors.EditDocumentModalJSONEditor).waitForDisplayed();
    const json = await readModalJson(browser);
    expect(json.replace(/\s+/g, ' ')).to.match(
      /\{ "_id": \{ "\$oid": "[a-f0-9]{24}" \}, "i": 5, "j": 0 \}/
    );

    const edited = JSON.stringify({ ...JSON.parse(json), j: 555 });
    await browser.setCodemirrorEditorValue(
      Selectors.EditDocumentModalJSONEditor,
      edited
    );

    const footer = browser.$(
      Selectors.EditDocumentModal + ' ' + Selectors.DocumentFooter
    );
    await browser.waitUntil(async () => {
      return (await footer.getAttribute('data-status')) === 'Modified';
    });

    await browser.clickVisible(Selectors.EditDocumentModalUpdateButton);
    // A successful save closes the modal.
    await browser
      .$(Selectors.EditDocumentModal)
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
    await browser.$(Selectors.EditDocumentModalJSONEditor).waitForDisplayed();

    // The Cancel/Update footer must be visible immediately, before any
    // modification (regression guard: full-screen layout used to push it
    // below the viewport).
    await browser.$(Selectors.EditDocumentModalCancelButton).waitForDisplayed();
    await browser.$(Selectors.EditDocumentModalUpdateButton).waitForDisplayed();
    // Copy is re-enabled on the JSON editor.
    await browser.$(Selectors.EditDocumentModalCopyButton).waitForDisplayed();

    await browser.clickVisible(Selectors.EditDocumentModalCancelButton);
    await browser
      .$(Selectors.EditDocumentModal)
      .waitForDisplayed({ reverse: true });
  });

  it('carries edits across the JSON <-> Tree mode switch', async function () {
    await openEditModalFor(browser, '{ i: 6 }');

    const json = await readModalJson(browser);
    const edited = JSON.stringify({ ...JSON.parse(json), j: 111 });
    await browser.setCodemirrorEditorValue(
      Selectors.EditDocumentModalJSONEditor,
      edited
    );

    // JSON -> Tree applies the edited JSON into the structured editor.
    await browser.clickVisible(Selectors.EditDocumentModalModeTree);
    await browser.$(Selectors.EditDocumentModalTreeEditor).waitForDisplayed();

    // Tree -> JSON regenerates the text; the edit must survive the round-trip.
    await browser.clickVisible(Selectors.EditDocumentModalModeJSON);
    await browser.$(Selectors.EditDocumentModalJSONEditor).waitForDisplayed();
    await browser.waitUntil(async () => {
      return /"j":\s*111/.test(await readModalJson(browser));
    });

    await browser.clickVisible(Selectors.EditDocumentModalUpdateButton);
    await browser
      .$(Selectors.EditDocumentModal)
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
      Selectors.EditDocumentModalJSONEditor,
      '{ this is not valid json }'
    );

    const footer = browser.$(
      Selectors.EditDocumentModal + ' ' + Selectors.DocumentFooter
    );
    await browser.waitUntil(async () => {
      return (await footer.getAttribute('data-status')) === 'ContainsErrors';
    });

    // Attempting to save while invalid keeps the modal open.
    await browser.clickVisible(Selectors.EditDocumentModalUpdateButton);
    expect(await browser.$(Selectors.EditDocumentModal).isDisplayed()).to.equal(
      true
    );

    // Correcting the JSON clears the error and lets the save through.
    const fixed = JSON.stringify({ i: 7, j: 777 });
    await browser.setCodemirrorEditorValue(
      Selectors.EditDocumentModalJSONEditor,
      fixed
    );
    await browser.waitUntil(async () => {
      return (await footer.getAttribute('data-status')) === 'Modified';
    });

    await browser.clickVisible(Selectors.EditDocumentModalUpdateButton);
    await browser
      .$(Selectors.EditDocumentModal)
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

  it('opens the find bar with Ctrl/Cmd+F and reports a match count', async function () {
    await openEditModalFor(browser, '{ i: 8 }');
    await browser.$(Selectors.EditDocumentModalJSONEditor).waitForDisplayed();

    await browser.keys(['Control', 'f']);
    await browser.$(Selectors.EditDocumentModalFind).waitForDisplayed();

    await browser.setValueVisible(Selectors.EditDocumentModalFindInput, 'i');
    const counter = browser.$(Selectors.EditDocumentModalFindCounter);
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
    expect(await browser.$(Selectors.EditDocumentModal).isDisplayed()).to.equal(
      true
    );

    await browser.clickVisible(Selectors.EditDocumentModalCancelButton);
    await browser
      .$(Selectors.EditDocumentModal)
      .waitForDisplayed({ reverse: true });
  });
});

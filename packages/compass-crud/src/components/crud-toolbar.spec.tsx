import React from 'react';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  screen,
  within,
  userEvent,
  waitFor,
} from '@mongodb-js/testing-library-compass';
import type { PreferencesAccess } from 'compass-preferences-model';
import { createSandboxFromDefaultPreferences } from 'compass-preferences-model';
import { CrudToolbar } from './crud-toolbar';
import { renderWithQueryBar } from '../../test/render-with-query-bar';

const noop = () => {
  /* noop */
};

const testOutdatedMessageId = 'crud-outdated-message-id';
const testErrorMessageId = 'document-list-error-summary';
const testDocumentsPerPageId = 'crud-document-per-page-selector';

const insertDocumentLabel = 'Insert document';
const bulkUpdateLabel = 'Bulk update documents';
const bulkDeleteLabel = 'Bulk delete documents';

describe('CrudToolbar Component', function () {
  let preferences: PreferencesAccess;

  function renderCrudToolbar(
    props?: Partial<React.ComponentProps<typeof CrudToolbar>>
  ) {
    return renderWithQueryBar(
      <CrudToolbar
        activeDocumentView="List"
        count={55}
        end={20}
        getPage={noop}
        lastCountRunMaxTimeMS={12345}
        insertDataHandler={noop}
        loadingCount={false}
        isFetching={false}
        docsPerPage={25}
        isWritable
        instanceDescription=""
        onApplyClicked={noop}
        onResetClicked={noop}
        onUpdateButtonClicked={noop}
        onDeleteButtonClicked={noop}
        areAllDocumentsExpanded={false}
        onExpandAllClicked={noop}
        onCollapseAllClicked={noop}
        openExportFileDialog={noop}
        onOpenExportToLanguage={noop}
        outdated={false}
        page={0}
        readonly={false}
        refreshDocuments={noop}
        resultId="123"
        start={0}
        viewSwitchHandler={noop}
        updateMaxDocumentsPerPage={noop}
        queryLimit={0}
        querySkip={0}
        {...props}
      />,
      { preferences }
    );
  }

  beforeEach(async function () {
    preferences = await createSandboxFromDefaultPreferences();
  });

  it('renders the query bar role', function () {
    renderCrudToolbar();

    expect(screen.getByTestId('query-bar')).to.be.visible;
  });

  it('call to change the document view type on click', function () {
    const viewSwitchHandlerSpy = sinon.spy();
    renderCrudToolbar({
      viewSwitchHandler: viewSwitchHandlerSpy,
    });

    expect(viewSwitchHandlerSpy.called).to.be.false;
    const option = within(screen.getByTestId('toolbar-view-table')).getByRole(
      'tab'
    );
    userEvent.click(option);

    expect(viewSwitchHandlerSpy.calledOnce).to.be.true;
    expect(viewSwitchHandlerSpy.firstCall.args[0]).to.equal('Table');
  });

  it('should call to get the next page when the next button is hit', function () {
    const getPageSpy = sinon.spy();
    renderCrudToolbar({
      getPage: getPageSpy,
    });

    expect(getPageSpy.called).to.be.false;
    userEvent.click(screen.getByTestId('docs-toolbar-next-page-btn'));

    expect(getPageSpy.calledOnce).to.be.true;
    expect(getPageSpy.firstCall.args[0]).to.equal(1);
  });

  it('should have the prev page button disabled', function () {
    const getPageSpy = sinon.spy();
    renderCrudToolbar({
      getPage: getPageSpy,
    });

    expect(getPageSpy.called).to.be.false;
    userEvent.click(screen.getByTestId('docs-toolbar-prev-page-btn'));

    expect(screen.getByTestId('docs-toolbar-prev-page-btn')).to.have.attribute(
      'aria-disabled',
      'true'
    );

    expect(getPageSpy.calledOnce).to.be.false;
    expect(screen.getByTestId('docs-toolbar-prev-page-btn')).to.be.visible;
  });

  context('respecting the docsPerPage setting', () => {
    it('should have the next page button disabled when on the first page without more than a page of documents', function () {
      const getPageSpy = sinon.spy();
      renderCrudToolbar({
        getPage: getPageSpy,
        docsPerPage: 50,
        count: 50,
        page: 0,
        start: 1,
        end: 50,
      });
      expect(getPageSpy.called).to.be.false;
      userEvent.click(screen.getByTestId('docs-toolbar-next-page-btn'));

      expect(
        screen.getByTestId('docs-toolbar-next-page-btn')
      ).to.have.attribute('aria-disabled', 'true');

      expect(getPageSpy.calledOnce).to.be.false;
    });

    it('should have the next page button disabled when on the first page with more than a page of documents', function () {
      const getPageSpy = sinon.spy();
      renderCrudToolbar({
        getPage: getPageSpy,
        docsPerPage: 25,
        count: 50,
        page: 0,
        start: 1,
        end: 25,
      });
      expect(getPageSpy.called).to.be.false;
      userEvent.click(screen.getByTestId('docs-toolbar-next-page-btn'));

      expect(
        screen.getByTestId('docs-toolbar-next-page-btn')
      ).to.have.attribute('aria-disabled', 'false');

      expect(getPageSpy.calledOnce).to.be.true;
      expect(getPageSpy.firstCall.args[0]).to.equal(1);
    });
  });

  it('should call to get the next page when the prev button is hit on a non-first page', function () {
    const getPageSpy = sinon.spy();
    renderCrudToolbar({
      getPage: getPageSpy,
      page: 1,
      start: 20,
      end: 40,
    });
    expect(screen.getByTestId('docs-toolbar-prev-page-btn')).to.have.attribute(
      'aria-disabled',
      'false'
    );

    expect(getPageSpy.called).to.be.false;
    userEvent.click(screen.getByTestId('docs-toolbar-prev-page-btn'));

    expect(getPageSpy.calledOnce).to.be.true;
    expect(getPageSpy.firstCall.args[0]).to.equal(0);
  });

  it('should have the next page button disabled when on the last page', function () {
    const getPageSpy = sinon.spy();
    renderCrudToolbar({
      getPage: getPageSpy,
      page: 1,
      start: 20,
      end: 39,
      count: 39,
    });

    expect(getPageSpy.called).to.be.false;
    userEvent.click(screen.getByTestId('docs-toolbar-next-page-btn'));

    expect(screen.getByTestId('docs-toolbar-next-page-btn')).to.have.attribute(
      'aria-disabled',
      'true'
    );

    expect(getPageSpy.calledOnce).to.be.false;
  });

  it('should have the next page button enabled when count is unknown', function () {
    const getPageSpy = sinon.spy();
    renderCrudToolbar({
      getPage: getPageSpy,
      page: 2,
      count: undefined,
    });

    const nextButton = screen.getByTestId('docs-toolbar-next-page-btn');
    expect(nextButton).to.have.attribute('aria-disabled', 'false');

    expect(getPageSpy.called).to.be.false;
    userEvent.click(nextButton);

    expect(getPageSpy.calledOnce).to.be.true;
    expect(getPageSpy.firstCall.args[0]).to.equal(3);
  });

  it('should render the add data button when it is not readonly', function () {
    renderCrudToolbar({
      readonly: false,
    });

    expect(screen.getByRole('button', { name: insertDocumentLabel })).to.be
      .visible;
  });

  it('renders the toolbar action buttons as icons and names them in a tooltip on hover', async function () {
    renderCrudToolbar();

    for (const name of [
      insertDocumentLabel,
      'Import JSON or CSV file',
      bulkUpdateLabel,
      bulkDeleteLabel,
      'Export query results',
      'Export the full collection',
      'Export query to language',
    ]) {
      const button = screen.getByRole('button', { name });
      expect(button).to.have.text('');

      userEvent.hover(button);
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).to.have.text(name);
      });
      userEvent.unhover(button);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).to.not.exist;
      });
    }
  });

  it('explains why bulk actions are disabled in the tooltip', async function () {
    renderCrudToolbar({ querySkip: 10 });

    userEvent.hover(screen.getByRole('button', { name: bulkUpdateLabel }));
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).to.have.text(
        'Remove limit and skip in your query to perform a bulk operation'
      );
    });
  });

  it('should render the start and end count', function () {
    renderCrudToolbar({
      start: 5,
      end: 25,
      count: 200,
    });

    expect(screen.getByTestId('crud-document-count-display')).to.have.text(
      '5 – 25 of 200'
    );
  });

  it('should not render the add data and bulk actions buttons when it is readonly', function () {
    renderCrudToolbar({
      readonly: true,
    });

    expect(screen.queryByRole('button', { name: insertDocumentLabel })).to.not
      .exist;
    expect(screen.queryByRole('button', { name: bulkUpdateLabel })).to.not
      .exist;
    expect(screen.queryByRole('button', { name: bulkDeleteLabel })).to.not
      .exist;
  });

  it('should call to open the export dialog when export is clicked', function () {
    const exportSpy = sinon.spy();
    renderCrudToolbar({
      openExportFileDialog: exportSpy,
    });

    expect(exportSpy.called).to.be.false;
    userEvent.click(
      screen.getByRole('button', { name: 'Export the full collection' })
    );

    expect(exportSpy.calledOnce).to.be.true;
    expect(exportSpy.firstCall.args[0]).to.be.true;
  });

  describe('bulk actions', function () {
    it('should render disabled when the query has a skip', function () {
      renderCrudToolbar({
        querySkip: 10,
      });

      expect(
        screen
          .getByTestId('crud-bulk-actions-bulk-update-action')
          .getAttribute('aria-disabled')
      ).to.equal('true');
    });

    it('should render disabled when the query has a limit', function () {
      renderCrudToolbar({
        queryLimit: 10,
      });

      expect(
        screen
          .getByTestId('crud-bulk-actions-bulk-update-action')
          .getAttribute('aria-disabled')
      ).to.equal('true');
    });

    it('should propagate bulk update click events', function () {
      const onUpdateButtonClickedSpy = sinon.spy();

      renderCrudToolbar({ onUpdateButtonClicked: onUpdateButtonClickedSpy });

      userEvent.click(screen.getByRole('button', { name: bulkUpdateLabel }));
      expect(onUpdateButtonClickedSpy).to.have.been.called;
    });

    it('should propagate bulk delete click events', function () {
      const onDeleteButtonClickedSpy = sinon.spy();

      renderCrudToolbar({ onDeleteButtonClicked: onDeleteButtonClickedSpy });

      userEvent.click(screen.getByRole('button', { name: bulkDeleteLabel }));
      expect(onDeleteButtonClickedSpy).to.have.been.called;
    });
  });

  describe('expand/collapse all documents toggle', function () {
    it('should be disabled in table view', function () {
      renderCrudToolbar({
        activeDocumentView: 'Table',
      });

      expect(
        screen.getByRole('button', { name: 'Expand all documents' })
      ).to.have.attribute('aria-disabled', 'true');
    });

    it('should show its action in a tooltip on hover', async function () {
      renderCrudToolbar({ activeDocumentView: 'JSON' });

      userEvent.hover(
        screen.getByRole('button', { name: 'Expand all documents' })
      );

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).to.have.text(
          'Expand all documents'
        );
      });
    });

    it('should expand all documents when they are collapsed', function () {
      const onExpandAllClicked = sinon.spy();
      renderCrudToolbar({
        activeDocumentView: 'JSON',
        areAllDocumentsExpanded: false,
        onExpandAllClicked,
      });

      userEvent.click(
        screen.getByRole('button', { name: 'Expand all documents' })
      );
      expect(onExpandAllClicked).to.have.been.calledOnce;
    });

    it('should collapse all documents when they are expanded', function () {
      const onCollapseAllClicked = sinon.spy();
      renderCrudToolbar({
        activeDocumentView: 'JSON',
        areAllDocumentsExpanded: true,
        onCollapseAllClicked,
      });

      userEvent.click(
        screen.getByRole('button', { name: 'Collapse all documents' })
      );
      expect(onCollapseAllClicked).to.have.been.calledOnce;
    });
  });

  it('should not render the outdated message', function () {
    renderCrudToolbar();

    expect(screen.queryByTestId(testOutdatedMessageId)).to.not.exist;
  });

  describe('when the instance is in a writable state (`isWritable` is true)', function () {
    beforeEach(function () {
      renderCrudToolbar({
        isWritable: true,
      });
    });

    it('has the add data button enabled', function () {
      expect(
        screen
          .getByTestId('crud-add-data-insert-document-action')
          .getAttribute('disabled')
      ).to.equal(null);
    });
  });

  describe('when the instance is not in a writable state (`isWritable` is false)', function () {
    beforeEach(function () {
      renderCrudToolbar({
        isWritable: false,
      });
    });

    it('has the add data button disabled', function () {
      expect(
        screen
          .getByTestId('crud-add-data-insert-document-action')
          .getAttribute('aria-disabled')
      ).to.equal('true');
    });
  });

  describe('when the documents are outdated', function () {
    beforeEach(function () {
      renderCrudToolbar({
        outdated: true,
      });
    });

    it('should render the outdated message', function () {
      expect(screen.getByTestId(testOutdatedMessageId)).to.be.visible;
    });

    it('should not render an error message', function () {
      expect(screen.queryByTestId(testErrorMessageId)).to.not.exist;
    });
  });

  describe('when there is an error', function () {
    beforeEach(function () {
      renderCrudToolbar({
        error: {
          name: 'test-error',
          message: 'pineapple 123',
        },
      });
    });

    it('should render the message', function () {
      expect(screen.getByTestId(testErrorMessageId)).to.be.visible;
      expect(screen.getByText('pineapple 123')).to.be.visible;
    });
  });

  describe('when there is an operation timed out error', function () {
    beforeEach(function () {
      renderCrudToolbar({
        error: {
          name: 'MongoServerError',
          message: 'pineapple',
          code: {
            value: 50,
          },
        },
      });
    });

    it('should render the message', function () {
      expect(screen.queryByText('pineapple')).to.not.exist;
      expect(
        screen.getByText(
          'Operation exceeded time limit. Please try increasing the maxTimeMS for the query in the expanded filter options.'
        )
      ).to.be.visible;
    });
  });

  describe('documents per page select', function () {
    it('should render a select to update documents fetched per page', async function () {
      renderCrudToolbar();

      await waitFor(
        () => expect(screen.getByTestId(testDocumentsPerPageId)).to.be.visible
      );
    });

    it('should call updateDocumentsPerPage when select value changes', async function () {
      const stub = sinon.stub();
      renderCrudToolbar({
        updateMaxDocumentsPerPage: stub,
      });

      const selector = screen.getByTestId(testDocumentsPerPageId);

      await waitFor(() => expect(selector).to.be.visible);
      userEvent.click(selector);
      userEvent.click(screen.getByText('75'));
      expect(stub).to.be.calledWithExactly(75);
    });
  });

  describe('when count the count is unavailable', function () {
    it('shows N/A with the count maxTimeMS', async function () {
      renderCrudToolbar({
        count: undefined,
      });
      expect(screen.getByText('N/A')).to.be.visible;

      const naText = screen.getByTestId('crud-document-count-unavailable');
      expect(naText).to.be.visible;
      userEvent.hover(naText);

      await waitFor(
        function () {
          expect(screen.getByRole('tooltip')).to.exist;
        },
        {
          timeout: 5000,
        }
      );

      const tooltipText = screen.getByRole('tooltip').textContent;
      expect(tooltipText).to.include('maxTimeMS of 12345.');
    });
  });

  describe('context menu', function () {
    beforeEach(async function () {
      await preferences.savePreferences({ enableImportExport: true });
    });

    it('should open context menu on right click', function () {
      renderCrudToolbar();

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      expect(within(contextMenu).getByText('Expand all documents')).to.be
        .visible;
      expect(within(contextMenu).getByText('Refresh')).to.be.visible;
    });

    it('should call onExpandAllClicked when "Expand all documents" is clicked', function () {
      const onExpandAllClicked = sinon.spy();
      renderCrudToolbar({ onExpandAllClicked });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const expandMenuItem = within(contextMenu).getByText(
        'Expand all documents'
      );
      userEvent.click(expandMenuItem);

      expect(onExpandAllClicked).to.have.been.calledOnce;
    });

    it('should call onCollapseAllClicked when "Collapse all documents" is clicked', function () {
      const onCollapseAllClicked = sinon.spy();
      renderCrudToolbar({ onCollapseAllClicked });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const collapseMenuItem = within(contextMenu).getByText(
        'Collapse all documents'
      );
      userEvent.click(collapseMenuItem);

      expect(onCollapseAllClicked).to.have.been.called;
    });

    it('should call insertDataHandler with "import-file" when "Import JSON or CSV file" is clicked', function () {
      const insertDataHandler = sinon.spy();
      renderCrudToolbar({ insertDataHandler });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const importMenuItem = within(contextMenu).getByText(
        'Import JSON or CSV file'
      );
      userEvent.click(importMenuItem);

      expect(insertDataHandler).to.have.been.calledOnceWithExactly(
        'import-file'
      );
    });

    it('should call insertDataHandler with "insert-document" when "Insert document..." is clicked', function () {
      const insertDataHandler = sinon.spy();
      renderCrudToolbar({ insertDataHandler });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const insertMenuItem =
        within(contextMenu).getByText('Insert document...');
      userEvent.click(insertMenuItem);

      expect(insertDataHandler).to.have.been.calledOnceWithExactly(
        'insert-document'
      );
    });

    it('should call openExportFileDialog with false when "Export query results..." is clicked', function () {
      const openExportFileDialog = sinon.spy();
      renderCrudToolbar({ openExportFileDialog });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const exportQueryMenuItem = within(contextMenu).getByText(
        'Export query results...'
      );
      userEvent.click(exportQueryMenuItem);

      expect(openExportFileDialog).to.have.been.calledOnceWithExactly(false);
    });

    it('should call openExportFileDialog with true when "Export full collection..." is clicked', function () {
      const openExportFileDialog = sinon.spy();
      renderCrudToolbar({ openExportFileDialog });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const exportCollectionMenuItem = within(contextMenu).getByText(
        'Export full collection...'
      );
      userEvent.click(exportCollectionMenuItem);

      expect(openExportFileDialog).to.have.been.calledOnceWithExactly(true);
    });

    it('should call onUpdateButtonClicked when "Bulk update" is clicked', function () {
      const onUpdateButtonClicked = sinon.spy();
      renderCrudToolbar({ onUpdateButtonClicked });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const updateMenuItem = within(contextMenu).getByText('Bulk update');
      userEvent.click(updateMenuItem);

      expect(onUpdateButtonClicked).to.have.been.calledOnce;
    });

    it('should call onDeleteButtonClicked when "Bulk delete" is clicked', function () {
      const onDeleteButtonClicked = sinon.spy();
      renderCrudToolbar({ onDeleteButtonClicked });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const deleteMenuItem = within(contextMenu).getByText('Bulk delete');
      userEvent.click(deleteMenuItem);

      expect(onDeleteButtonClicked).to.have.been.calledOnce;
    });

    it('should call refreshDocuments when "Refresh" is clicked', function () {
      const refreshDocuments = sinon.spy();
      renderCrudToolbar({ refreshDocuments });

      const toolbar = screen.getByTestId('query-bar').closest('div');
      userEvent.click(toolbar!, { button: 2 });

      const contextMenu = screen.getByTestId('context-menu');
      const refreshMenuItem = within(contextMenu).getByText('Refresh');
      userEvent.click(refreshMenuItem);

      expect(refreshDocuments).to.have.been.calledOnce;
    });

    describe('conditional menu items', function () {
      it('should not show import/export items when enableImportExport is false', async function () {
        await preferences.savePreferences({ enableImportExport: false });
        renderCrudToolbar();

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).queryByText('Import JSON or CSV file')).to
          .not.exist;
        expect(within(contextMenu).queryByText('Export query results...')).to
          .not.exist;
        expect(within(contextMenu).queryByText('Export full collection...')).to
          .not.exist;
      });

      it('should not show insert document item when readonly is true', function () {
        renderCrudToolbar({ readonly: true });

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).queryByText('Insert document...')).to.not
          .exist;
      });

      it('should not show bulk operations when readonly is true', function () {
        renderCrudToolbar({ readonly: true });

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).queryByText('Bulk update')).to.not.exist;
        expect(within(contextMenu).queryByText('Bulk delete')).to.not.exist;
      });

      it('should not show bulk operations when isWritable is false', function () {
        renderCrudToolbar({ isWritable: false });

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).queryByText('Bulk update')).to.not.exist;
      });

      it('should not show bulk operations when query has skip', function () {
        renderCrudToolbar({ querySkip: 10 });

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).queryByText('Bulk update')).to.not.exist;
      });

      it('should not show bulk operations when query has limit', function () {
        renderCrudToolbar({ queryLimit: 10 });

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).queryByText('Bulk update')).to.not.exist;
        expect(within(contextMenu).queryByText('Bulk delete')).to.not.exist;
      });

      it('should show all applicable items when conditions are met', function () {
        renderCrudToolbar({
          readonly: false,
          isWritable: true,
          querySkip: 0,
          queryLimit: 0,
        });

        const toolbar = screen.getByTestId('query-bar').closest('div');
        userEvent.click(toolbar!, { button: 2 });

        const contextMenu = screen.getByTestId('context-menu');
        expect(within(contextMenu).getByText('Expand all documents')).to.be
          .visible;
        expect(within(contextMenu).getByText('Import JSON or CSV file')).to.be
          .visible;
        expect(within(contextMenu).getByText('Insert document...')).to.be
          .visible;
        expect(within(contextMenu).getByText('Export query results...')).to.be
          .visible;
        expect(within(contextMenu).getByText('Export full collection...')).to.be
          .visible;
        expect(within(contextMenu).getByText('Bulk update')).to.be.visible;
        expect(within(contextMenu).getByText('Bulk delete')).to.be.visible;
        expect(within(contextMenu).getByText('Refresh')).to.be.visible;
      });
    });
  });

  describe('insights signal functionality', function () {
    it('should show "Tell me more" button and hide standalone "Learn more" link when insights with onAssistantButtonClick is provided', function () {
      const onAssistantButtonClick = sinon.spy();
      const insights = {
        id: 'test-insight',
        title: 'Test Insight',
        description: 'This is a test insight.',
        learnMoreLink: 'https://example.com',
        onAssistantButtonClick,
      };

      renderCrudToolbar({
        insights,
      });

      userEvent.click(screen.getByTestId('insight-badge-button'));

      expect(screen.getByTestId('tell-me-more-button')).to.exist;
      expect(screen.getByText('Tell me more')).to.exist;

      const learnMoreLinks = screen.getAllByTestId('insight-signal-link');
      expect(learnMoreLinks).to.have.length(1);
    });

    it('should show "Learn more" link and hide "Tell me more" button when insights without onAssistantButtonClick is provided', function () {
      const insights = {
        id: 'test-insight',
        title: 'Test Insight',
        description: 'This is a test insight.',
        learnMoreLink: 'https://example.com',
      };

      renderCrudToolbar({
        insights,
      });

      userEvent.click(screen.getByTestId('insight-badge-button'));

      expect(screen.getByTestId('insight-signal-link')).to.exist;
      expect(screen.getByText('Learn more')).to.exist;

      expect(() => screen.getByTestId('tell-me-more-button')).to.throw();
    });

    it('should call onAssistantButtonClick when "Tell me more" button is clicked', function () {
      const onAssistantButtonClick = sinon.spy();
      const insights = {
        id: 'test-insight',
        title: 'Test Insight',
        description: 'This is a test insight.',
        learnMoreLink: 'https://example.com',
        onAssistantButtonClick,
      };

      renderCrudToolbar({
        insights,
      });

      userEvent.click(screen.getByTestId('insight-badge-button'));

      const tellMeMoreButton = screen.getByTestId('tell-me-more-button');
      userEvent.click(tellMeMoreButton);

      expect(onAssistantButtonClick).to.have.been.calledOnce;
    });

    it('should not render signal popover when insights is not provided', function () {
      renderCrudToolbar();

      expect(() => screen.getByTestId('insight-badge-button')).to.throw();
    });
  });

  describe('Mock Data Generator action', function () {
    it('shows the action for an eligible collection when the feature flag is on', async function () {
      await preferences.savePreferences({ enableMockDataGenerator: true });
      renderCrudToolbar({
        isMockDataGeneratorEligible: true,
      });

      expect(screen.getByRole('button', { name: 'Generate mock data script' }))
        .to.be.visible;
    });

    it('should not show "Generate mock data script" menu item when not enabled', function () {
      renderCrudToolbar({
        isMockDataGeneratorEligible: false,
      });

      expect(
        screen.queryByRole('button', { name: 'Generate mock data script' })
      ).to.not.exist;
    });

    it('should emit "open-mock-data-generator-modal" event when "Generate mock data script" is clicked', async function () {
      await preferences.savePreferences({ enableMockDataGenerator: true });
      const { localAppRegistry } = renderCrudToolbar({
        isMockDataGeneratorEligible: true,
      });
      const emitSpy = sinon.spy(localAppRegistry, 'emit');

      userEvent.click(
        screen.getByRole('button', { name: 'Generate mock data script' })
      );

      expect(emitSpy).to.have.been.calledOnceWith(
        'open-mock-data-generator-modal'
      );
    });

    it('keeps Add data disabled for a non-writable collection', function () {
      renderCrudToolbar({
        isMockDataGeneratorEligible: true,
        isWritable: false,
      });
      expect(
        screen.getByRole('button', { name: 'Generate mock data script' })
      ).to.have.attribute('aria-disabled', 'true');
    });
  });
});

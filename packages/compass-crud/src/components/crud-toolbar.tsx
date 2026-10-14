import React, { useCallback, useMemo } from 'react';
import { useTelemetry } from '@mongodb-js/compass-telemetry/provider';

import {
  Body,
  Icon,
  IconButton,
  SpinLoader,
  css,
  spacing,
  WarningSummary,
  ErrorSummary,
  Select,
  Option,
  SignalPopover,
  useContextMenuGroups,
  Tooltip,
} from '@mongodb-js/compass-components';
import type { Signal } from '@mongodb-js/compass-components';
import { ViewSwitcher } from './view-switcher';
import { type DocumentView } from '../stores/crud-store';
import { AddDataActions } from './add-data-actions';
import { usePreference } from 'compass-preferences-model/provider';
import { BulkActions } from './bulk-actions';
import { QueryBar } from '@mongodb-js/compass-query-bar';
import { useConnectionInfoRef } from '@mongodb-js/compass-connections/provider';
import {
  ToolbarIconButton,
  toolbarButtonGroupStyles,
} from './toolbar-icon-button';

const crudQueryBarStyles = css({
  width: '100%',
  position: 'relative',
});

const crudToolbarStyles = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: spacing[300],
  padding: spacing[400],
});

const crudBarStyles = css({
  width: '100%',
  display: 'flex',
  gap: spacing[200],
  justifyContent: 'space-between',
});

const toolbarLeftActionStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const toolbarRightActionStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[200],
});

const prevNextStyles = css({
  display: 'flex',
  alignItems: 'center',
});

const docsPerPageOptionStyles = css({
  width: spacing[1600] + spacing[300],
});

const loaderContainerStyles = css({
  paddingLeft: spacing[200],
  paddingRight: spacing[200],
});

const countUnavailableTextStyles = css({
  textDecoration: 'underline',
  textDecorationStyle: 'dotted',
  textUnderlineOffset: '3px',
});

const OUTDATED_WARNING = `The content is outdated and no longer in sync
with the current query. Press "Find" again to see the results for
the current query.`;

// From https://github.com/mongodb/mongo/blob/master/src/mongo/base/error_codes.yml#L86
const ERROR_CODE_OPERATION_TIMED_OUT = 50;

const INCREASE_MAX_TIME_MS_HINT =
  'Operation exceeded time limit. Please try increasing the maxTimeMS for the query in the expanded filter options.';

const countUnavailableTooltipText = (maxTimeMS: number) =>
  `The count is not available for this query. This can happen when the count operation fails or exceeds the maxTimeMS of ${maxTimeMS}.`;

type ErrorWithPossibleCode = Error & {
  code?: {
    value: number;
  };
};

function isOperationTimedOutError(err: ErrorWithPossibleCode) {
  return (
    err.name === 'MongoServerError' &&
    err.code?.value === ERROR_CODE_OPERATION_TIMED_OUT
  );
}

export type CrudToolbarProps = {
  activeDocumentView: DocumentView;
  count?: number;
  end: number;
  error?: ErrorWithPossibleCode | null;
  getPage: (page: number) => void;
  insertDataHandler: (openInsertKey: 'insert-document' | 'import-file') => void;
  instanceDescription: string;
  isWritable: boolean;
  isFetching: boolean;
  isMockDataGeneratorEligible?: boolean;
  lastCountRunMaxTimeMS: number;
  loadingCount: boolean;
  onApplyClicked: () => void;
  onResetClicked: () => void;
  onUpdateButtonClicked: () => void;
  onDeleteButtonClicked: () => void;
  areAllDocumentsExpanded: boolean;
  onExpandAllClicked: () => void;
  onCollapseAllClicked: () => void;
  openExportFileDialog: (exportFullCollection?: boolean) => void;
  onOpenExportToLanguage: () => void;
  outdated: boolean;
  page: number;
  readonly: boolean;
  refreshDocuments: () => void;
  resultId: string;
  start: number;
  viewSwitchHandler: (view: DocumentView) => void;
  insights?: Signal;
  queryLimit?: number;
  querySkip?: number;
  docsPerPage: number;
  updateMaxDocumentsPerPage: (docsPerPage: number) => void;
};

const CrudToolbar: React.FunctionComponent<CrudToolbarProps> = ({
  activeDocumentView,
  count,
  end,
  error,
  getPage,
  insertDataHandler,
  instanceDescription,
  isWritable,
  isFetching,
  isMockDataGeneratorEligible,
  lastCountRunMaxTimeMS,
  loadingCount,
  onApplyClicked,
  onResetClicked,
  onUpdateButtonClicked,
  onDeleteButtonClicked,
  areAllDocumentsExpanded,
  onExpandAllClicked,
  onCollapseAllClicked,
  openExportFileDialog,
  onOpenExportToLanguage,
  outdated,
  page,
  readonly,
  refreshDocuments,
  resultId,
  start,
  viewSwitchHandler,
  insights,
  queryLimit,
  querySkip,
  docsPerPage,
  updateMaxDocumentsPerPage,
}) => {
  const track = useTelemetry();
  const connectionInfoRef = useConnectionInfoRef();
  const isImportExportEnabled = usePreference('enableImportExport');

  const onClickRefreshDocuments = useCallback(() => {
    track('Query Results Refreshed', {}, connectionInfoRef.current);
    refreshDocuments();
  }, [refreshDocuments, track, connectionInfoRef]);

  const onExportQueryResults = useCallback(() => {
    openExportFileDialog(false);
  }, [openExportFileDialog]);

  const onExportFullCollection = useCallback(() => {
    openExportFileDialog(true);
  }, [openExportFileDialog]);

  const prevButtonDisabled = useMemo(() => page === 0, [page]);
  const nextButtonDisabled = useMemo(
    // If we don't know the count, we can't know if there are more pages.
    () =>
      count === undefined || count === null
        ? false
        : docsPerPage * (page + 1) >= count,
    [count, page, docsPerPage]
  );

  const enableExplainPlan = usePreference('enableExplainPlan');
  const shouldDisableBulkOp = useMemo(
    () => querySkip || queryLimit,
    [querySkip, queryLimit]
  );

  const contextMenuRef = useContextMenuGroups(
    () => [
      {
        telemetryLabel: 'Expand all documents',
        items: [
          {
            label: 'Expand all documents',
            onAction: () => {
              onExpandAllClicked();
            },
          },
          {
            label: 'Collapse all documents',
            onAction: () => {
              onCollapseAllClicked();
            },
          },
          isImportExportEnabled
            ? {
                label: 'Import JSON or CSV file',
                onAction: () => {
                  insertDataHandler('import-file');
                },
              }
            : undefined,
          !readonly
            ? {
                label: 'Insert document...',
                onAction: () => {
                  insertDataHandler('insert-document');
                },
              }
            : undefined,
          ...(isImportExportEnabled
            ? [
                {
                  label: 'Export query results...',
                  onAction: () => {
                    openExportFileDialog(false);
                  },
                },
                {
                  label: 'Export full collection...',
                  onAction: () => {
                    openExportFileDialog(true);
                  },
                },
              ]
            : []),
          ...(!readonly && isWritable && !shouldDisableBulkOp
            ? [
                {
                  label: 'Bulk update',
                  onAction: () => {
                    onUpdateButtonClicked();
                  },
                },
                {
                  label: 'Bulk delete',
                  onAction: () => {
                    onDeleteButtonClicked();
                  },
                },
              ]
            : []),
          {
            label: 'Refresh',
            onAction: () => {
              onClickRefreshDocuments();
            },
          },
        ],
      },
    ],
    [
      isImportExportEnabled,
      readonly,
      isWritable,
      shouldDisableBulkOp,
      onCollapseAllClicked,
      onExpandAllClicked,
      insertDataHandler,
      openExportFileDialog,
      onUpdateButtonClicked,
      onDeleteButtonClicked,
      onClickRefreshDocuments,
    ]
  );

  return (
    <div className={crudToolbarStyles} ref={contextMenuRef}>
      <div className={crudQueryBarStyles}>
        <QueryBar
          source="crud"
          resultId={resultId}
          buttonLabel="Find"
          onApply={onApplyClicked}
          onReset={onResetClicked}
          showExplainButton={enableExplainPlan}
        />
      </div>

      <div className={crudBarStyles}>
        <div className={toolbarLeftActionStyles}>
          {!readonly && (
            <AddDataActions
              insertDataHandler={insertDataHandler}
              isWritable={isWritable}
              instanceDescription={instanceDescription}
              isMockDataGeneratorEligible={isMockDataGeneratorEligible}
            />
          )}
          {!readonly && (
            <BulkActions
              isWritable={isWritable && !shouldDisableBulkOp}
              disabledTooltip={
                isWritable
                  ? 'Remove limit and skip in your query to perform a bulk operation'
                  : instanceDescription
              }
              onUpdate={onUpdateButtonClicked}
              onDelete={onDeleteButtonClicked}
            />
          )}
          <div className={toolbarButtonGroupStyles}>
            {isImportExportEnabled && (
              <>
                <ToolbarIconButton
                  label="Export query results"
                  glyph="Export"
                  onClick={onExportQueryResults}
                  data-testid="crud-export-collection-export-query-action"
                />
                <ToolbarIconButton
                  label="Export the full collection"
                  glyph="Database"
                  onClick={onExportFullCollection}
                  data-testid="crud-export-collection-export-full-collection-action"
                />
              </>
            )}
            <ToolbarIconButton
              label="Export query to language"
              glyph="Code"
              onClick={onOpenExportToLanguage}
              data-testid="crud-export-to-language-button"
            />
          </div>
          {insights && <SignalPopover signals={insights} />}
        </div>
        <div className={toolbarRightActionStyles}>
          <Select
            data-testid="crud-document-per-page-selector"
            size="xsmall"
            disabled={isFetching}
            allowDeselect={false}
            dropdownWidthBasis="option"
            aria-label="Update number of documents per page"
            value={`${docsPerPage}`}
            onChange={(value: string) =>
              updateMaxDocumentsPerPage(parseInt(value))
            }
          >
            {['25', '50', '75', '100'].map((value) => (
              <Option
                className={docsPerPageOptionStyles}
                key={value}
                value={value}
              >
                {value}
              </Option>
            ))}
          </Select>
          <Body data-testid="crud-document-count-display">
            {start} – {end}{' '}
            {!loadingCount && (
              <span>
                {'of '}
                {count ?? (
                  <Tooltip
                    trigger={
                      <span
                        data-testid="crud-document-count-unavailable"
                        className={countUnavailableTextStyles}
                      >
                        N/A
                      </span>
                    }
                  >
                    <Body>
                      {countUnavailableTooltipText(lastCountRunMaxTimeMS)}
                    </Body>
                  </Tooltip>
                )}
              </span>
            )}
          </Body>
          {loadingCount && (
            <div className={loaderContainerStyles}>
              <SpinLoader size="12px" title="Fetching document count…" />
            </div>
          )}
          {!loadingCount && !isFetching && (
            <IconButton
              aria-label="Refresh documents"
              title="Refresh documents"
              data-testid="refresh-documents-button"
              onClick={onClickRefreshDocuments}
            >
              <Icon glyph="Refresh" />
            </IconButton>
          )}

          <div className={prevNextStyles}>
            <IconButton
              data-testid="docs-toolbar-prev-page-btn"
              aria-label="Previous Page"
              title="Previous Page"
              onClick={() => getPage(page - 1)}
              disabled={prevButtonDisabled}
            >
              <Icon glyph="ChevronLeft" />
            </IconButton>
            <IconButton
              data-testid="docs-toolbar-next-page-btn"
              aria-label="Next Page"
              title="Next Page"
              onClick={() => getPage(page + 1)}
              disabled={nextButtonDisabled}
            >
              <Icon glyph="ChevronRight" />
            </IconButton>
          </div>

          <ToolbarIconButton
            label={
              areAllDocumentsExpanded
                ? 'Collapse all documents'
                : 'Expand all documents'
            }
            glyph={areAllDocumentsExpanded ? 'CaretDown' : 'CaretRight'}
            onClick={
              areAllDocumentsExpanded
                ? onCollapseAllClicked
                : onExpandAllClicked
            }
            disabled={activeDocumentView === 'Table'}
            disabledReason="Not available in table view"
            data-testid="crud-expand-collapse-all-toggle"
          />

          <ViewSwitcher
            activeView={activeDocumentView}
            onChange={viewSwitchHandler}
          />
        </div>
      </div>
      {error && (
        <ErrorSummary
          data-testid="document-list-error-summary"
          errors={
            isOperationTimedOutError(error)
              ? INCREASE_MAX_TIME_MS_HINT
              : error.message
          }
        />
      )}
      {outdated && !error && (
        <WarningSummary
          data-testid="crud-outdated-message-id"
          warnings={[OUTDATED_WARNING]}
        />
      )}
    </div>
  );
};

export { CrudToolbar };

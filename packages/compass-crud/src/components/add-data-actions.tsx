import React, { useCallback } from 'react';
import { usePreference } from 'compass-preferences-model/provider';
import { useLocalAppRegistry } from '@mongodb-js/compass-app-registry';
import {
  ToolbarIconButton,
  toolbarButtonGroupStyles,
} from './toolbar-icon-button';

type AddDataActionsProps = {
  instanceDescription: string;
  insertDataHandler: (openInsertKey: 'import-file' | 'insert-document') => void;
  isWritable: boolean;
  isMockDataGeneratorEligible?: boolean;
};

const AddDataActions: React.FunctionComponent<AddDataActionsProps> = ({
  instanceDescription,
  insertDataHandler,
  isWritable,
  isMockDataGeneratorEligible = false,
}) => {
  const isImportExportEnabled = usePreference('enableImportExport');
  const localAppRegistry = useLocalAppRegistry();

  const onInsertDocument = useCallback(() => {
    insertDataHandler('insert-document');
  }, [insertDataHandler]);

  const onImportFile = useCallback(() => {
    insertDataHandler('import-file');
  }, [insertDataHandler]);

  const onGenerateMockData = useCallback(() => {
    localAppRegistry.emit('open-mock-data-generator-modal');
  }, [localAppRegistry]);

  // When the instance isn't writable the buttons are disabled and their
  // tooltips explain why, using the instance description.
  const disabledReason = isWritable ? undefined : instanceDescription;

  return (
    <div className={toolbarButtonGroupStyles}>
      <ToolbarIconButton
        label="Insert document"
        glyph="PlusWithCircle"
        variant="primary"
        onClick={onInsertDocument}
        disabled={!isWritable}
        disabledReason={disabledReason}
        data-testid="crud-add-data-insert-document-action"
      />
      {isImportExportEnabled && (
        <ToolbarIconButton
          label="Import JSON or CSV file"
          glyph="Import"
          onClick={onImportFile}
          disabled={!isWritable}
          disabledReason={disabledReason}
          data-testid="crud-add-data-import-file-action"
        />
      )}
      {isMockDataGeneratorEligible && (
        <ToolbarIconButton
          label="Generate mock data script"
          glyph="Sparkle"
          onClick={onGenerateMockData}
          disabled={!isWritable}
          disabledReason={disabledReason}
          data-testid="crud-add-data-generate-mock-data-action"
        />
      )}
    </div>
  );
};

export { AddDataActions };

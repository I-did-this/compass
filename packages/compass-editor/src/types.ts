import type { EditorView } from '@codemirror/view';
import type { EditorSearchResult } from './codemirror/search-util';

export type { EditorSearchResult };

export type CompletionWithServerInfo = {
  name?: string;
  value?: string;
  type?: string | undefined;
  /** Code snippet inserted when completion is selected */
  snippet?: string;
  exactMatch?: number | undefined;
  docHTML?: string | undefined;
} & {
  /** Server version that supports the stage */
  version: string;
  /* Server version that supports using the key in $project stage */
  projectVersion?: string;
  /** Optional completion description */
  description?: string;
};

export type EditorRef = {
  foldAll: () => boolean;
  unfoldAll: () => boolean;
  copyAll: () => boolean;
  prettify: () => boolean;
  applySnippet: (template: string) => boolean;
  focus: () => boolean;
  cursorDocEnd: () => boolean;
  startCompletion: () => boolean;
  /**
   * Sets the active search term, selecting the first match. Returns the
   * total match count and the 1-based index of the active match.
   */
  find: (term: string) => EditorSearchResult;
  /** Moves the selection to the next match (wraps around). */
  findNext: () => EditorSearchResult;
  /** Moves the selection to the previous match (wraps around). */
  findPrevious: () => EditorSearchResult;
  /** Clears the active search term. */
  clearSearch: () => void;
  /**
   * Scrolls the current selection to near the top of the viewport, leaving a
   * small margin so the focused line isn't flush against the top edge. Used
   * by callers (e.g. the Update Document modal opened from a per-field
   * wrench) that want the matched line presented as a header rather than
   * centered in the viewport.
   */
  scrollSelectionToTop: (topMarginPx?: number) => boolean;
  readonly editorContents: string | null;
  readonly editor: EditorView | null;
};

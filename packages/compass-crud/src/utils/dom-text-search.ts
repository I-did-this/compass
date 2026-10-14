import type { EditorSearchResult } from '@mongodb-js/compass-editor';
import type { DocumentSearchTarget } from '../components/document-find';

export const SEARCH_HIGHLIGHT = 'compass-document-search';
export const CURRENT_SEARCH_HIGHLIGHT = 'compass-document-search-current';

const activeSearches = new Set<DomTextSearch>();

// The CSS Custom Highlight API has a single page-wide registry keyed by name,
// so the matches of every open document search are merged into the same two
// entries. https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API
function syncHighlightRegistry() {
  if (typeof Highlight === 'undefined' || !CSS.highlights) {
    return;
  }
  const all: Range[] = [];
  const current: Range[] = [];
  for (const search of activeSearches) {
    all.push(...search.ranges);
    const currentRange = search.currentRange;
    if (currentRange) {
      current.push(currentRange);
    }
  }
  CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...all));
  CSS.highlights.set(CURRENT_SEARCH_HIGHLIGHT, new Highlight(...current));
}

/**
 * Case-insensitive text search over a rendered DOM tree. Matches are
 * highlighted without touching the DOM, so it works on top of components it
 * doesn't own (the shared document field renderer).
 */
export class DomTextSearch implements DocumentSearchTarget {
  ranges: Range[] = [];
  private current = 0;
  private term = '';
  private observer: MutationObserver | null = null;
  private readonly getContainer: () => HTMLElement | null;

  constructor(getContainer: () => HTMLElement | null) {
    this.getContainer = getContainer;
  }

  get currentRange(): Range | undefined {
    return this.current > 0 ? this.ranges[this.current - 1] : undefined;
  }

  // Like the editor search, typing selects the first match.
  find(term: string): EditorSearchResult {
    this.term = term;
    this.current = 0;
    this.collectMatches();
    this.observeContainer();
    activeSearches.add(this);
    return this.step(1);
  }

  findNext(): EditorSearchResult {
    return this.step(1);
  }

  findPrevious(): EditorSearchResult {
    return this.step(-1);
  }

  clearSearch(): void {
    this.term = '';
    this.ranges = [];
    this.current = 0;
    this.observer?.disconnect();
    this.observer = null;
    activeSearches.delete(this);
    syncHighlightRegistry();
  }

  private step(direction: 1 | -1): EditorSearchResult {
    const count = this.ranges.length;
    if (count === 0) {
      syncHighlightRegistry();
      return this.result();
    }
    this.current =
      this.current === 0
        ? direction === 1
          ? 1
          : count
        : ((this.current - 1 + direction + count) % count) + 1;
    syncHighlightRegistry();
    this.currentRange?.startContainer.parentElement?.scrollIntoView({
      block: 'nearest',
    });
    return this.result();
  }

  private result(): EditorSearchResult {
    return { count: this.ranges.length, current: this.current };
  }

  private collectMatches() {
    this.ranges = [];
    const container = this.getContainer();
    const needle = this.term.toLowerCase();
    if (!container || !needle) {
      return;
    }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.toLowerCase() ?? '';
      for (
        let index = text.indexOf(needle);
        index !== -1;
        index = text.indexOf(needle, index + needle.length)
      ) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + needle.length);
        this.ranges.push(range);
      }
    }
  }

  // Fields render after the search starts (expanding, "show more fields",
  // edits), so matches are recollected whenever the rendered document changes.
  private observeContainer() {
    const container = this.getContainer();
    if (this.observer || !container) {
      return;
    }
    this.observer = new MutationObserver(() => {
      this.collectMatches();
      this.current = Math.min(this.current, this.ranges.length);
      syncHighlightRegistry();
    });
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

/**
 * Routes Ctrl/Cmd+F to the search of the document the user last clicked in,
 * instead of the global find-in-page. compass-find-in-page dispatches the
 * cancelable `compass:find` event before opening its own find bar (see
 * compass-find-in-page/src/stores/store.ts); cancelling it keeps the global
 * find bar closed.
 */
export type DocumentSearchOwner = {
  contains(node: Node): boolean;
  openSearch(): void;
};

const owners = new Set<DocumentSearchOwner>();
let lastClickedOwner: DocumentSearchOwner | null = null;

function onPointerDown(event: PointerEvent) {
  const target = event.target;
  lastClickedOwner =
    target instanceof Node
      ? ([...owners].find((owner) => owner.contains(target)) ?? null)
      : null;
}

function onFind(event: Event) {
  if (lastClickedOwner && owners.has(lastClickedOwner)) {
    event.preventDefault();
    lastClickedOwner.openSearch();
  }
}

export function registerDocumentSearch(owner: DocumentSearchOwner) {
  if (owners.size === 0) {
    // Capture phase so the click is recorded even if a child stops it.
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('compass:find', onFind);
  }
  owners.add(owner);

  return () => {
    owners.delete(owner);
    if (lastClickedOwner === owner) {
      lastClickedOwner = null;
    }
    if (owners.size === 0) {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('compass:find', onFind);
    }
  };
}

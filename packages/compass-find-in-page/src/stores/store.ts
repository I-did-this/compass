import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { ipcRenderer } from 'hadron-ipc';

import reducer, { toggleStatus, setSearchTerm } from '../modules';

type FindInPageStore = ReturnType<typeof createFindInPageStore>;

function createFindInPageStore() {
  return createStore(reducer, applyMiddleware(thunk));
}

export function createAppFindHandler(store: FindInPageStore) {
  return () => {
    // Gives a more specific find UI (e.g. compass-crud's per-document search,
    // see document-search-focus.ts) the chance to take Ctrl/Cmd+F instead of
    // the global find-in-page, by cancelling this event.
    const findEvent = new Event('compass:find', { cancelable: true });
    if (!window.dispatchEvent(findEvent)) {
      return;
    }
    if (store.getState().enabled) {
      void ipcRenderer?.call('app:stop-find-in-page', 'clearSelection');
      store.dispatch(setSearchTerm(''));
    }
    store.dispatch(toggleStatus());
  };
}

export function activatePlugin() {
  const store = createFindInPageStore();
  const onAppFind = createAppFindHandler(store);

  ipcRenderer?.on('app:find', onAppFind);

  return {
    store,
    deactivate() {
      ipcRenderer?.off('app:find', onAppFind);
    },
  };
}

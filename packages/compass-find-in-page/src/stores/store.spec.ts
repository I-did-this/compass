import { expect } from 'chai';
import { activatePlugin, createAppFindHandler } from './store';

describe('CompassFindInPageStore [Store]', function () {
  it("should have an initial state of {status: 'enabled'}", function () {
    const { store } = activatePlugin();
    expect(store.getState()).to.be.deep.equal({
      searching: false,
      searchTerm: '',
      enabled: false,
    });
  });

  describe('on app:find', function () {
    let cancelFind: ((event: Event) => void) | undefined;

    afterEach(function () {
      if (cancelFind) {
        window.removeEventListener('compass:find', cancelFind);
        cancelFind = undefined;
      }
    });

    it('opens the global find bar', function () {
      const { store } = activatePlugin();

      createAppFindHandler(store)();

      expect(store.getState().enabled).to.equal(true);
    });

    it('leaves the global find bar closed when another find UI takes it', function () {
      const { store } = activatePlugin();
      cancelFind = (event: Event) => event.preventDefault();
      window.addEventListener('compass:find', cancelFind);

      createAppFindHandler(store)();

      expect(store.getState().enabled).to.equal(false);
    });
  });
});

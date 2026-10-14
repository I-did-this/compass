import { expect } from 'chai';
import sinon from 'sinon';
import { registerDocumentSearch } from './document-search-focus';

function pressFind(): boolean {
  return window.dispatchEvent(new Event('compass:find', { cancelable: true }));
}

describe('registerDocumentSearch', function () {
  let first: HTMLDivElement;
  let second: HTMLDivElement;
  let outside: HTMLDivElement;
  const cleanups: (() => void)[] = [];

  beforeEach(function () {
    [first, second, outside] = [0, 1, 2].map(() => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      return element;
    });
  });

  afterEach(function () {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    [first, second, outside].forEach((element) => element.remove());
  });

  function register(element: HTMLElement) {
    const openSearch = sinon.spy();
    cleanups.push(
      registerDocumentSearch({
        contains: (node) => element.contains(node),
        openSearch,
      })
    );
    return openSearch;
  }

  function click(element: HTMLElement) {
    element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  }

  it('opens the search of the last clicked document and keeps the global find closed', function () {
    const openFirst = register(first);
    const openSecond = register(second);

    click(first);
    click(second);

    expect(pressFind()).to.equal(false);
    expect(openSecond).to.have.been.calledOnce;
    expect(openFirst).to.not.have.been.called;
  });

  it('leaves Ctrl/Cmd+F to the global find after clicking outside any document', function () {
    const openFirst = register(first);

    click(first);
    click(outside);

    expect(pressFind()).to.equal(true);
    expect(openFirst).to.not.have.been.called;
  });

  it('forgets a document once it is unregistered', function () {
    const openFirst = register(first);
    click(first);
    cleanups.splice(0).forEach((cleanup) => cleanup());

    expect(pressFind()).to.equal(true);
    expect(openFirst).to.not.have.been.called;
  });
});

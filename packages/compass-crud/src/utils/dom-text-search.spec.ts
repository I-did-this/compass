import { expect } from 'chai';
import { DomTextSearch } from './dom-text-search';

describe('DomTextSearch', function () {
  let container: HTMLDivElement;
  let search: DomTextSearch;

  beforeEach(function () {
    container = document.createElement('div');
    container.innerHTML =
      '<span>email</span><span>"nehal@callhippo.com"</span>' +
      '<span>firstName</span><span>"NEHAL"</span>';
    document.body.appendChild(container);
    search = new DomTextSearch(() => container);
  });

  afterEach(function () {
    search.clearSearch();
    container.remove();
  });

  it('counts case-insensitive matches and selects the first one', function () {
    expect(search.find('nehal')).to.deep.equal({ count: 2, current: 1 });
    expect(search.find('EMAIL')).to.deep.equal({ count: 1, current: 1 });
    expect(search.find('missing')).to.deep.equal({ count: 0, current: 0 });
  });

  it('steps through matches in both directions and wraps around', function () {
    search.find('nehal');

    expect(search.findNext()).to.deep.equal({ count: 2, current: 2 });
    expect(search.findNext()).to.deep.equal({ count: 2, current: 1 });
    expect(search.findPrevious()).to.deep.equal({ count: 2, current: 2 });
  });

  it('forgets matches once cleared', function () {
    search.find('nehal');
    search.clearSearch();

    expect(search.ranges).to.have.length(0);
    expect(search.findNext()).to.deep.equal({ count: 0, current: 0 });
  });

  it('picks up fields rendered after the search started', async function () {
    search.find('nehal');

    const span = document.createElement('span');
    span.textContent = '"Nehal Callhippo"';
    container.appendChild(span);
    // MutationObserver callbacks run as a microtask.
    await Promise.resolve();

    expect(search.ranges).to.have.length(3);
  });
});

  function wikiUrl(term){ return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(term)}`; }

  function learnChips(art){
    return [
      { label: art.artist, url: wikiUrl(art.artist) },
      { label: art.era, url: wikiUrl(art.era) },
      { label: `more by ${art.artist} at ${art.source}`, url: art.sourceSearchUrl },
      { label: `view at ${art.source}`, url: art.sourceUrl }
    ];
  }

  // Builds one review-screen entry: thumbnail, verdict, full artwork
  // record, and lookup links — this is the information that used to
  // flash by mid-round; now it's browsable at the player's own pace.
  function reviewEntryHTML(entry){
    const { art, options, verdictClass, verdictLabel } = entry;
    const chips = learnChips(art);
    return `
      <div class="review-item">
        <img class="review-thumb" src="${art.img}" alt="" referrerpolicy="no-referrer">
        <div class="review-body">
          <div class="verdict-tag ${verdictClass}">${verdictLabel}</div>
          <div class="placard-card">
            <p class="pc-artist">${art.artist}</p>
            ${art.title ? `<p class="pc-title">${art.title}</p>` : ''}
            <p class="pc-era">${art.era}${art.date ? ', ' + art.date : ''}</p>
            ${art.medium ? `<p class="pc-medium">${art.medium}</p>` : ''}
          </div>
          <div class="learn-chips">
            ${chips.map(c => `<a class="learn-chip" href="${c.url}" target="_blank" rel="noopener noreferrer">${c.label}</a>`).join('')}
          </div>
        </div>
      </div>`;
  }

  function renderReview(){
    state.screen = 'review';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">review</h2>
        <div class="review-list">${state.history.map(reviewEntryHTML).join('')}</div>
      </div>`;
  }


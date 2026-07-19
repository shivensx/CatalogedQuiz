  /* ============================================================
     LEARN TAB — rendering. Content/data lives in js/learn-content.js;
     the AIC lookup fetchers live in js/api-sources.js. This file is
     just the screens: four browsable lists (Movements / Artists /
     Subjects / Mediums), and detail pages that show a write-up, the
     real artworks it references, and a short quiz.
     ============================================================ */

  const learnExampleCache = new Map(); // lookup key -> resolved artwork (or null)

  function learnLookupKey(lookup){
    return lookup.type === 'id'
      ? `${lookup.source}-id-${lookup.id}`
      : `${lookup.source}-title-${lookup.artist}-${lookup.titleKeyword}`;
  }

  async function resolveLearnExamples(examples){
    return Promise.all(examples.map(async ex => {
      const key = learnLookupKey(ex.lookup);
      if(!learnExampleCache.has(key)){
        learnExampleCache.set(key, await resolveLearnExample(ex.lookup));
      }
      return { ...ex, art: learnExampleCache.get(key) };
    }));
  }

  function examplesRowHTML(resolved){
    const usable = resolved.filter(r => r.art);
    if(!usable.length) return '';
    return `
      <div class="examples-row">
        ${usable.map(r => `
          <a class="example-card" href="${r.art.sourceUrl}" target="_blank" rel="noopener noreferrer">
            <img src="${r.art.img}" alt="" loading="lazy" referrerpolicy="no-referrer">
            <span class="example-cap">
              <span class="example-title">${r.art.title || r.refLabel}</span>
              <span class="example-meta">${r.art.artist}${r.art.date ? ', ' + r.art.date : ''}</span>
            </span>
          </a>`).join('')}
      </div>`;
  }

  function quizBlockHTML(quiz, quizId){
    return `
      <div class="quiz-block" id="${quizId}">
        <div class="quiz-label">quick check</div>
        ${quiz.map((q, qi) => `
          <div class="quiz-q">
            <p class="quiz-question">${q.question}</p>
            <div class="quiz-options">
              ${q.options.map((opt, oi) => `
                <button class="quiz-option" data-q="${qi}" data-o="${oi}">${opt}</button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  function wireQuiz(quizId, quiz){
    const root = document.getElementById(quizId);
    if(!root) return;
    quiz.forEach((q, qi) => {
      const buttons = root.querySelectorAll(`.quiz-option[data-q="${qi}"]`);
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          if(root.dataset[`answered${qi}`]) return;
          root.dataset[`answered${qi}`] = '1';
          const chosen = parseInt(btn.dataset.o, 10);
          buttons.forEach(b => {
            b.disabled = true;
            const oi = parseInt(b.dataset.o, 10);
            if(oi === q.correct) b.classList.add('correct');
            else if(oi === chosen) b.classList.add('incorrect');
          });
        });
      });
    });
  }

  // Figures out what "continue" should point to when a detail page was
  // reached by walking a movement's path, vs. browsed directly.
  function nextPathStep(pathCtx){
    if(!pathCtx) return null;
    const movement = LEARN_CONTENT.movements[pathCtx.movementId];
    if(!movement) return null;
    return movement.path[pathCtx.stepIndex + 1] || null;
  }

  function goToPathStep(step, pathCtx){
    if(!step){ renderLearn(); return; }
    const nextCtx = { movementId: pathCtx.movementId, stepIndex: pathCtx.stepIndex + 1 };
    if(step.kind === 'artist') renderLearnArtistDetail(step.id, nextCtx);
    else renderLearnSubjectDetail(step.id, nextCtx);
  }

  // ---------------- SCREEN: LEARN HUB ----------------
  function renderLearn(){
    state.screen = 'learn';
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">learn</h2>
        <div class="mode-list" id="learnList"></div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    const learnList = document.getElementById('learnList');
    const sections = [
      { name: 'Movements', action: renderLearnMovements },
      { name: 'Artists', action: renderLearnArtists },
      { name: 'Subjects', action: renderLearnSubjects },
      { name: 'Mediums', action: renderLearnMediums }
    ];
    sections.forEach(s => {
      const b = document.createElement('button');
      b.className = 'mode-item';
      b.innerHTML = `<span class="mode-main"><span class="mode-name">${s.name}</span></span>`;
      b.addEventListener('click', s.action);
      learnList.appendChild(b);
    });
    document.getElementById('backBtn').addEventListener('click', renderLanding);
  }

  // ---------------- SHARED: BROWSABLE LIST SCREEN ----------------
  function renderLearnList(screenName, title, entries, onOpen){
    state.screen = screenName;
    updateChrome();
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">${title}</h2>
        <div class="mode-list" id="learnEntryList"></div>
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
        </div>
      </div>`;
    const list = document.getElementById('learnEntryList');
    if(!entries.length){
      list.innerHTML = `<p class="stage-body">Content coming soon.</p>`;
    }
    entries.forEach(entry => {
      const b = document.createElement('button');
      b.className = 'mode-item';
      b.innerHTML = `
        <span class="mode-main">
          <span class="mode-name">${entry.title}</span>
          <span class="mode-desc">${entry.teaser}</span>
        </span>`;
      b.addEventListener('click', () => onOpen(entry.id));
      list.appendChild(b);
    });
    document.getElementById('backBtn').addEventListener('click', renderLearn);
  }

  function renderLearnMovements(){
    renderLearnList('learn-movements', 'movements', Object.values(LEARN_CONTENT.movements), renderLearnMovementDetail);
  }
  function renderLearnArtists(){
    renderLearnList('learn-artists', 'artists', Object.values(LEARN_CONTENT.artists), id => renderLearnArtistDetail(id, null));
  }
  function renderLearnSubjects(){
    renderLearnList('learn-subjects', 'subjects', Object.values(LEARN_CONTENT.subjects), id => renderLearnSubjectDetail(id, null));
  }
  function renderLearnMediums(){
    renderLearnList('learn-mediums', 'mediums', Object.values(LEARN_CONTENT.mediums), () => {});
  }

  // ---------------- SHARED: DETAIL SCREEN ----------------
  // Renders a write-up + its example artworks + a quiz, then either a
  // "continue" button (if reached via a movement's guided path) or a
  // plain "back" button (if browsed directly from a list).
  async function renderLearnDetail(opts){
    const { screenName, entry, backAction, continueLabel, onContinue } = opts;
    state.screen = screenName;
    updateChrome();
    const quizId = `quiz-${entry.id}`;
    screenEl.innerHTML = `
      <div class="stage-wrap">
        <h2 class="stage-title">${entry.title.toLowerCase()}</h2>
        ${entry.years ? `<p class="learn-meta">${entry.years}</p>` : ''}
        <div class="writeup">${entry.writeupHtml}</div>
        <div id="examplesSlot"><p class="stage-body">loading referenced artworks…</p></div>
        ${quizBlockHTML(entry.quiz, quizId)}
        <div class="stage-actions">
          <button class="btn btn-ghost" id="backBtn">back</button>
          ${continueLabel ? `<button class="btn btn-primary" id="continueBtn">${continueLabel}</button>` : ''}
        </div>
      </div>`;
    wireQuiz(quizId, entry.quiz);
    document.getElementById('backBtn').addEventListener('click', backAction);
    if(onContinue) document.getElementById('continueBtn').addEventListener('click', onContinue);

    const resolved = await resolveLearnExamples(entry.examples);
    const slot = document.getElementById('examplesSlot');
    if(slot) slot.outerHTML = examplesRowHTML(resolved) || '';
  }

  function renderLearnMovementDetail(id){
    const movement = LEARN_CONTENT.movements[id];
    const firstStep = movement.path[0];
    const firstEntry = firstStep && (firstStep.kind === 'artist' ? LEARN_CONTENT.artists[firstStep.id] : LEARN_CONTENT.subjects[firstStep.id]);
    renderLearnDetail({
      screenName: 'learn-movement-detail',
      entry: movement,
      backAction: renderLearnMovements,
      continueLabel: firstEntry ? `continue to ${firstEntry.title} \u2192` : null,
      onContinue: firstStep ? () => goToPathStep(firstStep, { movementId: id, stepIndex: -1 }) : null
    });
  }

  function renderLearnArtistDetail(id, pathCtx){
    const artist = LEARN_CONTENT.artists[id];
    const next = nextPathStep(pathCtx);
    const nextEntry = next && (next.kind === 'artist' ? LEARN_CONTENT.artists[next.id] : LEARN_CONTENT.subjects[next.id]);
    renderLearnDetail({
      screenName: 'learn-artist-detail',
      entry: artist,
      backAction: pathCtx ? () => renderLearnMovementDetail(pathCtx.movementId) : renderLearnArtists,
      continueLabel: pathCtx ? (nextEntry ? `continue to ${nextEntry.title} \u2192` : 'finish \u2192') : null,
      onContinue: pathCtx ? () => goToPathStep(next, pathCtx) : null
    });
  }

  function renderLearnSubjectDetail(id, pathCtx){
    const subject = LEARN_CONTENT.subjects[id];
    const next = nextPathStep(pathCtx);
    const nextEntry = next && (next.kind === 'artist' ? LEARN_CONTENT.artists[next.id] : LEARN_CONTENT.subjects[next.id]);
    renderLearnDetail({
      screenName: 'learn-subject-detail',
      entry: subject,
      backAction: pathCtx ? () => renderLearnMovementDetail(pathCtx.movementId) : renderLearnSubjects,
      continueLabel: pathCtx ? (nextEntry ? `continue to ${nextEntry.title} \u2192` : 'finish \u2192') : null,
      onContinue: pathCtx ? () => goToPathStep(next, pathCtx) : null
    });
  }

  // ---------------- BOOT ----------------
  async function boot(){
    warmPoolInBackground();
    warmLearnContent();
    await Theme.init();
    document.getElementById('themeBtn').addEventListener('click', () => Theme.toggle());
    document.getElementById('profileBtn').addEventListener('click', renderLogin);
    document.getElementById('logoMark').addEventListener('click', () => {
      if(state.screen !== 'loading') renderLanding();
    });
    renderLanding();

    const scrollBtn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('show', window.scrollY > 300);
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  boot();

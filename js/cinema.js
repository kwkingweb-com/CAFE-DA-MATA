/* Local MP4 playback: no player library, API key or external video service. */
(() => {
  'use strict';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = window.matchMedia('(max-width: 750px)');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const automaticMotionAllowed = () => !motionPreference.matches && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType);
  const background = document.querySelector('[data-background-video]');
  const toggle = document.querySelector('[data-motion-toggle]');
  const surface = document.querySelector('[data-motion-surface]');
  let pausedByVisitor = false;
  let explicitlyStarted = false;
  let visible = true;
  let backgroundFailed = false;
  let backgroundCompleted = false;
  let playAttempt = null;

  const anyDialogOpen = () => !!document.querySelector('dialog[open]');
  function setToggleState() {
    if (!toggle || !background) return;
    const playing = !background.paused && !background.ended;
    const label = playing ? 'Pausar vídeo de fundo' : backgroundCompleted ? 'Rever vídeo de fundo' : 'Reproduzir vídeo de fundo';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.querySelector('[data-motion-icon]').setAttribute('href', playing ? '#i-movie-pause' : '#i-movie-play');
  }
  function attachBackgroundSource() {
    if (background.getAttribute('src')) return;
    background.src = smallScreen.matches ? background.dataset.mobileSrc : background.dataset.desktopSrc;
    background.muted = true;
    background.defaultMuted = true;
    background.load();
  }
  function synchronizeMotion() {
    if (!background || backgroundFailed) return;
    const shouldPlay = (explicitlyStarted || automaticMotionAllowed()) && !pausedByVisitor && !backgroundCompleted && !background.ended && visible && !document.hidden && !anyDialogOpen();
    if (!shouldPlay) {
      background.pause();
      return;
    }
    attachBackgroundSource();
    if (background.paused && !playAttempt) {
      playAttempt = background.play();
      if (playAttempt?.catch) {
        playAttempt.catch(() => { /* Autoplay may be blocked; the real photo stays visible. */ })
          .finally(() => { playAttempt = null; setToggleState(); });
      } else { playAttempt = null; }
    }
  }

  if (background && toggle && surface) {
    toggle.hidden = false;
    background.addEventListener('playing', () => {
      background.classList.add('has-frame');
      setToggleState();
      if (document.hidden || anyDialogOpen() || pausedByVisitor || !visible) background.pause();
    });
    background.addEventListener('pause', setToggleState);
    background.addEventListener('ended', () => {
      // Keep the final frame; do not jump back or reverse the camera.
      backgroundCompleted = true;
      setToggleState();
    });
    background.addEventListener('error', () => {
      backgroundFailed = true;
      background.classList.remove('has-frame');
      toggle.hidden = true;
    });
    toggle.addEventListener('click', () => {
      if (!background.paused) {
        pausedByVisitor = true;
        background.pause();
      } else {
        if (backgroundCompleted || background.ended) {
          backgroundCompleted = false;
          background.currentTime = 0;
        }
        pausedByVisitor = false;
        explicitlyStarted = true;
        synchronizeMotion();
      }
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        synchronizeMotion();
      }, { threshold: 0.04 });
      observer.observe(surface);
    }
    motionPreference.addEventListener?.('change', synchronizeMotion);
    connection?.addEventListener?.('change', synchronizeMotion);
    document.addEventListener('visibilitychange', synchronizeMotion);
    new MutationObserver(synchronizeMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setToggleState();
    requestAnimationFrame(() => requestAnimationFrame(synchronizeMotion));
  }

  const dialog = document.getElementById('film-dialog');
  const player = document.getElementById('film-player');
  const title = document.getElementById('film-title');
  const caption = document.getElementById('film-caption');
  const status = document.getElementById('film-status');
  const roomLink = document.getElementById('film-room-link');
  if (!dialog || !player) return;
  let filmOpener = null;
  const showStatus = message => { status.textContent = message; status.hidden = !message; };
  player.addEventListener('playing', () => showStatus(''));
  player.addEventListener('canplay', () => showStatus(''));
  player.addEventListener('waiting', () => { if (dialog.open) showStatus('Carregando vídeo…'); });
  player.addEventListener('error', () => { if (dialog.open) showStatus('Não foi possível carregar o vídeo. As fotos da acomodação continuam disponíveis na galeria.'); });

  document.querySelectorAll('[data-film]').forEach(link => {
    link.addEventListener('click', event => {
      if (typeof dialog.showModal !== 'function') return;
      event.preventDefault();
      filmOpener = link;
      title.textContent = link.dataset.filmTitle;
      caption.textContent = link.dataset.filmCaption;
      roomLink.href = link.dataset.filmPage || 'index.html#acomodacoes';
      roomLink.querySelector('span').textContent = link.dataset.filmPage ? 'Conhecer a acomodação' : 'Conhecer os chalés';
      player.poster = link.dataset.filmPoster;
      player.src = smallScreen.matches && link.dataset.filmMobile ? link.dataset.filmMobile : link.getAttribute('href');
      player.muted = true;
      player.defaultMuted = true;
      showStatus('Carregando vídeo…');
      const menu = document.getElementById('mobile-menu');
      if (menu) menu.open = false;
      document.querySelectorAll('.nav-dropdown[open]').forEach(item => { item.open = false; });
      if (!dialog.open) dialog.showModal();
      document.body.classList.add('dialog-open');
      background?.pause();
      player.load();
      const attempt = player.play();
      attempt?.catch(() => { if (dialog.open) showStatus('Toque no botão de reprodução para assistir.'); });
    });
  });
  dialog.addEventListener('close', () => {
    player.pause();
    player.removeAttribute('src');
    player.load();
    showStatus('');
    if (!anyDialogOpen()) document.body.classList.remove('dialog-open');
    filmOpener?.focus({ preventScroll: true });
    synchronizeMotion();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dialog.open) player.pause();
  });
})();

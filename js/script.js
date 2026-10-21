/* Pousada Café da Mata — consulta de datas, menu e galeria */
(() => {
  'use strict';
  const WHATSAPP = '5532984023517';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function dateSerial(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return NaN;
    return date.getTime();
  }

  function nextDay(value) {
    const valueInMs = dateSerial(value);
    return Number.isFinite(valueInMs) ? new Date(valueInMs + 86400000).toISOString().slice(0, 10) : '';
  }

  function todayInBrazil() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const part = name => parts.find(item => item.type === name).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  }

  function formatDate(value) { return value.split('-').reverse().join('/'); }

  function makeMessage(data) {
    const nights = Math.round((dateSerial(data.departure) - dateSerial(data.arrival)) / 86400000);
    return [
      'Olá! Gostaria de consultar uma hospedagem na Pousada Café da Mata.', '',
      '*Entrada:* ' + formatDate(data.arrival),
      '*Saída:* ' + formatDate(data.departure),
      '*Período:* ' + nights + (nights === 1 ? ' noite' : ' noites'),
      '*Adultos:* ' + data.adults,
      '*Crianças:* ' + data.children,
      data.children !== '0' ? '*Idades das crianças:* ' + data.ages.trim() : '',
      '*Acomodação:* ' + (data.room || 'Gostaria de uma indicação'),
      data.notes.trim() ? '*Observações:* ' + data.notes.trim() : '', '',
      'Podem me informar a disponibilidade e os valores, por favor?'
    ].filter((line, index) => line !== '' || index === 1).join('\n');
  }

  const header = $('#header');
  const setHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
  setHeader();
  window.addEventListener('scroll', setHeader, { passive: true });
  $('#year').textContent = new Date().getFullYear();

  const menu = $('#mobile-menu');
  const dropdowns = $$('.nav-dropdown');
  $$('#mobile-menu a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
  document.addEventListener('pointerdown', event => {
    if (!menu.contains(event.target)) menu.open = false;
    dropdowns.forEach(dropdown => {
      if (!dropdown.contains(event.target)) dropdown.open = false;
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
    if (event.key === 'Escape') dropdowns.forEach(dropdown => { dropdown.open = false; });
  });

  const dialogs = $$('dialog');
  const syncLock = () => document.body.classList.toggle('dialog-open', dialogs.some(dialog => dialog.open));
  dialogs.forEach(dialog => {
    dialog.addEventListener('close', syncLock);
    dialog.addEventListener('click', event => {
      const box = dialog.getBoundingClientRect();
      if (event.target === dialog && (
        event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom
      )) dialog.close();
    });
  });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  const openDialog = dialog => {
    menu.open = false;
    dropdowns.forEach(dropdown => { dropdown.open = false; });
    if (!dialog.open) dialog.showModal();
    syncLock();
  };

  const booking = $('#booking-dialog');
  const form = $('#booking-form');
  const arrival = $('#arrival');
  const departure = $('#departure');
  const children = $('#children');
  const ages = $('#ages');
  const room = $('#room');
  const formStatus = $('#form-status');
  const tripSummary = $('#trip-summary');
  const DRAFT_KEY = 'cafedamata-stay-v2';

  // Só o período e a composição da viagem acompanham a navegação nesta aba.
  // Nada é enviado até a pessoa continuar para o WhatsApp.
  function restoreDraft() {
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
      if (!draft || typeof draft !== 'object') return;
      if (typeof draft.arrival === 'string' && draft.arrival >= todayInBrazil() && Number.isFinite(dateSerial(draft.arrival))) arrival.value = draft.arrival;
      if (arrival.value && typeof draft.departure === 'string' && draft.departure > arrival.value && Number.isFinite(dateSerial(draft.departure))) departure.value = draft.departure;
      ['adults', 'children'].forEach(id => {
        const field = $('#' + id);
        if (Array.from(field.options).some(option => option.value === draft[id])) field.value = draft[id];
      });
      if (typeof draft.ages === 'string') ages.value = draft.ages.slice(0, 80);
    } catch { /* O site também funciona quando o navegador bloqueia o armazenamento local. */ }
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        arrival: arrival.value, departure: departure.value,
        adults: $('#adults').value, children: children.value,
        ages: children.value !== '0' ? ages.value : ''
      }));
    } catch { /* A consulta continua disponível sem armazenamento. */ }
  }

  function updateTripSummary() {
    if (!tripSummary) return;
    const nights = (dateSerial(departure.value) - dateSerial(arrival.value)) / 86400000;
    const valid = Number.isFinite(nights) && nights > 0 && arrival.value >= todayInBrazil();
    tripSummary.hidden = !valid;
    tripSummary.textContent = valid ? nights + (nights === 1 ? ' noite' : ' noites') + ' · ' + formatDate(arrival.value) + ' a ' + formatDate(departure.value) + (room.value ? ' · ' + room.value : '') : '';
  }

  function syncChildren() {
    const hasChildren = children.value !== '0';
    $('#ages-field').hidden = !hasChildren;
    ages.disabled = !hasChildren;
    ages.required = hasChildren;
    ages.setCustomValidity('');
  }

  restoreDraft();
  syncChildren();
  if (document.body.dataset.room) room.value = document.body.dataset.room;
  updateTripSummary();

  const syncDates = () => {
    arrival.min = todayInBrazil();
    departure.min = arrival.value && Number.isFinite(dateSerial(arrival.value))
      ? nextDay(arrival.value) : nextDay(arrival.min);
  };
  syncDates();
  arrival.addEventListener('input', () => {
    arrival.setCustomValidity('');
    departure.setCustomValidity('');
    syncDates();
    if (departure.value && departure.value < departure.min) departure.value = '';
  });
  departure.addEventListener('input', () => departure.setCustomValidity(''));
  children.addEventListener('change', syncChildren);

  $$('[data-book]').forEach(link => link.addEventListener('click', event => {
    if (typeof booking.showModal !== 'function') return;
    event.preventDefault();
    room.value = link.dataset.book || document.body.dataset.room || '';
    formStatus.textContent = '';
    $('#whatsapp-fallback').hidden = true;
    arrival.setCustomValidity('');
    departure.setCustomValidity('');
    syncDates();
    updateTripSummary();
    openDialog(booking);
  }));
  ages.addEventListener('input', () => ages.setCustomValidity(''));
  form.addEventListener('input', () => {
    formStatus.textContent = '';
    $('#whatsapp-fallback').hidden = true;
    saveDraft();
    updateTripSummary();
  });
  form.addEventListener('change', () => { saveDraft(); updateTripSummary(); });

  form.addEventListener('submit', event => {
    event.preventDefault();
    arrival.setCustomValidity('');
    departure.setCustomValidity('');
    syncDates();
    const start = dateSerial(arrival.value);
    const end = dateSerial(departure.value);
    if (!Number.isFinite(start) || arrival.value < todayInBrazil()) {
      arrival.setCustomValidity('Escolha uma data de entrada a partir de hoje.');
    }
    if (!Number.isFinite(end) || end <= start) {
      departure.setCustomValidity('A saída precisa ser depois da entrada.');
    }
    ages.setCustomValidity(children.value !== '0' && !ages.value.trim() ? 'Informe as idades das crianças.' : '');
    if (!form.reportValidity()) return;
    const message = makeMessage({
      arrival: arrival.value, departure: departure.value,
      adults: $('#adults').value, children: children.value,
      ages: ages.value, room: room.value, notes: $('#notes').value
    });
    const url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(message);
    const fallback = $('#whatsapp-fallback');
    fallback.href = url;
    fallback.hidden = false;
    formStatus.textContent = 'Sua consulta está pronta. Abrindo o WhatsApp…';
    window.location.assign(url);
  });

  const photoLinks = $$('#gallery [data-photo]');
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightbox-image');
  const lightboxStatus = $('#lightbox-status');
  const thumbnailContainer = $('#photo-thumbnails');
  const thumbnailButtons = [];
  let photoIndex = 0;
  function showPhoto(index) {
    if (!photoLinks.length) return;
    photoIndex = (index + photoLinks.length) % photoLinks.length;
    const link = photoLinks[photoIndex];
    lightboxImage.hidden = false;
    lightboxStatus.textContent = 'Carregando foto…';
    lightboxImage.alt = link.querySelector('img').alt;
    lightboxImage.src = link.href;
    $('#photo-caption').textContent = link.dataset.caption;
    $('#photo-counter').textContent = (photoIndex + 1) + ' / ' + photoLinks.length;
    thumbnailButtons.forEach((button, index) => button.setAttribute('aria-current', String(index === photoIndex)));
  }
  lightboxImage.addEventListener('load', () => { lightboxStatus.textContent = ''; });
  lightboxImage.addEventListener('error', () => {
    lightboxImage.hidden = true;
    lightboxStatus.textContent = 'Não foi possível carregar esta foto. Use as setas para ver a próxima.';
  });
  photoLinks.forEach((link, index) => link.addEventListener('click', event => {
    if (typeof lightbox.showModal !== 'function') return;
    event.preventDefault();
    showPhoto(index);
    openDialog(lightbox);
  }));
  photoLinks.forEach((link, index) => {
    if (!thumbnailContainer) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Ver foto ' + (index + 1) + ': ' + link.dataset.caption);
    button.setAttribute('aria-current', 'false');
    const thumb = document.createElement('img');
    thumb.src = link.querySelector('img').src;
    thumb.alt = '';
    thumb.loading = 'lazy';
    button.appendChild(thumb);
    button.addEventListener('click', () => showPhoto(index));
    thumbnailContainer.appendChild(button);
    thumbnailButtons.push(button);
  });
  $$('[data-gallery-open]').forEach(button => button.addEventListener('click', () => {
    if (typeof lightbox.showModal !== 'function' || !photoLinks.length) {
      $('#galeria').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      return;
    }
    showPhoto(0);
    openDialog(lightbox);
  }));
  $('#previous-photo').addEventListener('click', () => showPhoto(photoIndex - 1));
  $('#next-photo').addEventListener('click', () => showPhoto(photoIndex + 1));
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      showPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  let touchStart = null;
  lightboxImage.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  lightboxImage.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 80) showPhoto(photoIndex + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  lightboxImage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });

  if ('IntersectionObserver' in window && !reducedMotion) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('will-reveal');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    $$('[data-reveal]').forEach(element => {
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('will-reveal');
        observer.observe(element);
      }
    });
  }
})();

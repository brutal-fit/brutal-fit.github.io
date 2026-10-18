// Set to the waitlist service URL to start collecting sign-ups. Empty means nothing is sent.
const WAITLIST_ENDPOINT = '';

(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 880px)');

  // Navigation: mobile panel toggle and the scrolled pill state.
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.getElementById('nav-panel');

  function setOpen(open) {
    if (!header || !toggle) return;
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-open', open);
  }

  function isOpen() {
    return !!header && header.classList.contains('is-open');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });
  }

  if (panel) {
    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  function onBreakpoint() {
    if (desktop.matches) setOpen(false);
  }
  if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);

  function onScroll() {
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Reveal on scroll. Without IntersectionObserver or with reduced motion, show everything now.
  var revealables = document.querySelectorAll('[data-reveal]');
  function showAll() {
    for (var i = 0; i < revealables.length; i++) revealables[i].classList.add('is-visible');
  }
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (var j = 0; j < revealables.length; j++) observer.observe(revealables[j]);
  }

  // Links marked data-role preselect the waitlist role, so no query string is needed.
  var form = document.getElementById('waitlist-form');
  var roleSelect = form ? form.querySelector('select[name="role"]') : null;
  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-role]');
    if (link && roleSelect) roleSelect.value = link.getAttribute('data-role');
  });

  // Waitlist form. Native validation runs before this handler fires.
  if (!form) return;
  var status = document.getElementById('form-status');
  var submit = form.querySelector('button[type="submit"]');

  var MESSAGES = {
    closed: 'The waitlist is not open yet. We are not collecting details until it is. Check back soon.',
    ok: 'You are on the list.',
    failed: 'That did not go through. Please try again.'
  };

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (!WAITLIST_ENDPOINT) {
      setStatus(MESSAGES.closed);
      return;
    }

    var data = new FormData(form);
    var payload = {
      email: String(data.get('email') || '').trim(),
      role: String(data.get('role') || 'client'),
      city: String(data.get('city') || '').trim(),
      source: 'brutal-fit.github.io'
    };

    if (submit) submit.disabled = true;
    setStatus('');

    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (response.ok) {
        setStatus(MESSAGES.ok);
        form.reset();
      } else {
        setStatus(MESSAGES.failed);
      }
    }).catch(function () {
      setStatus(MESSAGES.failed);
    }).then(function () {
      if (submit) submit.disabled = false;
    });
  });
})();

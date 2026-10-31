/* ==========================================================================
   MOVEMENT TO WORK: MAIN.JS
   ==========================================================================
   Progressive enhancement. With this file absent every section still
   renders and reads top to bottom; style.css only pins or hides things
   under the `.js` class set in <head>.

   What this file adds
     1. Menu        modal dialog: opens as a circle from the toggle, traps
                    focus, closes on Esc, the X or a link, and gives focus
                    back to the toggle. The toggle's bars fold into an X.
     2. Intro       one scroll-driven timeline across the pinned stage,
                    which plays through on its own after the first nudge
                    down (or back up from the top of About):
                      a. hero copy lifts and fades
                      b. green field fades in while the words MOVEMENT TO
                         WORK shrink into place, the photograph showing
                         through the letters
                      c. the words lift upwards as About slides over
     3. About       pieces rise in as they enter the screen
     4. Journey     the section pins; each scene slides up over the last
                    while its photograph drifts upwards, and the copy steps
                    in once the scene has docked
     5. Current     the menu marks the section on screen as current; its
                    yellow stroke follows hover and focus, then returns
     6. Get to know choosing a word in the crossword, or its card, lights
                    the word up and swaps the panel to its topic
     7. Skills      pieces go onto the board by click (via the sheet),
                    mouse drag, or press-and-hold drag on touch; the
                    sheet is a native <dialog>, a bottom sheet on phones
     8. Tools       the CV review, interview practice and strengths
                    profile (js/cv.min.js, interview.min.js,
                    profile.min.js and css/tools.min.css) are fetched the
                    first time one is wanted, not with the page

   The page loads the checked-in js/main.min.js static file directly.
   Deployment does not run a build step.

   Scroll choreography runs whenever the pinned layout is in force, on a
   screen at least 30em tall (the same query as grid.css section 12). It
   follows the reader's own scrolling, so it also runs with reduced
   motion; the looping decoration does not.

   Contents
     1. Setup and helpers
     2. Menu
     3. Scroll choreography
     4. Reveals
     5. Current section
     6. Get to know
     7. Skills
     8. Programme
     9. Get Job Ready, FAQ, returning, keeping your place, tools on demand
     10. Init
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. SETUP AND HELPERS
     ======================================================================== */

  var doc = document.documentElement;
  // Scroll-driven motion follows the reader's own scrolling, so it stays
  // on with reduced motion; only looping decoration is switched off (CSS).
  var pinQuery = window.matchMedia('(min-height: 30em)');
  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var wideQuery = window.matchMedia(
    '(min-width: 56em) and (min-aspect-ratio: 5/4) and (min-height: 34em)'
  );
  // Tablets held upright (and other screens between a phone and the wide
  // layout): room to show every Get Job Ready tool at once, so no tabs.
  // Must match the tablet query in grid.css section 25.
  var tabletQuery = window.matchMedia('(min-width: 40em) and (min-height: 28em)');

  /* Phones show and hide their address bar as you scroll. That fires
     'resize' and changes window.innerHeight, though nothing on the page
     changes size: every pinned section is measured in small-viewport
     units (--screen, grid.css). So the page works from that steady height,
     and a resize only counts when the width or that height really changes.
     Treating the address bar as a resize used to put the page back where
     it had been a moment before (straight after a hand-over, back to
     About), and re-measured the programme on every swipe. */
  var screenProbe = null;
  var screenCache = 0;
  var sizeSeen = { w: window.innerWidth, h: -1 };
  var realResize = true;

  function screenH() {
    if (!screenCache) {
      if (!screenProbe) {
        screenProbe = document.createElement('div');
        screenProbe.className = 'screen-probe';
        screenProbe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(screenProbe);
      }
      screenCache = screenProbe.offsetHeight || window.innerHeight;
    }
    return screenCache;
  }

  // Registered before every other resize handler, so each can ask.
  window.addEventListener('resize', function () {
    screenCache = 0;
    var w = window.innerWidth;
    var h = screenH();
    realResize = w !== sizeSeen.w || sizeSeen.h < 0 || Math.abs(h - sizeSeen.h) > 1;
    sizeSeen.w = w;
    sizeSeen.h = h;
  });

  /* Focus that follows a tap or click (back onto a card's button when a
     tool closes, or onto the current link when the menu opens) is not
     ringed; the ring comes back as soon as a key is pressed (style.css,
     section 15). */
  document.addEventListener('pointerdown', function () {
    doc.classList.add('is-pointing');
  }, true);
  document.addEventListener('keydown', function (event) {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      doc.classList.remove('is-pointing');
    }
  }, true);

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  /** Map v from [a, b] onto [0, 1], clamped. */
  function range(v, a, b) {
    return clamp((v - a) / (b - a), 0, 1);
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function listen(query, fn) {
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', fn);
    } else if (typeof query.addListener === 'function') {
      query.addListener(fn);
    }
  }


  /* ========================================================================
     2. MENU
     ======================================================================== */

  var toggle = document.querySelector('[data-menu-toggle]');
  var toggleLabel = document.querySelector('[data-menu-toggle-label]');
  var menu = document.querySelector('[data-menu]');
  var closeBtn = document.querySelector('[data-menu-close]');
  var main = document.getElementById('main');
  var skipLink = document.querySelector('.skip-link');
  var menuOpen = false;

  var FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** Grow the circle from wherever the toggle actually is. */
  function setMenuOrigin() {
    var box = toggle.getBoundingClientRect();
    menu.style.setProperty('--ox', (box.left + box.width / 2) + 'px');
    menu.style.setProperty('--oy', (box.top + box.height / 2) + 'px');
  }

  function setBackgroundInert(on) {
    [main, skipLink].forEach(function (el) {
      if (!el) {
        return;
      }
      if (on) {
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      }
    });
  }

  /* The closed menu is skipped by the browser (no layout, no fonts, no
     photograph) until it is wanted: pointing at, touching or tabbing to
     the toggle, or opening it, renders it out of sight first. */
  function warmMenu() {
    if (!menu || menu.classList.contains('is-warm')) {
      return;
    }
    menu.classList.add('is-warm');
    lightMenu(menuNav && menuNav.querySelector('.menu__link.is-lit'), true);
  }

  function openMenu() {
    warmMenu();
    if (menuOpen) {
      return;
    }
    menuOpen = true;
    setMenuOrigin();
    menu.scrollTop = 0;
    menu.classList.add('is-open');
    doc.classList.add('menu-open');
    // The highlight starts on the current page, without sliding there.
    lightMenu(null, true);
    toggle.setAttribute('aria-expanded', 'true');
    toggleLabel.textContent = 'Close menu';
    setBackgroundInert(true);

    // Focus the current page link, after the circle has started to open.
    window.setTimeout(function () {
      var current = menu.querySelector('[aria-current]') ||
        menu.querySelector('.menu__link');
      if (current && menuOpen) {
        current.focus({ preventScroll: true });
      }
    }, 120);
  }

  /**
   * @param {boolean} [returnFocus=true]  false when a link is taking the
   *   reader somewhere else, so focus should not jump back to the toggle.
   */
  function closeMenu(returnFocus) {
    if (!menuOpen) {
      return;
    }
    menuOpen = false;
    setMenuOrigin();
    menu.classList.remove('is-open');
    doc.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggleLabel.textContent = 'Open menu';
    setBackgroundInert(false);
    if (returnFocus !== false) {
      toggle.focus({ preventScroll: true });
    }
  }

  /** Keep Tab inside the dialog. The toggle hides while the menu is open,
   *  so the loop is the menu's own controls. */
  function trapFocus(event) {
    var items = Array.prototype.slice.call(menu.querySelectorAll(FOCUSABLE));
    var first = items[0];
    var last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onMenuLink(event) {
    var link = event.target.closest('a[href^="#"]');
    if (!link) {
      return;
    }
    var id = link.getAttribute('href').slice(1);
    var target = document.getElementById(id);

    event.preventDefault();

    if (!target) {
      // Sections still to come in the next build stage.
      closeMenu(true);
      return;
    }

    navigateToTarget(target, id, true);
  }

  function navigateToTarget(target, id, closeOpenMenu) {
    // Settle the layout before moving. When navigating from the menu, keep
    // its overlay open through the jump and close it over the destination.
    stopAutoplay();
    // Measure the destination from the page as it will be once you arrive,
    // not as it is now. Part-way through the opening, the intro track and
    // the Get Job Ready hand-over were still open above the destination
    // and folded away a moment after the jump, and sections not yet drawn
    // only had estimated heights; both moved the page on, so Get Job Ready
    // landed on the section after it. So: fold whatever lies above the
    // destination first, and draw every section for this one measurement.
    doc.classList.add('is-drawing-all');
    progNear = true;
    ensureProg();
    var after = function (el) {
      return !!el && (el === target || !!(el.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING));
    };
    if (active && id !== 'home' && intro && !intro.contains(target) && after(intro)) {
      setCollapsed(true);
    }
    if (active && readySection && progOutro && after(readySection)) {
      setOutroDone(true);
    }
    var y = target.getBoundingClientRect().top + window.scrollY;
    if (id === 'home') {
      y = 0;
    }
    if (collapsed && y <= 1) {
      setCollapsed(false);
    }
    window.scrollTo({ top: y, behavior: 'instant' });
    lastY = window.scrollY;
    outroLastY = window.scrollY;
    requestUpdate();
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        doc.classList.remove('is-drawing-all');
      });
    });
    if (closeOpenMenu) {
      closeMenu(false);
    }

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
    if (window.history && history.replaceState) {
      history.replaceState(null, '', '#' + id);
    }
  }

  function initJoinNavigation() {
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || !event.target.closest ||
        event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      var link = event.target.closest('a[href="#join"]');
      if (!link || link.hasAttribute('download') ||
        (link.target && link.target !== '_self')) {
        return;
      }
      var target = document.getElementById('join');
      if (!target) {
        return;
      }
      event.preventDefault();
      navigateToTarget(target, 'join', false);
    });
  }

  /* --- Moving highlight -------------------------------------------------
     One yellow stroke at a time: on the current page by default, on the
     row under the pointer or keyboard focus otherwise. */
  var menuNav = document.querySelector('[data-menu-nav]');

  function menuLinks() {
    return Array.prototype.slice.call(menuNav.querySelectorAll('.menu__link'));
  }

  /* One highlight for the whole list, which glides from row to row,
     instead of a stroke fading out on one row while another fades in
     (two half-visible strokes at once is what made hovering look
     glitchy). Positions come from offsetTop, which ignores the rows'
     entrance animation, so it always lands where the row will settle. */
  var glide = null;

  function offsetIn(el, root) {
    var x = 0;
    var y = 0;
    while (el && el !== root) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent;
    }
    return { x: x, y: y };
  }

  function placeGlide(link, instant) {
    // Until the menu is first wanted its contents are not rendered at all
    // (content-visibility in style.css), so there is nothing to measure;
    // warmMenu() places the stroke then.
    if (!glide || !menu.classList.contains('is-warm')) {
      return;
    }
    if (!link) {
      glide.classList.remove('is-on');
      return;
    }
    var num = link.querySelector('.menu__num');
    var u = num && num.offsetWidth ? num.offsetWidth / 22 : 1;
    var faq = link.classList.contains('menu__link--faq');
    var at = offsetIn(link, menuNav);
    var top = at.y + (faq ? 14 : 4) * u;
    var h = link.offsetHeight - (faq ? 16 : 6) * u;
    if (instant) {
      glide.classList.add('is-instant');
    }
    glide.style.transform = 'translate(' + at.x.toFixed(1) + 'px, ' + top.toFixed(1) + 'px)';
    glide.style.width = (link.offsetWidth + 6 * u).toFixed(1) + 'px';
    glide.style.height = Math.max(0, h).toFixed(1) + 'px';
    glide.classList.add('is-on');
    if (instant) {
      void glide.offsetWidth;
      glide.classList.remove('is-instant');
    }
  }

  function lightMenu(link, instant) {
    if (!menuNav) {
      return;
    }
    var target = link || menuNav.querySelector('.menu__link[aria-current]');
    menuLinks().forEach(function (l) {
      var on = l === target;
      l.classList.toggle('is-lit', on);
      var item = l.closest('.menu__item');
      if (item) {
        item.classList.toggle('is-lit', on);
      }
    });
    placeGlide(target, instant);
  }

  function initMenuHighlight() {
    if (!menuNav) {
      return;
    }
    glide = document.createElement('span');
    glide.className = 'menu__glide';
    glide.setAttribute('aria-hidden', 'true');
    menuNav.insertBefore(glide, menuNav.firstChild);
    window.addEventListener('resize', function () {
      if (menuOpen) {
        lightMenu(menuNav.querySelector('.menu__link.is-lit'), true);
      }
    });
    var hoverTimer = 0;
    menuNav.addEventListener('mouseover', function (event) {
      var link = event.target.closest('.menu__link');
      if (!link || link.classList.contains('is-lit')) {
        return;
      }
      // A short pause, so sweeping the pointer across the list does not
      // flicker the stroke through every row on the way.
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(function () {
        lightMenu(link);
      }, 40);
    });
    // Moving off the list without choosing always returns the stroke to
    // the page you are on.
    var resetTimer = 0;
    menuNav.addEventListener('mouseleave', function () {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        lightMenu(null);
      }, 220);
    });
    menuNav.addEventListener('mouseenter', function () {
      window.clearTimeout(resetTimer);
    });
    // Keyboard focus moves it too, but only for keyboard users: the focus
    // placed on the current link when the menu opens must not pin it.
    menuNav.addEventListener('focusin', function (event) {
      var link = event.target.closest('.menu__link');
      if (link && link.matches(':focus-visible')) {
        lightMenu(link);
      }
    });
    menuNav.addEventListener('focusout', function (event) {
      if (!menuNav.contains(event.relatedTarget)) {
        lightMenu(null);
      }
    });
    lightMenu(null);
  }

  function initMenu() {
    if (!toggle || !menu) {
      return;
    }
    initMenuHighlight();

    ['pointerenter', 'touchstart', 'focus'].forEach(function (type) {
      toggle.addEventListener(type, warmMenu, { passive: true });
    });

    toggle.addEventListener('click', function () {
      if (menuOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeMenu();
      });
    }

    menu.addEventListener('click', onMenuLink);

    // Hold the page still behind the menu without touching overflow, so
    // the scrollbar stays put. Scrolling inside the menu still works when
    // it has more content than fits.
    function menuCanScroll(dy) {
      var max = menu.scrollHeight - menu.clientHeight;
      if (max <= 0) {
        return false;
      }
      return dy > 0 ? menu.scrollTop < max - 1 : menu.scrollTop > 0;
    }
    window.addEventListener('wheel', function (event) {
      if (menuOpen && !(menu.contains(event.target) && menuCanScroll(event.deltaY))) {
        event.preventDefault();
      }
    }, { passive: false });
    var menuTouchY = 0;
    window.addEventListener('touchstart', function (event) {
      menuTouchY = event.touches[0] ? event.touches[0].clientY : 0;
    }, { passive: true });
    window.addEventListener('touchmove', function (event) {
      if (!menuOpen) {
        return;
      }
      var dy = menuTouchY - event.touches[0].clientY;
      if (!(menu.contains(event.target) && menuCanScroll(dy))) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('keydown', function (event) {
      if (!menuOpen) {
        return;
      }
      if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(event.key) &&
        !menuCanScroll(/Up|Home/.test(event.key) ? -1 : 1)) {
        event.preventDefault();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      } else if (event.key === 'Tab') {
        trapFocus(event);
      }
    });

    window.addEventListener('resize', function () {
      if (menuOpen) {
        setMenuOrigin();
      }
    });
  }


  /* ========================================================================
     3. SCROLL CHOREOGRAPHY
     ======================================================================== */

  var intro = document.querySelector('[data-intro]');
  var hero = document.querySelector('[data-hero]');
  var shade = document.querySelector('.hero__shade');
  var reveal = document.querySelector('[data-reveal]');
  var words = Array.prototype.slice.call(document.querySelectorAll('[data-reveal-words]'));
  var scenes = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));

  /* Where each drawing's words sit, in its own viewBox units: the point
     they shrink towards, and how far they lift at the end. */
  var WORD_GEOMETRY = [
    { cx: 646, cy: 389, lift: 520 },   // wide  1292 x 728
    { cx: 180, cy: 415, lift: 560 }    // tall  360 x 800
  ];

  /* The intro timeline, as fractions of the pinned scroll distance.
     The track is 4.2 screens tall, so it pins for 3.2 screens, and About
     (pulled up one screen) starts to cover the stage at 2.2 / 3.2. */
  var T = {
    heroOut: [0, 0.12],
    fieldIn: [0.1, 0.34],
    shrink: [0.1, 0.52],
    lift: [0.6875, 1]
  };

  var ticking = false;
  var active = false;

  function setWords(scale, lift) {
    words.forEach(function (group, i) {
      var g = WORD_GEOMETRY[i] || WORD_GEOMETRY[0];
      var ty = -g.lift * lift;
      group.setAttribute('transform',
        'translate(' + g.cx + ' ' + (g.cy + ty) + ') ' +
        'scale(' + scale.toFixed(4) + ') ' +
        'translate(' + (-g.cx) + ' ' + (-g.cy) + ')');
    });
  }

  // Read on the first frame rather than while the page is still loading,
  // so it does not force an early layout.
  var lastY = null;

  /* Once the reader has arrived at About, the long intro track is folded
     down to a single screen (the scroll position is shifted by the same
     amount, so nothing visibly moves). Scrolling back up is then an
     ordinary scroll: About slides away and the hero is simply there. The
     track unfolds again at the very top, ready to play forwards. */
  var collapsed = false;
  var settleTimer = 0;

  function setCollapsed(on) {
    if (on === collapsed || !intro) {
      return;
    }
    var before = intro.offsetHeight;
    var y = window.scrollY;
    collapsed = on;
    doc.classList.toggle('is-intro-done', on);
    // Folding happens with About at the top of the screen, so everything
    // above shrinks by the same amount and the scroll position follows.
    // Unfolding only ever happens at the very top, where nothing moves.
    var diff = before - intro.offsetHeight;
    if (on && diff) {
      window.scrollTo({ top: Math.max(0, y - diff), behavior: 'instant' });
    }
    lastY = window.scrollY;
  }

  function checkCollapse() {
    if (!active || !intro || auto) {
      return;
    }
    var y = window.scrollY;
    if (collapsed && y <= 1) {
      setCollapsed(false);
    } else if (!collapsed && y >= introEnd() - 1) {
      setCollapsed(true);
    }
  }

  function updateIntro(vh) {
    if (!intro) {
      return;
    }
    var y = window.scrollY;
    if (lastY === null) {
      lastY = y;
    }
    if (!auto && Math.abs(y - lastY) > 1) {
      // Scrolling up through a full track (e.g. after dragging the
      // scrollbar) skips the mask too.
      doc.classList.toggle('is-rewinding', y < lastY);
    }
    lastY = y;

    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(checkCollapse, 160);

    if (collapsed) {
      // Folded: the hero is just the hero.
      hero.style.opacity = '';
      hero.style.transform = '';
      hero.style.visibility = '';
      if (shade) {
        shade.style.opacity = '';
      }
      reveal.style.opacity = '0';
      reveal.style.visibility = 'hidden';
      return;
    }

    var rect = intro.getBoundingClientRect();
    var distance = rect.height - vh;
    if (distance <= 0) {
      return;
    }
    var p = clamp(-rect.top / distance, 0, 1);

    // a. Hero copy lifts and fades.
    var h = easeOut(range(p, T.heroOut[0], T.heroOut[1]));
    hero.style.opacity = (1 - h).toFixed(3);
    hero.style.transform = 'translate3d(0,' + (-h * 6).toFixed(2) + 'vh,0)';
    hero.style.visibility = h >= 1 ? 'hidden' : '';

    // The green wash leaves with the copy, so the letters show the
    // untinted photograph, as in the transition frame.
    if (shade) {
      shade.style.opacity = (1 - h).toFixed(3);
    }

    // b. Field fades in while the words shrink into place.
    var f = range(p, T.fieldIn[0], T.fieldIn[1]);
    var s = easeInOut(range(p, T.shrink[0], T.shrink[1]));
    var scale = 3.4 - 2.4 * s;

    // c. Words lift away as About arrives.
    var l = easeInOut(range(p, T.lift[0], T.lift[1]));

    reveal.style.opacity = f.toFixed(3);
    reveal.style.visibility = f <= 0 ? 'hidden' : '';
    setWords(scale, l);

  }

  var journey = document.querySelector('.journey');

  /* The journey track pins for (track height - one screen). That distance
     is split into three hand-overs, one per new scene, each with a short
     hold either side so every scene can be read before the next arrives. */
  var pinFallback = false;

  var HOLD = 0.14;      // screens of stillness before each hand-over
  var MOVE = 0.8;       // screens the slide-up itself takes
  // The track (grid.css) is 3 x (HOLD + MOVE) + HOLD screens of pin, plus
  // one screen: kept short so the scenes follow the scroll without long
  // stretches where nothing moves.
  var journeyBar = document.querySelector('[data-journey-bar]');
  var journeyPinned = null;

  function setVar(el, name, value) {
    // Only when it changes: each write restyles the whole scene.
    var key = '_' + name;
    if (el[key] !== value) {
      el[key] = value;
      el.style.setProperty(name, value);
    }
  }

  function updateScenes(vh) {
    if (!journey || !scenes.length) {
      return;
    }
    var rect = journey.getBoundingClientRect();
    var d = -rect.top / vh;            // screens scrolled into the track

    // Safety net: if this browser fails to pin the stage with position:
    // sticky, hold it in place from here instead.
    var list = scenes[0].parentNode;
    var lr = list.getBoundingClientRect();
    if (!pinFallback && rect.top < -4 && rect.bottom > vh + 4 && Math.abs(lr.top) > 4) {
      pinFallback = true;
    }
    if (pinFallback) {
      list.style.transform = 'translate3d(0,' + clamp(-rect.top, 0, rect.height - vh).toFixed(1) + 'px,0)';
    }

    // e[i]: how far scene i has slid in (scene 0 is always in place).
    var e = scenes.map(function (scene, i) {
      if (i === 0) {
        return 1 - clamp(rect.top / vh, 0, 1);
      }
      var start = (i - 1) * (HOLD + MOVE) + HOLD;
      return easeInOut(range(d, start, start + MOVE));
    });

    scenes.forEach(function (scene, i) {
      var inn = e[i];
      var out = e[i + 1] || 0;
      setVar(scene, '--enter', (i === 0 ? 0 : 1 - inn).toFixed(4));
      setVar(scene, '--in', inn.toFixed(4));
      setVar(scene, '--out', out.toFixed(4));

      // The photograph keeps drifting upwards for as long as the scene
      // is on screen: from arriving, through its hold, until covered.
      var life = clamp((inn + out) / 2, 0, 1);
      setVar(scene, '--drift', ((0.5 - life) * 14).toFixed(3));

      scene.classList.toggle('is-active', inn > 0.55 && out < 0.9);
    });

    // The bar along the top: how far through the four stages you are.
    if (journeyBar) {
      var pinned = rect.top <= 0.5 && rect.bottom >= vh - 0.5;
      if (pinned !== journeyPinned) {
        journeyPinned = pinned;
        journey.classList.toggle('is-pinned', pinned);
      }
      var through = clamp(-rect.top / Math.max(1, rect.height - vh), 0, 1);
      setVar(journeyBar, '--p', through.toFixed(4));
    }

  }

  var scrolled = null;

  /** The fixed corners tuck in once the hero is behind you. */
  function updateScrolled() {
    var on = window.scrollY > window.innerHeight * 0.4;
    if (on !== scrolled) {
      scrolled = on;
      doc.classList.toggle('is-scrolled', on);
    }
  }

  var forceUpdate = true;
  var lastRunY = -1;

  function update() {
    ticking = false;
    var y = window.scrollY;
    // Already drawn for this position this frame (a hand-over draws in
    // step with its own scrolling, then the scroll event asks again).
    if (!forceUpdate && y === lastRunY) {
      return;
    }
    forceUpdate = false;
    lastRunY = y;
    updateScrolled();
    if (!active) {
      return;
    }
    var vh = screenH();
    updateIntro(vh);
    updateScenes(vh);
    updateProg(vh);
  }

  function queueUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  /** Redraw on the next frame, even if the page has not moved. */
  function requestUpdate() {
    forceUpdate = true;
    queueUpdate();
  }

  /** Scroll, then draw in the same frame. A hand-over moves the page from
   *  inside an animation frame; waiting for the scroll event drew every
   *  frame one frame late, which is what made hand-overs judder. */
  function scrollNow(top) {
    window.scrollTo({ top: top, behavior: 'instant' });
    update();
  }

  /** Clear every inline style the timeline wrote, for the static layout. */
  function resetChoreography() {
    [hero, shade, reveal].forEach(function (el) {
      if (el) {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.visibility = '';
      }
    });
    words.forEach(function (g) {
      g.removeAttribute('transform');
    });
    resetProg();
    scenes.forEach(function (scene) {
      scene.style.removeProperty('--in');
      scene.style.removeProperty('--out');
      scene.style.removeProperty('--drift');
      scene.style.removeProperty('--enter');
      ['--in', '--out', '--drift', '--enter'].forEach(function (name) {
        scene['_' + name] = undefined;
      });
      scene.classList.add('is-active');
    });
  }

  function setMotion() {
    active = pinQuery.matches && !!intro && !!hero && !!reveal;
    if (active) {
      requestUpdate();
    } else {
      resetChoreography();
      updateScrolled();
    }
  }

  /* --- Autoplay through the intro -------------------------------------
     The hero -> MOVEMENT TO WORK -> About hand-over is still driven by the
     scroll position, but the reader no longer has to scrub through it.
     The first nudge downwards from the hero (wheel, swipe, arrow keys,
     Page Down or Space) glides the page through the whole pinned track on
     its own, and the first nudge upwards from the top of About glides it
     back. Input is held while it plays, so it cannot stutter. */
  var auto = null;
  var nextAuto = null;     // the "next step" hand-over into Join now
  var AUTO_MS = 2900;      // the full hand-over, downwards

  /* While a hand-over plays, the reader's own scrolling is held, so a
     trackpad's momentum or a keen scroll wheel cannot fight the animation.
     After it lands, only the tail of that same fling is swallowed: a
     trackpad keeps sending ever-smaller scroll events for a second or two
     after the fingers lift. The moment the reader scrolls again on purpose
     (after a pause, a bigger push than the last event, a key or a touch),
     scrolling is theirs again. Before, the page stayed locked for as long
     as any scrolling kept arriving, which could be several seconds. */
  var lockUntil = 0;
  var LOCK_AFTER_MS = 160;     // held at least this long after landing
  var MOMENTUM_MS = 1100;      // a fling's tail is never swallowed for longer
  var QUIET_MS = 110;          // a gap this long ends a fling
  var lastInputAt = 0;
  var lastDelta = 0;
  var landedAt = -1e9;
  var inTail = false;          // still receiving the fling that was playing
  var pending = null;          // a hand-over waiting for the scrolling to settle

  // Every wheel turn, swipe or scroll key is noted (before anything else
  // handles it), so the lock can tell a fling's tail from a fresh scroll.
  window.addEventListener('wheel', function (event) {
    var now = performance.now();
    var d = Math.abs(event.deltaY);
    if (inTail && (now - lastInputAt > QUIET_MS || d > lastDelta * 1.25 + 4)) {
      inTail = false;
    }
    lastDelta = d;
    lastInputAt = now;
  }, { passive: true, capture: true });
  window.addEventListener('touchmove', function () {
    lastInputAt = performance.now();
    inTail = false;
  }, { passive: true, capture: true });
  window.addEventListener('keydown', function (event) {
    if (/^(ArrowDown|ArrowUp|PageDown|PageUp|Home|End| )$/.test(event.key)) {
      lastInputAt = performance.now();
      inTail = false;
    }
  }, true);

  function scrollLocked() {
    var now = performance.now();
    return !!auto || !!outroAuto || !!nextAuto || !!pending || now < lockUntil ||
      (inTail && now - landedAt < MOMENTUM_MS);
  }

  /** Called when a hand-over finishes: hold input for a beat, then only
   *  while the fling that was under way is still dying away. */
  function landed() {
    landedAt = performance.now();
    lockUntil = landedAt + LOCK_AFTER_MS;
    inTail = landedAt - lastInputAt < QUIET_MS;
  }

  /** Start a hand-over once the reader's scrolling has settled (input is
   *  held from this moment, so nothing moves in the meantime). Waits at
   *  most half a second, so a long trackpad fling cannot stall it. */
  function whenSettled(play) {
    if (pending) {
      return;
    }
    var since = performance.now();
    pending = play;
    function check(now) {
      if (!pending) {
        return;    // cancelled (a menu link was chosen meanwhile)
      }
      if (now - lastInputAt >= QUIET_MS || now - since > 360) {
        var fn = pending;
        pending = null;
        fn();
      } else {
        window.requestAnimationFrame(check);
      }
    }
    window.requestAnimationFrame(check);
  }
  var REWIND_MS = 1700;    // back up to the hero (no mask)

  /** Stop any hand-over or glide that is playing or waiting to play, and
   *  hand scrolling straight back to the reader. Used when a menu link is
   *  chosen part-way through one, so the page goes where they asked rather
   *  than carrying on to where the animation was heading. */
  function stopAutoplay() {
    auto = null;
    outroAuto = null;
    nextAuto = null;
    pending = null;
    tween = null;
    lockUntil = 0;
    inTail = false;
    doc.classList.remove('is-autoplaying', 'is-rewinding');
  }

  function introEnd() {
    return intro.offsetTop + intro.offsetHeight - screenH();
  }

  function easeAuto(t) {
    // Sine in-out: no sudden acceleration, a long soft landing.
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function playIntro(dir) {
    if (auto) {
      return true;
    }
    var from = window.scrollY;
    var end = introEnd();
    var to = dir > 0 ? end : intro.offsetTop;
    var dist = Math.abs(to - from);
    if (dist < 4) {
      return false;
    }
    var span = Math.max(end - intro.offsetTop, 1);
    var duration = Math.max(900, (dir > 0 ? AUTO_MS : REWIND_MS) * dist / span);
    var start = null;
    var mine = null;
    whenSettled(function () {
      from = window.scrollY;
      mine = auto = { to: to };
      window.requestAnimationFrame(step);
    });
    doc.classList.add('is-autoplaying');
    // Going back up, the mask is skipped: About slides away to the hero.
    doc.classList.toggle('is-rewinding', dir < 0);

    function step(now) {
      if (auto !== mine) {
        return;    // stopped: the reader chose somewhere else to go
      }
      if (start === null) {
        start = now;
      }
      var t = clamp((now - start) / duration, 0, 1);
      scrollNow(from + (to - from) * easeAuto(t));
      if (t < 1) {
        window.requestAnimationFrame(step);
      } else {
        auto = null;
        landed();
        doc.classList.remove('is-autoplaying');
        if (dir > 0) {
          setCollapsed(true);
        }
      }
    }
    return true;
  }

  /** Should a nudge in this direction start the autoplay? */
  function wantsAutoplay(dir) {
    if (!active || !intro || menuOpen || document.querySelector('dialog[open]')) {
      return false;
    }
    var y = window.scrollY;
    var top = intro.offsetTop;
    var end = introEnd();
    // Downwards only, and only through the full track. Going back up is
    // an ordinary scroll.
    return dir > 0 && !collapsed && y >= top - 2 && y < end - 4;
  }

  function initAutoplay() {
    if (!intro) {
      return;
    }

    window.addEventListener('wheel', function (event) {
      if (scrollLocked()) {
        event.preventDefault();
        return;
      }
      if (event.ctrlKey || Math.abs(event.deltaY) < 2) {
        return;
      }
      var dir = event.deltaY > 0 ? 1 : -1;
      if (wantsAutoplay(dir) && playIntro(dir)) {
        event.preventDefault();
      }
    }, { passive: false });

    var touchY = null;
    window.addEventListener('touchstart', function (event) {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    }, { passive: true });

    window.addEventListener('touchmove', function (event) {
      if (scrollLocked()) {
        event.preventDefault();
        return;
      }
      if (touchY === null) {
        return;
      }
      var dy = touchY - event.touches[0].clientY;
      if (Math.abs(dy) < 10) {
        return;
      }
      var dir = dy > 0 ? 1 : -1;
      touchY = null;
      if (wantsAutoplay(dir) && playIntro(dir)) {
        event.preventDefault();
      }
    }, { passive: false });

    var DOWN = { ArrowDown: 1, PageDown: 1, ' ': 1, Spacebar: 1 };
    var UP = { ArrowUp: 1, PageUp: 1 };
    window.addEventListener('keydown', function (event) {
      var t = event.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) {
        return;
      }
      var dir = DOWN[event.key] && !event.shiftKey ? 1 : (UP[event.key] || (event.key === ' ' && event.shiftKey)) ? -1 : 0;
      if (!dir) {
        return;
      }
      if (scrollLocked()) {
        event.preventDefault();
        return;
      }
      if (wantsAutoplay(dir) && playIntro(dir)) {
        event.preventDefault();
      }
    });

    // Scrolling that sends no usable wheel, swipe or key event still
    // starts it: a slow trackpad scroll (steps under 2px, ignored above),
    // a flick's momentum, or a drag of the scrollbar. Before, these moved
    // the page part-way into the hand-over and left it stuck there, half
    // played. Held for a moment after load, so restoring your place does
    // not set it off.
    var lastY = window.scrollY;
    var armedAt = performance.now() + 800;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var down = y > lastY + 1;
      lastY = y;
      if (down && performance.now() > armedAt && !scrollLocked() && wantsAutoplay(1)) {
        playIntro(1);
      }
    }, { passive: true });
  }

  /** Wrap each word of a scene title so it can rise in on its own. */
  function splitTitles() {
    scenes.forEach(function (scene) {
      var title = scene.querySelector('.scene__title');
      if (!title || title.querySelector('.w')) {
        return;
      }
      // A <p> cannot take aria-label, so screen readers get the whole title
      // from a visually hidden copy and skip the animated word spans.
      var words = title.textContent.trim().split(/\s+/);
      var spoken = document.createElement('span');
      spoken.className = 'visually-hidden';
      spoken.textContent = words.join(' ');
      title.textContent = '';
      title.appendChild(spoken);
      words.forEach(function (w, i) {
        var span = document.createElement('span');
        span.className = 'w';
        span.setAttribute('aria-hidden', 'true');
        span.style.setProperty('--wi', i);
        span.textContent = w;
        title.appendChild(document.createTextNode(' '));
        title.appendChild(span);
      });
    });
  }

  function initChoreography() {
    splitTitles();
    initAutoplay();
    setMotion();
    listen(pinQuery, setMotion);
    listen(wideQuery, requestUpdate);
    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    // Fonts change the mask's letter shapes; redraw once they arrive.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(requestUpdate);
    }
  }


  /* ========================================================================
     4. REVEALS  (About)
     ======================================================================== */

  function initReveals() {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll('[data-rise], .steps, .cw, .pieces')
    );

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-in', 'is-settled');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.classList.add('is-in');
          observer.unobserve(el);
          // The crossword's letters are pencilled in over about 1.5s; after
          // that its colour changes are instant (see style.css).
          if (el.classList.contains('cw')) {
            window.setTimeout(function () {
              el.classList.add('is-settled');
            }, 1900);
          }
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }


  /* ========================================================================
     5. CURRENT SECTION
     Marks the menu link for whichever section holds the middle of the
     screen. Only Home and About exist so far.
     ======================================================================== */

  function initCurrent() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-menu-link]'));
    var sections = links
      .map(function (link) {
        return document.getElementById(link.getAttribute('data-menu-link'));
      })
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) {
      return;
    }

    function mark(id) {
      links.forEach(function (link) {
        if (link.getAttribute('data-menu-link') === id) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
      if (!menuOpen) {
        lightMenu(null);
      }
    }

    mark('home');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          mark(entry.target.id);
        }
      });
    }, { rootMargin: '-50% 0px -50% 0px' });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }


  /* ========================================================================
     6. GET TO KNOW  (crossword and panel)
     Choosing a word, from the grid or from its card, lights that word up
     letter by letter and swaps the panel to its topic. The panel's height
     is animated between the two states so nothing jumps.
     ======================================================================== */

  function initExplore() {
    var panel = document.querySelector('[data-panel]');
    var cw = document.querySelector('[data-cw]');
    if (!panel || !cw) {
      return;
    }

    var cells = Array.prototype.slice.call(cw.querySelectorAll('[data-word]'));
    var cards = Array.prototype.slice.call(panel.querySelectorAll('.word-card[data-word-open]'));
    var topics = Array.prototype.slice.call(panel.querySelectorAll('[data-topic]'));
    var current = null;
    var lastCard = null;

    function wordsOf(cell) {
      return cell.getAttribute('data-word').split(' ');
    }

    /** Cells of one word, in reading order, so the colour can run along it. */
    function cellsFor(key) {
      return cells.filter(function (cell) {
        return wordsOf(cell).indexOf(key) !== -1;
      });
    }

    var clues = Array.prototype.slice.call(cw.querySelectorAll('[data-clue]'));
    var chosen = null;

    /** The word in use (hovered, else chosen) claims the shared R. */
    function setActive(key) {
      if (key) {
        cw.setAttribute('data-active', key);
      } else {
        cw.removeAttribute('data-active');
      }
    }

    function light(key) {
      chosen = key;
      cells.forEach(function (cell) {
        cell.classList.remove('is-lit');
      });
      cw.classList.toggle('has-choice', !!key);
      setActive(key);
      if (!key) {
        return;
      }
      cellsFor(key).forEach(function (cell) {
        cell.classList.add('is-lit');
      });
    }

    function hover(key) {
      cells.forEach(function (cell) {
        cell.classList.toggle('is-hover', !!key && wordsOf(cell).indexOf(key) !== -1);
      });
      clues.forEach(function (clue) {
        clue.classList.toggle('is-hover', clue.getAttribute('data-clue') === key);
      });
      setActive(key || chosen);
    }

    /** Animate the panel between its old and new heights. */
    function morph(change) {
      var before = panel.offsetHeight;
      change();
      var after = panel.offsetHeight;
      if (before !== after && pinQuery.matches && typeof panel.animate === 'function') {
        panel.animate(
          [{ height: before + 'px' }, { height: after + 'px' }],
          { duration: 460, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
        );
      }
    }

    function open(key, moveFocus) {
      var topic = panel.querySelector('[data-topic="' + key + '"]');
      if (!topic) {
        return;
      }
      current = key;
      morph(function () {
        panel.classList.add('has-topic');
        topics.forEach(function (t) {
          t.classList.toggle('is-open', t === topic);
        });
      });
      cards.forEach(function (card) {
        card.setAttribute('aria-expanded', String(card.getAttribute('data-word-open') === key));
      });
      light(key);

      if (moveFocus !== false) {
        topic.focus({ preventScroll: true });
      }
      // Keep the topic in view: on phones the panel sits under the grid.
      var box = panel.getBoundingClientRect();
      if (box.top < 0 || box.top > window.innerHeight * 0.6) {
        panel.scrollIntoView({ behavior: pinQuery.matches ? 'smooth' : 'auto', block: 'start' });
      }
      panel.scrollTop = 0;
    }

    function close() {
      var key = current;
      current = null;
      morph(function () {
        panel.classList.remove('has-topic');
        topics.forEach(function (t) {
          t.classList.remove('is-open');
        });
      });
      cards.forEach(function (card) {
        card.setAttribute('aria-expanded', 'false');
      });
      light(null);
      var back = lastCard || panel.querySelector('.word-card[data-word-open="' + key + '"]');
      if (back) {
        back.focus({ preventScroll: true });
      }
    }

    panel.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-word-open]');
      if (opener) {
        if (opener.classList.contains('word-card')) {
          lastCard = opener;
        }
        open(opener.getAttribute('data-word-open'));
        return;
      }
      if (event.target.closest('[data-word-close]')) {
        close();
      }
    });

    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && current) {
        event.preventDefault();
        close();
      }
    });

    // Grid: pointer users can click any letter of a word, or a clue.
    cw.addEventListener('click', function (event) {
      var clue = event.target.closest('[data-clue]');
      if (clue) {
        var ck = clue.getAttribute('data-clue');
        lastCard = panel.querySelector('.word-card[data-word-open="' + ck + '"]');
        open(ck, false);
        return;
      }
      var cell = event.target.closest('[data-word]');
      if (!cell) {
        return;
      }
      var words = wordsOf(cell);
      // The shared R belongs to both words; pick the one not already open.
      var key = words.length > 1 && words.indexOf(current) !== -1
        ? words[(words.indexOf(current) + 1) % words.length]
        : words[words.length - 1];
      lastCard = panel.querySelector('.word-card[data-word-open="' + key + '"]');
      open(key, false);
    });

    var tip = cw.querySelector('[data-cw-tip]');
    var TIPS = {
      purpose: ['Purpose', '#1E96E8', '#fff'],
      mtw: ['Movement to Work', '#FDD114', '#3A2E00'],
      eligibility: ['Eligibility', '#0E9F5F', '#fff']
    };
    var hovered = null;

    function showTip(key) {
      if (!tip) {
        return;
      }
      if (!key) {
        tip.classList.remove('is-shown');
        return;
      }
      var list = cellsFor(key);
      var cwBox = cw.getBoundingClientRect();
      var a = list[0].getBoundingClientRect();
      var b = list[list.length - 1].getBoundingClientRect();
      var vertical = Math.abs(b.top - a.top) > Math.abs(b.left - a.left);
      var x = vertical ? a.left + a.width / 2 : (a.left + b.right) / 2;
      tip.textContent = TIPS[key][0] + '  \u2192';
      tip.style.setProperty('--tip', TIPS[key][1]);
      tip.style.setProperty('--tip-ink', TIPS[key][2]);
      tip.classList.toggle('is-side', vertical);
      if (vertical) {
        tip.style.left = (a.left - cwBox.left) + 'px';
        tip.style.top = (a.top + a.height * 1.5 - cwBox.top) + 'px';
      } else {
        tip.style.left = (x - cwBox.left) + 'px';
        tip.style.top = (a.top - cwBox.top) + 'px';
      }
      tip.classList.add('is-shown');
    }

    cw.addEventListener('mouseover', function (event) {
      var cell = event.target.closest('[data-word]');
      var clueEl = event.target.closest('[data-clue]');
      var key = clueEl ? clueEl.getAttribute('data-clue')
        : cell ? (wordsOf(cell).indexOf(hovered) !== -1 ? hovered : wordsOf(cell)[wordsOf(cell).length - 1])
        : null;
      if (key !== hovered) {
        hovered = key;
        hover(key);
        showTip(key);
      }
    });
    cw.addEventListener('mouseleave', function () {
      hovered = null;
      hover(null);
      showTip(null);
    });

    // Cards point back at their word in the grid.
    cards.forEach(function (card) {
      var key = card.getAttribute('data-word-open');
      ['mouseenter', 'focus'].forEach(function (type) {
        card.addEventListener(type, function () {
          hover(key);
        });
      });
      ['mouseleave', 'blur'].forEach(function (type) {
        card.addEventListener(type, function () {
          hover(null);
        });
      });
    });
  }


  /* ========================================================================
     7. SKILLS  (pieces, board and sheet)
     A piece reaches the board three ways, all ending in the same place:
       - click or Enter: the sheet opens; "Add" flies the piece over
       - mouse or pen: drag it onto the circle and let go
       - touch: press and hold for a moment, then drag
     Pieces land in the nearest free slot when dragged, or fill the board
     from the centre outwards when added from the sheet.
     ======================================================================== */

  var SKILLS = {
    'confidence': {
      icon: 'confidence',
      why: 'Movement to Work can help you build confidence in your abilities, recognise your strengths and feel more prepared for the workplace. You can develop confidence by trying new tasks, gaining experience and working in a supportive environment.',
      build: ['Confidence in your abilities', 'Self-belief', 'Communicating with others', 'Workplace confidence']
    },
    'problem-solving': {
      icon: 'gear',
      why: 'Every workplace has problems to solve, from a tricky customer to a task that does not go to plan. You will practise breaking problems down, weighing up options and finding a way forward, with support when you need it.',
      build: ['Thinking things through', 'Spotting solutions', 'Making decisions', 'Staying calm under pressure']
    },
    'goal-setting': {
      icon: 'target',
      why: 'Clear goals make a big step feel manageable. You will set realistic goals for your job search and your future, plan the steps to reach them and see how far you have come.',
      build: ['Setting realistic goals', 'Planning your next steps', 'Tracking your progress', 'Staying motivated']
    },
    'teamwork': {
      icon: 'team',
      why: 'Most jobs mean working with other people. Group tasks and time in a real workplace help you share ideas, listen to others and play your part in a team.',
      build: ['Working with others', 'Sharing ideas', 'Listening and respect', 'Supporting your team']
    },
    'adaptability': {
      icon: 'adapt',
      why: 'Workplaces change, and employers value people who can change with them. Trying new tasks and settings helps you adjust, learn quickly and handle the unexpected.',
      build: ['Coping with change', 'Learning new things quickly', 'Being open to feedback', 'Handling the unexpected']
    },
    'interview-skills': {
      icon: 'interview',
      why: 'Interviews feel easier with practice. You will prepare answers, take part in practice interviews and get friendly feedback, so you can walk in ready to show your best self.',
      build: ['Answering questions clearly', 'Making a good first impression', 'Talking about your strengths', 'Interview confidence']
    },
    'personal-development': {
      icon: 'personal',
      why: 'Movement to Work is about you as well as work. You will reflect on your strengths, what you enjoy and where you want to go, and leave with a clearer picture of your next step.',
      build: ['Knowing your strengths', 'Reflecting on progress', 'Building resilience', 'A plan for your future']
    },
    'employability': {
      icon: 'employ',
      why: 'Employability brings everything together: the attitude, habits and skills employers look for. Time in a real workplace shows you what is expected and how to meet it.',
      build: ['Workplace habits', 'Reliability and timekeeping', 'A professional attitude', 'Understanding employers']
    },
    'digital-skills': {
      icon: 'digital',
      why: 'Nearly every job uses technology, from email to online applications. You will build everyday digital skills, use job sites with confidence and stay safe online.',
      build: ['Email and online tools', 'Searching for jobs online', 'Online applications', 'Staying safe online']
    },
    'cv-applications': {
      icon: 'cv',
      why: 'A strong CV and application open doors. With your adviser you will create or update your CV, tailor it to the jobs you want and write applications that stand out.',
      build: ['A clear, up-to-date CV', 'Tailored applications', 'Cover letters', 'Showing your experience']
    },
    'communication': {
      icon: 'comm',
      why: 'Good communication helps in interviews, with colleagues and with customers. You will practise speaking clearly, listening well and getting your point across in person, on the phone and in writing.',
      build: ['Speaking with confidence', 'Active listening', 'Workplace etiquette', 'Written communication']
    },
    'time-management': {
      icon: 'time',
      why: 'Being on time and organising your day are among the first things employers notice. The programme’s routine helps you plan your time, prioritise tasks and meet deadlines.',
      build: ['Punctuality', 'Prioritising tasks', 'Planning your day', 'Meeting deadlines']
    }
  };

  /** Slots fill from the middle of the circle outwards when added by
   *  click, so the board always looks composed. */
  var FILL_ORDER = [3, 4, 7, 8, 0, 1, 10, 11, 2, 5, 6, 9];

  function initSkills() {
    var board = document.querySelector('[data-board]');
    var disc = document.querySelector('[data-board-disc]');
    var list = document.querySelector('[data-pieces]');
    var sheet = document.querySelector('[data-sheet]');
    if (!board || !disc || !list || !sheet) {
      return;
    }

    var slots = Array.prototype.slice.call(board.querySelectorAll('[data-slot]'));
    var pieces = Array.prototype.slice.call(list.querySelectorAll('[data-skill]'));
    var countEl = board.querySelector('[data-count]');
    var countWrap = board.querySelector('.board__count');
    var toast = board.querySelector('[data-toast]');
    var placed = {};            // skill key -> slot index
    var toastTimer = 0;

    // Movement the reader starts (a click or a drop) always animates.
    var reduce = { matches: false };

    function pieceFor(key) {
      return list.querySelector('[data-skill="' + key + '"]');
    }

    function nameOf(key) {
      return pieceFor(key).querySelector('.piece__label').textContent;
    }

    function colours(key) {
      // The colours live in the stylesheet (one rule per skill), so read
      // the computed values rather than the element's own style.
      var cs = window.getComputedStyle(pieceFor(key));
      return {
        piece: cs.getPropertyValue('--piece').trim(),
        ink: cs.getPropertyValue('--ink').trim()
      };
    }

    function iconMarkup(key) {
      return '<svg aria-hidden="true" focusable="false"><use href="#i-sk-' + SKILLS[key].icon + '" /></svg>';
    }

    function freeSlots() {
      var used = Object.keys(placed).map(function (k) { return placed[k]; });
      return slots.map(function (s, i) { return i; }).filter(function (i) {
        return used.indexOf(i) === -1;
      });
    }

    function nextSlot() {
      var free = freeSlots();
      for (var i = 0; i < FILL_ORDER.length; i++) {
        if (free.indexOf(FILL_ORDER[i]) !== -1) {
          return FILL_ORDER[i];
        }
      }
      return -1;
    }

    /** Where a piece lands in a slot: the slot itself, or for the wide
     *  slots at the top and bottom (which reach into the corners) a square
     *  over the part of the circle that shows, so the piece never
     *  stretches on the way in. */
    function landRect(i) {
      var r = slots[i].getBoundingClientRect();
      if (r.width < r.height * 1.3) {
        return r;
      }
      var cx = r.left + r.width / 2 + (i === 0 || i === 10 ? 1 : -1) * r.width * 0.12;
      return { left: cx - r.height / 2, top: r.top, width: r.height, height: r.height };
    }

    function nearestSlot(x, y) {
      var best = -1;
      var bestD = Infinity;
      freeSlots().forEach(function (i) {
        var r = slots[i].getBoundingClientRect();
        var d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best;
    }

    function updateCount(animate) {
      var n = Object.keys(placed).length;
      countEl.textContent = n < 10 && n > 0 ? '0' + n : String(n);
      board.classList.toggle('is-complete', n === slots.length);
      if (animate) {
        countWrap.classList.remove('is-bump');
        void countWrap.offsetWidth;
        countWrap.classList.add('is-bump');
      }
    }

    function showToast(key) {
      var c = colours(key);
      var n = Object.keys(placed).length;
      toast.style.setProperty('--piece', c.piece);
      toast.innerHTML = '';
      var dot = document.createElement('span');
      dot.className = 'board__toast-dot';
      var text = document.createElement('span');
      text.textContent = n === slots.length
        ? 'All 12 skills added. Small steps, big opportunities!'
        : nameOf(key) + ' added to your skills';
      toast.appendChild(dot);
      toast.appendChild(text);
      if (n < slots.length) {
        var more = document.createElement('button');
        more.type = 'button';
        more.textContent = 'Why it matters';
        more.addEventListener('click', function () {
          openSheet(key, more);
        });
        toast.appendChild(more);
      }
      toast.classList.add('is-shown');
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(function () {
        toast.classList.remove('is-shown');
      }, 4200);
    }

    /** Put a skill on the board for good. */
    function place(key, slotIndex) {
      if (placed[key] !== undefined || slotIndex < 0) {
        return;
      }
      placed[key] = slotIndex;
      var c = colours(key);
      var tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'board__tile';
      tile.setAttribute('data-tile', key);
      tile.style.setProperty('--piece', c.piece);
      tile.style.setProperty('--ink', c.ink);
      tile.setAttribute('aria-label', nameOf(key) + ', on your board. Show details');
      tile.innerHTML = iconMarkup(key) + '<span>' + pieceFor(key).querySelector('.piece__label').innerHTML + '</span>';
      slots[slotIndex].appendChild(tile);
      pieceFor(key).parentNode.classList.add('is-placed');
      updateCount(true);
      showToast(key);
    }

    /** A copy of the piece that can travel across the screen. */
    function makeGhost(key, rect) {
      var c = colours(key);
      var ghost = document.createElement('div');
      ghost.className = 'piece-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.setProperty('--piece', c.piece);
      ghost.style.setProperty('--ink', c.ink);
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
      ghost.style.fontSize = Math.max(11, rect.width * 0.11) + 'px';
      ghost.innerHTML = iconMarkup(key) + '<span>' + pieceFor(key).querySelector('.piece__label').innerHTML + '</span>';
      document.body.appendChild(ghost);
      return ghost;
    }

    function setGhost(ghost, x, y, extra) {
      ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)' + (extra || '');
    }

    /** Fly a ghost from one rectangle to a slot, then place it. */
    function fly(key, fromRect, slotIndex) {
      if (reduce.matches || typeof document.body.animate !== 'function') {
        place(key, slotIndex);
        return;
      }
      var to = landRect(slotIndex);
      var ghost = makeGhost(key, fromRect);
      var sx = to.width / fromRect.width;
      var sy = to.height / fromRect.height;
      var anim = ghost.animate([
        { transform: 'translate3d(' + fromRect.left + 'px,' + fromRect.top + 'px,0) rotate(0deg) scale(1)' },
        { transform: 'translate3d(' + (fromRect.left + (to.left - fromRect.left) * 0.5) + 'px,' + (Math.min(fromRect.top, to.top) - 60) + 'px,0) rotate(-14deg) scale(' + ((1 + sx) / 2) + ',' + ((1 + sy) / 2) + ')', offset: 0.55 },
        { transform: 'translate3d(' + to.left + 'px,' + to.top + 'px,0) rotate(0deg) scale(' + sx + ',' + sy + ')' }
      ], { duration: 760, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' });
      anim.onfinish = function () {
        ghost.remove();
        place(key, slotIndex);
      };
    }

    /* --- Sheet ------------------------------------------------------------ */
    var card = sheet.querySelector('[data-sheet-card]');
    var tileEl = sheet.querySelector('[data-sheet-tile]');
    var iconUse = sheet.querySelector('[data-sheet-icon]');
    var nameEl = sheet.querySelector('[data-sheet-name]');
    var posEl = sheet.querySelector('[data-sheet-pos]');
    var whyEl = sheet.querySelector('[data-sheet-why]');
    var buildEl = sheet.querySelector('[data-sheet-build]');
    var addBtn = sheet.querySelector('[data-sheet-add]');
    var laterBtn = sheet.querySelector('.sheet__later');
    var sheetKey = null;
    var closing = 0;
    var canDialog = typeof sheet.showModal === 'function';

    function fillSheet(key) {
      var data = SKILLS[key];
      var c = colours(key);
      var keys = Object.keys(SKILLS);
      card.style.setProperty('--piece', c.piece);
      card.style.setProperty('--ink', c.ink);
      iconUse.setAttribute('href', '#i-sk-' + data.icon);
      nameEl.textContent = nameOf(key);
      posEl.textContent = '· ' + (keys.indexOf(key) + 1) + ' of ' + keys.length;
      whyEl.textContent = data.why;
      buildEl.innerHTML = '';
      data.build.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        buildEl.appendChild(li);
      });
      var on = placed[key] !== undefined;
      addBtn.classList.toggle('is-added', on);
      addBtn.textContent = on ? nameOf(key) + ' is on your board ✓' : 'Add ' + nameOf(key) + ' to your skills';
      laterBtn.textContent = on ? 'Close' : 'Maybe later';
    }

    function openSheet(key) {
      if (!canDialog) {
        return;
      }
      window.clearTimeout(closing);
      sheetKey = key;
      fillSheet(key);
      card.style.removeProperty('--drag');
      if (!sheet.open) {
        sheet.showModal();
      }
      // Opening moves focus into the card while it is still below the
      // screen, and the browser scrolls the dialog to show it: the card
      // then rose past its place and jumped back. Undo that scroll.
      sheet.scrollTop = 0;
      card.scrollTop = 0;
      // Restart the entrance each time.
      sheet.classList.remove('is-shown');
      void card.offsetWidth;
      window.requestAnimationFrame(function () {
        sheet.classList.add('is-shown');
      });
    }

    function closeSheet(after) {
      if (!sheet.open) {
        return;
      }
      sheet.classList.remove('is-shown');
      window.clearTimeout(closing);
      closing = window.setTimeout(function () {
        sheet.classList.remove('is-dragging');
        card.style.removeProperty('--drag');
        sheet.close();
        if (after) {
          after();
        }
      }, reduce.matches ? 0 : 380);
    }

    sheet.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeSheet();
    });

    sheet.addEventListener('click', function (event) {
      // A click on the dialog itself is a click on the backdrop.
      if (event.target === sheet || event.target.closest('[data-sheet-close]')) {
        closeSheet();
      }
    });

    addBtn.addEventListener('click', function () {
      var key = sheetKey;
      if (placed[key] !== undefined) {
        closeSheet();
        return;
      }
      var from = tileEl.getBoundingClientRect();
      var slot = nextSlot();
      closeSheet();
      // The board may be off screen behind the sheet; bring it in first.
      var box = disc.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) {
        disc.scrollIntoView({ block: 'center', behavior: 'auto' });
        place(key, slot);
        return;
      }
      fly(key, from, slot);
    });

    // Swipe the sheet down to dismiss (phones).
    (function () {
      var startY = 0;
      var dy = 0;
      var dragging = false;
      var handle = sheet.querySelector('.sheet__head');
      var grab = sheet.querySelector('[data-sheet-grab]');

      function down(event) {
        if (wideQuery.matches || event.target.closest('button')) {
          return;
        }
        dragging = true;
        startY = event.clientY;
        dy = 0;
        sheet.classList.add('is-dragging');
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      function move(event) {
        if (!dragging) {
          return;
        }
        dy = Math.max(0, event.clientY - startY);
        card.style.setProperty('--drag', dy + 'px');
      }
      function up() {
        if (!dragging) {
          return;
        }
        dragging = false;
        sheet.classList.remove('is-dragging');
        if (dy > 110) {
          closeSheet();
        } else {
          card.style.removeProperty('--drag');
        }
      }
      [grab, handle].forEach(function (el) {
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
      grab.style.touchAction = 'none';
      handle.style.touchAction = 'none';
    }());

    /* --- Clicks ----------------------------------------------------------- */
    var suppressClick = false;

    list.addEventListener('click', function (event) {
      var piece = event.target.closest('[data-skill]');
      if (!piece) {
        return;
      }
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      openSheet(piece.getAttribute('data-skill'));
    });

    disc.addEventListener('click', function (event) {
      var tile = event.target.closest('[data-tile]');
      if (tile) {
        openSheet(tile.getAttribute('data-tile'));
      }
    });

    /* --- Drag ------------------------------------------------------------- */
    var drag = null;

    function overDisc(x, y) {
      var r = disc.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      return Math.hypot(x - cx, y - cy) < r.width / 2 + 24;
    }

    function startDrag(piece, x, y) {
      var key = piece.getAttribute('data-skill');
      if (placed[key] !== undefined) {
        return false;
      }
      var rect = piece.getBoundingClientRect();
      drag = {
        key: key,
        piece: piece,
        dx: x - rect.left,
        dy: y - rect.top,
        rect: rect,
        ghost: makeGhost(key, rect),
        target: -1
      };
      piece.parentNode.classList.add('is-dragging');
      doc.classList.add('is-grabbing');
      moveDrag(x, y);
      return true;
    }

    function moveDrag(x, y) {
      if (!drag) {
        return;
      }
      setGhost(drag.ghost, x - drag.dx, y - drag.dy, ' rotate(-6deg) scale(1.08)');
      var over = overDisc(x, y);
      disc.classList.toggle('is-over', over);
      var target = over ? nearestSlot(x, y) : -1;
      if (target !== drag.target) {
        slots.forEach(function (s, i) {
          s.classList.toggle('is-target', i === target);
        });
        drag.target = target;
      }
    }

    function endDrag() {
      if (!drag) {
        return;
      }
      var d = drag;
      drag = null;
      disc.classList.remove('is-over');
      slots.forEach(function (s) {
        s.classList.remove('is-target');
      });
      d.piece.parentNode.classList.remove('is-dragging');
      doc.classList.remove('is-grabbing');

      if (d.target >= 0) {
        var to = landRect(d.target);
        var anim = d.ghost.animate([
          { transform: d.ghost.style.transform },
          { transform: 'translate3d(' + to.left + 'px,' + to.top + 'px,0) scale(' + (to.width / d.rect.width) + ',' + (to.height / d.rect.height) + ')' }
        ], { duration: 320, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' });
        anim.onfinish = function () {
          d.ghost.remove();
          place(d.key, d.target);
          // Dropping a piece also opens its card, the same as clicking it.
          window.setTimeout(function () {
            openSheet(d.key);
          }, 260);
        };
      } else {
        // Missed the board: the piece slides home.
        var back = d.ghost.animate([
          { transform: d.ghost.style.transform },
          { transform: 'translate3d(' + d.rect.left + 'px,' + d.rect.top + 'px,0)' }
        ], { duration: 380, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' });
        back.onfinish = function () {
          d.ghost.remove();
        };
      }
    }

    // Mouse and pen: drag starts once the pointer has moved a little, so a
    // plain click still opens the sheet.
    list.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch' || event.button !== 0) {
        return;
      }
      var piece = event.target.closest('[data-skill]');
      if (!piece) {
        return;
      }
      var sx = event.clientX;
      var sy = event.clientY;
      var started = false;

      function onMove(e) {
        if (!started && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
          started = startDrag(piece, sx, sy);
          if (!started) {
            cleanup();
            return;
          }
        }
        if (started) {
          e.preventDefault();
          moveDrag(e.clientX, e.clientY);
        }
      }
      function onUp() {
        if (started) {
          // Swallow only the click that this release may fire.
          suppressClick = true;
          window.setTimeout(function () {
            suppressClick = false;
          }, 60);
          endDrag();
        }
        cleanup();
      }
      function cleanup() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    // Touch: press and hold to pick a piece up, so ordinary swipes still
    // scroll the page.
    list.addEventListener('touchstart', function (event) {
      var piece = event.target.closest('[data-skill]');
      if (!piece || event.touches.length > 1) {
        return;
      }
      var t = event.touches[0];
      var sx = t.clientX;
      var sy = t.clientY;
      var lx = sx;
      var ly = sy;
      var started = false;
      var timer = window.setTimeout(function () {
        started = startDrag(piece, lx, ly);
        if (started && navigator.vibrate) {
          navigator.vibrate(12);
        }
      }, 260);

      function onMove(e) {
        var p = e.touches[0];
        lx = p.clientX;
        ly = p.clientY;
        if (!started) {
          if (Math.hypot(lx - sx, ly - sy) > 10) {
            finish();
          }
          return;
        }
        e.preventDefault();
        moveDrag(lx, ly);
      }
      function onEnd() {
        if (started) {
          suppressClick = true;
          endDrag();
          window.setTimeout(function () {
            suppressClick = false;
          }, 450);
        }
        finish();
      }
      function finish() {
        window.clearTimeout(timer);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
      }
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    }, { passive: true });

    list.addEventListener('contextmenu', function (event) {
      if (event.target.closest('[data-skill]')) {
        event.preventDefault();
      }
    });
  }


  /* ========================================================================
     8. PROGRAMME  (how it works)
     One row of day cards on a timeline. Phones swipe it (scroll snap).
     Wide screens pin the stage and slide the belt sideways as the page
     scrolls down; it can also be dragged, swiped sideways on a trackpad,
     or stepped with the arrow keys. Each card is a single tab stop that
     turns over to show the day's timetable.

     At the end the words GET JOB READY settle into a green field over the
     skyline. Like the intro, the first nudge down from the end of the row
     plays the whole hand-over on its own; once Get job ready has arrived
     the room is folded away, so scrolling back up is an ordinary scroll
     and the mask never shows on the way up.
     ======================================================================== */

  var prog = document.querySelector('[data-prog]');
  var progTrack = document.querySelector('[data-prog-track]');
  var progStage = document.querySelector('[data-prog-stage]');
  var progBelt = document.querySelector('[data-prog-belt]');
  var progRail = document.querySelector('[data-prog-rail]');
  var progOutro = document.querySelector('[data-prog-outro]');
  var progMask = document.querySelector('[data-ready-mask]');
  var readySection = document.getElementById('job-ready');
  var progWords = Array.prototype.slice.call(document.querySelectorAll('[data-ready-words]'));
  var progItems = prog ? Array.prototype.slice.call(prog.querySelectorAll('.prog__item')) : [];
  var progDays = prog ? Array.prototype.slice.call(prog.querySelectorAll('[data-day]')) : [];
  var progDots = prog ? Array.prototype.slice.call(prog.querySelectorAll('.prog__bar [data-go]')) : [];
  var progSteps = prog ? Array.prototype.slice.call(prog.querySelectorAll('[data-step]')) : [];
  var progControls = document.querySelector('[data-prog-controls]');
  var progWeekLabel = document.querySelector('[data-prog-week]');
  var progDayLabel = document.querySelector('[data-prog-day]');

  var sideways = false;    // wide screen: the belt runs sideways
  var progDist = 0;        // how far the belt travels, in px
  var progX = 0;           // how far it has travelled
  var progSpots = [];      // each item's left edge and width along the belt
  var progCurrent = 0;     // index of the day card in the middle
  var tween = null;        // a running glide (arrows, dots, keys)
  var progKeep = null;     // how far along the pinned row the reader is (0-1)
  var progResizing = false;

  var READY_GEOMETRY = [
    { cx: 646, cy: 437, lift: 560 },   // wide  1292 x 728
    { cx: 180, cy: 438, lift: 600 }    // tall  360 x 800
  ];

  function trackTravel() {
    return Math.max(1, progTrack.offsetHeight - screenH());
  }

  function trackTop() {
    return progTrack.getBoundingClientRect().top + window.scrollY;
  }

  /* The programme is long and phones pay for every measurement of it, so
     it is only laid out and tracked once it is within a screen of view
     (or a return to a saved place needs it). */
  var progNear = false;
  var progMeasured = false;

  function ensureProg() {
    if (!progMeasured) {
      progMeasured = true;
      measureProg();
    }
  }

  function remeasureProg() {
    if (progMeasured) {
      measureProg();
    }
  }

  /** Lay the belt out again. Keeps the reader at the same point along it,
   *  so resizing the window never jumps them to another day. */
  function measureProg() {
    if (!prog || !progBelt) {
      return;
    }
    // Taken from the last scroll frame, before the resize moved anything.
    var keep = sideways ? progKeep : null;
    sideways = wideQuery.matches && pinQuery.matches;
    progBelt.style.transform = '';
    if (!sideways) {
      prog.style.removeProperty('--prog-dist');
      progItems.forEach(function (item) {
        item.style.removeProperty('--near');
      });
      progDist = 0;
      progX = 0;
      updateCurrent();
      return;
    }
    progDist = Math.max(0, progBelt.scrollWidth - progStage.clientWidth);
    prog.style.setProperty('--prog-dist', progDist.toFixed(0) + 'px');
    var left = progBelt.getBoundingClientRect().left;
    progSpots = progItems.map(function (item) {
      var r = item.getBoundingClientRect();
      return { item: item, left: r.left - left, width: r.width };
    });
    if (keep !== null) {
      window.scrollTo({ top: trackTop() + keep * trackTravel(), behavior: 'instant' });
    }
    requestUpdate();
  }

  function spotOf(el) {
    var item = el.closest('.prog__item') || el;
    return progSpots.filter(function (s) { return s.item === item; })[0] || null;
  }

  /** Page scroll position that brings this item to the middle (wide). */
  function sideTarget(el) {
    var spot = spotOf(el);
    if (!spot) {
      return null;
    }
    var x = clamp(spot.left + spot.width / 2 - window.innerWidth / 2, 0, progDist);
    return trackTop() + (progDist ? x / progDist : 0) * trackTravel();
  }

  function glideTo(top, duration) {
    if (top === null) {
      return;
    }
    var from = window.scrollY;
    var to = clamp(top, 0, document.documentElement.scrollHeight - window.innerHeight);
    var dist = to - from;
    if (Math.abs(dist) < 2) {
      return 0;
    }
    if (reduceQuery.matches) {
      window.scrollTo({ top: to, behavior: 'instant' });
      return 0;
    }
    var ms = duration || clamp(450 + Math.abs(dist) * 0.3, 600, 1300);
    var start = null;
    var id = {};
    tween = id;
    function step(now) {
      if (tween !== id) {
        return;
      }
      if (start === null) {
        start = now;
      }
      var t = clamp((now - start) / ms, 0, 1);
      scrollNow(from + dist * easeAuto(t));
      if (t < 1) {
        window.requestAnimationFrame(step);
      } else {
        tween = null;
      }
    }
    window.requestAnimationFrame(step);
    return ms;
  }

  /** Bring a day card (or any item) to the middle. Returns how long the
   *  glide takes (0 when it is already there). */
  function showItem(el) {
    if (!el) {
      return 0;
    }
    if (sideways) {
      return glideTo(sideTarget(el)) || 0;
    }
    // Phones and tablets: the days run down the page, so scroll to it.
    var r = el.getBoundingClientRect();
    return glideTo(window.scrollY + r.top + r.height / 2 - window.innerHeight / 2) || 0;
  }

  function stepDay(dir) {
    var i = clamp(progCurrent + dir, 0, progDays.length - 1);
    if (i !== progCurrent || dir === 0) {
      showItem(progDays[i]);
    }
  }

  /** Which day card is nearest the middle of the screen. */
  function updateCurrent() {
    if (!progDays.length) {
      return;
    }
    var midX = window.innerWidth / 2;
    var midY = window.innerHeight / 2;
    var best = Infinity;
    var index = 0;
    progDays.forEach(function (day, i) {
      var r = day.getBoundingClientRect();
      var d = sideways ? Math.abs(r.left + r.width / 2 - midX) : Math.abs(r.top + r.height / 2 - midY);
      if (d < best) {
        best = d;
        index = i;
      }
    });
    // At the very end of the belt the certificate cannot reach the middle,
    // so it is the current card once the belt has run out.
    if (sideways && progDist && progX >= progDist - 2) {
      index = progDays.length - 1;
    }
    progCurrent = index;
    progDays.forEach(function (day, i) {
      day.closest('.prog__item').classList.toggle('is-current', i === index);
    });
    progDots.forEach(function (dot, i) {
      if (i === index) {
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.removeAttribute('aria-current');
      }
      dot.classList.toggle('is-past', i < index);
    });
    // "Week 1  Monday" under the arrows, in that day's colour.
    var now = progDots[index];
    if (now && progControls) {
      var parts = now.getAttribute('aria-label').split(', ');
      progWeekLabel.textContent = parts.length > 1 ? parts[0] : 'The finish';
      progDayLabel.textContent = parts.length > 1 ? parts[1] : 'Certificate';
      progControls.style.setProperty('--now', window.getComputedStyle(now).getPropertyValue('--c').trim());
    }
    progSteps.forEach(function (btn) {
      var dir = parseInt(btn.getAttribute('data-step'), 10);
      btn.disabled = (dir < 0 && index === 0) || (dir > 0 && index === progDays.length - 1);
    });
  }

  /* --- The GET JOB READY hand-over ------------------------------------ */
  var outroAuto = null;
  var outroDone = false;
  var outroLastY = window.scrollY;
  var OUTRO_MS = AUTO_MS;   // same pace as the MOVEMENT TO WORK hand-over
  var OUTRO_FROM = 0.24;    // screens past the last card where it starts

  function outroStart() {
    return progOutro.getBoundingClientRect().top + window.scrollY - screenH();
  }

  function outroEnd() {
    // Rounded up, so Get job ready always covers the very top row of pixels.
    return Math.ceil(readySection.getBoundingClientRect().top + window.scrollY);
  }

  function setOutroDone(on) {
    if (on === outroDone || !progOutro) {
      return;
    }
    var before = progOutro.offsetHeight;
    var y = window.scrollY;
    outroDone = on;
    doc.classList.toggle('is-ready-done', on);
    // Folding happens with Get job ready on screen, below the room, so
    // the page above shrinks and the scroll position follows it. Opening
    // only happens with the room out of sight below, where nothing moves.
    var diff = before - progOutro.offsetHeight;
    if (on && diff) {
      window.scrollTo({ top: Math.max(0, y - diff), behavior: 'instant' });
    }
    outroLastY = window.scrollY;
  }

  function wantsOutro(dir) {
    if (!progNear || !active || !progOutro || !readySection || outroDone || outroAuto || pending || dir <= 0) {
      return false;
    }
    if (menuOpen || document.querySelector('dialog[open]') || auto) {
      return false;
    }
    // A little room past the last card first, so the certificate can be
    // looked at without the next swipe carrying the page away; the hand-
    // over starts just before the green field begins to show (it fades in
    // from a quarter of a screen in). It used to start at 0.3, so stopping
    // between the two left the field faintly showing and the page stuck.
    var y = window.scrollY;
    return y >= outroStart() + screenH() * OUTRO_FROM - 4 && y < outroEnd() - 4;
  }

  function playOutro() {
    if (outroAuto) {
      return true;
    }
    // Plays exactly like the MOVEMENT TO WORK hand-over: one fixed, eased
    // glide at the same pace, which the reader's scrolling cannot speed up
    // or push around until it has landed (their input is held while it
    // plays). It starts the moment it is reached rather than first freezing
    // the page until their scrolling settles, which felt like a stall.
    var from = window.scrollY;
    var to = outroEnd();
    var dist = to - from;
    if (dist < 4) {
      return false;
    }
    // The full hand-over (from where it normally starts) takes exactly as
    // long as the MOVEMENT TO WORK one; starting further in takes
    // proportionally less.
    var span = Math.max(1, to - (outroStart() + screenH() * OUTRO_FROM));
    var ms = clamp(OUTRO_MS * dist / span, 900, OUTRO_MS);
    var start = null;
    var mine = outroAuto = {};
    pending = null;
    tween = null;
    doc.classList.add('is-autoplaying');
    doc.classList.remove('is-ready-rewinding');
    function step(now) {
      if (outroAuto !== mine) {
        return;    // stopped: the reader chose somewhere else to go
      }
      if (start === null) {
        start = now;
      }
      var t = clamp((now - start) / ms, 0, 1);
      scrollNow(from + (to - from) * easeAuto(t));
      if (t < 1) {
        window.requestAnimationFrame(step);
      } else {
        // Sections below draw lazily, so the landing is checked once at
        // the end (measuring it every frame forced a layout per frame).
        var end = outroEnd();
        if (Math.abs(end - window.scrollY) > 1) {
          scrollNow(end);
        }
        outroAuto = null;
        landed();
        doc.classList.remove('is-autoplaying');
        setOutroDone(true);
      }
    }
    window.requestAnimationFrame(step);
    return true;
  }

  /* Reaching Get job ready any other way (the scrollbar, a menu link, a
     keyboard jump) folds the room away too, once the scrolling settles. */
  var outroSettle = 0;
  function checkOutro() {
    if (!active || outroDone || outroAuto || !readySection) {
      return;
    }
    if (readySection.getBoundingClientRect().top <= 1) {
      setOutroDone(true);
    }
  }

  /* --- Per frame ------------------------------------------------------- */
  function updateProg(vh) {
    if (!prog || !progNear) {
      return;
    }
    var vw = window.innerWidth;
    var y = window.scrollY;

    if (progResizing) {
      return;
    }

    if (sideways) {
      var r = progTrack.getBoundingClientRect();
      var p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      progKeep = r.top <= 1 && r.bottom >= vh - 1 ? p : null;
      progX = p * progDist;
      progBelt.style.transform = 'translate3d(' + (-progX).toFixed(1) + 'px,0,0)';
      prog.style.setProperty('--veil', (1 - clamp(progX / (vw * 0.4), 0, 1)).toFixed(3));
      progSpots.forEach(function (s) {
        var left = s.left - progX;
        var near = easeOut(clamp((vw - left) / (vw * 0.38), 0, 1));
        s.item.style.setProperty('--near', near.toFixed(3));
      });
      updateCurrent();
    } else {
      // Phones: the coloured line fills down the track to the middle of
      // the screen, and each day's node fills in as the line reaches it.
      // Every position is read first, then everything is written, so the
      // page is laid out once per frame rather than once per card.
      var rr = progRail.getBoundingClientRect();
      var fill = clamp((vh * 0.55 - rr.top) / Math.max(1, rr.height), 0, 1);
      var reached = progItems.map(function (item) {
        var ir = item.getBoundingClientRect();
        return ir.top + ir.height / 2 < vh * 0.55;
      });
      updateCurrent();
      setVar(progRail, '--fill', fill.toFixed(4));
      progItems.forEach(function (item, i) {
        if (item._reached !== reached[i]) {
          item._reached = reached[i];
          item.classList.toggle('is-reached', reached[i]);
        }
      });
    }

    if (!progOutro || !progMask || !progOutro.offsetHeight) {
      return;
    }

    // Folded away, and the reader has gone back above it: open it again
    // (out of sight below, so nothing moves) ready for the next time.
    var o = progOutro.getBoundingClientRect();
    if (outroDone && !outroAuto && o.top >= vh) {
      setOutroDone(false);
      o = progOutro.getBoundingClientRect();
    }

    if (!outroAuto && Math.abs(y - outroLastY) > 1) {
      doc.classList.toggle('is-ready-rewinding', y < outroLastY);
    }
    var goingDown = y > outroLastY + 1;
    outroLastY = y;
    if (goingDown && !scrollLocked() && wantsOutro(1)) {
      playOutro();
    }
    window.clearTimeout(outroSettle);
    outroSettle = window.setTimeout(checkOutro, 180);

    var s = -o.top / vh;
    var H = o.height / vh;
    var f = range(s, -0.75, 0.1);
    var shrink = easeInOut(range(s, -0.75, 0.6));
    var scale = 3.2 - 2.2 * shrink;
    var lift = easeInOut(range(s, H - 2, H - 1));
    progMask.style.opacity = outroDone ? '0' : f.toFixed(3);
    progMask.style.visibility = f <= 0 || outroDone ? 'hidden' : '';
    progWords.forEach(function (group, i) {
      var g = READY_GEOMETRY[i] || READY_GEOMETRY[0];
      group.setAttribute('transform',
        'translate(' + g.cx + ' ' + (g.cy - g.lift * lift).toFixed(1) + ') ' +
        'scale(' + scale.toFixed(4) + ') ' +
        'translate(' + (-g.cx) + ' ' + (-g.cy) + ')');
    });
  }

  function resetProg() {
    if (!prog) {
      return;
    }
    progBelt.style.transform = '';
    if (progMask) {
      progMask.style.opacity = '';
      progMask.style.visibility = '';
    }
    progWords.forEach(function (g) {
      g.removeAttribute('transform');
    });
  }

  function flipDay(day, on) {
    var toggle = day.querySelector('[data-day-toggle]');
    if (!toggle) {
      return;
    }
    var flipped = on === undefined ? !day.classList.contains('is-flipped') : on;
    if (flipped === day.classList.contains('is-flipped')) {
      return;
    }
    day.classList.toggle('is-flipped', flipped);
    day.classList.remove('is-turning');
    void day.offsetWidth;
    day.classList.add('is-turning');
    window.setTimeout(function () {
      day.classList.remove('is-turning');
    }, 950);
    toggle.setAttribute('aria-expanded', flipped ? 'true' : 'false');
    var label = toggle.querySelector('.visually-hidden');
    if (label) {
      label.textContent = label.textContent.replace(/^(Show|Hide)/, flipped ? 'Hide' : 'Show');
    }
  }

  function inProgView() {
    if (!progNear) {
      return false;
    }
    var r = (sideways ? progTrack : progRail).getBoundingClientRect();
    return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
  }

  function initProgramme() {
    if (!prog || !progBelt) {
      return;
    }

    var dragged = false;

    prog.addEventListener('click', function (event) {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      var toggle = event.target.closest('[data-day-toggle]');
      var step = event.target.closest('[data-step]');
      var go = event.target.closest('[data-go]');
      if (toggle) {
        var day = toggle.closest('[data-day]');
        // A card off to the side glides to the middle first and turns as
        // it settles, so the move reads as one smooth motion.
        var wait = progDays.indexOf(day) !== progCurrent ? showItem(day) : 0;
        if (wait) {
          window.clearTimeout(day._turn);
          day._turn = window.setTimeout(function () {
            flipDay(day);
          }, wait * 0.6);
        } else {
          flipDay(day);
        }
      } else if (step) {
        stepDay(parseInt(step.getAttribute('data-step'), 10));
      } else if (go) {
        showItem(document.getElementById(go.getAttribute('data-go')));
      }
    }, true);

    // Any input of the reader's own cancels a glide.
    ['wheel', 'touchstart'].forEach(function (type) {
      window.addEventListener(type, function () {
        tween = null;
      }, { passive: true });
    });

    // Sideways trackpad swipes move the belt too.
    window.addEventListener('wheel', function (event) {
      if (scrollLocked()) {
        event.preventDefault();
        return;
      }
      if (sideways && !event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        var r = progTrack.getBoundingClientRect();
        if (r.top <= 1 && r.bottom >= screenH() - 1) {
          var delta = event.deltaX * (event.deltaMode === 1 ? 32 : 1);
          window.scrollBy({ top: delta * (trackTravel() / Math.max(progDist, 1)), behavior: 'instant' });
          event.preventDefault();
          return;
        }
      }
      if (!event.ctrlKey && event.deltaY > 2 && wantsOutro(1) && playOutro()) {
        event.preventDefault();
      }
    }, { passive: false });

    var touchY = null;
    window.addEventListener('touchstart', function (event) {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    }, { passive: true });
    window.addEventListener('touchmove', function (event) {
      if (scrollLocked()) {
        event.preventDefault();
        return;
      }
      if (touchY === null) {
        return;
      }
      var dy = touchY - event.touches[0].clientY;
      if (Math.abs(dy) < 10) {
        return;
      }
      touchY = null;
      if (dy > 0 && wantsOutro(1) && playOutro()) {
        event.preventDefault();
      }
    }, { passive: false });

    // Keys: left and right step through the days; down at the end plays
    // the hand-over. Inside a card, left and right move between cards.
    window.addEventListener('keydown', function (event) {
      var t = event.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
        return;
      }
      if (scrollLocked()) {
        event.preventDefault();
        return;
      }
      if (menuOpen || document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      var key = event.key;
      if ((key === 'ArrowRight' || key === 'ArrowLeft') && (inProgView() || prog.contains(t))) {
        var dir = key === 'ArrowRight' ? 1 : -1;
        var next = clamp(progCurrent + dir, 0, progDays.length - 1);
        event.preventDefault();
        if (prog.contains(t) && t.matches('[data-day-toggle]')) {
          var target = progDays[next].querySelector('[data-day-toggle]');
          if (target) {
            target.focus({ preventScroll: true });
          }
        }
        stepDay(dir);
        return;
      }
      var down = (key === 'ArrowDown' || key === 'PageDown' || (key === ' ' && !event.shiftKey));
      if (down && !(t && t.tagName === 'BUTTON' && key === ' ') && wantsOutro(1) && playOutro()) {
        event.preventDefault();
      }
    });

    // The stage clips the belt, which also makes it scrollable from code:
    // focusing a card at the edge let the browser scroll it sideways in
    // one jump, under the glide. It is kept at rest; the glide does the
    // moving.
    progStage.addEventListener('scroll', function () {
      if (progStage.scrollLeft || progStage.scrollTop) {
        progStage.scrollLeft = 0;
        progStage.scrollTop = 0;
      }
    }, { passive: true });

    // Tabbing to a card brings it to the middle.
    prog.addEventListener('focusin', function (event) {
      var day = event.target.closest('[data-day]');
      if (!day) {
        return;
      }
      if (sideways) {
        var r = day.getBoundingClientRect();
        if (r.left < 0 || r.right > window.innerWidth || progDays.indexOf(day) !== progCurrent) {
          showItem(day);
        }
      }
    });

    // Wide: drag the belt with the mouse, with a little momentum.
    (function () {
      var startX = 0;
      var startY = 0;
      var lastX = 0;
      var lastT = 0;
      var vel = 0;
      var down = false;
      var coast = null;
      progStage.addEventListener('pointerdown', function (event) {
        if (!sideways || event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('.prog__controls')) {
          return;
        }
        // No text selection as the mouse sweeps across the page.
        event.preventDefault();
        down = true;
        dragged = false;
        startX = lastX = event.clientX;
        startY = window.scrollY;
        lastT = performance.now();
        vel = 0;
        tween = null;
        if (coast) {
          window.cancelAnimationFrame(coast);
          coast = null;
        }
      });
      window.addEventListener('pointermove', function (event) {
        if (!down) {
          return;
        }
        var dx = event.clientX - startX;
        if (!dragged && Math.abs(dx) > 6) {
          dragged = true;
          progStage.classList.add('is-dragging');
          doc.classList.add('is-grabbing');
          try {
            progStage.setPointerCapture(event.pointerId);
          } catch (e) { /* not captured: still works */ }
        }
        if (!dragged) {
          return;
        }
        var now = performance.now();
        var ratio = trackTravel() / Math.max(progDist, 1);
        vel = (event.clientX - lastX) / Math.max(1, now - lastT) * 0.8 + vel * 0.2;
        lastX = event.clientX;
        lastT = now;
        var t0 = trackTop();
        window.scrollTo({ top: clamp(startY - dx * ratio, t0, t0 + trackTravel()), behavior: 'instant' });
      });
      function release() {
        if (!down) {
          return;
        }
        down = false;
        progStage.classList.remove('is-dragging');
        doc.classList.remove('is-grabbing');
        if (!dragged) {
          return;
        }
        window.setTimeout(function () {
          dragged = false;
        }, 0);
        var ratio = trackTravel() / Math.max(progDist, 1);
        var v = vel;
        var lastFrame = performance.now();
        function glide(now) {
          var dt = now - lastFrame;
          lastFrame = now;
          v *= Math.pow(0.92, dt / 16);
          if (Math.abs(v) < 0.02) {
            coast = null;
            return;
          }
          var t1 = trackTop();
          var nextY = clamp(window.scrollY - v * dt * ratio, t1, t1 + trackTravel());
          if (nextY === window.scrollY) {
            coast = null;
            return;
          }
          window.scrollTo({ top: nextY, behavior: 'instant' });
          coast = window.requestAnimationFrame(glide);
        }
        if (!reduceQuery.matches) {
          coast = window.requestAnimationFrame(glide);
        }
      }
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      progStage.addEventListener('dragstart', function (event) {
        event.preventDefault();
      });
    }());

    // Phones: keep the dots in step with the swipe.
    var railQueued = false;
    progRail.addEventListener('scroll', function () {
      if (!railQueued) {
        railQueued = true;
        window.requestAnimationFrame(function () {
          railQueued = false;
          updateCurrent();
        });
      }
    }, { passive: true });

    // Pieces arrive as they come into view.
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.04 });
      progItems.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      progItems.forEach(function (el) {
        el.classList.add('is-in');
      });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        progNear = entries[entries.length - 1].isIntersecting;
        if (progNear) {
          ensureProg();
          requestUpdate();
        }
      }, { rootMargin: '100% 0px' }).observe(prog);
    } else {
      progNear = true;
      ensureProg();
    }
    listen(wideQuery, remeasureProg);
    listen(pinQuery, remeasureProg);
    // Re-measure in the same frame as the resize, so the belt never
    // shows a stale layout.
    var resizeQueued = false;
    window.addEventListener('resize', function () {
      if (!realResize) {
        return;
      }
      progResizing = true;
      if (!resizeQueued) {
        resizeQueued = true;
        window.requestAnimationFrame(function () {
          resizeQueued = false;
          progResizing = false;
          remeasureProg();
          requestUpdate();
        });
      }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasureProg);
    }
    window.addEventListener('load', remeasureProg);
  }


  /* ========================================================================
     9. GET JOB READY
     The tools fan in; choosing a CV file checks its type and size here in
     the browser, then the feedback cards play again.
     ======================================================================== */

  function initReady() {
    var tools = document.querySelector('[data-tools]');
    if (tools) {
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) {
            tools.classList.add('is-in');
            observer.disconnect();
          }
        }, { threshold: 0.15 });
        observer.observe(tools);
      } else {
        tools.classList.add('is-in');
      }
    }

    initToolTabs(tools);

    // Import your CV opens the upload dialog (cv-review.js).

  }



  /** Phones: one tool at a time, chosen with the tabs or by swiping the
   *  card. Wide screens show all three and the tabs are hidden. */
  function initToolTabs(tools) {
    var bar = document.querySelector('[data-tool-tabs]');
    if (!tools || !bar) {
      return;
    }
    var tabs = Array.prototype.slice.call(bar.querySelectorAll('[data-tool-tab]'));
    var cards = Array.prototype.slice.call(tools.querySelectorAll('[data-tool]'));
    var current = 0;

    function show(i, focus) {
      var from = current;
      current = (i + tabs.length) % tabs.length;
      var frame = bar.parentNode;
      if (frame) {
        frame.setAttribute('data-tool-active', tabs[current].getAttribute('data-tool-tab'));
      }
      tabs.forEach(function (tab, n) {
        var on = n === current;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
      });
      cards.forEach(function (card, n) {
        var on = n === current;
        card.classList.toggle('is-active', on);
        card.classList.remove('is-switching');
        if (on && from !== current) {
          card.style.setProperty('--from-x', current > from ? '1' : '-1');
          void card.offsetWidth;
          card.classList.add('is-switching');
        }
      });
      if (focus) {
        tabs[current].focus();
      }
    }

    function setMode() {
      var narrow = !wideQuery.matches && !tabletQuery.matches;
      tools.classList.toggle('has-tabs', narrow);
      // The panel is the card's <section> (an <li> cannot be a tabpanel).
      cards.forEach(function (card, n) {
        var panel = card.querySelector('.tool__card');
        if (!panel) {
          return;
        }
        if (narrow) {
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', tabs[n].id);
        } else {
          panel.removeAttribute('role');
          panel.removeAttribute('aria-labelledby');
        }
      });
      show(current);
    }

    bar.addEventListener('click', function (event) {
      var tab = event.target.closest('[data-tool-tab]');
      if (tab) {
        show(tabs.indexOf(tab));
      }
    });

    bar.addEventListener('keydown', function (event) {
      var dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (event.key === 'Home') {
        event.preventDefault();
        show(0, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        show(tabs.length - 1, true);
      } else if (dir) {
        event.preventDefault();
        show(current + dir, true);
      }
    });

    // Swipe the card left or right to move between tools.
    var sx = null;
    var sy = null;
    tools.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) {
        sx = null;
        return;
      }
      sx = event.touches[0].clientX;
      sy = event.touches[0].clientY;
    }, { passive: true });
    tools.addEventListener('touchend', function (event) {
      if (sx === null || !tools.classList.contains('has-tabs')) {
        return;
      }
      var t = event.changedTouches[0];
      var dx = t.clientX - sx;
      var dy = t.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        show(current + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });

    setMode();
    listen(wideQuery, setMode);
    listen(tabletQuery, setMode);
  }


  /* ========================================================================
     9b. FAQ, NEXT STEP AND FOOTER
     ======================================================================== */

  /** One answer open at a time; each opens and closes smoothly (CSS). */
  function initFaq() {
    var list = document.querySelector('[data-faq]');
    if (!list) {
      return;
    }
    var buttons = Array.prototype.slice.call(list.querySelectorAll('[data-qa]'));
    function set(btn, open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.closest('.qa').classList.toggle('is-open', open);
    }
    list.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-qa]');
      if (!btn) {
        return;
      }
      var open = btn.getAttribute('aria-expanded') !== 'true';
      buttons.forEach(function (b) {
        if (b !== btn) {
          set(b, false);
        }
      });
      set(btn, open);
    });
  }

  /** The next-step hand-over. Purely scroll-linked, so it runs the same
   *  forwards and backwards: the arrow draws as the block comes up the
   *  screen, and the pale green patch grows out to fill the block, so it
   *  meets Join now's matching background with no seam. */
  function initNext() {
    var next = document.querySelector('[data-next]');
    var paint = document.querySelector('[data-next-paint]');
    if (!next || !paint) {
      return;
    }
    var stage = next.querySelector('.next__stage');
    var base = null;
    function measure() {
      var prev = paint.style.scale;
      paint.style.scale = '1';
      var pr = paint.getBoundingClientRect();
      var sr = stage.getBoundingClientRect();
      paint.style.scale = prev;
      // Scale that takes the patch past every edge of the block.
      var cx = pr.left + pr.width / 2 - sr.left;
      var cy = pr.top + pr.height / 2 - sr.top;
      var needX = Math.max(cx, sr.width - cx) * 2 / Math.max(pr.width, 1);
      var needY = Math.max(cy, sr.height - cy) * 2 / Math.max(pr.height, 1);
      base = Math.max(needX, needY) * 1.25;
      next.style.setProperty('--S', base.toFixed(2));
    }
    var queued = false;
    function draw() {
      queued = false;
      if (base === null) {
        measure();
      }
      var r = next.getBoundingClientRect();
      var vh = screenH();
      // 0 as the block's top enters the bottom of the screen, 1 as the
      // block's bottom reaches the bottom of the screen.
      var travel = Math.max(1, r.height);
      var p = clamp((vh - r.top) / travel, 0, 1);
      var drawn = reduceQuery.matches ? 1 : clamp(p / 0.62, 0, 1);
      var grow = reduceQuery.matches ? 1 : easeInOut(range(p, 0.62, 1));
      next.style.setProperty('--draw', drawn.toFixed(3));
      next.style.setProperty('--grow', grow.toFixed(3));
      next.classList.toggle('is-flooding', grow > 0);
    }
    window.addEventListener('scroll', function () {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(draw);
      }
    }, { passive: true });
    window.addEventListener('resize', function () {
      if (realResize) {
        base = null;
        draw();
      }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        base = null;
        draw();
      });
    }
    draw();
  }

  /** The journal message types itself, then sends. */
  function typeJournal() {
    var demo = document.querySelector('.dj');
    var target = demo && demo.querySelector('[data-type]');
    if (!target || demo.classList.contains('is-typed')) {
      return;
    }
    var text = target.getAttribute('data-type');
    if (reduceQuery.matches) {
      target.textContent = text;
      demo.classList.add('is-typed', 'is-sent');
      return;
    }
    var i = 0;
    function tick() {
      i += 1;
      target.textContent = text.slice(0, i);
      if (i < text.length) {
        window.setTimeout(tick, text.charAt(i - 1) === ',' || text.charAt(i - 1) === '.' ? 220 : 34 + Math.random() * 40);
      } else {
        demo.classList.add('is-typed');
        window.setTimeout(function () {
          demo.classList.add('is-sent');
        }, 650);
      }
    }
    window.setTimeout(tick, 700);
  }

  /** Pieces that arrive once as they scroll into view. */
  function initArrivals() {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll('[data-next], [data-join-steps], .foot, .foot__frame')
    );
    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
          if (entry.target.hasAttribute('data-join-steps')) {
            typeJournal();
          }
        }
      });
    }, { threshold: 0.2 });
    targets.forEach(function (el) {
      observer.observe(el);
    });
  }


  /* ========================================================================
     9b. COMING BACK FROM THE PRIVACY POLICY OR DISCLAIMER
     Leaving for one of those pages notes where you were (and whether the
     intro and Get job ready hand-overs had already played, as they fold
     the page). Coming back, with their Back link or the browser's back
     button, returns you to the same place instead of the top.
     ======================================================================== */

  var RETURN_KEY = 'mtw-return';

  function initReturn() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href$="privacy.html"], a[href$="disclaimer.html"]');
      if (!link) {
        return;
      }
      try {
        window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({
          y: window.scrollY, intro: collapsed, ready: outroDone, t: Date.now()
        }));
      } catch (e) { /* storage off: you simply return to the top */ }
    });

    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var back = /^#back$/.test(location.hash) || (nav && nav.type === 'back_forward');
    var saved = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(RETURN_KEY) || 'null');
      window.sessionStorage.removeItem(RETURN_KEY);
    } catch (e) { /* nothing saved */ }
    if (location.hash === '#back' && window.history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!back || !saved || Date.now() - saved.t > 60 * 60 * 1000) {
      return;
    }
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    // Fold the page the way it was, then go straight back to the spot.
    if (saved.intro) {
      collapsed = true;
      doc.classList.add('is-intro-done');
    }
    if (saved.ready && progOutro) {
      outroDone = true;
      doc.classList.add('is-ready-done');
    }
    // Sections further down are normally only drawn near the screen, with
    // estimated heights; draw them all for a moment so the saved position
    // means the same place it did.
    doc.classList.add('is-drawing-all');
    progNear = true;
    ensureProg();
    window.scrollTo({ top: saved.y, behavior: 'instant' });
    lastY = window.scrollY;
    outroLastY = window.scrollY;
    requestUpdate();
    window.requestAnimationFrame(function () {
      window.scrollTo({ top: saved.y, behavior: 'instant' });
      window.requestAnimationFrame(function () {
        doc.classList.remove('is-drawing-all');
      });
    });
  }


  /* ========================================================================
     9c. KEEP YOUR PLACE WHEN THE WINDOW CHANGES SIZE
     Resizing changes how tall almost everything is (the pinned sections are
     measured in screens, and the programme switches between a sideways
     belt and a column), so the same scroll position lands somewhere else.
     While you scroll, this notes where you are: the day card you are on in
     the programme, how far through a pinned section you are, or which
     section is at the top of the screen and how far into it. While the
     window is being resized, the page is put back to that same place on
     every frame, and only starts noting again once resizing has stopped.
     ======================================================================== */

  var place = null;
  var placeFrozen = false;
  var placeQueued = false;
  var placeTimer = 0;

  function pinnedTracks() {
    // The programme's tracks only count once it is near (see progNear):
    // measuring them sooner would make the browser lay it all out.
    var tracks = progNear ? [intro, journey, progTrack, progOutro] : [intro, journey];
    return tracks.concat(document.querySelector('[data-next]')).filter(Boolean);
  }

  function readPlace() {
    var vh = screenH();
    var mid = vh / 2;
    // The programme: hold on to the day card being looked at.
    if (prog && progTrack && progNear) {
      var tr = progTrack.getBoundingClientRect();
      if (tr.top < mid && tr.bottom > mid) {
        var item = null;
        if (sideways) {
          item = progDays[progCurrent] ? progDays[progCurrent].closest('.prog__item') : null;
        } else {
          item = progItems.filter(function (el) {
            var r = el.getBoundingClientRect();
            return r.top <= mid && r.bottom >= mid;
          })[0] || null;
        }
        if (item) {
          var ir = item.getBoundingClientRect();
          return { kind: 'prog', el: item, off: sideways ? null : (mid - ir.top) / Math.max(1, ir.height),
            p: sideways && tr.top <= 1 && tr.bottom >= vh - 1 ? -tr.top / Math.max(1, tr.height - vh) : null };
        }
      }
    }
    // Part-way through a pinned section.
    var tracks = pinnedTracks();
    for (var i = 0; i < tracks.length; i++) {
      var r = tracks[i].getBoundingClientRect();
      if (r.height > vh + 4 && r.top <= 1 && r.bottom >= vh - 1) {
        return { kind: 'track', el: tracks[i], p: -r.top / (r.height - vh) };
      }
    }
    // Otherwise the section at the top of the screen.
    var main = document.querySelector('main');
    var blocks = main ? Array.prototype.slice.call(main.children) : [];
    var foot = document.querySelector('.foot');
    if (foot) {
      blocks.push(foot);
    }
    for (var j = 0; j < blocks.length; j++) {
      var b = blocks[j].getBoundingClientRect();
      if (b.height && b.bottom > 0) {
        return { kind: 'block', el: blocks[j], f: -b.top / b.height };
      }
    }
    return null;
  }

  function restorePlace(a) {
    if (!a || !document.contains(a.el)) {
      return;
    }
    var vh = screenH();
    var r = a.el.getBoundingClientRect();
    var top = r.top + window.scrollY;
    var y;
    if (a.kind === 'prog') {
      if (sideways && a.p != null) {
        // Still sideways: the same distance along the belt.
        y = trackTop() + a.p * trackTravel();
      } else {
        // Switched layout: bring the same day card back into view.
        y = sideways ? sideTarget(a.el) : top + (a.off == null ? 0.5 : a.off) * r.height - vh / 2;
      }
    } else if (a.kind === 'track') {
      y = top + a.p * Math.max(0, r.height - vh);
    } else {
      y = top + a.f * r.height;
    }
    if (y != null && isFinite(y)) {
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    }
  }

  function initKeepPlace() {
    window.addEventListener('scroll', function () {
      if (placeFrozen || placeQueued) {
        return;
      }
      placeQueued = true;
      window.requestAnimationFrame(function () {
        placeQueued = false;
        if (!placeFrozen && !auto && !outroAuto && !nextAuto) {
          place = readPlace();
        }
      });
    }, { passive: true });

    // Registered after the programme's own resize handling, so this runs
    // last in each frame and has the final word on where the page sits.
    window.addEventListener('resize', function () {
      if (!realResize) {
        return;
      }
      if (!placeFrozen) {
        placeFrozen = true;
      }
      var held = place;
      window.requestAnimationFrame(function () {
        restorePlace(held);
      });
      window.clearTimeout(placeTimer);
      placeTimer = window.setTimeout(function () {
        restorePlace(held);
        placeFrozen = false;
        place = readPlace();
      }, 350);
    });
    place = readPlace();
  }


  /* ========================================================================
     9d. TOOLS ON DEMAND
     The CV review, interview practice and strengths profile are large and
     most visits never open them, so their scripts and styles are fetched
     the first time one is wanted (or once Get Job Ready comes near), not
     with the page. A click on an opener before then waits for the files,
     then goes through as normal.

     The tools write per-element values (a bar's width, a ring's score) as
     data-css="..." in their markup; they are applied here through the
     CSSOM, so no style="" attribute is ever parsed from HTML.
     ======================================================================== */

  function applyDataCss(root) {
    var list = root.querySelectorAll ? root.querySelectorAll('[data-css]') : [];
    var all = root.hasAttribute && root.hasAttribute('data-css') ? [root] : [];
    Array.prototype.push.apply(all, list);
    all.forEach(function (el) {
      el.getAttribute('data-css').split(';').forEach(function (decl) {
        var at = decl.indexOf(':');
        if (at < 1) {
          return;
        }
        var prop = decl.slice(0, at).trim();
        // A value the tool has already set itself (an animation under way)
        // is left alone.
        if (!el.style.getPropertyValue(prop)) {
          el.style.setProperty(prop, decl.slice(at + 1).trim());
        }
      });
      el.removeAttribute('data-css');
    });
  }

  function initDataCss() {
    if (!('MutationObserver' in window)) {
      return;
    }
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (node) {
          if (node.nodeType === 1) {
            applyDataCss(node);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  var TOOLS = {
    cv: { opener: '[data-cv-open]', file: 'cv.min.js' },
    interview: { opener: '[data-ivw-open]', file: 'interview.min.js' },
    profile: { opener: '[data-qnw-open]', file: 'profile.min.js' }
  };
  // Paths follow wherever this script was loaded from.
  var SCRIPT_BASE = (function () {
    var me = document.currentScript || document.querySelector('script[src*="main"]');
    return me ? me.src.replace(/[^/]*$/, '') : '../js/';
  }());
  var STYLE_BASE = SCRIPT_BASE + '../css/';
  var toolFetch = {};
  var toolReady = {};

  function fetchOnce(key, make) {
    if (!toolFetch[key]) {
      toolFetch[key] = make().catch(function (err) {
        // Let a later click try again (a dropped connection, say).
        delete toolFetch[key];
        throw err;
      });
    }
    return toolFetch[key];
  }

  function toolStyles() {
    return fetchOnce('styles', function () {
      return new Promise(function (resolve, reject) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = STYLE_BASE + 'tools.min.css';
        link.onload = resolve;
        link.onerror = function () {
          link.remove();
          reject(new Error('tools.min.css'));
        };
        document.head.appendChild(link);
      });
    });
  }

  function loadTool(name) {
    return fetchOnce(name, function () {
      var script = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = SCRIPT_BASE + TOOLS[name].file;
        s.onload = resolve;
        s.onerror = function () {
          s.remove();
          reject(new Error(TOOLS[name].file));
        };
        document.body.appendChild(s);
      });
      return Promise.all([toolStyles(), script]).then(function () {
        toolReady[name] = true;
      });
    });
  }

  // A short message at the foot of the screen (a tool that failed to load).
  var toastTimer = 0;
  function toolToast(text) {
    var el = document.querySelector('.page-toast');
    if (!el) {
      el = document.createElement('p');
      el.className = 'page-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('is-shown');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('is-shown');
    }, 5000);
  }

  /* Coming back to a tool you have used: the card shows where you got to
     (read from this browser only, the same saved data the tool itself
     uses) and the button says "Continue". Refreshed when a tool closes. */
  function initToolProgress() {
    var cards = {
      interview: document.querySelector('[data-tool="interview"]'),
      strengths: document.querySelector('[data-tool="strengths"]')
    };
    var original = {};
    Object.keys(cards).forEach(function (k) {
      var card = cards[k];
      if (!card) {
        return;
      }
      var pill = card.querySelector('.tool__time span');
      var btn = card.querySelector('.tool__btn');
      original[k] = { pill: pill ? pill.textContent : '', btn: btn ? btn.firstChild.textContent : '' };
    });

    function read(key) {
      try {
        return JSON.parse(window.localStorage.getItem(key) || 'null');
      } catch (e) {
        return null;
      }
    }

    function set(k, pillText, btnText) {
      var card = cards[k];
      if (!card) {
        return;
      }
      var pill = card.querySelector('.tool__time span');
      var btn = card.querySelector('.tool__btn');
      if (pill) {
        pill.textContent = pillText || original[k].pill;
      }
      if (btn && btn.firstChild && btn.firstChild.nodeType === 3) {
        btn.firstChild.textContent = (btnText || original[k].btn.trim()) + ' ';
      }
      card.classList.toggle('has-progress', !!pillText);
    }

    function refresh() {
      var profile = read('mtw-profile-v1');
      var answered = profile && profile.answers ? Object.keys(profile.answers).length : 0;
      if (profile && typeof profile.done === 'number' && profile.done >= (profile.total || 7)) {
        set('strengths', 'Profile ready', 'View your profile');
      } else if (answered) {
        set('strengths', typeof profile.done === 'number' ? profile.done + ' of ' + (profile.total || 7) + ' done' : 'In progress',
          'Continue your profile');
      } else {
        set('strengths', '', '');
      }
      var saving = false;
      try {
        saving = window.localStorage.getItem('mtw-interview-save') === '1';
      } catch (e) { /* not saved */ }
      var iv = saving ? read('mtw-interview-v1') : null;
      var last = iv && iv.history && iv.history.length ? iv.history[iv.history.length - 1] : null;
      if (last && typeof last.score === 'number') {
        set('interview', 'Scored ' + last.score, 'Practise again');
      } else {
        set('interview', '', '');
      }
    }

    refresh();
    ['[data-ivw]', '[data-qnw]'].forEach(function (sel) {
      var d = document.querySelector(sel);
      if (d) {
        d.addEventListener('close', refresh);
      }
    });
    window.addEventListener('storage', refresh);
  }

  function initTools() {
    initDataCss();
    initToolProgress();

    // Capture phase, so this runs before the tool's own click handler
    // (which only exists once its script has arrived).
    document.addEventListener('click', function (e) {
      if (!e.target.closest) {
        return;
      }
      Object.keys(TOOLS).some(function (name) {
        var opener = e.target.closest(TOOLS[name].opener);
        if (!opener || toolReady[name]) {
          return false;
        }
        e.preventDefault();
        e.stopImmediatePropagation();
        opener.setAttribute('aria-busy', 'true');
        loadTool(name).then(function () {
          opener.removeAttribute('aria-busy');
          opener.click();
        }, function () {
          opener.removeAttribute('aria-busy');
          toolToast('That tool could not load. Check your connection and try again.');
        });
        return true;
      });
    }, true);

    // Pointing at or tabbing to an opener starts the download early.
    function warm(e) {
      if (!e.target.closest) {
        return;
      }
      Object.keys(TOOLS).forEach(function (name) {
        if (!toolReady[name] && e.target.closest(TOOLS[name].opener)) {
          loadTool(name).catch(function () {});
        }
      });
    }
    document.addEventListener('pointerover', warm, { passive: true });
    document.addEventListener('focusin', warm);

    // Get Job Ready coming into reach: fetch all three while the reader is
    // still looking at the section before it.
    var ready = document.getElementById('job-ready');
    if (ready && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) {
          io.disconnect();
          Object.keys(TOOLS).forEach(function (name) {
            loadTool(name).catch(function () {});
          });
        }
      }, { rootMargin: '100% 0px' });
      io.observe(ready);
    }
  }


  /* ========================================================================
     9e. LOOPING DECORATION ONLY ON SCREEN
     Swaying leaves, bobbing discs and twinkling stars loop for ever. Off
     screen they are paused (see .is-offscreen in style.css), so the
     browser is not redrawing parts of the page nobody can see.
     ======================================================================== */

  function initLoopPause() {
    if (!('IntersectionObserver' in window)) {
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.classList.toggle('is-offscreen', !en.isIntersecting);
      });
    }, { rootMargin: '25% 0px' });
    Array.prototype.forEach.call(
      document.querySelectorAll('#main > section, #main > div, body > footer'),
      function (el) { io.observe(el); }
    );
  }


  /* ========================================================================
     10. INIT
     ======================================================================== */

  function start() {
    sizeSeen.h = screenH();
    initTools();
    initLoopPause();
    initMenu();
    initChoreography();
    initReveals();
    initCurrent();
    initExplore();
    initSkills();
    initProgramme();
    initReady();
    initFaq();
    initNext();
    initArrivals();
    initReturn();
    initKeepPlace();
  }

  // Let the first screen paint before the page's behaviour is wired up,
  // so phones show the hero sooner. Coming back to a saved place (from
  // the privacy policy or disclaimer) starts at once instead, so the page
  // never flashes the top before jumping back.
  var nav = window.performance && performance.getEntriesByType ?
    performance.getEntriesByType('navigation')[0] : null;
  initJoinNavigation();
  if (location.hash === '#back' || (nav && nav.type === 'back_forward')) {
    start();
  } else {
    window.requestAnimationFrame(function () {
      window.setTimeout(start, 0);
    });
  }

}());

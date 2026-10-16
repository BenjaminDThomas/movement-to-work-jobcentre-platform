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
     2. Intro       one scroll-driven timeline across the pinned stage:
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

   Motion only runs when the pinned layout is in force: no preference for
   reduced motion and a screen at least 30em tall (the same query as
   grid.css section 12). It re-checks live if either changes.

   Contents
     1. Setup and helpers
     2. Menu
     3. Scroll choreography
     4. Reveals
     5. Current section
     6. Get to know
     7. Skills
     8. Init
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     1. SETUP AND HELPERS
     ======================================================================== */

  var doc = document.documentElement;
  var pinQuery = window.matchMedia(
    '(prefers-reduced-motion: no-preference) and (min-height: 30em)'
  );
  var wideQuery = window.matchMedia(
    '(min-width: 56em) and (min-aspect-ratio: 5/4) and (min-height: 34em)'
  );

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

  function openMenu() {
    if (menuOpen) {
      return;
    }
    menuOpen = true;
    setMenuOrigin();
    menu.scrollTop = 0;
    menu.classList.add('is-open');
    doc.classList.add('menu-open');
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
    closeMenu(!target);

    if (!target) {
      // Sections still to come in the next build stage.
      return;
    }

    // Let the page unlock before scrolling, then move focus with it.
    window.requestAnimationFrame(function () {
      target.scrollIntoView({ behavior: pinQuery.matches ? 'smooth' : 'auto' });
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
      if (window.history && history.replaceState) {
        history.replaceState(null, '', '#' + id);
      }
    });
  }

  /* --- Moving highlight -------------------------------------------------
     One yellow stroke at a time: on the current page by default, on the
     row under the pointer or keyboard focus otherwise. */
  var menuNav = document.querySelector('[data-menu-nav]');

  function menuLinks() {
    return Array.prototype.slice.call(menuNav.querySelectorAll('.menu__link'));
  }

  function lightMenu(link) {
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
  }

  function initMenuHighlight() {
    if (!menuNav) {
      return;
    }
    menuNav.addEventListener('mouseover', function (event) {
      var link = event.target.closest('.menu__link');
      if (link) {
        lightMenu(link);
      }
    });
    // Moving off the list without choosing always returns the stroke to
    // the page you are on.
    menuNav.addEventListener('mouseleave', function () {
      lightMenu(null);
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

    document.addEventListener('keydown', function (event) {
      if (!menuOpen) {
        return;
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

  function updateIntro(vh) {
    if (!intro) {
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
  var HOLD = 0.32;      // screens of stillness before each hand-over
  var MOVE = 0.88;      // screens the slide-up itself takes

  function updateScenes(vh) {
    if (!journey || !scenes.length) {
      return;
    }
    var rect = journey.getBoundingClientRect();
    var d = -rect.top / vh;            // screens scrolled into the track

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
      scene.style.setProperty('--enter', (i === 0 ? 0 : 1 - inn).toFixed(4));
      scene.style.setProperty('--in', inn.toFixed(4));
      scene.style.setProperty('--out', out.toFixed(4));

      // The photograph keeps drifting upwards for as long as the scene
      // is on screen: from arriving, through its hold, until covered.
      var life = clamp((inn + out) / 2, 0, 1);
      scene.style.setProperty('--drift', ((0.5 - life) * 14).toFixed(3));

      scene.classList.toggle('is-active', inn > 0.55 && out < 0.9);
    });
  }

  var stage = document.querySelector('.intro__stage');
  var scrolled = null;

  /** The fixed corners tuck in once the hero is behind you. */
  function updateScrolled() {
    var on = window.scrollY > window.innerHeight * 0.4;
    if (on !== scrolled) {
      scrolled = on;
      doc.classList.toggle('is-scrolled', on);
    }
  }

  function update() {
    ticking = false;
    updateScrolled();
    if (!active) {
      return;
    }
    var vh = window.innerHeight;
    updateIntro(vh);
    updateScenes(vh);
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
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
    scenes.forEach(function (scene) {
      scene.style.removeProperty('--in');
      scene.style.removeProperty('--out');
      scene.style.removeProperty('--drift');
      scene.style.removeProperty('--enter');
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

  /** The student drifts a little against the room behind her as the
   *  pointer moves. Mouse and pen only, and only with motion allowed. */
  function initParallax() {
    if (!stage) {
      return;
    }
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    var queued = false;
    var px = 0;
    var py = 0;
    window.addEventListener('pointermove', function (event) {
      if (!fine.matches || !pinQuery.matches || event.pointerType === 'touch') {
        return;
      }
      px = (event.clientX / window.innerWidth) * 2 - 1;
      py = (event.clientY / window.innerHeight) * 2 - 1;
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(function () {
          queued = false;
          stage.style.setProperty('--px', px.toFixed(3));
          stage.style.setProperty('--py', py.toFixed(3));
        });
      }
    }, { passive: true });
  }

  function initChoreography() {
    initParallax();
    setMotion();
    listen(pinQuery, setMotion);
    listen(wideQuery, requestUpdate);
    window.addEventListener('scroll', requestUpdate, { passive: true });
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
        el.classList.add('is-in');
      });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
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

    function light(key) {
      cells.forEach(function (cell) {
        cell.classList.remove('is-lit', 'is-lit-yellow');
      });
      cw.classList.toggle('has-choice', !!key);
      if (!key) {
        return;
      }
      cellsFor(key).forEach(function (cell, i) {
        cell.style.setProperty('--k', i);
        cell.classList.add('is-lit');
        if (key === 'mtw' && wordsOf(cell).length > 1) {
          cell.classList.add('is-lit-yellow');
        }
      });
    }

    function hover(key) {
      cells.forEach(function (cell) {
        cell.classList.toggle('is-hover', !!key && wordsOf(cell).indexOf(key) !== -1);
      });
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

    // Grid: pointer users can click any letter of a word.
    cw.addEventListener('click', function (event) {
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

    cw.addEventListener('mouseover', function (event) {
      var cell = event.target.closest('[data-word]');
      hover(cell ? wordsOf(cell)[wordsOf(cell).length - 1] : null);
    });
    cw.addEventListener('mouseleave', function () {
      hover(null);
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

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    function pieceFor(key) {
      return list.querySelector('[data-skill="' + key + '"]');
    }

    function nameOf(key) {
      return pieceFor(key).querySelector('.piece__label').textContent;
    }

    function colours(key) {
      var piece = pieceFor(key);
      return {
        piece: piece.style.getPropertyValue('--piece'),
        ink: piece.style.getPropertyValue('--ink')
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
      var to = slots[slotIndex].getBoundingClientRect();
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

      if (d.target >= 0) {
        var to = slots[d.target].getBoundingClientRect();
        var anim = d.ghost.animate([
          { transform: d.ghost.style.transform },
          { transform: 'translate3d(' + to.left + 'px,' + to.top + 'px,0) scale(' + (to.width / d.rect.width) + ',' + (to.height / d.rect.height) + ')' }
        ], { duration: 320, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'forwards' });
        anim.onfinish = function () {
          d.ghost.remove();
          place(d.key, d.target);
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
     8. INIT
     ======================================================================== */

  initMenu();
  initChoreography();
  initReveals();
  initCurrent();
  initExplore();
  initSkills();

}());

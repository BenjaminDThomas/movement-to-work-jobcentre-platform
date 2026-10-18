/* ==========================================================================
   MOVEMENT TO WORK: DISCOVER YOUR STRENGTHS
   Seven short questionnaires and a personal profile, in a full-screen
   dialog built like the CV review and interview practice:
     - Dashboard        greeting, overall progress and the eight-stage journey
     - Questionnaires   one question at a time, saved as you go
     - Summary          the profile (questionnaire-profile.js)

   Answers are saved automatically in this browser (localStorage) and
   nowhere else. They are never put in a URL, logged or sent anywhere.
   The reader can export a printable copy or delete everything.

   Sections
     1. Helpers     3. Navigation       5. Summary
     2. Storage     4. Questionnaires   6. Report and links   7. Events
   ========================================================================== */

(function () {
  'use strict';

  var D = window.MTWQD;
  var P = window.MTWQP;
  var dialog = document.querySelector('[data-qnw]');
  if (!D || !P || !dialog) {
    return;
  }

  var pageEl = dialog.querySelector('[data-qnw-page]');
  var main = dialog.querySelector('[data-qnw-main]');
  var tab = dialog.querySelector('[data-qnw-tab]');
  var scrim = dialog.querySelector('[data-qnw-scrim]');
  var toast = dialog.querySelector('[data-qnw-toast]');
  var live = dialog.querySelector('[data-qnw-live]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var KEY = 'mtw-profile-v1';
  var JOURNEY_ICONS = ['i-target', 'i-muscle', 'i-walk', 'i-cap', 'i-briefcase', 'i-medal', 'i-key', 'i-user'];

  var state = {
    page: 'dashboard',
    opener: null,
    answers: {},
    actions: {},
    name: '',
    stage: 0,          // the questionnaire on screen
    index: 0,          // the question on screen (or the stage's length for its results)
    tab: 'strengths',
    stored: true       // false when the browser will not let us save
  };


  /* ------------------------------------------------------------------------
     1. HELPERS
     ------------------------------------------------------------------------ */

  function $(sel, root) {
    return (root || dialog).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || dialog).querySelectorAll(sel));
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(id, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true" focusable="false"><use href="#' + id + '" /></svg>';
  }

  function say(text) {
    live.textContent = '';
    window.setTimeout(function () { live.textContent = text; }, 30);
  }

  function showToast(html) {
    toast.innerHTML = html;
    toast.hidden = false;
    toast.classList.remove('is-out');
    window.clearTimeout(showToast.t);
    showToast.t = window.setTimeout(function () {
      toast.classList.add('is-out');
      window.setTimeout(function () { toast.hidden = true; }, 320);
    }, 3000);
  }

  function head(title, lead) {
    return '<header class="ivh"><h2 class="ivh__title">' + title + '</h2>' + (lead ? '<p class="ivh__lead">' + lead + '</p>' : '') + '</header>';
  }

  function ring(percent, label) {
    return '<div class="ivr ivr--lg qnr" data-css="--p: 0" data-qnr="' + percent + '" role="img" aria-label="' + label + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ivr__bg" cx="60" cy="60" r="48" /><circle class="ivr__fg" cx="60" cy="60" r="48" pathLength="100" /></svg>' +
      '<span class="ivr__num" aria-hidden="true"><b><span data-qnr-num>0</span>%</b><small>Complete</small></span></div>';
  }

  function animateRings(instant) {
    $$('[data-qnr]', pageEl).forEach(function (r) {
      var target = parseInt(r.getAttribute('data-qnr'), 10);
      var num = $('[data-qnr-num]', r);
      if (reduce.matches || instant) {
        r.style.setProperty('--p', target);
        num.textContent = target;
        return;
      }
      var start = null;
      function frame(now) {
        if (start === null) {
          start = now;
        }
        var t = Math.min(1, (now - start) / 900);
        var e = 1 - Math.pow(1 - t, 3);
        r.style.setProperty('--p', (target * e).toFixed(1));
        num.textContent = Math.round(target * e);
        if (t < 1) {
          window.requestAnimationFrame(frame);
        }
      }
      window.requestAnimationFrame(frame);
    });
  }

  function profile() {
    return P.profile(state.answers);
  }


  /* ------------------------------------------------------------------------
     2. STORAGE
     Everything lives under one key, with a version number, so a future
     change to the questions can never break what someone already saved
     (unknown answers are simply dropped by MTWQP.clean).
     ------------------------------------------------------------------------ */

  function load() {
    try {
      var data = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (data && data.v === 1) {
        state.answers = P.clean(data.answers);
        state.actions = data.actions && typeof data.actions === 'object' ? data.actions : {};
        state.name = typeof data.name === 'string' ? data.name.slice(0, 60) : '';
        if (data.pos && typeof data.pos.stage === 'number') {
          state.stage = Math.min(Math.max(0, data.pos.stage), D.STAGES.length - 1);
          state.index = Math.min(Math.max(0, data.pos.index | 0), D.STAGES[state.stage].questions.length);
        }
      }
      window.localStorage.setItem('__mtw', '1');
      window.localStorage.removeItem('__mtw');
    } catch (e) {
      state.stored = false;
    }
  }

  function save() {
    if (!state.stored) {
      return;
    }
    try {
      window.localStorage.setItem(KEY, JSON.stringify({
        v: 1, answers: state.answers, actions: state.actions, name: state.name,
        pos: { stage: state.stage, index: state.index }, saved: new Date().toISOString()
      }));
      flashSaved();
    } catch (e) {
      state.stored = false;
      showToast('<b>Could not save.</b> Your browser’s storage is full or switched off, so answers last until you close the page.');
    }
  }

  function flashSaved() {
    var el = $('[data-qnq-saved]', pageEl);
    if (el) {
      el.classList.remove('is-on');
      void el.offsetWidth;
      el.classList.add('is-on');
    }
  }

  function deleteAll() {
    state.answers = {};
    state.actions = {};
    state.name = '';
    state.stage = 0;
    state.index = 0;
    try {
      window.localStorage.removeItem(KEY);
    } catch (e) { /* nothing stored */ }
    renderSide();
    go('dashboard');
    showToast('<b>Profile deleted.</b> All your answers and results have been removed from this browser.');
  }


  /* ------------------------------------------------------------------------
     3. NAVIGATION
     ------------------------------------------------------------------------ */

  function renderSide() {
    var pr = P.progress(state.answers);
    $('[data-qnw-stat]').textContent = pr.done + ' of 7 questionnaires done';
    $('[data-qnw-bar]').style.width = pr.percent + '%';
    $$('[data-qnw-go]').forEach(function (b) {
      if (b.getAttribute('data-qnw-go') === state.page) {
        b.setAttribute('aria-current', 'page');
      } else {
        b.removeAttribute('aria-current');
      }
    });
  }

  function go(page, opts) {
    opts = opts || {};
    state.page = page;
    renderSide();
    pageEl.innerHTML = page === 'dashboard' ? dashboardHtml() : page === 'questions' ? questionsHtml() : summaryHtml();
    // Choosing an answer redraws the page in place: no entrance animation.
    pageEl.classList.remove('is-entering');
    if (!opts.quiet) {
      void pageEl.offsetWidth;
      pageEl.classList.add('is-entering');
    }
    if (!opts.keepScroll) {
      main.scrollTop = 0;
    }
    setDrawer(false);
    animateRings(opts.quiet);
    var target = opts.focus ? $(opts.focus, pageEl) : pageEl.querySelector('h2');
    if (target && !opts.first) {
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: true });
    } else if (opts.first) {
      main.focus({ preventScroll: true });
    }
  }

  function setDrawer(open) {
    dialog.classList.toggle('is-menu-open', open);
    tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
    if (open) {
      var cur = $('[data-qnw-go][aria-current]') || $('[data-qnw-go]');
      if (cur) {
        cur.focus();
      }
    }
  }

  function open(opener) {
    state.opener = opener || null;
    document.documentElement.classList.add('has-cvr');
    if (!dialog.open) {
      dialog.showModal();
    }
    go('dashboard', { first: true });
  }

  dialog.addEventListener('close', function () {
    document.documentElement.classList.remove('has-cvr');
    setDrawer(false);
    if (state.opener && state.opener.focus && document.contains(state.opener)) {
      state.opener.focus();
    }
  });


  /* --- Dashboard ------------------------------------------------------------ */

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  }

  function journeyHtml(pr, current) {
    var steps = pr.stages.map(function (s, i) {
      var word = s.status === 'done' ? 'Completed' : s.status === 'progress' ? 'In progress' : 'Not started';
      return '<li class="qnj__item is-' + s.status + (current === i ? ' is-current' : '') + '">' +
        '<button type="button" data-qnw-stage="' + i + '"' + (current === i ? ' aria-current="step"' : '') + '>' +
          '<span class="qnj__n" aria-hidden="true">' + (i + 1) + '</span>' +
          '<span class="qnj__ico" aria-hidden="true">' + icon(JOURNEY_ICONS[i]) + '</span>' +
          '<span class="qnj__name">' + esc(s.name) + '</span>' +
          '<span class="qnj__status">' + (s.status === 'done' ? icon('i-check') : '') + word +
            (s.status === 'progress' ? '<span class="visually-hidden">, ' + s.requiredDone + ' of ' + s.required + ' questions answered</span>' : '') + '</span>' +
        '</button></li>';
    });
    steps.push('<li class="qnj__item qnj__item--final is-' + (pr.complete ? 'done' : 'todo') + (current === 7 ? ' is-current' : '') + '">' +
      '<button type="button" data-qnw-go="summary">' +
        '<span class="qnj__n" aria-hidden="true">8</span>' +
        '<span class="qnj__ico" aria-hidden="true">' + icon(JOURNEY_ICONS[7]) + '</span>' +
        '<span class="qnj__name">Your profile complete</span>' +
        '<span class="qnj__status">' + (pr.complete ? icon('i-check') + 'Ready to view' : pr.done ? 'Partial summary' : 'Not started') + '</span>' +
      '</button></li>');
    return '<ol class="qnj" aria-label="Your questionnaire journey">' + steps.join('') + '</ol>';
  }

  function dashboardHtml() {
    var pr = P.progress(state.answers);
    var lead = pr.complete ? 'Your profile is ready! Explore your strengths, opportunities and personalised next steps.' :
      pr.started ? 'You’re making progress! Continue building your profile to discover more about yourself.' :
        'You haven’t started your profile yet. Let’s discover your strengths and take the next step towards your future.';
    var cta = pr.complete ? ['Review your goals', 'data-qnw-stage="0"'] :
      pr.started ? ['Continue where you left off', 'data-qnw-resume'] : ['Start your profile', 'data-qnw-stage="0"'];
    var g = P.profile(state.answers).goals;
    return '<div class="qnd">' +
      head(greeting(), lead) +
      '<div class="ivd__grid"><div class="ivd__main">' +
      '<section class="qng" aria-labelledby="qng-title">' +
        '<div class="qng__body">' +
          '<h3 class="ivs__label" id="qng-title">Your goals</h3>' +
          (g ? '<p class="ivs__text"><b>Your main goal: ' + esc(g.title.toLowerCase()) + '.</b> ' + esc(g.text) + '</p>' :
            '<p class="ivs__text">Start by setting some clear, actionable goals you want to achieve as you move from education to employment.</p>') +
          '<button class="ivbtn ivbtn--wide" type="button" ' + cta[1] + '>' + cta[0] + icon('i-arrow') + '</button>' +
        '</div>' +
        '<div class="qng__progress">' +
          '<p class="qng__ptitle">Overall progress</p>' +
          ring(pr.percent, 'Profile ' + pr.percent + ' per cent complete: ' + pr.done + ' of 7 questionnaires done') +
          '<p class="qng__pnote">' + pr.done + ' of 7 questionnaires done</p>' +
        '</div>' +
      '</section>' +
      (pr.complete ? '<section class="qnready"><h3>Your profile is ready!</h3><p>You’ve explored your goals, strengths, preferences and development opportunities. Now let’s look at what your answers tell you.</p>' +
        '<button class="ivbtn" type="button" data-qnw-go="summary">View your personal profile' + icon('i-arrow') + '</button></section>' : '') +
      '<h3 class="ivsec">Your <span>questionnaire journey</span></h3>' +
      '<p class="qnd__hint">Each takes about two minutes. Work through them in order, or start wherever you like: your answers save as you go.</p>' +
      journeyHtml(pr, -1) +
      '</div>' +
      '<aside class="ivd__aside" aria-label="About your profile">' +
        '<section class="ivside"><h3 class="ivside__title">What you’ll get</h3>' +
          '<ul class="qnlist"><li>' + icon('i-muscle') + 'Your strengths, in your own words</li><li>' + icon('i-target') + 'Areas to develop, with reasons</li>' +
          '<li>' + icon('i-key') + 'Career areas worth exploring</li><li>' + icon('i-check') + 'A short action plan you can tick off</li></ul>' +
          '<p class="ivside__text">It reflects what you tell us. It is not a test, and there are no wrong answers.</p></section>' +
        dataHtml() +
      '</aside></div>' +
    '</div>';
  }

  function dataHtml() {
    var any = Object.keys(state.answers).length > 0;
    return '<section class="ivside ivpriv qndata" aria-labelledby="qndata-title">' +
      '<h3 class="ivpriv__title" id="qndata-title">' + icon('i-lock') + 'Your data</h3>' +
      (state.stored ?
        '<p>Your answers are saved automatically in this browser on this device, and nowhere else. Nothing is sent to us. Clearing your browsing data will remove them, and they are not encrypted, so use a device you trust.</p>' :
        '<p>Your browser is not allowing storage, so your answers will only last until you close this page.</p>') +
      (any ? '<div class="qndata__btns"><button class="ivbtn ivbtn--light ivbtn--sm" type="button" data-qnw-report>' + icon('i-print') + 'Download or print</button>' +
        '<button class="ivbtn ivbtn--ghost ivbtn--sm" type="button" data-qnw-delete>' + icon('i-trash') + 'Delete my profile</button></div>' : '') +
    '</section>';
  }


  /* ------------------------------------------------------------------------
     4. QUESTIONNAIRES
     ------------------------------------------------------------------------ */

  function questionsHtml() {
    var pr = P.progress(state.answers);
    var st = D.STAGES[state.stage];
    var n = st.questions.length;
    var body = state.index >= n ? stageDoneHtml(st, pr) : questionHtml(st, st.questions[state.index], state.index, n);
    return '<div class="qnq">' +
      head('Small steps, big opportunities', 'Complete the questionnaires below to build your profile, understand your strengths and spot areas for improvement.') +
      journeyHtml(pr, state.stage) +
      body +
    '</div>';
  }

  function questionHtml(st, q, i, n) {
    var a = state.answers[q.id];
    var answerHtml;
    if (q.type === 'single' || q.type === 'multi') {
      var multi = q.type === 'multi';
      var chosen = multi ? (a || []) : [a];
      var full = multi && chosen.length >= q.max;
      answerHtml = '<div class="qncards' + (q.options.length > 8 ? ' qncards--many' : '') + '" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="qnq-text" aria-describedby="qnq-help">' +
        q.options.map(function (o, k) {
          var on = chosen.indexOf(o.v) !== -1;
          var disabled = full && !on;
          return '<button type="button" class="qncard' + (on ? ' is-on' : '') + '" role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '"' +
            (disabled ? ' aria-disabled="true"' : '') + ' data-qnq-opt="' + esc(o.v) + '"' +
            (!multi ? ' tabindex="' + ((on || (!a && k === 0)) ? 0 : -1) + '"' : '') + '>' +
            '<span class="qncard__tick" aria-hidden="true">' + icon('i-check') + '</span>' +
            '<span class="qncard__label">' + esc(o.label) + '</span>' +
            (o.desc ? '<span class="qncard__desc">' + esc(o.desc) + '</span>' : '') +
          '</button>';
        }).join('') + '</div>' +
        (multi ? '<p class="qnq__count" data-qnq-count aria-live="polite">' + chosen.length + ' of ' + q.max + ' selected' + (full ? '. Unselect one to choose another.' : '') + '</p>' : '');
    } else if (q.type === 'scale') {
      answerHtml = '<div class="qnscale" role="radiogroup" aria-labelledby="qnq-text">' + q.scale.map(function (label, k) {
        var v = k + 1;
        var on = a === v;
        return '<button type="button" class="qnscale__opt' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on + '" data-qnq-opt="' + v + '" tabindex="' + ((on || (!a && k === 0)) ? 0 : -1) + '">' +
          '<b>' + v + '</b><span>' + esc(label) + '</span></button>';
      }).join('') + '</div>';
    } else {
      answerHtml = '<label class="visually-hidden" for="qnq-textarea">Your answer</label>' +
        '<textarea id="qnq-textarea" class="ivp__text qnq__textarea" rows="4" maxlength="600" data-qnq-text placeholder="' + esc(q.placeholder || '') + '">' + esc(a || '') + '</textarea>' +
        '<p class="qnq__note">Only you will see this. It stays in this browser.</p>';
    }
    return '<section class="qnq__card" aria-labelledby="qnq-text">' +
      '<div class="qnq__top">' +
        '<p class="qnq__pill">Question ' + (i + 1) + ' of ' + n + '</p>' +
        '<div class="qnq__bar" role="progressbar" aria-label="' + esc(st.name) + ' progress" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + i + '"><span data-css="width: ' + ((i + 1) / n * 100) + '%"></span></div>' +
        '<p class="qnq__saved" data-qnq-saved aria-hidden="true">' + icon('i-check') + 'Saved</p>' +
      '</div>' +
      '<p class="qnq__stage">' + icon(JOURNEY_ICONS[state.stage]) + esc(st.name) + (i === 0 ? '<span> · ' + esc(st.intro) + '</span>' : '') + '</p>' +
      '<h3 class="qnq__text" id="qnq-text" tabindex="-1">' + esc(q.text) + '</h3>' +
      '<p class="qnq__help" id="qnq-help">' + (q.help ? esc(q.help) : '') + ' <span class="qnq__req">' + (q.optional ? 'Optional' : 'Required') + '</span></p>' +
      answerHtml +
      '<p class="qnq__error" data-qnq-error role="alert"></p>' +
      '<div class="qnq__nav">' +
        '<button class="ivbtn ivbtn--sm qnq__prev" type="button" data-qnq-prev' + (i === 0 && state.stage === 0 ? ' disabled' : '') + '>' + icon('i-arrow', 'qnq__back') + 'Previous</button>' +
        (q.optional ? '<button class="ivlink" type="button" data-qnq-skip>Skip this question</button>' : '') +
        '<button class="ivbtn ivbtn--sm" type="button" data-qnq-next>' + (i === n - 1 ? 'Finish' : 'Next') + icon('i-arrow') + '</button>' +
      '</div>' +
    '</section>';
  }

  /** The end of a questionnaire: what it showed, then where to go next. */
  function stageDoneHtml(st, pr) {
    var p = profile();
    var stp = pr.stages[state.stage];
    var nextIdx = pr.stages.map(function (s, i) { return s.status !== 'done' && i !== state.stage ? i : -1; }).filter(function (i) { return i !== -1; });
    var after = nextIdx.filter(function (i) { return i > state.stage; })[0];
    var nextStage = after != null ? after : nextIdx[0];
    var missing = stp.required - stp.requiredDone;
    var result = stageResultHtml(st.key, p);
    var answers = st.questions.map(function (q, i) {
      var a = state.answers[q.id];
      var shown = a == null ? '<em>Not answered</em>' : q.type === 'scale' ? a + ' out of 5 (' + esc(q.scale[a - 1]) + ')' :
        q.type === 'text' ? esc(a) : esc((Array.isArray(a) ? a : [a]).map(function (v) { return D.label(q.id, v); }).join(', '));
      return '<li><span class="qnans__q">' + esc(q.text) + '</span><span class="qnans__a">' + shown + '</span>' +
        '<button class="ivlink" type="button" data-qnq-edit="' + i + '">Change<span class="visually-hidden">: ' + esc(q.text) + '</span></button></li>';
    }).join('');
    return '<section class="qnq__card qndone" aria-labelledby="qndone-title">' +
      '<h3 class="qndone__title" id="qndone-title" tabindex="-1">' + (missing ? esc(st.name) + ': nearly there' : esc(st.name) + ': done!') + '</h3>' +
      (missing ? '<p class="qndone__warn">' + missing + ' required ' + (missing === 1 ? 'question still needs' : 'questions still need') + ' an answer before this questionnaire is complete.</p>' : '') +
      result +
      '<div class="qndone__btns">' +
        (pr.complete ? '<button class="ivbtn" type="button" data-qnw-go="summary">View your personal profile' + icon('i-arrow') + '</button>' :
          nextStage != null ? '<button class="ivbtn" type="button" data-qnw-stage="' + nextStage + '">Next: ' + esc(D.STAGES[nextStage].name) + icon('i-arrow') + '</button>' : '') +
        (!pr.complete && pr.done ? '<button class="ivbtn ivbtn--light" type="button" data-qnw-go="summary">See my summary so far</button>' : '') +
        '<button class="ivbtn ivbtn--ghost ivbtn--sm" type="button" data-qnw-go="dashboard">Back to dashboard</button>' +
      '</div>' +
      '<details class="qnans"><summary>Review or change your answers</summary><ol>' + answers + '</ol>' +
        '<button class="ivlink qnans__reset" type="button" data-qnq-reset>' + icon('i-refresh') + 'Reset this questionnaire</button></details>' +
    '</section>';
  }

  function stageResultHtml(key, p) {
    var out = '';
    if (key === 'goals' && p.goals) {
      var g = p.goals;
      out = '<h4>Your main goal: ' + esc(g.title.toLowerCase()) + '</h4><p>' + esc(g.text) + '</p>' +
        (g.secondary.length ? '<p><b>Also important to you:</b> ' + esc(g.secondary.join(', ')) + '.</p>' : '') +
        (g.priority ? '<p><b>Your priority right now:</b> ' + esc(g.priority.toLowerCase()) + '.</p>' : '') +
        (g.firstAction ? '<p><b>Your first action:</b> ' + esc(g.firstAction) + '</p>' : '') +
        toolButton(g.tool, g.toolLabel);
    } else if (key === 'strengths') {
      var mine = p.strengths.filter(function (s) { return s.selfIdentified; });
      var picked = (state.answers.s1 || []).map(function (v) { return D.label('s1', v); });
      out = picked.length ? '<h4>Your strongest areas</h4><ul class="qnchips">' + picked.map(function (n) { return '<li>' + icon('i-check') + esc(n) + '</li>'; }).join('') + '</ul>' +
        '<p>' + (mine.length ? 'You see yourself as strong in ' + esc(picked.join(', ').toLowerCase()) + '. ' : '') +
        (state.answers.s7 ? 'You’d like to build on ' + esc(D.label('s7', state.answers.s7).toLowerCase()) + ' next.' : '') + '</p>' : '';
    } else if (key === 'barriers') {
      out = p.barriers.length ? '<h4>Support that could help</h4><ul class="qnsupport">' + p.barriers.map(function (b) {
        return '<li><b>' + esc(b.name) + (b.first ? ' (your first focus)' : '') + '</b><span>' + esc(b.text) + '</span></li>';
      }).join('') + '</ul><p class="qnq__note">These are things to work on, not a reflection of what you can do.</p>' : '<p>Thanks for sharing. Nothing here needs to hold you back.</p>';
    } else if (key === 'learning' && p.learning) {
      out = '<h4>' + esc(p.learning.title) + '</h4><p>Your answers suggest that ' + esc(p.learning.text.charAt(0).toLowerCase() + p.learning.text.slice(1)) + '</p><p>' + esc(p.learning.tip) + '</p>';
    } else if (key === 'work' && p.work) {
      out = '<h4>Your work preferences</h4><p>' + esc(p.work.text) + '</p>' +
        (p.ideal && p.ideal.areas.length ? '<p><b>Areas you might explore:</b> ' + esc(p.ideal.areas.map(function (x) { return x.name; }).join(', ')) + '. These are ideas to look into, not a perfect match.</p>' : '');
    } else if (key === 'confidence' && p.confidence) {
      var c = p.confidence;
      out = '<h4>How you feel right now</h4>' +
        (c.higher.length ? '<p><b>Feeling more confident:</b> ' + esc(c.higher.map(function (r) { return r.name.toLowerCase(); }).join('; ')) + '.</p>' : '') +
        (c.lower.length ? '<p><b>Would like more confidence:</b> ' + esc(c.lower.map(function (r) { return r.name.toLowerCase(); }).join('; ')) + '.</p>' : '') +
        (c.lower.some(function (r) { return r.id === 'c2'; }) ? toolButton('interview', 'Practise interview questions') : '') +
        '<p class="qnq__note">This is how you rated yourself, not a measure of how you will do.</p>';
    } else if (key === 'ideal' && p.ideal) {
      out = '<h4>Your preferred opportunity</h4>' + (p.ideal.summary ? '<p>' + esc(p.ideal.summary) + '</p>' : '') +
        (p.ideal.interests.length ? '<p><b>Interested in:</b> ' + esc(p.ideal.interests.join(', ')) + '.</p>' : '') +
        '<p class="qnq__note">This is an idea to explore, not a definite career match.</p>';
    }
    return out ? '<div class="qnresult">' + out + '</div>' : '';
  }

  function toolButton(tool, label) {
    return tool ? '<button class="ivbtn ivbtn--sm" type="button" data-qnw-tool="' + tool + '">' + esc(label || 'Find out more') + icon('i-arrow') + '</button>' : '';
  }

  function currentQ() {
    var st = D.STAGES[state.stage];
    return state.index < st.questions.length ? st.questions[state.index] : null;
  }

  function setAnswer(q, value) {
    if (value == null || (Array.isArray(value) && !value.length) || value === '') {
      delete state.answers[q.id];
    } else {
      state.answers[q.id] = value;
    }
    state.answers = P.clean(state.answers);
    save();
    renderSide();
  }

  function choose(btn) {
    var q = currentQ();
    if (!q || btn.getAttribute('aria-disabled') === 'true') {
      if (q && q.type === 'multi') {
        say('You can choose up to ' + q.max + '. Unselect one to choose another.');
      }
      return;
    }
    var v = btn.getAttribute('data-qnq-opt');
    if (q.type === 'scale') {
      setAnswer(q, parseInt(v, 10));
    } else if (q.type === 'single') {
      setAnswer(q, v);
    } else {
      var list = (state.answers[q.id] || []).slice();
      var at = list.indexOf(v);
      // "None of these" and "Prefer not to say" stand on their own.
      var alone = ['none', 'prefer'];
      if (at !== -1) {
        list.splice(at, 1);
      } else if (list.length < q.max) {
        list = alone.indexOf(v) !== -1 ? [v] : list.filter(function (x) { return alone.indexOf(x) === -1; }).concat([v]);
      }
      setAnswer(q, list);
    }
    var y = main.scrollTop;
    var opt = btn.getAttribute('data-qnq-opt');
    go('questions', { keepScroll: true, quiet: true, focus: '[data-qnq-opt="' + opt + '"]' });
    main.scrollTop = y;
    $('[data-qnq-error]', pageEl).textContent = '';
  }

  function move(delta, skip) {
    var st = D.STAGES[state.stage];
    var q = currentQ();
    if (q && delta > 0 && !skip && !q.optional && !P.isAnswered(q, state.answers[q.id])) {
      var err = $('[data-qnq-error]', pageEl);
      err.textContent = q.type === 'multi' ? 'Please choose at least one answer to carry on. You can change it later.' :
        'Please choose an answer to carry on. You can change it later.';
      return;
    }
    if (q && q.type === 'text') {
      var box = $('[data-qnq-text]', pageEl);
      setAnswer(q, box ? box.value.trim() : '');
    }
    var next = state.index + delta;
    if (next < 0) {
      if (state.stage > 0) {
        state.stage -= 1;
        state.index = D.STAGES[state.stage].questions.length;
      }
    } else {
      state.index = Math.min(next, st.questions.length);
    }
    save();
    go('questions', { focus: state.index >= D.STAGES[state.stage].questions.length ? '#qndone-title' : '#qnq-text' });
    if (state.index >= D.STAGES[state.stage].questions.length) {
      say(D.STAGES[state.stage].name + ' finished. Your results are below.');
    }
  }

  function openStage(i, index) {
    state.stage = i;
    var pr = P.progress(state.answers).stages[i];
    state.index = index != null ? index : pr.status === 'done' ? D.STAGES[i].questions.length : Math.max(0, pr.firstOpen);
    save();
    go('questions', { focus: state.index >= D.STAGES[i].questions.length ? '#qndone-title' : '#qnq-text' });
  }

  function resume() {
    var pr = P.progress(state.answers);
    var st = pr.stages[state.stage];
    if (st && st.status !== 'done' && state.index < D.STAGES[state.stage].questions.length) {
      go('questions', { focus: '#qnq-text' });
      return;
    }
    var next = pr.next ? pr.stages.indexOf(pr.next) : 0;
    openStage(next);
  }


  /* ------------------------------------------------------------------------
     5. SUMMARY
     ------------------------------------------------------------------------ */

  var TABS = [
    { key: 'strengths', name: 'Your strengths', icon: 'i-muscle' },
    { key: 'develop', name: 'Areas to develop', icon: 'i-alert' },
    { key: 'steps', name: 'Next steps', icon: 'i-walk' },
    { key: 'prefs', name: 'Your preferences', icon: 'i-key' }
  ];

  function summaryHtml() {
    var p = profile();
    var pr = p.progress;
    if (!pr.started) {
      return '<div class="qns">' + head('Your profile summary', 'Your summary builds as you answer the questionnaires.') +
        '<section class="ivs ivs--empty"><div class="ivs__ring-empty" aria-hidden="true">' + icon('i-user') + '</div><div class="ivs__body">' +
        '<h3 class="ivs__label">Nothing here yet</h3><p class="ivs__text">Answer a questionnaire or two and your profile will start to take shape. It only uses your own answers.</p>' +
        '<button class="ivbtn" type="button" data-qnw-stage="0">Start your profile' + icon('i-arrow') + '</button></div></section></div>';
    }
    var partial = !pr.complete;
    return '<div class="qns">' +
      head('Your profile summary', 'Explore your personal profile based on the answers you’ve given. Discover your strengths, areas to develop and practical next steps.') +
      '<div class="ivd__grid"><div class="ivd__main">' +
      '<section class="ivs qns__card" aria-labelledby="qns-title">' +
        ring(pr.percent, 'Profile ' + pr.percent + ' per cent complete') +
        '<div class="ivs__body">' +
          '<h3 class="ivs__label" id="qns-title">' + (partial ? 'Your summary so far' : 'Your profile summary') + '</h3>' +
          '<p class="ivs__text">' + (partial ?
            'This is a partial summary, based only on the ' + pr.done + ' of 7 questionnaires you’ve completed (and any answers so far). It will grow as you finish the rest.' :
            'We’ve used your answers to build a profile that highlights your strengths and areas to develop, with next steps to guide what to do.') + '</p>' +
          '<p class="ivs__meta">' + pr.done + ' of 7 questionnaires completed. 100% means every questionnaire is done, not a perfect score.</p>' +
          (partial && pr.next ? '<button class="ivbtn ivbtn--sm" type="button" data-qnw-resume>Continue: ' + esc(pr.next.name) + icon('i-arrow') + '</button>' : '') +
        '</div>' +
      '</section>' +
      '<section class="qntabs">' +
        '<div class="qntabs__list" role="tablist" aria-label="Your profile">' + TABS.map(function (t) {
          var on = state.tab === t.key;
          return '<button type="button" role="tab" id="qntab-' + t.key + '" aria-controls="qnpanel" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" data-qns-tab="' + t.key + '">' +
            icon(t.icon) + '<span>' + t.name + '</span></button>';
        }).join('') + '</div>' +
        '<div class="qntabs__panel" id="qnpanel" role="tabpanel" aria-labelledby="qntab-' + state.tab + '" tabindex="0">' + panelHtml(state.tab, p) + '</div>' +
      '</section>' +
      '<div class="qns__actions">' +
        '<button class="ivbtn ivbtn--light" type="button" data-qnw-report>' + icon('i-print') + 'Download or print my profile</button>' +
        '<button class="ivbtn ivbtn--ghost ivbtn--sm" type="button" data-qnw-go="questions">' + icon('i-pen') + 'Edit my answers</button>' +
      '</div>' +
      '<p class="qns__note">This profile reflects your own answers. It’s meant to help you explore and plan, not a formal assessment of your skills or suitability for a job.</p>' +
      '</div>' +
      '<aside class="ivd__aside qns__aside" aria-label="Highlights">' + highlightsHtml(p) + idealHtml(p) + dataHtml() + '</aside>' +
      '</div>' +
    '</div>';
  }

  function panelHtml(key, p) {
    if (key === 'strengths') {
      var known = p.strengths.filter(function (s) { return s.tone !== 'none'; });
      var unknown = p.strengths.filter(function (s) { return s.tone === 'none'; });
      return '<h4 class="qnpanel__title">Your strengths at a glance</h4>' +
        (known.length ? '<ul class="qnbars">' + known.map(function (s) {
          return '<li class="qnbar qnbar--' + s.tone + '">' +
            '<span class="qnbar__name">' + esc(s.name) + '</span>' +
            (s.percent != null ? '<span class="qnbar__track" aria-hidden="true"><i data-css="width: ' + s.percent + '%"></i></span><b class="qnbar__pct">' + s.percent + '%<span class="visually-hidden"> self-rated confidence</span></b>' :
              '<span class="qnbar__track qnbar__track--none" aria-hidden="true"></span><b class="qnbar__pct">–</b>') +
            '<span class="qnbar__tag">' + esc(s.tag) + '</span>' +
            '<details class="qnbar__why"><summary>Why?</summary><ul>' + s.evidence.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' +
              (s.basis ? '<p>' + esc(s.basis) + '</p>' : '<p>No rating for this one, so there’s no bar: just what you told us.</p>') + '</details>' +
          '</li>';
        }).join('') + '</ul>' : '<p>Answer the Strengths and Confidence questionnaires to see this.</p>') +
        '<p class="qnpanel__note">Bars show your own confidence ratings (the average of your 1 to 5 answers, as a share of 5). They are not a measured skill score.</p>' +
        (unknown.length ? '<p class="qnpanel__note"><b>Not enough information yet:</b> ' + esc(unknown.map(function (s) { return s.name; }).join(', ')) + '.</p>' : '');
    }
    if (key === 'develop') {
      if (!p.develop.length) {
        return '<h4 class="qnpanel__title">Areas to develop</h4><p>Nothing stands out from your answers so far. As you complete more questionnaires, ideas will appear here.</p>';
      }
      return '<h4 class="qnpanel__title">Areas to develop</h4><ul class="qndev">' + p.develop.slice(0, 6).map(function (d) {
        var stageFor = { interview: 5, cv: 2, applying: 5, communication: 5, time: 1, digital: 1, direction: 6, opportunities: 2, experience: 2, practical: 2 }[d.key];
        return '<li class="qndev__item"><h5>' + esc(d.title) + '</h5>' +
          '<p class="qndev__label">Why we suggested this</p><ul>' + d.evidence.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' +
          '<p class="qndev__label">Why this matters</p><p>' + esc(d.why) + '</p>' +
          '<p class="qndev__label">Suggested action</p><p>' + esc(d.action) + '</p>' +
          '<div class="qndev__btns">' + toolButton(d.tool, d.toolLabel) +
            (stageFor != null ? '<button class="ivlink" type="button" data-qnw-stage="' + stageFor + '" data-qnw-review>Revisit ' + esc(D.STAGES[stageFor].name.toLowerCase()) + '</button>' : '') + '</div></li>';
      }).join('') + '</ul>';
    }
    if (key === 'steps') {
      if (!p.steps.length) {
        return '<h4 class="qnpanel__title">Your next steps</h4><p>Complete the Goals questionnaire and your action plan will appear here.</p>';
      }
      var done = p.steps.filter(function (s) { return state.actions[s.id]; }).length;
      return '<h4 class="qnpanel__title">Your action plan</h4><p class="qnpanel__note">' + done + ' of ' + p.steps.length + ' done. Tick each one off when you’ve done it.</p>' +
        '<ol class="qnsteps">' + p.steps.map(function (s) {
          var on = !!state.actions[s.id];
          return '<li class="qnstep' + (on ? ' is-done' : '') + '">' +
            '<label class="qnstep__check"><input type="checkbox" data-qns-action="' + esc(s.id) + '"' + (on ? ' checked' : '') + '><span aria-hidden="true">' + icon('i-check') + '</span><span class="visually-hidden">Mark "' + esc(s.title) + '" as done</span></label>' +
            '<div><h5>' + esc(s.title) + '</h5><p><b>Why:</b> ' + esc(s.reason) + '</p><p><b>Next step:</b> ' + esc(s.step) + '</p>' + toolButton(s.tool, s.toolLabel) + '</div></li>';
        }).join('') + '</ol>';
    }
    var out = '<h4 class="qnpanel__title">Your preferences</h4>';
    if (p.learning) {
      out += '<div class="qnpref"><h5>' + icon('i-cap') + esc(p.learning.title) + '</h5><p>Your answers suggest that ' + esc(p.learning.text.charAt(0).toLowerCase() + p.learning.text.slice(1)) + '</p>' +
        (p.learning.prefs.length > 1 ? '<p><b>Also helpful for you:</b> ' + esc(p.learning.prefs.slice(1).join(', ')) + '.</p>' : '') +
        (p.learning.feedback ? '<p><b>Feedback that helps:</b> ' + esc(p.learning.feedback.toLowerCase()) + '.</p>' : '') +
        '<p class="qnpanel__note">' + esc(p.learning.tip) + '</p></div>';
    }
    if (p.work) {
      out += '<div class="qnpref"><h5>' + icon('i-briefcase') + 'How you like to work</h5><p>' + esc(p.work.text) + '</p>' +
        (p.work.environments.length ? '<p><b>Settings:</b> ' + esc(p.work.environments.join(', ')) + '.</p>' : '') +
        (p.work.matters ? '<p><b>Matters most:</b> ' + esc(p.work.matters.toLowerCase()) + '.</p>' : '') + '</div>';
    }
    if (p.confidence) {
      out += '<div class="qnpref"><h5>' + icon('i-medal') + 'Your confidence</h5>' +
        '<ul class="qnconf">' + p.confidence.rated.map(function (r) {
          return '<li><span>' + esc(r.name) + '</span><span class="qnconf__dots" aria-hidden="true">' + [1, 2, 3, 4, 5].map(function (k) { return '<i' + (k <= r.value ? ' class="is-on"' : '') + '></i>'; }).join('') + '</span>' +
            '<b>' + esc(r.word.charAt(0).toUpperCase() + r.word.slice(1)) + '</b></li>';
        }).join('') + '</ul><p class="qnpanel__note">Your own ratings, out of 5. They can change quickly with practice.</p></div>';
    }
    if (p.barriers.length) {
      out += '<div class="qnpref"><h5>' + icon('i-walk') + 'Support that could help</h5><ul class="qnsupport">' + p.barriers.map(function (b) {
        return '<li><b>' + esc(b.name) + '</b><span>' + esc(b.text) + '</span></li>';
      }).join('') + '</ul></div>';
    }
    return out === '<h4 class="qnpanel__title">Your preferences</h4>' ? out + '<p>Complete the Learning, Work and Confidence questionnaires to see this.</p>' : out;
  }

  function highlightsHtml(p) {
    if (!p.highlights.length) {
      return '';
    }
    return '<section class="ivside qnhl" aria-labelledby="qnhl-title"><h3 class="ivside__title" id="qnhl-title">Key highlights</h3><ul>' +
      p.highlights.map(function (h) {
        return '<li class="qnhl__item qnhl__item--' + h.tone + '"><span class="qnhl__mark" aria-hidden="true">' + icon(h.tone === 'good' ? 'i-check' : 'i-alert') + '</span>' +
          '<span><span class="visually-hidden">' + (h.tone === 'good' ? 'Strength: ' : h.tone === 'fix' ? 'Priority: ' : 'To develop: ') + '</span>' + esc(h.text) + '</span></li>';
      }).join('') + '</ul><span class="ivq__torn" aria-hidden="true"></span></section>';
  }

  function idealHtml(p) {
    var id = p.ideal;
    if (!id) {
      return '<section class="ivside qnideal"><h3 class="ivside__title">Your ideal opportunity</h3><p class="ivside__text">Complete Work preferences and Your ideal opportunity to see this.</p>' +
        '<button class="ivbtn ivbtn--sm" type="button" data-qnw-stage="6">Your ideal opportunity' + icon('i-arrow') + '</button></section>';
    }
    return '<section class="ivside qnideal" aria-labelledby="qnideal-title"><h3 class="ivside__title" id="qnideal-title">Your ideal opportunity</h3>' +
      (id.summary ? '<p class="qnideal__lead">' + esc(id.summary) + '</p>' : '') +
      '<dl class="qnideal__list">' +
        (id.interests.length ? '<div><dt>Interested in</dt><dd>' + esc(id.interests.join(', ')) + '</dd></div>' : '') +
        (p.work && p.work.environments.length ? '<div><dt>Settings</dt><dd>' + esc(p.work.environments.join(', ')) + '</dd></div>' : '') +
        (p.work && p.work.tasks.length ? '<div><dt>Favourite tasks</dt><dd>' + esc(p.work.tasks.join(', ')) + '</dd></div>' : '') +
        (id.matters.length ? '<div><dt>Matters most</dt><dd>' + esc(id.matters.join(', ')) + '</dd></div>' : '') +
        (id.consider.length ? '<div><dt>Would consider</dt><dd>' + esc(id.consider.join(', ')) + '</dd></div>' : '') +
      '</dl>' +
      (id.areas.length ? '<h4 class="qnideal__sub">Areas you could explore</h4><ul class="qnareas">' + id.areas.map(function (a) {
        return '<li><b>' + esc(a.name) + '</b><span>Because ' + esc(a.why.slice(0, 3).join(', ')) + '.</span></li>';
      }).join('') + '</ul>' : '') +
      '<p class="qnpanel__note">A summary of your preferences to help you explore, not a judgement of what you’re suited to.</p>' +
      '<span class="ivq__torn" aria-hidden="true"></span>' +
    '</section>';
  }


  /* ------------------------------------------------------------------------
     6. REPORT AND LINKS
     The report is built here and opened in a new tab to print or save as
     a PDF. If pop-ups are blocked, it downloads as a web page instead.
     Nothing is uploaded.
     ------------------------------------------------------------------------ */

  function reportHtml(name) {
    var p = profile();
    var pr = p.progress;
    var d = new Date();
    var date = d.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()] + ' ' + d.getFullYear();
    function sec(title, body) {
      return body ? '<section><h2>' + title + '</h2>' + body + '</section>' : '';
    }
    function ul(items) {
      return items.length ? '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '';
    }
    var g = p.goals;
    var body =
      sec('Goals', g ? '<p><b>Main goal:</b> ' + esc(g.title) + '</p>' + (g.secondary.length ? '<p><b>Also important:</b> ' + esc(g.secondary.join(', ')) + '</p>' : '') +
        (g.priority ? '<p><b>Priority:</b> ' + esc(g.priority) + '</p>' : '') + (g.firstAction ? '<p><b>First action:</b> ' + esc(g.firstAction) + '</p>' : '') : '') +
      sec('Self-reported strengths', ul(p.strengths.filter(function (s) { return s.tone !== 'none'; }).map(function (s) {
        return '<b>' + esc(s.name) + '</b>: ' + esc(s.tag) + (s.percent != null ? ' (self-rated confidence ' + s.percent + '%)' : '');
      }))) +
      sec('Areas to develop', ul(p.develop.slice(0, 6).map(function (x) { return '<b>' + esc(x.title) + '</b>: ' + esc(x.evidence.join(' ')) + ' <i>Suggested: ' + esc(x.action) + '</i>'; }))) +
      sec('Learning preferences', p.learning ? '<p>' + esc(p.learning.title) + '. ' + esc(p.learning.text) + '</p>' : '') +
      sec('Work preferences', p.work ? '<p>' + esc(p.work.text) + '</p>' : '') +
      sec('Career interests', p.ideal ? (p.ideal.summary ? '<p>' + esc(p.ideal.summary) + '</p>' : '') +
        (p.ideal.interests.length ? '<p><b>Interested in:</b> ' + esc(p.ideal.interests.join(', ')) + '</p>' : '') +
        ul(p.ideal.areas.map(function (a) { return '<b>' + esc(a.name) + '</b>: because ' + esc(a.why.join(', ')); })) : '') +
      sec('Next steps', ul(p.steps.map(function (s) { return (state.actions[s.id] ? '&#10003; ' : '') + '<b>' + esc(s.title) + '</b>: ' + esc(s.step); })));
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + (name ? esc(name) + ': ' : '') + 'Movement to Work profile</title>' +
      '<style>body{font:15px/1.55 "Inter",Arial,sans-serif;color:#0B3B24;max-width:760px;margin:32px auto;padding:0 24px}' +
      'header{border-bottom:4px solid #FDD114;padding-bottom:14px;margin-bottom:18px}.brand{font-weight:800;font-size:20px}.brand span{color:#0E9F5F}' +
      'h1{font-size:28px;margin:6px 0 2px}h2{font-size:18px;margin:22px 0 6px;color:#033D23;border-bottom:1px solid #DCE5DA;padding-bottom:4px}' +
      'ul{padding-left:20px;margin:6px 0}li{margin:4px 0}.meta{color:#3E5D4A;font-size:13px}.note{margin-top:26px;padding:12px 14px;background:#F2F7EF;border-radius:8px;font-size:13px}' +
      '.print{margin:18px 0;padding:10px 18px;font:inherit;font-weight:700;color:#fff;background:#2F8550;border:0;border-radius:999px;cursor:pointer}@media print{.print{display:none}body{margin:0}}</style></head><body>' +
      '<header><div class="brand">jobcentre<span>plus</span> · Movement to Work</div><h1>' + (name ? esc(name) + '’s profile' : 'My employability profile') + '</h1>' +
      '<p class="meta">Generated on ' + date + ' · ' + pr.done + ' of 7 questionnaires completed' + (pr.complete ? ' (profile complete)' : ' (partial profile)') + '</p></header>' +
      '<button class="print" onclick="window.print()">Print or save as PDF</button>' + body +
      '<p class="note">These are self-reported reflections from the Movement to Work questionnaires, intended to support career exploration and conversations with a Work Coach. They are not a formal assessment. This report was made in your browser and has not been sent anywhere.</p>' +
      '</body></html>';
  }

  function exportReport() {
    var name = window.prompt('Add your name to the report? (Optional. Leave blank for a neutral title.)', state.name || '');
    if (name === null) {
      return;
    }
    state.name = name.trim().slice(0, 60);
    save();
    var html = reportHtml(state.name);
    var w = window.open('', '_blank');
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
    } else {
      var blob = new Blob([html], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'movement-to-work-profile.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      showToast('<b>Report downloaded.</b> Open it to print or save as a PDF.');
    }
  }

  /** Links to the rest of Get Job Ready. */
  function openTool(tool) {
    if (/^stage:/.test(tool)) {
      var key = tool.split(':')[1];
      openStage(D.STAGES.map(function (s) { return s.key; }).indexOf(key));
      return;
    }
    dialog.close();
    if (tool === 'interview') {
      var iv = document.querySelector('[data-ivw-open]');
      if (iv) {
        iv.click();
      }
    } else if (tool === 'cv') {
      var cv = document.querySelector('[data-cv-open]');
      if (cv) {
        cv.click();
      }
    } else {
      var target = document.getElementById(tool === 'skills' ? 'skills' : tool === 'programme' ? 'programme' : 'join');
      if (target) {
        target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }


  /* ------------------------------------------------------------------------
     7. EVENTS
     ------------------------------------------------------------------------ */

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-qnw-open]');
    if (opener) {
      e.preventDefault();
      open(opener);
    }
  });

  dialog.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if (t.closest('[data-qnw-close]')) {
      dialog.close();
    } else if ((el = t.closest('[data-qnq-opt]'))) {
      choose(el);
    } else if ((el = t.closest('[data-qnw-stage]'))) {
      openStage(parseInt(el.getAttribute('data-qnw-stage'), 10), el.hasAttribute('data-qnw-review') ? 0 : null);
    } else if ((el = t.closest('[data-qnw-go]'))) {
      var page = el.getAttribute('data-qnw-go');
      if (page === 'questions' && state.page !== 'questions') {
        resume();
      } else {
        go(page);
      }
    } else if (t.closest('[data-qnw-resume]')) {
      resume();
    } else if (t.closest('[data-qnq-next]')) {
      move(1);
    } else if (t.closest('[data-qnq-prev]')) {
      move(-1);
    } else if (t.closest('[data-qnq-skip]')) {
      move(1, true);
    } else if ((el = t.closest('[data-qnq-edit]'))) {
      state.index = parseInt(el.getAttribute('data-qnq-edit'), 10);
      save();
      go('questions', { focus: '#qnq-text' });
    } else if (t.closest('[data-qnq-reset]')) {
      var st = D.STAGES[state.stage];
      if (window.confirm('Clear your answers to "' + st.name + '"? Your other questionnaires are kept.')) {
        st.questions.forEach(function (q) { delete state.answers[q.id]; });
        state.index = 0;
        save();
        renderSide();
        go('questions', { focus: '#qnq-text' });
        showToast('<b>' + st.name + ' reset.</b> You can answer it again.');
      }
    } else if ((el = t.closest('[data-qns-tab]'))) {
      state.tab = el.getAttribute('data-qns-tab');
      var y = main.scrollTop;
      go('summary', { keepScroll: true, quiet: true, focus: '#qntab-' + state.tab });
      main.scrollTop = y;
    } else if ((el = t.closest('[data-qnw-tool]'))) {
      openTool(el.getAttribute('data-qnw-tool'));
    } else if (t.closest('[data-qnw-report]')) {
      exportReport();
    } else if (t.closest('[data-qnw-delete]')) {
      if (window.confirm('Delete your whole profile? All your answers, results and action plan will be removed from this browser. This cannot be undone.')) {
        deleteAll();
      }
    } else if (t === tab || t.closest('[data-qnw-tab]')) {
      setDrawer(!dialog.classList.contains('is-menu-open'));
    } else if (t === scrim) {
      setDrawer(false);
    }
  });

  dialog.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-qns-action]')) {
      var id = t.getAttribute('data-qns-action');
      if (t.checked) {
        state.actions[id] = true;
      } else {
        delete state.actions[id];
      }
      save();
      var item = t.closest('.qnstep');
      if (item) {
        item.classList.toggle('is-done', t.checked);
      }
      say(t.checked ? 'Marked as done.' : 'Marked as not done.');
    }
  });

  // Written answers save while typing (after a short pause).
  var typing = 0;
  dialog.addEventListener('input', function (e) {
    if (e.target.matches('[data-qnq-text]')) {
      window.clearTimeout(typing);
      var q = currentQ();
      var value = e.target.value;
      typing = window.setTimeout(function () {
        if (q) {
          setAnswer(q, value.trim());
        }
      }, 500);
    }
  });

  // Arrow keys move between radio cards, scale points and tabs.
  dialog.addEventListener('keydown', function (e) {
    var t = e.target;
    if (e.key === 'Escape' && dialog.classList.contains('is-menu-open')) {
      e.preventDefault();
      setDrawer(false);
      tab.focus();
      return;
    }
    var group = t.closest('[role="radiogroup"], [role="tablist"]');
    if (!group || !/^(ArrowRight|ArrowDown|ArrowLeft|ArrowUp|Home|End)$/.test(e.key)) {
      return;
    }
    var items = $$('[role="radio"], [role="tab"]', group);
    var i = items.indexOf(t);
    if (i === -1) {
      return;
    }
    e.preventDefault();
    var next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 :
      (i + (/Right|Down/.test(e.key) ? 1 : -1) + items.length) % items.length;
    items[next].click();
  });

  load();
}());

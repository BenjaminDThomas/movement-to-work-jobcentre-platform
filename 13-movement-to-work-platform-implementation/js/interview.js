/* ==========================================================================
   MOVEMENT TO WORK: INTERVIEW PRACTICE
   A full-screen tool in a dialog, built like the CV review:
     - Dashboard        the latest practice score and a few questions
     - Mock Questions   the 45-question library (interview-questions.js)
     - Assessment       answering: typed, recorded, or spoken as text
     - Results          rule-based feedback (interview-analyser.js)

   Free and local: no account, no backend, no paid service. Recordings stay
   in this browser tab and are never uploaded or kept. Text answers and
   results are only saved on this device if the reader turns that on.

   Sections
     1. Helpers           5. Recording and speech to text
     2. Progress store    6. Pages
     3. Navigation        7. Results and improving answers
     4. Sessions          8. Events
   ========================================================================== */

(function () {
  'use strict';

  var Q = window.MTWIQ;
  var A = window.MTWIA;
  var dialog = document.querySelector('[data-ivw]');
  if (!Q || !A || !dialog) {
    return;
  }

  var pageEl = dialog.querySelector('[data-ivw-page]');
  var main = dialog.querySelector('[data-ivw-main]');
  var tab = dialog.querySelector('[data-ivw-tab]');
  var scrim = dialog.querySelector('[data-ivw-scrim]');
  var toast = dialog.querySelector('[data-ivw-toast]');
  var live = dialog.querySelector('[data-ivw-live]');
  var statEl = dialog.querySelector('[data-ivw-stat]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var STORE_KEY = 'mtw-interview-v1';
  var SAVE_KEY = 'mtw-interview-save';
  var VIEW_KEY = 'mtw-interview-view';
  var COACH = '../images/coach-full.webp';
  var COACH_HEAD = '../images/coach-head.webp';
  var MAX_RECORD_S = 300;

  var state = {
    page: 'dashboard',
    opener: null,
    view: 'grid',
    filters: { q: '', cat: '', level: '', star: false, tried: false },
    session: null,     // the interview being answered
    latest: null,      // the last finished session, with its answers
    history: [],       // finished sessions: date, score, categories, question ids
    attempts: {},      // per question: { count, best, last }
    save: false
  };

  // Recording state lives outside `state`: it is never saved.
  var rec = { on: false, media: null, stream: null, timer: 0, started: 0, speech: null, keep: true };


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

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : (many || one + 's'));
  }

  function duration(s) {
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m ? m + 'm' : '') + (r ? (m ? ' ' : '') + r + 's' : '');
  }

  function clock(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
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
    }, 3200);
  }

  function answerText(a) {
    if (!a) {
      return '';
    }
    if (a.guided) {
      return ['s', 't', 'a', 'r'].map(function (k) { return (a.parts[k] || '').trim(); })
        .filter(Boolean).map(function (t) { return /[.!?]$/.test(t) ? t : t + '.'; }).join(' ');
    }
    return (a.text || '').trim();
  }

  function exampleText(q) {
    return typeof q.example === 'string' ? q.example : [q.example.s, q.example.t, q.example.a, q.example.r].join(' ');
  }

  var LEVEL_CLASS = { 1: 'easy', 2: 'mid', 3: 'hard' };


  /* ------------------------------------------------------------------------
     2. PROGRESS STORE
     Only written when the reader has chosen to keep progress. Turning it
     off deletes what was stored. Recordings are never stored.
     ------------------------------------------------------------------------ */

  function storageOk() {
    try {
      var k = '__mtw';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    try {
      state.view = window.sessionStorage.getItem(VIEW_KEY) || state.view;
    } catch (e) { /* the view simply resets */ }
    try {
      state.save = window.localStorage.getItem(SAVE_KEY) === '1';
      if (!state.save) {
        return;
      }
      var data = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
      if (data && data.v === 1) {
        state.history = data.history || [];
        state.attempts = data.attempts || {};
        state.latest = data.latest || null;
      }
    } catch (e) {
      state.save = false;
    }
  }

  function persist() {
    if (!state.save) {
      return;
    }
    try {
      // Text answers are kept so the results can be reopened; recordings
      // are dropped (they only ever exist in this tab).
      var latest = state.latest && {
        id: state.latest.id, date: state.latest.date, mode: state.latest.mode, summary: state.latest.summary,
        compare: state.latest.compare,
        answers: state.latest.answers.map(function (a) {
          return { id: a.id, text: a.text, source: a.source, guided: a.guided, parts: a.parts, hadAudio: !!a.audioUrl, result: a.result };
        })
      };
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 1, history: state.history.slice(-20), attempts: state.attempts, latest: latest
      }));
    } catch (e) {
      showToast('<b>Could not save.</b> Your browser’s storage is full or switched off.');
    }
  }

  function setSave(on) {
    state.save = on;
    try {
      if (on) {
        window.localStorage.setItem(SAVE_KEY, '1');
        persist();
      } else {
        window.localStorage.removeItem(SAVE_KEY);
        window.localStorage.removeItem(STORE_KEY);
      }
    } catch (e) {
      state.save = false;
    }
  }

  function clearProgress() {
    stopRecording(true);
    releaseAudio(state.latest);
    releaseAudio(state.session);
    state.history = [];
    state.attempts = {};
    state.latest = null;
    state.session = null;
    try {
      window.localStorage.removeItem(STORE_KEY);
    } catch (e) { /* nothing stored */ }
    renderSide();
    go('dashboard');
    showToast('<b>Progress cleared.</b> Your practice history has been deleted.');
  }

  function previousSession() {
    return state.history.length > 1 ? state.history[state.history.length - 2] : null;
  }


  /* ------------------------------------------------------------------------
     3. NAVIGATION
     ------------------------------------------------------------------------ */

  var PAGES = {
    dashboard: function () { return dashboardHtml(); },
    questions: function () { return libraryHtml(); },
    // Assessment: where every interview starts, and where Back returns to.
    practice: function () { return practiceStartHtml(); },
    session: function () { return state.session ? practiceHtml() : practiceStartHtml(); },
    results: function () { return resultsHtml(); }
  };

  function renderSide() {
    var current = state.page === 'session' ? 'practice' : state.page;
    $$('.ivw__nav [data-ivw-go]').forEach(function (b) {
      if (b.getAttribute('data-ivw-go') === current) {
        b.setAttribute('aria-current', 'page');
      } else {
        b.removeAttribute('aria-current');
      }
    });
    var n = state.history.length;
    statEl.textContent = n ? plural(n, 'practice session') + ' completed' : 'No practice yet';
    var start = $('[data-ivw-start] span');
    start.textContent = state.session ? 'Back to my interview' : 'Start a 5-question interview';
  }

  function go(page, opts) {
    opts = opts || {};
    if (state.page === 'session' && page !== 'session') {
      saveDraft();
      stopRecording(false);
    }
    state.page = page;
    dialog.classList.toggle('is-answering', page === 'session' && !!state.session);
    renderSide();
    pageEl.innerHTML = PAGES[page]();
    pageEl.classList.remove('is-entering');
    void pageEl.offsetWidth;
    pageEl.classList.add('is-entering');
    if (!opts.keepScroll) {
      main.scrollTop = 0;
    }
    setDrawer(false);
    if (page === 'results' || page === 'dashboard') {
      animateRings();
    }
    if (page === 'questions') {
      updateMore();
    }
    if (page === 'session' && state.session) {
      updateWordCount();
    }
    var focusTarget = opts.focus ? $(opts.focus, pageEl) : pageEl.querySelector('h2');
    if (focusTarget && !opts.first) {
      if (!focusTarget.hasAttribute('tabindex')) {
        focusTarget.setAttribute('tabindex', '-1');
      }
      focusTarget.focus({ preventScroll: true });
    } else if (opts.first) {
      main.focus({ preventScroll: true });
    }
  }

  function setDrawer(open) {
    dialog.classList.toggle('is-menu-open', open);
    tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
    if (open) {
      var cur = $('[data-ivw-go][aria-current]') || $('[data-ivw-go]');
      if (cur) {
        cur.focus();
      }
    }
  }

  function open(opener, page) {
    state.opener = opener || null;
    document.documentElement.classList.add('has-cvr');
    if (!dialog.open) {
      dialog.showModal();
    }
    go(page || (state.session ? 'session' : 'dashboard'), { first: true });
  }

  function close() {
    dialog.close();
  }

  dialog.addEventListener('close', function () {
    saveDraft();
    stopRecording(false);
    document.documentElement.classList.remove('has-cvr');
    setDrawer(false);
    if (state.opener && state.opener.focus && document.contains(state.opener)) {
      state.opener.focus();
    }
  });


  /* ------------------------------------------------------------------------
     4. SESSIONS
     A full interview is five questions from different categories: an
     opener, a motivation question, two STAR questions and a workplace
     situation. Questions from the last session are avoided where possible.
     ------------------------------------------------------------------------ */

  function recentIds() {
    var last = state.history[state.history.length - 1];
    return last ? last.ids : [];
  }

  function pick(pool, used, recent) {
    var fresh = pool.filter(function (q) { return used.indexOf(q.id) === -1 && recent.indexOf(q.id) === -1; });
    var any = pool.filter(function (q) { return used.indexOf(q.id) === -1; });
    var list = fresh.length ? fresh : any;
    return list.length ? shuffle(list)[0] : null;
  }

  function chooseFive() {
    var all = Q.QUESTIONS;
    var recent = recentIds();
    var used = [];
    var usedCats = [];
    function take(q) {
      if (q) {
        used.push(q.id);
        usedCats.push(q.cat);
      }
    }
    // First time: the classic opener. After that, any introduction question.
    take(!state.history.length ? Q.byId('q01') : pick(all.filter(function (q) { return q.cat === 'intro' && !q.star; }), used, recent));
    take(pick(all.filter(function (q) { return q.cat === 'motivation'; }), used, recent));
    take(pick(all.filter(function (q) { return q.star && (q.cat === 'teamwork' || q.cat === 'problem'); }), used, recent));
    take(pick(all.filter(function (q) { return q.kind === 'situational' && (q.cat === 'workplace' || q.cat === 'organisation'); }), used, recent));
    take(pick(all.filter(function (q) { return q.star && usedCats.indexOf(q.cat) === -1; }), used, recent) ||
      pick(all.filter(function (q) { return q.star; }), used, recent));
    return used;
  }

  function startSession(ids, mode) {
    stopRecording(true);
    releaseAudio(state.session);
    state.session = {
      id: 's' + Date.now(),
      mode: mode,
      ids: ids,
      index: 0,
      answers: {}
    };
    ids.forEach(function (id) {
      state.session.answers[id] = { id: id, text: '', parts: { s: '', t: '', a: '', r: '' }, guided: false, source: 'typed', audioUrl: null, audioLength: 0 };
    });
    go('session', { focus: '.ivp__q' });
  }

  function startFull() {
    startSession(chooseFive(), 'full');
  }

  function startSingle(id) {
    startSession([id], 'single');
  }

  /** Start a short set for a next step: STAR questions, or detailed ones. */
  function startFocused(kind) {
    var pool = Q.QUESTIONS.filter(function (q) { return q.star; });
    var recent = recentIds();
    var used = [];
    for (var i = 0; i < 3; i++) {
      var q = pick(pool, used, recent);
      if (q) {
        used.push(q.id);
      }
    }
    startSession(used, kind);
  }

  function startCategory(cat) {
    var pool = Q.QUESTIONS.filter(function (q) { return q.cat === cat; });
    var untried = pool.filter(function (q) { return !state.attempts[q.id]; });
    var used = [];
    for (var i = 0; i < 3; i++) {
      var q = pick(untried.length >= 3 - i ? untried : pool, used, recentIds());
      if (q) {
        used.push(q.id);
      }
    }
    startSession(used, 'topic');
  }

  function currentQuestion() {
    var s = state.session;
    return s ? Q.byId(s.ids[s.index]) : null;
  }

  function currentAnswer() {
    var s = state.session;
    return s ? s.answers[s.ids[s.index]] : null;
  }

  /** Copy what is on screen into the session. */
  function saveDraft() {
    var a = currentAnswer();
    if (!a || state.page !== 'session') {
      return;
    }
    var text = $('[data-ivp-text]', pageEl);
    if (text) {
      a.text = text.value;
    }
    ['s', 't', 'a', 'r'].forEach(function (k) {
      var box = $('[data-ivp-part="' + k + '"]', pageEl);
      if (box) {
        a.parts[k] = box.value;
      }
    });
  }

  function step(delta) {
    saveDraft();
    stopRecording(false);
    var s = state.session;
    var next = s.index + delta;
    if (next < 0) {
      return;
    }
    if (next >= s.ids.length) {
      finishSession();
      return;
    }
    s.index = next;
    go('session', { focus: '.ivp__q' });
  }

  function exitSession() {
    saveDraft();
    var s = state.session;
    var started = s && s.ids.some(function (id) { return answerText(s.answers[id]) || s.answers[id].audioUrl; });
    if (started && !window.confirm('Leave this interview? Your answers so far will not be scored.')) {
      return;
    }
    stopRecording(true);
    releaseAudio(s);
    state.session = null;
    go('practice');
  }

  function releaseAudio(holder) {
    if (!holder || !holder.answers) {
      return;
    }
    var list = Array.isArray(holder.answers) ? holder.answers : Object.keys(holder.answers).map(function (k) { return holder.answers[k]; });
    list.forEach(function (a) {
      if (a.audioUrl) {
        URL.revokeObjectURL(a.audioUrl);
        a.audioUrl = null;
      }
    });
  }

  function finishSession() {
    var s = state.session;
    stopRecording(true);
    var answers = s.ids.map(function (id) {
      var a = s.answers[id];
      var text = answerText(a);
      return {
        id: id, text: text, source: a.source, guided: a.guided, parts: a.parts,
        audioUrl: a.audioUrl, audioLength: a.audioLength,
        result: A.analyseAnswer(Q.byId(id), text, a.source)
      };
    });
    var summary = A.analyseSession(answers);
    var prevLatest = state.history.length ? state.history[state.history.length - 1] : null;
    releaseAudio(state.latest);
    state.latest = {
      id: s.id, date: new Date().toISOString(), mode: s.mode, answers: answers, summary: summary,
      compare: A.compare(prevLatest, summary)
    };
    state.history.push({
      id: s.id, date: state.latest.date, mode: s.mode, ids: s.ids.slice(), score: summary.score,
      categories: summary.categories, assessed: summary.assessed, total: summary.total
    });
    answers.forEach(function (a) {
      var t = state.attempts[a.id] || { count: 0, best: null, last: null };
      t.count += 1;
      if (a.result.assessed) {
        t.last = a.result.score;
        t.best = t.best == null ? a.result.score : Math.max(t.best, a.result.score);
      }
      state.attempts[a.id] = t;
    });
    state.session = null;
    persist();
    go('results');
    say('Your feedback is ready.');
  }


  /* ------------------------------------------------------------------------
     5. RECORDING AND SPEECH TO TEXT
     MediaRecorder keeps the audio in this tab only, for playback. Speech to
     text uses the browser's own recogniser, which some browsers run on
     their own servers, so it is off unless the reader turns it on.
     ------------------------------------------------------------------------ */

  var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var speechOn = false;

  function recUi() {
    return {
      btn: $('[data-ivp-record]', pageEl),
      label: $('[data-ivp-record-label]', pageEl),
      time: $('[data-ivp-time]', pageEl),
      status: $('[data-ivp-rec-status]', pageEl),
      interim: $('[data-ivp-interim]', pageEl)
    };
  }

  function recStatus(text, isError) {
    var ui = recUi();
    if (ui.status) {
      ui.status.textContent = text;
      ui.status.classList.toggle('is-error', !!isError);
    }
  }

  /* Phones and tablets cannot share the microphone between a recording
     and the browser's speech recogniser: Android hands it to one or the
     other, and iOS only lets the recogniser start straight from a tap. So
     there, with "write down what I say" on, the words are written down and
     no playback copy is made. Desktop browsers do both at once. */
  var oneMic = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var FATAL_SPEECH = ['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'];

  function startClock() {
    window.clearInterval(rec.timer);
    rec.timer = window.setInterval(function () {
      var t = (performance.now() - rec.started) / 1000;
      var ui = recUi();
      if (ui.time) {
        ui.time.textContent = clock(t);
      }
      if (t >= MAX_RECORD_S) {
        stopRecording(false);
        showToast('<b>Recording stopped</b> at 5 minutes.');
      }
    }, 250);
  }

  /** Words only: the recogniser has the microphone to itself. */
  function useSpeechOnly() {
    return !!(speechOn && Recognition && (oneMic || !canRecord));
  }

  /** Start a take. Called straight from the tap on Record, so the speech
   *  recogniser (which some browsers only allow from a tap) starts here. */
  function startRecording() {
    if (rec.on) {
      return;
    }
    var a = currentAnswer();
    rec.on = true;
    rec.started = performance.now();
    if (useSpeechOnly()) {
      startSpeech(a);
      startClock();
      setRecordingUi(true);
      say('Listening. Press the button again to stop.');
      return;
    }
    if (!canRecord) {
      rec.on = false;
      return;
    }
    if (speechOn) {
      startSpeech(a);
    }
    recStatus('Asking to use your microphone…');
    startMedia(a, true);
  }

  /** The playback recording. */
  function startMedia(a, fresh) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (!rec.on || rec.media || state.page !== 'session' || currentAnswer() !== a) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        return;
      }
      var media;
      try {
        media = new window.MediaRecorder(stream);
      } catch (e) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (!rec.speech) {
          stopRecording(false);
        }
        recStatus('Recording is not available in this browser. You can type your answer instead.', true);
        return;
      }
      var chunks = [];
      var began = performance.now();
      rec.stream = stream;
      rec.media = media;
      rec.keep = true;
      media.addEventListener('dataavailable', function (e) {
        if (e.data && e.data.size) {
          chunks.push(e.data);
        }
      });
      media.addEventListener('stop', function () {
        var seconds = (performance.now() - began) / 1000;
        if (rec.keep !== false && chunks.length) {
          var blob = new Blob(chunks, { type: media.mimeType || 'audio/webm' });
          if (a.audioUrl) {
            URL.revokeObjectURL(a.audioUrl);
          }
          a.audioUrl = URL.createObjectURL(blob);
          a.audioType = blob.type;
          a.audioLength = Math.round(seconds);
        }
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (rec.media === media) {
          rec.media = null;
          rec.stream = null;
        }
        if (state.page === 'session' && currentAnswer() === a) {
          var box = $('[data-ivp-player]', pageEl);
          if (box) {
            box.innerHTML = playerHtml(a);
          }
          if (!rec.on) {
            setRecordingUi(false);
            recStatus('');
            if (a.audioUrl) {
              say('Recording saved for playback. ' + clock(a.audioLength) + ' long.');
            }
          }
        }
      });
      media.start(500);
      if (fresh) {
        rec.started = performance.now();
        startClock();
        setRecordingUi(true);
        say('Recording. Press the button again to stop.');
      }
    }).catch(function (err) {
      var name = err && err.name;
      if (!rec.speech) {
        stopRecording(false);
      }
      recStatus(name === 'NotAllowedError' || name === 'SecurityError' ?
        'Microphone access was blocked. You can allow it from the address bar, or type your answer instead.' :
        name === 'NotFoundError' ? 'We could not find a microphone. You can type your answer instead.' :
          'The microphone could not be started. You can type your answer instead.', true);
    });
  }

  /** Stop the microphone. With discard, the take is thrown away (used when
   *  clearing progress); otherwise it is kept for playback. */
  function stopRecording(discard) {
    var was = rec.on;
    rec.on = false;
    window.clearInterval(rec.timer);
    stopSpeech();
    if (rec.media && rec.media.state !== 'inactive') {
      rec.keep = !discard;
      rec.media.stop();
    } else if (was) {
      recStatus('');
    }
    setRecordingUi(false);
  }

  /** "Write down what I say" turned on or off part-way through a take. */
  function switchSpeech() {
    var a = currentAnswer();
    if (!rec.on || !a) {
      return;
    }
    if (speechOn) {
      if (useSpeechOnly() && rec.media) {
        // Hand the microphone to the recogniser, keeping what has been
        // recorded so far for playback.
        rec.keep = true;
        rec.media.stop();
        if (rec.stream) {
          rec.stream.getTracks().forEach(function (t) { t.stop(); });
        }
      }
      startSpeech(a);
    } else {
      stopSpeech();
      if (!rec.media && canRecord) {
        startMedia(a, false);
      }
    }
    setRecordingUi(true);
  }

  function setRecordingUi(on) {
    var ui = recUi();
    if (!ui.btn) {
      return;
    }
    ui.btn.classList.toggle('is-recording', on);
    ui.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    ui.label.textContent = on ? 'Stop recording' : (currentAnswer() && currentAnswer().audioUrl ? 'Record again' : 'Record answer');
    if (on) {
      recStatus(useSpeechOnly() ? 'Listening and writing down what you say…' :
        speechOn ? 'Recording, and writing down what you say…' : 'Recording…');
    }
  }

  function refreshRecorder() {
    var box = $('[data-ivp-player]', pageEl);
    if (box) {
      box.innerHTML = playerHtml(currentAnswer());
    }
    setRecordingUi(false);
    recStatus('');
  }

  function startSpeech(a) {
    if (!Recognition || rec.speech) {
      return;
    }
    var r;
    try {
      r = new Recognition();
    } catch (e) {
      return;
    }
    r.lang = 'en-GB';
    // Android repeats earlier words in each new result of a continuous
    // session, so phones listen one phrase at a time and start again.
    r.continuous = !oneMic;
    r.interimResults = true;
    r.pending = '';
    r.fails = 0;
    r.onresult = function (event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var res = event.results[i];
        if (res.isFinal) {
          addSpoken(a, res[0].transcript);
          r.pending = '';
        } else {
          interim += res[0].transcript;
        }
      }
      r.pending = interim;
      r.fails = 0;
      var ui = recUi();
      if (ui.interim) {
        ui.interim.textContent = interim;
      }
    };
    r.onerror = function (e) {
      if (FATAL_SPEECH.indexOf(e.error) === -1) {
        return;    // "no-speech" and "aborted": it simply starts again
      }
      r.dead = true;
      if (rec.speech === r) {
        rec.speech = null;
      }
      if (rec.on && !rec.media) {
        // Words only, and the words have stopped: end the take.
        stopRecording(false);
      }
      recStatus(e.error === 'network' ?
        'Speech to text needs an internet connection in this browser. You can type your answer instead.' :
        e.error === 'audio-capture' ?
          'The microphone is busy, so speech to text could not start. Try again, or type your answer.' :
          'Speech to text was blocked in this browser. You can allow the microphone, or type your answer.', true);
    };
    r.onend = function () {
      // Words still on their way when listening stopped (Safari does not
      // always mark the last phrase as final) are kept.
      if (r.pending) {
        addSpoken(a, r.pending);
        r.pending = '';
      }
      var ui = recUi();
      if (ui.interim) {
        ui.interim.textContent = '';
      }
      // Browsers stop listening after a pause: carry on while the take is
      // running, unless it keeps failing to start.
      if (rec.speech === r && rec.on && !r.dead) {
        r.fails += performance.now() - r.began < 600 ? 1 : 0;
        if (r.fails > 4) {
          rec.speech = null;
          recStatus('Speech to text stopped listening. Press Record to carry on, or type your answer.', true);
          if (!rec.media) {
            stopRecording(false);
          }
          return;
        }
        try {
          r.began = performance.now();
          r.start();
        } catch (e) { /* already running */ }
      }
    };
    rec.speech = r;
    try {
      r.began = performance.now();
      r.start();
    } catch (e) {
      rec.speech = null;
    }
  }

  function stopSpeech() {
    var r = rec.speech;
    rec.speech = null;
    if (r) {
      try {
        r.stop();
      } catch (e) { /* already stopped */ }
    }
  }

  /** Spoken words go into the answer box, where they can be corrected. */
  function addSpoken(a, words) {
    words = String(words || '').trim();
    if (!words) {
      return;
    }
    var sentence = words.charAt(0).toUpperCase() + words.slice(1);
    a.source = 'speech';
    var target = a.guided ? null : $('[data-ivp-text]', pageEl);
    if (a.guided) {
      // In four parts, speech goes into the box the reader is working on.
      var focused = document.activeElement && document.activeElement.getAttribute('data-ivp-part');
      var key = focused || 'a';
      target = $('[data-ivp-part="' + key + '"]', pageEl);
    }
    if (target) {
      target.value = (target.value.trim() ? target.value.trim() + ' ' : '') + sentence;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    saveDraft();
  }


  /* ------------------------------------------------------------------------
     6. PAGES
     ------------------------------------------------------------------------ */

  function head(title, lead, extra) {
    return '<header class="ivh">' +
      '<h2 class="ivh__title">' + title + '</h2>' +
      (lead ? '<p class="ivh__lead">' + lead + '</p>' : '') + (extra || '') +
    '</header>';
  }

  function ringHtml(score, size, label) {
    var has = score != null;
    return '<div class="ivr ivr--' + (size || 'lg') + '" data-css="--p: 0" data-ivr="' + (has ? score : '') + '" role="img" aria-label="' +
      (has ? (label || 'Practice score') + ' ' + score + ' out of 100' : 'Not assessed') + '">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ivr__bg" cx="60" cy="60" r="48" /><circle class="ivr__fg" cx="60" cy="60" r="48" pathLength="100" /></svg>' +
      '<span class="ivr__num" aria-hidden="true">' + (has ? '<b data-ivr-num>0</b><small>/100</small>' : '<b class="ivr__none">–</b><small>Not assessed</small>') + '</span>' +
    '</div>';
  }

  function animateRings() {
    $$('[data-ivr]', pageEl).forEach(function (ring) {
      var v = ring.getAttribute('data-ivr');
      if (v === '') {
        return;
      }
      var target = parseInt(v, 10);
      var num = $('[data-ivr-num]', ring);
      if (reduce.matches) {
        ring.style.setProperty('--p', target);
        num.textContent = target;
        return;
      }
      var start = null;
      function frame(now) {
        if (start === null) {
          start = now;
        }
        var t = Math.min(1, (now - start) / 1100);
        var e = 1 - Math.pow(1 - t, 3);
        ring.style.setProperty('--p', (target * e).toFixed(1));
        num.textContent = Math.round(target * e);
        if (t < 1) {
          window.requestAnimationFrame(frame);
        }
      }
      window.requestAnimationFrame(frame);
    });
  }

  /** The full figure on wide screens, her head and shoulders on phones. */
  function coachPicture(cls) {
    return '<picture><source media="(max-width: 56em)" srcset="' + COACH_HEAD + '" width="440" height="521">' +
      '<img class="' + cls + '" src="' + COACH + '" alt="" width="560" height="590" decoding="async"></picture>';
  }

  function coachHtml(message, cls) {
    return '<figure class="ivc' + (cls ? ' ' + cls : '') + '">' +
      '<p class="ivc__bubble">' + message + '</p>' +
      coachPicture('ivc__img') +
      '<figcaption class="visually-hidden">Your interview coach says: ' + message + '</figcaption>' +
    '</figure>';
  }

  /** What the coach says, from the reader's progress. */
  function coachMessage() {
    var l = state.latest;
    if (state.session) {
      return 'Welcome back! You’re part-way through an interview. Pick up where you left off?';
    }
    if (!l) {
      return 'Hi! I’m here to help you get job ready. What would you like to work on today?';
    }
    var s = l.summary;
    if (s.score == null) {
      return 'Last time we couldn’t score your answers. Try typing one, and I’ll show you what’s working.';
    }
    if (s.assessed < s.total) {
      return 'Try to answer every question, even briefly. A typed answer gets you feedback.';
    }
    if (s.score >= 80) {
      return 'Great work last time! Ready for a harder question?';
    }
    var focus = s.work[0];
    var tips = {
      structure: 'Last time, a little more structure would have helped. Fancy trying a STAR question?',
      development: 'Your answers could use a bit more detail. Let’s practise telling the full story.',
      examples: 'Real examples make answers stick. School, college and volunteering all count!',
      outcomes: 'Don’t forget the ending: what happened, and what you learned.',
      relevance: 'Try making your first sentence answer the question directly.',
      clarity: 'Short, clear sentences make a big difference. Let’s give it another go.',
      unanswered: 'Try to answer every question, even briefly. A typed answer gets you feedback.'
    };
    return focus ? tips[focus.id] : 'Nice progress! Keep practising to build your confidence.';
  }

  function scoreCardHtml(forDash) {
    var l = state.latest;
    if (!l) {
      return '<section class="ivs ivs--empty" aria-labelledby="ivs-title">' +
        '<div class="ivs__ring-empty" aria-hidden="true">' + icon('i-chat') + '</div>' +
        '<div class="ivs__body">' +
          '<h3 class="ivs__label" id="ivs-title">Your first practice</h3>' +
          '<p class="ivs__text">Answer five common questions in your own words, then see what you did well and what to work on. It takes about ten minutes.</p>' +
          '<button class="ivbtn" type="button" data-ivw-start-full>Start a 5-question interview' + icon('i-arrow') + '</button>' +
        '</div>' +
      '</section>';
    }
    var s = l.summary;
    var prev = l.compare;
    return '<section class="ivs" aria-labelledby="ivs-title">' +
      ringHtml(s.score, 'lg') +
      '<div class="ivs__body">' +
        '<h3 class="ivs__label" id="ivs-title">' + esc(s.label) + '</h3>' +
        '<p class="ivs__text">' + esc(s.summary) + '</p>' +
        (prev ? '<p class="ivs__delta ivs__delta--' + (prev.delta >= 0 ? 'up' : 'down') + '">' +
          (prev.delta === 0 ? 'The same score as your previous practice.' :
            (prev.delta > 0 ? 'Up ' : 'Down ') + Math.abs(prev.delta) + ' points on your previous practice.') + '</p>' : '') +
        (forDash ? '<p class="ivs__meta">From your ' + (l.mode === 'single' ? 'last practice question' : 'last practice interview') + ' · <button class="ivlink" type="button" data-ivw-go="results">See your full feedback</button></p>' : '') +
      '</div>' +
    '</section>';
  }

  function statsHtml() {
    if (!state.history.length) {
      return '';
    }
    var tried = Object.keys(state.attempts).length;
    var revisit = Object.keys(state.attempts).filter(function (id) {
      var t = state.attempts[id];
      return t.last != null && t.last < 60;
    });
    var last = state.history[state.history.length - 1];
    var prev = previousSession();
    return '<ul class="ivst" aria-label="Your progress">' +
      '<li><b>' + state.history.length + '</b><span>' + (state.history.length === 1 ? 'session' : 'sessions') + ' completed</span></li>' +
      '<li><b>' + tried + '</b><span>of 45 questions tried</span></li>' +
      '<li><b>' + (last.score == null ? '–' : last.score) + '</b><span>latest score</span></li>' +
      '<li><b>' + (prev && prev.score != null ? prev.score : '–') + '</b><span>previous score</span></li>' +
    '</ul>' +
    (revisit.length ? '<p class="ivst__revisit">Worth another go: ' + revisit.slice(0, 3).map(function (id) {
      return '<button class="ivlink" type="button" data-ivw-try="' + id + '">' + esc(Q.byId(id).text) + '</button>';
    }).join(', ') + '</p>' : '');
  }

  function privacyHtml() {
    var ok = storageOk();
    return '<section class="ivpriv" aria-labelledby="ivpriv-title">' +
      '<h3 class="ivpriv__title" id="ivpriv-title">' + icon('i-lock') + 'Your practice, your data</h3>' +
      '<p>Everything happens in your browser. Nothing is sent to us, and recordings are never kept once you leave the page.</p>' +
      (ok ? '<label class="ivswitch"><input type="checkbox" data-ivw-save' + (state.save ? ' checked' : '') + '><span class="ivswitch__track" aria-hidden="true"></span>' +
        '<span>Keep my answers and scores on this device, so I can come back to them</span></label>' +
        '<p class="ivpriv__small">Saved progress lives in this browser only and can be lost if you clear your browsing data.</p>' :
        '<p class="ivpriv__small">Your browser is not allowing storage, so progress lasts until you close the page.</p>') +
      (state.history.length || state.latest ? '<button class="ivbtn ivbtn--ghost ivbtn--sm" type="button" data-ivw-clear>' + icon('i-trash') + 'Clear my progress</button>' : '') +
    '</section>';
  }

  function dashboardHtml() {
    var first = !state.latest;
    var preview = first ? ['q01', 'q08', 'q15', 'q10'] : previewIds();
    return '<div class="ivd">' +
      head('Preparing for your interview', first ?
        'Practise the questions employers ask most, in your own words. You’ll get clear, friendly feedback on each answer.' :
        'We’ve found a few areas that could be even stronger. Follow the suggestions to make the most of your experience and skills.') +
      '<div class="ivd__grid"><div class="ivd__main">' +
      '<div class="ivd__top">' + scoreCardHtml(true) + coachHtml(coachMessage(), 'ivc--dash') + '</div>' +
      (state.session ? '<div class="ivd__resume"><p>You have an interview in progress: question ' + (state.session.index + 1) + ' of ' + state.session.ids.length + '.</p>' +
        '<button class="ivbtn" type="button" data-ivw-go="session">Continue my interview' + icon('i-arrow') + '</button></div>' : '') +
      statsHtml() +
      '<section class="ivd__qs" aria-labelledby="ivd-qs">' +
        '<h3 class="ivsec" id="ivd-qs">Common <span>Mock Questions</span></h3>' +
        '<ul class="ivq-list is-grid">' + preview.map(function (id) { return cardHtml(Q.byId(id)); }).join('') + '</ul>' +
        '<div class="ivd__more">' +
          '<button class="ivbtn ivbtn--wide" type="button" data-ivw-go="questions">View more questions' + icon('i-arrow') + '</button>' +
          (state.session ? '' : '<button class="ivbtn ivbtn--light ivbtn--wide" type="button" data-ivw-start-full>' + icon('i-mic') + 'Start a full interview</button>') +
        '</div>' +
      '</section>' +
      '</div>' +
      '<aside class="ivd__aside" aria-label="Practice shortcuts and progress">' +
        quickHtml() + dailyHtml() + historyHtml() + privacyHtml() +
      '</aside></div>' +
    '</div>';
  }

  var CAT_ICONS = { intro: 'i-user', motivation: 'i-target', teamwork: 'i-people', problem: 'i-bulb',
    organisation: 'i-cal', workplace: 'i-briefcase', firstjob: 'i-cap' };

  /** Three questions on one topic: a short, focused practice. */
  function quickHtml() {
    return '<section class="ivside ivside--quick" aria-labelledby="ivq-quick">' +
      '<h3 class="ivside__title" id="ivq-quick">Quick practice</h3>' +
      '<p class="ivside__text">Three questions on one topic. About five minutes.</p>' +
      '<ul class="ivcats">' + Q.CATEGORIES.map(function (c) {
        var all = Q.QUESTIONS.filter(function (q) { return q.cat === c.key; });
        var done = all.filter(function (q) { return state.attempts[q.id]; }).length;
        return '<li><button type="button" data-ivw-cat="' + c.key + '">' + icon(CAT_ICONS[c.key] || 'i-chat') +
          '<span>' + esc(c.name) + '<small>' + done + ' of ' + all.length + ' tried</small></span>' + icon('i-chevron', 'ivcats__chev') + '</button></li>';
      }).join('') + '</ul>' +
    '</section>';
  }

  /** The same question for everyone on a given day. */
  function dailyHtml() {
    var now = new Date();
    var day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    var q = Q.QUESTIONS[day % Q.QUESTIONS.length];
    var t = state.attempts[q.id];
    return '<section class="ivside ivside--daily" aria-labelledby="ivq-daily">' +
      '<h3 class="ivside__title" id="ivq-daily">Question of the day</h3>' +
      '<p class="ivside__q">' + esc(q.text) + '</p>' +
      '<p class="ivside__text">' + icon('i-clock') + 'About ' + duration(q.time) + (q.star ? ' · STAR works well' : '') + '</p>' +
      '<button class="ivbtn ivbtn--sm" type="button" data-ivw-try="' + q.id + '">' + (t ? 'Try it again' : 'Give it a go') + icon('i-arrow') + '</button>' +
    '</section>';
  }

  /** Scores from past sessions, oldest to newest (only real results). */
  function historyHtml() {
    var list = state.history.slice(-8);
    var tried = Object.keys(state.attempts).length;
    if (!list.length) {
      return '<section class="ivside" aria-labelledby="ivq-hist"><h3 class="ivside__title" id="ivq-hist">Your progress</h3>' +
        '<p class="ivside__text">After your first practice, your scores will show here so you can see how you are improving.</p></section>';
    }
    return '<section class="ivside" aria-labelledby="ivq-hist">' +
      '<h3 class="ivside__title" id="ivq-hist">Your progress</h3>' +
      '<ol class="ivhist" aria-label="Scores from your recent sessions">' + list.map(function (h) {
        var d = new Date(h.date);
        var label = d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
        return '<li><span class="ivhist__bar' + (h.score == null ? ' is-none' : '') + '" data-css="--h: ' + (h.score == null ? 6 : Math.max(6, h.score)) + '%">' +
          '<b>' + (h.score == null ? '–' : h.score) + '</b></span><small>' + label + '</small>' +
          '<span class="visually-hidden">: ' + (h.score == null ? 'not assessed' : h.score + ' out of 100') + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="ivside__text">' + tried + ' of 45 questions tried</p>' +
      '<div class="ivside__meter" aria-hidden="true"><span data-css="width: ' + (tried / 45 * 100) + '%"></span></div>' +
    '</section>';
  }

  /** Questions to suggest: ones that match the weakest area, not yet tried. */
  function previewIds() {
    var focus = state.latest && state.latest.summary.work[0];
    var wantStar = focus && /structure|examples|outcomes|development/.test(focus.id);
    var pool = Q.QUESTIONS.filter(function (q) { return !state.attempts[q.id] && (!wantStar || q.star); });
    if (pool.length < 2) {
      pool = Q.QUESTIONS.filter(function (q) { return !state.attempts[q.id]; });
    }
    if (pool.length < 2) {
      pool = Q.QUESTIONS;
    }
    return pool.slice(0, 4).map(function (q) { return q.id; });
  }

  function cardHtml(q) {
    var t = state.attempts[q.id];
    var cat = Q.category(q.cat);
    return '<li class="ivq">' +
      '<article class="ivq__card" aria-labelledby="ivq-' + q.id + '">' +
        '<h4 class="ivq__q" id="ivq-' + q.id + '">' + esc(q.text) + '</h4>' +
        '<p class="ivq__time">' + duration(q.time) + '</p>' +
        '<p class="ivq__tags">' +
          '<span class="ivtag">' + esc(cat.name) + '</span>' +
          '<span class="ivtag ivtag--' + LEVEL_CLASS[q.level] + '">' + Q.LEVELS[q.level] + '</span>' +
          (q.star ? '<span class="ivtag ivtag--star">STAR</span>' : '') +
          (t ? '<span class="ivtag ivtag--done">' + icon('i-check') + (t.best != null ? 'Best ' + t.best : 'Tried') + '</span>' : '') +
        '</p>' +
        '<button class="ivbtn ivbtn--try" type="button" data-ivw-try="' + q.id + '" aria-label="' + (t ? 'Retry' : 'Try') + ': ' + esc(q.text) + '">' + (t ? 'Retry' : 'Try') + icon('i-arrow') + '</button>' +
        '<span class="ivq__torn" aria-hidden="true"></span>' +
      '</article>' +
    '</li>';
  }

  function filtered() {
    var f = state.filters;
    var term = f.q.trim().toLowerCase();
    return Q.QUESTIONS.filter(function (q) {
      return (!term || q.text.toLowerCase().indexOf(term) !== -1 || Q.category(q.cat).name.toLowerCase().indexOf(term) !== -1) &&
        (!f.cat || q.cat === f.cat) &&
        (!f.level || String(q.level) === f.level) &&
        (!f.star || q.star) &&
        (!f.tried || state.attempts[q.id]);
    });
  }

  function libraryHtml() {
    var f = state.filters;
    return '<div class="ivl">' +
      head('Common Mock Questions', 'These questions come up in interviews for many entry-level jobs and apprenticeships. Choose one to practise, or start a full interview.') +
      '<div class="ivl__bar">' +
        '<div class="ivl__filters" role="search">' +
          '<label class="ivfield ivfield--search"><span class="visually-hidden">Search questions</span>' + icon('i-search') +
            '<input type="search" placeholder="Search questions" value="' + esc(f.q) + '" data-ivl-filter="q" autocomplete="off"></label>' +
          '<label class="ivfield"><span class="visually-hidden">Category</span><select data-ivl-filter="cat"><option value="">All categories</option>' +
            Q.CATEGORIES.map(function (c) { return '<option value="' + c.key + '"' + (f.cat === c.key ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
          '</select></label>' +
          '<label class="ivfield"><span class="visually-hidden">Difficulty</span><select data-ivl-filter="level"><option value="">Any difficulty</option>' +
            [1, 2, 3].map(function (l) { return '<option value="' + l + '"' + (f.level === String(l) ? ' selected' : '') + '>' + Q.LEVELS[l] + '</option>'; }).join('') +
          '</select></label>' +
          '<button class="ivchip" type="button" aria-pressed="' + f.star + '" data-ivl-toggle="star">STAR questions</button>' +
          '<button class="ivchip" type="button" aria-pressed="' + f.tried + '" data-ivl-toggle="tried">Practised</button>' +
        '</div>' +
        '<div class="ivl__views" role="group" aria-label="Layout">' +
          '<button class="ivview" type="button" aria-pressed="' + (state.view === 'list') + '" data-ivl-view="list">' + icon('i-list') + '<span class="visually-hidden">List view</span></button>' +
          '<span class="ivl__sep" aria-hidden="true"></span>' +
          '<button class="ivview" type="button" aria-pressed="' + (state.view === 'grid') + '" data-ivl-view="grid">' + icon('i-grid') + '<span class="visually-hidden">Grid view</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="ivl__count"><p data-ivl-count></p>' +
        (state.session ? '' : '<button class="ivbtn ivbtn--sm" type="button" data-ivw-start-full>' + icon('i-mic') + 'Start full interview</button>') + '</div>' +
      '<ul class="ivq-list is-' + state.view + '" data-ivl-list></ul>' +
      '<button class="ivmore" type="button" data-ivl-more hidden>' + icon('i-download') + 'More questions below</button>' +
    '</div>';
  }

  function renderList() {
    var list = $('[data-ivl-list]', pageEl);
    if (!list) {
      return;
    }
    var items = filtered();
    list.className = 'ivq-list is-' + state.view;
    list.innerHTML = items.length ? items.map(cardHtml).join('') :
      '<li class="ivl__none"><p><b>No questions match.</b> Try a different word or clear the filters.</p>' +
      '<button class="ivbtn ivbtn--light ivbtn--sm" type="button" data-ivl-reset>Clear filters</button></li>';
    var count = $('[data-ivl-count]', pageEl);
    count.textContent = items.length === 45 ? 'Showing all 45 questions' : 'Showing ' + plural(items.length, 'question') + ' of 45';
    updateMore();
  }

  /** The "More questions below" pill shows while the list runs on below. */
  function updateMore() {
    var more = $('[data-ivl-more]', pageEl);
    var list = $('[data-ivl-list]', pageEl);
    if (!more || !list) {
      return;
    }
    if (!list.children.length) {
      renderList();
      return;
    }
    var below = list.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom;
    more.hidden = below < 40;
  }

  /** The same Back control in every Get Job Ready tool: an arrow and
   *  where it goes, top left, above the page title. */
  function backHtml(label, attrs) {
    return '<button class="toolback" type="button" ' + attrs + '>' + icon('i-arrow') + '<span>' + label + '</span></button>';
  }

  /** Assessment: carry on with an interview, or start one. */
  function practiceStartHtml() {
    var s = state.session;
    var resume = '';
    if (s) {
      var done = s.ids.filter(function (id) { return answerText(s.answers[id]) || s.answers[id].audioUrl; }).length;
      resume = '<section class="ivresume" aria-labelledby="ivresume-title">' +
        '<div class="ivresume__copy"><p class="ivresume__eyebrow">' + icon('i-mic') + 'Interview in progress</p>' +
          '<h3 class="ivresume__title" id="ivresume-title">Question ' + (s.index + 1) + ' of ' + s.ids.length + '</h3>' +
          '<p class="ivresume__text">' + (done ? plural(done, 'answer') + ' so far.' : 'No answers yet.') + ' Carry on where you left off.</p>' +
          '<div class="ivp__bar ivresume__bar" aria-hidden="true"><span data-css="width: ' + Math.round(done / s.ids.length * 100) + '%"></span></div></div>' +
        '<div class="ivresume__btns"><button class="ivbtn" type="button" data-ivw-go="session">Carry on' + icon('i-arrow') + '</button>' +
          '<button class="ivlink" type="button" data-ivp-exit>End this interview</button></div>' +
      '</section>';
    }
    return '<div class="ivp ivp--start">' +
      head('Practise Interview', 'Answer out loud, type, or both. Take your time: there are no trick questions here.') +
      resume +
      '<div class="ivstart">' +
        '<div class="ivp__choose">' +
          '<article class="ivopt">' +
            '<h3>' + icon('i-mic') + 'Full interview</h3>' +
            '<p>Five questions from different areas, like a real first interview. About ten minutes.</p>' +
            '<ul class="ivopt__facts"><li>' + icon('i-clock') + 'About 10 minutes</li><li>' + icon('i-chat') + '5 questions</li></ul>' +
            (s ? '<button class="ivbtn ivbtn--light" type="button" data-ivw-restart>Start a new interview' + icon('i-arrow') + '</button>' :
              '<button class="ivbtn" type="button" data-ivw-start-full>Start 5 questions' + icon('i-arrow') + '</button>') +
          '</article>' +
          '<article class="ivopt ivopt--light">' +
            '<h3>' + icon('i-list') + 'One question</h3>' +
            '<p>Pick any question from the library and practise just that one.</p>' +
            '<ul class="ivopt__facts"><li>' + icon('i-clock') + '1 to 3 minutes</li><li>' + icon('i-list') + Q.QUESTIONS.length + ' to choose from</li></ul>' +
            '<button class="ivbtn ivbtn--light" type="button" data-ivw-go="questions">Choose a question' + icon('i-arrow') + '</button>' +
          '</article>' +
        '</div>' +
        coachHtml('Examples from school, college, volunteering or hobbies are just as good as paid work.', 'ivc--start') +
      '</div>' +
      '<section class="ivsteps" aria-labelledby="ivsteps-title">' +
        '<h3 class="ivsteps__title" id="ivsteps-title">How it works</h3>' +
        '<ol class="ivsteps__list">' +
          '<li><span class="ivsteps__num" aria-hidden="true">1</span><b>Answer</b><span>Record yourself, type your answer, or both. Aim for a real example.</span></li>' +
          '<li><span class="ivsteps__num" aria-hidden="true">2</span><b>Get feedback</b><span>See what went well and what to add, such as what you did and how it ended.</span></li>' +
          '<li><span class="ivsteps__num" aria-hidden="true">3</span><b>Try again</b><span>Improve an answer and watch your score change in Results.</span></li>' +
        '</ol>' +
      '</section>' +
    '</div>';
  }

  function playerHtml(a) {
    if (!a || !a.audioUrl) {
      return '';
    }
    var ext = /mp4|aac/.test(a.audioType || '') ? 'm4a' : /ogg/.test(a.audioType || '') ? 'ogg' : 'webm';
    return '<div class="ivrec">' +
      '<audio controls src="' + a.audioUrl + '" aria-label="Your recorded answer"></audio>' +
      '<div class="ivrec__actions">' +
        '<a class="ivlink" href="' + a.audioUrl + '" download="interview-answer.' + ext + '">' + icon('i-download') + 'Save to my device</a>' +
        '<button class="ivlink" type="button" data-ivp-delete>' + icon('i-trash') + 'Delete recording</button>' +
      '</div>' +
      '<p class="ivrec__note">Listen back and ask yourself: did I give an example, say what I did, and say how it ended?' +
        (answerText(a) ? '' : ' To get a score, type what you said in the box below, or turn on speech to text.') + '</p>' +
    '</div>';
  }

  function practiceHtml() {
    var s = state.session;
    var q = currentQuestion();
    var a = currentAnswer();
    var n = s.ids.length;
    var i = s.index;
    var last = i === n - 1;
    var cat = Q.category(q.cat);
    var structure = Q.STRUCTURES[q.kind] || Q.STRUCTURES.intro;
    var hasText = !!answerText(a);
    var message = last && n > 1 ? 'Last one! You’re nearly there.' :
      q.star ? 'Take your time. A real example from school, college or volunteering is perfect.' :
        'Answer in your own words. There’s no single right answer.';

    var parts = [
      { k: 's', name: 'Situation', ask: 'What was happening?', hint: 'For example: "During college, we had to give a group presentation."' },
      { k: 't', name: 'Task', ask: 'What were you responsible for?', hint: 'For example: "I was in charge of organising our research."' },
      { k: 'a', name: 'Action', ask: 'What did you actually do?', hint: 'Use "I": "I split the tasks and checked in with everyone."' },
      { k: 'r', name: 'Result', ask: 'What happened afterwards?', hint: 'For example: "We finished on time, and I learned…"' }
    ];

    return '<div class="ivp">' +
      '<header class="ivh ivh--practice">' +
        backHtml('Back to Assessment', 'data-ivw-go="practice"') +
        '<h2 class="ivh__title">Practise Interview</h2>' +
      '</header>' +

      '<div class="ivp__stage">' +
        '<div class="ivp__bubble">' +
          '<p class="ivp__count">' + (n > 1 ? 'Question ' + (i + 1) + ' of ' + n : 'Single question') + '</p>' +
          '<h3 class="ivp__q" tabindex="-1">' + esc(q.text) + '</h3>' +
          '<p class="ivp__meta"><span>' + icon('i-clock') + 'Aim for about ' + duration(q.time) + '</span><span>' + esc(cat.name) + '</span>' +
            (q.star ? '<span class="ivtag ivtag--star">STAR works well</span>' : '') + '</p>' +
          (canRecord ? '<div class="ivp__rec-row">' +
            '<button class="ivbtn ivbtn--record" type="button" aria-pressed="false" data-ivp-record>' +
              '<span class="ivbtn__dot" aria-hidden="true"></span>' + icon('i-mic') + '<span data-ivp-record-label>' + (a.audioUrl ? 'Record again' : 'Record answer') + '</span></button>' +
            '<span class="ivp__time" data-ivp-time aria-hidden="true">0:00</span>' +
            '</div>' : '<p class="ivp__norec">Recording isn’t available in this browser. Typing works everywhere.</p>') +
          '<p class="ivp__status" data-ivp-rec-status role="status"></p>' +
        '</div>' +
        '<p class="ivp__coach-say" aria-hidden="true">' + message + '</p>' +
        coachPicture('ivp__coach') +
      '</div>' +

      '<div class="ivp__work"><div class="ivp__answer">' +
        (canRecord && Recognition ? '<div class="ivp__stt">' +
          '<label class="ivswitch ivswitch--sm"><input type="checkbox" data-ivp-speech' + (speechOn ? ' checked' : '') + '><span class="ivswitch__track" aria-hidden="true"></span>' +
          '<span>Write down what I say (speech to text)</span></label>' +
          '<details class="ivp__stt-info"><summary>How this works</summary><p>Your browser turns your speech into text. Some browsers, such as Chrome, send the audio to their own speech service to do this, so it’s off until you turn it on. Leave it off to keep everything on your device, and type instead. On phones and tablets the microphone can only do one job at a time, so with this on your answer is written down but not recorded for playback. Check the text afterwards: it can mishear words.</p></details>' +
        '</div>' : '') +
        '<p class="ivp__interim" data-ivp-interim aria-live="off"></p>' +
        '<div data-ivp-player>' + playerHtml(a) + '</div>' +

        (q.star || q.kind === 'behavioural' ? '<details class="ivstar"' + (a.guided ? ' open' : '') + ' data-ivp-star>' +
          '<summary><span class="ivstar__badge">STAR</span>Need help? Try the STAR method' + icon('i-chevron', 'ivstar__chev') + '</summary>' +
          '<div class="ivstar__body">' +
            '<ol class="ivstar__steps">' + parts.map(function (p) {
              return '<li><b>' + p.k.toUpperCase() + '</b><span><strong>' + p.name + '.</strong> ' + p.ask + '</span></li>';
            }).join('') + '</ol>' +
            '<p class="ivstar__note">Your example can come from school, college, volunteering, a hobby or everyday life. You don’t need paid work to give a great answer.</p>' +
            '<label class="ivswitch ivswitch--sm"><input type="checkbox" data-ivp-guided' + (a.guided ? ' checked' : '') + '><span class="ivswitch__track" aria-hidden="true"></span><span>Answer in four parts</span></label>' +
          '</div>' +
        '</details>' : '') +

        '<div class="ivp__write">' +
          (a.guided ? parts.map(function (p) {
            return '<label class="ivpart"><span class="ivpart__name"><b>' + p.k.toUpperCase() + '</b>' + p.name + ': ' + p.ask + '</span>' +
              '<textarea rows="2" data-ivp-part="' + p.k + '" placeholder="' + esc(p.hint) + '">' + esc(a.parts[p.k]) + '</textarea></label>';
          }).join('') :
            '<label class="ivp__label" for="ivp-text">Your answer</label>' +
            '<textarea id="ivp-text" class="ivp__text" rows="7" data-ivp-text placeholder="Type your answer here, or record it and type the key points.">' + esc(a.text) + '</textarea>') +
          '<p class="ivp__wc" data-ivp-wc aria-live="polite"></p>' +
        '</div>' +

      '</div>' +
      '<aside class="ivp__aside" aria-label="This interview">' +
        (n > 1 ? '<section class="ivside"><h3 class="ivside__title">This interview</h3><ol class="ivout">' + s.ids.map(function (id, k) {
          var ans = s.answers[id];
          var st = k === i ? 'now' : (answerText(ans) || ans.audioUrl) ? 'done' : 'todo';
          return '<li class="is-' + st + '"><button type="button" data-ivp-jump="' + k + '"' + (k === i ? ' aria-current="step"' : '') + '>' +
            '<span class="ivout__n">' + (st === 'done' ? icon('i-check') : k + 1) + '</span><span>' + esc(Q.byId(id).text) +
            '<span class="visually-hidden">' + (st === 'done' ? ', answered' : st === 'now' ? ', current question' : ', not answered yet') + '</span></span></button></li>';
        }).join('') + '</ol></section>' : '') +
        '<details class="ivtips" open>' +
          '<summary>' + icon('i-bulb') + 'Tips for this question</summary>' +
          '<div class="ivtips__body">' +
            '<h4>A good shape for your answer</h4><ol>' + structure.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
            '<h4>Tips</h4><ul>' + q.tips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
            '<h4>Common mistakes</h4><ul>' + q.mistakes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
          '</div>' +
        '</details>' +
      '</aside></div>' +

      '<footer class="ivp__foot">' +
        '<p class="ivp__step" aria-hidden="true">' + (i + 1) + ' / ' + n + '</p>' +
        '<div class="ivp__bar" role="progressbar" aria-label="Interview progress" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + i + '"><span data-css="width: ' + (i / n * 100) + '%"></span></div>' +
        (i > 0 ? '<button class="ivbtn ivbtn--ghost ivbtn--sm" type="button" data-ivp-back>Back</button>' : '') +
        '<button class="ivbtn ivbtn--next" type="button" data-ivp-next>' +
          '<span data-ivp-next-label>' + nextLabel(hasText || !!a.audioUrl, last) + '</span>' + icon('i-arrow') + '</button>' +
      '</footer>' +
    '</div>';
  }

  function nextLabel(answered, last) {
    if (!answered) {
      return last ? 'Skip and finish' : 'Skip question';
    }
    return last ? 'Finish and get feedback' : 'Continue';
  }

  function updateWordCount() {
    var a = currentAnswer();
    var q = currentQuestion();
    var wc = $('[data-ivp-wc]', pageEl);
    if (!a || !wc) {
      return;
    }
    saveDraft();
    var t = answerText(a);
    var n = (t.match(/\S+/g) || []).length;
    var range = Q.LENGTHS[q.kind] || [40, 200];
    wc.textContent = n ? plural(n, 'word') + (n < range[0] ? ' · aim for ' + range[0] + ' or more' : n > range[1] ? ' · try trimming to around ' + range[1] : ' · a good length') : '';
    var label = $('[data-ivp-next-label]', pageEl);
    if (label) {
      label.textContent = nextLabel(!!n || !!a.audioUrl, state.session.index === state.session.ids.length - 1);
    }
  }


  /* ------------------------------------------------------------------------
     7. RESULTS AND IMPROVING ANSWERS
     ------------------------------------------------------------------------ */

  function catBarsHtml(s) {
    return '<aside class="ivside ivhow" aria-labelledby="ivhow-title"><h3 class="ivside__title" id="ivhow-title">Score breakdown</h3>' +
      '<p>Your score comes from the words in your answers, checked against the rules below. It cannot hear your tone, and it does not judge accents, confidence or personality.</p>' +
      '<ul class="ivbars">' + A.CATS.map(function (c) {
        var v = s.categories[c.key];
        return '<li><span>' + esc(c.name) + '</span><span class="ivbars__track"><i data-css="width: ' + Math.round(v.share * 100) + '%"></i></span><b>' + Math.round(v.points) + ' / ' + c.max + '</b></li>';
      }).join('') + '</ul>' +
      '<p class="ivhow__small">Averaged across the answers we could score' +
        (s.assessed < s.total ? ' (' + s.average + '), then lowered because ' + (s.total - s.assessed) + ' of ' + s.total + ' answers were skipped or too short to score.' : '.') + '</p>' +
    '</aside>';
  }

  function feedbackCard(f, kind) {
    var lvl = kind === 'good' ? 'good' : f.level;
    return '<li class="ivf ivf--' + lvl + '">' +
      '<span class="ivf__mark" aria-hidden="true">' + icon(kind === 'good' ? 'i-check' : 'i-alert') + '</span>' +
      '<h4 class="ivf__title">' + esc(f.title) + '</h4>' +
      '<p class="ivf__score"><b>' + f.outOf10 + '</b>/10<span class="visually-hidden"> out of ten</span></p>' +
      '<p class="ivf__text">' + esc(f.detail) + '</p>' +
      (kind !== 'good' && f.action ? '<button class="ivlink ivf__action" type="button" data-ivw-step="' + f.go + '">' + esc(f.action) + icon('i-arrow') + '</button>' : '') +
      '<span class="ivq__torn" aria-hidden="true"></span>' +
    '</li>';
  }

  function starChips(star) {
    var names = { s: 'Situation', t: 'Task', a: 'Action', r: 'Result' };
    return '<ul class="ivchips" aria-label="STAR parts found">' + ['s', 't', 'a', 'r'].map(function (k) {
      return '<li class="' + (star[k] ? 'is-on' : '') + '"><b>' + k.toUpperCase() + '</b>' + names[k] +
        '<span class="visually-hidden">' + (star[k] ? ': found' : ': not found') + '</span></li>';
    }).join('') + '</ul>';
  }

  var REASONS = {
    empty: 'You did not type an answer for this question, so it has not been scored.',
    short: 'This answer is too short to score yet. Try a few sentences.',
    repeated: 'This answer repeats the same word, so it does not read as a real answer yet.',
    placeholder: 'This looks like test or placeholder text, so it has not been scored.'
  };

  function answerHtml(a, i) {
    var q = Q.byId(a.id);
    var r = a.result;
    var structure = Q.STRUCTURES[q.kind] || Q.STRUCTURES.intro;
    var ex = q.example;
    return '<li class="iva" id="iva-' + a.id + '">' +
      '<details' + (i === 0 ? ' open' : '') + '>' +
        '<summary>' +
          '<span class="iva__n" aria-hidden="true">' + (i + 1) + '</span>' +
          '<span class="iva__q">' + esc(q.text) + '</span>' +
          (r.assessed ? '<span class="iva__score iva__score--' + (r.score >= 70 ? 'good' : r.score >= 45 ? 'tip' : 'fix') + '">' + r.score + '<small>/100</small></span>' :
            '<span class="iva__score iva__score--none">Not assessed</span>') +
          icon('i-chevron', 'iva__chev') +
        '</summary>' +
        '<div class="iva__body">' +
          '<div class="iva__cols">' +
            '<div>' +
              '<h5>Your answer' + (a.source === 'speech' ? ' (from speech to text)' : '') + '</h5>' +
              (a.text ? '<blockquote class="iva__text">' + esc(a.text) + '</blockquote>' : '<p class="iva__empty">No typed answer.</p>') +
              (a.audioUrl ? '<audio controls src="' + a.audioUrl + '" aria-label="Your recorded answer"></audio>' :
                a.hadAudio ? '<p class="iva__small">Your recording was not kept after you left the page.</p>' : '') +
              (r.assessed ? '' : '<p class="iva__reason">' + REASONS[r.reason] + (a.audioUrl ? ' You can listen back to your recording and check it against the tips here.' : '') + '</p>') +
              (r.star ? '<h5>STAR parts we found</h5>' + starChips(r.star) : '') +
            '</div>' +
            '<div>' +
              (r.assessed ? '<p class="iva__label">' + esc(r.label) + '</p>' : '') +
              (r.strengths.length ? '<h5>What worked</h5><ul class="iva__list iva__list--good">' + r.strengths.map(function (s) {
                return '<li>' + icon('i-check') + '<span><b>' + esc(s.title) + '.</b> ' + esc(s.detail) + '</span></li>';
              }).join('') + '</ul>' : '') +
              (r.improve.length ? '<h5>To work on</h5><ul class="iva__list iva__list--tip">' + r.improve.map(function (s) {
                return '<li>' + icon('i-alert') + '<span><b>' + esc(s.title) + '.</b> ' + esc(s.detail) + '</span></li>';
              }).join('') + '</ul>' : '') +
            '</div>' +
          '</div>' +

          '<div class="iva__improve" data-iva-improve="' + a.id + '">' +
            '<h5>' + icon('i-pen') + 'Improve my answer</h5>' +
            (r.prompts && r.prompts.length ? '<ul class="iva__prompts">' + r.prompts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' :
              '<p class="iva__small">' + (r.assessed ? 'This answer covers the basics. You could still try a different example, or make it a little tighter.' : 'Type your answer below, then check it.') + '</p>') +
            '<label class="visually-hidden" for="iva-edit-' + a.id + '">Edit your answer</label>' +
            '<textarea id="iva-edit-' + a.id + '" rows="6" data-iva-edit>' + esc(a.text) + '</textarea>' +
            '<div class="iva__row"><button class="ivbtn ivbtn--sm" type="button" data-iva-check="' + a.id + '">' + icon('i-refresh') + 'Check again</button>' +
              '<p class="iva__delta" data-iva-delta role="status"></p></div>' +
          '</div>' +

          '<div class="iva__help">' +
            '<details><summary>Suggested structure</summary><ol>' + structure.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></details>' +
            '<details><summary>Example answer</summary>' +
              '<p class="iva__small">An example of the shape a good answer can take, not a script to learn. Use your own experience.</p>' +
              (typeof ex === 'string' ? '<p>' + esc(ex) + '</p>' :
                '<dl class="iva__star">' + ['s', 't', 'a', 'r'].map(function (k) {
                  return '<div><dt>' + { s: 'Situation', t: 'Task', a: 'Action', r: 'Result' }[k] + '</dt><dd>' + esc(ex[k]) + '</dd></div>';
                }).join('') + '</dl>') +
            '</details>' +
          '</div>' +
          '<button class="ivbtn ivbtn--light ivbtn--sm" type="button" data-ivw-try="' + a.id + '">' + icon('i-refresh') + 'Retry this question</button>' +
        '</div>' +
      '</details>' +
    '</li>';
  }

  function resultsHtml() {
    var l = state.latest;
    if (!l) {
      return '<div class="ivres">' +
        head('Your interview assessment', 'Your feedback will appear here once you have answered some questions.') +
        '<section class="ivs ivs--empty"><div class="ivs__ring-empty" aria-hidden="true">' + icon('i-bars') + '</div><div class="ivs__body">' +
          '<h3 class="ivs__label">No results yet</h3>' +
          '<p class="ivs__text">There’s nothing to score until you’ve practised. Try a full interview, or just one question.</p>' +
          '<div class="ivd__more ivd__more--left"><button class="ivbtn" type="button" data-ivw-start-full>Start a 5-question interview' + icon('i-arrow') + '</button>' +
          '<button class="ivbtn ivbtn--light" type="button" data-ivw-go="questions">Choose a question</button></div>' +
        '</div></section>' +
      '</div>';
    }
    var s = l.summary;
    var cmp = l.compare;
    var changes = cmp && cmp.changes.length ? '<ul class="ivs__changes">' + cmp.changes.slice(0, 3).map(function (c) {
      return '<li class="is-' + (c.delta > 0 ? 'up' : 'down') + '">Your ' + c.name.toLowerCase() + ' score ' + (c.delta > 0 ? 'improved' : 'dropped') + ' by ' + Math.abs(c.delta) + ' points since your previous attempt.</li>';
    }).join('') + '</ul>' : '';

    return '<div class="ivres">' +
      head('Your interview assessment', 'See how you performed and discover what you’re already doing well and where you can improve.') +
      '<div class="ivres__top">' +
      '<section class="ivs ivs--result" aria-labelledby="ivs-res">' +
        ringHtml(s.score, 'lg') +
        '<div class="ivs__body">' +
          '<h3 class="ivs__label" id="ivs-res">' + esc(s.label) + '</h3>' +
          '<p class="ivs__text">' + esc(s.summary) + '</p>' +
          (cmp ? '<p class="ivs__delta ivs__delta--' + (cmp.delta >= 0 ? 'up' : 'down') + '">' + (cmp.delta === 0 ? 'Same overall score as your previous attempt.' :
            (cmp.delta > 0 ? 'Up ' : 'Down ') + Math.abs(cmp.delta) + ' points on your previous attempt.') + '</p>' : '') +
          changes +
          '<p class="ivs__meta">' + (s.assessed < s.total ? s.assessed + ' of ' + plural(s.total, 'answer') + ' scored. ' : '') +
            'A practice feedback score, based only on the words in your answers. It is not a recruitment assessment.</p>' +
        '</div>' +
      '</section>' +
        (s.score != null ? catBarsHtml(s) : '') +
      '</div>' +

      (s.score != null ? '<h3 class="ivsec ivsec--line">What you did well</h3>' +
        (s.strengths.length ? '<ul class="ivf-list">' + s.strengths.map(function (f) { return feedbackCard(f, 'good'); }).join('') + '</ul>' :
          '<p class="ivres__none">Nothing stood out as a clear strength in these answers yet. Use the suggestions below and try again: each practice builds on the last.</p>') +
        (s.work.length ? '<h3 class="ivsec ivsec--line">Things to work on</h3><ul class="ivf-list">' + s.work.map(function (f) { return feedbackCard(f, 'work'); }).join('') + '</ul>' : '') : '') +

      '<h3 class="ivsec ivsec--line">Question by question</h3>' +
      '<ol class="iva-list">' + l.answers.map(answerHtml).join('') + '</ol>' +

      '<h3 class="ivsec ivsec--line">Your next steps</h3>' +
      '<ul class="ivnext">' + s.steps.map(function (st) {
        return '<li class="ivnext__item"><h4>' + esc(st.title) + '</h4><p>' + esc(st.detail) + '</p>' +
          '<button class="ivbtn ivbtn--sm" type="button" data-ivw-step="' + st.go + '">' + esc(st.action) + icon('i-arrow') + '</button></li>';
      }).join('') + '</ul>' +

      '<h3 class="ivsec ivsec--line">More ways to get job ready</h3>' +
      '<ul class="ivlinks">' +
        '<li><button type="button" data-ivw-tool="cv">' + icon('i-doc') + '<span><b>CV review</b>Get feedback on your CV</span></button></li>' +
        '<li><button type="button" data-ivw-tool="strengths">' + icon('i-muscle') + '<span><b>Discover your strengths</b>Build your personal profile</span></button></li>' +
        '<li><button type="button" data-ivw-go="dashboard">' + icon('i-home') + '<span><b>Interview dashboard</b>Your progress at a glance</span></button></li>' +
        '<li><button type="button" data-ivw-go="questions">' + icon('i-list') + '<span><b>Common mock questions</b>All 45 questions</span></button></li>' +
      '</ul>' +
    '</div>';
  }

  /** Re-check one edited answer and refresh the session's feedback. */
  function recheck(id) {
    var l = state.latest;
    var a = l.answers.filter(function (x) { return x.id === id; })[0];
    var box = $('#iva-' + id + ' [data-iva-edit]', pageEl);
    if (!a || !box) {
      return;
    }
    var before = a.result.assessed ? a.result.score : null;
    a.text = box.value.trim();
    a.guided = false;
    a.result = A.analyseAnswer(Q.byId(id), a.text, a.source);
    l.summary = A.analyseSession(l.answers);
    var prevHistory = previousSession();
    l.compare = A.compare(prevHistory, l.summary);
    var h = state.history[state.history.length - 1];
    if (h && h.id === l.id) {
      h.score = l.summary.score;
      h.categories = l.summary.categories;
      h.assessed = l.summary.assessed;
    }
    var t = state.attempts[id];
    if (t && a.result.assessed) {
      t.last = a.result.score;
      t.best = t.best == null ? a.result.score : Math.max(t.best, a.result.score);
    }
    persist();
    var y = main.scrollTop;
    go('results', { keepScroll: true, focus: '#iva-' + id + ' [data-iva-delta]' });
    main.scrollTop = y;
    var det = $('#iva-' + id + ' details', pageEl);
    $$('.iva details', pageEl).forEach(function (d) { d.open = d === det; });
    var msg = !a.result.assessed ? 'Not scored yet: ' + REASONS[a.result.reason].toLowerCase() :
      before == null ? 'Scored ' + a.result.score + ' out of 100.' :
        a.result.score === before ? 'Still ' + a.result.score + '. Try one of the suggestions above.' :
          'Score: ' + before + ' to ' + a.result.score + (a.result.score > before ? '. Nice improvement!' : '.');
    var out = $('#iva-' + id + ' [data-iva-delta]', pageEl);
    if (out) {
      out.textContent = msg;
      out.classList.toggle('is-up', before != null && a.result.score > before);
    }
  }

  function runStep(go_) {
    if (go_ === 'star' || go_ === 'detail') {
      startFocused(go_);
    } else if (go_ === 'session') {
      startFull();
    } else if (go_ === 'retry') {
      var worst = state.latest && state.latest.answers.filter(function (a) { return a.result.assessed; })
        .sort(function (x, y) { return x.result.score - y.result.score; })[0];
      if (worst) {
        startSingle(worst.id);
      } else {
        go('questions');
      }
    } else if (go_ === 'review') {
      var first = state.latest && state.latest.answers.filter(function (a) { return !a.result.assessed; })[0];
      if (first) {
        var det = $('#iva-' + first.id + ' details', pageEl);
        if (det) {
          det.open = true;
          var box = $('[data-iva-edit]', det);
          det.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
          if (box) {
            box.focus({ preventScroll: true });
          }
        }
      }
    }
  }

  function openTool(name) {
    close();
    if (name === 'cv') {
      var btn = document.querySelector('[data-cv-open]');
      if (btn) {
        btn.click();
      }
    } else if (name === 'strengths') {
      var q = document.querySelector('[data-qnw-open]');
      if (q) {
        q.click();
      }
    }
  }


  /* ------------------------------------------------------------------------
     8. EVENTS
     ------------------------------------------------------------------------ */

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-ivw-open]');
    if (opener) {
      e.preventDefault();
      open(opener);
    }
  });

  dialog.addEventListener('click', function (e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-ivw-close]'))) {
      close();
    } else if ((el = t.closest('[data-ivw-go]'))) {
      go(el.getAttribute('data-ivw-go'));
    } else if (t.closest('[data-ivw-start]')) {
      if (state.session) {
        go('session', { focus: '.ivp__q' });
      } else {
        startFull();
      }
    } else if (t.closest('[data-ivw-start-full]')) {
      startFull();
    } else if (t.closest('[data-ivw-restart]')) {
      // A fresh interview in place of the one under way.
      var cur = state.session;
      var begun = cur && cur.ids.some(function (id) { return answerText(cur.answers[id]) || cur.answers[id].audioUrl; });
      if (begun && !window.confirm('Start a new interview? Your answers so far will not be scored.')) {
        return;
      }
      saveDraft();
      stopRecording(true);
      releaseAudio(cur);
      state.session = null;
      startFull();
    } else if ((el = t.closest('[data-ivw-try]'))) {
      if (state.session && !window.confirm('Start this question instead of finishing your current interview?')) {
        return;
      }
      startSingle(el.getAttribute('data-ivw-try'));
    } else if ((el = t.closest('[data-ivw-cat]'))) {
      if (state.session && !window.confirm('Start a new practice instead of finishing your current interview?')) {
        return;
      }
      startCategory(el.getAttribute('data-ivw-cat'));
    } else if ((el = t.closest('[data-ivp-jump]'))) {
      saveDraft();
      stopRecording(false);
      state.session.index = parseInt(el.getAttribute('data-ivp-jump'), 10);
      go('session', { focus: '.ivp__q' });
    } else if ((el = t.closest('[data-ivw-step]'))) {
      runStep(el.getAttribute('data-ivw-step'));
    } else if ((el = t.closest('[data-ivw-tool]'))) {
      openTool(el.getAttribute('data-ivw-tool'));
    } else if (t.closest('[data-ivw-clear]')) {
      if (window.confirm('Delete all your practice answers, scores and history? This cannot be undone.')) {
        clearProgress();
      }
    } else if (t === tab || t.closest('[data-ivw-tab]')) {
      setDrawer(!dialog.classList.contains('is-menu-open'));
    } else if (t === scrim) {
      setDrawer(false);
    } else if ((el = t.closest('[data-ivl-view]'))) {
      state.view = el.getAttribute('data-ivl-view');
      try {
        window.sessionStorage.setItem(VIEW_KEY, state.view);
      } catch (err) { /* remembered until the page closes */ }
      $$('[data-ivl-view]', pageEl).forEach(function (b) {
        b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
      });
      renderList();
    } else if ((el = t.closest('[data-ivl-toggle]'))) {
      var key = el.getAttribute('data-ivl-toggle');
      state.filters[key] = !state.filters[key];
      el.setAttribute('aria-pressed', String(state.filters[key]));
      renderList();
      say($('[data-ivl-count]', pageEl).textContent);
    } else if (t.closest('[data-ivl-reset]')) {
      state.filters = { q: '', cat: '', level: '', star: false, tried: false };
      go('questions', { keepScroll: true });
    } else if (t.closest('[data-ivl-more]')) {
      main.scrollBy({ top: main.clientHeight * 0.7, behavior: reduce.matches ? 'auto' : 'smooth' });
    } else if (t.closest('[data-ivp-record]')) {
      if (rec.on) {
        stopRecording(false);
      } else {
        startRecording();
      }
    } else if (t.closest('[data-ivp-delete]')) {
      var a = currentAnswer();
      if (a && a.audioUrl) {
        URL.revokeObjectURL(a.audioUrl);
        a.audioUrl = null;
        a.audioLength = 0;
        refreshRecorder();
        updateWordCount();
        say('Recording deleted.');
      }
    } else if (t.closest('[data-ivp-next]')) {
      step(1);
    } else if (t.closest('[data-ivp-back]')) {
      step(-1);
    } else if (t.closest('[data-ivp-exit]')) {
      exitSession();
    } else if ((el = t.closest('[data-iva-check]'))) {
      recheck(el.getAttribute('data-iva-check'));
    }
  });

  dialog.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches('[data-ivl-filter="q"]')) {
      state.filters.q = t.value;
      renderList();
    } else if (t.matches('[data-ivp-text], [data-ivp-part]')) {
      updateWordCount();
    }
  });

  dialog.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('select[data-ivl-filter]')) {
      state.filters[t.getAttribute('data-ivl-filter')] = t.value;
      renderList();
      say($('[data-ivl-count]', pageEl).textContent);
    } else if (t.matches('[data-ivw-save]')) {
      setSave(t.checked);
      showToast(t.checked ? '<b>Saved on this device.</b> Turn this off at any time to delete it.' : '<b>Not saving.</b> Anything stored on this device has been deleted.');
    } else if (t.matches('[data-ivp-speech]')) {
      speechOn = t.checked;
      // The change comes from a tap, so the recogniser may start here.
      switchSpeech();
    } else if (t.matches('[data-ivp-guided]')) {
      var a = currentAnswer();
      saveDraft();
      // Switching never loses an answer: four parts go back into the
      // single box when it is empty, and the box is kept as it was.
      if (!t.checked && !a.text.trim()) {
        a.text = answerText({ guided: true, parts: a.parts });
      }
      a.guided = t.checked;
      var y = main.scrollTop;
      go('session', { keepScroll: true, focus: t.checked ? '[data-ivp-part="s"]' : '[data-ivp-text]' });
      main.scrollTop = y;
    }
  });

  main.addEventListener('scroll', function () {
    if (state.page === 'questions') {
      updateMore();
    }
  }, { passive: true });

  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.classList.contains('is-menu-open')) {
      e.preventDefault();
      setDrawer(false);
      tab.focus();
    }
  });

  dialog.addEventListener('cancel', function (e) {
    if (rec.on) {
      // Escape while recording stops the recording first.
      e.preventDefault();
      stopRecording(false);
    }
  });

  window.addEventListener('pagehide', function () {
    stopRecording(true);
  });

  load();
}());

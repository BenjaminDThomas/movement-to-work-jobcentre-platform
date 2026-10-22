/* ==========================================================================
   MOVEMENT TO WORK: CV REVIEW
   The upload dialog and the full-screen review. Files are read in the
   browser (PDF.js for PDFs, Mammoth for Word files, both bundled in
   js/vendor and only loaded when needed); the analysis is the rule-based
   code in cv-analyser.js. Nothing leaves the device, and nothing is kept
   once the review is closed.
   ========================================================================== */

(function () {
  'use strict';

  var A = window.MTWCV;
  var upload = document.querySelector('[data-cvu]');
  var review = document.querySelector('[data-cvr]');
  if (!A || !upload || !review) {
    return;
  }

  var MAX_BYTES = 5 * 1024 * 1024;
  var VENDOR = '../js/vendor/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  var SECTIONS = [
    { key: 'overview', name: 'Overview', icon: 'i-star' },
    { key: 'header', name: 'Header', label: 'Your details',
      intro: 'Your name and contact details, so employers know who you are and how to reach you.' },
    { key: 'experience', name: 'Experience', label: 'Your experience',
      intro: 'Highlight your experience, responsibilities and the impact you’ve made, to help employers see what you can bring to the role.' },
    { key: 'education', name: 'Education', label: 'Your education',
      intro: 'Your qualifications and where you studied, so employers can check you meet what the role asks for.' },
    { key: 'skills', name: 'Skills', label: 'Your skills',
      intro: 'The practical and people skills you can offer, shown in a list employers can scan in seconds.' },
    { key: 'summary', name: 'Summary', label: 'Your summary',
      intro: 'A few sentences at the top that sum up who you are, what you do well and what you’re looking for.' },
    { key: 'other', name: 'Other Sections', label: 'Other sections',
      intro: 'Interests, achievements and anything else, plus how easy the whole CV is to read.' }
  ];

  var LEVEL = {
    good: { word: 'Working well', icon: 'i-check' },
    tip: { word: 'Suggestion', icon: 'i-alert' },
    fix: { word: 'Needs fixing', icon: 'i-alert' }
  };

  var state = {
    cv: null,          // the sections, as the reader has edited them
    fields: null,      // header fields
    result: null,      // the latest analysis
    page: 'overview',
    seen: {},
    opener: null,
    doc: null,         // the uploaded file as a picture: page images or HTML
    wide: false        // overview: score panel tucked away, CV enlarged
  };


  /* ------------------------------------------------------------------------
     1. HELPERS
     ------------------------------------------------------------------------ */

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function icon(id, cls) {
    return '<svg class="' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#' + id + '" /></svg>';
  }

  function wait(ms) {
    return new Promise(function (r) { window.setTimeout(r, reduce.matches ? 0 : ms); });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.ready) {
          resolve();
        } else {
          existing.addEventListener('load', function () { resolve(); });
          existing.addEventListener('error', reject);
        }
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.src = src;
      s.onload = function () { s.dataset.ready = '1'; resolve(); };
      s.onerror = function () { reject(new Error('load')); };
      document.head.appendChild(s);
    });
  }

  function levelOf(score) {
    return score >= 8 ? 'good' : score >= 5 ? 'tip' : 'fix';
  }


  /* ------------------------------------------------------------------------
     2. READING FILES
     ------------------------------------------------------------------------ */

  function friendly(code) {
    return {
      type: 'Please choose a PDF or Word (.docx) file. Older .doc files can be saved as .docx from Word.',
      size: 'That file is over 5MB. Please choose a smaller one, or save it as a PDF to reduce its size.',
      empty: 'That file is empty. Please check it and try again.',
      scanned: 'We couldn’t find any text in this file. It may be a scanned image or a photo of a CV. Please upload a version you can select text in (for example, saved as PDF from Word).',
      password: 'This PDF is password protected. Please remove the password and try again.',
      corrupt: 'We couldn’t open this file. It may be damaged. Please try saving it again.',
      library: 'We couldn’t load the file reader. Please check your connection to this website and try again.'
    }[code] || 'Something went wrong reading that file. Please try again.';
  }

  function fail(code) {
    var e = new Error(code);
    e.code = code;
    return e;
  }

  function checkFile(file) {
    var name = (file.name || '').toLowerCase();
    var isPdf = /\.pdf$/.test(name) || file.type === 'application/pdf';
    var isDocx = /\.docx$/.test(name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (!isPdf && !isDocx) {
      throw fail('type');
    }
    if (file.size === 0) {
      throw fail('empty');
    }
    if (file.size > MAX_BYTES) {
      throw fail('size');
    }
    return isPdf ? 'pdf' : 'docx';
  }

  /** PDF: rebuild each line from the position of every piece of text.
   *  Pieces are joined with a space only when there is a real gap between
   *  them, so kerned words ("inform" + "ation") stay whole. Each line keeps
   *  its page and height, so notes can be pinned beside it later. */
  function pdfRows(content, view, pageIndex) {
    var rows = [];
    var cur = null;
    var height = view[3] - view[1];
    content.items.forEach(function (it) {
      if (!it.transform) {
        return;
      }
      var t = it.transform;
      var x = t[4];
      var y = t[5];
      var size = Math.hypot(t[2], t[3]) || Math.abs(t[0]) || 10;
      if (!it.str) {
        if (it.hasEOL && cur) {
          cur.eol = true;
        }
        return;
      }
      var newRow = !cur || cur.eol || Math.abs(y - cur.y) > size * 0.5 || x < cur.end - size * 1.5;
      if (newRow) {
        cur = { text: '', y: y, end: x, size: size, page: pageIndex };
        rows.push(cur);
      } else if (x - cur.end > size * 0.12 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) {
        cur.text += ' ';
      }
      cur.text += it.str;
      cur.end = x + (it.width || 0);
      if (it.hasEOL) {
        cur.eol = true;
      }
    });
    return rows.map(function (r) {
      return {
        text: r.text.replace(/\s+/g, ' ').trim(),
        page: r.page,
        size: r.size,
        top: Math.min(1, Math.max(0, 1 - (r.y + r.size * 0.85 - view[1]) / height))
      };
    }).filter(function (r) { return r.text; });
  }

  /** Short lines set in larger text than the body: likely headings. The
   *  body size is the one most of the text is set in. */
  function largerRows(rows) {
    var weight = {};
    rows.forEach(function (r) {
      var k = Math.round(r.size * 2) / 2;
      weight[k] = (weight[k] || 0) + r.text.length;
    });
    var body = Number(Object.keys(weight).sort(function (a, b) { return weight[b] - weight[a]; })[0]) || 10;
    return rows.filter(function (r, i) {
      return i > 0 && r.size >= body * 1.12 && r.text.length <= 60;
    }).map(function (r) { return r.text; });
  }

  function pageImage(page) {
    var base = page.getViewport({ scale: 1 });
    var scale = Math.min(2.4, 1400 / base.width);
    var vp = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return page.render({ canvasContext: ctx, viewport: vp }).promise.then(function () {
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve({ url: URL.createObjectURL(blob), ratio: canvas.height / canvas.width });
        }, 'image/jpeg', 0.9);
      });
    });
  }

  function readPdf(buffer) {
    return loadScript(VENDOR + 'pdf.min.js').catch(function () { throw fail('library'); }).then(function () {
      var lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.min.js';
      return lib.getDocument({ data: buffer, isEvalSupported: false }).promise;
    }).catch(function (err) {
      if (err && err.code) {
        throw err;
      }
      throw fail(err && err.name === 'PasswordException' ? 'password' : 'corrupt');
    }).then(function (pdf) {
      var jobs = [];
      for (var i = 1; i <= Math.min(pdf.numPages, 6); i++) {
        jobs.push(pdf.getPage(i).then(function (page) {
          return page.getTextContent().then(function (content) {
            return { page: page, rows: pdfRows(content, page.view, page.pageNumber - 1) };
          });
        }));
      }
      return Promise.all(jobs);
    }).then(function (pages) {
      var rows = [];
      pages.forEach(function (p) { rows = rows.concat(p.rows); });
      var text = rows.map(function (r) { return r.text; }).join('\n');
      var styled = largerRows(rows);
      if (!hasWords(text)) {
        return { text: text, doc: null, styled: styled };
      }
      return Promise.all(pages.map(function (p) { return pageImage(p.page); })).then(function (images) {
        return { text: text, doc: { kind: 'pdf', pages: images, rows: rows }, styled: styled };
      }, function () {
        return { text: text, doc: null, styled: styled };
      });
    });
  }

  /** Word: Mammoth gives the text, and HTML that keeps the document's
   *  headings, lists and tables, shown as the picture of the CV. */
  function cleanHtml(html) {
    var box = document.createElement('div');
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('script, style, iframe, object, embed, form'), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(box.querySelectorAll('*'), function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var keep = (a.name === 'src' && el.tagName === 'IMG' && /^data:image\//.test(a.value)) ||
          a.name === 'alt' || a.name === 'colspan' || a.name === 'rowspan';
        if (!keep) {
          el.removeAttribute(a.name);
        }
      });
    });
    return box.innerHTML;
  }

  /** Word headings, and paragraphs that are all bold, as heading hints. */
  function docxHeadings(html) {
    var box = document.createElement('div');
    box.innerHTML = html;
    var out = [];
    Array.prototype.forEach.call(box.querySelectorAll('h1, h2, h3, h4, h5, h6, p'), function (el) {
      var t = el.textContent.trim();
      if (!t || t.length > 60) {
        return;
      }
      var strong = el.querySelector('strong, b');
      if (/^H/.test(el.tagName) || (strong && strong.textContent.trim() === t)) {
        out.push(t);
      }
    });
    return out;
  }

  function readDocx(buffer) {
    return loadScript(VENDOR + 'mammoth.browser.min.js').catch(function () { throw fail('library'); }).then(function () {
      return Promise.all([
        window.mammoth.extractRawText({ arrayBuffer: buffer }),
        window.mammoth.convertToHtml({ arrayBuffer: buffer }).catch(function () { return null; })
      ]);
    }).catch(function (err) {
      if (err && err.code) {
        throw err;
      }
      throw fail('corrupt');
    }).then(function (res) {
      var html = res[1] && res[1].value ? cleanHtml(res[1].value) : '';
      return {
        text: res[0].value.replace(/\n{2,}/g, '\n'),
        doc: html ? { kind: 'docx', html: html } : null,
        styled: html ? docxHeadings(html) : []
      };
    });
  }

  function hasWords(text) {
    return (text.match(/[A-Za-z]{2,}/g) || []).length >= 12;
  }

  function readFile(file, kind) {
    return file.arrayBuffer().then(function (buf) {
      return kind === 'pdf' ? readPdf(buf) : readDocx(buf);
    }).then(function (out) {
      var clean = out.text.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim();
      if (!hasWords(clean)) {
        // A PDF with pages but no text is almost always a scan or a photo.
        throw fail(kind === 'pdf' || clean.length ? 'scanned' : 'empty');
      }
      if (out.doc) {
        out.doc.name = file.name;
      }
      return { text: clean, doc: out.doc, styled: out.styled || [] };
    });
  }




  /* ------------------------------------------------------------------------
     3. UPLOAD DIALOG
     ------------------------------------------------------------------------ */

  var drop = $('[data-cvu-drop]', upload);
  var input = $('[data-cvu-input]', upload);
  var work = $('[data-cvu-work]', upload);
  var done = $('[data-cvu-done]', upload);
  var errorBox = $('[data-cvu-error]', upload);
  var live = $('[data-cvu-live]', upload);
  var bar = $('[data-cvu-bar]', upload);
  var steps = Array.prototype.slice.call(upload.querySelectorAll('[data-cvu-steps] li'));
  var goBtn = $('[data-cvu-go]', upload);
  var busy = false;

  function resetUpload() {
    busy = false;
    drop.hidden = false;
    work.hidden = true;
    done.hidden = true;
    goBtn.hidden = true;
    errorBox.hidden = true;
    errorBox.textContent = '';
    input.value = '';
    drop.classList.remove('is-over');
    upload.classList.remove('is-busy');
  }

  function openUpload(opener) {
    state.opener = opener || document.activeElement;
    resetUpload();
    if (!upload.open) {
      upload.showModal();
    }
  }

  function closeUpload() {
    if (busy) {
      return;
    }
    upload.close();
  }

  upload.addEventListener('close', function () {
    if (!review.open && state.opener && state.opener.focus) {
      state.opener.focus();
    }
  });

  function showError(code) {
    busy = false;
    upload.classList.remove('is-busy');
    work.hidden = true;
    drop.hidden = false;
    errorBox.hidden = false;
    errorBox.textContent = friendly(code);
    live.textContent = '';
  }

  function setStep(i, total) {
    steps.forEach(function (li, n) {
      li.classList.toggle('is-done', n < i);
      li.classList.toggle('is-now', n === i);
    });
    bar.style.width = Math.round((i / total) * 100) + '%';
    if (steps[i]) {
      live.textContent = steps[i].textContent;
    }
  }

  function begin(name, getText) {
    if (busy) {
      return;
    }
    busy = true;
    upload.classList.add('is-busy');
    errorBox.hidden = true;
    drop.hidden = true;
    done.hidden = true;
    work.hidden = false;
    $('[data-cvu-name]', upload).textContent = name;
    setStep(0, 4);
    var text;
    var doc;
    var styled;
    getText().then(function (out) {
      text = out.text;
      doc = out.doc;
      styled = out.styled;
      setStep(1, 4);
      return wait(350);
    }).then(function () {
      var cv = A.readSections(text, styled);
      start(cv, doc);
      setStep(2, 4);
      return wait(350);
    }).then(function () {
      setStep(3, 4);
      return wait(350);
    }).then(function () {
      setStep(4, 4);
      busy = false;
      upload.classList.remove('is-busy');
      work.hidden = true;
      done.hidden = false;
      goBtn.hidden = false;
      var found = SECTIONS.filter(function (s) {
        return s.key !== 'overview' && s.key !== 'header' && s.key !== 'other' && state.cv[s.key].trim();
      }).map(function (s) { return s.name.toLowerCase(); });
      $('[data-cvu-summary]', upload).textContent = found.length ?
        'We found your ' + found.join(', ').replace(/, ([^,]*)$/, ' and $1') + '. Your score is ' + state.result.score + ' out of 100.' :
        'We couldn’t find the usual section headings, so you can sort your details in the review. Your score is ' + state.result.score + ' out of 100.';
      live.textContent = 'Your CV is ready to review. ' + $('[data-cvu-summary]', upload).textContent;
      goBtn.focus();
    }).catch(function (err) {
      showError(err && err.code ? err.code : 'corrupt');
    });
  }

  function takeFile(file) {
    if (!file) {
      return;
    }
    var kind;
    try {
      kind = checkFile(file);
    } catch (e) {
      showError(e.code);
      return;
    }
    begin(file.name, function () { return readFile(file, kind); });
  }

  input.addEventListener('change', function () {
    takeFile(input.files && input.files[0]);
  });

  ['dragenter', 'dragover'].forEach(function (type) {
    drop.addEventListener(type, function (e) {
      e.preventDefault();
      drop.classList.add('is-over');
    });
  });
  ['dragleave', 'drop'].forEach(function (type) {
    drop.addEventListener(type, function (e) {
      e.preventDefault();
      drop.classList.remove('is-over');
    });
  });
  drop.addEventListener('drop', function (e) {
    takeFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  upload.addEventListener('click', function (e) {
    if (e.target === upload || e.target.closest('[data-cvu-close]')) {
      closeUpload();
    } else if (e.target.closest('[data-cvu-go]')) {
      upload.close();
      openReview();
    }
  });
  upload.addEventListener('cancel', function (e) {
    if (busy) {
      e.preventDefault();
    }
  });

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-cv-open]');
    if (opener) {
      e.preventDefault();
      openUpload(opener);
    }
  });


  /* ------------------------------------------------------------------------
     4. STATE AND ANALYSIS
     ------------------------------------------------------------------------ */

  function freeDoc() {
    if (state.doc && state.doc.pages) {
      state.doc.pages.forEach(function (p) { URL.revokeObjectURL(p.url); });
    }
    state.doc = null;
  }

  function start(cv, doc) {
    freeDoc();
    state.doc = doc || null;
    var head = A.readHeader(cv.header);
    // Anything in the header block that isn't one of the fields is kept.
    var extra = cv.header.split('\n').map(function (l) { return l.trim(); }).filter(function (l) {
      return l && [head.name, head.title, head.location].indexOf(l) === -1 &&
        !(head.email && l.indexOf(head.email) !== -1) && !(head.phone && l.indexOf(head.phone) !== -1);
    });
    state.fields = {
      name: head.name, title: head.title, email: head.email,
      phone: head.phone, location: head.location, extra: extra.join('\n')
    };
    state.cv = cv;
    state.seen = {};
    state.page = 'overview';
    state.history = [];
    analyse();
  }

  function headerText() {
    var f = state.fields;
    return [f.name, f.title, [f.email, f.phone].filter(Boolean).join(' | '), f.location, f.extra]
      .filter(function (l) { return l && l.trim(); }).join('\n');
  }

  function analyse() {
    state.cv.header = headerText();
    state.result = A.analyse(state.cv);
    return state.result;
  }


  /* ------------------------------------------------------------------------
     5. REVIEW: SHELL
     ------------------------------------------------------------------------ */

  var nav = $('[data-cvr-nav]', review);
  var pageEl = $('[data-cvr-page]', review);
  var main = $('[data-cvr-main]', review);
  var side = $('[data-cvr-side]', review);
  var tab = $('[data-cvr-tab]', review);
  var scrim = $('[data-cvr-scrim]', review);
  var toast = $('[data-cvr-toast]', review);
  var toastTimer = 0;

  /* Upload a different CV without leaving the review. */
  var fileInput = $('[data-cvr-file]', review);
  var busyEl = $('[data-cvr-busy]', review);

  function swapFile(file) {
    if (!file) {
      return;
    }
    var kind;
    try {
      kind = checkFile(file);
    } catch (e) {
      showToast('<b>Couldn’t use that file.</b> ' + esc(friendly(e.code)));
      return;
    }
    readEditors();
    busyEl.hidden = false;
    $('[data-cvr-busy-name]', review).textContent = file.name;
    readFile(file, kind).then(function (out) {
      var before = state.result ? state.result.score : null;
      start(A.readSections(out.text, out.styled), out.doc);
      busyEl.hidden = true;
      go('overview');
      showToast('<b>New CV loaded</b> · ' + state.result.score + ' out of 100' +
        (before !== null ? ' (was ' + before + ')' : '') + '.');
    }).catch(function (err) {
      busyEl.hidden = true;
      showToast('<b>Couldn’t read that file.</b> ' + esc(friendly(err && err.code ? err.code : 'corrupt')));
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      swapFile(fileInput.files && fileInput.files[0]);
    });
  }

  function openReview() {
    document.documentElement.classList.add('has-cvr');
    if (!review.open) {
      review.showModal();
    }
    go(state.page || 'overview', true);
  }

  function closeReview() {
    review.close();
  }

  review.addEventListener('close', function () {
    document.documentElement.classList.remove('has-cvr');
    setDrawer(false);
    // Nothing is kept once the review is closed.
    state.cv = null;
    state.result = null;
    freeDoc();
    pageEl.innerHTML = '';
    if (state.opener && state.opener.focus) {
      state.opener.focus();
    }
  });

  function setDrawer(open) {
    review.classList.toggle('is-menu-open', open);
    tab.setAttribute('aria-expanded', open ? 'true' : 'false');
    scrim.hidden = !open;
    if (open) {
      var current = nav.querySelector('[aria-current="page"]') || nav.querySelector('button');
      if (current) {
        current.focus();
      }
    }
  }

  function renderNav() {
    var r = state.result;
    nav.innerHTML = SECTIONS.map(function (s) {
      var status = s.key === 'overview' ? '' : levelOf(r.sections[s.key]);
      var mark = s.key === 'overview' ?
        '<span class="cvr__mark cvr__mark--star">' + icon('i-star') + '</span>' :
        '<span class="cvr__mark cvr__mark--' + status + '">' + icon(LEVEL[status].icon) + '</span>';
      var label = s.key === 'overview' ? '' :
        '<span class="visually-hidden">, ' + LEVEL[status].word.toLowerCase() + ', ' + r.sections[s.key] + ' out of 10</span>';
      return '<li><button type="button" data-go="' + s.key + '"' + (state.page === s.key ? ' aria-current="page"' : '') + '>' +
        mark + '<span class="cvr__nav-name">' + s.name + label + '</span>' + icon('i-chevron', 'cvr__chev') + '</button></li>';
    }).join('');
    var seen = Object.keys(state.seen).length;
    $('[data-cvr-seen]', review).textContent = seen;
    $('[data-cvr-seenbar]', review).style.width = (seen / 6 * 100) + '%';
  }

  function go(key, first) {
    state.page = key;
    if (key !== 'overview') {
      state.seen[key] = true;
    }
    renderNav();
    pageEl.innerHTML = key === 'overview' ? overviewHtml() : sectionHtml(key);
    pageEl.classList.remove('is-entering');
    void pageEl.offsetWidth;
    pageEl.classList.add('is-entering');
    main.scrollTop = 0;
    setDrawer(false);
    var h = pageEl.querySelector('h2');
    if (h && !first) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    } else if (first) {
      main.focus({ preventScroll: true });
    }
    if (key === 'overview') {
      animateRing();
      watchDoc();
    }
  }

  function showToast(html) {
    toast.innerHTML = html;
    toast.hidden = false;
    toast.classList.remove('is-out');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.add('is-out');
      window.setTimeout(function () { toast.hidden = true; }, 400);
    }, 3200);
  }

  function rescore() {
    readEditors();
    var before = state.result.score;
    analyse();
    var after = state.result.score;
    go(state.page);
    var diff = after - before;
    showToast(diff > 0 ?
      '<b>Score up ' + diff + '</b> · now ' + after + ' out of 100. Nice work.' :
      diff < 0 ? '<b>Score down ' + (-diff) + '</b> · now ' + after + ' out of 100.' :
        '<b>Re-scored</b> · still ' + after + ' out of 100.');
  }

  review.addEventListener('click', function (e) {
    var t = e.target;
    var goEl = t.closest('[data-go]');
    if (goEl) {
      readEditors();
      go(goEl.getAttribute('data-go'));
      return;
    }
    if (t.closest('[data-cvr-close]')) {
      closeReview();
    } else if (t.closest('[data-cvr-rescore]')) {
      rescore();
    } else if (t.closest('[data-cvr-upload]')) {
      fileInput.value = '';
      fileInput.click();
    } else if (t.closest('[data-cvd-zoom]') || t.closest('[data-cvo-min]')) {
      setWide(!state.wide);
    } else if (t.closest('[data-cvo-show]')) {
      setWide(false);
    } else if (t.closest('[data-cvr-tab]')) {
      setDrawer(!review.classList.contains('is-menu-open'));
    } else if (t.closest('[data-cvr-scrim]')) {
      setDrawer(false);
    } else if (t.closest('[data-cvr-add-other]')) {
      readEditors();
      state.cv.other.push({ title: 'New section', text: '' });
      go('other');
      var titles = pageEl.querySelectorAll('[data-other-title]');
      if (titles.length) {
        titles[titles.length - 1].select();
      }
    } else if (t.closest('[data-cvr-remove-other]')) {
      readEditors();
      state.cv.other.splice(parseInt(t.closest('[data-cvr-remove-other]').getAttribute('data-cvr-remove-other'), 10), 1);
      go('other');
    } else if (t.closest('[data-cvr-start]')) {
      go(worstSection());
    }
  });

  review.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && review.classList.contains('is-menu-open')) {
      e.preventDefault();
      setDrawer(false);
      tab.focus();
    }
  });

  function worstSection() {
    var r = state.result;
    var keys = ['header', 'experience', 'education', 'skills', 'summary', 'other'];
    return keys.slice().sort(function (a, b) { return r.sections[a] - r.sections[b]; })[0];
  }


  /* ------------------------------------------------------------------------
     6. OVERVIEW PAGE
     ------------------------------------------------------------------------ */

  function topFinding(key) {
    var list = state.result.findings[key] || [];
    return list.filter(function (f) { return f.level === 'fix'; })[0] ||
      list.filter(function (f) { return f.level === 'tip'; })[0] ||
      list.filter(function (f) { return f.level === 'good'; })[0];
  }

  function noteHtml(key) {
    var f = topFinding(key);
    if (!f) {
      return '';
    }
    return '<button type="button" class="cvn cvn--' + f.level + '" data-go="' + key + '">' +
      '<span class="cvn__mark">' + icon(LEVEL[f.level].icon) + '</span>' +
      '<span class="cvn__copy"><b>' + esc(f.title) + '</b>' + esc(shorten(f.detail, 70)) + '</span></button>';
  }

  function shorten(s, n) {
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  }

  /* --- The uploaded CV, as a picture, with notes pinned beside it -------- */
  var NOTE_KEYS = ['header', 'summary', 'experience', 'education', 'skills', 'other'];

  function docHtml() {
    var d = state.doc;
    var body;
    if (d && d.kind === 'pdf') {
      body = d.pages.map(function (p, i) {
        return '<img class="cvd__page" src="' + p.url + '" alt="' + (i === 0 ? 'Page 1 of your CV' : 'Page ' + (i + 1)) + '" data-css="aspect-ratio: 1 / ' + p.ratio.toFixed(4) + '">';
      }).join('');
    } else if (d && d.kind === 'docx') {
      body = '<div class="cvd__word">' + d.html + '</div>';
    } else {
      // No picture could be made: show the text as we read it.
      body = '<div class="cvd__word cvd__word--text">' + A.logicalLines(A.fullText(state.cv)).map(function (l) {
        return '<p>' + esc(l) + '</p>';
      }).join('') + '</div>';
    }
    var notes = NOTE_KEYS.map(function (k) { return noteHtml(k); }).join('');
    return '<section class="cvd" aria-label="Your CV">' +
      '<div class="cvd__bar"><p class="cvd__file">' + icon('i-file') + '<span>' + esc(d && d.name ? d.name : 'Your CV') + '</span></p>' +
        '<button type="button" class="cvd__zoom" data-cvd-zoom aria-pressed="' + state.wide + '">' + zoomLabel(state.wide) + '</button></div>' +
      '<p class="cvd__note">This is the CV you uploaded. Changes you make in each section are scored, but not drawn here.</p>' +
      '<div class="cvd__stage" data-cvd-stage><div class="cvd__doc" data-cvd-doc>' + body + '</div>' +
      '<div class="cvd__notes" data-cvd-notes>' + notes + '</div></div></section>';
  }

  /** Where each section's heading sits in the picture, in pixels. */
  function anchors() {
    var d = state.doc;
    var docEl = pageEl.querySelector('[data-cvd-doc]');
    var found = {};
    if (!docEl) {
      return found;
    }
    found.header = 0;
    // Where each section starts: the heading line the reader used, or the
    // first line of a section it found without a heading.
    var marks = {};
    var key = function (t) { return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60); };
    var cvMarks = (state.cv && state.cv.marks) || {};
    Object.keys(cvMarks).forEach(function (k) { marks[key(cvMarks[k])] = k; });
    function kindOf(t) {
      var k = marks[key(t)];
      return k || A.headingKind(t);
    }
    if (d && d.kind === 'pdf') {
      var imgs = docEl.querySelectorAll('.cvd__page');
      var offsets = [];
      var y = 0;
      Array.prototype.forEach.call(imgs, function (img) {
        offsets.push({ top: y, h: img.offsetHeight });
        y += img.offsetHeight;
      });
      d.rows.forEach(function (r) {
        var kind = kindOf(r.text);
        if (kind && found[kind] === undefined && offsets[r.page]) {
          found[kind] = offsets[r.page].top + r.top * offsets[r.page].h;
        }
      });
    } else {
      Array.prototype.forEach.call(docEl.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td'), function (el) {
        var kind = kindOf(el.textContent.trim());
        if (kind && found[kind] === undefined) {
          found[kind] = el.offsetTop;
        }
      });
    }
    return found;
  }

  /** Pin each note beside its section, and keep them from overlapping. */
  function layoutNotes() {
    var box = pageEl.querySelector('[data-cvd-notes]');
    if (!box) {
      return;
    }
    var at = anchors();
    var notes = Array.prototype.slice.call(box.children);
    var last = 0;
    var placed = notes.map(function (n, i) {
      var key = n.getAttribute('data-go');
      // A section we could not find sits just after the one before it.
      return { el: n, y: at[key] !== undefined ? at[key] : null, order: i };
    });
    var prevY = 0;
    placed.forEach(function (p) {
      if (p.y === null) {
        p.y = prevY + 1;
      }
      prevY = p.y;
    });
    placed.sort(function (a, b) { return a.y - b.y || a.order - b.order; });
    placed.forEach(function (p) {
      var top = Math.max(p.y - 6, last);
      p.el.style.top = top + 'px';
      last = top + p.el.offsetHeight + 12;
    });
    var stage = pageEl.querySelector('[data-cvd-stage]');
    if (stage) {
      stage.style.minHeight = last + 'px';
    }
  }

  var notesObserver = window.ResizeObserver ? new ResizeObserver(function () { layoutNotes(); }) : null;

  function watchDoc() {
    var docEl = pageEl.querySelector('[data-cvd-doc]');
    if (!docEl) {
      return;
    }
    Array.prototype.forEach.call(docEl.querySelectorAll('img'), function (img) {
      if (!img.complete) {
        img.addEventListener('load', layoutNotes, { once: true });
      }
    });
    if (notesObserver) {
      notesObserver.disconnect();
      notesObserver.observe(docEl);
    } else {
      window.addEventListener('resize', layoutNotes);
    }
    layoutNotes();
  }

  function setWide(on) {
    state.wide = on;
    var o = pageEl.querySelector('.cvo');
    if (!o) {
      return;
    }
    o.classList.toggle('is-wide', on);
    var z = o.querySelector('[data-cvd-zoom]');
    if (z) {
      z.setAttribute('aria-pressed', on ? 'true' : 'false');
      z.innerHTML = zoomLabel(on);
    }
    window.requestAnimationFrame(function () {
      layoutNotes();
      // Brought back: make sure the panel is on screen, not above it.
      var card = o.querySelector('.cvo__card');
      if (!on && card) {
        var r = card.getBoundingClientRect();
        if (r.bottom < 80 || r.top > window.innerHeight - 80) {
          card.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
        }
      }
    });
  }

  /** The Enlarge / Show score panel button: with the panel tucked away it
   *  carries the score, so it is clear what it brings back. */
  function zoomLabel(on) {
    return on && state.result ?
      '<b class="cvd__zoom-score">' + state.result.score + '</b><span>Show score panel</span>' + icon('i-shrink') :
      icon('i-expand') + '<span>Enlarge CV</span>';
  }

  function overviewHtml() {
    var r = state.result;
    var mood = r.score >= 85 ? 'Your CV is in great shape. A few finishing touches below.' :
      r.score >= 65 ? 'We’ve found a few areas that could be even stronger. Follow the suggestions to make the most of your experience and skills.' :
        'There’s plenty here to build on. Work through the sections, starting with the ones marked red.';
    var bars = Object.keys(r.categories).map(function (k) {
      var c = r.categories[k];
      var pct = Math.round(c.points / c.max * 100);
      return '<li class="cvo__cat"><span class="cvo__cat-name">' + esc(c.label) + '</span>' +
        '<span class="cvo__cat-bar" aria-hidden="true"><i data-css="--w: ' + pct + '%"></i></span>' +
        '<span class="cvo__cat-pts">' + c.points + ' / ' + c.max + '</span></li>';
    }).join('');
    var how = Object.keys(r.categories).map(function (k) {
      var c = r.categories[k];
      return '<li><b>' + esc(c.label) + ' (' + c.points + ' of ' + c.max + ')</b><ul>' +
        c.notes.map(function (n) { return '<li>' + esc(n.note) + ': ' + n.points + '</li>'; }).join('') + '</ul></li>';
    }).join('');
    return '' +
      '<div class="cvo' + (state.wide ? ' is-wide' : '') + '">' +
        '<div class="cvo__grid">' +
          '<div class="cvo__left">' +
            '<header class="cvo__head">' +
              '<h2 class="cvo__title" id="cvr-page-title">Your CV review</h2>' +
              '<p class="cvo__lead">' + mood + '</p>' +
            '</header>' +
            docHtml() +
          '</div>' +
          '<button type="button" class="cvo__pill" data-cvo-show aria-label="Show the score panel. Score ' + r.score + ' out of 100">' +
            '<b>' + r.score + '</b><span>Show score panel</span>' + icon('i-chevron') + '</button>' +
          '<aside class="cvo__card" aria-labelledby="cvo-overall">' +
            '<div class="cvo__card-head">' + icon('i-star', 'cvo__star') + '<div><h3 id="cvo-overall">Overall</h3><p>A quick look at your CV and the key areas to improve.</p></div>' +
              '<button type="button" class="cvo__min" data-cvo-min>' + icon('i-shrink') + '<span class="visually-hidden">Minimise the score panel</span></button></div>' +
            '<div class="cvo__score">' +
              '<div class="cvo__ring" data-css="--p: 0" data-ring="' + r.score + '" role="img" aria-label="CV readiness score ' + r.score + ' out of 100">' +
                '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="cvo__ring-bg" cx="60" cy="60" r="50" /><circle class="cvo__ring-fg" cx="60" cy="60" r="50" pathLength="100" /></svg>' +
                '<span class="cvo__pct"><span class="cvo__num"><b data-ring-num>0</b><i>%</i></span><small>CV ready</small></span>' +
              '</div>' +
              '<ul class="cvo__counts">' +
                '<li class="cvo__count cvo__count--fix"><span class="cvr__mark cvr__mark--fix">' + icon('i-alert') + '</span><b>' + r.counts.fix + '</b> ' + (r.counts.fix === 1 ? 'area' : 'areas') + ' to fix</li>' +
                '<li class="cvo__count cvo__count--tip"><span class="cvr__mark cvr__mark--tip">' + icon('i-alert') + '</span><b>' + r.counts.tip + '</b> ' + (r.counts.tip === 1 ? 'suggestion' : 'suggestions') + '</li>' +
                '<li class="cvo__count cvo__count--good"><span class="cvr__mark cvr__mark--good">' + icon('i-check') + '</span><b>' + r.counts.good + '</b> ' + (r.counts.good === 1 ? 'strength' : 'strengths') + '</li>' +
              '</ul>' +
            '</div>' +
            '<div class="cvo__cats"><p class="cvo__cats-head">' + icon('i-bars') + 'How you’re doing across the CV</p><ul>' + bars + '</ul>' +
              '<details class="cvo__how"><summary>How is this worked out?</summary><p>Your score is a rule-based check of the text in your CV, out of 100. It isn’t a prediction of whether you’ll get a job. Points come from:</p><ul>' + how + '</ul></details>' +
            '</div>' +
            '<div class="cvo__next">' + icon('i-target') + '<div><h3>Next step</h3><p>Start with the section marked in red on the left, make the changes, then re-score your CV to see your progress.</p></div></div>' +
            '<button class="cvo__start" type="button" data-cvr-start>Start improving your CV now' + icon('i-arrow') + '</button>' +
          '</aside>' +
        '</div>' +
      '</div>';
  }

  function animateRing() {
    var ring = pageEl.querySelector('[data-ring]');
    if (!ring) {
      return;
    }
    var target = parseInt(ring.getAttribute('data-ring'), 10);
    var num = ring.querySelector('[data-ring-num]');
    if (reduce.matches) {
      ring.style.setProperty('--p', target);
      num.textContent = target;
      return;
    }
    var t0 = null;
    function step(now) {
      if (t0 === null) {
        t0 = now;
      }
      var t = Math.min(1, (now - t0) / 1100);
      var e = 1 - Math.pow(1 - t, 3);
      ring.style.setProperty('--p', (target * e).toFixed(1));
      num.textContent = Math.round(target * e);
      if (t < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  }


  /* ------------------------------------------------------------------------
     7. SECTION PAGES
     ------------------------------------------------------------------------ */

  function findingHtml(f, i) {
    var open = f.level !== 'good' || i === 0;
    var body = '<div class="cvf__main"><span class="cvf__icon">' + icon(LEVEL[f.level].icon) + '</span>' +
      '<p class="cvf__detail">' + esc(f.detail) + '</p></div>';
    if (f.why) {
      body += '<h4 class="cvf__sub">Why it matters</h4><p class="cvf__why">' + esc(f.why) + '</p>';
    }
    if (f.steps && f.steps.length) {
      body += '<h4 class="cvf__sub">What to do</h4><ul class="cvf__steps">' + f.steps.map(function (s) {
        return '<li>' + esc(s) + '</li>';
      }).join('') + '</ul>';
    }
    if (f.examples && f.examples.length) {
      body += '<h4 class="cvf__sub">' + (f.level === 'good' ? 'Where we found this' : 'Lines this applies to') + '</h4>' +
        '<ul class="cvf__lines">' + f.examples.map(function (l) {
          return '<li>' + esc(shorten(l, 140)) + '</li>';
        }).join('') + '</ul>';
    }
    if (f.options && f.options.length) {
      body += '<p class="cvf__opts-head">You could use:</p><ul class="cvf__opts">' + f.options.map(function (o) {
        return '<li>' + esc(o) + '</li>';
      }).join('') + '</ul>';
    }
    return '<details class="cvf cvf--' + f.level + '"' + (open ? ' open' : '') + '>' +
      '<summary><span class="cvf__title">' + esc(f.title) + '</span><span class="cvf__pill">' + LEVEL[f.level].word + '</span>' +
      icon('i-chevron', 'cvf__chev') + '</summary><div class="cvf__body">' + body + '</div></details>';
  }

  function editorHtml(key) {
    var s = SECTIONS.filter(function (x) { return x.key === key; })[0];
    var inner = '';
    if (key === 'header') {
      var f = state.fields;
      var fld = function (id, label, type, val, auto) {
        return '<label class="cve__field"><span>' + label + '</span><input type="' + type + '" data-field="' + id + '" value="' + esc(val) + '" autocomplete="' + auto + '"></label>';
      };
      inner = '<div class="cve__grid">' +
        fld('name', 'Full name', 'text', f.name, 'name') +
        fld('title', 'Headline (optional)', 'text', f.title, 'organization-title') +
        fld('email', 'Email address', 'email', f.email, 'email') +
        fld('phone', 'Phone number', 'tel', f.phone, 'tel') +
        fld('location', 'Town or city', 'text', f.location, 'address-level2') +
        '</div><label class="cve__field"><span>Other details (one per line)</span><textarea data-field="extra" rows="3">' + esc(f.extra) + '</textarea></label>';
    } else if (key === 'other') {
      inner = state.cv.other.map(function (o, i) {
        return '<div class="cve__other"><label class="cve__field"><span>Section title</span><input type="text" data-other-title="' + i + '" value="' + esc(o.title) + '"></label>' +
          '<label class="cve__field"><span>Content</span><textarea data-other-text="' + i + '" rows="4">' + esc(o.text) + '</textarea></label>' +
          '<button type="button" class="cve__remove" data-cvr-remove-other="' + i + '">Remove this section</button></div>';
      }).join('') +
        '<button type="button" class="cve__add" data-cvr-add-other>' + icon('i-plus') + 'Add a section</button>';
    } else {
      var rows = Math.min(16, Math.max(5, state.cv[key].split('\n').length + 1));
      inner = '<label class="cve__field"><span class="visually-hidden">' + s.label + '</span><textarea data-section="' + key + '" rows="' + rows + '" spellcheck="true">' + esc(state.cv[key]) + '</textarea></label>';
    }
    return '<section class="cve" aria-labelledby="cve-title">' +
      '<header class="cve__head">' + icon('i-pen') + '<div><h3 id="cve-title">' + s.label + '</h3>' +
      '<p>We’ve filled this in from your CV. Check it, correct anything we read wrongly, and add what’s missing. Then re-score.</p></div></header>' +
      inner +
      '<button type="button" class="cve__go" data-cvr-rescore>' + icon('i-refresh') + 'Re-score with my changes</button></section>';
  }

  function sectionHtml(key) {
    var s = SECTIONS.filter(function (x) { return x.key === key; })[0];
    var r = state.result;
    var score = r.sections[key];
    var lvl = levelOf(score);
    var list = (r.findings[key] || []).slice().sort(function (a, b) {
      var order = { fix: 0, tip: 1, good: 2 };
      return order[a.level] - order[b.level];
    });
    var idx = SECTIONS.indexOf(s);
    var next = SECTIONS[idx + 1];
    return '' +
      '<div class="cvs">' +
        '<button class="toolback" type="button" data-go="overview">' + icon('i-arrow') + '<span>Back to overview</span></button>' +
        '<header class="cvs__head">' +
          '<div class="cvs__ring cvs__ring--' + lvl + '" data-css="--p: ' + score * 10 + '" role="img" aria-label="' + s.name + ' score ' + score + ' out of 10">' +
            '<svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="25" class="cvs__ring-bg" /><circle cx="30" cy="30" r="25" pathLength="100" class="cvs__ring-fg" /></svg><b>' + score + '</b></div>' +
          '<div><h2 class="cvs__title" id="cvr-page-title">' + s.name + '</h2><p class="cvs__intro">' + s.intro + '</p></div>' +
        '</header>' +
        '<div class="cvs__cols">' +
          '<div class="cvs__findings">' + (list.length ? list.map(findingHtml).join('') :
            '<p class="cvs__none">Nothing to check here yet. Add some content on the right, then re-score.</p>') + '</div>' +
          editorHtml(key) +
        '</div>' +
        (next ? '<button type="button" class="cvs__next" data-go="' + next.key + '">Next: ' + next.name + icon('i-arrow') + '</button>' :
          '<button type="button" class="cvs__next" data-go="overview">Back to the overview' + icon('i-arrow') + '</button>') +
      '</div>';
  }

  /** Copy whatever the reader has typed back into the CV. */
  function readEditors() {
    if (!state.cv) {
      return;
    }
    Array.prototype.forEach.call(pageEl.querySelectorAll('[data-field]'), function (el) {
      state.fields[el.getAttribute('data-field')] = el.value.trim();
    });
    Array.prototype.forEach.call(pageEl.querySelectorAll('[data-section]'), function (el) {
      state.cv[el.getAttribute('data-section')] = el.value.replace(/\s+$/, '');
    });
    Array.prototype.forEach.call(pageEl.querySelectorAll('[data-other-title]'), function (el) {
      var i = parseInt(el.getAttribute('data-other-title'), 10);
      if (state.cv.other[i]) {
        state.cv.other[i].title = el.value.trim() || 'Section';
      }
    });
    Array.prototype.forEach.call(pageEl.querySelectorAll('[data-other-text]'), function (el) {
      var i = parseInt(el.getAttribute('data-other-text'), 10);
      if (state.cv.other[i]) {
        state.cv.other[i].text = el.value.replace(/\s+$/, '');
      }
    });
    state.cv.header = headerText();
  }

}());

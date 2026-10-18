/* ==========================================================================
   MOVEMENT TO WORK: PROFILE RULES
   Turns questionnaire answers into a personal profile. Every line it
   produces comes from a rule below and names the answers behind it.

   What this is, and is not
   - Answers are the reader's own view of themselves. Nothing here is a
     test of skill, personality or suitability for a job.
   - Profile completion (how many questionnaires are done) is kept apart
     from strength indicators, and neither is an "employability score".
   - Bars are only drawn from ratings the reader gave (1 to 5). Where
     there is no rating, a plain label is used instead of a number.
   ========================================================================== */

(function (root) {
  'use strict';

  var D = (typeof module !== 'undefined' && module.exports) ? require('./questionnaire-data.js') : root.MTWQD;


  /* --- Answers --------------------------------------------------------------- */

  /** Keep only answers that still match the questions (so saved data from
   *  an older version never breaks anything). */
  function clean(raw) {
    var out = {};
    raw = raw || {};
    D.STAGES.forEach(function (st) {
      st.questions.forEach(function (q) {
        var v = raw[q.id];
        if (v == null) {
          return;
        }
        var valid = (q.options || []).map(function (o) { return o.v; });
        if (q.type === 'single' && valid.indexOf(v) !== -1) {
          out[q.id] = v;
        } else if (q.type === 'multi' && Array.isArray(v)) {
          var list = v.filter(function (x, i) { return valid.indexOf(x) !== -1 && v.indexOf(x) === i; }).slice(0, q.max || valid.length);
          if (list.length) {
            out[q.id] = list;
          }
        } else if (q.type === 'scale') {
          var n = parseInt(v, 10);
          if (n >= 1 && n <= 5) {
            out[q.id] = n;
          }
        } else if (q.type === 'text' && typeof v === 'string' && v.trim()) {
          out[q.id] = v.trim().slice(0, 600);
        }
      });
    });
    return out;
  }

  function isAnswered(q, v) {
    if (v == null) {
      return false;
    }
    if (q.type === 'multi') {
      return Array.isArray(v) && v.length > 0;
    }
    if (q.type === 'text') {
      return typeof v === 'string' && v.trim().length > 0;
    }
    return true;
  }

  /** Each questionnaire: not started, in progress or completed. A section
   *  is complete when every question that is not optional is answered. */
  function progress(answers) {
    var stages = D.STAGES.map(function (st) {
      var required = st.questions.filter(function (q) { return !q.optional; });
      var reqDone = required.filter(function (q) { return isAnswered(q, answers[q.id]); }).length;
      var any = st.questions.filter(function (q) { return isAnswered(q, answers[q.id]); }).length;
      var firstOpen = -1;
      for (var i = 0; i < st.questions.length; i++) {
        if (!st.questions[i].optional && !isAnswered(st.questions[i], answers[st.questions[i].id])) {
          firstOpen = i;
          break;
        }
      }
      return {
        key: st.key, name: st.name, answered: any, required: required.length, requiredDone: reqDone,
        total: st.questions.length, firstOpen: firstOpen,
        status: reqDone === required.length ? 'done' : any ? 'progress' : 'todo'
      };
    });
    var done = stages.filter(function (s) { return s.status === 'done'; }).length;
    var next = stages.filter(function (s) { return s.status === 'progress'; })[0] || stages.filter(function (s) { return s.status === 'todo'; })[0] || null;
    return {
      stages: stages,
      done: done,
      started: stages.filter(function (s) { return s.status !== 'todo'; }).length,
      total: stages.length,
      // Completion: questionnaires finished, out of seven. Not a skill score.
      percent: Math.round(done / stages.length * 100),
      complete: done === stages.length,
      next: next
    };
  }


  /* --- Helpers --------------------------------------------------------------- */

  function has(answers, id, v) {
    var a = answers[id];
    return Array.isArray(a) ? a.indexOf(v) !== -1 : a === v;
  }

  function lbl(id, v) {
    return D.label(id, v);
  }

  function lower(s) {
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function list(items) {
    items = items.filter(Boolean);
    if (items.length < 2) {
      return items.join('');
    }
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  function rating(answers, id) {
    var v = answers[id];
    return typeof v === 'number' ? v : null;
  }

  function scaleWord(id, v) {
    var q = D.question(id);
    return q && q.scale ? q.scale[v - 1].toLowerCase() : String(v);
  }

  function shortQ(id) {
    var q = D.question(id);
    return q ? q.text.replace(/^How confident do you feel /, '').replace(/^How comfortable (are you|do you feel) /, '').replace(/\?$/, '') : id;
  }


  /* --- Strengths --------------------------------------------------------------
     Each indicator lists the answers that feed it. A bar is only drawn from
     ratings (the average of 1 to 5, shown as a share of 5) and is labelled
     as self-rated confidence, never as a measured skill. */

  var INDICATORS = [
    { key: 'communication', name: 'Communication', skills: ['communication', 'listening'], improve: ['communication'], goals: ['communication'],
      ratings: ['s5', 'c5', 'c1'] },
    { key: 'teamwork', name: 'Teamwork', skills: ['teamwork'], improve: ['teamwork'], goals: ['teamwork'], ratings: ['c3'],
      roles: ['support', 'listener', 'organiser'] },
    { key: 'problem', name: 'Problem-solving', skills: ['problem'], improve: ['problem'], goals: ['problem'], ratings: ['c6', 's6'] },
    { key: 'organisation', name: 'Organisation', skills: ['organisation', 'time', 'detail', 'reliability'], improve: ['organisation', 'time', 'detail'],
      goals: ['organisation'], ratings: [], roles: ['organiser'] },
    { key: 'adaptability', name: 'Adaptability', skills: ['adaptability', 'initiative'], improve: ['adaptability', 'initiative'], ratings: [] },
    { key: 'digital', name: 'Digital confidence', skills: ['digital'], improve: ['digital'], goals: ['digital'], ratings: [] },
    { key: 'learning', name: 'Learning confidence', skills: ['learning'], improve: ['learning'], ratings: ['c4'] },
    { key: 'workplace', name: 'Workplace confidence', skills: [], improve: [], ratings: ['c7', 'c8', 'c2'] }
  ];

  function strengths(a) {
    return INDICATORS.map(function (ind) {
      var evidence = [];
      var chosen = (a.s1 || []).filter(function (s) { return ind.skills.indexOf(s) !== -1; });
      var praised = a.s2 && ind.skills.indexOf(a.s2) !== -1;
      var wants = (a.s7 && ind.improve.indexOf(a.s7) !== -1) || (a.g3 && (ind.goals || []).indexOf(a.g3) !== -1);
      var role = a.s3 && (ind.roles || []).indexOf(a.s3) !== -1;
      var rated = ind.ratings.filter(function (id) { return rating(a, id) != null; });
      var avg = rated.length ? rated.reduce(function (n, id) { return n + a[id]; }, 0) / rated.length : null;

      if (chosen.length) {
        evidence.push('You chose ' + list(chosen.map(function (s) { return lbl('s1', s).toLowerCase(); })) + ' as one of your strongest skills.');
      }
      if (praised) {
        evidence.push('You said people often compliment your ' + lbl('s2', a.s2).toLowerCase() + '.');
      }
      if (role) {
        evidence.push('In a team, you said: "' + lbl('s3', a.s3) + '".');
      }
      rated.forEach(function (id) {
        evidence.push('You rated "' + shortQ(id) + '" as ' + scaleWord(id, a[id]) + ' (' + a[id] + ' out of 5).');
      });
      if (wants) {
        evidence.push('You said this is something you would like to improve.');
      }

      var tag;
      var tone;
      if (chosen.length || praised) {
        tag = chosen.length ? 'Self-identified strength' : 'Others notice this';
        tone = 'good';
      } else if (wants) {
        tag = 'Would like to improve';
        tone = 'develop';
      } else if (avg != null && avg >= 3.5) {
        tag = 'Higher self-rated confidence';
        tone = 'good';
      } else if (avg != null && avg <= 2) {
        tag = 'Lower self-rated confidence';
        tone = 'develop';
      } else if (avg != null || role) {
        tag = role && avg == null ? 'Shows in how you work' : 'Developing';
        tone = 'neutral';
      } else {
        tag = 'Not enough information';
        tone = 'none';
      }
      // Ranking for "at a glance": chosen strengths, then ratings.
      var weight = (chosen.length ? 3 : 0) + (praised ? 2 : 0) + (role ? 1 : 0) + (avg != null ? avg / 2.5 : 0) - (wants ? 1 : 0);
      return {
        key: ind.key, name: ind.name, tag: tag, tone: tone, evidence: evidence, weight: weight,
        percent: avg != null ? Math.round(avg / 5 * 100) : null,
        basis: avg != null ? 'Self-rated confidence: the average of your ' + (rated.length === 1 ? 'rating' : rated.length + ' ratings') + ' (' +
          rated.map(function (id) { return a[id]; }).join(', ') + ' out of 5).' : null,
        selfIdentified: chosen.length > 0
      };
    }).sort(function (x, y) {
      if ((x.tone === 'none') !== (y.tone === 'none')) {
        return x.tone === 'none' ? 1 : -1;
      }
      return y.weight - x.weight;
    });
  }


  /* --- Areas to develop ----------------------------------------------------
     Each area lists the answers that suggested it, so the reader can see why. */

  var TOOL_LABELS = {
    interview: 'Practise interviews', cv: 'Review your CV', skills: 'Explore your skills', programme: 'See the programme',
    join: 'How to join', 'stage:ideal': 'Revisit your ideal opportunity', 'stage:work': 'Revisit work preferences'
  };

  var AREAS = [
    { key: 'interview', title: 'Build interview confidence', tool: 'interview',
      why: 'Interview practice can help you organise your thoughts and get used to common questions.',
      action: 'Try practising three common interview questions.',
      test: function (a, e) {
        if (rating(a, 'c2') != null && a.c2 <= 2) { e.push('You rated answering interview questions as ' + scaleWord('c2', a.c2) + '.'); }
        if (has(a, 'b1', 'interview') || has(a, 'b8', 'interview')) { e.push('You picked interview confidence as a challenge.'); }
        if (a.b2 === 'interview') { e.push('You said interviews are the hardest part of looking for work.'); }
        if (a.g1 === 'interview' || has(a, 'g2', 'interview') || a.g3 === 'interview') { e.push('Building interview confidence is one of your goals.'); }
        if (a.b4 && a.b4 !== 'none') { e.push('You said "' + lbl('b4', a.b4).toLowerCase() + '" worries you about interviews.'); }
        if (has(a, 'b7', 'practice')) { e.push('You said interview practice would help.'); }
      } },
    { key: 'cv', title: 'Strengthen your CV', tool: 'cv',
      why: 'A clear CV helps employers see your skills and experience quickly.',
      action: 'Upload your CV to spot common issues and ways to improve it.',
      test: function (a, e) {
        if (has(a, 'b1', 'cv') || has(a, 'b8', 'cv')) { e.push('You picked CV writing as a challenge.'); }
        if (a.b2 === 'cv') { e.push('You said writing applications and CVs is the hardest part.'); }
        if (a.g1 === 'cv' || has(a, 'g2', 'cv') || a.g3 === 'cv') { e.push('Improving your CV is one of your goals.'); }
        if (has(a, 'b7', 'cvhelp')) { e.push('You said help with your CV would make a difference.'); }
      } },
    { key: 'applying', title: 'Feel ready to apply', tool: 'cv',
      why: 'Knowing your strengths and having a CV ready makes applying feel much less daunting.',
      action: 'Get your CV ready, then try applying for one role you are interested in.',
      test: function (a, e) {
        if (rating(a, 'c7') != null && a.c7 <= 2) { e.push('You rated applying for jobs as ' + scaleWord('c7', a.c7) + '.'); }
        if (rating(a, 'b3') != null && a.b3 <= 2) { e.push('You said you feel ' + scaleWord('b3', a.b3) + ' applying for jobs.'); }
      } },
    { key: 'communication', title: 'Grow your workplace communication', tool: 'interview',
      why: 'Clear communication helps in interviews, with customers and in any team.',
      action: 'Practise introducing yourself in a few sentences, out loud.',
      test: function (a, e) {
        ['c5', 'c1', 's5'].forEach(function (id) {
          if (rating(a, id) != null && a[id] <= 2) { e.push('You rated "' + shortQ(id) + '" as ' + scaleWord(id, a[id]) + '.'); }
        });
        if (has(a, 'b1', 'communication') || has(a, 'b8', 'communication')) { e.push('You picked communication confidence as a challenge.'); }
        if (a.g3 === 'communication' || a.s7 === 'communication') { e.push('You said you would like to improve your communication.'); }
      } },
    { key: 'time', title: 'Get organised', tool: 'skills',
      why: 'Being organised and on time is one of the first things employers notice.',
      action: 'Try a simple weekly planner for one week, and note what helped.',
      test: function (a, e) {
        if (a.g3 === 'organisation') { e.push('You chose organisation and time management as the area to improve.'); }
        if (['time', 'organisation', 'detail'].indexOf(a.s7) !== -1) { e.push('You said you would like to improve your ' + lbl('s7', a.s7).toLowerCase() + '.'); }
      } },
    { key: 'digital', title: 'Build your digital skills', tool: 'skills',
      why: 'Most jobs use some technology, from email to rotas and tills.',
      action: 'Pick one tool to practise, such as email, a spreadsheet or a job site.',
      test: function (a, e) {
        if (has(a, 'b1', 'digital') || has(a, 'b8', 'digital')) { e.push('You picked digital skills as a challenge.'); }
        if (a.g3 === 'digital' || a.s7 === 'digital') { e.push('You said you would like to improve your digital skills.'); }
        if (has(a, 'b6', 'equipment') || has(a, 'b1', 'equipment')) { e.push('You mentioned limited access to a computer or equipment.'); }
      } },
    { key: 'direction', title: 'Find your direction', tool: 'stage:ideal',
      why: 'Exploring your interests and work preferences can help you find roles worth looking into.',
      action: 'Pick two of your suggested career areas and look up one entry-level role in each.',
      test: function (a, e) {
        if (has(a, 'b1', 'direction') || has(a, 'b8', 'direction')) { e.push('You said you are not sure which career to choose.'); }
        if (a.b2 === 'direction') { e.push('You said choosing a path is the hardest part.'); }
        if (a.g6 === 'unsure') { e.push('You said you are still exploring what you want to do.'); }
        if (rating(a, 'b5') != null && a.b5 <= 2) { e.push('You said you have ' + scaleWord('b5', a.b5) + ' information about your career options.'); }
        if (has(a, 'o2', 'exploring')) { e.push('You said you are still exploring which work interests you.'); }
      } },
    { key: 'opportunities', title: 'Understand what’s out there', tool: 'programme',
      why: 'Knowing where to look and what employers expect makes it easier to spot the right opportunity.',
      action: 'Find out how Movement to Work places you with a local employer for two weeks.',
      test: function (a, e) {
        if (has(a, 'b1', 'finding') || has(a, 'b8', 'finding')) { e.push('You said finding suitable opportunities is hard.'); }
        if (has(a, 'b1', 'expectations') || has(a, 'b8', 'expectations')) { e.push('You said you are not sure what employers expect.'); }
        if (a.b2 === 'finding' || a.b2 === 'expectations') { e.push('You said "' + lbl('b2', a.b2).toLowerCase() + '" is the hardest part.'); }
        if (has(a, 'b7', 'info')) { e.push('You said information about careers would help.'); }
      } },
    { key: 'experience', title: 'Gain practical experience', tool: 'programme',
      why: 'Real experience gives you examples to talk about and helps you find out what you enjoy.',
      action: 'Look at the Movement to Work programme: two weeks with a real employer.',
      test: function (a, e) {
        if (has(a, 'b1', 'experience') || has(a, 'b8', 'experience')) { e.push('You picked lack of work experience as a challenge.'); }
        if (a.g1 === 'experience' || has(a, 'g2', 'experience')) { e.push('Gaining practical experience is one of your goals.'); }
        if (has(a, 'b7', 'experience')) { e.push('You said work experience or a placement would help.'); }
      } },
    { key: 'practical', title: 'Talk through practical support', tool: 'join',
      why: 'Your Work Coach may be able to talk about available support and suitable next steps.',
      action: 'Mention these when you speak to your Work Coach.',
      test: function (a, e) {
        var picked = (a.b6 || []).filter(function (v) { return ['travel', 'equipment', 'caring', 'hours'].indexOf(v) !== -1; });
        if (has(a, 'b1', 'travel') && picked.indexOf('travel') === -1) { picked.push('travel'); }
        if (picked.length) { e.push('You mentioned: ' + list(picked.map(function (v) { return lbl('b6', v).toLowerCase(); })) + '.'); }
        if (has(a, 'b7', 'coach')) { e.push('You said talking to a Work Coach would help.'); }
      } }
  ];

  function develop(a) {
    return AREAS.map(function (ar) {
      var evidence = [];
      ar.test(a, evidence);
      return { key: ar.key, title: ar.title, why: ar.why, action: ar.action, tool: ar.tool, toolLabel: TOOL_LABELS[ar.tool],
        evidence: evidence, weight: evidence.length };
    }).filter(function (x) { return x.weight > 0; }).sort(function (x, y) { return y.weight - x.weight; });
  }


  /* --- Goals ----------------------------------------------------------------- */

  var GOAL_TEXT = {
    firstjob: ['Find your first job', 'You’d like to take your first step into work. A strong CV and some interview practice are a great place to start.', 'cv'],
    cv: ['Improve your CV', 'You’d like your CV to show what you can do. The CV review can point out quick wins.', 'cv'],
    interview: ['Build interview confidence', 'You’d like to feel more prepared when speaking to employers. Practising common interview questions could be a useful first step.', 'interview'],
    experience: ['Gain practical experience', 'You’d like hands-on experience. The Movement to Work programme gives you two weeks with a real employer.', 'programme'],
    strengths: ['Discover your strengths', 'You’d like to understand what you’re good at. Finishing this profile and exploring your skills will help.', 'skills'],
    careers: ['Explore different career paths', 'You’d like to explore your options. Your interests and work preferences can point to areas worth looking into.', 'stage:ideal'],
    apprenticeship: ['Find an apprenticeship', 'You’d like to earn while you learn. Your Work Coach can talk you through apprenticeship options.', 'join'],
    skills: ['Develop workplace skills', 'You’d like to build skills employers look for. The skills activity shows the ones that matter most.', 'skills'],
    other: ['Your own goal', 'You have a goal of your own in mind. Your Work Coach can help you plan the steps towards it.', 'join']
  };

  function goals(a) {
    if (!a.g1) {
      return null;
    }
    var g = GOAL_TEXT[a.g1];
    return {
      primary: a.g1, title: g[0], text: g[1], tool: g[2], toolLabel: TOOL_LABELS[g[2]] || 'Find out more',
      secondary: (a.g2 || []).filter(function (v) { return v !== a.g1; }).map(function (v) { return GOAL_TEXT[v][0]; }),
      priority: a.g7 ? lbl('g7', a.g7) : null,
      firstAction: a.g8 || null,
      motivations: (a.g4 || []).map(function (v) { return lbl('g4', v); })
    };
  }


  /* --- Learning and work preferences ---------------------------------------- */

  var LEARN = {
    try: ['hands-on learning', 'You enjoy practising tasks and learning through experience.'],
    watch: ['learning by watching', 'You like to see something done before you try it yourself.'],
    read: ['reading and written steps', 'You like clear written instructions you can go back to.'],
    ask: ['asking questions', 'You learn well by talking things through and asking questions.'],
    listen: ['having things explained', 'You find it helpful when someone explains things to you.'],
    visual: ['diagrams and videos', 'You find pictures, diagrams and videos helpful.'],
    steps: ['step-by-step guidance', 'You like breaking things into clear steps.'],
    others: ['learning with others', 'You enjoy learning alongside other people.']
  };

  function learning(a) {
    var counts = {};
    function add(v, n) {
      if (LEARN[v]) {
        counts[v] = (counts[v] || 0) + (n || 1);
      }
    }
    add(a.l1, 2);
    (a.l2 || []).forEach(function (v) { add(v); });
    add(a.l3, 2);
    add(a.l8);
    if (a.l6 === 'steps' || a.l6 === 'ask') {
      add(a.l6);
    }
    if (a.l4 === 'others') {
      add('others');
    }
    if (rating(a, 'l5') != null && a.l5 >= 4) {
      add('watch');
    }
    var ranked = Object.keys(counts).sort(function (x, y) { return counts[y] - counts[x]; });
    if (!ranked.length) {
      return null;
    }
    var top = ranked[0];
    var other = ['try', 'watch', 'read', 'ask'].filter(function (k) { return ranked.slice(0, 2).indexOf(k) === -1; })[0];
    return {
      top: top, title: 'You enjoy ' + LEARN[top][0], text: LEARN[top][1],
      prefs: ranked.slice(0, 3).map(function (k) { return LEARN[k][0]; }),
      company: a.l4 ? lbl('l4', a.l4) : null,
      feedback: a.l7 ? lbl('l7', a.l7) : null,
      tip: 'Everyone learns in lots of ways. Next time, you could also try ' + LEARN[other][0] + ' alongside what already works for you.'
    };
  }

  function work(a) {
    var bits = [];
    if (a.w5 === 'structured') { bits.push('structured tasks'); } else if (a.w5 === 'varied') { bits.push('varied responsibilities'); }
    if (a.w3 === 'practical') { bits.push('practical, hands-on work'); } else if (a.w3 === 'computer') { bits.push('computer-based work'); }
    (a.w6 || []).slice(0, 2).forEach(function (v) {
      var t = lbl('w6', v).toLowerCase();
      if (bits.indexOf(t) === -1 && !(v === 'practical' && a.w3 === 'practical')) { bits.push(t); }
    });
    if (a.w1 === 'team') { bits.push('working in a team'); } else if (a.w1 === 'independent') { bits.push('working independently'); }
    if (!bits.length) {
      return null;
    }
    return {
      text: 'Your answers suggest that you enjoy ' + list(bits.slice(0, 4)) + '.',
      environments: (a.w2 || []).map(function (v) { return lbl('w2', v); }),
      tasks: (a.w6 || []).map(function (v) { return lbl('w6', v); }),
      setting: a.w7 ? lbl('w7', a.w7) : null,
      matters: a.w8 ? lbl('w8', a.w8) : null,
      customers: rating(a, 'w4')
    };
  }


  /* --- Ideal opportunity: broad areas to explore ----------------------------
     Each area collects reasons from the reader's own answers. Only areas
     with at least two points of support are suggested, and never as a
     guaranteed match. */

  var AREA_RULES = {
    tech: { tasks: ['technical', 'computers'], env: ['office', 'remote'], w3: 'computer', s4: 'tech', skills: ['digital'] },
    business: { tasks: ['organising'], env: ['office'], s4: 'planning', skills: ['organisation', 'detail', 'time'], w5: 'structured' },
    creative: { tasks: ['creative'], s4: 'creating', skills: ['creativity'], prio: ['creative'] },
    engineering: { tasks: ['technical', 'practical', 'problem'], env: ['workshop'], s4: 'fixing', w3: 'practical' },
    construction: { tasks: ['practical'], env: ['outdoors', 'workshop'], s4: 'fixing', w7: 'outdoors' },
    care: { tasks: ['helping'], env: ['community'], s4: 'helping', prio: ['helping'] },
    retail: { tasks: ['helping', 'team'], env: ['retail'], customers: true },
    hospitality: { tasks: ['team'], env: ['retail'], customers: true, w5: 'varied' },
    education: { tasks: ['helping'], env: ['community'], s4: 'explaining', prio: ['helping'] },
    logistics: { tasks: ['practical', 'organising'], env: ['workshop'], w5: 'structured' },
    outdoor: { tasks: ['practical'], env: ['outdoors'], w7: 'outdoors' }
  };

  function ideal(a) {
    var scored = Object.keys(AREA_RULES).map(function (key) {
      var r = AREA_RULES[key];
      var why = [];
      var score = 0;
      if (has(a, 'o2', key)) { score += 3; why.push('you said it interests you'); }
      if (a.o6 === key) { score += 2; why.push('you’d like to explore it first'); }
      var tasks = (a.w6 || []).filter(function (t) { return (r.tasks || []).indexOf(t) !== -1; });
      if (tasks.length) { score += tasks.length; why.push('you enjoy ' + list(tasks.map(function (t) { return lbl('w6', t).toLowerCase(); }))); }
      var env = (a.w2 || []).filter(function (t) { return (r.env || []).indexOf(t) !== -1; });
      if (env.length) { score += 1; why.push('you picked "' + lbl('w2', env[0]).replace(/, where available$/, '') + '" as a setting you’d like'); }
      if (r.s4 && a.s4 === r.s4) { score += 1; why.push('you feel capable ' + lower(lbl('s4', a.s4))); }
      var sk = (a.s1 || []).filter(function (s) { return (r.skills || []).indexOf(s) !== -1; });
      if (sk.length) { score += 1; why.push('you see ' + lbl('s1', sk[0]).toLowerCase() + ' as a strength'); }
      if (r.w3 && a.w3 === r.w3) { score += 1; }
      if (r.w5 && a.w5 === r.w5) { score += 1; }
      if (r.w7 && a.w7 === r.w7) { score += 1; why.push('you’d rather work outdoors'); }
      var pr = (a.o4 || []).filter(function (p) { return (r.prio || []).indexOf(p) !== -1; });
      if (pr.length) { score += 1; why.push(lbl('o4', pr[0]).toLowerCase() + ' matters to you'); }
      if (r.customers && rating(a, 'w4') != null && a.w4 >= 4) { score += 1; why.push('you’re comfortable speaking with customers'); }
      return { key: key, name: lbl('o2', key), score: score, why: why };
    }).filter(function (x) { return x.score >= 2 && x.why.length; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 3);

    var parts = [];
    if (a.w3 === 'practical') { parts.push('practical, hands-on work'); } else if (a.w3 === 'computer') { parts.push('computer-based work'); } else if (a.w3 === 'both') { parts.push('a mix of practical and computer-based work'); }
    if (a.w1 === 'team') { parts.push('in a team'); } else if (a.w1 === 'independent') { parts.push('where you can work independently'); }
    var learn = rating(a, 'o5') != null && a.o5 >= 4;
    var summary = parts.length ? cap(parts.join(' ')) + (learn ? ', with opportunities to develop new skills.' : '.') :
      (learn ? 'Somewhere you can keep developing new skills.' : null);
    if (!summary && !scored.length && !(a.o2 || []).length) {
      return null;
    }
    return {
      summary: summary,
      interests: (a.o2 || []).map(function (v) { return lbl('o2', v); }),
      matters: (a.o4 || []).map(function (v) { return lbl('o4', v); }),
      workplace: a.o3 ? lbl('o3', a.o3) : null,
      consider: (a.o7 || []).map(function (v) { return lbl('o7', v); }),
      own: a.o1 || null,
      areas: scored
    };
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }


  /* --- Confidence ------------------------------------------------------------ */

  function confidence(a) {
    var rated = D.stage('confidence').questions.filter(function (q) { return rating(a, q.id) != null; })
      .map(function (q) { return { id: q.id, name: cap(shortQ(q.id)), value: a[q.id], word: scaleWord(q.id, a[q.id]) }; });
    if (!rated.length) {
      return null;
    }
    return {
      rated: rated,
      higher: rated.filter(function (r) { return r.value >= 4; }),
      lower: rated.filter(function (r) { return r.value <= 2; })
    };
  }


  /* --- Barriers: practical support for each challenge chosen ---------------- */

  var SUPPORT = {
    experience: 'Describe skills from education, volunteering, hobbies and personal projects. The programme can add real workplace experience.',
    interview: 'Practising questions in a low-pressure setting may help you feel more prepared.',
    cv: 'The CV review highlights quick, practical improvements.',
    finding: 'Your Work Coach and the programme can help you find suitable openings.',
    direction: 'Exploring your interests and work preferences may help you spot suitable opportunities.',
    qualifications: 'Many entry-level roles and apprenticeships include training. Your Work Coach can talk through options.',
    digital: 'Small steps help: practise email, a spreadsheet or a job website, one at a time.',
    travel: 'Your Work Coach may be able to talk about travel support and local opportunities.',
    equipment: 'Libraries and Jobcentres often have computers you can use. Ask your Work Coach.',
    communication: 'Practising short introductions out loud can build confidence quickly.',
    expectations: 'The programme shows you what a workplace expects, with support as you go.'
  };

  function barriers(a) {
    var picked = (a.b1 || []).filter(function (v) { return SUPPORT[v]; });
    if (a.b8 && picked.indexOf(a.b8) === -1) {
      picked.push(a.b8);
    }
    return picked.map(function (v) {
      return { key: v, name: lbl('b8', v) || lbl('b1', v), text: SUPPORT[v], first: a.b8 === v };
    });
  }


  /* --- Next steps: about three priority actions ------------------------------ */

  function steps(a, dev, g) {
    var out = [];
    var tools = {};
    function push(id, title, reason, step, tool) {
      if (tools[tool] && tool !== 'join') {
        return;
      }
      tools[tool] = true;
      out.push({ id: id, title: title, reason: reason, step: step, tool: tool, toolLabel: TOOL_LABELS[tool] || 'Find out more' });
    }
    var STEP_TEXT = {
      interview: ['Practise common interview questions', 'Start with introductory questions before moving on to teamwork and problem-solving examples.'],
      cv: ['Review your CV', 'Upload your CV to spot common issues and find ways to present your experience better.'],
      skills: ['Explore your skills', 'Try the skills activity to see the transferable skills employers look for.'],
      programme: ['Get real experience', 'Find out how the two-week programme places you with a local employer.'],
      join: ['Speak to your Work Coach', 'Your Work Coach can talk through available support and suitable next steps.'],
      'stage:ideal': ['Explore different opportunities', 'Look at your interests and work preferences and pick areas to investigate further.']
    };
    if (g) {
      var t = STEP_TEXT[g.tool] || STEP_TEXT.join;
      push('goal-' + g.primary, t[0], 'Your main goal is to ' + lower(g.title) + '.', t[1], g.tool);
    }
    dev.forEach(function (d) {
      if (out.length >= 3) {
        return;
      }
      push('area-' + d.key, d.tool === 'join' ? STEP_TEXT.join[0] : d.title, d.evidence[0], d.action, d.tool);
    });
    if (out.length < 3 && a.g8) {
      out.push({ id: 'own', title: 'Your own first step', reason: 'You set yourself this action.', step: a.g8, tool: null });
    }
    if (out.length < 3 && !tools.interview && a.c2 != null) {
      push('extra-interview', STEP_TEXT.interview[0], 'Interview practice helps everyone, whatever their confidence.', STEP_TEXT.interview[1], 'interview');
    }
    return out.slice(0, 4);
  }


  /* --- Key highlights: four short lines, never contradicting answers ------ */

  function highlights(st, g, dev, conf, id) {
    var out = [];
    var top = st.filter(function (s) { return s.selfIdentified; })[0] || st.filter(function (s) { return s.tone === 'good'; })[0];
    if (top) {
      out.push({ tone: 'good', text: top.name + (top.selfIdentified ? ' is one of your self-identified strengths' : ': higher self-rated confidence') });
    }
    if (g) {
      out.push({ tone: 'good', text: 'Goal: ' + lower(g.title) });
    }
    if (dev[0]) {
      out.push({ tone: 'tip', text: dev[0].title });
    }
    var low = conf && conf.rated.filter(function (r) { return r.value === 1; })[0];
    if (low) {
      out.push({ tone: 'fix', text: 'Not confident yet: ' + lower(low.name) });
    } else if (dev[1]) {
      out.push({ tone: 'tip', text: dev[1].title });
    } else if (id && id.areas[0]) {
      out.push({ tone: 'good', text: 'Worth exploring: ' + id.areas[0].name.toLowerCase() });
    }
    return out.slice(0, 4);
  }


  /* --- The profile ----------------------------------------------------------- */

  function profile(raw) {
    var a = clean(raw);
    var prog = progress(a);
    var st = prog.stages[1].answered || prog.stages[5].answered || prog.stages[0].answered ? strengths(a) : [];
    var dev = develop(a);
    var g = goals(a);
    var conf = confidence(a);
    var id = ideal(a);
    return {
      progress: prog,
      complete: prog.complete,
      goals: g,
      strengths: st,
      develop: dev,
      steps: steps(a, dev, g),
      highlights: highlights(st, g, dev, conf, id),
      learning: learning(a),
      work: work(a),
      ideal: id,
      confidence: conf,
      barriers: barriers(a)
    };
  }

  var api = { clean: clean, progress: progress, profile: profile, isAnswered: isAnswered };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MTWQP = api;
  }
}(this));

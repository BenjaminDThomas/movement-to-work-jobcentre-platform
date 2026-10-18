/* ==========================================================================
   MOVEMENT TO WORK: INTERVIEW ANSWER ANALYSER
   Rule-based checks on a typed answer or a transcript. No AI, no network:
   every point comes from a rule written out below, so the reader can be
   shown exactly why they scored what they did.

   What it can and cannot judge
   - It reads WORDS only. It cannot hear tone, confidence or enthusiasm,
     and it never guesses at personality, accent or speech differences.
   - Keywords are hints that an answer is on topic, never proof that it is
     right or meaningful.
   - The score is a practice feedback score, not a recruitment assessment.

   Practice feedback score (out of 100)
     Answer development and detail      20
     Structure and organisation         25
     Specific examples and own actions  20
     Outcomes and reflection            15
     Question-specific indicators       10
     Clarity and repetition             10
   ========================================================================== */

(function (root) {
  'use strict';

  var CATS = [
    { key: 'development', name: 'Detail', max: 20 },
    { key: 'structure', name: 'Structure', max: 25 },
    { key: 'examples', name: 'Examples', max: 20 },
    { key: 'outcomes', name: 'Results and reflection', max: 15 },
    { key: 'relevance', name: 'On topic', max: 10 },
    { key: 'clarity', name: 'Clarity', max: 10 }
  ];

  var LABELS = [
    [90, 'Interview Ready'],
    [80, 'Strong Progress'],
    [60, 'Good Start'],
    [40, 'Building Confidence'],
    [0, 'Keep Practising']
  ];

  var STOP = ('a an the and or but of to in on for with at by from as is are was were be been being it its this ' +
    'that these those my i me we our us you your their they them he she his her has have had will would can could ' +
    'do did does so if then than also just very really into over about up out not no all any some more most such ' +
    'there here when what which who how why im id ive ill dont didnt its thats').split(' ');

  var DEFAULT_LENGTHS = {
    intro: [35, 220], motivation: [30, 200], behavioural: [55, 260], situational: [35, 200], closing: [12, 120]
  };

  /* --- Patterns -------------------------------------------------------------
     Each one is a plain list of phrases a reader can check. */

  // Setting the scene (STAR: Situation).
  var SITUATION = /\b(when i|while i|during|at (my|the|our|a) |at (college|school|uni|university|work|home)|last (year|summer|term|month|week|christmas)|this (year|summer|term)|in my (first|last|final|previous|second|old)|on my (placement|work experience|course)|once|one day|one time|a few (days|weeks|months|years) ago|there was|we had (a|an|to)|i was (working|volunteering|studying|helping|at|on|in)|in year \d+|in 20\d\d)\b/i;
  // What needed doing (STAR: Task).
  var TASK = /\b(i (needed|had|was asked|was responsible|was supposed|was tasked|wanted|offered|decided|volunteered|agreed|chose) to|my (job|role|task|responsibility|goal|aim|part) (was|were|is)|i was (in charge|responsible|asked)|the (goal|aim|task|challenge|problem|plan|issue) was|we (needed|had|wanted) to|it was my job|i had (the|a) (job|task|role)|i was (put|left) in charge|put me in charge|(asked|told|wanted|needed|trusted) me to|it was (up to|down to) me|i (took on|stepped up|offered|volunteered)|i was given|(had|needed) to [a-z]+|we were (asked|told|given)|(was|were) due|deadline|(had gone|went|was|were) missing|(wasn'?t|weren'?t|was not|were not) working|kept (jamming|breaking|crashing|failing|going wrong|happening)|there was a problem|i'?d never|i had never|i hadn'?t (done|used|worked|been)|for the first time|i was new to)\b/i;
  // What happened (STAR: Result) and outcomes in general.
  var RESULT = /\b(as a result|in the end|eventually|which (meant|helped|led|made|showed)|this (meant|helped|led|made|showed)|that (meant|helped|led|made)|the (result|outcome) (was|is)|we (achieved|won|finished|completed|raised|passed|got|managed|hit|met|reached)|i (achieved|passed|got|won|finished|completed|managed|reached|met|received|earned|gained)|it (worked|helped|went well|paid off)|now i|since then|successfully|feedback|managed to|ended up|was able to|were able to|improved|reduced|increased|saved|on time|ahead of|praised|thanked|asked me to|kept the idea|recognised|recognized|reviews?|five[- ]star|5[- ]star|compliment(ed|s)?|commended|merit|distinctions?|top (grade|mark)|grades?|promoted|employee of the month|by the end|after that|from then on|no (more|complaints|mistakes)|stopped|sold out|came back|pleased|happy with|grateful|confident enough|within (a|an|one|two|three|four|five|six|\d+) (days?|weeks?|months?)|went (really |very )?well|turned out|beat (the|my|our) target|hit (the|my|our) target|on target)\b/i;
  // Looking back (reflection).
  var REFLECT = /\b(i (learned|learnt|realised|realized|discovered|now know|understood|found out)|i('ve| have) learned|taught me|showed me|made me (realise|realize|see|more)|next time|since then|from now on|i would (do|change|now)|i('d| would) do (it )?differently|it helped me|helped me (to )?(see|understand|learn|grow|become|improve)|i('m| am) (now )?(more|better))\b/i;
  // A concrete example.
  var EXAMPLE = /\b(for example|for instance|such as|when i|during|at (college|school|uni|university|work)|on my (placement|work experience|course)|last (year|summer|term|month|week)|one time|once|in my (job|role|placement|volunteering|course|last|previous|old)|while i was|i remember|at my (job|placement|school|college|last)|at (a|the) [a-z]+ (shop|cafe|café|club|centre|center|school|college|placement|job|charity|company|restaurant|store|bank|team|event)|volunteering (at|with|for)|from (college|school|university|my)|(group|college|school|class) projects?|back in|in year (7|8|9|10|11|12|13)|for my (btec|coursework|course|a ?levels?|gcses?|exams?|project|placement|job|dissertation|degree|apprenticeship|dofe|duke of edinburgh)|in my (first|last|second|final) (week|month|year|day|shift|job|term)|at my (school|college|uni|placement|job|work|last job|part-time job|saturday job|old job)|during my|on (a|my|our) (shift|placement|trip|course|work experience)|(at|in) the (shop|store|café|cafe|restaurant|pub|warehouse|office|care home|hospital|gym|club|food bank|charity shop|stall|fair)|where i (work|worked|volunteer|volunteered))\b/gi;
  // Named places: "at Greggs", "for Tesco", "In Year 12". Case matters here,
  // so it is checked on the answer as written.
  var NAMED = /\b(at|for|with|in) (?!I\b)[A-Z][A-Za-z&']{2,}/g;
  // Reasons and support for a point.
  var REASON = /\b(because|so that|which means|this means|that means|for example|for instance|such as|that'?s why|this is why|which is why|since|so i|as a result|to make sure|which helps|this helps)\b/gi;
  // Forward-looking or summing-up close.
  var CLOSE = /\b(i('d| would) (like|love|bring|be|want|enjoy|aim|hope)|i('m| am) (keen|looking|excited|ready|hoping|eager|confident)|in the future|next step|that'?s why|which is why|so i|overall|i (hope|want|plan|aim)|thank|i('ll| will)|i (can|could) bring|i think (i|that)|i believe)\b/i;
  // Sequenced steps (situational answers).
  var STEPS = /\b(first|firstly|then|next|after that|afterwards|finally|if (it|they|that|i|the)|once (i|it|that)|straight away|before|as soon as)\b/gi;
  // What a situational answer achieves.
  var PURPOSE = /\b(so that|so (i|they|we|it|the|everyone|nothing|people)|to make sure|that way|which (would|means|helps)|this (would|means|helps)|it would|(it'?s|is) (important|better|best|key)|better (for|to|than)|to (avoid|stop|keep|help|show|get|put)|in time|on time|because)\b/i;
  // A final sentence that sums up or looks ahead.
  var SUMMING = /\b(always|mostly|usually|most|important|matters|best|better|key|means|that'?s|overall|so|really|everyone|want to|need to)\b/i;
  // Past-tense outcomes near the end of a story ("We reached the final").
  var OUTCOME_VERBS = /\b(reached|won|finished|completed|raised|passed|got|kept|saved|improved|grew|became|ended|worked|helped|sorted|solved|fixed|delivered|received|launched|opened|sold|stayed|moved|went)\b/i;
  // Something specific: a name, a number or something looked up.
  var SPECIFIC = /\b(\d+|your website|i (noticed|saw|read|looked|found|know|heard)|i'?ve (seen|noticed|read|shopped|used|visited|been)|recently|founded|started in|for years|such as)\b/i;

  var IRREGULAR_PAST = ('made took led ran wrote spoke set put gave got went sent found built kept told taught brought ' +
    'met began chose drew drove held left paid read rang sold spent stood won came did caught dealt stepped ' +
    'split cut shut hit lent lit fed fixed').split(' ');
  // "-ed" words that describe feelings or wishes rather than actions taken.
  var NOT_ACTIONS = ('needed wanted seemed liked loved hoped enjoyed wished felt called named aged based ' +
    'interested excited bored tired worried scared supposed used').split(' ');
  var PRESENT_ACTIONS = ('use write set plan make keep check ask break list put tell stay listen focus take work ' +
    'prioritise prioritize organise organize remind try start finish split track note read prepare learn practise ' +
    'practice help offer explain apologise apologize call contact speak talk find look follow double-check ' +
    'repeat show bring support give get go let own handle review').split(' ');

  // Other ways people say a keyword, so an answer on topic is recognised.
  var SAME = {
    problem: ['issue', 'wrong', 'broken', 'jamming', 'missing', 'complaint', 'challenge'],
    solved: ['sorted', 'fixed', 'resolved', 'worked out', 'figured out', 'stopped'],
    fixed: ['sorted', 'solved', 'resolved', 'repaired'],
    found: ['realised', 'realized', 'noticed', 'discovered', 'worked out'],
    idea: ['suggested', 'thought of', 'came up with'],
    helped: ['supported', 'assisted', 'showed', 'looked after', 'covered'],
    team: ['group', 'together', 'everyone', 'colleagues', 'class', 'squad', 'crew'],
    group: ['team', 'class', 'together'],
    feedback: ['advice', 'comments', 'told me', 'pointed out', 'suggested'],
    deadline: ['due', 'handed in', 'in time', 'on time', 'cut-off'],
    mistake: ['wrong', 'error', 'messed up', 'slipped up', 'got it wrong'],
    learned: ['learnt', 'taught me', 'realised', 'realized', 'picked up'],
    learn: ['learnt', 'learned', 'pick up', 'taught', 'training'],
    customer: ['customers', 'client', 'shopper', 'resident', 'guest', 'patient', 'member of the public'],
    customers: ['customer', 'clients', 'shoppers', 'residents', 'guests', 'patients', 'public'],
    calm: ['patient', 'relaxed', 'stay cool', 'deep breath'],
    listen: ['hear them out', 'let them explain', 'understand'],
    apologise: ['apologize', 'sorry'],
    manager: ['supervisor', 'team leader', 'boss', 'line manager', 'tutor', 'teacher'],
    responsibility: ['in charge', 'trusted', 'up to me', 'my job'],
    organised: ['organized', 'planned', 'arranged', 'sorted out', 'rota', 'schedule'],
    plan: ['planner', 'planned', 'list', 'schedule', 'rota', 'calendar'],
    priorities: ['prioritise', 'prioritize', 'most urgent', 'first'],
    proud: ['pleased', 'achievement', 'best thing'],
    result: ['in the end', 'outcome', 'which meant', 'as a result'],
    improved: ['better', 'faster', 'increased', 'reduced', 'saved'],
    new: ['never', 'first time', 'unfamiliar']
  };

  var FILLER_RE = /\b(lorem|ipsum|dolor|asdf\w*|qwerty\w*|blah|test(ing)?\s+test|xxx+|placeholder|sample text)\b/i;
  var SPOKEN_FILLERS = /\b(um+|uh+|erm+|er|ah+|you know|basically|kind of|sort of|i mean)\b/gi;


  /* --- Helpers ------------------------------------------------------------ */

  function words(text) {
    return (String(text || '').toLowerCase().replace(/[’']/g, '').match(/[a-z][a-z\-]*/g) || []);
  }

  function count(re, text) {
    var m = String(text).match(new RegExp(re.source, 'gi'));
    return m ? m.length : 0;
  }

  /** Sentences, or for an unpunctuated transcript, nothing (so sentence
   *  length is not judged on text that never had full stops). */
  function sentences(text) {
    var t = String(text).replace(/\s+/g, ' ').trim();
    if (!/[.!?]/.test(t) && !/\n/.test(text)) {
      return null;
    }
    return String(text).replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return /[a-z]/i.test(s); });
  }

  function stem(w) {
    return w.replace(/(ing|ed|es|e|s|ly)$/, '').replace(/(.)\1$/, '$1');
  }

  // Words in a question that say nothing about its topic.
  var QUESTION_FILLER = ('tell time describe would what how why when where your you about make makes made more ' +
    'most main deal handle do does did have had like think one someone something being any us our this').split(' ');

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function labelFor(score) {
    for (var i = 0; i < LABELS.length; i++) {
      if (score >= LABELS[i][0]) {
        return LABELS[i][1];
      }
    }
    return LABELS[LABELS.length - 1][1];
  }

  /** "I" followed by something done: "I organised", "I then rang",
   *  "I’d ask", "I always check". Returns the phrases found. */
  function personalActions(text) {
    var found = [];
    var re = /\bi(?:'d| would| will|'ll|'ve| have| can| try to| make sure (?:i |to )?| always| usually| often| then| also| first| quickly| immediately| personally| carefully| soon| later| just| still| now| even| actually)*\s+([a-z\-]+)/gi;
    var t = String(text).replace(/’/g, "'");
    var m;
    while ((m = re.exec(t))) {
      var v = m[1].toLowerCase();
      var past = (/[a-z]{3,}ed$/.test(v) && NOT_ACTIONS.indexOf(v) === -1) || IRREGULAR_PAST.indexOf(v) !== -1;
      var present = PRESENT_ACTIONS.indexOf(v) !== -1;
      if (past || present) {
        found.push(m[0].trim());
        // Further actions in the same sentence, after a comma or "and".
        var rest = t.slice(re.lastIndex).split(/[.!?\n]/)[0];
        var more = /(?:,\s*|\s+and\s+|\s+then\s+)(?:then\s+|also\s+)?([a-z\-]+)/gi;
        var mm;
        while ((mm = more.exec(rest))) {
          var w = mm[1].toLowerCase();
          if ((/[a-z]{3,}ed$/.test(w) && NOT_ACTIONS.indexOf(w) === -1) || IRREGULAR_PAST.indexOf(w) !== -1 ||
              (present && PRESENT_ACTIONS.indexOf(w) !== -1)) {
            found.push(mm[0].replace(/^[,\s]+/, '').trim());
          }
        }
      }
    }
    return found;
  }

  /** Text that is not a real answer: one word over and over, keyboard
   *  mashing or placeholder text. Checked first, so it is never scored. */
  function junk(text) {
    var ws = words(text).filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1; });
    var counts = {};
    ws.forEach(function (w) { counts[w] = (counts[w] || 0) + 1; });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var distinct = Object.keys(counts).length;
    if (FILLER_RE.test(text)) {
      return { reason: 'placeholder' };
    }
    if (ws.length >= 5 && (counts[top] / ws.length >= 0.34 || (ws.length < 40 && distinct / ws.length < 0.45))) {
      return { reason: 'repeated', word: top, times: counts[top] };
    }
    var all = words(text);
    var noVowel = all.filter(function (w) { return w.length > 3 && !/[aeiouy]/.test(w); }).length;
    var mashed = (String(text).match(/([a-z])\1\1/gi) || []).length;
    if (all.length && (noVowel / all.length > 0.25 || mashed >= 2)) {
      return { reason: 'placeholder' };
    }
    return null;
  }


  /* --- One answer ------------------------------------------------------------ */

  /**
   * question: an entry from interview-questions.js
   * text:     the typed answer or transcript
   * source:   'typed' or 'speech' (filler words are only mentioned for speech)
   */
  function analyseAnswer(question, text, source) {
    var raw = String(text || '').trim();
    var ws = words(raw);
    var kind = question.kind || 'intro';
    var result = { assessed: false, words: ws.length, source: source || 'typed', points: {}, notes: {},
      strengths: [], improve: [], prompts: [], star: null };

    if (!ws.length) {
      result.reason = 'empty';
      return result;
    }
    if (ws.length < 8) {
      result.reason = 'short';
      return result;
    }
    var j = junk(raw);
    if (j) {
      result.reason = j.reason;
      result.junk = j;
      return result;
    }
    result.assessed = true;

    var n = ws.length;
    var sents = sentences(raw);
    var lower = raw.toLowerCase().replace(/’/g, "'");
    var first = sents ? sents[0] : raw.split(/\s+/).slice(0, 25).join(' ');
    var lastTwo = sents ? sents.slice(-2).join(' ') : raw.split(/\s+/).slice(-30).join(' ');
    var acts = personalActions(raw);
    var examples = count(EXAMPLE, lower) + (raw.match(NAMED) || []).length;
    var weCount = count(/\bwe\b/, lower);
    var iCount = count(/\bi\b/, lower);
    var pts = result.points;
    var notes = result.notes;

    function strength(id, title, detail) { result.strengths.push({ id: id, title: title, detail: detail }); }
    function improve(id, title, detail, prompt) {
      result.improve.push({ id: id, title: title, detail: detail });
      if (prompt) { result.prompts.push(prompt); }
    }

    /* 1. Development (20): length against what suits this kind of question. */
    var range = question.lengths || DEFAULT_LENGTHS[kind] || [40, 220];
    var low = range[0];
    var high = range[1];
    if (n < low * 0.35) {
      pts.development = 3;
      improve('short', 'Add more detail', 'Your answer is ' + n + ' words. Around ' + low + ' to ' + high + ' words gives the interviewer enough to go on.',
        'Add a sentence on what you did, and one on why it matters.');
    } else if (n < low * 0.7) {
      pts.development = 8;
      improve('short', 'Add more detail', 'Your answer is ' + n + ' words. A little more (around ' + low + ' words or more) would show more of what you can do.',
        'What else happened? Add one more sentence about what you did or what came of it.');
    } else if (n < low) {
      pts.development = 14;
      notes.development = 'Nearly there: ' + n + ' words.';
    } else if (n <= high) {
      pts.development = 20;
      strength('length', 'Good amount of detail', 'At ' + n + ' words, your answer is long enough to be useful without dragging on.');
    } else if (n <= high * 1.5) {
      pts.development = 15;
      improve('long', 'Tighten it up', 'Your answer is ' + n + ' words. Interviewers can lose track after about ' + high + '.',
        'Which two points matter most? Keep those and cut the rest.');
    } else {
      pts.development = 10;
      improve('long', 'Much too long', 'Your answer is ' + n + ' words. Aim for ' + low + ' to ' + high + ' so the key points stand out.',
        'Try saying the whole answer in four sentences, then add detail only where it helps.');
    }

    /* 2. Structure (25). */
    if (question.star) {
      // STAR: a quarter of the marks for each part we can find.
      var actionLines = acts.length;
      // A scene is set by a "when/at college/last year" phrase, or by an
      // opening sentence describing what was happening ("was", "had").
      var star = {
        s: SITUATION.test(lower) || /\b(was|were|had)\b/.test(first.toLowerCase()),
        t: TASK.test(lower),
        a: actionLines >= 2 || (actionLines >= 1 && n < 60),
        r: RESULT.test(lower) || /\d+ ?%|£\d/.test(lower) || OUTCOME_VERBS.test(lastTwo)
      };
      result.star = star;
      var parts = ['s', 't', 'a', 'r'].filter(function (k) { return star[k]; }).length;
      pts.structure = Math.round(parts * 6.25);
      var NAMES = { s: 'Situation', t: 'Task', a: 'Action', r: 'Result' };
      var PROMPTS = {
        s: 'Situation: where were you and what was happening? One sentence is enough.',
        t: 'Task: what were you responsible for, or what needed to be done?',
        a: 'Action: what did you do yourself? Start a sentence with "I…".',
        r: 'Result: what happened afterwards, and what did you learn?'
      };
      if (parts === 4) {
        strength('star', 'Clear STAR structure', 'You covered the situation, your task, what you did and the result.');
      } else {
        var missing = ['s', 't', 'a', 'r'].filter(function (k) { return !star[k]; });
        improve('star', 'Structure your answer', 'We could not find the ' + missing.map(function (k) { return NAMES[k]; }).join(', ') +
          ' part' + (missing.length > 1 ? 's' : '') + ' of a STAR answer.', PROMPTS[missing[0]]);
        missing.slice(1).forEach(function (k) { result.prompts.push(PROMPTS[k]); });
      }
    } else if (kind === 'closing') {
      var questionsAsked = (raw.match(/\?/g) || []).length || (/\b(what|how|could you|would you|is there|are there|do you)\b/i.test(raw) ? 1 : 0);
      var thanks = /\bthank/i.test(raw);
      pts.structure = clamp((questionsAsked >= 2 ? 18 : questionsAsked ? 13 : 0) + (thanks ? 7 : 0), 0, 25);
      result.asks = questionsAsked;
      if (questionsAsked) {
        strength('asks', 'You asked questions', 'Asking ' + (questionsAsked >= 2 ? 'a couple of questions' : 'a question') + ' shows real interest in the role.');
      } else {
        improve('asks', 'Ask a question back', 'We could not find a question to the interviewer.', 'Add a question about the training, the team or a typical day.');
      }
      if (!thanks) {
        result.prompts.push('Start with a quick "Thank you, yes…" before your questions.');
      }
    } else {
      // Opening that answers directly, support in the middle, and a close.
      var opens = /\b(i|i'm|i'd|my|me|yes|for me|to me)\b/i.test(first) && (sents ? first.split(/\s+/).length <= 35 : true);
      var reasons = count(REASON, lower);
      var steps = count(STEPS, lower);
      var lastOne = sents ? sents[sents.length - 1] : lastTwo;
      var closes = (sents ? sents.length >= 2 : n >= 40) && (CLOSE.test(lastTwo) || SUMMING.test(lastOne));
      var middle;
      if (kind === 'situational') {
        middle = Math.min(9, (steps >= 2 ? 5 : steps ? 3 : 0) + (PURPOSE.test(lower) ? 4 : 0));
        if (!steps && !PURPOSE.test(lower)) {
          improve('steps', 'Walk through your steps', 'Say what you would do first, then next, and why.',
            'What would you do first? And then what? Add a "because" to explain why.');
        } else if (steps < 1) {
          result.prompts.push('Put your steps in order with words like "first", "then" and "if".');
        }
      } else {
        // Specific detail ("I noticed on your website…", a number, a
        // name) supports a point as well as "because" does.
        var support = reasons + (SPECIFIC.test(raw) ? 1 : 0) + (count(EXAMPLE, lower) ? 1 : 0);
        middle = support >= 2 ? 9 : support ? 5 : 0;
        if (!support) {
          improve('reasons', 'Back up your points', 'We could not find a reason or example supporting what you said (words such as "because" or "for example").',
            'Add "because…" or "for example…" after your main point.');
        }
      }
      pts.structure = (opens ? 8 : 3) + middle + (closes ? 8 : 0);
      if (!closes) {
        result.prompts.push(kind === 'situational' ?
          'Finish by saying what this would achieve, or a time you did something similar.' :
          'Finish with a sentence about what you would bring or what you are looking for.');
      }
      if (pts.structure >= 20) {
        strength('structure', 'Well organised', 'Your answer opens with a clear point, backs it up and finishes well.');
      } else if (pts.structure < 14 && !result.improve.some(function (f) { return f.id === 'reasons' || f.id === 'steps'; })) {
        improve('structure', 'Organise your answer', 'Open with your main point, back it up, then finish with a short conclusion.', null);
      }
    }

    /* 3. Examples and own actions (20). */
    if (kind === 'closing') {
      pts.examples = result.asks >= 2 ? 20 : result.asks ? 14 : 4;
    } else if (kind === 'motivation' || kind === 'situational') {
      // These ask for reasons or an approach, not a story: specific detail
      // and a clear personal approach count, and a real example is a bonus.
      var personal = acts.length + count(/\bi('d| would)? (enjoy|like|love|want)|\bi('m| am) (keen|interested|excited)|\bmy (placement|experience|skills|course|volunteering|job)\b/, lower);
      var specific = SPECIFIC.test(raw) || examples > 0;
      pts.examples = (specific ? 10 : 4) + (personal >= 2 ? 10 : personal ? 6 : 0);
      result.actions = acts.slice(0, 6);
      if (examples && personal >= 2) {
        strength('examples', 'Good examples', 'You backed up your answer with something specific from your own experience.');
      } else if (!specific) {
        improve('example', 'Make it specific', kind === 'motivation' ?
          'Your answer could fit any job. Mention something specific about the role, the company or your own experience.' :
          'A short real example would make your approach more convincing.',
          kind === 'motivation' ? 'Add one specific detail: something you noticed about the company, or a related experience.' :
            'Can you add a time you did something similar? Start with "When I…".');
      }
    } else {
      var exPts = examples >= 2 ? 10 : examples ? 8 : 0;
      var actPts = acts.length >= 3 ? 10 : acts.length === 2 ? 7 : acts.length ? 4 : 0;
      pts.examples = exPts + actPts;
      result.actions = acts.slice(0, 6);
      if (exPts && actPts >= 7) {
        strength('examples', 'Good examples', 'You used a real example and said what you did yourself (' + acts.slice(0, 2).map(function (a) { return '"' + a + '"'; }).join(', ') + ').');
      }
      if (!examples) {
        improve('example', 'Make it specific', 'We could not find a particular example (such as "When I…", "At college…" or "For example…").',
          'Could you describe a particular situation where you showed this? School, volunteering and hobbies all count.');
      }
      if (acts.length < 2) {
        improve('actions', 'Say what you did', acts.length ? 'Only one sentence describes something you did yourself.' : 'We could not find a sentence about what you did yourself.',
          'What did you do yourself? Start a sentence with "I…", for example "I organised…" or "I asked…".');
      } else if (weCount > iCount * 1.5 && weCount >= 3) {
        improve('we', 'Say "I" for your part', 'You say "we" ' + weCount + ' times. The interviewer wants to know what you did.',
          'Swap one "we" for "I" where it was your own action.');
      }
    }

    /* 4. Outcomes and reflection (15). */
    var results = count(RESULT, lower) + (/\d+ ?%|£\d/.test(lower) ? 1 : 0);
    var reflects = REFLECT.test(lower);
    if (kind === 'closing') {
      pts.outcomes = /\b(thank|interested|excited|look forward|keen)\b/i.test(raw) ? 15 : 7;
    } else if (kind === 'situational') {
      var aims = PURPOSE.test(lower) ? 1 : 0;
      var past = SITUATION.test(lower) || /\bwhen i\b|\blast time\b/.test(lower);
      pts.outcomes = (results || aims ? 10 : 0) + (reflects || past ? 5 : 0);
      if (!results && !aims) {
        improve('outcome', 'Say what it would achieve', 'Explain what your approach would lead to, such as a happy customer or a job done on time.',
          'Add a sentence starting "That way…" or "so that…".');
      } else if (past || reflects) {
        strength('outcome', 'Backed up with experience', 'You linked your approach to something you have done before.');
      }
    } else if (kind === 'intro' || kind === 'motivation') {
      var value = /\b(bring|offer|contribute|help (the|your|customers|the team)|benefit|make a difference|add)\b/i.test(lower) || CLOSE.test(lower);
      pts.outcomes = (results || value ? 10 : 3) + (reflects ? 5 : 0);
      if (!results && !value) {
        improve('outcome', 'Show what you would bring', 'Link your answer back to the job: what would you bring, or what came of your experience?',
          'Finish with what you would bring to the role.');
      }
      if (reflects) {
        strength('reflection', 'Strong reflection', 'You explained what you learned from your experience.');
      }
    } else {
      pts.outcomes = (results >= 2 ? 10 : results ? 7 : 0) + (reflects ? 5 : 0);
      if (!results) {
        improve('outcome', 'Include the result', 'We could not find what happened in the end.',
          'Try adding one sentence explaining what happened after you took action.');
      }
      if (!reflects) {
        result.prompts.push('What did you learn from it, or what would you do differently next time?');
      }
      if (results && reflects) {
        strength('reflection', 'Strong reflection', 'You explained the outcome and what you learned from it.');
      }
    }

    /* 5. Question-specific indicators (10). A hint only: words we would
          often expect in an answer to this question. */
    var stems = {};
    ws.forEach(function (w) { stems[stem(w)] = true; });
    var own = words(question.text).filter(function (w) {
      return w.length > 3 && STOP.indexOf(w) === -1 && QUESTION_FILLER.indexOf(w) === -1;
    });
    function present(k) {
      var parts = k.toLowerCase().split(/\s+/);
      return parts.length > 1 ? lower.indexOf(k.toLowerCase()) !== -1 : !!stems[stem(parts[0])];
    }
    var hits = (question.keywords || []).concat(own).filter(function (k, i, list) {
      if (list.indexOf(k) !== i) {
        return false;
      }
      return present(k) || (SAME[k.toLowerCase()] || []).some(present);
    });
    result.keywords = hits;
    pts.relevance = hits.length >= 3 ? 10 : hits.length === 2 ? 8 : hits.length === 1 ? 6 : 3;
    if (!hits.length) {
      improve('topic', 'Check you answered the question', 'We could not spot words we would usually expect in an answer to this question. This is only a hint: your answer may still be on topic.',
        'Re-read the question. Does your first sentence answer it directly?');
    }

    /* 6. Clarity and repetition (10). */
    var clarity = 10;
    if (sents && sents.length) {
      var avg = n / sents.length;
      result.avgSentence = Math.round(avg);
      if (avg > 32 || (sents.length === 1 && n > 45)) {
        clarity -= 4;
        improve('sentences', 'Shorter sentences', 'Your sentences average ' + Math.round(avg) + ' words. Shorter ones (under 25) are easier to follow.',
          'Split your longest sentence into two.');
      } else if (avg > 25) {
        clarity -= 2;
      }
    }
    var content = ws.filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1; });
    var freq = {};
    content.forEach(function (w) { freq[w] = (freq[w] || 0) + 1; });
    var topWord = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; })[0];
    if (topWord && freq[topWord] >= 4 && freq[topWord] / content.length >= 0.08) {
      clarity -= 3;
      result.repeated = { word: topWord, times: freq[topWord] };
      improve('repeat', 'Avoid repetition', 'You use "' + topWord + '" ' + freq[topWord] + ' times.',
        'Try a different word for "' + topWord + '" in one or two places.');
    }
    var tri = {};
    for (var i = 0; i + 2 < ws.length; i++) {
      var key = ws.slice(i, i + 3).join(' ');
      if (ws.slice(i, i + 3).filter(function (w) { return STOP.indexOf(w) !== -1; }).length < 2) {
        tri[key] = (tri[key] || 0) + 1;
      }
    }
    var repeatedPhrase = Object.keys(tri).filter(function (k) { return tri[k] >= 3; })[0];
    if (repeatedPhrase) {
      clarity -= 2;
      result.prompts.push('The phrase "' + repeatedPhrase + '" comes up ' + tri[repeatedPhrase] + ' times. Could you say it differently?');
    }
    // Filler words: everyone uses some when speaking, so they are only
    // mentioned when frequent, and cost at most two points.
    var fillers = (lower.match(SPOKEN_FILLERS) || []).length;
    result.fillers = fillers;
    if (fillers && fillers / n > 0.05) {
      clarity -= 2;
      improve('fillers', 'Fewer filler words', 'We counted ' + fillers + ' filler words such as "um" or "basically". A short pause works just as well.', null);
    }
    // Very short answers cannot show much clarity, structure or relevance
    // either way, so those are capped rather than given for free.
    if (n < low * 0.5) {
      clarity = Math.min(clarity, 5);
    }
    if (n < low * 0.35) {
      pts.structure = Math.min(pts.structure, 6);
      pts.relevance = Math.min(pts.relevance, 4);
    } else if (n < low * 0.7) {
      // Short answers: the parts found are there, but only in passing, so
      // they count in proportion to how much was said rather than in full
      // (otherwise 22 words could score as well as a full answer).
      var share = n / (low * 0.7);
      pts.structure = pts.structure * share;
      pts.examples = pts.examples * share;
      pts.outcomes = pts.outcomes * share;
      pts.relevance = Math.min(pts.relevance, 8);
    }
    pts.clarity = clamp(clarity, 0, 10);
    if (pts.clarity >= 9 && sents && sents.length >= 2 && n >= low * 0.7) {
      strength('clarity', 'Clear communication', 'Your sentences are a comfortable length and you vary your words.');
    }

    var total = 0;
    CATS.forEach(function (c) {
      pts[c.key] = clamp(Math.round(pts[c.key] || 0), 0, c.max);
      total += pts[c.key];
    });
    result.score = clamp(total, 0, 100);
    result.label = labelFor(result.score);
    result.prompts = result.prompts.filter(function (p, i, list) { return p && list.indexOf(p) === i; }).slice(0, 5);
    return result;
  }


  /* --- A whole session ------------------------------------------------------- */

  // What a strong or weak category means, in plain words.
  var CARD = {
    development: {
      good: ['Enough detail', 'Your answers were developed enough to show what you can do.'],
      work: ['Add more details', 'Explain what you did and what happened as a result.'],
      step: ['Build stronger examples', 'Choose one experience and describe what you did, why you did it and what happened next.', 'Practise detailed answers', 'detail']
    },
    structure: {
      good: ['Clear structure', 'Your answers were clearly organised and easy to follow.'],
      work: ['Structure your answers', 'Try the STAR method to keep your examples focused.'],
      step: ['Practise the STAR method', 'Try answering a teamwork or problem-solving question using Situation, Task, Action and Result.', 'Practise STAR questions', 'star']
    },
    examples: {
      good: ['Good examples', 'You used real examples and said what you did yourself.'],
      work: ['Make your answers more specific', 'Try adding a real example from school, volunteering or previous experience.'],
      step: ['Use real examples', 'Think of three experiences you could use: one from school or college, one from volunteering or a hobby, one from work if you have it.', 'Practise with examples', 'star']
    },
    outcomes: {
      good: ['Strong reflection', 'You explained what happened and what you learned.'],
      work: ['Include results', 'Explain what changed, what you achieved or what you learned.'],
      step: ['Show what you achieved', 'Try explaining the outcome of your actions, or what you learned.', 'Practise result-based questions', 'star']
    },
    relevance: {
      good: ['On topic', 'Your answers used the kind of words we would expect for each question.'],
      work: ['Answer the question asked', 'Open with a sentence that answers the question directly.'],
      step: ['Answer the question first', 'Re-read each question and make your first sentence a direct answer.', 'Retry a question', 'retry']
    },
    clarity: {
      good: ['Clear communication', 'Your answers were easy to understand.'],
      work: ['Avoid repetition', 'Use a wider range of words, and keep sentences short.'],
      step: ['Keep it clear', 'Read your answer aloud: if you run out of breath, split the sentence.', 'Retry a question', 'retry']
    }
  };

  function analyseSession(answers) {
    var assessed = answers.filter(function (a) { return a.result && a.result.assessed; });
    var out = { assessed: assessed.length, total: answers.length, categories: {}, strengths: [], work: [], steps: [] };
    if (!assessed.length) {
      out.score = null;
      out.label = 'Not assessed';
      out.summary = 'We could not score these answers yet. Add a typed answer or a transcript, and the practice tool can give you structured feedback.';
      out.steps.push({ id: 'review', title: 'Review your answer', detail: 'Add a typed response or transcript so the practice tool can offer structured feedback.', action: 'Review response', go: 'review' });
      return out;
    }
    var sum = 0;
    assessed.forEach(function (a) { sum += a.result.score; });
    // Skipped answers lower the overall score (up to 40%), so leaving
    // questions out cannot make a session look stronger than it was.
    var ratio = assessed.length / answers.length;
    out.average = Math.round(sum / assessed.length);
    out.score = Math.round(out.average * (0.6 + 0.4 * ratio));
    out.label = labelFor(out.score);

    CATS.forEach(function (c) {
      var s = 0;
      assessed.forEach(function (a) { s += a.result.points[c.key]; });
      var mean = s / assessed.length;
      out.categories[c.key] = { name: c.name, max: c.max, points: mean, share: mean / c.max, outOf10: Math.round(mean / c.max * 10) };
    });

    var ranked = CATS.map(function (c) { return c.key; }).sort(function (a, b) {
      return out.categories[a].share - out.categories[b].share;
    });
    ranked.slice().reverse().forEach(function (k) {
      var c = out.categories[k];
      if (c.share >= 0.75) {
        out.strengths.push({ id: k, title: CARD[k].good[0], detail: CARD[k].good[1], outOf10: c.outOf10 });
      }
    });
    ranked.forEach(function (k) {
      var c = out.categories[k];
      if (c.share < 0.6) {
        out.work.push({ id: k, title: CARD[k].work[0], detail: CARD[k].work[1], outOf10: c.outOf10,
          level: c.share < 0.35 ? 'fix' : 'tip', action: CARD[k].step[2], go: CARD[k].step[3] });
      }
    });

    // Skipped or unscorable answers are not counted as zero (that would
    // mix "not answered" with "answered badly"), but they are flagged.
    if (assessed.length < answers.length) {
      var missed = answers.length - assessed.length;
      out.work.unshift({ id: 'unanswered', title: 'Answer every question',
        detail: missed + ' of your ' + answers.length + ' answers could not be scored, which lowers your overall score. In a real interview, every answer counts.',
        outOf10: Math.round(assessed.length / answers.length * 10), level: assessed.length / answers.length < 0.5 ? 'fix' : 'tip',
        action: 'Review response', go: 'review' });
    }

    // Summary: the best thing, then the one thing that would help most.
    var best = out.strengths[0];
    var worst = out.work.filter(function (w) { return w.id !== 'unanswered'; })[0];
    out.summary = (best ? best.detail : 'You have made a start, and every answer you practise builds your confidence.') +
      (worst ? ' Next, ' + worst.detail.charAt(0).toLowerCase() + worst.detail.slice(1) :
        ratio < 1 ? ' Next time, try to answer every question.' : ' Keep practising to stay sharp.');
    out.focus = worst ? worst.title : null;

    // Next steps from the weakest areas, then a stretch if it went well.
    ranked.filter(function (k) { return out.categories[k].share < 0.6; }).slice(0, 2).forEach(function (k) {
      out.steps.push({ id: k, title: CARD[k].step[0], detail: CARD[k].step[1], action: CARD[k].step[2], go: CARD[k].step[3] });
    });
    if (out.score >= 80 || !out.steps.length) {
      out.steps.push({ id: 'stretch', title: 'Challenge yourself', detail: 'Try a harder interview question or complete another five-question assessment.', action: 'Start another assessment', go: 'session' });
    }
    if (assessed.length < answers.length) {
      out.steps.push({ id: 'review', title: 'Review your answer', detail: 'Some answers could not be scored. Add a typed response or transcript so the practice tool can offer structured feedback.', action: 'Review response', go: 'review' });
    }
    return out;
  }

  /** What changed since the previous session: only from saved results,
   *  and only when both sessions were scored. */
  function compare(prev, cur) {
    if (!prev || !cur || prev.score == null || cur.score == null) {
      return null;
    }
    var changes = [];
    CATS.forEach(function (c) {
      var a = prev.categories && prev.categories[c.key];
      var b = cur.categories[c.key];
      if (a && b) {
        var d = Math.round((b.share - a.share) * 100);
        if (Math.abs(d) >= 5) {
          changes.push({ key: c.key, name: c.name, delta: d });
        }
      }
    });
    changes.sort(function (x, y) { return Math.abs(y.delta) - Math.abs(x.delta); });
    return { delta: cur.score - prev.score, changes: changes };
  }

  var api = {
    CATS: CATS,
    LABELS: LABELS,
    analyseAnswer: analyseAnswer,
    analyseSession: analyseSession,
    compare: compare,
    labelFor: labelFor,
    personalActions: personalActions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MTWIA = api;
  }
}(this));

/* ==========================================================================
   MOVEMENT TO WORK: CV ANALYSER
   Rule-based CV reading and scoring. No AI, no network: every result
   comes from the checks written out below, so the same CV always gets the
   same score, and every point can be explained.

     readSections(text)  -> the CV split into Header, Summary, Experience,
                            Education, Skills and Other Sections
     analyse(cv)         -> scores, section results and feedback

   Works in the browser (window.MTWCV) and in Node (module.exports), so the
   rules can be tested without a page.
   ========================================================================== */

(function (root) {
  'use strict';

  /* ------------------------------------------------------------------------
     1. WORD LISTS
     ------------------------------------------------------------------------ */

  // Headings people use for each part of a CV. Matched against a whole line
  // (ignoring case, a trailing colon and surrounding symbols).
  var HEADINGS = {
    summary: [
      'summary', 'professional summary', 'personal summary', 'profile', 'personal profile',
      'professional profile', 'career profile', 'about me', 'personal statement', 'career summary',
      'career objective', 'objective', 'objectives', 'introduction', 'about', 'overview', 'career aim',
      'career aims', 'career goals', 'my goals', 'professional statement'
    ],
    experience: [
      'experience', 'work experience', 'employment', 'employment history', 'professional experience',
      'work history', 'career history', 'relevant experience', 'work placements', 'placements',
      'employment experience', 'volunteering', 'volunteer experience', 'voluntary work',
      'volunteering experience', 'internships', 'internship', 'experience and volunteering',
      'professional background', 'work background', 'employment background', 'career background',
      'career experience', 'previous employment', 'previous experience', 'employment record', 'work record',
      'positions held', 'jobs', 'paid work', 'part-time work', 'part time work', 'part-time jobs',
      'work experience and placements', 'placements and work experience', 'industry experience',
      'experience to date', 'where i have worked', 'voluntary experience', 'community work'
    ],
    education: [
      'education', 'qualifications', 'education and qualifications', 'education & qualifications',
      'academic background', 'academic qualifications', 'education and training', 'education & training',
      'training', 'academic history', 'schooling', 'school', 'schools', 'school and college',
      'education history', 'educational background', 'education background', 'educational history',
      'qualifications and training', 'training and development', 'professional development', 'cpd', 'studies'
    ],
    skills: [
      'skills', 'key skills', 'technical skills', 'core skills', 'skills and abilities', 'skills & abilities',
      'competencies', 'core competencies', 'key competencies', 'abilities', 'skills summary',
      'transferable skills', 'it skills', 'digital skills', 'skills and interests', 'strengths', 'key strengths',
      'skills and tools', 'tools', 'toolkit', 'software', 'tech stack', 'technical expertise', 'areas of expertise',
      'skills profile', 'skills overview', 'skill set', 'skillset', 'my skills', 'what i can offer',
      'what i bring', 'key skills and attributes', 'skills and qualities', 'personal skills', 'practical skills',
      'it and digital skills', 'computer skills', 'attributes', 'key attributes', 'qualities'
    ],
    other: [
      'interests', 'hobbies', 'hobbies and interests', 'hobbies & interests', 'achievements', 'awards',
      'achievements and awards', 'references', 'referees', 'languages', 'certifications', 'certificates',
      'courses', 'projects', 'additional information', 'activities', 'extracurricular activities',
      'memberships', 'licences', 'driving licence', 'publications', 'licences and certificates',
      'certificates and licences', 'licences and tickets', 'tickets', 'training and tickets', 'cards and tickets',
      'certifications and training', 'courses and certifications', 'certifications and licences',
      'key achievements', 'accomplishments', 'interests and hobbies', 'personal interests', 'other information',
      'further information', 'clubs and societies', 'awards and certificates'
    ]
  };

  // Strong verbs to open an experience bullet with.
  var ACTION_VERBS = (
    'achieved accelerated adapted addressed administered advised analysed analyzed answered arranged ' +
    'assembled assessed assisted audited automated balanced boosted briefed budgeted built calculated ' +
    'catalogued championed changed checked cleaned coached collaborated collected communicated compiled ' +
    'completed composed computed conducted configured consolidated constructed consulted contributed ' +
    'controlled converted coordinated co-ordinated counselled created cut debugged decreased defined ' +
    'delivered demonstrated designed developed devised diagnosed directed discovered displayed distributed ' +
    'documented drafted drove edited educated eliminated enabled encouraged engaged engineered enhanced ' +
    'ensured established estimated evaluated examined exceeded executed expanded expedited explained ' +
    'facilitated filed finalised fixed followed forecast formed founded gathered generated guided ' +
    'handled headed helped hired identified implemented improved increased influenced informed initiated ' +
    'inspected installed instructed integrated interviewed introduced investigated launched led liaised ' +
    'maintained managed marketed maximised measured mentored merged minimised modernised monitored ' +
    'motivated negotiated operated optimised orchestrated organised organized oversaw participated ' +
    'performed persuaded pioneered planned predicted prepared presented prioritised processed produced ' +
    'programmed promoted proposed protected provided published purchased raised ran reached recommended ' +
    'reconciled recorded recruited redesigned reduced refined registered reorganised reported represented ' +
    'researched resolved restored restructured reviewed revised scheduled secured served set shaped ' +
    'simplified sold solved sorted sourced spearheaded staffed standardised streamlined strengthened ' +
    'structured supervised supported surveyed sustained taught tested tracked trained transformed ' +
    'translated troubleshot tutored updated upgraded used verified volunteered welcomed won wrote ' +
    'worked gained learned learnt attended answered booked cared cooked greeted lifted loaded packed ' +
    'picked prepared restocked stocked tidied unloaded wrapped cleared carried drove fitted repaired ' +
    'progressed considered crafted prototyped iterated mapped optimized benchmarked partnered owned steered ' +
    'chaired authored illustrated photographed filmed moderated curated coded deployed migrated refactored ' +
    'scripted shipped validated hosted pitched grew modelled modeled visualised visualized interpreted ' +
    'tailored customised customized localised translated drafted contributed oversaw produced ' +
    'applied utilised utilized employed adopted assisted aided served handled processed welcomed ' +
    'resolved escalated logged scheduled booked invoiced audited reconciled forecasted presented ' +
    'pitched negotiated sourced procured researched surveyed tested user-tested piloted rolled ' +
    'introduced spearheaded championed mentored coached onboarded trained inducted supervised ' +
    'took mixed dealt priced opened closed counted covered kept baked prepped plated washed served ' +
    'replenished rotated unpacked received dispatched despatched labelled labeled scanned weighed ' +
    'wired plastered painted decorated laid dug installed safeguarded escorted patrolled responded ' +
    'de-escalated upsold cross-sold hit beat met cashed merchandised refilled fed bathed dressed ' +
    'accompanied comforted reassured listened advertised posted answered ordered stocktook audited ' +
    'demonstrated volunteered fundraised campaigned refereed captained umpired performed competed'
  ).split(/\s+/);

  // Alternatives to suggest when a verb is overused.
  var VERB_ALTERNATIVES = {
    developed: ['Designed', 'Created', 'Established', 'Implemented', 'Produced', 'Introduced'],
    managed: ['Led', 'Directed', 'Oversaw', 'Coordinated', 'Supervised', 'Organised'],
    helped: ['Supported', 'Assisted', 'Enabled', 'Contributed to', 'Facilitated', 'Guided'],
    worked: ['Collaborated', 'Partnered', 'Contributed', 'Delivered', 'Operated', 'Served'],
    created: ['Designed', 'Built', 'Produced', 'Developed', 'Launched', 'Composed'],
    improved: ['Enhanced', 'Strengthened', 'Streamlined', 'Refined', 'Upgraded', 'Boosted'],
    supported: ['Assisted', 'Helped', 'Enabled', 'Guided', 'Advised', 'Aided'],
    used: ['Applied', 'Operated', 'Employed', 'Utilised', 'Ran', 'Handled'],
    led: ['Headed', 'Directed', 'Guided', 'Chaired', 'Steered', 'Coordinated'],
    made: ['Created', 'Built', 'Produced', 'Prepared', 'Designed', 'Generated'],
    did: ['Completed', 'Carried out', 'Performed', 'Delivered', 'Achieved', 'Conducted'],
    responsible: ['Led', 'Managed', 'Owned', 'Oversaw', 'Ran', 'Directed']
  };

  // Phrases that tell an employer little on their own.
  var GENERIC_PHRASES = [
    'hard working', 'hard-working', 'hardworking', 'team player', 'self-motivated', 'self motivated',
    'highly motivated', 'motivated individual', 'go-getter', 'go getter', 'results-driven', 'results driven',
    'detail-oriented', 'detail oriented', 'excellent communication skills', 'good communication skills',
    'works well under pressure', 'work well under pressure', 'think outside the box', 'passionate about',
    'dynamic', 'proactive', 'enthusiastic individual', 'reliable and trustworthy', 'fast learner',
    'quick learner', 'can work independently', 'work well in a team', 'people person', 'synergy',
    'best of breed', 'thought leader', 'dedicated individual', 'driven individual'
  ];

  // Wording that hides what was actually done.
  var VAGUE_PHRASES = [
    'responsible for', 'duties included', 'duties include', 'tasks included', 'helped with',
    'involved in', 'worked on', 'in charge of', 'various', 'etc', 'stuff', 'things', 'and so on',
    'and more', 'a lot of', 'lots of', 'some experience'
  ];

  // Mostly people skills (useful, but on their own they say little about
  // what someone can actually do in a role).
  var SOFT_SKILLS = [
    'communication', 'teamwork', 'team work', 'leadership', 'problem solving', 'problem-solving',
    'time management', 'organisation', 'organization', 'organisational', 'adaptability', 'flexibility',
    'creativity', 'reliability', 'punctuality', 'motivation', 'work ethic', 'interpersonal',
    'customer service', 'listening', 'confidence', 'empathy', 'patience', 'resilience',
    'decision making', 'critical thinking', 'attention to detail', 'multitasking', 'collaboration',
    'positive attitude', 'self-motivated', 'hardworking', 'hard working', 'team player'
  ];

  // Common misspellings in CVs (small, local list: no dictionary service).
  var MISSPELLINGS = {
    recieve: 'receive', recieved: 'received', acheive: 'achieve', acheived: 'achieved',
    acheivement: 'achievement', acheivements: 'achievements', managment: 'management',
    enviroment: 'environment', experiance: 'experience', expereince: 'experience',
    responsable: 'responsible', responsibilty: 'responsibility', seperate: 'separate',
    occured: 'occurred', definately: 'definitely', untill: 'until', sucessful: 'successful',
    succesful: 'successful', successfull: 'successful', comunication: 'communication',
    communciation: 'communication', proffesional: 'professional', profesional: 'professional',
    knowlege: 'knowledge', liase: 'liaise', liason: 'liaison', independant: 'independent',
    reliabe: 'reliable', excellant: 'excellent', excelent: 'excellent', oppurtunity: 'opportunity',
    oportunity: 'opportunity', calender: 'calendar', accomodate: 'accommodate',
    accomodation: 'accommodation', begining: 'beginning', beleive: 'believe', commited: 'committed',
    concious: 'conscious', curiculum: 'curriculum', dependant: 'dependent', embarass: 'embarrass',
    goverment: 'government', guidence: 'guidance', immediatly: 'immediately', maintainance: 'maintenance',
    neccessary: 'necessary', necesary: 'necessary', occassion: 'occasion', persue: 'pursue',
    posession: 'possession', prefered: 'preferred', priviledge: 'privilege', recomend: 'recommend',
    reccomend: 'recommend', refered: 'referred', relevent: 'relevant', resposibilities: 'responsibilities',
    responsibilites: 'responsibilities', speach: 'speech', strenght: 'strength', strenghts: 'strengths',
    tommorow: 'tomorrow', truely: 'truly', wich: 'which', writting: 'writing'
  };

  var QUALIFICATION_WORDS = [
    'gcse', 'gcses', 'a level', 'a-level', 'a levels', 'a-levels', 'as level', 'btec', 'nvq', 'hnc', 'hnd',
    'degree', 'bsc', 'ba ', 'b.a', 'b.sc', 'msc', 'ma ', 'mba', 'phd', 'pgce', 'diploma', 'certificate',
    'apprenticeship', 'university', 'college', 'school', 'academy', 'sixth form', 'foundation',
    't level', 't-level', 'access to', 'level 1', 'level 2', 'level 3', 'level 4', 'cscs', 'functional skills',
    'grade', 'honours', 'hons', '2:1', '2:2', 'first class'
  ];

  var GOAL_WORDS = [
    'seeking', 'looking for', 'looking to', 'aim to', 'aiming to', 'hope to', 'keen to', 'eager to',
    'role', 'position', 'opportunity', 'career', 'goal', 'ambition', 'want to', 'would like to',
    'interested in', 'interest in', 'pursue', 'pursuing', 'aspiring', 'aspire', 'next step', 'progress into',
    'move into', 'moving into', 'build on', 'grow my', 'develop my', 'developing expertise', 'specialise in',
    'specialising in', 'open to', 'ready to', 'excited to', 'motivated to', 'hoping to', 'aiming for',
    'graduate scheme', 'entry-level', 'entry level'
  ];

  var MONTHS = 'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|' +
    'sep|sept|september|oct|october|nov|november|dec|december';

  var STOP = ('a an the and or of to in on for with at by from as is are was were be been it its this that ' +
    'my i me we our you your their they he she his her them our has have had will would can could also ' +
    'into over under up out about more most very than then so not no yes all any each other such').split(' ');


  /* ------------------------------------------------------------------------
     2. TEXT HELPERS
     ------------------------------------------------------------------------ */

  function words(text) {
    return (text.toLowerCase().match(/[a-z][a-z'\-]*/g) || []);
  }

  function wordCount(text) {
    return (text.match(/\S+/g) || []).length;
  }

  function lines(text) {
    return text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  }

  /** Lines as the writer meant them: a line that carries on from the one
   *  before (it starts with a small letter, or the one before ends in a
   *  hyphen) is joined back on. PDFs break long sentences across lines. */
  function logicalLines(text) {
    var out = [];
    lines(text).forEach(function (l) {
      var prev = out[out.length - 1];
      var bulleted = stripBullet(l) !== l;
      if (prev && !bulleted && (/^[a-z(]/.test(l) || /[a-z]-$/.test(prev)) && !/[.:;!?]$/.test(prev)) {
        out[out.length - 1] = /[a-z]-$/.test(prev) ? prev + l : prev + ' ' + l;
      } else {
        out.push(l);
      }
    });
    return out;
  }

  /** The past-tense form of a verb in the list, for any form a CV might
   *  use: "Organised", "Organising", "Organise", "Organises", "Led",
   *  "Leading". Returns null when the word is not one of the verbs. */
  var IRREGULAR = { leading: 'led', lead: 'led', leads: 'led', running: 'ran', run: 'ran', runs: 'ran',
    writing: 'wrote', write: 'wrote', writes: 'wrote', driving: 'drove', drive: 'drove', building: 'built',
    build: 'built', builds: 'built', selling: 'sold', sell: 'sold', teaching: 'taught', teach: 'taught',
    overseeing: 'oversaw', oversee: 'oversaw', setting: 'set', cutting: 'cut', winning: 'won',
    making: 'made', make: 'made', doing: 'did', do: 'did', forecasting: 'forecast',
    learning: 'learned', learn: 'learned' };
  function verbKey(word) {
    var w = (word || '').toLowerCase().replace(/[^a-z\-]/g, '');
    if (!w) {
      return null;
    }
    if (IRREGULAR[w]) {
      return IRREGULAR[w];
    }
    if (ACTION_VERBS.indexOf(w) !== -1) {
      return w;
    }
    var stems = [];
    if (/ing$/.test(w)) {
      var b = w.slice(0, -3);
      stems.push(b + 'ed', b + 'd', b + 'ted', b.replace(/(.)\1$/, '$1') + 'ed', b + 'ied');
      stems.push(b.slice(0, -1) + 'ied');
    }
    if (/ies$/.test(w)) {
      stems.push(w.slice(0, -3) + 'ied');
    }
    if (/s$/.test(w)) {
      stems.push(w.slice(0, -1) + 'd', w.slice(0, -1) + 'ed', w.slice(0, -2) + 'ed');
    }
    stems.push(w + 'd', w + 'ed', w.replace(/y$/, 'ied'));
    for (var i = 0; i < stems.length; i++) {
      if (ACTION_VERBS.indexOf(stems[i]) !== -1) {
        return stems[i];
      }
    }
    return null;
  }

  /** A line that names a role rather than describing what was done:
   *  "Sales Assistant – Next | Jun 2022 to Present". */
  function isRoleLine(l, dated) {
    if (dated.test(l) || / \| /.test(l)) {
      return true;
    }
    var first = (stripBullet(l).match(/^[A-Za-z\-]+/) || [''])[0];
    return stripBullet(l) === l && / [–\u2014-] /.test(l) && wordCount(l) <= 12 && !verbKey(first);
  }

  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function countPhrase(text, phrase) {
    var re = new RegExp('(^|[^a-z])' + escapeReg(phrase) + '(?![a-z])', 'gi');
    return (text.match(re) || []).length;
  }

  function stripBullet(line) {
    // A lone "o" (a common Word bullet) only counts when a space follows,
    // so "organisation" keeps its first letter.
    return line.replace(/^(?:[\s•●▪■‣⁃∙·*\-–\u2014>➢➤►▸◦○✓✔]+|o\s+)+/, '');
  }

  /** Split a list on commas, semicolons, pipes and bullets, but not inside
   *  brackets: "Microsoft Office (Word, Excel), Git" is two items. */
  function splitList(body) {
    var out = [];
    var depth = 0;
    var cur = '';
    for (var i = 0; i < body.length; i++) {
      var ch = body.charAt(i);
      if (ch === '(' || ch === '[') {
        depth += 1;
      } else if ((ch === ')' || ch === ']') && depth) {
        depth -= 1;
      }
      if (!depth && /[,;|•●·]/.test(ch)) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /** A point that opens with a short label, such as "Front-End
   *  Development: Built the prototype...", read from after the label. */
  function dropLabel(s) {
    var m = s.match(/^([^:]{2,50}):\s+(\S.*)$/);
    if (m && wordCount(m[1]) <= 6 && !/https?$/i.test(m[1])) {
      return m[2];
    }
    return s;
  }

  /** A line that is a list of short items rather than a sentence:
   *  "Figma, HTML, CSS, JavaScript" or "Tools: Excel, Word, Outlook". */
  function isListLine(l) {
    var body = dropLabel(stripBullet(l));
    var items = splitList(body);
    if (items.length < 3) {
      return false;
    }
    var short = items.filter(function (it) { return wordCount(it) <= 4; }).length;
    return short / items.length >= 0.8 && !verbKey((body.match(/^[A-Za-z\-]+/) || [''])[0]);
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }


  /* ------------------------------------------------------------------------
     3. READING THE CV
     ------------------------------------------------------------------------ */

  /** Which section a line is a heading for, if any.
   *  1. The whole line is a known heading ("Skills", "Employment History").
   *  2. With "&", "and" and qualifiers such as "tools", "key" or "relevant"
   *     taken out, what is left is a known heading ("Skills & Tools",
   *     "Relevant Work Experience", "Education and Training").
   *  3. A line styled as a heading (capitals, a colon at the end, or larger
   *     or bold text in the file) whose last word is a section word:
   *     "DIGITAL MARKETING, SEO & TECHNICAL SKILLS", "Key Skills:".
   *  4. A short line in title case ending in a section word, such as
   *     "Customer Service Skills" or "Retail Experience".
   *  A line ending in a full stop, with digits, an email or link, or more
   *  than eight words is never a heading, so sentences and points are not
   *  mistaken for one. */
  var QUALIFIERS = ('and tools tool technologies technology software key core technical professional relevant ' +
    'additional other personal selected main my areas of in at highlights overview summary details ' +
    'information history background expertise abilities competencies').split(' ');
  var SECTION_WORDS = [
    ['skills', /\bskills?\b|\bcompetenc|\bexpertise\b|\btoolkit\b|\btools\b|\bcapabilities\b|\bproficienc|\btech stack\b|\bstrengths\b/],
    ['experience', /\bexperience\b|\bemployment\b|\bwork history\b|\bcareer history\b|\bcareer\b|\bplacements?\b|\binternships?\b|\bvolunteer|\bjobs\b|\broles\b|\bwork\b/],
    ['education', /\beducation\b|\bqualifications?\b|\bacademic|\btraining\b|\bcertificat|\bstudies\b|\bschooling\b|\bcourses?\b/],
    ['summary', /\bsummary\b|\bprofile\b|\babout me\b|\babout\b|\bpersonal statement\b|\bobjectives?\b|\bintroduction\b|\bbio\b/],
    ['other', /\binterests?\b|\bhobbies\b|\bawards?\b|\bachievements?\b|\breferences?\b|\breferees\b|\blanguages?\b|\bprojects?\b|\bportfolio\b|\bactivities\b|\bpublications?\b|\bmemberships?\b|\blicen[cs]es?\b|\btickets\b|\baccomplishments\b/]
  ];
  // Words a heading can end in (after qualifiers such as "tools").
  var ENDINGS = /(skills?|competencies|expertise|toolkit|tools|capabilities|strengths|experience|employment|history|placements?|internships?|volunteering|education|qualifications?|training|certifications?|certificates|courses|summary|profile|statement|objectives?|interests|hobbies|awards|achievements|references|referees|languages|projects|portfolio|activities|publications|memberships|licences|licenses|tickets|accomplishments)$/;
  function headingKind(line, styled) {
    var raw = line.replace(/^[\s#*\-•|=_~>]+|[\s#*\-•|=_~]+$/g, '');
    var colon = /:\s*$/.test(raw);
    raw = raw.replace(/:\s*$/, '').trim();
    var clean = raw.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z\s'\/\-]/g, ' ').replace(/\s+/g, ' ').trim();
    var count = clean ? clean.split(' ').length : 0;
    if (!clean || raw.length > 60 || count > 8 || /\d/.test(raw) || /[.!?]$/.test(raw) || /[:;]/.test(raw) ||
        /@|https?:|www\.|\.com\b/i.test(raw)) {
      return null;
    }
    var kinds = ['summary', 'experience', 'education', 'skills', 'other'];
    var i;
    var flat = clean.replace(/[,\-]/g, ' ').replace(/\s+/g, ' ');
    for (i = 0; i < kinds.length; i++) {
      if (HEADINGS[kinds[i]].indexOf(flat) !== -1) {
        return kinds[i];
      }
    }
    var core = flat.split(/[\s\/]+/).filter(function (w) { return QUALIFIERS.indexOf(w) === -1; }).join(' ');
    for (i = 0; i < kinds.length; i++) {
      if (core && HEADINGS[kinds[i]].indexOf(core) !== -1) {
        return kinds[i];
      }
    }
    // From here on the line has to end in a section word, so a role
    // ("Training Assistant, Next") or a skill ("Problem solving") is left
    // alone. The ending decides the kind: "Projects and Experience" is
    // experience, "Experience and Projects" is projects.
    var tail = flat.replace(/\s+(and|&)\s+(tools|software|technologies|abilities)$/, '');
    var end = tail.match(ENDINGS);
    if (!end) {
      return null;
    }
    var letters = raw.replace(/[^A-Za-z]/g, '');
    var shouting = letters.length >= 4 && letters === letters.toUpperCase();
    var titled = raw.split(/\s+/).every(function (w) {
      return !/^[a-z]/.test(w) || /^(and|of|in|at|for|to|the|&)$/.test(w);
    });
    var strong = /^(skills|experience|employment|history|education|qualifications|summary|profile|interests|achievements|accomplishments|projects|certifications|certificates|licences|licenses|tickets|languages|references)$/.test(end[0]);
    if (shouting || colon || styled || (titled && strong && count <= 7)) {
      for (i = 0; i < SECTION_WORDS.length; i++) {
        if (SECTION_WORDS[i][1].test(end[0])) {
          return SECTION_WORDS[i][0];
        }
      }
    }
    return null;
  }

  var EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
  var PHONE_RE = /(?:\+?44\s?\(?0?\)?|\(?0)\s?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/;
  var POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i;
  var LINKEDIN_RE = /linkedin\.com\/[A-Za-z0-9\-_/]+/i;
  var PLACE_RE = new RegExp('(,\\s*(uk|united kingdom|gb|england|scotland|wales|northern ireland)\\b)|\\b(' +
    'lancashire|merseyside|cheshire|cumbria|yorkshire|greater manchester|west midlands|staffordshire|derbyshire|' +
    'skelmersdale|ormskirk|wigan|preston|chorley|southport|st helens|warrington|bolton|leigh|liverpool|manchester|' +
    'blackburn|blackpool|burnley|lancaster|london|leeds|birmingham|sheffield|bristol|newcastle|nottingham|' +
    'leicester|glasgow|edinburgh|cardiff|belfast|remote|open to relocation)\\b', 'i');

  /** Pull the contact details out of the header block. Only what can be
   *  found reliably is filled in; anything else is left blank. */
  function readHeader(text) {
    var ls = lines(text);
    var email = (text.match(EMAIL_RE) || [''])[0];
    var phone = (text.match(PHONE_RE) || [''])[0].trim();
    var linkedin = (text.match(LINKEDIN_RE) || [''])[0];
    var name = '';
    var title = '';
    var location = '';
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i];
      if (EMAIL_RE.test(l) || PHONE_RE.test(l) || LINKEDIN_RE.test(l) || /https?:\/\//i.test(l)) {
        // A place written on the same line as the email or phone number:
        // whatever is left once those are taken out, if it reads as a name.
        if (!location) {
          // Each piece between separators is checked on its own, with notes
          // in brackets such as "(Open to Relocation)" left out.
          l.split(/\s*[|•·]\s*|\s+\/\s+|\s{3,}/).some(function (part) {
            var rest = part.replace(EMAIL_RE, ' ').replace(PHONE_RE, ' ').replace(LINKEDIN_RE, ' ')
              .replace(/https?:\/\/\S+|\b[\w\-]+\.(com|co\.uk|net|org|app|io|dev|me|uk)\b\S*/gi, ' ')
              .replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[,\s]+|[,\s]+$/g, '');
            if (rest && rest.length <= 50 && (/^[A-Z][A-Za-z'\-]+([ ,]+[A-Z][A-Za-z'\-]+){0,3}$/.test(rest) || POSTCODE_RE.test(rest) || PLACE_RE.test(rest))) {
              location = rest;
              return true;
            }
            return false;
          });
        }
        continue;
      }
      if (!name && /^[A-Za-z][A-Za-z'\-]+(\s+[A-Za-z][A-Za-z'\-]+){1,3}$/.test(l) && l.length <= 40) {
        name = l;
        continue;
      }
      if (name && !title && l.length <= 60 && !POSTCODE_RE.test(l) && !PLACE_RE.test(l) && wordCount(l) <= 8 && !/[.!?]$/.test(l)) {
        title = l;
        continue;
      }
      if (!location && (POSTCODE_RE.test(l) || PLACE_RE.test(l)) && wordCount(l) <= 8) {
        location = l.replace(EMAIL_RE, '').replace(PHONE_RE, '').replace(/\([^)]*\)/g, '').replace(/[|•,\s]+$/, '').trim();
      }
    }
    return { name: name, title: title, email: email, phone: phone, location: location, linkedin: linkedin };
  }

  function norm(l) {
    return l.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // A point in time: "Jun 2023", "June '23", "Jan 22", "Summer 2022",
  // "06/2023" or "2023". A range is two of these, or one and "Present".
  var MONTH_YEAR = '(?:(?:' + MONTHS + ')\\.?\\s+(?:(?:19|20)\\d{2}|\'?\\d{2}\\b))';
  var WHEN = '(?:' + MONTH_YEAR + '|(?:spring|summer|autumn|winter)\\s+(?:19|20)\\d{2}|\\b\\d{1,2}\\/(?:19|20)?\\d{2}\\b|(?:19|20)\\d{2})';
  var RANGE_RE = new RegExp(WHEN + '\\s*(?:-|–|\u2014|to|until|till)\\s*(?:' + WHEN +
    '|present|current|now|date|ongoing|today)', 'i');
  var QUAL_RE = /\b(gcses?|a[\s\-]levels?|as level|btec|nvq|hnc|hnd|bsc|b\.sc|ba|b\.a|msc|m\.sc|ma|mba|phd|pgce|degree|diploma|t[\s\-]level|foundation year|access to|level [1-7]|functional skills|(first|2:1|2:2|third)[\s\-]class|honours|\(hons\))\b/i;
  var CONTACT_RE = /@|https?:|www\.|linkedin\.com|github\.com|\+?\d[\d\s]{8,}/i;

  /** A line that belongs in a skills list. */
  function isSkillLine(l) {
    if (CONTACT_RE.test(l) || /[.!?]$/.test(l)) {
      return false;
    }
    var body = stripBullet(l);
    var group = body.match(/^([^:]{2,45}):\s*(.+)$/);
    if (group && wordCount(group[1]) <= 6 && splitList(group[2]).length >= 2) {
      return true;
    }
    return isListLine(l);
  }

  /**
   * Sections without a heading this recognises, found from what they look
   * like, so a CV is read properly even when its headings are unusual:
   *  - skills: lines that are lists of short items, or "Label: a, b, c";
   *  - experience: a line with a date range ("Jun 2022 - Present") that is
   *    not a qualification, and the points under it;
   *  - education: lines naming a qualification ("BSc", "GCSEs", "BTEC");
   *  - summary: sentences straight after the contact details.
   * Only empty sections are filled, and each one found this way is listed
   * in cv.inferred so the review can suggest a clear heading.
   */
  function inferSections(buf, others, marks) {
    var inferred = [];
    function take(kind, from, start, end) {
      var moved = buf[from].splice(start, end - start);
      if (!marks[kind]) {
        marks[kind] = moved[0];
      }
      buf[kind] = buf[kind].concat(moved);
      inferred.push(kind);
    }
    var hasSkills = skillList(buf.skills.join('\n')).length > 0;
    if (!hasSkills) {
      // The longest run of skill lines outside the experience.
      var best = null;
      ['header', 'summary', 'education'].forEach(function (from) {
        var ls = buf[from];
        for (var i = 0; i < ls.length; i++) {
          if (!isSkillLine(ls[i])) {
            continue;
          }
          var j = i + 1;
          while (j < ls.length && (isSkillLine(ls[j]) ||
              (stripBullet(ls[j]) === ls[j] && !/[.!?:]$/.test(ls[j]) && wordCount(ls[j]) <= 8 && !headingKind(ls[j]) && !RANGE_RE.test(ls[j])))) {
            j++;
          }
          var items = skillList(ls.slice(i, j).join('\n')).length;
          if (items >= 4 && (!best || items > best.items)) {
            best = { from: from, start: i, end: j, items: items };
          }
          i = j - 1;
        }
      });
      if (best) {
        take('skills', best.from, best.start, best.end);
      }
    }
    if (wordCount(buf.experience.join(' ')) < 5) {
      ['summary', 'header'].some(function (from) {
        var ls = buf[from];
        for (var i = 0; i < ls.length; i++) {
          if (RANGE_RE.test(ls[i]) && !QUAL_RE.test(ls[i]) && !CONTACT_RE.test(ls[i]) && wordCount(ls[i]) <= 16) {
            var points = ls.slice(i + 1).filter(function (l) { return wordCount(l) >= 4; }).length;
            if (points) {
              var end = i + 1;
              while (end < ls.length && !(QUAL_RE.test(ls[end]) && wordCount(ls[end]) <= 14)) {
                end++;
              }
              take('experience', from, i, end);
              return true;
            }
          }
        }
        return false;
      });
    }
    if (wordCount(buf.education.join(' ')) < 2) {
      ['experience', 'summary', 'header'].some(function (from) {
        var ls = buf[from];
        for (var i = 0; i < ls.length; i++) {
          if (QUAL_RE.test(ls[i]) && wordCount(ls[i]) <= 14 && !/[.!?]$/.test(ls[i])) {
            var end = i + 1;
            // The lines that go with it: dates, grades or the place studied,
            // up to the next role ("Sales Assistant – Next | 2022 - 2023").
            while (end < ls.length && (QUAL_RE.test(ls[end]) || (wordCount(ls[end]) <= 8 &&
                stripBullet(ls[end]) === ls[end] && !/[–\u2014|]/.test(ls[end].replace(RANGE_RE, ''))))) {
              end++;
            }
            take('education', from, i, end);
            return true;
          }
        }
        return false;
      });
    }
    if (wordCount(buf.summary.join(' ')) < 5) {
      var ls = buf.header;
      var contactAt = -1;
      // The last contact line near the top (name, title, contact details).
      ls.slice(0, 8).forEach(function (l, n) { if (CONTACT_RE.test(l) && wordCount(l) <= 16) { contactAt = n; } });
      var start = contactAt + 1;
      while (start < ls.length && wordCount(ls[start]) < 8) {
        start++;
      }
      if (contactAt >= 0 && start < ls.length) {
        var stop = start;
        while (stop < ls.length && (wordCount(ls[stop]) >= 6 || /^[a-z]/.test(ls[stop]))) {
          stop++;
        }
        if (wordCount(ls.slice(start, stop).join(' ')) >= 15) {
          take('summary', 'header', start, stop);
        }
      }
    }
    return inferred;
  }

  /**
   * Split plain CV text into sections. Lines before the first recognised
   * heading are the header. Anything under a heading this does not know
   * goes into Other Sections with its own title, so nothing is lost.
   * `styled` lists lines the file shows as headings (larger or bold text,
   * or Word heading styles); they are read as headings more readily.
   */
  function readSections(text, styled) {
    var cv = { header: '', summary: '', experience: '', education: '', skills: '', other: [] };
    var current = 'header';
    var buffers = { header: [], summary: [], experience: [], education: [], skills: [] };
    var otherCurrent = null;
    var marks = {};
    var styledSet = {};
    (styled || []).forEach(function (l) { styledSet[norm(l)] = true; });
    lines(text).forEach(function (line) {
      var kind = headingKind(line, !!styledSet[norm(line)]);
      if (kind) {
        if (kind === 'other') {
          otherCurrent = { title: cap(line.replace(/[:\s]+$/, '').toLowerCase()), lines: [] };
          cv.other.push(otherCurrent);
        } else if (!marks[kind]) {
          marks[kind] = line;
        }
        current = kind;
        return;
      }
      if (current === 'other') {
        otherCurrent.lines.push(line);
      } else {
        buffers[current].push(line);
      }
    });
    cv.inferred = inferSections(buffers, cv.other, marks);
    Object.keys(buffers).forEach(function (k) {
      cv[k] = buffers[k].join('\n');
    });
    cv.other = cv.other.map(function (o) {
      return { title: o.title, text: o.lines.join('\n') };
    });
    cv.marks = marks;
    cv.recognised = ['summary', 'experience', 'education', 'skills'].filter(function (k) {
      return cv[k].trim();
    }).length + cv.other.length;
    return cv;
  }

  /** The CV back into one block of text (for whole-document checks). */
  function fullText(cv) {
    return [cv.header, cv.summary, cv.experience, cv.education, cv.skills]
      .concat(cv.other.map(function (o) { return o.title + '\n' + o.text; }))
      .join('\n');
  }

  /** Split a skills section into separate skills. */
  /** Each skill on its own. Handles lists split by commas, bullets,
   *  semicolons or pipes, one per line, and grouped lines such as
   *  "UI/UX Design: Figma, Wireframing, Prototyping" (the group name
   *  before the colon is a label, not a skill). */
  function skillList(text) {
    var out = [];
    // In a bulleted list, a line without a bullet carries on the one
    // before ("...Google Lighthouse, Core" + "Web Vitals Fundamentals").
    var raw = lines(text);
    var bulleted = raw.some(function (l) { return stripBullet(l) !== l; });
    var joined = [];
    raw.forEach(function (l) {
      if (joined.length && bulleted && stripBullet(l) === l && !/^[^:]{2,45}:/.test(l)) {
        joined[joined.length - 1] += ' ' + l;
      } else {
        joined.push(l);
      }
    });
    joined.forEach(function (l) {
      var body = stripBullet(l);
      var label = body.match(/^([^:]{2,45}):\s*(.+)$/);
      if (label) {
        body = label[2];
      }
      [].concat.apply([], splitList(body).map(function (part) {
        return part.split(/\s+[–\u2014]\s+/);
      })).forEach(function (s) {
        var item = stripBullet(s).replace(/^(and|&)\s+/i, '').replace(/[.:]+$/, '').trim();
        if (item && item.length <= 60 && /[A-Za-z]/.test(item)) {
          out.push(item);
        }
      });
    });
    return out;
  }

  // Words that say nothing about which skill it is.
  var SKILL_GENERIC = ('skills skill good strong basic advanced excellent knowledge awareness understanding ' +
    'ability abilities experience time level working work using use of the and with in for to a an ' +
    'microsoft').split(' ');
  function stem(w) {
    return w.length > 5 ? w.slice(0, 5) : w.replace(/(ing|ed|es|s)$/, '');
  }

  /** Whether a listed skill shows up in the writing: the whole phrase, or
   *  at least half of its telling words (any form of them). */
  function skillEvidenced(skill, evidence) {
    var low = skill.toLowerCase();
    if (low.length > 2 && countPhrase(evidence, low.replace(/\s*\(.*$/, '')) > 0) {
      return true;
    }
    var have = {};
    words(evidence).forEach(function (w) { have[stem(w)] = true; });
    var keys = words(low).filter(function (w) {
      return w.length >= 3 && SKILL_GENERIC.indexOf(w) === -1 && STOP.indexOf(w) === -1;
    });
    if (!keys.length) {
      return false;
    }
    var hit = keys.filter(function (w) { return have[stem(w)]; }).length;
    return hit >= Math.ceil(keys.length / 2);
  }

  /** The same skill listed more than once (ignoring case and spacing). */
  function duplicateSkills(list) {
    var seen = {};
    list.forEach(function (s) {
      var k = s.toLowerCase().replace(/[^a-z0-9+#]/g, '');
      if (k) {
        seen[k] = seen[k] || { name: s, count: 0 };
        seen[k].count += 1;
      }
    });
    return Object.keys(seen).map(function (k) { return seen[k]; }).filter(function (d) { return d.count > 1; });
  }

  /** A skills list is judged item by item: "Microsoft Word, Microsoft
   *  Excel" is fine, "Figma, Figma, Figma" is not. */
  function skillQuality(text) {
    var list = skillList(text);
    var dupes = duplicateSkills(list);
    var extra = dupes.reduce(function (n, d) { return n + d.count - 1; }, 0);
    var repeated = list.length >= 3 && extra / list.length >= 0.4;
    var single = list.length === 1 && wordCount(list[0]) >= 4 && textQuality(list[0]).repeated;
    var filler = FILLER_RE.test(text);
    var top = dupes.sort(function (a, b) { return b.count - a.count; })[0];
    var inner = single ? textQuality(list[0]) : null;
    return {
      ok: !repeated && !single && !filler,
      repeated: repeated || single,
      filler: filler,
      listed: !single,
      top: top ? top.name : inner ? inner.top : '',
      topCount: top ? top.count : inner ? inner.topCount : 0
    };
  }

  /** Text that is not really writing: the same word over and over, or
   *  placeholder text such as "lorem ipsum", "test" or "asdf". Checked
   *  before anything is scored, so it cannot pass as a real section. */
  var FILLER_RE = /\b(lorem|ipsum|dolor|asdf\w*|qwerty\w*|blah|test(ing)?\s+test|xxx+|placeholder|sample text)\b/i;
  function textQuality(text) {
    var ws = words(text).filter(function (w) { return w.length > 2 && STOP.indexOf(w) === -1; });
    var counts = {};
    ws.forEach(function (w) { counts[w] = (counts[w] || 0) + 1; });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var distinct = Object.keys(counts).length;
    // One word filling a third of the section, or (in a short section)
    // fewer than half the words being different, is repetition rather
    // than writing. Long sections naturally reuse words, so only the
    // first test applies to them.
    var repeated = ws.length >= 5 && (counts[top] / ws.length >= 0.34 ||
      (ws.length < 40 && distinct / ws.length < 0.45));
    var mashed = (text.match(/\b\w*([a-z])\1\1\w*\b/gi) || []).length >= 2;
    return {
      ok: !repeated && !FILLER_RE.test(text) && !mashed,
      repeated: repeated,
      filler: FILLER_RE.test(text) || mashed,
      top: top,
      topCount: top ? counts[top] : 0
    };
  }


  /** Date-range styles used in a piece of text, e.g. "Jun 2023", "06/2023". */
  function dateStyles(text) {
    var styles = {};
    var re = {
      'Month Year (short)': new RegExp('\\b(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?\\s+(19|20)\\d{2}\\b', 'gi'),
      'Month Year (full)': /\b(january|february|march|april|june|july|august|september|october|november|december)\s+(19|20)\d{2}\b/gi,
      'Month and two-digit year': new RegExp('\\b(' + MONTHS + ')\\.?\\s+\'?\\d{2}\\b(?!\\d)', 'gi'),
      'MM/YYYY': /\b(0?[1-9]|1[0-2])[\/\-.](19|20)\d{2}\b/g,
      'Year only': /(^|[^\/\d])(19|20)\d{2}\s*[\-–\u2014to]+\s*((19|20)\d{2}|present|current|now)\b/gi
    };
    // Years that follow a month belong to that month, not to "Year only".
    var bare = text.replace(new RegExp('\\b(' + MONTHS + ')\\.?\\s+(19|20)\\d{2}', 'gi'), ' M ');
    Object.keys(re).forEach(function (k) {
      var n = ((k === 'Year only' ? bare : text).match(re[k]) || []).length;
      if (n) {
        styles[k] = n;
      }
    });
    return styles;
  }

  /** Lines in a section that look like the start of a job or course:
   *  they hold a date. */
  function dateLines(text) {
    var re = new RegExp(MONTH_YEAR + '|\\b(19|20)\\d{2}\\b|\\b\\d{1,2}[\\/\\-.](19|20)\\d{2}\\b', 'i');
    return lines(text).filter(function (l) { return re.test(l); });
  }

  /** Numbers that show a result: percentages, money, counts and amounts
   *  ("20+ pages", "6 local businesses", "two new starters"). Dates,
   *  years, phone numbers and things like "Level 3" or "Windows 11" are
   *  not counted. Returns each line that has one. */
  var NUMBER_WORDS = 'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|dozen|dozens|doubled|tripled|halved';
  function measurables(text) {
    var found = [];
    var dates = new RegExp('\\b(' + MONTHS + ')\\.?\\s+(19|20)\\d{2}\\b', 'gi');
    logicalLines(text).forEach(function (l) {
      var clean = l
        .replace(dates, ' ')
        .replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g, ' ')
        .replace(/\b\d{1,2}[\/\-.](19|20)\d{2}\b/g, ' ')
        .replace(/\b(19|20)\d{2}\b/g, ' ')
        .replace(/(\+?44|\b0)\s?\d{2,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g, ' ')
        .replace(/\b(level|year|years old|grade|grades|version|windows|office|key stage|stage|nvq|iso|wcag|html|css|es|python|php|ios|android|gcse|a-level|a level|step)\s?\d+(\.\d+)?\b/gi, ' ')
        .replace(/\b\d:\d\b/g, ' ')
        .replace(/\b(aged|ages|age)\s+\d+(\s?[\-–\u2014to]+\s?\d+)?\b/gi, ' ');
      var m = clean.match(/\d+(\.\d+)?\s?%|[£$€]\s?\d[\d,.]*\s?[kKmM]?|\b\d[\d,.]*\s?(\+|k\b|x\b)?\s?[A-Za-z][A-Za-z\-]{2,}/) ||
        clean.match(new RegExp('\\b(' + NUMBER_WORDS + ')\\b\\s+[a-z]{3,}', 'i'));
      if (m) {
        found.push({ value: m[0].trim(), line: stripBullet(l) });
      }
    });
    return found;
  }

  /** The verbs that open each experience point. Role and date lines are
   *  left out, wrapped lines are joined, and every form of a verb counts
   *  as that verb ("Organising" and "Organised" are both "organised"). */
  function openingVerbs(text) {
    var dated = new RegExp('\\b(' + MONTHS + ')\\b.*\\b(19|20)\\d{2}\\b|' + MONTH_YEAR + '|\\b(19|20)\\d{2}\\b|\\b\\d{1,2}\\/(19|20)?\\d{2}\\b|\\bpresent\\b', 'i');
    var counts = {};
    var examples = {};
    var opened = 0;
    var points = [];
    var prose = 0;
    var units = [];
    logicalLines(text).forEach(function (l) {
      var parts = stripBullet(l).split(/(?:[.!?])\s+(?=[A-Z])/);
      if (parts.length > 1 && wordCount(l) >= 12) {
        prose += 1;
        parts.forEach(function (p) { units.push(p.replace(/[.!?]+$/, '')); });
      } else {
        units.push(l);
      }
    });
    units.forEach(function (l) {
      var clean = stripBullet(l).replace(/^(i|we)\s+(also\s+|then\s+|often\s+|regularly\s+|sometimes\s+|would\s+)?/i, '');
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      if (wordCount(clean) < 4 || isRoleLine(l, dated) || isListLine(l)) {
        return;
      }
      points.push(clean);
      var key = verbKey((dropLabel(clean).match(/^[A-Za-z\-]+/) || [''])[0]);
      if (key) {
        opened += 1;
        counts[key] = (counts[key] || 0) + 1;
        (examples[key] = examples[key] || []).push(clean);
      }
    });
    if (countPhrase(text, 'responsible for') >= 2) {
      counts.responsible = countPhrase(text, 'responsible for');
      examples.responsible = logicalLines(text).filter(function (l) { return /responsible for/i.test(l); }).map(stripBullet);
    }
    return { counts: counts, examples: examples, opened: opened, bullets: points.length, points: points, prose: prose };
  }

  /** Three-word phrases repeated three or more times. */
  function repeatedPhrases(text) {
    var ws = words(text);
    var seen = {};
    for (var i = 0; i + 2 < ws.length; i++) {
      var tri = ws.slice(i, i + 3);
      if (tri.filter(function (w) { return STOP.indexOf(w) !== -1; }).length > 1) {
        continue;
      }
      var key = tri.join(' ');
      seen[key] = (seen[key] || 0) + 1;
    }
    return Object.keys(seen).filter(function (k) { return seen[k] >= 3; })
      .map(function (k) { return { phrase: k, count: seen[k] }; });
  }

  /** Blocks of text with no line breaks for a long stretch. */
  function longParagraphs(text) {
    return lines(text).filter(function (l) { return wordCount(l) > 70; });
  }

  function misspellings(text) {
    var found = {};
    words(text).forEach(function (w) {
      if (MISSPELLINGS[w]) {
        found[w] = MISSPELLINGS[w];
      }
    });
    return Object.keys(found).map(function (w) { return { word: w, fix: found[w] }; });
  }


  /* ------------------------------------------------------------------------
     4. CHECKS AND SCORES
     Each check adds a finding: 'good' (a strength), 'tip' (a possible
     improvement) or 'fix' (a confirmed issue). Points are added up per
     category; nothing is random or fixed in advance.
     ------------------------------------------------------------------------ */

  function analyse(cv) {
    var all = fullText(cv);
    var head = readHeader(cv.header);
    var findings = { header: [], summary: [], experience: [], education: [], skills: [], other: [] };
    var cat = {
      completeness: { label: 'CV completeness', max: 25, points: 0, notes: [] },
      experience: { label: 'Experience and achievements', max: 25, points: 0, notes: [] },
      skills: { label: 'Skills and relevance', max: 20, points: 0, notes: [] },
      structure: { label: 'Structure and readability', max: 15, points: 0, notes: [] },
      summary: { label: 'Professional summary', max: 15, points: 0, notes: [] }
    };

    function add(section, level, id, title, detail, extra) {
      var f = { id: id, section: section, level: level, title: title, detail: detail };
      if (extra) {
        Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
      }
      findings[section].push(f);
      return f;
    }

    function give(c, pts, note) {
      cat[c].points += pts;
      cat[c].notes.push({ points: pts, note: note });
    }

    /* --- Header and completeness ---------------------------------------- */
    // A section only counts when it holds real writing: repeated words or
    // placeholder text are reported, and score as if the section were empty.
    var quality = {
      summary: textQuality(cv.summary),
      experience: textQuality(cv.experience),
      skills: skillQuality(cv.skills),
      education: textQuality(cv.education)
    };
    var hasSummary = wordCount(cv.summary) >= 5 && quality.summary.ok;
    var hasExperience = wordCount(cv.experience) >= 5 && quality.experience.ok;
    var hasEducation = wordCount(cv.education) >= 2 && quality.education.ok;
    var hasSkills = skillList(cv.skills).length >= 1 && quality.skills.ok;
    ['summary', 'experience', 'skills', 'education'].forEach(function (k) {
      var q = quality[k];
      if (!q.ok && cv[k].trim()) {
        add(k, 'fix', k + '-junk', q.repeated ? 'Repeated text' : 'Placeholder text',
          q.repeated ? (q.listed ? '"' + q.top + '" is listed ' + q.topCount + ' times, so this does not read as a real list yet.' :
            'The word "' + q.top + '" is used ' + q.topCount + ' times, so this section does not read as real content yet.') :
            'This section looks like placeholder or test text, so it cannot be scored yet.', {
            why: 'Employers read every line. This section only counts once it describes you in your own words.',
            steps: ['Replace this text with real content, then re-score.']
          });
      }
    });

    if (head.name) {
      give('completeness', 2, 'Name at the top');
      add('header', 'good', 'name', 'Name is clear', 'Your name is at the top, where employers look first.');
    } else {
      add('header', 'fix', 'name', 'Name not found', 'We could not find your name at the top of the CV.', {
        why: 'Your name should be the first thing an employer reads, so they remember whose CV it is.',
        steps: ['Put your full name on the first line of your CV.']
      });
    }
    if (head.email) {
      give('completeness', 4, 'Email address');
      add('header', 'good', 'email', 'Email address included', 'Employers can reply to you at ' + head.email + '.');
    } else {
      add('header', 'fix', 'email', 'No email address', 'We could not find an email address.', {
        why: 'Most employers reply by email. Without one they may not be able to reach you.',
        steps: ['Add an email address you check often, near your name.']
      });
    }
    if (head.phone) {
      give('completeness', 3, 'Phone number');
      add('header', 'good', 'phone', 'Phone number included', 'Employers can call you for an interview.');
    } else {
      add('header', 'fix', 'phone', 'No phone number', 'We could not find a phone number.', {
        why: 'Employers often phone to arrange interviews.',
        steps: ['Add a mobile number near your name and email address.']
      });
    }
    if (!head.location) {
      add('header', 'tip', 'location', 'Add your town or city', 'We could not find where you are based.', {
        why: 'Local employers like to see that you can get to work easily. You do not need your full address.',
        steps: ['Add your town and county, for example "Skelmersdale, Lancashire".']
      });
    } else {
      add('header', 'good', 'location', 'Location included', 'You have said where you are based (' + head.location + ').');
    }
    // Contact details hidden away further down the CV.
    var rest = [cv.summary, cv.experience, cv.education, cv.skills].join('\n') +
      cv.other.map(function (o) { return '\n' + o.text; }).join('');
    if ((!head.email && EMAIL_RE.test(rest)) || (!head.phone && PHONE_RE.test(rest))) {
      add('header', 'fix', 'contact-place', 'Contact details in an unusual place',
        'Your contact details appear further down the CV instead of at the top.', {
          why: 'Employers expect to find your contact details straight away, under your name.',
          steps: ['Move your email address and phone number to the top, under your name.']
        });
    }

    if (hasSummary) { give('completeness', 4, 'Professional summary'); }
    if (hasExperience) { give('completeness', 5, 'Work or relevant experience'); }
    if (hasEducation) { give('completeness', 4, 'Education'); }
    if (hasSkills) { give('completeness', 3, 'Skills'); }

    /* --- Summary ----------------------------------------------------------- */
    var sumWords = wordCount(cv.summary);
    if (!hasSummary) {
      add('summary', 'fix', 'summary-missing', 'No professional summary', 'We could not find a summary or profile.', {
        why: 'A short summary at the top tells employers who you are and what you are looking for in a few seconds.',
        steps: ['Add a "Profile" section of 3 to 4 sentences under your contact details.',
          'Say what you are good at, what you have done, and the kind of role you want.']
      });
    } else {
      give('summary', 5, 'Summary present');
      if (sumWords < 25) {
        give('summary', 2, 'Summary is short');
        add('summary', 'tip', 'summary-short', 'Summary is quite short',
          'Your summary is ' + sumWords + ' words. Around 40 to 100 words gives employers enough to go on.', {
            why: 'A very short summary can feel unfinished and misses the chance to sell your strengths.',
            steps: ['Add one sentence about your experience and one about the role you want.']
          });
      } else if (sumWords > 150) {
        give('summary', 2, 'Summary is long');
        add('summary', 'tip', 'summary-long', 'Summary is long',
          'Your summary is ' + sumWords + ' words. Employers often skim, so 40 to 100 words works best.', {
            why: 'A long summary pushes your experience further down the page.',
            steps: ['Keep the 3 or 4 most important points and move the rest into your experience.']
          });
      } else {
        give('summary', 5, 'Summary is a good length');
        add('summary', 'good', 'summary-length', 'Good length', 'Your summary is ' + sumWords + ' words: long enough to be useful, short enough to skim.');
      }
      var generic = GENERIC_PHRASES.filter(function (p) { return countPhrase(cv.summary, p); });
      if (generic.length >= 2) {
        add('summary', 'tip', 'summary-generic', 'Quite general wording',
          'Phrases such as ' + generic.slice(0, 3).map(function (g) { return '"' + g + '"'; }).join(', ') +
          ' appear on many CVs.', {
            why: 'Employers read these phrases on lots of CVs. An example of what you did is more convincing.',
            steps: ['Swap one general phrase for a real example, such as a project you finished or a result you achieved.'],
            phrases: generic
          });
      } else {
        give('summary', 3, 'Specific wording');
        if (generic.length === 0) {
          add('summary', 'good', 'summary-specific', 'Specific wording', 'Your summary avoids over-used phrases.');
        }
      }
      if (GOAL_WORDS.some(function (g) { return countPhrase(cv.summary, g); })) {
        give('summary', 2, 'Says what you are looking for');
        add('summary', 'good', 'summary-goal', 'Clear goal', 'You say what you are looking for, so employers can see the fit.');
      } else {
        add('summary', 'tip', 'summary-goal', 'Say what you are looking for',
          'Your summary does not mention the kind of role or opportunity you want.', {
            why: 'Saying what you want helps employers see quickly whether you are a good fit.',
            steps: ['End your summary with a sentence such as "I am looking for an entry-level role in ...".']
          });
      }
    }

    /* --- Experience ---------------------------------------------------------- */
    var expDates = dateLines(cv.experience);
    var verbs = openingVerbs(cv.experience);
    var results = measurables(cv.experience);
    var overused = Object.keys(verbs.counts)
      .filter(function (v) { return verbs.counts[v] >= 3; })
      .map(function (v) { return { verb: v, count: verbs.counts[v], lines: verbs.examples[v] || [] }; })
      .sort(function (a, b) { return b.count - a.count; });
    var vague = VAGUE_PHRASES.filter(function (p) { return countPhrase(cv.experience, p); });

    if (!hasExperience) {
      add('experience', 'fix', 'exp-missing', 'No experience section', 'We could not find any work or relevant experience.', {
        why: 'Employers look for evidence of what you have done. Volunteering, placements, school projects and part-time work all count.',
        steps: ['Add an "Experience" section with any jobs, placements, volunteering or projects.',
          'For each one, give the role, where, when, and two or three things you did.']
      });
    } else {
      if (expDates.length) {
        give('experience', 4, 'Dates for each role');
        add('experience', 'good', 'exp-dates', 'Dates included', 'We found ' + expDates.length + ' dated ' + (expDates.length === 1 ? 'entry' : 'entries') + ' in your experience.');
      } else {
        add('experience', 'fix', 'exp-dates', 'No dates', 'We could not find dates for your roles.', {
          why: 'Dates show employers how recent and how long your experience is.',
          steps: ['Add start and end dates to each role, for example "Jun 2023 - Aug 2025".']
        });
      }

      var verbShare = verbs.bullets ? verbs.opened / verbs.bullets : 0;
      give('experience', Math.round(clamp(verbShare / 0.6, 0, 1) * 7), 'Lines that start with an action verb');
      if (verbShare >= 0.5) {
        add('experience', 'good', 'exp-verbs', 'Strong action verbs', verbs.opened + ' of your ' + verbs.bullets + ' points start with a clear action verb.');
      } else {
        add('experience', 'tip', 'exp-verbs', 'Use more action verbs',
          (verbs.bullets === 1 ? 'Your point does not start' : verbs.opened ?
            'Only ' + verbs.opened + ' of your ' + verbs.bullets + ' points start' : 'None of your ' + verbs.bullets + ' points start') +
          ' with an action verb such as "Organised" or "Delivered".', {
            why: 'Starting with a verb makes it clear what you did, not just what the job was.',
            steps: ['Start each point with a verb: Organised, Delivered, Supported, Created, Improved.'],
            options: ['Organised', 'Delivered', 'Supported', 'Created', 'Improved', 'Coordinated'],
            examples: verbs.points.filter(function (p) { return !verbKey((dropLabel(p).match(/^[A-Za-z\-]+/) || [''])[0]); }).slice(0, 4)
          });
      }

      var rPts = results.length >= 3 ? 7 : results.length === 2 ? 5 : results.length === 1 ? 3 : 0;
      give('experience', rPts, 'Measurable results');
      if (results.length >= 2) {
        add('experience', 'good', 'exp-results', 'Measurable results', 'You back up ' + results.length + ' of your points with numbers.', {
          examples: results.slice(0, 4).map(function (r) { return r.line; })
        });
      } else {
        add('experience', results.length ? 'tip' : 'fix', 'exp-results', results.length ? 'Add more numbers' : 'No measurable results',
          results.length ? 'We found one point with a number ("' + results[0].value + '"). A couple more would make your impact clearer.' :
            'We could not find any numbers that show the result of your work.', {
            why: 'Numbers make achievements concrete: "served 40 customers a day" says more than "served customers".',
            steps: ['Add a number to two or three of your points: how many, how often, how much, or by what percentage.'],
            examples: results.map(function (r) { return r.line; })
          });
      }

      // Written as a paragraph rather than points: still read sentence by
      // sentence above, but points are quicker for an employer to scan.
      var bulletedExp = lines(cv.experience).some(function (l) { return stripBullet(l) !== l; });
      if (verbs.prose && !bulletedExp) {
        add('experience', 'tip', 'exp-bullets', 'Use bullet points', 'Your experience is written as sentences in a paragraph.', {
          why: 'Employers skim a CV in seconds. Short points are easier to scan than a paragraph.',
          steps: ['Put each task or achievement on its own line, starting with a verb: "Served up to 60 tables a shift".']
        });
      }

      var expLines = verbs.points;
      var avg = expLines.length ? expLines.reduce(function (n, l) { return n + wordCount(l); }, 0) / expLines.length : 0;
      if (expLines.length < 3 || avg < 6) {
        give('experience', 1, 'Some detail');
        add('experience', 'tip', 'exp-detail', 'Add more detail',
          expLines.length < 3 ?
            'Your experience has ' + expLines.length + ' descriptive ' + (expLines.length === 1 ? 'line' : 'lines') + '. Two or three points per role works well.' :
            'Your points average ' + Math.round(avg) + ' words. A little more detail (around 10 to 20 words each) shows what you achieved.', {
            why: 'A little more detail helps employers picture what you did day to day.',
            steps: ['Under each role, add two or three points about your main tasks and what came of them.']
          });
      } else {
        give('experience', 4, 'Detailed descriptions');
      }

      if (overused.length) {
        give('experience', 0, 'Repeated verbs');
        var top = overused[0];
        add('experience', 'fix', 'exp-repeat', 'Repeated words',
          top.count + ' of your points start with "' + cap(top.verb) + '"' +
          (overused.length > 1 ? ' (and ' + overused.slice(1).map(function (o) { return o.count + ' with "' + cap(o.verb) + '"'; }).join(', ') + ')' : '') + '.', {
            why: 'Using the same action verb again and again can make your experience sound repetitive. Varying your language helps each achievement stand out.',
            steps: ['Replace some uses of "' + cap(top.verb) + '" with a different verb.'],
            options: (VERB_ALTERNATIVES[top.verb] || ['Delivered', 'Created', 'Organised', 'Led', 'Improved', 'Supported'])
              .filter(function (o) { return o.toLowerCase() !== top.verb; }),
            overused: overused,
            examples: top.lines.slice(0, 5)
          });
      } else {
        give('experience', 3, 'Varied verbs');
        if (verbs.bullets >= 3) {
          add('experience', 'good', 'exp-repeat', 'Varied wording', 'You do not lean on any one verb too often.');
        }
      }

      if (vague.length) {
        add('experience', 'tip', 'exp-vague', 'Vague wording',
          'Phrases such as ' + vague.slice(0, 3).map(function (v) { return '"' + v + '"'; }).join(', ') + ' hide what you actually did.', {
            why: '"Responsible for the till" tells an employer less than "Handled cash and card payments for up to 200 customers a day".',
            steps: ['Rewrite these lines to say what you did, starting with a verb.'],
            phrases: vague
          });
      }
    }

    /* --- Education ---------------------------------------------------------- */
    var edLow = cv.education.toLowerCase();
    var quals = QUALIFICATION_WORDS.filter(function (q) { return edLow.indexOf(q) !== -1; });
    var edScore = 0;
    if (!hasEducation) {
      add('education', 'fix', 'edu-missing', 'No education section', 'We could not find your education or qualifications.', {
        why: 'Many roles ask for certain qualifications, and employers check this section.',
        steps: ['Add an "Education" section with your school, college or university, your qualifications and dates.']
      });
    } else {
      edScore += 4;
      if (quals.length) {
        edScore += 3;
        add('education', 'good', 'edu-quals', 'Qualifications listed', 'We can see your qualifications or where you studied.');
      } else {
        add('education', 'tip', 'edu-quals', 'Name your qualifications', 'We could not see the name of a qualification, such as GCSEs, A levels, a BTEC or a degree.', {
          why: 'Employers look for named qualifications and grades.',
          steps: ['List each qualification with the subject and grade where you have it.']
        });
      }
      if (dateLines(cv.education).length) {
        edScore += 3;
        add('education', 'good', 'edu-dates', 'Dates included', 'Your education has dates, so employers can see the timeline.');
      } else {
        add('education', 'tip', 'edu-dates', 'Add dates', 'We could not find dates for your education.', {
          why: 'Dates help employers follow your timeline.',
          steps: ['Add the years you studied, for example "2020 - 2024".']
        });
      }
    }

    /* --- Skills ------------------------------------------------------------- */
    var allSkills = skillList(cv.skills);
    var dupes = duplicateSkills(allSkills);
    var seenSkill = {};
    var skills = allSkills.filter(function (s) {
      var k = s.toLowerCase().replace(/[^a-z0-9+#]/g, '');
      if (seenSkill[k]) {
        return false;
      }
      seenSkill[k] = true;
      return true;
    });
    var wordy = skills.filter(function (s) { return wordCount(s) > 6; });
    var groups = lines(cv.skills).filter(function (l) { return /^[^:]{2,45}:\s*\S/.test(stripBullet(l)); }).length;
    var softOnly = skills.length && skills.every(function (s) {
      var low = s.toLowerCase();
      return SOFT_SKILLS.some(function (k) { return low.indexOf(k) !== -1; });
    });
    var evidenceText = (cv.experience + '\n' + cv.summary).toLowerCase();
    var used = skills.filter(function (s) {
      return skillEvidenced(s, evidenceText);
    });
    if (!hasSkills && !quality.skills.ok && cv.skills.trim()) {
      // Reported above as repeated or placeholder text.
    } else if (!hasSkills) {
      add('skills', 'fix', 'skills-missing', 'No skills section', 'We could not find a list of your skills.', {
        why: 'A skills list lets employers match you to a role at a glance.',
        steps: ['Add a "Skills" section with 6 to 12 skills, mixing practical skills (such as software or tools) and people skills.']
      });
    } else {
      give('skills', 4, 'Skills listed');
      if (dupes.length) {
        give('skills', -2, 'Skills listed more than once');
        add('skills', 'fix', 'skills-dupes', 'Repeated skills',
          dupes.slice(0, 3).map(function (d) { return '"' + d.name + '" is listed ' + d.count + ' times'; }).join(', ') + '.', {
            why: 'Listing a skill twice takes space without telling an employer anything new.',
            steps: ['Keep each skill once, and use the space for another skill you have.']
          });
      }
      if (wordy.length) {
        add('skills', 'tip', 'skills-wordy', 'Keep each skill short', wordy.length + ' of your skills read more like sentences.', {
          why: 'A skills list works best as short items employers can scan, with the detail in your experience.',
          steps: ['Cut each skill to a few words, such as "Customer service" or "Excel".'],
          examples: wordy.slice(0, 3)
        });
      }
      if (skills.length < 4) {
        give('skills', 2, 'A few skills');
        add('skills', 'tip', 'skills-few', 'Only a few skills', 'You list ' + skills.length + ' skill' + (skills.length === 1 ? '' : 's') + '. Most CVs list 6 to 12.', {
          why: 'A fuller list gives employers more chances to see a match with their role.',
          steps: ['Add more skills you have used at work, school, volunteering or in your own time.']
        });
      } else if (groups >= 3 && skills.length <= 50) {
        give('skills', 6, 'Skills grouped into categories');
        add('skills', 'good', 'skills-count', 'Well organised', 'You list ' + skills.length + ' skills, grouped under ' + groups + ' headings, so employers can find what they need.', {
          examples: lines(cv.skills).filter(function (l) { return /^[^:]{2,45}:/.test(stripBullet(l)); })
            .map(function (l) { return stripBullet(l).split(':')[0]; }).slice(0, 7)
        });
      } else if (skills.length > 25) {
        give('skills', 3, 'Many skills');
        add('skills', 'tip', 'skills-many', 'A very long list', 'You list ' + skills.length + ' skills. A focused list of around 12 is easier to read.', {
          why: 'Too many skills can hide the ones that matter most for the role.',
          steps: ['Keep the skills most relevant to the jobs you are applying for.']
        });
      } else {
        give('skills', 6, 'A good number of skills');
        add('skills', 'good', 'skills-count', 'A good range', 'You list ' + skills.length + ' different skills, which is easy to scan.', {
          examples: [skills.slice(0, 8).join(', ') + (skills.length > 8 ? ' and ' + (skills.length - 8) + ' more' : '')]
        });
      }
      if (softOnly) {
        give('skills', 2, 'Mostly people skills');
        add('skills', 'fix', 'skills-relevant', 'Include relevant skills', 'Your skills are mostly people skills, such as communication and teamwork.', {
          why: 'People skills matter, but employers also look for practical skills that match the role.',
          steps: ['Add skills that match the role and show what you offer, such as software, tools, languages or a driving licence.']
        });
      } else {
        var softCount = skills.filter(function (s) {
          var low = s.toLowerCase();
          return SOFT_SKILLS.some(function (k) { return low.indexOf(k) !== -1; });
        }).length;
        if (softCount === 0 && skills.length >= 6) {
          give('skills', 4, 'Practical skills');
          add('skills', 'tip', 'skills-mix', 'Add a people skill or two', 'Your skills are all practical (tools and techniques).', {
            why: 'Employers also look for how you work with others, such as communication or teamwork.',
            steps: ['Add one or two people skills you can back up, such as "Stakeholder communication".']
          });
        } else {
          give('skills', 5, 'A mix of practical and people skills');
          add('skills', 'good', 'skills-mix', 'A good mix', 'You include practical skills as well as people skills.');
        }
      }
      if (used.length >= 2) {
        give('skills', 5, 'Skills backed up in your experience');
        add('skills', 'good', 'skills-evidence', 'Backed up with examples', used.length + ' of your skills, such as ' + used.slice(0, 2).map(function (u) { return '"' + u + '"'; }).join(' and ') + ', also appear in your experience or summary.');
      } else {
        give('skills', used.length ? 2 : 0, 'Skills backed up in your experience');
        add('skills', 'tip', 'skills-evidence', 'Show your skills in action', 'Few of your listed skills appear in your experience or summary.', {
          why: 'Employers trust skills more when they can see where you used them.',
          steps: ['Mention two or three of your skills in your experience points, for example "Used Excel to track weekly stock".']
        });
      }
    }

    /* --- Headings ------------------------------------------------------------ */
    var NAMES = { skills: ['skills', 'Skills'], experience: ['experience', 'Work Experience'],
      education: ['education', 'Education'], summary: ['summary', 'Profile'] };
    (cv.inferred || []).forEach(function (k) {
      if (!cv[k].trim()) {
        return;
      }
      add(k, 'tip', k + '-heading', 'Give this section a clear heading',
        'We found what looks like your ' + NAMES[k][0] + ' without a heading we recognise, so we have read it as ' + NAMES[k][0] + '.', {
          why: 'Employers, and the software many of them use to sort CVs, look for standard headings such as "' + NAMES[k][1] + '".',
          steps: ['Add a short heading such as "' + NAMES[k][1] + '" above this part of your CV.'],
          examples: lines(cv[k]).slice(0, 1)
        });
    });

    /* --- Structure and readability (Other Sections page) ------------------- */
    // Dates are compared within the experience, where they sit side by
    // side; years on their own for a qualification are normal.
    var styles = dateStyles(cv.experience);
    var styleNames = Object.keys(styles);
    if (styleNames.length > 1) {
      add('other', 'tip', 'dates-mixed', 'Mixed date formats', 'Your experience uses ' + styleNames.length + ' date styles: ' + styleNames.join(', ') + '.', {
        why: 'One date style throughout looks tidier and is easier to follow.',
        steps: ['Pick one style, such as "Jun 2023 - Aug 2025", and use it everywhere.']
      });
    } else {
      give('structure', 4, 'Consistent dates');
      if (styleNames.length) {
        add('other', 'good', 'dates', 'Consistent dates', 'Your dates use one style throughout.');
      }
    }
    var longs = longParagraphs(all);
    if (longs.length) {
      add('other', 'tip', 'long-paras', 'Long paragraphs', 'We found ' + longs.length + ' paragraph' + (longs.length === 1 ? '' : 's') + ' of over 70 words.', {
        why: 'Employers skim CVs. Short points are quicker to read than long paragraphs.',
        steps: ['Break long paragraphs into bullet points of one or two lines each.']
      });
    } else {
      give('structure', 3, 'No very long paragraphs');
    }
    var total = wordCount(all);
    if (total < 150) {
      give('structure', 1, 'Length');
      add('other', 'tip', 'length-short', 'Quite short', 'Your CV is about ' + total + ' words. Most one-page CVs are 300 to 600 words.', {
        why: 'A very short CV may not give employers enough to go on.',
        steps: ['Add more detail to your experience and a short summary.']
      });
    } else if (total > 900) {
      give('structure', 1, 'Length');
      add('other', 'tip', 'length-long', 'Quite long', 'Your CV is about ' + total + ' words, which is likely more than two pages.', {
        why: 'Employers spend seconds on a first read. Two pages is usually the most you need.',
        steps: ['Cut older or less relevant points, and keep each point to one or two lines.']
      });
    } else {
      give('structure', 3, 'A good length');
      add('other', 'good', 'length', 'A good length', 'Your CV is about ' + total + ' words, a comfortable length to read.');
    }
    // The header and education are left out: a course title is rightly
    // repeated in the title, summary and education.
    var reps = repeatedPhrases([cv.summary, cv.experience].concat(cv.other.map(function (o) { return o.text; })).join('\n'));
    if (reps.length) {
      add('other', 'tip', 'repeat-phrases', 'Repeated phrases', 'The phrase "' + reps[0].phrase + '" appears ' + reps[0].count + ' times.', {
        why: 'Repeating the same phrase can make a CV feel padded.',
        steps: ['Reword some of these lines so each one adds something new.']
      });
    } else {
      give('structure', 3, 'No repeated phrases');
    }
    var spell = misspellings(all);
    if (spell.length) {
      add('other', 'fix', 'spelling', 'Possible spelling mistakes',
        spell.slice(0, 4).map(function (s) { return '"' + s.word + '" (did you mean "' + s.fix + '"?)'; }).join(', '), {
          why: 'Spelling mistakes are one of the most common reasons CVs are put aside.',
          steps: ['Correct these words, then read your CV aloud to catch any others. (We check a list of common mistakes only.)']
        });
    } else {
      give('structure', 2, 'No common spelling mistakes');
    }
    if (cv.other.length) {
      add('other', 'good', 'extras', 'Extra sections', 'You include ' + cv.other.map(function (o) { return o.title; }).join(', ') + '.');
    }
    if (countPhrase(all, 'references available on request') || countPhrase(all, 'references on request')) {
      add('other', 'tip', 'references', '"References on request" is not needed', 'Employers assume you will provide references if asked.', {
        why: 'This line takes up space that could show something about you.',
        steps: ['Remove the line, or replace it with something useful such as an interest or achievement.']
      });
    }

    // Readability can only be judged when there is something to read.
    if (total < 50) {
      cat.structure.points = 0;
      cat.structure.notes = [{ points: 0, note: 'Not enough text to judge' }];
      findings.other = findings.other.filter(function (f) { return f.level !== 'good'; });
    }

    /* --- Totals --------------------------------------------------------------- */
    Object.keys(cat).forEach(function (k) {
      cat[k].points = clamp(Math.round(cat[k].points), 0, cat[k].max);
    });
    var score = Object.keys(cat).reduce(function (n, k) { return n + cat[k].points; }, 0);

    // Section scores out of 10, for the menu and each page.
    function tenth(n, d) { return Math.round(clamp(n / d, 0, 1) * 10); }
    var headerPts = (head.name ? 2 : 0) + (head.email ? 4 : 0) + (head.phone ? 3 : 0) + (head.location ? 1 : 0);
    var sectionScores = {
      header: headerPts,
      summary: tenth(cat.summary.points, cat.summary.max),
      experience: tenth(cat.experience.points, cat.experience.max),
      education: edScore,
      skills: tenth(cat.skills.points, cat.skills.max),
      other: tenth(cat.structure.points, cat.structure.max)
    };

    var counts = { good: 0, tip: 0, fix: 0 };
    Object.keys(findings).forEach(function (k) {
      findings[k].forEach(function (f) { counts[f.level] += 1; });
    });

    return {
      score: score,
      categories: cat,
      sections: sectionScores,
      findings: findings,
      counts: counts,
      header: head,
      skills: skills,
      words: total
    };
  }

  var api = {
    readSections: readSections,
    readHeader: readHeader,
    analyse: analyse,
    skillList: skillList,
    headingKind: headingKind,
    logicalLines: logicalLines,
    fullText: fullText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MTWCV = api;
  }
}(this));

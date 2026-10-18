/* ==========================================================================
   MOVEMENT TO WORK: QUESTIONNAIRE CONTENT
   The seven questionnaires behind "Discover your strengths". Content only:
   the profile rules are in questionnaire-profile.js and the interface in
   questionnaire.js, so questions can be edited here on their own.

   Question types
     single   choose one card
     multi    choose up to `max` cards
     scale    a five-point rating (labels in `scale`)
     text     an optional short written answer
   `optional: true` questions can be skipped. A questionnaire is complete
   when every question that is not optional has an answer.
   ========================================================================== */

(function (root) {
  'use strict';

  var CONFIDENCE = ['Not confident yet', 'Slightly confident', 'Somewhat confident', 'Confident', 'Very confident'];
  var COMFORT = ['Not comfortable yet', 'Slightly comfortable', 'Somewhat comfortable', 'Comfortable', 'Very comfortable'];
  var OFTEN = ['Rarely', 'Now and then', 'Sometimes', 'Often', 'Very often'];
  var USEFUL = ['Not useful', 'A little useful', 'Quite useful', 'Useful', 'Very useful'];
  var ENOUGH = ['Not at all', 'A little', 'Some', 'Quite a lot', 'Plenty'];
  var KEEN = ['Not really', 'A little', 'Somewhat', 'Yes', 'Very much'];

  function o(v, label, desc) {
    return { v: v, label: label, desc: desc || '' };
  }

  var GOALS = [
    o('firstjob', 'Find my first job'), o('cv', 'Improve my CV'), o('interview', 'Build interview confidence'),
    o('experience', 'Gain practical experience'), o('strengths', 'Discover my strengths'),
    o('careers', 'Explore different career paths'), o('apprenticeship', 'Find an apprenticeship'),
    o('skills', 'Develop workplace skills'), o('other', 'Something else')
  ];

  var SKILLS = [
    o('communication', 'Communication', 'Sharing ideas and expressing yourself clearly'),
    o('teamwork', 'Teamwork', 'Working well with and supporting others'),
    o('problem', 'Problem-solving', 'Finding solutions when things don’t go to plan'),
    o('organisation', 'Organisation', 'Managing tasks and staying on top of deadlines'),
    o('creativity', 'Creativity', 'Coming up with new ideas and different approaches'),
    o('listening', 'Listening', 'Understanding others and taking feedback on board'),
    o('adaptability', 'Adaptability', 'Staying flexible when situations change'),
    o('initiative', 'Taking initiative', 'Being proactive and getting things done'),
    o('time', 'Time management', 'Being on time and using your time well'),
    o('digital', 'Digital skills', 'Using computers, apps and online tools'),
    o('detail', 'Attention to detail', 'Spotting mistakes and getting things right'),
    o('reliability', 'Reliability', 'Doing what you say you will do'),
    o('leadership', 'Leadership', 'Guiding and motivating a group'),
    o('learning', 'Learning new skills', 'Picking things up and keeping on learning')
  ];

  var CHALLENGES = [
    o('experience', 'Lack of work experience'), o('interview', 'Interview confidence'), o('cv', 'CV writing'),
    o('finding', 'Finding suitable opportunities'), o('direction', 'Not knowing which career to choose'),
    o('qualifications', 'Lack of qualifications'), o('digital', 'Digital skills'),
    o('travel', 'Transport or travel'), o('equipment', 'Limited access to equipment'),
    o('communication', 'Communication confidence'), o('expectations', 'Not sure what employers expect')
  ];

  var AREAS = [
    o('tech', 'Technology and IT'), o('business', 'Business and administration'), o('creative', 'Creative and digital'),
    o('engineering', 'Engineering and manufacturing'), o('construction', 'Construction and trades'),
    o('care', 'Health and social care'), o('retail', 'Retail and customer service'), o('hospitality', 'Hospitality'),
    o('education', 'Education and community'), o('logistics', 'Logistics and transport'),
    o('outdoor', 'Environmental and outdoor work'), o('exploring', 'Still exploring')
  ];

  var PRIORITIES = [
    o('progression', 'Career progression'), o('learning', 'Learning and development'),
    o('colleagues', 'Supportive colleagues'), o('hours', 'Stable working hours'), o('practical', 'Practical experience'),
    o('balance', 'Work-life balance'), o('helping', 'Helping others'), o('creative', 'Creative freedom'),
    o('security', 'Job security'), o('local', 'Local opportunities')
  ];

  var STAGES = [
    { key: 'goals', name: 'Your goals', icon: 'i-target',
      intro: 'What you want to achieve, and what keeps you going.',
      questions: [
        { id: 'g1', type: 'single', text: 'What would you most like to achieve in the next six months?', help: 'Choose the one that matters most right now.', options: GOALS },
        { id: 'g2', type: 'multi', max: 3, optional: true, text: 'Which other goals matter to you?', help: 'Select up to 3, or skip.', options: GOALS.filter(function (g) { return g.v !== 'other'; }) },
        { id: 'g3', type: 'single', text: 'Which area would you most like to improve?', options: [
          o('communication', 'Communication'), o('confidence', 'Confidence'), o('organisation', 'Organisation and time management'),
          o('digital', 'Digital skills'), o('interview', 'Interview skills'), o('cv', 'My CV and applications'),
          o('teamwork', 'Working with others'), o('problem', 'Problem-solving')] },
        { id: 'g4', type: 'multi', max: 2, text: 'What motivates you to work towards employment?', help: 'Select up to 2.', options: [
          o('independence', 'Earning my own money'), o('progress', 'Building a career'), o('learning', 'Learning new things'),
          o('helping', 'Helping other people'), o('routine', 'Having a routine'), o('people', 'Meeting new people'),
          o('proving', 'Proving to myself I can do it'), o('family', 'Supporting my family')] },
        { id: 'g5', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel about your next step?' },
        { id: 'g6', type: 'single', text: 'Do you have a particular career or job in mind?', options: [
          o('clear', 'Yes, I know what I want'), o('ideas', 'I have a few ideas'), o('unsure', 'Not yet, I’m still exploring')] },
        { id: 'g7', type: 'single', text: 'What is currently your biggest priority?', options: [
          o('income', 'Earning money soon'), o('longterm', 'Finding the right long-term path'),
          o('skills', 'Building skills and experience'), o('qualification', 'Getting a qualification'), o('confidence', 'Feeling more confident')] },
        { id: 'g8', type: 'text', optional: true, text: 'What is one small action you could take this week?', help: 'Optional. For example: "Update my CV" or "Practise one interview question".', placeholder: 'One small thing I could do this week is…' }
      ] },

    { key: 'strengths', name: 'Your strengths', icon: 'i-muscle',
      intro: 'The skills you already have, wherever you picked them up.',
      questions: [
        { id: 's1', type: 'multi', max: 3, text: 'Which skills do you feel are your strongest?', help: 'Select up to 3.', options: SKILLS },
        { id: 's2', type: 'single', optional: true, text: 'Which skill do other people often compliment you on?', help: 'Optional.', options: SKILLS.concat([o('notsure', 'I’m not sure')]) },
        { id: 's3', type: 'single', text: 'When working with others, what role do you naturally take?', options: [
          o('lead', 'I take the lead'), o('organiser', 'I keep things organised'), o('ideas', 'I come up with ideas'),
          o('support', 'I support and encourage others'), o('doer', 'I get the practical jobs done'), o('listener', 'I listen and help everyone agree')] },
        { id: 's4', type: 'single', text: 'Which everyday activity do you feel most capable doing?', options: [
          o('fixing', 'Fixing or making things'), o('planning', 'Planning and organising'), o('helping', 'Looking after or helping people'),
          o('tech', 'Using technology'), o('creating', 'Creating or designing'), o('explaining', 'Explaining things to others')] },
        { id: 's5', type: 'scale', scale: COMFORT, text: 'How comfortable are you communicating your ideas?' },
        { id: 's6', type: 'scale', scale: OFTEN, text: 'How often do you help others solve problems?' },
        { id: 's7', type: 'single', text: 'What skill would you most like to improve?', options: SKILLS },
        { id: 's8', type: 'text', optional: true, text: 'Can you describe an example of a strength you’ve used?', help: 'Optional. School, college, volunteering, hobbies and home life all count.', placeholder: 'For example: I organised…' }
      ] },

    { key: 'barriers', name: 'What’s holding you back', icon: 'i-walk',
      intro: 'Anything making things harder right now. There are no wrong answers, and you can skip anything.',
      questions: [
        { id: 'b1', type: 'multi', max: 3, text: 'What is currently making employment feel difficult?', help: 'Select up to 3.', options: CHALLENGES.concat([o('other', 'Something else'), o('prefer', 'Prefer not to say')]) },
        { id: 'b2', type: 'single', text: 'Which part of looking for work feels most challenging?', options: [
          o('finding', 'Knowing where to look'), o('cv', 'Writing applications and CVs'), o('interview', 'Interviews'),
          o('expectations', 'Knowing what employers want'), o('motivation', 'Staying motivated'), o('direction', 'Choosing a path')] },
        { id: 'b3', type: 'scale', scale: COMFORT, text: 'How comfortable do you feel applying for jobs?' },
        { id: 'b4', type: 'single', optional: true, text: 'What worries you most about interviews?', help: 'Optional.', options: [
          o('questions', 'Not knowing what they’ll ask'), o('examples', 'Not having examples to talk about'), o('nerves', 'Feeling nervous'),
          o('talking', 'Talking about myself'), o('practical', 'Knowing what to wear or bring'), o('none', 'Nothing in particular')] },
        { id: 'b5', type: 'scale', scale: ENOUGH, text: 'Do you feel you have enough information about your career options?' },
        { id: 'b6', type: 'multi', max: 4, optional: true, text: 'Are there practical barriers affecting your opportunities?', help: 'Optional. Select any that apply.', options: [
          o('travel', 'Transport or travel'), o('equipment', 'Access to a computer or the internet'), o('caring', 'Caring responsibilities'),
          o('hours', 'Limited hours I can work'), o('none', 'None of these'), o('prefer', 'Prefer not to say')] },
        { id: 'b7', type: 'multi', max: 2, text: 'What type of support would make the biggest difference?', help: 'Select up to 2.', options: [
          o('practice', 'Interview practice'), o('cvhelp', 'Help with my CV'), o('experience', 'Work experience or placements'),
          o('coach', 'Talking to a Work Coach'), o('training', 'Training or qualifications'), o('info', 'Information about careers'),
          o('confidence', 'Building my confidence')] },
        { id: 'b8', type: 'single', text: 'What is one challenge you would like to work on first?', options: CHALLENGES }
      ] },

    { key: 'learning', name: 'Your learning style', icon: 'i-cap',
      intro: 'How you like to learn. Everyone learns in lots of ways: this is about what you enjoy, not a fixed type.',
      questions: [
        { id: 'l1', type: 'single', text: 'How do you prefer to approach something new?', options: [
          o('watch', 'Watch someone do it first'), o('read', 'Read about it'), o('try', 'Have a go straight away'), o('ask', 'Ask questions')] },
        { id: 'l2', type: 'multi', max: 2, text: 'What helps you understand instructions?', help: 'Select up to 2.', options: [
          o('read', 'Written steps'), o('watch', 'Being shown'), o('listen', 'Having it explained'), o('try', 'Trying it with help'), o('visual', 'Diagrams or videos')] },
        { id: 'l3', type: 'single', text: 'When learning a practical skill, what do you usually do first?', options: [
          o('watch', 'Watch a demonstration'), o('read', 'Read the instructions'), o('try', 'Try it and learn as I go'), o('ask', 'Ask someone to explain')] },
        { id: 'l4', type: 'single', text: 'Do you prefer learning independently or with others?', options: [
          o('independent', 'On my own'), o('others', 'With other people'), o('mix', 'A mix of both')] },
        { id: 'l5', type: 'scale', scale: USEFUL, text: 'How useful do you find demonstrations?' },
        { id: 'l6', type: 'single', text: 'How do you respond when something is difficult to understand?', options: [
          o('ask', 'Ask for help'), o('research', 'Look it up'), o('practise', 'Keep practising'), o('steps', 'Break it into smaller steps'), o('pause', 'Take a break and come back')] },
        { id: 'l7', type: 'single', text: 'What type of feedback helps you improve?', options: [
          o('regular', 'Regular check-ins'), o('written', 'Written notes'), o('spoken', 'A quick chat'), o('examples', 'Seeing a good example')] },
        { id: 'l8', type: 'single', optional: true, text: 'Which learning activity do you enjoy most?', help: 'Optional.', options: [
          o('try', 'Hands-on practice'), o('others', 'Group activities'), o('watch', 'Videos and demonstrations'), o('read', 'Reading and research'), o('steps', 'Step-by-step guides')] }
      ] },

    { key: 'work', name: 'Work preferences', icon: 'i-briefcase',
      intro: 'The kind of work and places you would enjoy.',
      questions: [
        { id: 'w1', type: 'single', text: 'Do you prefer working independently or as part of a team?', options: [
          o('independent', 'Independently'), o('team', 'As part of a team'), o('mix', 'A mix of both')] },
        { id: 'w2', type: 'multi', max: 2, text: 'Which type of environment sounds most appealing?', help: 'Select up to 2.', options: [
          o('office', 'Office'), o('workshop', 'Workshop'), o('outdoors', 'Outdoors'), o('retail', 'Shop or retail'),
          o('community', 'Community setting'), o('remote', 'Remote or hybrid, where available'), o('any', 'No strong preference')] },
        { id: 'w3', type: 'single', text: 'Do you enjoy practical or computer-based tasks?', options: [
          o('practical', 'Practical, hands-on tasks'), o('computer', 'Computer-based tasks'), o('both', 'Both')] },
        { id: 'w4', type: 'scale', scale: COMFORT, text: 'How comfortable are you speaking with customers?' },
        { id: 'w5', type: 'single', text: 'Would you prefer structured routines or varied responsibilities?', options: [
          o('structured', 'Structured routines'), o('varied', 'Varied responsibilities'), o('mix', 'A bit of both')] },
        { id: 'w6', type: 'multi', max: 3, text: 'What kind of tasks do you enjoy most?', help: 'Select up to 3.', options: [
          o('creative', 'Creative tasks'), o('technical', 'Technical tasks'), o('practical', 'Practical hands-on work'),
          o('problem', 'Problem-solving'), o('helping', 'Helping people'), o('organising', 'Organising information'),
          o('computers', 'Working with computers'), o('team', 'Team-based activities')] },
        { id: 'w7', type: 'single', text: 'Do you prefer working indoors, outdoors or a combination?', options: [
          o('indoors', 'Indoors'), o('outdoors', 'Outdoors'), o('mix', 'A combination')] },
        { id: 'w8', type: 'single', text: 'What matters most to you in a job?', options: PRIORITIES.concat([o('pay', 'Good pay')]) }
      ] },

    { key: 'confidence', name: 'Your confidence', icon: 'i-medal',
      intro: 'How you feel about each of these right now. It’s your own view, not a test.',
      questions: [
        { id: 'c1', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel introducing yourself to an employer?' },
        { id: 'c2', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel answering interview questions?' },
        { id: 'c3', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel working with people you don’t know?' },
        { id: 'c4', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel learning a new task?' },
        { id: 'c5', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel communicating professionally, for example by email or phone?' },
        { id: 'c6', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel solving problems at work?' },
        { id: 'c7', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel applying for jobs?' },
        { id: 'c8', type: 'scale', scale: CONFIDENCE, text: 'How confident do you feel about starting a new role?' }
      ] },

    { key: 'ideal', name: 'Your ideal opportunity', icon: 'i-key',
      intro: 'What a great next opportunity would look like for you.',
      questions: [
        { id: 'o1', type: 'text', optional: true, text: 'What would your ideal job involve?', help: 'Optional. A few words is fine.', placeholder: 'My ideal job would involve…' },
        { id: 'o2', type: 'multi', max: 3, text: 'Which types of work sound most interesting?', help: 'Select up to 3.', options: AREAS },
        { id: 'o3', type: 'single', text: 'What kind of workplace would you prefer?', options: [
          o('small', 'A small, friendly team'), o('large', 'A larger organisation'), o('public', 'Public service or a charity'), o('any', 'Not sure yet')] },
        { id: 'o4', type: 'multi', max: 3, text: 'What matters most when choosing a job?', help: 'Select up to 3.', options: PRIORITIES },
        { id: 'o5', type: 'scale', scale: KEEN, text: 'Would you enjoy learning new skills while working?' },
        { id: 'o6', type: 'single', optional: true, text: 'Which career area would you like to explore first?', help: 'Optional.', options: AREAS },
        { id: 'o7', type: 'multi', max: 7, optional: true, text: 'Which opportunities would you currently consider?', help: 'Optional. Select any that apply.', options: [
          o('fulltime', 'Full-time work'), o('parttime', 'Part-time work'), o('apprenticeship', 'An apprenticeship'),
          o('traineeship', 'A traineeship'), o('volunteering', 'Volunteering'), o('workexp', 'Work experience'), o('training', 'A training course')] },
        { id: 'o8', type: 'text', optional: true, text: 'What would make an opportunity appealing to you?', help: 'Optional.', placeholder: 'It would appeal to me if…' }
      ] }
  ];

  var api = {
    STAGES: STAGES,
    stage: function (key) {
      for (var i = 0; i < STAGES.length; i++) {
        if (STAGES[i].key === key) {
          return STAGES[i];
        }
      }
      return null;
    },
    question: function (id) {
      for (var i = 0; i < STAGES.length; i++) {
        for (var j = 0; j < STAGES[i].questions.length; j++) {
          if (STAGES[i].questions[j].id === id) {
            return STAGES[i].questions[j];
          }
        }
      }
      return null;
    },
    label: function (qid, v) {
      var q = api.question(qid);
      if (!q || !q.options) {
        return v;
      }
      for (var i = 0; i < q.options.length; i++) {
        if (q.options[i].v === v) {
          return q.options[i].label;
        }
      }
      return v;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MTWQD = api;
  }
}(this));

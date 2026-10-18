/* ==========================================================================
   MOVEMENT TO WORK: INTERVIEW QUESTIONS
   The question library for the interview practice tool (interview.js).
   Kept apart from the interface so questions can be added or edited here
   without touching any other code.

   Each question has:
     id         unique, stable (saved progress refers to it)
     cat        category key (see CATEGORIES)
     text       the question as it is asked
     time       suggested answer time, in seconds
     level      1 Getting started, 2 Building up, 3 Stretch
     star       true when a STAR answer (Situation, Task, Action, Result)
                is the best fit
     kind       intro | motivation | behavioural | situational | closing
                (decides the suggested structure and the length checks)
     keywords   words that often show an answer is on topic. Only ever
                used as a hint, never as proof an answer is right.
     example    an example answer: a string, or { s, t, a, r } for STAR
     mistakes   common mistakes
     tips       short tips shown while answering
   ========================================================================== */

(function (root) {
  'use strict';

  var CATEGORIES = [
    { key: 'intro', name: 'Introducing yourself' },
    { key: 'motivation', name: 'Motivation and goals' },
    { key: 'teamwork', name: 'Teamwork and communication' },
    { key: 'problem', name: 'Problem-solving and adaptability' },
    { key: 'organisation', name: 'Organisation and work ethic' },
    { key: 'workplace', name: 'Workplace situations' },
    { key: 'firstjob', name: 'Entry-level and first jobs' }
  ];

  var LEVELS = { 1: 'Getting started', 2: 'Building up', 3: 'Stretch' };

  // The suggested shape of an answer, by kind of question.
  var STRUCTURES = {
    intro: ['Start with who you are now (studying, training or looking for work).',
      'Add one or two strengths or experiences that fit the role.',
      'Back one of them up with a quick example.',
      'Finish with what you are looking for next.'],
    motivation: ['Give your main reason in the first sentence.',
      'Show you know something about the job, company or industry.',
      'Link it to your own skills, interests or experience.',
      'Finish with what you would bring or hope to learn.'],
    behavioural: ['Situation: set the scene in a sentence or two.',
      'Task: say what you were responsible for.',
      'Action: explain the steps you took yourself (use "I").',
      'Result: say what happened and what you learned.'],
    situational: ['Say clearly what you would do first.',
      'Walk through the next steps in order.',
      'Explain why: who it helps and what could go wrong otherwise.',
      'If you can, mention a time you did something similar.'],
    closing: ['Thank them for the interview.',
      'Ask one or two genuine questions about the role, team or training.',
      'Avoid questions about pay or holidays at this stage, unless they raise it.']
  };

  // Rough answer lengths in words that suit each kind of question, for a
  // typed or transcribed answer. Spoken answers run longer than typed ones.
  var LENGTHS = {
    intro: [40, 220],
    motivation: [40, 200],
    behavioural: [70, 260],
    situational: [45, 220],
    closing: [15, 120]
  };

  function q(id, cat, kind, text, time, level, star, keywords, example, mistakes, tips) {
    return { id: id, cat: cat, kind: kind, text: text, time: time, level: level, star: star,
      keywords: keywords, example: example, mistakes: mistakes, tips: tips };
  }

  var QUESTIONS = [
    /* --- A. Introducing yourself ------------------------------------------ */
    q('q01', 'intro', 'intro', 'Tell us more about yourself.', 90, 1, false,
      ['studying', 'college', 'school', 'experience', 'enjoy', 'skills', 'looking', 'interested', 'volunteer', 'worked'],
      'I’m 19 and I recently finished a Level 2 course in Business at college. Alongside my studies I volunteered at a food bank on Saturdays, where I sorted donations and helped customers find what they needed. That taught me how much I enjoy working with people and keeping things organised. I’m now looking for my first full-time role in customer service, where I can keep learning and be part of a team.',
      ['Reading out your whole life story or your CV line by line.', 'Sharing personal details that are not relevant to work.'],
      ['Think "present, past, future": what you do now, what you have done, what you want next.', 'Keep it to about a minute and a half.']),

    q('q02', 'intro', 'intro', 'How would you describe yourself in three words?', 60, 1, false,
      ['reliable', 'friendly', 'organised', 'hardworking', 'curious', 'calm', 'positive', 'patient', 'because', 'example'],
      'I’d say reliable, friendly and curious. Reliable because at my part-time job I’ve never missed a shift and I’m usually early. Friendly because I like making customers feel welcome. And curious because I always ask questions when I’m learning something new, like when I taught myself basic Excel for a college project.',
      ['Giving three words with no explanation.', 'Choosing words that do not suit the job.'],
      ['Give a one-line reason or example for each word.']),

    q('q03', 'intro', 'intro', 'What are your main strengths?', 90, 1, false,
      ['strength', 'good at', 'organised', 'communication', 'team', 'reliable', 'example', 'learn', 'problem'],
      'One of my main strengths is staying organised. At college I juggled coursework with a part-time job, so I used a weekly planner and never missed a deadline. I’m also good at talking to people: when I volunteered at a charity shop I helped new volunteers settle in and showed them how the till worked. I think both would help me in a busy customer-facing role.',
      ['Listing lots of strengths with no proof.', 'Being too modest to name any.'],
      ['Pick two strengths that match the job and give an example of each.']),

    q('q04', 'intro', 'intro', 'What is one weakness you’re working on?', 90, 2, false,
      ['weakness', 'working on', 'improve', 'learning', 'practise', 'better', 'confidence', 'now'],
      'I used to find speaking in front of groups quite nerve-racking. I’ve been working on it by volunteering to present in class and by preparing notes beforehand. Last term I gave a ten-minute presentation to my whole course and it went well. I’m still building my confidence, but I now say yes to these opportunities instead of avoiding them.',
      ['Saying you have no weaknesses.', 'Choosing a weakness that is essential for the job.', 'Disguising a strength as a weakness ("I work too hard").'],
      ['Name a real but manageable weakness, then spend most of the answer on what you are doing about it.']),

    q('q05', 'intro', 'intro', 'What motivates you?', 60, 1, false,
      ['motivate', 'enjoy', 'helping', 'learning', 'achieve', 'team', 'progress', 'satisfaction'],
      'I’m motivated by seeing that my work has made a difference. When I volunteered at a youth club, I helped organise a games night and seeing everyone enjoy it made all the planning worthwhile. I also like learning new skills and seeing myself improve, so I’m excited by roles that offer training.',
      ['Saying only money motivates you.', 'Giving a vague answer such as "lots of things".'],
      ['Link what motivates you to something the job offers.']),

    q('q06', 'intro', 'intro', 'What makes you a good candidate?', 90, 2, false,
      ['skills', 'experience', 'reliable', 'learn', 'team', 'customer', 'role', 'because', 'example'],
      'I think I’m a good candidate because I’m reliable, I learn quickly and I enjoy helping people. During my work placement at a local café I learned the till and food safety rules in my first week, and the manager asked me to stay on for weekend shifts. I’d bring the same attitude to this role.',
      ['Repeating the job advert back to them.', 'Comparing yourself with other candidates.'],
      ['Match two or three things from the job advert with your own evidence.']),

    q('q07', 'intro', 'behavioural', 'What are you most proud of?', 90, 2, true,
      ['proud', 'achieved', 'completed', 'overcame', 'worked hard', 'result', 'learned'],
      { s: 'In my final year at school I was struggling with maths and was predicted to fail my GCSE.',
        t: 'I needed at least a grade 4 to get onto my college course.',
        a: 'I asked my teacher for extra help, went to revision sessions twice a week and did a past paper every weekend.',
        r: 'I passed with a grade 5. I’m proud of it because it showed me that steady effort pays off, and I use the same approach to learning now.' },
      ['Choosing something with no link to work skills.', 'Not explaining what you did yourself.'],
      ['Pick something that shows effort, not just luck.', 'School, sport, family, volunteering and hobbies all count.']),

    /* --- B. Motivation and career goals ------------------------------------- */
    q('q08', 'motivation', 'motivation', 'Why do you want to work here?', 120, 1, false,
      ['company', 'values', 'customers', 'reputation', 'training', 'team', 'local', 'products', 'learn'],
      'I’ve shopped here for years and I’ve always noticed how helpful the staff are. When I looked at your website I saw that you offer training for new starters and value good customer service, which is exactly what I want to build on. I’d like to work somewhere I can learn properly and be part of a friendly team.',
      ['Saying "I need a job" or "it’s close to my house" as your only reason.', 'Knowing nothing about the company.'],
      ['Look at the company’s website before the interview and mention one specific thing.']),

    q('q09', 'motivation', 'motivation', 'Why are you interested in this job?', 60, 1, false,
      ['interested', 'enjoy', 'skills', 'role', 'customers', 'learn', 'experience', 'suit'],
      'I enjoy work where I’m talking to people and solving small problems, and this job is all about that. I liked dealing with customers during my retail placement, and this role would let me build on that and learn new skills such as handling orders and stock.',
      ['Being vague about what the job involves.'],
      ['Mention one or two tasks from the job advert you would enjoy.']),

    q('q10', 'motivation', 'motivation', 'Why should we hire you?', 120, 2, false,
      ['skills', 'reliable', 'experience', 'learn', 'team', 'because', 'bring', 'role'],
      'You should hire me because I’m reliable, keen to learn and good with people. At college I had full attendance, and in my volunteering role I was trusted to open up the shop on my own. I know I have plenty to learn, but I pick things up quickly and I’d work hard to be a useful member of your team from the start.',
      ['Sounding arrogant or putting others down.', 'Not giving any evidence.'],
      ['Summarise your top two or three selling points, each with proof.']),

    q('q11', 'motivation', 'motivation', 'What do you know about our company?', 90, 2, false,
      ['company', 'founded', 'products', 'services', 'customers', 'values', 'website', 'recently', 'local'],
      'I know you’re a family-run business that started in Wigan and now has five shops across the North West. Your website talks a lot about supporting local suppliers, and I saw you recently opened a new branch in Ormskirk. I like that you put the community first.',
      ['Guessing or making things up.', 'Only repeating the company name and what it sells.'],
      ['Find two or three facts: what they do, who their customers are, and something recent.']),

    q('q12', 'motivation', 'motivation', 'What interests you about this industry?', 90, 2, false,
      ['industry', 'interested', 'growing', 'enjoy', 'future', 'learn', 'people', 'change'],
      'I’m interested in hospitality because no two days are the same, and you can see straight away when you’ve made someone’s day better. It’s also an industry where you can work your way up, and I’d like to learn the different parts of running a busy venue.',
      ['Giving a general answer that could fit any industry.'],
      ['Say what first got you interested, and what you would like to learn about it.']),

    q('q13', 'motivation', 'motivation', 'Where do you see yourself in five years?', 90, 2, false,
      ['future', 'progress', 'learn', 'develop', 'responsibility', 'qualification', 'role', 'team', 'goal'],
      'In five years I’d like to have built up solid experience in this kind of role and taken on more responsibility, perhaps training new starters or leading a small team. I’d also like to have gained a qualification along the way, such as an apprenticeship or a Level 3 course.',
      ['Saying you want the interviewer’s job.', 'Saying you have no idea, or that you plan to leave soon.'],
      ['Show ambition that fits with staying and growing in the role.']),

    q('q14', 'motivation', 'motivation', 'What would you like to learn from this role?', 60, 1, false,
      ['learn', 'skills', 'training', 'experience', 'develop', 'confidence', 'customers', 'team'],
      'I’d like to learn how a workplace like this runs day to day, from handling customer queries to keeping on top of stock. I’d also like to build my confidence on the phone and get used to working as part of a team on busy shifts.',
      ['Making it all about what you get, with nothing about what you give.'],
      ['Name specific skills from the job advert you would like to develop.']),

    /* --- C. Teamwork and communication ------------------------------------- */
    q('q15', 'teamwork', 'behavioural', 'Tell me about a time you worked as part of a team.', 120, 1, true,
      ['team', 'group', 'together', 'organised', 'helped', 'role', 'communicate', 'shared', 'result'],
      { s: 'During college, we had to complete a group presentation.',
        t: 'I was responsible for organising our research and helping coordinate the work.',
        a: 'I divided the tasks, checked everyone’s progress and helped a teammate who was falling behind.',
        r: 'We completed the presentation on time and received positive feedback. I learned how important communication is when working with others.' },
      ['Saying "we" all the way through, so they cannot tell what you did.', 'Not saying how it turned out.'],
      ['School, college, sport, volunteering and hobbies all count as teams.', 'Use "I" for your own part.']),

    q('q16', 'teamwork', 'behavioural', 'Describe a time you helped someone.', 90, 1, true,
      ['helped', 'supported', 'explained', 'listened', 'showed', 'needed', 'result', 'grateful'],
      { s: 'A new volunteer at the charity shop where I help out was nervous about using the till.',
        t: 'The manager asked me to show her how everything worked.',
        a: 'I went through each step slowly, let her practise while it was quiet and wrote her a short checklist.',
        r: 'By the end of the week she was serving customers on her own, and the manager now asks me to help train new volunteers.' },
      ['Choosing an example with no clear help given.'],
      ['Explain what the person needed and exactly what you did.']),

    q('q17', 'teamwork', 'situational', 'How would you deal with a disagreement with a colleague?', 90, 2, false,
      ['listen', 'calm', 'talk', 'privately', 'understand', 'compromise', 'manager', 'respect', 'solution'],
      'I’d stay calm and ask to talk it through privately, rather than in front of customers. I’d listen to their point of view first, then explain mine, and try to find a solution we could both accept. If we still couldn’t agree and it was affecting the work, I’d ask our manager for advice. At college I had a similar disagreement in a group project, and talking it through early sorted it out.',
      ['Saying you never disagree with anyone.', 'Describing yourself winning the argument.'],
      ['Show you can listen, stay calm and focus on the work.']),

    q('q18', 'teamwork', 'situational', 'What does good communication mean to you?', 60, 1, false,
      ['listening', 'clear', 'questions', 'respect', 'understand', 'honest', 'update', 'example'],
      'To me, good communication means listening properly, being clear and checking that the other person has understood. For example, when I take an order I repeat it back to the customer so nothing gets missed. It also means letting people know early if there’s a problem.',
      ['Only talking about speaking, and not about listening.'],
      ['Give one small, real example of how you communicate well.']),

    q('q19', 'teamwork', 'behavioural', 'Tell me about a time you listened to someone’s feedback.', 120, 2, true,
      ['feedback', 'listened', 'changed', 'improved', 'advice', 'learned', 'better'],
      { s: 'On my work placement, my supervisor said my emails to customers were a bit too informal.',
        t: 'I needed to make them more professional while still sounding friendly.',
        a: 'I asked her for a couple of good examples, made myself a short template and had her check my next few emails.',
        r: 'She said they were much better, and I now use the same approach whenever I write to customers. It taught me that feedback is a quick way to improve.' },
      ['Sounding defensive about the feedback.', 'Not showing what you changed.'],
      ['Show you welcomed the feedback and acted on it.']),

    q('q20', 'teamwork', 'situational', 'How would you support a teammate who was struggling?', 90, 2, false,
      ['ask', 'help', 'support', 'listen', 'offer', 'manager', 'workload', 'check'],
      'I’d quietly ask if they were okay and whether I could help. If it was a busy shift, I might offer to take one of their tasks once mine were done. If it seemed like something bigger, I’d encourage them to speak to our manager. I’d want them to feel the team had their back.',
      ['Taking over their work without asking.'],
      ['Show kindness and good judgement about when to involve a manager.']),

    q('q21', 'teamwork', 'situational', 'Do you prefer working independently or in a team?', 60, 1, false,
      ['both', 'team', 'independently', 'enjoy', 'example', 'own', 'together'],
      'I’m comfortable with both. I enjoy working in a team because you can share ideas and help each other on busy days, but I can also get on with tasks on my own. At my last placement I worked alone on stock checks but with the team at the till, and I was happy doing either.',
      ['Saying you hate working with people, or that you cannot work alone.'],
      ['Show you can do both, and give an example of each if you can.']),

    /* --- D. Problem-solving and adaptability ------------------------------- */
    q('q22', 'problem', 'behavioural', 'Tell me about a time you solved a problem.', 120, 2, true,
      ['problem', 'solved', 'fixed', 'found', 'idea', 'decided', 'result', 'improved'],
      { s: 'At my part-time job, customers often queued for a long time at the start of the lunch rush.',
        t: 'I wanted to help the queue move faster without rushing customers.',
        a: 'I suggested we set up the most popular sandwiches in advance, and I prepared them each morning before we opened.',
        r: 'The queue moved much more quickly and the manager kept the idea. I learned that small changes can make a big difference.' },
      ['Describing the problem in detail but not your solution.'],
      ['Keep the problem short and spend most of the answer on what you did.']),

    q('q23', 'problem', 'behavioural', 'Describe a time something didn’t go to plan.', 120, 2, true,
      ['plan', 'changed', 'adapted', 'went wrong', 'decided', 'result', 'learned', 'next time'],
      { s: 'I organised a bake sale for a charity at college, but on the day half the volunteers were ill.',
        t: 'I still needed to run the stall and raise as much money as possible.',
        a: 'I asked two friends to cover the busiest hour, cut the stall down to one table and put up a sign with prices so we could serve faster.',
        r: 'We still raised £120. Next time I’d line up back-up volunteers in advance.' },
      ['Blaming other people.', 'Choosing something that went badly with no recovery.'],
      ['Show how you stayed calm and adapted, and what you would do differently.']),

    q('q24', 'problem', 'behavioural', 'Tell me about a mistake you made and what you learned.', 150, 2, true,
      ['mistake', 'wrong', 'apologised', 'fixed', 'learned', 'now', 'check', 'responsibility'],
      { s: 'In my first week at a café, I mixed up two orders at a busy table.',
        t: 'I needed to put it right quickly and keep the customers happy.',
        a: 'I apologised straight away, told my supervisor and brought the right dishes out as fast as I could.',
        r: 'The customers were fine about it. Since then I always read orders back before sending them to the kitchen, and I haven’t made that mistake again.' },
      ['Saying you have never made a mistake.', 'Choosing a serious mistake with no lesson learned.'],
      ['Spend most of the answer on how you put it right and what you learned.']),

    q('q25', 'problem', 'situational', 'How do you handle unexpected changes?', 90, 2, false,
      ['change', 'adapt', 'calm', 'flexible', 'ask', 'plan', 'priorities', 'example'],
      'I try to stay calm and work out what needs to happen first. I’d ask questions if I wasn’t sure, then adjust my plan. For example, when my shift pattern changed at short notice last summer, I rearranged my week and still covered all my hours.',
      ['Saying you dislike change, with no sign of coping.'],
      ['Show a clear approach, then back it up with a short example.']),

    q('q26', 'problem', 'situational', 'What would you do if you didn’t understand a task?', 60, 1, false,
      ['ask', 'questions', 'check', 'clarify', 'manager', 'notes', 'understand', 'example'],
      'I’d ask for help straight away rather than guessing. I’d check exactly what was needed, write down the steps and, if possible, ask to see an example. It’s better to ask early than to do it wrong and waste time.',
      ['Saying you would guess, or just get on with it.'],
      ['Employers like people who ask questions. Say so.']),

    q('q27', 'problem', 'behavioural', 'Describe a time you had to learn something new.', 120, 2, true,
      ['learn', 'new', 'practised', 'taught', 'course', 'quickly', 'result', 'now'],
      { s: 'When I started volunteering at a community centre, they used a booking system I had never seen.',
        t: 'I needed to learn it within a week to take bookings on my own.',
        a: 'I watched the coordinator use it, made notes of each step and practised with test bookings during quiet times.',
        r: 'By the end of the week I was taking bookings on my own, and I later showed another new volunteer how to use it.' },
      ['Not explaining how you learned it.'],
      ['Show your method for learning, not just that you learned it.']),

    q('q28', 'problem', 'situational', 'How do you approach a difficult challenge?', 90, 2, false,
      ['break', 'steps', 'plan', 'ask', 'help', 'calm', 'focus', 'example'],
      'I break it down into smaller steps and tackle them one at a time. I ask for advice when I need it and keep checking my progress. When I had a difficult coursework deadline, I split the work into weekly targets and finished a few days early.',
      ['Only saying you "work hard".'],
      ['Describe your method, then give a quick example.']),

    /* --- E. Organisation and work ethic ------------------------------------ */
    q('q29', 'organisation', 'situational', 'How do you manage your time?', 90, 1, false,
      ['plan', 'list', 'priorities', 'calendar', 'deadlines', 'organised', 'early', 'example'],
      'I write a to-do list each morning and put the most urgent things first. I use my phone calendar for shifts and deadlines, and I set reminders a day before. At college this helped me balance coursework with a part-time job without missing anything.',
      ['Being vague, with no method.'],
      ['Mention the tools you use, such as lists, a planner or reminders.']),

    q('q30', 'organisation', 'behavioural', 'Tell me about a time you had to meet a deadline.', 120, 2, true,
      ['deadline', 'time', 'planned', 'finished', 'on time', 'priorities', 'result'],
      { s: 'At college I had two assignments due in the same week as my mock exams.',
        t: 'I needed to hand both in on time while still revising.',
        a: 'I made a plan for each day, started the assignments two weeks early and asked my tutor to check my plan.',
        r: 'I handed both in a day early and passed my mocks. Planning ahead is now something I always do.' },
      ['Describing a deadline you missed with no lesson learned.'],
      ['Show the planning, not just the rush at the end.']),

    q('q31', 'organisation', 'situational', 'What would you do if you had several tasks to complete?', 90, 2, false,
      ['prioritise', 'urgent', 'list', 'order', 'ask', 'manager', 'deadline', 'first'],
      'I’d list them and work out which are most urgent or important. If I wasn’t sure which came first, I’d check with my manager. Then I’d work through them one by one and let people know if anything was going to take longer than expected.',
      ['Saying you would do them all at once.'],
      ['Show you can prioritise and keep people updated.']),

    q('q32', 'organisation', 'situational', 'How would you respond if you were running late for work?', 60, 1, false,
      ['call', 'tell', 'manager', 'early', 'apologise', 'plan', 'arrive', 'reliable'],
      'I’d let my manager know as soon as I knew I’d be late, explain why and give an honest arrival time. I’d apologise and make up the time if needed. I always try to leave early to avoid this happening in the first place.',
      ['Saying you would just turn up late without telling anyone.'],
      ['Show you would tell someone straight away.']),

    q('q33', 'organisation', 'situational', 'What does being reliable mean to you?', 60, 1, false,
      ['on time', 'trust', 'promise', 'turn up', 'consistent', 'team', 'example'],
      'Being reliable means turning up on time, doing what I say I’ll do and letting people know early if something changes. For example, during my volunteering I committed to every Saturday for six months and didn’t miss one.',
      ['Giving a definition with no example.'],
      ['Back it up with a real example of your reliability.']),

    q('q34', 'organisation', 'situational', 'How do you stay focused on repetitive tasks?', 60, 2, false,
      ['focus', 'targets', 'breaks', 'accuracy', 'check', 'music', 'goal', 'quality'],
      'I set myself small targets, like finishing a section before a short break, and I remind myself why the task matters. When I did stock counting on my placement, I double-checked every tenth shelf so I stayed accurate.',
      ['Saying you get bored easily.'],
      ['Show how you keep your quality high.']),

    q('q35', 'organisation', 'behavioural', 'Describe a time you took responsibility for something.', 120, 2, true,
      ['responsibility', 'trusted', 'led', 'organised', 'in charge', 'result', 'learned'],
      { s: 'My football team’s coach was off sick for three weeks before a tournament.',
        t: 'I offered to organise the training sessions so we could keep practising.',
        a: 'I booked the pitch, planned each session with the captain and sent everyone the times each week.',
        r: 'We kept training and reached the semi-final. It showed me I can step up when it’s needed.' },
      ['Picking something you were made to do, with no initiative.'],
      ['Explain why you stepped up, as well as what you did.']),

    /* --- F. Workplace situations ------------------------------------------- */
    q('q36', 'workplace', 'situational', 'How would you deal with an unhappy customer?', 90, 2, false,
      ['listen', 'apologise', 'calm', 'understand', 'solution', 'manager', 'help', 'polite'],
      'I’d stay calm, listen to what the problem is without interrupting and apologise for their experience. Then I’d see what I could do to put it right, such as offering a replacement, and if it was beyond what I could do, I’d get my manager. Customers mostly want to feel listened to.',
      ['Arguing with the customer or blaming colleagues.'],
      ['Listen, apologise, solve, and know when to ask for help.']),

    q('q37', 'workplace', 'situational', 'What would you do if you noticed a colleague needed help?', 60, 1, false,
      ['offer', 'ask', 'help', 'support', 'team', 'finish', 'manager'],
      'I’d ask if they’d like a hand, as long as my own work was covered. If I couldn’t help myself, I’d let a supervisor know they might need support. In a team, it’s better for everyone if we help each other out.',
      ['Ignoring it because it is "not your job".'],
      ['Balance helping with keeping on top of your own tasks.']),

    q('q38', 'workplace', 'situational', 'How would you handle constructive criticism?', 60, 2, false,
      ['listen', 'thank', 'improve', 'questions', 'learn', 'change', 'example'],
      'I’d listen, thank them and ask questions if I didn’t understand. Then I’d act on it. When my tutor said my essays needed clearer structure, I started planning them in bullet points first, and my grades improved.',
      ['Sounding defensive or upset.'],
      ['Show you see feedback as useful, with an example of acting on it.']),

    q('q39', 'workplace', 'situational', 'What would you do if you made a mistake at work?', 60, 1, false,
      ['tell', 'manager', 'honest', 'apologise', 'fix', 'learn', 'check'],
      'I’d own up straight away and tell my manager, even if it was small. Then I’d help put it right and think about how to stop it happening again. Being honest early stops a small problem becoming a big one.',
      ['Saying you would hide it or hope no one noticed.'],
      ['Honesty is what employers are listening for.']),

    q('q40', 'workplace', 'situational', 'How would you respond to an unfamiliar task?', 60, 1, false,
      ['ask', 'learn', 'instructions', 'example', 'notes', 'try', 'check', 'help'],
      'I’d see it as a chance to learn. I’d ask for instructions or an example, make notes and check my work with someone the first time. Once I’d done it a couple of times I’d be confident doing it on my own.',
      ['Saying you would refuse or panic.'],
      ['Show a positive attitude and a sensible way to learn.']),

    q('q41', 'workplace', 'situational', 'How would you deal with someone who was being difficult?', 90, 3, false,
      ['calm', 'listen', 'polite', 'understand', 'boundaries', 'manager', 'professional', 'respect'],
      'I’d stay calm and polite, and try to understand what was really bothering them. Often people are difficult because they are stressed or worried. I’d focus on the task, not the attitude, and if they became rude or aggressive I’d involve my manager.',
      ['Saying you would argue back.'],
      ['Show patience, professionalism and when you would get support.']),

    /* --- G. Entry-level and first jobs ------------------------------------- */
    q('q42', 'firstjob', 'intro', 'What skills have you gained from school, college or volunteering?', 90, 1, false,
      ['skills', 'school', 'college', 'volunteering', 'teamwork', 'communication', 'organised', 'example'],
      'From college I’ve learned to manage my time and meet deadlines, and group projects taught me to work as part of a team. Volunteering at a charity shop gave me customer service skills and experience using a till. I also gained confidence talking to people I didn’t know.',
      ['Saying you have not gained any skills because you have not had a job.'],
      ['Turn school and volunteering activities into skills an employer needs.']),

    q('q43', 'firstjob', 'intro', 'How would you show an employer you’re ready to learn?', 60, 1, false,
      ['ask', 'questions', 'notes', 'feedback', 'training', 'learn', 'practise', 'example'],
      'I’d ask questions, take notes during training and ask for feedback on how I’m doing. I’d also practise things in my own time where I can. When I started at my placement, I asked my supervisor for a list of common tasks and worked through them in my first week.',
      ['Just saying "I’m a fast learner" with no proof.'],
      ['Describe what you would actually do in your first weeks.']),

    q('q44', 'firstjob', 'intro', 'What would you say if you haven’t had a job before?', 90, 2, false,
      ['school', 'college', 'volunteering', 'skills', 'responsibility', 'learn', 'example', 'ready'],
      'I’d say that although I haven’t had a paid job yet, I’ve built useful skills in other ways. I helped organise events at college, I look after my younger brother after school, which means being responsible and on time, and I’ve volunteered at a local food bank. I’m keen to put those skills to use and learn on the job.',
      ['Apologising for having no experience.'],
      ['Everyone starts somewhere. Focus on what you can already do.']),

    q('q45', 'firstjob', 'closing', 'Do you have any questions for us?', 45, 1, false,
      ['training', 'team', 'typical day', 'progress', 'next steps', 'support', 'start'],
      'Yes, thank you. What would a typical day look like in this role? And what training do new starters get in the first few weeks?',
      ['Saying "no, I think you’ve covered everything".', 'Only asking about pay and holidays.'],
      ['Prepare two questions before the interview, about the role, training or team.'])
  ];

  var api = {
    CATEGORIES: CATEGORIES,
    LEVELS: LEVELS,
    STRUCTURES: STRUCTURES,
    LENGTHS: LENGTHS,
    QUESTIONS: QUESTIONS,
    byId: function (id) {
      for (var i = 0; i < QUESTIONS.length; i++) {
        if (QUESTIONS[i].id === id) {
          return QUESTIONS[i];
        }
      }
      return null;
    },
    category: function (key) {
      for (var i = 0; i < CATEGORIES.length; i++) {
        if (CATEGORIES[i].key === key) {
          return CATEGORIES[i];
        }
      }
      return null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MTWIQ = api;
  }
}(this));

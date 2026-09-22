// TypeTrainer 3 UI tests — puppeteer-core driving headless Chrome over file://.
// Run: node tests/test_ui.js  (no server needed)
'use strict';

var path = require('path');
var puppeteer = require('puppeteer-core');

var CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
var INDEX = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

var passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.error('FAIL  ' + name); }
}

(async function () {
  var browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--allow-file-access-from-files']
  });
  var page = await browser.newPage();
  page.on('pageerror', function (e) { console.error('PAGE ERROR: ' + e.message); failed++; });

  // ---- basic load ---------------------------------------------------------
  await page.goto(INDEX, { waitUntil: 'load' });
  ok(await page.title() === 'TypeTrainer 3', 'title is TypeTrainer 3');
  var tabCount = await page.$$eval('.tab-btn', function (els) { return els.length; });
  ok(tabCount === 6, 'six tabs render (incl. Milestones, Shortcuts)');
  var modeCount = await page.$$eval('.mode-pill', function (els) { return els.length; });
  ok(modeCount === 3, 'mode picker renders (Test / Sprint / Daily loop)');
  var hasText = await page.$eval('#practice-text', function (el) { return el.textContent.length > 50; });
  ok(hasText, 'practice text generated');

  // ---- demo weak spots: Autopilot ------------------------------------------
  await page.goto(INDEX + '?demo=1&tab=weakspots', { waitUntil: 'load' });
  ok(await page.$eval('#autopilot', function (el) { return !el.classList.contains('hidden'); }),
    'Autopilot panel visible with demo data');
  var comfort = await page.$eval('#ap-comfort', function (el) { return parseInt(el.textContent, 10); });
  var potential = await page.$eval('#ap-potential', function (el) { return parseInt(el.textContent, 10); });
  ok(comfort > 0 && potential >= comfort, 'comfortable -> potential WPM readout (' + comfort + ' -> ' + potential + ')');
  var apItems = await page.$$eval('#ap-bottlenecks .ap-item', function (els) { return els.length; });
  ok(apItems >= 3 && apItems <= 5, 'bottleneck list populated (' + apItems + ')');
  var gains = await page.$$eval('.ap-gain', function (els) {
    return els.every(function (e) { return /WPM/.test(e.textContent); });
  });
  ok(gains, 'per-bottleneck WPM estimates shown');
  var headers = await page.$$eval('.weak-table th', function (els) {
    return els.map(function (e) { return e.textContent; });
  });
  ok(headers.length === 7 && headers.indexOf('Speed') !== -1 && headers.indexOf('Time cost') !== -1,
    'weak table has 7 columns incl. Speed and Time cost');
  var causeTags = await page.$$eval('#weak-body .cause-tag', function (els) {
    return els.map(function (e) { return e.textContent; });
  });
  ok(causeTags.length > 0, 'cause tags rendered');
  ok(causeTags.indexOf('slow') !== -1, 'a slow-but-accurate pattern is tagged "slow"');
  var speedCells = await page.$$eval('#weak-body .speed-slow', function (els) { return els.length; });
  ok(speedCells > 0, 'speed column shows +% for slow patterns');

  // ---- Drill button -> sprint mode -------------------------------------------
  await page.click('#ap-bottlenecks .ap-item .btn-drill');
  await page.waitForSelector('#panel-practice:not(.hidden)');
  ok(true, 'Drill button switches to practice tab');
  var sprintActive = await page.$eval('.mode-pill[data-mode="sprint"]', function (el) {
    return el.classList.contains('active');
  });
  ok(sprintActive, 'sprint mode active after Drill');
  var dots = await page.$$eval('#stage-dots .stage-dot', function (els) { return els.length; });
  ok(dots === 4, 'sprint shows 4 stage dots');
  var chipLabel = await page.$eval('#target-label', function (el) { return el.textContent; });
  ok(/sprint/i.test(chipLabel), 'sidebar explains the sprint');

  // ---- typing works (classic test) ------------------------------------------
  await page.click('.mode-pill[data-mode="test"]');
  await page.click('#practice-stage');
  var first5 = await page.$eval('#practice-text', function (el) { return el.textContent.slice(0, 5); });
  await page.type('#hidden-input', first5, { delay: 40 });
  var correct = await page.$$eval('#practice-text .ch.correct', function (els) { return els.length; });
  ok(correct === 5, 'typed characters marked correct (' + correct + '/5)');
  var timerSub = await page.$eval('#practice-timer-sub', function (el) { return el.textContent; });
  ok(/left/.test(timerSub), 'timer running after first keystroke');

  // ---- daily loop mode ---------------------------------------------------------
  await page.keyboard.press('Escape'); // abort the running test so controls unlock
  await new Promise(function (r) { setTimeout(r, 200); });
  await page.click('.mode-pill[data-mode="loop"]');
  await new Promise(function (r) { setTimeout(r, 300); });
  var loopDots = await page.$$eval('#stage-dots .stage-dot', function (els) { return els.length; });
  ok(loopDots === 8, 'daily loop shows 8 part dots (one per minute)');
  var loopTimer = await page.$eval('#practice-timer', function (el) { return el.textContent; });
  ok(loopTimer === '08:00', 'daily loop is 8 minutes');
  var loopLabel = await page.$eval('#target-label', function (el) { return el.textContent; });
  ok(/8 one-minute parts/.test(loopLabel), 'sidebar explains the one-minute parts');
  ok(await page.$eval('#loop-gate', function (el) { return el.classList.contains('hidden'); }),
    'checkpoint gate hidden before a part completes');

  // Simulate reaching the end of part 1: rewind the part clock and let a tick fire.
  await page.click('#practice-stage');
  var loopFirst = await page.$eval('#practice-text', function (el) { return el.textContent.slice(0, 3); });
  await page.type('#hidden-input', loopFirst, { delay: 30 });
  await page.evaluate(function () {
    // Pull the session start 61s into the past so elapsed crosses the
    // first one-minute boundary on the next timer tick.
    var el = document.getElementById('practice-timer-sub');
    var shift = 61000;
    // practice.js keeps session private; shifting performance.now is enough
    // because perfStart was captured from it.
    var orig = performance.now.bind(performance);
    performance.now = function () { return orig() + shift; };
    void el;
  });
  await new Promise(function (r) { setTimeout(r, 400); });
  ok(await page.$eval('#loop-gate', function (el) { return !el.classList.contains('hidden'); }),
    'checkpoint gate appears after a part completes');
  var gateDone = await page.$eval('#gate-stage-done', function (el) { return el.textContent; });
  ok(gateDone === 'Warm-up', 'gate names the completed part (Warm-up)');
  var gateNext = await page.$eval('#gate-stage-next', function (el) { return el.textContent; });
  ok(gateNext === 'Transitions I', 'gate names the next part (Transitions I)');
  await page.keyboard.press('Enter');
  await new Promise(function (r) { setTimeout(r, 300); });
  ok(await page.$eval('#loop-gate', function (el) { return el.classList.contains('hidden'); }),
    'Enter dismisses the gate and resumes the loop');
  var afterSub = await page.$eval('#practice-timer-sub', function (el) { return el.textContent; });
  ok(/Transitions I/.test(afterSub), 'timer sub shows the new part after resuming');
  await page.keyboard.press('Escape'); // abort the loop before moving on
  await new Promise(function (r) { setTimeout(r, 200); });

  // ---- milestones tab (verified speed badges) ---------------------------------
  await page.goto(INDEX + '?demo=1&tab=milestones', { waitUntil: 'load' });
  var msSpeed = await page.$eval('#ms-speed', function (el) { return parseInt(el.textContent, 10); });
  ok(msSpeed > 40, 'current verified speed shown (' + msSpeed + ' WPM)');
  var msBest = await page.$eval('#ms-best', function (el) { return el.textContent; });
  ok(/70 WPM/.test(msBest), 'highest verified milestone is 70 WPM in demo');
  var badgeCells = await page.$$eval('#ms-grid .ms-badge', function (els) { return els.length; });
  ok(badgeCells === 16, '16 badge cells render');
  var earnedCells = await page.$$eval('#ms-grid .ms-badge.earned', function (els) { return els.length; });
  ok(earnedCells === 3, '50/60/70 earned in demo (' + earnedCells + ')');
  var progressCell = await page.$$eval('#ms-grid .ms-badge.in-progress', function (els) {
    return els.map(function (e) { return e.textContent; });
  });
  ok(progressCell.length === 1 && /80/.test(progressCell[0]) && /2 \/ 3/.test(progressCell[0]),
    '80 WPM badge in progress at 2 of 3 runs');
  var nextTh = await page.$eval('.ms-next-th', function (el) { return el.textContent; });
  ok(/^80/.test(nextTh), 'next milestone card targets 80 WPM');
  var vcRows = await page.$$eval('#ms-next-card .vc-row', function (els) { return els.length; });
  ok(vcRows === 3, 'verification checklist shows 3 requirements');
  var noteText = await page.$eval('.ms-note', function (el) { return el.textContent; });
  ok(/one more/i.test(noteText), 'coaching note: one more strong run needed');

  // Earned badge opens the evidence modal.
  await page.click('#ms-grid .ms-badge.earned');
  ok(await page.$eval('#badge-modal', function (el) { return !el.classList.contains('hidden'); }),
    'clicking an earned badge opens the detail modal');
  var evRows = await page.$$eval('.bm-ev-row', function (els) { return els.length; });
  ok(evRows === 3, 'modal lists 3 evidence runs');
  await page.keyboard.press('Escape');
  ok(await page.$eval('#badge-modal', function (el) { return el.classList.contains('hidden'); }),
    'Escape closes the modal');

  // Two badge tracks: sustained (30s) and burst (15s).
  var trackBtns = await page.$$eval('.ms-track', function (els) {
    return els.map(function (e) { return e.dataset.track + ':' + e.classList.contains('active'); });
  });
  ok(trackBtns.join(',') === 'steady:true,burst:false', 'milestones opens on the sustained track');
  ok(/Sustained 30s/.test(await page.$eval('#ms-best-label', function (el) { return el.textContent; })),
    'best-milestone tile names the sustained track');
  await page.click('.ms-track[data-track="burst"]');
  ok(await page.$eval('.ms-track[data-track="burst"]', function (el) { return el.classList.contains('active'); }),
    'clicking the burst pill switches track');
  var burstTitle = await page.$eval('#ms-next-card .card-title', function (el) { return el.textContent; });
  ok(/burst milestone/.test(burstTitle) && /15s/.test(burstTitle), 'next-milestone card follows the burst track');
  ok(/15-second test/.test(await page.$eval('#btn-prove', function (el) { return el.textContent; })),
    'Prove button offers a 15-second test on the burst track');
  ok(/Burst 15s/.test(await page.$eval('#ms-best-label', function (el) { return el.textContent; })),
    'best-milestone tile follows the track too');
  var burstEarned = await page.$$eval('#ms-grid .ms-badge.earned', function (els) { return els.length; });
  ok(burstEarned === 3, 'the demo 60s runs also verified 50/60/70 on the burst track (' + burstEarned + ')');
  await page.click('.ms-track[data-track="steady"]');

  // Prove button starts a qualifying-length test on the practice tab.
  await page.click('#btn-prove');
  await page.waitForSelector('#panel-practice:not(.hidden)');
  var durActive = await page.$eval('.duration-pill.active', function (el) { return el.dataset.dur; });
  ok(durActive === '30', 'Prove button arms a 30s test');

  // ---- settings: loop length + dim theme ---------------------------------------
  await page.goto(INDEX + '?tab=settings', { waitUntil: 'load' });
  var loopOpts = await page.$$eval('.loop-option', function (els) { return els.length; });
  ok(loopOpts === 5, 'loop length picker offers 5 choices');
  var loopDefault = await page.$eval('.loop-option.active', function (el) { return el.dataset.loopMin; });
  ok(loopDefault === '8', 'default loop length is 8 min');
  await page.click('.loop-option[data-loop-min="4"]');
  await new Promise(function (r) { setTimeout(r, 200); });
  // Switch to practice, arm the loop, and confirm the shorter timer.
  await page.click('.tab-btn[data-tab="practice"]');
  await page.click('.mode-pill[data-mode="loop"]');
  await new Promise(function (r) { setTimeout(r, 300); });
  var shortTimer = await page.$eval('#practice-timer', function (el) { return el.textContent; });
  ok(shortTimer === '04:00', 'daily loop honors the 4-minute setting');
  var shortLabel = await page.$eval('#target-label', function (el) { return el.textContent; });
  ok(/~4 min/.test(shortLabel), 'loop label shows the chosen length');

  var themeOpts = await page.$$eval('.theme-option', function (els) {
    return els.map(function (e) { return e.dataset.themeOpt; });
  });
  ok(themeOpts.join(',') === 'dark,dim,light,auto', 'theme picker offers Dark / Dim / Light / Auto');

  // ---- dim theme sanity ---------------------------------------------------------
  await page.goto(INDEX + '?demo=1&tab=milestones&theme=dim', { waitUntil: 'load' });
  var dimTheme = await page.$eval('html', function (el) { return el.getAttribute('data-theme'); });
  ok(dimTheme === 'dim', 'dim theme applies');
  var dimBg = await page.evaluate(function () {
    return getComputedStyle(document.body).backgroundColor;
  });
  ok(/rgb/.test(dimBg) && dimBg !== 'rgba(0, 0, 0, 0)', 'dim theme paints a background');
  // Header toggle cycles dark -> dim -> light.
  await page.goto(INDEX + '?theme=dark', { waitUntil: 'load' });
  await page.click('#theme-toggle');
  var afterOnce = await page.$eval('html', function (el) { return el.getAttribute('data-theme'); });
  await page.click('#theme-toggle');
  var afterTwice = await page.$eval('html', function (el) { return el.getAttribute('data-theme'); });
  ok(afterOnce === 'dim' && afterTwice === 'light', 'theme toggle cycles dark -> dim -> light');

  // ---- settings buttons must not corrupt the test duration (regression) ----------
  // Theme/loop buttons share the .duration-pill class for styling; clicking them
  // once set settings.duration = NaN -> empty practice text ("nulls ready").
  await page.goto(INDEX + '?tab=settings', { waitUntil: 'load' });
  await page.click('.theme-option[data-theme-opt="dim"]');
  await page.click('.loop-option[data-loop-min="6"]');
  var durAfterSettings = await page.evaluate(function () { return TT.data.settings.duration; });
  ok(durAfterSettings === 30, 'clicking theme/loop buttons leaves duration intact');
  await page.click('.tab-btn[data-tab="practice"]');
  var textAfterSettings = await page.$eval('#practice-text', function (el) { return el.textContent.length; });
  var timerSub = await page.$eval('#practice-timer-sub', function (el) { return el.textContent; });
  ok(textAfterSettings > 50 && !/null/.test(timerSub), 'practice text intact after visiting settings');

  // A corrupted stored duration (null) heals to 30 on load.
  await page.evaluate(function () {
    var raw = JSON.parse(localStorage.getItem('tt3.data.v1'));
    raw.settings.duration = null;
    localStorage.setItem('tt3.data.v1', JSON.stringify(raw));
  });
  await page.goto(INDEX, { waitUntil: 'load' });
  var healed = await page.evaluate(function () { return TT.data.settings.duration; });
  var healedText = await page.$eval('#practice-text', function (el) { return el.textContent.length; });
  ok(healed === 30 && healedText > 50, 'stored null duration heals to 30 with text generated');

  // ---- light theme sanity ---------------------------------------------------------
  await page.goto(INDEX + '?demo=1&tab=weakspots&theme=light', { waitUntil: 'load' });
  var theme = await page.$eval('html', function (el) { return el.getAttribute('data-theme'); });
  ok(theme === 'light', 'light theme applies');
  ok(await page.$eval('#autopilot', function (el) { return !el.classList.contains('hidden'); }),
    'Autopilot renders in light theme');

  // ---- sprint stall detection: parked pattern ---------------------------------
  await page.goto(INDEX + '?demo=1&tab=practice', { waitUntil: 'load' });
  var topId = await page.evaluate(function () {
    // No sprint history: the kind rotation starts with letters, so park the
    // weakest letter — that is the one the auto-pick would have chosen.
    var top = TT.stats.weakList().active.filter(function (e) { return TT.stats.kindOf(e.id) === 'letter'; })[0].id;
    TT.data.sprintLog = {};
    TT.data.sprintLog[top] = { days: [], parkedUntil: Date.now() + 20 * 3600000, parkedAt: Date.now(), parks: 1 };
    TT.weakspots.invalidate(); // a real park happens in results handling, which invalidates too
    return top;
  });
  await page.click('.mode-pill[data-mode="sprint"]');
  var autoChip = await page.$eval('#target-chips', function (el) { return el.textContent.trim(); });
  ok(autoChip !== topId.slice(2), 'auto sprint skips the parked top pattern (' + topId + ' -> ' + autoChip + ')');
  var noteVisible = await page.$eval('#sprint-note', function (el) {
    return !el.classList.contains('hidden') && /parked/.test(el.textContent);
  });
  ok(noteVisible, 'sidebar note explains the skipped parked pattern');
  var rotationNote = await page.$eval('#sprint-note', function (el) { return /next kind/.test(el.textContent); });
  ok(rotationNote, 'sidebar note explains stick-until-improved and the letter → pair → chunk → word rotation');
  // Kind rotation across sprints: after a logged letter sprint the auto-pick is a pair.
  var afterLetter = await page.evaluate(function (letter) {
    // Log a completed sprint on the (still parked) letter.
    TT.data.sprintLog[letter].days = [{ day: TT.stats.localDayKey(Date.now()), t: Date.now(), att: 30, err: 2, dtSum: 6000, dtN: 28 }];
    TT.practice.startSprint(null);
    var chip = document.getElementById('target-chips').textContent.trim();
    var kind = document.getElementById('target-label').textContent;
    return { chip: chip, kind: kind, note: document.getElementById('sprint-note').textContent };
  }, topId);
  ok(/one pair/.test(afterLetter.kind) && afterLetter.chip.length === 2,
    'after a letter sprint the auto-pick is a pair (' + afterLetter.chip + ')');
  ok(/last letter/.test(afterLetter.note), 'note names the previous kind');
  // Stick-until-improved: a flat sprint day on a pair keeps that pair as the target.
  var sticky = await page.evaluate(function () {
    var pair = TT.stats.weakList().active.filter(function (e) { return TT.stats.kindOf(e.id) === 'pair'; })[1].id;
    TT.data.sprintLog[pair] = { days: [{ day: TT.stats.localDayKey(Date.now()), t: Date.now() + 1000, att: 30, err: 6, dtSum: 6000, dtN: 24 }], parkedUntil: 0, parkedAt: 0, parks: 0 };
    TT.practice.startSprint(null);
    return { chip: document.getElementById('target-chips').textContent.trim(), want: pair.slice(2),
             note: document.getElementById('sprint-note').textContent };
  });
  ok(sticky.chip === sticky.want && /Staying on this pair/.test(sticky.note),
    'a pattern without progress yet stays the sprint target (' + sticky.chip + ')');
  // Whole-word sprint: word chip renders as one cap, isolate text repeats the word.
  var wordSprint = await page.evaluate(function () {
    TT.practice.startSprint('w:the');
    return {
      caps: document.querySelectorAll('#target-chips .keycap.word').length,
      label: document.getElementById('target-label').textContent,
      text: document.getElementById('practice-text').textContent.slice(0, 40)
    };
  });
  ok(wordSprint.caps === 1 && /one word/.test(wordSprint.label), 'word target renders as a single word cap');
  ok(/^(the ?)+/.test(wordSprint.text), 'word sprint isolate stage repeats the word (' + wordSprint.text.trim() + ')');
  await page.click('.tab-btn[data-tab="weakspots"]');
  await page.waitForSelector('#panel-weakspots:not(.hidden)');
  var tags = await page.$$eval('.parked-tag', function (els) { return els.length; });
  ok(tags >= 1, 'Weak Spots marks the parked pattern (' + tags + ' tags)');
  // Manual Drill on the parked pattern still works.
  var drilled = await page.evaluate(function (id) {
    TT.practice.startSprint(id);
    TT.app.showTab('practice');
    return document.getElementById('target-chips').textContent.trim();
  }, topId);
  ok(drilled === topId.slice(2), 'manual Drill still sprints the parked pattern');
  var manualNote = await page.$eval('#sprint-note', function (el) {
    return !el.classList.contains('hidden') && /parked/.test(el.textContent) && /by hand/.test(el.textContent);
  });
  ok(manualNote, 'sidebar note says the parked pattern is being drilled by hand');

  // ---- milestone celebration --------------------------------------------------
  await page.goto(INDEX + '?demo=1&tab=practice&celebrate=100', { waitUntil: 'load' });
  await page.waitForSelector('#badge-modal:not(.hidden)');
  ok(await page.$eval('#badge-modal-card', function (el) {
    return el.classList.contains('celebrate') && el.classList.contains('major');
  }), 'celebration modal opens for a major milestone');
  ok(await page.$('.bm-rays') !== null && await page.$('.bm-crown') !== null, 'rays + crown rendered');
  var early = await page.$eval('#bm-num', function (el) { return parseInt(el.textContent, 10); });
  await page.waitForFunction(function () {
    return document.getElementById('badge-modal-card').classList.contains('landed');
  }, { timeout: 5000 });
  var final = await page.$eval('#bm-num', function (el) { return parseInt(el.textContent, 10); });
  ok(early < 100 && final === 100, 'number counts up and lands on 100 (' + early + ' -> ' + final + ')');
  ok(await page.$('.confetti-canvas.on') !== null, 'confetti canvas is running');
  var visibleAfter = await page.waitForFunction(function () {
    var a = document.querySelector('.bm-actions');
    return a && parseFloat(getComputedStyle(a).opacity) > 0.9;
  }, { timeout: 4000 }).then(function () { return true; }).catch(function () { return false; });
  ok(visibleAfter, 'action buttons fade in after landing');
  await page.click('#bm-close');
  ok(await page.$eval('#badge-modal', function (el) { return el.classList.contains('hidden'); }),
    'View milestones closes the celebration');
  // Goal tier: the burst goal (120) gets its own look everywhere.
  await page.goto(INDEX + '?demo=1&tab=practice&celebrate=120&ctrack=burst', { waitUntil: 'load' });
  await page.waitForSelector('#badge-modal:not(.hidden)');
  ok(await page.$eval('#badge-modal-card', function (el) { return el.classList.contains('goal'); }),
    'goal celebration card has the goal tier');
  var kicker = await page.$eval('.bm-kicker', function (el) { return el.textContent; });
  ok(/your goal/i.test(kicker), 'goal kicker names the goal');
  await page.waitForFunction(function () {
    return document.getElementById('badge-modal-card').classList.contains('landed');
  }, { timeout: 6000 });
  ok(/GOAL REACHED/.test(await page.$eval('.bm-title', function (el) { return el.textContent; })), 'goal title stamps GOAL REACHED');
  await page.keyboard.press('Escape');
  await page.click('.tab-btn[data-tab="milestones"]');
  var goalTags = await page.$$eval('#ms-grid .ms-badge.goal .ms-badge-goal', function (els) { return els.map(function (e) { return e.textContent; }); });
  ok(goalTags.length === 1 && /goal/i.test(goalTags[0]), 'milestone grid marks exactly one goal badge');
  var goalNum = await page.$eval('#ms-grid .ms-badge.goal .ms-badge-num', function (el) { return el.textContent; });
  ok(goalNum === '120', 'burst goal badge is 120');
  ok(await page.$eval('.ms-track[data-track="burst"]', function (el) { return el.classList.contains('active'); }),
    'the celebration left the tab on the track that was earned');
  await page.click('.ms-track[data-track="steady"]');
  var steadyGoal = await page.$eval('#ms-grid .ms-badge.goal .ms-badge-num', function (el) { return el.textContent; });
  ok(steadyGoal === '100', 'sustained goal badge is 100');
  // Settings carries one goal row per track.
  await page.click('.tab-btn[data-tab="settings"]');
  var goalPills = await page.$$eval('.goal-option.active', function (els) {
    return els.map(function (e) { return e.dataset.goalTrack + ':' + e.dataset.goal; });
  });
  ok(goalPills.join(',') === 'steady:100,burst:120', 'goal pills default to 100 sustained / 120 burst');
  await page.click('.goal-option[data-goal-track="burst"][data-goal="140"]');
  ok(await page.evaluate(function () { return TT.data.settings.goalWpm15 === 140 && TT.data.settings.goalWpm === 100; }),
    'changing the burst goal leaves the sustained goal alone');
  await page.click('.goal-option[data-goal-track="burst"][data-goal="120"]');

  // Sound setting pills exist and toggle.
  await page.click('.tab-btn[data-tab="settings"]');
  var soundOn = await page.$eval('.sound-option[data-sound="on"]', function (el) { return el.classList.contains('active'); });
  ok(soundOn, 'celebration sound defaults to On');
  await page.click('.sound-option[data-sound="off"]');
  var soundOff = await page.evaluate(function () { return TT.data.settings.celebrationSound === false; });
  ok(soundOff, 'sound pill turns the setting off');

  // ---- interface time tile ---------------------------------------------------
  await page.goto(INDEX + '?demo=1&tab=dashboard', { waitUntil: 'load' });
  var tileLabels = await page.$$eval('.tiles .tile-label', function (els) { return els.map(function (e) { return e.textContent; }); });
  ok(tileLabels.indexOf('Total practice time') !== -1 && tileLabels.indexOf('Total time in app') !== -1,
    'dashboard shows both practice time and time-in-app tiles');
  var uiTxt = await page.$eval('#tile-ui-time', function (el) { return el.textContent; });
  ok(/\d+(h|m|s)/.test(uiTxt) && uiTxt !== '0s', 'time-in-app tile populated from demo data (' + uiTxt + ')');
  var uiSub = await page.$eval('#tile-ui-time-sub', function (el) { return el.textContent; });
  ok(/this week/.test(uiSub), 'time-in-app weekly sub-line renders');
  var uiBefore = await page.evaluate(function () { return TT.data.totals.uiSeconds; });
  var practiceBefore = await page.evaluate(function () { return TT.data.totals.seconds; });
  await page.evaluate(function () {
    var now = Date.now();
    TT.usage._step(now - 3000, true);
    TT.usage._step(now, true);
  });
  var uiAfter = await page.evaluate(function () { return TT.data.totals.uiSeconds; });
  var practiceAfter = await page.evaluate(function () { return TT.data.totals.seconds; });
  ok(uiAfter === uiBefore + 3, 'live interface seconds accrue');
  ok(practiceAfter === practiceBefore, 'practice total does not move while only browsing');
  var tileLive = await page.$eval('#tile-ui-time', function (el) { return el.textContent; });
  ok(typeof tileLive === 'string' && tileLive.length > 0, 'tile re-renders on credit');
  var hiddenIdle = await page.evaluate(function () {
    return TT.usage.isActive(Date.now() + TT.usage.IDLE_MS + 1);
  });
  ok(hiddenIdle === false, 'no input for the idle window stops counting');

  // ---- Settings: sprint patience ----------------------------------------------
  await page.goto(INDEX + '?tab=settings', { waitUntil: 'load' });
  var stallPills = await page.$$eval('.stall-option', function (els) {
    return { n: els.length, active: els.filter(function (e) { return e.classList.contains('active'); }).map(function (e) { return e.textContent; }) };
  });
  ok(stallPills.n === 4 && stallPills.active.length === 1 && stallPills.active[0] === '12 days', 'sprint patience pills, 12 days by default');
  await page.click('.stall-option[data-stall-days="20"]');
  var stallSet = await page.evaluate(function () { return TT.data.settings.stallDays === 20 && TT.stall.stallDays() === 20; });
  ok(stallSet, 'choosing 20 days is saved and used by the stall rule');
  await page.evaluate(function () { TT.data.settings.stallDays = 12; TT.storage.save(); });

  // ---- Shortcuts tab (learn & review) ----------------------------------------
  await page.goto(INDEX + '?tab=shortcuts', { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('tt3.data.v1'); });
  await page.goto(INDEX + '?tab=shortcuts', { waitUntil: 'load' });
  ok(await page.$eval('#panel-shortcuts', function (el) { return !el.classList.contains('hidden'); }),
    'shortcuts panel opens via ?tab=shortcuts');
  var scTabs = await page.$$eval('#sc-root .sc-tab', function (els) { return els.map(function (e) { return e.textContent.trim(); }); });
  ok(scTabs.length === 7 && scTabs[0].indexOf('Review') === 0 && scTabs[1] === 'Core 20%' &&
      scTabs[3] === 'Terminal' && scTabs[4] === 'Tools',
    'seven sub-tabs (Review, Core 20%, Beyond, Terminal, Tools, Mastered, Progress)');
  // First load imports the habit-tracker progress (shortcuts-seed.js): 8 mastered, 18 learning, 12 due.
  var seeded = await page.evaluate(function () {
    return { flag: !!TT.data.shortcutsSeeded, n: TT.data.shortcuts.windows.length, mac: TT.data.shortcuts.macos.length };
  });
  ok(seeded.flag && seeded.n === 26 && seeded.mac === 0, 'fresh install imports 26 Windows shortcuts of progress from the seed');
  // The seed is a dated snapshot, so how many of its 18 learning shortcuts are due
  // depends on today. Count them the way the app does rather than hard-coding a number
  // that silently rots as the seed's review dates slip into the past.
  var dueExpected = await page.evaluate(function () {
    var today = TT.stats.localDayKey(Date.now());
    return TT.data.shortcuts.windows.filter(function (s) {
      return s.status === 'learning' && (s.reviews === 0 || (s.dueDate && s.dueDate <= today));
    }).length;
  });
  var dueCards = await page.$$eval('#sc-root .sc-card', function (els) { return els.length; });
  ok(dueCards === dueExpected && dueExpected > 0, 'Review shows the ' + dueExpected + ' shortcuts due today (' + dueCards + ')');
  ok(await page.$eval('#sc-nav-due', function (el) { return !el.hidden && el.textContent; }) === String(dueExpected), 'nav tab shows the due count');
  await page.click('#sc-root .sc-tab[data-subtab="core"]');
  var coreRows = await page.$$eval('#sc-root .sc-row', function (els) { return els.length; });
  ok(coreRows === 20, 'Core 20% lists the 20 not-yet-mastered Windows shortcuts (' + coreRows + ')');
  ok(/8<\/b> \/ 28 mastered/.test(await page.$eval('#sc-root .sc-tier-progress', function (el) { return el.innerHTML; })), 'core header reads 8 / 28 mastered');
  var tierHead = await page.$eval('#sc-root .sc-tier-progress', function (el) { return el.textContent; });
  var tierNums = tierHead.match(/[0-9]+/g).map(Number); // mastered, total, learning, to go
  ok(/learning/.test(tierHead) && tierNums[0] + tierNums[2] + tierNums[3] === tierNums[1],
    'core header splits mastered / learning / to go (' + tierHead.trim() + ')');
  ok(tierNums[2] > 0, 'the learning count is shown and non-zero (' + tierNums[2] + ' learning)');
  await page.click('#sc-root .sc-row .sc-learn');
  var learnedId = await page.$eval('#sc-root .sc-row.learning[data-id="alt-f4"]', function (el) { return el.dataset.id; });
  ok(learnedId === 'alt-f4', 'first unlearned core row (Alt+F4) becomes Learning');
  ok(await page.$eval('#sc-nav-due', function (el) { return el.textContent; }) === String(dueExpected + 1), 'due badge grows by one');
  await page.click('#sc-root .sc-tab[data-subtab="review"]');
  ok(await page.$$eval('#sc-root .sc-card', function (els) { return els.length; }) === dueExpected + 1, 'Review shows the newly learned card immediately');
  await page.click('#sc-root .sc-card[data-id="alt-f4"] .sc-got');
  var afterGot = await page.evaluate(function () {
    return TT.data.shortcuts.windows.filter(function (s) { return s.id === 'alt-f4'; })[0];
  });
  ok(afterGot && afterGot.intervalDays === 1 && afterGot.reviews === 1 && afterGot.status === 'learning',
    'Got it climbs to the first rung (1 day) and persists in TT.data.shortcuts');
  ok(await page.$eval('#sc-toast', function (el) { return el.classList.contains('show'); }), 'toast confirms the action');
  await page.evaluate(function () { TT.storage.saveNow(); });
  await page.goto(INDEX + '?tab=shortcuts&scsub=progress', { waitUntil: 'load' });
  var afterReload = await page.evaluate(function () { return TT.data.shortcuts.windows.length; });
  ok(afterReload === 27, 'seed is applied only once (no duplicates after reload)');
  var stats = await page.$$eval('#sc-root .sc-stat-num', function (els) { return els.map(function (e) { return e.textContent; }); });
  ok(stats[0] === '8/28' && stats[4] === '19' && stats[5] === '8', 'Progress shows 8/28 core, 19 learning, 8 reviews after reload (' + stats.join(' ') + ')');
  var statLabels = await page.$$eval('#sc-root .sc-stat-label', function (els) { return els.map(function (e) { return e.textContent; }); });
  ok(statLabels[4] === 'learning now', 'Progress labels the learning tile plainly (' + statLabels[4] + ')');
  var badgeCount = await page.$$eval('#sc-root .sc-badge', function (els) { return els.length; });
  var earned = await page.$$eval('#sc-root .sc-badge.earned .sc-badge-name', function (els) { return els.map(function (e) { return e.textContent; }); });
  ok(badgeCount === 19 && earned.join(',') === 'First Steps,Editor', 'badge shelves: 11 shortcut + 3 terminal + 5 tool badges, First Steps + Editor earned (' + earned.join(',') + ')');
  ok(stats.length === 6 && statLabels[2] === 'commands mastered' && /^0\/\d+$/.test(stats[2]), 'Progress has a commands-mastered tile at 0 (' + stats[2] + ')');
  ok(statLabels[3] === 'tool shortcuts' && /^0\/\d+$/.test(stats[3]), 'Progress has a tool-shortcuts tile at 0 (' + stats[3] + ')');

  // ---- Terminal sub-tab (Linux commands, shared across platforms) ----------------
  await page.click('#sc-root .sc-tab[data-subtab="terminal"]');
  var termTotal = await page.evaluate(function () { return TT.terminalData.COMMANDS.length; });
  var termEss = await page.evaluate(function () { return TT.terminalData.COMMANDS.filter(function (c) { return c.level === 'essential'; }).length; });
  var termRows = await page.$$eval('#sc-root .sc-row.sh-row', function (els) { return els.length; });
  ok(termRows === termEss && termTotal > 80 && termEss < termTotal, 'Terminal opens on Essentials only (' + termRows + ' of ' + termTotal + ')');
  var levelNames = await page.$$eval('#sc-root .sh-level', function (els) { return els.map(function (e) { return (e.classList.contains('active') ? '*' : '') + e.querySelector('.sh-level-name').textContent; }); });
  ok(levelNames.join(',') === '*Essentials,More', 'level switch shows Essentials (active) and More side by side');
  await page.click('#sc-root .sh-level[data-level="more"]');
  var moreRows = await page.$$eval('#sc-root .sc-row.sh-row', function (els) { return els.length; });
  ok(moreRows === termTotal - termEss, 'switching to More lists only the More commands (' + moreRows + ')');
  ok(await page.$$eval('#sc-root .sh-level-title', function (els) { return els.length; }) === 0, 'levels are never stacked one under the other');
  await page.click('#sc-root .sh-level[data-level="essential"]');
  ok(await page.$eval('#sc-root .sc-plat-static', function (el) { return /Linux/.test(el.textContent); }), 'platform toggle is replaced by a shared Linux label');
  var firstCmd = await page.$eval('#sc-root .sc-row.sh-row .sh-cmd', function (el) { return el.textContent; });
  ok(firstCmd === '$pwd', 'first row is the pwd command chip (' + firstCmd + ')');
  var phRow = await page.$eval('#sc-root .sc-row[data-id="sh-cd"] .sh-cmd', function (el) { return el.innerHTML; });
  ok(/<em class="sh-ph">dir<\/em>/.test(phRow) && !/[{}]/.test(phRow), 'placeholders render italic without braces');
  var dueBefore = await page.evaluate(function () { return TT.shortcuts.dueCount(); });
  await page.click('#sc-root .sc-row[data-id="sh-grep-r"] .sc-learn');
  ok(await page.$('#sc-root .sc-row.learning[data-id="sh-grep-r"]') !== null, '+ Learn on a command marks it Learning');
  ok(await page.evaluate(function () { return TT.shortcuts.dueCount(); }) === dueBefore + 1, 'a learned command counts toward the due badge');
  ok(await page.evaluate(function () {
    return TT.data.shortcuts.terminal.length === 1 && TT.data.shortcuts.terminal[0].id === 'sh-grep-r';
  }), 'command progress persists in TT.data.shortcuts.terminal');
  await page.click('#sc-root .sc-tab[data-subtab="review"]');
  ok(await page.$('#sc-root .sc-card.sh-card[data-id="sh-grep-r"] .sh-try') !== null, 'Review shows the command card with a type-it box');
  ok(await page.$eval('#sc-root .sc-card[data-id="sh-grep-r"] .sh-example code', function (el) { return el.textContent; }) === '$ grep -rn TODO src/',
    'the card shows the example line');
  await page.type('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', 'grep -rn fixme lib/');
  await page.keyboard.press('Enter');
  ok(await page.$eval('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', function (el) { return el.classList.contains('ok'); }),
    'typing the command with your own arguments is accepted');
  await page.$eval('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', function (el) { el.value = ''; });
  await page.type('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', 'grep TODO src/');
  await page.keyboard.press('Enter');
  ok(await page.$eval('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', function (el) { return el.classList.contains('bad'); }),
    'a wrong line is marked not quite');
  await page.$eval('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', function (el) { el.value = ''; });
  await page.type('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', 'grep -rn TODO src/ extra junk');
  await page.keyboard.press('Enter');
  ok(await page.$eval('#sc-root .sc-card[data-id="sh-grep-r"] .sh-try', function (el) { return el.classList.contains('bad'); }),
    'extra words are not swallowed by a placeholder');
  ok(await page.$eval('#panel-shortcuts', function (el) { return !el.classList.contains('hidden'); }), 'typing in the box does not trigger tab shortcuts');
  var typedChecks = await page.evaluate(function () {
    var c = TT.shortcuts.checkTyped;
    var pipe = { cmd: '{cmd1} | {cmd2}', example: 'ls | wc -l' };
    var sed = { cmd: "sed 's/{old}/{new}/g' {file}", example: "sed 's/colour/color/g' notes.txt" };
    return c({ cmd: 'pwd' }, ' pwd ') && !c({ cmd: 'pwd' }, 'pwdd') &&
      c(pipe, 'ps aux | grep node') && c(pipe, 'ls | wc -l') &&
      c(sed, "sed 's/a/b/g' x.txt") && !c(sed, 'sed x.txt') &&
      c({ cmd: 'cd ..' }, 'cd ..') && !c({ cmd: 'cd ..' }, 'cd .') &&
      c({ cmd: 'kill {pid}' }, 'kill 1234') && !c({ cmd: 'kill {pid}' }, 'kill 12 34') &&
      c({ cmd: 'ssh {user}@{host}' }, 'ssh pi@192.168.1.20') && !c({ cmd: 'ssh {user}@{host}' }, 'ssh pi');
  });
  ok(typedChecks, 'checkTyped: placeholders accept any text, literals must match, regex chars are escaped');
  await page.click('#sc-root .sc-card[data-id="sh-grep-r"] .sc-retire');
  await page.click('#sc-root .sc-tab[data-subtab="mastered"]');
  ok(await page.$('#sc-root .sc-row.retired.sh-row[data-id="sh-grep-r"]') !== null, 'a retired command lands in Mastered under Terminal');
  await page.evaluate(function () { TT.storage.saveNow(); });
  await page.goto(INDEX + '?tab=shortcuts&scsub=terminal', { waitUntil: 'load' });
  ok(await page.$('#sc-root .sc-row[data-id="sh-grep-r"]') === null, 'a mastered command leaves the Terminal to-learn list after reload');
  ok(/1<\/b> \/ \d+ mastered/.test(await page.$eval('#sc-root .sc-tier-progress', function (el) { return el.innerHTML; })), 'terminal header counts the mastered command');
  await page.click('#sc-root .sc-tab[data-subtab="mastered"]');
  ok(await page.$$eval('#sc-root .sc-row.retired', function (els) { return els.length; }) === 9, 'Mastered lists the 8 retired shortcuts + 1 command');
  await page.click('#sc-root .sc-plat[data-platform="macos"]');
  await page.click('#sc-root .sc-tab[data-subtab="mastered"]');
  ok(await page.$$eval('#sc-root .sc-row.retired', function (els) { return els.length; }) === 1, 'terminal progress is shared: the command stays mastered on macOS');
  await page.click('#sc-root .sc-tab[data-subtab="core"]');
  var macLearning = await page.$$eval('#sc-root .sc-row.learning', function (els) { return els.length; });
  var macKey = await page.$eval('#sc-root .sc-row kbd', function (el) { return el.textContent; });
  ok(macLearning === 0 && macKey === 'Cmd', 'macOS catalog is separate (Cmd keycaps, nothing learning)');
  ok(await page.evaluate(function () { return TT.data.shortcuts.platform === 'macos'; }), 'platform choice persists');

  // ---- Tools sub-tab (per-app shortcuts, shared across platforms) ----------------
  await page.click('#sc-root .sc-tab[data-subtab="tools"]');
  var toolBtns = await page.$$eval('#sc-root .sc-tool', function (els) {
    return els.map(function (e) { return e.querySelector('.sc-tool-name').textContent; });
  });
  ok(toolBtns.length === 2 && toolBtns[0] === 'VS Code' && toolBtns[1] === 'Claude Code',
    'Tools offers a picker: VS Code and Claude Code (' + toolBtns.join(', ') + ')');
  var vsEss = await page.evaluate(function () {
    return TT.toolsData.SHORTCUTS.filter(function (s) { return s.tool === 'vscode' && s.level === 'essential'; }).length;
  });
  var vsRows = await page.$$eval('#sc-root .sc-row', function (els) { return els.length; });
  ok(vsRows === vsEss && vsEss > 0, 'Tools opens on VS Code essentials (' + vsRows + ' of ' + vsEss + ')');
  ok(await page.$eval('#sc-root .sc-row[data-id="vs-goto-file"] kbd', function (el) { return el.textContent; }) === 'Cmd',
    'on macOS a VS Code shortcut shows Cmd, not Ctrl');
  // A two-step chord must be ONE element, or it would eat a column of the row grid.
  await page.click('#sc-root .sh-level[data-level="more"][data-level-scope="tools"]');
  var chord = await page.$eval('#sc-root .sc-row[data-id="vs-zen"]', function (el) {
    return {
      chords: el.querySelectorAll(':scope > .key-chord').length,
      caps: el.querySelectorAll('.key-chord > .keycaps').length,
      then: el.querySelector('.key-then') ? el.querySelector('.key-then').textContent : ''
    };
  });
  ok(chord.chords === 1 && chord.caps === 2 && chord.then === 'then',
    'a two-step chord (Ctrl+K then Z) is one row element holding two keycap groups');
  await page.click('#sc-root .sh-level[data-level="essential"][data-level-scope="tools"]');
  // Switch tools: the list, the filters and the header all follow the picker.
  await page.click('#sc-root .sc-tool[data-tool="claude"]');
  var ccEss = await page.evaluate(function () {
    return TT.toolsData.SHORTCUTS.filter(function (s) { return s.tool === 'claude' && s.level === 'essential'; }).length;
  });
  var ccRows = await page.$$eval('#sc-root .sc-row', function (els) { return els.length; });
  ok(ccRows === ccEss && ccRows !== vsRows, 'picking Claude Code swaps the list (' + ccRows + ' of ' + ccEss + ')');
  ok(/Claude Code/.test(await page.$eval('#sc-root .sc-tier-title', function (el) { return el.textContent; })),
    'the header names the tool in view');
  // A slash command renders as a typed chip, not keycaps.
  ok(await page.$eval('#sc-root .sc-row[data-id="cc-clear"] .sh-cmd .sh-prompt', function (el) { return el.textContent; }) === '>',
    'a Claude slash command renders with a > prompt');
  var dueBeforeTool = await page.evaluate(function () { return TT.shortcuts.dueCount(); });
  await page.click('#sc-root .sc-row[data-id="cc-ctrl-u"] .sc-learn');
  ok(await page.evaluate(function () { return TT.shortcuts.dueCount(); }) === dueBeforeTool + 1,
    'a learned tool shortcut counts toward the due badge');
  ok(await page.evaluate(function () {
    return TT.data.shortcuts.tools.length === 1 && TT.data.shortcuts.tools[0].id === 'cc-ctrl-u';
  }), 'tool progress persists in TT.data.shortcuts.tools');
  // Shared across platforms: switching back to Windows keeps it, and swaps the keys shown.
  await page.click('#sc-root .sc-plat[data-platform="windows"]');
  await page.click('#sc-root .sc-tab[data-subtab="tools"]');
  ok(await page.$('#sc-root .sc-row.learning[data-id="cc-ctrl-u"]') !== null,
    'tool progress is shared: the shortcut stays learning on Windows');
  ok(await page.$eval('#sc-root .sc-tool[data-tool="vscode"]', function (el) { return true; }) &&
     await page.$eval('#sc-root .sc-row[data-id="cc-ctrl-u"] kbd', function (el) { return el.textContent; }) === 'Ctrl',
    'the same entry shows Ctrl on Windows');
  // Alt+6 reaches the Settings tab now that there are six tabs.
  await page.keyboard.down('Alt'); await page.keyboard.press('6'); await page.keyboard.up('Alt');
  ok(await page.$eval('#panel-settings', function (el) { return !el.classList.contains('hidden'); }), 'Alt+6 opens Settings');
  await page.keyboard.down('Alt'); await page.keyboard.press('5'); await page.keyboard.up('Alt');
  ok(await page.$eval('#panel-shortcuts', function (el) { return !el.classList.contains('hidden'); }), 'Alt+5 opens Shortcuts');
  await page.evaluate(function () { localStorage.removeItem('tt3.data.v1'); });

  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});

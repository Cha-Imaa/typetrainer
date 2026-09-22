// Settings tab: theme, defaults, export/import/reset.
(function () {
  'use strict';
  window.TT = window.TT || {};

  function q(id) { return document.getElementById(id); }

  function init() {
    // Theme radio group
    document.querySelectorAll('.theme-option').forEach(function (b) {
      b.addEventListener('click', function () {
        TT.data.settings.theme = b.dataset.themeOpt;
        TT.storage.save();
        TT.app.applyTheme();
        render();
      });
    });

    // Daily loop length
    document.querySelectorAll('.loop-option').forEach(function (b) {
      b.addEventListener('click', function () {
        TT.data.settings.loopMinutes = parseInt(b.dataset.loopMin, 10);
        TT.storage.save();
        render();
        // A queued (not yet started) daily loop should pick up the new length.
        if (!TT.practice.isRunning()) TT.practice.newTest();
      });
    });

    // Sprint patience: flat sprint days before the auto-sprint moves on
    document.querySelectorAll('.stall-option').forEach(function (b) {
      b.addEventListener('click', function () {
        TT.data.settings.stallDays = parseInt(b.dataset.stallDays, 10);
        TT.storage.save();
        render();
        if (TT.practice && !TT.practice.isRunning()) TT.practice.newTest();
      });
    });

    // Goal speed — one per badge track (the badge that gets the goal tier)
    document.querySelectorAll('.goal-option').forEach(function (b) {
      b.addEventListener('click', function () {
        var setting = TT.badges.track(b.dataset.goalTrack).goalSetting;
        TT.data.settings[setting] = parseInt(b.dataset.goal, 10);
        TT.storage.save();
        render();
        if (TT.milestones) { TT.milestones.invalidate(); }
      });
    });

    // Milestone celebration sound
    document.querySelectorAll('.sound-option').forEach(function (b) {
      b.addEventListener('click', function () {
        TT.data.settings.celebrationSound = b.dataset.sound === 'on';
        TT.storage.save();
        render();
        if (TT.data.settings.celebrationSound && TT.celebrate) TT.celebrate.chime(false); // preview
      });
    });

    q('btn-export').addEventListener('click', function () {
      TT.storage.exportData();
      flash('Backup exported. Move the file into this app’s folder to keep it in OneDrive.');
    });

    q('import-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      TT.storage.importData(file, function (err) {
        if (err) {
          flash('Import failed: ' + err.message, true);
        } else {
          flash('Backup imported successfully.');
          location.reload();
        }
      });
      e.target.value = '';
    });

    var resetArmed = false;
    var resetBtn = q('btn-reset');
    resetBtn.addEventListener('click', function () {
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = 'Click again to permanently erase all data';
        resetBtn.classList.add('armed');
        setTimeout(function () {
          resetArmed = false;
          resetBtn.textContent = 'Reset all data';
          resetBtn.classList.remove('armed');
        }, 4000);
      } else {
        TT.storage.resetAll();
        location.reload();
      }
    });

    render();
  }

  function flash(msg, isError) {
    var el = q('settings-flash');
    el.textContent = msg;
    el.className = 'settings-flash ' + (isError ? 'bad' : 'good');
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 5000);
  }

  function render() {
    var s = TT.data.settings;
    document.querySelectorAll('.theme-option').forEach(function (b) {
      b.classList.toggle('active', b.dataset.themeOpt === s.theme);
    });
    document.querySelectorAll('.loop-option').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.loopMin, 10) === (s.loopMinutes || 8));
    });
    var stallDays = TT.stall ? TT.stall.stallDays() : 12;
    document.querySelectorAll('.stall-option').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.stallDays, 10) === stallDays);
    });
    document.querySelectorAll('.sound-option').forEach(function (b) {
      b.classList.toggle('active', (b.dataset.sound === 'on') === (s.celebrationSound !== false));
    });
    document.querySelectorAll('.goal-option').forEach(function (b) {
      var goal = TT.badges ? TT.badges.goalWpm(b.dataset.goalTrack) : 100;
      b.classList.toggle('active', parseInt(b.dataset.goal, 10) === goal);
    });
    var kb = Math.round((localStorage.getItem('tt3.data.v1') || '').length / 1024);
    q('storage-size').textContent = kb + ' KB used locally';
  }

  TT.settings = { init: init, render: render };
})();

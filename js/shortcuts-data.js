// Curated shortcut catalogs (Windows + macOS) + badge/group definitions.
// The catalog is the source of truth for keys/action/category/tier; the
// user's learning state (status, intervals, due dates) lives in
// TT.data.shortcuts — kept per platform, never mixed — and is merged over
// this at render time. Same catalog as the habit tracker's Shortcuts section.
(function () {
  'use strict';
  window.TT = window.TT || {};


  var CATEGORIES = [
    { id: 'navigate', label: 'Navigate' },
    { id: 'openclose', label: 'Open & Close' },
    { id: 'editing', label: 'Editing' },
    { id: 'text', label: 'Text' },
    { id: 'windows', label: 'Windows' },
    { id: 'browser', label: 'Browser' },
    { id: 'files', label: 'Files' },
    { id: 'system', label: 'System' },
    { id: 'utilities', label: 'Utilities' },
  ];

  function categoryLabel(id) {
    return CATEGORIES.find((c) => c.id === id)?.label ?? id;
  }

  // keys: each entry is one keycap ("← →" renders as a single cap meaning either arrow)
  const core = (id, keys, action, category) => ({ id, keys, action, category, tier: 'core' });
  const beyond = (id, keys, action, category) => ({ id, keys, action, category, tier: 'beyond' });

  // ============================================================ WINDOWS
  const WINDOWS = [
    // ---------- CORE 20% ----------
    // Navigate
    core('alt-tab', ['Alt', 'Tab'], 'Switch between open apps', 'navigate'),
    core('tab', ['Tab'], 'Jump to the next field or button', 'navigate'),
    core('shift-tab', ['Shift', 'Tab'], 'Jump to the previous field or button', 'navigate'),
    core('esc', ['Esc'], 'Cancel / close a dialog or menu', 'navigate'),
    // Open & Close
    core('win-search', ['Win'], 'Open Start — just type to search anything', 'openclose'),
    core('win-e', ['Win', 'E'], 'Open File Explorer', 'openclose'),
    core('ctrl-w', ['Ctrl', 'W'], 'Close the current tab or window', 'openclose'),
    core('alt-f4', ['Alt', 'F4'], 'Close the current application', 'openclose'),
    // Editing
    core('ctrl-c', ['Ctrl', 'C'], 'Copy', 'editing'),
    core('ctrl-v', ['Ctrl', 'V'], 'Paste', 'editing'),
    core('ctrl-x', ['Ctrl', 'X'], 'Cut', 'editing'),
    core('ctrl-z', ['Ctrl', 'Z'], 'Undo', 'editing'),
    core('ctrl-a', ['Ctrl', 'A'], 'Select all', 'editing'),
    core('ctrl-f', ['Ctrl', 'F'], 'Find on the page / in the document', 'editing'),
    core('ctrl-s', ['Ctrl', 'S'], 'Save', 'editing'),
    // Text
    core('ctrl-arrows', ['Ctrl', '← →'], 'Move the cursor one word at a time', 'text'),
    core('ctrl-shift-arrows', ['Ctrl', 'Shift', '← →'], 'Select one word at a time', 'text'),
    core('ctrl-backspace', ['Ctrl', 'Backspace'], 'Delete the previous word', 'text'),
    core('home-end', ['Home', 'End'], 'Jump to the start / end of the line', 'text'),
    // Windows
    core('win-left', ['Win', '←'], 'Snap the window to the left half', 'windows'),
    core('win-right', ['Win', '→'], 'Snap the window to the right half', 'windows'),
    core('win-up', ['Win', '↑'], 'Maximize the window', 'windows'),
    core('win-down', ['Win', '↓'], 'Minimize / restore the window', 'windows'),
    // Browser
    core('ctrl-l', ['Ctrl', 'L'], 'Jump to the address / search bar', 'browser'),
    core('ctrl-t', ['Ctrl', 'T'], 'Open a new tab', 'browser'),
    core('ctrl-shift-t', ['Ctrl', 'Shift', 'T'], 'Reopen the last closed tab', 'browser'),
    // Utilities
    core('win-shift-s', ['Win', 'Shift', 'S'], 'Screenshot a selected area', 'utilities'),
    core('win-v', ['Win', 'V'], 'Open clipboard history', 'utilities'),

    // ---------- BEYOND — the other 80% ----------
    // Navigate
    beyond('win-tab', ['Win', 'Tab'], 'Task view — all windows & desktops', 'navigate'),
    beyond('ctrl-tab', ['Ctrl', 'Tab'], 'Next tab inside an app', 'navigate'),
    beyond('ctrl-shift-tab', ['Ctrl', 'Shift', 'Tab'], 'Previous tab inside an app', 'navigate'),
    beyond('alt-space', ['Alt', 'Space'], 'Window menu (move, size, close)', 'navigate'),
    beyond('win-number', ['Win', '1…9'], 'Open the nth app pinned to the taskbar', 'navigate'),
    beyond('win-t', ['Win', 'T'], 'Cycle through taskbar apps', 'navigate'),
    beyond('shift-f10', ['Shift', 'F10'], 'Right-click menu for the selected item', 'navigate'),
    // Open & Close
    beyond('win-r', ['Win', 'R'], 'Run dialog — launch anything by name', 'openclose'),
    beyond('win-s', ['Win', 'S'], 'Open Windows search directly', 'openclose'),
    // Editing / Text
    beyond('ctrl-y', ['Ctrl', 'Y'], 'Redo', 'editing'),
    beyond('ctrl-shift-v', ['Ctrl', 'Shift', 'V'], 'Paste without formatting (plain text)', 'editing'),
    beyond('ctrl-b', ['Ctrl', 'B'], 'Bold the selected text', 'editing'),
    beyond('ctrl-i', ['Ctrl', 'I'], 'Italicize the selected text', 'editing'),
    beyond('ctrl-u', ['Ctrl', 'U'], 'Underline the selected text', 'editing'),
    beyond('ctrl-p', ['Ctrl', 'P'], 'Print', 'editing'),
    beyond('ctrl-home-end', ['Ctrl', 'Home', 'End'], 'Jump to the start / end of the document', 'text'),
    beyond('shift-home-end', ['Shift', 'Home', 'End'], 'Select to the start / end of the line', 'text'),
    beyond('ctrl-delete', ['Ctrl', 'Delete'], 'Delete the next word', 'text'),
    beyond('shift-arrows', ['Shift', '← →'], 'Select one character at a time', 'text'),
    // Windows & desktops
    beyond('win-d', ['Win', 'D'], 'Show the desktop (press again to restore)', 'windows'),
    beyond('win-m', ['Win', 'M'], 'Minimize all windows', 'windows'),
    beyond('win-home', ['Win', 'Home'], 'Minimize everything except the active window', 'windows'),
    beyond('win-shift-arrows', ['Win', 'Shift', '← →'], 'Move the window to another monitor', 'windows'),
    beyond('win-z', ['Win', 'Z'], 'Open snap layouts for the window', 'windows'),
    beyond('win-ctrl-d', ['Win', 'Ctrl', 'D'], 'Create a new virtual desktop', 'windows'),
    beyond('win-ctrl-arrows', ['Win', 'Ctrl', '← →'], 'Switch between virtual desktops', 'windows'),
    beyond('win-ctrl-f4', ['Win', 'Ctrl', 'F4'], 'Close the current virtual desktop', 'windows'),
    // Browser
    beyond('ctrl-r', ['Ctrl', 'R'], 'Reload the page', 'browser'),
    beyond('ctrl-shift-r', ['Ctrl', 'Shift', 'R'], 'Hard reload (skip the cache)', 'browser'),
    beyond('ctrl-n', ['Ctrl', 'N'], 'Open a new browser window', 'browser'),
    beyond('ctrl-d', ['Ctrl', 'D'], 'Bookmark the current page', 'browser'),
    beyond('ctrl-h', ['Ctrl', 'H'], 'Open browser history', 'browser'),
    beyond('ctrl-j', ['Ctrl', 'J'], 'Open downloads', 'browser'),
    beyond('ctrl-tabnum', ['Ctrl', '1…8'], 'Jump to the nth tab (9 = last tab)', 'browser'),
    beyond('ctrl-pgupdn', ['Ctrl', 'PgUp PgDn'], 'Cycle through tabs in order', 'browser'),
    beyond('alt-arrows', ['Alt', '← →'], 'Go back / forward a page', 'browser'),
    beyond('ctrl-zoom', ['Ctrl', '+ −'], 'Zoom in / out (0 resets)', 'browser'),
    beyond('ctrl-enter', ['Ctrl', 'Enter'], 'Add www. and .com around what you typed', 'browser'),
    beyond('ctrl-shift-b', ['Ctrl', 'Shift', 'B'], 'Show / hide the bookmarks bar', 'browser'),
    beyond('ctrl-shift-n', ['Ctrl', 'Shift', 'N'], 'Open a private / incognito window', 'browser'),
    beyond('f11', ['F11'], 'Toggle full screen', 'browser'),
    // Files (Explorer)
    beyond('alt-up', ['Alt', '↑'], 'Go up one folder', 'files'),
    beyond('alt-back', ['Alt', '←'], 'Back to the previous folder', 'files'),
    beyond('alt-d', ['Alt', 'D'], 'Jump to the Explorer address bar', 'files'),
    beyond('f2', ['F2'], 'Rename the selected file', 'files'),
    beyond('ctrl-shift-nfolder', ['Ctrl', 'Shift', 'N'], 'New folder in Explorer', 'files'),
    beyond('shift-delete', ['Shift', 'Delete'], 'Delete permanently (skips the Recycle Bin)', 'files'),
    beyond('alt-enter', ['Alt', 'Enter'], 'Properties of the selected file', 'files'),
    // System
    beyond('ctrl-shift-esc', ['Ctrl', 'Shift', 'Esc'], 'Open Task Manager directly', 'system'),
    beyond('win-l', ['Win', 'L'], 'Lock the computer', 'system'),
    beyond('win-i', ['Win', 'I'], 'Open Settings', 'system'),
    beyond('win-x', ['Win', 'X'], 'Power-user menu (device manager, terminal…)', 'system'),
    beyond('win-a', ['Win', 'A'], 'Quick settings (wifi, volume, brightness)', 'system'),
    beyond('win-n', ['Win', 'N'], 'Notification center & calendar', 'system'),
    beyond('win-p', ['Win', 'P'], 'Project to a second screen', 'system'),
    beyond('win-space', ['Win', 'Space'], 'Switch keyboard language / layout', 'system'),
    beyond('win-h', ['Win', 'H'], 'Voice typing — dictate instead of typing', 'system'),
    // Utilities
    beyond('win-dot', ['Win', '.'], 'Emoji & symbol picker', 'utilities'),
    beyond('win-k', ['Win', 'K'], 'Connect to wireless displays & audio', 'utilities'),
    beyond('prtscn', ['PrtScn'], 'Screenshot the whole screen to the clipboard', 'utilities'),
    beyond('alt-prtscn', ['Alt', 'PrtScn'], 'Screenshot only the active window', 'utilities'),
    beyond('win-alt-r', ['Win', 'Alt', 'R'], 'Record the screen (Game Bar)', 'utilities'),
    beyond('win-plus', ['Win', '+ −'], 'Magnifier — zoom the whole screen', 'utilities'),
  ];

  // ============================================================ MACOS
  const MACOS = [
    // ---------- CORE 20% ----------
    // Navigate
    core('cmd-tab', ['Cmd', 'Tab'], 'Switch between open apps', 'navigate'),
    core('mac-tab', ['Tab'], 'Jump to the next field or button', 'navigate'),
    core('mac-shift-tab', ['Shift', 'Tab'], 'Jump to the previous field or button', 'navigate'),
    core('mac-esc', ['Esc'], 'Cancel / close a dialog or menu', 'navigate'),
    // Open & Close
    core('cmd-space', ['Cmd', 'Space'], 'Spotlight — open or find anything by typing', 'openclose'),
    core('cmd-n', ['Cmd', 'N'], 'New window (Finder, browser, most apps)', 'openclose'),
    core('cmd-w', ['Cmd', 'W'], 'Close the current tab or window', 'openclose'),
    core('cmd-q', ['Cmd', 'Q'], 'Quit the current application', 'openclose'),
    // Editing
    core('cmd-c', ['Cmd', 'C'], 'Copy', 'editing'),
    core('cmd-v', ['Cmd', 'V'], 'Paste', 'editing'),
    core('cmd-x', ['Cmd', 'X'], 'Cut', 'editing'),
    core('cmd-z', ['Cmd', 'Z'], 'Undo', 'editing'),
    core('cmd-a', ['Cmd', 'A'], 'Select all', 'editing'),
    core('cmd-f', ['Cmd', 'F'], 'Find on the page / in the document', 'editing'),
    core('cmd-s', ['Cmd', 'S'], 'Save', 'editing'),
    // Text
    core('option-arrows', ['Option', '← →'], 'Move the cursor one word at a time', 'text'),
    core('option-shift-arrows', ['Option', 'Shift', '← →'], 'Select one word at a time', 'text'),
    core('option-delete', ['Option', 'Delete'], 'Delete the previous word', 'text'),
    core('cmd-line-arrows', ['Cmd', '← →'], 'Jump to the start / end of the line', 'text'),
    // Windows
    core('cmd-m', ['Cmd', 'M'], 'Minimize the window to the Dock', 'windows'),
    core('cmd-h', ['Cmd', 'H'], 'Hide the current app', 'windows'),
    core('ctrl-cmd-f', ['Ctrl', 'Cmd', 'F'], 'Toggle full screen', 'windows'),
    core('ctrl-up', ['Ctrl', '↑'], 'Mission Control — see every open window', 'windows'),
    // Browser
    core('cmd-l', ['Cmd', 'L'], 'Jump to the address / search bar', 'browser'),
    core('cmd-t', ['Cmd', 'T'], 'Open a new tab', 'browser'),
    core('cmd-shift-t', ['Cmd', 'Shift', 'T'], 'Reopen the last closed tab', 'browser'),
    // Utilities
    core('cmd-shift-4', ['Cmd', 'Shift', '4'], 'Screenshot a selected area', 'utilities'),
    core('ctrl-cmd-space', ['Ctrl', 'Cmd', 'Space'], 'Emoji & symbol picker', 'utilities'),

    // ---------- BEYOND — the other 80% ----------
    // Navigate
    beyond('cmd-backtick', ['Cmd', '`'], 'Switch between windows of the same app', 'navigate'),
    beyond('mac-ctrl-tab', ['Ctrl', 'Tab'], 'Next tab inside an app', 'navigate'),
    beyond('mac-ctrl-shift-tab', ['Ctrl', 'Shift', 'Tab'], 'Previous tab inside an app', 'navigate'),
    beyond('cmd-option-esc', ['Cmd', 'Option', 'Esc'], 'Force-quit an app', 'navigate'),
    beyond('ctrl-side-arrows', ['Ctrl', '← →'], 'Switch between desktops (Spaces)', 'navigate'),
    beyond('ctrl-down', ['Ctrl', '↓'], 'All windows of the current app', 'navigate'),
    beyond('cmd-comma', ['Cmd', ','], 'Open the current app’s settings', 'navigate'),
    // Editing / Text
    beyond('cmd-shift-z', ['Cmd', 'Shift', 'Z'], 'Redo', 'editing'),
    beyond('cmd-b', ['Cmd', 'B'], 'Bold the selected text', 'editing'),
    beyond('cmd-i', ['Cmd', 'I'], 'Italicize the selected text', 'editing'),
    beyond('cmd-u', ['Cmd', 'U'], 'Underline the selected text', 'editing'),
    beyond('cmd-p', ['Cmd', 'P'], 'Print', 'editing'),
    beyond('cmd-opt-shift-v', ['Cmd', 'Option', 'Shift', 'V'], 'Paste without formatting (match style)', 'editing'),
    beyond('cmd-updown', ['Cmd', '↑ ↓'], 'Jump to the start / end of the document', 'text'),
    beyond('cmd-shift-line', ['Cmd', 'Shift', '← →'], 'Select to the start / end of the line', 'text'),
    beyond('fn-delete', ['Fn', 'Delete'], 'Delete forward (the character after the cursor)', 'text'),
    beyond('mac-shift-arrows', ['Shift', '← →'], 'Select one character at a time', 'text'),
    // Windows & desktops
    beyond('ctrl-cmd-q', ['Ctrl', 'Cmd', 'Q'], 'Lock the Mac', 'windows'),
    beyond('cmd-option-m', ['Cmd', 'Option', 'M'], 'Minimize all windows of the app', 'windows'),
    beyond('cmd-option-h', ['Cmd', 'Option', 'H'], 'Hide every other app', 'windows'),
    beyond('cmd-option-d', ['Cmd', 'Option', 'D'], 'Show / hide the Dock', 'windows'),
    beyond('cmd-option-w', ['Cmd', 'Option', 'W'], 'Close all windows of the app', 'windows'),
    // Browser
    beyond('cmd-r', ['Cmd', 'R'], 'Reload the page', 'browser'),
    beyond('cmd-shift-r', ['Cmd', 'Shift', 'R'], 'Hard reload (skip the cache)', 'browser'),
    beyond('cmd-d-bookmark', ['Cmd', 'D'], 'Bookmark the current page', 'browser'),
    beyond('cmd-y', ['Cmd', 'Y'], 'Open browser history', 'browser'),
    beyond('cmd-shift-j', ['Cmd', 'Shift', 'J'], 'Open downloads', 'browser'),
    beyond('cmd-tabnum', ['Cmd', '1…8'], 'Jump to the nth tab (9 = last tab)', 'browser'),
    beyond('cmd-option-tabarrows', ['Cmd', 'Option', '← →'], 'Cycle through tabs in order', 'browser'),
    beyond('cmd-zoom', ['Cmd', '+ −'], 'Zoom in / out (0 resets)', 'browser'),
    beyond('cmd-shift-n-priv', ['Cmd', 'Shift', 'N'], 'Open a private / incognito window', 'browser'),
    beyond('cmd-brackets', ['Cmd', '[ ]'], 'Go back / forward a page', 'browser'),
    // Files (Finder)
    beyond('space-quicklook', ['Space'], 'Quick Look — preview the selected file', 'files'),
    beyond('enter-rename', ['Enter'], 'Rename the selected file', 'files'),
    beyond('cmd-delete', ['Cmd', 'Delete'], 'Move the selected file to the Trash', 'files'),
    beyond('cmd-shift-delete', ['Cmd', 'Shift', 'Delete'], 'Empty the Trash', 'files'),
    beyond('cmd-shift-nfolder', ['Cmd', 'Shift', 'N'], 'New folder in Finder', 'files'),
    beyond('cmd-up', ['Cmd', '↑'], 'Go up one folder', 'files'),
    beyond('cmd-down', ['Cmd', '↓'], 'Open the selected file or folder', 'files'),
    beyond('cmd-i-info', ['Cmd', 'I'], 'Get Info on the selected file', 'files'),
    beyond('cmd-shift-g', ['Cmd', 'Shift', 'G'], 'Go to a folder by typing its path', 'files'),
    beyond('cmd-dup', ['Cmd', 'D'], 'Duplicate the selected file (Finder)', 'files'),
    beyond('cmd-shift-a', ['Cmd', 'Shift', 'A'], 'Jump to the Applications folder', 'files'),
    beyond('cmd-shift-d', ['Cmd', 'Shift', 'D'], 'Jump to the Desktop folder', 'files'),
    // System / Utilities
    beyond('cmd-shift-3', ['Cmd', 'Shift', '3'], 'Screenshot the whole screen', 'utilities'),
    beyond('cmd-shift-5', ['Cmd', 'Shift', '5'], 'Screenshot & screen-recording menu', 'utilities'),
    beyond('cmd-option-space', ['Cmd', 'Option', 'Space'], 'Finder search window', 'utilities'),
  ];

  var CATALOGS = { windows: WINDOWS, macos: MACOS };

  var PLATFORMS = [
    { id: 'windows', label: 'Windows', icon: '⊞' },
    { id: 'macos', label: 'macOS', icon: '⌘' },
  ];

  // Core groups, in learning order — same seven groups on both platforms.
  var CORE_GROUPS = [
    { id: 'navigate', title: 'Navigate', badge: { icon: '🧭', name: 'Navigator' } },
    { id: 'openclose', title: 'Open & Close', badge: { icon: '🚪', name: 'Doorkeeper' } },
    { id: 'editing', title: 'Editing', badge: { icon: '✂️', name: 'Editor' } },
    { id: 'text', title: 'Text', badge: { icon: '✒️', name: 'Wordsmith' } },
    { id: 'windows', title: 'Windows', badge: { icon: '🪟', name: 'Window Master' } },
    { id: 'browser', title: 'Browser', badge: { icon: '🌐', name: 'Web Surfer' } },
    { id: 'utilities', title: 'Utilities', badge: { icon: '🛠️', name: 'Handy' } },
  ];

  // Review interval ladder (days). "Got it" climbs a rung, "Fuzzy" resets to the first.
  var LADDER = [1, 3, 7, 14, 30, 60];

  TT.shortcutsData = {
    CATEGORIES: CATEGORIES,
    categoryLabel: categoryLabel,
    CATALOGS: CATALOGS,
    PLATFORMS: PLATFORMS,
    CORE_GROUPS: CORE_GROUPS,
    LADDER: LADDER
  };
})();

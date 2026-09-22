// Tool shortcut catalogs for the Shortcuts tab's "Tools" sub-tab.
// Same learn & review mechanics as the OS shortcuts (shortcuts.js), but grouped
// by the tool you are in: pick a tool, its shortcuts show.
//
// Progress is ONE shared list (TT.data.shortcuts.tools) across platforms: a tool
// shortcut is the same idea on both machines, only the modifier differs. The
// platform toggle changes the keys on screen, not which list you are learning.
//
// Each entry: id, tool, action, category, level ('essential' first, then 'more'),
// plus EITHER keys (a chord of keycaps) OR cmd (a typed command, {braces} mark
// placeholders). Optional: mac (keys on macOS), then/thenMac (the second half of
// a two-step chord like Ctrl+K then Z), note (a one-line teaching tip), example
// (a realistic line to type), prompt (the chip's prompt character, default $).
(function () {
  'use strict';
  window.TT = window.TT || {};

  var TOOLS = [
    { id: 'vscode', icon: '🧩', label: 'VS Code',
      tagline: 'The editor shortcuts that keep your hands off the mouse.' },
    { id: 'claude', icon: '✳', label: 'Claude Code',
      tagline: 'Driving the Claude CLI: keys, slash commands, and the flags you start it with.' }
  ];

  var CATEGORIES = [
    // VS Code
    { id: 'vs-nav', label: 'Navigate' },
    { id: 'vs-edit', label: 'Edit' },
    { id: 'vs-multi', label: 'Multi-cursor' },
    { id: 'vs-search', label: 'Search' },
    { id: 'vs-files', label: 'Files & tabs' },
    { id: 'vs-view', label: 'View & panels' },
    { id: 'vs-debug', label: 'Run & debug' },
    // Claude Code
    { id: 'cc-session', label: 'Session' },
    { id: 'cc-line', label: 'Editing the line' },
    { id: 'cc-input', label: 'Typing & input' },
    { id: 'cc-modes', label: 'Modes & control' },
    { id: 'cc-slash', label: 'Slash commands' },
    { id: 'cc-cli', label: 'Starting it' }
  ];

  function categoryLabel(id) {
    var c = CATEGORIES.filter(function (x) { return x.id === id; })[0];
    return c ? c.label : id;
  }

  function toolLabel(id) {
    var t = TOOLS.filter(function (x) { return x.id === id; })[0];
    return t ? t.label : id;
  }

  // On macOS almost every VS Code binding is the Windows one with Ctrl→Cmd and
  // Alt→Option. The handful that break the rule pass `mac` explicitly.
  function toMac(keys) {
    if (!keys) return null;
    return keys.map(function (k) {
      return k === 'Ctrl' ? 'Cmd' : k === 'Alt' ? 'Option' : k;
    });
  }

  var LEVELS = [
    { id: 'essential', title: 'Essentials', sub: 'the ones that pay for themselves the first day' },
    { id: 'more', title: 'More', sub: 'the rest worth knowing, once the essentials feel natural' }
  ];

  // ---- VS Code -------------------------------------------------------------------
  // vs(id, keys, action, category, note, opts) — mac keys derived unless overridden.
  function vs(level) {
    return function (id, keys, action, category, note, opts) {
      opts = opts || {};
      return {
        id: id, tool: 'vscode', tier: 'tools', level: level,
        keys: keys, mac: opts.mac || toMac(keys),
        then: opts.then || null, thenMac: opts.then ? (opts.thenMac || toMac(opts.then)) : null,
        action: action, category: category, note: note
      };
    };
  }
  var vsE = vs('essential');
  var vsM = vs('more');

  var VSCODE = [
    // ============================ ESSENTIALS
    // Navigate
    vsE('vs-palette', ['Ctrl', 'Shift', 'P'], 'Open the Command Palette', 'vs-nav',
      'Every command in VS Code lives here, searchable. If you learn one shortcut, learn this one.'),
    vsE('vs-goto-file', ['Ctrl', 'P'], 'Jump to any file by name', 'vs-nav',
      'Fuzzy matching — "usrctl" finds UserController.ts. No hunting through the file tree.'),
    vsE('vs-goto-line', ['Ctrl', 'G'], 'Jump to a line number', 'vs-nav',
      'Or type a colon and a number in the Ctrl+P box: :120.', { mac: ['Ctrl', 'G'] }),
    vsE('vs-goto-symbol', ['Ctrl', 'Shift', 'O'], 'Jump to a function or symbol in this file', 'vs-nav',
      'A table of contents for the file you are in. Type : to group them by kind.'),
    vsE('vs-definition', ['F12'], 'Go to the definition of whatever is under the cursor', 'vs-nav',
      'Ctrl+Click does the same with the mouse. Alt+F12 peeks it inline instead.'),
    vsE('vs-back', ['Alt', '←'], 'Go back to where you just were', 'vs-nav',
      'The undo button for navigation. Alt+→ goes forward again.', { mac: ['Ctrl', '-'] }),
    vsE('vs-switch-editor', ['Ctrl', 'Tab'], 'Switch to another open editor', 'vs-nav',
      'Hold Ctrl and tap Tab to walk the list — Alt+Tab, but for your tabs.'),
    // Edit
    vsE('vs-comment', ['Ctrl', '/'], 'Comment or uncomment the line (or selection)', 'vs-edit',
      'Works in every language — VS Code knows the right comment characters.'),
    vsE('vs-move-line-up', ['Alt', '↑'], 'Move the current line up', 'vs-edit',
      'Alt+↓ moves it down. Select several lines first to move a whole block.'),
    vsE('vs-copy-line-down', ['Shift', 'Alt', '↓'], 'Duplicate the line below', 'vs-edit',
      'Shift+Alt+↑ duplicates it above. Faster than copy, move, paste.'),
    vsE('vs-delete-line', ['Ctrl', 'Shift', 'K'], 'Delete the whole line', 'vs-edit',
      'No selecting first — the cursor can be anywhere on the line.'),
    vsE('vs-line-below', ['Ctrl', 'Enter'], 'Open a new line below and go to it', 'vs-edit',
      'From mid-line, with no End press first. Ctrl+Shift+Enter opens one above.'),
    vsE('vs-quick-fix', ['Ctrl', '.'], 'Show quick fixes for the error or warning', 'vs-edit',
      'The lightbulb, by keyboard: import the missing name, fix the typo, extract a function.'),
    vsE('vs-format', ['Shift', 'Alt', 'F'], 'Format the whole document', 'vs-edit',
      'Uses whatever formatter the project is set up with (Prettier, Black, gofmt…).'),
    vsE('vs-rename', ['F2'], 'Rename a symbol everywhere it is used', 'vs-edit',
      'A real rename, not find-and-replace — it follows scope across files.'),
    vsE('vs-suggest', ['Ctrl', 'Space'], 'Ask for suggestions right here', 'vs-edit',
      'Summons IntelliSense when it has not popped up on its own.', { mac: ['Ctrl', 'Space'] }),
    // Multi-cursor
    vsE('vs-add-next', ['Ctrl', 'D'], 'Select the next occurrence of this word too', 'vs-multi',
      'Press it again and again to build a multi-cursor edit one match at a time.'),
    vsE('vs-select-all-occ', ['Ctrl', 'Shift', 'L'], 'Select every occurrence at once', 'vs-multi',
      'One cursor per match, instantly. Ideal for renaming inside a single file.'),
    vsE('vs-cursor-below', ['Ctrl', 'Alt', '↓'], 'Add a cursor on the line below', 'vs-multi',
      'Ctrl+Alt+↑ adds one above. Edit a stack of lines in one go.'),
    vsE('vs-select-line', ['Ctrl', 'L'], 'Select the whole line', 'vs-multi',
      'Press it again to swallow the next line, and the next.'),
    vsE('vs-escape-cursors', ['Esc'], 'Drop back to a single cursor', 'vs-multi',
      'Your way out of a multi-cursor edit that got away from you.', { mac: ['Esc'] }),
    // Search
    vsE('vs-find', ['Ctrl', 'F'], 'Find in this file', 'vs-search',
      'Enter and Shift+Enter walk the matches. Alt+Enter puts a cursor on all of them.'),
    vsE('vs-replace', ['Ctrl', 'H'], 'Find and replace in this file', 'vs-search',
      'Ctrl+Alt+Enter replaces every match at once.'),
    vsE('vs-find-files', ['Ctrl', 'Shift', 'F'], 'Search across the whole project', 'vs-search',
      'The one you reach for when you do not know which file it is in.'),
    // Files & tabs
    vsE('vs-save', ['Ctrl', 'S'], 'Save the file', 'vs-files',
      'Ctrl+K S saves every unsaved file at once.'),
    vsE('vs-close', ['Ctrl', 'W'], 'Close this editor', 'vs-files',
      'Closes the tab, not the window — Ctrl+Shift+W closes the window.'),
    vsE('vs-reopen', ['Ctrl', 'Shift', 'T'], 'Reopen the editor you just closed', 'vs-files',
      'The one you want three seconds after Ctrl+W. It keeps going further back.'),
    vsE('vs-split', ['Ctrl', '\\'], 'Split the editor side by side', 'vs-files',
      'Ctrl+1 and Ctrl+2 jump between the two halves.'),
    // View & panels
    vsE('vs-sidebar', ['Ctrl', 'B'], 'Show or hide the side bar', 'vs-view',
      'The fastest way to buy back screen width.'),
    vsE('vs-terminal', ['Ctrl', '`'], 'Show or hide the integrated terminal', 'vs-view',
      'Ctrl+Shift+` opens an additional terminal instead of toggling this one.'),
    vsE('vs-panel', ['Ctrl', 'J'], 'Show or hide the bottom panel', 'vs-view',
      'Terminal, problems, output and debug console all live down there.'),

    // ============================ MORE
    // Edit
    vsM('vs-line-above', ['Ctrl', 'Shift', 'Enter'], 'Open a new line above', 'vs-edit',
      'The twin of Ctrl+Enter.'),
    vsM('vs-block-comment', ['Shift', 'Alt', 'A'], 'Toggle a block comment', 'vs-edit',
      'For /* … */ style comments around a selection.'),
    vsM('vs-indent', ['Ctrl', ']'], 'Indent the line', 'vs-edit',
      'Ctrl+[ outdents. Both work on a whole selection.'),
    vsM('vs-expand-selection', ['Shift', 'Alt', '→'], 'Grow the selection to the next syntax block', 'vs-edit',
      'Word, then string, then call, then statement. Shift+Alt+← shrinks it back.'),
    vsM('vs-match-bracket', ['Ctrl', 'Shift', '\\'], 'Jump to the matching bracket', 'vs-edit',
      'Useful when a block is long enough that you cannot see both ends.'),
    vsM('vs-fold', ['Ctrl', 'Shift', '['], 'Fold the block at the cursor', 'vs-edit',
      'Ctrl+Shift+] unfolds it. Ctrl+K Ctrl+0 folds everything.'),
    vsM('vs-word-wrap', ['Alt', 'Z'], 'Toggle word wrap', 'vs-edit',
      'For the one file with 400-character lines.'),
    vsM('vs-undo-cursor', ['Ctrl', 'U'], 'Undo the last cursor move', 'vs-edit',
      'Rewinds the cursor, not the text — the rescue after one Ctrl+D too many.'),
    // Navigate
    vsM('vs-symbol-workspace', ['Ctrl', 'T'], 'Find a symbol anywhere in the project', 'vs-nav',
      'Like Ctrl+P, but for functions and classes instead of files.'),
    vsM('vs-references', ['Shift', 'F12'], 'Show everywhere this symbol is used', 'vs-nav',
      'Read this before you change a signature.'),
    vsM('vs-peek', ['Alt', 'F12'], 'Peek the definition without leaving the file', 'vs-nav',
      'Opens it inline. Esc closes the peek.'),
    vsM('vs-next-problem', ['F8'], 'Jump to the next error or warning', 'vs-nav',
      'Shift+F8 walks back up. Clear a file without hunting red squiggles.'),
    vsM('vs-file-start', ['Ctrl', 'Home'], 'Jump to the top of the file', 'vs-nav',
      'Ctrl+End goes to the bottom.'),
    // Search
    vsM('vs-replace-files', ['Ctrl', 'Shift', 'H'], 'Find and replace across the project', 'vs-search',
      'Always read the preview before you hit Replace All.'),
    vsM('vs-find-selection', ['Ctrl', 'F3'], 'Find the next match of the word under the cursor', 'vs-search',
      'No typing the search term at all.'),
    // Files & tabs
    vsM('vs-new-file', ['Ctrl', 'N'], 'New untitled file', 'vs-files',
      'A scratchpad. Ctrl+Shift+N opens a whole new window.'),
    vsM('vs-close-all', ['Ctrl', 'K'], 'Close every open editor', 'vs-files',
      'A two-step chord: Ctrl+K, then Ctrl+W. A clean slate.', { then: ['Ctrl', 'W'] }),
    vsM('vs-focus-group', ['Ctrl', '1'], 'Focus the first editor group', 'vs-files',
      'Ctrl+2, Ctrl+3… for the others once the editor is split.'),
    vsM('vs-keep-open', ['Ctrl', 'K'], 'Pin the previewed file open', 'vs-files',
      'Ctrl+K, then Enter. Stops the italic preview tab being replaced by the next file you look at.',
      { then: ['Enter'] }),
    // View & panels
    vsM('vs-explorer', ['Ctrl', 'Shift', 'E'], 'Focus the file explorer', 'vs-view',
      'Press it again to jump back to the editor.'),
    vsM('vs-scm', ['Ctrl', 'Shift', 'G'], 'Open Source Control', 'vs-view',
      'Stage, diff and commit without touching the terminal.'),
    vsM('vs-extensions', ['Ctrl', 'Shift', 'X'], 'Open the Extensions view', 'vs-view',
      'Search, install, disable.'),
    vsM('vs-problems', ['Ctrl', 'Shift', 'M'], 'Open the Problems panel', 'vs-view',
      'Every error and warning in the project, in one list.'),
    vsM('vs-settings', ['Ctrl', ','], 'Open Settings', 'vs-view',
      'Ctrl+K Ctrl+S opens the keyboard shortcuts editor instead.'),
    vsM('vs-zen', ['Ctrl', 'K'], 'Enter Zen Mode', 'vs-view',
      'Ctrl+K, then Z. Everything but the code disappears. Esc Esc leaves.', { then: ['Z'] }),
    vsM('vs-new-terminal', ['Ctrl', 'Shift', '`'], 'Open an additional terminal', 'vs-view',
      'A second shell alongside the first, rather than toggling the one you have.'),
    vsM('vs-markdown-preview', ['Ctrl', 'Shift', 'V'], 'Preview the Markdown file', 'vs-view',
      'Ctrl+K V opens the preview beside the source, scrolling in sync.'),
    vsM('vs-zoom', ['Ctrl', '='], 'Zoom the whole editor in', 'vs-view',
      'Ctrl+- zooms out. Different from the font-size setting — this scales the entire UI.'),
    // Run & debug
    vsM('vs-debug-start', ['F5'], 'Start debugging, or continue', 'vs-debug',
      'Ctrl+F5 runs without attaching the debugger.'),
    vsM('vs-breakpoint', ['F9'], 'Toggle a breakpoint on this line', 'vs-debug',
      'The red dot, by keyboard.'),
    vsM('vs-step-over', ['F10'], 'Step over the next line', 'vs-debug',
      'F11 steps into the call, Shift+F11 steps back out.'),
    vsM('vs-debug-stop', ['Shift', 'F5'], 'Stop debugging', 'vs-debug',
      'Ctrl+Shift+F5 restarts the session instead.'),
    vsM('vs-debug-view', ['Ctrl', 'Shift', 'D'], 'Open the Run and Debug view', 'vs-debug',
      'Launch configurations, watch expressions and the call stack.')
  ];

  // ---- Claude Code ---------------------------------------------------------------
  // The CLI runs inside a terminal, so its control keys are the same on both
  // platforms unless `mac` says otherwise.
  function ccKey(level) {
    return function (id, keys, action, category, note, opts) {
      opts = opts || {};
      return {
        id: id, tool: 'claude', tier: 'tools', level: level,
        keys: keys, mac: opts.mac || keys,
        then: opts.then || null, thenMac: opts.then ? (opts.thenMac || opts.then) : null,
        action: action, category: category, note: note
      };
    };
  }
  // Something you type: a slash command (prompt >) or a shell line (prompt $).
  function ccCmd(level, prompt) {
    return function (id, cmd, action, category, example, note) {
      return {
        id: id, tool: 'claude', tier: 'tools', level: level,
        cmd: cmd, prompt: prompt, action: action, category: category,
        example: example, note: note
      };
    };
  }
  var ccE = ccKey('essential');
  var ccM = ccKey('more');
  var slashE = ccCmd('essential', '>');
  var slashM = ccCmd('more', '>');
  var cliE = ccCmd('essential', '$');
  var cliM = ccCmd('more', '$');

  var CLAUDE = [
    // ============================ ESSENTIALS
    // Session
    ccE('cc-esc', ['Esc'], 'Stop Claude mid-answer', 'cc-session',
      'Interrupts the reply or the tool it is running and hands the prompt back. The conversation stays.'),
    ccE('cc-esc-esc', ['Esc'], 'Go back and edit an earlier message', 'cc-session',
      'Press Esc twice, pick a message, change it — the conversation replays from there.',
      { then: ['Esc'] }),
    ccE('cc-ctrl-c', ['Ctrl', 'C'], 'Clear what you have typed; press twice to quit', 'cc-session',
      'One press wipes the input line. Two in a row exits Claude Code.'),
    ccE('cc-ctrl-d', ['Ctrl', 'D'], 'Exit Claude Code', 'cc-session',
      'End of input, the same as in any shell.'),
    ccE('cc-ctrl-l', ['Ctrl', 'L'], 'Clear the screen', 'cc-session',
      'Wipes the scrollback only — Claude still remembers everything. /clear is what makes it forget.'),
    ccE('cc-up', ['↑'], 'Bring back a previous prompt', 'cc-session',
      'Walks your history like a shell. Handy for rerunning a prompt with one word changed.'),
    // Editing the line — the readline keys. A long prompt is a line of text, and
    // these are how you fix it without holding down an arrow key.
    ccE('cc-ctrl-u', ['Ctrl', 'U'], 'Delete everything before the cursor', 'cc-line',
      'At the end of a line that is the whole prompt gone. The fastest way to start the sentence again.'),
    ccE('cc-ctrl-k', ['Ctrl', 'K'], 'Delete from the cursor to the end of the line', 'cc-line',
      'The other half of Ctrl+U. Kill the tail of a prompt and retype just that part.'),
    ccE('cc-ctrl-w', ['Ctrl', 'W'], 'Delete the word before the cursor', 'cc-line',
      'One wrong word, one keystroke. Far better than nine presses of Backspace.'),
    ccE('cc-ctrl-a', ['Ctrl', 'A'], 'Jump to the start of the line', 'cc-line',
      'For adding a word to the front of a prompt you already typed.'),
    ccE('cc-ctrl-e', ['Ctrl', 'E'], 'Jump to the end of the line', 'cc-line',
      'The twin of Ctrl+A. Home and End work too, when your terminal passes them through.'),
    ccE('cc-word-left', ['Alt', '←'], 'Move back one word', 'cc-line',
      'Alt+→ moves forward one. Land on the word you want instead of crawling there.',
      { mac: ['Option', '←'] }),
    ccM('cc-ctrl-y', ['Ctrl', 'Y'], 'Paste back what you just deleted', 'cc-line',
      'Undo for Ctrl+U, Ctrl+K and Ctrl+W — they cut into a buffer, they do not destroy.'),
    // Typing & input
    ccE('cc-newline', ['Shift', 'Enter'], 'Add a line break without sending', 'cc-input',
      'Run /terminal-setup once to teach your terminal this one.', { mac: ['Option', 'Enter'] }),
    ccE('cc-backslash', ['\\'], 'Add a line break in any terminal', 'cc-input',
      'A backslash followed straight by Enter. The fallback when Shift+Enter is not wired up.',
      { then: ['Enter'] }),
    ccE('cc-paste-image', ['Ctrl', 'V'], 'Paste an image from the clipboard', 'cc-input',
      'A screenshot of the broken UI says more than a paragraph about it.', { mac: ['Ctrl', 'V'] }),
    // Modes & control
    ccE('cc-shift-tab', ['Shift', 'Tab'], 'Cycle the permission mode', 'cc-modes',
      'Normal → auto-accept edits → plan mode. Plan mode reads and thinks but changes nothing.'),
    // Typed entry points
    slashE('cc-at', '@{path}', 'Point Claude at a file or folder', 'cc-input',
      '@src/app.js', 'Typing @ opens path autocomplete and pulls that file into context.'),
    slashE('cc-bang', '!{command}', 'Run a shell command yourself', 'cc-input',
      '!git status', 'A line starting with ! runs in your shell, and its output stays in the conversation.'),
    slashE('cc-hash', '#{note}', 'Save a note to memory', 'cc-input',
      '#always run tests with npm test', 'A line starting with # is written into CLAUDE.md, so it survives the session.'),
    // Slash commands
    slashE('cc-help', '/help', 'List every command and shortcut', 'cc-slash',
      '/help', 'The authority on your version — start here if anything on this card looks different.'),
    slashE('cc-clear', '/clear', 'Start a fresh conversation', 'cc-slash',
      '/clear', 'Drops the whole context. Do it between unrelated tasks: answers stay sharp and cheap.'),
    slashE('cc-compact', '/compact', 'Summarise the conversation so far', 'cc-slash',
      '/compact', 'Keeps a long thread going with the gist instead of every message.'),
    slashE('cc-model', '/model', 'Switch model', 'cc-slash',
      '/model', 'The bigger model for hard reasoning, the faster one for mechanical edits.'),
    slashE('cc-init', '/init', 'Write a CLAUDE.md for this project', 'cc-slash',
      '/init', 'Reads the repo and records how to build, test and run it. Do this first in a new project.'),
    slashE('cc-context', '/context', 'Show what is in context right now', 'cc-slash',
      '/context', 'Which files, how many tokens, how close to full.'),
    slashE('cc-cost', '/cost', 'Show what this session has cost', 'cc-slash',
      '/cost', 'Tokens and spend so far.'),
    slashE('cc-resume', '/resume', 'Reopen an earlier conversation', 'cc-slash',
      '/resume', 'Pick from a list of past sessions in this folder.'),
    slashE('cc-review', '/review', 'Review the pending changes', 'cc-slash',
      '/review', 'A code review of your diff before anyone else sees it.'),
    // Starting it
    cliE('cc-start', 'claude', 'Start Claude Code in this folder', 'cc-cli',
      'claude', 'The folder you start in is the project it can see. cd first.'),
    cliE('cc-continue', 'claude -c', 'Pick up the most recent conversation', 'cc-cli',
      'claude -c', 'Same as --continue. The one you want after closing the terminal by accident.'),
    cliE('cc-resume-flag', 'claude -r', 'Choose which past conversation to resume', 'cc-cli',
      'claude -r', 'Same as --resume: shows a list instead of assuming the latest.'),
    cliE('cc-print', 'claude -p "{prompt}"', 'Ask one question and exit', 'cc-cli',
      'claude -p "summarise the README"', 'Print mode: no interactive session, just an answer. Pipes into other commands.'),

    // ============================ MORE
    ccM('cc-ctrl-b', ['Ctrl', 'B'], 'Send the running command to the background', 'cc-modes',
      'For a dev server or a long build: it keeps running and you keep talking.'),
    ccM('cc-ctrl-t', ['Ctrl', 'T'], 'Show or hide the todo list', 'cc-modes',
      'What Claude thinks the remaining steps are, on a long task.'),
    ccM('cc-ctrl-z', ['Ctrl', 'Z'], 'Suspend Claude Code to the shell', 'cc-session',
      'Type fg to come back. A Unix habit that works here too.'),
    slashM('cc-config', '/config', 'Open the settings', 'cc-slash',
      '/config', 'Theme, model, notifications and the rest.'),
    slashM('cc-permissions', '/permissions', 'See and edit what Claude may do without asking', 'cc-slash',
      '/permissions', 'Allow the commands you trust and the prompts stop interrupting you.'),
    slashM('cc-memory', '/memory', 'Edit the CLAUDE.md memory files', 'cc-slash',
      '/memory', 'The project rules Claude reads at the start of every session.'),
    slashM('cc-agents', '/agents', 'Manage subagents', 'cc-slash',
      '/agents', 'Named agents with their own prompt and tools, for work you repeat.'),
    slashM('cc-mcp', '/mcp', 'Manage MCP servers', 'cc-slash',
      '/mcp', 'Connections to outside tools and data sources.'),
    slashM('cc-hooks', '/hooks', 'Configure hooks', 'cc-slash',
      '/hooks', 'Run your own command automatically before or after Claude uses a tool.'),
    slashM('cc-add-dir', '/add-dir {path}', 'Let Claude see another folder', 'cc-slash',
      '/add-dir ../shared-lib', 'For work that spans two repositories.'),
    slashM('cc-terminal-setup', '/terminal-setup', 'Teach your terminal Shift+Enter', 'cc-slash',
      '/terminal-setup', 'A one-time fix so a line break stops sending the message.'),
    slashM('cc-vim', '/vim', 'Turn on vim keys in the prompt', 'cc-slash',
      '/vim', 'If your fingers already know hjkl.'),
    slashM('cc-export', '/export', 'Export this conversation', 'cc-slash',
      '/export', 'To a file or the clipboard, for sharing or keeping.'),
    slashM('cc-doctor', '/doctor', 'Check the installation', 'cc-slash',
      '/doctor', 'First stop when something is broken and you do not know why.'),
    slashM('cc-status', '/status', 'Show version, account and settings', 'cc-slash',
      '/status', 'What you quote when you report a bug.'),
    slashM('cc-bug', '/bug', 'Report a problem to Anthropic', 'cc-slash',
      '/bug', 'Sends the conversation along with it.'),
    cliM('cc-model-flag', 'claude --model {name}', 'Start on a specific model', 'cc-cli',
      'claude --model opus', 'Skips the /model step when you already know which one you want.'),
    cliM('cc-json', 'claude -p "{prompt}" --output-format json', 'Get a machine-readable answer', 'cc-cli',
      'claude -p "list the TODOs" --output-format json', 'For scripts and CI, where something has to parse the output.'),
    cliM('cc-mcp-add', 'claude mcp add {name} {command}', 'Register an MCP server', 'cc-cli',
      'claude mcp add github npx @modelcontextprotocol/server-github', 'Adds a tool connection Claude can use in this project.'),
    cliM('cc-update', 'claude update', 'Update to the newest version', 'cc-cli',
      'claude update', 'Worth doing when a shortcut here does not match what /help shows.'),
    cliM('cc-doctor-cli', 'claude doctor', 'Check the installation without starting a session', 'cc-cli',
      'claude doctor', 'The same check as /doctor, from your shell.')
  ];

  var SHORTCUTS = VSCODE.concat(CLAUDE);

  TT.toolsData = {
    TOOLS: TOOLS,
    CATEGORIES: CATEGORIES,
    categoryLabel: categoryLabel,
    toolLabel: toolLabel,
    SHORTCUTS: SHORTCUTS,
    LEVELS: LEVELS
  };
})();

// Linux terminal command catalog for the Shortcuts tab's "Terminal" sub-tab.
// Same learn & review mechanics as keyboard shortcuts (shortcuts.js), but the
// list is platform-neutral: one shared progress list (TT.data.shortcuts.terminal)
// whichever platform toggle is active — a shell is a shell.
//
// Each entry: id, cmd (canonical form; {braces} mark placeholders the user fills
// in), action (what it does), category, example (a realistic line to type),
// note (a one-line teaching tip), level ('essential' first, then 'more').
// Keystroke entries carry `keys` instead of `cmd` and render as keycaps.
(function () {
  'use strict';
  window.TT = window.TT || {};

  var CATEGORIES = [
    { id: 'sh-nav', label: 'Navigate' },
    { id: 'sh-files', label: 'Files' },
    { id: 'sh-view', label: 'Read & Edit' },
    { id: 'sh-search', label: 'Search' },
    { id: 'sh-text', label: 'Text' },
    { id: 'sh-perms', label: 'Permissions' },
    { id: 'sh-proc', label: 'Processes' },
    { id: 'sh-sys', label: 'System' },
    { id: 'sh-net', label: 'Network' },
    { id: 'sh-pkg', label: 'Packages' },
    { id: 'sh-shell', label: 'Shell tricks' },
  ];

  function categoryLabel(id) {
    var c = CATEGORIES.filter(function (x) { return x.id === id; })[0];
    return c ? c.label : id;
  }

  var ess = function (id, cmd, action, category, example, note) {
    return { id: id, cmd: cmd, action: action, category: category, example: example, note: note, level: 'essential', tier: 'terminal' };
  };
  var more = function (id, cmd, action, category, example, note) {
    return { id: id, cmd: cmd, action: action, category: category, example: example, note: note, level: 'more', tier: 'terminal' };
  };
  var key = function (id, keys, action, category, note, level) {
    return { id: id, keys: keys, action: action, category: category, note: note, level: level || 'essential', tier: 'terminal' };
  };

  var COMMANDS = [
    // ============================ ESSENTIALS — the commands you use every day
    // Navigate
    ess('sh-pwd', 'pwd', 'Print the folder you are in', 'sh-nav',
      'pwd', '"Print working directory" — your "where am I?"'),
    ess('sh-ls', 'ls', 'List the files in this folder', 'sh-nav',
      'ls', 'Folders and files, in columns. Add -l for one detailed line each.'),
    ess('sh-ls-la', 'ls -la', 'List everything, hidden files included, with sizes and permissions', 'sh-nav',
      'ls -la ~', '-l = long format, -a = all (files starting with a dot are hidden by default).'),
    ess('sh-cd', 'cd {dir}', 'Move into a folder', 'sh-nav',
      'cd Documents', 'Paths can be relative (Documents) or absolute (/home/you/Documents).'),
    ess('sh-cd-up', 'cd ..', 'Go up one folder', 'sh-nav',
      'cd ../..', '.. is the parent folder, . is the current one.'),
    ess('sh-cd-home', 'cd', 'Jump back to your home folder', 'sh-nav',
      'cd', 'Plain cd with no argument. ~ also means home: cd ~/Downloads.'),
    ess('sh-clear', 'clear', 'Clear the screen', 'sh-nav',
      'clear', 'Ctrl+L does the same without typing anything.'),
    // Files
    ess('sh-mkdir', 'mkdir -p {dir}', 'Make a folder (and any missing parents)', 'sh-files',
      'mkdir -p projects/site', 'Without -p, mkdir fails if the parent folder does not exist yet.'),
    ess('sh-touch', 'touch {file}', 'Create an empty file (or update its timestamp)', 'sh-files',
      'touch notes.txt', 'The quickest way to make a file exist.'),
    ess('sh-cp', 'cp {src} {dst}', 'Copy a file', 'sh-files',
      'cp notes.txt backup.txt', 'Destination can be a folder: cp notes.txt backups/'),
    ess('sh-mv', 'mv {src} {dst}', 'Move — or rename — a file or folder', 'sh-files',
      'mv draft.txt final.txt', 'Same command for both: moving into a new name is renaming.'),
    ess('sh-rm', 'rm {file}', 'Delete a file — permanently, there is no recycle bin', 'sh-files',
      'rm old.log', 'Double-check the name before Enter. rm -r deletes a whole folder.'),
    // Read & edit
    ess('sh-cat', 'cat {file}', 'Print a file\'s contents', 'sh-view',
      'cat notes.txt', 'Best for short files — long ones scroll past; use less instead.'),
    ess('sh-less', 'less {file}', 'Scroll through a long file', 'sh-view',
      'less /var/log/syslog', 'Space = page down, / = search, q = quit.'),
    ess('sh-nano', 'nano {file}', 'Edit a file right in the terminal', 'sh-view',
      'nano notes.txt', 'Ctrl+O saves, Ctrl+X exits. The shortcuts are listed at the bottom.'),
    // Search
    ess('sh-grep', 'grep {pattern} {file}', 'Find lines containing some text', 'sh-search',
      'grep error app.log', '-i ignores case, -n shows line numbers.'),
    ess('sh-grep-r', 'grep -rn {pattern} {dir}', 'Search for text inside every file under a folder', 'sh-search',
      'grep -rn TODO src/', '-r = recursive, -n = line numbers. The everyday code search.'),
    ess('sh-find', 'find {dir} -name {pattern}', 'Find files by name', 'sh-search',
      "find . -name '*.js'", 'Quote the pattern so the shell does not expand the * first.'),
    // Permissions
    ess('sh-sudo', 'sudo {cmd}', 'Run one command as the administrator (root)', 'sh-perms',
      'sudo apt update', 'It asks for your password, then remembers it for a few minutes.'),
    ess('sh-chmod-x', 'chmod +x {file}', 'Make a script executable', 'sh-perms',
      'chmod +x deploy.sh', 'Then run it with ./deploy.sh'),
    // Processes
    ess('sh-ps', 'ps aux', 'List every running process', 'sh-proc',
      'ps aux | grep node', 'Pipe it into grep to find the one you want — its PID is the second column.'),
    ess('sh-kill', 'kill {pid}', 'Stop a process by its id', 'sh-proc',
      'kill 1234', 'Asks politely. kill -9 forces it when it will not listen.'),
    key('sh-ctrl-c', ['Ctrl', 'C'], 'Stop the command that is running', 'sh-proc',
      'The universal "make it stop". It does not copy anything in a terminal.'),
    // System
    ess('sh-man', 'man {cmd}', 'Read the manual page for a command', 'sh-sys',
      'man ls', 'Or try cmd --help for a shorter summary. q quits the manual.'),
    ess('sh-history', 'history', 'Show the commands you have typed', 'sh-sys',
      'history | tail -20', 'Each line has a number: !42 re-runs command 42.'),
    // Network
    ess('sh-ping', 'ping {host}', 'Check that a machine or website is reachable', 'sh-net',
      'ping -c 4 google.com', '-c 4 sends four packets and stops; without it, Ctrl+C.'),
    ess('sh-ssh', 'ssh {user}@{host}', 'Log in to another machine over the network', 'sh-net',
      'ssh pi@192.168.1.20', 'Type exit to come back.'),
    // Packages
    ess('sh-apt-install', 'sudo apt install {pkg}', 'Install software (Debian / Ubuntu)', 'sh-pkg',
      'sudo apt install git', 'Run sudo apt update first so it knows the latest versions.'),
    // Shell tricks
    ess('sh-pipe', '{cmd1} | {cmd2}', 'Feed one command\'s output into another', 'sh-shell',
      'ls | wc -l', 'The pipe is the heart of the shell: small tools chained together.'),
    ess('sh-redirect', '{cmd} > {file}', 'Write a command\'s output into a file', 'sh-shell',
      'ls > files.txt', '> replaces the file, >> appends to the end of it.'),
    key('sh-tab', ['Tab'], 'Autocomplete a file, folder or command name', 'sh-shell',
      'Press twice to see every possible completion. Saves more typing than anything else.'),
    key('sh-up', ['↑'], 'Recall the previous command', 'sh-shell',
      'Keep pressing to go further back; Enter runs it, or edit it first.'),
    key('sh-ctrl-r', ['Ctrl', 'R'], 'Search your command history as you type', 'sh-shell',
      'Type a few letters of an old command; press Ctrl+R again for older matches, Enter to run.'),

    // ============================ MORE — the rest worth knowing
    // Navigate
    more('sh-cd-back', 'cd -', 'Go back to the previous folder', 'sh-nav',
      'cd -', 'Toggles between the last two folders you were in.'),
    more('sh-ls-lh', 'ls -lh', 'List with human-readable sizes (K, M, G)', 'sh-nav',
      'ls -lh', 'Combine flags freely: ls -lah'),
    more('sh-ls-lt', 'ls -lt', 'List newest files first', 'sh-nav',
      'ls -lt | head', '-t sorts by modification time; -r reverses.'),
    more('sh-tree', 'tree', 'Show a folder as an indented tree', 'sh-nav',
      'tree -L 2', '-L 2 limits the depth. May need: sudo apt install tree'),
    // Files
    more('sh-cp-r', 'cp -r {src} {dst}', 'Copy a whole folder', 'sh-files',
      'cp -r site/ site-backup/', '-r = recursive. Plain cp refuses folders.'),
    more('sh-rm-r', 'rm -r {dir}', 'Delete a folder and everything in it', 'sh-files',
      'rm -r old-build/', 'rm -rf never asks and never stops. Read the path twice.'),
    more('sh-ln-s', 'ln -s {target} {link}', 'Create a symbolic link (a shortcut to a file)', 'sh-files',
      'ln -s /opt/app/config.yml ~/config.yml', 'Target first, link name second.'),
    more('sh-file', 'file {name}', 'Tell what kind of file something is', 'sh-files',
      'file mystery.bin', 'Looks at the contents, not the extension.'),
    more('sh-tar-x', 'tar -xzf {archive}', 'Extract a .tar.gz archive', 'sh-files',
      'tar -xzf release.tar.gz', 'x = extract, z = gzip, f = file. "eXtract Ze File".'),
    more('sh-tar-c', 'tar -czf {archive} {dir}', 'Pack a folder into a .tar.gz archive', 'sh-files',
      'tar -czf site.tar.gz site/', 'c = create. "Create Ze File".'),
    more('sh-unzip', 'unzip {file}', 'Extract a .zip file', 'sh-files',
      'unzip photos.zip', 'zip -r out.zip folder/ goes the other way.'),
    // Read & edit
    more('sh-head', 'head -n {n} {file}', 'Show the first lines of a file', 'sh-view',
      'head -n 20 app.log', 'Default is 10 lines.'),
    more('sh-tail', 'tail -n {n} {file}', 'Show the last lines of a file', 'sh-view',
      'tail -n 50 app.log', 'The end of a log is where the newest errors are.'),
    more('sh-tail-f', 'tail -f {file}', 'Follow a file live as it grows', 'sh-view',
      'tail -f /var/log/syslog', 'Watch a log while your program runs. Ctrl+C to stop.'),
    more('sh-wc', 'wc -l {file}', 'Count the lines in a file', 'sh-view',
      'wc -l users.csv', '-w counts words, -c counts bytes.'),
    more('sh-diff', 'diff {a} {b}', 'Show the differences between two files', 'sh-view',
      'diff old.conf new.conf', '< lines are from the first file, > from the second.'),
    // Search
    more('sh-grep-i', 'grep -i {pattern} {file}', 'Search ignoring upper / lower case', 'sh-search',
      'grep -i warning app.log', 'Add -v to show the lines that do NOT match.'),
    more('sh-which', 'which {cmd}', 'Show where a command lives on disk', 'sh-search',
      'which python3', 'Handy when two versions of something are installed.'),
    more('sh-find-type', 'find {dir} -type f -size +{size}', 'Find files bigger than a size', 'sh-search',
      'find . -type f -size +100M', '-type f = files only, -type d = folders only.'),
    more('sh-find-mtime', 'find {dir} -mtime -{days}', 'Find files changed in the last N days', 'sh-search',
      'find . -mtime -7', '-7 = within seven days; +7 = older than seven days.'),
    // Text
    more('sh-echo', 'echo {text}', 'Print text (or a variable)', 'sh-text',
      'echo $HOME', 'echo "hello" > file.txt writes it into a file.'),
    more('sh-sort', 'sort {file}', 'Sort lines alphabetically', 'sh-text',
      'sort names.txt', '-n sorts numerically, -r reverses.'),
    more('sh-uniq', 'sort {file} | uniq -c', 'Count how often each line appears', 'sh-text',
      'sort ips.txt | uniq -c', 'uniq only spots repeats next to each other — sort first.'),
    more('sh-cut', 'cut -d{sep} -f{n} {file}', 'Take one column out of delimited text', 'sh-text',
      'cut -d, -f2 users.csv', '-d sets the delimiter, -f picks the field.'),
    more('sh-sed', "sed 's/{old}/{new}/g' {file}", 'Find and replace text in a stream', 'sh-text',
      "sed 's/colour/color/g' notes.txt", 'Add -i to change the file in place.'),
    more('sh-awk', "awk '{print ${n}}' {file}", 'Print one column of whitespace-separated text', 'sh-text',
      "ps aux | awk '{print $2}'", '$1 is the first column, $NF the last.'),
    more('sh-xargs', '{cmd1} | xargs {cmd2}', 'Use one command\'s output as another\'s arguments', 'sh-text',
      "find . -name '*.tmp' | xargs rm", 'Turns a list of names into arguments.'),
    // Permissions
    more('sh-chmod-num', 'chmod {mode} {file}', 'Set exact permissions with a number', 'sh-perms',
      'chmod 644 notes.txt', '644 = owner reads and writes, others read. 755 adds execute.'),
    more('sh-chown', 'sudo chown {user}:{group} {file}', 'Change who owns a file', 'sh-perms',
      'sudo chown www-data:www-data index.html', 'Add -R to change a whole folder.'),
    more('sh-whoami', 'whoami', 'Print your user name', 'sh-perms',
      'whoami', 'Useful after sudo -i to check who you are right now.'),
    more('sh-sudo-i', 'sudo -i', 'Open a root shell (stay administrator)', 'sh-perms',
      'sudo -i', 'exit returns to your own account. Every command is dangerous here.'),
    more('sh-passwd', 'passwd', 'Change your password', 'sh-perms',
      'passwd', 'sudo passwd otheruser changes someone else\'s.'),
    // Processes
    more('sh-top', 'top', 'Live view of CPU and memory by process', 'sh-proc',
      'top', 'q quits. htop is the friendlier version if installed.'),
    more('sh-kill-9', 'kill -9 {pid}', 'Force-stop a process that ignores kill', 'sh-proc',
      'kill -9 1234', '-9 is SIGKILL: no cleanup, no goodbye.'),
    more('sh-pkill', 'pkill {name}', 'Stop processes by name', 'sh-proc',
      'pkill firefox', 'No PID lookup needed. killall works the same way.'),
    more('sh-bg-amp', '{cmd} &', 'Run a command in the background', 'sh-proc',
      'python3 server.py &', 'You get the prompt back immediately; jobs lists it.'),
    key('sh-ctrl-z', ['Ctrl', 'Z'], 'Pause the running command (suspend it)', 'sh-proc',
      'bg continues it in the background, fg brings it back to the front.', 'more'),
    more('sh-jobs', 'jobs', 'List the commands running in the background', 'sh-proc',
      'jobs', 'fg %1 brings job 1 back to the foreground.'),
    more('sh-nohup', 'nohup {cmd} &', 'Keep a command running after you log out', 'sh-proc',
      'nohup ./backup.sh &', 'Output goes to nohup.out.'),
    // System
    more('sh-df', 'df -h', 'Show free disk space per drive', 'sh-sys',
      'df -h', '-h = human-readable sizes.'),
    more('sh-du', 'du -sh {dir}', 'Show how big a folder is', 'sh-sys',
      'du -sh ~/Downloads', 'du -sh * shows every item in the current folder.'),
    more('sh-free', 'free -h', 'Show memory usage', 'sh-sys',
      'free -h', '"available" is the number that matters.'),
    more('sh-uname', 'uname -a', 'Show the kernel and system version', 'sh-sys',
      'uname -a', 'cat /etc/os-release names the distribution.'),
    more('sh-uptime', 'uptime', 'Show how long the machine has been running, and its load', 'sh-sys',
      'uptime', 'Load averages over 1, 5 and 15 minutes.'),
    more('sh-date', 'date', 'Print the current date and time', 'sh-sys',
      'date', "date +%F prints just 2026-09-16."),
    more('sh-env', 'env', 'List every environment variable', 'sh-sys',
      'env | grep PATH', 'echo $VAR prints one of them.'),
    more('sh-export', 'export {VAR}={value}', 'Set an environment variable for this session', 'sh-sys',
      'export EDITOR=nano', 'Put it in ~/.bashrc to make it permanent.'),
    more('sh-systemctl', 'systemctl status {service}', 'Check whether a service is running', 'sh-sys',
      'systemctl status nginx', 'sudo systemctl restart nginx restarts it; enable starts it at boot.'),
    more('sh-journalctl', 'journalctl -u {service}', 'Read a service\'s logs', 'sh-sys',
      'journalctl -u nginx -f', '-f follows live, -n 50 shows the last 50 lines.'),
    more('sh-shutdown', 'sudo shutdown now', 'Shut the machine down', 'sh-sys',
      'sudo shutdown now', 'sudo reboot restarts it instead.'),
    // Network
    more('sh-curl', 'curl {url}', 'Fetch a web page or API response', 'sh-net',
      'curl https://api.github.com', 'Prints to the screen. -O saves the file with its own name.'),
    more('sh-wget', 'wget {url}', 'Download a file', 'sh-net',
      'wget https://example.com/file.zip', 'Resumes with -c if the connection drops.'),
    more('sh-scp', 'scp {file} {user}@{host}:{path}', 'Copy a file to another machine', 'sh-net',
      'scp site.tar.gz pi@192.168.1.20:~/', 'Swap the arguments to copy from the machine instead.'),
    more('sh-ip', 'ip a', 'Show your network interfaces and IP addresses', 'sh-net',
      'ip a', 'hostname -I prints just the addresses.'),
    more('sh-ss', 'ss -tulpn', 'Show which programs are listening on which ports', 'sh-net',
      'sudo ss -tulpn', 't = tcp, u = udp, l = listening, p = program, n = numeric.'),
    // Packages
    more('sh-apt-update', 'sudo apt update', 'Refresh the list of available packages', 'sh-pkg',
      'sudo apt update', 'Downloads the catalog — does not install anything.'),
    more('sh-apt-upgrade', 'sudo apt upgrade', 'Upgrade every installed package', 'sh-pkg',
      'sudo apt upgrade', 'Run update first, then upgrade.'),
    more('sh-apt-remove', 'sudo apt remove {pkg}', 'Uninstall software', 'sh-pkg',
      'sudo apt remove tree', 'sudo apt autoremove clears the leftovers.'),
    more('sh-apt-search', 'apt search {word}', 'Look for a package by name', 'sh-pkg',
      'apt search image editor', 'apt show pkg gives the details.'),
    // Shell tricks
    more('sh-and', '{cmd1} && {cmd2}', 'Run the second command only if the first succeeded', 'sh-shell',
      'mkdir build && cd build', '|| runs the second one only if the first FAILED.'),
    more('sh-semicolon', '{cmd1}; {cmd2}', 'Run two commands one after the other, regardless', 'sh-shell',
      'cd ..; ls', 'Unlike &&, the second runs even if the first fails.'),
    more('sh-append', '{cmd} >> {file}', 'Append a command\'s output to a file', 'sh-shell',
      'date >> visits.log', 'Two arrows add to the end; one arrow overwrites.'),
    more('sh-stderr', '{cmd} 2> {file}', 'Send only the error messages to a file', 'sh-shell',
      'make 2> errors.txt', '2>&1 merges errors into the normal output.'),
    more('sh-bangbang', '!!', 'Repeat the last command', 'sh-shell',
      'sudo !!', 'The classic: forgot sudo? sudo !! re-runs it as root.'),
    more('sh-alias', 'alias {name}=\'{cmd}\'', 'Make a short name for a long command', 'sh-shell',
      "alias ll='ls -la'", 'Put it in ~/.bashrc to keep it.'),
    more('sh-glob', '{cmd} *.{ext}', 'Match many files at once with a wildcard', 'sh-shell',
      'rm *.tmp', '* matches anything, ? one character.'),
    more('sh-tee', '{cmd} | tee {file}', 'Show output on screen AND save it to a file', 'sh-shell',
      'make | tee build.log', 'A pipe fitting that splits the stream in two.'),
    more('sh-watch', 'watch {cmd}', 'Re-run a command every two seconds', 'sh-shell',
      'watch df -h', '-n 5 changes the interval. Ctrl+C stops.'),
    more('sh-exit', 'exit', 'Close the shell or log out of a remote machine', 'sh-shell',
      'exit', 'Ctrl+D does the same.'),
    key('sh-ctrl-l', ['Ctrl', 'L'], 'Clear the screen without losing what you typed', 'sh-shell',
      'Same as clear, one keystroke.', 'more'),
    key('sh-ctrl-a', ['Ctrl', 'A'], 'Jump to the start of the line', 'sh-shell',
      'Ctrl+E jumps to the end. Faster than holding an arrow key.', 'more'),
    key('sh-ctrl-w', ['Ctrl', 'W'], 'Delete the word before the cursor', 'sh-shell',
      'Ctrl+U wipes the whole line.', 'more'),
    key('sh-ctrl-d', ['Ctrl', 'D'], 'Log out / close the shell', 'sh-shell',
      'Sends end-of-input. Same as typing exit.', 'more'),
  ];

  var LEVELS = [
    { id: 'essential', title: 'Essentials', sub: 'the commands you will type every day' },
    { id: 'more', title: 'More', sub: 'the rest worth knowing, once the essentials feel natural' },
  ];

  TT.terminalData = {
    CATEGORIES: CATEGORIES,
    categoryLabel: categoryLabel,
    COMMANDS: COMMANDS,
    LEVELS: LEVELS
  };
})();

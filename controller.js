(() => {
    if (globalThis.ccbpControllerLoaded) return; globalThis.ccbpControllerLoaded = true;
    const N = ccbpNav, KEY = 'ccbp-helper-run-v6'; let run = null, busy = false, starting = false, epoch = 0, status = 'Ready.', logs = [], lastURL = location.href, navigating = false;
    let leaving = false;
    addEventListener('pagehide', () => { leaving = true; });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let checkpoint = Promise.resolve();
    function persist() {
        const state = JSON.stringify({ run, status, logs }); sessionStorage.setItem(KEY, state);
        checkpoint = checkpoint.then(async () => { const r = await chrome.runtime.sendMessage({ type: 'run-save', state }); if (r?.error) throw Error(r.error); });
        checkpoint.catch(() => { });
    }
    globalThis.ccbpLog = message => { logs.push({ time: new Date().toLocaleTimeString(), message }); logs = logs.slice(-250); persist(); };
    function say(s) { status = s; ccbpLog(s); }
    function guard(t) { if (t !== epoch || !run?.active) throw Error('Stopped'); if (location.hostname !== 'learning.ccbp.in') throw Error('Left the learning portal'); if (N.course() && N.courseId(location.href) !== run.courseId && run.settings.scope === 'course') throw Error('Course changed; stopped'); }
    async function waitFor(fn, t, timeout = 20000) { const end = Date.now() + timeout; while (Date.now() < end) { guard(t); if (await fn()) return; await sleep(60); } throw Error('Page did not reach the expected screen. Stopped without guessing.'); }
    function phase(p) { run.phase = p; persist(); }
    async function click(e, t) {
        await checkpoint;
        guard(t);
        if (!e || e.disabled) throw Error('Expected navigation control unavailable');
        try { e.scrollIntoView({ block: 'nearest' }); } catch {}
        const opts = { bubbles: true, cancelable: true, view: window };
        e.dispatchEvent(new PointerEvent('pointerdown', opts));
        e.dispatchEvent(new MouseEvent('mousedown', opts));
        e.dispatchEvent(new PointerEvent('pointerup', opts));
        e.dispatchEvent(new MouseEvent('mouseup', opts));
        if (typeof e.click === 'function') {
            e.click();
        } else {
            e.dispatchEvent(new MouseEvent('click', opts));
        }
    }
    function finish(message) { if (run) run.active = false; say(message); }
    function stop() { epoch++; if (run) run.active = false; ccbpMCQ.stop(); ccbpCoding.stop(); say('Stopped. No further actions will be started.'); }
    function atList() {
        if (ccbpMCQ.detected() || ccbpCoding.detected() || N.startButton() || N.proceedButton?.()) return false;
        if (run?.settings?.scope === 'course') {
            return N.course() && N.modules().length > 0;
        }
        return N.problems().length > 0 || (N.course() && N.modules().length > 0);
    }
    async function returnToList(t) {
        if (atList()) return;
        phase('return');
        const destination = run.returnUrl || run.home;
        const proceed = N.proceedButton?.();
        if (proceed) {
            say('Practice finished; returning…');
            await click(proceed, t);
            for (let i = 0; i < 32; i++) {
                guard(t);
                if (atList()) return;
                if (location.pathname === '/course' || N.problems().length > 0) {
                    await sleep(400);
                    if (atList()) return;
                }
                await sleep(250);
            }
        }
        if (atList()) return;
        const back = N.backButton();
        if (back) {
            say('Returning to course…');
            const before = location.href;
            await click(back, t);
            for (let i = 0; i < 32; i++) {
                guard(t);
                if (N.saveButton()) await click(N.saveButton(), t);
                if (atList()) return;
                if (location.href !== before) {
                    await sleep(400);
                    if (atList()) return;
                }
                await sleep(250);
            }
        }
        if (atList()) return;
        // Return only to the actual course/list address recorded before opening this item.
        let target; try { target = new URL(destination); } catch { }
        if (!target || target.origin !== 'https://learning.ccbp.in' || (run.settings.scope === 'course' && target.pathname !== '/course')) {
            target = new URL(run.home || 'https://learning.ccbp.in/course');
        }
        if (ccbpCoding.detected()) {
            const saved = await ccbpCoding.save?.();
            if (saved === false) throw Error('Could not save code before returning. Use the portal save button, then go back.');
        }
        await checkpoint; guard(t);
        if (location.href !== target.href) {
            say('Navigating back to course…');
            navigating = true; location.assign(target.href);
        }
    }
    async function solve(t) {
        let type = null;
        if (run.phase === 'opening-problem' || run.settings.scope === 'coding-list') {
            type = 'coding';
        } else if (run.phase === 'opening-mcq') {
            type = 'mcq';
        } else {
            type = ccbpCoding.detected() ? 'coding' : ccbpMCQ.detected() ? 'mcq' : null;
        }
        if (!type) throw Error('No supported practice on this page');
        phase('solving'); say('Solving ' + type + ' practice…');
        const result = await (type === 'coding' ? ccbpCoding.start() : ccbpMCQ.start());
        guard(t);
        ccbpLog((type === 'coding' ? ccbpCoding : ccbpMCQ).status());
        if (run.settings.scope === 'current') { finish(result?.error ? 'Stopped: ' + result.error : result?.skipped ? 'Skipped: ' + result.reason : 'Current practice finished.'); return; }
        if (result?.error) throw Error(result.error);
        if (result?.skipped) { run.skipped++; ccbpLog(result.reason || 'Unsupported practice skipped.'); }
        else if (result?.exhausted) { run.skipped++; ccbpLog('Attempt limit reached; this problem is skipped for the remainder of this run.'); }
        else run.finished++;
        run.afterReturn = (run.settings.scope === 'course' || type === 'mcq') ? 'course' : 'list'; persist();
        if (type === 'coding') { await returnToList(t); if (!navigating) phase(run.afterReturn); }
        else { await returnToList(t); if (!navigating) phase(run.afterReturn); }
    }
    async function step(t) {
        guard(t);
        if (run.phase === 'subject') {
            if (ccbpCoding.detected()) {
                run.afterReturn = 'subject'; await returnToList(t); phase('subject'); return;
            }
            if (N.course() && run.currentCourseName) {
                run.courseId = N.courseId(location.href); run.visitedModules = []; run.visitedPractices = []; run.visitedProblems = [];
                const expanded = N.modules().find(m => m.expanded);
                run.module = expanded?.name || ''; if (expanded) run.visitedModules.push(expanded.name);
                phase('course'); return;
            }
            const result = await ccbpSubjects.advance(run, () => guard(t), persist);
            if (result?.navigating) navigating = true;
            if (result?.done) finish('Subject pass finished. See Activity for completed and skipped items.');
            return;
        }
        if (run.phase === 'opening-problem') {
            await waitFor(() => ccbpCoding.detected(), t, 20000);
            await solve(t);
            return;
        }
        if (run.phase === 'opening-mcq') {
            await waitFor(() => ccbpMCQ.detected(), t, 20000);
            await solve(t);
            return;
        }
        if (run.phase === 'return') {
            await returnToList(t);
            if (navigating) return;
            if (N.saveButton()) await click(N.saveButton(), t);
            await waitFor(() => atList(), t, 20000);
            phase(run.afterReturn || (run.settings.scope === 'course' ? 'course' : 'list'));
            return;
        }
        if (run.phase === 'open-practice') {
            const isCodingP = N.isCoding ? N.isCoding(run.practiceType) : /Coding/i.test(run.practiceType || '');
            if (isCodingP) {
                phase('list');
                return;
            }
            if (ccbpMCQ.detected()) {
                phase('opening-mcq');
                await solve(t);
                return;
            }
            await waitFor(() => N.startButton() || ccbpMCQ.detected(), t, 15000);
            await sleep(400); guard(t);
            if (ccbpMCQ.detected()) {
                phase('opening-mcq');
                await solve(t);
                return;
            }
            const start = N.startButton();
            if (!start) {
                if (ccbpMCQ.detected()) { phase('opening-mcq'); await solve(t); return; }
                throw Error('Start or Restart not found for ' + run.practiceType);
            }
            run.returnUrl = location.href; phase('opening-mcq');
            await click(start, t);
            return;
        }
        if (run.phase === 'list') {
            if (!N.problems().length) {
                await waitFor(() => N.problems().length > 0, t, 10000);
            }
            const rows = N.problems();
            if (!rows.length) throw Error('No coding problem rows recognized. Use Scan current page.');
            const problemKey = x => location.href + '|' + x.key;
            const next = rows.find(x => !x.completed && !run.visitedProblems.includes(problemKey(x)));
            if (next) {
                run.returnUrl = location.href; run.visitedProblems.push(problemKey(next));
                phase('opening-problem');
                say('Opening ' + next.name);
                await click(next.target, t);
                return;
            }
            if (run.settings.scope === 'coding-list') {
                finish('Coding list finished. Completed and skipped problems are recorded in Activity.');
                return;
            }
            phase('course');
            return;
        }
        if (run.phase === 'course') {
            if (!N.course()) throw Error('Course mode needs the course page');
            const eligible = p => (N.isCoding ? (N.isCoding(p.name) ? run.settings.includeCoding : run.settings.includeMCQ) : (/Coding/i.test(p.name) ? run.settings.includeCoding : run.settings.includeMCQ));

            // 1. Check current module for incomplete practices
            if (run.module) {
                const practices = N.practices(run.module);
                const unknown = practices.find(p => eligible(p) && p.completed === null);
                if (unknown) { ccbpLog('Unknown completion marker for ' + unknown.name + '; treating as incomplete.'); unknown.completed = false; }
                const p = practices.find(p => eligible(p) && !p.completed && !run.visitedPractices.includes(run.module + '|' + p.key));
                if (p) {
                    run.visitedPractices.push(run.module + '|' + p.key);
                    run.practiceType = p.name;
                    phase('open-practice');
                    say('Opening ' + p.name + ' in ' + run.module);
                    await click(p.target, t);
                    return;
                }
            }

            // 2. Find next module to scan
            const modules = N.modules();
            if (!modules.length) {
                const allPractices = N.practices();
                const nextP = allPractices.find(item => eligible(item) && !item.completed && !run.visitedPractices.includes('|' + item.key));
                if (nextP) {
                    run.visitedPractices.push('|' + nextP.key);
                    run.practiceType = nextP.name;
                    phase('open-practice');
                    say('Opening ' + nextP.name);
                    await click(nextP.target, t);
                    return;
                }
                if (allPractices.length && allPractices.every(item => !eligible(item) || item.completed)) {
                    finish('Course pass finished. All recognized eligible practices are complete.');
                    return;
                }
                throw Error('Module dropdowns were not recognized. Use Scan current page.');
            }

            const next = modules.find(m => !run.visitedModules.includes(m.name));
            if (!next) {
                if (run.settings.scope === 'subject') {
                    run.visitedCourses.push(run.currentCourseName);
                    run.currentCourseName = null;
                    say('Finished course pass; checking the next course in ' + run.settings.subject);
                    phase('subject');
                    return;
                }
                finish('Course pass finished. All recognized eligible practices were visited; skipped items remain incomplete.');
                return;
            }

            run.module = next.name;
            persist();
            say('Scanning module: ' + next.name);

            // 3. Expand the module if not already expanded
            if (!next.expanded) {
                try { next.node.scrollIntoView({ block: 'center' }); } catch {}
                await sleep(250); guard(t);

                const targetToClick = next.chevron || next.target || next.node;
                await click(targetToClick, t);
                await sleep(700); guard(t);

                const updatedMods = N.modules();
                const currentMod = updatedMods.find(m => m.name === next.name);
                if (currentMod && !currentMod.expanded) {
                    const altTarget = (targetToClick === next.chevron) ? (next.target || next.node) : (next.chevron || next.node);
                    if (altTarget && altTarget !== targetToClick) {
                        await click(altTarget, t);
                        await sleep(700); guard(t);
                    }
                }
            }

            // 4. Inspect practices in this module
            const practicesNow = N.practices(next.name);
            const uncompleted = practicesNow.find(p => eligible(p) && !p.completed && !run.visitedPractices.includes(next.name + '|' + p.key));
            if (uncompleted) {
                run.visitedPractices.push(next.name + '|' + uncompleted.key);
                run.practiceType = uncompleted.name;
                phase('open-practice');
                say('Opening ' + uncompleted.name + ' in ' + next.name);
                await click(uncompleted.target, t);
                return;
            }

            // Mark as visited only after checking practices
            run.visitedModules.push(next.name);
            persist();
            if (!practicesNow.length) {
                ccbpLog('No eligible practices in ' + next.name + '; continuing.');
            } else {
                ccbpLog('All practices in ' + next.name + ' are already completed; continuing.');
            }
            await sleep(200);
        }
    }
    async function pump() { if (busy || !run?.active) return; busy = true; const t = epoch; try { while (run?.active && t === epoch && !navigating && !leaving) { await step(t); await sleep(run?.settings.delay || 100); } } catch (e) { if (t === epoch && !leaving) finish('Stopped: ' + e.message); } finally { busy = false; } }
    async function start() {
        if (restoring) throw Error('Restoring the run; try again in a moment.');
        if (busy || starting || run?.active) throw Error('A run is already active. Stop it before starting another.');
        starting = true; const before = epoch; let settings; try { settings = await Helper.settings(); } finally { starting = false; } if (before !== epoch) throw Error('Stopped');
        if (settings.scope === 'course' && !N.course()) throw Error('Open the course page first, then Start.');
        if (settings.scope === 'coding-list' && !N.problems().length && !N.course() && !ccbpCoding.detected()) throw Error('Open a coding practice list first.');
        if (settings.scope === 'current' && !ccbpCoding.detected() && !ccbpMCQ.detected() && !N.startButton()) throw Error('Open a practice question first.');
        if (settings.scope === 'subject' && !settings.subject?.trim()) throw Error('Choose a subject first.');
        epoch++; logs = []; navigating = false;
        let initPhase = 'course';
        if (settings.scope === 'subject') initPhase = 'subject';
        else if (settings.scope === 'coding-list') {
            initPhase = (ccbpCoding.detected() && !N.problems().length) ? 'opening-problem' : 'list';
        } else if (settings.scope === 'current') {
            initPhase = ccbpCoding.detected() ? 'opening-problem' : N.startButton() ? 'open-practice' : 'opening-mcq';
        } else if (settings.scope === 'course') {
            if (ccbpCoding.detected() && !N.problems().length) initPhase = 'opening-problem';
            else if (N.problems().length > 0) initPhase = 'list';
            else if (ccbpMCQ.detected()) initPhase = 'opening-mcq';
            else if (N.startButton()) initPhase = 'open-practice';
            else initPhase = 'course';
        }
        run = { active: true, settings, finished: 0, skipped: 0, courseId: N.courseId(location.href), home: location.href, phase: initPhase, module: '', visitedModules: [], visitedPractices: [], visitedProblems: [], visitedCourses: [], discoveryTopics: [] };
        const expanded = N.modules().find(m => m.expanded); if (expanded) { run.module = expanded.name; }
        say('Started: ' + settings.scope); void pump();
    }
    function currentStatus() { if (run?.active) { if (ccbpCoding.running()) return ccbpCoding.status(); if (ccbpMCQ.running()) return ccbpMCQ.status(); } return status; }
    chrome.runtime.onMessage.addListener((msg, sender, reply) => {
        if (!['start', 'stop', 'status', 'scan'].includes(msg.action)) return;
        if (msg.action === 'start') { start().then(() => reply({ status: currentStatus() })).catch(e => reply({ error: e.message })); return true; }
        if (msg.action === 'stop') stop();
        try { reply({ status: currentStatus(), active: !!run?.active, finished: run?.finished || 0, skipped: run?.skipped || 0, log: logs, scan: msg.action === 'scan' ? N.scan() : undefined }); } catch (e) { reply({ error: e.message }); }
    });
    let restoring = true;
    async function restore() {
        try {
            const remote = await chrome.runtime.sendMessage({ type: 'run-load' });
            const saved = JSON.parse(remote?.state || sessionStorage.getItem(KEY) || 'null');
            if (saved) {
                ({ run, status, logs } = saved); if (run?.active) {
                    if (run.phase === 'solving') { run.active = false; status = 'Page reloaded during solving. Check the page before starting again.'; persist(); }
                    else setTimeout(() => void pump(), 1200);
                }
            }
        } catch (e) { status = 'Could not restore the previous run: ' + e.message; }
        finally { restoring = false; }
    }
    void restore();
    setInterval(() => { if (location.href !== lastURL) { lastURL = location.href; if (run?.active && !busy && !leaving && !navigating) void pump(); } }, 600);
})();

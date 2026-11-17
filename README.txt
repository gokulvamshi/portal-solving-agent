CCBP Local Practice Helper 0.7.1

UPDATE
1. Stop the helper.
2. Extract this ZIP and replace the files in the SAME extension folder.
3. Open chrome://extensions and click Reload on Practice Helper.
4. Refresh the learning portal and reopen the helper dashboard.
5. Model fields switch once to the speed-first defaults below.
   Check the fields and click Save settings.
6. Choose your scope and click Start.

FEATURES
- Handles the completed-MCQ Proceed dialog.
- Recognizes nested practice headers and records the course/list address before
  opening a problem. Falls back to that verified address after completion.
- Saves with Yes when the portal asks; accepted submissions are already stored.
- Supported self-contained Python output questions run through bundled Python
  3.10.2 before option matching. This preserves punctuation, case, slicing and
  actual runtime exceptions. Exact matches avoid model calls. Other questions
  retain the selected one/three model answers and majority-vote behavior.
- HTML, CSS and JavaScript practices: reads and backs up all three tabs,
  verifies each tab before writing, submits, reads Total/Passed/Failed counts,
  and retries using failed-test messages up to the configured attempt limit.
- Image input is restricted to MCQ option images in 0.7.1.
- Image practices that cannot be read are recorded as skipped in course/list
  mode; the run continues. They are not marked completed.

SPEED-FIRST DEFAULTS (0.7.1)
Normal MCQs and Python/web coding: qwen3-vl:4b-instruct.
Only MCQs with image options: qwen3-vl:4b-thinking.
Both are installed on this laptop. qwen3:8b remains removed.
One answer per MCQ; thinking off for normal text and coding.
This implements a speed preference, not a numerical accuracy guarantee.
The defaults migrate once; later manually saved settings remain yours.

No image payloads are sent for web coding or normal MCQs. Only option images
are collected for MCQs; question-only diagrams are not sent in this mode.
Web practices read the written requirements, resource URLs and starter files,
produce concise HTML/CSS/JavaScript, submit, wait for a fresh test result,
and use failed-test feedback to repair the code up to the attempt limit.
Reference pictures/videos are not analyzed. Visual-only requirements may be
missed; the helper relies on text and exposed test feedback in this mode.
Image URLs remain ordinary text resources for generated img elements.

If MCQ image access is needed, use Allow images on this practice page.
Requests go to localhost:11434. The Thinking model always reasons and remains
slower; it is reserved for MCQ image options. Instruct avoids that long phase.
Model: https://ollama.com/library/qwen3-vl:4b-instruct

SCOPE
Current practice, coding list, course, and selected-subject modes remain.
Only MCQ Practice and Coding Practice are included. Classroom/module quizzes,
videos, and reading materials are excluded. Each practice is visited once per
run. Skipped or failed practices remain incomplete on the portal.

PYTHON OUTPUT CHECK
The bundled runtime supports deterministic introductory Python, including
functions, loops, lists, strings, slicing and exception detection. It rejects
imports, input(), file/network access, reflection and unsupported features.
Workers have execution/output limits and run without portal access. When the
code is unsupported, the model remains the fallback. Ambiguous option matches
are not silently normalized. Three model votes are still used for other
questions when selected. No model or runtime coverage guarantees all answers.
Runtime startup adds a small initial delay but avoids lengthy model calls for
supported code-output questions.

SMALL LOCAL SPEED CHECKS
Using the extension's actual model request code on this laptop:
- Text MCQ: 7.2 seconds cold; 0.8 seconds with model/prompt cache warm.
- Minimal web page first attempt: 5.7 seconds.
- Repair using supplied failed-test feedback: 5.3 seconds.
These are small examples, not full portal runs or guaranteed timings. Larger
problems take longer. The first attempt and repair returned separate HTML/CSS
files and empty JavaScript when no interaction was required.

VALIDATION
Automated tests cover navigation/save/return persistence, MCQ selection,
image option mappings, all three web editors, failed-test repair, test-result
freshness, stop behavior and Python exact output. Bundled Python executed the
reported NameError, string-case, punctuation and slicing examples correctly.
The Chrome page was read. Browser automation cannot open Chrome's extension
management page, so the user must reload the installed extension.
A full live portal run of the new release has NOT been verified. Inspect the
first completed practice and its return transition after installing.

BACKUPS AND TROUBLESHOOTING
Activity contains transitions, votes, model execution audits and skipped reasons.
Original Python code is saved in the portal tab's sessionStorage under
ccbp-helper-backup:<URL>; web files under ccbp-helper-web-backup:<URL>.
Keep Ollama running, the portal tab open, and Windows awake. The Windows PDF
covers installation and changing/removing models; this README covers new
0.7.1 features. Hidden test inputs are not accessed.

THIRD-PARTY RUNTIME
Pyodide 0.22.1: https://pyodide.org/en/0.22.1/
Python 3.10.2: https://www.python.org/downloads/release/python-3102/
Bundled runtime licenses are in python-runtime/. All runtime files are local;
no remote executable code is downloaded while solving.

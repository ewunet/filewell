/*
 * Filewell: tax return customer portal prototype
 * Plain JavaScript, no build step. State is kept in localStorage so the
 * demo remembers progress between visits. Use "Reset demo" to start over.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'filewell-demo-v1';
  const MAX_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const ACCEPTED_EXT = /\.(pdf|jpe?g|png)$/i;

  const STAGES = [
    'Documents received',
    'Preparer review',
    'Your approval',
    'Filed with the IRS',
    'Refund sent'
  ];

  const DEFAULT_STATE = {
    requests: [
      {
        id: 'w2-second',
        title: 'W-2 from your second employer',
        why: 'Your bank deposits show pay from two employers, and we only have one W-2 so far.',
        status: 'open',
        sentOn: null
      },
      {
        id: '1098e',
        title: 'Student loan interest statement (Form 1098-E)',
        why: 'You may be able to deduct the interest you paid on student loans this year.',
        status: 'open',
        sentOn: null
      },
      {
        id: 'photo-id',
        title: 'Photo ID',
        why: 'We verify your identity before we file.',
        status: 'sent',
        sentOn: '2026-02-03'
      }
    ],
    approved: false,
    filedOn: null
  };

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>'
  };

  /* ---------- State ---------- */

  const clone = (obj) => JSON.parse(JSON.stringify(obj));

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable: fall back to defaults */ }
    return clone(DEFAULT_STATE);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable: demo still works for this visit */ }
  }

  let state = loadState();
  let wiz = null;            // wizard state for "Send a document"
  let approveError = '';
  let section = 'home';

  const openRequests = () => state.requests.filter((r) => r.status === 'open');
  const findRequest = (id) => state.requests.find((r) => r.id === id);

  function getProgress() {
    const open = openRequests();
    if (open.length) return { current: 1, waiting: true, note: 'Waiting on your documents', open };
    if (!state.approved) return { current: 2, waiting: true, note: 'Waiting on you', open };
    return { current: 4, waiting: false, note: 'Usually within 21 days', open };
  }

  /* ---------- Helpers ---------- */

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function todayISO() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function fmtDate(iso) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ---------- Shared components ---------- */

  function trackerHTML(p) {
    const steps = STAGES.map((name, i) => {
      const status = i < p.current ? 'done' : i === p.current ? 'current' : 'upcoming';
      const note = status === 'done' ? 'Done' : status === 'current' ? p.note : 'Not started';
      const waitingClass = status === 'current' && p.waiting ? ' is-waiting' : '';
      return `
        <li class="tracker__step is-${status}${waitingClass}" ${status === 'current' ? 'aria-current="step"' : ''}>
          <span class="tracker__dot" aria-hidden="true">${status === 'done' ? ICON.check : ''}</span>
          <span class="tracker__label">${name}</span>
          <span class="tracker__note">${note}</span>
        </li>`;
    }).join('');
    return `<ol class="tracker">${steps}</ol>`;
  }

  function nextStepHTML(p) {
    if (p.open.length) {
      return `
        <section class="next-step is-waiting" aria-labelledby="next-title">
          <div>
            <span class="badge badge--waiting">Waiting on you</span>
            <h2 id="next-title">Send ${plural(p.open.length, 'more document')}</h2>
            <p>Your preparer needs ${p.open.length === 1 ? 'it' : 'these'} to finish your return. It takes about two minutes.</p>
          </div>
          <a class="btn btn--primary" href="#/send/${p.open[0].id}">${p.open.length === 1 ? 'Send document' : 'Send documents'}</a>
        </section>`;
    }
    if (!state.approved) {
      return `
        <section class="next-step is-waiting" aria-labelledby="next-title">
          <div>
            <span class="badge badge--waiting">Waiting on you</span>
            <h2 id="next-title">Your return is ready to review</h2>
            <p>Check the summary and approve it so we can file.</p>
          </div>
          <a class="btn btn--primary" href="#/approve">Review return</a>
        </section>`;
    }
    return `
      <section class="next-step" aria-labelledby="next-title">
        <div>
          <span class="badge badge--done">Filed</span>
          <h2 id="next-title">You're all set</h2>
          <p>We filed your return on ${fmtDate(state.filedOn)}. Most refunds arrive within 21 days of filing. We'll email you when yours is sent.</p>
        </div>
      </section>`;
  }

  function requestsHTML() {
    const items = state.requests.map((r) => `
      <li class="request">
        <div>
          <h3 class="request__title">${esc(r.title)}</h3>
          <p class="request__why">${esc(r.why)}</p>
        </div>
        <div class="request__side">
          ${r.status === 'open'
            ? `<span class="badge badge--waiting">Needed</span>
               <a class="btn btn--secondary" href="#/send/${r.id}">Send document<span class="sr-only">: ${esc(r.title)}</span></a>`
            : `<span class="badge badge--done">Sent ${fmtDate(r.sentOn)}</span>`}
        </div>
      </li>`).join('');
    return `<ul class="requests">${items}</ul>`;
  }

  /* ---------- Views ---------- */

  function homeView() {
    const p = getProgress();
    return `
      <div class="page-head">
        <h1 tabindex="-1">Hi, Jordan</h1>
        <p class="lede">Here's where your 2025 tax return stands.</p>
      </div>
      ${nextStepHTML(p)}
      <section class="section" aria-labelledby="progress-title">
        <h2 id="progress-title">Your return's progress</h2>
        <div class="card">${trackerHTML(p)}</div>
      </section>
      <section class="section" aria-labelledby="docs-title">
        <h2 id="docs-title">Documents your preparer asked for</h2>
        ${requestsHTML()}
      </section>`;
  }

  function startWizard(id) {
    const open = openRequests();
    const preselected = open.find((r) => r.id === id);
    wiz = {
      step: preselected ? 2 : 1,
      reqId: preselected ? preselected.id : (open[0] ? open[0].id : null),
      file: null,
      note: '',
      error: ''
    };
  }

  function sendView() {
    const open = openRequests();
    if (!open.length || !wiz || !wiz.reqId) {
      return `
        <a class="back-link" href="#/">Back to home</a>
        <h1 tabindex="-1">Send a document</h1>
        <div class="card notice" style="margin-top:24px">
          <p>Nothing to send right now. Your preparer has every document they asked for, and we'll email you if they need anything else.</p>
          <a class="btn btn--secondary" href="#/">Go to home</a>
        </div>`;
    }

    const labels = ['Choose document', 'Add file', 'Review and send'];
    const stepper = labels.map((label, i) => {
      const n = i + 1;
      const cls = n < wiz.step ? 'is-done' : n === wiz.step ? 'is-current' : '';
      return `
        <li class="stepper__item ${cls}" ${n === wiz.step ? 'aria-current="step"' : ''}>
          <span class="stepper__num" aria-hidden="true">${n < wiz.step ? '&#10003;' : n}</span>
          ${label}<span class="sr-only">${n < wiz.step ? ', done' : ''}</span>
        </li>`;
    }).join('');

    const req = findRequest(wiz.reqId);
    let body = '';

    if (wiz.step === 1) {
      const options = open.map((r) => `
        <label class="choice">
          <input type="radio" name="req" value="${r.id}" ${wiz.reqId === r.id ? 'checked' : ''}>
          <span>
            <span class="choice__title">${esc(r.title)}</span>
            <span class="choice__hint">${esc(r.why)}</span>
          </span>
        </label>`).join('');
      body = `
        <form data-form="choose" novalidate>
          <fieldset>
            <legend><h2 id="step-title" tabindex="-1">Which document are you sending?</h2></legend>
            ${options}
          </fieldset>
          ${wiz.error ? `<p class="field__error" id="choose-error" tabindex="-1">${ICON.alert}${esc(wiz.error)}</p>` : ''}
          <div class="wizard__actions">
            <button class="btn btn--primary" type="submit">Continue</button>
          </div>
        </form>`;
    }

    if (wiz.step === 2) {
      const describedBy = `file-help${wiz.error ? ' file-error' : ''}`;
      const picker = wiz.file
        ? `
          <div class="file-chip">
            <span class="file-chip__icon" aria-hidden="true">${ICON.file}</span>
            <div>
              <div class="file-chip__name">${esc(wiz.file.name)}</div>
              <div class="file-chip__size">${fmtSize(wiz.file.size)}</div>
            </div>
            <button class="btn btn--quiet" type="button" data-action="remove-file">Remove<span class="sr-only"> ${esc(wiz.file.name)}</span></button>
          </div>`
        : `
          <label class="dropzone ${wiz.error ? 'has-error' : ''}" for="file-input">
            <input id="file-input" class="sr-only" type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              aria-describedby="${describedBy}" ${wiz.error ? 'aria-invalid="true"' : ''}>
            <span class="dropzone__icon" aria-hidden="true">${ICON.upload}</span>
            <span class="dropzone__title">Drag a file here or <span class="link">choose a file</span></span>
          </label>`;
      body = `
        <form data-form="file" novalidate>
          <h2 id="step-title" tabindex="-1">Add your ${esc(req.title)}</h2>
          <p class="muted" id="file-help">PDF, JPG, or PNG, up to 10 MB. A clear photo from your phone works.</p>
          ${picker}
          ${wiz.error ? `<p class="field__error" id="file-error">${ICON.alert}${esc(wiz.error)}</p>` : ''}
          <div class="wizard__actions">
            <button class="btn btn--quiet" type="button" data-action="back">Back</button>
            <button class="btn btn--primary" type="submit">Continue</button>
          </div>
        </form>`;
    }

    if (wiz.step === 3) {
      body = `
        <form data-form="review" novalidate>
          <h2 id="step-title" tabindex="-1">Review and send</h2>
          <dl class="summary" style="margin-top:16px">
            <div><dt>Document</dt><dd>${esc(req.title)}</dd></div>
            <div><dt>File</dt><dd>${esc(wiz.file.name)} (${fmtSize(wiz.file.size)})</dd></div>
          </dl>
          <div class="field">
            <label for="note">Note for your preparer <span class="optional">(optional)</span></label>
            <textarea id="note" rows="3" maxlength="500" aria-describedby="note-hint">${esc(wiz.note)}</textarea>
            <p class="field__hint" id="note-hint">For example: "This W-2 is from my weekend job at the library."</p>
          </div>
          <div class="wizard__actions">
            <button class="btn btn--quiet" type="button" data-action="back">Back</button>
            <button class="btn btn--primary" type="submit">Send document</button>
          </div>
        </form>`;
    }

    return `
      <a class="back-link" href="#/">Back to home</a>
      <h1 tabindex="-1">Send a document</h1>
      <ol class="stepper" aria-label="Steps">${stepper}</ol>
      <div class="card wizard">${body}</div>`;
  }

  function approveView() {
    const open = openRequests();
    const head = `<a class="back-link" href="#/">Back to home</a><h1 tabindex="-1">Review your return</h1>`;

    if (open.length) {
      return `${head}
        <div class="card notice" style="margin-top:24px">
          <p>Your return will be ready to review after you send ${plural(open.length, 'more document')}.</p>
          <a class="btn btn--primary" href="#/send/${open[0].id}">Send documents</a>
        </div>`;
    }

    if (state.approved) {
      return `${head}
        <div class="card notice" style="margin-top:24px">
          <p>You approved your return, and we filed it on ${fmtDate(state.filedOn)}.</p>
          <a class="btn btn--secondary" href="#/">Go to home</a>
        </div>`;
    }

    return `${head}
      <p class="lede">Your preparer, Dana Ruiz, finished your return. Check these numbers before you approve it.</p>
      <div class="card" style="margin-top:24px">
        <dl class="summary">
          <div><dt>Filing status</dt><dd>Single</dd></div>
          <div><dt>Total income</dt><dd>$58,420</dd></div>
          <div><dt>Federal tax withheld</dt><dd>$6,912</dd></div>
          <div><dt>Total tax</dt><dd>$5,628</dd></div>
          <div class="is-total"><dt>Your refund</dt><dd>$1,284</dd></div>
        </dl>
        <form data-form="approve" novalidate>
          <div class="check ${approveError ? 'has-error' : ''}">
            <input type="checkbox" id="confirm" ${approveError ? 'aria-invalid="true" aria-describedby="confirm-error"' : ''}>
            <label for="confirm">I reviewed my return, and the information is correct to the best of my knowledge.</label>
          </div>
          ${approveError ? `<p class="field__error" id="confirm-error">${ICON.alert}${esc(approveError)}</p>` : ''}
          <div class="wizard__actions">
            <a class="btn btn--quiet" href="#/">Not now</a>
            <button class="btn btn--primary" type="submit">Approve and file</button>
          </div>
        </form>
      </div>`;
  }

  function systemView() {
    const colors = [
      ['Ink', '#18263A', 'Text and navigation'],
      ['Ink secondary', '#4A5A70', 'Supporting text'],
      ['Ledger green', '#1F5C4A', 'Primary actions, completed steps'],
      ['Green tint', '#E3EFEA', 'Selected and completed backgrounds'],
      ['Marigold', '#E8A33D', 'Anything waiting on the customer'],
      ['Marigold tint', '#FDF1DC', 'Waiting backgrounds'],
      ['Danger', '#B3261E', 'Errors only'],
      ['Canvas', '#F2F4F7', 'Page background'],
      ['Line', '#D9DFE7', 'Borders and dividers']
    ];
    const swatches = colors.map(([name, hex, use]) => `
      <div class="swatch">
        <div class="swatch__chip" style="background:${hex}"></div>
        <div class="swatch__meta">
          <div class="swatch__name">${name}</div>
          <div class="swatch__hex">${hex}</div>
          <div class="swatch__use">${use}</div>
        </div>
      </div>`).join('');

    const type = [
      ['Page title', '36 / 700', '<h1 style="font-size:2.25rem">Your 2025 return</h1>'],
      ['Section title', '22 / 700', '<p class="h2">Your return\'s progress</p>'],
      ['Card title', '18 / 600', '<p style="font-size:1.125rem;font-weight:600">W-2 from your second employer</p>'],
      ['Body', '16 / 400', '<p>Your preparer needs these to finish your return.</p>'],
      ['Small', '14 / 400', '<p style="font-size:.875rem;color:var(--ink-2)">PDF, JPG, or PNG, up to 10 MB.</p>']
    ].map(([name, spec, sample]) => `
      <div class="type-row">
        <div class="type-row__meta"><strong>${name}</strong><br>${spec}</div>
        ${sample}
      </div>`).join('');

    return `
      <div class="page-head ds-intro">
        <h1 tabindex="-1">Design system</h1>
        <p class="lede">The tokens and components behind Filewell. Every screen in the prototype is built from these pieces.</p>
      </div>

      <section class="ds-section" aria-labelledby="ds-principles">
        <h2 id="ds-principles">Principles</h2>
        <p class="ds-note">Taxes make people anxious. Each principle exists to reduce that.</p>
        <ul class="principles">
          <li><strong>Lead with the next step</strong><span>The home screen answers "what do I need to do?" before anything else.</span></li>
          <li><strong>Marigold means it's your turn</strong><span>One color is reserved for anything waiting on the customer, so it's never ambiguous.</span></li>
          <li><strong>One decision per screen</strong><span>Multi-part tasks are split into short, labeled steps people can go back through.</span></li>
          <li><strong>Plain language</strong><span>Explain why we need something, not just what form number it is.</span></li>
        </ul>
      </section>

      <section class="ds-section" aria-labelledby="ds-color">
        <h2 id="ds-color">Color</h2>
        <p class="ds-note">All text and background pairs meet WCAG 2.1 AA contrast. Status is never shown by color alone; it always has a text label too.</p>
        <div class="swatches">${swatches}</div>
      </section>

      <section class="ds-section" aria-labelledby="ds-type">
        <h2 id="ds-type">Typography</h2>
        <p class="ds-note">Public Sans throughout: a clear, neutral typeface built for public-facing services. Sizes follow a 14, 16, 18, 22, 28, 36 scale.</p>
        ${type}
      </section>

      <section class="ds-section" aria-labelledby="ds-buttons">
        <h2 id="ds-buttons">Buttons</h2>
        <p class="ds-note">One primary button per screen. Every button is at least 44px tall to meet touch target guidance.</p>
        <div class="demo-row">
          <button class="btn btn--primary" type="button">Send document</button>
          <button class="btn btn--secondary" type="button">Review return</button>
          <button class="btn btn--quiet" type="button">Back</button>
          <button class="btn btn--primary" type="button" disabled>Disabled</button>
        </div>
      </section>

      <section class="ds-section" aria-labelledby="ds-status">
        <h2 id="ds-status">Status badges</h2>
        <p class="ds-note">Each badge pairs a color with a word, so status reads correctly for people with color blindness.</p>
        <div class="demo-row">
          <span class="badge badge--waiting">Waiting on you</span>
          <span class="badge badge--done">Sent Feb 3</span>
          <span class="badge badge--neutral">Not started</span>
        </div>
      </section>

      <section class="ds-section" aria-labelledby="ds-forms">
        <h2 id="ds-forms">Form fields</h2>
        <p class="ds-note">Labels sit above fields. Errors say what went wrong and how to fix it.</p>
        <div class="card" style="max-width:520px">
          <div class="field" style="margin-top:0">
            <label for="demo-name">Employer name</label>
            <input class="input" id="demo-name" type="text" value="Northside Library">
          </div>
          <div class="field">
            <label for="demo-ein">Employer ID number</label>
            <input class="input" id="demo-ein" type="text" value="12-34" aria-invalid="true" aria-describedby="demo-ein-error">
            <p class="field__error" id="demo-ein-error">${ICON.alert}Enter all 9 digits, like 12-3456789.</p>
          </div>
        </div>
      </section>

      <section class="ds-section" aria-labelledby="ds-tracker">
        <h2 id="ds-tracker">Progress tracker</h2>
        <p class="ds-note">The signature component. It shows every stage at once, so people always know where they are and what comes next. It stacks vertically on small screens.</p>
        <div class="card">${trackerHTML({ current: 2, waiting: true, note: 'Waiting on you' })}</div>
      </section>`;
  }

  function notFoundView() {
    return `
      <h1 tabindex="-1">We can't find that page</h1>
      <p class="lede">The link may be out of date.</p>
      <p style="margin-top:20px"><a class="btn btn--primary" href="#/">Go to home</a></p>`;
  }

  /* ---------- Rendering and routing ---------- */

  const VIEWS = { home: homeView, send: sendView, approve: approveView, 'design-system': systemView };
  const NAV_KEY = { home: 'home', approve: 'home', send: 'send', 'design-system': 'system' };
  const TITLES = { home: 'Home', send: 'Send a document', approve: 'Review your return', 'design-system': 'Design system' };

  function render(focusSelector) {
    const view = document.getElementById('view');
    view.innerHTML = (VIEWS[section] || notFoundView)();

    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.nav === NAV_KEY[section]) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `${TITLES[section] || 'Page not found'} | Filewell`;

    if (focusSelector) {
      const el = view.querySelector(focusSelector);
      if (el) el.focus();
    }
  }

  let firstLoad = true;

  function router() {
    const hash = location.hash || '#/';
    if (hash === '#main') return;
    const [first, id] = hash.replace(/^#\/?/, '').split('/');
    section = first || 'home';
    if (section === 'send') startWizard(id);
    if (section !== 'approve') approveError = '';

    window.scrollTo(0, 0);
    render(firstLoad ? null : 'h1');
    firstLoad = false;
  }

  function go(hash) {
    if (location.hash === hash) router();
    else location.hash = hash;
  }

  /* ---------- Toast ---------- */

  let toastTimer;
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3500);
  }

  /* ---------- File handling ---------- */

  function takeFile(file) {
    if (!file || !wiz) return;
    const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXT.test(file.name);
    if (!typeOk) {
      wiz.file = null;
      wiz.error = `We can't open "${file.name}". Send a PDF, JPG, or PNG instead.`;
      render('#file-input');
      return;
    }
    if (file.size > MAX_BYTES) {
      wiz.file = null;
      wiz.error = `This file is ${fmtSize(file.size)}. Files can be up to 10 MB. Try saving it as a PDF or taking a smaller photo.`;
      render('#file-input');
      return;
    }
    wiz.file = { name: file.name, size: file.size };
    wiz.error = '';
    render('[data-action="remove-file"]');
  }

  /* ---------- Form handlers ---------- */

  const FORMS = {
    choose(form) {
      const selected = form.querySelector('input[name="req"]:checked');
      if (!selected) {
        wiz.error = 'Choose a document to continue.';
        render('#choose-error');
        return;
      }
      if (selected.value !== wiz.reqId) wiz.file = null;
      wiz.reqId = selected.value;
      wiz.error = '';
      wiz.step = 2;
      render('#step-title');
    },

    file() {
      if (!wiz.file) {
        wiz.error = 'Add a file to continue.';
        render('#file-input');
        return;
      }
      wiz.error = '';
      wiz.step = 3;
      render('#step-title');
    },

    review(form) {
      const req = findRequest(wiz.reqId);
      req.status = 'sent';
      req.sentOn = todayISO();
      req.note = form.querySelector('#note').value.trim();
      saveState();
      const left = openRequests().length;
      wiz = null;
      toast(left ? `Document sent. ${plural(left, 'more document')} to go.` : 'Document sent. Your return is ready to review.');
      go('#/');
    },

    approve(form) {
      if (!form.querySelector('#confirm').checked) {
        approveError = 'Check the box to confirm you reviewed your return.';
        render('#confirm');
        return;
      }
      approveError = '';
      state.approved = true;
      state.filedOn = todayISO();
      saveState();
      toast('Return approved and filed.');
      go('#/');
    }
  };

  /* ---------- Click actions ---------- */

  const ACTIONS = {
    skip(el, event) {
      event.preventDefault();
      document.getElementById('main').focus();
    },
    back() {
      const note = document.getElementById('note');
      if (note) wiz.note = note.value;
      wiz.error = '';
      wiz.step = Math.max(1, wiz.step - 1);
      render('#step-title');
    },
    'remove-file'() {
      wiz.file = null;
      render('#file-input');
    },
    reset() {
      state = clone(DEFAULT_STATE);
      saveState();
      wiz = null;
      approveError = '';
      toast('Demo reset.');
      go('#/');
    }
  };

  /* ---------- Event wiring ---------- */

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-form]');
    if (!form) return;
    event.preventDefault();
    FORMS[form.dataset.form](form);
  });

  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    ACTIONS[el.dataset.action](el, event);
  });

  document.addEventListener('change', (event) => {
    if (event.target.id === 'file-input') takeFile(event.target.files[0]);
    if (event.target.name === 'req' && wiz) wiz.reqId = event.target.value;
  });

  // Drag and drop. Default handling is blocked everywhere so a missed drop
  // doesn't navigate the browser away to the file.
  document.addEventListener('dragover', (event) => {
    event.preventDefault();
    const zone = event.target.closest && event.target.closest('.dropzone');
    if (zone) zone.classList.add('is-dragging');
  });
  document.addEventListener('dragleave', (event) => {
    const zone = event.target.closest && event.target.closest('.dropzone');
    if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('is-dragging');
  });
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    const zone = event.target.closest && event.target.closest('.dropzone');
    if (zone && event.dataTransfer.files.length) takeFile(event.dataTransfer.files[0]);
  });

  window.addEventListener('hashchange', router);
  router();
})();

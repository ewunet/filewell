# Filewell: Tax Return Customer Portal

A UX/UI concept prototype for a customer-facing web app that helps people send tax documents to their preparer, track their return, and approve it for filing.

**Live prototype:** [add your GitHub Pages or Netlify link here]
**Figma file:** [add your Figma link here]

> Concept project. Filewell is a fictional company, and all names and numbers are made up. Not affiliated with the IRS or any tax preparation business.

---

## The problem

Getting your taxes done by a preparer usually means a long back-and-forth: emailed requests for documents, unclear status, and no idea what's holding things up. People end up asking "Where's my return?" and "What do you still need from me?"

Filewell is designed to answer those two questions the moment someone logs in.

## Who it's for

People who use a tax preparer and want their taxes handled with as little stress as possible. Many aren't comfortable with tax forms, and many will be on their phone.

## Key design decisions

**Lead with the next step.** The home screen opens with a single "next step" panel that tells you what to do and gives you one button to do it. Status details come second.

**A progress tracker that shows the whole journey.** Every stage, from documents received to refund sent, is visible at once, so people always know where they are and what comes next. It stacks vertically on mobile.

**One color means "it's your turn."** Marigold is reserved for anything waiting on the customer. Green means done. Status always has a text label too, so it never relies on color alone.

**Break complex tasks into short steps.** Sending a document is a three-step flow (choose, add file, review and send). If you start from a specific request, the first step is skipped because the choice has already been made.

**Explain the "why."** Each document request says why it's needed in plain language, such as "You may be able to deduct the interest you paid on student loans," instead of only a form number.

**Errors that help.** Error messages say what went wrong and how to fix it, for example: "This file is 14.2 MB. Files can be up to 10 MB. Try saving it as a PDF or taking a smaller photo."

## Features

- Home dashboard with a next-step panel, a 5-stage progress tracker, and a list of document requests
- Three-step "Send a document" flow with drag-and-drop or file picker, file type and size validation, and an optional note to the preparer
- "Review your return" screen with a summary and a required confirmation before filing
- The whole flow is connected: sending documents advances the tracker, and approving the return marks it filed
- A design system page documenting color, type, buttons, badges, form fields, and the tracker
- Progress is saved in the browser, and a "Reset demo" button starts over

## Accessibility

- Semantic HTML: real buttons, labels, fieldsets, and ordered lists for steps
- Skip link, visible keyboard focus, and focus moved to the page title or step heading on every screen change
- `aria-current` on the active nav item, tracker stage, and wizard step
- Errors linked to their fields with `aria-describedby` and `aria-invalid`
- Status messages announced to screen readers through a live region
- Text and background colors meet WCAG 2.1 AA contrast
- Touch targets at least 44px tall
- Respects reduced-motion settings

## Responsive design

- **Desktop:** sidebar navigation with a horizontal progress tracker
- **Mobile (760px and below):** bottom tab bar, a vertical tracker, stacked list items, and full-width buttons

## Tech

Plain HTML, CSS, and JavaScript. No frameworks or build step. Design tokens are CSS custom properties at the top of `css/styles.css`.

```
filewell/
├── index.html        App shell and navigation
├── css/styles.css    Design tokens, components, responsive rules
└── js/app.js         Routing, state, views, and the document flow
```

## Run it locally

Open `index.html` in your browser. That's it.

## Deploy to GitHub Pages

1. Push this folder to a new GitHub repository.
2. In the repository, go to **Settings > Pages**.
3. Under **Source**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/` within a minute or two.

## Process

[Add your process here: sketches, user flows, wireframes, and Figma screens. If you run usability tests, describe who you tested with, what tasks you gave them, what you learned, and what you changed as a result.]

## What I'd do next

- Usability test the send-document flow with 5 people, focusing on mobile
- Add secure messaging between the customer and their preparer
- Add notifications by email or text when a new document is requested
- Support uploading several files at once, such as both sides of an ID

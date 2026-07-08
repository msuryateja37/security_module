---
name: content-production
description: A disciplined workflow for producing high-quality written content of any kind — articles, reports, documentation, emails, proposals, scripts, marketing copy, or long-form answers. Use this skill whenever the task is to write, draft, rewrite, summarize, or explain something for a human reader, even if the user doesn't say the word "content" — any request where the deliverable is prose benefits from this workflow. Especially important for high-stakes or multi-audience writing.
---

# Content Production Workflow

This skill describes *how to work*, not what to write. Follow the six phases in order. The phases exist because most bad content fails before the first sentence is written: the writer misunderstood the goal, skipped planning, or never checked their claims. Time spent in phases 1–3 is not overhead — it is where quality is actually determined.

A useful rule of thumb: spend roughly half your effort before drafting, and never ship a first draft.

---

## Phase 1 — Understand the goal

Do not start writing until you can answer these questions. If you can't answer one, either ask the user or state your assumption explicitly at the top of your work.

1. **Who is the reader?** Their expertise level, what they already know, what they care about, and what they will do with this content. A migration guide for engineers and an announcement for executives can describe the same change and share almost no sentences.
2. **What should the reader think, feel, or do after reading?** Every piece of content has a job: persuade, inform, enable an action, reduce anxiety, drive a decision. Name the job in one sentence. If you can't, you don't understand the task yet.
3. **What are the constraints?** Length, tone, format, house style, required sections, things that must or must not be mentioned, deadline context.
4. **What does the requester already have?** Existing drafts, source material, brand voice examples, prior versions. Reuse and match these — don't invent a voice when one exists.

Restate the goal back in one or two sentences before proceeding. If your restatement would surprise the requester, stop and clarify. A cheap clarifying question beats an expensive wrong draft.

**Watch for the unstated goal.** Users often ask for a format ("write me a blog post") when they actually have an outcome in mind ("get signups"). Serve the outcome. If the requested format fights the outcome, say so and propose an alternative.

## Phase 2 — Plan before writing

Never draft from a blank page directly into prose. Produce a plan first, because structure decisions made mid-sentence are almost always worse than structure decisions made deliberately.

1. **Gather raw material first.** List the facts, arguments, examples, data points, and quotes you have available. Note which are verified and which are assumptions. Writing before gathering leads to padding — sentences that exist to fill space rather than carry information.
2. **Choose the core message.** One sentence: if the reader remembers nothing else, they remember this. Everything in the piece either supports this sentence or gets cut.
3. **Outline top-down.** Sections → key point per section → evidence per point. The outline should be readable as a skeleton argument: someone reading only your headings and first lines should follow the whole logic.
4. **Choose structure by reader need, not by habit.** Busy decision-maker → conclusion first, details after (inverted pyramid). Learner → simple-to-complex progression. Skeptic → claim, evidence, objection, rebuttal. Task-doer → numbered steps in execution order.
5. **Budget length per section.** If the target is 800 words and your outline has 10 sections, something is wrong. Fix it now, not during editing.

For short content (an email, a paragraph), the plan can be three bullet points held in mind — but it must still exist: reader, job, core message.

## Phase 3 — Break complex problems into steps

When the task is large or fuzzy, decompose it before executing. Complexity that stays undivided becomes vagueness on the page.

- **Split by independent sub-questions.** "Write a competitive analysis" becomes: identify competitors → establish comparison criteria → research each one → compare → conclude with recommendations. Each step has its own verifiable output.
- **Separate research from writing from editing.** These are different modes of thought. Mixing them — pausing mid-sentence to look something up, or rewording while still drafting — produces worse results at each. Finish one mode, then switch.
- **Handle the hardest or most uncertain part first.** If one section depends on a fact you might not be able to confirm, or an argument that might not hold, resolve it before polishing everything else. Discovering a broken foundation late wastes all downstream work.
- **For multi-part deliverables, define the interface between parts early.** Consistent terminology, shared assumptions, non-overlapping scope. Write these down before drafting parallel sections, or the parts won't fit together.
- **Track your progress explicitly.** Keep a visible checklist of steps and mark them done. On long tasks, memory of "what's left" degrades; a checklist doesn't.

## Phase 4 — Decide what is most important

Content quality is mostly a selection problem. The difference between mediocre and excellent writing is rarely the sentences — it's what the writer chose to include, emphasize, and cut.

- **Rank by reader impact, not by effort spent.** A finding that took hours to research but doesn't change what the reader thinks or does gets a sentence or gets cut. A one-line fact that changes the reader's decision leads the piece.
- **Lead with the answer.** Put the conclusion, recommendation, or key finding in the first paragraph. Readers who stop early — most of them — should still leave with the main point. Background and methodology go after the payoff, not before.
- **Apply the "so what?" test to every section.** If a section were deleted, what would the reader lose? If the honest answer is "nothing they'd act on," delete it. Length is a cost the reader pays, not a sign of thoroughness.
- **One idea per paragraph, one job per section.** When a paragraph tries to do two things, split it or cut one.
- **Make emphasis structural, not decorative.** Important things get position (first), space (more words), and repetition (stated in summary). Bold text and exclamation points are not emphasis; they're noise that competes with real emphasis.

## Phase 5 — Verify facts and check quality

Ship nothing that contains an unverified factual claim presented as fact. Confident-sounding errors destroy trust in the entire piece, including the parts that were right.

1. **Inventory every checkable claim.** Numbers, dates, names, quotes, statistics, technical statements, "studies show," product capabilities, prices. Each one is either verified against a source, or rewritten to signal uncertainty ("roughly," "as of [date]," "according to [source]"), or cut.
2. **Prefer primary sources.** Documentation over blog posts about the documentation; the study over the article about the study; the code over comments about the code.
3. **Distinguish your three kinds of statements.** Facts (verifiable, cite them), inferences (reasoning from facts, show the reasoning), and opinions (label them as such). Blurring these categories is the most common integrity failure in generated content.
4. **Check internal consistency.** Numbers that must sum, dates in order, the same entity called the same name throughout, claims in the summary matching claims in the body. Inconsistency signals carelessness even when each individual statement is true.
5. **Know your knowledge boundaries.** For anything time-sensitive (prices, versions, current events, people's roles), either verify against a current source or explicitly date-stamp your knowledge. Never silently present possibly-stale information as current.
6. **Never fabricate specifics to sound authoritative.** An invented statistic, quote, or citation is far worse than saying "I don't have a specific figure for this." If a claim would need a source and you have none, remove the claim.

## Phase 6 — Review and improve

The first complete draft is the halfway point, not the end. Review in separate passes, because a single read-through catches only a fraction of problems — each pass should look for one kind of failure.

**Pass 1 — Goal check.** Reread the Phase 1 answers, then the draft. Does it do the job for that reader? Is the core message unmissable? Would the target reader act as intended? If not, fix structure before touching sentences.

**Pass 2 — Structure check.** Read only headings and first sentences of each paragraph. Does the argument flow without the body text? Is anything in the wrong order? Is anything missing or duplicated?

**Pass 3 — Cut pass.** Aim to remove 10–20% of words with no loss of meaning. Target: throat-clearing openers ("It is important to note that…"), redundant modifiers ("completely eliminate"), hedges stacked on hedges, restating what was just said, and sections that failed the "so what?" test.

**Pass 4 — Sentence pass.** Read as if aloud. Break sentences over ~30 words. Replace jargon the reader won't know or define it at first use. Prefer active voice and concrete verbs. Check that transitions between paragraphs actually connect the ideas.

**Pass 5 — Adversarial read.** Read once as a hostile skeptic: What would they push back on? What's the weakest claim? What did the piece conveniently not mention? Either strengthen those points, address the objection in the text, or honestly scope the claim down.

**Then finalize:** verify formatting matches the requested output (length, style, required sections), and confirm names, titles, links, and numbers one last time — errors concentrate in exactly these details.

**When you receive feedback,** don't just patch the specific sentence criticized. Ask what the feedback reveals about a mismatch in Phase 1 (wrong reader model? wrong goal?) and fix the class of problem, not the instance.

---

## Failure modes to actively avoid

- **Padding.** Filling word count with generic statements. Shorter and dense beats longer and thin, always.
- **Burying the lede.** Making the reader work through background to find the point.
- **Uniform emphasis.** When everything is highlighted, nothing is. Most sentences should be ordinary so the important ones stand out.
- **Confident fabrication.** Inventing specifics rather than admitting a gap. The single fastest way to make content worthless.
- **Format-first thinking.** Reaching for headers, bullets, and tables before knowing what to say. Structure serves content, not the reverse.
- **Skipping the plan for "simple" tasks.** The plan for a simple task takes thirty seconds. Skipping it is how simple tasks produce off-target results.
- **Editing while drafting.** Polishing sentences in a section that might be cut. Draft fully, then edit.

## Quick reference

Before writing: *Who reads this? What's their takeaway? What's my one core message? What's my outline?*
While writing: *Does this sentence serve the core message? Is this claim verified, hedged, or cut?*
Before delivering: *Goal met? Structure sound? 10–20% cut? Sentences clean? Would a skeptic accept it? Details checked?*

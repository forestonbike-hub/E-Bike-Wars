---
name: playbook-creator
description: "Creates Good/Better/Best tiered playbooks for GTM workflows. Generates actionable, verified implementation guides that show readers how to implement at their comfort level. Triggers on: create playbook, playbook for, GTM playbook, workflow guide, implementation guide, how to automate."
---

# Playbook Creator Skill

## Description
Creates Good/Better/Best tiered playbooks for GTM workflows. Generates actionable, verified implementation guides that show readers how to implement at their comfort level.

## Trigger
Invoke with `/playbook` followed by a topic, tool+outcome, or problem statement.

Examples:
- `/playbook Gong call review automation`
- `/playbook HubSpot + lead scoring`
- `/playbook I need to automate competitor research`

## Workflow

### Step 1: Clarifying Questions
Before generating, ask these 2-3 questions:

1. **Tools/Platforms:** "What tools or platforms are involved? (Or should I assume based on the topic?)"
2. **Specific Outcome:** "What's the specific outcome you want? (e.g., 'graded call transcripts weekly' vs. 'one-time analysis')"
3. **Constraints:** "Any constraints I should know about? (existing tools, technical limits, budget, team size)"

Wait for answers before proceeding.

### Step 2: Research & Verification
Before writing the playbook:

1. **Search documentation** for each tool/platform mentioned using WebSearch
2. **Fetch and verify** specific capabilities (API endpoints, features, integrations) using WebFetch
3. **Confirm** that recommended methods actually exist and work as described
4. **Note any gaps** where documentation is unclear or unavailable

**Critical Rule:** Never fabricate methods, endpoints, features, or workflows that aren't confirmed in documentation.

### Step 3: Handle Uncertainty
When you cannot verify something through documentation:

- **Do NOT** include unverified details as fact
- **Do NOT** omit silently
- **DO** ask the user: "I couldn't confirm [specific detail]. Should I include it with a caveat, or skip it entirely?"

Wait for user direction before proceeding.

### Step 4: Check Existing Playbooks
Before writing:

1. Read existing playbooks in `/Playbooks/Completed Playbooks/` folder using Glob and Read (do NOT reference Playbook Ideas)
2. Match tone, depth, and structure to maintain consistency
3. Identify any related completed playbooks for cross-linking

### Step 4.5: Narrative Opening Guidelines

**Every playbook must start with a conversational narrative hook (500-1,000 words):**

#### Opening Pattern:

**1. Personal story or relatable pain** (2-3 paragraphs)
- Start with first-person narrative: "Every month, I spent X hours doing Y..."
- Describe the tedium, the frustration, the business impact
- Use specific numbers and real experience
- Make it relatable to the target audience's daily pain

**2. The insight** (1 paragraph)
- "The data existed. The problem was [root cause]."
- Frame the core issue simply
- Connect pain to solvable problem

**3. The promise** (1 paragraph)
- "This playbook shows you three ways to fix this"
- Preview the tier framework
- Set expectation for what they'll walk away with

**Example opening:**
> Every product launch follows the same painful sequence: product gives you specs, you translate them into a fact sheet, then a messaging doc, then a creative brief, then you wait for prioritization, then you kick off with creative, then you approve assets one by one.
>
> It's not hard work. It's tedious work. And tedious work is exactly what AI should handle.
>
> This playbook shows you three ways to automate the PMM launch workflow — pick the level that matches your priorities: speed, quality, or both.

### Step 4.6: Prompt Presentation Pattern

**For every prompt in Good/Better/Best tiers, use this structure:**

**Step 1: Narrative Context** (2-3 sentences)
Explain what this prompt does and why in conversational tone.

Example:
> "The first step is extracting your brand voice. I run this once per company, save the output, and reuse it for every launch. Takes 5 minutes, saves 1-2 hours per launch."

**Step 2: Copy-Paste Ready Prompt** (code block)
Complete prompt in markdown code fence. Never abbreviate or summarize.

**Step 3: How to Use** (5 steps max)
1. Copy this prompt
2. Replace [PLACEHOLDER] with your data
3. Run in Claude
4. Save output as [filename]
5. Use for [next step]

**Step 4: Time Saved** (one line)
"Time saved: X hours → Y minutes"

### Step 4.7: Target Playbook Length

**Target: 5,000-8,000 words total**

**Structure breakdown:**
- Opening narrative: 500-1,000 words
- Prerequisites & Quick Start: 300-500 words
- Good tier: 1,500-2,000 words
- Better tier: 1,500-2,000 words
- Best tier: 1,500-2,000 words
- Sample output/example: 500-800 words
- Why This Matters: 300-500 words
- FAQ: 500-800 words (top 5-7 questions only)
- Common Pitfalls: 300-500 words (top 3-4 only)

**What to trim:**
- Edge case FAQs (keep only common questions)
- Redundant explanations (say it once well)
- Over-explanation of tier selection (trust the comparison table)
- Excessive troubleshooting (cover main issues, not every scenario)

**What to NEVER trim:**
- Complete prompts (always include full text)
- Complete skill files with YAML (always include full implementation)
- Real examples with numbers (critical for credibility)
- Before/after time comparisons (show ROI)

### Step 4.8: Writing Voice Guidelines

**Conversational narrative for:**
- Opening hook (first-person pain point)
- Tier introductions ("Here's when to use this...")
- Examples and stories ("I've run this 15+ times. Here's what I learned...")
- Transitions between sections
- Narrative bridges between tiers

**Authoritative instruction for:**
- Step-by-step processes
- Technical setup (file paths, YAML structure)
- Quality checkpoints
- Validation steps

**Prompts use third-person expert:**
- "You are a senior product marketing manager..."
- "Generate a comprehensive analysis..."

**Blend example:**
> I've run this for 15+ launches now. The pattern is consistent: first draft takes 10 minutes, but I spend 30-40 minutes on refinement. Here's what I learned: if you add the self-critique step, refinement drops to 10-15 minutes. Worth the extra upfront structure.
>
> Here's the self-critique prompt I use:
>
> [Code block with complete prompt]
>
> Copy this prompt, paste it after your first draft, and Claude will identify weak claims, generic phrasing, and areas needing proof points.

### Step 5: Generate the Playbook

#### Structure

**Opening (500-1,000 words):**
Follow the narrative opening pattern from Step 4.5.

**Prerequisites & Quick Start (300-500 words):**

```markdown
## Prerequisites & Quick Start

**What you need:**
- [Tool/access requirements]
- [Specific credentials or accounts]

**Quick Start ([X] minutes):**
1. Start with **Good** tier today (immediate results)
2. Graduate to **Better** tier after [X uses/time]
3. Build **Best** tier for [high-stakes scenario]

**Time to value:**
- Good: Immediate (use prompts below, save [X] hours today)
- Better: After one-time [X]-min setup
- Best: After one-time [X]-hour setup
```

**What You'll Walk Away With Table:**

```markdown
## What You'll Walk Away With

| Level | What You Get | Effort | Complexity | Output Quality |
|-------|--------------|--------|------------|----------------|
| **Good** | [Brief description] | Low | Low | B+ |
| **Better** | [Brief description] | Medium | Medium | A- |
| **Best** | [Brief description] | High* | High | A+ |

*Saves most total time due to minimal refinement needed
```

**Then follow with tier sections:**

#### Good Tier Structure

**Opening paragraph** (conversational):
"Start here if you want faster drafts without changing your workflow. This tier gives you copy-paste prompts that do the work—no setup, no skills to build, just immediate time savings."

**What You'll Get** (bullet points)
**The Process** (numbered steps)

**Then: Prompts** (following presentation pattern from Step 4.6):
- Narrative context
- Code block with complete prompt
- How to use (5 steps max)
- Time saved

**Transition to Better tier** (conversational bridge):
"After you've run this 3-4 times, you'll notice you're repeating the same steps. That's when Better tier makes sense—one-time setup, then automation takes over."

#### Better Tier Structure

**Opening paragraph** (conversational):
"Once you run this 3-4 times, you'll want automation. Better tier eliminates the repetitive steps with a Claude Code skill you build once and run forever."

**What You'll Get** (bullet points)
**The Process** (numbered steps)

**One-Time Setup:** Complete Claude Code skill with YAML
- Exact file path: `.claude/skills/[skill-name]/SKILL.md`
- Complete YAML frontmatter
- Full skill implementation

**Using the Better Tier** (per-use instructions)
- How to invoke
- What to expect
- Time per use

**Transition to Best tier** (conversational bridge):
"Better tier works great for most use cases. But if you need the highest quality output with minimal refinement—or if this feeds into high-stakes decisions—Best tier adds multi-pass validation."

#### Best Tier Structure

**Opening paragraph** (conversational):
"Use this when [high-stakes scenario]. Best tier adds multi-pass validation: first draft → self-critique → improvement → quality checks."

**What You'll Get** (bullet points)
**The Process** (numbered steps, show the validation loops)

**One-Time Setup:** Enhanced skill with validation
**Using the Best Tier**

#### Sample Output/Example (500-800 words)
Show what each tier produces for same input

#### Why This Matters (300-500 words)

#### FAQ (500-800 words, top 5-7 questions only)

#### Common Pitfalls (300-500 words, top 3-4 only)

#### Related Playbooks

#### Tier Logic
| Tier | Setup | Effectiveness | Long-term ROI |
|------|-------|---------------|---------------|
| Good | Easy - Copy-paste prompts | B+ drafts, needs editing | Quick win, saves 2-3 hrs per use |
| Better | Medium - One-time skill creation | A- output, light editing | Moderate setup, saves 3-4 hrs per use |
| Best | High - Enhanced skill with validation | A+ output, minimal editing | High setup, saves 4-5 hrs per use (including refinement time) |

### Step 6: Determine Save Location
Auto-detect the appropriate folder based on content:

- **Sales:** Outbound, calls, deals, prospecting, Gong, SDR, AE workflows
- **Marketing:** Campaigns, content, ads, positioning, messaging, analytics
- **RevOps:** CRM, automation, data sync, integrations, reporting
- **CS:** Onboarding, retention, support, health scores, renewals
- **PM:** Roadmap, feedback, prioritization, specs, user research

If unclear, ask: "This could fit in [Option A] or [Option B]. Where should I save it?"

Save to: `/Users/travishurst/Documents/AI GTM/Playbooks/Completed Playbooks/{Function}/{Topic} Playbook.md`

### Step 7: Confirm Completion
After saving the playbook, confirm:
- File location: `/Users/travishurst/Documents/AI GTM/Playbooks/Completed Playbooks/{Function}/{Topic} Playbook.md`
- Quick summary of the three tiers:
  - **Good:** [One-sentence summary of what it provides]
  - **Better:** [One-sentence summary of what it provides]
  - **Best:** [One-sentence summary of what it provides]
- Estimated word count (target: 5,000-8,000 words)
- Any caveats or items that need user verification
- Related playbooks that were cross-linked

## Quality Standards

### Do
- Open with conversational narrative hook (500-1,000 words, first-person pain point)
- Embed prompts with narrative context before code block
- Target 5,000-8,000 words total (trim edge cases, keep substance)
- Use first-person for examples/stories ("I've run this 15+ times...")
- Use second-person for instructions ("You'll want to...")
- Include narrative bridges between tiers
- Verify every technical claim against documentation
- Include specific, actionable steps
- Show the actual output/outcome for each tier
- Use real tool names, real endpoints, real features
- Provide complete prompts (never abbreviate)
- Provide complete skill files with YAML (never summarize)
- Include real examples with numbers (critical for credibility)
- Include before/after time comparisons (show ROI)
- Flag uncertainty explicitly
- Cross-reference related playbooks

### Don't
- Don't start with prerequisites (start with pain point)
- Don't exceed 8,000 words without strong justification
- Don't include every edge case FAQ (top 5-7 questions only)
- Don't use only instructional voice (blend conversational narrative)
- Don't show prompts without narrative context (explain what/why first)
- Don't create fill-in-the-blank templates (create extraction prompts)
- Don't hallucinate features or capabilities
- Don't use vague language ("easily integrate," "simply connect")
- Don't skip the research step
- Don't assume capabilities without verification
- Don't include unverified methods without user approval

# Verified Speed Badges — Implementation Guide

## Purpose

Add a milestone badge system to the touch-typing speed platform.

The badge system should **not** reward a user simply because they hit a speed once.

A badge should mean:

> **The platform has enough evidence to believe the user can reliably type at that speed.**

The system should therefore distinguish between:

- Peak speed
- Sustainable speed
- Verified speed
- Historical badges earned

The main user-facing achievement is the **Verified Speed Badge**.

---

# 1. Badge Speed Levels

Use 10 WPM increments.

Recommended badge thresholds:

```text
50 WPM
60 WPM
70 WPM
80 WPM
90 WPM
100 WPM
110 WPM
120 WPM
130 WPM
140 WPM
150 WPM
160 WPM
170 WPM
180 WPM
190 WPM
200 WPM
```

The platform is intended for users who already know how to touch type, so there is no need for very low-speed beginner badges.

## Badge Importance Levels

Not every badge needs the same visual weight.

### Standard Milestones

```text
50
60
70
80
90

110
120
130
140

160
170
180
190
```

### Major Milestones

```text
100 WPM
150 WPM
200 WPM
```

These should receive stronger visual treatment and a more prominent celebration.

---

# 2. Core Principle

Do not award a badge based on:

```text
bestWpm >= badgeThreshold
```

That would allow a lucky short burst to count as a permanent achievement.

Instead, badges should be based on **verified ability**.

For example, a user should not receive the 90 WPM badge simply because they once typed:

```text
92 WPM
for 10 seconds
```

The system should require repeated evidence.

---

# 3. Recommended V1 Verification Rule

A speed badge is earned when all of the following are true:

```text
WPM >= badge threshold
Accuracy >= 98%
Test duration >= 60 seconds
At least 3 qualifying runs
Runs use different text
Runs occur across at least 2 separate sessions
```

Example for the 90 WPM badge:

```text
Threshold:
90 WPM

Requirements:
- 3 qualifying tests
- each test >= 60 seconds
- each test >= 90 WPM
- each test >= 98% accuracy
- different text passages
- spread across at least 2 sessions
```

This should be the default V1 logic because it is:

- understandable
- deterministic
- easy to test
- hard to exploit accidentally
- simple to communicate in the UI

---

# 4. Qualifying Run

Define a helper function conceptually like:

```ts
function isQualifyingRun(
  run,
  threshold
): boolean
```

A run qualifies when:

```ts
run.wpm >= threshold &&
run.accuracy >= 98 &&
run.durationSeconds >= 60
```

Optionally also require:

```ts
run.isCompleted === true
run.isPracticeMode === false
run.textDifficultyWithinVerificationRange === true
```

---

# 5. Badge Verification Logic

For every badge threshold:

```text
50
60
70
...
200
```

evaluate recent qualifying runs.

Pseudo-logic:

```ts
const qualifyingRuns = runs.filter(run =>
  run.wpm >= threshold &&
  run.accuracy >= 98 &&
  run.durationSeconds >= 60
)
```

Then verify:

```ts
qualifyingRuns.length >= 3
```

and:

```ts
uniqueSessionCount >= 2
```

and:

```ts
uniqueTextCount >= 3
```

If all conditions are satisfied:

```ts
badge.status = "earned"
```

---

# 6. Recommended Data Model

Each typing run should store enough information to verify badges later.

Example:

```ts
type TypingRun = {
  id: string
  userId: string

  startedAt: string
  completedAt: string

  sessionId: string
  textId: string

  durationSeconds: number

  grossWpm: number
  netWpm: number
  accuracy: number

  errorCount: number
  correctedErrorCount: number

  rhythmVariance?: number
  textDifficulty?: number

  mode:
    | "practice"
    | "verification"
    | "speed-test"
    | "training"
}
```

For badge purposes, use one canonical WPM field.

Recommended:

```text
netWpm
```

Do not mix gross WPM and net WPM when awarding badges.

---

# 7. Badge Model

Example:

```ts
type SpeedBadge = {
  threshold: number

  status:
    | "locked"
    | "in-progress"
    | "earned"

  earnedAt?: string

  qualifyingRunIds: string[]

  isMajorMilestone: boolean
}
```

Example:

```json
{
  "threshold": 90,
  "status": "earned",
  "earnedAt": "2026-08-31T14:00:00Z",
  "qualifyingRunIds": [
    "run_123",
    "run_127",
    "run_131"
  ],
  "isMajorMilestone": false
}
```

---

# 8. Do Not Remove Earned Badges

Once a user earns a badge, keep it permanently.

Example:

```text
Personal verified best:
90 WPM

Current verified speed:
86 WPM
```

The user still keeps:

```text
90 WPM Badge
```

because they previously demonstrated that level.

Do not downgrade or delete historical achievements because current performance drops.

---

# 9. Current Verified Speed vs Historical Best

Track these separately.

## Historical Verified Best

The highest badge the user has ever earned.

Example:

```text
90 WPM
```

## Current Verified Speed

An estimate based on recent typing performance.

Example:

```text
86.4 WPM
```

This allows the UI to communicate:

```text
Highest verified milestone
90 WPM

Current verified speed
86 WPM
```

without taking achievements away.

---

# 10. Progress Toward the Next Badge

If the user's highest badge is:

```text
80 WPM
```

then the next badge is:

```text
90 WPM
```

Do not simply calculate:

```text
currentSpeed / 90
```

because progress toward verification also depends on consistency.

Instead, show both speed progress and verification progress.

Example:

```text
NEXT MILESTONE

90 WPM

Current verified speed
87.2 WPM

Qualifying runs
2 / 3

Accuracy requirement
Passed

Session diversity
Passed
```

This is more useful than a generic progress bar.

---

# 11. Recommended Dashboard UI

Example:

```text
YOUR SPEED

87
WPM

Verified Speed

+5 WPM this month
```

Then:

```text
NEXT MILESTONE

90 WPM

██████████████████░░

87 / 90 WPM
```

Then:

```text
Verification

✓ Accuracy
  98.6%

✓ Duration
  60+ sec

✓ Session diversity
  2 sessions

◌ Qualifying runs
  2 / 3

One more strong 90+ WPM run
could verify this milestone.
```

The important idea is that the UI tells the user **why they have not earned the badge yet**.

---

# 12. Badge Card Design

An earned badge could contain:

```text
╭─────────────────────────╮
│                         │
│          90             │
│         WPM             │
│                         │
│     VERIFIED SPEED      │
│                         │
│    Earned Aug 31        │
│                         │
╰─────────────────────────╯
```

When opened:

```text
90 WPM — Verified

Earned
August 31, 2026

Verification evidence

93 WPM · 98.7%
91 WPM · 99.1%
90 WPM · 98.4%

3 qualifying runs
3 different passages
2 sessions
```

---

# 13. Major Milestone Design

Use stronger visual treatment for:

```text
100 WPM
150 WPM
200 WPM
```

These can include:

- larger badge
- stronger animation
- special border
- milestone-specific iconography
- more prominent profile placement
- dedicated achievement screen

Do not overdo animations for every 10 WPM milestone.

The major milestones should feel rare and meaningful.

---

# 14. Badge Collection Screen

Example:

```text
SPEED MILESTONES

50   ✓
60   ✓
70   ✓
80   ✓
90   ◌
100  🔒
110  🔒
120  🔒
130  🔒
140  🔒
150  🔒
160  🔒
170  🔒
180  🔒
190  🔒
200  🔒
```

Possible states:

```text
Earned
In Progress
Locked
```

Do not show too many intermediate states.

Keep it visually simple.

---

# 15. Milestone Challenge

When the user is close to a milestone, optionally offer:

```text
Prove 90 WPM
```

A milestone challenge can consist of:

```text
3 rounds

Round 1
60 seconds

Round 2
60 seconds

Round 3
60 seconds
```

Suggested requirement:

```text
Pass at least 2 of 3 rounds

WPM >= threshold
Accuracy >= 98%
```

However:

> The milestone challenge should not be the only way to earn a badge.

Normal typing sessions should also count toward verification.

This allows badges to feel naturally earned.

---

# 16. Near-Milestone State

Example:

```text
90 WPM is within reach.

Current verified speed:
88.7 WPM

Qualifying runs:
2 / 3

You're ready to prove it.
```

Then provide:

```text
[ Prove 90 WPM ]
```

This can create a strong motivational moment without making the system feel overly game-like.

---

# 17. Text Difficulty

Do not allow very easy passages to disproportionately influence verification.

Eventually assign passages a typing difficulty score.

Possible factors:

```text
average word length
rare bigrams
rare trigrams
same-finger transitions
awkward hand transitions
punctuation frequency
capitalization frequency
number frequency
symbol frequency
```

Example:

```ts
type TypingText = {
  id: string
  content: string
  difficultyScore: number
}
```

For verification runs, require a controlled range.

Example:

```text
0.8 <= difficultyScore <= 1.2
```

V1 can skip sophisticated difficulty normalization if all verification passages come from the same curated pool.

---

# 18. Avoid Repeating the Same Passage

A user should not earn a badge by memorizing one passage.

Require:

```text
uniqueTextCount >= 3
```

or ensure the verification engine automatically serves a new passage each time.

---

# 19. Session Definition

A session should represent a real practice period.

Example:

```text
session starts when user begins training
session ends after inactivity or explicit exit
```

A simple V1 rule:

```text
new session after 30 minutes of inactivity
```

This prevents someone from doing three immediate attempts and satisfying the multi-session requirement artificially.

---

# 20. Recommended Badge Evaluation Flow

After every eligible typing run:

```text
typing run completed
        ↓
save run
        ↓
determine next unearned milestone
        ↓
check if run qualifies
        ↓
update qualifying evidence
        ↓
check unique texts
        ↓
check unique sessions
        ↓
if requirements satisfied
        ↓
award badge
        ↓
show celebration
```

---

# 21. Example

User currently owns:

```text
80 WPM Badge
```

Next target:

```text
90 WPM
```

Recent runs:

```text
Run A
91 WPM
98.4%
60 sec
Session 1
Text A

Run B
88 WPM
99.0%
60 sec
Session 1
Text B

Run C
92 WPM
98.8%
60 sec
Session 2
Text C

Run D
90 WPM
98.2%
60 sec
Session 2
Text D
```

Qualifying runs:

```text
A
C
D
```

Therefore:

```text
3 qualifying runs
3 unique texts
2 sessions
```

Result:

```text
90 WPM Badge Earned
```

---

# 22. Example of a Non-Qualifying User

Recent runs:

```text
92 WPM
96.5% accuracy

91 WPM
97.2% accuracy

95 WPM
94.0% accuracy
```

The user is clearly fast enough, but accuracy is not stable enough.

Result:

```text
90 WPM Badge
Not yet verified
```

UI:

```text
Speed
✓

Accuracy
Needs improvement

Your speed is already above 90 WPM.
Raise verification accuracy to 98%.
```

This is valuable because the badge system becomes part of the coaching system.

---

# 23. Another Non-Qualifying Example

Recent runs:

```text
91 WPM
98.8%
10 seconds

93 WPM
99.1%
15 seconds

92 WPM
98.5%
30 seconds
```

These are good burst speeds, but none are long enough.

Result:

```text
90 WPM Badge
Not yet verified
```

UI:

```text
Speed
✓

Accuracy
✓

Sustained duration
Needs verification
```

---

# 24. Badge Award Celebration

When earned:

```text
          90

          WPM

    SPEED VERIFIED

You've now sustained 90+ WPM
with 98%+ accuracy across
multiple sessions.
```

Then show:

```text
Previous milestone
80 WPM

New milestone
90 WPM

Improvement
+10 WPM
```

Actions:

```text
View progress
Continue to 100 WPM
```

---

# 25. Suggested Badge Naming

Keep the numerical value as the primary identity.

Recommended:

```text
90 WPM
Verified Speed
```

Avoid overly arbitrary labels such as:

```text
Typing Warrior
Keyboard Master
Speed Demon
```

The product is intended to feel intelligent and performance-oriented rather than childish.

If names are used at all, keep them secondary.

---

# 26. Recommended Visual Hierarchy

Standard badge:

```text
90
WPM

Verified
```

Major milestone:

```text
100
WPM

Major Milestone
Verified
```

The number should always be the strongest visual element.

---

# 27. Suggested Component Structure

Example frontend structure:

```text
SpeedDashboard
├── CurrentVerifiedSpeed
├── NextMilestoneCard
│   ├── ProgressBar
│   ├── VerificationChecklist
│   └── MilestoneChallengeButton
│
├── BadgeCollection
│   └── SpeedBadge
│
└── BadgeAchievementModal
```

Possible components:

```ts
<CurrentVerifiedSpeed />
<NextMilestoneCard />
<VerificationChecklist />
<SpeedBadge />
<BadgeGrid />
<BadgeAchievementModal />
<MilestoneChallenge />
```

---

# 28. Suggested Backend Functions

Possible domain functions:

```ts
getBadgeThresholds()

getNextBadgeThreshold()

isQualifyingRun()

getQualifyingRunsForThreshold()

calculateUniqueSessionCount()

calculateUniqueTextCount()

isBadgeVerified()

awardBadge()

getCurrentVerifiedSpeed()

getHighestEarnedBadge()

getBadgeProgress()
```

Keep badge logic inside a dedicated domain/service layer rather than scattering it throughout UI components.

---

# 29. Suggested Constants

Example:

```ts
export const SPEED_BADGE_THRESHOLDS = [
  50,
  60,
  70,
  80,
  90,
  100,
  110,
  120,
  130,
  140,
  150,
  160,
  170,
  180,
  190,
  200
]

export const MAJOR_SPEED_BADGES = [
  100,
  150,
  200
]

export const BADGE_VERIFICATION = {
  minAccuracy: 98,
  minDurationSeconds: 60,
  requiredQualifyingRuns: 3,
  requiredUniqueSessions: 2,
  requiredUniqueTexts: 3
}
```

Do not hardcode these values throughout the application.

---

# 30. Recommended V1 Scope

Implement first:

```text
✓ badge thresholds
✓ qualifying run logic
✓ 3-run verification
✓ 98% minimum accuracy
✓ 60-second minimum duration
✓ unique text requirement
✓ multi-session requirement
✓ earned badge persistence
✓ next milestone progress
✓ badge collection screen
✓ badge celebration modal
```

Do not initially build:

```text
complex statistical confidence models
machine learning
adaptive passage difficulty normalization
advanced rhythm-based verification
dynamic badge thresholds
```

These can come later.

---

# 31. Possible V2 Improvements

Once enough user data exists, move beyond fixed rules.

Possible additions:

## Confidence Score

Example:

```text
90 WPM confidence

82%
```

As more evidence arrives:

```text
98%

Milestone verified
```

---

## Stability-Aware Verified Speed

Possible model:

```text
VerifiedSpeed = MedianRecentSpeed - StabilityPenalty
```

High variability results in a larger penalty.

---

## Rhythm Verification

Use inter-key timing variance to detect unstable speed.

Example:

```text
91 WPM
98.7% accuracy
high rhythm instability
```

The run may still count, but rhythm can become another signal.

---

## Difficulty-Normalized WPM

Adjust verification based on text difficulty.

---

## Personalized Milestone Challenges

Generate passages containing the user's weak motor patterns while still testing the target WPM.

---

# 32. Important UX Principle

Never tell the user:

```text
You are not a 90 WPM typist.
```

Instead say:

```text
90 WPM has not been verified yet.
```

That wording is more accurate.

The platform is measuring evidence, not defining the user's identity.

---

# 33. Core Product Rule

The most important design rule is:

> **A badge should not mean "you once typed this fast."**

It should mean:

> **"You have repeatedly demonstrated this speed with strong accuracy and enough consistency for the platform to verify it."**

That makes the badge meaningful, defensible, and motivating.

---

# 34. Recommended Final V1 Definition

For implementation, use this exact rule initially:

```text
A user earns a speed badge when:

1. The badge threshold is reached or exceeded.
2. Accuracy is at least 98%.
3. The test lasts at least 60 seconds.
4. The user completes 3 qualifying runs.
5. The 3 runs use different passages.
6. The qualifying runs span at least 2 sessions.
7. Once earned, the badge is permanent.
```

Badge thresholds:

```text
50
60
70
80
90
100
110
120
130
140
150
160
170
180
190
200
```

Major milestones:

```text
100
150
200
```

This is the recommended starting implementation.

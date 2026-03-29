# Future Ideas

Items here are ideas for future implementation. Do not start on these without explicit direction.

---

## Food item timestamps
Store `time: 'HH:MM'` on food items (auto-set on creation) for future time-of-day display and sorting. Data model change: `{ id, name, cal, time }`. No UI yet — just persist the timestamp for when we want to show "2:30 PM — chicken breast" style entries.

## Exception days
Mark a day as "exception" — skips scoring, doesn't break streaks, doesn't count as a failure in any metric. Use case: sick days, travel, special occasions where dailies/tasks aren't relevant.

Possible implementation: `days[date].exception = true` flag. `closeDayScoring` checks this and returns a neutral result (no XP change, no streak break). Streak logic treats exception days as invisible (streak continues through them). Heatmaps show exception days in a distinct color (e.g., silver or blue). UI: a button in DayView score block to toggle exception status.

## Claude API calorie estimation
When Anthropic API integration is added, allow food items to have their calories auto-estimated by Claude. User types "chicken breast sandwich" and Claude returns a calorie estimate. Would need an API key configuration and a small UI indicator showing estimated vs manually-entered calories.

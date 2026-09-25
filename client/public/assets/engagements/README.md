# Engagement how-it-works media

Animated "how it works" assets shown in the **Locked Engagement** modal
(`src/views/Experiences/LockedEngagementModal.jsx`). Each engagement resolves its
media by convention:

```
/assets/engagements/<typeId>.gif
```

If the file is missing, the modal shows a graceful "preview coming soon"
fallback — so the app works with or without these assets.

## Generate with Magnific (MCP)

These are intended to be generated via the Magnific MCP server
(`https://mcp.magnific.com`). Use an animated output (GIF/MP4/webp) sized ~16:9,
clean and on-brand (Tabs orange `#F09925` accents, light UI, friendly motion).

Drop each file at `public/assets/engagements/<typeId>.gif`.

| typeId | Suggested prompt |
|---|---|
| `raffles` | Animated UI: attendees tapping "Enter" on phones, tickets dropping into a drum, a winner highlighted. Clean, light, orange accents. |
| `live-polls` | Animated UI: a poll question with bars filling in real time as votes come in on phones. |
| `trivia-challenges` | Animated UI: a timed trivia question, countdown ring, a live leaderboard reordering. |
| `prediction-challenges` | Animated UI: attendees locking predictions before a deadline, then an outcome resolving and points updating. |
| `surveys` | Animated UI: a multi-question survey form being filled and submitted, results tallying. |
| `pulse-feedback` | Animated UI: attendees tapping sentiment emojis, a live sentiment gauge moving. |
| `instant-win` | Animated UI: a phone tap revealing an instant prize with a celebratory burst. |
| `digital-scratch-offs` | Animated UI: a finger scratching a digital card to reveal a prize tier. |
| `treasure-hunts` | Animated UI: a venue map with QR checkpoints being scanned and a progress path filling. |
| `check-in-challenges` | Animated UI: attendees scanning QR at locations, a checklist completing. |
| `photo-contests` | Animated UI: photo submissions appearing in a grid, hearts/votes accumulating. |
| `social-wall` | Animated UI: attendee posts and photos flowing onto a big-screen wall feed. |
| `digital-coupons` | Animated UI: a coupon claimed on a phone, then redeemed at a vendor with a checkmark. |
| `sponsor-promotions` | Animated UI: a branded sponsor card surfacing inside a live engagement, engagement counter rising. |
| `loyalty-rewards` | Animated UI: points accruing across events, a reward being redeemed, tier badge upgrading. |
| `leaderboards` | Animated UI: a ranked standings board updating in real time as points change. |

Keep each file reasonably small (ideally < 2 MB) for fast modal loads.

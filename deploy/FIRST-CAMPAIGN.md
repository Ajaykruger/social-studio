# First Live Campaign Checklist

Use this the first time Andre and Jen run a real Crystal Clawz campaign through
the deployed studio.

## Before You Start

1. Open the studio URL on a phone.
2. Sign in with Google through Cloudflare Access.
3. Confirm the app loads and shows the Create, Review, and Operator tabs.
4. Keep Postiz separate. The studio prepares a draft package only.

## Create The Campaign

1. Open the Create tab.
2. Paste the crystalclawz.co.za product URL into the product link box.
3. Tap `Import product`.
4. Pick the approved benefit from the product page wording, or type the exact
   approved benefit into the approved benefit field.
5. Choose `Reel + post` for the first full campaign.
6. Add a short angle or pain point if needed.
7. Tap `Generate content`.
8. Read the captions, hooks, and reel script.
9. Pick the best caption.
10. Tap `Send to review`.

## Attach The Rendered Reel

1. On the studio PC, render the reel with MoneyPrinterTurbo.
2. Save or locate the finished MP4 in `MoneyPrinterTurbo/storage/`.
3. Open the Review tab.
4. Select the new campaign.
5. In the `Attach rendered reel` box, paste the MP4 path.
6. Tap `Attach rendered reel`.
7. Confirm the reel appears in the Review tab.

## Jen Reviews

1. Jen opens the studio URL on her phone.
2. Jen signs in with Google through Cloudflare Access.
3. Jen opens the Review tab and selects the campaign.
4. Jen watches the reel and checks the normal post.
5. Jen confirms every approval gate.
6. Jen leaves a short note if useful.
7. Jen taps `Approve`.

If something is wrong, Jen taps `Needs changes` or `Reject` and writes a clear
sentence explaining what must change.

## Operator Uploads The Draft

1. After approval, open the generated manual Postiz draft package for the
   campaign.
2. Upload the media and caption into Postiz as a DRAFT.
3. Do not schedule it.
4. Do not publish it.
5. Keep the draft in Postiz for the separate final go-live decision.

Reminder: the app never schedules or publishes. The human operator does the
manual Postiz draft package upload, and going live is a separate, later,
deliberate decision.

## If Something Looks Wrong

1. Read the campaign decision log:

   ```bash
   tail -n 40 /opt/social-studio/social-studio/audit/<campaign>.decisions.jsonl
   ```

   The repo-relative path is `social-studio/audit/<campaign>.decisions.jsonl`.

2. Restart the service if the app is stuck:

   ```bash
   sudo systemctl restart social-studio
   sudo systemctl status social-studio --no-pager
   ```

3. If the healthcheck fails, read the service logs:

   ```bash
   /opt/social-studio/deploy/healthcheck.sh
   journalctl -u social-studio -n 80 --no-pager
   ```

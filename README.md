# Shake & Hiss

**Status: ACTIVE**

Physical random numbers in the browser. Shake your phone or let the microphone listen to its own background hiss, and the app turns that sensor noise into dice rolls, coin flips, numbers in a range, or a password.

Live: https://shake-and-hiss.vercel.app

## How it works

1. **Collect.** Motion sensor readings (phones) or about 2 seconds of raw microphone samples (any device) with echo cancellation, noise suppression and auto gain turned off.
2. **Measure changes, not readings.** Each reading becomes an 8-bit symbol for how much it changed since the previous one, which is close to independent.
3. **Estimate entropy.** Two checks in the style of NIST SP 800-90B: a Most Common Value estimate and a predictor estimate. The lower one wins. A Repetition Count Test rejects stuck sensors or real sound such as a TV.
4. **Credit conservatively.** Only half the measured entropy is credited, capped at 256 bits.
5. **Extract and spend.** Raw noise is hashed with SHA-256 into a seed. Results use rejection sampling, and every credited bit is spent once. Passwords also mix in `crypto.getRandomValues`, so they are at least as strong as the stronger source.

Nothing leaves the device. The "Nerd stats" panel shows the histogram, entropy estimates, a 1,000-dice chi-squared fairness test (raw vs hashed), and lets you download the raw samples as CSV.

## Devices

Phones get two buttons: **Shake** and **Listen**. Laptops and desktops (no touch screen, so no motion events) get **Listen to the hiss** as the only main action.

## Structure

- `index.html`: the whole app (markup, styles, browser code)
- `stats.js`: pure statistics helpers (entropy estimates, crediting, chi-squared), no browser APIs

## Deploy

Static site on Vercel, no build step:

```sh
vercel link --project shake-and-hiss
vercel --prod
```

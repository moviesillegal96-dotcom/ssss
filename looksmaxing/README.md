# Looks Maxing in 10 Minutes ✨

A motivational Android app (also works in any browser) for looking your best in 10 minutes a day. Everything is
based on research: dermatology, sleep, food, fitness, posture and confidence. It also warns you away from
dangerous "looksmaxxing" trends.

## Install
**Android:** download [`LooksMaxing.apk`](LooksMaxing.apk) to your phone, open it, allow installing from your
browser or file manager when asked, and tap **Install**. It works offline.

**Any browser:** open `index.html`.

## What's inside
- **Today:** a daily motivational quote, your streak, and a tip from the research library.
- **10-minute routine:** a guided timer with a beep and buzz at each step. Every step explains *why* it works.
  - ☀️ **Morning:** water, wash face, moisturize, sunscreen, posture reset, 3-minute workout, grooming check, smile.
  - 🌙 **Evening:** wash, acne treatment and moisturizer, stretch and breathe, plan tomorrow's food, teeth, sleep prep, one win.
- **Research library:** 13 topics, each rated by how strong the evidence is: Strong, Moderate, Weak, or Avoid.
  - **Dermatology:** sunscreen, acne, retinol.
  - **Body and health:** sleep, food, water, exercise.
  - **Confidence and style:** posture, smiling, grooming.
  - **Warnings:** what ages you, dangerous trends (bone smashing, mewing, steroids/SARMs, DIY skin hacks, crash diets, tanning beds), and a healthy mindset.

  Each topic gives practical steps and the published studies behind them.
- **Progress:** check off 6 daily habits, see a 28-day calendar, and track your confidence after each routine.

All data stays on the phone. For education and motivation only, not medical advice.

## Sources used
- Hughes et al., *Annals of Internal Medicine* 2013: daily sunscreen and skin aging (randomized trial)
- Zaenglein et al., *J Am Acad Dermatol* 2016: acne treatment guidelines
- Kafi et al., *Archives of Dermatology* 2007: retinol and naturally aged skin
- Axelsson et al., *BMJ* 2010: "Beauty sleep"
- Sundelin et al., *Royal Society Open Science* 2017: restricted sleep and facial appearance
- Whitehead et al., *PLoS ONE* 2012: fruit and vegetables and skin color
- Palma et al., *Clin Cosmet Investig Dermatol* 2015: dietary water and skin
- Crane et al., *Aging Cell* 2015: exercise and skin aging
- Nair et al., *Health Psychology* 2015: upright vs slumped posture
- Ranehill et al., *Psychological Science* 2015: power posing failed to replicate
- Reis et al., *European Journal of Social Psychology* 1990: "What is smiling is beautiful and good"
- Guyuron et al., *Plastic and Reconstructive Surgery* 2009: facial aging in identical twins
- Goodman et al., *J Clin Aesthet Dermatol* 2019: smoking, alcohol and facial aging
- El Ghissassi et al., *Lancet Oncology* 2009: tanning devices classified as carcinogenic
- Veale et al., *Body Image* 2016: prevalence of body dysmorphic disorder

## Building the APK
Needs the same tools as FocusBud (see `../focusbud/README.md`), then:

```bash
looksmaxing/android/build-apk.sh
```

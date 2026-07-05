// SiteVolt — static site, minimal JS.
//
// SPOT COUNTER — the one piece of real state on the page. Update SPOTS_LEFT
// when a build sells, and roll SPOT_MONTH / SPOT_NEXT_MONTH forward when the
// month changes. Every urgency surface (topbar countdown, hero meter, CTAs,
// offer cohort line, final CTA) renders from these four constants through ONE
// render pass, and the month-end deadline closes EVERY surface at once — so
// the page can never disagree with itself, even if the constants go stale or
// the tab stays open past midnight on the last day. The numbers must stay
// TRUE — a stale counter is a fake timer with extra steps (compliance: no
// invented scarcity).
const SPOT_MONTH = "July";
const SPOT_NEXT_MONTH = "August";
const SPOT_TOTAL = 5;
const SPOTS_LEFT = 5;

// CHECKOUT — paste your Stripe Payment Link here (looks like
// "https://buy.stripe.com/xxxxxxxx"). Every [data-checkout] CTA points at it.
// While empty, those CTAs fall back to their in-page anchors, so nothing breaks.
const CHECKOUT_URL = "";

const MONTHS = ["January","February","March","April","May","June","July",
  "August","September","October","November","December"];
const monthIndex = MONTHS.indexOf(SPOT_MONTH);
const M = SPOT_MONTH.toUpperCase();
const NEXT = SPOT_NEXT_MONTH.toUpperCase();
const pad2 = (n) => String(n).padStart(2, "0");
const $$ = (sel) => document.querySelectorAll(sel);

// The month's checkout window closes at 23:59:59 on its last calendar day
// (current year). The clock is REAL: it targets that moment, so it can never
// drift into invented scarcity.
function getTarget() {
  if (monthIndex < 0) return null;
  const now = new Date();
  return new Date(now.getFullYear(), monthIndex + 1, 0, 23, 59, 59);
}

// Sold out and past-deadline are the SAME state everywhere. This is the
// single source of truth every surface reads from.
function isClosed() {
  const target = getTarget();
  return SPOTS_LEFT <= 0 || !target || target - new Date() <= 0;
}

// Everything except the ticking clock digits. Re-runs only when the
// open/closed state actually flips.
function renderStatic(closed) {
  $$("[data-countdown-label]").forEach((el) => {
    el.textContent = closed
      ? `Next builds start later in ${SPOT_NEXT_MONTH}`
      : `${SPOT_MONTH} builds close in`;
  });

  $$("[data-spot-meter]").forEach((el) => {
    el.innerHTML = "";
    const used = closed ? SPOT_TOTAL : SPOT_TOTAL - SPOTS_LEFT;
    for (let i = 0; i < SPOT_TOTAL; i++) {
      const s = document.createElement("span");
      s.className = "spot" + (i < used ? " spot--used" : "");
      el.appendChild(s);
    }
    el.setAttribute("aria-label", closed
      ? `All ${SPOT_TOTAL} ${SPOT_MONTH} build spots taken`
      : `${SPOTS_LEFT} of ${SPOT_TOTAL} ${SPOT_MONTH} build spots left`);
  });

  $$("[data-spot-phrase]").forEach((el) => {
    el.textContent = closed
      ? `${SPOT_MONTH} is full`
      : SPOTS_LEFT === SPOT_TOTAL
        ? `Only ${SPOT_TOTAL} builds in ${SPOT_MONTH}`
        : `${SPOTS_LEFT} of ${SPOT_MONTH}'s ${SPOT_TOTAL} builds left`;
  });

  $$("[data-spot-after]").forEach((el) => {
    el.textContent = closed
      ? `First crack reopens in ${SPOT_NEXT_MONTH} — join the list below.`
      : `Next opening: ${SPOT_NEXT_MONTH}.`;
  });

  $$("[data-spot-month]").forEach((el) => {
    el.textContent = SPOT_MONTH;
  });

  // $1 CTAs → Stripe checkout while the month is open; back to their in-page
  // anchors when it closes. (Runs BEFORE data-spot-cta so a closed month's
  // "join the list" #footer link isn't clobbered.)
  $$("[data-checkout]").forEach((el) => {
    if (!el.dataset.baseHref) el.dataset.baseHref = el.getAttribute("href");
    el.setAttribute("href", CHECKOUT_URL && !closed ? CHECKOUT_URL : el.dataset.baseHref);
  });

  $$("[data-spot-cta]").forEach((el) => {
    if (closed) {
      el.textContent = `GET FIRST CRACK AT ${NEXT} · JOIN THE LIST`;
      el.setAttribute("href", "#footer");
    } else {
      el.textContent = `See What $1 Gets You`;
    }
  });
}

// Clock digits only — the once-a-second work.
function renderClock(closed) {
  const target = getTarget();
  $$("[data-countdown]").forEach((el) => {
    el.style.display = closed ? "none" : "";
    if (closed) return;
    let diff = Math.max(0, Math.floor((target - new Date()) / 1000));
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    el.querySelector('[data-cd="days"]').textContent = pad2(days);
    el.querySelector('[data-cd="hours"]').textContent = pad2(hours);
    el.querySelector('[data-cd="mins"]').textContent = pad2(mins);
    el.querySelector('[data-cd="secs"]').textContent = pad2(secs);
    el.setAttribute("aria-label",
      `${days} days, ${hours} hours, ${mins} minutes, ${secs} seconds left in ${SPOT_MONTH}`);
  });
}

let wasClosed = null;
function render() {
  const closed = isClosed();
  if (closed !== wasClosed) {
    renderStatic(closed);
    wasClosed = closed;
  }
  renderClock(closed);
}

render();
setInterval(render, 1000);

// PAGE-RIP DECODE KICK — the torn-edge rips are structural page chrome.
// Chrome can leave a below-viewport async image "loaded but never painted"
// (complete=true, correct box, blank pixels) until something forces a decode;
// the band then ends in a razor-straight edge with the blueprint borders cut
// off square instead of ripped. Decoding each rip up front pins the bitmap
// so the tears are painted before the user scrolls to them.
window.addEventListener("load", () => {
  $$(".hero__rip, .tst__rip, .cs__rip").forEach((img) => {
    if (img.decode) img.decode().catch(() => {});
  });
});

// Footer email form — non-functional, faked success state (no network calls).
document.addEventListener("submit", (e) => {
  const form = e.target.closest(".footer__form");
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector(".footer__input");
  if (!input || !input.checkValidity()) {
    if (input) input.reportValidity();
    return;
  }
  const btn = form.querySelector(".footer__submit");
  const status = form.querySelector(".footer__status");
  if (btn) { btn.textContent = "THANKS!"; btn.disabled = true; }
  input.value = "";
  input.placeholder = "You're on the list ⚡";
  if (status) status.textContent = "Thanks, you're on the list.";
});

// Hero animation choreography: the arm rises from behind the torn rip
// (translateY transition on the box), then the clip plays ONCE and freezes on
// its final "new website" frame (no loop attr — an ended video holds its last
// frame). Entrance + play are gated on the box actually being visible
// (IntersectionObserver), so on phones — where the art sits below the copy —
// the moment isn't wasted off-screen before the user scrolls to it.
(() => {
  const box = document.querySelector("[data-hero-anim]");
  if (!box) return;
  const vid = box.querySelector("video");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !vid) {
    // no motion: swap the poster (old ugly site) for the final new-site frame
    // and never play — reduced-motion users get the payoff, not the tease
    if (vid) { vid.preload = "none"; vid.poster = "assets/hero-anim-still.jpg"; }
    return;
  }
  vid.muted = true; // defensive: autoplay policy needs it even with the attr
  // sink NOW, at parse time (script sits at end of body, before first paint),
  // so there's no flash of the settled box before the entrance. The hero's
  // overflow:hidden + the rip (z 4) hide the sunk portion.
  box.classList.add("is-prep");
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    vid.preload = "auto"; // start buffering during the 0.9s rise
    requestAnimationFrame(() => box.classList.add("is-in")); // rise
    setTimeout(() => {
      vid.play().catch(() => {}); // blocked autoplay ⇒ static poster, fine
    }, 950);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          go();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(box);
  } else {
    go();
  }
})();

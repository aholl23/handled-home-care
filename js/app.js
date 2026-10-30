/* Handled HomeCare: pages, example texts, and the request form. */
(function () {
  "use strict";
  var root = document.documentElement;
  if (!root.getAttribute("lang")) root.setAttribute("lang", "en");
  root.classList.add("js");

  var DATA = JSON.parse(document.getElementById("hh-data").textContent);
  function $(id) { return document.getElementById(id); }
  function make(tag, cls, text) { var el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; }
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var WHO_LABEL = { mine: "My home", parent: "My parent's home", away: "A home I'm away from", pro: "A local pro" };
  var PATH_LABEL = { fix: "Something needs fixing", check: "Seasonal home check", watch: "House watch while away", parent: "Looking after a parent's home", join: "Just joining (free)", pro: "Local pro" };
  var PAID = { check: 1, watch: 1, parent: 1 };
  var NEED_LABEL = { inside: "Inside the house", outside: "Outside the house", water: "On the water", safe: "Safe at home", away: "House checks", unsure: "Not sure" };
  var state = { db: null, user: null, uid: null, canSave: false };
  /* On the real website, js/site-config.js sets window.HH_SITE. Inside the Claude artifact it is absent. */
  var SITE = window.HH_SITE || null;
  /* The form sends only when all three EmailJS settings are filled in. */
  function cfg(v) { v = typeof v === "string" ? v.trim() : ""; return v && !/^PASTE/i.test(v) ? v : ""; }
  var EMAILJS = SITE && SITE.emailjs ? { serviceId: cfg(SITE.emailjs.serviceId), templateId: cfg(SITE.emailjs.templateId), publicKey: cfg(SITE.emailjs.publicKey) } : null;
  var SITE_READY = !!(EMAILJS && EMAILJS.serviceId && EMAILJS.templateId && EMAILJS.publicKey);

  /* ---------- pages ---------- */
  var ROUTES = ["home", "membership", "about", "get-started"];
  var ALIAS = { pros: "get-started", services: "home", "what-we-handle": "home", pricing: "membership", "get-help": "get-started", families: "home", "how-it-works": "home", how: "home" };
  /* old links that now point at a spot on the home page */
  var ANCHORS = { "how-it-works": "how", how: "how", services: "help", "what-we-handle": "help" };
  function anchorFor(h) { return ANCHORS.hasOwnProperty(h) ? ANCHORS[h] : null; }
  var pages = document.querySelectorAll("[data-page]");
  var current = null;

  function routeFromHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (ROUTES.indexOf(h) >= 0) return h;
    if (ALIAS[h]) return ALIAS[h];
    return "home";
  }
  function setCurrentNav(route, anchor) {
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      var k = a.getAttribute("data-nav");
      var on = anchor === "how" ? k === "how" : (k === route);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function scrollToAnchor(id) {
    var t = $(id);
    if (!t) return;
    var y = t.getBoundingClientRect().top + window.pageYOffset - (document.querySelector(".nav").offsetHeight + 16);
    window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? "auto" : "smooth" });
  }
  function show(route, opts) {
    opts = opts || {};
    var changed = route !== current;
    pages.forEach(function (p) { p.hidden = p.getAttribute("data-page") !== route; });
    current = route;
    document.body.setAttribute("data-route", route);
    setCurrentNav(route, opts.anchor);
    closeMenu();
    var cta = document.querySelector(".nav-cta");
    var onForm = route === "get-started";
    cta.textContent = onForm ? "Back to site" : "Get started";
    cta.setAttribute("href", onForm ? "#home" : "#get-started");
    cta.classList.toggle("btn-sun", !onForm);
    cta.classList.toggle("btn-quiet", onForm);
    if (route === "get-started") { if (location.hash === "#pros") setDraft({ who: "pro" }); openFlow(); }
    if (opts.anchor) { setTimeout(function () { scrollToAnchor(opts.anchor); }, changed ? 30 : 0); return; }
    if (changed || opts.top) {
      window.scrollTo(0, 0);
      if (opts.focus) {
        var h = document.querySelector('[data-page="' + route + '"] h1');
        if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      }
    }
    if (route === "home") requestAnimationFrame(onScroll);
  }
  window.addEventListener("hashchange", function () {
    var h = (location.hash || "").replace(/^#/, "");
    show(routeFromHash(), { focus: true, anchor: anchorFor(h) });
  });

  /* every link to a page: carry the request details along, and handle same-page clicks */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var target = a.getAttribute("href").slice(1);
    if (target === "fn1") return;
    var route = ROUTES.indexOf(target) >= 0 ? target : ALIAS[target];
    if (!route) return;
    if (route === "get-started") {
      var d = {};
      if (a.hasAttribute("data-who")) d.who = a.getAttribute("data-who");
      if (a.hasAttribute("data-needs")) d.needs = a.getAttribute("data-needs").split(" ");
      if (a.hasAttribute("data-notes")) d.notes = a.getAttribute("data-notes");
      if (a.hasAttribute("data-member")) d.member = a.getAttribute("data-member") === "1";
      if (a.id === "scn-start") { var s = scenario(); d.who = s.who; d.needs = s.needs; d.notes = firstMessage(s); }
      if (Object.keys(d).length) setDraft(d);
    }
    var anchor = anchorFor(target);
    if (location.hash === "#" + target) {
      e.preventDefault();
      show(route, { focus: true, anchor: anchor, top: !anchor });
    }
  });

  /* ---------- menu ---------- */
  var menuBtn = document.querySelector(".menu-btn");
  var mnav = $("mnav");
  function closeMenu() { mnav.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); }
  menuBtn.addEventListener("click", function () {
    var open = mnav.hidden;
    mnav.hidden = !open;
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !mnav.hidden) { closeMenu(); menuBtn.focus(); }
  });

  /* ---------- the phone: example conversations ---------- */
  var thread = $("thread");
  var chips = document.querySelectorAll(".chip");
  var steps = document.querySelectorAll(".step");
  var stickyMQ = window.matchMedia("(min-width: 960px) and (min-height: 760px)");
  var scnIndex = 0;
  var shownStage = 1;       // how far the conversation on screen has gone
  var shownCount = 0;       // messages on screen
  var playToken = 0;
  var played = false;       // phone (stacked layout) has auto-played once

  function scenario() { return DATA.scenarios[scnIndex]; }
  function firstMessage(s) { for (var i = 0; i < s.msgs.length; i++) if (s.msgs[i][1] === "me") return s.msgs[i][2]; return ""; }
  function msgsUpTo(stage) { return scenario().msgs.filter(function (m) { return m[0] <= stage; }); }
  function bubble(m, isNew) {
    var el = make("p", m[1] === "time" ? "m-time" : "m m-" + m[1], m[2]);
    if (isNew && !reduceMotion) el.classList.add("is-new");
    return el;
  }
  function toBottom(smooth) {
    try { thread.scrollTo({ top: thread.scrollHeight, behavior: smooth && !reduceMotion ? "smooth" : "auto" }); }
    catch (e) { thread.scrollTop = thread.scrollHeight; }
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduceMotion ? 0 : ms); }); }

  /* show the conversation up to `stage`, animating any new messages one by one */
  async function playTo(stage, opts) {
    opts = opts || {};
    var token = ++playToken;
    var target = msgsUpTo(stage);
    if (opts.reset) { thread.textContent = ""; shownCount = 0; }
    if (target.length < shownCount) {
      while (thread.children.length > target.length) thread.removeChild(thread.lastChild);
      shownCount = target.length;
      shownStage = stage;
      toBottom(false);
      return;
    }
    for (var i = shownCount; i < target.length; i++) {
      var m = target[i];
      if (token !== playToken) return;
      if (m[1] === "us" && !reduceMotion) {
        var t = make("p", "typing");
        t.setAttribute("aria-hidden", "true");
        t.innerHTML = "<i></i><i></i><i></i>";
        thread.appendChild(t);
        toBottom(true);
        await wait(opts.fast ? 420 : 700);
        if (token !== playToken) { if (t.parentNode) t.parentNode.removeChild(t); return; }
        thread.removeChild(t);
      } else if (!reduceMotion) {
        await wait(m[1] === "time" ? 120 : (opts.fast ? 260 : 420));
        if (token !== playToken) return;
      }
      thread.appendChild(bubble(m, true));
      shownCount = i + 1;
      toBottom(true);
    }
    shownStage = stage;
  }

  function activeStage() {
    var a = 1;
    steps.forEach(function (s) { if (s.classList.contains("is-active")) a = +s.getAttribute("data-step"); });
    return a;
  }
  function setActiveStep(n) {
    steps.forEach(function (s) { s.classList.toggle("is-active", +s.getAttribute("data-step") === n); });
  }

  /* sticky layout: the step crossing the middle of the screen drives the phone */
  var stepObserver = null;
  function startStepSync() {
    if (stepObserver) return;
    stepObserver = new IntersectionObserver(function (entries) {
      var best = null;
      entries.forEach(function (en) { if (en.isIntersecting) best = en.target; });
      if (!best) return;
      var n = +best.getAttribute("data-step");
      if (n !== activeStage()) { setActiveStep(n); playTo(n); }
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { stepObserver.observe(s); });
  }
  function stopStepSync() { if (stepObserver) { stepObserver.disconnect(); stepObserver = null; } }

  /* stacked layout: play the whole conversation once the phone is on screen */
  var phoneObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting && !stickyMQ.matches && !played) { played = true; playTo(4); }
    });
  }, { threshold: 0.55 });
  phoneObserver.observe(document.querySelector(".phone"));

  function applyLayout() {
    if (stickyMQ.matches) {
      setActiveStep(1);
      startStepSync();
    } else {
      stopStepSync();
      setActiveStep(0);
      steps.forEach(function (s) { s.classList.add("is-active"); });
    }
  }
  if (stickyMQ.addEventListener) stickyMQ.addEventListener("change", applyLayout); else stickyMQ.addListener(applyLayout);
  applyLayout();
  shownCount = thread.children.length;

  chips.forEach(function (c, i) {
    c.addEventListener("click", function () {
      if (i === scnIndex && !stickyMQ.matches && played) { playTo(4, { reset: true, fast: true }); return; }
      scnIndex = i;
      chips.forEach(function (o) { o.setAttribute("aria-pressed", o === c ? "true" : "false"); });
      var stage = stickyMQ.matches ? activeStage() : 4;
      played = true;
      playTo(stage, { reset: true, fast: true });
    });
  });

  /* ---------- statement: words light up as you scroll ---------- */
  var statement = $("statement");
  var words = statement ? statement.querySelectorAll(".w") : [];
  if (statement && !reduceMotion) statement.parentNode.parentNode.classList.add("js-reveal");
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (!statement || reduceMotion || current !== "home") return;
      var r = statement.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      /* starts lighting as the text enters; fully lit once it's centered */
      var start = vh * 0.85;
      var p = (start - r.top) / Math.max(1, vh * 0.35 + r.height * 0.5);
      p = Math.max(0, Math.min(1, p));
      var lit = Math.round(p * words.length);
      for (var i = 0; i < words.length; i++) words[i].classList.toggle("lit", i < lit);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- 65 of 100 houses ---------- */
  var hgrid = document.querySelector(".hgrid");
  if (hgrid) {
    var statNum = document.querySelector(".stat-num");
    var FILL_MS = 350, STAGGER_MS = 12;
    /* the gold homes fill in a diagonal wave from the top left: sort by column + row, then by row */
    var gold = Array.prototype.slice.call(hgrid.querySelectorAll(".h.on")).map(function (el) {
      var c = Math.round(+el.getAttribute("x") / 30), r = Math.round(+el.getAttribute("y") / 30);
      return { el: el, k: (c + r) * 10 + r };
    }).sort(function (a, b) { return a.k - b.k; });
    gold.forEach(function (g, n) { g.el.style.setProperty("--d", n * STAGGER_MS + "ms"); });
    var runMs = (gold.length - 1) * STAGGER_MS + FILL_MS;
    var countUp = function () {
      var t0 = null;
      function tick(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / runMs);
        statNum.textContent = Math.round(gold.length * p);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };
    if (reduceMotion || !("IntersectionObserver" in window)) hgrid.classList.add("is-on");
    else {
      if (statNum) statNum.textContent = "0";
      var hObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          hgrid.classList.add("is-on");
          if (statNum) countUp();
          hObs.disconnect();
        });
      }, { threshold: 0.4 });
      hObs.observe(hgrid);
    }
  }

  /* ---------- request flow ---------- */
  var form = $("flow");
  var qs = form.querySelectorAll(".q");
  var TOTAL = qs.length;
  var step = 1;
  var draft = null;
  var backToReview = false;
  var nextBtn = $("next"), backBtn = $("back"), statusEl = $("flow-status");
  var doneBox = $("done");
  var ticketNo = String(1000 + Math.floor(Math.random() * 9000));
  document.querySelectorAll(".progress-top span:last-child").forEach(function (s) { s.textContent = "Request No. " + ticketNo; });

  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
  function radio(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
  function checked(name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; }); }
  function path() { return radio("path"); }
  function digitsOk(s) { var d = s.replace(/\D/g, ""); return d.length === 10 || (d.length === 11 && d.charAt(0) === "1"); }
  /* Which of the five screens this path walks through. Joining skips the details; pros skip the home. */
  function stepList() { var p = path(); return p === "join" ? [1, 3, 4, 5] : p === "pro" ? [1, 2, 4, 5] : [1, 2, 3, 4, 5]; }

  /* Links elsewhere on the site hand over the old who/needs/member values. They map onto the new paths here. */
  function setDraft(d) {
    if (!draft) draft = {};
    if (d.who) draft.who = d.who;
    if (d.needs) draft.needs = (draft.needs || []).concat(d.needs);
    if (d.notes) draft.notes = d.notes;
    if (d.member === true || d.member === false) draft.member = d.member;
  }
  function draftPath(d) {
    var needs = d.needs || [];
    if (d.who === "pro") return "pro";
    if (d.who === "parent") return "parent";
    if (d.who === "away" || needs.indexOf("away") >= 0) return "watch";
    if (d.who === "mine") return "fix";
    if (d.member === true) return "join";
    if (d.member === false || needs.length) return "fix";
    return "";
  }
  function addText(ta, text) { if (ta.value.indexOf(text) < 0) ta.value = ta.value ? ta.value.replace(/\s+$/, "") + "\n" + text : text; }
  function applyDraft() {
    if (!draft) return;
    if (!doneBox.hidden) resetFlow(false);
    var d = draft; draft = null;
    var p = draftPath(d);
    if (p && $("path-" + p)) $("path-" + p).checked = true;
    if (p === "fix") (d.needs || []).forEach(function (n) { var el = $("need-" + n); if (el) el.checked = true; });
    if (d.notes) addText(p === "fix" || !p ? $("f-details") : $("f-extra"), d.notes);
    syncFlow();
  }
  function openFlow() { applyDraft(); }

  var Q2_TITLE = { fix: "What needs fixing?", check: "When would you like your home check?", watch: "Tell us about your time away.", parent: "Tell us about your parent.", pro: "Tell us about your work." };
  var Q3_TITLE = { watch: "Which home will you be away from?", parent: "Where's your parent's home?" };
  var Q4_HELP = { parent: "Your own details, not your parent's. We'll call you first.", join: "We'll send seasonal reminders here. A phone number, an email, or both.", pro: "Your own details. We'll use them to reach you about jobs." };
  var EXTRA_LABEL = { fix: "Anything else we should know?", check: "Anything we should look at? Want house watch too? Say so here.", watch: "Anything else we should know? Want a home check too? Say so here.", parent: "What would help most? Is there a best way to reach them?", pro: "Anything else about your work?" };
  var EXTRA_HINT = { fix: "Renting it out? Add who lives there and their number. More than one address? List them here." };

  function syncFlow() {
    form.querySelectorAll(".opt-row, .pill").forEach(function (l) { var i = l.querySelector("input"); l.classList.toggle("is-checked", !!(i && i.checked)); });
    var p = path();
    form.querySelectorAll("[data-panel]").forEach(function (el) { el.hidden = el.getAttribute("data-panel") !== p; });
    $("extra-wrap").hidden = !EXTRA_LABEL[p];
    $("extra-label").textContent = EXTRA_LABEL[p] || "";
    $("extra-label").appendChild(make("span", "optional", " (optional)"));
    if (EXTRA_HINT[p]) $("extra-label").appendChild(make("span", "hint", EXTRA_HINT[p])).style.display = "block";
    $("q2-title").textContent = Q2_TITLE[p] || "Tell us more.";
    $("q3-title").textContent = Q3_TITLE[p] || "Where's the home?";
    $("q4-title").textContent = p === "join" ? "Where should we send reminders?" : "How can we reach you?";
    $("q4-help").textContent = Q4_HELP[p] || "Your own details. We'll use them to call you about this request.";
    var emailOnly = radio("how") === "Email me" && p !== "join";
    $("q3-help").hidden = p !== "join";
    $("phone-opt").hidden = !(p === "join" || emailOnly);
    $("phone-opt").textContent = p === "join" ? "(one is enough)" : "(optional)";
    $("email-opt").hidden = emailOnly;
    $("email-opt").textContent = p === "join" ? "(one is enough)" : "(optional)";
    $("fld-how").hidden = p === "join";
    $("fld-calltime").hidden = p === "join" || emailOnly;
    $("fld-owner-phone").querySelector(".label").textContent = radio("pknows") === "Not yet, call me first" ? "Their phone (optional)" : "Their phone";
    var list = stepList(), idx = Math.max(0, list.indexOf(step));
    $("prog-text").textContent = "Step " + (idx + 1) + " of " + list.length;
    $("prog-bar").style.width = ((idx + 1) / list.length * 100) + "%";
    backBtn.disabled = step === 1;
    var last = step === TOTAL;
    nextBtn.textContent = last ? (state.canSave ? (p === "join" ? "Join for free" : "Send my request") : "Preview my request") : backToReview ? "Back to review" : "Continue";
    nextBtn.className = "btn " + (last ? "btn-sun" : "btn-ink");
  }
  form.addEventListener("change", syncFlow);

  function clearErrors() {
    form.querySelectorAll(".has-error").forEach(function (f) { f.classList.remove("has-error"); });
    form.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".group-error").forEach(function (e) { e.hidden = true; });
  }
  function fieldError(fid, iid) { $(fid).classList.add("has-error"); $(iid).setAttribute("aria-invalid", "true"); }
  function groupError(eid, firstInput) { $(eid).hidden = false; return $(firstInput); }
  function validate(n) {
    clearErrors();
    var p = path(), first = null;
    function note(el) { first = first || el; }
    if (n === 1 && !p) note(groupError("err-path", "path-fix"));
    if (n === 2) {
      if (p === "fix" && val("f-details").length < 3) { fieldError("fld-details", "f-details"); note($("f-details")); }
      if (p === "check" && !radio("season")) note(groupError("err-season", "season-spring"));
      if (p === "watch") {
        if (!val("f-away")) { fieldError("fld-away", "f-away"); note($("f-away")); }
        if (!radio("freq")) note(groupError("err-freq", "freq-week"));
        if (!radio("storm")) note(groupError("err-storm", "storm-yes"));
      }
      if (p === "parent") {
        var op = val("f-owner-phone");
        if (!val("f-owner")) { fieldError("fld-owner", "f-owner"); note($("f-owner")); }
        if (!radio("pknows")) note(groupError("err-pknows", "pknows-yes"));
        if ((radio("pknows") === "Yes, they know" && !digitsOk(op)) || (op && !digitsOk(op))) { fieldError("fld-owner-phone", "f-owner-phone"); note($("f-owner-phone")); }
      }
      if (p === "pro") {
        if (!val("f-trade")) { fieldError("fld-trade", "f-trade"); note($("f-trade")); }
        if (!checked("served").length) note(groupError("err-served", "served-stev"));
        if (!radio("insured")) note(groupError("err-insured", "ins-yes"));
      }
    }
    if (n === 3) {
      if (!radio("town")) note(groupError("err-town", "town-stevensville"));
      if (!radio("htype") && p !== "join") note(groupError("err-htype", "htype-house"));
    }
    if (n === 4) {
      var em = val("f-email"), ph = val("f-phone");
      if (!val("f-name")) { fieldError("fld-name", "f-name"); note($("f-name")); }
      if (p === "join") {
        if (!ph && !em) { $("err-reach").hidden = false; note($("f-phone")); }
        if (ph && !digitsOk(ph)) { fieldError("fld-phone", "f-phone"); note($("f-phone")); }
      } else if (radio("how") === "Email me") {
        if (!em) { fieldError("fld-email", "f-email"); $("err-email").textContent = "Add your email so we can reach you."; note($("f-email")); }
        if (ph && !digitsOk(ph)) { fieldError("fld-phone", "f-phone"); note($("f-phone")); }
      } else if (!digitsOk(ph)) { fieldError("fld-phone", "f-phone"); note($("f-phone")); }
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { fieldError("fld-email", "f-email"); $("err-email").textContent = "That email looks incomplete. It should look like name@example.com."; note($("f-email")); }
    }
    if (first) { first.focus(); return false; }
    return true;
  }

  function goTo(n, focus) {
    step = Math.max(1, Math.min(TOTAL, n));
    if (step === TOTAL) backToReview = false;
    qs.forEach(function (q) {
      var on = +q.getAttribute("data-q") === step;
      q.hidden = !on;
      q.classList.remove("is-entering");
      if (on && !reduceMotion) { void q.offsetWidth; q.classList.add("is-entering"); }
    });
    statusEl.textContent = "";
    clearErrors();
    syncFlow();
    if (step === TOTAL) buildReview($("review"), true);
    var top = form.getBoundingClientRect().top + window.pageYOffset - (document.querySelector(".nav").offsetHeight + 24);
    if (window.pageYOffset > top) window.scrollTo(0, Math.max(0, top));
    if (focus !== false) { var h = $("q" + step + "-title"); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }
  backBtn.addEventListener("click", function () { var l = stepList(), i = l.indexOf(step); backToReview = false; goTo(l[Math.max(0, i - 1)]); });
  function nextStep() { var l = stepList(), i = l.indexOf(step); return l[Math.min(l.length - 1, i + 1)]; }

  function record() {
    var p = path(), pro = p === "pro", join = p === "join", nohome = pro || join;
    var parent = p === "parent";
    var r = {
      id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ticketNo: ticketNo,
      createdAt: new Date().toISOString(),
      path: p,
      name: val("f-name"),
      phone: val("f-phone"),
      contactHow: join ? "" : radio("how"),
      callTime: join || radio("how") === "Email me" ? "" : radio("calltime"),
      email: val("f-email"),
      town: pro ? checked("served").join(", ") : join ? "" : radio("town"),
      street: nohome ? "" : val("f-street"),
      homeType: nohome ? "" : radio("htype"),
      acAge: nohome ? "" : val("f-ac"),
      roofAge: nohome ? "" : val("f-roof"),
      extra: EXTRA_LABEL[p] ? val("f-extra") : "",
      member: !pro,
      details: "", needs: [], urgency: "", visit: false,
      season: "", away: "", freq: "", storm: "",
      ownerName: "", ownerPhone: "", ownerKnows: "",
      trade: "", insured: ""
    };
    if (p === "fix") { r.details = val("f-details"); r.needs = checked("needs").map(function (n) { return NEED_LABEL[n] || n; }); r.urgency = radio("urgency"); r.visit = $("f-visit").checked; }
    if (p === "check") r.season = radio("season");
    if (p === "watch") { r.away = val("f-away"); r.freq = radio("freq"); r.storm = radio("storm"); }
    if (parent) { r.ownerName = val("f-owner"); r.ownerPhone = val("f-owner-phone"); r.ownerKnows = radio("pknows") === "Yes, they know" ? "Yes, they know" : "Not yet, call the child first"; }
    if (pro) { r.trade = val("f-trade"); r.insured = radio("insured") === "Yes" ? "Yes" : "No"; }
    return r;
  }
  function reachLine(r) {
    var bits = [r.name];
    if (r.phone) bits.push(r.phone);
    if (r.contactHow) bits.push(r.contactHow.toLowerCase().replace(" me", "") + (r.callTime && r.callTime !== "Any time" ? ", " + r.callTime.toLowerCase() : ""));
    return bits.join(", ");
  }
  function buildReview(dl, editable) {
    var r = record();
    dl.textContent = "";
    function row(k, v, toStep) {
      if (!v) return;
      var d = make("div");
      var dd = make("dd");
      d.appendChild(make("dt", null, k));
      dd.appendChild(make("span", null, v));
      if (editable && toStep) {
        var b = make("button", null, "Edit");
        b.type = "button";
        b.setAttribute("aria-label", "Edit " + k.toLowerCase());
        b.addEventListener("click", function () { backToReview = true; goTo(toStep); });
        dd.appendChild(b);
      }
      d.appendChild(dd);
      dl.appendChild(d);
    }
    if (!editable) row("Request", "No. " + r.ticketNo);
    row("What", PATH_LABEL[r.path], 1);
    if (r.path === "fix") {
      row("The job", r.details, 2);
      row("Kind of job", r.needs.join(", "), 2);
      row("How soon", r.urgency, 2);
      if (r.visit) row("Look first", "Yes, check it out in person", 2);
    }
    row("When", r.season, 2);
    if (r.path === "watch") { row("Away", r.away, 2); row("Visits", r.freq, 2); row("After storms", r.storm, 2); }
    if (r.path === "parent") { row("Parent", r.ownerName + (r.ownerPhone ? ", " + r.ownerPhone : ""), 2); row("They know", r.ownerKnows, 2); }
    if (r.path === "pro") { row("Work", r.trade, 2); row("Towns", r.town, 2); row("Insured", r.insured, 2); }
    row("Notes", r.extra, 2);
    if (r.path !== "pro") row(r.path === "parent" ? "Parent's home" : "Home", [r.street, radio("town"), r.homeType].filter(Boolean).join(", "), 3);
    row("AC and roof", [r.acAge ? "AC " + r.acAge : "", r.roofAge ? "Roof " + r.roofAge : ""].filter(Boolean).join(", "), 3);
    row(r.path === "join" ? "Reminders to" : "We'll reach", reachLine(r), 4);
    if (r.email) row("Email", r.email, 4);
    if (editable) {
      var p = r.path;
      $("member-note").textContent = p === "pro"
        ? "Pros pay us a referral fee on jobs we send. We'll go over it on the call."
        : "You'll be a free member: we'll send seasonal reminders. Unsubscribe anytime." + (PAID[p] ? " No payment today. We'll go over the price on the call." : "");
      $("privacy-note").textContent = p === "pro" ? "" : "We only share your details with a pro when a job needs one.";
    }
  }

  function cap(name) {
    try {
      if (window.claude && typeof window.claude.use === "function") {
        return Promise.resolve(window.claude.use(name)).catch(function () { return null; });
      }
    } catch (e) {}
    return Promise.resolve(null);
  }
  function setPreview() { state.canSave = false; $("preview-note").hidden = false; syncFlow(); }
  var ready = (async function () {
    if (SITE) {
      if (/[?&]team(=|&|$)/.test(location.search)) document.body.classList.add("is-team");
      if (SITE_READY) { state.canSave = true; syncFlow(); } else setPreview();
      return;
    }
    var hasRuntime = !!(window.claude && typeof window.claude.use === "function");
    if (!hasRuntime) document.body.classList.add("is-team");   /* local preview shows the photo notes */
    var got = await Promise.all([cap("db"), cap("user")]);
    state.db = got[0];
    state.user = got[1];
    if (state.user) { try { state.uid = await state.user.id(); } catch (e) { state.uid = null; } }
    var writable = null;
    if (state.user) { try { writable = await state.user.can("data.write"); } catch (e) { writable = null; } }
    if (!state.db || !state.uid || writable === false) setPreview();
    else { state.canSave = true; syncFlow(); }
    var editor = false;
    if (state.user) { try { editor = await state.user.canEdit(); } catch (e) { editor = false; } }
    if (editor) document.body.classList.add("is-team");
    if (state.db && editor) startInbox();
  })().catch(function () { setPreview(); });

  /* Sends the request through the EmailJS REST API. Field names match the template in CLAUDE.md. */
  function detailLines(r) {
    var L = [];
    if (r.path === "fix") { L.push("The job: " + r.details, "Kind of job: " + (r.needs.join(", ") || "Not said"), "How soon: " + r.urgency, "Check it out in person first: " + (r.visit ? "Yes" : "No")); }
    if (r.path === "check") L.push("Preferred time: " + r.season);
    if (r.path === "watch") L.push("Away: " + r.away, "Visits: " + r.freq, "Storm checks: " + r.storm);
    if (r.path === "parent") L.push("Parent: " + r.ownerName + (r.ownerPhone ? ", " + r.ownerPhone : ", no phone given"), "Parent knows we'll call: " + r.ownerKnows);
    if (r.path === "pro") L.push("Trade: " + r.trade, "Towns served: " + r.town, "Insured (their answer, we don't claim it): " + r.insured);
    if (r.path === "join") L.push("Just joining. No job.");
    return L.join("\n");
  }
  async function sendByEmail(rec) {
    var none = function (v) { return v || "Not given"; };
    var na = function (v) { return v || "Not applicable"; };
    var res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: EMAILJS.templateId,
        user_id: EMAILJS.publicKey,
        template_params: {
          request_no: rec.ticketNo,
          sent_at: new Date(rec.createdAt).toLocaleString(),
          path: PATH_LABEL[rec.path],
          membership: rec.member ? "Free member (reminders)" : "No (local pro)",
          name: rec.name,
          phone: none(rec.phone),
          contact_pref: rec.contactHow ? rec.contactHow.replace(" me", "") : "Not asked",
          call_time: rec.callTime || "Not asked",
          email: none(rec.email),
          reply_to: rec.email,
          request_details: detailLines(rec),
          job: na(rec.details),
          kind_of_job: na(rec.needs.join(", ")),
          how_soon: na(rec.urgency),
          visit_first: rec.path === "fix" ? (rec.visit ? "Yes" : "No") : "Not applicable",
          season: na(rec.season),
          away_dates: na(rec.away),
          visit_frequency: na(rec.freq),
          storm_checks: na(rec.storm),
          parent_name: na(rec.ownerName),
          parent_phone: na(rec.ownerPhone),
          parent_knows: na(rec.ownerKnows),
          trade: na(rec.trade),
          towns_served: rec.path === "pro" ? rec.town : "Not applicable",
          insured: na(rec.insured),
          home_type: na(rec.homeType),
          ac_age: none(rec.acAge),
          roof_age: none(rec.roofAge),
          extra_notes: none(rec.extra),
          street: rec.path === "pro" || rec.path === "join" ? "Not applicable" : none(rec.street),
          town: rec.town || "Not applicable"
        }
      })
    });
    if (!res.ok) {
      var text = "";
      try { text = await res.text(); } catch (e) { text = ""; }
      var err = new Error(text || ("HTTP " + res.status));
      err.code = res.status === 429 ? "quota_exceeded" : "send_failed";
      throw err;
    }
  }
  async function save(rec) {
    if (SITE) return sendByEmail(rec);
    var ref = state.db.doc("requests/" + state.uid);
    var snap = await ref.get();
    var body = snap.exists ? snap.data() : null;
    var items = body && Array.isArray(body.items) ? body.items.slice() : [];
    items.push(rec);
    await ref.set({ items: items, updatedAt: rec.createdAt });
  }

  var sending = false;
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (sending) return;
    if (!validate(step)) return;
    if (step < TOTAL) { goTo(backToReview ? TOTAL : nextStep()); return; }
    sending = true;
    nextBtn.disabled = true;
    statusEl.textContent = "";
    try {
      await ready;
      var rec = record();
      if (state.canSave) {
        try { await save(rec); finish(rec, true); }
        catch (err) {
          var code = err && err.code;
          if (["invalid_argument", "not_granted", "revoked", "capability_disabled", "capability_removed", "transform_error"].indexOf(code) >= 0) {
            setPreview();
            finish(rec, false);
          } else if (code === "quota_exceeded") {
            statusEl.textContent = "We can't take new requests online right now. Please try again later.";
          } else {
            statusEl.textContent = "That didn't go through. Please wait a moment and press Send again. Everything you typed is still here.";
          }
        }
      } else {
        finish(rec, false);
      }
    } finally {
      sending = false;
      nextBtn.disabled = false;
    }
  });

  /* What the thank-you screen says depends on the path they picked. */
  function doneCopy(r, when) {
    var first = r.name.split(/\s+/)[0] || "";
    var hi = first ? ", " + first : "";
    var reach = r.contactHow === "Text me" ? "We'll text you" : r.contactHow === "Email me" ? "We'll email you" : "We'll call you";
    var at = r.callTime && r.callTime !== "Any time" ? " " + (r.callTime === "Morning" ? "in the morning" : r.callTime === "Afternoon" ? "in the afternoon" : "in the evening") : " soon";
    if (r.path === "fix") return { title: "Thank you" + hi + ". We have your request.", body: reach + at + " to talk it over. Nothing is booked or charged until you say yes.", steps: [reach + " and ask a few questions." + (r.visit ? " We'll set up a time to look at it in person first." : ""), "We find a local pro we trust and send you their price.", "You say yes. They do the job and you pay them directly. We never add anything to their price.", "After the job, we check that it went right."] };
    if (r.path === "check") return { title: "Thank you" + hi + ". We have your request.", body: reach + at + " to pick a day. No payment has been taken.", steps: [reach + " to pick a day" + (r.season && r.season.indexOf("Not sure") < 0 ? " in " + r.season.toLowerCase().replace("as soon as you can", "the next few weeks") : "") + ".", "We'll go over the price of the check on the call.", "We walk through your home and send you what we saw.", "For anything we find, we line up local pros. You pay them directly."] };
    if (r.path === "watch") return { title: "Thank you" + hi + ". We have your request.", body: reach + at + " to plan your time away. No payment has been taken.", steps: [reach + " to go over your dates and how often to stop by.", "We'll go over the price on the call.", "We visit on the schedule and send you a note each time.", r.storm === "Yes" ? "After a big storm, we check the house and tell you what we find." : "If a big storm comes and you want us to check, just tell us."] };
    if (r.path === "parent") return { title: "Thank you" + hi + ". We have your request.", body: (r.ownerKnows.indexOf("Not yet") === 0 ? "We'll call you first. We won't call " + r.ownerName + " until you say so." : "We'll call you first, then " + r.ownerName + ".") + " No payment has been taken.", steps: [reach + " first to learn about " + r.ownerName + " and what would help.", "We'll go over the price on the call.", "We check in on " + r.ownerName + "'s home and send you updates.", "If something needs fixing, we line up a local pro. You pay them directly."] };
    if (r.path === "pro") return { title: "Thanks" + hi + ". We have your details.", body: "We'll be in touch about the kind of work you do.", steps: [reach + at.replace(" soon", " soon") + " to learn about your work.", "When a homeowner in your towns needs your trade, we send you the job.", "You quote and do the work. The homeowner pays you directly.", "Pros pay us a referral fee on jobs we send. We'll go over it on the call."] };
    return { title: "You're in" + hi + ". Welcome.", body: "You're a free member. We'll send seasonal reminders" + (r.phone && r.email ? " by text and email" : r.phone ? " by text" : " by email") + ". Unsubscribe anytime.", steps: ["Watch for your first seasonal reminder.", "When something needs doing, come back and tell us. We'll find a local pro.", "Want a home check, house watch, or help with a parent's home? Ask any time. We'll go over the price on a call."] };
  }
  function finish(rec, sent) {
    var c = doneCopy(rec);
    doneBox.classList.toggle("is-preview", !sent);
    if (sent) {
      $("done-title").textContent = c.title;
      $("done-body").textContent = c.body;
    } else {
      $("done-title").textContent = "Here's how your request would look.";
      $("done-body").textContent = "Online requests open soon, so this one was not sent. Nothing was booked or charged.";
    }
    var ol = $("next-list");
    ol.textContent = "";
    c.steps.forEach(function (t) { ol.appendChild(make("li", null, t)); });
    $("share").hidden = rec.path === "pro";
    buildReview($("done-summary"), false);
    $("done-next").hidden = !sent;
    form.hidden = true;
    doneBox.hidden = false;
    window.scrollTo(0, 0);
    try { $("done-title").focus({ preventScroll: true }); } catch (e) { $("done-title").focus(); }
  }
  function resetFlow(focus) {
    form.reset();
    clearErrors();
    statusEl.textContent = "";
    backToReview = false;
    ticketNo = String(1000 + Math.floor(Math.random() * 9000));
    document.querySelectorAll(".progress-top span:last-child").forEach(function (s) { s.textContent = "Request No. " + ticketNo; });
    doneBox.hidden = true;
    form.hidden = false;
    goTo(1, focus);
  }
  $("again").addEventListener("click", function () { resetFlow(true); });

  /* ---------- team inbox (editors only) ---------- */
  function startInbox() {
    var box = $("inbox"), list = $("inbox-list"), count = $("inbox-count");
    box.hidden = false;
    state.db.collection("requests").onSnapshot(function (snap) {
      var all = [];
      snap.docs.forEach(function (d) {
        var b = d.data();
        if (b && Array.isArray(b.items)) b.items.forEach(function (it) { if (it && typeof it === "object") all.push(it); });
      });
      all.sort(function (a, b) { return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); });
      count.textContent = "(" + all.length + ")";
      list.textContent = "";
      if (!all.length) { list.appendChild(make("p", "fine", "No requests yet.")); return; }
      all.forEach(function (it) {
        var c = make("article", "req");
        c.appendChild(make("strong", null, "No. " + (it.ticketNo || "?") + ", " + String(it.name || "No name") + ""));
        var when = "";
        try { when = new Date(it.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch (e) {}
        c.appendChild(make("span", null, [when, it.phone, it.callTime ? "call " + String(it.callTime).toLowerCase() : "", it.email].filter(Boolean).join(", ")));
        c.appendChild(make("span", null, [PATH_LABEL[it.path] || WHO_LABEL[it.who] || "", it.ownerName ? "Parent: " + it.ownerName + (it.ownerPhone ? " " + it.ownerPhone : "") : "", [it.street, it.town].filter(Boolean).join(", ")].filter(Boolean).join(". ")));
        if (Array.isArray(it.needs) && it.needs.length) c.appendChild(make("span", null, it.needs.join(", ") + (it.urgency ? ". " + it.urgency : "")));
        if (it.visit) c.appendChild(make("span", null, "Wants one of us to check it out in person first"));
        if (it.details) c.appendChild(make("p", "d", String(it.details)));
        list.appendChild(c);
      });
    }, function () {
      list.textContent = "";
      list.appendChild(make("p", "fine", "The inbox couldn't load. Reopen the page to try again."));
    });
  }

  /* ---------- thank-you: text this to a neighbor ---------- */
  var shareBtn = $("share-btn"), shareStatus = $("share-status");
  var onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  shareBtn.addEventListener("click", function (e) {
    if (onPhone) return;   /* phones open their texting app through the sms: link */
    e.preventDefault();
    var text = shareBtn.getAttribute("data-msg");
    if (navigator.share) { navigator.share({ text: text }).catch(function () {}); return; }
    var done = function () { shareStatus.textContent = "Copied. Paste it into a text or email."; };
    try { navigator.clipboard.writeText(text).then(done, function () { shareStatus.textContent = text; }); }
    catch (err) { shareStatus.textContent = text; }
  });

  /* ---------- phone: a Get started button follows you down the page ---------- */
  var stickyCta = $("sticky-cta");
  var stickyTick = false;
  function updateSticky() {
    stickyTick = false;
    var h = document.documentElement;
    var past = window.pageYOffset > window.innerHeight * 0.6;
    /* hide the bar once the closing call to action or the footer is on screen, so it never covers them */
    var end = document.querySelector(".foot");
    var closing = Array.prototype.filter.call(document.querySelectorAll(".price-band, .mem-close"), function (s) { return s.offsetParent !== null; })[0];
    var nearEnd = (end && end.getBoundingClientRect().top < window.innerHeight - 8) || (closing && closing.getBoundingClientRect().top < window.innerHeight - 8);
    var on = past && !nearEnd && (current === "home" || current === "membership");
    stickyCta.classList.toggle("is-on", on);
    stickyCta.setAttribute("aria-hidden", on ? "false" : "true");
    stickyCta.tabIndex = on ? 0 : -1;
  }
  function queueSticky() { if (!stickyTick) { stickyTick = true; requestAnimationFrame(updateSticky); } }
  window.addEventListener("scroll", queueSticky, { passive: true });
  window.addEventListener("resize", queueSticky);
  window.addEventListener("hashchange", queueSticky);

  /* ---------- start ---------- */
  syncFlow();
  var startHash = (location.hash || "").replace(/^#/, "");
  show(routeFromHash(), { anchor: anchorFor(startHash) });
})();

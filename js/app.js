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
    if (reduceMotion || !("IntersectionObserver" in window)) hgrid.classList.add("is-on");
    else {
      var hObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { hgrid.classList.add("is-on"); hObs.disconnect(); } });
      }, { threshold: 0.45 });
      hObs.observe(hgrid);
    }
  }

  /* ---------- request flow ---------- */
  var form = $("flow");
  var qs = form.querySelectorAll(".q");
  var TOTAL = qs.length;
  var step = 1;
  var draft = null;
  var nextBtn = $("next"), backBtn = $("back"), statusEl = $("flow-status");
  var doneBox = $("done");
  var ticketNo = "4127";

  function val(id) { var el = $(id); return el ? el.value.trim() : ""; }
  function radio(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
  function checked(name) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; }); }

  function setDraft(d) {
    if (!draft) draft = {};
    if (d.who) draft.who = d.who;
    if (d.needs) draft.needs = (draft.needs || []).concat(d.needs);
    if (d.notes) draft.notes = d.notes;
    if (d.member === true || d.member === false) draft.member = d.member;
  }
  function applyDraft() {
    if (!draft) return;
    if (!doneBox.hidden) resetFlow(false);
    var d = draft; draft = null;
    if (d.who && $("who-" + d.who)) $("who-" + d.who).checked = true;
    (d.needs || []).forEach(function (n) { var el = $("need-" + n); if (el) el.checked = true; });
    if (d.notes) {
      var ta = $("f-details");
      if (ta.value.indexOf(d.notes) < 0) ta.value = ta.value ? ta.value.replace(/\s+$/, "") + "\n" + d.notes : d.notes;
    }
    if (d.member === true || d.member === false) $("f-member").checked = d.member;
    syncFlow();
  }
  function openFlow() { applyDraft(); }

  function syncFlow() {
    form.querySelectorAll(".opt-row, .pill").forEach(function (l) { var i = l.querySelector("input"); l.classList.toggle("is-checked", !!(i && i.checked)); });
    var isPro = radio("who") === "pro";
    $("parent-fields").hidden = radio("who") !== "parent";
    $("fld-urgency").hidden = isPro;
    $("visit-opt").hidden = isPro;
    var memberOnly = $("f-member").checked;
    $("q2-help").textContent = isPro ? "Tell us what work you do and how long you've done it." : memberOnly
      ? "Anything you need help with right now? This is optional if you're just joining."
      : "Describe it in your own words, the way you'd tell a neighbor.";
    $("prog-text").textContent = "Step " + step + " of " + TOTAL;
    $("prog-bar").style.width = (step / TOTAL * 100) + "%";
    backBtn.disabled = step === 1;
    nextBtn.textContent = step < TOTAL ? "Continue" : (state.canSave ? "Send my request" : "Preview my request");
    nextBtn.className = "btn " + (step < TOTAL ? "btn-ink" : "btn-sun");
  }
  form.addEventListener("change", syncFlow);

  function clearErrors() {
    form.querySelectorAll(".has-error").forEach(function (f) { f.classList.remove("has-error"); });
    form.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
    $("err-who").hidden = true;
    $("err-town").hidden = true;
  }
  function fieldError(fid, iid) { $(fid).classList.add("has-error"); $(iid).setAttribute("aria-invalid", "true"); }
  function validate(n) {
    clearErrors();
    var first = null;
    if (n === 1 && !radio("who")) { $("err-who").hidden = false; first = $("who-mine"); }
    if (n === 2 && !$("f-member").checked && val("f-details").length < 3) { fieldError("fld-details", "f-details"); first = $("f-details"); }
    if (n === 3) {
      var digits = val("f-phone").replace(/\D/g, "");
      var em = val("f-email");
      if (!val("f-name")) { fieldError("fld-name", "f-name"); first = first || $("f-name"); }
      if (!(digits.length === 10 || (digits.length === 11 && digits.charAt(0) === "1"))) { fieldError("fld-phone", "f-phone"); first = first || $("f-phone"); }
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { fieldError("fld-email", "f-email"); first = first || $("f-email"); }
      if (radio("who") === "parent" && !val("f-owner")) { fieldError("fld-owner", "f-owner"); first = first || $("f-owner"); }
    }
    if (n === 4 && !radio("town")) { $("err-town").hidden = false; first = $("town-stevensville"); }
    if (first) { first.focus(); return false; }
    return true;
  }

  function goTo(n, focus) {
    step = Math.max(1, Math.min(TOTAL, n));
    qs.forEach(function (q) {
      var on = +q.getAttribute("data-q") === step;
      q.hidden = !on;
      q.classList.remove("is-entering");
      if (on && !reduceMotion) { void q.offsetWidth; q.classList.add("is-entering"); }
    });
    statusEl.textContent = "";
    clearErrors();
    if (step === TOTAL) buildReview($("review"), true);
    syncFlow();
    var top = form.getBoundingClientRect().top + window.pageYOffset - (document.querySelector(".nav").offsetHeight + 24);
    if (window.pageYOffset > top) window.scrollTo(0, Math.max(0, top));
    if (focus !== false) { var h = $("q" + step + "-title"); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
  }
  backBtn.addEventListener("click", function () { goTo(step - 1); });

  function record() {
    var who = radio("who");
    return {
      id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ticketNo: ticketNo,
      createdAt: new Date().toISOString(),
      who: who,
      needs: checked("needs").map(function (n) { return NEED_LABEL[n] || n; }),
      details: val("f-details"),
      urgency: who === "pro" ? "Not applicable (local pro)" : radio("urgency"),
      name: val("f-name"),
      phone: val("f-phone"),
      callTime: radio("calltime"),
      email: val("f-email"),
      ownerName: who === "parent" ? val("f-owner") : "",
      ownerPhone: who === "parent" ? val("f-owner-phone") : "",
      town: radio("town"),
      street: val("f-street"),
      visit: who === "pro" ? false : $("f-visit").checked,
      member: $("f-member").checked
    };
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
        b.addEventListener("click", function () { goTo(toStep); });
        dd.appendChild(b);
      }
      d.appendChild(dd);
      dl.appendChild(d);
    }
    if (!editable) row("Request", "No. " + r.ticketNo);
    row("For", (WHO_LABEL[r.who] || "") + (r.ownerName ? " (" + r.ownerName + ")" : ""), 1);
    row("The job", r.details || (r.member ? "Joining as a member" : ""), 2);
    if (r.needs.length) row("Kind of job", r.needs.join(", "), 2);
    if (r.visit) row("Visit first", "Yes, check it out in person", 2);
    row("How soon", r.urgency, 2);
    row("We'll call", r.name + ", " + r.phone + " (" + r.callTime.toLowerCase() + ")", 3);
    if (r.email) row("Email", r.email, 3);
    row("Home", [r.street, r.town].filter(Boolean).join(", "), 4);
    if (!editable && r.member) row("Membership", "Yes, sign me up");
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
  async function sendByEmail(rec) {
    var yes = function (v) { return v ? "Yes" : "No"; };
    var who = (WHO_LABEL[rec.who] || rec.who) + (rec.ownerName ? ": " + rec.ownerName + (rec.ownerPhone ? ", " + rec.ownerPhone : "") : "");
    var res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: EMAILJS.templateId,
        user_id: EMAILJS.publicKey,
        template_params: {
          request_no: rec.ticketNo,
          name: rec.name,
          phone: rec.phone,
          call_time: rec.callTime,
          who_for: who,
          kind_of_job: rec.needs.join(", ") || "Not said",
          job: rec.details || (rec.member ? "Joining as a member" : ""),
          how_soon: rec.urgency,
          visit_first: yes(rec.visit),
          membership: yes(rec.member),
          street: rec.street || "Not given",
          town: rec.town,
          email: rec.email || "Not given",
          reply_to: rec.email,
          sent_at: new Date(rec.createdAt).toLocaleString()
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
    if (step < TOTAL) { goTo(step + 1); return; }
    if (!$("f-member").checked && val("f-details").length < 3) { goTo(2); validate(2); return; }
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

  function finish(rec, sent) {
    var first = rec.name.split(/\s+/)[0] || "";
    var when = { "Morning": "in the morning", "Afternoon": "in the afternoon", "Evening": "in the evening" }[rec.callTime] || "soon";
    doneBox.classList.toggle("is-preview", !sent);
    if (sent) {
      $("done-title").textContent = "Thank you" + (first ? ", " + first : "") + ". We have your request.";
      $("done-body").textContent = rec.member && !rec.details
        ? "We'll call you " + when + " to go over membership options and your price. No payment has been taken."
        : "We'll call you " + when + " to talk it over and find the right pro. Nothing is booked or charged until you say yes.";
    } else {
      $("done-title").textContent = "Here's how your request would look.";
      $("done-body").textContent = "Online requests open soon, so this one was not sent. Nothing was booked or charged.";
    }
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
        c.appendChild(make("strong", null, "No. " + (it.ticketNo || "?") + ", " + String(it.name || "No name") + (it.member ? ", wants membership" : "")));
        var when = "";
        try { when = new Date(it.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); } catch (e) {}
        c.appendChild(make("span", null, [when, it.phone, it.callTime ? "call " + String(it.callTime).toLowerCase() : "", it.email].filter(Boolean).join(", ")));
        c.appendChild(make("span", null, [WHO_LABEL[it.who] || "", it.ownerName ? "Parent: " + it.ownerName + (it.ownerPhone ? " " + it.ownerPhone : "") : "", [it.street, it.town].filter(Boolean).join(", ")].filter(Boolean).join(". ")));
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

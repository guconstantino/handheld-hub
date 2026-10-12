// Handheld Hub — Navegação Espacial 2D por Controle (GameSir X5 Lite / W3C Gamepad API / Bridge Nativa Android)
(() => {
  const SELECTORS = [
    ".device",
    ".live-item[data-launch]",
    ".live-col:not(:has(.live-item[data-launch]))",
    ".b-hero",
    ".ptile",
    ".gcard",
    ".morerow a",
    ".ra-recent a",
    ".mosaic a",
    ".combo",
    ".install .btn",
    ".relcard:not(:disabled)",
    ".htile",
    "#devGames",
    "#devSystems",
    ".detail-grid .panel",
    ".back",
    ".chip:not([hidden])",
    ".seg button",
    ".filters input",
    ".filters select",
    "#epicSearchInput",
    "#epicSortSelect",
    ".btn:not([hidden]):not(.fmore-btn):not(#customize):not(#toTop):not(tbody .btn):not(.live-item .btn)",
    ".drive-btn",
    ".listbtn",
    ".stepbtn",
    ".linkbtn",
    ".copy",
    "#portsTable tbody tr",
    "#epicTable tbody tr",
    "#gamesTable tbody tr",
    ".copies-table tbody tr",
  ].join(", ");

  // Ordem estrita de prioridade para o foco inicial de cada tela
  const PRIMARY_PRIORITY = [
    ".device",
    "#devGames",
    ".listbtn[data-list='playing']",
    ".ptile",
    ".gcard",
    "#portsTable tbody tr",
    "#epicTable tbody tr",
    "#gamesTable tbody tr",
    ".htile",
  ];

  const WRAP_GRID_SELECTORS = ".device, .ptile, .gcard, .live-col, .relcard, .htile, .chip, .seg button, .listbtn";
  const DIALOG_SELECTORS = ".pal-item, .palette input, .palette button, .palette select, .theme-opt";
  const DEFAULT_TABS = ["overview", "platforms", "games", "ports", "epic", "lists", "compare", "health"];

  let curEl = null;
  let gpMode = false;
  let userMoved = false;
  let hudEl = null;
  let pendingFocusSelector = null;

  function blurNativeFocus() {
    const skip = document.getElementById("skip");
    if (skip) skip.setAttribute("tabindex", "-1");
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.tagName !== "INPUT" && ae.tagName !== "TEXTAREA" && ae.tagName !== "SELECT") {
      ae.blur();
    }
  }
  blurNativeFocus();

  function enableGpMode() {
    blurNativeFocus();
    if (!gpMode) {
      gpMode = true;
      document.documentElement.classList.add("gp-mode");
      ensureHud();
    }
  }

  function ensureHud() {
    if (hudEl) return;
    hudEl = document.createElement("div");
    hudEl.className = "gp-hud";
    hudEl.setAttribute("aria-hidden", "true");
    hudEl.innerHTML = `
      <span><kbd>L1/R1</kbd> Abas</span>
      <span><kbd>L2/R2</kbd> Filtro</span>
      <span><kbd>A</kbd> Abrir</span>
      <span><kbd>B</kbd> Voltar</span>
      <span><kbd>Y</kbd> Busca</span>
      <span><kbd>X</kbd> Topo</span>
    `;
    document.body.appendChild(hudEl);
  }

  function isVisible(el) {
    if (!el || el.hidden || el.disabled) return false;
    if (el.id === "hero" && !el.children.length) return false;
    if (el.closest(".hidden, [hidden]")) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }

  function getCandidates() {
    const openDlg = document.querySelector("dialog[open]");
    if (openDlg) {
      return [...openDlg.querySelectorAll(DIALOG_SELECTORS)].filter(isVisible);
    }
    const activeView = document.querySelector("main .view:not(.hidden)") || document.querySelector("main");
    if (!activeView) return [];
    const raw = [...activeView.querySelectorAll(SELECTORS)].filter(isVisible);
    const set = new Set(raw);
    const filtered = raw.filter((el) => {
      let p = el.parentElement;
      while (p && p !== activeView) {
        if (set.has(p)) return false;
        p = p.parentElement;
      }
      return true;
    });
    // Ordena pela posição visual real no documento (respeita CSS Grid/Flexbox order)
    return filtered.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 14) return ra.top - rb.top;
      return ra.left - rb.left;
    });
  }

  function setFocus(el, scroll = true) {
    enableGpMode();
    if (curEl && curEl !== el) {
      curEl.removeAttribute("data-gp-focus");
    }
    curEl = el;
    if (!el) return;
    el.setAttribute("data-gp-focus", "true");

    if (el.classList.contains("pal-item")) {
      el.closest(".pal-list")?.querySelectorAll(".pal-item[aria-selected='true']").forEach((x) => {
        if (x !== el) x.setAttribute("aria-selected", "false");
      });
      el.setAttribute("aria-selected", "true");
    }

    if (scroll) {
      const r = el.getBoundingClientRect();
      const absTop = window.scrollY + r.top;
      const isLandscape = window.innerHeight <= 520;
      const topPad = isLandscape ? 16 : 68;
      const botPad = isLandscape ? 48 : window.innerWidth <= 900 ? 74 : 36;
      const vh = window.innerHeight;

      if (absTop < 220 && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (r.top < topPad || r.bottom > vh - botPad) {
        const availH = vh - topPad - botPad;
        const targetY = absTop - topPad - Math.max(0, (availH - Math.min(r.height, availH * 0.85)) / 2);
        window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
      }
      const scroller = el.closest(".morerow, .chiprow, .chips-bar, .seg.tabs, .pal-list, .theme-list");
      if (scroller) {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    }
  }

  function findBestInitialCandidate(list) {
    for (const sel of PRIMARY_PRIORITY) {
      const match = list.find((el) => el.matches(sel));
      if (match) return match;
    }
    const topPad = 24;
    return (
      list.find((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > topPad && r.top < window.innerHeight - 36;
      }) || list[0]
    );
  }

  function ensureValidFocus(forceBest = false) {
    if (pendingFocusSelector) {
      const target = document.querySelector(pendingFocusSelector);
      if (target && isVisible(target)) {
        pendingFocusSelector = null;
        setFocus(target, false);
        return target;
      }
    }
    const list = getCandidates();
    if (!list.length) return null;
    if (!forceBest && curEl && document.body.contains(curEl) && list.includes(curEl) && isVisible(curEl)) {
      return curEl;
    }
    const pick = findBestInitialCandidate(list);
    setFocus(pick, false);
    return pick;
  }

  // Observa carregamento assíncrono (ex.: #devices, #ports, #epic) para garantir que o 1º card receba o foco
  const domObserver = new MutationObserver(() => {
    if (!gpMode) return;
    if (pendingFocusSelector) {
      ensureValidFocus(false);
      return;
    }
    if (!userMoved) {
      ensureValidFocus(true);
      return;
    }
    if (!curEl || !document.body.contains(curEl) || !isVisible(curEl)) {
      ensureValidFocus(false);
    }
  });
  const mainEl = document.querySelector("main");
  if (mainEl) {
    domObserver.observe(mainEl, { childList: true, subtree: true });
  }

  function move(dir) {
    enableGpMode();
    userMoved = true;
    pendingFocusSelector = null;
    const list = getCandidates();
    if (!list.length) return;
    if (!curEl || !document.body.contains(curEl) || !list.includes(curEl) || !isVisible(curEl)) {
      ensureValidFocus(true);
      return;
    }

    const openDlg = document.querySelector("dialog[open]");
    if (openDlg && (dir === "up" || dir === "down")) {
      const idx = list.indexOf(curEl);
      if (idx !== -1) {
        const nextIdx = dir === "down" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
        setFocus(list[nextIdx], true);
        return;
      }
    }

    const cur = curEl.getBoundingClientRect();
    const cx = cur.left + cur.width / 2;
    const cy = cur.top + cur.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (const el of list) {
      if (el === curEl) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = ex - cx;
      const dy = ey - cy;

      let score = Infinity;

      if (dir === "right") {
        if (dx <= 8) continue;
        const vOverlap = Math.max(0, Math.min(cur.bottom, r.bottom) - Math.max(cur.top, r.top));
        if (vOverlap <= 4 && Math.abs(dy) > Math.max(cur.height, r.height) * 0.55) continue;
        const hGap = Math.max(0, r.left - cur.right);
        score = hGap + Math.abs(dx) * 0.35 + (vOverlap > 10 ? Math.abs(dy) * 0.25 : Math.abs(dy) * 2.5);
      } else if (dir === "left") {
        if (dx >= -8) continue;
        const vOverlap = Math.max(0, Math.min(cur.bottom, r.bottom) - Math.max(cur.top, r.top));
        if (vOverlap <= 4 && Math.abs(dy) > Math.max(cur.height, r.height) * 0.55) continue;
        const hGap = Math.max(0, cur.left - r.right);
        score = hGap + Math.abs(dx) * 0.35 + (vOverlap > 10 ? Math.abs(dy) * 0.25 : Math.abs(dy) * 2.5);
      } else if (dir === "down") {
        if (dy <= 10 || r.top < cur.top + 8) continue;
        const vGap = Math.max(0, r.top - cur.bottom);
        const hOverlap = Math.max(0, Math.min(cur.right, r.right) - Math.max(cur.left, r.left));
        const hGap = Math.max(0, Math.max(cur.left - r.right, r.left - cur.right));
        const adx = Math.abs(dx);
        score = vGap * 2.4 + Math.abs(dy) * 0.45 + (hOverlap > 12 ? adx * 0.14 : hGap * 1.35 + adx * 0.38);
      } else if (dir === "up") {
        if (dy >= -10 || r.bottom > cur.bottom - 8) continue;
        const vGap = Math.max(0, cur.top - r.bottom);
        const hOverlap = Math.max(0, Math.min(cur.right, r.right) - Math.max(cur.left, r.left));
        const hGap = Math.max(0, Math.max(cur.left - r.right, r.left - cur.right));
        const adx = Math.abs(dx);
        score = vGap * 2.4 + Math.abs(dy) * 0.45 + (hOverlap > 12 ? adx * 0.14 : hGap * 1.35 + adx * 0.38);
      }

      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    // Wrap de leitura em grades (ex.: Direita no 2º console da linha 1 vai para o 1º console da linha 2)
    if (!best && (dir === "right" || dir === "left") && curEl.matches(WRAP_GRID_SELECTORS)) {
      const idx = list.indexOf(curEl);
      const step = dir === "right" ? 1 : -1;
      const neighbor = list[idx + step];
      if (neighbor && neighbor.matches(WRAP_GRID_SELECTORS)) {
        const nr = neighbor.getBoundingClientRect();
        if (Math.abs(nr.top - cur.top) < 420) {
          best = neighbor;
        }
      }
    }

    if (best) {
      setFocus(best, true);
    } else if (dir === "up") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (dir === "down") {
      window.scrollBy({ top: 220, behavior: "smooth" });
    }
  }

  function activate() {
    enableGpMode();
    const el = ensureValidFocus(false);
    if (!el) return;

    el.classList.add("gp-press");
    setTimeout(() => el.classList.remove("gp-press"), 150);

    // Preserva o foco em botões de filtro que re-renderizam seu container (#portsTabs, #epicTabs, #listTabs)
    if (el.dataset.pcat) {
      pendingFocusSelector = `#portsTabs button[data-pcat="${el.dataset.pcat}"]`;
    } else if (el.dataset.ecat) {
      pendingFocusSelector = `#epicTabs button[data-ecat="${el.dataset.ecat}"]`;
    } else if (el.dataset.tab) {
      pendingFocusSelector = `#listTabs button[data-tab="${el.dataset.tab}"]`;
    }

    if (el.matches(".device")) {
      const link = el.querySelector("a.device-link, a");
      if (link) link.click();
      return;
    }
    if (el.matches(".b-hero")) {
      const link = el.querySelector("a.hero-link, a");
      if (link) link.click();
      return;
    }
    if (el.matches(".gcard")) {
      const link = el.querySelector("a.glink, a.gfull, a");
      if (link) link.click();
      return;
    }
    if (el.matches(".live-item[data-launch]")) {
      const link = el.querySelector("a.play-btn");
      if (link) link.click();
      return;
    }
    if (el.matches("tr")) {
      const target = el.querySelector("a.play-btn, a.tlink, a, button");
      if (target) target.click();
      return;
    }
    if (el.id === "devSystems") {
      const firstBar = el.querySelector("a[href]");
      if (firstBar) firstBar.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return;
    }
    if (el.tagName === "SELECT") {
      const next = (el.selectedIndex + 1) % el.options.length;
      el.selectedIndex = next;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (el.tagName === "INPUT") {
      if (el.type === "checkbox") {
        el.click();
      } else {
        el.focus();
      }
      return;
    }
    el.click();
  }

  function back() {
    enableGpMode();
    pendingFocusSelector = null;
    const openDlg = document.querySelector("dialog[open]");
    if (openDlg) {
      openDlg.close();
      setTimeout(() => ensureValidFocus(false), 60);
      return true;
    }
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT")) {
      document.activeElement.blur();
      return true;
    }
    const h = location.hash || "#overview";
    if (h.startsWith("#device-") || h.startsWith("#platform-") || h.startsWith("#game-")) {
      userMoved = false;
      const backLink = document.querySelector("main .view:not(.hidden) .back");
      if (backLink) {
        backLink.click();
      } else {
        history.back();
      }
      return true;
    }
    if (h !== "#overview") {
      userMoved = false;
      location.hash = "#overview";
      return true;
    }
    return false;
  }

  function getVisibleTabs() {
    const links = [...document.querySelectorAll(".nav a[data-view]")].filter(isVisible);
    const views = links.map((a) => a.dataset.view).filter(Boolean);
    return views.length ? views : DEFAULT_TABS;
  }

  function cycleTab(delta) {
    enableGpMode();
    userMoved = false;
    pendingFocusSelector = null;
    const openDlg = document.querySelector("dialog[open]");
    if (openDlg) openDlg.close();

    const tabs = getVisibleTabs();
    const activeLink = document.querySelector(".nav a.active");
    const curView = activeLink?.dataset.view || "overview";
    const idx = Math.max(0, tabs.indexOf(curView));
    const nextIdx = (idx + delta + tabs.length) % tabs.length;
    const nextView = tabs[nextIdx];
    const targetLink = document.querySelector(`.nav a[data-view="${nextView}"]`);
    if (targetLink) {
      targetLink.click();
      window.scrollTo({ top: 0, behavior: "instant" });
      setTimeout(() => {
        curEl = null;
        ensureValidFocus(true);
      }, 140);
    }
  }

  // L2 / R2: alterna filtros internos da aba atual (ou jogo Anterior / Próximo na página do jogo)
  function cycleSubFilter(delta) {
    enableGpMode();
    const activeView = document.querySelector("main .view:not(.hidden)");
    if (!activeView) return false;

    if (activeView.id === "view-game") {
      const stepBtn = activeView.querySelector(`.stepbtn[data-step="${delta < 0 ? "prev" : "next"}"]`);
      if (stepBtn) {
        userMoved = false;
        stepBtn.click();
        return true;
      }
      return false;
    }

    const groups = [
      "#portsTabs button",
      "#epicTabs button",
      "#listTabs button",
      "#gChips .chip:not([hidden])",
      "#cmpTabA, #cmpTabB",
      "#platformSort .seg button",
    ];
    for (const sel of groups) {
      const items = [...activeView.querySelectorAll(sel)].filter(isVisible);
      if (items.length > 1) {
        const curIdx = Math.max(0, items.findIndex((b) => b.getAttribute("aria-pressed") === "true" || b.classList.contains("active")));
        const nextIdx = (curIdx + delta + items.length) % items.length;
        const nextBtn = items[nextIdx];
        if (nextBtn) {
          userMoved = false;
          nextBtn.click();
          setTimeout(() => {
            curEl = null;
            ensureValidFocus(true);
          }, 90);
          return true;
        }
      }
    }
    return false;
  }

  function toggleSearch() {
    enableGpMode();
    const dlg = document.getElementById("palette");
    if (dlg && dlg.open) {
      dlg.close();
      setTimeout(() => ensureValidFocus(false), 60);
    } else {
      document.getElementById("searchBtn")?.click();
      setTimeout(() => {
        const firstItem = document.querySelector("#palette .pal-item");
        if (firstItem) setFocus(firstItem, false);
      }, 100);
    }
  }

  function handleX() {
    enableGpMode();
    const activeView = document.querySelector("main .view:not(.hidden)");
    if (activeView && activeView.id === "view-game") {
      const favBtn = activeView.querySelector('.listbtn[data-list="fav"]');
      if (favBtn) {
        favBtn.click();
        setFocus(favBtn, false);
        return true;
      }
    }
    userMoved = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    curEl = null;
    ensureValidFocus(true);
    return true;
  }

  function toggleSettings() {
    enableGpMode();
    userMoved = false;
    if (location.hash === "#settings") {
      history.back();
    } else {
      location.hash = "#settings";
    }
    return true;
  }

  function handleCommand(cmd) {
    switch (cmd) {
      case "up":
      case "down":
      case "left":
      case "right":
        move(cmd);
        return true;
      case "a":
        activate();
        return true;
      case "b":
        return back();
      case "l1":
        cycleTab(-1);
        return true;
      case "r1":
        cycleTab(1);
        return true;
      case "l2":
        return cycleSubFilter(-1);
      case "r2":
        return cycleSubFilter(1);
      case "y":
        toggleSearch();
        return true;
      case "x":
        return handleX();
      case "start":
        return toggleSettings();
      default:
        return false;
    }
  }

  window.addEventListener("hashchange", () => {
    if (!gpMode) return;
    userMoved = false;
    pendingFocusSelector = null;
    setTimeout(() => {
      curEl = null;
      ensureValidFocus(true);
    }, 150);
  });

  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.pointerType === "mouse") {
      if (curEl) curEl.removeAttribute("data-gp-focus");
    }
  }, { passive: true });

  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement?.tagName;
    const inText = tag === "INPUT" || tag === "TEXTAREA";
    if (e.key === "ArrowUp" && !inText) { e.preventDefault(); handleCommand("up"); }
    else if (e.key === "ArrowDown" && !inText) { e.preventDefault(); handleCommand("down"); }
    else if (e.key === "ArrowLeft" && !inText) { e.preventDefault(); handleCommand("left"); }
    else if (e.key === "ArrowRight" && !inText) { e.preventDefault(); handleCommand("right"); }
    else if ((e.key === "Enter" || e.key === " ") && gpMode && !inText) { e.preventDefault(); handleCommand("a"); }
    else if (e.key === "PageUp" && !inText) { e.preventDefault(); handleCommand("l1"); }
    else if (e.key === "PageDown" && !inText) { e.preventDefault(); handleCommand("r1"); }
    else if (e.key === "[" && !inText) { e.preventDefault(); handleCommand("l2"); }
    else if (e.key === "]" && !inText) { e.preventDefault(); handleCommand("r2"); }
  });

  let rafId = null;
  const holdState = {};
  const INITIAL_REPEAT_MS = 250;
  const REPEAT_MS = 110;

  function checkHold(key, pressed, now, fn) {
    if (!pressed) {
      delete holdState[key];
      return;
    }
    const st = holdState[key];
    if (!st) {
      holdState[key] = { nextAt: now + INITIAL_REPEAT_MS };
      fn();
    } else if (now >= st.nextAt) {
      st.nextAt = now + REPEAT_MS;
      fn();
    }
  }

  function pollGamepad() {
    if (document.visibilityState === "hidden") {
      rafId = null;
      return;
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && (pads[0] || pads[1] || pads[2] || pads[3]);
    if (gp) {
      const now = performance.now();
      const b = (i) => Boolean(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.6));
      const ax = (i) => (gp.axes && gp.axes[i]) || 0;

      const up = b(12) || ax(1) < -0.55;
      const down = b(13) || ax(1) > 0.55;
      const left = b(14) || ax(0) < -0.55;
      const right = b(15) || ax(0) > 0.55;

      checkHold("up", up, now, () => handleCommand("up"));
      checkHold("down", down, now, () => handleCommand("down"));
      checkHold("left", left, now, () => handleCommand("left"));
      checkHold("right", right, now, () => handleCommand("right"));

      checkHold("a", b(0), now, () => handleCommand("a"));
      checkHold("b", b(1), now, () => handleCommand("b"));
      checkHold("x", b(2), now, () => handleCommand("x"));
      checkHold("y", b(3) || b(8), now, () => handleCommand("y"));
      checkHold("l1", b(4), now, () => handleCommand("l1"));
      checkHold("r1", b(5), now, () => handleCommand("r1"));
      checkHold("l2", b(6), now, () => handleCommand("l2"));
      checkHold("r2", b(7), now, () => handleCommand("r2"));
      checkHold("start", b(9), now, () => handleCommand("start"));

      const ry = ax(3);
      if (Math.abs(ry) > 0.22) {
        enableGpMode();
        window.scrollBy({ top: ry * 14, behavior: "instant" });
      }
    }
    rafId = requestAnimationFrame(pollGamepad);
  }

  window.addEventListener("gamepadconnected", () => {
    enableGpMode();
    ensureValidFocus(true);
    if (!rafId) rafId = requestAnimationFrame(pollGamepad);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      if (pads && (pads[0] || pads[1] || pads[2] || pads[3]) && !rafId) {
        rafId = requestAnimationFrame(pollGamepad);
      }
    }
  });

  window.HH_GAMEPAD = {
    initHandheld() {
      userMoved = false;
      enableGpMode();
      ensureValidFocus(true);
    },
    nativeKey(cmd) {
      return handleCommand(cmd);
    },
    scrollBy(dy) {
      enableGpMode();
      window.scrollBy({ top: dy, behavior: "instant" });
    },
  };
})();

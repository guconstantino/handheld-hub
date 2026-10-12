// Handheld Hub: micro-interações (Motion). Tudo é enfeite: sem JS, sem Motion ou com
// "reduzir movimento" ligado, a página aparece completa e parada.
(() => {
  const M = window.Motion;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  if (!M || reduce.matches) return;
  const { animate } = M;
  document.documentElement.classList.add("fx");          // libera o estado inicial "escondido" do CSS

  const EASE = [0.2, 0.7, 0.2, 1];
  const REVEAL = ".tile, .device, .ptile, .gcard, .htile, .phero, .page-head, .panel, .mosaic li";
  const NUMBER = ".hero-num, .kpi-value, .nums dd, .htile b, .ring b";

  // Número "15.752", "69%", "106 GB" → anima só a parte numérica, mantendo o formato pt-BR.
  function countUp(el) {
    const m = el.textContent.match(/^(\D*)([\d.]+(?:,\d+)?)(.*)$/);
    if (!m || el.dataset.counted) return;
    el.dataset.counted = "1";
    const [, pre, num, suf] = m;
    const dec = (num.split(",")[1] || "").length;
    const target = Number(num.replace(/\./g, "").replace(",", "."));
    if (!target) return;
    animate(0, target, {
      duration: 1.1, ease: EASE,
      onUpdate: (v) => { el.textContent = pre + v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; },
    });
  }

  function play(el, i) {
    el.classList.add("in");
    animate(el, { opacity: [0, 1], transform: ["translateY(14px)", "translateY(0)"] }, { duration: 0.55, delay: Math.min(i, 12) * 0.045, ease: EASE })
      .then(() => { el.style.transform = ""; });
    el.querySelectorAll(NUMBER).forEach(countUp);
    if (el.matches(NUMBER)) countUp(el);
    // Barras e anel enchem a partir do zero.
    el.querySelectorAll(".bar i, .barlist .track i").forEach((b, j) =>
      animate(b, { transform: ["scaleX(0)", "scaleX(1)"] }, { duration: 0.8, delay: 0.15 + j * 0.03, ease: EASE }));
    el.querySelectorAll(".ring-fg").forEach((c) => {
      const [len, total] = c.getAttribute("stroke-dasharray").split(" ").map(Number);
      animate(0, len, { duration: 1.2, delay: 0.2, ease: EASE, onUpdate: (v) => c.setAttribute("stroke-dasharray", `${v} ${total}`) });
    });
  }

  // Revela em lotes: o que entra na tela junto aparece em sequência (stagger).
  const io = new IntersectionObserver((entries) => {
    const show = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    show.forEach((el, i) => { io.unobserve(el); play(el, i); });
  }, { rootMargin: "120px 0px 120px 0px" });
  const watch = (root) => {
    if (root.nodeType !== 1) return;
    if (root.matches(REVEAL) && !root.classList.contains("in")) io.observe(root);
    root.querySelectorAll(REVEAL).forEach((el) => { if (!el.classList.contains("in")) io.observe(el); });
  };
  watch(document.querySelector("main"));
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(watch)))
    .observe(document.querySelector("main"), { childList: true, subtree: true });

  // Cartões inclinam levemente seguindo o mouse (só com mouse de verdade).
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const TILT = ".ptile, .gcard, .device";
    let cur = null;
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest(TILT);
      if (cur && cur !== el) { animate(cur, { transform: "perspective(900px) rotateX(0deg) rotateY(0deg)" }, { type: "spring", stiffness: 260, damping: 20 }); cur = null; }
      if (!el) return;
      cur = el;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      const max = el.matches(".device") ? 2 : 5;
      animate(el, { transform: `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)` },
        { type: "spring", stiffness: 300, damping: 24 });
    });
  }

  // Transição entre telas: a arte do cartão de plataforma "cresce" e vira o topo da página.
  document.addEventListener("click", (e) => {
    const tile = e.target.closest(".ptile");
    if (tile) tile.querySelector("img").style.viewTransitionName = "platform-art";
    // A capa clicada (grade, lista, "Mais de", busca) "voa" até a capa grande da página do jogo.
    const link = e.target.closest('a[href^="#game-"]');
    // Nos cartões da grade o link que cobre o cartão (.gfull) não contém a imagem: ela é irmã.
    const img = link && (link.querySelector("img:not(.gplat)") || link.closest(".gcard")?.querySelector("img:not(.gplat)"));
    if (img) {
      document.querySelectorAll(".ghero-cover img").forEach((i) => (i.style.viewTransitionName = "none"));   // nome único na tela antiga
      img.style.viewTransitionName = "game-cover";
    }
  }, true);
  window.HH_TRANSITION = (fn) => (document.startViewTransition ? document.startViewTransition(fn).finished : Promise.resolve(fn()));
})();

// Handheld Hub: gráficos com Observable Plot. Estilo minimalista (skill dataviz): traço fino,
// rótulo direto no lugar de legenda quando dá, grade discreta, um eixo só, sem pizza.
// Cores vêm dos tokens do CSS (lidas na hora, para seguir o tema claro/escuro).
(() => {
  const P = window.Plot;
  if (!P) return;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const nf = (n) => Number(n || 0).toLocaleString("pt-BR");
  const base = (el, extra) => ({
    width: Math.max(el.clientWidth, 260),
    style: { background: "transparent", color: css("--muted"), fontFamily: "Geist, system-ui, sans-serif", fontSize: "12px", overflow: "visible" },
    ...extra,
  });
  const charts = new Map();                         // elemento → função que redesenha (resize/tema)
  const mount = (el, draw) => {
    charts.set(el, draw);
    const svg = draw();
    el.replaceChildren(svg);
  };
  const redraw = () => charts.forEach((draw, el) => { if (el.isConnected && el.clientWidth) el.replaceChildren(draw()); });
  new ResizeObserver(() => redraw()).observe(document.querySelector("main"));
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);

  // Barras horizontais com o valor escrito na ponta (ranking: jogos por plataforma).
  function bars(el, rows, { label, value, href, fmt = nf, color = "--series", aria }) {
    mount(el, () => {
      const max = Math.max(...rows.map(value), 1);
      return P.plot(base(el, {
        ariaLabel: aria, height: rows.length * 26 + 8, marginLeft: el.clientWidth < 480 ? 118 : 150, marginRight: 56, marginTop: 4, marginBottom: 4,
        x: { axis: null, domain: [0, max] }, y: { label: null, domain: rows.map(label), tickSize: 0 },
        marks: [
          P.barX(rows, { y: label, x: value, fill: css(color), rx: 4, insetTop: 6, insetBottom: 6,
            href: href ? (d) => href(d) : undefined, title: (d) => `${label(d)}: ${fmt(value(d))}` }),
          P.text(rows, { y: label, x: value, text: (d) => fmt(value(d)), dx: 8, textAnchor: "start", fill: css("--muted"), fontVariant: "tabular-nums" }),
          P.axisY({ tickSize: 0, fill: css("--text"), fontSize: 13 }),
        ],
      }));
    });
  }

  // Porcentagem por linha: trilho cinza + barra preenchida + "91% · 3.048/3.339".
  function percent(el, rows, { label, done, total, href, aria }) {
    mount(el, () => { const narrow = el.clientWidth < 480; return P.plot(base(el, {
      ariaLabel: aria, height: rows.length * 26 + 8, marginLeft: narrow ? 118 : 150, marginRight: narrow ? 52 : 170, marginTop: 4, marginBottom: 4,
      x: { axis: null, domain: [0, 1] }, y: { label: null, domain: rows.map(label), tickSize: 0 },
      marks: [
        P.barX(rows, { y: label, x: 1, fill: css("--line"), rx: 4, insetTop: 7, insetBottom: 7 }),
        P.barX(rows, { y: label, x: (d) => done(d) / (total(d) || 1), fill: css("--series"), rx: 4, insetTop: 7, insetBottom: 7,
          href: href ? (d) => href(d) : undefined, title: (d) => `${label(d)}: ${nf(done(d))} de ${nf(total(d))}` }),
        // % em destaque (alinhada) e a contagem em cinza ao lado: lê-se a % de relance.
        P.text(rows, { y: label, x: 1, dx: 46, textAnchor: "end", fill: css("--text"), fontWeight: 600, fontVariant: "tabular-nums",
          text: (d) => `${Math.round((done(d) / (total(d) || 1)) * 100)}%` }),
        narrow ? null : P.text(rows, { y: label, x: 1, dx: 56, textAnchor: "start", fill: css("--muted"), fontVariant: "tabular-nums",
          text: (d) => `${nf(done(d))} de ${nf(total(d))}` }),
        P.axisY({ tickSize: 0, fill: css("--text"), fontSize: 13 }),
      ],
    })); });
  }

  // Uma barra empilhada por console, na ordem fixa (a cor segue o console). A legenda com números fica no HTML.
  function stack(el, rows, { aria }) {
    mount(el, () => P.plot(base(el, {
      ariaLabel: aria, height: 26, margin: 0, x: { axis: null }, y: { axis: null },
      marks: [P.barX(rows, P.stackX({ x: "n", fill: (d) => css(`--acc-${d.id}`), inset: 1, rx: 3, title: (d) => `${d.name}: ${nf(d.n)}` }))],
    })));
  }

  // Evolução no tempo: linhas finas com área suave e rótulo direto no último ponto.
  function timeline(el, hist, { series, aria }) {
    mount(el, () => {
      const pts = series.flatMap((s) => hist.map((h) => ({ s: s.name, date: new Date(h.date + "T12:00"), v: s.value(h), color: css(s.color) })));
      const last = series.map((s) => pts.filter((p) => p.s === s.name).at(-1));
      const one = hist.length < 2;
      return P.plot(base(el, {
        ariaLabel: aria, height: 220, marginLeft: 8, marginRight: 110, marginTop: 16, marginBottom: 28,
        x: { type: "time", label: null, ticks: one ? 1 : 5, tickFormat: (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) },
        y: { axis: null, domain: [0, Math.max(...pts.map((p) => p.v), 1) * 1.1] },
        marks: [
          P.ruleY([0], { stroke: css("--line") }),
          ...series.map((s) => P.areaY(pts.filter((p) => p.s === s.name), { x: "date", y: "v", fill: css(s.color), fillOpacity: 0.08, curve: "monotone-x" })),
          ...series.map((s) => P.lineY(pts.filter((p) => p.s === s.name), { x: "date", y: "v", stroke: css(s.color), strokeWidth: 2, curve: "monotone-x" })),
          P.dot(last, { x: "date", y: "v", fill: (d) => d.color, r: 4, stroke: css("--surface"), strokeWidth: 2 }),
          P.text(last, { x: "date", y: "v", text: (d) => `${d.s} ${nf(d.v)}`, dx: 10, textAnchor: "start", fill: css("--text"), fontWeight: 600 }),
          P.tip(pts, P.pointerX({ x: "date", y: "v", title: (d) => `${d.s}: ${nf(d.v)}\n${d.date.toLocaleDateString("pt-BR")}` })),
        ],
      }));
    });
  }

  window.HH_CHARTS = { bars, percent, stack, timeline, redraw };
})();

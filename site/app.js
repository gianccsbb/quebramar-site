/* Quebra-Mar Café & Padaria (concept project)
 * Menu rendering, order builder, WhatsApp hand-off, PT/EN toggle and open/closed status.
 * Prices are stored in cents to avoid floating-point rounding errors.
 */
(() => {
  "use strict";

  // Set the business number in international format (e.g. "5581XXXXXXXXX").
  // Left empty in this demo, so WhatsApp opens its contact picker instead of a real number.
  const WHATSAPP_NUMBER = "";
  const TIMEZONE = "America/Recife";
  // Opening hours per weekday (0 = Sunday), in 24h decimal hours.
  const HOURS = { 0: [7, 12], 1: [7, 19], 2: [7, 19], 3: [7, 19], 4: [7, 19], 5: [7, 19], 6: [7, 19] };

  const MENU = {
    cafes: [
      { id: "coado", price: 600, pt: ["Café coado", "Passado na hora, grão do Agreste."], en: ["Pour-over coffee", "Brewed to order, beans from Pernambuco's Agreste."] },
      { id: "espresso", price: 700, pt: ["Espresso", "Curto e encorpado."], en: ["Espresso", "Short and full-bodied."] },
      { id: "cappuccino", price: 1200, pt: ["Cappuccino", "Com canela e cacau."], en: ["Cappuccino", "With cinnamon and cocoa."] },
      { id: "gelado", price: 1400, tag: true, pt: ["Café gelado com rapadura", "O favorito do verão."], en: ["Iced coffee with rapadura", "Our summer favorite, sweetened with cane sugar."] },
    ],
    padaria: [
      { id: "chapa", price: 700, pt: ["Pão na chapa", "Pão francês com manteiga, tostado na chapa."], en: ["Griddled bread", "French roll with butter, toasted on the griddle."] },
      { id: "tapioca", price: 1400, pt: ["Tapioca de queijo coalho", "Feita na hora."], en: ["Coalho cheese tapioca", "Made to order."] },
      { id: "cuscuz", price: 1300, pt: ["Cuscuz com ovo", "Cuscuz nordestino com ovo e manteiga."], en: ["Cuscuz with egg", "Northeastern corn couscous with egg and butter."] },
      { id: "croissant", price: 1100, pt: ["Croissant", "Massa folhada, assado aqui."], en: ["Croissant", "Flaky pastry, baked in-house."] },
    ],
    doces: [
      { id: "rolo", price: 1000, tag: true, pt: ["Bolo de rolo (fatia)", "Goiabada em camadas finíssimas."], en: ["Bolo de rolo (slice)", "Guava paste rolled in paper-thin layers."] },
      { id: "souza", price: 1200, pt: ["Bolo Souza Leão", "Receita pernambucana de mandioca."], en: ["Souza Leão cake", "Traditional Pernambuco cassava cake."] },
      { id: "cartola", price: 1600, pt: ["Cartola", "Banana, queijo coalho, açúcar e canela."], en: ["Cartola", "Banana, coalho cheese, sugar and cinnamon."] },
      { id: "brigadeiro", price: 400, pt: ["Brigadeiro", "Unidade."], en: ["Brigadeiro", "Each."] },
    ],
  };

  const I18N = {
    en: {
      "skip": "Skip to menu",
      "nav.menu": "Menu", "nav.about": "About", "nav.visit": "Visit",
      "hero.kicker": "Boa Viagem · Recife",
      "hero.title": "Fresh-brewed coffee, warm bread and a sea breeze.",
      "hero.lead": "One block from the beach, serving Northeastern Brazilian breakfast, regional sweets and coffee brewed to order.",
      "hero.cta1": "See the menu", "hero.cta2": "Build an order",
      "menu.title": "Menu",
      "menu.intro": "Tap “+” to add items to your order. You send everything through WhatsApp at the end.",
      "cat.cafes": "Coffee", "cat.padaria": "Bakery", "cat.doces": "Regional sweets",
      "order.title": "Your order",
      "order.intro": "Review your items and send them. We confirm on WhatsApp and have everything ready for pickup.",
      "order.empty": "No items yet. Add something from the menu.",
      "order.total": "Total", "order.name": "Your name",
      "order.send": "Send via WhatsApp", "order.clear": "Clear order",
      "about.title": "A café that smells like the tide",
      "about.p1": "Quebra-Mar started from an idea: bring together two things Recife does well, a generous breakfast and late afternoons by the sea.",
      "about.p2": "Bread comes out of the oven three times a day, coffee is brewed to order and the sweets follow family recipes: bolo de rolo, Souza Leão and cartola.",
      "about.f1": "batches of bread a day", "about.f2": "we open early, every day", "about.f3": "block from the beach",
      "visit.title": "Come visit", "visit.note": "(Fictional address. Concept project.)",
      "days.weekdays": "Monday to Saturday", "days.sunday": "Sunday",
      "footer.disclaimer": "Quebra-Mar Café & Padaria is a fictional brand, created as a portfolio project (visual identity and website).",
      "status.open": "Open now · until {h}h", "status.closed": "Closed now · opens {d} at {h}h",
      "day.today": "today", "day.tomorrow": "tomorrow",
      "toast.added": "{item} added to your order",
      "msg.greeting": "Hi! I'd like to order:", "msg.name": "Name", "msg.total": "Total",
      "lang.label": "Mudar para português", "lang.code": "PT",
    },
    pt: {
      "status.open": "Aberto agora · até {h}h", "status.closed": "Fechado agora · abre {d} às {h}h",
      "day.today": "hoje", "day.tomorrow": "amanhã",
      "toast.added": "{item} adicionado ao pedido",
      "msg.greeting": "Olá! Gostaria de fazer um pedido:", "msg.name": "Nome", "msg.total": "Total",
      "lang.label": "Switch to English", "lang.code": "EN",
    },
  };

  const $ = (sel) => document.querySelector(sel);
  const state = { lang: "pt", cat: "cafes", order: new Map() };
  const ptDefaults = {}; // original Portuguese text, captured from the HTML

  const allItems = Object.values(MENU).flat();
  const byId = Object.fromEntries(allItems.map((i) => [i.id, i]));

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = (cents) => brl.format(cents / 100);
  const t = (key, vars = {}) => {
    const dict = I18N[state.lang] || {};
    let s = dict[key] ?? I18N.pt[key] ?? ptDefaults[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
  const itemText = (item) => (state.lang === "en" ? item.en : item.pt);

  // ---------- Storage (optional; the page works without it) ----------
  const STORE_KEY = "quebramar-order-v1";
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ lang: state.lang, order: [...state.order] })); } catch (_) { /* ignore */ }
  }
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!data) return;
      if (data.lang === "en" || data.lang === "pt") state.lang = data.lang;
      for (const [id, qty] of data.order || []) if (byId[id] && qty > 0) state.order.set(id, Math.min(qty, 99));
    } catch (_) { /* ignore */ }
  }

  // ---------- Menu ----------
  function renderMenu() {
    const panels = $("#menuPanels");
    panels.innerHTML = "";
    for (const [cat, items] of Object.entries(MENU)) {
      const ul = document.createElement("ul");
      ul.className = "menu";
      ul.id = `cat-${cat}`;
      ul.setAttribute("role", "tabpanel");
      ul.setAttribute("aria-labelledby", `tab-${cat}`);
      ul.hidden = cat !== state.cat;
      for (const item of items) {
        const [name, desc] = itemText(item);
        const li = document.createElement("li");
        li.className = "menu__item";
        li.dataset.id = item.id;
        li.innerHTML = `
          <span class="menu__name"></span>
          <span class="menu__desc"></span>
          <span class="menu__price">${money(item.price)}</span>
          <button class="menu__add" type="button">+</button>`;
        li.querySelector(".menu__name").textContent = name;
        if (item.tag) {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = state.lang === "en" ? "Favorite" : "Favorito";
          li.querySelector(".menu__name").append(tag);
        }
        li.querySelector(".menu__desc").textContent = desc;
        li.querySelector(".menu__add").setAttribute("aria-label", `${state.lang === "en" ? "Add" : "Adicionar"} ${name}`);
        ul.append(li);
      }
      panels.append(ul);
    }
  }

  function selectTab(cat, focus = false) {
    state.cat = cat;
    document.querySelectorAll('[role="tab"]').forEach((tab) => {
      const on = tab.dataset.cat === cat;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    document.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== `cat-${cat}`; });
  }

  // ---------- Order ----------
  function setQty(id, qty) {
    if (qty <= 0) state.order.delete(id);
    else state.order.set(id, Math.min(qty, 99));
    renderOrder();
    save();
  }

  function orderTotal() {
    let total = 0;
    for (const [id, qty] of state.order) total += byId[id].price * qty;
    return total;
  }

  function renderOrder() {
    const list = $("#orderList");
    list.innerHTML = "";
    for (const [id, qty] of state.order) {
      const item = byId[id];
      const [name] = itemText(item);
      const li = document.createElement("li");
      li.className = "order__row";
      li.dataset.id = id;
      li.innerHTML = `
        <span class="order__rowname"></span>
        <span class="qty">
          <button type="button" data-act="dec">−</button>
          <span class="qty__n">${qty}</span>
          <button type="button" data-act="inc">+</button>
        </span>
        <span class="order__rowprice">${money(item.price * qty)}</span>`;
      li.querySelector(".order__rowname").textContent = name;
      li.querySelector('[data-act="dec"]').setAttribute("aria-label", `${state.lang === "en" ? "Remove one" : "Remover um"} ${name}`);
      li.querySelector('[data-act="inc"]').setAttribute("aria-label", `${state.lang === "en" ? "Add one" : "Adicionar um"} ${name}`);
      list.append(li);
    }
    const empty = state.order.size === 0;
    $("#orderEmpty").hidden = !empty;
    $("#orderTotal").textContent = money(orderTotal());
    const send = $("#sendOrder");
    send.setAttribute("aria-disabled", String(empty));
    send.href = empty ? "#" : whatsappUrl();
  }

  function whatsappUrl() {
    const lines = [t("msg.greeting")];
    for (const [id, qty] of state.order) {
      const item = byId[id];
      lines.push(`• ${qty}× ${itemText(item)[0]}: ${money(item.price * qty)}`);
    }
    lines.push(`${t("msg.total")}: ${money(orderTotal())}`);
    const name = $("#orderName").value.trim();
    if (name) lines.push(`${t("msg.name")}: ${name}`);
    const text = encodeURIComponent(lines.join("\n"));
    return WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${text}` : `https://wa.me/?text=${text}`;
  }

  // ---------- Open / closed status ----------
  function recifeNow() {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    const hour = (Number(get("hour")) % 24) + Number(get("minute")) / 60;
    return { day, hour };
  }

  function renderStatus() {
    const el = $("#openStatus");
    const { day, hour } = recifeNow();
    const [open, close] = HOURS[day];
    if (hour >= open && hour < close) {
      el.textContent = t("status.open", { h: close });
      el.className = "status is-open";
    } else {
      const opensToday = hour < open;
      const next = opensToday ? day : (day + 1) % 7;
      el.textContent = t("status.closed", { d: t(opensToday ? "day.today" : "day.tomorrow"), h: HOURS[next][0] });
      el.className = "status is-closed";
    }
  }

  // ---------- Language ----------
  function applyLang() {
    document.documentElement.lang = state.lang === "en" ? "en" : "pt-BR";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (!(key in ptDefaults)) ptDefaults[key] = el.textContent;
      el.textContent = state.lang === "en" ? (I18N.en[key] ?? ptDefaults[key]) : ptDefaults[key];
    });
    const btn = $("#langToggle");
    btn.textContent = t("lang.code");
    btn.setAttribute("aria-label", t("lang.label"));
    renderMenu();
    selectTab(state.cat);
    renderOrder();
    renderStatus();
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  // ---------- Events ----------
  function bind() {
    $("#menuPanels").addEventListener("click", (e) => {
      const btn = e.target.closest(".menu__add");
      if (!btn) return;
      const id = btn.closest(".menu__item").dataset.id;
      setQty(id, (state.order.get(id) || 0) + 1);
      toast(t("toast.added", { item: itemText(byId[id])[0] }));
    });

    $("#orderList").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.closest(".order__row").dataset.id;
      const qty = state.order.get(id) || 0;
      setQty(id, btn.dataset.act === "inc" ? qty + 1 : qty - 1);
    });

    $("#clearOrder").addEventListener("click", () => { state.order.clear(); renderOrder(); save(); });
    $("#orderName").addEventListener("input", renderOrder);
    $("#sendOrder").addEventListener("click", (e) => { if (state.order.size === 0) e.preventDefault(); });

    const tabs = [...document.querySelectorAll('[role="tab"]')];
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => selectTab(tab.dataset.cat));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(next.dataset.cat, true);
      });
    });

    $("#langToggle").addEventListener("click", () => {
      state.lang = state.lang === "pt" ? "en" : "pt";
      applyLang();
      save();
    });
  }

  load();
  bind();
  applyLang();
  setInterval(renderStatus, 60 * 1000);
})();

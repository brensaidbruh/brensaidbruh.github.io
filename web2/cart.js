/* ByteArena Cart (localStorage-backed)
   - Renders items into #cart-items using the existing cart item layout
   - Supports add/increase/decrease/remove
   - Updates totals + empty state + navbar cart count
*/

(function () {
  "use strict";

  const STORAGE_KEY = "bytearena_cart_v1";
  const TAX_RATE = 0.1;

  const SUGGEST_LIMIT = 3;
  const SUGGEST_FETCH_LIMIT = 8;

  // Optional: hydrate missing covers from backend to ensure cover images show
  const HYDRATE_MISSING_COVERS = true;

  const els = {
    cartItems: document.getElementById("cart-items"),
    emptyCart: document.getElementById("empty-cart"),
    checkoutBtn: document.getElementById("checkout-btn"),
    subtotal: document.getElementById("subtotal"),
    tax: document.getElementById("tax"),
    total: document.getElementById("total"),
    discount: document.getElementById("discount"),
    shipping: document.getElementById("shipping"),
    subtotalLabel: document.getElementById("subtotal-label"),
    toast: document.getElementById("toast"),
    toastMessage: document.getElementById("toast-message"),
    cartCount: document.getElementById("cart-count"),

    // Suggested section
    suggestedWrap: document.getElementById("suggested-games"),
    suggestedRow: document.getElementById("suggested-games-row"),
  };

  let _lastSuggestKey = "";
  const _hydratedCoverIds = new Set();

  // NEW: wishlist cache for suggested cards on cart page
  let _wishlistIds = new Set();
  let _wishlistLoaded = false;
  let _wishlistLoading = null;

  function safeParseJSON(str, fallback) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  function loadCart() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cart = safeParseJSON(raw, []);
    if (!Array.isArray(cart)) return [];
    // sanitize
    return cart
      .map((i) => ({
        id: String(i.id ?? ""),
        title: String(i.title ?? ""),
        category: String(i.category ?? ""),
        icon: String(i.icon ?? "fas fa-gamepad"),
        cover: String(i.cover ?? i.cover_image ?? ""), // NEW
        price: Number(i.price ?? 0),
        quantity: Math.max(1, parseInt(i.quantity ?? 1, 10) || 1),
      }))
      .filter(
        (i) => i.id && i.title && Number.isFinite(i.price) && i.price >= 0
      );
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function formatMoney(amount) {
    const n = Number(amount) || 0;
    return "RM" + n.toFixed(2);
  }

  function computeTotals(cart) {
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const discount = 0;
    const shipping = 0;
    const tax = subtotal * TAX_RATE;
    const total = subtotal - discount + shipping + tax;

    const totalUnits = cart.reduce((sum, i) => sum + i.quantity, 0);

    return { subtotal, discount, shipping, tax, total, totalUnits };
  }

  function setEmptyState(isEmpty) {
    if (!els.cartItems || !els.emptyCart || !els.checkoutBtn) return;
    els.cartItems.classList.toggle("d-none", isEmpty);
    els.emptyCart.classList.toggle("d-none", !isEmpty);
    els.checkoutBtn.disabled = isEmpty;
  }

  function updateSummary(cart) {
    const t = computeTotals(cart);

    if (els.subtotal) els.subtotal.textContent = formatMoney(t.subtotal);
    if (els.tax) els.tax.textContent = formatMoney(t.tax);
    if (els.total) els.total.textContent = formatMoney(t.total);

    if (els.discount) els.discount.textContent = "-" + formatMoney(t.discount);
    if (els.shipping) els.shipping.textContent = formatMoney(t.shipping);

    if (els.subtotalLabel) {
      const unitLabel = t.totalUnits === 1 ? "item" : "items";
      els.subtotalLabel.textContent = `Subtotal (${t.totalUnits} ${unitLabel})`;
    }

    if (els.cartCount) {
      els.cartCount.textContent = String(t.totalUnits);
    }

    setEmptyState(cart.length === 0);
  }

  function cartItemHTML(item) {
    const safeTitle = escapeHTML(item.title);
    const safeCategory = escapeHTML(item.category);
    const safeIcon = escapeAttr(item.icon);
    const cover = String(item.cover ?? "").trim();
    const lineSubtotal = item.price * item.quantity;

    const imageHTML = cover
      ? `<img class="game-cover" src="${escapeAttr(cover)}" alt="${escapeAttr(
          item.title
        )}" loading="lazy" />`
      : `<i class="${safeIcon}" aria-hidden="true"></i>`;

    return `
      <div class="cart-item" data-id="${escapeAttr(item.id)}">
        <div class="row align-items-center">
          <div class="col-md-2">
            <div class="game-image">
              ${imageHTML}
            </div>
          </div>

          <div class="col-md-4">
            <div class="game-title">${safeTitle}</div>
            <div class="game-category">${safeCategory}</div>
          </div>

          <div class="col-md-3">
            <div class="quantity-controls">
              <button class="quantity-btn decrease" type="button" aria-label="Decrease quantity">
                <i class="fas fa-minus"></i>
              </button>
              <input
                type="number"
                class="quantity-input"
                value="${item.quantity}"
                min="1"
                inputmode="numeric"
                aria-label="Quantity"
              />
              <button class="quantity-btn increase" type="button" aria-label="Increase quantity">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>

          <div class="col-md-2 text-center">
            <div class="price">
              <div class="unit-price">${formatMoney(
                item.price
              )} <span class="unit-muted">each</span></div>
              <div class="line-subtotal">${formatMoney(lineSubtotal)}</div>
            </div>
          </div>

          <div class="col-md-1 text-end">
            <button class="remove-btn" type="button" aria-label="Remove item">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderCart(cart) {
    if (els.cartItems) {
      els.cartItems.innerHTML = cart.map(cartItemHTML).join("");
    }
    updateSummary(cart);
    updateSuggestedGames(cart);

    if (HYDRATE_MISSING_COVERS) {
      hydrateMissingCovers(cart);
    }
  }

  function escapeHTML(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(str) {
    return escapeHTML(str).replaceAll("`", "&#096;");
  }

  function showToast(message) {
    if (!els.toast || !els.toastMessage) return;
    els.toastMessage.textContent = message;
    els.toast.classList.add("show");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(
      () => els.toast.classList.remove("show"),
      3000
    );
  }

  function addItem(payload) {
    const cart = loadCart();
    const id = String(payload.id ?? "").trim();
    if (!id) return;

    const incomingCover = String(
      payload.cover ?? payload.cover_image ?? ""
    ).trim();

    const existing = cart.find((i) => i.id === id);
    if (existing) {
      existing.quantity += 1;
      // Fill missing cover if we get it later
      if (!existing.cover && incomingCover) existing.cover = incomingCover;
    } else {
      cart.push({
        id,
        title: String(payload.title ?? "Game"),
        category: String(payload.category ?? ""),
        icon: String(payload.icon ?? "fas fa-gamepad"),
        cover: incomingCover, // NEW
        price: Number(payload.price ?? 0),
        quantity: 1,
      });
    }

    saveCart(cart);
    renderCart(cart);
    showToast("Game added to cart!");
  }

  function setQuantity(id, qty) {
    const cart = loadCart();
    const item = cart.find((i) => i.id === id);
    if (!item) return;

    item.quantity = Math.max(1, parseInt(qty, 10) || 1);
    saveCart(cart);
    renderCart(cart);
  }

  function removeItem(id) {
    const cart = loadCart().filter((i) => i.id !== id);
    saveCart(cart);
    renderCart(cart);
    showToast("Item removed from cart");
  }

  function wireCartEvents() {
    if (!els.cartItems) return;

    els.cartItems.addEventListener("click", (e) => {
      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;

      const id = itemEl.getAttribute("data-id");
      if (!id) return;

      if (e.target.closest(".increase")) {
        const input = itemEl.querySelector(".quantity-input");
        setQuantity(id, (parseInt(input.value, 10) || 1) + 1);
      }

      if (e.target.closest(".decrease")) {
        const input = itemEl.querySelector(".quantity-input");
        const next = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
        setQuantity(id, next);
      }

      if (e.target.closest(".remove-btn")) {
        itemEl.style.transition = "opacity 0.25s ease";
        itemEl.style.opacity = "0";
        window.setTimeout(() => removeItem(id), 250);
      }
    });

    els.cartItems.addEventListener("change", (e) => {
      const input = e.target.closest(".quantity-input");
      if (!input) return;

      const itemEl = e.target.closest(".cart-item");
      if (!itemEl) return;

      const id = itemEl.getAttribute("data-id");
      if (!id) return;

      setQuantity(id, input.value);
    });
  }

  // -----------------------------
  // Cover hydration (optional)
  // -----------------------------
  async function fetchSingleGame(id) {
    const url = `backend/api/games/get_single_game.php?id=${encodeURIComponent(
      id
    )}`;
    const res = await fetch(url, { credentials: "same-origin" });
    const data = await res.json().catch(() => null);
    if (!data || !data.success || !data.game) return null;
    return data.game;
  }

  async function hydrateMissingCovers(cart) {
    // Only makes sense on pages that show cart items
    if (!els.cartItems) return;

    const needs = cart.filter(
      (i) => !i.cover && i.id && !_hydratedCoverIds.has(i.id)
    );
    if (needs.length === 0) return;

    // mark first to prevent parallel double-fetch
    needs.forEach((i) => _hydratedCoverIds.add(i.id));

    let changed = false;
    for (const item of needs) {
      try {
        const g = await fetchSingleGame(item.id);
        const cover = String(g?.cover_image ?? "").trim();
        if (cover) {
          const current = cart.find((x) => x.id === item.id);
          if (current && !current.cover) {
            current.cover = cover;
            changed = true;
          }
        }
      } catch {
        // ignore
      }
    }

    if (changed) {
      saveCart(cart);
      // re-render only cart list (summary unchanged)
      if (els.cartItems)
        els.cartItems.innerHTML = cart.map(cartItemHTML).join("");
    }
  }

  // -----------------------------
  // Suggested games (Steam cards)
  // -----------------------------
  function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  function createPopoverPlatformBadges(platforms) {
    if (!platforms) {
      return '<span style="color: rgba(255, 255, 255, 0.4); font-size: 0.75rem;">No platforms</span>';
    }
    return String(platforms)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map(
        (platform) =>
          `<span class="popover-badge platform-badge">${escapeHTML(
            platform
          )}</span>`
      )
      .join("");
  }

  function createPopoverCategoryBadges(categories) {
    if (!categories) {
      return '<span style="color: rgba(255, 255, 255, 0.4); font-size: 0.75rem;">No categories</span>';
    }
    return String(categories)
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map(
        (category) =>
          `<span class="popover-badge category-badge">${escapeHTML(
            category
          )}</span>`
      )
      .join("");
  }

  function createSuggestedPopoverContent(game, carouselId) {
    const formattedDate = formatDate(game.release_date);

    return `
      <div style="min-width: 320px;">
        <div id="${escapeAttr(
          carouselId
        )}" class="carousel slide mb-3" data-bs-ride="carousel">
          <div class="carousel-inner">
            <div class="carousel-item active">
              <div class="d-flex justify-content-center align-items-center" style="height: 180px; background: rgba(203, 187, 8, 0.1);">
                <i class="fas fa-spinner fa-spin fa-2x" style="color: #cbbb08;"></i>
              </div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbbb08; font-size: 0.85rem;">Developer:</strong>
          <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">${escapeHTML(
            game.developer || "Unknown"
          )}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbbb08; font-size: 0.85rem;">Release Date:</strong>
          <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">${escapeHTML(
            formattedDate
          )}</span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbbb08; font-size: 0.85rem;">Rating:</strong>
          <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">
            <i class="fas fa-star" style="color: #cbbb08;"></i> ${escapeHTML(
              game.rating || "N/A"
            )}
          </span>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbbb08; display: block; margin-bottom: 8px; font-size: 0.85rem;">Platforms:</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${createPopoverPlatformBadges(game.platforms)}
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <strong style="color: #cbbb08; display: block; margin-bottom: 8px; font-size: 0.85rem;">Categories:</strong>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${createPopoverCategoryBadges(game.categories)}
          </div>
        </div>

        ${
          game.description
            ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(203, 187, 8, 0.2);">
            <strong style="color: #cbbb08; display: block; margin-bottom: 6px; font-size: 0.85rem;">Description:</strong>
            <p style="color: rgba(255, 255, 255, 0.8); font-size: 0.8rem; margin: 0; line-height: 1.4;">
              ${escapeHTML(String(game.description).substring(0, 200))}${
                String(game.description).length > 200 ? "..." : ""
              }
            </p>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  async function loadSuggestedScreenshotsIntoCarousel(gameId, carouselId) {
    const carouselEl = document.getElementById(carouselId);
    if (!carouselEl) return;

    const inner = carouselEl.querySelector(".carousel-inner");
    if (!inner) return;

    try {
      const url = `backend/api/games/get_game_images.php?game_id=${encodeURIComponent(
        gameId
      )}`;
      const res = await fetch(url, { credentials: "same-origin" });
      const data = await res.json().catch(() => null);

      if (
        !data ||
        !data.success ||
        !Array.isArray(data.screenshots) ||
        data.screenshots.length === 0
      ) {
        inner.innerHTML = `
          <div class="carousel-item active">
            <div class="d-flex justify-content-center align-items-center" style="height: 180px; background: rgba(203, 187, 8, 0.1); border-radius: 8px;">
              <div class="text-center">
                <i class="fas fa-image fa-3x mb-2" style="color: rgba(203, 187, 8, 0.3);"></i>
                <p style="color: rgba(255, 255, 255, 0.5); margin: 0;">No screenshots available</p>
              </div>
            </div>
          </div>
        `;
        return;
      }

      inner.innerHTML = data.screenshots
        .slice(0, 5)
        .map((s, idx) => {
          const src = String(s.image_url ?? "").trim();
          if (!src) return "";
          return `
            <div class="carousel-item ${idx === 0 ? "active" : ""}">
              <img
                src="${escapeAttr(src)}"
                class="d-block w-100"
                alt="Screenshot ${idx + 1}"
                style="border-radius: 8px; max-height: 180px; object-fit: cover;"
              >
            </div>
          `;
        })
        .join("");

      // Ensure carousel works (and doesn't duplicate instances)
      if (window.bootstrap && window.bootstrap.Carousel) {
        const existing = window.bootstrap.Carousel.getInstance(carouselEl);
        if (existing) existing.dispose();

        new window.bootstrap.Carousel(carouselEl, {
          interval: 2000,
          wrap: true,
          ride: "carousel",
        });
      }
    } catch {
      inner.innerHTML = `
        <div class="carousel-item active">
          <div class="d-flex justify-content-center align-items-center" style="height: 180px; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
            <div class="text-center">
              <i class="fas fa-exclamation-triangle fa-2x mb-2" style="color: #dc3545;"></i>
              <p style="color: rgba(255, 255, 255, 0.5); margin: 0;">Failed to load screenshots</p>
            </div>
          </div>
        </div>
      `;
    }
  }

  function initSuggestedPopovers() {
    if (!els.suggestedWrap) return;
    if (!window.bootstrap || !window.bootstrap.Popover) return;

    const popoverTriggerList = els.suggestedWrap.querySelectorAll(
      '[data-bs-toggle="popover"]'
    );

    [...popoverTriggerList].forEach((el) => {
      const existing = window.bootstrap.Popover.getInstance(el);
      if (existing) existing.dispose();

      new window.bootstrap.Popover(el, {
        container: "body",
        customClass: "steam-popover",
      });

      el.addEventListener("shown.bs.popover", function () {
        const gameId = this.getAttribute("data-game-id");
        const carouselId = this.getAttribute("data-carousel-id");
        if (gameId && carouselId)
          loadSuggestedScreenshotsIntoCarousel(gameId, carouselId);
      });
    });
  }

  function suggestedCardHTML(game) {
    const id = String(game.id ?? "");
    const title = String(game.title ?? "Game");
    const price = Number(game.price ?? 0);
    const cover = String(game.cover_image ?? "");
    const rating = escapeHTML(String(game.rating ?? "N/A"));
    const categories = String(game.categories ?? "").trim();

    const carouselId = `carousel-${id}`;
    const popoverContent = createSuggestedPopoverContent(game, carouselId);

    return `
      <div class="col-md-4 col-sm-6">
        <div class="steam-game-card"
             data-game-id="${escapeAttr(id)}"
             data-carousel-id="${escapeAttr(carouselId)}"
             data-bs-toggle="popover"
             data-bs-trigger="hover focus"
             data-bs-placement="right"
             data-bs-html="true"
             data-bs-content='${popoverContent.replace(/'/g, "&#39;")}'
             role="button"
             tabindex="0">

          <div class="steam-card-image">
            ${
              cover
                ? `<img src="${escapeAttr(cover)}" alt="${escapeAttr(title)}">`
                : `<div class="steam-card-placeholder"><i class="fas fa-gamepad"></i></div>`
            }
          </div>

          <div class="steam-card-info">
            <h6 class="steam-card-title">${escapeHTML(title)}</h6>

            <div class="steam-card-meta">
              <div class="steam-rating">
                <i class="fas fa-star"></i>
                <span>${rating}</span>
              </div>
              <div class="steam-price">${formatMoney(price)}</div>
            </div>

            <div class="card-action-buttons">
              <button
                class="btn-card-action btn-add-cart"
                type="button"
                title="Add to Cart"
                data-id="${escapeAttr(id)}"
                data-title="${escapeAttr(title)}"
                data-category="${escapeAttr(categories)}"
                data-price="${escapeAttr(
                  String(Number.isFinite(price) ? price : 0)
                )}"
                data-cover="${escapeAttr(cover)}"
                data-icon="fas fa-gamepad"
              >
                <i class="fas fa-cart-plus"></i>
              </button>

              <!-- UPDATED: add data-game-id so we can persist wishlist -->
              <button class="btn-card-action btn-favorite" type="button" title="Add to Wishlist" data-game-id="${escapeAttr(id)}">
                <i class="far fa-heart"></i>
              </button>

              <button class="btn-card-action btn-buy-now" type="button" data-game-id="${escapeAttr(id)}">
                <i class="fas fa-shopping-bag"></i> Buy Now
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function setSuggestedVisible(visible) {
    if (!els.suggestedWrap) return;
    els.suggestedWrap.classList.toggle("d-none", !visible);
  }

  function clearSuggested() {
    if (els.suggestedRow) els.suggestedRow.innerHTML = "";
    setSuggestedVisible(false);
  }

  function extractCategoriesFromCart(cart) {
    const freq = new Map();

    cart.forEach((item) => {
      const raw = String(item.category ?? "").trim();
      if (!raw) return;

      raw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => {
          freq.set(c, (freq.get(c) || 0) + 1);
        });
    });

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([c]) => c);
  }

  async function fetchGamesByCategory(category) {
    const url =
      `backend/api/games/get_games.php?` +
      `categories=${encodeURIComponent(category)}&limit=${encodeURIComponent(
        SUGGEST_FETCH_LIMIT
      )}&active_only=1`;

    const res = await fetch(url, { credentials: "same-origin" });
    const data = await res.json().catch(() => null);

    if (!data || !data.success || !Array.isArray(data.games)) return [];
    return data.games;
  }

  async function updateSuggestedGames(cart) {
    if (!els.suggestedWrap || !els.suggestedRow) return;

    if (!cart || cart.length === 0) {
      _lastSuggestKey = "";
      clearSuggested();
      return;
    }

    const cartIds = new Set(cart.map((i) => String(i.id)));
    const cats = extractCategoriesFromCart(cart);

    const key = `${[...cartIds].sort().join(",")}::${cats
      .slice(0, 10)
      .join("|")}`;
    if (key === _lastSuggestKey) {
      setSuggestedVisible(els.suggestedRow.children.length > 0);
      return;
    }
    _lastSuggestKey = key;

    if (cats.length === 0) {
      clearSuggested();
      return;
    }

    const picked = new Map();
    for (const c of cats.slice(0, 4)) {
      try {
        const games = await fetchGamesByCategory(c);
        for (const g of games) {
          const gid = String(g.id ?? "");
          if (!gid) continue;
          if (cartIds.has(gid)) continue;
          if (!picked.has(gid)) picked.set(gid, g);
          if (picked.size >= SUGGEST_LIMIT) break;
        }
      } catch {}
      if (picked.size >= SUGGEST_LIMIT) break;
    }

    const list = [...picked.values()].slice(0, SUGGEST_LIMIT);
    if (list.length === 0) {
      clearSuggested();
      return;
    }

    els.suggestedRow.innerHTML = list.map(suggestedCardHTML).join("");
    setSuggestedVisible(true);

    initSuggestedPopovers();

    // NEW: load wishlist ids + apply filled hearts
    await ensureWishlistLoaded();
    applyWishlistStateToSuggested();
  }

  // NEW: wishlist functions
  async function ensureWishlistLoaded() {
    if (_wishlistLoaded) return;
    if (_wishlistLoading) return _wishlistLoading;

    _wishlistLoading = (async () => {
      try {
        const res = await fetch("backend/api/wishlist/get_wishlist.php", { credentials: "same-origin" });
        const data = await res.json().catch(() => null);
        if (data && data.success && Array.isArray(data.wishlist)) {
          _wishlistIds = new Set(data.wishlist.map((g) => String(g.id)));
        } else {
          _wishlistIds = new Set();
        }
      } catch {
        _wishlistIds = new Set();
      } finally {
        _wishlistLoaded = true;
      }
    })();

    return _wishlistLoading;
  }

  async function toggleWishlist(gameId) {
    const gid = String(gameId ?? "").trim();
    if (!gid) return null;

    try {
      const res = await fetch("backend/api/wishlist/toggle_wishlist.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: `game_id=${encodeURIComponent(gid)}`,
      });
      const data = await res.json().catch(() => null);
      return data;
    } catch {
      return null;
    }
  }

  function applyWishlistStateToSuggested() {
    if (!els.suggestedWrap) return;

    const btns = els.suggestedWrap.querySelectorAll(".btn-favorite[data-game-id]");
    btns.forEach((btn) => {
      const gid = String(btn.getAttribute("data-game-id") || "");
      const isFav = _wishlistIds.has(gid);
      btn.classList.toggle("active", isFav);

      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fas", isFav);
        icon.classList.toggle("far", !isFav);
      }
    });
  }

  function wireSuggestedEvents() {
    if (!els.suggestedWrap) return;

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".add-to-cart-btn, .btn-add-cart");
      if (!btn) return;

      // IMPORTANT: prevent Home page (and other pages) from double-adding
      // Only handle clicks coming from the cart page "You might also like" section.
      if (!btn.closest("#suggested-games")) return;

      const data = btn.dataset || {};
      addItem({
        id: data.id || data.gameId,
        title: data.title,
        category: data.category,
        price: data.price,
        icon: data.icon,
        cover: data.cover,
      });
    });

    document.addEventListener("click", (e) => {
      const card = e.target.closest(".steam-game-card");
      if (!card) return;
      if (e.target.closest(".btn-card-action")) return;

      // Only for cards inside suggested area
      if (!card.closest("#suggested-games")) return;

      const gameId = card.getAttribute("data-game-id");
      if (gameId)
        window.location.href = `itempage.php?id=${encodeURIComponent(gameId)}`;
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-buy-now");
      if (!btn) return;

      if (!btn.closest("#suggested-games")) return;

      const gameId =
        btn.getAttribute("data-game-id") || (btn.dataset && btn.dataset.gameId);
      if (gameId)
        window.location.href = `itempage.php?id=${encodeURIComponent(gameId)}`;
    });

    // UPDATED: persist wishlist (not just UI toggle)
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-favorite");
      if (!btn) return;

      if (!btn.closest("#suggested-games")) return;

      e.preventDefault();
      e.stopPropagation();

      const gameId = btn.getAttribute("data-game-id");
      if (!gameId) return;

      const res = await toggleWishlist(gameId);
      if (!res || !res.success) return;

      const isFav = res.action === "added";
      const gid = String(gameId);

      if (isFav) _wishlistIds.add(gid);
      else _wishlistIds.delete(gid);

      btn.classList.toggle("active", isFav);
      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fas", isFav);
        icon.classList.toggle("far", !isFav);
      }

      showToast(isFav ? "Added to wishlist!" : "Removed from wishlist");
    });
  }

  function init() {
    renderCart(loadCart());
    wireCartEvents();
    wireSuggestedEvents();

    window.ByteArenaCart = {
      addItem,
      loadCart,
      clear() {
        saveCart([]);
        renderCart([]);
      },
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

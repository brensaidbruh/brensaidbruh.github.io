(function ($) {
  "use strict";

  const HomeCoffee = {
    searchTerm: "",
    searchTimeout: null,
    selectedOrigins: [],
    selectedCategories: [],
    availableOrigins: [],
    availableCategories: [],
    wishlistIds: new Set(),

    init: function () {
      this.loadFilters();

      // Load wishlist ids for hearts
      this.loadWishlistIds(() => this.loadFeaturedCoffees());

      // Fallback if wishlist fetch fails
      setTimeout(() => {
        if ($("#featured-coffees-container").children().length === 0) {
          this.loadFeaturedCoffees();
        }
      }, 800);

      this.attachEventHandlers();
    },

    escapeHTML: function (str) {
      return String(str ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    },

    escapeAttr: function (str) {
      return this.escapeHTML(str).replaceAll("`", "&#096;");
    },

    attachEventHandlers: function () {
      $("#coffee-search").on("input", (e) => this.handleSearch(e));
      $("#clear-search").on("click", () => this.clearSearch());

      $(document).on("change", ".origin-checkbox", (e) =>
        this.handleOriginFilter(e)
      );
      $(document).on("change", ".category-checkbox", (e) =>
        this.handleCategoryFilter(e)
      );

      $("#clear-all-filters").on("click", () => this.clearAllFilters());

      $(document).on("click", ".remove-filter", (e) => this.removeFilter(e));

      // Card click redirect
      $(document).on("click", ".coffee-card", function (e) {
        if ($(e.target).closest(".btn-card-action").length === 0) {
          const coffeeId = $(this).data("coffee-id");
          window.location.href = `itempage.php?id=${coffeeId}`;
        }
      });

      // Scroll to Featured Coffees
      $("#btn-browse-featured").on("click", function () {
        const el = document.getElementById("featured-coffees");
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      // Add to cart
      $(document).on("click", ".btn-add-cart", function (e) {
        e.stopPropagation();
        HomeCoffee.addToCart(this);
      });

      // Favorite / wishlist
      $(document).on("click", ".btn-favorite", function (e) {
        e.stopPropagation();
        const coffeeId = $(this).data("coffee-id");
        const btn = $(this);
        HomeCoffee.toggleFavorite(coffeeId, btn);
      });

      // Buy now
      $(document).on("click", ".btn-buy-now", function (e) {
        e.stopPropagation();
        const coffeeId = $(this).data("coffee-id");
        HomeCoffee.buyNow(coffeeId);
      });
    },

    handleSearch: function (e) {
      clearTimeout(this.searchTimeout);
      this.searchTerm = $(e.target).val();

      this.searchTimeout = setTimeout(() => {
        this.loadFeaturedCoffees();
      }, 500);
    },

    clearSearch: function () {
      $("#coffee-search").val("");
      this.searchTerm = "";
      this.loadFeaturedCoffees();
    },

    handleOriginFilter: function (e) {
      const origin = $(e.target).val();

      if ($(e.target).is(":checked")) {
        this.selectedOrigins.push(origin);
      } else {
        this.selectedOrigins = this.selectedOrigins.filter((o) => o !== origin);
      }

      this.updateFilterBadge("origin-count", this.selectedOrigins.length);
      this.updateActiveFilters();
      this.loadFeaturedCoffees();
    },

    handleCategoryFilter: function (e) {
      const category = $(e.target).val();

      if ($(e.target).is(":checked")) {
        this.selectedCategories.push(category);
      } else {
        this.selectedCategories = this.selectedCategories.filter(
          (c) => c !== category
        );
      }

      this.updateFilterBadge("category-count", this.selectedCategories.length);
      this.updateActiveFilters();
      this.loadFeaturedCoffees();
    },

    clearAllFilters: function () {
      $("#coffee-search").val("");
      this.searchTerm = "";

      $(".origin-checkbox").prop("checked", false);
      this.selectedOrigins = [];
      this.updateFilterBadge("origin-count", 0);

      $(".category-checkbox").prop("checked", false);
      this.selectedCategories = [];
      this.updateFilterBadge("category-count", 0);

      $("#active-filters").hide();
      this.loadFeaturedCoffees();
    },

    removeFilter: function (e) {
      const type = $(e.currentTarget).data("type");
      const value = $(e.currentTarget).data("value");

      if (type === "origin") {
        this.selectedOrigins = this.selectedOrigins.filter((o) => o !== value);
        $(`.origin-checkbox[value="${value}"]`).prop("checked", false);
        this.updateFilterBadge("origin-count", this.selectedOrigins.length);
      } else if (type === "category") {
        this.selectedCategories = this.selectedCategories.filter((c) => c !== value);
        $(`.category-checkbox[value="${value}"]`).prop("checked", false);
        this.updateFilterBadge("category-count", this.selectedCategories.length);
      }

      this.updateActiveFilters();
      this.loadFeaturedCoffees();
    },

    updateFilterBadge: function (badgeId, count) {
      $(`#${badgeId}`).text(count);
    },

    updateActiveFilters: function () {
      const filtersList = $("#active-filters-list");
      filtersList.empty();

      let hasFilters = false;

      this.selectedOrigins.forEach((origin) => {
        hasFilters = true;
        filtersList.append(`
          <span class="active-filter-tag">
            <i class="fas fa-globe"></i> ${origin}
            <i class="fas fa-times remove-filter" data-type="origin" data-value="${origin}"></i>
          </span>
        `);
      });

      this.selectedCategories.forEach((category) => {
        hasFilters = true;
        filtersList.append(`
          <span class="active-filter-tag">
            <i class="fas fa-tag"></i> ${category}
            <i class="fas fa-times remove-filter" data-type="category" data-value="${category}"></i>
          </span>
        `);
      });

      if (hasFilters) $("#active-filters").show();
      else $("#active-filters").hide();
    },

    loadFilters: function () {
      // Origins
      $.ajax({
        url: "backend/api/coffee/get_origins.php",
        method: "GET",
        dataType: "json",
        success: (res) => {
          if (res.success && res.origins) {
            this.availableOrigins = res.origins;
            this.renderOriginFilters();
          }
        },
        error: () => {
          $("#origin-filters").html('<p class="text-danger">Failed to load origins</p>');
        },
      });

      // Categories
      $.ajax({
        url: "backend/api/coffee/get_categories.php",
        method: "GET",
        dataType: "json",
        success: (res) => {
          if (res.success && res.categories) {
            this.availableCategories = res.categories;
            this.renderCategoryFilters();
          }
        },
        error: () => {
          $("#category-filters").html('<p class="text-danger">Failed to load categories</p>');
        },
      });
    },

    renderOriginFilters: function () {
      const container = $("#origin-filters");
      container.empty();
      if (!this.availableOrigins.length) {
        container.html('<p style="color: rgba(255,255,255,0.5); text-align: center;">No origins available</p>');
        return;
      }
      this.availableOrigins.forEach((origin) => {
        container.append(`
          <div class="filter-item">
            <input type="checkbox" class="origin-checkbox" id="origin-${origin.id}" value="${origin.name}">
            <label for="origin-${origin.id}">${origin.name}</label>
          </div>
        `);
      });
    },

    renderCategoryFilters: function () {
      const container = $("#category-filters");
      container.empty();
      if (!this.availableCategories.length) {
        container.html('<p style="color: rgba(255,255,255,0.5); text-align: center;">No categories available</p>');
        return;
      }
      this.availableCategories.forEach((category) => {
        container.append(`
          <div class="filter-item">
            <input type="checkbox" class="category-checkbox" id="category-${category.id}" value="${category.name}">
            <label for="category-${category.id}">${category.name}</label>
          </div>
        `);
      });
    },

    loadFeaturedCoffees: function () {
      $("#loading-coffees").show();
      $("#featured-coffees-container").hide();
      $("#no-coffees").hide();

      const requestData = { featured: true, limit: 50 };

      if (this.searchTerm) requestData.search = this.searchTerm;
      if (this.selectedOrigins.length) requestData.origins = this.selectedOrigins.join(",");
      if (this.selectedCategories.length) requestData.categories = this.selectedCategories.join(",");

      $.ajax({
        url: "backend/api/coffee/get_coffees.php",
        method: "GET",
        data: requestData,
        dataType: "json",
        success: (res) => {
          if (res.success && res.coffees.length) this.displayCoffees(res.coffees);
          else this.showNoCoffees();
        },
        error: () => this.showError(),
      });
    },

    displayCoffees: function (coffees) {
      $("#loading-coffees").hide();
      const container = $("#featured-coffees-container");
      container.empty().show();

      let html = '<div class="row g-2">';
      coffees.forEach((coffee) => html += this.createCoffeeCard(coffee));
      html += "</div>";
      container.html(html);
    },

    createCoffeeCard: function (coffee) {
      const price = parseFloat(coffee.price).toFixed(2);
      const isFav = this.wishlistIds.has(String(coffee.id));
      const heartClass = isFav ? "fas" : "far";
      const favActiveClass = isFav ? "active" : "";

      return `
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="coffee-card" data-coffee-id="${this.escapeAttr(coffee.id)}">
            <div class="coffee-card-image">
              ${coffee.image ? `<img src="${coffee.image}" alt="${coffee.name}">` : `<div class="coffee-card-placeholder"><i class="fas fa-mug-hot"></i></div>`}
            </div>
            <div class="coffee-card-info">
              <h6 class="coffee-card-title">${this.escapeHTML(coffee.name)}</h6>
              <div class="coffee-price">RM${price}</div>
              <div class="card-action-buttons">
                <button class="btn-card-action btn-add-cart" data-coffee-id="${coffee.id}"><i class="fas fa-cart-plus"></i></button>
                <button class="btn-card-action btn-favorite ${favActiveClass}" data-coffee-id="${coffee.id}"><i class="${heartClass} fa-heart"></i></button>
                <button class="btn-card-action btn-buy-now" data-coffee-id="${coffee.id}"><i class="fas fa-shopping-bag"></i> Buy Now</button>
              </div>
            </div>
          </div>
        </div>
      `;
    },

    loadWishlistIds: function (cb) {
      $.ajax({
        url: "backend/api/wishlist/get_wishlist.php",
        method: "GET",
        dataType: "json",
        success: (res) => {
          if (res.success && Array.isArray(res.wishlist)) {
            this.wishlistIds = new Set(res.wishlist.map((c) => String(c.id)));
          }
          if (cb) cb();
        },
        error: () => { if (cb) cb(); },
      });
    },

    addToCart: function (btnEl) {
      const d = btnEl.dataset || {};
      const payload = {
        id: d.coffeeId,
        title: d.title,
        category: d.category,
        price: d.price,
        cover: d.cover,
      };
      if (!payload.id) return;
      if (window.ByteArenaCart && typeof window.ByteArenaCart.addItem === "function") {
        window.ByteArenaCart.addItem(payload);
      }
    },

    toggleFavorite: function (coffeeId, btn) {
      $.ajax({
        url: "backend/api/wishlist/toggle_wishlist.php",
        method: "POST",
        dataType: "json",
        data: { coffee_id: coffeeId },
        success: (res) => {
          if (!res.success) return;
          const action = res.action;
          const idStr = String(coffeeId);
          if (action === "added") {
            this.wishlistIds.add(idStr);
            btn.addClass("active");
            btn.find("i").removeClass("far").addClass("fas");
          } else if (action === "removed") {
            this.wishlistIds.delete(idStr);
            btn.removeClass("active");
            btn.find("i").removeClass("fas").addClass("far");
          }
        },
      });
    },

    buyNow: function (coffeeId) {
      window.location.href = `itempage.php?id=${coffeeId}`;
    },

    showNoCoffees: function () {
      $("#loading-coffees").hide();
      $("#featured-coffees-container").hide();
      $("#no-coffees").show();
    },

    showError: function () {
      $("#loading-coffees").hide();
      $("#featured-coffees-container").hide();
      $("#no-coffees")
        .html(`
          <i class="fas fa-exclamation-triangle fa-3x mb-3" style="color: #dc3545;"></i>
          <h4 style="color: #fff;">Failed to load coffees</h4>
          <p style="color: rgba(255,255,255,0.6);">Please try again later</p>
          <button class="btn btn-purple" onclick="location.reload()"><i class="fas fa-sync"></i> Retry</button>
        `).show();
    },
  };

  $(document).ready(function () {
    HomeCoffee.init();
  });

  window.HomeCoffee = HomeCoffee;
})(jQuery);
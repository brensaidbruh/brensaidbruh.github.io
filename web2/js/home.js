(function ($) {
  "use strict";

  const HomeGames = {
    searchTerm: "",
    searchTimeout: null,
    selectedPlatforms: [],
    selectedCategories: [],
    availablePlatforms: [],
    availableCategories: [],
    wishlistIds: new Set(),

    init: function () {
      this.loadFilters();

      // NEW: load wishlist ids (so hearts reflect saved state)
      this.loadWishlistIds(() => this.loadFeaturedGames());

      // If wishlist fetch fails, still load games
      setTimeout(() => {
        if ($("#featured-games-container").children().length === 0) {
          this.loadFeaturedGames();
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
      // Search functionality
      $("#game-search").on("input", (e) => this.handleSearch(e));
      $("#clear-search").on("click", () => this.clearSearch());

      // Filter checkboxes (delegated events)
      $(document).on("change", ".platform-checkbox", (e) =>
        this.handlePlatformFilter(e)
      );
      $(document).on("change", ".category-checkbox", (e) =>
        this.handleCategoryFilter(e)
      );

      // Clear all filters
      $("#clear-all-filters").on("click", () => this.clearAllFilters());

      // Remove individual filter tags
      $(document).on("click", ".remove-filter", (e) => this.removeFilter(e));

      // Card click handler - redirect to game details
      $(document).on("click", ".steam-game-card", function (e) {
        if ($(e.target).closest(".btn-card-action").length === 0) {
          const gameId = $(this).data("game-id");
          window.location.href = `itempage.php?id=${gameId}`;
        }
      });

      // Scroll to Featured Games when clicking "Browse Games"
      $("#btn-browse-featured").on("click", function () {
        const el = document.getElementById("featured-games");
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      // Add to cart handler
      $(document).on("click", ".btn-add-cart", function (e) {
        e.stopPropagation();
        HomeGames.addToCart(this);
      });

      // Favorite handler
      $(document).on("click", ".btn-favorite", function (e) {
        e.stopPropagation();
        const gameId = $(this).data("game-id");
        const btn = $(this);
        HomeGames.toggleFavorite(gameId, btn);
      });

      // Buy now handler
      $(document).on("click", ".btn-buy-now", function (e) {
        e.stopPropagation();
        const gameId = $(this).data("game-id");
        HomeGames.buyNow(gameId);
      });
    },

    handleSearch: function (e) {
      clearTimeout(this.searchTimeout);
      this.searchTerm = $(e.target).val();

      this.searchTimeout = setTimeout(() => {
        this.loadFeaturedGames();
      }, 500);
    },

    clearSearch: function () {
      $("#game-search").val("");
      this.searchTerm = "";
      this.loadFeaturedGames();
    },

    handlePlatformFilter: function (e) {
      const platform = $(e.target).val();

      if ($(e.target).is(":checked")) {
        this.selectedPlatforms.push(platform);
      } else {
        this.selectedPlatforms = this.selectedPlatforms.filter(
          (p) => p !== platform
        );
      }

      this.updateFilterBadge("platform-count", this.selectedPlatforms.length);
      this.updateActiveFilters();
      this.loadFeaturedGames();
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
      this.loadFeaturedGames();
    },

    clearAllFilters: function () {
      // Clear search
      $("#game-search").val("");
      this.searchTerm = "";

      // Clear platform filters
      $(".platform-checkbox").prop("checked", false);
      this.selectedPlatforms = [];
      this.updateFilterBadge("platform-count", 0);

      // Clear category filters
      $(".category-checkbox").prop("checked", false);
      this.selectedCategories = [];
      this.updateFilterBadge("category-count", 0);

      // Hide active filters
      $("#active-filters").hide();

      // Reload games
      this.loadFeaturedGames();
    },

    removeFilter: function (e) {
      const type = $(e.currentTarget).data("type");
      const value = $(e.currentTarget).data("value");

      if (type === "platform") {
        this.selectedPlatforms = this.selectedPlatforms.filter(
          (p) => p !== value
        );
        $(`.platform-checkbox[value="${value}"]`).prop("checked", false);
        this.updateFilterBadge("platform-count", this.selectedPlatforms.length);
      } else if (type === "category") {
        this.selectedCategories = this.selectedCategories.filter(
          (c) => c !== value
        );
        $(`.category-checkbox[value="${value}"]`).prop("checked", false);
        this.updateFilterBadge(
          "category-count",
          this.selectedCategories.length
        );
      }

      this.updateActiveFilters();
      this.loadFeaturedGames();
    },

    updateFilterBadge: function (badgeId, count) {
      $(`#${badgeId}`).text(count);
    },

    updateActiveFilters: function () {
      const filtersList = $("#active-filters-list");
      filtersList.empty();

      let hasFilters = false;

      // Add platform filters
      this.selectedPlatforms.forEach((platform) => {
        hasFilters = true;
        filtersList.append(`
          <span class="active-filter-tag">
            <i class="fas fa-desktop"></i> ${platform}
            <i class="fas fa-times remove-filter" data-type="platform" data-value="${platform}"></i>
          </span>
        `);
      });

      // Add category filters
      this.selectedCategories.forEach((category) => {
        hasFilters = true;
        filtersList.append(`
          <span class="active-filter-tag">
            <i class="fas fa-tag"></i> ${category}
            <i class="fas fa-times remove-filter" data-type="category" data-value="${category}"></i>
          </span>
        `);
      });

      // Show/hide active filters section
      if (hasFilters) {
        $("#active-filters").show();
      } else {
        $("#active-filters").hide();
      }
    },

    loadFilters: function () {
      // Load platforms
      $.ajax({
        url: "backend/api/games/get_platforms.php",
        method: "GET",
        dataType: "json",
        success: (response) => {
          if (response.success && response.platforms) {
            this.availablePlatforms = response.platforms;
            this.renderPlatformFilters();
          }
        },
        error: (xhr, status, error) => {
          console.error("Error loading platforms:", error);
          $("#platform-filters").html(
            '<p class="text-danger">Failed to load platforms</p>'
          );
        },
      });

      // Load categories
      $.ajax({
        url: "backend/api/games/get_categories.php",
        method: "GET",
        dataType: "json",
        success: (response) => {
          if (response.success && response.categories) {
            this.availableCategories = response.categories;
            this.renderCategoryFilters();
          }
        },
        error: (xhr, status, error) => {
          console.error("Error loading categories:", error);
          $("#category-filters").html(
            '<p class="text-danger">Failed to load categories</p>'
          );
        },
      });
    },

    renderPlatformFilters: function () {
      const container = $("#platform-filters");
      container.empty();

      if (this.availablePlatforms.length === 0) {
        container.html(
          '<p style="color: rgba(255,255,255,0.5); text-align: center;">No platforms available</p>'
        );
        return;
      }

      this.availablePlatforms.forEach((platform) => {
        container.append(`
          <div class="filter-item">
            <input
              type="checkbox"
              class="platform-checkbox"
              id="platform-${platform.id}"
              value="${platform.platform_name}"
            />
            <label for="platform-${platform.id}">${
          platform.platform_name
        }</label>
            <span class="filter-item-count">${platform.game_count || 0}</span>
          </div>
        `);
      });
    },

    renderCategoryFilters: function () {
      const container = $("#category-filters");
      container.empty();

      if (this.availableCategories.length === 0) {
        container.html(
          '<p style="color: rgba(255,255,255,0.5); text-align: center;">No categories available</p>'
        );
        return;
      }

      this.availableCategories.forEach((category) => {
        container.append(`
          <div class="filter-item">
            <input
              type="checkbox"
              class="category-checkbox"
              id="category-${category.id}"
              value="${category.category_name}"
            />
            <label for="category-${category.id}">${
          category.category_name
        }</label>
            <span class="filter-item-count">${category.game_count || 0}</span>
          </div>
        `);
      });
    },

    loadFeaturedGames: function () {
      $("#loading-games").show();
      $("#featured-games-container").hide();
      $("#no-games").hide();

      const requestData = {
        featured: true,
        limit: 50,
        active_only: true,
      };

      // Add search term if present
      if (this.searchTerm) {
        requestData.search = this.searchTerm;
      }

      // Add platform filters
      if (this.selectedPlatforms.length > 0) {
        requestData.platforms = this.selectedPlatforms.join(",");
      }

      // Add category filters
      if (this.selectedCategories.length > 0) {
        requestData.categories = this.selectedCategories.join(",");
      }

      $.ajax({
        url: "backend/api/games/get_games.php",
        method: "GET",
        data: requestData,
        dataType: "json",
        success: (response) => {
          if (response.success && response.games.length > 0) {
            this.displayGames(response.games);
          } else {
            this.showNoGames();
          }
        },
        error: (xhr, status, error) => {
          console.error("Error loading games:", error);
          this.showError();
        },
      });
    },

    displayGames: function (games) {
      $("#loading-games").hide();
      $("#no-games").hide();

      const container = $("#featured-games-container");
      container.empty().show();

      let html = '<div class="row g-2">';

      games.forEach((game) => {
        html += this.createGameCard(game);
      });

      html += "</div>";
      container.html(html);

      this.initializePopovers();
    },

    createGameCard: function (game) {
      const price = parseFloat(game.price).toFixed(2);
      const carouselId = `carousel-${game.id}`;
      const popoverContent = this.createPopoverContent(game, carouselId);

      return `
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="steam-game-card"
               data-game-id="${this.escapeAttr(game.id)}"
               data-carousel-id="${this.escapeAttr(carouselId)}"
               data-bs-toggle="popover"
               data-bs-trigger="hover focus"
               data-bs-placement="right"
               data-bs-html="true"
               data-bs-content='${popoverContent.replace(/'/g, "&#39;")}'>

            <div class="steam-card-image">
              ${
                game.cover_image
                  ? `
                <img src="${this.escapeAttr(
                  game.cover_image
                )}" alt="${this.escapeAttr(game.title)}">
              `
                  : `
                <div class="steam-card-placeholder">
                  <i class="fas fa-gamepad"></i>
                </div>
              `
              }
            </div>

            <div class="steam-card-info">
              <h6 class="steam-card-title">${this.escapeHTML(game.title)}</h6>
              <div class="steam-card-meta">
                <div class="steam-rating">
                  <i class="fas fa-star"></i>
                  <span>${this.escapeHTML(game.rating || "N/A")}</span>
                </div>
                <div class="steam-price">RM${price}</div>
              </div>
              ${this.createActionButtons(game)}
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
          if (res && res.success && Array.isArray(res.wishlist)) {
            this.wishlistIds = new Set(res.wishlist.map((g) => String(g.id)));
          }
          if (typeof cb === "function") cb();
        },
        error: () => {
          if (typeof cb === "function") cb();
        },
      });
    },

    createActionButtons: function (game) {
      const id = String(game.id ?? "").trim();
      const title = String(game.title ?? "Game");
      const categories = String(game.categories ?? "");
      const price = String(Number(game.price ?? 0));
      const cover = String(game.cover_image ?? "");

      const isFav = this.wishlistIds.has(String(id));
      const heartClass = isFav ? "fas" : "far";
      const favActiveClass = isFav ? "active" : "";

      return `
        <div class="card-action-buttons">
          <button
            class="btn-card-action btn-add-cart"
            type="button"
            title="Add to Cart"
            data-game-id="${this.escapeAttr(id)}"
            data-id="${this.escapeAttr(id)}"
            data-title="${this.escapeAttr(title)}"
            data-category="${this.escapeAttr(categories)}"
            data-price="${this.escapeAttr(price)}"
            data-cover="${this.escapeAttr(cover)}"
            data-icon="fas fa-gamepad"
          >
            <i class="fas fa-cart-plus"></i>
          </button>

          <button
            class="btn-card-action btn-favorite ${favActiveClass}"
            data-game-id="${this.escapeAttr(id)}"
            title="Add to Wishlist"
            type="button"
          >
            <i class="${heartClass} fa-heart"></i>
          </button>

          <button class="btn-card-action btn-buy-now" data-game-id="${this.escapeAttr(id)}" type="button">
            <i class="fas fa-shopping-bag"></i> Buy Now
          </button>
        </div>
      `;
    },

    // Add to cart function
    addToCart: function (btnEl) {
      const d = btnEl?.dataset || {};
      const payload = {
        id: d.id || d.gameId,
        title: d.title,
        category: d.category, // cart.js uses "category" (string, comma-separated)
        price: d.price,
        cover: d.cover,
        icon: d.icon || "fas fa-gamepad",
      };

      if (!payload.id) return;

      if (
        window.ByteArenaCart &&
        typeof window.ByteArenaCart.addItem === "function"
      ) {
        window.ByteArenaCart.addItem(payload);
      }
    },

    toggleFavorite: function (gameId, btn) {
      $.ajax({
        url: "backend/api/wishlist/toggle_wishlist.php",
        method: "POST",
        dataType: "json",
        data: { game_id: gameId },
        success: (res) => {
          if (!res || !res.success) return;

          const action = res.action;
          const idStr = String(gameId);

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

    buyNow: function (gameId) {
      window.location.href = `itempage.php?id=${gameId}`;
    },

    createPopoverContent: function (game, carouselId) {
      const formattedDate = this.formatDate(game.release_date);

      return `
        <div style="min-width: 320px;">
          <div id="${carouselId}" class="carousel slide mb-3" data-bs-ride="carousel">
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
            <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">${
              game.developer || "Unknown"
            }</span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #cbbb08; font-size: 0.85rem;">Release Date:</strong>
            <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">${formattedDate}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #cbbb08; font-size: 0.85rem;">Rating:</strong>
            <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">
              <i class="fas fa-star" style="color: #cbbb08;"></i> ${
                game.rating || "N/A"
              }
            </span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #cbbb08; display: block; margin-bottom: 8px; font-size: 0.85rem;">Platforms:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${this.createPopoverPlatformBadges(game.platforms)}
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #cbbb08; display: block; margin-bottom: 8px; font-size: 0.85rem;">Categories:</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${this.createPopoverCategoryBadges(game.categories)}
            </div>
          </div>
          ${
            game.description
              ? `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(203, 187, 8, 0.2);">
              <strong style="color: #cbbb08; display: block; margin-bottom: 6px; font-size: 0.85rem;">Description:</strong>
              <p style="color: rgba(255, 255, 255, 0.8); font-size: 0.8rem; margin: 0; line-height: 1.4;">
                ${game.description.substring(0, 200)}${
                  game.description.length > 200 ? "..." : ""
                }
              </p>
            </div>
          `
              : ""
          }
        </div>
      `;
    },

    createPopoverPlatformBadges: function (platforms) {
      if (!platforms) {
        return '<span style="color: rgba(255, 255, 255, 0.4); font-size: 0.75rem;">No platforms</span>';
      }
      return platforms
        .split(",")
        .map((p) => p.trim())
        .map(
          (platform) => `
        <span class="popover-badge platform-badge">
          ${platform}
        </span>
      `
        )
        .join("");
    },

    createPopoverCategoryBadges: function (categories) {
      if (!categories) {
        return '<span style="color: rgba(255, 255, 255, 0.4); font-size: 0.75rem;">No categories</span>';
      }
      return categories
        .split(",")
        .map((c) => c.trim())
        .map(
          (category) => `
        <span class="popover-badge category-badge">
          ${category}
        </span>
      `
        )
        .join("");
    },

    initializePopovers: function () {
      const popoverTriggerList = document.querySelectorAll(
        '[data-bs-toggle="popover"]'
      );
      [...popoverTriggerList].forEach((popoverTriggerEl) => {
        const popover = new bootstrap.Popover(popoverTriggerEl, {
          container: "body",
          customClass: "steam-popover",
        });

        popoverTriggerEl.addEventListener("shown.bs.popover", function () {
          const gameId = this.getAttribute("data-game-id");
          const carouselId = this.getAttribute("data-carousel-id");
          HomeGames.loadScreenshotsIntoCarousel(gameId, carouselId);
        });
      });
    },

    loadScreenshotsIntoCarousel: function (gameId, carouselId) {
      $.ajax({
        url: "backend/api/games/get_game_images.php",
        method: "GET",
        data: { game_id: gameId },
        dataType: "json",
        success: (response) => {
          const carouselElement = document.getElementById(carouselId);
          const carouselInner = $(`#${carouselId} .carousel-inner`);

          if (response.success && response.screenshots.length > 0) {
            carouselInner.empty();

            response.screenshots.forEach((screenshot, index) => {
              const isActive = index === 0 ? "active" : "";
              carouselInner.append(`
                <div class="carousel-item ${isActive}">
                  <img src="${
                    screenshot.image_url
                  }" class="d-block w-100" alt="Screenshot ${index + 1}"
                       style="border-radius: 8px; max-height: 180px; object-fit: cover;">
                </div>
              `);
            });

            this.initializeCarousel(carouselElement);
          } else {
            carouselInner.html(`
              <div class="carousel-item active">
                <div class="d-flex justify-content-center align-items-center" style="height: 180px; background: rgba(203, 187, 8, 0.1); border-radius: 8px;">
                  <div class="text-center">
                    <i class="fas fa-image fa-3x mb-2" style="color: rgba(203, 187, 8, 0.3);"></i>
                    <p style="color: rgba(255, 255, 255, 0.5); margin: 0;">No screenshots available</p>
                  </div>
                </div>
              </div>
            `);
          }
        },
        error: () => {
          const carouselInner = $(`#${carouselId} .carousel-inner`);
          carouselInner.html(`
            <div class="carousel-item active">
              <div class="d-flex justify-content-center align-items-center" style="height: 180px; background: rgba(220, 53, 69, 0.1); border-radius: 8px;">
                <div class="text-center">
                  <i class="fas fa-exclamation-triangle fa-2x mb-2" style="color: #dc3545;"></i>
                  <p style="color: rgba(255, 255, 255, 0.5); margin: 0;">Failed to load screenshots</p>
                </div>
              </div>
            </div>
          `);
        },
      });
    },

    initializeCarousel: function (carouselElement) {
      if (!carouselElement) return;

      const existingInstance = bootstrap.Carousel.getInstance(carouselElement);
      if (existingInstance) {
        existingInstance.dispose();
      }

      return new bootstrap.Carousel(carouselElement, {
        interval: 2000,
        wrap: true,
        ride: "carousel",
      });
    },

    showNoGames: function () {
      $("#loading-games").hide();
      $("#featured-games-container").hide();
      $("#no-games").show();
    },

    showError: function () {
      $("#loading-games").hide();
      $("#featured-games-container").hide();
      $("#no-games")
        .html(
          `
        <i class="fas fa-exclamation-triangle fa-3x mb-3" style="color: #dc3545;"></i>
        <h4 style="color: #fff;">Failed to load games</h4>
        <p style="color: rgba(255, 255, 255, 0.6);">Please try again later</p>
        <button class="btn btn-purple" onclick="location.reload()">
          <i class="fas fa-sync"></i> Retry
        </button>
      `
        )
        .show();
    },

    formatDate: function (dateString) {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
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
      return `${date.getDate()} ${
        months[date.getMonth()]
      } ${date.getFullYear()}`;
    },
  };

  $(document).ready(function () {
    HomeGames.init();
  });

  window.HomeGames = HomeGames;
})(jQuery);

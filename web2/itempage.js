(function($) {
  'use strict';

  const ItemPage = {
    gameId: null,
    gameData: null,
    wishlistIds: new Set(),

    init: function() {
      // Get game ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      this.gameId = urlParams.get('id');

      if (!this.gameId) {
        this.showError('No game ID provided');
        return;
      }

      // Load wishlist first so hearts render in the correct state
      this.loadWishlistIds(() => {
        // If anything is already on the page, sync it too
        this.applyWishlistStateToButtons(document);
        this.loadGameData();
      });

      this.attachEventHandlers();
    },

    // --- helpers for safe HTML attributes ---
    escapeHTML: function(str) {
      return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    },

    escapeAttr: function(str) {
      return this.escapeHTML(str).replaceAll('`', '&#096;');
    },

    loadWishlistIds: function(cb) {
      $.ajax({
        url: 'backend/api/wishlist/get_wishlist.php',
        method: 'GET',
        dataType: 'json',
        success: (res) => {
          if (res && res.success && Array.isArray(res.wishlist)) {
            this.wishlistIds = new Set(res.wishlist.map(w => String(w.id)));
          }
          if (typeof cb === 'function') cb();
        },
        error: () => {
          // Not logged in or endpoint error: proceed without wishlist state
          if (typeof cb === 'function') cb();
        }
      });
    },

    addPayloadToCart: function(payload) {
      if (window.ByteArenaCart && typeof window.ByteArenaCart.addItem === 'function') {
        window.ByteArenaCart.addItem(payload);
        return;
      }

      // Fallback (should not happen if itempage.php loads cart.js)
      try {
        const key = 'bytearena_cart_v1';
        const raw = localStorage.getItem(key);
        const cart = Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw || '[]') : [];
        const id = String(payload.id ?? '').trim();
        if (!id) return;

        const existing = cart.find(i => String(i.id) === id);
        if (existing) existing.quantity = (parseInt(existing.quantity, 10) || 1) + 1;
        else cart.push({ ...payload, id, quantity: 1 });

        localStorage.setItem(key, JSON.stringify(cart));
      } catch {}
    },

    attachEventHandlers: function() {
      // Add to cart handler (main game)
      $(document).on('click', '.btn-add-to-cart', () => {
        this.addToCart();
      });

      // Buy now handler (main game)
      $(document).on('click', '.btn-buy-now', () => {
        this.buyNow();
      });

      // Wishlist handler (main game) -> real wishlist toggle
      $(document).on('click', '.btn-wishlist', function(e) {
        e.preventDefault();
        const btn = $(this);
        const gameId = btn.data('game-id') || ItemPage.gameId;
        ItemPage.toggleWishlist(gameId, btn);
      });

      // Screenshot lightbox
      $(document).on('click', '.screenshot-item img', function() {
        ItemPage.openScreenshotModal($(this).attr('src'));
      });

      // Category tag clicks
      $(document).on('click', '.game-tag', function() {
        const category = $(this).text();
        window.location.href = `home.php?category=${encodeURIComponent(category)}`;
      });

      // Related game card click - redirect to game details
      $(document).on('click', '.steam-game-card', function(e) {
        if ($(e.target).closest('.btn-card-action').length === 0) {
          const gameId = $(this).data('game-id');
          window.location.href = `itempage.php?id=${gameId}`;
        }
      });

      // Related game - Add to cart (use data attributes from the button)
      $(document).on('click', '.related-games .btn-add-cart', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = this;
        const payload = {
          id: btn.dataset.id,
          title: btn.dataset.title,
          category: btn.dataset.category,
          price: btn.dataset.price,
          icon: btn.dataset.icon
        };

        if (window.ByteArenaCart && typeof window.ByteArenaCart.addItem === 'function') {
          window.ByteArenaCart.addItem(payload);
        }
      });

      // Related game - Favorite (wishlist) -> real wishlist toggle
      $(document).on('click', '.related-games .btn-favorite', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const btn = $(this);
        const gameId = btn.data('game-id');
        ItemPage.toggleWishlist(gameId, btn);
      });

      // Related game - Buy now
      $(document).on('click', '.related-games .btn-buy-now', function(e) {
        e.stopPropagation();
        const gameId = $(this).data('game-id');
        window.location.href = `itempage.php?id=${gameId}`;
      });

      $(document).on('submit', '#review-form', (e) => {
        e.preventDefault();
        this.saveReview();
      });
    },

    loadGameData: function() {
      $('#game-loading').show();
      $('#game-content').hide();

      $.ajax({
        url: 'backend/api/games/get_single_game.php',
        method: 'GET',
        data: { id: this.gameId },
        dataType: 'json',
        success: (response) => {
          if (response.success && response.game) {
            this.gameData = response.game;
            this.renderGamePage();
            this.loadRelatedGames();
          } else {
            this.showError(response.error || 'Game not found');
          }
        },
        error: (xhr, status, error) => {
          console.error('Error loading game:', error);
          console.error('Response:', xhr.responseText);

          let errorMessage = 'Failed to load game details';

          try {
            const errorData = JSON.parse(xhr.responseText);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.trace) {
              console.error('Error trace:', errorData.trace);
            }
          } catch (e) {
            // Could not parse error response
          }

          if (xhr.status === 404) {
            errorMessage = 'Game not found or not available';
          } else if (xhr.status === 401) {
            errorMessage = 'Please login to view game details';
            setTimeout(() => {
              window.location.href = 'login.php';
            }, 2000);
          } else if (xhr.status === 403) {
            errorMessage = 'You do not have permission to view this game';
          }

          this.showError(errorMessage);
        }
      });
    },

    // Keep all wishlist/favorite buttons in sync across the page
    setWishlistButtonState: function(gameId, isFav, root) {
      const idStr = String(gameId ?? '').trim();
      if (!idStr) return;

      const $root = root ? $(root) : $(document);

      // Main item page wishlist button
      const $mainBtn = $root.find(`.btn-wishlist[data-game-id="${CSS.escape(idStr)}"]`);
      // Related cards favorite button
      const $cardBtn = $root.find(`.btn-favorite[data-game-id="${CSS.escape(idStr)}"]`);

      const updateBtn = ($btn) => {
        if (!$btn || !$btn.length) return;

        if (isFav) {
          $btn.addClass('active');
          $btn.find('i').removeClass('far').addClass('fas');
        } else {
          $btn.removeClass('active');
          $btn.find('i').removeClass('fas').addClass('far');
        }
      };

      updateBtn($mainBtn);
      updateBtn($cardBtn);
    },

    applyWishlistStateToButtons: function(root) {
      const $root = root ? $(root) : $(document);

      $root
        .find('.btn-wishlist[data-game-id], .btn-favorite[data-game-id]')
        .each((_, el) => {
          const idStr = String($(el).data('game-id') ?? '').trim();
          if (!idStr) return;
          const isFav = this.wishlistIds.has(idStr);
          this.setWishlistButtonState(idStr, isFav, root);
        });
    },

    renderGamePage: function() {
      const game = this.gameData;
      document.title = `${game.title} - ByteArena`;
      this.renderGameCard(game);
      this.renderDescriptionTab(game);
      this.renderRequirementsTab(game);
      this.renderScreenshotsTab(game);
      $('#game-loading').hide();
      $('#game-content').show();

      // Ensure review UI exists (in case the HTML is missing / cached / overwritten)
      this.ensureReviewUI();

      $('#review-game-id').val(this.gameId);
      this.loadReviews(this.gameId);
    },

    ensureReviewUI: function() {
      // If the reviews pane exists but the form is missing, inject it.
      const $reviewsPane = $('#reviews');
      if (!$reviewsPane.length) return;

      if ($('#review-form').length) return;

      $reviewsPane.html(`
        <div class="card mt-3" style="background-color:#1a1a2e; border:1px solid rgba(203,187,8,0.35);">
          <div class="card-body">
            <div id="reviews-summary" class="mb-3"></div>

            <form id="review-form" class="mb-4">
              <input type="hidden" id="review-game-id" value="" />

              <div class="row g-3">
                <div class="col-md-3">
                  <label class="form-label" style="color:#cbbb08;">Rating</label>
                  <select class="form-select" id="review-rating" required>
                    <option value="">Select</option>
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Good</option>
                    <option value="3">3 - Okay</option>
                    <option value="2">2 - Bad</option>
                    <option value="1">1 - Terrible</option>
                  </select>
                </div>

                <div class="col-md-9">
                  <label class="form-label" style="color:#cbbb08;">Title (optional)</label>
                  <input class="form-control" id="review-title" maxlength="200" placeholder="Short summary" />
                </div>

                <div class="col-12">
                  <label class="form-label" style="color:#cbbb08;">Review</label>
                  <textarea class="form-control" id="review-text" rows="4" placeholder="Write your thoughts..."></textarea>
                </div>

                <div class="col-12 d-flex gap-2">
                  <button type="submit" class="btn btn-action">
                    <i class="fas fa-paper-plane"></i> Submit Review
                  </button>
                  <div id="review-status" style="align-self:center; color: rgba(255,255,255,0.7);"></div>
                </div>
              </div>
            </form>

            <div id="reviews-list"></div>
          </div>
        </div>
      `);
    },

    renderGameCard: function(game) {
      const price = parseFloat(game.price).toFixed(2);
      const ratingValue = parseFloat(game.rating) || 0;
      const rating = this.generateStarRating(ratingValue);
      const platforms = game.platforms ? game.platforms.split(',').map(p => p.trim()) : [];

      const idStr = String(game.id ?? '').trim();
      const isFav = idStr && this.wishlistIds.has(idStr);
      const heartStyle = isFav ? 'fas' : 'far';
      const activeClass = isFav ? 'active' : '';

      const cardHtml = `
        <div class="row g-0">
          <div class="col-md-4">
            ${game.cover_image ? `
              <img src="${game.cover_image}" class="img-fluid rounded-start" alt="${game.title}" style="height: 100%; object-fit: cover;">
            ` : `
              <div class="img-fluid rounded-start d-flex align-items-center justify-content-center" style="height: 400px; background: linear-gradient(135deg, #490596, #6c42f5);">
                <i class="fas fa-gamepad fa-5x" style="color: rgba(255,255,255,0.3);"></i>
              </div>
            `}
          </div>
          <div class="col-md-8">
            <div class="card-body">
              <h5 class="card-title">${game.title}</h5>
              <p class="card-text">By ${game.developer || 'Unknown Developer'}</p>
              <p class="card-text">Rating: ${rating}</p>
              <p class="card-text"><strong>Price: RM${price}</strong></p>
              <div class="cta">
                <button class="btn-add-to-cart">
                  <i class="fas fa-shopping-cart"></i> Add to Cart
                </button>
                <button class="btn-buy-now">
                  <i class="fas fa-bolt"></i> Buy Now
                </button>
                <button class="btn-wishlist wishlist-btn ${activeClass}" data-game-id="${this.escapeAttr(idStr)}" type="button">
                  <i class="${heartStyle} fa-heart"></i>
                </button>
              </div>
              ${platforms.length > 0 ? `
                <div class="platforms-section">
                  <h6 class="platforms-title">Available Platforms</h6>
                  <div class="platforms-buttons">
                    ${this.renderPlatformButtons(platforms)}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      $('.content-itempage .card').html(cardHtml);

      // Ensure the just-rendered button matches wishlist state (reuse idStr)
      this.setWishlistButtonState(idStr, this.wishlistIds.has(idStr), $('.content-itempage .card'));
    },

    renderPlatformButtons: function(platforms) {
      return platforms.map(platform => {
        return `
          <button class="platform-btn">
            ${platform}
          </button>
        `;
      }).join('');
    },

    generateStarRating: function(rating) {
      const ratingNum = typeof rating === 'number' ? rating : parseFloat(rating) || 0;
      const clampedRating = Math.max(0, Math.min(5, ratingNum));
      const fullStars = Math.floor(clampedRating);
      const hasHalfStar = clampedRating % 1 >= 0.5;
      const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

      let html = '';
      for (let i = 0; i < fullStars; i++) {
        html += '<i class="fas fa-star" style="color: #ffc107;"></i>';
      }
      if (hasHalfStar) {
        html += '<i class="fas fa-star-half-alt" style="color: #ffc107;"></i>';
      }
      for (let i = 0; i < emptyStars; i++) {
        html += '<i class="far fa-star" style="color: #ffc107;"></i>';
      }
      html += ` <span style="color: rgba(255,255,255,0.7);">(${clampedRating.toFixed(1)})</span>`;
      return html;
    },

    renderDescriptionTab: function(game) {
      const categories = game.categories ? game.categories.split(',').map(c => c.trim()) : [];

      const descriptionHtml = `
        ${categories.length > 0 ? `
          <div class="game-tags">
            ${this.renderCategoryTags(categories)}
          </div>
        ` : ''}

        <div class="tab-section">
          <h4>Game Description</h4>
          ${game.description ? `
            <p>${game.description}</p>
          ` : `
            <p style="color: rgba(255,255,255,0.6);">No description available.</p>
          `}

          ${game.developer ? `
            <h5>Developer:</h5>
            <p><strong>${game.developer}</strong></p>
          ` : ''}

          ${game.release_date ? `
            <h5>Release Date:</h5>
            <p>${this.formatDate(game.release_date)}</p>
          ` : ''}
        </div>
      `;

      $('#description').html(descriptionHtml);
    },

    renderCategoryTags: function(categories) {
      // All categories now use the same purple styling
      return categories.map(category => {
        return `<span class="tag tag-category-dynamic">${category}</span>`;
      }).join('');
    },

    renderRequirementsTab: function(game) {
      const hasDetailedReqs = game.system_requirements_detailed &&
                              (game.system_requirements_detailed.minimum ||
                               game.system_requirements_detailed.recommended);

      let requirementsHtml = `<div class="tab-section"><h4>System Requirements</h4>`;

      if (hasDetailedReqs) {
        const minimum = game.system_requirements_detailed.minimum;
        const recommended = game.system_requirements_detailed.recommended;

        requirementsHtml += `<div class="requirements-container">`;

        if (minimum) {
          requirementsHtml += `
            <div class="requirement-box minimum">
              <h5><i class="fas fa-desktop"></i> Minimum Requirements</h5>
              <ul>
                <li><strong>OS:</strong> ${minimum.os || 'N/A'}</li>
                <li><strong>Processor:</strong> ${minimum.processor || 'N/A'}</li>
                <li><strong>Memory:</strong> ${minimum.memory || 'N/A'}</li>
                <li><strong>Graphics:</strong> ${minimum.graphics || 'N/A'}</li>
                <li><strong>Storage:</strong> ${minimum.storage || 'N/A'}</li>
              </ul>
            </div>
          `;
        }

        if (recommended) {
          requirementsHtml += `
            <div class="requirement-box recommended">
              <h5><i class="fas fa-rocket"></i> Recommended Requirements</h5>
              <ul>
                <li><strong>OS:</strong> ${recommended.os || 'N/A'}</li>
                <li><strong>Processor:</strong> ${recommended.processor || 'N/A'}</li>
                <li><strong>Memory:</strong> ${recommended.memory || 'N/A'}</li>
                <li><strong>Graphics:</strong> ${recommended.graphics || 'N/A'}</li>
                <li><strong>Storage:</strong> ${recommended.storage || 'N/A'}</li>
              </ul>
            </div>
          `;
        }

        requirementsHtml += `</div>`;
      } else if (game.system_requirements) {
        requirementsHtml += `
          <div class="requirements-container">
            <div class="requirement-box minimum" style="grid-column: 1 / -1;">
              <h5>System Requirements</h5>
              <div style="color: rgba(255,255,255,0.8); line-height: 1.8; white-space: pre-line;">
                ${game.system_requirements}
              </div>
            </div>
          </div>
        `;
      } else {
        requirementsHtml += `
          <p style="color: rgba(255,255,255,0.6); text-align: center; padding: 40px;">
            <i class="fas fa-info-circle fa-2x mb-3" style="display: block;"></i>
            System requirements not available for this game.
          </p>
        `;
      }

      requirementsHtml += `</div>`;
      $('#requirements').html(requirementsHtml);
    },

    renderScreenshotsTab: function(game) {
      $('#screenshots').html(`
        <div class="tab-section">
          <h4>Screenshots</h4>
          <div id="screenshots-grid" class="screenshots-grid">
            <div class="text-center p-5">
              <i class="fas fa-spinner fa-spin fa-2x" style="color: #cbbb08;"></i>
              <p style="color: #cbbb08; margin-top: 15px;">Loading screenshots...</p>
            </div>
          </div>
        </div>
      `);

      $.ajax({
        url: 'backend/api/games/get_game_images.php',
        method: 'GET',
        data: { game_id: game.id },
        dataType: 'json',
        success: (response) => {
          if (response.success && response.screenshots && response.screenshots.length > 0) {
            const screenshotsHtml = response.screenshots.map((screenshot, index) => `
              <div class="screenshot-item">
                <img src="${screenshot.image_url}" alt="Screenshot ${index + 1}" />
                <p>${screenshot.caption || `Screenshot ${index + 1}`}</p>
              </div>
            `).join('');
            $('#screenshots-grid').html(screenshotsHtml);
          } else {
            $('#screenshots-grid').html(`
              <p style="color: rgba(255,255,255,0.6); text-align: center; padding: 40px;">
                <i class="fas fa-image fa-3x mb-3" style="display: block; color: rgba(203,187,8,0.3);"></i>
                No screenshots available for this game.
              </p>
            `);
          }
        },
        error: () => {
          $('#screenshots-grid').html(`
            <p style="color: rgba(255,255,255,0.6); text-align: center; padding: 40px;">
              <i class="fas fa-exclamation-triangle fa-2x mb-3" style="display: block; color: #dc3545;"></i>
              Failed to load screenshots.
            </p>
          `);
        }
      });
    },

    loadRelatedGames: function() {
      const categories = this.gameData.categories ? this.gameData.categories.split(',')[0].trim() : '';

      if (!categories) {
        $('.related-games').hide();
        return;
      }

      $.ajax({
        url: 'backend/api/games/get_games.php',
        method: 'GET',
        data: {
          categories: categories,
          limit: 4,
          active_only: true
        },
        dataType: 'json',
        success: (response) => {
          if (response.success && response.games.length > 0) {
            const relatedGames = response.games.filter(g => g.id != this.gameId).slice(0, 3);
            if (relatedGames.length > 0) {
              this.renderRelatedGames(relatedGames);
              $('.related-games').show();
            } else {
              $('.related-games').hide();
            }
          } else {
            $('.related-games').hide();
          }
        },
        error: (xhr, status, error) => {
          console.error('Error loading related games:', error);
          $('.related-games').hide();
        }
      });
    },

    renderRelatedGames: function(games) {
      let html = '<div class="row g-2">';

      games.forEach(game => {
        html += this.createRelatedGameCard(game);
      });

      html += '</div>';
      $('.related-games .row').html(html);

      // Ensure related hearts match wishlist state
      this.applyWishlistStateToButtons($('.related-games'));

      this.initializePopovers();
    },

    createRelatedGameCard: function(game) {
      const price = parseFloat(game.price).toFixed(2);
      const carouselId = `carousel-related-${game.id}`;
      const popoverContent = this.createPopoverContent(game, carouselId);

      return `
        <div class="col-lg-3 col-md-4 col-sm-6">
          <div class="steam-game-card"
               data-game-id="${game.id}"
               data-carousel-id="${carouselId}"
               data-bs-toggle="popover"
               data-bs-trigger="hover focus"
               data-bs-placement="top"
               data-bs-html="true"
               data-bs-content='${popoverContent.replace(/'/g, "&#39;")}'>

            <div class="steam-card-image">
              ${game.cover_image ? `
                <img src="${game.cover_image}" alt="${game.title}">
              ` : `
                <div class="steam-card-placeholder">
                  <i class="fas fa-gamepad"></i>
                </div>
              `}
            </div>
            <div class="steam-card-info">
              <h6 class="steam-card-title">${game.title}</h6>
              <div class="steam-card-meta">
                <div class="steam-rating">
                  <i class="fas fa-star"></i>
                  <span>${game.rating || 'N/A'}</span>
                </div>
                <div class="steam-price">RM${price}</div>
              </div>
              ${this.createActionButtons(game)}
            </div>
          </div>
        </div>
      `;
    },

    createActionButtons: function(game) {
      const id = String(game.id ?? '').trim();
      const title = String(game.title ?? 'Game');
      const categories = String(game.categories ?? '');
      const price = Number(game.price ?? 0);

      const isFav = id && this.wishlistIds.has(id);
      const heartStyle = isFav ? 'fas' : 'far';
      const activeClass = isFav ? 'active' : '';

      return `
        <div class="card-action-buttons">
          <button
            class="btn-card-action btn-add-cart"
            type="button"
            title="Add to Cart"
            data-id="${id}"
            data-title="${this.escapeAttr ? this.escapeAttr(title) : title}"
            data-category="${this.escapeAttr ? this.escapeAttr(categories) : categories}"
            data-price="${String(Number.isFinite(price) ? price : 0)}"
            data-icon="fas fa-gamepad"
          >
            <i class="fas fa-cart-plus"></i>
          </button>

          <button
            class="btn-card-action btn-favorite ${activeClass}"
            type="button"
            title="Add to Wishlist"
            data-game-id="${id}"
          >
            <i class="${heartStyle} fa-heart"></i>
          </button>

          <button class="btn-card-action btn-buy-now" type="button" data-game-id="${id}">
            <i class="fas fa-shopping-bag"></i> Buy Now
          </button>
        </div>
      `;
    },

    createPopoverContent: function(game, carouselId) {
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
            <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">${game.developer || 'Unknown'}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #cbbb08; font-size: 0.85rem;">Release Date:</strong>
            <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">${formattedDate}</span>
          </div>
          <div style="margin-bottom: 12px;">
            <strong style="color: #cbbb08; font-size: 0.85rem;">Rating:</strong>
            <span style="color: rgba(255, 255, 255, 0.9); margin-left: 6px; font-size: 0.85rem;">
              <i class="fas fa-star" style="color: #cbbb08;"></i> ${game.rating || 'N/A'}
            </span>
          </div>
          ${game.description ? `
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(203, 187, 8, 0.2);">
              <strong style="color: #cbbb08; display: block; margin-bottom: 6px; font-size: 0.85rem;">Description:</strong>
              <p style="color: rgba(255, 255, 255, 0.8); font-size: 0.8rem; margin: 0; line-height: 1.4;">
                ${game.description.substring(0, 150)}${game.description.length > 150 ? '...' : ''}
              </p>
            </div>
          ` : ''}
        </div>
      `;
    },

    initializePopovers: function() {
      const popoverTriggerList = document.querySelectorAll('.related-games [data-bs-toggle="popover"]');
      [...popoverTriggerList].forEach(popoverTriggerEl => {
        const popover = new bootstrap.Popover(popoverTriggerEl, {
          container: 'body',
          customClass: 'steam-popover'
        });

        popoverTriggerEl.addEventListener('shown.bs.popover', function() {
          const gameId = this.getAttribute('data-game-id');
          const carouselId = this.getAttribute('data-carousel-id');
          ItemPage.loadScreenshotsIntoCarousel(gameId, carouselId);
        });
      });
    },

    loadScreenshotsIntoCarousel: function(gameId, carouselId) {
      $.ajax({
        url: 'backend/api/games/get_game_images.php',
        method: 'GET',
        data: { game_id: gameId },
        dataType: 'json',
        success: (response) => {
          const carouselElement = document.getElementById(carouselId);
          const carouselInner = $(`#${carouselId} .carousel-inner`);

          if (response.success && response.screenshots.length > 0) {
            carouselInner.empty();

            response.screenshots.forEach((screenshot, index) => {
              const isActive = index === 0 ? 'active' : '';
              carouselInner.append(`
                <div class="carousel-item ${isActive}">
                  <img src="${screenshot.image_url}" class="d-block w-100" alt="Screenshot ${index + 1}"
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
        }
      });
    },

    initializeCarousel: function(carouselElement) {
      if (!carouselElement) return;

      const existingInstance = bootstrap.Carousel.getInstance(carouselElement);
      if (existingInstance) {
        existingInstance.dispose();
      }

      return new bootstrap.Carousel(carouselElement, {
        interval: 2000,
        wrap: true,
        ride: 'carousel'
      });
    },

    addToCart: function() {
      if (!this.gameData) return;

      const payload = {
        id: String(this.gameData.id ?? '').trim(),
        title: String(this.gameData.title ?? 'Game'),
        category: String(this.gameData.categories ?? ''), // IMPORTANT: cart.js expects "category"
        price: Number(this.gameData.price ?? 0),
        icon: 'fas fa-gamepad'
      };

      if (!payload.id) return;

      if (window.ByteArenaCart && typeof window.ByteArenaCart.addItem === 'function') {
        window.ByteArenaCart.addItem(payload);
      }
    },

    buyNow: function() {
      console.log('Buy now:', this.gameId);
      alert(`Proceeding to checkout for "${this.gameData.title}"... (Feature coming soon)`);
    },

    toggleWishlist: function(gameId, btn) {
      const idStr = String(gameId ?? '').trim();
      if (!idStr || !btn || !btn.length) return;

      btn.prop('disabled', true);

      $.ajax({
        url: 'backend/api/wishlist/toggle_wishlist.php',
        method: 'POST',
        dataType: 'json',
        data: { game_id: idStr },
        success: (res) => {
          if (!res || !res.success) return;

          if (res.action === 'added') {
            this.wishlistIds.add(idStr);
          } else if (res.action === 'removed') {
            this.wishlistIds.delete(idStr);
          }

          // Sync *all* heart buttons for this game (main + related)
          this.setWishlistButtonState(idStr, this.wishlistIds.has(idStr), document);
        },
        error: (xhr) => {
          if (xhr && xhr.status === 401) {
            window.location.href = 'login.php';
          }
        },
        complete: () => {
          btn.prop('disabled', false);
        }
      });
    },

    toggleFavoriteRelated: function(gameId, btn) {
      // Backward-compatible wrapper if anything else calls this
      this.toggleWishlist(gameId, btn);
    },

    openScreenshotModal: function(imageSrc) {
      const modalHtml = `
        <div class="modal fade" id="screenshotModal" tabindex="-1">
          <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content" style="background: rgba(0,0,0,0.95); border: 2px solid #490596;">
              <div class="modal-body p-0">
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"
                        style="position: absolute; top: 20px; right: 20px; z-index: 1000;"></button>
                <img src="${imageSrc}" class="img-fluid w-100" alt="Screenshot">
              </div>
            </div>
          </div>
        </div>
      `;

      $('#screenshotModal').remove();
      $('body').append(modalHtml);
      const modal = new bootstrap.Modal(document.getElementById('screenshotModal'));
      modal.show();

      $('#screenshotModal').on('hidden.bs.modal', function() {
        $(this).remove();
      });
    },

    formatDate: function(dateString) {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    },

    showError: function(message) {
      $('#game-loading').hide();
      $('#game-content').html(`
        <div class="text-center" style="padding: 100px 20px;">
          <i class="fas fa-exclamation-triangle fa-4x mb-4" style="color: #dc3545;"></i>
          <h2 style="color: #fff; margin-bottom: 20px;">Error</h2>
          <p style="color: rgba(255,255,255,0.7); font-size: 1.2rem; margin-bottom: 30px;">
            ${message}
          </p>
          <button class="btn btn-browse" onclick="window.location.href='home.php'" style="background-color: #490596; color: #fff; padding: 12px 30px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            <i class="fas fa-home"></i> Go Back Home
          </button>
        </div>
      `).show();
    },

    // Reviews section methods
    loadReviews: function(gameId) {
      $.ajax({
        url: 'backend/api/reviews/get_reviews.php',
        method: 'GET',
        dataType: 'json',
        data: { game_id: gameId },
        success: (res) => {
          if (!res || !res.success) return;
          this.renderReviews(res);
        }
      });
    },

    renderReviews: function(data) {
      const avg = data?.summary?.avg_rating;
      const total = Number(data?.summary?.total_reviews ?? 0);

      const summaryHtml = `
        <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          <div style="color:#fff; font-weight:700; font-size:1.1rem;">
            Average: <span style="color:#cbbb08;">${avg === null ? '—' : avg.toFixed(1)}/5</span>
          </div>
          <div style="color:rgba(255,255,255,0.7);">
            (${total} review${total === 1 ? '' : 's'})
          </div>
        </div>
      `;
      $('#reviews-summary').html(summaryHtml);

      // Prefill form with my review if exists (edit-in-place)
      const my = data?.my_review;
      if (my) {
        $('#review-rating').val(String(my.rating ?? ''));
        $('#review-title').val(my.title ?? '');
        $('#review-text').val(my.review_text ?? '');
      }

      const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
      if (!reviews.length) {
        $('#reviews-list').html(`<div style="color:rgba(255,255,255,0.65);">No reviews yet. Be the first.</div>`);
        return;
      }

      const listHtml = reviews.map(r => {
        const stars = this.renderStars(Number(r.rating ?? 0));
        const title = (r.title || '').trim();
        const text = (r.review_text || '').trim();
        const who = this.escapeHTML(r.username || 'User');
        const date = this.escapeHTML(r.review_date || '');

        return `
          <div class="card mb-3" style="background-color:#141427; border:1px solid rgba(203,187,8,0.25);">
            <div class="card-body">
              <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                <div>
                  <div style="color:#fff; font-weight:700;">
                    ${who} <span style="color:#cbbb08; font-weight:600;">${stars}</span>
                  </div>
                  <div style="color:rgba(255,255,255,0.55); font-size:0.9rem;">${date}</div>
                </div>
              </div>

              ${title ? `<div style="margin-top:10px; color:#fff; font-weight:600;">${this.escapeHTML(title)}</div>` : ''}
              ${text ? `<div style="margin-top:8px; color:rgba(255,255,255,0.75); white-space:pre-wrap;">${this.escapeHTML(text)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      $('#reviews-list').html(listHtml);
    },

    saveReview: function() {
      const gameId = $('#review-game-id').val();
      const rating = $('#review-rating').val();
      const title = $('#review-title').val();
      const reviewText = $('#review-text').val();

      $('#review-status').text('Saving...');

      $.ajax({
        url: 'backend/api/reviews/save_review.php',
        method: 'POST',
        dataType: 'json',
        data: {
          game_id: gameId,
          rating: rating,
          title: title,
          review_text: reviewText
        },
        success: (res) => {
          if (!res || !res.success) {
            $('#review-status').text(res?.error || 'Failed to save review');
            return;
          }
          $('#review-status').text('Saved.');
          this.loadReviews(gameId);
        },
        error: () => {
          $('#review-status').text('Failed to save review');
        }
      });
    },

    renderStars: function(rating) {
      const n = Math.max(0, Math.min(5, Math.floor(rating)));
      let s = '';
      for (let i = 0; i < 5; i++) s += (i < n) ? '★' : '☆';
      return s;
    },

    // ...existing code...
  };

  $(document).ready(function() {
    ItemPage.init();
  });

  window.ItemPage = ItemPage;

})(jQuery);
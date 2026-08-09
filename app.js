    function drainVisibleImageLoadQueue() {
      const concurrency = getAdaptiveImagePrefetchConcurrency();

      while (imageVisibleLoadActiveCount < concurrency) {
        const next = IMAGE_VISIBLE_LOAD_QUEUE.shift();
        if (!next || !next.img) return;

        const img = next.img;
        if (img.dataset.loaded === '1') {
          try { img.dataset.visibleLoadQueued = '0'; } catch (err) {}
          next.resolve(true);
          continue;
        }

        imageVisibleLoadActiveCount += 1;
        imageVisibleLoadActive = imageVisibleLoadActiveCount > 0;

        loadLazyMediaImage(img).then(function(result) {
          imageVisibleLoadActiveCount = Math.max(0, imageVisibleLoadActiveCount - 1);
          imageVisibleLoadActive = imageVisibleLoadActiveCount > 0;
          try {
            img.dataset.visibleLoadQueued = '0';
          } catch (err) {}
          next.resolve(!!result);
          drainVisibleImageLoadQueue();
        }).catch(function() {
          imageVisibleLoadActiveCount = Math.max(0, imageVisibleLoadActiveCount - 1);
          imageVisibleLoadActive = imageVisibleLoadActiveCount > 0;
          try {
            img.dataset.visibleLoadQueued = '0';
          } catch (err) {}
          next.resolve(false);
          drainVisibleImageLoadQueue();
        });
      }
    }
    function shouldUnloadLazyMediaImage(img) {
      if (!img || img.dataset.loaded !== '1') return false;
      if (!mainContent || !mainContent.getBoundingClientRect || !img.getBoundingClientRect) return false;
      try {
        const rootRect = mainContent.getBoundingClientRect();
        const rect = img.getBoundingClientRect();
        const buffer = shouldReduceAggressivePrefetch() ? 240 : 900;
        return rect.bottom < (rootRect.top - buffer) || rect.top > (rootRect.bottom + buffer) || rect.right < (rootRect.left - buffer) || rect.left > (rootRect.right + buffer);
      } catch (err) {
        return false;
      }
    }
    function shouldReduceAggressivePrefetch() {
      const connection = getConnectionInfo();
      if (!connection) return false;
      const effectiveType = String(connection.effectiveType || '').toLowerCase();
      return !!connection.saveData || effectiveType.indexOf('2g') !== -1 || effectiveType.indexOf('slow-2g') !== -1;
    }

    function getAdaptiveImagePrefetchConcurrency() {
      if (shouldReduceAggressivePrefetch()) return 1;
      const connection = getConnectionInfo();
      const effectiveType = String(connection && connection.effectiveType || '').toLowerCase();
      if (effectiveType.indexOf('4g') !== -1) return 5;
      if (effectiveType.indexOf('3g') !== -1) return 3;
      return 3;
    }

    function getAdaptiveImageObserverMargin() {
      if (shouldReduceAggressivePrefetch()) return '320px 0px 520px 0px';
      const connection = getConnectionInfo();
      const effectiveType = String(connection && connection.effectiveType || '').toLowerCase();
      if (effectiveType.indexOf('4g') !== -1) return '1400px 0px 1800px 0px';
      if (effectiveType.indexOf('3g') !== -1) return '900px 0px 1200px 0px';
      return '1100px 0px 1500px 0px';
    }

    function isImageNearMainViewport(img, extraMarginPx) {
      if (!img || !mainContent || !mainContent.getBoundingClientRect || !img.getBoundingClientRect) return true;
      const margin = Number(extraMarginPx);
      const padding = Number.isFinite(margin) ? Math.max(0, margin) : (shouldReduceAggressivePrefetch() ? 320 : 900);
      try {
        const rootRect = mainContent.getBoundingClientRect();
        const rect = img.getBoundingClientRect();
        return rect.bottom >= (rootRect.top - padding) && rect.top <= (rootRect.bottom + padding) && rect.right >= (rootRect.left - padding) && rect.left <= (rootRect.right + padding);
      } catch (err) {
        return true;
      }
    }
// ============================================================
    //  CONFIGURACIÓN
    // ============================================================
    const firebaseConfig = {
      apiKey: "AIzaSyDGtzAfPtbbOMUUbkiadVFh_JbXE5IpT0w",
      authDomain: "snappix-34d39.firebaseapp.com",
      databaseURL: "https://snappix-34d39-default-rtdb.firebaseio.com",
      projectId: "snappix-34d39",
      storageBucket: "snappix-34d39.firebasestorage.app",
      messagingSenderId: "205291317595",
      appId: "1:205291317595:web:daabfa9535e4658b1a527e",
      measurementId: "G-SKWZ7C22M6"
    };

    const app = firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    const auth = firebase.auth();
    const supportsIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;

    const IMGBB_API_KEY = 'bf9a2b7113c38e05a5bf71072edacaf7';
    const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

    const IMAGE_HOST_HINTS = [
      'https://i.ibb.co',
      'https://raw.githubusercontent.com',
      'https://firebasestorage.googleapis.com',
      'https://storage.googleapis.com'
    ];
    const IMAGE_PRECONNECT_CACHE = new Set();
    const IMAGE_OPTIMIZATION_SKIP_SELECTOR = 'svg, canvas, video, audio, iframe, picture';
    const IMAGE_LOCAL_CACHE_KEY = 'snappix_image_local_cache_v2';
    const IMAGE_DRAFT_CACHE_KEY = 'snappix_selected_images_draft_v2';
    const IMAGE_LOCAL_CACHE_LIMIT = 80;
    const IMAGE_DRAFT_LIMIT = 12;
    let imageOptimizationObserver = null;
    let imageLocalCache = loadImageLocalCache();
    let imageLocalCacheSaveTimer = null;
    const TRANSPARENT_PLACEHOLDER_SRC = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>');

    function sanitizeRenderableImageUrl(url) {
      if (!url) return null;
      const value = String(url).trim();
      return isGifImageUrl(value) ? null : value;
    }

    function neutralizeGifImageElement(img) {
      if (!img || !img.getAttribute) return false;
      const src = img.getAttribute('src') || img.dataset.lazySrc || img.dataset.src || '';
      const srcset = img.getAttribute('srcset') || img.dataset.lazySrcset || img.dataset.srcset || '';
      if (!isGifImageUrl(src || srcset)) return false;

      try {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.dataset.lazySrc = '';
        img.dataset.lazySrcset = '';
        img.dataset.src = '';
        img.dataset.srcset = '';
        img.dataset.mediaKind = 'blocked';
        img.dataset.loaded = '0';
        img.dataset.loading = '0';
        img.alt = img.alt || 'Imagen bloqueada';
        img.src = TRANSPARENT_PLACEHOLDER_SRC;
        img.classList.add('gif-blocked');
        if (img.parentElement) {
          img.parentElement.classList.add('blocked-gif');
        }
      } catch (err) {}
      return true;
    }

    function isGifImageUrl(url) {
      if (!url) return false;
      const value = String(url).trim().toLowerCase();
      return value.indexOf('data:image/gif') === 0 || /\.gif(?:$|[?#])/i.test(value);
    }

    function loadJsonFromStorage(storageKey, fallbackValue) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return fallbackValue;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallbackValue;
      } catch (err) {
        return fallbackValue;
      }
    }

    function saveJsonToStorage(storageKey, value) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
        return true;
      } catch (err) {
        return false;
      }
    }

    function loadImageLocalCache() {
      const cached = loadJsonFromStorage(IMAGE_LOCAL_CACHE_KEY, null);
      if (!cached) return Object.create(null);

      const cleaned = Object.create(null);
      const keys = Object.keys(cached).sort(function(a, b) {
        const aTs = Number(cached[a] && cached[a].ts) || 0;
        const bTs = Number(cached[b] && cached[b].ts) || 0;
        return bTs - aTs;
      });

      keys.slice(0, IMAGE_LOCAL_CACHE_LIMIT).forEach(function(url) {
        if (!url || isGifImageUrl(url)) return;
        const entry = cached[url];
        if (!entry || typeof entry !== 'object') return;
        cleaned[url] = {
          ts: Number(entry.ts) || Date.now(),
          type: 'image',
          hits: Number(entry.hits) || 0
        };
      });

      return cleaned;
    }

    function persistImageLocalCacheSoon() {
      if (imageLocalCacheSaveTimer) return;
      imageLocalCacheSaveTimer = setTimeout(function() {
        imageLocalCacheSaveTimer = null;
        const entries = Object.keys(imageLocalCache).map(function(url) {
          return [url, imageLocalCache[url]];
        }).filter(function(pair) {
          return pair && pair[0] && !isGifImageUrl(pair[0]);
        }).sort(function(a, b) {
          const aTs = Number(a[1] && a[1].ts) || 0;
          const bTs = Number(b[1] && b[1].ts) || 0;
          return bTs - aTs;
        }).slice(0, IMAGE_LOCAL_CACHE_LIMIT);

        const payload = {};
        entries.forEach(function(pair) {
          payload[pair[0]] = {
            ts: Number(pair[1] && pair[1].ts) || Date.now(),
            type: 'image',
            hits: Number(pair[1] && pair[1].hits) || 0
          };
        });

        saveJsonToStorage(IMAGE_LOCAL_CACHE_KEY, payload);
      }, 250);
    }

    function rememberImageUrlInLocalCache(url, explicitType) {
      if (!url || isGifImageUrl(url)) return;
      const key = String(url);
      const prev = imageLocalCache[key] || {};
      imageLocalCache[key] = {
        ts: Date.now(),
        type: 'image',
        hits: (Number(prev.hits) || 0) + 1
      };
      persistImageLocalCacheSoon();
    }

    function wasImageSeenLocally(url) {
      if (!url) return false;
      return !!imageLocalCache[String(url)];
    }

    function loadSelectedImagesDraft() {
      const draft = loadJsonFromStorage(IMAGE_DRAFT_CACHE_KEY, null);
      if (!draft) return [];
      const images = Array.isArray(draft.images) ? draft.images : [];
      return images.filter(function(item) {
        return typeof item === 'string' && item && sanitizeRenderableImageUrl(item);
      }).slice(0, IMAGE_DRAFT_LIMIT);
    }

    function persistSelectedImagesDraft(imagesData) {
      const images = Array.isArray(imagesData) ? imagesData.filter(function(item) {
        return typeof item === 'string' && item && sanitizeRenderableImageUrl(item);
      }) : [];

      const capped = images.slice(0, IMAGE_DRAFT_LIMIT);
      const totalLength = capped.reduce(function(total, value) {
        return total + String(value).length;
      }, 0);

      const payload = {
        updatedAt: Date.now(),
        images: capped,
        count: capped.length,
        totalLength: totalLength
      };

      saveJsonToStorage(IMAGE_DRAFT_CACHE_KEY, payload);
      capped.forEach(function(value) {
        rememberImageUrlInLocalCache(value, 'image');
      });
    }

    function clearSelectedImagesDraft() {
      try {
        localStorage.removeItem(IMAGE_DRAFT_CACHE_KEY);
      } catch (err) {}
    }

    function getImagePriorityForUrl(url, currentPriority) {
      if (currentPriority) return currentPriority;
      if (wasImageSeenLocally(url)) return 'low';
      return 'auto';
    }

    function getImagePriorityForElement(img, explicitPriority) {
      if (!img || !img.closest) {
        return explicitPriority || 'auto';
      }

      const src = img.getAttribute('src') || img.dataset.lazySrc || img.dataset.src || '';
      const srcset = img.getAttribute('srcset') || img.dataset.lazySrcset || img.dataset.srcset || '';
      const priorityHint = explicitPriority || img.dataset.imagePriority || '';

      let priority = getImagePriorityForUrl(src, priorityHint);
      if ((!priority || priority === 'auto') && srcset) {
        const firstCandidate = srcset.split(',')[0];
        if (firstCandidate) {
          priority = getImagePriorityForUrl(firstCandidate.trim().split(' ')[0], priorityHint);
        }
      }

      if (img.closest('.carousel-slide')) {
        const slide = img.closest('.carousel-slide');
        const card = slide.closest('.post-card');
        if (card && card.querySelector('.carousel-slide') === slide) return 'high';
        return priority === 'auto' ? 'low' : priority;
      }

      if (img.closest('.login-view') || img.closest('.download-overlay') || img.closest('.upload-item-overlay')) {
        return 'high';
      }

      if (img.closest('.chat-message-avatar') || img.closest('.post-profile-avatar') || img.closest('.post-author-name-row')) {
        return 'low';
      }

      if (img.closest('.search-results') || img.closest('.shop-view') || img.closest('.profile-view')) {
        return priority === 'auto' ? 'low' : priority;
      }

      return priority || 'auto';
    }

    function getConnectionInfo() {
      try {
        return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
      } catch (err) {
        return null;
      }
    }

    function shouldReduceAggressivePrefetch() {
      const connection = getConnectionInfo();
      if (!connection) return false;
      const effectiveType = String(connection.effectiveType || '').toLowerCase();
      return !!connection.saveData || effectiveType.indexOf('2g') !== -1 || effectiveType.indexOf('slow-2g') !== -1;
    }

    function getImageOrigin(url) {
      if (!url) return null;
      try {
        return new URL(String(url), window.location.href).origin;
      } catch (err) {
        return null;
      }
    }

    function registerImageOriginHint(url) {
      const origin = getImageOrigin(url);
      if (!origin || IMAGE_PRECONNECT_CACHE.has(origin)) return;
      IMAGE_PRECONNECT_CACHE.add(origin);

      try {
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = origin;
        preconnect.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect);
      } catch (err) {}

      try {
        const dns = document.createElement('link');
        dns.rel = 'dns-prefetch';
        dns.href = origin;
        document.head.appendChild(dns);
      } catch (err) {}
    }

    function isOptimizableImageElement(img) {
      return !!img && img.tagName === 'IMG' && !img.closest(IMAGE_OPTIMIZATION_SKIP_SELECTOR);
    }

    function optimizeImageElement(img, options) {
      if (!isOptimizableImageElement(img)) return;
      if (neutralizeGifImageElement(img)) return;
      if (img.dataset.imageOptimized === '1') return;

      const settings = options || {};
      const currentLoading = (img.getAttribute('loading') || '').toLowerCase();
      const currentDecoding = (img.getAttribute('decoding') || '').toLowerCase();
      const priority = getImagePriorityForElement(img, settings.priority);

      if (!currentLoading) {
        img.setAttribute('loading', priority === 'high' ? 'eager' : 'lazy');
      }

      if (!currentDecoding) {
        img.setAttribute('decoding', 'async');
      }

      if ('fetchPriority' in img) {
        try {
          if (priority === 'high') {
            img.fetchPriority = 'high';
          } else if (priority === 'low') {
            img.fetchPriority = 'low';
          } else if (!img.fetchPriority) {
            img.fetchPriority = shouldReduceAggressivePrefetch() ? 'low' : 'auto';
          }
        } catch (err) {}
      }

      const src = img.getAttribute('src');
      const lazySrc = img.dataset.lazySrc || img.dataset.src || '';
      const srcset = img.getAttribute('srcset') || img.dataset.lazySrcset || img.dataset.srcset || '';
      const imageTypeHint = 'image';

      if (src) registerImageOriginHint(src);
      if (lazySrc) registerImageOriginHint(lazySrc);
      if (srcset) {
        const firstCandidate = srcset.split(',')[0];
        if (firstCandidate) {
          registerImageOriginHint(firstCandidate.trim().split(' ')[0]);
        }
      }

      if (!img.hasAttribute('referrerpolicy')) {
        img.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      }

      rememberImageUrlInLocalCache(src || lazySrc || (srcset ? srcset.split(',')[0].trim().split(' ')[0] : ''), imageTypeHint);
      img.dataset.imageOptimized = '1';
    }

    function optimizeImagesInContainer(root, options) {
      if (!root) return;
      const scope = root.querySelectorAll ? root : document;
      const imgs = scope.querySelectorAll ? scope.querySelectorAll('img') : [];
      imgs.forEach(function(img) {
        optimizeImageElement(img, options);
      });
    }

    function setupGlobalImageOptimizer() {
      imageLocalCache = loadImageLocalCache();
      optimizeImagesInContainer(document);
      bindImageRecoveryEvents();
      scheduleImageRecoveryScan(document, true);

      if (imageOptimizationObserver) {
        imageOptimizationObserver.disconnect();
        imageOptimizationObserver = null;
      }

      if (!('MutationObserver' in window)) return;

      imageOptimizationObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (!node || node.nodeType !== 1) return;
            if (node.tagName === 'IMG') {
              if (neutralizeGifImageElement(node)) {
                scheduleImageRecoveryScan(node.parentNode || document, false);
                return;
              }
              optimizeImageElement(node);
              scheduleImageRecoveryScan(node.parentNode || document, false);
              return;
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('img').forEach(function(img) {
                optimizeImageElement(img);
              });
              scheduleImageRecoveryScan(node, false);
            }
          });
        });
      });

      try {
        imageOptimizationObserver.observe(document.body, { childList: true, subtree: true });
      } catch (err) {}
    }

    const IMAGE_RECOVERY_SCAN_DELAY = 160;
    let imageRecoveryScanTimer = null;
    let imageRecoveryScanBound = false;

    function getPendingLazyImages(root) {
      const scope = root && root.querySelectorAll ? root : document;
      if (!scope || !scope.querySelectorAll) return [];
      return Array.prototype.slice.call(scope.querySelectorAll('img[data-lazy-src]:not([data-loaded="1"]), img[data-lazy-srcset]:not([data-loaded="1"]), img[data-src]:not([data-loaded="1"]), img[data-srcset]:not([data-loaded="1"])'));
    }

    function rescuePendingLazyImages(root, forceAll) {
      const scope = root && root.querySelectorAll ? root : document;
      const pending = getPendingLazyImages(scope);
      if (!pending.length) return 0;

      let loadedCount = 0;
      pending.forEach(function(img) {
        if (!img) return;
        const sourceUrl = img.dataset.lazySrc || img.dataset.src || img.getAttribute('src') || '';
        const sourceSet = img.dataset.lazySrcset || img.dataset.srcset || img.getAttribute('srcset') || '';
        const isGif = isGifImageUrl(sourceUrl || sourceSet);

        if (isGif) {
          try { img.loading = 'lazy'; } catch (err) {}
          try { img.fetchPriority = 'low'; } catch (err) {}
        }

        if (img.dataset.loaded === '1') return;
        if (img.dataset.loading === '1' && !forceAll) return;

        if (genericLazyImageObserver) {
          try {
            genericLazyImageObserver.observe(img);
          } catch (err) {}
        }

        if (!genericLazyImageObserver || forceAll) {
          loadLazyMediaImage(img).then(function(success) {
            if (success) loadedCount += 1;
          });
        }
      });

      return pending.length;
    }

    function scheduleImageRecoveryScan(root, immediate) {
      const targetRoot = root || document;
      if (!targetRoot) return;
      if (immediate) {
        rescuePendingLazyImages(targetRoot, true);
        return;
      }
      if (imageRecoveryScanTimer) return;
      imageRecoveryScanTimer = setTimeout(function() {
        imageRecoveryScanTimer = null;
        rescuePendingLazyImages(targetRoot, false);
      }, IMAGE_RECOVERY_SCAN_DELAY);
    }

    function bindImageRecoveryEvents() {
      if (imageRecoveryScanBound) return;
      imageRecoveryScanBound = true;

      const scheduleFromEvent = function() {
        scheduleImageRecoveryScan(mainContent, false);
        if (!supportsIntersectionObserver) {
          scheduleVisibleMediaRefresh(mainContent, false);
        }
      };

      if (mainContent) {
        mainContent.addEventListener('scroll', scheduleFromEvent, { passive: true });
      }
      window.addEventListener('resize', scheduleFromEvent, { passive: true });
      window.addEventListener('orientationchange', function() {
        scheduleImageRecoveryScan(mainContent, true);
        if (!supportsIntersectionObserver) {
          scheduleVisibleMediaRefresh(mainContent, true);
        }
      });
      document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
          scheduleImageRecoveryScan(mainContent, true);
          if (!supportsIntersectionObserver) {
            scheduleVisibleMediaRefresh(mainContent, true);
          }
        }
      });
    }

    const IMAGE_VISIBILITY_REFRESH_DELAY = 120;
    let imageVisibilityRefreshTimer = null;

    function scheduleVisibleMediaRefresh(root, immediate) {
      if (!root) return;
      if (immediate) {
        refreshVisibleMediaState(root);
        return;
      }
      if (imageVisibilityRefreshTimer) return;
      imageVisibilityRefreshTimer = setTimeout(function() {
        imageVisibilityRefreshTimer = null;
        refreshVisibleMediaState(root);
      }, IMAGE_VISIBILITY_REFRESH_DELAY);
    }

    function refreshVisibleMediaState(root) {
      const scope = root && root.querySelectorAll ? root : document;
      const images = Array.prototype.slice.call(scope.querySelectorAll('img[data-lazy-src], img[data-lazy-srcset], img[data-src], img[data-srcset]'));
      images.forEach(function(img) {
        if (!img) return;
        if (shouldUnloadLazyMediaImage(img)) {
          unloadLazyMediaImage(img);
        } else if (isImageWithinMainViewport(img)) {
          enqueueVisibleImageLoad(img);
        }
      });
    }

    function isImageWithinMainViewport(img) {
      if (!img || !mainContent || !mainContent.getBoundingClientRect || !img.getBoundingClientRect) return true;
      try {
        const rootRect = mainContent.getBoundingClientRect();
        const rect = img.getBoundingClientRect();
        return rect.bottom >= rootRect.top && rect.top <= rootRect.bottom && rect.right >= rootRect.left && rect.left <= rootRect.right;
      } catch (err) {
        return true;
      }
    }

    // ============================================================
    //  ESTADO GLOBAL
    // ============================================================
    let posts = [];
    let profileData = {
      name: '',
      bio: '',
      avatar: null,
      verifiedSticker: null,
      likedPosts: [],
      followers: {},
      following: {},
      coins: 0,
      purchasedItems: [],
      selectedFrame: null,
      selectedParticles: null,
      selectedVerifiedSticker: null,
      rewardedPosts: {}  // { postId: { liked: true, commented: true } }
    };
    let currentUserId = null;

    let editAvatarFile = null;
    let editAvatarPreview = null;
    let editVerifiedSticker = null;
    let editOriginalSelectedFrame = null;
    const VERIFIED_STICKER_OPTIONS = [
      'https://i.ibb.co/Y7Y2pffJ/facebook-verificado.png',
      'https://i.ibb.co/3ymgbjWk/fba73c0a-e6b4-4ff4-845a-efc9ebf2ed84.png'
    ];

    function getShopItemById(itemId) {
      if (!itemId || !Array.isArray(userShopItems)) return null;
      return userShopItems.find(function(item) {
        return item.id === itemId;
      }) || null;
    }

    function getShopItemImageUrl(itemId, category) {
      const item = getShopItemById(itemId);
      if (!item) return null;
      if (category && item.category !== category) return null;
      return sanitizeRenderableImageUrl(item.imageUrl || null);
    }

    function sortItemsNewestFirst(items) {
      return (Array.isArray(items) ? items.slice() : []).sort(function(a, b) {
        const diff = (Number(b && b.timestamp) || 0) - (Number(a && a.timestamp) || 0);
        if (diff !== 0) return diff;
        return String(b && b.id || '').localeCompare(String(a && a.id || ''));
      });
    }

    function getResolvedProfileAvatar(userData) {
      if (!userData) return null;
      return getShopItemImageUrl(userData.selectedFrame, 'profileFrames') || sanitizeRenderableImageUrl(userData.avatar) || null;
    }

    function getLoadedShopItemIdSet() {
      const ids = new Set();
      if (!Array.isArray(userShopItems)) return ids;
      userShopItems.forEach(function(item) {
        if (item && item.id) ids.add(String(item.id));
      });
      return ids;
    }

    function pruneProfileAgainstLoadedShop(profile, uid) {
      if (!profile || typeof profile !== 'object') {
        return { changed: false, profile: profile, updates: {} };
      }

      const cleaned = { ...profile };
      const updates = {};
      let changed = false;

      const safeAvatar = sanitizeRenderableImageUrl(cleaned.avatar);
      if (cleaned.avatar && !safeAvatar) {
        cleaned.avatar = null;
        updates.avatar = null;
        changed = true;
      }

      const shopReady = Array.isArray(userShopItems) && userShopItems.length > 0;
      if (shopReady) {
        const availableIds = getLoadedShopItemIdSet();

        if (Array.isArray(cleaned.purchasedItems)) {
          const filteredPurchased = cleaned.purchasedItems.filter(function(itemId) {
            return availableIds.has(String(itemId));
          });
          if (filteredPurchased.length !== cleaned.purchasedItems.length) {
            cleaned.purchasedItems = filteredPurchased;
            updates.purchasedItems = filteredPurchased;
            changed = true;
          }
        }

        ['selectedFrame', 'selectedParticles', 'selectedVerifiedSticker'].forEach(function(field) {
          if (cleaned[field] && !availableIds.has(String(cleaned[field]))) {
            cleaned[field] = null;
            updates[field] = null;
            changed = true;
          }
        });
      }

      if (uid && changed) {
        database.ref('users/' + uid).update(updates).catch(function(err) {
          console.warn('No se pudo limpiar el perfil ' + uid + ':', err);
        });
      }

      return { changed: changed, profile: cleaned, updates: updates };
    }

    function pruneAllLoadedProfilesAgainstShop() {
      if (!Array.isArray(userShopItems) || userShopItems.length === 0) return;
      if (profileData && currentUserId) {
        const currentResult = pruneProfileAgainstLoadedShop(profileData, currentUserId);
        profileData = currentResult.profile;
        if (userProfiles[currentUserId]) {
          userProfiles[currentUserId] = { ...userProfiles[currentUserId], ...currentResult.profile };
        }
      }
      Object.keys(userProfiles).forEach(function(uid) {
        const profile = userProfiles[uid];
        if (!profile) return;
        const result = pruneProfileAgainstLoadedShop(profile, uid);
        userProfiles[uid] = result.profile;
      });
    }

    function getResolvedVerifiedSticker(userData) {
      if (!userData) return null;
      const selectedSticker = getShopItemImageUrl(userData.selectedVerifiedSticker, 'verifiedStickers');
      if (selectedSticker) return selectedSticker;
      return sanitizeRenderableImageUrl(userData.verifiedSticker) || null;
    }

    function getResolvedParticleImageUrl(userData) {
      if (!userData) return null;
      return getShopItemImageUrl(userData.selectedParticles, 'particles') || null;
    }

    function getPostImageUrls(post) {
      if (!post) return [];
      if (post.images && Array.isArray(post.images) && post.images.length > 0) {
        return post.images.filter(function(url) { return !!sanitizeRenderableImageUrl(url); });
      }
      if (post.imageUrl) {
        return sanitizeRenderableImageUrl(post.imageUrl) ? [post.imageUrl] : [];
      }
      return [];
    }

    function getDownloadTrackerId() {
      if (currentUserId) return currentUserId;
      try {
        const storageKey = 'snappix_download_tracker_id';
        let trackerId = localStorage.getItem(storageKey);
        if (!trackerId) {
          trackerId = 'anon_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
          localStorage.setItem(storageKey, trackerId);
        }
        return trackerId;
      } catch (err) {
        return 'anon_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
      }
    }

    function getPostDownloadUserCount(post) {
      if (!post) return 0;

      if (post.downloadedBy && typeof post.downloadedBy === 'object') {
        return Object.keys(post.downloadedBy).filter(function(key) {
          return !!post.downloadedBy[key];
        }).length;
      }

      const numericCount = Number(post.downloadCount);
      return Number.isFinite(numericCount) && numericCount > 0 ? Math.floor(numericCount) : 0;
    }

    function updatePostDownloadCountUI(postId, count) {
      if (!postId) return;
      const safeCount = Math.max(0, Number(count) || 0);

      const card = document.querySelector('.post-card[data-post-id="' + postId + '"]');
      if (card) {
        const countEl = card.querySelector('.download-count');
        if (countEl) {
          countEl.textContent = String(safeCount);
        }
        const button = card.querySelector('.download-btn');
        if (button) {
          button.dataset.downloadCount = String(safeCount);
          button.setAttribute('aria-label', 'Abrir menú de descarga. ' + safeCount + ' usuarios han descargado esta publicación');
        }
      }

      const post = posts.find(function(p) { return p && p.id === postId; });
      if (post) {
        post.downloadCount = safeCount;
        if (!post.downloadedBy || typeof post.downloadedBy !== 'object') {
          post.downloadedBy = {};
        }
      }
    }

    function incrementPostDownloadCount(postId) {
      if (!postId) return Promise.resolve(0);

      const trackerId = getDownloadTrackerId();
      const postRef = database.ref('posts/' + postId);

      return new Promise(function(resolve) {
        postRef.transaction(function(post) {
          if (!post) return post;
          if (!post.downloadedBy || typeof post.downloadedBy !== 'object') {
            post.downloadedBy = {};
          }
          post.downloadedBy[trackerId] = true;
          post.downloadCount = Object.keys(post.downloadedBy).filter(function(key) {
            return !!post.downloadedBy[key];
          }).length;
          return post;
        }, function(error, committed, snapshot) {
          if (error) {
            console.warn('Error al registrar la descarga del post ' + postId + ':', error);
            resolve(0);
            return;
          }

          if (!committed || !snapshot || !snapshot.val()) {
            const fallbackPost = posts.find(function(p) { return p && p.id === postId; });
            const fallbackCount = getPostDownloadUserCount(fallbackPost);
            updatePostDownloadCountUI(postId, fallbackCount);
            resolve(fallbackCount);
            return;
          }

          const updatedPost = snapshot.val() || {};
          const updatedCount = getPostDownloadUserCount(updatedPost);
          updatePostDownloadCountUI(postId, updatedCount);
          resolve(updatedCount);
        }, false);
      });
    }

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function getUserDataForUid(uid) {
      if (!uid || uid === 'unknown') return null;
      if (uid === currentUserId) return profileData || null;
      return userProfiles[uid] || null;
    }

    function getUserTotalLikes(uid) {
      if (!uid || uid === 'unknown' || !Array.isArray(posts) || posts.length === 0) return 0;
      return posts.reduce(function(total, post) {
        const postAuthorUid = post && (post.authorUid || post.authorId);
        return postAuthorUid === uid ? total + (post.likes || 0) : total;
      }, 0);
    }

    function getResolvedVerifiedStickerForUid(uid) {
      const userData = getUserDataForUid(uid);
      if (!userData) return null;

      const selectedVerified = getResolvedVerifiedSticker(userData);
      if (userData.selectedVerifiedSticker) {
        return selectedVerified;
      }

      const totalLikes = getUserTotalLikes(uid);
      return (userData.verifiedSticker && totalLikes >= 100) ? userData.verifiedSticker : null;
    }

    function getPostAuthorNameMarkup(authorName, verifiedStickerUrl) {
      const safeAuthorName = escapeHtml(authorName || 'Usuario');
      const safeStickerUrl = verifiedStickerUrl ? String(verifiedStickerUrl) : '';
      return '<div class="post-author-name-row"><div class="post-author-name-text">' + safeAuthorName + '</div>' +
        (safeStickerUrl ? '<span class="post-verified-sticker-badge" title="Usuario verificado"><img src="' + safeStickerUrl + '" alt="Verificado" loading="lazy" decoding="async" /></span>' : '') +
        '</div>';
    }

    function createInlineParticleEffectLayer(particleUrl) {
      if (!particleUrl || isGifImageUrl(particleUrl)) return null;

      const layer = document.createElement('div');
      layer.className = 'post-particle-effect-layer';

      const isImage = /\.(png|jpe?g|webp|svg)(\?|$)/i.test(particleUrl) || particleUrl.indexOf('data:') === 0;
      let html = '';
      for (let i = 0; i < 12; i++) {
        const left = Math.random() * 100;
        const size = 10 + Math.random() * 14;
        const duration = 5 + Math.random() * 4;
        const delay = -(Math.random() * duration);
        const opacity = 0.28 + Math.random() * 0.5;
        const drift = -8 + Math.random() * 16;
        if (isImage) {
          html += `<span class="particle-falling particle-image" style="left:${left}vw; width:${size}px; height:${size}px; animation-duration:${duration}s; animation-delay:${delay}s; opacity:${opacity}; --drift:${drift}vw;"><img src="${particleUrl}" alt="Partícula" loading="lazy" decoding="async" /></span>`;
        } else {
          html += `<span class="particle-falling particle-icon" style="left:${left}vw; width:${size}px; height:${size}px; animation-duration:${duration}s; animation-delay:${delay}s; opacity:${opacity}; --drift:${drift}vw;"><i class="fas fa-sparkles"></i></span>`;
        }
      }

      layer.innerHTML = html;
      return layer;
    }

    function renderParticleEffect(particleUrl) {
      let layer = document.getElementById('particleEffectLayer');
      if (!particleUrl || isGifImageUrl(particleUrl)) {
        if (layer) layer.remove();
        return;
      }
      if (!layer) {
        layer = document.createElement('div');
        layer.id = 'particleEffectLayer';
        layer.className = 'particle-effect-layer';
        document.body.appendChild(layer);
      }
      const isImage = /\.(png|jpe?g|webp|svg)(\?|$)/i.test(particleUrl) || particleUrl.indexOf('data:') === 0;
      let html = '';
      for (let i = 0; i < 18; i++) {
        const left = Math.random() * 100;
        const size = 12 + Math.random() * 16;
        const duration = 5 + Math.random() * 5;
        const delay = -(Math.random() * duration);
        const opacity = 0.35 + Math.random() * 0.55;
        const drift = -10 + Math.random() * 20;
        if (isImage) {
          html += `<span class="particle-falling particle-image" style="left:${left}vw; width:${size}px; height:${size}px; animation-duration:${duration}s; animation-delay:${delay}s; opacity:${opacity}; --drift:${drift}vw;"><img src="${particleUrl}" alt="Partícula" /></span>`;
        } else {
          html += `<span class="particle-falling particle-icon" style="left:${left}vw; width:${size}px; height:${size}px; animation-duration:${duration}s; animation-delay:${delay}s; opacity:${opacity}; --drift:${drift}vw;"><i class="fas fa-sparkles"></i></span>`;
        }
      }
      layer.innerHTML = html;
    }

    function updateParticleEffectForUser(userData) {
      renderParticleEffect(getResolvedParticleImageUrl(userData));
    }

    let selectedImagesData = [];
    let musicList = [];
    let isPlaying = false;
    let currentFeedAudioPostId = null;
    let audioUnlocked = false;
    let feedObserver = null;
    let postMediaObserver = null;
    let genericLazyImageObserver = null;
    let currentCommentPostId = null;
    let commentsScrollLockTop = null;
    let commentsScrollLockActive = false;
    let commentsScrollLockHandler = null;
    let isUpdatingLike = false;

    let postOrder = [];
    let autoPlayAttempted = false;
    let isPostsLoading = true;
    let feedScrollTop = 0;
    let feedRenderCounter = 0;
    let postToDeleteId = null;
    let userProfiles = {};
    let profilesLoaded = false;
    let activeScreen = 'home';
    let feedAutoplayTimer = null;
    let feedMode = localStorage.getItem('snappix_feed_mode') || 'for-you';
    let feedLastSeenTimestamp = parseInt(localStorage.getItem('snappix_recent_last_seen') || '0', 10) || 0;
    let feedFollowingLastSeenTimestamp = parseInt(localStorage.getItem('snappix_following_last_seen') || '0', 10) || 0;
    let feedRecentSeenPostIds = loadStoredIdSet('snappix_recent_seen_posts');
    let feedFollowingSeenPostIds = loadStoredIdSet('snappix_following_seen_posts');
    let mainContentFrozenState = null;

    // CHATS
    let chats = {};
    let currentChatId = null;
    let chatListeners = {};

    // Tienda items de usuarios
    let userShopItems = [];

    // Variables para compra
    let pendingBuyItemId = null;

    const SHOP_BOT_UID = 'shop-bot';
    const SHOP_BOT_NAME = 'Tienda';
    const SHOP_BOT_AVATAR = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#60a5fa" />
            <stop offset="100%" stop-color="#fbbf24" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="32" fill="#111827" />
        <path d="M14 26h36l-3-8H17z" fill="url(#g)" />
        <path d="M17 28h30v6H17z" fill="#e5e7eb" opacity="0.9" />
        <path d="M18 34h28v15a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V34z" fill="none" stroke="url(#g)" stroke-width="3" />
        <rect x="24" y="41" width="16" height="8" rx="2" fill="url(#g)" opacity="0.9" />
      </svg>
    `);

    function getChatParticipantInfo(uid) {
      if (uid === SHOP_BOT_UID) {
        return { name: SHOP_BOT_NAME, avatar: SHOP_BOT_AVATAR };
      }
      const user = userProfiles[uid] || { name: 'Usuario', avatar: null };
      return { ...user, avatar: getResolvedProfileAvatar(user) };
    }

    function loadStoredIdSet(storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter(function(value) {
          return typeof value === 'string' && value;
        }));
      } catch (err) {
        return new Set();
      }
    }

    function persistStoredIdSet(storageKey, idSet) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(idSet || [])));
      } catch (err) {}
    }

    function getFeedStorageSuffix(mode) {
      return mode === 'following' ? 'following' : 'recent';
    }

    function getFeedCheckpointKey(mode) {
      return 'snappix_' + getFeedStorageSuffix(mode) + '_last_seen';
    }

    function getFeedSeenIdsKey(mode) {
      return 'snappix_' + getFeedStorageSuffix(mode) + '_seen_posts';
    }

    function getFeedCheckpointTimestamp(mode) {
      return mode === 'following' ? feedFollowingLastSeenTimestamp : feedLastSeenTimestamp;
    }

    function setFeedCheckpointTimestamp(mode, value) {
      const normalized = Number(value) || 0;
      if (mode === 'following') {
        feedFollowingLastSeenTimestamp = normalized;
      } else {
        feedLastSeenTimestamp = normalized;
      }
      localStorage.setItem(getFeedCheckpointKey(mode), String(normalized));
    }

    function getFeedSeenSet(mode) {
      return mode === 'following' ? feedFollowingSeenPostIds : feedRecentSeenPostIds;
    }

    function persistFeedSeenSet(mode) {
      persistStoredIdSet(getFeedSeenIdsKey(mode), getFeedSeenSet(mode));
    }

    function clearFeedSeenSet(mode) {
      const seenSet = getFeedSeenSet(mode);
      seenSet.clear();
      persistFeedSeenSet(mode);
    }

    function isPostInFollowingFeed(post) {
      if (!post) return false;
      const authorUid = post.authorUid || post.authorId || 'unknown';
      if (!authorUid || authorUid === 'unknown') return false;
      if (authorUid === currentUserId) return true;
      return !!(profileData && profileData.following && profileData.following[authorUid]);
    }

    function getFeedRelevantPosts(mode) {
      const selectedMode = mode || feedMode;
      if (!Array.isArray(posts) || posts.length === 0) return [];
      if (selectedMode === 'recent') {
        return posts.slice();
      }
      if (selectedMode === 'following') {
        const checkpoint = getFeedCheckpointTimestamp('following');
        return posts.filter(function(post) {
          return isPostInFollowingFeed(post) && getPostTimestampValue(post) > checkpoint;
        });
      }
      return posts.slice();
    }

    function getFeedPostsForCurrentMode() {
      if (!Array.isArray(posts) || posts.length === 0) return [];
      if (feedMode === 'recent') {
        return posts.slice();
      }
      if (feedMode === 'following') {
        const checkpoint = getFeedCheckpointTimestamp('following');
        return posts.filter(function(post) {
          return isPostInFollowingFeed(post) && getPostTimestampValue(post) > checkpoint;
        });
      }
      return posts.slice();
    }

    function getNewestRelevantFeedTimestamp(mode) {
      const selectedMode = mode || feedMode;
      const relevantPosts = getFeedRelevantPosts(selectedMode);
      if (relevantPosts.length === 0) return 0;
      return relevantPosts.reduce(function(maxValue, post) {
        const ts = getPostTimestampValue(post);
        return ts > maxValue ? ts : maxValue;
      }, 0);
    }

    function getFeedRemainingCount(mode) {
      const selectedMode = mode || feedMode;
      if (selectedMode === 'for-you') return 0;
      const relevantPosts = getFeedRelevantPosts(selectedMode);
      const seenSet = getFeedSeenSet(selectedMode);
      return relevantPosts.reduce(function(total, post) {
        return total + (seenSet.has(post.id) ? 0 : 1);
      }, 0);
    }

    function updateFeedTerminalCard() {
      const card = document.getElementById('feedTerminalCard');
      if (!card) return;
      const titleEl = card.querySelector('.feed-terminal-title');
      const textEl = card.querySelector('.feed-terminal-text');
      const mode = feedMode;
      if (mode === 'for-you' || mode === 'recent') {
        card.remove();
        return;
      }

      const remaining = getFeedRemainingCount(mode);
      const finished = remaining <= 0;
      const title = finished ? 'Ya estás totalmente al día' : 'Sigue bajando';
      const text = finished
        ? 'No hay más publicaciones nuevas para mostrar en esta sección.'
        : 'Las publicaciones de las cuentas que sigues aparecen aquí.';

      card.hidden = false;
      card.classList.toggle('is-finished', finished);
      if (titleEl) titleEl.textContent = title;
      if (textEl) textEl.textContent = text;
    }

    function markFeedPostAsSeen(postId) {
      if (feedMode !== 'following' && feedMode !== 'recent') return;
      if (!postId) return;

      const relevantPosts = getFeedRelevantPosts(feedMode);
      const relevantPost = relevantPosts.find(function(post) {
        return post.id === postId;
      });
      if (!relevantPost) return;

      const seenSet = getFeedSeenSet(feedMode);
      if (seenSet.has(postId)) return;

      seenSet.add(postId);
      persistFeedSeenSet(feedMode);
      updateFeedTerminalCard();

      const remaining = getFeedRemainingCount(feedMode);
      if (remaining <= 0 && feedMode === 'following') {
        const newestRelevant = getNewestRelevantFeedTimestamp(feedMode);
        if (newestRelevant > 0) {
          setFeedCheckpointTimestamp(feedMode, newestRelevant);
        }
        clearFeedSeenSet(feedMode);
        updateFeedTerminalCard();
      }

      updateRecentPostsBadge();
    }

    // ============================================================
    //  FUNCIONES AUXILIARES
    // ============================================================
    function saveFeedScrollPosition() {
      if (activeScreen === 'home' && document.getElementById('feedContainer')) {
        feedScrollTop = mainContent.scrollTop || 0;
      }
    }

    function restoreFeedScrollPosition(targetScrollTop) {
      const scrollTarget = typeof targetScrollTop === 'number' ? targetScrollTop : (feedScrollTop || 0);
      const previousBehavior = mainContent.style.scrollBehavior;
      mainContent.style.scrollBehavior = 'auto';
      mainContent.scrollTop = scrollTarget;
      requestAnimationFrame(function() {
        mainContent.scrollTop = scrollTarget;
        mainContent.style.scrollBehavior = previousBehavior || '';
      });
      setTimeout(function() {
        mainContent.scrollTop = scrollTarget;
        mainContent.style.scrollBehavior = previousBehavior || '';
      }, 50);
    }

    function lockCommentsFeedPosition(targetScrollTop) {
      const scrollTarget = typeof targetScrollTop === 'number' ? targetScrollTop : (mainContent.scrollTop || feedScrollTop || 0);
      commentsScrollLockTop = scrollTarget;
      commentsScrollLockActive = true;
      body.classList.add('comments-open');
      freezeMainContentAtScroll(scrollTarget);

      if (!commentsScrollLockHandler) {
        commentsScrollLockHandler = function() {
          if (!commentsScrollLockActive || commentsScrollLockTop === null) return;
          if (mainContent.scrollTop !== commentsScrollLockTop) {
            mainContent.scrollTop = commentsScrollLockTop;
          }
        };
      }

      mainContent.addEventListener('scroll', commentsScrollLockHandler, { passive: true });
      const previousBehavior = mainContent.style.scrollBehavior;
      mainContent.style.scrollBehavior = 'auto';
      mainContent.scrollTop = scrollTarget;
      requestAnimationFrame(function() {
        if (commentsScrollLockActive) {
          freezeMainContentAtScroll(scrollTarget);
          mainContent.scrollTop = scrollTarget;
          mainContent.style.scrollBehavior = previousBehavior || '';
        }
      });
    }

    function unlockCommentsFeedPosition(targetScrollTop) {
      const scrollTarget = typeof targetScrollTop === 'number' ? targetScrollTop : (commentsScrollLockTop ?? feedScrollTop ?? 0);
      commentsScrollLockActive = false;
      body.classList.remove('comments-open');

      if (commentsScrollLockHandler) {
        mainContent.removeEventListener('scroll', commentsScrollLockHandler);
      }

      commentsScrollLockTop = null;
      unfreezeMainContent(scrollTarget);
      restoreFeedScrollPosition(scrollTarget);
    }

    function isHomeScreenActive() {
      return activeScreen === 'home' && !!document.getElementById('feedContainer');
    }

    function setActiveScreen(screen) {
      if (screen !== activeScreen) {
        // Guardar posición si salimos de home
        if (activeScreen === 'home') {
          saveFeedScrollPosition();
        }
        activeScreen = screen || 'home';
        if (feedAutoplayTimer) {
          clearTimeout(feedAutoplayTimer);
          feedAutoplayTimer = null;
        }
        if (feedObserver) {
          feedObserver.disconnect();
          feedObserver = null;
        }
        if (activeScreen !== 'home') {
          stopAllMusic();
        }
        body.classList.toggle('feed-mode-visible', activeScreen === 'home');
        mainContent.classList.toggle('search-screen-active', activeScreen === 'search');
        if (feedModeSwitcher) {
          feedModeSwitcher.classList.toggle('hidden', activeScreen !== 'home');
        }
      } else {
        activeScreen = screen || 'home';
        body.classList.toggle('feed-mode-visible', activeScreen === 'home');
        mainContent.classList.toggle('search-screen-active', activeScreen === 'search');
        if (feedModeSwitcher) {
          feedModeSwitcher.classList.toggle('hidden', activeScreen !== 'home');
        }
      }
    }

    function scheduleFeedAutoplay(callback, delayMs) {
      if (feedAutoplayTimer) {
        clearTimeout(feedAutoplayTimer);
        feedAutoplayTimer = null;
      }
      feedAutoplayTimer = setTimeout(function() {
        feedAutoplayTimer = null;
        if (!isHomeScreenActive()) return;
        callback();
      }, typeof delayMs === 'number' ? delayMs : 150);
    }

    function updateViewportMetrics() {
      const viewport = window.visualViewport;
      const viewportHeight = viewport ? viewport.height : window.innerHeight;
      const keyboardOffset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      document.documentElement.style.setProperty('--vv-height', Math.round(viewportHeight) + 'px');
      document.documentElement.style.setProperty('--keyboard-offset', Math.round(keyboardOffset) + 'px');
    }

    function adjustCommentInputForKeyboard(forceFocus) {
      updateViewportMetrics();
      if (commentsOverlay && commentsOverlay.classList.contains('active')) {
        commentsOverlay.style.height = '';
      }
      if (forceFocus && commentInput) {
        requestAnimationFrame(function() {
          try {
            void 0;
          } catch (err) {
            void 0;
          }
        });
      }
    }

    function bindKeyboardViewportEvents() {
      updateViewportMetrics();
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', function() {
          adjustCommentInputForKeyboard(false);
        });
        window.visualViewport.addEventListener('scroll', function() {
          adjustCommentInputForKeyboard(false);
        });
      }
      window.addEventListener('resize', function() {
        adjustCommentInputForKeyboard(false);
      });
      window.addEventListener('orientationchange', function() {
        adjustCommentInputForKeyboard(false);
      });
    }

    function getVisibleFeedPostIds() {
      const container = document.getElementById('feedContainer');
      if (!container) return [];
      return Array.prototype.map.call(container.querySelectorAll('.post-card'), function(card) {
        return card.dataset.postId;
      });
    }

    function isFeedStructureStable() {
      const currentIds = getVisibleFeedPostIds();
      const expectedIds = getFeedPostsForCurrentMode().map(function(post) { return post.id; });
      if (currentIds.length !== expectedIds.length) return false;
      for (let i = 0; i < expectedIds.length; i++) {
        if (currentIds[i] !== expectedIds[i]) return false;
      }
      return true;
    }

    function syncFeedCardsInPlace() {
      const container = document.getElementById('feedContainer');
      if (!container || !isFeedStructureStable()) return false;

      const savedScrollTop = mainContent.scrollTop || 0;
      const feedPosts = getFeedPostsForCurrentMode();

      feedPosts.forEach(function(post) {
        const card = container.querySelector('.post-card[data-post-id="' + post.id + '"]');
        if (!card) return;

        const likeBtn = card.querySelector('.like-btn');
        const likeCount = card.querySelector('.like-count');
        const commentCount = card.querySelector('.comment-count');
        const avatarDiv = card.querySelector('.post-profile-avatar');

        if (likeBtn) {
          likeBtn.classList.toggle('liked', !!post.liked);
        }
        if (likeCount) {
          likeCount.textContent = post.likes || 0;
        }
        if (commentCount) {
          commentCount.textContent = (post.comments && post.comments.length) || 0;
        }
        if (avatarDiv) {
          const authorUid = post.authorUid || post.authorId || 'unknown';
          const authorName = resolvePostAuthorName(post);
          let displayAvatar = null;
          if (authorUid === currentUserId) {
            displayAvatar = getResolvedProfileAvatar(profileData);
          } else if (userProfiles[authorUid]) {
            displayAvatar = getResolvedProfileAvatar(userProfiles[authorUid]);
          }

          let avatarContent = '';
          if (displayAvatar) {
            avatarContent = '<img src="' + displayAvatar + '" alt="Avatar" />';
          } else {
            const initials = authorName.split(' ').map(function(word) { return word[0]; }).join('').toUpperCase().slice(0, 2);
            const hue = Math.abs(authorName.split('').reduce(function(acc, char) {
              return acc + char.charCodeAt(0);
            }, 0) * 137) % 360;
            avatarContent = '<span style="background:hsl(' + hue + ', 70%, 50%); display:flex; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%; font-size:20px; font-weight:600; color:white;">' + (initials || '?') + '</span>';
          }
          avatarDiv.dataset.authorUid = authorUid;
          avatarDiv.innerHTML = avatarContent;
        }

        const authorNameEl = card.querySelector('.post-author-name');
        if (authorNameEl) {
          const authorUid = post.authorUid || post.authorId || 'unknown';
          const authorName = resolvePostAuthorName(post);
          const verifiedStickerUrl = getResolvedVerifiedStickerForUid(authorUid);
          authorNameEl.outerHTML = getPostAuthorNameMarkup(authorName, verifiedStickerUrl);
        }
      });

      restoreFeedScrollPosition(savedScrollTop);
      return true;
    }

    const audioWarmCache = [];
    const audioPreloadCache = {};

    function primeAudioSource(url) {
      if (!url || audioPreloadCache[url]) return;
      audioPreloadCache[url] = true;

      try {
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'preload';
        preloadLink.as = 'audio';
        preloadLink.href = url;
        document.head.appendChild(preloadLink);
      } catch (err) {}

      try {
        const warmAudio = new Audio();
        warmAudio.preload = 'auto';
        warmAudio.src = url;
        warmAudio.load();
        audioWarmCache.push(warmAudio);
        if (audioWarmCache.length > 4) {
          const oldAudio = audioWarmCache.shift();
          if (oldAudio) {
            oldAudio.pause();
            oldAudio.src = '';
          }
        }
      } catch (err) {}
    }

    function warmUpFeedAudioSources() {
      const urls = [];
      const sourcePosts = getFeedPostsForCurrentMode();
      for (let i = 0; i < sourcePosts.length && urls.length < 4; i++) {
        const post = sourcePosts[i];
        if (post && post.musicUrl && urls.indexOf(post.musicUrl) === -1) {
          urls.push(post.musicUrl);
        }
      }
      urls.forEach(function(url) {
        primeAudioSource(url);
      });
      if (globalAudio && !globalAudio.src && urls.length > 0) {
        globalAudio.preload = 'auto';
      }
    }

    const IMAGE_PRELOAD_CACHE = new Map();
    const IMAGE_PREFETCH_QUEUE = [];
    let imagePrefetchScheduled = false;
    const IMAGE_VISIBLE_LOAD_QUEUE = [];
    let imageVisibleLoadActive = false;
    let imageVisibleLoadActiveCount = 0;
    let imageVisibleLoadSequence = 0;

    function preloadImage(url, priority) {
      if (!url) return Promise.resolve(null);
      const normalizedUrl = String(url);
      const isGif = isGifImageUrl(normalizedUrl);
      if (isGif) return Promise.resolve(null);
      registerImageOriginHint(normalizedUrl);
      if (IMAGE_PRELOAD_CACHE.has(normalizedUrl)) {
        return IMAGE_PRELOAD_CACHE.get(normalizedUrl);
      }

      const promise = new Promise(function(resolve) {
        const img = new Image();
        try { img.decoding = 'async'; } catch (err) {}
        try { img.loading = priority === 'high' && !isGif ? 'eager' : 'lazy'; } catch (err) {}
        if ('fetchPriority' in img) {
          try { img.fetchPriority = priority === 'high' && !isGif ? 'high' : 'low'; } catch (err) {}
        }

        img.onload = function() {
          rememberImageUrlInLocalCache(normalizedUrl, isGif ? 'gif' : 'image');
          resolve(normalizedUrl);
        };
        img.onerror = function() {
          resolve(null);
        };

        try {
          img.src = normalizedUrl;
          if (typeof img.decode === 'function') {
            img.decode().then(function() {
              rememberImageUrlInLocalCache(normalizedUrl, isGif ? 'gif' : 'image');
              resolve(normalizedUrl);
            }).catch(function() {
              resolve(normalizedUrl);
            });
          }
        } catch (err) {
          resolve(null);
        }
      });

      IMAGE_PRELOAD_CACHE.set(normalizedUrl, promise);
      return promise;
    }

    function queueImagePrefetch(url, priority) {
      if (!url || IMAGE_PRELOAD_CACHE.has(url)) return;
      const normalizedUrl = String(url);
      const isHighPriority = (priority || 'low') === 'high';

      if (!isHighPriority && !wasImageSeenLocally(normalizedUrl)) {
        return;
      }

      if (shouldReduceAggressivePrefetch() && !isHighPriority) return;
      if (isGifImageUrl(normalizedUrl)) return;

      IMAGE_PREFETCH_QUEUE.push({ url: normalizedUrl, priority: isHighPriority ? 'high' : 'low' });
      if (imagePrefetchScheduled) return;
      imagePrefetchScheduled = true;

      var runQueue = function() {
        imagePrefetchScheduled = false;
        var batch = IMAGE_PREFETCH_QUEUE.splice(0, 1);
        batch.forEach(function(item) {
          preloadImage(item.url, item.priority);
        });
        if (IMAGE_PREFETCH_QUEUE.length > 0) {
          schedulePrefetch();
        }
      };

      function schedulePrefetch() {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(runQueue, { timeout: 500 });
        } else {
          setTimeout(runQueue, 160);
        }
      }

      schedulePrefetch();
    }

    function warmUpPostImages(postList) {
      const source = Array.isArray(postList) ? postList : [];
      const limited = source.slice(0, shouldReduceAggressivePrefetch() ? 1 : 3);

      limited.forEach(function(post, postIndex) {
        const images = getPostImageUrls(post);
        if (!images.length) return;

        images.slice(0, shouldReduceAggressivePrefetch() ? 1 : 2).forEach(function(url, imageIndex) {
          if (!url) return;
          registerImageOriginHint(url);

          if (postIndex === 0 && imageIndex === 0) {
            queueImagePrefetch(url, 'high');
            return;
          }

          if (!shouldReduceAggressivePrefetch() || wasImageSeenLocally(url)) {
            queueImagePrefetch(url, 'low');
          }
        });
      });
    }

    function createLazyMediaShell(url, options) {
      const settings = options || {};
      const shell = document.createElement('div');
      const safeUrl = sanitizeRenderableImageUrl(url);
      shell.className = 'lazy-media-shell' + (settings.fitContain ? ' fit-contain' : '');
      shell.dataset.lazyState = 'idle';
      shell.dataset.mediaKind = safeUrl ? 'image' : 'blocked';

      if (settings.placeholder) {
        shell.dataset.lazyPlaceholder = String(settings.placeholder);
      }
      if (settings.srcset) {
        shell.dataset.lazySrcset = String(settings.srcset);
      }
      if (settings.priority) {
        shell.dataset.imagePriority = String(settings.priority);
      }
      if (settings.sizes) {
        shell.dataset.lazySizes = String(settings.sizes);
      }

      try {
        shell.style.contentVisibility = 'auto';
        shell.style.containIntrinsicSize = '1px 320px';
      } catch (err) {}

      const img = document.createElement('img');
      img.alt = settings.alt || 'Imagen';
      img.dataset.lazySrc = safeUrl || '';
      img.dataset.loaded = '0';
      img.dataset.loading = '0';
      img.dataset.lazyState = 'idle';
      img.dataset.mediaKind = shell.dataset.mediaKind;
      img.decoding = 'async';
      img.loading = safeUrl ? (settings.loading || (settings.priority === 'high' ? 'eager' : 'lazy')) : 'lazy';
      img.src = settings.placeholder || TRANSPARENT_PLACEHOLDER_SRC;
      try { img.fetchPriority = safeUrl ? (settings.priority || 'auto') : 'low'; } catch (err) {}
      try {
        img.style.clipPath = 'inset(0 0 100% 0)';
        img.style.webkitClipPath = 'inset(0 0 100% 0)';
        img.style.transform = 'translateY(8px)';
      } catch (err) {}

      shell.appendChild(img);
      return shell;
    }

    function loadLazyMediaImage(img) {
      if (!img) return Promise.resolve(false);
      const src = img.dataset.lazySrc || img.dataset.src || '';
      const srcset = img.dataset.lazySrcset || img.dataset.srcset || '';
      const sizes = img.dataset.lazySizes || img.dataset.sizes || '';
      const placeholder = img.dataset.lazyPlaceholder || img.dataset.placeholder || img.dataset.lqip || img.dataset.lazyThumb || '';
      const mediaKind = img.dataset.mediaKind || 'image';
      if (src) registerImageOriginHint(src);
      if (!src && !srcset) return Promise.resolve(false);
      if (img.dataset.loaded === '1') return Promise.resolve(true);
      if (img.dataset.loading === '1') {
        return img._lazyLoadPromise || Promise.resolve(false);
      }

      img.dataset.loading = '1';
      const shell = img.closest('.lazy-media-shell') || img.closest('.post-item') || img.closest('.search-post-media') || img.closest('.download-panel .image-item');
      if (shell) {
        shell.classList.remove('failed');
        shell.classList.add('loading');
      }

      const promise = new Promise(function(resolve) {
        let finalSourceRequested = false;

        const finish = function(success) {
          img.dataset.loading = '0';
          img.dataset.loaded = success ? '1' : '0';
          if (shell && shell.classList) {
            shell.classList.toggle('loading', false);
            shell.classList.toggle('loaded', !!success);
            shell.classList.toggle('failed', !success);
          }
          if (success) {
            try {
              requestAnimationFrame(function() {
                try {
                  img.style.clipPath = 'inset(0 0 0 0)';
                  img.style.webkitClipPath = 'inset(0 0 0 0)';
                  img.style.opacity = '1';
                  img.style.transform = 'translateY(0)';
                } catch (err) {}
              });
            } catch (err) {}
          }
          resolve(!!success);
        };

        try {
          img.onload = function() {
            if (!finalSourceRequested) return;
            const cachedSource = src || (srcset ? srcset.split(',')[0].trim().split(' ')[0] : '');
            rememberImageUrlInLocalCache(cachedSource, 'image');
            img.dataset.imageOptimized = '1';
            finish(true);
          };
          img.onerror = function() {
            if (!finalSourceRequested) return;
            finish(false);
          };
          try { img.decoding = 'async'; } catch (err) {}
          try { img.loading = 'eager'; } catch (err) {}
          if ('fetchPriority' in img) {
            try { img.fetchPriority = img.fetchPriority || 'auto'; } catch (err) {}
          }

          const commitSource = function() {
            try {
              finalSourceRequested = true;
              if (srcset) {
                img.srcset = srcset;
              }
              if (sizes) {
                img.sizes = sizes;
              }
              if (src) {
                img.src = src;
              } else if (srcset && !img.src) {
                img.src = TRANSPARENT_PLACEHOLDER_SRC;
              }
            } catch (err) {
              finish(false);
            }
          };

          commitSource();
        } catch (err) {
          finish(false);
        }
      });

      img._lazyLoadPromise = promise;
      return promise;
    }

    

    function estimateLazyImageWeight(img) {
      if (!img) return Number.POSITIVE_INFINITY;
      const shell = img.closest('.lazy-media-shell') || img.closest('.carousel-slide') || img.closest('.post-card') || img.parentElement;
      let area = 240 * 240;
      try {
        if (shell && shell.getBoundingClientRect) {
          const rect = shell.getBoundingClientRect();
          const width = Math.max(1, rect.width || img.clientWidth || 240);
          const height = Math.max(1, rect.height || img.clientHeight || 240);
          area = width * height;
        }
      } catch (err) {}
      let priorityBias = 1;
      const priority = String(img.dataset.imagePriority || (shell && shell.dataset && shell.dataset.imagePriority) || '').toLowerCase();
      if (priority === 'high') priorityBias = 0.72;
      if (priority === 'low') priorityBias = 1.18;
      let verticalBias = 0;
      try {
        const rootRect = mainContent && mainContent.getBoundingClientRect ? mainContent.getBoundingClientRect() : { top: 0 };
        const rect = shell && shell.getBoundingClientRect ? shell.getBoundingClientRect() : { top: 0 };
        verticalBias = Math.max(0, rect.top - rootRect.top);
      } catch (err) {}
      return (area * priorityBias) + verticalBias;
    }

    function unloadLazyMediaImage(img) {
      if (!img) return false;
      const hasSource = !!(img.dataset.lazySrc || img.dataset.src || img.dataset.lazySrcset || img.dataset.srcset);
      if (!hasSource) return false;

      const loadToken = String((parseInt(img.dataset.lazyLoadToken || '0', 10) || 0) + 1);
      img.dataset.lazyLoadToken = loadToken;
      img.dataset.loading = '0';
      img.dataset.loaded = '0';
      img.dataset.visibleLoadQueued = '0';
      img._lazyLoadPromise = null;

      try {
        img.onload = null;
        img.onerror = null;
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.src = img.dataset.lazyPlaceholder || img.dataset.placeholder || img.dataset.lqip || img.dataset.lazyThumb || TRANSPARENT_PLACEHOLDER_SRC;
      } catch (err) {}

      const shell = img.closest('.lazy-media-shell') || img.closest('.post-item') || img.closest('.search-post-media') || img.closest('.download-panel .image-item');
      if (shell && shell.classList) {
        shell.classList.remove('loading', 'loaded');
        shell.classList.add('paused');
      }
      return true;
    }

    function shouldUnloadLazyMediaImage(img) {
      if (!img || img.dataset.loaded !== '1') return false;
      if (!mainContent || !mainContent.getBoundingClientRect || !img.getBoundingClientRect) return false;
      try {
        const rootRect = mainContent.getBoundingClientRect();
        const rect = img.getBoundingClientRect();
        return rect.bottom < rootRect.top || rect.top > rootRect.bottom || rect.right < rootRect.left || rect.left > rootRect.right;
      } catch (err) {
        return false;
      }
    }

        function enqueueVisibleImageLoad(img) {
      if (!img) return Promise.resolve(false);
      if (img.dataset.loaded === '1') return Promise.resolve(true);
      if (img.dataset.visibleLoadQueued === '1') return img._visibleLoadPromise || Promise.resolve(false);

      img.dataset.visibleLoadQueued = '1';
      const weight = estimateLazyImageWeight(img);

      const promise = new Promise(function(resolve) {
        IMAGE_VISIBLE_LOAD_QUEUE.push({ img: img, resolve: resolve, weight: weight, order: ++imageVisibleLoadSequence });
        IMAGE_VISIBLE_LOAD_QUEUE.sort(function(a, b) {
          if (a.weight !== b.weight) return a.weight - b.weight;
          return a.order - b.order;
        });
        drainVisibleImageLoadQueue();
      });

      img._visibleLoadPromise = promise;
      return promise;
    }

        function drainVisibleImageLoadQueue() {
      const concurrency = getAdaptiveImagePrefetchConcurrency();

      while (imageVisibleLoadActiveCount < concurrency) {
        const next = IMAGE_VISIBLE_LOAD_QUEUE.shift();
        if (!next || !next.img) return;

        const img = next.img;
        if (img.dataset.loaded === '1') {
          try { img.dataset.visibleLoadQueued = '0'; } catch (err) {}
          next.resolve(true);
          continue;
        }

        imageVisibleLoadActiveCount++;

        loadLazyMediaImage(img).then(function(result) {
          try {
            img.dataset.visibleLoadQueued = '0';
          } catch (err) {}
          next.resolve(!!result);
        }).catch(function() {
          try {
            img.dataset.visibleLoadQueued = '0';
          } catch (err) {}
          next.resolve(false);
        }).finally(function() {
          imageVisibleLoadActiveCount = Math.max(0, imageVisibleLoadActiveCount - 1);
          drainVisibleImageLoadQueue();
        });
      }
    }

        function loadLazyImagesInContainer(container) {
      if (!container) return;
      const images = container.querySelectorAll('img[data-lazy-src]:not([data-loaded="1"]), img[data-lazy-srcset]:not([data-loaded="1"]), img[data-src]:not([data-loaded="1"]), img[data-srcset]:not([data-loaded="1"])');
      if (!images.length) return;

      images.forEach(function(img) {
        if (genericLazyImageObserver) {
          genericLazyImageObserver.observe(img);
        } else {
          enqueueVisibleImageLoad(img);
        }
      });
    }

        function loadPostCardMediaSequentially(card) {
      if (!card) return Promise.resolve();

      const images = Array.from(card.querySelectorAll('.carousel-slide img[data-lazy-src], .carousel-slide img[data-lazy-srcset], .carousel-slide img[data-src], .carousel-slide img[data-srcset]'));
      if (images.length === 0) return Promise.resolve();

      images.sort(function(a, b) {
        return estimateLazyImageWeight(a) - estimateLazyImageWeight(b);
      });

      // The first visible/primary image gets high priority; the remaining
      // carousel images enter the shared concurrent queue instead of waiting
      // for the previous image to finish.
      images.forEach(function(img, index) {
        if (!img) return;
        const url = img.dataset.lazySrc || img.dataset.src || '';
        if (url && !isGifImageUrl(url)) {
          registerImageOriginHint(url);
          if (index < 2) {
            queueImagePrefetch(url, 'high');
          } else if (!shouldReduceAggressivePrefetch()) {
            queueImagePrefetch(url, 'low');
          }
        }
        enqueueVisibleImageLoad(img);
      });

      return Promise.resolve(true);
    }

        function setupGenericLazyImageObserver() {
      if (genericLazyImageObserver) {
        genericLazyImageObserver.disconnect();
        genericLazyImageObserver = null;
      }

      if (!supportsIntersectionObserver) {
        document.querySelectorAll('img[data-lazy-src]:not([data-loaded="1"]), img[data-lazy-srcset]:not([data-loaded="1"]), img[data-src]:not([data-loaded="1"]), img[data-srcset]:not([data-loaded="1"])').forEach(function(img) {
          enqueueVisibleImageLoad(img);
        });
        scheduleImageRecoveryScan(mainContent, true);
        return;
      }

      genericLazyImageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          const img = entry.target;
          if (entry.isIntersecting) {
            enqueueVisibleImageLoad(img);
          } else {
            if (shouldUnloadLazyMediaImage(img)) {
              unloadLazyMediaImage(img);
            }
          }
        });
      }, {
        root: mainContent,
        rootMargin: getAdaptiveImageObserverMargin(),
        threshold: 0.001
      });
    }

        function setupPostMediaObserver() {
      if (postMediaObserver) {
        postMediaObserver.disconnect();
        postMediaObserver = null;
      }

      const container = document.getElementById('feedContainer');
      if (!container || !isHomeScreenActive()) return;

      if (!supportsIntersectionObserver) {
        document.querySelectorAll('.post-card').forEach(function(card) {
          loadPostCardMediaSequentially(card);
        });
        scheduleImageRecoveryScan(container, true);
        return;
      }

      postMediaObserver = new IntersectionObserver(function(entries) {
        if (!isHomeScreenActive()) return;
        entries.forEach(function(entry) {
          const card = entry.target;
          if (entry.isIntersecting) {
            loadPostCardMediaSequentially(card);
          } else {
            const images = card.querySelectorAll('.carousel-slide img[data-lazy-src], .carousel-slide img[data-lazy-srcset], .carousel-slide img[data-src], .carousel-slide img[data-srcset]');
            images.forEach(function(img) {
              if (shouldUnloadLazyMediaImage(img)) {
                unloadLazyMediaImage(img);
              }
            });
          }
        });
      }, {
        root: mainContent,
        rootMargin: getAdaptiveImageObserverMargin(),
        threshold: 0.001
      });

      document.querySelectorAll('.post-card').forEach(function(card) {
        postMediaObserver.observe(card);
      });

      scheduleImageRecoveryScan(container, false);
    }

    function createCarouselSlide(url, isPrimary) {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide media-slide';
      if (!url) {
        slide.classList.add('empty');
        slide.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:48px;"><i class="fas fa-image"></i></div>';
        return slide;
      }

      const shell = createLazyMediaShell(url, {
        fitContain: true,
        alt: 'Imagen de la publicación',
        priority: isPrimary ? 'high' : 'low'
      });
      shell.dataset.imagePriority = isPrimary ? 'high' : 'low';
      const img = shell.querySelector('img');
      try { img.loading = 'eager'; } catch (err) {}
      if (isPrimary && 'fetchPriority' in img) {
        try { img.fetchPriority = 'high'; } catch (err) {}
      }
      slide.appendChild(shell);
      return slide;
    }

    // Vista previa de música en el selector
    const musicPickerPreviewAudio = new Audio();
    musicPickerPreviewAudio.autoplay = false;
    musicPickerPreviewAudio.preload = 'none';
    let musicPreviewButton = null;
    let musicPreviewUrl = '';

    const MUSIC_JSON_URL = 'https://raw.githubusercontent.com/SterlingPlus-Studio/Musica/main/Data.json';

    const mainContent = document.getElementById('mainContent');
    const homeBtn = document.getElementById('homeBtn');
    const profileBtn = document.getElementById('profileBtn');
    const plusBtn = document.getElementById('plusBtn');
    const searchBtn = document.getElementById('searchBtn');
    const shopBtn = document.getElementById('shopBtn');
    const messagesBtn = document.getElementById('messagesBtn');
    const topBar = document.getElementById('topBar');
    const feedModeSwitcher = document.getElementById('feedModeSwitcher');
    const recentPostsBadge = document.getElementById('recentPostsBadge');
    const body = document.body;
    const globalAudio = document.getElementById('globalAudio');

    const commentsOverlay = document.getElementById('commentsOverlay');
    const commentsList = document.getElementById('commentsList');
    const commentInput = document.getElementById('commentInput');
    const sendCommentBtn = document.getElementById('sendCommentBtn');
    const closeCommentsBtn = document.getElementById('closeCommentsBtn');

    const notifBadge = document.getElementById('notifBadge');

    const chatOverlay = document.getElementById('chatOverlay');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatBackBtn = document.getElementById('chatBackBtn');
    const chatUserName = document.getElementById('chatUserName');
    const chatAvatar = document.getElementById('chatAvatar');

    const coinBubble = document.getElementById('coinBubble');
    const coinBubbleText = document.getElementById('coinBubbleText');

    // Elementos subir item
    const uploadItemOverlay = document.getElementById('uploadItemOverlay');
    const uploadImagePreview = document.getElementById('uploadImagePreview');
    const uploadImageInput = document.getElementById('uploadImageInput');
    const uploadItemCategory = document.getElementById('uploadItemCategory');
    const uploadItemPrice = document.getElementById('uploadItemPrice');
    const uploadCancelBtn = document.getElementById('uploadCancelBtn');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    let uploadImageData = null;

    // Confirmación de compra
    const buyConfirmOverlay = document.getElementById('buyConfirmOverlay');
    const buyConfirmCancel = document.getElementById('buyConfirmCancel');
    const buyConfirmAccept = document.getElementById('buyConfirmAccept');

    if (globalAudio) {
      globalAudio.preload = 'auto';
      globalAudio.playsInline = true;
      globalAudio.autoplay = false;
      globalAudio.removeAttribute('autoplay');
      globalAudio.muted = false;
      globalAudio.volume = 1;
      globalAudio.load();
      globalAudio.addEventListener('play', function() {
        audioUnlocked = true;
      });
    }

    const startOverlay = document.getElementById('startOverlay');
    let experienceStarted = false;

    function hideStartOverlay() {
      if (!startOverlay) return;
      startOverlay.style.transition = 'opacity 0.3s ease';
      startOverlay.style.opacity = '0';
      startOverlay.style.pointerEvents = 'none';
      setTimeout(() => {
        if (startOverlay.parentNode) startOverlay.remove();
      }, 300);
    }

    function startExperience() {
      if (experienceStarted) return;
      experienceStarted = true;
      audioUnlocked = true;

      if (globalAudio) {
        globalAudio.muted = false;
        globalAudio.volume = 1;
      }

      hideStartOverlay();

      const firstWithMusic = posts.find(p => p && p.musicUrl);

      if (globalAudio && !globalAudio.src && firstWithMusic) {
        primeAudioSource(firstWithMusic.musicUrl);
        globalAudio.src = firstWithMusic.musicUrl;
        globalAudio.load();
        currentFeedAudioPostId = firstWithMusic.id;
      }

      if (globalAudio && globalAudio.src) {
        globalAudio.play().then(() => {
          isPlaying = true;
          if (firstWithMusic) currentFeedAudioPostId = firstWithMusic.id;
          setupFeedObserver();
        }).catch(error => {
          console.warn('Audio bloqueado al iniciar experiencia:', error);
          setupFeedObserver();
        });
      } else {
        setupFeedObserver();
      }
    }

    // Elementos del selector de música
    const musicPickerOverlay = document.getElementById('musicPickerOverlay');
    const musicPickerList = document.getElementById('musicPickerList');
    const closeMusicPickerBtn = document.getElementById('closeMusicPickerBtn');
    const musicSearchInput = document.getElementById('musicSearchInput');

    // Elementos del diálogo de descarga
    const downloadOverlay = document.getElementById('downloadOverlay');
    const downloadImageScroll = document.getElementById('downloadImageScroll');
    const downloadConfirmBtn = document.getElementById('downloadConfirmBtn');
    const downloadCancelBtn = document.getElementById('downloadCancelBtn');
    const downloadSelectedCount = document.getElementById('downloadSelectedCount');

    // Elementos del diálogo de confirmación de eliminación
    const deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
    const deleteConfirmCancel = document.getElementById('deleteConfirmCancel');
    const deleteConfirmAccept = document.getElementById('deleteConfirmAccept');

    // ============================================================
    //  SISTEMA DE MONEDAS (CORREGIDO)
    // ============================================================
    function showCoinBubble(amount) {
      if (amount <= 0) return;
      coinBubbleText.textContent = '+' + amount;
      coinBubble.classList.add('show');
      setTimeout(() => {
        coinBubble.classList.remove('show');
      }, 1200);
    }

    function addCoins(uid, amount) {
      if (!uid) return;
      const safeAmount = Number(amount) || 0;
      if (safeAmount <= 0) return;

      const userRef = database.ref('users/' + uid);
      userRef.transaction(function(user) {
        if (!user) user = {};
        const currentCoins = Number(user.coins || 0);
        user.coins = currentCoins + safeAmount;
        return user;
      }, function(error, committed, snapshot) {
        if (error) {
          console.warn('Error al añadir monedas al usuario ' + uid + ':', error);
          return;
        }
        if (!committed || !snapshot || !snapshot.val()) {
          console.warn('Transacción de monedas no confirmada para ' + uid);
          return;
        }

        const updatedUser = snapshot.val() || {};
        if (uid === currentUserId) {
          profileData.coins = Number(updatedUser.coins || 0);
          showCoinBubble(safeAmount);
          updateShopCoinsUI();
        }

        if (userProfiles[uid]) {
          userProfiles[uid] = { ...userProfiles[uid], coins: Number(updatedUser.coins || 0) };
        }

        console.log('Monedas añadidas correctamente a ' + uid + ': +' + safeAmount);
        if (document.getElementById('shopView')) {
          updateShopCoinsUI();
        }
      });
    }

    function updateShopCoinsUI() {
      const coinEl = document.querySelector('.shop-coins .coin-amount');
      if (coinEl) coinEl.textContent = profileData.coins || 0;
    }

    // ---- Verificación de recompensa única por publicación ----
    function hasUserRewardedPost(postId, type) {
      if (!profileData.rewardedPosts) profileData.rewardedPosts = {};
      const postRewards = profileData.rewardedPosts[postId] || {};
      return !!postRewards[type];
    }

    function markPostRewarded(postId, type) {
      if (!profileData.rewardedPosts) profileData.rewardedPosts = {};
      if (!profileData.rewardedPosts[postId]) profileData.rewardedPosts[postId] = {};
      profileData.rewardedPosts[postId][type] = true;
      // Persistir en Firebase
      const updates = {};
      updates['rewardedPosts/' + postId + '/' + type] = true;
      updateUserProfile(currentUserId, { rewardedPosts: profileData.rewardedPosts })
        .catch(err => console.warn('Error al guardar recompensa:', err));
    }

    // ============================================================
    //  CHAT
    // ============================================================
    function getChatId(uid1, uid2) {
      return uid1 < uid2 ? uid1 + '_' + uid2 : uid2 + '_' + uid1;
    }

    function loadChats(uid) {
      const chatsRef = database.ref('chats');
      chatsRef.off();
      chatsRef.on('value', function(snapshot) {
        const data = snapshot.val();
        chats = {};
        if (data) {
          Object.keys(data).forEach(function(chatId) {
            const chat = data[chatId];
            if (chat.participants && chat.participants.includes(uid)) {
              chats[chatId] = chat;
            }
          });
        }
        updateChatBadge();
        if (activeScreen === 'messages') {
          const container = document.querySelector('.messages-view .messages-list');
          if (container) renderChatList(container);
        }
      });
    }

    function updateChatBadge() {
      let totalUnread = 0;
      Object.keys(chats).forEach(function(chatId) {
        const chat = chats[chatId];
        if (chat.unreadCount && chat.unreadCount[currentUserId]) {
          totalUnread += chat.unreadCount[currentUserId];
        }
      });
      if (totalUnread > 0) {
        notifBadge.style.display = 'flex';
        notifBadge.textContent = totalUnread;
      } else {
        notifBadge.style.display = 'none';
      }
    }

    function renderChatList(container) {
      if (!container) return;
      const chatIds = Object.keys(chats).sort(function(a, b) {
        const chatA = chats[a] || {};
        const chatB = chats[b] || {};
        const unreadA = chatA.unreadCount && chatA.unreadCount[currentUserId] ? Number(chatA.unreadCount[currentUserId]) : 0;
        const unreadB = chatB.unreadCount && chatB.unreadCount[currentUserId] ? Number(chatB.unreadCount[currentUserId]) : 0;
        if (unreadB !== unreadA) return unreadB - unreadA;
        const timeDiff = (chatB.lastTimestamp || 0) - (chatA.lastTimestamp || 0);
        if (timeDiff !== 0) return timeDiff;
        return String(a).localeCompare(String(b));
      });
      if (chatIds.length === 0) {
        container.innerHTML = '<div class="no-chats">No tienes conversaciones</div>';
        return;
      }
      let html = '';
      chatIds.forEach(function(chatId) {
        const chat = chats[chatId];
        const otherUid = chat.participants.find(function(uid) { return uid !== currentUserId; });
        if (!otherUid) return;
        const user = getChatParticipantInfo(otherUid);
        const unread = chat.unreadCount && chat.unreadCount[currentUserId] ? chat.unreadCount[currentUserId] : 0;
        const lastMsg = chat.lastMessage || 'Sin mensajes';
        const avatarHtml = user.avatar
          ? `<img src="${user.avatar}" alt="Avatar" />`
          : `<span>${(user.name || '?').charAt(0).toUpperCase()}</span>`;
        html += `
          <div class="chat-list-item ${otherUid === SHOP_BOT_UID ? 'bot' : ''}" data-chat-id="${chatId}" data-other-uid="${otherUid}" role="button" tabindex="0">
            <div class="avatar">${avatarHtml}</div>
            <div class="info">
              <div class="name">${user.name || 'Usuario'}</div>
              <div class="last-msg">${lastMsg}</div>
            </div>
            ${unread > 0 ? `<div class="badge">${unread}</div>` : ''}
            <div class="open-indicator"><i class="fas fa-chevron-right"></i></div>
          </div>
        `;
      });
      container.innerHTML = html;
      container.querySelectorAll('.chat-list-item').forEach(function(item) {
        item.addEventListener('click', function() {
          const chatId = this.dataset.chatId;
          const otherUid = this.dataset.otherUid;
          if (!chatId || !otherUid) return;
          openChat(chatId, otherUid);
        });
        item.addEventListener('touchend', function() {
          const chatId = this.dataset.chatId;
          const otherUid = this.dataset.otherUid;
          if (!chatId || !otherUid) return;
          openChat(chatId, otherUid);
        }, { passive: true });
        item.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const chatId = this.dataset.chatId;
            const otherUid = this.dataset.otherUid;
            if (!chatId || !otherUid) return;
            openChat(chatId, otherUid);
          }
        });
      });
    }

    function openChat(chatId, otherUid) {
      currentChatId = chatId;
      chatOverlay.classList.add('active');
      if (chatMessages) {
        chatMessages.innerHTML = '<div class="chat-empty">Cargando mensajes...</div>';
      }
      const user = getChatParticipantInfo(otherUid);
      chatUserName.textContent = user.name || 'Usuario';
      if (user.avatar) {
        chatAvatar.innerHTML = `<img src="${user.avatar}" alt="Avatar" />`;
      } else {
        chatAvatar.innerHTML = `<span>${(user.name || '?').charAt(0).toUpperCase()}</span>`;
      }
      markChatAsRead(chatId);
      loadChatMessages(chatId);
      // El teclado no se abre automáticamente al entrar en el chat.
    }

    function closeChat() {
      const chatId = currentChatId;
      chatOverlay.classList.remove('active');
      currentChatId = null;
      if (chatId && chatListeners[chatId]) {
        database.ref('chats/' + chatId + '/messages').off();
        delete chatListeners[chatId];
      }
    }

    function loadChatMessages(chatId) {
      const messagesRef = database.ref('chats/' + chatId + '/messages');
      if (chatListeners[chatId]) {
        messagesRef.off();
        delete chatListeners[chatId];
      }
      messagesRef.on('value', function(snapshot) {
        const data = snapshot.val();
        renderMessages(data);
      });
      chatListeners[chatId] = true;
    }

    function renderMessages(data) {
      if (!chatMessages) return;

      const chatInfo = currentChatId ? (chats[currentChatId] || null) : null;
      const fallbackMessage = chatInfo && chatInfo.lastMessage ? String(chatInfo.lastMessage) : '';
      const fallbackTimestamp = chatInfo && chatInfo.lastTimestamp ? Number(chatInfo.lastTimestamp) : 0;

      if (!data) {
        if (fallbackMessage) {
          chatMessages.innerHTML = `
            <div class="chat-message received system chat-fallback-message">
              <div class="chat-message-system-header">
                <div class="chat-message-avatar"><img src="${SHOP_BOT_AVATAR}" alt="${SHOP_BOT_NAME}" /></div>
                <span>${SHOP_BOT_NAME}</span>
              </div>
              <div class="chat-message-text">${escapeHtml(fallbackMessage)}</div>
              <div class="time">${fallbackTimestamp ? new Date(fallbackTimestamp).toLocaleTimeString() : ''}</div>
            </div>
          `;
        } else {
          chatMessages.innerHTML = '<div class="chat-empty">Sin mensajes aún</div>';
        }
        return;
      }

      const msgs = Object.keys(data).map(function(key) {
        return { id: key, ...data[key] };
      }).sort(function(a, b) {
        const diff = (a.timestamp || 0) - (b.timestamp || 0);
        if (diff !== 0) return diff;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

      if (msgs.length === 0) {
        if (fallbackMessage) {
          chatMessages.innerHTML = `
            <div class="chat-message received system chat-fallback-message">
              <div class="chat-message-system-header">
                <div class="chat-message-avatar"><img src="${SHOP_BOT_AVATAR}" alt="${SHOP_BOT_NAME}" /></div>
                <span>${SHOP_BOT_NAME}</span>
              </div>
              <div class="chat-message-text">${escapeHtml(fallbackMessage)}</div>
              <div class="time">${fallbackTimestamp ? new Date(fallbackTimestamp).toLocaleTimeString() : ''}</div>
            </div>
          `;
        } else {
          chatMessages.innerHTML = '<div class="chat-empty">Sin mensajes aún</div>';
        }
        return;
      }
      let html = '';
      msgs.forEach(function(msg) {
        const isSent = msg.sender === currentUserId;
        const isSystem = msg.system || msg.sender === SHOP_BOT_UID;
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
        const avatarHtml = isSystem
          ? `<div class="chat-message-avatar"><img src="${msg.avatar || SHOP_BOT_AVATAR}" alt="${msg.senderName || SHOP_BOT_NAME}" /></div>`
          : '';
        const safeText = escapeHtml(msg.text);
        const itemPreviewHtml = isSystem && msg.itemImageUrl
          ? `<div class="shop-sale-preview"><img src="${msg.itemImageUrl}" alt="${escapeHtml(msg.itemLabel || 'Artículo')}" /><span>${escapeHtml(msg.itemLabel || 'Artículo')}</span></div>`
          : '';
        html += `
          <div class="chat-message ${isSent ? 'sent' : 'received'} ${isSystem ? 'system' : ''}">
            ${isSystem ? `<div class="chat-message-system-header">${avatarHtml}<span>${msg.senderName || SHOP_BOT_NAME}</span></div>` : ''}
            ${itemPreviewHtml}
            <div class="chat-message-text">${safeText}</div>
            <div class="time">${time}</div>
          </div>
        `;
      });
      chatMessages.innerHTML = html;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendMessage() {
      const text = chatInput.value.trim();
      if (!text || !currentChatId) return;
      const messagesRef = database.ref('chats/' + currentChatId + '/messages');
      const newMsgRef = messagesRef.push();
      const msgData = {
        text: text,
        sender: currentUserId,
        timestamp: Date.now(),
        read: false
      };
      newMsgRef.set(msgData).then(function() {
        const chatRef = database.ref('chats/' + currentChatId);
        const update = {
          lastMessage: text,
          lastTimestamp: Date.now()
        };
        const otherUid = chats[currentChatId]?.participants?.find(function(uid) { return uid !== currentUserId; });
        if (otherUid) {
          const unreadPath = 'unreadCount/' + otherUid;
          update[unreadPath] = firebase.database.ServerValue.increment(1);
        }
        chatRef.update(update);
        chatInput.value = '';
        // Mantener el teclado cerrado tras enviar si no estaba activo.
      }).catch(function(err) {
        console.warn('Error al enviar mensaje:', err);
        alert('Error al enviar mensaje.');
      });
    }

    function markChatAsRead(chatId) {
      if (!chatId) return;
      const chatRef = database.ref('chats/' + chatId);
      const update = {};
      update['unreadCount/' + currentUserId] = 0;
      chatRef.update(update);
    }

    function notifyShopSale(sellerUid, item, price, buyerName) {
      if (!sellerUid || sellerUid === currentUserId) return Promise.resolve();
      const chatId = getChatId(sellerUid, SHOP_BOT_UID);
      const chatRef = database.ref('chats/' + chatId);
      const messagesRef = database.ref('chats/' + chatId + '/messages');
      const itemLabel = item && (item.name || item.title || item.category || 'un artículo');
      const messageText = buyerName + ' compró ' + itemLabel + ' por ' + price + ' monedas.';
      const timestamp = Date.now();

      return chatRef.transaction(function(current) {
        if (!current) {
          current = {
            participants: [sellerUid, SHOP_BOT_UID],
            unreadCount: {}
          };
        }
        if (!Array.isArray(current.participants)) {
          current.participants = [sellerUid, SHOP_BOT_UID];
        }
        if (!current.participants.includes(sellerUid)) current.participants.push(sellerUid);
        if (!current.participants.includes(SHOP_BOT_UID)) current.participants.push(SHOP_BOT_UID);
        current.lastMessage = messageText;
        current.lastTimestamp = timestamp;
        current.unreadCount = current.unreadCount || {};
        current.unreadCount[sellerUid] = Number(current.unreadCount[sellerUid] || 0) + 1;
        return current;
      }).then(function() {
        return messagesRef.push({
          text: messageText,
          sender: SHOP_BOT_UID,
          senderName: SHOP_BOT_NAME,
          avatar: SHOP_BOT_AVATAR,
          timestamp: timestamp,
          read: false,
          system: true,
          itemLabel: itemLabel,
          itemImageUrl: item && item.imageUrl ? item.imageUrl : null,
          itemPrice: price
        });
      }).catch(function(err) {
        console.warn('Error al crear notificación de venta:', err);
      });
    }

    // ============================================================
    //  FUNCIONES DE ALEATORIEDAD Y ORDEN
    // ============================================================
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }

    function buildRandomOrder(ids) {
      return shuffleArray([...ids]);
    }

    function insertNewPostInOrder(newPostId) {
      const pos = Math.floor(Math.random() * (postOrder.length + 1));
      postOrder.splice(pos, 0, newPostId);
    }

    // ============================================================
    //  FUNCIÓN PARA DETENER TODA LA MÚSICA
    // ============================================================
    function stopAllMusic() {
      globalAudio.pause();
      if (globalAudio.readyState >= 1) {
        try {
          globalAudio.currentTime = 0;
        } catch (err) {}
      }
      if (currentFeedAudioPostId !== null) {
        currentFeedAudioPostId = null;
      }
      isPlaying = false;
      const playBtn = document.getElementById('musicPlayBtn');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.classList.remove('playing');
      }
    }

    // ============================================================
    //  AUTH
    // ============================================================
    function showLoginView() {
      setActiveScreen('login');
      stopAllMusic();
      clearMainContent();
      showTopBar(false);
      setBottomNavActive(null);

      const container = document.createElement('div');
      container.className = 'login-view';
      container.id = 'loginView';
      container.innerHTML = `
        <div class="logo"><i class="fas fa-camera-retro"></i></div>
        <h1>SnapPix</h1>
        <p class="subtitle">Inicia sesión para continuar</p>
        <div class="form-group">
          <label for="loginEmail">Email</label>
          <input type="email" id="loginEmail" placeholder="tu@email.com" />
        </div>
        <div class="form-group">
          <label for="loginPassword">Contraseña</label>
          <input type="password" id="loginPassword" placeholder="••••••••" />
        </div>
        <button class="login-btn" id="loginBtn">Iniciar sesión</button>
        <div class="error-msg" id="loginError"></div>
        <p style="margin-top:20px; font-size:14px; color:#aaa;">
          ¿No tienes cuenta? <span style="color:#3b82f6; cursor:pointer;" id="goToRegisterLink">Regístrate</span>
        </p>
      `;
      mainContent.appendChild(container);

      const emailInput = document.getElementById('loginEmail');
      const passInput = document.getElementById('loginPassword');
      const loginBtn = document.getElementById('loginBtn');
      const errorMsg = document.getElementById('loginError');

      const performLogin = () => {
        const email = emailInput.value.trim();
        const password = passInput.value;
        if (!email || !password) {
          errorMsg.textContent = 'Por favor, completa todos los campos.';
          return;
        }
        loginBtn.disabled = true;
        loginBtn.textContent = 'Iniciando...';
        errorMsg.textContent = '';
        auth.signInWithEmailAndPassword(email, password)
          .then(() => {})
          .catch(err => {
            errorMsg.textContent = err.message;
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar sesión';
          });
      };

      loginBtn.addEventListener('click', performLogin);
      passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performLogin();
      });
      emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') passInput.focus();
      });

      document.getElementById('goToRegisterLink').addEventListener('click', () => {
        showRegisterView();
      });
    }

    function showRegisterView() {
      stopAllMusic();
      clearMainContent();
      showTopBar(false);

      const container = document.createElement('div');
      container.className = 'login-view';
      container.id = 'registerView';
      container.innerHTML = `
        <div class="logo"><i class="fas fa-user-plus"></i></div>
        <h1>Crear cuenta</h1>
        <p class="subtitle">Regístrate para empezar</p>
        <div class="form-group">
          <label for="regEmail">Email</label>
          <input type="email" id="regEmail" placeholder="tu@email.com" />
        </div>
        <div class="form-group">
          <label for="regPassword">Contraseña</label>
          <input type="password" id="regPassword" placeholder="Mínimo 6 caracteres" />
        </div>
        <div class="form-group">
          <label for="regName">Nombre</label>
          <input type="text" id="regName" placeholder="Tu nombre" />
        </div>
        <div class="form-group">
          <label for="regBio">Descripción</label>
          <textarea id="regBio" placeholder="Cuéntanos sobre ti..."></textarea>
        </div>
        <button class="login-btn" id="registerBtn">Registrarse</button>
        <div class="error-msg" id="registerError"></div>
        <p style="margin-top:20px; font-size:14px; color:#aaa;">
          ¿Ya tienes cuenta? <span style="color:#3b82f6; cursor:pointer;" id="goToLoginLink">Inicia sesión</span>
        </p>
      `;
      mainContent.appendChild(container);

      const emailInput = document.getElementById('regEmail');
      const passInput = document.getElementById('regPassword');
      const nameInput = document.getElementById('regName');
      const bioInput = document.getElementById('regBio');
      const registerBtn = document.getElementById('registerBtn');
      const errorMsg = document.getElementById('registerError');

      const performRegister = () => {
        const email = emailInput.value.trim();
        const password = passInput.value;
        const name = nameInput.value.trim() || 'Usuario';
        const bio = bioInput.value.trim() || '';

        if (!email || !password) {
          errorMsg.textContent = 'Por favor, completa email y contraseña.';
          return;
        }
        if (password.length < 6) {
          errorMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
          return;
        }

        registerBtn.disabled = true;
        registerBtn.textContent = 'Creando cuenta...';
        errorMsg.textContent = '';

        auth.createUserWithEmailAndPassword(email, password)
          .then((userCredential) => {
            const user = userCredential.user;
            const profileRef = database.ref(`users/${user.uid}`);
            return profileRef.set({
              name: name,
              bio: bio,
              avatar: null,
              likedPosts: [],
              followers: {},
              following: {},
              coins: 100,
              purchasedItems: [],
              selectedFrame: null,
              selectedParticles: null,
              selectedVerifiedSticker: null,
              rewardedPosts: {}
            });
          })
          .catch(err => {
            errorMsg.textContent = err.message;
            registerBtn.disabled = false;
            registerBtn.textContent = 'Registrarse';
          });
      };

      registerBtn.addEventListener('click', performRegister);
      passInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performRegister();
      });

      document.getElementById('goToLoginLink').addEventListener('click', () => {
        showLoginView();
      });
    }

    function logout() {
      auth.signOut().then(() => {}).catch(err => {
        console.warn('Error al cerrar sesión:', err);
      });
    }

    // ============================================================
    //  PERFIL USUARIO ACTUAL
    // ============================================================
    function loadUserProfile(uid) {
      const profileRef = database.ref(`users/${uid}`);
      profileRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const avatar = sanitizeRenderableImageUrl(data.avatar) || null;
          if (data.avatar && !avatar) {
            profileRef.update({ avatar: null }).catch(function(err) {
              console.warn('No se pudo limpiar el avatar del perfil ' + uid + ':', err);
            });
          }
          profileData.name = data.name || 'Usuario';
          profileData.bio = data.bio || '';
          profileData.avatar = avatar;
          profileData.verifiedSticker = data.verifiedSticker || null;
          profileData.likedPosts = data.likedPosts || [];
          profileData.followers = data.followers || {};
          profileData.following = data.following || {};
          profileData.coins = Number(data.coins || 0);
          profileData.purchasedItems = data.purchasedItems || [];
          profileData.selectedFrame = data.selectedFrame || null;
          profileData.selectedParticles = data.selectedParticles || null;
          profileData.selectedVerifiedSticker = data.selectedVerifiedSticker || null;
          profileData.rewardedPosts = data.rewardedPosts || {};
          userProfiles[uid] = { ...data, avatar: avatar };
          normalizePostAuthorNames();
          if (document.getElementById('feedContainer')) {
            syncFeedCardsInPlace();
          }
          updateShopCoinsUI();
        } else {
          const defaultProfile = {
            name: 'Usuario',
            bio: '',
            avatar: null,
            verifiedSticker: null,
            likedPosts: [],
            followers: {},
            following: {},
            coins: 100,
            purchasedItems: [],
            selectedFrame: null,
            selectedParticles: null,
            selectedVerifiedSticker: null,
            rewardedPosts: {}
          };
          profileRef.set(defaultProfile);
          Object.assign(profileData, defaultProfile);
          userProfiles[uid] = defaultProfile;
          normalizePostAuthorNames();
          updateShopCoinsUI();
        }
        loadPostsFromFirebase();
        const profileView = document.getElementById('profileView');
        if (profileView) {
          const viewedUid = profileView.dataset.uid;
          if (viewedUid === currentUserId) {
            showProfile(currentUserId);
          }
        }
        if (currentUserId) {
          profileData.avatar = sanitizeRenderableImageUrl(profileData.avatar) || null;
          if (userProfiles[currentUserId]) {
            userProfiles[currentUserId] = { ...userProfiles[currentUserId], avatar: sanitizeRenderableImageUrl(userProfiles[currentUserId].avatar) || null };
          }
          Object.keys(userProfiles).forEach(function(uid) {
            const user = userProfiles[uid];
            if (user) {
              userProfiles[uid] = { ...user, avatar: sanitizeRenderableImageUrl(user.avatar) || null };
            }
          });
        }
        if (document.getElementById('shopView')) {
          renderShop();
        }
      });
    }

    // ============================================================
    //  FIREBASE POSTS
    // ============================================================
    function loadPostsFromFirebase() {
      const postsRef = database.ref('posts');
      postsRef.off();
      postsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const postsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          posts = postsArray;
          normalizePostAuthorNames();
        } else {
          posts = [];
        }

        if (profileData.likedPosts && profileData.likedPosts.length > 0) {
          posts.forEach(post => {
            post.liked = profileData.likedPosts.includes(post.id);
          });
        } else {
          posts.forEach(post => post.liked = false);
        }

        const currentIds = posts.map(p => p.id);
        syncRandomPostOrderWithCurrentPosts();
        sortPostsForCurrentFeedMode();

        isPostsLoading = false;
        warmUpFeedAudioSources();

        const feedVisible = !!document.getElementById('feedContainer');
        const canPatchFeed = feedVisible && syncFeedCardsInPlace();
        if (canPatchFeed) {
          setupPostMediaObserver();
        }

        if (!profilesLoaded) {
          const authorUids = [...new Set(posts.map(p => p.authorUid || p.authorId).filter(id => id && id !== 'unknown'))];
          if (authorUids.length > 0) {
            database.ref('users').once('value').then(snapshot => {
              const data = snapshot.val();
              if (data) {
                Object.keys(data).forEach(uid => {
                  userProfiles[uid] = data[uid];
                });
              }
              profilesLoaded = true;
              if (document.getElementById('feedContainer')) {
                if (!syncFeedCardsInPlace()) {
                  updateFeedContainer();
                }
              }
              if (activeScreen === 'messages') {
                const container = document.querySelector('.messages-view .messages-list');
                if (container) renderChatList(container);
              }
            }).catch(err => console.warn('Error cargando perfiles:', err));
          } else {
            profilesLoaded = true;
          }
        }

        updateFeedModeUI();

        if (feedVisible && !canPatchFeed) {
          updateFeedContainer();
        }
        const profileView = document.getElementById('profileView');
        if (profileView) {
          const viewedUid = profileView.dataset.uid;
          if (viewedUid === currentUserId) {
            showProfile(currentUserId);
          }
        }
      });
    }

    // ============================================================
    //  FUNCIÓN PARA ACTUALIZAR EL CONTENEDOR DEL FEED
    // ============================================================
    function updateFeedContainer(scrollTarget) {
      sortPostsForCurrentFeedMode();
      let container = document.getElementById('feedContainer');
      if (!container) {
        container = document.createElement('div');
        container.className = 'feed-container';
        container.id = 'feedContainer';
        mainContent.appendChild(container);
      }

      const savedScrollTop = (typeof scrollTarget === 'number') ? scrollTarget : (mainContent.scrollTop || 0);
      feedScrollTop = savedScrollTop;

      container.innerHTML = '';

      if (isPostsLoading) {
        container.innerHTML = `
          <div class="loading-feed">
            <i class="fas fa-spinner"></i>
            <p>Cargando publicaciones...</p>
          </div>
        `;
        return;
      }

      const feedPosts = getFeedPostsForCurrentMode();

      if (posts.length === 0) {
        container.innerHTML = `
          <div class="empty-feed">
            <i class="fas fa-plus-circle"></i>
            <p>No hay publicaciones aún</p>
            <p style="font-size:14px; margin-top:8px; color:#666;">Toca el botón + para crear tu primera publicación</p>
          </div>
        `;
        return;
      }

      if (feedMode === 'following' && feedPosts.length === 0) {
        container.innerHTML = `
          <div class="feed-terminal-card" id="feedTerminalCard">
            <div class="feed-terminal-box">
              <div class="feed-terminal-icon"><i class="fas fa-check-circle"></i></div>
              <div class="feed-terminal-title">Ya estás totalmente al día</div>
              <div class="feed-terminal-text">No hay más publicaciones nuevas para mostrar en esta sección.</div>
            </div>
          </div>
        `;
        updateFeedTerminalCard();
        return;
      }

      feedPosts.forEach(post => {
        const card = createPostCard(post);
        container.appendChild(card);
      });

      if (!genericLazyImageObserver) {
        setupGenericLazyImageObserver();
      }
      setupPostMediaObserver();
      loadLazyImagesInContainer(container);
      scheduleImageRecoveryScan(container, true);

      if (feedMode === 'following') {
        const terminal = document.createElement('div');
        terminal.className = 'feed-terminal-card';
        terminal.id = 'feedTerminalCard';
        terminal.innerHTML = `
          <div class="feed-terminal-box">
            <div class="feed-terminal-icon"><i class="fas fa-check-circle"></i></div>
            <div class="feed-terminal-title">Ya estás totalmente al día</div>
            <div class="feed-terminal-text">No hay más publicaciones nuevas para mostrar en esta sección.</div>
          </div>
        `;
        container.appendChild(terminal);
        updateFeedTerminalCard();
      }

      warmUpPostImages(feedPosts);

      requestAnimationFrame(function() {
        mainContent.scrollTop = savedScrollTop;
      });

      scheduleFeedAutoplay(function() {
        mainContent.scrollTop = savedScrollTop;
        setupFeedObserver();
        setupPostMediaObserver();
        tryAutoPlayFirstMusic();
      }, 150);
    }

    // ---- Toggle música al tocar el carrusel ----
    function toggleMusicPlayback() {
      if (!globalAudio.src) return;
      if (globalAudio.paused) {
        globalAudio.play().then(() => {
          audioUnlocked = true;
          isPlaying = true;
          if (!currentFeedAudioPostId) {
            const post = posts.find(p => p.musicUrl === globalAudio.src);
            if (post) currentFeedAudioPostId = post.id;
          }
        }).catch(err => {
          console.warn('No se pudo reanudar la música:', err);
        });
      } else {
        globalAudio.pause();
        isPlaying = false;
      }
    }

    // ============================================================
    //  MANEJO DE LONG PRESS PARA DESCARGAR IMÁGENES
    // ============================================================
    function updateDownloadSelectionCounter(totalImages) {
      if (!downloadSelectedCount) return;
      const selected = downloadImageScroll ? downloadImageScroll.querySelectorAll('.image-item.selected').length : 0;
      downloadSelectedCount.textContent = `${selected}/${totalImages}`;
    }

    function showDownloadDialog(postId) {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      let images = getPostImageUrls(post);
      if (!images.length) {
        return;
      }

      downloadImageScroll.innerHTML = '';
      images.forEach((url, index) => {
        const item = document.createElement('div');
        const shouldStartSelected = images.length === 1 ? true : index !== 0;
        item.className = 'image-item' + (shouldStartSelected ? ' selected' : '');
        item.dataset.index = index;
        item.dataset.selected = shouldStartSelected ? 'true' : 'false';

        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        const thumbImg = document.createElement('img');
        thumbImg.alt = 'Vista previa';
        try { thumbImg.decoding = 'async'; } catch (err) {}
        try { thumbImg.loading = index === 0 ? 'eager' : 'lazy'; } catch (err) {}
        if ('fetchPriority' in thumbImg) {
          try { thumbImg.fetchPriority = index === 0 ? 'high' : 'low'; } catch (err) {}
        }
        thumbImg.src = url;
        thumb.appendChild(thumbImg);

        item.appendChild(thumb);

        item.addEventListener('click', function() {
          const isSelected = this.classList.toggle('selected');
          this.dataset.selected = isSelected ? 'true' : 'false';
          updateDownloadSelectionCounter(images.length);
        });

        downloadImageScroll.appendChild(item);
      });

      downloadOverlay.classList.add('active');
      downloadConfirmBtn.dataset.postId = postId;
      downloadImageScroll.scrollLeft = 0;
      updateDownloadSelectionCounter(images.length);
    }

    function closeDownloadDialog() {
      downloadOverlay.classList.remove('active');
      if (downloadSelectedCount) downloadSelectedCount.textContent = '0/0';
    }

    async function downloadSelectedImages() {
      const items = downloadImageScroll.querySelectorAll('.image-item.selected');
      const selected = [];
      items.forEach(item => {
        const idx = parseInt(item.dataset.index, 10);
        if (!isNaN(idx)) {
          selected.push(idx);
        }
      });

      if (selected.length === 0) {
        alert('No has seleccionado ninguna imagen.');
        return;
      }

      const postId = downloadConfirmBtn.dataset.postId;
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      let images = getPostImageUrls(post);

      const urlsToDownload = selected.map(idx => images[idx]).filter(Boolean);
      if (urlsToDownload.length === 0) {
        alert('No se seleccionaron imágenes válidas.');
        return;
      }

      let successfulDownloads = 0;

      for (let i = 0; i < urlsToDownload.length; i++) {
        const url = urlsToDownload[i];
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          const ext = blob.type.split('/')[1] || 'jpg';
          link.download = `imagen_${i+1}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          successfulDownloads += 1;
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          console.warn('Error al descargar imagen:', err);
          alert(`Error al descargar la imagen ${i+1}.`);
        }
      }

      if (successfulDownloads > 0) {
        try {
          await incrementPostDownloadCount(postId);
        } catch (err) {
          console.warn('No se pudo actualizar el contador de descargas:', err);
        }
      }

      closeDownloadDialog();
    }

    // ============================================================
    //  FUNCIÓN PARA ELIMINAR PUBLICACIÓN
    // ============================================================
    function showDeleteConfirm(postId) {
      postToDeleteId = postId;
      deleteConfirmOverlay.classList.add('active');
    }

    function closeDeleteConfirm() {
      deleteConfirmOverlay.classList.remove('active');
      postToDeleteId = null;
    }

    async function deletePost(postId) {
      if (!postId) return;
      try {
        await database.ref(`posts/${postId}`).remove();
        posts = posts.filter(p => p.id !== postId);
        postOrder = postOrder.filter(id => id !== postId);

        if (document.getElementById('feedContainer')) {
          sortPostsForCurrentFeedMode();
          updateFeedModeUI();
          updateFeedContainer(feedScrollTop);
        }

        const profileView = document.getElementById('profileView');
        if (profileView) {
          const viewedUid = profileView.dataset.uid;
          if (viewedUid === currentUserId) {
            showProfile(currentUserId);
          }
        }

        closeDeleteConfirm();
      } catch (err) {
        console.warn('Error al eliminar publicación:', err);
        alert('No se pudo eliminar la publicación.');
        closeDeleteConfirm();
      }
    }

    function resolvePostAuthorName(post) {
      const authorUid = post && (post.authorUid || post.authorId) ? (post.authorUid || post.authorId) : 'unknown';
      if (authorUid === currentUserId && profileData && profileData.name) {
        return profileData.name || 'Usuario';
      }
      if (authorUid !== 'unknown' && userProfiles[authorUid] && userProfiles[authorUid].name) {
        return userProfiles[authorUid].name || 'Usuario';
      }
      return (post && post.authorName) ? post.authorName : 'Usuario';
    }

    function normalizePostAuthorNames() {
      if (!Array.isArray(posts) || posts.length === 0) return;
      posts.forEach(function(post) {
        if (!post) return;
        post.authorName = resolvePostAuthorName(post);
      });
    }

    // ============================================================
    //  CREAR POST CARD
    // ============================================================
    
function createPostCard(post) {
      const postCard = document.createElement('div');
      postCard.className = 'post-card';
      postCard.dataset.postId = post.id;

      let images = getPostImageUrls(post);

      const carousel = document.createElement('div');
      carousel.className = 'post-image-carousel';

      if (images.length === 0) {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        slide.style.background = '#111';
        slide.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:48px;"><i class="fas fa-image"></i></div>';
        carousel.appendChild(slide);
      } else {
        images.forEach(function(url, index) {
          carousel.appendChild(createCarouselSlide(url, index === 0));
        });
      }
      postCard.appendChild(carousel);
      try { postCard.style.contentVisibility = 'auto'; postCard.style.containIntrinsicSize = '1px 900px'; } catch (err) {}

      if (images.length > 0) {
        warmUpPostImages([{ images: images }]);
      }

      carousel.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleMusicPlayback();
      });

      let pressTimer = null;
      const startPress = function(e) {
        pressTimer = setTimeout(() => {
          const postId = this.closest('.post-card').dataset.postId;
          showDownloadDialog(postId);
        }, 500);
      };
      const endPress = function(e) {
        clearTimeout(pressTimer);
      };
      const cancelPress = function(e) {
        clearTimeout(pressTimer);
      };
      carousel.addEventListener('touchstart', startPress, { passive: true });
      carousel.addEventListener('touchend', endPress, { passive: true });
      carousel.addEventListener('touchcancel', cancelPress, { passive: true });
      carousel.addEventListener('mousedown', function(e) {
        if (e.button === 0) {
          startPress.call(this, e);
        }
      });
      carousel.addEventListener('mouseup', function(e) {
        if (e.button === 0) {
          endPress.call(this, e);
        }
      });
      carousel.addEventListener('mouseleave', function(e) {
        cancelPress.call(this, e);
      });

      if (images.length > 1) {
        const counter = document.createElement('div');
        counter.className = 'image-counter';
        counter.textContent = `1/${images.length}`;
        counter.dataset.total = images.length;
        postCard.appendChild(counter);
        carousel.addEventListener('scroll', function() {
          const total = parseInt(counter.dataset.total, 10);
          const slideWidth = this.querySelector('.carousel-slide')?.offsetWidth || 1;
          const scrollLeft = this.scrollLeft;
          const index = Math.round(scrollLeft / slideWidth) + 1;
          counter.textContent = `${Math.min(index, total)}/${total}`;
        });
      }

      const authorUid = post.authorUid || post.authorId || 'unknown';
      const authorName = resolvePostAuthorName(post);
      const verifiedStickerUrl = getResolvedVerifiedStickerForUid(authorUid);

      let displayAvatar = null;
      if (authorUid === currentUserId) {
        displayAvatar = getResolvedProfileAvatar(profileData);
      } else if (userProfiles[authorUid]) {
        displayAvatar = getResolvedProfileAvatar(userProfiles[authorUid]);
      }

      let avatarContent = '';
      if (displayAvatar) {
        avatarContent = `<img src="${displayAvatar}" alt="Avatar" loading="lazy" decoding="async" />`;
      } else {
        const initials = authorName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
        const hue = Math.abs(authorName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) * 137) % 360;
        avatarContent = `<span style="background:hsl(${hue}, 70%, 50%); display:flex; align-items:center; justify-content:center; width:100%; height:100%; border-radius:50%; font-size:20px; font-weight:600; color:white;">${initials || '?'}</span>`;
      }

      const likedClass = post.liked ? 'liked' : '';
      const commentCount = post.comments ? post.comments.length : 0;

      let descHtml = post.description || 'Sin descripción';
      descHtml = descHtml.replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

      const postParticleUrl = getResolvedParticleImageUrl(getUserDataForUid(authorUid));
      if (postParticleUrl) {
        const particleLayer = createInlineParticleEffectLayer(postParticleUrl);
        if (particleLayer) postCard.appendChild(particleLayer);
      }

      const bottomLeft = document.createElement('div');
      bottomLeft.className = 'post-bottom-left';
      bottomLeft.innerHTML = getPostAuthorNameMarkup(authorName, verifiedStickerUrl) + `<div class="post-description">${descHtml}</div>`;

      const actionsRight = document.createElement('div');
      actionsRight.className = 'post-actions-right';
      actionsRight.innerHTML = `
        <div class="post-profile-avatar" data-author-uid="${authorUid}">${avatarContent}</div>
        <button class="action-btn like-btn ${likedClass}" data-post-id="${post.id}">
          <i class="fas fa-heart"></i>
          <span class="like-count">${post.likes || 0}</span>
        </button>
        <button class="action-btn comment-btn" data-post-id="${post.id}">
          <i class="fas fa-comment"></i>
          <span class="comment-count">${commentCount}</span>
        </button>
        <button class="action-btn download-btn" data-post-id="${post.id}" data-download-count="${getPostDownloadUserCount(post)}" aria-label="Abrir menú de descarga. ${getPostDownloadUserCount(post)} usuarios han descargado esta publicación">
          <i class="fi fi-br-arrow-alt-circle-down"></i>
          <span class="download-count">${getPostDownloadUserCount(post)}</span>
        </button>
        ${getPostMusicArtworkMarkup(post)}
      `;

      postCard.appendChild(bottomLeft);
      postCard.appendChild(actionsRight);

      const avatarDiv = postCard.querySelector('.post-profile-avatar');
      if (avatarDiv) {
        avatarDiv.addEventListener('click', function(e) {
          e.stopPropagation();
          const uid = this.dataset.authorUid;
          if (uid && uid !== 'unknown') {
            showUserProfile(uid);
          } else {
            showProfile(currentUserId);
          }
        });
      }
      const likeBtn = postCard.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const postId = this.dataset.postId;
          toggleLike(postId);
        });
      }
      const commentBtn = postCard.querySelector('.comment-btn');
      if (commentBtn) {
        commentBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const postId = this.dataset.postId;
          openComments(postId);
        });
      }

      const downloadBtn = postCard.querySelector('.download-btn');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          const postId = this.dataset.postId;
          showDownloadDialog(postId);
        });
      }

      return postCard;
    }

    // ============================================================
    //  RESTO DE FUNCIONES (savePost, updatePost, etc.)
    // ============================================================
    // ============================================================
    function savePostToFirebase(postData) {
      const postsRef = database.ref('posts');
      const newPostRef = postsRef.push();
      return newPostRef.set(postData);
    }

    function updatePostInFirebase(postId, updates) {
      const postRef = database.ref(`posts/${postId}`);
      return postRef.update(updates);
    }

    function updateUserProfile(uid, data) {
      const profileRef = database.ref(`users/${uid}`);
      return profileRef.update(data);
    }

    function getUserProfile(uid) {
      return new Promise((resolve, reject) => {
        const profileRef = database.ref(`users/${uid}`);
        profileRef.once('value').then(snapshot => {
          const data = snapshot.val();
          if (data) {
            resolve({ ...data, avatar: getResolvedProfileAvatar(data) });
          } else {
            resolve({ name: 'Usuario', bio: '', avatar: null, verifiedSticker: null, followers: {}, following: {}, coins: 0, purchasedItems: [], selectedFrame: null, selectedParticles: null, selectedVerifiedSticker: null, rewardedPosts: {} });
          }
        }).catch(reject);
      });
    }

    function followUser(targetUid) {
      const updates = {};
      updates[`users/${targetUid}/followers/${currentUserId}`] = true;
      updates[`users/${currentUserId}/following/${targetUid}`] = true;
      return database.ref().update(updates);
    }

    function unfollowUser(targetUid) {
      const updates = {};
      updates[`users/${targetUid}/followers/${currentUserId}`] = null;
      updates[`users/${currentUserId}/following/${targetUid}`] = null;
      return database.ref().update(updates);
    }

    // ============================================================
    //  IMGBB
    // ============================================================
    function delay(ms) {
      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });
    }

    let uploadStatusOverlay = null;

    function removeUploadStatusOverlay() {
      if (uploadStatusOverlay && uploadStatusOverlay.parentNode) {
        uploadStatusOverlay.parentNode.removeChild(uploadStatusOverlay);
      }
      uploadStatusOverlay = null;
    }

    function showUploadStatusOverlay(message, isSuccess) {
      removeUploadStatusOverlay();

      uploadStatusOverlay = document.createElement('div');
      uploadStatusOverlay.id = 'uploadStatusOverlay';
      uploadStatusOverlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:6000',
        'background:rgba(0,0,0,0.82)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:20px',
        'backdrop-filter:blur(6px)'
      ].join(';');

      const panel = document.createElement('div');
      panel.style.cssText = [
        'min-width:220px',
        'max-width:320px',
        'background:#111',
        'border:1px solid rgba(255,255,255,0.08)',
        'border-radius:22px',
        'padding:22px 20px',
        'text-align:center',
        'color:#fff',
        'box-shadow:0 18px 40px rgba(0,0,0,0.35)'
      ].join(';');

      const icon = document.createElement('div');
      icon.style.cssText = [
        'width:58px',
        'height:58px',
        'border-radius:50%',
        'margin:0 auto 14px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:24px',
        'background:' + (isSuccess ? 'linear-gradient(145deg, #22c55e, #16a34a)' : 'linear-gradient(145deg, #3b82f6, #2563eb)'),
        'color:#fff'
      ].join(';');
      icon.innerHTML = isSuccess ? '<i class="fas fa-check"></i>' : '<i class="fas fa-spinner fa-spin"></i>';

      const textNode = document.createElement('div');
      textNode.style.cssText = 'font-size:16px;font-weight:700;line-height:1.35;';
      textNode.textContent = message;

      panel.appendChild(icon);
      panel.appendChild(textNode);
      uploadStatusOverlay.appendChild(panel);
      document.body.appendChild(uploadStatusOverlay);
    }

    function extractBase64FromDataUrl(imageDataUrl) {
      if (typeof imageDataUrl !== 'string') return '';
      const commaIndex = imageDataUrl.indexOf(',');
      if (commaIndex === -1) return '';
      return imageDataUrl.slice(commaIndex + 1);
    }

    function sanitizeFileName(fileName) {
      const base = String(fileName || 'image.jpg').trim();
      return base.replace(/[^a-zA-Z0-9._-]+/g, '_');
    }

    async function postImageToImgbb(payload, errorLabel) {
      const response = await fetch(IMGBB_UPLOAD_URL, {
        method: 'POST',
        body: payload
      });

      const responseText = await response.text();
      let data = null;

      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error('ImgBB devolvió una respuesta no válida' + (errorLabel ? ' (' + errorLabel + ')' : '') + '.');
      }

      if (response.ok && data && data.success && data.data && data.data.url) {
        return data.data.url;
      }

      const apiMessage = data && data.error && data.error.message ? data.error.message : 'Respuesta inválida de ImgBB';
      throw new Error(apiMessage + (errorLabel ? ' (' + errorLabel + ')' : ''));
    }

    async function uploadImageOnceToImgbb(imageDataUrl, fileName) {
      if (typeof imageDataUrl !== 'string' || !imageDataUrl.trim()) {
        throw new Error('La imagen no tiene un formato válido.');
      }

      const safeFileName = sanitizeFileName(fileName || 'image.jpg');
      const base64 = extractBase64FromDataUrl(imageDataUrl);

      try {
        const sourceResponse = await fetch(imageDataUrl);
        if (!sourceResponse.ok) {
          throw new Error('No se pudo leer la imagen (' + sourceResponse.status + ').');
        }

        const blob = await sourceResponse.blob();
        const formData = new FormData();
        formData.append('key', IMGBB_API_KEY);
        formData.append('image', blob, safeFileName);
        formData.append('name', safeFileName.replace(/\.[^.]+$/, ''));

        try {
          return await postImageToImgbb(formData, 'blob');
        } catch (blobErr) {
          if (!base64) throw blobErr;
          const fallbackForm = new FormData();
          fallbackForm.append('key', IMGBB_API_KEY);
          fallbackForm.append('image', base64);
          fallbackForm.append('name', safeFileName.replace(/\.[^.]+$/, ''));
          return await postImageToImgbb(fallbackForm, 'base64');
        }
      } catch (sourceErr) {
        if (!base64) throw sourceErr;

        const fallbackForm = new FormData();
        fallbackForm.append('key', IMGBB_API_KEY);
        fallbackForm.append('image', base64);
        fallbackForm.append('name', safeFileName.replace(/\.[^.]+$/, ''));
        return await postImageToImgbb(fallbackForm, 'base64');
      }
    }

    async function uploadImageToImgbb(imageDataUrl, fileName) {
      if (isGifImageUrl(imageDataUrl)) {
        throw new Error('Ese formato no está permitido.');
      }

      let lastError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await uploadImageOnceToImgbb(imageDataUrl, fileName);
        } catch (err) {
          lastError = err;
          if (attempt < 3) {
            await delay(450 * attempt);
          }
        }
      }

      throw lastError || new Error('Error en ImgBB');
    }

    async function uploadMultipleImages(imagesData) {
      const urls = [];

      if (!imagesData || imagesData.length === 0) {
        return urls;
      }

      for (let i = 0; i < imagesData.length; i++) {
        const loadingMsg = document.querySelector('.upload-progress-msg');
        if (loadingMsg) {
          loadingMsg.textContent = 'Subiendo imagen ' + (i + 1) + ' de ' + imagesData.length + '...';
        }

        if (isGifImageUrl(imagesData[i])) {
          continue;
        }

        const fileName = 'post_' + Date.now() + '_' + (i + 1) + '.jpg';
        const url = await uploadImageToImgbb(imagesData[i], fileName);
        urls.push(url);
      }

      return urls;
    }

    // ============================================================
    //  MÚSICA
    // ============================================================
    async function loadMusicFromJson() {
      try {
        const response = await fetch(MUSIC_JSON_URL);
        if (!response.ok) throw new Error('Error al cargar la música');
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          musicList = data.map(item => ({
            value: item.file,
            label: item.title || 'Sin título',
            icon: item.icon || item.iconUrl || item.image || item.cover || item.thumbnail || ''
          }));
        } else {
          throw new Error('Formato de datos inválido');
        }
      } catch (error) {
        console.warn('Error al cargar música desde GitHub, usando lista por defecto:', error);
        musicList = [
          { value: '', label: 'Sin música', icon: '' },
          {
            value: 'https://raw.githubusercontent.com/SterlingPlus-Studio/Musica/main/Musica/MONTAGEM.mp3',
            label: 'MONTAGEM',
            icon: 'https://raw.githubusercontent.com/SterlingPlus-Studio/Musica/main/Icono/MONTAGEM.png'
          },
          {
            value: 'https://raw.githubusercontent.com/SterlingPlus-Studio/Musica/main/Musica/NOOTFUNK.mp3',
            label: 'NOOTFUNK',
            icon: 'https://raw.githubusercontent.com/SterlingPlus-Studio/Musica/main/Icono/NOOTFUNK.png'
          },
        ];
      }
      updateMusicPicker();
    }

    function stringToColor(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 70%, 50%)`;
    }

    function getMusicIconCandidates(item) {
      const candidates = [];
      const add = (value) => {
        if (value && !candidates.includes(value)) candidates.push(value);
      };

      add(item && item.icon);
      add(item && item.iconUrl);
      add(item && item.image);
      add(item && item.cover);
      add(item && item.thumbnail);

      const fileName = (item && item.file ? String(item.file) : '').split('/').pop().split('?')[0];
      if (fileName) {
        const base = fileName.replace(/\.[^.]+$/, '');
        const encodedBase = encodeURIComponent(base);
        const rawRoot = 'https://raw.githubusercontent.com/SterlingPlus-Studio/Musica/main/Icono/';
        ['png', 'jpg', 'jpeg', 'webp'].forEach(ext => add(`${rawRoot}${encodedBase}.${ext}`));
        ['png', 'jpg', 'jpeg', 'webp'].forEach(ext => add(`Icono/${encodedBase}.${ext}`));
      }

      return candidates;
    }

    function getPostMusicData(post) {
      if (!post) return null;

      const musicUrl = String(post.musicUrl || '').trim();
      const musicTitle = String(post.musicTitle || '').trim();
      if (!musicUrl && !musicTitle) return null;

      const normalizedUrl = musicUrl.toLowerCase();
      const normalizedTitle = musicTitle.toLowerCase();

      const matched = Array.isArray(musicList)
        ? musicList.find(function(item) {
            if (!item) return false;
            const itemUrl = String(item.value || '').trim().toLowerCase();
            const itemLabel = String(item.label || '').trim().toLowerCase();
            return (normalizedUrl && itemUrl === normalizedUrl) || (normalizedTitle && itemLabel === normalizedTitle);
          })
        : null;

      return matched || {
        value: musicUrl,
        label: musicTitle || 'Música',
        icon: ''
      };
    }

    function getPostMusicArtworkMarkup(post) {
      const musicItem = getPostMusicData(post);
      if (!musicItem) return '';

      const candidates = getMusicIconCandidates(musicItem);
      const altText = escapeHtml((musicItem.label || post.musicTitle || 'Música').trim() || 'Música');
      const titleText = escapeHtml((musicItem.label || post.musicTitle || 'Música').trim() || 'Música');
      const imageUrl = candidates.length > 0 ? candidates[0] : '';

      if (imageUrl) {
        return `
          <div class="post-music-cover" title="${titleText}" aria-label="${titleText}">
            <img src="${imageUrl}" alt="${altText}" loading="lazy" decoding="async" />
          </div>
        `;
      }

      return `
        <div class="post-music-cover post-music-cover--fallback" title="${titleText}" aria-label="${titleText}">
          <i class="fas fa-music"></i>
        </div>
      `;
    }

    function resetMusicPreview() {
      if (musicPreviewButton) {
        musicPreviewButton.classList.remove('playing');
        musicPreviewButton.innerHTML = '<i class="fas fa-play"></i>';
      }
      musicPreviewButton = null;
      musicPreviewUrl = '';
      musicPickerPreviewAudio.pause();
      musicPickerPreviewAudio.currentTime = 0;
      musicPickerPreviewAudio.src = '';
    }

    function toggleMusicPreview(item, button, event) {
      if (event) event.stopPropagation();
      if (!item || !item.value) return;

      if (musicPreviewUrl === item.value && !musicPickerPreviewAudio.paused) {
        resetMusicPreview();
        return;
      }

      if (musicPreviewButton && musicPreviewButton !== button) {
        musicPreviewButton.classList.remove('playing');
        musicPreviewButton.innerHTML = '<i class="fas fa-play"></i>';
      }

      musicPreviewButton = button;
      musicPreviewUrl = item.value;

      musicPickerPreviewAudio.pause();
      musicPickerPreviewAudio.src = item.value;
      musicPickerPreviewAudio.currentTime = 0;

      const playPromise = musicPickerPreviewAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function() {
          if (musicPreviewButton === button) {
            button.classList.add('playing');
            button.innerHTML = '<i class="fas fa-pause"></i>';
          }
        }).catch(function(err) {
          console.warn('No se pudo reproducir la vista previa:', err);
          if (musicPreviewButton === button) {
            button.classList.remove('playing');
            button.innerHTML = '<i class="fas fa-play"></i>';
          }
        });
      } else {
        button.classList.add('playing');
        button.innerHTML = '<i class="fas fa-pause"></i>';
      }

      musicPickerPreviewAudio.onended = function() {
        if (musicPreviewButton === button) {
          button.classList.remove('playing');
          button.innerHTML = '<i class="fas fa-play"></i>';
          musicPreviewButton = null;
          musicPreviewUrl = '';
        }
      };
    }

    function renderMusicCover(coverEl, item, fallbackHtml) {
      if (!coverEl) return;

      const label = item && item.label ? item.label : 'Sin música';
      const color = label !== 'Sin música' ? stringToColor(label) : '#444';
      const candidates = getMusicIconCandidates(item);

      coverEl.style.background = color;

      if (!candidates.length) {
        coverEl.innerHTML = fallbackHtml;
        return;
      }

      const img = document.createElement('img');
      let index = 0;

      const tryNext = () => {
        if (index >= candidates.length) {
          coverEl.innerHTML = fallbackHtml;
          coverEl.style.background = color;
          return;
        }
        img.src = candidates[index++];
      };

      img.onerror = tryNext;
      img.onload = () => {
        coverEl.innerHTML = '';
        coverEl.appendChild(img);
      };

      tryNext();
    }

    function updateMusicPicker() {
      const selectBtn = document.getElementById('musicSelectBtn');
      const list = document.getElementById('musicPickerList');
      const searchInput = document.getElementById('musicSearchInput');
      if (!selectBtn || !list) return;

      const currentValue = selectBtn.dataset.value || '';
      const query = searchInput ? searchInput.value.toLowerCase() : '';

      const filteredList = musicList.filter(item => 
        (item.label || '').toLowerCase().includes(query)
      );

      const selected = musicList.find(m => m.value === currentValue) || musicList[0] || { value: '', label: 'Sin música', icon: '' };
      const coverDiv = selectBtn.querySelector('.cover');
      const infoSpan = selectBtn.querySelector('.info');
      if (coverDiv) {
        renderMusicCover(coverDiv, selected, '<i class="fas fa-music"></i>');
      }
      if (infoSpan) {
        infoSpan.textContent = selected.label || 'Sin música';
      }

      list.innerHTML = '';
      if (filteredList.length === 0) {
        list.innerHTML = '<div class="music-empty-message">No se encontraron canciones</div>';
        return;
      }

      filteredList.forEach(function(item) {
        const div = document.createElement('div');
        div.className = 'music-picker-item';
        if (item.value === currentValue) {
          div.style.background = '#2a2a2a';
        }

        const actions = document.createElement('div');
        actions.className = 'music-actions';

        const check = document.createElement('div');
        check.className = 'check' + (item.value === currentValue ? '' : ' hidden');
        check.innerHTML = '<i class="fas fa-check-circle"></i>';

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'preview-btn';
        previewBtn.innerHTML = '<i class="fas fa-play"></i>';
        previewBtn.addEventListener('click', function(e) {
          toggleMusicPreview(item, previewBtn, e);
        });

        const cover = document.createElement('div');
        cover.className = 'cover';
        renderMusicCover(cover, item, '🎵');

        const info = document.createElement('div');
        info.className = 'info';
        info.innerHTML = '<div class="title">' + (item.label || 'Sin música') + '</div><div class="sub">' + (item.value ? 'Canción' : 'Sin audio') + '</div>';

        actions.appendChild(check);
        actions.appendChild(previewBtn);

        div.appendChild(cover);
        div.appendChild(info);
        div.appendChild(actions);

        div.addEventListener('click', function() {
          selectBtn.dataset.value = item.value;
          resetMusicPreview();
          closeMusicPicker();
          updateMusicPicker();
          if (item.value) {
            globalAudio.pause();
            try {
              globalAudio.currentTime = 0;
            } catch (err) {}
            globalAudio.autoplay = false;
            globalAudio.removeAttribute('autoplay');
            globalAudio.src = item.value;
            globalAudio.load();
          } else {
            stopAllMusic();
          }
        });

        list.appendChild(div);
      });
    }

    function openMusicPicker() {
      musicPickerOverlay.classList.add('active');
      updateMusicPicker();
      setTimeout(() => {
        void 0;
      }, 100);
    }

    function closeMusicPicker() {
      musicPickerOverlay.classList.remove('active');
      resetMusicPreview();
      if (musicSearchInput) musicSearchInput.value = '';
    }

    // ============================================================
    //  FEED MUSIC PLAYER — AHORA SIEMPRE REINICIA
    // ============================================================
    function playFeedMusic(postId, url) {
      if (!url || !isHomeScreenActive()) return;
      primeAudioSource(url);

      // Siempre detener el audio actual y reiniciar
      stopAllMusic();

      // Si la URL es la misma, simplemente reiniciamos
      if (globalAudio.src === url) {
        try {
          globalAudio.currentTime = 0;
        } catch (err) {}
        globalAudio.play().then(() => {
          audioUnlocked = true;
          currentFeedAudioPostId = postId;
          isPlaying = true;
        }).catch(err => {
          console.warn('Error al reiniciar la música:', err);
          currentFeedAudioPostId = null;
          isPlaying = false;
        });
        return;
      }

      // URL diferente: cargar nueva fuente
      globalAudio.src = url;
      globalAudio.load();

      const playFn = () => {
        globalAudio.play().then(() => {
          audioUnlocked = true;
          currentFeedAudioPostId = postId;
          isPlaying = true;
        }).catch(err => {
          console.warn('Error al reproducir en feed:', err);
          currentFeedAudioPostId = null;
          isPlaying = false;
        });
      };

      if (globalAudio.readyState >= 2) {
        playFn();
      } else {
        globalAudio.addEventListener('canplaythrough', playFn, { once: true });
        setTimeout(() => {
          if (currentFeedAudioPostId !== postId) {
            globalAudio.removeEventListener('canplaythrough', playFn);
            playFn();
          }
        }, 3000);
      }
    }

    function tryAutoPlayFirstMusic() {
      if (!isHomeScreenActive()) return;
      if (autoPlayAttempted) return;
      const feedPosts = getFeedPostsForCurrentMode();
      if (feedPosts.length === 0) return;
      const firstWithMusic = feedPosts.find(function(p) { return p.musicUrl; });
      if (firstWithMusic) {
        autoPlayAttempted = true;
        primeAudioSource(firstWithMusic.musicUrl);
        playFeedMusic(firstWithMusic.id, firstWithMusic.musicUrl);
        const playOnInteraction = function() {
          startExperience();
          document.removeEventListener('click', playOnInteraction);
          document.removeEventListener('touchstart', playOnInteraction);
        };
        document.addEventListener('click', playOnInteraction, { once: true });
        document.addEventListener('touchstart', playOnInteraction, { once: true });
      }
    }

    function setupFeedObserver() {
      if (feedObserver) {
        feedObserver.disconnect();
        feedObserver = null;
      }

      const container = document.getElementById('feedContainer');
      if (!container || !isHomeScreenActive()) return;

      const observerOptions = {
        root: mainContent,
        rootMargin: '0px',
        threshold: 0.6
      };

      feedObserver = new IntersectionObserver((entries) => {
        if (!isHomeScreenActive()) return;

        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const card = entry.target;
          const postId = card.dataset.postId;

          if (feedMode === 'following' || feedMode === 'recent') {
            markFeedPostAsSeen(postId);
          }

          if (!audioUnlocked) return;

          const post = posts.find(p => p.id === postId);

          if (post && post.musicUrl) {
            if (globalAudio.src !== post.musicUrl) {
              stopAllMusic();
              globalAudio.src = post.musicUrl;
              globalAudio.load();
              globalAudio.play().then(() => {
                currentFeedAudioPostId = postId;
              }).catch(e => console.warn("Autoplay al deslizar bloqueado:", e));
            } else {
              if (globalAudio.paused) {
                globalAudio.play();
              } else {
                try {
                  globalAudio.currentTime = 0;
                } catch (err) {}
              }
            }
          } else {
            globalAudio.pause();
          }
        });
      }, observerOptions);

      document.querySelectorAll('.post-card').forEach(card => {
        feedObserver.observe(card);
      });
    }

    function setupFeedAutoPlay() {
      setupFeedObserver();
    }

    // ---- UI HELPERS ----
    function showTopBar(show) {
      if (show) {
        topBar.classList.remove('hidden');
        body.classList.remove('top-bar-hidden');
      } else {
        topBar.classList.add('hidden');
        body.classList.add('top-bar-hidden');
      }
      body.classList.toggle('feed-mode-visible', !!show && activeScreen === 'home');
      if (feedModeSwitcher) {
        feedModeSwitcher.classList.toggle('hidden', !(!!show && activeScreen === 'home'));
      }
    }

    function getPostTimestampValue(post) {
      if (!post) return 0;
      const raw = post.timestamp ?? post.createdAt ?? post.publishedAt ?? post.date ?? post.time ?? 0;
      if (typeof raw === 'number' && !isNaN(raw)) return raw;
      if (typeof raw === 'string' && raw.trim()) {
        const numeric = Number(raw);
        if (!isNaN(numeric)) return numeric;
        const parsed = Date.parse(raw);
        if (!isNaN(parsed)) return parsed;
      }
      return 0;
    }

    function getNewestPostTimestamp() {
      if (!Array.isArray(posts) || posts.length === 0) return 0;
      return posts.reduce(function(maxValue, post) {
        const ts = getPostTimestampValue(post);
        return ts > maxValue ? ts : maxValue;
      }, 0);
    }

    function updateRecentPostsBadge() {
      if (!recentPostsBadge) return;
      const count = getFeedRemainingCount('recent');
      recentPostsBadge.textContent = String(count);
      recentPostsBadge.classList.toggle('hidden', count <= 0);
    }

    function updateFeedModeUI() {
      if (!feedModeSwitcher) return;
      const buttons = feedModeSwitcher.querySelectorAll('[data-mode]');
      buttons.forEach(function(button) {
        const isActive = button.dataset.mode === feedMode;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      updateRecentPostsBadge();
      updateFeedTerminalCard();
    }

    function syncRandomPostOrderWithCurrentPosts() {
      const currentIds = posts.map(function(post) { return post.id; });
      if (postOrder.length === 0) {
        postOrder = buildRandomOrder(currentIds);
        return;
      }
      postOrder = postOrder.filter(function(id) {
        return currentIds.includes(id);
      });
      const newIds = currentIds.filter(function(id) {
        return !postOrder.includes(id);
      });
      newIds.forEach(function(id) {
        insertNewPostInOrder(id);
      });
    }

    function sortPostsForCurrentFeedMode() {
      if (!Array.isArray(posts) || posts.length === 0) return;

      if (feedMode === 'recent' || feedMode === 'following') {
        posts.sort(function(a, b) {
          const diff = getPostTimestampValue(b) - getPostTimestampValue(a);
          if (diff !== 0) return diff;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
        return;
      }

      syncRandomPostOrderWithCurrentPosts();
      posts.sort(function(a, b) {
        return postOrder.indexOf(a.id) - postOrder.indexOf(b.id);
      });
    }

    function setFeedMode(nextMode, options) {
      const opts = options || {};
      const normalizedMode = nextMode === 'recent' || nextMode === 'following' ? nextMode : 'for-you';
      feedMode = normalizedMode;
      localStorage.setItem('snappix_feed_mode', feedMode);

      sortPostsForCurrentFeedMode();
      updateFeedModeUI();

      const shouldScrollToTop = opts.scrollToTop !== false;
      const currentScrollTop = mainContent.scrollTop || 0;
      updateFeedContainer(shouldScrollToTop ? 0 : currentScrollTop);
    }

    function freezeMainContentAtScroll(scrollTop) {
      if (!mainContent) return;
      const target = typeof scrollTop === 'number' ? scrollTop : (mainContent.scrollTop || 0);
      if (!mainContentFrozenState) {
        mainContentFrozenState = {
          position: mainContent.style.position || '',
          top: mainContent.style.top || '',
          left: mainContent.style.left || '',
          right: mainContent.style.right || '',
          width: mainContent.style.width || '',
          overflow: mainContent.style.overflow || '',
          scrollBehavior: mainContent.style.scrollBehavior || '',
          overscrollBehavior: mainContent.style.overscrollBehavior || '',
          touchAction: mainContent.style.touchAction || ''
        };
      }
      mainContent.style.position = 'fixed';
      mainContent.style.top = (-target) + 'px';
      mainContent.style.left = '0';
      mainContent.style.right = '0';
      mainContent.style.width = '100%';
      mainContent.style.overflow = 'hidden';
      mainContent.style.scrollBehavior = 'auto';
      mainContent.style.overscrollBehavior = 'none';
      mainContent.style.touchAction = 'none';
      mainContent.scrollTop = target;
    }

    function unfreezeMainContent(scrollTop) {
      if (!mainContent) return;
      const target = typeof scrollTop === 'number' ? scrollTop : (mainContent.scrollTop || 0);
      if (mainContentFrozenState) {
        mainContent.style.position = mainContentFrozenState.position;
        mainContent.style.top = mainContentFrozenState.top;
        mainContent.style.left = mainContentFrozenState.left;
        mainContent.style.right = mainContentFrozenState.right;
        mainContent.style.width = mainContentFrozenState.width;
        mainContent.style.overflow = mainContentFrozenState.overflow;
        mainContent.style.scrollBehavior = mainContentFrozenState.scrollBehavior;
        mainContent.style.overscrollBehavior = mainContentFrozenState.overscrollBehavior;
        mainContent.style.touchAction = mainContentFrozenState.touchAction;
        mainContentFrozenState = null;
      } else {
        mainContent.style.position = '';
        mainContent.style.top = '';
        mainContent.style.left = '';
        mainContent.style.right = '';
        mainContent.style.width = '';
        mainContent.style.overflow = '';
        mainContent.style.scrollBehavior = '';
        mainContent.style.overscrollBehavior = '';
        mainContent.style.touchAction = '';
      }
      requestAnimationFrame(function() {
        mainContent.scrollTop = target;
      });
    }

    // ---- RENDER FEED ----
    function renderFeed() {
      updateFeedContainer();
    }

    // ---- NAVEGAR A POST ----
    function goToPost(postId) {
      const feedContainer = document.getElementById('feedContainer');
      if (!feedContainer) {
        showHome();
        setTimeout(() => {
          const cards = document.querySelectorAll('.post-card');
          let target = null;
          cards.forEach(c => {
            if (c.dataset.postId === postId) target = c;
          });
          if (target) {
            target.scrollIntoView({ block: 'start' });
          } else {
            renderFeed();
            setTimeout(() => {
              const cards2 = document.querySelectorAll('.post-card');
              let target2 = null;
              cards2.forEach(c => {
                if (c.dataset.postId === postId) target2 = c;
              });
              if (target2) {
                target2.scrollIntoView({ block: 'start' });
              }
            }, 300);
          }
        }, 300);
      } else {
        const cards = document.querySelectorAll('.post-card');
        let target = null;
        cards.forEach(c => {
          if (c.dataset.postId === postId) target = c;
        });
        if (target) {
          target.scrollIntoView({ block: 'start' });
        } else {
          renderFeed();
          setTimeout(() => {
            const cards2 = document.querySelectorAll('.post-card');
            let target2 = null;
            cards2.forEach(c => {
              if (c.dataset.postId === postId) target2 = c;
            });
            if (target2) {
              target2.scrollIntoView({ block: 'start' });
            }
          }, 300);
        }
      }
    }

    // ---- LIKES (con transacción y control de monedas) ----
    function updateLikeInDOM(postId, isLiked, newLikes) {
      const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
      if (!postCard) return;
      const likeBtn = postCard.querySelector('.like-btn');
      const likeCount = postCard.querySelector('.like-count');
      if (likeBtn) {
        likeBtn.classList.toggle('liked', isLiked);
      }
      if (likeCount) {
        likeCount.textContent = newLikes;
      }
    }

    function toggleLike(postId) {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      const isLiked = post.liked;
      const newLiked = !isLiked;

      // Evitar múltiples llamadas mientras se actualiza
      if (isUpdatingLike) return;
      isUpdatingLike = true;

      // Actualizar estado local inmediatamente (optimista)
      const currentLikes = post.likes || 0;
      const newLikes = currentLikes + (newLiked ? 1 : -1);
      // No permitir que baje de 0
      const finalLikes = Math.max(0, newLikes);
      post.liked = newLiked;
      post.likes = finalLikes;
      updateLikeInDOM(postId, newLiked, finalLikes);

      // Actualizar array de likedPosts del usuario
      let updatedLikedPosts = [...profileData.likedPosts];
      const wasLikedBefore = updatedLikedPosts.includes(postId);
      if (newLiked) {
        if (!wasLikedBefore) updatedLikedPosts.push(postId);
      } else {
        updatedLikedPosts = updatedLikedPosts.filter(id => id !== postId);
      }
      profileData.likedPosts = updatedLikedPosts;

      // Actualizar en Firebase con transacción para el contador de likes
      const postRef = database.ref(`posts/${postId}/likes`);
      postRef.transaction(function(current) {
        if (current === undefined || current === null) return newLiked ? 1 : 0;
        if (newLiked) {
          return (current || 0) + 1;
        } else {
          // No permitir que baje de 0
          return Math.max(0, (current || 0) - 1);
        }
      }, function(error, committed, snapshot) {
        if (error) {
          console.warn('Error en transacción de likes:', error);
          // Revertir estado local
          post.liked = isLiked;
          post.likes = (post.likes || 0) + (newLiked ? -1 : 1);
          profileData.likedPosts = isLiked ? [...profileData.likedPosts, postId] : profileData.likedPosts.filter(id => id !== postId);
          updateLikeInDOM(postId, isLiked, post.likes);
          isUpdatingLike = false;
          return;
        }

        // Actualizar perfil del usuario (array likedPosts)
        updateUserProfile(auth.currentUser.uid, { likedPosts: updatedLikedPosts })
          .then(() => {
            // Recompensa por like: solo si es nuevo like, a otro usuario, y no ha sido recompensado antes
            if (newLiked && !wasLikedBefore && post.authorUid && post.authorUid !== currentUserId) {
              if (!hasUserRewardedPost(postId, 'liked')) {
                addCoins(currentUserId, 5);
                markPostRewarded(postId, 'liked');
              }
            }
            isUpdatingLike = false;
          })
          .catch(err => {
            console.warn('Error al actualizar likedPosts:', err);
            isUpdatingLike = false;
          });
      });
    }

    // ---- COMENTARIOS ----
    function openComments(postId) {
      const savedScrollTop = mainContent.scrollTop || 0;
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      currentCommentPostId = postId;
      if (!post.comments) post.comments = [];
      commentsOverlay.classList.add('active');
      commentInput.value = '';
      renderComments(post.comments, false);
      lockCommentsFeedPosition(savedScrollTop);
      // El teclado no se abre automáticamente al entrar en comentarios.
      setTimeout(function() {
        adjustCommentInputForKeyboard(false);
      }, 300);
      setTimeout(function() {
        lockCommentsFeedPosition(savedScrollTop);
        adjustCommentInputForKeyboard(true);
      }, 0);
      setTimeout(function() {
        lockCommentsFeedPosition(savedScrollTop);
        adjustCommentInputForKeyboard(true);
      }, 120);
      setTimeout(function() {
        lockCommentsFeedPosition(savedScrollTop);
      }, 240);
    }

    function closeComments() {
      const savedScrollTop = mainContent.scrollTop || feedScrollTop || 0;
      commentsOverlay.classList.remove('active');
      commentsOverlay.style.height = '';
      currentCommentPostId = null;
      if (commentInput) commentInput.blur();
      unlockCommentsFeedPosition(savedScrollTop);
    }

    function renderComments(comments, autoScrollToBottom) {
      if (!comments || comments.length === 0) {
        commentsList.innerHTML = `<div class="no-comments">No hay comentarios aún. ¡Sé el primero!</div>`;
        return;
      }
      let html = '';
      comments.forEach(comment => {
        const avatarHtml = comment.avatar
          ? `<img src="${comment.avatar}" alt="avatar" />`
          : `<span style="font-size:14px;">${(comment.author || '?').charAt(0).toUpperCase()}</span>`;
        html += `
          <div class="comment-item">
            <div class="avatar">${avatarHtml}</div>
            <div class="body">
              <div class="author">${comment.author || 'Anónimo'}</div>
              <div class="text">${comment.text}</div>
              <div class="time">${comment.timestamp || 'Ahora'}</div>
            </div>
          </div>
        `;
      });
      commentsList.innerHTML = html;
      requestAnimationFrame(function() {
        if (autoScrollToBottom !== false) {
          commentsList.scrollTop = commentsList.scrollHeight;
        }
        adjustCommentInputForKeyboard(false);
      });
    }

    function addComment() {
      const text = commentInput.value.trim();
      if (!text || currentCommentPostId === null) return;
      const post = posts.find(p => p.id === currentCommentPostId);
      if (!post) return;
      if (!post.comments) post.comments = [];
      const newComment = {
        author: profileData.name,
        text: text,
        timestamp: new Date().toLocaleString(),
        avatar: profileData.avatar || null
      };
      post.comments.push(newComment);
      updatePostInFirebase(post.id, {
        comments: post.comments
      }).then(() => {
        // Recompensa por comentario: solo si no ha sido recompensado antes
        if (!hasUserRewardedPost(post.id, 'commented')) {
          addCoins(currentUserId, 10);
          markPostRewarded(post.id, 'commented');
        }
      }).catch(err => {
        console.warn('Error al guardar comentario en Firebase:', err);
      });
      renderComments(post.comments, true);
      commentInput.value = '';
      const commentCountSpan = document.querySelector(`.post-card[data-post-id="${post.id}"] .comment-count`);
      if (commentCountSpan) {
        commentCountSpan.textContent = post.comments.length;
      }
    }

    // ---- BÚSQUEDA (solo publicaciones) ----
    let searchQuery = '';

    function showSearchView() {
      saveFeedScrollPosition();
      setActiveScreen('search');
      stopAllMusic();
      closeComments();
      clearMainContent();
      showTopBar(false);

      const container = document.createElement('div');
      container.className = 'search-view active';
      container.id = 'searchView';

      container.innerHTML = `
        <div class="search-header">
          <button class="back-btn" id="searchBackBtn"><i class="fas fa-arrow-left"></i></button>
          <div class="search-input-shell">
            <i class="fi fi-rr-search"></i>
            <input type="text" id="searchInput" placeholder="Buscar publicaciones, música o texto..." />
          </div>
        </div>
        <div class="search-meta">
          <span class="search-meta-chip" id="searchResultCount">0 resultados</span>
        </div>
        <div class="search-results" id="searchResults"></div>
      `;

      mainContent.appendChild(container);
      requestAnimationFrame(function() {
        mainContent.scrollTop = 0;
      });

      const searchInput = document.getElementById('searchInput');
      const searchResults = document.getElementById('searchResults');

      function getRandomSuggestions() {
        const results = [];
        const shuffled = shuffleArray([...posts]);
        const sliced = shuffled.slice(0, 10);
        sliced.forEach(post => {
          const imgSrc = getPostImageUrls(post)[0] || '';
          results.push({
            id: post.id,
            image: imgSrc,
            desc: post.description || 'Sin descripción',
            music: post.musicTitle || ''
          });
        });
        return results;
      }

      function getSearchPreviewText(item) {
        const baseText = (item.desc || item.description || 'Sin descripción').toString().trim();
        return baseText.length > 72 ? baseText.substring(0, 72) + '...' : baseText;
      }

      function getSearchPostImage(item) {
        if (!item) return '';
        if (item.image) return item.image;
        if (item.imageUrl) return item.imageUrl;
        if (item.images && item.images.length > 0) return item.images[0];
        return '';
      }

      
function buildSearchPostCard(item, postId) {
        const imageSrc = getSearchPostImage(item);
        const previewText = getSearchPreviewText(item);
        const musicText = (item.music || item.musicTitle || '').toString().trim();
        return `
          <div class="search-result-item search-post-card" data-post-id="${postId}">
            <div class="search-post-media ${imageSrc ? '' : 'empty'}">
              ${imageSrc ? `
                <div class="lazy-media-shell">
                  
                  <img src="${TRANSPARENT_PLACEHOLDER_SRC}" data-lazy-src="${imageSrc}" alt="Preview" loading="eager" decoding="async" />
                </div>` : `<div class="search-post-placeholder"><i class="fas fa-image"></i></div>`}
            </div>
            <div class="search-post-overlay">
              <div class="search-post-desc">${previewText}</div>
              ${musicText ? `<div class="search-post-tag">🎵 ${musicText}</div>` : ''}
            </div>
          </div>
        `;
      }

      function renderSearchResults(query) {

        if (!searchResults) return;
        searchResults.className = 'search-results';
        const searchCountEl = document.getElementById('searchResultCount');
        const normalizedQuery = (query || '').trim().toLowerCase();

        if (normalizedQuery.length === 0) {
          const suggestions = getRandomSuggestions();
          if (searchCountEl) {
            searchCountEl.textContent = suggestions.length + ' sugerencias';
          }
          if (suggestions.length === 0) {
            searchResults.innerHTML = `
              <div class="search-empty">
                <i class="fas fa-search"></i>
                <p>No hay sugerencias disponibles</p>
              </div>
            `;
            return;
          }
          let html = '';
          suggestions.forEach(item => {
            html += buildSearchPostCard(item, item.id);
          });
          searchResults.innerHTML = html;
          if (!genericLazyImageObserver) setupGenericLazyImageObserver();
          loadLazyImagesInContainer(searchResults);
          scheduleImageRecoveryScan(searchResults, true);
          searchResults.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', function() {
              const postId = this.dataset.postId;
              closeSearchAndGoToPost(postId);
            });
          });
          return;
        }

        const results = posts.filter(post => {
          const desc = (post.description || '').toLowerCase();
          const music = (post.musicTitle || post.music || '').toLowerCase();
          const author = (post.authorName || '').toLowerCase();
          return desc.includes(normalizedQuery) || music.includes(normalizedQuery) || author.includes(normalizedQuery);
        });

        if (searchCountEl) {
          searchCountEl.textContent = results.length + (results.length === 1 ? ' resultado' : ' resultados');
        }

        if (results.length === 0) {
          searchResults.innerHTML = `
            <div class="search-empty">
              <i class="fas fa-times-circle"></i>
              <p>No se encontraron publicaciones con "${query}"</p>
            </div>
          `;
          return;
        }

        let html = '';
        results.forEach(post => {
          html += buildSearchPostCard(post, post.id);
        });
        searchResults.innerHTML = html;
        if (!genericLazyImageObserver) setupGenericLazyImageObserver();
        loadLazyImagesInContainer(searchResults);
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', function() {
            const postId = this.dataset.postId;
            closeSearchAndGoToPost(postId);
          });
        });
      }

      searchInput.addEventListener('input', function() {
        searchQuery = this.value.trim();
        renderSearchResults(searchQuery);
      });

      document.getElementById('searchBackBtn').addEventListener('click', closeSearch);

      renderSearchResults('');
    }

    function closeSearch() {
      const searchView = document.getElementById('searchView');
      if (searchView) searchView.remove();
      showHome();
    }

    function closeSearchAndGoToPost(postId) {
      const searchView = document.getElementById('searchView');
      if (searchView) searchView.remove();
      showHome();
      setTimeout(() => {
        const cards = document.querySelectorAll('.post-card');
        let targetCard = null;
        cards.forEach(card => {
          if (card.dataset.postId === postId) {
            targetCard = card;
          }
        });
        if (targetCard) {
          targetCard.scrollIntoView({ block: 'start' });
        }
      }, 300);
    }

    // ============================================================
    //  TIENDA (CORREGIDO: pago al vendedor)
    // ============================================================
    function loadUserShopItems() {
      const itemsRef = database.ref('userShopItems');
      itemsRef.off();
      itemsRef.on('value', function(snapshot) {
        const data = snapshot.val();
        const removedIds = [];
        if (data) {
          userShopItems = Object.keys(data).map(function(key) {
            return { id: key, ...data[key] };
          }).filter(function(item) {
            if (!item) return false;
            if (isGifImageUrl(item.imageUrl)) {
              removedIds.push(item.id);
              return false;
            }
            return true;
          });
        } else {
          userShopItems = [];
        }

        if (removedIds.length > 0) {
          removedIds.forEach(function(id) {
            itemsRef.child(id).remove().catch(function(err) {
              console.warn('No se pudo eliminar el item no permitido ' + id + ':', err);
            });
          });

          database.ref('users').once('value').then(function(usersSnapshot) {
            const usersData = usersSnapshot.val() || {};
            const updates = {};
            Object.keys(usersData).forEach(function(uid) {
              const user = usersData[uid];
              if (!user || typeof user !== 'object') return;

              const patch = {};
              let changed = false;

              if (user.avatar && !sanitizeRenderableImageUrl(user.avatar)) {
                patch.avatar = null;
                changed = true;
              }

              if (Array.isArray(user.purchasedItems)) {
                const filteredPurchased = user.purchasedItems.filter(function(itemId) {
                  return !removedIds.includes(String(itemId));
                });
                if (filteredPurchased.length !== user.purchasedItems.length) {
                  patch.purchasedItems = filteredPurchased;
                  changed = true;
                }
              }

              ['selectedFrame', 'selectedParticles', 'selectedVerifiedSticker'].forEach(function(field) {
                if (user[field] && removedIds.includes(String(user[field]))) {
                  patch[field] = null;
                  changed = true;
                }
              });

              if (changed) {
                Object.assign(updates, Object.fromEntries(Object.keys(patch).map(function(key) {
                  return [`users/${uid}/${key}`, patch[key]];
                })));
              }
            });

            if (Object.keys(updates).length > 0) {
              return database.ref().update(updates);
            }
            return null;
          }).catch(function(err) {
            console.warn('No se pudieron limpiar los perfiles después de eliminar items no permitidos:', err);
          });
        }

        pruneAllLoadedProfilesAgainstShop();

        if (currentUserId) {
          profileData.avatar = sanitizeRenderableImageUrl(profileData.avatar) || null;
          if (userProfiles[currentUserId]) {
            userProfiles[currentUserId] = { ...userProfiles[currentUserId], avatar: sanitizeRenderableImageUrl(userProfiles[currentUserId].avatar) || null };
          }
          Object.keys(userProfiles).forEach(function(uid) {
            const user = userProfiles[uid];
            if (user) {
              userProfiles[uid] = { ...user, avatar: sanitizeRenderableImageUrl(user.avatar) || null };
            }
          });
        }
        if (document.getElementById('shopView')) {
          renderShop();
        }
      });
    }

    function renderShop() {
      let container = document.getElementById('shopView');
      if (!container) {
        container = document.createElement('div');
        container.className = 'shop-view active';
        container.id = 'shopView';
        mainContent.appendChild(container);
      } else {
        container.innerHTML = '';
      }      let html = `
        <div class="shop-header">
          <h2><i class="fas fa-store"></i> Tienda</h2>
          <div class="shop-actions">
            <div class="shop-coins"><i class="fas fa-coins coin-icon" aria-hidden="true"></i><span class="coin-amount">${profileData.coins || 0}</span></div>
            <button class="shop-upload-btn" id="shopUploadBtn"><i class="fas fa-upload"></i> Subir</button>
          </div>
        </div>
      `;

      // Agrupar items por categoría
      const categories = {
        profileFrames: { title: 'Foto de perfil', icon: 'fas fa-id-card' },
        particles: { title: 'Partículas', icon: 'fas fa-wand-magic-sparkles' },
        verifiedStickers: { title: 'Iconos verificado', icon: 'fas fa-check-circle' }
      };

      let hasItems = false;
      for (const [key, cat] of Object.entries(categories)) {
        const items = sortItemsNewestFirst(userShopItems
          .filter(function(item) { return item.category === key; }));
        if (items.length === 0) continue;
        hasItems = true;
        html += `<div class="shop-section"><div class="shop-section-title"><i class="${cat.icon}"></i> ${cat.title}</div><div class="shop-scroll">`;
        items.forEach(item => {
          const owned = (profileData.purchasedItems && profileData.purchasedItems.includes(item.id)) || item.ownerId === currentUserId;
          const price = item.price || 0;
          const iconHtml = sanitizeRenderableImageUrl(item.imageUrl) ? `<img src="${sanitizeRenderableImageUrl(item.imageUrl)}" alt="Item" />` : `<i class="fas fa-box"></i>`;
          html += `
            <div class="shop-item">
              <div class="icon">${iconHtml}</div>
              <button class="buy-btn ${owned ? 'owned-btn' : ''}" data-item-id="${item.id}" data-price="${price}" ${owned ? 'disabled' : ''}>
                ${owned ? 'Poseído' : `<span class="buy-btn-price"><i class="fas fa-coins coin-icon" aria-hidden="true"></i> ${price}</span><span class="buy-btn-label">Comprar</span>`}
              </button>
            </div>
          `;
        });
        html += '</div></div>';
      }

      if (!hasItems) {
        html += `<p style="color:#666; text-align:center; padding:20px;">No hay items disponibles en la tienda. ¡Sé el primero en subir uno!</p>`;
      }

      container.innerHTML = html;

      // Eventos de compra
      container.querySelectorAll('.buy-btn:not(.owned-btn)').forEach(btn => {
        btn.addEventListener('click', function() {
          const itemId = this.dataset.itemId;
          const price = parseInt(this.dataset.price);
          if (isNaN(price) || !itemId) return;
          if (profileData.coins < price) {
            alert('No tienes suficientes monedas.');
            return;
          }
          if (profileData.purchasedItems && profileData.purchasedItems.includes(itemId)) {
            alert('Ya posees este item.');
            return;
          }
          pendingBuyItemId = itemId;
          buyConfirmOverlay.classList.add('active');
        });
      });

      // Botón subir item
      const uploadBtn = container.querySelector('#shopUploadBtn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
          uploadItemOverlay.classList.add('active');
          uploadImageData = null;
          uploadImagePreview.innerHTML = '<i class="fas fa-image"></i>';
          uploadImagePreview.style.backgroundImage = '';
          uploadItemCategory.value = 'profileFrames';
          uploadItemPrice.value = 50;
        });
      }
    }

    // Confirmación de compra (CORREGIDO: pago al vendedor)
    buyConfirmCancel.addEventListener('click', function() {
      buyConfirmOverlay.classList.remove('active');
      pendingBuyItemId = null;
    });

    buyConfirmAccept.addEventListener('click', function() {
      const itemId = pendingBuyItemId;
      if (!itemId) {
        buyConfirmOverlay.classList.remove('active');
        return;
      }
      const item = userShopItems.find(it => it.id === itemId);
      if (!item) {
        alert('Item no encontrado.');
        buyConfirmOverlay.classList.remove('active');
        pendingBuyItemId = null;
        return;
      }
      const price = item.price || 0;
      if (profileData.coins < price) {
        alert('No tienes suficientes monedas.');
        buyConfirmOverlay.classList.remove('active');
        pendingBuyItemId = null;
        return;
      }
      if (profileData.purchasedItems && profileData.purchasedItems.includes(itemId)) {
        alert('Ya posees este item.');
        buyConfirmOverlay.classList.remove('active');
        pendingBuyItemId = null;
        return;
      }
      if (item.ownerId && item.ownerId === currentUserId) {
        alert('No puedes comprar tu propio item.');
        buyConfirmOverlay.classList.remove('active');
        pendingBuyItemId = null;
        return;
      }

      // Transacción para el comprador
      const userRef = database.ref('users/' + currentUserId);
      userRef.transaction(function(user) {
        if (!user) return user;
        const currentCoins = Number(user.coins || 0);
        const purchasedItems = Array.isArray(user.purchasedItems) ? user.purchasedItems.slice() : [];
        if (currentCoins < price) return;
        if (purchasedItems.includes(itemId)) return;
        user.coins = currentCoins - price;
        purchasedItems.push(itemId);
        user.purchasedItems = purchasedItems;
        return user;
      }, function(error, committed, snapshot) {
        if (error) {
          alert('Error al comprar: ' + error.message);
          buyConfirmOverlay.classList.remove('active');
          pendingBuyItemId = null;
          return;
        }
        if (!committed || !snapshot || !snapshot.val()) {
          alert('No se pudo completar la compra.');
          buyConfirmOverlay.classList.remove('active');
          pendingBuyItemId = null;
          return;
        }
        const updatedUser = snapshot.val() || {};
        profileData.coins = Number(updatedUser.coins || 0);
        profileData.purchasedItems = updatedUser.purchasedItems || [];
        updateShopCoinsUI();

        // ---- AÑADIR MONEDAS AL VENDEDOR (CORREGIDO) ----
        if (item.ownerId && item.ownerId !== currentUserId) {
          console.log('Pagando al vendedor ' + item.ownerId + ' con ' + price + ' monedas');
          addCoins(item.ownerId, price);
          notifyShopSale(item.ownerId, item, price, profileData.name);
        } else {
          console.warn('El item no tiene ownerId o el vendedor es el comprador, no se paga.');
        }

        renderShop();
        alert('¡Compra realizada con éxito!');
        buyConfirmOverlay.classList.remove('active');
        pendingBuyItemId = null;
      });
    });

    function showShop() {
      setActiveScreen('shop');
      stopAllMusic();
      closeComments();
      renderParticleEffect(null);
      clearMainContent();
      showTopBar(false);
      setBottomNavActive('shop');
      renderShop();
    }

    // ============================================================
    //  SUBIR ITEM A TIENDA
    // ============================================================
    uploadImagePreview.addEventListener('click', function() {
      uploadImageInput.click();
    });

    uploadImageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.type === 'image/gif') {
        alert('Ese formato de imagen no está permitido.');
        e.target.value = '';
        uploadImageData = null;
        uploadImagePreview.innerHTML = '<i class="fas fa-image"></i>';
        uploadImagePreview.style.backgroundImage = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function(ev) {
        uploadImageData = ev.target.result;
        if (!sanitizeRenderableImageUrl(uploadImageData)) {
          alert('Ese formato de imagen no está permitido.');
          uploadImageData = null;
          uploadImagePreview.innerHTML = '<i class="fas fa-image"></i>';
          return;
        }
        uploadImagePreview.innerHTML = '';
        uploadImagePreview.style.backgroundImage = `url('${uploadImageData}')`;
        uploadImagePreview.style.backgroundSize = 'cover';
        uploadImagePreview.style.backgroundPosition = 'center';
      };
      reader.readAsDataURL(file);
    });

    uploadItemPrice.addEventListener('input', function() {
      let value = parseInt(this.value, 10);
      if (Number.isNaN(value)) return;
      if (value > 100) value = 100;
      if (value < 1) value = 1;
      this.value = value;
    });

    uploadCancelBtn.addEventListener('click', function() {
      uploadItemOverlay.classList.remove('active');
    });

    uploadSubmitBtn.addEventListener('click', async function() {
      if (!uploadImageData) {
        alert('Debes seleccionar una imagen.');
        return;
      }
      const category = uploadItemCategory.value;
      let price = parseInt(uploadItemPrice.value, 10);
      if (Number.isNaN(price)) price = 50;
      price = Math.min(100, Math.max(1, price));
      uploadItemPrice.value = price;

      const originalSubmitText = uploadSubmitBtn.textContent;
      uploadSubmitBtn.disabled = true;
      uploadSubmitBtn.textContent = 'Subiendo...';
      showUploadStatusOverlay('Subiendo ítem...', false);

      try {
        const imageUrl = await uploadImageToImgbb(uploadImageData, 'shop_item_' + Date.now());
        const newItemRef = database.ref('userShopItems').push();
        await newItemRef.set({
          category: category,
          price: price,
          imageUrl: imageUrl,
          ownerId: currentUserId,
          ownerName: profileData.name || 'Usuario',
          timestamp: Date.now()
        });

        showUploadStatusOverlay('¡Subido con éxito!', true);
        setTimeout(function() {
          removeUploadStatusOverlay();
          uploadItemOverlay.classList.remove('active');
          renderShop();
        }, 1200);
      } catch (err) {
        removeUploadStatusOverlay();
        alert('Error al subir el item: ' + err.message);
        console.error(err);
      } finally {
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.textContent = originalSubmitText;
      }
    });

    // ============================================================
    //  CREAR POST
    // ============================================================
    function createPost(imagesData, description, musicUrl, musicTitle) {
      const publishBtn = document.getElementById('createPublishBtn');
      const originalPublishText = publishBtn ? publishBtn.innerHTML : 'Publicar';

      if (publishBtn) {
        publishBtn.disabled = true;
        publishBtn.innerHTML = 'Publicando...';
      }

      const loadingMsg = document.createElement('div');
      loadingMsg.className = 'upload-progress-msg';
      loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.9);color:white;padding:20px 30px;border-radius:16px;z-index:9999;font-size:16px;text-align:center;';
      loadingMsg.innerHTML = `Subiendo imagen 0 de ${imagesData.length}...`;
      document.body.appendChild(loadingMsg);

      uploadMultipleImages(imagesData)
        .then(imageUrls => {
          loadingMsg.textContent = 'Guardando publicación...';
          const postData = {
            images: imageUrls,
            description: description.trim() || 'Sin descripción',
            musicUrl: musicUrl || '',
            musicTitle: musicTitle || '',
            likes: 0,
            liked: false,
            comments: [],
            timestamp: Date.now(),
            authorName: resolvePostAuthorName({ authorUid: auth.currentUser.uid, authorName: profileData.name }),
            authorUid: auth.currentUser.uid
          };
          return savePostToFirebase(postData);
        })
        .then(() => {
          loadingMsg.remove();
          showHome();
        })
        .catch(err => {
          loadingMsg.remove();
          alert('Error al publicar: ' + err.message);
          console.error(err);
        })
        .finally(() => {
          if (publishBtn) {
            publishBtn.disabled = false;
            publishBtn.innerHTML = originalPublishText;
          }
        });
    }

    // ---- VISTA CREAR POST ----
    function showCreatePost(preloadedImages = []) {
      setActiveScreen('create');
      stopAllMusic();
      closeComments();
      selectedImagesData = preloadedImages.length > 0 ? preloadedImages : loadSelectedImagesDraft();
      selectedImagesData = selectedImagesData.slice(0, IMAGE_DRAFT_LIMIT);
      clearMainContent();
      showTopBar(false);

      const container = document.createElement('div');
      container.className = 'create-post-view active';
      container.id = 'createPostView';

      const defaultMusic = musicList[0] || { value: '', label: 'Sin música' };

      container.innerHTML = `
        <div class="create-header">
          <button class="back-btn" id="createBackBtn" aria-label="Volver">
            <i class="fas fa-arrow-left"></i>
          </button>
          <h2>Nueva publicación</h2>
          <button class="publish-btn" id="createPublishBtn">Publicar</button>
        </div>

        <section class="create-section">
          <div class="create-section-title">
            <span>Contenido</span>
            <span id="createImageCount">0 imágenes</span>
          </div>

          <div class="create-images-grid" id="createImagesGrid">
            <div class="create-images-placeholder" id="createImagesPlaceholder">
              <i class="fas fa-images"></i>
              <span>Selecciona las imágenes que quieres compartir</span>
            </div>
          </div>

          <button class="select-image-btn" id="selectImageBtn">
            <i class="fas fa-plus"></i> Añadir imágenes
          </button>
          <input type="file" id="createImageInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" multiple style="display:none;" />
        </section>

        <div class="create-field">
          <label for="createDescInput">Descripción</label>
          <textarea id="createDescInput" maxlength="2000" placeholder="Escribe algo sobre esta publicación..."></textarea>
        </div>

        <div class="create-field">
          <label>Música</label>
          <div class="music-player-wrapper">
            <button class="music-select-btn" id="musicSelectBtn" data-value="${defaultMusic.value}">
              <div class="cover"><i class="fas fa-music"></i></div>
              <span class="info">${defaultMusic.label}</span>
              <span class="arrow"><i class="fas fa-chevron-right"></i></span>
            </button>
          </div>
        </div>
      `;

      mainContent.appendChild(container);
      updateMusicPicker();

      document.getElementById('musicSelectBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        openMusicPicker();
      });

      function updateImageGrid() {
        const grid = document.getElementById('createImagesGrid');
        const count = document.getElementById('createImageCount');
        if (!grid) return;

        if (count) {
          count.textContent = selectedImagesData.length + (selectedImagesData.length === 1 ? ' imagen' : ' imágenes');
        }

        grid.innerHTML = '';

        if (selectedImagesData.length === 0) {
          grid.innerHTML = `
            <div class="create-images-placeholder" id="createImagesPlaceholder">
              <i class="fas fa-images"></i>
              <span>Selecciona las imágenes que quieres compartir</span>
            </div>
          `;
          const placeholder = document.getElementById('createImagesPlaceholder');
          if (placeholder) {
            placeholder.addEventListener('click', function() {
              document.getElementById('createImageInput').click();
            });
          }
          return;
        }

        selectedImagesData.forEach(function(dataUrl, index) {
          const item = document.createElement('div');
          item.className = 'create-image-item';
          item.style.backgroundImage = `url('${dataUrl}')`;
          try { item.style.contentVisibility = 'auto'; item.style.containIntrinsicSize = '1px 180px'; } catch (err) {}
          rememberImageUrlInLocalCache(dataUrl, 'image');

          const removeBtn = document.createElement('button');
          removeBtn.className = 'remove-btn';
          removeBtn.innerHTML = '<i class="fas fa-times"></i>';
          removeBtn.setAttribute('aria-label', 'Eliminar imagen');

          removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            selectedImagesData.splice(index, 1);
            updateImageGrid();
          });

          item.appendChild(removeBtn);
          grid.appendChild(item);
        });

        persistSelectedImagesDraft(selectedImagesData);
      }

      const selectImageBtn = document.getElementById('selectImageBtn');
      const createImageInput = document.getElementById('createImageInput');

      function readFileAsDataUrl(file) {
        return new Promise(function(resolve, reject) {
          const reader = new FileReader();
          reader.onload = function(ev) { resolve(ev.target.result); };
          reader.onerror = function() { reject(new Error('No se pudo leer la imagen.')); };
          reader.readAsDataURL(file);
        });
      }

      selectImageBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        createImageInput.value = '';
        createImageInput.click();
      });

      createImageInput.addEventListener('change', async function(e) {
        const files = Array.from(e.target.files || []).filter(function(file) {
          return file && file.type !== 'image/gif';
        });
        if (!files.length) {
          alert('Ese formato de imagen no está permitido.');
          e.target.value = '';
          return;
        }

        try {
          const loadedImages = await Promise.all(files.map(function(file) {
            return readFileAsDataUrl(file);
          }));
          const safeImages = loadedImages.filter(function(dataUrl) {
            return !!sanitizeRenderableImageUrl(dataUrl);
          });
          if (safeImages.length !== loadedImages.length) {
            alert('Se omitieron imágenes no permitidas.');
          }
          selectedImagesData = selectedImagesData.concat(safeImages);
          updateImageGrid();
        } catch (err) {
          console.warn('Error al cargar imágenes seleccionadas:', err);
          alert('No se pudieron agregar todas las imágenes seleccionadas.');
        } finally {
          this.value = '';
        }
      });

      document.getElementById('createBackBtn').addEventListener('click', function() {
        stopAllMusic();
        showHome();
      });

      document.getElementById('createPublishBtn').addEventListener('click', function() {
        if (selectedImagesData.length === 0) {
          alert('Por favor, selecciona al menos una imagen.');
          return;
        }

        const description = document.getElementById('createDescInput').value.trim() || 'Sin descripción';
        const selectBtn = document.getElementById('musicSelectBtn');
        const musicUrl = selectBtn.dataset.value || '';
        const selectedMusic = musicList.find(function(m) { return m.value === musicUrl; });
        const musicTitle = selectedMusic ? selectedMusic.label : '';

        createPost(selectedImagesData, description, musicUrl, musicTitle);
        clearSelectedImagesDraft();
        resetMusicPreview();
        stopAllMusic();
      });

      // Enfocar el textarea después de renderizar
      setTimeout(function() {
        const descInput = document.getElementById('createDescInput');
        if (descInput) {
          void 0;
        }
      }, 300);

      updateImageGrid();
    }

    // ============================================================
    //  PERFIL
    // ============================================================
    function createProfileView(uid, userData, isOwnProfile = false) {
      const container = document.createElement('div');
      container.className = 'profile-view active';
      container.id = 'profileView';
      container.dataset.uid = uid;

      let avatarContent = '';
      const resolvedAvatar = getResolvedProfileAvatar(userData);
      if (resolvedAvatar) {
        avatarContent = `<div class="lazy-media-shell" style="border-radius:50%;"><img src="${TRANSPARENT_PLACEHOLDER_SRC}" data-lazy-src="${resolvedAvatar}" alt="Avatar" loading="eager" decoding="async" style="object-fit:cover;border-radius:50%;" /></div>`;
      } else {
        avatarContent = `<i class="fas fa-user-circle"></i>`;
      }

      let totalLikes = 0;
      const userPosts = posts.filter(p => p.authorUid === uid);
      userPosts.forEach(post => {
        totalLikes += (post.likes || 0);
      });

      const followersCount = userData.followers ? Object.keys(userData.followers).length : 0;
      const followingCount = userData.following ? Object.keys(userData.following).length : 0;

      let actionsHtml = '';
      if (isOwnProfile) {
        actionsHtml = `
          <div class="profile-actions">
            <button class="edit-profile-btn" id="editProfileBtn"><i class="fas fa-pen"></i> Editar perfil</button>
            <button class="logout-btn" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</button>
          </div>
        `;
      } else {
        const isFollowing = userData.followers && userData.followers[currentUserId] === true;
        const followBtnClass = isFollowing ? 'following' : '';
        const followBtnText = isFollowing ? 'Siguiendo' : 'Seguir';
        actionsHtml = `
          <div class="profile-actions">
            <button class="follow-btn ${followBtnClass}" id="followBtn">${followBtnText}</button>
            <button class="message-btn" id="messageBtn"><i class="fas fa-envelope"></i> Mensaje</button>
          </div>
        `;
      }

      const coins = Number(userData.coins || 0);

      const selectedVerifiedStickerUrl = getResolvedVerifiedSticker(userData);
      const classicVerifiedStickerUrl = userData.verifiedSticker || null;
      const verifiedStickerUrl = userData.selectedVerifiedSticker ? selectedVerifiedStickerUrl : ((classicVerifiedStickerUrl && totalLikes >= 100) ? classicVerifiedStickerUrl : null);

      container.innerHTML = `
        <div class="profile-header">
          <div class="profile-avatar">${avatarContent}</div>
          <div class="profile-name-row">
            <div class="profile-name" id="profileNameDisplay">${userData.name || 'Usuario'}</div>
            ${verifiedStickerUrl ? `
              <span class="verified-sticker-badge" title="Sticker verificado">
                <img src="${verifiedStickerUrl}" alt="Sticker verificado" />
              </span>
            ` : ''}
          </div>
          <div class="profile-bio" id="profileBioDisplay">${userData.bio || ''}</div>
          <div class="profile-stats">
            <div><div class="number">${totalLikes}</div><div class="label">Me gustas</div></div>
            <div><div class="number" id="followersCount">${followersCount}</div><div class="label">Seguidores</div></div>
            <div><div class="number">${followingCount}</div><div class="label">Siguiendo</div></div>
          </div>
          ${actionsHtml}
        </div>
        <div class="profile-posts">
          <h4><i class="fas fa-th"></i> ${isOwnProfile ? 'Mis publicaciones' : 'Publicaciones'}</h4>
          <div class="post-grid" id="profilePostGrid">
            ${userPosts.length === 0 ? '<p style="color:#888; text-align:center; grid-column:1/-1;">No hay publicaciones aún</p>' : ''}
            ${userPosts.slice().reverse().map(post => {
              const imgUrl = getPostImageUrls(post)[0] || '';
              return `<div class="post-item" data-post-id="${post.id}">
                ${imgUrl ? `
                  <div class="lazy-media-shell">
                    
                    <img src="${TRANSPARENT_PLACEHOLDER_SRC}" data-lazy-src="${imgUrl}" alt="Miniatura" loading="eager" decoding="async" />
                  </div>` : '<i class="fas fa-image"></i>'}
                ${isOwnProfile ? `<button class="delete-post-btn" data-post-id="${post.id}"><i class="fas fa-trash"></i></button>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
      `;

      updateParticleEffectForUser(userData);
      if (!genericLazyImageObserver) setupGenericLazyImageObserver();
      loadLazyImagesInContainer(container);
      scheduleImageRecoveryScan(container, true);

      container.querySelectorAll('.post-item').forEach(item => {
        item.addEventListener('click', function(e) {
          if (e.target.closest('.delete-post-btn')) return;
          const postId = this.dataset.postId;
          if (postId) {
            goToPost(postId);
          }
        });

        const deleteBtn = item.querySelector('.delete-post-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const postId = this.dataset.postId;
            if (postId) {
              showDeleteConfirm(postId);
            }
          });
        }
      });

      if (isOwnProfile) {
        const editProfileBtn = container.querySelector('#editProfileBtn');
        if (editProfileBtn) editProfileBtn.addEventListener('click', showEditProfile);
        const logoutBtn = container.querySelector('#logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);
      } else {
        const followBtn = container.querySelector('#followBtn');
        const followersSpan = container.querySelector('#followersCount');

        followBtn.addEventListener('click', function() {
          const currentlyFollowing = this.classList.contains('following');
          const targetUid = uid;
          const action = currentlyFollowing ? unfollowUser(targetUid) : followUser(targetUid);

          action.then(() => {
            if (currentlyFollowing) {
              delete userData.followers[currentUserId];
            } else {
              userData.followers[currentUserId] = true;
            }
            const newCount = Object.keys(userData.followers).length;
            if (followersSpan) followersSpan.textContent = newCount;
            this.classList.toggle('following');
            this.textContent = currentlyFollowing ? 'Seguir' : 'Siguiendo';
          }).catch(err => {
            console.warn('Error al seguir/dejar de seguir:', err);
          });
        });

        const messageBtn = container.querySelector('#messageBtn');
        messageBtn.addEventListener('click', function() {
          const targetUid = uid;
          if (targetUid === currentUserId) return;
          const chatId = getChatId(currentUserId, targetUid);
          const chatRef = database.ref('chats/' + chatId);
          chatRef.once('value').then(function(snapshot) {
            if (!snapshot.exists()) {
              chatRef.set({
                participants: [currentUserId, targetUid],
                lastMessage: '',
                lastTimestamp: Date.now(),
                unreadCount: {}
              });
            }
            openChat(chatId, targetUid);
          }).catch(function(err) {
            console.warn('Error al abrir chat:', err);
            alert('No se pudo abrir el chat.');
          });
        });
      }

      return container;
    }

    // ---- MOSTRAR PERFIL ----
    function showUserProfile(uid) {
      saveFeedScrollPosition();
      setActiveScreen('profile');
      stopAllMusic();
      closeComments();
      clearMainContent();
      showTopBar(false);
      setBottomNavActive('profile');

      if (uid === currentUserId) {
        const profileView = createProfileView(uid, profileData, true);
        mainContent.appendChild(profileView);
      } else {
        getUserProfile(uid).then(userData => {
          const profileView = createProfileView(uid, userData, false);
          mainContent.appendChild(profileView);
        }).catch(err => {
          console.warn('Error al cargar perfil de usuario:', err);
          const profileView = createProfileView(uid, { name: 'Usuario', bio: '', avatar: null, verifiedSticker: null, followers: {}, following: {}, coins: 0 }, false);
          mainContent.appendChild(profileView);
        });
      }
    }

    function showProfile(uid) {
      if (!uid) uid = currentUserId;
      showUserProfile(uid);
    }

    // ---- EDITAR PERFIL ----
    function createEditProfileView() {
      const container = document.createElement('div');
      container.className = 'edit-profile-view active';
      container.id = 'editProfileView';

      let avatarPreviewHtml = '';
      const resolvedEditAvatar = getResolvedProfileAvatar(profileData);
      if (resolvedEditAvatar) {
        avatarPreviewHtml = `<img src="${resolvedEditAvatar}" alt="Avatar" id="editAvatarImg" />`;
      } else {
        avatarPreviewHtml = `<i class="fas fa-user-circle placeholder-icon" id="editAvatarPlaceholder"></i>`;
      }

      let totalLikesForVerified = 0;
      posts.filter(function(p) { return p.authorUid === currentUserId; }).forEach(function(post) {
        totalLikesForVerified += (post.likes || 0);
      });
      const canUseVerifiedSticker = totalLikesForVerified >= 100;
      editOriginalSelectedFrame = profileData.selectedFrame || null;

      // Obtener items comprados por categoría
      const purchased = profileData.purchasedItems || [];
      const frames = sortItemsNewestFirst(userShopItems.filter(function(item) {
        return item.category === 'profileFrames' && (purchased.includes(item.id) || item.ownerId === currentUserId);
      }));
      const particles = sortItemsNewestFirst(userShopItems.filter(function(item) {
        return item.category === 'particles' && (purchased.includes(item.id) || item.ownerId === currentUserId);
      }));
      const stickers = sortItemsNewestFirst(userShopItems.filter(function(item) {
        return item.category === 'verifiedStickers' && (purchased.includes(item.id) || item.ownerId === currentUserId);
      }));

      // Función para crear opción "Ninguno"
      const noneOption = (label) => `
        <div class="edit-item-option ${!profileData.selectedFrame && label === 'Marco' ? 'selected' : ''}" data-item-id="none" data-category="frame">
          <div class="preview"><i class="fas fa-ban" style="font-size:32px; color:#666;"></i></div>
          <div class="name"><span>Ninguno</span><i class="fas fa-slash"></i></div>
          ${!profileData.selectedFrame && label === 'Marco' ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
        </div>
      `;

      container.innerHTML = `
        <div class="edit-header">
          <button class="back-btn" id="editBackBtn"><i class="fas fa-arrow-left"></i></button>
          <h2>Editar perfil</h2>
          <button class="save-btn" id="editSaveBtn">Guardar</button>
        </div>
        <div class="edit-avatar-section">
          <div class="avatar-preview" id="editAvatarPreview">${avatarPreviewHtml}</div>
          <div class="avatar-hint">Toca la foto para cambiarla</div>
          <input type="file" id="editAvatarInput" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" />
        </div>
        <div class="edit-field">
          <label for="editNameInput">Nombre</label>
          <input type="text" id="editNameInput" value="${profileData.name}" placeholder="Tu nombre" />
        </div>
        <div class="edit-field">
          <label for="editBioInput">Descripción</label>
          <textarea id="editBioInput" placeholder="Cuéntanos sobre ti">${profileData.bio}</textarea>
        </div>

        <!-- Marcos de perfil -->
        <div class="edit-items-section">
          <div class="section-title"><i class="fas fa-id-card"></i> Marcos de perfil</div>
          <div class="edit-items-scroll" id="editFramesScroll">
            ${noneOption('Marco')}
            ${frames.length === 0 ? '<div class="edit-item-empty">No tienes marcos comprados.</div>' : ''}
            ${frames.map(item => `
              <div class="edit-item-option ${profileData.selectedFrame === item.id ? 'selected' : ''}" data-item-id="${item.id}" data-category="frame">
                <div class="preview">${sanitizeRenderableImageUrl(item.imageUrl) ? `<img src="${sanitizeRenderableImageUrl(item.imageUrl)}" alt="Item" />` : `<i class="fas fa-camera"></i>`}</div>
                
                ${profileData.selectedFrame === item.id ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Partículas -->
        <div class="edit-items-section">
          <div class="section-title"><i class="fas fa-sparkles"></i> Partículas</div>
          <div class="edit-items-scroll" id="editParticlesScroll">
            <div class="edit-item-option ${!profileData.selectedParticles ? 'selected' : ''}" data-item-id="none" data-category="particles">
              <div class="preview"><i class="fas fa-ban" style="font-size:32px; color:#666;"></i></div>
              <div class="name">Ninguno</div>
              ${!profileData.selectedParticles ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
            </div>
            ${particles.length === 0 ? '<div class="edit-item-empty">No tienes partículas compradas.</div>' : ''}
            ${particles.map(item => `
              <div class="edit-item-option ${profileData.selectedParticles === item.id ? 'selected' : ''}" data-item-id="${item.id}" data-category="particles">
                <div class="preview">${sanitizeRenderableImageUrl(item.imageUrl) ? `<img src="${sanitizeRenderableImageUrl(item.imageUrl)}" alt="Item" />` : `<i class="fas fa-star"></i>`}</div>
                
                ${profileData.selectedParticles === item.id ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Stickers verificados (comprados en tienda) -->
        <div class="edit-items-section">
          <div class="section-title"><i class="fas fa-check-circle"></i> Stickers de verificado de la tienda </div>
          <div class="edit-items-scroll" id="editVerifiedScroll">
            <div class="edit-item-option ${!profileData.selectedVerifiedSticker ? 'selected' : ''}" data-item-id="none" data-category="verified">
              <div class="preview"><i class="fas fa-ban" style="font-size:32px; color:#666;"></i></div>
              <div class="name">Ninguno</div>
              ${!profileData.selectedVerifiedSticker ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
            </div>
            ${stickers.length === 0 ? '<div class="edit-item-empty">No tienes stickers verificados comprados.</div>' : ''}
            ${stickers.map(item => `
              <div class="edit-item-option ${profileData.selectedVerifiedSticker === item.id ? 'selected' : ''}" data-item-id="${item.id}" data-category="verified">
                <div class="preview">${sanitizeRenderableImageUrl(item.imageUrl) ? `<img src="${sanitizeRenderableImageUrl(item.imageUrl)}" alt="Item" />` : `<i class="fas fa-check-circle"></i>`}</div>
                
                ${profileData.selectedVerifiedSticker === item.id ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Stickers clásicos (los 3 por defecto) -->
        <div class="edit-items-section">
          <div class="section-title"><i class="fas fa-certificate"></i> Stickers Verificado Oficial</div>
          <div class="edit-items-scroll" id="editClassicScroll">
            <div class="edit-item-option ${!profileData.verifiedSticker ? 'selected' : ''}" data-sticker-url="none" data-category="classic">
              <div class="preview"><i class="fas fa-ban" style="font-size:32px; color:#666;"></i></div>
              <div class="name">Ninguno</div>
              ${!profileData.verifiedSticker ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
            </div>
            ${VERIFIED_STICKER_OPTIONS.map((url, idx) => {
              const isLocked = !canUseVerifiedSticker;
              const isSelected = profileData.verifiedSticker === url;
              return `
                <div class="edit-item-option ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" data-sticker-url="${url}" data-category="classic">
                  <div class="preview"><img src="${url}" alt="Sticker" /></div>
                  <div class="name">Sticker ${idx+1}</div>
                  ${isSelected ? '<div class="check"><i class="fas fa-check"></i></div>' : ''}
                  ${isLocked ? '<div class="lock-overlay"><i class="fas fa-lock"></i></div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${!canUseVerifiedSticker ? `<div style="color:#888; font-size:12px; margin-top:6px;">Desbloquea con 100 me gustas</div>` : ''}
        </div>
      `;

      // Eventos para seleccionar items
      container.querySelectorAll('.edit-item-option:not(.locked)').forEach(el => {
        el.addEventListener('click', function() {
          const category = this.dataset.category;
          const itemId = this.dataset.itemId;
          const stickerUrl = this.dataset.stickerUrl;
          const parentScroll = this.closest('.edit-items-scroll');
          const siblings = parentScroll.querySelectorAll('.edit-item-option');
          siblings.forEach(s => s.classList.remove('selected'));
          this.classList.add('selected');
          // Guardar selección
          if (category === 'frame') {
            profileData.selectedFrame = (itemId === 'none') ? null : itemId;
          } else if (category === 'particles') {
            profileData.selectedParticles = (itemId === 'none') ? null : itemId;
          } else if (category === 'verified') {
            profileData.selectedVerifiedSticker = (itemId === 'none') ? null : itemId;
          } else if (category === 'classic') {
            profileData.verifiedSticker = (stickerUrl === 'none') ? null : stickerUrl;
          }
          // Actualizar checks visualmente
          parentScroll.querySelectorAll('.check').forEach(c => c.remove());
          if (itemId !== 'none' || stickerUrl !== 'none') {
            this.querySelector('.preview').insertAdjacentHTML('afterend', '<div class="check"><i class="fas fa-check"></i></div>');
          } else {
            // Para "ninguno", el check ya está en el html
          }
        });
      });

      const editBackBtn = container.querySelector('#editBackBtn');
      if (editBackBtn) {
        editBackBtn.addEventListener('click', function() {
          stopAllMusic();
          showProfile(currentUserId);
        });
      }

      const editSaveBtn = container.querySelector('#editSaveBtn');
      if (editSaveBtn) editSaveBtn.addEventListener('click', saveProfileData);
      const avatarPreview = container.querySelector('#editAvatarPreview');
      const fileInput = container.querySelector('#editAvatarInput');
      avatarPreview.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type === 'image/gif') {
          alert('Ese formato de imagen no está permitido.');
          fileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = function(ev) {
          const dataUrl = ev.target.result;
          if (!sanitizeRenderableImageUrl(dataUrl)) {
            alert('Ese formato de imagen no está permitido.');
            fileInput.value = '';
            return;
          }
          avatarPreview.innerHTML = `<img src="${dataUrl}" alt="Avatar" id="editAvatarImg" />`;
          editAvatarPreview = dataUrl;
          editAvatarFile = file;
        };
        reader.readAsDataURL(file);
      });

      return container;
    }

    function saveProfileData() {
      const editView = document.getElementById('editProfileView');
      if (!editView) return;
      const nameInput = editView.querySelector('#editNameInput');
      const bioInput = editView.querySelector('#editBioInput');
      const newName = nameInput.value.trim() || 'Usuario';
      const newBio = bioInput.value.trim() || '';

      const updates = {
        name: newName,
        bio: newBio,
        selectedFrame: profileData.selectedFrame || null,
        selectedParticles: profileData.selectedParticles || null,
        selectedVerifiedSticker: profileData.selectedVerifiedSticker || null,
        verifiedSticker: profileData.verifiedSticker || null
      };

      const selectedFrameAvatar = getResolvedProfileAvatar(profileData);
      const hadSelectedFrame = !!editOriginalSelectedFrame;
      const hasSelectedFrameNow = !!updates.selectedFrame;

      if (hasSelectedFrameNow && selectedFrameAvatar) {
        updates.avatar = selectedFrameAvatar;
      }

      let avatarPromise = Promise.resolve();
      if (editAvatarPreview && !selectedFrameAvatar) {
        avatarPromise = uploadImageToImgbb(editAvatarPreview)
          .then(url => {
            updates.avatar = url;
          })
          .catch(err => {
            console.warn('Error al subir avatar:', err);
            alert('Error al subir la foto de perfil.');
          });
      } else if (hadSelectedFrame && !hasSelectedFrameNow) {
        updates.avatar = null;
      }

      avatarPromise.then(() => {
        return updateUserProfile(auth.currentUser.uid, updates);
      }).then(() => {
        profileData.name = newName;
        profileData.bio = newBio;
        if (Object.prototype.hasOwnProperty.call(updates, 'avatar')) {
          profileData.avatar = updates.avatar;
        }
        profileData.selectedFrame = updates.selectedFrame;
        profileData.selectedParticles = updates.selectedParticles;
        profileData.selectedVerifiedSticker = updates.selectedVerifiedSticker;
        profileData.verifiedSticker = updates.verifiedSticker;
        userProfiles[currentUserId] = { ...profileData };
        showProfile(currentUserId);
      }).catch(err => {
        alert('Error al guardar perfil: ' + err.message);
        console.error(err);
      });
    }

    // ---- VISTA DE MENSAJES INTEGRADA ----
    function showMessagesView() {
      setActiveScreen('messages');
      stopAllMusic();
      closeComments();
      renderParticleEffect(null);
      clearMainContent();
      showTopBar(false);
      setBottomNavActive('messages');

      const container = document.createElement('div');
      container.className = 'messages-view';
      container.id = 'messagesView';
      container.innerHTML = `
        <div class="messages-header">
          <h2><i class="fas fa-comment-dots"></i> Mensajes</h2>
        </div>
        <div class="messages-list" id="messagesList">
          <!-- Se llena con renderChatList -->
        </div>
      `;
      mainContent.appendChild(container);

      const listContainer = document.getElementById('messagesList');
      if (listContainer) {
        renderChatList(listContainer);
      }
    }

    // ---- NAVEGACIÓN ----
    function clearMainContent() {
      mainContent.innerHTML = '';
    }

    function showHome() {
      // Guardar posición antes de cambiar
      saveFeedScrollPosition();
      setActiveScreen('home');
      stopAllMusic();
      closeComments();
      renderParticleEffect(null);
      clearMainContent();
      showTopBar(true);
      setBottomNavActive('home');
      sortPostsForCurrentFeedMode();
      updateFeedModeUI();
      updateFeedContainer(feedScrollTop);
      scheduleImageRecoveryScan(mainContent, true);
      // Restaurar después de renderizar
      restoreFeedScrollPosition(feedScrollTop);
    }

    function showEditProfile() {
      saveFeedScrollPosition();
      setActiveScreen('edit-profile');
      stopAllMusic();
      closeComments();
      renderParticleEffect(null);
      clearMainContent();
      showTopBar(false);
      const editView = createEditProfileView();
      mainContent.appendChild(editView);
      setBottomNavActive('profile');
    }

    // ---- NAVEGACIÓN BOTTOM BAR ----
    function setBottomNavActive(active) {
      homeBtn.classList.toggle('active', active === 'home');
      shopBtn.classList.toggle('active', active === 'shop');
      plusBtn.classList.remove('active');
      messagesBtn.classList.toggle('active', active === 'messages');
      profileBtn.classList.toggle('active', active === 'profile');
    }

    // ============================================================
    //  AUTH LISTENER
    // ============================================================
    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUserId = user.uid;
        loadUserProfile(user.uid);
        loadChats(user.uid);
        loadUserShopItems();
        showHome();
      } else {
        currentUserId = null;
        postOrder = [];
        autoPlayAttempted = false;
        profilesLoaded = false;
        userProfiles = {};
        showLoginView();
        setBottomNavActive(null);
      }
    });

    // ============================================================
    //  EVENTOS UI
    // ============================================================
    if (feedModeSwitcher) {
      feedModeSwitcher.querySelectorAll('[data-mode]').forEach(function(button) {
        button.addEventListener('click', function() {
          if (!auth.currentUser) return;
          const mode = this.dataset.mode === 'recent' || this.dataset.mode === 'following' ? this.dataset.mode : 'for-you';
          setFeedMode(mode);
        });
      });
    }

    homeBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        setBottomNavActive('home');
        showHome();
      }
    });
    profileBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        saveFeedScrollPosition();
        setBottomNavActive('profile');
        showProfile(currentUserId);
      }
    });
    shopBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        saveFeedScrollPosition();
        showShop();
      }
    });
    messagesBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        saveFeedScrollPosition();
        showMessagesView();
      }
    });

    searchBtn.addEventListener('click', () => {
      if (auth.currentUser) showSearchView();
    });

    plusBtn.addEventListener('click', function() {
      if (!auth.currentUser) return;
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.multiple = true;
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.click();

      fileInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files || []).filter(function(file) {
          return file && file.type !== 'image/gif';
        });
        if (!files || files.length === 0) {
          fileInput.remove();
          return;
        }
        let loaded = 0;
        const imageData = [];
        for (let i = 0; i < files.length; i++) {
          const reader = new FileReader();
          reader.onload = function(ev) {
            imageData.push(ev.target.result);
            loaded++;
            if (loaded === files.length) {
              fileInput.remove();
              showCreatePost(imageData);
            }
          };
          reader.readAsDataURL(files[i]);
        }
      });

      window.addEventListener('focus', function() {
        setTimeout(() => {
          if (fileInput.parentNode) fileInput.remove();
        }, 1000);
      }, { once: true });
    });

    closeCommentsBtn.addEventListener('click', closeComments);
    commentsOverlay.addEventListener('click', function(e) {
      if (e.target === this) closeComments();
    });
    sendCommentBtn.addEventListener('click', addComment);
    commentInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addComment();
      }
    });
    commentInput.addEventListener('focus', function() {
      adjustCommentInputForKeyboard(true);
    });
    commentInput.addEventListener('click', function() {
      adjustCommentInputForKeyboard(true);
    });

    chatBackBtn.addEventListener('click', closeChat);
    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    setupGlobalImageOptimizer();
    bindKeyboardViewportEvents();
    scheduleImageRecoveryScan(mainContent, true);

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        stopAllMusic();
      } else if (isHomeScreenActive()) {
        tryAutoPlayFirstMusic();
      }
    });
    window.addEventListener('pagehide', function() {
      try {
        if (Array.isArray(selectedImagesData) && selectedImagesData.length > 0) {
          persistSelectedImagesDraft(selectedImagesData);
        }
        saveJsonToStorage(IMAGE_LOCAL_CACHE_KEY, imageLocalCache);
      } catch (err) {}
      stopAllMusic();
    });
    window.addEventListener('beforeunload', function() {
      try {
        if (Array.isArray(selectedImagesData) && selectedImagesData.length > 0) {
          persistSelectedImagesDraft(selectedImagesData);
        }
        saveJsonToStorage(IMAGE_LOCAL_CACHE_KEY, imageLocalCache);
      } catch (err) {}
    });

    closeMusicPickerBtn.addEventListener('click', closeMusicPicker);
    musicPickerOverlay.addEventListener('click', function(e) {
      if (e.target === this) closeMusicPicker();
    });
    if (musicSearchInput) {
      musicSearchInput.addEventListener('input', updateMusicPicker);
    }

    downloadCancelBtn.addEventListener('click', closeDownloadDialog);
    downloadOverlay.addEventListener('click', function(e) {
      if (e.target === this) closeDownloadDialog();
    });
    downloadConfirmBtn.addEventListener('click', downloadSelectedImages);

    deleteConfirmCancel.addEventListener('click', closeDeleteConfirm);
    deleteConfirmAccept.addEventListener('click', function() {
      if (postToDeleteId) {
        deletePost(postToDeleteId);
      } else {
        closeDeleteConfirm();
      }
    });
    deleteConfirmOverlay.addEventListener('click', function(e) {
      if (e.target === this) closeDeleteConfirm();
    });

    if (startOverlay) {
      startOverlay.addEventListener('click', startExperience, { once: true });
      startOverlay.addEventListener('touchstart', startExperience, { once: true });
    }

    loadMusicFromJson().catch(() => {});
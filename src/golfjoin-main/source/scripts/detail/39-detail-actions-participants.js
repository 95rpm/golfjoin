    function renderDetailContent(join, options = {}) {
      if (!join) return;
      const isBuilderMode = options.mode === "builder";
      const hideParticipants = Boolean(options.hideParticipants) || !isJoinScheduleLikeForDetail(join);
      const disableEmptySlots = options.disableEmptySlots !== false;
      const confirmedParticipants = getConfirmedParticipants(join);
      const participantCapacity = getCardTeamCapacity(join);
      const slides = getDetailSlides(join);
      const slideIndex = Math.max(0, Math.min(currentDetailSlideIndex, slides.length - 1));
      const hasReviews = hasDetailReviews(join);
      const detailTitleCopy = cleanSecretTourDetailText(join.detailTitleCopy || "");
      currentDetailSlideIndex = slideIndex;
      clearTimeout(detailParticipantTooltipTimer);
      detailParticipantTooltipTimer = null;

      document.getElementById("detailContent").innerHTML = `
        <div class="detail-mobile-sticky-header" aria-hidden="true">
          <button type="button" class="detail-mobile-header-button" onclick="closeModal('detailModal')" aria-label="뒤로가기">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left-icon lucide-arrow-left" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
          </button>
          <div class="detail-mobile-sticky-title">${escapeHtml(join.title)}</div>
          <button type="button" class="detail-mobile-header-button" data-detail-wish-button aria-label="찜하기" aria-pressed="false">
            <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-bookmark-check-icon lucide-bookmark-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path><path d="m9 10 2 2 4-4"></path></svg>
          </button>
          <button type="button" class="detail-mobile-header-button" aria-label="공유하기">
            <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-share2-icon lucide-share-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>
          </button>
        </div>
        <div class="detail-slider">
          <button type="button" class="detail-slider-back" onclick="closeModal('detailModal')" aria-label="뒤로가기">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left-icon lucide-arrow-left" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
          </button>
          <div class="detail-slider-actions" aria-label="상품상세 액션">
            <button type="button" class="detail-mobile-header-button" data-detail-wish-button aria-label="찜하기" aria-pressed="false">
              <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-bookmark-check-icon lucide-bookmark-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"></path><path d="m9 10 2 2 4-4"></path></svg>
            </button>
            <button type="button" class="detail-mobile-header-button" aria-label="공유하기">
              <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-share2-icon lucide-share-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line></svg>
            </button>
          </div>
          <button type="button" class="detail-slider-nav prev" onclick="changeDetailSlide(-1)" aria-label="이전 이미지">&lt;</button>
          <div class="detail-slider-viewport">
            <div class="detail-slider-track" style="transform: translateX(-${slideIndex * 100}%);">
              ${slides.concat(slides[0]).map((slide, index) => `<img class="detail-thumb" src="${slide}" alt="${join.title} 이미지 ${(index % slides.length) + 1}">`).join("")}
            </div>
          </div>
          <button type="button" class="detail-slider-nav next" onclick="changeDetailSlide(1)" aria-label="다음 이미지">&gt;</button>
          <div class="detail-slider-dots join-slide-dots" data-slide-dots="detail" data-dot-click="setDetailSlide" aria-hidden="true"></div>
          <div class="detail-slider-pagination" aria-label="상품 이미지 ${slideIndex + 1} / ${slides.length}">
            <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-image-icon lucide-image" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
            <div id="detailSliderPageText" class="detail-slider-page-text">${slideIndex + 1}/${slides.length}</div>
          </div>
        </div>
        <div class="detail-content-sheet">
        <div class="detail-section detail-product-head">
          <div class="detail-main-title${detailTitleCopy ? " has-detail-title-copy" : ""}">${escapeHtml(join.title)}</div>
          ${detailTitleCopy ? `<p class="detail-title-copy">${escapeHtml(detailTitleCopy)}</p>` : ""}
          <div class="detail-product-price-row">
            <div class="detail-price-value">${formatPrice(join.price)}<div class="detail-price-unit">원~</div></div>
          </div>
          ${renderDetailProductFamilyPeriods(join)}
          ${renderDetailBenefitCard()}
          ${hideParticipants ? "" : renderDetailParticipantStatus(join, confirmedParticipants, participantCapacity, { disableEmptySlots })}
        </div>
        <div class="detail-anchor-tabs" aria-label="상세정보 바로가기">
          <button type="button" class="detail-anchor-chip" data-anchor-target="summary" onclick="scrollDetailSection('summary')">상품요약</button>
          <button type="button" class="detail-anchor-chip" data-anchor-target="flight" onclick="scrollDetailSection('flight')">항공정보</button>
          <button type="button" class="detail-anchor-chip" data-anchor-target="includes" onclick="scrollDetailSection('includes')">포함·불포함</button>
          <button type="button" class="detail-anchor-chip" data-anchor-target="schedule" onclick="scrollDetailSection('schedule')">일정표</button>
          <button type="button" class="detail-anchor-chip" data-anchor-target="place" onclick="scrollDetailSection('place')">시설소개</button>
          ${hasReviews ? `<button type="button" class="detail-anchor-chip" data-anchor-target="review" onclick="scrollDetailSection('review')">여행후기</button>` : ""}
        </div>
        <div class="detail-anchor-tabs-spacer" aria-hidden="true"></div>
        ${renderDetailSummaryInfo(join)}
        ${renderDetailFlightSection(join)}
        ${renderDetailInclusionSection(join)}
        ${renderDetailNotesSection(join)}
        ${renderDetailScheduleTabs(join)}
        </div>
      `;
      window.setTimeout(() => hydrateDetailProductFamilyPeriodMetadata(join), 0);
      const detailBody = document.getElementById("detailContent");
      document.querySelectorAll("#detailModal .detail-mobile-header-button[data-detail-wish-button]").forEach((button) => {
        if (button.dataset.wishBound === "true") return;
        button.dataset.wishBound = "true";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          handleDetailWish();
        });
      });
      document.querySelectorAll("#detailModal .detail-mobile-header-button[aria-label='공유하기']").forEach((button) => {
        if (button.dataset.shareBound === "true") return;
        button.dataset.shareBound = "true";
        button.addEventListener("click", (event) => {
          event.preventDefault();
          button.dataset.shareClicked = String(Number(button.dataset.shareClicked || 0) + 1);
          handleDetailShare();
        });
      });
      refreshDetailWishButtons();
      detailBody.onscroll = handleDetailContentScroll;
      detailBody.onwheel = () => {
        const tabs = detailBody.querySelector(".detail-anchor-tabs");
        const scheduleNav = detailBody.querySelector(".detail-schedule-day-nav");
        clearTimeout(detailAnchorForcedActiveTimer);
        if (tabs) {
          delete tabs.dataset.forcedActive;
          delete tabs.dataset.pinnedVisible;
        }
        if (scheduleNav) delete scheduleNav.dataset.forcedActiveIndex;
      };
      detailBody.ontouchstart = () => {
        const tabs = detailBody.querySelector(".detail-anchor-tabs");
        const scheduleNav = detailBody.querySelector(".detail-schedule-day-nav");
        clearTimeout(detailAnchorForcedActiveTimer);
        if (tabs) {
          delete tabs.dataset.forcedActive;
          delete tabs.dataset.pinnedVisible;
        }
        if (scheduleNav) delete scheduleNav.dataset.forcedActiveIndex;
      };
      detailBody.scrollTop = 0;
      const anchorTabs = detailBody.querySelector(".detail-anchor-tabs");
      const summarySection = detailBody.querySelector('[data-detail-section="summary"]');
      if (anchorTabs && summarySection) {
        anchorTabs.dataset.showAt = Math.max(0, summarySection.offsetTop - 1);
        delete anchorTabs.dataset.mobileFixedAt;
        anchorTabs.classList.remove("is-mobile-fixed");
        detailBody.classList.remove("detail-anchor-tabs-fixed");
        anchorTabs.classList.remove("is-visible");
        syncDetailAnchorTabsSpacer(detailBody, anchorTabs);
      }
      prepareDetailScheduleHeights();
      updateDetailMobileStickyHeader();
      updateDetailAnchorTabs();
      updateDetailScheduleDayNav();
      bindDetailSliderSwipe();
      updateDetailSlider(false);
      startDetailReviewAutoSlide();
    }

    function isDetailSliderWindowed(slideCount) {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      return isMobile && slideCount > 5;
    }

    function getDetailSliderDotState(slideCount, activeIndex, index) {
      const normalizedActive = ((activeIndex % slideCount) + slideCount) % slideCount;
      let offset = (index - normalizedActive + slideCount) % slideCount;
      if (offset > slideCount / 2) offset -= slideCount;
      const distance = Math.abs(offset);
      const visible = distance <= 2;
      const xByOffset = {
        "-2": -24,
        "-1": -12,
        "0": 0,
        "1": 12,
        "2": 24
      };
      const clampedOffset = Math.max(-2, Math.min(2, offset));
      const stateClass = distance === 0
        ? "active swiper-pagination-bullet-active"
        : offset === -1
          ? "swiper-pagination-bullet-active-prev"
          : offset === 1
            ? "swiper-pagination-bullet-active-next"
            : offset === -2
              ? "swiper-pagination-bullet-active-prev-prev"
              : "swiper-pagination-bullet-active-next-next";
      const scale = distance === 0 ? 1 : distance === 1 ? .66 : .33;
      return {
        visible,
        className: ["detail-slider-dot swiper-pagination-bullet", visible ? "is-visible" : "", stateClass].filter(Boolean).join(" "),
        x: `${xByOffset[String(clampedOffset)] ?? 0}px`,
        scale
      };
    }

    function updateDetailSliderDotsElement(dots, slideCount, activeIndex) {
      updateSlideDots("detail", activeIndex, slideCount, slideCount > 1);
    }

    function renderDetailSliderDots(slideCount, activeIndex) {
      if (slideCount <= 0) return "";
      const normalizedActive = ((activeIndex % slideCount) + slideCount) % slideCount;
      if (isDetailSliderWindowed(slideCount)) {
        return Array.from({ length: slideCount }).map((_, index) => {
          const state = getDetailSliderDotState(slideCount, normalizedActive, index);
          return `<button type="button" class="${state.className}" style="--dot-x:${state.x}; --dot-scale:${state.scale}" onclick="setDetailSlide(${index})" aria-label="슬라이드 ${index + 1} 보기"></button>`;
        }).join("");
      }
      return Array.from({ length: slideCount }).map((_, index) => {
        const state = getDetailSliderDotState(slideCount, normalizedActive, index);
        const stateClass = state.visible ? state.className.replace(" is-visible", "") : "detail-slider-dot swiper-pagination-bullet";
        return `<button type="button" class="${stateClass}" onclick="setDetailSlide(${index})" aria-label="슬라이드 ${index + 1} 보기"></button>`;
      }).join("");
    }

    function renderDetailPhoneIcon() {
      return `<svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-phone-icon lucide-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg>`;
    }

    function renderDetailCalendarIcon() {
      return `<svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-calendar-icon lucide-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>`;
    }

    function renderDetailChevronRightIcon() {
      return `<svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-chevron-right-icon lucide-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
    }

    function getDetailShareHost() {
      const host = window.location.hostname;
      if (/^m\./i.test(host)) return "m.secret-tour.com";
      if (/^(www\.)?secret-tour\.com$/i.test(host)) return "www.secret-tour.com";
      return window.matchMedia("(max-width: 640px)").matches ? "m.secret-tour.com" : "www.secret-tour.com";
    }

    function buildDetailGoodsSourceUrl(join = {}) {
      const parsedReference = parseSecretTourProductReference(join.id || join.erpProductId || "", join.eventSeq || join.erpEventSeq || "");
      const goodSeq = String(join.goodSeq || parsedReference.goodSeq || join.erpProductId || "").trim();
      const eventSeq = String(join.eventSeq || parsedReference.eventSeq || join.erpEventSeq || "").trim();
      const url = new URL("https://www.secret-tour.com/event/plan_view?eventPlanSeq=3&page=1");
      url.searchParams.set("golfjoinOpen", "detail");
      if (goodSeq) url.searchParams.set("goodSeq", goodSeq);
      if (eventSeq) url.searchParams.set("eventSeq", eventSeq);
      return url.toString();
    }

    function stripSharePreviewText(value = "") {
      return String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function truncateSharePreviewText(value = "", maxLength = 160) {
      const text = stripSharePreviewText(value);
      if (text.length <= maxLength) return text;
      return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
    }

    function getDetailSharePreviewImage(payload = {}, join = payload) {
      const candidates = [
        payload.imageUrl,
        payload.image,
        ...getDetailSlides(payload),
        join.imageUrl,
        join.image,
        ...getDetailSlides(join)
      ].filter((image) => /^https?:\/\//i.test(String(image || "").trim()));
      return [...new Set(candidates.map((image) => String(image).trim()))][0]
        || "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/hero_banner1.webp";
    }

    function getDetailSharePreviewDescription(payload = {}, join = payload) {
      const direct = stripSharePreviewText(payload.description || payload.goodDescription || join.goodDescription || join.description || "");
      if (direct) return truncateSharePreviewText(direct, 180);
      const schedule = getKakaoCommerceScheduleText(payload, join);
      const duration = getKakaoCommerceDurationText(payload, join);
      const region = [payload.country || join.country || "", payload.region || join.region || ""].filter(Boolean).join(" ");
      const spotsValue = Number(payload.emptySlots ?? join.emptySlots ?? 0);
      const spots = spotsValue > 0 ? `잔여 ${spotsValue}자리` : "";
      return truncateSharePreviewText(["함께 떠날 골프친구를 찾는 중", region, schedule, duration, spots].filter(Boolean).join(" · "), 180);
    }

    function buildDetailShareOgUrl(payload = {}, targetUrl = "") {
      const endpoint = new URL(GOLFJOIN_SHEET_API_ENDPOINT, window.location.href);
      const target = targetUrl || payload.sourceUrl || buildDetailGoodsSourceUrl(payload);
      const parsedReference = parseSecretTourProductReference(payload.id || payload.erpProductId || "", payload.eventSeq || payload.erpEventSeq || "");
      const goodSeq = String(payload.goodSeq || parsedReference.goodSeq || payload.erpProductId || "").trim();
      const eventSeq = String(payload.eventSeq || parsedReference.eventSeq || payload.erpEventSeq || "").trim();
      endpoint.search = "";
      endpoint.searchParams.set("action", "share_og");
      endpoint.searchParams.set("url", target);
      endpoint.searchParams.set("title", truncateSharePreviewText(payload.title || document.title, 90));
      endpoint.searchParams.set("desc", getDetailSharePreviewDescription(payload, payload));
      endpoint.searchParams.set("image", getDetailSharePreviewImage(payload, payload));
      if (goodSeq) endpoint.searchParams.set("goodSeq", goodSeq);
      if (eventSeq) endpoint.searchParams.set("eventSeq", eventSeq);
      endpoint.searchParams.set("ogv", String(payload.updatedAt || payload.createdAt || payload.departureDate || eventSeq || goodSeq || "1").replace(/[^\w.-]/g, "").slice(0, 40) || "1");
      return endpoint.toString();
    }

    function getDetailWishEndpoint() {
      if (/^(m\.|www\.)?secret-tour\.com$/i.test(window.location.hostname)) return "/goods/updateGoodsWish.json";
      const host = window.matchMedia("(max-width: 640px)").matches ? "m.secret-tour.com" : "www.secret-tour.com";
      return `https://${host}/goods/updateGoodsWish.json`;
    }

    async function postDetailGoodsWish(goodSeq) {
      if (!/^(m\.|www\.)?secret-tour\.com$/i.test(window.location.hostname)) return { skipped: true };
      const body = new URLSearchParams({ goodSeq: String(goodSeq || "") });
      const response = await fetch(getDetailWishEndpoint(), {
        method: "POST",
        credentials: "include",
        cache: "no-cache",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest"
        },
        body
      });
      if (!response.ok) throw new Error(`Wish request failed: ${response.status}`);
      return response.json().catch(() => ({}));
    }

    function refreshDetailWishButtons() {
      const join = currentDetailJoinData || joins.find((item) => item.id === currentDetailJoinId) || {};
      const wished = isJoinProductWished(join);
      document.querySelectorAll(".detail-mobile-header-button[data-detail-wish-button]").forEach((button) => {
        button.classList.toggle("is-wished", wished);
        button.setAttribute("aria-pressed", wished ? "true" : "false");
      });
    }

    function restoreDetailModalForLoginAction(joinId = "") {
      const targetId = String(joinId || currentDetailJoinId || "").trim();
      if (!targetId) return false;
      const isDetailOpen = document.getElementById("detailModal")?.classList.contains("open");
      if (isDetailOpen && currentDetailJoinId === targetId) return true;
      const join = joins.find((item) => item.id === targetId);
      if (!join) return false;
      openDetail(targetId);
      return true;
    }

    async function continueDetailWishAfterLogin(params = {}, options = {}) {
      const wishJoinId = params.wishJoinId || params.joinId || currentDetailJoinId || "";
      restoreDetailModalForLoginAction(wishJoinId);
      if (!options.skipProfileCheck) {
        const member = await ensureJoinMemberProfileReady("detail-wish", wishJoinId ? { wishJoinId } : {});
        if (!member) return;
      }
      await handleDetailWish({ skipLogin: true });
    }

    async function handleDetailWish(options = {}) {
      const member = getJoinCachedCurrentMember();
      if (!getJoinWishMemberKey(member)) {
        const joinId = currentDetailJoinId || currentDetailJoinData?.id || "";
        redirectToJoinLogin("detail-wish", joinId ? { wishJoinId: joinId } : {});
        return;
      }
      const join = currentDetailJoinData || joins.find((item) => item.id === currentDetailJoinId) || {};
      const wishType = getJoinWishType(join);
      const goodSeq = getJoinProductGoodSeq(join);
      if (wishType === "product" && !goodSeq) {
        alert("찜하기에 필요한 상품번호를 확인할 수 없습니다.");
        return;
      }
      const alreadyWished = isJoinProductWished(join);
      if (alreadyWished) {
        const snapshot = createJoinWishProductSnapshot(join);
        const targetKey = getJoinWishTargetKey(snapshot);
        try {
          if (wishType === "product") await postDetailGoodsWish(goodSeq || targetKey);
        } catch (error) {
          golfJoinSafeWarn("Secret Tour wish toggle request failed.", error);
        }
        removeJoinWishProduct(targetKey, wishType);
        refreshDetailWishButtons();
        alert(wishType === "join_schedule" ? "찜한 조인 일정에서 삭제되었습니다." : "찜한 상품에서 삭제되었습니다.");
        return;
      }
      addJoinWishProduct(join);
      refreshDetailWishButtons();
      try {
        if (wishType === "product") await postDetailGoodsWish(goodSeq);
      } catch (error) {
        golfJoinSafeWarn("Secret Tour wish request failed.", error);
      }
      alert(wishType === "join_schedule" ? "찜한 조인 일정에 추가되었습니다." : "찜한 상품에 추가되었습니다.");
    }

    function getDetailShortUrlEndpoint(sourceUrl) {
      const params = new URLSearchParams({ sourceUrl });
      const targetHost = getDetailShareHost();
      const currentHost = window.location.hostname;
      const path = `/goods/getGoodsShortUrl.json?${params.toString()}`;
      if (/^(m\.|www\.)?secret-tour\.com$/i.test(currentHost)) return path;
      return `https://${targetHost}${path}`;
    }

    async function fetchDetailShareUrl(sourceUrl) {
      if (!/^(m\.|www\.)?secret-tour\.com$/i.test(window.location.hostname)) return sourceUrl;
      try {
        const response = await fetch(getDetailShortUrlEndpoint(sourceUrl), {
          method: "GET",
          credentials: "include",
          headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        if (!response.ok) return sourceUrl;
        const data = await response.json();
        return data?.data?.shortUrl || sourceUrl;
      } catch (error) {
        golfJoinSafeWarn("short url failed", error);
        return sourceUrl;
      }
    }

    function getDetailFacebookShareUrl(shareUrl, title) {
      return `https://www.facebook.com/sharer.php?u=${encodeURIComponent(shareUrl)}&t=${encodeURIComponent(title || "")}`;
    }

    function getDetailSmsShareUrl(shareUrl) {
      const smsSeparator = /iphone|ipad|ipod/i.test(navigator.userAgent) ? "&" : "?";
      return `sms://${smsSeparator}body=${encodeURIComponent(shareUrl)}`;
    }

    function getCurrentGolfJoinShareUrl() {
      const url = new URL(window.location.href);
      [
        "afterLogin",
        "applyJoinId",
        "wishJoinId",
        "builderAction",
        "builderProductId",
        "productGroupKey",
        "countryKey",
        "returnUrl"
      ].forEach((key) => url.searchParams.delete(key));
      url.hash = "";
      return url.toString();
    }

    function buildCompletionSharePayload(type = "apply") {
      const join = currentDetailJoinData || joins.find((item) => item.id === currentDetailJoinId) || null;
      if (type === "apply" && join) {
        return {
          ...join,
          title: join.title || "시크릿투어 조인골프",
          description: join.goodDescription || join.description || "함께 떠나는 시크릿투어 조인골프",
          imageUrl: getDetailSlides(join)[0] || join.image || "",
          sourceUrl: buildDetailGoodsSourceUrl(join)
        };
      }
      if (type === "builder" && latestBuilderApplicationShareJoin) {
        const createdJoin = latestBuilderApplicationShareJoin;
        return {
          ...createdJoin,
          title: createdJoin.title || "시크릿투어 조인골프",
          description: "생성된 조인 일정 상세를 공유합니다.",
          imageUrl: getDetailSlides(createdJoin)[0] || createdJoin.image || "",
          sourceUrl: buildDetailGoodsSourceUrl(createdJoin)
        };
      }
      const builderProduct = builderState.productId
        ? (currentDetailJoinData || [...(externalGolfJoinProducts || []), ...joins].find((item) => item.id === builderState.productId))
        : null;
      return {
        ...(builderProduct || {}),
        title: builderProduct?.title || "시크릿투어 조인골프",
        description: type === "builder"
          ? "새로운 골프 조인 모임을 함께 만들어보세요."
          : "취향이 통하는 골프친구와 함께 떠나는 조인여행",
        imageUrl: builderProduct ? (getDetailSlides(builderProduct)[0] || builderProduct.image || "") : "",
        sourceUrl: builderProduct ? buildDetailGoodsSourceUrl(builderProduct) : getCurrentGolfJoinShareUrl()
      };
    }

    function ensureDetailShareModal() {
      let overlay = document.getElementById("detailShareModal");
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "detailShareModal";
      overlay.className = "detail-share-overlay";
      overlay.setAttribute("onclick", "handleDetailShareBackdrop(event)");
      document.body.appendChild(overlay);
      return portalOverlayToBody("joinProfileManageOverlay") || overlay;
    }

    function handleDetailShareBackdrop(event) {
      if (event.target?.id === "detailShareModal") closeDetailShareModal();
    }

    function closeDetailShareModal() {
      const modal = document.getElementById("detailShareModal");
      resetModalRuntimeState(modal);
      modal?.classList.remove("open");
    }

    function ensureDetailCopyAlert() {
      let overlay = document.getElementById("detailCopyAlert");
      if (overlay) return overlay;
      overlay = document.createElement("div");
      overlay.id = "detailCopyAlert";
      overlay.className = "detail-copy-alert-overlay";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.innerHTML = `
        <div class="detail-copy-alert-panel">
          <div class="detail-copy-alert-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
          </div>
          <div class="detail-copy-alert-title">주소가 복사되었습니다</div>
          <div class="detail-copy-alert-copy">원하는 곳에 붙여넣어 공유해 주세요.</div>
        </div>
      `;
      document.body.appendChild(overlay);
      return overlay;
    }

    function showDetailCopyAlert() {
      const overlay = ensureDetailCopyAlert();
      window.clearTimeout(overlay._closeTimer);
      overlay.classList.add("open");
      overlay._closeTimer = window.setTimeout(() => {
        overlay.classList.remove("open");
      }, 1400);
    }

    function copyTextWithSelectionFallback(text) {
      const target = document.createElement("textarea");
      target.value = text;
      target.setAttribute("readonly", "");
      target.style.position = "fixed";
      target.style.left = "-9999px";
      target.style.top = "0";
      target.style.opacity = "0";
      document.body.appendChild(target);
      target.focus();
      target.select();
      if (target.setSelectionRange) target.setSelectionRange(0, target.value.length);
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        target.remove();
      }
      return copied;
    }

    async function copyDetailShareUrl() {
      const input = document.getElementById("detailShareUrlInput");
      const url = input?.value || "";
      if (!url) return;
      try {
        let copied = false;
        if (window.isSecureContext && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          copied = true;
        } else {
          copied = copyTextWithSelectionFallback(url);
        }
        if (!copied) copied = copyTextWithSelectionFallback(url);
        if (!copied) throw new Error("Clipboard copy failed");
        showDetailCopyAlert();
      } catch (error) {
        input?.focus();
        input?.select();
        golfJoinSafeWarn("copy failed", error);
        window.prompt("자동 복사가 제한되어 있습니다. 아래 주소를 복사해 주세요.", url);
      }
    }

    function getKakaoCommercePrice(value) {
      const price = Number(String(value || "").replace(/[^\d]/g, ""));
      return Number.isFinite(price) && price > 0 ? String(Math.round(price)) : "0";
    }

    function getKakaoCommerceMobileUrl(webUrl) {
      try {
        const url = new URL(webUrl || getCurrentGolfJoinShareUrl());
        if (/^(www\.)?secret-tour\.com$/i.test(url.hostname)) url.hostname = "m.secret-tour.com";
        return url.toString();
      } catch (error) {
        return webUrl || getCurrentGolfJoinShareUrl();
      }
    }

    function getKakaoCommerceImageCandidates(source = {}) {
      const candidates = [
        source.imageUrl,
        source.image,
        source.goodsImage,
        ...(Array.isArray(source.slides) ? source.slides : []),
        ...(Array.isArray(source.introImages) ? source.introImages : [])
      ].filter((image) => /^https?:\/\//i.test(String(image || "").trim()));
      return [...new Set(candidates.map((image) => String(image).trim()))];
    }

    function getKakaoCommerceImages(payload = {}, join = {}) {
      const candidates = [
        ...getKakaoCommerceImageCandidates(payload),
        ...getKakaoCommerceImageCandidates(join)
      ];
      const images = [...new Set(candidates.map((image) => String(image).trim()))];
      const fallback = "https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/hero_banner1.webp";
      while (images.length < 3) images.push(images[images.length - 1] || fallback);
      return images.slice(0, 3);
    }

    function formatKakaoCommerceDateWithDay(isoDate) {
      const text = String(isoDate || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      const date = new Date(`${text}T00:00:00`);
      if (Number.isNaN(date.getTime())) return text;
      const dayNames = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];
      return `${text}(${dayNames[date.getDay()]})`;
    }

    function getKakaoCommerceScheduleText(payload = {}, join = {}) {
      const start = payload.departureDate || join.departureDate || "";
      const end = payload.returnDate || join.returnDate || "";
      if (start && end) return `${formatKakaoCommerceDateWithDay(start)}~${formatKakaoCommerceDateWithDay(end)}`;
      return payload.date || join.date || start || end || "";
    }

    function getKakaoCommerceDurationText(payload = {}, join = {}) {
      const existing = payload.duration || join.duration || "";
      if (existing) return existing;
      const start = payload.departureDate || join.departureDate || "";
      const end = payload.returnDate || join.returnDate || "";
      if (!start || !end) return "";
      const startDate = new Date(`${start}T00:00:00`);
      const endDate = new Date(`${end}T00:00:00`);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "";
      const days = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
      return `${Math.max(0, days - 1)}\uBC15${days}\uC77C`;
    }

    function buildKakaoCommerceTemplateArgs(payload = {}, join = {}) {
      const url = payload.sourceUrl || payload.url || document.getElementById("detailShareUrlInput")?.value || buildDetailGoodsSourceUrl(join);
      const mobileUrl = getKakaoCommerceMobileUrl(url);
      const images = getKakaoCommerceImages(payload, join);
      const price = getKakaoCommercePrice(payload.price || payload.productPrice || join.price || join.productPrice);
      const schedule = getKakaoCommerceScheduleText(payload, join);
      const duration = getKakaoCommerceDurationText(payload, join);
      const spotsValue = Number(payload.emptySlots ?? join.emptySlots ?? 0);
      const spots = spotsValue > 0 ? `\uC794\uC5EC ${spotsValue}\uC790\uB9AC` : "\uC794\uC5EC \uC790\uB9AC \uD655\uC778";
      const descParts = ["\uD568\uAED8 \uB5A0\uB0A0 \uACE8\uD504\uCE5C\uAD6C \uCC3E\uB294 \uC911", schedule || "\uC77C\uC815 \uD655\uC778", duration, spots].filter(Boolean);
      const desc = payload.description || descParts.join(" \u00B7 ");
      return {
        TITLE: payload.title || join.title || document.title,
        DESC: desc,
        THU: images[0],
        THU2: images[1],
        THU3: images[2],
        PRICE: price,
        DISCOUNT_PRICE: "",
        DISCOUNT_RATE: "",
        CURRENCY: "\uC6D0",
        SCHEDULE: schedule || "\uC77C\uC815 \uD655\uC778",
        SPOTS: spots,
        WEB_URL: url,
        MOBILE_WEB_URL: mobileUrl
      };
    }

    async function shareDetailToKakao() {
      let join = currentDetailJoinData || joins.find((item) => item.id === currentDetailJoinId) || {};
      let payload = currentSharePayload || join;
      const url = payload.sourceUrl || payload.url || document.getElementById("detailShareUrlInput")?.value || buildDetailGoodsSourceUrl(join);
      if (join?.goodSeq && join?.eventSeq && !join.secretTourDetailLoaded) {
        try {
          const detail = await loadSecretTourGoodsDetail(join);
          const enrichedJoin = mergeSecretTourGoodsDetail(join, detail);
          Object.assign(join, enrichedJoin, { secretTourDetailLoaded: true });
          if (currentDetailJoinData?.id === join.id) currentDetailJoinData = join;
          payload = { ...payload, ...enrichedJoin };
          if (currentSharePayload) currentSharePayload = { ...currentSharePayload, ...enrichedJoin };
        } catch (error) {
          golfJoinSafeWarn("Failed to load share images from Secret Tour detail.", error);
        }
      }
      let KakaoSdk = window.Kakao;
      if (!KakaoSdk?.Share?.sendCustom && !KakaoSdk?.Link?.sendCustom) {
        try {
          KakaoSdk = await ensureJoinKakaoSdk();
        } catch (error) {
          golfJoinSafeWarn("Kakao share sdk failed", error);
        }
      }
      if (KakaoSdk && !KakaoSdk.isInitialized?.()) KakaoSdk.init(JOIN_KAKAO_JS_KEY);
      const templateArgs = buildKakaoCommerceTemplateArgs({ ...payload, url }, join);
      if (KakaoSdk?.Share?.sendCustom) {
        KakaoSdk.Share.sendCustom({
          templateId: GOLFJOIN_KAKAO_COMMERCE_TEMPLATE_ID,
          templateArgs
        });
        return;
      }
      if (KakaoSdk?.Link?.sendCustom) {
        KakaoSdk.Link.sendCustom({
          templateId: GOLFJOIN_KAKAO_COMMERCE_TEMPLATE_ID,
          templateArgs
        });
        return;
        KakaoSdk.Link.sendDefault({
          objectType: "feed",
          content: {
            title: payload.title || join.title || document.title,
            description: join.goodDescription || join.description || "시크릿투어 골프여행",
            description: payload.description || join.goodDescription || join.description || "시크릿투어 골프여행",
            imageUrl: payload.imageUrl || getDetailSlides(join)[0] || join.image || "",
            link: {
              mobileWebUrl: url,
              webUrl: url
            }
          }
        });
        return;
      }
      copyDetailShareUrl();
    }

    function openDetailShareModal(join, shareUrl, options = {}) {
      const overlay = ensureDetailShareModal();
      const title = join?.title || document.title;
      currentSharePayload = { ...(join || {}), title, url: shareUrl, sourceUrl: join?.sourceUrl || shareUrl, ogShareUrl: options.ogShareUrl || "" };
      overlay.innerHTML = `
        <div class="detail-share-panel" role="dialog" aria-modal="true" aria-labelledby="detailShareTitle">
          <div class="detail-share-head">
            <div class="detail-share-title" id="detailShareTitle">공유하기</div>
            <button type="button" class="detail-share-close" onclick="closeDetailShareModal()" aria-label="닫기">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
            </button>
          </div>
          <div class="detail-share-body">
            <div class="detail-share-list" aria-label="공유 채널">
              <button type="button" class="detail-share-item kakao" onclick="shareDetailToKakao()"><div class="detail-share-icon"><img src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/kakao.webp" alt="" loading="lazy" decoding="async"></div><div>카카오톡으로 공유하기</div></button>
              <button type="button" class="detail-share-item url" onclick="copyDetailShareUrl()"><div class="detail-share-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg></div><div>주소 복사하기</div></button>
            </div>
            <div class="detail-share-url-row">
              <input type="text" class="detail-share-url-input" id="detailShareUrlInput" value="${escapeHtml(shareUrl)}" readonly>
              <button type="button" class="detail-share-copy-button" onclick="copyDetailShareUrl()">복사</button>
            </div>
          </div>
        </div>
      `;
      overlay.classList.add("open");
    }

    function updateDetailShareModalUrl(shareUrl, title = document.title) {
      const input = document.getElementById("detailShareUrlInput");
      if (input) input.value = shareUrl;
      if (currentSharePayload) currentSharePayload.url = shareUrl;
    }

    async function handleDetailShare() {
      const join = currentDetailJoinData || joins.find((item) => item.id === currentDetailJoinId) || {};
      const sourceUrl = buildDetailGoodsSourceUrl(join);
      const ogShareUrl = buildDetailShareOgUrl({ ...join, sourceUrl }, sourceUrl);
      openDetailShareModal({ ...join, sourceUrl }, sourceUrl, { ogShareUrl });
      const shareUrl = await fetchDetailShareUrl(sourceUrl);
      if (shareUrl !== sourceUrl) updateDetailShareModalUrl(shareUrl, join.title || document.title);
    }
    async function handleCompletionShare(type = "apply") {
      const payload = buildCompletionSharePayload(type);
      const sourceUrl = payload.sourceUrl || getCurrentGolfJoinShareUrl();
      const ogShareUrl = buildDetailShareOgUrl({ ...payload, sourceUrl }, sourceUrl);
      openDetailShareModal({ ...payload, sourceUrl }, sourceUrl, { ogShareUrl });
      const shareUrl = await fetchDetailShareUrl(sourceUrl);
      if (shareUrl !== sourceUrl) updateDetailShareModalUrl(shareUrl, payload.title || document.title);
    }
    window.handleDetailShare = handleDetailShare;
    window.handleCompletionShare = handleCompletionShare;
    window.closeDetailShareModal = closeDetailShareModal;
    window.handleDetailShareBackdrop = handleDetailShareBackdrop;
    window.copyDetailShareUrl = copyDetailShareUrl;
    window.shareDetailToKakao = shareDetailToKakao;

    function setDetailDefaultContactActions() {
      const phone = document.getElementById("detailPhoneButton");
      const kakao = document.getElementById("detailKakaoButton");
      const dateChange = document.getElementById("detailDateChangeButton");
      const primary = document.getElementById("detailPrimaryButton");
      if (phone) {
        phone.hidden = false;
        phone.className = "button secondary detail-contact-button detail-phone-button";
        phone.innerHTML = renderDetailPhoneIcon();
        phone.setAttribute("onclick", "handlePhoneContact()");
        phone.setAttribute("aria-label", "전화문의");
      }
      if (kakao) kakao.hidden = false;
      if (dateChange) dateChange.hidden = true;
      primary?.style.removeProperty("grid-column");
    }

    function setDetailSingleSecondaryAction(label, action) {
      const phone = document.getElementById("detailPhoneButton");
      const kakao = document.getElementById("detailKakaoButton");
      const dateChange = document.getElementById("detailDateChangeButton");
      const primary = document.getElementById("detailPrimaryButton");
      if (phone) {
        phone.hidden = false;
        phone.className = "button secondary";
        phone.textContent = label;
        phone.setAttribute("onclick", action);
        phone.removeAttribute("aria-label");
      }
      if (kakao) kakao.hidden = true;
      if (dateChange) dateChange.hidden = true;
      primary?.style.removeProperty("grid-column");
    }

    function setDetailPrimaryOnlyAction(label, action) {
      const phone = document.getElementById("detailPhoneButton");
      const kakao = document.getElementById("detailKakaoButton");
      const dateChange = document.getElementById("detailDateChangeButton");
      const primary = document.getElementById("detailPrimaryButton");
      if (phone) phone.hidden = true;
      if (kakao) kakao.hidden = true;
      if (dateChange) dateChange.hidden = true;
      if (primary) {
        primary.textContent = label;
        primary.setAttribute("onclick", action);
        primary.style.gridColumn = "1 / -1";
      }
    }

    function isDetailOwnActiveSchedule(join = {}, options = {}) {
      return Boolean(
        options.ownActiveSchedule
        || findOwnActiveJoinSchedule(join)
        || isCurrentMemberCreatedJoinSchedule(join)
        || isCurrentMemberJoinedJoinSchedule(join)
      );
    }

    function setDetailNormalPrimaryAction(join = {}, options = {}) {
      const primary = document.getElementById("detailPrimaryButton");
      if (!primary) return;
      if (isJoinFullyBooked(join)) {
        primary.textContent = "마감되었어요";
        primary.removeAttribute("onclick");
        primary.setAttribute("aria-label", "마감되었어요");
        primary.disabled = true;
        primary.setAttribute("aria-disabled", "true");
        return;
      }
      const ownActiveSchedule = isDetailOwnActiveSchedule(join, options);
      const label = ownActiveSchedule ? "멤버 추가하기" : "참여하기";
      primary.textContent = label;
      primary.setAttribute("onclick", "openGlobalApply()");
      primary.setAttribute("aria-label", label);
      primary.disabled = false;
      primary.setAttribute("aria-disabled", "false");
    }

    function setDetailBuilderProductActions() {
      clearDetailScheduleConflictState();
      setDetailPrimaryOnlyAction("모임 만들기", "handleDetailPrimaryAction()");
    }

    function setDetailMdPickRecruitActions() {
      clearDetailScheduleConflictState();
      setDetailDefaultContactActions();
      const dateChange = document.getElementById("detailDateChangeButton");
      if (dateChange) {
        dateChange.hidden = false;
        dateChange.innerHTML = `${renderDetailCalendarIcon()}<span>날짜변경</span>`;
        dateChange.setAttribute("onclick", "handleDetailDateChangeAction()");
      }
    }

    function setDetailScheduleConflictState(join = {}) {
      const detailModal = document.getElementById("detailModal");
      const primary = document.getElementById("detailPrimaryButton");
      const notice = document.getElementById("detailScheduleConflictNotice");
      const blocked = Boolean(getBlockingActiveJoinSchedule(join));
      const fullyBooked = isJoinFullyBooked(join);
      detailModal?.classList.toggle("has-schedule-conflict", blocked);
      if (notice) notice.classList.toggle("is-visible", blocked);
      if (primary && currentDetailMode === "normal") {
        primary.disabled = blocked || fullyBooked;
        primary.setAttribute("aria-disabled", blocked || fullyBooked ? "true" : "false");
      }
      return blocked;
    }

    function clearDetailScheduleConflictState() {
      const detailModal = document.getElementById("detailModal");
      const primary = document.getElementById("detailPrimaryButton");
      const notice = document.getElementById("detailScheduleConflictNotice");
      detailModal?.classList.remove("has-schedule-conflict");
      notice?.classList.remove("is-visible");
      if (primary) {
        primary.disabled = false;
        primary.setAttribute("aria-disabled", "false");
      }
    }

    function openDetail(id, options = {}) {
      const join = joins.find((item) => item.id === id);
      if (!join || (!options.allowUnavailable && !shouldDisplayJoinProduct(join))) return;
      const detailPerformanceGeneration = beginGolfJoinDetailPerformance();
      currentDetailMode = "normal";
      currentDetailJoinId = id;
      currentDetailJoinData = join;
      currentDetailReturnContext = options.returnToJoinMy || null;
      addJoinRecentViewedItem(join, "join_schedule");
      currentDetailSlideIndex = 0;
      stopDetailReviewAutoSlide();
      closeDetailApply();
      document.getElementById("detailModalTitle").textContent = join.title;
      renderDetailContent(join, options);
      const secondary = document.querySelector("#detailModal .detail-modal-actions .button.secondary");
      setDetailNormalPrimaryAction(join, options);
      if (secondary) {
        setDetailDefaultContactActions();
      }
      const detailModal = document.getElementById("detailModal");
      detailModal?.classList.remove("builder-select-mode", "builder-product-detail-mode", "mdpick-recruit-mode", "my-reservation-view-mode");
      if (!options.elevateOverBuilder) detailModal?.style.removeProperty("z-index");
      setDetailScheduleConflictState(join);

      openModal("detailModal", { pageScrollState: options.pageScrollState });
      requestAnimationFrame(() => {
        prepareDetailScheduleHeights({ forceOpen: true });
        resetDetailModalScroll();
        finishGolfJoinDetailPerformance(
          detailPerformanceGeneration,
          "golfjoin:detail:visible",
          "golfjoin:duration:detail-visible"
        );
      });
      enrichOpenDetailWithSecretTourData(join, options, detailPerformanceGeneration);
    }

    function openBuilderDetail(id) {
      const join = joins.find((item) => item.id === id);
      if (!join) return;
      currentDetailMode = "builder";
      currentDetailJoinId = id;
      currentDetailJoinData = join;
      currentDetailSlideIndex = 0;
      stopDetailReviewAutoSlide();
      closeDetailApply();
      document.getElementById("detailModalTitle").textContent = join.title;
      renderDetailContent(join, { mode: "builder" });
      const primary = document.getElementById("detailPrimaryButton");
      const secondary = document.querySelector("#detailModal .detail-modal-actions .button.secondary");
      if (primary) {
        primary.textContent = "신청 취소";
        primary.setAttribute("onclick", "handleDetailPrimaryAction()");
      }
      if (secondary) {
        setDetailSingleSecondaryAction("이전", "closeModal('detailModal')");
      }
      clearDetailScheduleConflictState();
      document.getElementById("detailModal")?.classList.remove("builder-product-detail-mode");
      document.getElementById("detailModal")?.classList.add("builder-select-mode");
      openModal("detailModal");
      requestAnimationFrame(() => {
        prepareDetailScheduleHeights({ forceOpen: true });
        resetDetailModalScroll();
      });
    }

    async function handleDetailPrimaryAction() {
      if (currentDetailMode === "mdPickProduct") {
        const groupKey = currentMdPickProductGroupKey;
        const countryKey = currentMdPickCountryKey;
        const product = currentDetailJoinData;
        const loginParams = getCurrentBuilderLoginParams("mdpick-recruit");
        const loadingToken = openJoinActionLoading("신청 정보를 확인하고 있어요");
        try {
          const member = await ensureJoinMemberProfileReady("builder", loginParams);
          if (!member) return;
          closeModal("detailModal");
          if (getBlockingActiveJoinSchedule(product)) {
            await openMdPickBuilder(groupKey, countryKey, { dateChangeMode: true, product });
            return;
          }
          await openMdPickBuilderWithCurrentDate(groupKey, countryKey, product, { skipProfileCheck: true });
        } finally {
          await closeJoinActionLoading(loadingToken);
        }
        return;
      }
      if (currentDetailMode === "builderProduct") {
        const loginParams = getCurrentBuilderLoginParams("builder-product");
        const loadingToken = openJoinActionLoading("신청 정보를 확인하고 있어요");
        try {
          const member = await ensureJoinMemberProfileReady("builder", loginParams);
          if (!member) return;
          if (!selectBuilderProduct(currentDetailJoinId)) return;
          closeModal("detailModal");
          const opened = await openModal("builderModal", { preserveBuilderState: true, skipProfileCheck: true });
          if (!opened) return;
          setBuilderStep(3);
          suppressBuilderNextUntil = Date.now() + 500;
        } finally {
          await closeJoinActionLoading(loadingToken);
        }
        return;
      }
      if (currentDetailMode === "builder") {
        closeModal("detailModal");
        setBuilderStep(4);
        return;
      }
      openDetailApply();
    }

    function handleDetailDateChangeAction() {
      if (currentDetailMode !== "mdPickProduct") {
        closeModal("detailModal");
        return;
      }
      const loginParams = getCurrentBuilderLoginParams("mdpick-detail");
      if (!requireJoinLogin("builder", loginParams)) return;
      const groupKey = currentMdPickProductGroupKey;
      const countryKey = currentMdPickCountryKey;
      const product = currentDetailJoinData;
      closeModal("detailModal");
      openMdPickBuilder(groupKey, countryKey, { dateChangeMode: true, product });
    }

    function setDetailSlide(index) {
      const join = getCurrentDetailJoin();
      if (!join) return;
      const slides = getDetailSlides(join);
      currentDetailSlideIndex = Math.max(0, Math.min(index, slides.length - 1));
      updateDetailSlider();
    }

    function changeDetailSlide(direction) {
      const join = getCurrentDetailJoin();
      if (!join) return;
      const slides = getDetailSlides(join);
      if (direction > 0 && currentDetailSlideIndex === slides.length - 1) {
        currentDetailSlideIndex = slides.length;
        updateDetailSlider();
        setTimeout(() => {
          currentDetailSlideIndex = 0;
          updateDetailSlider(false);
        }, 380);
        return;
      }
      currentDetailSlideIndex = (currentDetailSlideIndex + direction + slides.length) % slides.length;
      updateDetailSlider();
    }

    function updateDetailSlider(animate = true) {
      const track = document.querySelector("#detailContent .detail-slider-track");
      if (track) {
        if (!animate) track.style.transition = "none";
        track.style.transform = `translateX(-${currentDetailSlideIndex * 100}%)`;
        if (!animate) {
          track.offsetHeight;
          track.style.transition = "";
        }
      }

      const join = getCurrentDetailJoin();
      const slideCount = join ? getDetailSlides(join).length : 1;
      const activeIndex = currentDetailSlideIndex % slideCount;
      const dots = document.querySelector("#detailContent .detail-slider-dots");
      if (dots) updateDetailSliderDotsElement(dots, slideCount, activeIndex);
      const pageText = document.getElementById("detailSliderPageText");
      if (pageText) pageText.textContent = `${activeIndex + 1}/${slideCount}`;
      const pageBadge = document.querySelector("#detailContent .detail-slider-pagination");
      if (pageBadge) pageBadge.setAttribute("aria-label", `상품 이미지 ${activeIndex + 1} / ${slideCount}`);
    }

    function bindDetailSliderSwipe() {
      const viewport = document.querySelector("#detailContent .detail-slider-viewport");
      if (!viewport || viewport.dataset.swipeBound === "true") return;
      viewport.dataset.swipeBound = "true";
      let startX = 0;
      let startY = 0;
      let sliderTouchMode = "";
      viewport.addEventListener("touchstart", (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
        sliderTouchMode = "";
      }, { passive: true });
      viewport.addEventListener("touchmove", (event) => {
        if (!window.matchMedia("(max-width: 640px)").matches) return;
        if (event.touches?.length !== 1) return;
        const touch = event.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (!sliderTouchMode && (absX > 8 || absY > 8)) {
          sliderTouchMode = absX > absY * 1.15 ? "horizontal" : "vertical";
        }
        if (sliderTouchMode === "horizontal") {
          event.preventDefault();
        }
      }, { passive: false });
      viewport.addEventListener("touchend", (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        if (Math.abs(deltaX) < 38 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
        changeDetailSlide(deltaX < 0 ? 1 : -1);
      }, { passive: true });
    }

    function openParticipant(joinId, participantId, trigger) {
      stopQuickMobileCarousel();
      const join = getParticipantJoinById(joinId);
      const participant = join && (join.participants || []).find((item) => String(item.id || "") === String(participantId || ""));
      if (!participant) return;
      const participants = getParticipantGroup(join, participant);
      const isGroup = participants.length > 1;
      const displayName = isGroup ? formatParticipantGroupName(participants) : participant.name;
      const displayGender = isGroup ? formatParticipantGroupGender(participants, participant) : participant.gender;
      const displayAge = isGroup ? formatParticipantGroupAges(participants) : formatParticipantAge(participant);

      const floating = portalOverlayToBody("participantModal");
      if (!floating) return;
      const isMobileSheet = isMobileParticipantSheet();
      const shouldElevateOverParentModal = [
        "detailModal",
        "joinMyMenuModal"
      ].some((modalId) => (
        Boolean(trigger?.closest?.(`#${modalId}`))
        && document.getElementById(modalId)?.classList.contains("open")
      ));
      const overlayZIndex = isMobileSheet && !shouldElevateOverParentModal ? "2147482990" : "2147483700";
      const contentZIndex = isMobileSheet && !shouldElevateOverParentModal ? "2147482991" : "2147483701";
      floating.style.setProperty("z-index", overlayZIndex, "important");
      document.getElementById("participantContent")?.style.setProperty("z-index", contentZIndex, "important");
      if (floating.classList.contains("open") && activeParticipantTrigger === trigger) {
        closeParticipant();
        return;
      }
      document.getElementById("participantContent").innerHTML = `
        <div class="participant-sheet-header">
          <div class="participant-sheet-title">참여자 정보</div>
        </div>
        <div class="participant-profile">
          <div class="participant-hero">
            ${renderParticipantHeroThumb(participants, participant)}
            <div class="participant-hero-info">
              <div class="participant-name">${escapeHtml(displayName)}</div>
              <div class="participant-meta">
                <div>${isGroup ? displayGender : escapeHtml(displayGender)}</div>
                <div>·</div>
                <div>${escapeHtml(displayAge)}</div>
              </div>
            </div>
          </div>
          ${participant.profession ? `
          <div class="participant-section">
            <div class="participant-section-title">주요경력/관심분야</div>
            <div class="participant-tags">
              ${String(participant.profession).split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => renderParticipantTag(tag, "profession")).join("")}
            </div>
          </div>` : ""}
          <div class="participant-section">
            <div class="participant-section-title">핸디</div>
            <div class="participant-level-pill"><span aria-hidden="true">${getParticipantLevelIcon(formatParticipantLevelLabel(participant.handicap))}</span><span>${escapeHtml(formatParticipantLevelLabel(participant.handicap))}</span></div>
          </div>
          ${participant.preferences && participant.preferences.length > 0 ? `
          <div class="participant-section">
            <div class="participant-section-title">라운딩 스타일</div>
            <div class="participant-tags">
              ${participant.preferences.map((tag) => renderParticipantTag(tag, "style")).join("")}
            </div>
          </div>` : ""}
          ${participant.message ? `
          <div class="participant-section">
            <div class="participant-section-title">참여자 한마디</div>
            <div class="participant-message bubble">${renderParticipantQuoteIcon()}<div class="participant-message-text">${escapeHtml(participant.message)}</div></div>
          </div>` : ""}
        </div>
      `;
      const content = document.getElementById("participantContent");
      floating.style.left = "0px";
      floating.style.top = "0px";
      floating.classList.remove("sheet-open");
      floating.classList.add("open");

      if (isMobileSheet) {
        activeParticipantTrigger = trigger;
        scheduleJoinMobileVisualViewportVarsUpdate({ settle: true });
        lockParticipantPageScroll();
        requestAnimationFrame(() => floating.classList.add("sheet-open"));
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const gap = 10;
      const viewportPadding = 12;
      const availableRight = window.innerWidth - rect.right - viewportPadding - gap;
      const availableLeft = rect.left - viewportPadding - gap;
      const preferRight = availableRight >= contentRect.width || availableRight >= availableLeft;
      let left = preferRight
        ? rect.right + gap
        : rect.left - contentRect.width - gap;
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - contentRect.width - viewportPadding));

      let top = rect.top + rect.height / 2 - contentRect.height / 2;
      top = Math.max(viewportPadding, Math.min(top, window.innerHeight - contentRect.height - viewportPadding));

      floating.style.left = `${left}px`;
      floating.style.top = `${top}px`;
      activeParticipantTrigger = trigger;
    }

    function handleParticipantClick(trigger) {
      cancelParticipantClose();
      const payload = JSON.parse(decodeURIComponent(trigger.dataset.participant));
      openParticipant(payload.joinId, payload.participantId, trigger);
    }

    function isPointerInsideParticipantArea(target) {
      return Boolean(target && (
        target.closest?.("[data-participant]") ||
        target.closest?.("#participantModal")
      ));
    }

    function isMobileParticipantSheet() {
      return window.matchMedia("(max-width: 768px), (hover: none) and (pointer: coarse)").matches;
    }

    function formatParticipantAge(participant) {
      const age = String(participant?.age || "").trim();
      const detail = String(participant?.ageDetail || participant?.agePhase || "").trim();
      if (!age) return "";
      if (/초반|중반|후반/.test(age)) return age.replace(/(대(?:이상)?)(초반|중반|후반)/g, "$1 $2");
      if (detail) return `${age} ${detail}`;

      const phases = ["초반", "중반", "후반"];
      const seed = String(participant?.id || participant?.name || age)
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
      return `${age} ${phases[seed % phases.length]}`;
    }

    function keepPeriodButtonInView(button) {
      const container = document.getElementById("periodButtons");
      if (!container || !button || window.innerWidth > 640) return;

      const padding = 12;
      const visibleStart = container.scrollLeft;
      const visibleEnd = visibleStart + container.clientWidth;
      const prevButton = button.previousElementSibling?.matches(".chip") ? button.previousElementSibling : null;
      const nextButton = button.nextElementSibling?.matches(".chip") ? button.nextElementSibling : null;
      const targetStartButton = prevButton || button;
      const targetEndButton = nextButton || button;
      const buttonStart = targetStartButton.offsetLeft;
      const buttonEnd = targetEndButton.offsetLeft + targetEndButton.offsetWidth;

      if (buttonStart < visibleStart + padding) {
        container.scrollTo({ left: Math.max(0, buttonStart - padding), behavior: "smooth" });
      } else if (buttonEnd > visibleEnd - padding) {
        container.scrollTo({ left: buttonEnd - container.clientWidth + padding, behavior: "smooth" });
      }
    }

    document.getElementById("periodButtons")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-period]");
      if (!button) return;
      state.period = button.dataset.period;
      document.querySelectorAll("#periodButtons .chip").forEach((chip) => chip.classList.toggle("active", chip === button));
      keepPeriodButtonInView(button);
      renderJoins();
    });

    document.getElementById("sortButtons")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-sort]");
      if (!button) return;
      state.sort = button.dataset.sort;
      document.querySelectorAll("#sortButtons .chip").forEach((chip) => chip.classList.toggle("active", chip === button));
      renderJoins();
    });

    document.addEventListener("click", (event) => {
      const chip = event.target.closest(".apply-chip");
      if (!chip) return;
      const group = chip.closest(".apply-chip-group");
      if (!group) return;
      if (group.dataset.multi === "true") {
        const max = Number(group.dataset.max) || Infinity;
        const activeCount = group.querySelectorAll(".apply-chip.active").length;
        if (chip.classList.contains("active")) {
          chip.classList.remove("active");
        } else if (activeCount < max) {
          chip.classList.add("active");
        }
      } else {
        group.querySelectorAll(".apply-chip").forEach((item) => item.classList.toggle("active", item === chip));
      }
      group.closest(".field.has-error")?.classList.remove("has-error");
      updateApplyProgressive();
      if (group.closest(".builder-apply-form")) {
        updateBuilderApplySummary();
      }
      if (group.dataset.chipGroup === "builder-gender") {
        renderCompanionGenderRows("builder");
      } else if (group.dataset.chipGroup === "global-gender") {
        renderCompanionGenderRows("global");
      }
      if (group.closest("#joinMemberSignupForm")) {
        if (group.dataset.chipGroup === "join-member-gender") {
          syncJoinMemberGenderToggleSlider(group);
        }
        if (group.dataset.chipGroup === "join-member-level" && chip.classList.contains("active")) {
          requestAnimationFrame(() => setJoinMemberSignupStep(5));
          return;
        }
        updateJoinMemberSignupNavState();
        requestAnimationFrame(updateJoinMemberSignupNavState);
      }
    });

    document.getElementById("joinMemberSignupForm")?.addEventListener("click", (event) => {
      const submitButton = event.target.closest("[data-signup-submit]");
      if (!submitButton || submitButton.disabled || submitButton.hidden) return;
      event.preventDefault();
      submitJoinMemberSignup();
    });

    document.querySelectorAll(".region-search-type button").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".region-search-type button").forEach((item) => item.classList.toggle("active", item === button));
      });
    });

    document.addEventListener("toggle", (event) => {
      const group = event.target;
      if (!(group instanceof HTMLDetailsElement) || !group.open) return;

      if (group.classList.contains("region-group")) {
        const categoryIndex = Number(group.dataset.regionCategoryIndex);
        let shouldRenderRegionMobile = false;
        if (Number.isInteger(categoryIndex)) {
          if (activeMobileRegionCategoryIndex !== categoryIndex) {
            activeMobileRegionCategoryIndex = categoryIndex;
            shouldRenderRegionMobile = true;
          }
          const defaultCountryKey = getDefaultMobileRegionCountryKey(categoryIndex);
          if (defaultCountryKey && activeMobileRegionCountryKey !== defaultCountryKey) {
            activeMobileRegionCountryKey = defaultCountryKey;
            shouldRenderRegionMobile = true;
          }
        }
        document.querySelectorAll(".region-group").forEach((item) => {
          if (item !== group) item.open = false;
        });
        if (shouldRenderRegionMobile) renderRegionMobile();
        return;
      }

      if (group.classList.contains("region-subgroup")) {
        const parent = group.closest(".region-grid-list");
        parent?.querySelectorAll(".region-subgroup").forEach((item) => {
          if (item !== group) item.open = false;
        });
      }
    }, true);

    ["wheel", "touchmove"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (!isJoinActionLoadingOpen()) return;
        event.preventDefault();
        event.stopPropagation();
      }, { passive: false, capture: true });
    });

    function isParticipantModalBackgroundScrollBlocked() {
      return isMobileParticipantSheet()
        && document.getElementById("participantModal")?.classList.contains("open")
        && document.body.classList.contains("join-participant-scroll-locked");
    }

    ["wheel", "touchmove"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (!isParticipantModalBackgroundScrollBlocked()) return;
        if (event.target.closest?.("#participantContent .participant-profile")) return;
        event.preventDefault();
        event.stopPropagation();
      }, { passive: false, capture: true });
    });

    document.querySelector("#regionSearchModal .region-search-body")?.addEventListener("click", (event) => {
      const option = event.target.closest(".region-option, .region-subregion, .region-subregion-heading");
      if (!option || option.hasAttribute("onclick")) return;
      if (option.disabled || option.classList.contains("is-unavailable")) return;
      selectRegionResult(option.dataset.region || option.textContent.replace("HOT", "").trim());
    });

    document.addEventListener("click", (event) => {
      if (regionProductSortMenuOpen && !event.target.closest(".builder-region-product-sort")) {
        regionProductSortMenuOpen = false;
        renderBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "");
      }

      if (!event.target.closest(".participant-info-wrap")) {
        document.querySelectorAll(".participant-info-wrap.open, .participant-info-wrap.suppress-hover").forEach((item) => {
          item.classList.remove("open", "suppress-hover");
        });
      }

      if (!event.target.closest(".join-mdpick-pack-info-button") && !event.target.closest(".join-mdpick-pack-tooltip")) {
        closeMdPickPackTooltips();
      }

      const trigger = event.target.closest("[data-participant]");
      if (trigger) {
        event.stopPropagation();
        handleParticipantClick(trigger);
        return;
      }

      const floating = document.getElementById("participantModal");
      if (!event.target.closest("#participantModal")) {
        closeParticipant();
      }
    });

    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".join-mdpick-pack-info-button") || event.target.closest(".join-mdpick-pack-tooltip")) return;
      closeMdPickPackTooltips();
    }, true);

    document.getElementById("participantModal")?.addEventListener("click", (event) => {
      if (event.target.id === "participantModal") {
        closeParticipant();
      }
    });

    document.addEventListener("mouseover", (event) => {
      const trigger = event.target.closest("[data-participant]");
      if (trigger) {
        cancelParticipantClose();
      }
    });

    document.addEventListener("mouseout", (event) => {
      if (isMobileParticipantSheet()) return;
      const trigger = event.target.closest("[data-participant]");
      if (!trigger && !event.target.closest("#participantModal")) return;
      const related = event.relatedTarget;
      if (isPointerInsideParticipantArea(related)) {
        return;
      }
      scheduleParticipantClose();
    });

    submitJoinMemberKakaoLogin = wrapJoinAsyncFunction(submitJoinMemberKakaoLogin);
    submitJoinMemberFindId = wrapJoinAsyncFunction(submitJoinMemberFindId);
    submitJoinMemberFindPw = wrapJoinAsyncFunction(submitJoinMemberFindPw);
    submitJoinMemberResetPassword = wrapJoinAsyncFunction(submitJoinMemberResetPassword);
    submitJoinMemberSignup = wrapJoinAsyncFunction(submitJoinMemberSignup);
    window.submitJoinMemberEmailLogin = submitJoinMemberEmailLogin;
    window.submitJoinMemberSignup = submitJoinMemberSignup;
    window.openJoinMemberEmailForm = openJoinMemberEmailForm;
    handleJoinMyLogout = wrapJoinAsyncFunction(handleJoinMyLogout);
    window.nextBuilderStep = nextBuilderStep;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.__golfjoinMainReady = true;
    window.openGlobalApply = openGlobalApply;
    window.submitGlobalApply = submitGlobalApply;
    window.confirmApplySubmitModal = confirmApplySubmitModal;
    window.closeApplySubmitConfirmModal = closeApplySubmitConfirmModal;
    window.handleApplySubmitConfirmBackdropClick = handleApplySubmitConfirmBackdropClick;
    window.openBuilderAlert = openBuilderAlert;
    window.closeBuilderAlert = closeBuilderAlert;
    window.confirmBuilderAlert = confirmBuilderAlert;
    window.handleBuilderAlertBackdropClick = handleBuilderAlertBackdropClick;
    window.openMdPickProductDetail = openMdPickProductDetail;
    window.selectDetailProductFamilyPeriod = selectDetailProductFamilyPeriod;
    handleDetailWish = wrapJoinAsyncFunction(handleDetailWish);
    window.handleDetailShare = handleDetailShare;
    window.copyDetailShareUrl = copyDetailShareUrl;

    document.addEventListener("mouseleave", (event) => {
      event.target.closest?.(".participant-info-wrap")?.classList.remove("suppress-hover");
    }, true);

    const participantModal = document.getElementById("participantModal");
    participantModal.addEventListener("mouseenter", cancelParticipantClose);
    participantModal.addEventListener("mouseleave", () => {
      if (isMobileParticipantSheet()) return;
      scheduleParticipantClose();
    });

    document.querySelectorAll(".overlay").forEach((overlay) => {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          if (overlay.id === "detailModal") {
            closeModal("detailModal");
            return;
          }
          if (overlay.id === "travelDateModal") {
            closeTravelDateModal();
            return;
          }
          if (overlay.id === "regionSearchModal") {
            closeRegionSearchModal();
            return;
          }
          resetModalRuntimeState(overlay);
          overlay.classList.remove("open");
        }
      });
    });

    const mobileSortQuery = window.matchMedia("(max-width: 640px)");
    mobileSortQuery.addEventListener?.("change", renderJoins);
    const largeDesktopQuickQuery = window.matchMedia("(min-width: 1170px)");
    largeDesktopQuickQuery.addEventListener?.("change", renderJoins);
    document.addEventListener("error", (event) => {
      if (event.target instanceof HTMLImageElement) {
        markGolfJoinImageFallback(event.target);
      }
    }, true);
    window.addEventListener("scroll", scheduleJoinSectionNavActiveUpdate, { passive: true });
    window.addEventListener("focus", () => {
      void synchronizeJoinErpSession();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) void synchronizeJoinErpSession();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void synchronizeJoinErpSession();
      }
    });
    window.addEventListener("resize", () => {
      const nextOverseasBestMobileLayout = isMobileSlideDotsViewport();
      if (overseasBestLastMobileLayout !== null && overseasBestLastMobileLayout !== nextOverseasBestMobileLayout) {
        overseasBestLastMobileLayout = nextOverseasBestMobileLayout;
        renderOverseasBestSectionInPlace();
      }
      if (myJoinLastMobileLayout !== null && myJoinLastMobileLayout !== nextOverseasBestMobileLayout) {
        myJoinLastMobileLayout = nextOverseasBestMobileLayout;
        renderMyJoinSectionInPlace();
      }
      scheduleJoinSectionNavActiveUpdate();
      updateQuickSectionControls();
      updateCustomSectionControls();
      updateBestSectionControlsAll();
      updateMdPickSlideDots();
      setupQuickMobileCarousel();
      updateSoonDateLine();
      if (document.getElementById("detailModal")?.classList.contains("open")) {
        updateDetailAnchorTabs();
      }
      handleCalendarSheetResize();
    });

    let mobileSheetDragState = null;

    function getMobileSheetDragCloseConfig(target, clientY = 0) {
      const isSmallMobileSheet = window.matchMedia("(max-width: 640px)").matches;
      const isParticipantSheetTarget = Boolean(target?.closest?.("#participantModal")) && isMobileParticipantSheet();
      if (!isSmallMobileSheet && !isParticipantSheetTarget) return null;
      const sheetCandidates = [
        {
          element: document.getElementById("builderDatePopover"),
          isOpen: (el) => el?.classList.contains("open"),
          headerSelector: ".builder-date-popover-title",
          close: () => closeBuilderDatePopover(true)
        },
        {
          element: document.getElementById("builderFlexSheet"),
          isOpen: (el) => el?.classList.contains("open"),
          headerSelector: ".builder-flex-head",
          close: closeBuilderFlexSheet
        },
        {
          element: document.getElementById("builderActiveScheduleSheet"),
          isOpen: (el) => el?.classList.contains("open"),
          headerSelector: ".builder-flex-head",
          close: closeBuilderActiveScheduleSheet
        },
        {
          element: document.getElementById("detailApplyPanel"),
          isOpen: (el) => el?.classList.contains("open"),
          headerSelector: ".detail-apply-head",
          close: closeDetailApply
        },
        {
          element: document.getElementById("globalApplyPanel"),
          isOpen: (el) => el?.classList.contains("open"),
          headerSelector: ".detail-apply-head",
          close: closeGlobalApply
        },
        {
          element: document.getElementById("participantContent"),
          isOpen: () => document.getElementById("participantModal")?.classList.contains("open"),
          headerSelector: ".participant-sheet-header",
          close: closeParticipant
        }
      ];

      for (const candidate of sheetCandidates) {
        const sheet = candidate.element;
        if (!sheet || !candidate.isOpen(sheet)) continue;
        const sheetRect = sheet.getBoundingClientRect();
        const header = sheet.querySelector(candidate.headerSelector);
        const isInsideSheet = target?.closest?.(`#${sheet.id}`) === sheet || sheet.contains(target);
        const headerRect = header?.getBoundingClientRect();
        const startsFromHeader = !!header
          && header.contains(target)
          && clientY >= headerRect.top
          && clientY <= headerRect.bottom;
        if (isInsideSheet && startsFromHeader) {
          return {
            sheet,
            close: candidate.close,
            maxTranslateY: Math.max(0, window.innerHeight - sheetRect.top),
            previousTransition: sheet.style.transition
          };
        }
      }
      return null;
    }

    document.addEventListener("touchstart", (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      const config = getMobileSheetDragCloseConfig(event.target, touch.clientY);
      if (!config) {
        mobileSheetDragState = null;
        return;
      }
      mobileSheetDragState = {
        startY: touch.clientY,
        lastY: touch.clientY,
        config
      };
      config.sheet.style.transition = "none";
    }, { passive: true, capture: true });

    document.addEventListener("touchmove", (event) => {
      if (!mobileSheetDragState) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      mobileSheetDragState.lastY = touch.clientY;
      const deltaY = Math.max(0, touch.clientY - mobileSheetDragState.startY);
      const maxTranslateY = mobileSheetDragState.config.maxTranslateY || window.innerHeight;
      mobileSheetDragState.config.sheet.style.transform = deltaY ? `translateY(${Math.min(deltaY, maxTranslateY)}px)` : "";
    }, { passive: true, capture: true });

    document.addEventListener("touchend", () => {
      if (!mobileSheetDragState) return;
      const { startY, lastY, config } = mobileSheetDragState;
      config.sheet.style.transform = "";
      config.sheet.style.transition = config.previousTransition || "";
      mobileSheetDragState = null;
      if (lastY - startY > 64) {
        config.close();
      }
    }, { passive: true, capture: true });

    function preventModalDragAndSelection(event) {
      const target = event.target;
      if (!target?.closest?.(".sgj-portal-overlay")) return;
      if (event.type === "dragstart" && target.closest(".detail-slider, .detail-slider *")) return;
      if (target.closest("input, textarea, select")) return;
      event.preventDefault();
    }

    document.addEventListener("dragstart", preventModalDragAndSelection, { capture: true });
    document.addEventListener("selectstart", preventModalDragAndSelection, { capture: true });
    document.addEventListener("contextmenu", preventModalDragAndSelection, { capture: true });
    document.addEventListener("gesturestart", (event) => {
      if (document.getElementById("builderModal")?.classList.contains("open")) {
        event.preventDefault();
      }
    }, { capture: true });


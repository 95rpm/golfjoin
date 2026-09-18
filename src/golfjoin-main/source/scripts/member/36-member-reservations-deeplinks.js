    async function handleJoinMyWishClick(trigger = null) {
      const returnToDrawer = shouldReturnJoinMyMenuToDrawer(trigger);
      setJoinMyDrawerActiveMenu("wish");
      closeJoinMyDrawer();
      const overlay = portalOverlayToBody("joinMyMenuModal");
      const body = document.getElementById("joinMyMenuBody");
      joinMyMenuReturnToDrawerOnClose = returnToDrawer;
      const viewGeneration = beginJoinMyMenuView("wish");
      document.getElementById("joinMyMenuTitle") && (document.getElementById("joinMyMenuTitle").textContent = "찜");
      if (body) body.innerHTML = `<div class="join-my-state">찜한 목록을 확인 중입니다.</div>`;
      overlay?.classList.add("open");
      setJoinMobileBottomNavLayerActive("my");
      setJoinMobileBottomNavVisible(false, { force: true, reason: "my-menu" });
      setWidgetModalOpen(true);
      renderJoinMyWishMenu();
      await hydrateJoinWishesFromGoogleSheet();
      if (isJoinMyMenuRequestCurrent("wish", viewGeneration)) {
        renderJoinMyWishMenu();
      }
    }

    function openJoinWishProduct(targetKey, wishType = "product") {
      const key = String(targetKey || "").trim();
      const type = String(wishType || "product");
      if (!key) return;
      if (type === "join_schedule") {
        const join = joins.find((item) => item.id === key || item.scheduleId === key || item.sourceApplicationId === key);
        if (!join) {
          alert("연결된 조인 일정을 찾을 수 없습니다.");
          return;
        }
        closeJoinMyMenu();
        openDetail(join.id, { returnToJoinMy: { menu: "wish", tab: "wish-joins" } });
        return;
      }
      const wish = getJoinWishProducts().find((item) => item.wishType === "product" && getJoinWishTargetKey(item) === key) || {};
      const join = joins.find((item) => getJoinProductGoodSeq(item) === key || String(item.goodSeq || "") === key);
      if (join) {
        closeJoinMyMenu();
        openDetail(join.id, { returnToJoinMy: { menu: "wish", tab: "wish-products" } });
        return;
      }
      const params = new URLSearchParams({ goodSeq: key });
      if (wish.eventSeq) params.set("eventSeq", wish.eventSeq);
      location.href = `/goods/goods_view?${params.toString()}`;
    }

    function handleJoinWishRemove(targetKey, wishType = "product") {
      const key = String(targetKey || "").trim();
      if (!key) return;
      const type = wishType === "join_schedule" ? "join_schedule" : "product";
      void executeJoinWishRemove(key, type);
    }

    async function executeJoinWishRemove(targetKey, wishType = "product") {
      const key = String(targetKey || "").trim();
      if (!key) return;
      const type = wishType === "join_schedule" ? "join_schedule" : "product";
      await runJoinActionLoading(async () => {
        removeJoinWishProduct(key, type);
        if (isJoinMyMenuViewOpen("wish")) {
          switchJoinMyTab(type === "join_schedule" ? "wish-joins" : "wish-products");
        }
        try {
          if (type === "product") await deleteSecretTourWishProduct(key);
        } catch (error) {
          golfJoinSafeWarn("Secret Tour delete wish request failed.", error);
        }
      }, { message: "찜한 목록에서 삭제하고 있어요", button: null, minVisibleMs: 250 });
    }

    async function handleJoinMyTripClick(trigger = null) {
      if (joinMyReservationOpening) return;
      joinMyReservationOpening = true;
      try {
        const returnToDrawer = shouldReturnJoinMyMenuToDrawer(trigger);
        setJoinMyDrawerActiveMenu("reservation");
        closeJoinMyDrawer();
        await openJoinMyMenu({ returnToDrawer });
      } finally {
        joinMyReservationOpening = false;
      }
    }

    function getJoinLogoutUrl() {
      return location.hostname.includes("secret-tour.com")
        ? "/member/logout.json"
        : "https://www.secret-tour.com/member/logout.json";
    }

    async function handleJoinMyLogout() {
      closeJoinMyDrawer();
      try {
        const response = await fetch(getJoinLogoutUrl(), {
          method: "GET",
          credentials: "include",
          cache: "no-cache",
          headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        if (!response.ok) throw new Error(`logout failed: ${response.status}`);
      } catch (error) {
        golfJoinSafeWarn("Secret Tour logout request failed.", error);
        alert("로그아웃 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      try {
        setJoinLogoutMarker();
        sessionStorage.removeItem(JOIN_TEMP_ADMIN_LOGIN_KEY);
        sessionStorage.removeItem(JOIN_SESSION_MEMBER_KEY);
        clearJoinMemberProfileCompletion();
        clearJoinPrivateClientCaches();
        joinMyMenuState.memberPromise = null;
      } catch (error) {
        golfJoinSafeWarn("Failed to clear join login state.", error);
      }
      closeJoinMyMenu();
      closeJoinMyDrawer();
      setJoinMobileNavActive("");
      overseasBestVisibleCount = OVERSEAS_BEST_INITIAL_VISIBLE_COUNT;
      myJoinFilter = "complete";
      resetMyJoinVisibleCounts();
      renderJoins();
    }

    function renderJoinMyInfoList(items) {
      return `<dl class="join-my-info-list">${items.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd>`).join("")}</dl>`;
    }

    function getJoinMyReservationProductSeed(joinId = "") {
      const join = joins.find((item) => item.id === joinId) || {};
      const includes = Array.isArray(join.includes) ? join.includes : [];
      const confirmedParticipants = join.id ? getConfirmedParticipants(join) : [];
      const departureAirport = String(join.departureAirport || join.airport || "").trim();
      const hasFlight = Boolean(departureAirport || includes.some((item) => /항공/.test(String(item))));
      const hotelText = join.hotel || join.hotelName || includes.find((item) => /호텔|숙박/.test(String(item))) || "";
      const regionText = join.countryRegion || join.location || join.region || "";
      return {
        join,
        regionText,
        confirmedParticipants,
        targetCount: join.id ? getCardTeamCapacity(join, 4) : 4,
        hasFlight,
        flightInfo: hasFlight ? [departureAirport ? `${departureAirport} 출발` : "", join.region ? `${join.region} 도착` : "", "항공팩"].filter(Boolean).join(" · ") : "",
        hotelText
      };
    }

    function getJoinMyMemberIdentity(member = {}) {
      return {
        memberKey: getJoinMemberCanonicalKey(member),
        seq: String(member.memberSeq || "").trim(),
        id: String(member.memberId || "").trim().toLowerCase(),
        phone: normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || ""),
        email: String(member.memberEmail || member.email || "").trim().toLowerCase(),
        kakaoId: String(member.kakaoId || "").trim()
      };
    }

    function isJoinMemberLookupMatchedForMember(source = {}, member = {}) {
      if (source?.memberLookupMatched !== true) return false;
      const lookupMemberKey = String(source.memberLookupKey || "").trim();
      const currentIdentity = getJoinMyMemberIdentity(member);
      return Boolean(lookupMemberKey && currentIdentity.memberKey && lookupMemberKey === currentIdentity.memberKey);
    }

    function getJoinParticipantMemberIdentity(participant = {}) {
      const normalizedPhone = normalizeJoinMemberPhone(
        participant.memberMobile
        || participant.phone
        || getNestedValue(participant, "member.memberMobile")
        || ""
      );
      return {
        seq: String(participant.memberSeq || getNestedValue(participant, "member.memberSeq") || "").trim(),
        id: String(participant.memberId || getNestedValue(participant, "member.memberId") || "").trim().toLowerCase(),
        // Member-specific sheet responses are still privacy-sanitized (for example 010****1234).
        // The seven visible digits must not override the trusted member lookup marker.
        phone: normalizedPhone.length >= 10 ? normalizedPhone : "",
        email: String(participant.memberEmail || getNestedValue(participant, "member.memberEmail") || "").trim().toLowerCase(),
        kakaoId: String(participant.kakaoId || getNestedValue(participant, "member.kakaoId") || "").trim()
      };
    }

    function isJoinParticipantForCurrentMember(participant = {}) {
      const loginState = getJoinLoginState();
      if (!loginState.isLogin) return false;
      const rememberedProfile = getRememberedJoinMemberProfile(loginState.member || {});
      const memberIdentity = getJoinMyMemberIdentity({
        ...(rememberedProfile || {}),
        ...(loginState.member || {}),
        memberMobile: loginState.member?.memberMobile || rememberedProfile?.memberMobile || rememberedProfile?.mobile || rememberedProfile?.phone || "",
        memberEmail: loginState.member?.memberEmail || loginState.member?.email || rememberedProfile?.memberEmail || rememberedProfile?.email || ""
      });
      const participantIdentity = getJoinParticipantMemberIdentity(participant);
      const hasMemberIdentity = Boolean(memberIdentity.seq || memberIdentity.id || memberIdentity.phone || memberIdentity.email || memberIdentity.kakaoId);
      const hasParticipantIdentity = Boolean(participantIdentity.seq || participantIdentity.id || participantIdentity.phone || participantIdentity.email || participantIdentity.kakaoId);
      const identityMatched = Boolean(
        (memberIdentity.seq && participantIdentity.seq && memberIdentity.seq === participantIdentity.seq)
        || (memberIdentity.id && participantIdentity.id && memberIdentity.id === participantIdentity.id)
        || (memberIdentity.phone && participantIdentity.phone && memberIdentity.phone === participantIdentity.phone)
        || (memberIdentity.email && participantIdentity.email && memberIdentity.email === participantIdentity.email)
        || (memberIdentity.kakaoId && participantIdentity.kakaoId && memberIdentity.kakaoId === participantIdentity.kakaoId)
      );
      if (hasMemberIdentity && hasParticipantIdentity) return identityMatched;
      const participantCurrentMemberKey = String(participant.currentMemberKey || "").trim();
      if (participant.isCurrentMember === true && participantCurrentMemberKey) {
        return Boolean(memberIdentity.memberKey && participantCurrentMemberKey === memberIdentity.memberKey);
      }
      return false;
    }

    function isJoinParticipantForCurrentMemberInSchedule(participant = {}, joinOrId = null) {
      const join = joinOrId && typeof joinOrId === "object"
        ? joinOrId
        : joins.find((item) => String(item.id || "") === String(joinOrId || ""));
      if (
        join
        && (participant?.isHost || participant?.isCreator)
        && !isCurrentMemberCreatedJoinSchedule(join)
      ) return false;
      return isJoinParticipantForCurrentMember(participant);
    }

    function normalizeJoinParticipantApplicationMarker(value = "") {
      return String(value || "").trim();
    }

    function isUsableJoinParticipantApplicationMarker(value = "") {
      return normalizeJoinParticipantApplicationMarker(value).length >= 8;
    }

    function doJoinParticipantApplicationMarkersMatch(a = "", b = "") {
      const left = normalizeJoinParticipantApplicationMarker(a);
      const right = normalizeJoinParticipantApplicationMarker(b);
      if (!isUsableJoinParticipantApplicationMarker(left) || !isUsableJoinParticipantApplicationMarker(right)) return false;
      return left === right;
    }

    function getJoinParticipantApplicationMarkers(participant = {}) {
      const id = String(participant.id || "");
      const idRecordMatch = id.match(/^(.+)-p\d+$/);
      return [
        participant.sourceRecordId,
        participant.joinApplyId,
        participant.applicationId,
        participant.sourceApplicationId,
        idRecordMatch?.[1],
        participant.previewSeed,
        participant.iconSeed,
        participant.seed,
        participant.companionGroup
      ].map(normalizeJoinParticipantApplicationMarker).filter(isUsableJoinParticipantApplicationMarker);
    }

    function hasJoinParticipantApplicationMarkerOverlap(participant = {}, markers = []) {
      const participantMarkers = getJoinParticipantApplicationMarkers(participant);
      const targetMarkers = (markers || []).map(normalizeJoinParticipantApplicationMarker).filter(isUsableJoinParticipantApplicationMarker);
      if (!participantMarkers.length || !targetMarkers.length) return false;
      return participantMarkers.some((participantMarker) => {
        return targetMarkers.some((targetMarker) => doJoinParticipantApplicationMarkersMatch(participantMarker, targetMarker));
      });
    }

    function isJoinParticipantPreviewSource(participant = {}) {
      return participant.source === "participant_summary_preview"
        || String(participant.id || "").includes("-preview-")
        || participant.summaryCountPlaceholder === true;
    }

    function isJoinApplicationMaterializedParticipant(participant = {}, recordId = "") {
      if (!recordId || isJoinParticipantPreviewSource(participant)) return false;
      return hasJoinParticipantApplicationMarkerOverlap(participant, [recordId]);
    }

    function isJoinApplicationPreviewParticipantForRecord(participant = {}, recordId = "") {
      if (!recordId || !isJoinParticipantPreviewSource(participant)) return false;
      return hasJoinParticipantApplicationMarkerOverlap(participant, [recordId]);
    }

    function isCurrentMemberJoinedJoinSchedule(join = {}) {
      if (isCurrentMemberCreatedJoinSchedule(join)) return false;
      return getConfirmedParticipants(join).some((participant) => (
        !(participant?.isHost || participant?.isCreator)
        && isJoinParticipantForCurrentMemberInSchedule(participant, join)
      ));
    }

    function getJoinMyBuilderApplicationIdentity(join = {}) {
      const application = join.sheetApplication || {};
      return {
        memberKey: getJoinMemberCanonicalKey({
          memberKey: getNestedValue(application, "member.memberKey") || application.memberKey || "",
          memberSeq: getNestedValue(application, "member.memberSeq") || application.memberSeq || "",
          memberId: getNestedValue(application, "member.memberId") || application.memberId || "",
          memberMobile: getNestedValue(application, "member.memberMobile") || getNestedValue(application, "applicant.phone") || application.memberMobile || application.creatorPhone || application.phone || "",
          memberEmail: getNestedValue(application, "member.memberEmail") || application.memberEmail || application.email || "",
          kakaoId: getNestedValue(application, "member.kakaoId") || application.kakaoId || ""
        }),
        seq: String(getNestedValue(application, "member.memberSeq") || application.memberSeq || "").trim(),
        id: String(getNestedValue(application, "member.memberId") || application.memberId || "").trim().toLowerCase(),
        phone: normalizeJoinMemberPhone(
          getNestedValue(application, "member.memberMobile")
          || getNestedValue(application, "applicant.phone")
          || application.memberMobile
          || application.creatorPhone
          || application.phone
          || ""
        ),
        email: String(
          getNestedValue(application, "member.memberEmail")
          || application.memberEmail
          || application.email
          || ""
        ).trim().toLowerCase(),
        kakaoId: String(getNestedValue(application, "member.kakaoId") || application.kakaoId || "").trim()
      };
    }

    function getJoinMyJoinApplicationIdentity(application = {}) {
      return {
        memberKey: getJoinMemberCanonicalKey({
          memberKey: getNestedValue(application, "member.memberKey") || application.memberKey || "",
          memberSeq: getNestedValue(application, "member.memberSeq") || application.memberSeq || "",
          memberId: getNestedValue(application, "member.memberId") || application.memberId || "",
          memberMobile: getNestedValue(application, "member.memberMobile") || getNestedValue(application, "applicant.phone") || application.memberMobile || application.phone || "",
          memberEmail: getNestedValue(application, "member.memberEmail") || application.memberEmail || application.email || "",
          kakaoId: getNestedValue(application, "member.kakaoId") || application.kakaoId || ""
        }),
        seq: String(getNestedValue(application, "member.memberSeq") || application.memberSeq || "").trim(),
        id: String(getNestedValue(application, "member.memberId") || application.memberId || "").trim().toLowerCase(),
        phone: normalizeJoinMemberPhone(
          getNestedValue(application, "member.memberMobile")
          || getNestedValue(application, "applicant.phone")
          || application.memberMobile
          || application.phone
          || ""
        ),
        email: String(
          getNestedValue(application, "member.memberEmail")
          || application.memberEmail
          || application.email
          || ""
        ).trim().toLowerCase(),
        kakaoId: String(getNestedValue(application, "member.kakaoId") || application.kakaoId || "").trim()
      };
    }

    function isJoinMyJoinApplicationForMember(application = {}, member = {}) {
      if (isJoinMemberLookupMatchedForMember(application, member)) return true;
      const memberIdentity = getJoinMyMemberIdentity(member);
      const applicationIdentity = getJoinMyJoinApplicationIdentity(application);
      const hasMemberIdentity = Boolean(memberIdentity.memberKey || memberIdentity.seq || memberIdentity.id || memberIdentity.phone || memberIdentity.email || memberIdentity.kakaoId);
      const hasApplicationIdentity = Boolean(applicationIdentity.memberKey || applicationIdentity.seq || applicationIdentity.id || applicationIdentity.phone || applicationIdentity.email || applicationIdentity.kakaoId);
      if (!hasMemberIdentity || !hasApplicationIdentity) return false;
      return Boolean(
        (memberIdentity.memberKey && applicationIdentity.memberKey && memberIdentity.memberKey === applicationIdentity.memberKey)
        || (memberIdentity.seq && applicationIdentity.seq && memberIdentity.seq === applicationIdentity.seq)
        || (memberIdentity.id && applicationIdentity.id && memberIdentity.id === applicationIdentity.id)
        || (memberIdentity.phone && applicationIdentity.phone && memberIdentity.phone === applicationIdentity.phone)
        || (memberIdentity.email && applicationIdentity.email && memberIdentity.email === applicationIdentity.email)
        || (memberIdentity.kakaoId && applicationIdentity.kakaoId && memberIdentity.kakaoId === applicationIdentity.kakaoId)
      );
    }

    function isJoinMyBuilderApplicationJoin(join = {}) {
      return Boolean(
        join?.isBuilderApplicationJoin
        || String(join?.id || "").startsWith(BUILDER_APPLICATION_JOIN_PREFIX)
        || getNestedValue(join?.sheetApplication || {}, "source") === "new_schedule_builder"
      );
    }

    function isJoinScheduleLikeForDetail(join = {}) {
      return Boolean(
        isJoinMyBuilderApplicationJoin(join)
        || join?.scheduleId
        || join?.sourceApplicationId
        || getNestedValue(join?.sheetApplication || {}, "scheduleId")
        || getNestedValue(join?.sheetApplication || {}, "applicationId")
        || getNestedValue(join?.sheetApplication || {}, "source") === "new_schedule_builder"
      );
    }

    function isJoinMyCreatedScheduleForMember(join = {}, member = {}) {
      if (!isJoinMyBuilderApplicationJoin(join)) return false;
      if (isJoinTempAdminMember(member)) return true;
      if (isJoinMemberLookupMatchedForMember(join?.sheetApplication || {}, member)) return true;
      const memberIdentity = getJoinMyMemberIdentity(member);
      const applicationIdentity = getJoinMyBuilderApplicationIdentity(join);
      const hasMemberIdentity = Boolean(memberIdentity.memberKey || memberIdentity.seq || memberIdentity.id || memberIdentity.phone || memberIdentity.email || memberIdentity.kakaoId);
      const hasApplicationIdentity = Boolean(applicationIdentity.memberKey || applicationIdentity.seq || applicationIdentity.id || applicationIdentity.phone || applicationIdentity.email || applicationIdentity.kakaoId);
      if (!hasMemberIdentity || !hasApplicationIdentity) return false;
      return Boolean(
        (memberIdentity.memberKey && applicationIdentity.memberKey && memberIdentity.memberKey === applicationIdentity.memberKey)
        || (memberIdentity.seq && applicationIdentity.seq && memberIdentity.seq === applicationIdentity.seq)
        || (memberIdentity.id && applicationIdentity.id && memberIdentity.id === applicationIdentity.id)
        || (memberIdentity.phone && applicationIdentity.phone && memberIdentity.phone === applicationIdentity.phone)
        || (memberIdentity.email && applicationIdentity.email && memberIdentity.email === applicationIdentity.email)
        || (memberIdentity.kakaoId && applicationIdentity.kakaoId && memberIdentity.kakaoId === applicationIdentity.kakaoId)
      );
    }

    function isCancelledJoinMyCreatedSchedule(join = {}) {
      const application = join.sheetApplication || {};
      const refundStatus = String(
        application.refundStatus
        || getNestedValue(application, "payment.refundStatus")
        || join.refundStatus
        || ""
      ).trim().toLowerCase();
      return Boolean(
        isCancelledJoinApplyPayload({
          applicationStatus: application.applicationStatus || application.status || join.applicationStatus || join.status || "",
          participantStatus: application.participantStatus || getNestedValue(application, "participant.status") || join.participantStatus || ""
        })
        || ["requested", "paid", "refunded"].includes(refundStatus)
        || /cancel|취소|환불/.test(refundStatus)
      );
    }

    function buildJoinMyCreatedReservationItem(join = {}) {
      const seed = getJoinMyReservationProductSeed(join.id);
      const productReference = getSecretTourProductReference(seed.join?.id ? seed.join : join);
      const sheetApplication = join.sheetApplication || {};
      return {
        joinId: join.id || "",
        id: join.id || "",
        scheduleId: join.scheduleId || getNestedValue(join.sheetApplication || {}, "scheduleId") || "",
        sourceApplicationId: join.sourceApplicationId || getNestedValue(join.sheetApplication || {}, "applicationId") || "",
        goodSeq: join.goodSeq || seed.join?.goodSeq || productReference.goodSeq || "",
        erpProductId: productReference.goodSeq || normalizeJoinCanonicalErpProductId(join.erpProductId || seed.join?.erpProductId, join.erpEventSeq || seed.join?.erpEventSeq || productReference.eventSeq) || "",
        eventSeq: join.eventSeq || seed.join?.eventSeq || productReference.eventSeq || "",
        erpEventSeq: join.erpEventSeq || seed.join?.erpEventSeq || productReference.eventSeq || "",
        hideImage: true,
        title: join.title || "새 조인 일정",
        meta: `${formatJoinMyDateRange(join)} · ${seed.regionText || "-"}`,
        countryRegion: seed.regionText,
        departureDate: join.departureDate || "",
        returnDate: join.returnDate || "",
        region: join.region || seed.regionText,
        image: join.image || "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg",
        status: "모집중",
        statusClass: "green",
        scheduleGroup: "created",
        currentCount: getJoinAuthoritativeConfirmedCount(join),
        targetCount: seed.targetCount,
        flightPack: seed.hasFlight,
        flightInfo: seed.flightInfo,
        price: join.price ? `${formatPrice(join.price)}원~` : "",
        golfCourse: join.golfCourse || join.title || "",
        hotel: seed.hotelText,
        quoteId: sheetApplication.quoteId || "",
        quoteNo: sheetApplication.quoteNo || "",
        quoteStatus: sheetApplication.quoteStatus || "",
        quoteUrl: sheetApplication.quoteUrl || "",
        quotePageUrl: sheetApplication.quotePageUrl || sheetApplication.quoteUrl || "",
        quotePdfUrl: sheetApplication.quotePdfUrl || "",
        quoteGeneratedAt: sheetApplication.quoteGeneratedAt || "",
        actions: [
          { label: "상세정보 열기", action: "accordion", placement: "head" }
        ]
      };
    }

    function buildJoinMyJoinedReservationItem(application = {}) {
      const linkedJoin = applyJoinApplicationPayload(application, { remember: false, render: false })
        || findJoinForJoinApplicationPayload(application);
      const target = getJoinApplicationTargetRow(application);
      const applicationJoin = getNestedValue(application, "join") || {};
      const applicationProduct = getNestedValue(application, "product") || {};
      const joinId = linkedJoin?.id
        || target.targetJoinId
        || target.targetScheduleId
        || getAdminRecommendedJoinIdFromApplicationId(target.targetApplicationId)
        || getNestedValue(application, "join.id")
        || application.joinId
        || "";
      const seed = getJoinMyReservationProductSeed(joinId);
      const join = linkedJoin || seed.join || {};
      const productReference = getSecretTourProductReference(join.id ? join : applicationProduct || applicationJoin || {});
      const normalizedApplication = normalizeJoinApplyPayload(application);
      const applicationRecordId = normalizedApplication.joinApplyId || buildGoogleSheetRecordId("ja", normalizedApplication.submittedAt, getNestedValue(normalizedApplication, "member.memberSeq") || getNestedValue(normalizedApplication, "member.memberId") || getNestedValue(normalizedApplication, "applicant.name") || "member", joinId);
      const confirmedParticipants = Array.isArray(join.participants) ? getConfirmedParticipants(join) : [];
      const hostParticipant = confirmedParticipants.find((participant) => participant?.isHost || participant?.isCreator)
        || confirmedParticipants[0]
        || null;
      const requestedParticipantCount = parseApplyPeopleValue(getNestedValue(application, "applicant.people") || application.applicantPeople || application.people || 1);
      const myParticipantIds = Array.from({ length: requestedParticipantCount }, (_, index) => `${applicationRecordId}-p${index + 1}`);
      return {
        joinId,
        id: joinId,
        scheduleId: join.scheduleId || getNestedValue(application, "join.scheduleId") || application.targetScheduleId || getNestedValue(application, "product.scheduleId") || "",
        sourceApplicationId: join.sourceApplicationId || getNestedValue(application, "join.sourceApplicationId") || application.targetApplicationId || getNestedValue(application, "product.applicationId") || "",
        goodSeq: join.goodSeq || getNestedValue(application, "product.goodSeq") || application.goodSeq || productReference.goodSeq || "",
        erpProductId: join.erpProductId || getNestedValue(application, "product.erpProductId") || application.erpProductId || productReference.goodSeq || productReference.id || "",
        eventSeq: join.eventSeq || getNestedValue(application, "product.eventSeq") || application.eventSeq || productReference.eventSeq || "",
        erpEventSeq: join.erpEventSeq || getNestedValue(application, "product.erpEventSeq") || application.erpEventSeq || productReference.eventSeq || "",
        hideImage: true,
        title: join.title || getNestedValue(application, "join.title") || getNestedValue(application, "product.productName") || application.productName || "참여중인 조인 일정",
        meta: `${formatJoinMyDateRange(join.id ? join : (applicationJoin || application))} · ${seed.regionText || getNestedValue(application, "join.region") || getNestedValue(application, "product.region") || application.region || "-"}`,
        countryRegion: seed.regionText || getNestedValue(application, "join.countryRegion") || getNestedValue(application, "join.region") || getNestedValue(application, "product.countryRegion") || getNestedValue(application, "product.region") || application.countryRegion || application.region || "",
        departureDate: join.departureDate || getNestedValue(application, "join.departureDate") || getNestedValue(application, "product.departureDate") || application.departureDate || "",
        returnDate: join.returnDate || getNestedValue(application, "join.returnDate") || getNestedValue(application, "product.returnDate") || application.returnDate || "",
        region: join.region || seed.regionText || getNestedValue(application, "join.region") || getNestedValue(application, "product.region") || application.region || "",
        image: join.image || getNestedValue(application, "product.image") || getNestedValue(application, "product.imageUrl") || application.image || application.imageUrl || "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg",
        status: "참여중",
        statusClass: "",
        scheduleGroup: "joined",
        myParticipantId: myParticipantIds[0] || "",
        myParticipantIds,
        hostParticipantId: hostParticipant?.id || "",
        currentCount: Math.max(
          getJoinAuthoritativeConfirmedCount(join),
          Number(application.currentCount || 0)
        ),
        targetCount: seed.targetCount || Number(application.targetCount || 0),
        flightPack: seed.hasFlight,
        flightInfo: seed.flightInfo || application.flightInfo || "",
        price: join.price ? `${formatPrice(join.price)}원~` : (application.price ? `${formatPrice(application.price)}원~` : ""),
        quoteId: application.quoteId || "",
        quoteNo: application.quoteNo || "",
        quoteStatus: application.quoteStatus || "",
        quoteUrl: application.quoteUrl || "",
        quotePageUrl: application.quotePageUrl || application.quoteUrl || "",
        quotePdfUrl: application.quotePdfUrl || "",
        quoteGeneratedAt: application.quoteGeneratedAt || "",
        actions: [
          { label: "상세정보 열기", action: "accordion", placement: "head" }
        ]
      };
    }

    const JOIN_REVIEW_STORAGE_KEY = "joinMyReservationReviews";

    function getJoinMyReviewKey(joinId = "", title = "") {
      return String(joinId || title || "").trim();
    }

    function getJoinReviewProductKey(product = {}) {
      const reference = getSecretTourProductReference(product);
      return [
        reference.id || product.erpProductId || product.productId || product.id || "",
        reference.eventSeq || product.erpEventSeq || product.eventSeq || "",
        product.title || product.productName || ""
      ].map((value) => String(value || "").trim()).join("|");
    }

    function getJoinReviewProductKeys(product = {}) {
      const reference = getSecretTourProductReference(product);
      return new Set([
        getJoinReviewProductKey(product),
        [reference.id || product.erpProductId || product.productId || product.id || "", "", ""].join("|"),
        ["", reference.eventSeq || product.erpEventSeq || product.eventSeq || "", ""].join("|"),
        ["", "", product.title || product.productName || ""].join("|")
      ].filter((key) => key.replace(/\|/g, "")));
    }

    function readJoinMyReviewStore() {
      try {
        return JSON.parse(localStorage.getItem(JOIN_REVIEW_STORAGE_KEY) || "{}") || {};
      } catch (error) {
        return {};
      }
    }

    function writeJoinMyReviewStore(store = {}) {
      try {
        localStorage.setItem(JOIN_REVIEW_STORAGE_KEY, JSON.stringify(store));
      } catch (error) {
        golfJoinSafeWarn("Failed to save join review", error);
      }
    }

    function pruneJoinMyReviewStoreByServerReviews(serverReviews = []) {
      const serverReviewIds = new Set(serverReviews.map((review) => String(review.reviewId || "").trim()).filter(Boolean));
      if (!serverReviewIds.size) {
        writeJoinMyReviewStore({});
        return;
      }
      const store = readJoinMyReviewStore();
      let changed = false;
      Object.entries(store).forEach(([key, payload]) => {
        const reviewId = String(payload?.reviewId || "").trim();
        if (reviewId && !serverReviewIds.has(reviewId)) {
          delete store[key];
          changed = true;
        }
      });
      if (changed) writeJoinMyReviewStore(store);
    }

    function getJoinMySubmittedReview(joinId = "", title = "") {
      const key = getJoinMyReviewKey(joinId, title);
      if (!key) return null;
      return readJoinMyReviewStore()[key] || joinReviewPayloadMemory.get(key) || null;
    }

    function hasJoinMySubmittedReview(joinId = "", title = "") {
      return Boolean(getJoinMySubmittedReview(joinId, title));
    }

    function getJoinMySubmittedReviewForProduct(product = {}) {
      const member = getJoinCachedCurrentMember() || {};
      const memberSeq = String(member.memberSeq || "").trim();
      const memberId = String(member.memberId || "").trim();
      const memberMobile = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      const productKeys = getJoinReviewProductKeys(product);
      return Array.from(joinReviewPayloadMemory.values())
        .map(normalizeJoinReviewPayload)
        .find((review) => {
          const sameMember = (memberSeq && review.member.memberSeq === memberSeq)
            || (memberId && review.member.memberId === memberId)
            || (memberMobile && review.member.memberMobile === memberMobile);
          if (!sameMember) return false;
          const reviewKeys = getJoinReviewProductKeys({
            id: review.product.erpProductId,
            erpProductId: review.product.erpProductId,
            erpEventSeq: review.product.erpEventSeq,
            title: review.product.productName
          });
          return Array.from(reviewKeys).some((key) => productKeys.has(key));
        }) || null;
    }

    function maskJoinReviewAuthor(name = "") {
      const text = String(name || "").trim();
      return text ? `${text.charAt(0)}*${text.length > 2 ? text.charAt(text.length - 1) : ""}` : "이용자";
    }

    function normalizeJoinReviewPayload(item = {}) {
      const productReference = getSecretTourProductReference({
        id: item.productId || item.erpProductId,
        erpProductId: item.erpProductId || item.productId,
        erpEventSeq: item.erpEventSeq || item.eventSeq
      });
      const rating = Math.max(1, Math.min(5, Number(item.rating || getNestedValue(item, "review.rating") || 5)));
      const tags = Array.isArray(item.tags) ? item.tags : toBuilderApplicationArray(item.tags || getNestedValue(item, "review.tags"));
      const reviewText = item.reviewText || item.text || getNestedValue(item, "review.text") || "";
      const productName = item.productName || getNestedValue(item, "product.productName") || "";
      const images = (() => {
        const rawImages = item.images || getNestedValue(item, "review.images");
        if (Array.isArray(rawImages)) return rawImages;
        const imagesJson = item.imagesJson || getNestedValue(item, "review.imagesJson") || "";
        if (!imagesJson) return [];
        try {
          const parsed = JSON.parse(imagesJson);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      })();
      const normalized = {
        reviewId: item.reviewId || "",
        submittedAt: item.submittedAt || item.createdAt || "",
        source: item.source || "join_review",
        pageUrl: item.pageUrl || "",
        member: {
          memberSeq: getNestedValue(item, "member.memberSeq") || item.memberSeq || "",
          memberId: getNestedValue(item, "member.memberId") || item.memberId || "",
          memberName: getNestedValue(item, "member.memberName") || item.memberName || item.name || "",
          memberMobile: normalizeJoinMemberPhone(getNestedValue(item, "member.memberMobile") || item.memberMobile || ""),
          memberEmail: getNestedValue(item, "member.memberEmail") || item.memberEmail || ""
        },
        targetType: item.targetType || "",
        targetScheduleId: item.targetScheduleId || "",
        targetApplicationId: item.targetApplicationId || "",
        product: {
          erpProductId: productReference.goodSeq || normalizeJoinCanonicalErpProductId(item.erpProductId || item.productId, productReference.eventSeq || item.erpEventSeq || item.eventSeq),
          erpEventSeq: normalizeJoinCanonicalErpEventSeq(productReference.eventSeq || item.erpEventSeq || item.eventSeq),
          productName,
          departureDate: item.departureDate || getNestedValue(item, "product.departureDate") || "",
          returnDate: item.returnDate || getNestedValue(item, "product.returnDate") || "",
          region: item.region || getNestedValue(item, "product.region") || ""
        },
        review: {
          rating,
          tags,
          text: reviewText,
          photoName: item.photoName || getNestedValue(item, "review.photoName") || "",
          imageUrl: item.imageUrl || getNestedValue(item, "review.imageUrl") || images[0]?.imageUrl || "",
          thumbnailUrl: item.thumbnailUrl || getNestedValue(item, "review.thumbnailUrl") || images[0]?.thumbnailUrl || "",
          images,
          photoSize: item.photoSize || getNestedValue(item, "review.photoSize") || "",
          photoMimeType: item.photoMimeType || getNestedValue(item, "review.photoMimeType") || ""
        },
        status: item.status || "visible",
        updatedAt: item.updatedAt || item.submittedAt || ""
      };
      if (!normalized.reviewId) {
        normalized.reviewId = buildGoogleSheetRecordId("jr", normalized.submittedAt || nowKstISOString(), normalized.member.memberSeq || normalized.member.memberId || normalized.member.memberName || "member", normalized.product.erpProductId || normalized.product.productName);
      }
      return normalized;
    }

    function rememberJoinReviewPayload(payload = {}) {
      const normalized = normalizeJoinReviewPayload(payload);
      if (normalized.reviewId) joinReviewPayloadMemory.set(normalized.reviewId, normalized);
      const ownKey = getJoinMyReviewKey(normalized.product.erpProductId || normalized.product.productName, normalized.product.productName);
      if (ownKey) joinReviewPayloadMemory.set(ownKey, normalized);
      return normalized;
    }

    function buildJoinMyCompletedReservationItem(source = {}) {
      const join = source.join || source || {};
      const seed = getJoinMyReservationProductSeed(join.id || "");
      const joinId = join.id || source.joinId || "";
      const title = join.title || source.title || "";
      const submittedReview = getJoinMySubmittedReview(joinId, title) || getJoinMySubmittedReviewForProduct(join);
      return {
        joinId,
        hideImage: true,
        title,
        meta: `${formatJoinMyDateRange(join.id ? join : source)} · ${seed.regionText || source.countryRegion || join.region || ""}`,
        countryRegion: seed.regionText || source.countryRegion || join.region || "",
        departureDate: join.departureDate || source.departureDate || "",
        returnDate: join.returnDate || source.returnDate || "",
        region: join.region || source.region || "",
        image: join.image || source.image || "",
        status: "여행완료",
        statusClass: "gray",
        scheduleGroup: "completed",
        hideParticipants: true,
        detailHideParticipants: true,
        submittedReview,
        currentCount: seed.confirmedParticipants.length || source.currentCount || 0,
        targetCount: seed.targetCount || source.targetCount || 0,
        flightPack: seed.hasFlight || source.flightPack,
        flightInfo: seed.flightInfo || source.flightInfo || "",
        price: join.price ? `${formatPrice(join.price)}원~` : source.price || "",
        actions: [
          { label: "상세정보 열기", action: "accordion", placement: "head" },
          { label: submittedReview ? "후기 수정" : "후기 작성", variant: "primary", action: "review" }
        ]
      };
    }

    function getJoinMyCompletedReservations(member = {}) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Array.from(joinApplicationPayloadMemory.values())
        .map(normalizeJoinApplyPayload)
        .filter((application) => isJoinMyJoinApplicationForMember(application, member))
        .map((application) => {
          const joinId = getNestedValue(application, "join.id") || "";
          const join = joins.find((item) => item.id === joinId) || getNestedValue(application, "join") || {};
          return buildJoinMyCompletedReservationItem({ ...join, joinId });
        })
        .filter((item) => {
          const endDate = new Date(`${item.returnDate || item.departureDate}T00:00:00`);
          return !Number.isNaN(endDate.getTime()) && endDate < today;
        });
    }

    function getJoinMyScheduleSheetStatus(item = {}) {
      const join = getJoinMyLinkedJoin(item);
      const source = join?.sheetApplication || item.sheetApplication || {};
      const candidates = [
        item.scheduleStatus,
        item.departureStatus,
        item.managerStatus,
        item.status,
        getNestedValue(source, "departureStatus"),
        getNestedValue(source, "scheduleStatus"),
        getNestedValue(source, "managerStatus"),
        getNestedValue(source, "confirmStatus"),
        getNestedValue(source, "status"),
        getNestedValue(source, "paymentStatus"),
        getNestedValue(source, "balanceStatus")
      ];
      return candidates.map((value) => String(value || "").trim()).filter(Boolean).join(" ");
    }

    function getJoinMyScheduleBadge(item = {}) {
      if (item.scheduleGroup === "joined") {
        const linkedJoin = getJoinMyLinkedJoin(item);
        const targetCount = getJoinMyParticipantCapacity(item);
        const participantCount = Math.max(
          linkedJoin ? getJoinAuthoritativeConfirmedCount(linkedJoin) : 0,
          Number(linkedJoin?.participantSummary?.confirmedCount || linkedJoin?.lightSummary?.confirmedCount || 0),
          Number(item.currentCount || 0)
        );
        const remainingSlots = Number(linkedJoin?.participantSummary?.remainingSlots ?? linkedJoin?.emptySlots);
        if (
          targetCount > 0
          && (participantCount >= targetCount || (participantCount > 0 && Number.isFinite(remainingSlots) && remainingSlots <= 0))
        ) {
          return { label: "모집완료", className: "complete" };
        }
        return { label: item.status || "참여중", className: item.statusClass || "joined" };
      }
      if (item.scheduleGroup !== "created") return null;
      const statusText = getJoinMyScheduleSheetStatus(item);
      if (/출발\s*확정|출발확정|departure\s*confirmed|confirmed\s*departure/i.test(statusText)) {
        return { label: "출발확정", className: "confirmed" };
      }
      const targetCount = getJoinMyParticipantCapacity(item);
      const linkedJoin = getJoinMyLinkedJoin(item);
      const participantCount = linkedJoin ? getJoinAuthoritativeConfirmedCount(linkedJoin) : Number(item.currentCount || 0);
      if (targetCount > 0 && participantCount >= targetCount) {
        return { label: "모집완료", className: "complete" };
      }
      return { label: "모집중", className: "recruiting" };
    }

    function renderJoinMyScheduleBadge(item = {}) {
      const badge = getJoinMyScheduleBadge(item);
      if (!badge) return "";
      return `<div class="join-my-card-schedule-badge ${escapeHtml(badge.className)}">${escapeHtml(badge.label)}</div>`;
    }

    function getJoinMyCreatedStatusGroups(items = []) {
      return items.reduce((groups, item) => {
        const badge = getJoinMyScheduleBadge(item);
        if (["complete", "confirmed"].includes(badge?.className || "")) groups.complete.push(item);
        else groups.recruiting.push(item);
        return groups;
      }, { complete: [], recruiting: [] });
    }

    function renderJoinMyCreatedStatusFilters(items = []) {
      const statusGroups = getJoinMyCreatedStatusGroups(items);
      if (!items.length) return "";
      const activeFilter = statusGroups.complete.length && joinMyCreatedScheduleFilter === "complete" ? "complete" : "recruiting";
      return `
        <div class="join-my-created-filter-group" role="group" aria-label="내가 만든 일정 모집 상태">
          ${statusGroups.complete.length ? `<button type="button" class="join-my-created-filter-button${activeFilter === "complete" ? " active" : ""}" aria-pressed="${activeFilter === "complete" ? "true" : "false"}" onclick="switchJoinMyCreatedStatusFilter('complete')">모집완료 ${statusGroups.complete.length}건</button>` : ""}
          <button type="button" class="join-my-created-filter-button${activeFilter === "recruiting" ? " active" : ""}" aria-pressed="${activeFilter === "recruiting" ? "true" : "false"}" onclick="switchJoinMyCreatedStatusFilter('recruiting')">모집중 ${statusGroups.recruiting.length}건</button>
        </div>
      `;
    }

    function getJoinMyVisibleCreatedSchedules(items = []) {
      const statusGroups = getJoinMyCreatedStatusGroups(items);
      return statusGroups.complete.length && joinMyCreatedScheduleFilter === "complete"
        ? statusGroups.complete
        : statusGroups.recruiting;
    }

    function getJoinMyJoinedStatusGroups(items = []) {
      return items.reduce((groups, item) => {
        const badge = getJoinMyScheduleBadge(item);
        if (badge?.className === "complete") groups.complete.push(item);
        else groups.joined.push(item);
        return groups;
      }, { complete: [], joined: [] });
    }

    function renderJoinMyJoinedStatusFilters(items = []) {
      const statusGroups = getJoinMyJoinedStatusGroups(items);
      if (!items.length) return "";
      const activeFilter = statusGroups.complete.length && joinMyJoinedScheduleFilter === "complete" ? "complete" : "joined";
      return `
        <div class="join-my-created-filter-group" role="group" aria-label="참여중인 일정 모집 상태">
          ${statusGroups.complete.length ? `<button type="button" class="join-my-created-filter-button${activeFilter === "complete" ? " active" : ""}" aria-pressed="${activeFilter === "complete" ? "true" : "false"}" onclick="switchJoinMyJoinedStatusFilter('complete')">모집완료 ${statusGroups.complete.length}건</button>` : ""}
          <button type="button" class="join-my-created-filter-button${activeFilter === "joined" ? " active" : ""}" aria-pressed="${activeFilter === "joined" ? "true" : "false"}" onclick="switchJoinMyJoinedStatusFilter('joined')">참여중 ${statusGroups.joined.length}건</button>
        </div>
      `;
    }

    function getJoinMyVisibleJoinedSchedules(items = []) {
      const statusGroups = getJoinMyJoinedStatusGroups(items);
      return statusGroups.complete.length && joinMyJoinedScheduleFilter === "complete"
        ? statusGroups.complete
        : statusGroups.joined;
    }

    function getJoinMyCreatedScheduleKey(join = {}) {
      return String(join.scheduleId || join.sourceApplicationId || getNestedValue(join.sheetApplication || {}, "scheduleId") || getNestedValue(join.sheetApplication || {}, "applicationId") || join.id || "").trim();
    }

    function getJoinMyJoinedApplicationKey(application = {}) {
      const target = getJoinApplicationTargetRow(application);
      const explicitId = String(application.joinApplyId || application.applicationId || "").trim();
      if (explicitId) return explicitId;
      return [
        target.targetScheduleId,
        target.targetApplicationId,
        target.erpProductId,
        target.erpEventSeq,
        getNestedValue(application, "member.memberSeq") || getNestedValue(application, "member.memberId") || getNestedValue(application, "member.memberMobile") || getNestedValue(application, "member.memberEmail") || "",
        application.submittedAt || application.createdAt || ""
      ].map((value) => String(value || "").trim()).filter(Boolean).join("|");
    }

    function getJoinMyReservationGroups(member = {}) {
      const ownedCreatedJoins = joins.filter((join) => isJoinMyCreatedScheduleForMember(join, member));
      const cancelledCreatedKeys = new Set(
        ownedCreatedJoins
          .filter(isCancelledJoinMyCreatedSchedule)
          .map(getJoinMyCreatedScheduleKey)
          .filter(Boolean)
      );
      const createdJoins = ownedCreatedJoins.filter((join) => {
        if (isCancelledJoinMyCreatedSchedule(join)) return false;
        const key = getJoinMyCreatedScheduleKey(join);
        return !key || !cancelledCreatedKeys.has(key);
      });
      const sheetCreatedJoins = createdJoins.filter((join) => join.builderApplicationSource === "sheet");
      const shouldUseSheetCreatedJoins = googleSheetBuilderApplicationsLoading || (googleSheetBuilderApplicationsReadCompleted && !googleSheetBuilderApplicationsReadFailed);
      const visibleCreatedJoins = shouldUseSheetCreatedJoins
        ? [
          ...sheetCreatedJoins,
          ...createdJoins.filter((join) => join.builderApplicationSource !== "sheet")
        ]
        : createdJoins;
      const createdItems = visibleCreatedJoins
        .filter((join, index, list) => {
          const key = getJoinMyCreatedScheduleKey(join);
          return !key || list.findIndex((item) => getJoinMyCreatedScheduleKey(item) === key) === index;
        })
        .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))
        .map(buildJoinMyCreatedReservationItem);
      const joinedSourceApplications = Array.from(joinApplicationPayloadMemory.values());
      const joinedItems = joinedSourceApplications
        .map(normalizeJoinApplyPayload)
        .filter((application) => !isCancelledJoinApplyPayload(application))
        .filter((application) => isJoinMyJoinApplicationForMember(application, member))
        .filter((application) => {
          const target = getJoinApplicationTargetRow(application);
          return Boolean(
            findJoinForJoinApplicationPayload(application)
            || getNestedValue(application, "join.id")
            || target.targetScheduleId
            || target.targetApplicationId
            || target.erpProductId
            || target.title
          );
        })
        .filter((application, index, list) => {
          const key = getJoinMyJoinedApplicationKey(application);
          return !key || list.findIndex((item) => getJoinMyJoinedApplicationKey(item) === key) === index;
        })
        .filter((application) => {
          const join = findJoinForJoinApplicationPayload(application);
          return !join || !isJoinMyCreatedScheduleForMember(join, member);
        })
        .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))
        .map(buildJoinMyJoinedReservationItem);
      return {
        created: createdItems,
        joined: joinedItems,
        completed: getJoinMyCompletedReservations(member)
      };
    }

    let activeJoinMySchedulesCache = {
      ready: false,
      key: "",
      dataKey: "",
      items: []
    };
    let activeJoinMySchedulesMemberScopeKey = null;

    function clearActiveJoinMySchedulesCache() {
      activeJoinMySchedulesCache = {
        ready: false,
        key: "",
        dataKey: "",
        items: []
      };
    }

    function syncActiveJoinMySchedulesMemberScope() {
      const member = typeof getJoinCachedCurrentMember === "function" ? getJoinCachedCurrentMember() : null;
      const nextMemberKey = getJoinMyMemberIdentity(member || {}).memberKey;
      if (
        activeJoinMySchedulesMemberScopeKey !== null
        && activeJoinMySchedulesMemberScopeKey !== nextMemberKey
      ) {
        clearActiveJoinMySchedulesCache();
      }
      activeJoinMySchedulesMemberScopeKey = nextMemberKey;
      return nextMemberKey;
    }

    function getDateOnlyTime(value = "") {
      const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00`);
      const time = date.getTime();
      return Number.isFinite(time) ? time : NaN;
    }

    function normalizeJoinScheduleRange(source = {}) {
      const start = String(source.departureDate || getNestedValue(source, "join.departureDate") || "").slice(0, 10);
      const end = String(source.returnDate || getNestedValue(source, "join.returnDate") || start || "").slice(0, 10);
      const startTime = getDateOnlyTime(start);
      const endTime = getDateOnlyTime(end || start);
      if (!Number.isFinite(startTime)) return null;
      return {
        start,
        end: end || start,
        startTime,
        endTime: Number.isFinite(endTime) ? endTime : startTime
      };
    }

    function doJoinScheduleRangesOverlap(a = {}, b = {}) {
      if (!a || !b) return false;
      return a.startTime <= b.endTime && b.startTime <= a.endTime;
    }

    function getJoinScheduleMatchKey(item = {}) {
      return [
        item.joinId || item.id || "",
        item.applicationId || item.sourceApplicationId || item.scheduleId || "",
        item.erpProductId || item.goodSeq || getNestedValue(item, "product.erpProductId") || "",
        item.erpEventSeq || item.eventSeq || getNestedValue(item, "product.erpEventSeq") || "",
        item.departureDate || "",
        item.returnDate || item.departureDate || ""
      ].map((value) => String(value || "").trim()).join("|");
    }

    function getJoinScheduleIdCandidates(item = {}) {
      return [
        item.id,
        item.joinId,
        item.scheduleId,
        item.applicationId,
        item.sourceApplicationId,
        getNestedValue(item, "sheetApplication.scheduleId"),
        getNestedValue(item, "sheetApplication.applicationId"),
        getNestedValue(item, "join.id"),
        getNestedValue(item, "join.scheduleId"),
        getNestedValue(item, "join.sourceApplicationId")
      ].map((value) => String(value || "").trim()).filter(Boolean);
    }

    function getJoinScheduleCanonicalIdCandidates(item = {}) {
      return [
        item.scheduleId,
        item.applicationId,
        item.sourceApplicationId,
        getNestedValue(item, "sheetApplication.scheduleId"),
        getNestedValue(item, "sheetApplication.applicationId"),
        getNestedValue(item, "join.scheduleId"),
        getNestedValue(item, "join.sourceApplicationId")
      ].map((value) => String(value || "").trim()).filter(Boolean);
    }

    function getJoinScheduleProductGoodSeq(item = {}) {
      const reference = getSecretTourProductReference(item);
      const parsedErp = parseSecretTourProductReference(item.erpProductId || item.productId || "");
      return String(
        item.goodSeq
        || reference.goodSeq
        || parsedErp.goodSeq
        || getNestedValue(item, "product.goodSeq")
        || getNestedValue(item, "product.erpProductId")
        || ""
      ).trim();
    }

    function getJoinScheduleEventSeq(item = {}) {
      const reference = getSecretTourProductReference(item);
      const parsedErp = parseSecretTourProductReference(item.erpProductId || item.productId || "", item.erpEventSeq || item.eventSeq || "");
      return String(
        item.eventSeq
        || item.erpEventSeq
        || reference.eventSeq
        || parsedErp.eventSeq
        || getNestedValue(item, "product.eventSeq")
        || getNestedValue(item, "product.erpEventSeq")
        || ""
      ).trim();
    }

    function normalizeJoinScheduleTitle(value = "") {
      return String(value || "").replace(/\s+/g, " ").trim();
    }

    function hasSharedJoinScheduleId(a = {}, b = {}) {
      const aIds = new Set(getJoinScheduleIdCandidates(a));
      return getJoinScheduleIdCandidates(b).some((id) => aIds.has(id));
    }

    function isInactiveJoinMySchedule(item = {}) {
      const statusText = String([item.status, item.statusClass, item.scheduleGroup].filter(Boolean).join(" ")).trim();
      if (/취소|반려|cancel|reject/i.test(statusText)) return true;
      const range = normalizeJoinScheduleRange(item);
      if (!range) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return range.endTime < today.getTime();
    }

    function getActiveJoinMySchedulesUncached() {
      const member = typeof getJoinCachedCurrentMember === "function" ? getJoinCachedCurrentMember() : null;
      if (!member) return [];
      const groups = applyJoinMyCreatedReservationRenderCache(member, getJoinMyReservationGroups(member));
      return [...(groups.created || []), ...(groups.joined || [])]
        .filter((item) => !isInactiveJoinMySchedule(item))
        .map((item, index) => {
          const linkedJoin = getJoinMyLinkedJoin(item) || {};
          const range = normalizeJoinScheduleRange(item) || normalizeJoinScheduleRange(linkedJoin);
          return {
            ...item,
            key: item.key || getJoinScheduleMatchKey(item) || `active-${index}`,
            title: item.title || linkedJoin.title || "참여중인 일정",
            image: item.image || linkedJoin.image || "",
            currentCount: Math.max(Number(item.currentCount || 0), getJoinAuthoritativeConfirmedCount(linkedJoin)),
            targetCount: Number(item.targetCount || getJoinMyParticipantCapacity(item) || 0),
            range
          };
        })
        .filter((item) => item.range);
    }

    function getActiveJoinMySchedulesDataKey() {
      return [
        joins.length,
        joinApplicationPayloadMemory.size,
        googleSheetBuilderApplicationsLoading ? "builder-loading" : "builder-ready",
        googleSheetBuilderApplicationsReadCompleted ? "builder-read" : "builder-unread",
        googleSheetJoinApplicationsLoading ? "join-loading" : "join-ready",
        googleSheetJoinApplicationsReadCompleted ? "join-read" : "join-unread"
      ].join("|");
    }

    function getActiveJoinMySchedulesCacheKey(memberKey = "", dataKey = getActiveJoinMySchedulesDataKey()) {
      return `${String(memberKey || "").trim()}|${dataKey}`;
    }

    function getActiveJoinMySchedules(options = {}) {
      const dataKey = getActiveJoinMySchedulesDataKey();
      const memberKey = syncActiveJoinMySchedulesMemberScope();
      const cacheKey = getActiveJoinMySchedulesCacheKey(memberKey, dataKey);
      if (!options.force && activeJoinMySchedulesCache.ready && activeJoinMySchedulesCache.key === cacheKey) {
        return activeJoinMySchedulesCache.items;
      }
      const items = getActiveJoinMySchedulesUncached().map((item) => {
        const linkedJoin = getJoinMyLinkedJoin(item) || {};
        return {
          ...item,
          goodSeq: item.goodSeq || linkedJoin.goodSeq || getJoinScheduleProductGoodSeq(linkedJoin),
          erpProductId: item.erpProductId || linkedJoin.erpProductId || getJoinScheduleProductGoodSeq(linkedJoin),
          eventSeq: item.eventSeq || linkedJoin.eventSeq || getJoinScheduleEventSeq(linkedJoin),
          erpEventSeq: item.erpEventSeq || linkedJoin.erpEventSeq || getJoinScheduleEventSeq(linkedJoin)
        };
      });
      activeJoinMySchedulesCache = { ready: true, key: cacheKey, dataKey, items };
      return items;
    }

    function isSameActiveJoinSchedule(join = {}, active = {}) {
      if (!join || !active) return false;
      const joinCanonicalIds = new Set(getJoinScheduleCanonicalIdCandidates(join));
      const activeCanonicalIds = getJoinScheduleCanonicalIdCandidates(active);
      if (joinCanonicalIds.size && activeCanonicalIds.length) {
        return activeCanonicalIds.some((id) => joinCanonicalIds.has(id));
      }
      if (hasSharedJoinScheduleId(join, active)) return true;
      const joinRange = normalizeJoinScheduleRange(join);
      const activeRange = active.range || normalizeJoinScheduleRange(active);
      if (!joinRange || !activeRange || joinRange.start !== activeRange.start || joinRange.end !== activeRange.end) return false;
      const joinProduct = getJoinScheduleProductGoodSeq(join) || getJoinProductGoodSeq(join) || "";
      const activeProduct = getJoinScheduleProductGoodSeq(active) || "";
      const joinEvent = getJoinScheduleEventSeq(join) || "";
      const activeEvent = getJoinScheduleEventSeq(active) || "";
      if (joinProduct && activeProduct && String(joinProduct) === String(activeProduct)) return true;
      if (joinEvent && activeEvent && String(joinEvent) === String(activeEvent)) return true;
      const joinTitle = normalizeJoinScheduleTitle(join.title || getNestedValue(join, "product.productName"));
      const activeTitle = normalizeJoinScheduleTitle(active.title || getNestedValue(active, "product.productName"));
      return Boolean(joinTitle && activeTitle && joinTitle === activeTitle);
    }

    function findOwnActiveJoinSchedule(join = {}) {
      return getActiveJoinMySchedules().find((active) => isSameActiveJoinSchedule(join, active)) || null;
    }

    function findOverlappingActiveJoinSchedule(join = {}) {
      const joinRange = normalizeJoinScheduleRange(join);
      if (!joinRange) return null;
      return getActiveJoinMySchedules().find((active) => {
        if (isSameActiveJoinSchedule(join, active)) return false;
        return doJoinScheduleRangesOverlap(joinRange, active.range);
      }) || null;
    }

    function findAnyOverlappingActiveJoinSchedule(join = {}) {
      const joinRange = normalizeJoinScheduleRange(join);
      if (!joinRange) return null;
      return getActiveJoinMySchedules().find((active) => {
        return doJoinScheduleRangesOverlap(joinRange, active.range);
      }) || null;
    }

    function isJoinExcludedByActiveScheduleOverlap(join = {}) {
      return Boolean(findOverlappingActiveJoinSchedule(join));
    }

    function isProductExcludedByActiveScheduleOverlap(product = {}) {
      return Boolean(findAnyOverlappingActiveJoinSchedule(product));
    }

    function isHomeJoinScheduleVisibleForCurrentMember(join = {}) {
      if (isCurrentMemberCreatedJoinSchedule(join) || isCurrentMemberJoinedJoinSchedule(join) || findOwnActiveJoinSchedule(join)) {
        return false;
      }
      return !isJoinExcludedByActiveScheduleOverlap(join);
    }

    function isJoinExcludedFromMyReservationRecommendations(join = {}) {
      return Boolean(
        findOwnActiveJoinSchedule(join)
        || isCurrentMemberCreatedJoinSchedule(join)
        || isCurrentMemberJoinedJoinSchedule(join)
        || findOverlappingActiveJoinSchedule(join)
      );
    }

    function isCurrentMemberCreatedJoinSchedule(join = {}) {
      const member = typeof getJoinCachedCurrentMember === "function" ? getJoinCachedCurrentMember() : null;
      return Boolean(member && isJoinMyCreatedScheduleForMember(join, member));
    }

    function getBlockingActiveJoinSchedule(join = {}) {
      return findOverlappingActiveJoinSchedule(join);
    }

    function renderJoinOwnScheduleBadge(join = {}) {
      const ownSchedule = findOwnActiveJoinSchedule(join);
      const isDirectJoined = isCurrentMemberJoinedJoinSchedule(join);
      if (!ownSchedule && !isDirectJoined) return "";
      const isCreated = ownSchedule?.scheduleGroup === "created" || isCurrentMemberCreatedJoinSchedule(join);
      const label = isCreated ? "내모임" : "참여중";
      const stateClass = isCreated ? "is-created" : "is-joined";
      return `<div class="join-badge-wrap"><div class="join-own-schedule-badge ${stateClass}">${escapeHtml(label)}</div></div>`;
    }

    function renderScheduleOverlapBadgeHtml(extraClass = "") {
      return `<div class="schedule-overlap-badge${extraClass ? ` ${extraClass}` : ""}">&#x1F4A1;&#xC77C;&#xC815;&#xC774; &#xACB9;&#xCCD0;&#xC694;</div>`;
    }

    function renderScheduleOverlapBadge(join = {}, extraClass = "", options = {}) {
      if (isCurrentMemberCreatedJoinSchedule(join)) return "";
      if (options.includeOwn && getBlockingActiveJoinSchedule(join)) return renderScheduleOverlapBadgeHtml(extraClass);
      if (findOverlappingActiveJoinSchedule(join)) return renderScheduleOverlapBadgeHtml(extraClass);
      return "";
    }

    function formatJoinMyDateWithWeekday(dateString = "") {
      const date = new Date(`${dateString}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}.${month}.${day}(${weekdays[date.getDay()]})`;
    }

    function formatJoinMyDateRange(item = {}) {
      const start = formatJoinMyDateWithWeekday(item.departureDate || "");
      const end = formatJoinMyDateWithWeekday(item.returnDate || item.departureDate || "");
      if (!start) return item.meta || "";
      return end && end !== start ? `${start} ~ ${end}` : start;
    }

    function formatJoinMyCompactDurationText(value = "") {
      return String(value || "").replace(/\s+/g, "");
    }

    function getJoinMyTripDuration(item = {}) {
      const join = getJoinMyLinkedJoin(item) || item;
      const duration = formatTripDuration(join);
      return /NaN/.test(duration) ? "" : duration;
    }

    function renderJoinMyPeriodSummaryValue(item = {}) {
      const range = formatJoinMyDateRange(item);
      if (!range) return "";
      if (/\d+\s*박\s*\d+\s*일/.test(range)) return escapeHtml(range);
      const duration = getJoinMyTripDuration(item);
      if (!duration) return escapeHtml(range);
      return `${escapeHtml(range)}<i class="join-my-summary-dot join-my-summary-duration" aria-hidden="true"></i><i class="join-my-summary-duration">${escapeHtml(formatJoinMyCompactDurationText(duration))}</i>`;
    }

    function formatJoinMyDday(dateString = "") {
      const date = new Date(`${dateString}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
      if (diff === 0) return "D-DAY";
      return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
    }

    function formatJoinMyCardDateBadge(item = {}) {
      if (item.scheduleGroup !== "completed") return formatJoinMyDday(item.departureDate);
      const date = new Date(`${item.returnDate || item.departureDate || ""}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
      if (diff >= 0 && diff <= 30) return diff === 0 ? "오늘" : `${diff}일 전`;
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    }

    function getJoinMyLinkedJoin(item = {}) {
      const keys = [
        item.joinId,
        item.id,
        item.scheduleId,
        item.sourceApplicationId
      ].map((value) => String(value || "").trim()).filter(Boolean);
      const idMatch = keys.length
        ? joins.find((join) => {
          const joinKeys = [
            join.id,
            join.scheduleId,
            join.sourceApplicationId,
            getNestedValue(join.sheetApplication || {}, "scheduleId"),
            getNestedValue(join.sheetApplication || {}, "applicationId"),
            getNestedValue(join.displayRule || {}, "recommendedScheduleId"),
            getNestedValue(join.displayRule || {}, "displayRuleId")
          ].map((value) => String(value || "").trim()).filter(Boolean);
          return keys.some((key) => joinKeys.includes(key));
        })
        : null;
      if (idMatch) return idMatch;
      if (keys.length) return null;
      const eventSeq = String(item.erpEventSeq || item.eventSeq || "").trim();
      const productId = normalizeJoinErpProductId(item.erpProductId || item.goodSeq || "", eventSeq);
      if (!productId && !eventSeq) return null;
      const matches = joins.filter((join) => {
        const reference = getSecretTourProductReference(join);
        const joinEventIds = [
          join.erpEventSeq,
          join.eventSeq,
          reference.eventSeq
        ].map((value) => String(value || "").trim()).filter(Boolean);
        const joinEventSeq = joinEventIds[0] || "";
        const joinProductIds = [
          join.erpProductId,
          join.goodSeq,
          join.productId,
          reference.id,
          reference.goodSeq
        ].map((value) => normalizeJoinErpProductId(value, joinEventSeq)).filter(Boolean);
        const productMatched = productId && joinProductIds.includes(productId);
        const eventMatched = !eventSeq || joinEventIds.includes(eventSeq);
        return productMatched && eventMatched;
      });
      return matches.length === 1 ? matches[0] : null;
    }

    function getJoinMyParticipantCapacity(item = {}) {
      const linkedJoin = getJoinMyLinkedJoin(item);
      return Number(item.targetCount || (linkedJoin ? getCardTeamCapacity(linkedJoin, 4) : 0) || 0);
    }

    function getJoinMyParticipantAgeValue(participant = {}) {
      const value = String(participant.age || participant.ageDisplay || "").trim();
      const exact = Number((value.match(/(?:^|\D)([3-9]\d)(?:\D|$)/) || [])[1]);
      if (exact && !/대/.test(value)) return exact;
      const decade = Number((value.match(/([3-9]\d)대/) || [])[1]);
      if (!decade) return 0;
      if (/초반/.test(value)) return decade + 2;
      if (/후반/.test(value)) return decade + 8;
      return decade + 5;
    }

    function formatJoinMyAverageAge(participants = []) {
      const values = participants.map(getJoinMyParticipantAgeValue).filter(Boolean);
      if (!values.length) return "확인중";
      const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      const decade = Math.floor(average / 10) * 10;
      const phase = average % 10 <= 3 ? "초반" : average % 10 >= 7 ? "후반" : "중반";
      return `${decade}대 ${phase}`;
    }

    function getJoinMyParticipantScoreValue(participant = {}) {
      const source = String(participant.handicap || participant.level || "").trim();
      const score = Number((source.match(/\d+/) || [])[0]);
      if (score) return score;
      if (/프로/.test(source)) return 72;
      if (/싱글/.test(source)) return 79;
      if (/보기/.test(source)) return 100;
      if (/입문|초보/.test(source)) return 110;
      return 0;
    }

    function formatJoinMyAverageScore(participants = []) {
      const values = participants.map(getJoinMyParticipantScoreValue).filter(Boolean);
      if (!values.length) return "확인중";
      const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      if (average < 80) return "싱글 수준";
      const scoreBand = Math.floor(average / 10) * 10;
      return `${scoreBand}대 정도`;
    }

    function renderJoinMyEmptySlot() {
      return `<div class="join-my-card-participant-slot">
        <div class="join-my-empty-slot" aria-label="빈 인원 슬롯">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-icon lucide-user" aria-hidden="true">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>`;
    }

    function renderJoinMyParticipantSlot(participant = {}, joinId = "", options = {}) {
      const payload = encodeURIComponent(JSON.stringify({ joinId, participantId: participant.id }));
      const genderFlowClass = getParticipantGenderFlowClass(participant.gender);
      const flowDelayStyle = getParticipantFlowDelayStyle(participant, joinId);
      const badge = options.isMe
        ? '<div class="join-my-card-participant-me-badge">나</div>'
        : options.isHost
        ? '<div class="join-my-card-participant-me-badge host">모임장</div>'
        : "";
      return `<div class="join-my-card-participant-slot">
        <div class="team-avatar-wrap">
          <button type="button" class="team-avatar participant-flow-avatar ${genderFlowClass}" data-participant="${payload}" data-participant-gender="${escapeHtml(participant.gender || "")}" style="${flowDelayStyle}" onclick="event.stopPropagation(); handleParticipantClick(this)" title="${escapeHtml(participant.name || "")} / ${escapeHtml(participant.age || "")} / ${escapeHtml(participant.handicap || "")}" aria-label="${escapeHtml(participant.name || "참여자")} 참여자 정보">
            <img src="${escapeHtml(participant.gif || "")}" alt="${escapeHtml(participant.name || "참여자")}">
          </button>
          ${badge}
        </div>
      </div>`;
    }

    function renderJoinMyParticipantGroup(participants = [], joinId = "", options = {}) {
      if (!participants.length) return "";
      if (participants.length === 1 || !participants[0].companionGroup) {
        return renderJoinMyParticipantSlot(participants[0], joinId, options);
      }
      return `<div class="team-couple-wrap">${participants.map((participant, index) => {
        return renderJoinMyParticipantSlot(participant, joinId, {
          ...options,
          isMe: Boolean(options.isMe && index === 0),
          isHost: Boolean(options.isHost && index === 0)
        });
      }).join("")}</div>`;
    }

    function isJoinMyParticipantMe(participant = {}, index = 0, item = {}) {
      if (item.scheduleGroup === "joined" && (participant?.isHost || participant?.isCreator)) return false;
      const myParticipantIds = Array.isArray(item.myParticipantIds)
        ? item.myParticipantIds.map((value) => String(value || "")).filter(Boolean)
        : [String(item.myParticipantId || "")].filter(Boolean);
      if (myParticipantIds.length) return myParticipantIds.includes(String(participant.id || ""));
      if (isJoinParticipantForCurrentMember(participant)) return true;
      return item.showMeBadge !== false && index === 0;
    }

    function isJoinMyParticipantHost(participant = {}, index = 0, item = {}) {
      const linkedJoin = getJoinMyLinkedJoin(item);
      if (linkedJoin?.isAdminRecommendedSchedule) return false;
      if (item.hostParticipantId) return String(participant.id || "") === String(item.hostParticipantId);
      return Boolean(participant.isHost || participant.isCreator || (item.scheduleGroup === "joined" && index === 0));
    }

    function renderJoinMyGroupedParticipantSlots(participants = [], joinId = "", options = {}) {
      const showMeBadge = options.showMeBadge !== false;
      const item = options.item || {};
      const renderedGroups = [];
      for (let index = 0; index < participants.length;) {
        const participant = participants[index];
        const groupKey = participant?.companionGroup || "";
        if (!groupKey) {
          renderedGroups.push(renderJoinMyParticipantSlot(participant, joinId, {
            isMe: showMeBadge && isJoinMyParticipantMe(participant, index, item),
            isHost: isJoinMyParticipantHost(participant, index, item)
          }));
          index += 1;
          continue;
        }
        const groupedParticipants = [];
        const groupStartIndex = index;
        while (index < participants.length && participants[index]?.companionGroup === groupKey) {
          groupedParticipants.push(participants[index]);
          index += 1;
        }
        renderedGroups.push(renderJoinMyParticipantGroup(groupedParticipants, joinId, {
          isMe: showMeBadge && isJoinMyParticipantMe(groupedParticipants[0], groupStartIndex, item),
          isHost: isJoinMyParticipantHost(groupedParticipants[0], groupStartIndex, item)
        }));
      }
      return renderedGroups.join("");
    }

    function renderJoinMyParticipantSlots(participants = [], item = {}) {
      const join = getJoinMyLinkedJoin(item);
      const targetCount = getJoinMyParticipantCapacity(item);
      const slotCount = Math.max(targetCount, participants.length, Number(item.currentCount || 0), 1);
      const visibleParticipants = participants.slice(0, slotCount);
      const emptyCount = Math.max(0, slotCount - visibleParticipants.length);
      return [
        join && visibleParticipants.length
          ? renderJoinMyGroupedParticipantSlots(visibleParticipants, join.id, { showMeBadge: item.showMeBadge !== false, item })
          : "",
        ...Array.from({ length: emptyCount }).map(() => renderJoinMyEmptySlot())
      ].join("");
    }

    function getJoinMySubmittedReviewImages(review = {}) {
      const source = review.review || review || {};
      const images = Array.isArray(source.images) ? source.images : [];
      const normalizedImages = images.map((image = {}) => ({
        url: image.thumbnailUrl || image.imageUrl || image.previewUrl || "",
        alt: image.photoName || image.fileName || "후기 사진"
      })).filter((image) => image.url);
      const fallbackUrl = source.thumbnailUrl || source.imageUrl || "";
      if (!normalizedImages.length && fallbackUrl) {
        normalizedImages.push({ url: fallbackUrl, alt: source.photoName || "후기 사진" });
      }
      return normalizedImages.slice(0, REVIEW_IMAGE_MAX_FILES);
    }

    function formatJoinMySubmittedReviewDate(review = {}) {
      const raw = String(review.submittedAt || review.updatedAt || review.createdAt || "").trim();
      if (!raw) return "";
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return raw;
      const today = new Date();
      if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()) return "오늘";
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfReviewDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayDiff = Math.round((startOfToday.getTime() - startOfReviewDate.getTime()) / 86400000);
      if (dayDiff > 0 && dayDiff <= 7) return `${dayDiff}일 전`;
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    }

    function renderJoinMySubmittedReviewBox(review = null) {
      if (!review) return "";
      const source = review.review || review || {};
      const rating = Math.max(1, Math.min(5, Number(source.rating || review.rating || 0) || 5));
      const tags = Array.isArray(source.tags) ? source.tags : toBuilderApplicationArray(source.tags || review.tags);
      const text = String(source.text || review.reviewText || review.text || "").trim();
      const images = getJoinMySubmittedReviewImages(review);
      const reviewDate = formatJoinMySubmittedReviewDate(review);
      return `<div class="join-my-review-box">
        <div class="join-my-review-head">
          <div class="join-my-review-title">내가 작성한 후기</div>
          <div class="join-my-review-meta">
            ${reviewDate ? `<span class="join-my-review-date">${escapeHtml(reviewDate)}</span>` : ""}
            <span class="join-my-review-stars" aria-label="별점 ${rating}점">${"★".repeat(rating)}</span>
          </div>
        </div>
        ${tags.length ? `<div class="join-my-review-tags">${tags.map((tag) => `<span class="join-my-review-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        ${text ? `<div class="join-my-review-text">${escapeHtml(text)}</div>` : ""}
        ${images.length ? `<div class="join-my-review-photos">${images.map((image) => `<img class="join-my-review-photo" src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">`).join("")}</div>` : ""}
      </div>`;
    }

    function getJoinParticipantGenderCounts(join = {}, participants = []) {
      const summary = join?.participantSummary || join?.lightSummary || {};
      const summaryMale = Number(summary.maleCount);
      const summaryFemale = Number(summary.femaleCount);
      const participantCounts = (Array.isArray(participants) ? participants : []).reduce((counts, participant = {}) => {
        const gender = String(participant.gender || "").trim().toLowerCase();
        if (gender.includes("여") || gender === "female") counts.female += 1;
        else if (gender.includes("남") || gender === "male") counts.male += 1;
        return counts;
      }, { male: 0, female: 0 });
      const participantGenderTotal = participantCounts.male + participantCounts.female;
      const hasAggregateCounts = Number.isFinite(summaryMale)
        && Number.isFinite(summaryFemale)
        && summaryMale + summaryFemale > 0;
      const authoritativeCount = getJoinAuthoritativeConfirmedCount(join);
      if (participantGenderTotal > 0 && participantGenderTotal >= authoritativeCount) {
        return participantCounts;
      }
      if (hasAggregateCounts) {
        return {
          male: Math.max(0, Math.round(summaryMale)),
          female: Math.max(0, Math.round(summaryFemale))
        };
      }
      return participantCounts;
    }

    function getJoinMyParticipantSummary(participants = [], item = {}) {
      const targetCount = getJoinMyParticipantCapacity(item);
      const linkedJoin = getJoinMyLinkedJoin(item);
      const authoritativeCount = linkedJoin ? getJoinAuthoritativeConfirmedCount(linkedJoin) : 0;
      const rawCount = Math.max(participants.length, Number(item.currentCount || 0), authoritativeCount);
      const count = targetCount > 0 ? Math.min(targetCount, rawCount) : rawCount;
      const remaining = Math.max(0, targetCount - count);
      const genderCounts = getJoinParticipantGenderCounts(linkedJoin, participants);
      return {
        count,
        targetCount,
        remaining,
        genderRatio: [
          genderCounts.male ? `남성 ${genderCounts.male}명` : "",
          genderCounts.female ? `여성 ${genderCounts.female}명` : ""
        ].filter(Boolean).join(" · ") || "확인중",
        averageScore: formatJoinMyAverageScore(participants),
        averageAge: formatJoinMyAverageAge(participants)
      };
    }

    function renderJoinMyParticipants(item = {}) {
      const join = getJoinMyLinkedJoin(item);
      const participants = join ? getUniqueCardParticipants(getConfirmedParticipants(join), join.id) : [];
      const summary = getJoinMyParticipantSummary(participants, item);
      const groupCapacity = getJoinRecruitmentCapacity(
        join || item,
        Number(item.targetCount || summary.targetCount || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY
      );
      const isGroupSchedule = isMonthlyRecommendationJoin(join || item) || groupCapacity > JOIN_MAX_CAPACITY;
      const groupCount = Math.min(
        groupCapacity,
        Math.max(
          summary.count,
          join ? getMonthlyCardParticipantCount(join) : 0,
          Number(item.currentCount || 0)
        )
      );
      const groupProgress = groupCapacity > 0
        ? Math.max(0, Math.min(100, (groupCount / groupCapacity) * 100))
        : 0;
      const participantMain = isGroupSchedule
        ? `<div class="detail-monthly-gauge join-my-participant-group-gauge">
            <div class="detail-monthly-gauge-head">
              <div>모집인원</div>
              <div class="detail-monthly-gauge-count">${groupCount}/${groupCapacity}명</div>
            </div>
            <div class="detail-participant-gauge-track" aria-hidden="true">
              <div class="detail-participant-gauge-fill" style="--gauge-width:${groupProgress}%;"></div>
            </div>
          </div>`
        : `<div class="join-my-participant-main">
            <div class="join-my-participant-icons-box">
              <div class="join-my-card-participants">${renderJoinMyParticipantSlots(participants, item)}</div>
            </div>
            <div class="join-my-participant-counts">
              <div class="join-my-participant-count">
                <div class="join-my-participant-count-label">현재인원</div>
                <div class="join-my-participant-count-value">${escapeHtml(String(summary.targetCount ? `${summary.count}/${summary.targetCount}명` : `${summary.count}명`))}</div>
              </div>
              <div class="join-my-participant-count">
                <div class="join-my-participant-count-label">남은자리</div>
                <div class="join-my-participant-count-value">${escapeHtml(String(summary.remaining))}자리</div>
              </div>
            </div>
          </div>`;
      return `
        <div class="join-my-participant-status">
          <div class="join-my-participant-panel">
            <div class="join-my-participant-panel-head">
              <div class="join-my-participant-panel-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor"/><path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div class="join-my-participant-panel-title">참여현황</div>
            </div>
            ${participantMain}
            <div class="join-my-participant-summary">
              <div class="join-my-participant-pill"><div class="join-my-participant-pill-label">인원구성</div><div class="join-my-participant-pill-value">${escapeHtml(summary.genderRatio)}</div></div>
              <div class="join-my-participant-pill"><div class="join-my-participant-pill-label">평균타수</div><div class="join-my-participant-pill-value">${escapeHtml(summary.averageScore)}</div></div>
              <div class="join-my-participant-pill"><div class="join-my-participant-pill-label">평균연령</div><div class="join-my-participant-pill-value">${escapeHtml(summary.averageAge)}</div></div>
            </div>
          </div>
        </div>
      `;
    }

    function renderJoinMyDetailIcon(label = "") {
      const key = String(label || "").trim();
      if (key === "여행지") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.5" stroke="currentColor"/></svg>`;
      }
      if (key === "여행기간") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor"/><path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" stroke-linecap="round"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" stroke="currentColor" stroke-linecap="round"/></svg>`;
      }
      if (key === "참여현황") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      if (key === "항공정보") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      }
      if (key === "요금") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7.5 7.2 17l4.8-9 4.8 9 2.7-9.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 13h16" stroke="currentColor" stroke-linecap="round"/></svg>`;
      }
      if (key === "골프장") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 20V4M6 4h11l-2 4 2 4H6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20h8" stroke="currentColor" stroke-linecap="round"/><circle cx="17" cy="18" r="2" stroke="currentColor"/></svg>`;
      }
      return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21v-6h6v6M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    function renderJoinMyDetailRows(item = {}) {
      const rows = [
        ["여행지", item.countryRegion || item.region || ""],
        ["여행기간", formatJoinMyDateRange(item)],
        item.flightPack && item.flightInfo ? ["항공정보", item.flightInfo] : null,
        ["요금", item.price || (getJoinMyLinkedJoin(item)?.price ? `${formatPrice(getJoinMyLinkedJoin(item).price)}원~` : "")],
        item.hideParticipants ? null : ["참여현황", renderJoinMyParticipants(item), true]
      ].filter(Boolean).filter((row) => row[1]);
      if (!rows.length) return "";
      return `<div class="join-my-card-detail-list">${rows.map(([label, value, isHtml]) => `
        <div class="join-my-card-detail-row${label === "참여현황" ? " participants" : ""}">
          <div class="join-my-card-detail-icon">${renderJoinMyDetailIcon(label)}</div>
          <div class="join-my-card-detail-copy">
            <div class="join-my-card-detail-label">${escapeHtml(label)}</div>
            <div class="join-my-card-detail-value">${isHtml ? value : escapeHtml(value)}</div>
          </div>
        </div>
      `).join("")}</div>`;
    }

    function getJoinMyEmptyMessage(tabKey = "") {
      if (tabKey === "created") return "아직 모집중인 모임이 없어요.";
      if (tabKey === "joined") return "아직 참여 중인 모임이 없어요.";
      if (tabKey === "completed") return "아직 다녀온 모임이 없어요.";
      return "아직 표시할 모임이 없어요.";
    }

    function getJoinMyEmptyRecommendTitle(tabKey = "") {
      return "바로 참여 가능한 모임";
    }

    function setJoinMyEmptyRecommendType(type) {
      regionEmptyRecommendType = SHOW_DOMESTIC_JOIN_PRODUCTS ? type : "overseas";
      if (!isJoinMyMenuViewOpen("reservation")) return;
      const member = getJoinCachedCurrentMember();
      if (member) renderJoinMyMenu(member);
    }

    async function openJoinMyEmptyRecommendRegion(region = "") {
      return runJoinActionLoading(async () => {
        closeJoinMyMenu();
        await ensureExternalGolfJoinProductsLoaded();
        selectedRegionSearchName = region;
        await openRegionSearchModal("default", { showLoading: false });
        if (region) {
          selectedRegionSearchName = region;
          performRegionProductSearch();
        }
      }, { message: "추천 여행지를 불러오고 있어요", minVisibleMs: 500 });
    }

    function renderJoinMyEmptyRecommendations(tabKey = "") {
      return renderEmptyRegionRecommendations("", {
        title: getJoinMyEmptyRecommendTitle(tabKey),
        setTypeHandler: "setJoinMyEmptyRecommendType",
        moreHandler: "openJoinMyEmptyRecommendRegion",
        excludeActiveScheduleOverlaps: true
      });
    }

    function renderJoinMyEmptyState(tabKey = "") {
      const showCreateButton = tabKey === "created" || tabKey === "joined";
      return `<div class="join-my-empty">
        <div class="join-my-empty-box">
          <div class="join-my-empty-copy">${escapeHtml(getJoinMyEmptyMessage(tabKey))}</div>
          ${showCreateButton ? `<button type="button" class="region-result-empty-action" onclick="openBuilderFromRegionSearch()">새로운 모임 만들기</button>` : ""}
        </div>
        ${renderJoinMyEmptyRecommendations(tabKey)}
      </div>`;
    }

    function isJoinMyReservationTab(tabKey = "") {
      return tabKey === "created" || tabKey === "joined";
    }

    function isJoinMyReservationBootstrapLoading(tabKey = "") {
      if (!isJoinMyReservationTab(tabKey) || !GOLFJOIN_SHEET_API_ENDPOINT) return false;
      return Boolean(joinMyReservationsRefreshing || googleSheetBuilderApplicationsLoading || googleSheetJoinApplicationsLoading);
    }

    function hasJoinMyReservationReadFailed(tabKey = "") {
      if (tabKey === "created") {
        return Boolean(googleSheetBuilderApplicationsReadCompleted && googleSheetBuilderApplicationsReadFailed);
      }
      if (tabKey === "joined") {
        return Boolean(googleSheetJoinApplicationsReadCompleted && googleSheetJoinApplicationsReadFailed);
      }
      return false;
    }

    function renderJoinMyLoadingState() {
      return `<div class="join-my-loading-state" role="status" aria-live="polite" aria-busy="true" aria-label="내 예약 정보를 확인하고 있어요">
        ${Array.from({ length: 2 }).map((_, index) => `
          <div class="join-my-loading-card" aria-hidden="true">
            <div class="join-my-loading-thumb"></div>
            <div class="join-my-loading-content">
              <div class="join-my-loading-line title"></div>
              <div class="join-my-loading-line meta" style="width:${index % 2 ? 62 : 48}%;"></div>
              <div class="join-my-loading-row">
                ${Array.from({ length: 4 }).map(() => `<div class="join-my-loading-avatar"></div>`).join("")}
              </div>
              <div class="join-my-loading-button"></div>
            </div>
          </div>
        `).join("")}
        <div class="join-my-loading-common" aria-hidden="true">
          <div class="join-action-loading-box has-message">
            <div class="join-action-loading-icon">${joinActionLoadingIcons[1] || joinActionLoadingIcons[0] || ""}</div>
            <div class="join-action-loading-message">
              <div class="join-loading-text">내 예약 정보를 확인하고 있어요<div class="join-loading-dots"><div class="join-loading-dot">.</div><div class="join-loading-dot">.</div><div class="join-loading-dot">.</div></div></div>
            </div>
          </div>
        </div>
      </div>`;
    }

    function renderJoinMyReadFailedState() {
      return `<div class="join-my-empty">
        <div class="join-my-empty-box">
          <div class="join-my-empty-copy">예약 정보를 불러오지 못했습니다. 다시 시도해 주세요.</div>
        </div>
      </div>`;
    }

    function getJoinMyActionConfig(rawAction) {
      if (Array.isArray(rawAction)) {
        return { label: rawAction[0] || "", variant: rawAction[1] || "", action: rawAction[2] || "" };
      }
      if (rawAction && typeof rawAction === "object") return rawAction;
      return { label: String(rawAction || ""), variant: "", action: "" };
    }

    function getJoinMyActionOnclick(item = {}, action = {}) {
      const actionKey = action.action || "";
      if (actionKey === "accordion") return "toggleJoinMyReservationAccordion(this)";
      if (actionKey === "removeWish") return `handleJoinWishRemove('${escapeJsString(getJoinWishTargetKey(item))}', '${escapeJsString(action.wishType || item.wishOpenType || "product")}')`;
      if (actionKey === "product") return `handleJoinMyReservationProduct('${escapeJsString(item.joinId || "")}', '${escapeJsString(item.title || "")}', ${item.detailHideParticipants || action.hideParticipants ? "true" : "false"})`;
      if (actionKey === "review") {
        const linkedJoin = getJoinMyLinkedJoin(item);
        const summaryImage = item.image || linkedJoin?.image || "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg";
        const summaryRegion = item.countryRegion || item.region || linkedJoin?.region || "";
        const summaryPeriod = formatJoinMyDateRange(item);
        return `handleJoinMyReviewWrite('${escapeJsString(item.joinId || "")}', '${escapeJsString(item.title || "")}', { image: '${escapeJsString(summaryImage)}', region: '${escapeJsString(summaryRegion)}', period: '${escapeJsString(summaryPeriod)}' })`;
      }
      if (actionKey === "contact" || String(action.label || "").includes("문의")) return "openExternalLink('http://pf.kakao.com/_lRbYxj/chat')";
      return "void 0";
    }

    function getJoinMyHeadAction(item = {}) {
      return (item.actions || []).map(getJoinMyActionConfig).find((action) => action.placement === "head") || null;
    }

    function getJoinMyAccordionIcon(isOpen = false) {
      return isOpen
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-icon lucide-chevron-up" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon lucide-chevron-down" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
    }

    function getJoinMySummaryIcon(type = "") {
      if (type === "period") {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor"/><path d="M8 2v4M16 2v4M3 10h18" stroke="currentColor" stroke-linecap="round"/></svg>`;
      }
      return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.5" stroke="currentColor"/></svg>`;
    }

    function getJoinMyDepartureAirportLabel(item = {}) {
      if (!item.flightPack) return "";
      const join = getJoinMyLinkedJoin(item);
      const airport = String(join?.departureAirport || join?.airport || item.departureAirport || item.airport || "").trim()
        || String(item.flightInfo || "").split("출발")[0].replace(/[·ㆍ|]/g, "").trim();
      return airport ? `${airport}출발` : "";
    }

    function renderJoinMySummaryLine(type = "", value = "") {
      if (!value) return "";
      return `<div class="join-my-summary-line ${escapeHtml(type)}">${getJoinMySummaryIcon(type)}<div class="join-my-summary-line-text">${value}</div></div>`;
    }

    function getJoinMyBrowseCardOnclick(item = {}) {
      if (item.wishOpenTargetKey) {
        return `handleJoinMyBrowseCardClick(event, '${escapeJsString(item.wishOpenTargetKey)}', '${escapeJsString(item.wishOpenType || "product")}', 'wish')`;
      }
      if (item.recentOpenTargetKey) {
        return `handleJoinMyBrowseCardClick(event, '${escapeJsString(item.recentOpenTargetKey)}', '${escapeJsString(item.recentOpenType || "product")}', 'recent')`;
      }
      return "";
    }

    function handleJoinMyBrowseCardClick(event, targetKey = "", itemType = "product", source = "recent") {
      if (event?.target?.closest?.("button, a, input, select, textarea, .join-my-participant-icons-box")) return;
      if (source === "wish") openJoinWishProduct(targetKey, itemType);
      else openJoinRecentViewedProduct(targetKey, itemType);
    }

    function renderJoinMyProductButton(item = {}) {
      if (item.wishOpenTargetKey) {
        return `<button type="button" class="join-my-card-browse-open-button" onclick="event.stopPropagation(); openJoinWishProduct('${escapeJsString(item.wishOpenTargetKey || "")}', '${escapeJsString(item.wishOpenType || "product")}')" aria-label="일정 자세히 보기">일정 자세히 보기 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
      }
      if (item.recentOpenTargetKey) {
        return `<button type="button" class="join-my-card-browse-open-button" onclick="event.stopPropagation(); openJoinRecentViewedProduct('${escapeJsString(item.recentOpenTargetKey || "")}', '${escapeJsString(item.recentOpenType || "product")}')" aria-label="일정 자세히 보기">일정 자세히 보기 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
      }
      return `<button type="button" class="join-my-card-product-button" onclick="event.stopPropagation(); handleJoinMyReservationProduct('${escapeJsString(item.joinId || "")}', '${escapeJsString(item.title || "")}', ${item.detailHideParticipants ? "true" : "false"})" aria-label="자세히 보기"><i class="join-my-card-product-label-desktop">자세히 보기</i><i class="join-my-card-product-label-mobile">자세히 보기</i> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
    }

    function openJoinMyQuotePage(url = "") {
      try {
        const target = new URL(String(url || "").trim(), window.location.href);
        if (target.protocol !== "https:" && target.protocol !== "http:") return;
        if (target.hostname.toLowerCase().endsWith(".cloudfunctions.net") && (!target.pathname || target.pathname === "/")) {
          target.pathname = new URL(GOLFJOIN_SHEET_API_ENDPOINT).pathname;
        }
        window.open(target.toString(), "_blank", "noopener");
      } catch (error) {
        golfJoinSafeWarn("Invalid quote page URL.", error);
      }
    }

    function renderJoinMyQuoteButton(item = {}) {
      if (!['created', 'joined'].includes(String(item.scheduleGroup || ""))) return "";
      const quotePageUrl = String(item.quotePageUrl || item.quoteUrl || "").trim();
      if (!quotePageUrl) return "";
      return `<div class="join-my-card-quote-row"><button type="button" class="join-my-card-quote-button" onclick="event.stopPropagation(); openJoinMyQuotePage('${escapeJsString(quotePageUrl)}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>견적서 보기</button></div>`;
    }

    function renderJoinMyAccordionCard(item = {}, headAction = null) {
      const dday = item.hideDday ? "" : formatJoinMyCardDateBadge(item);
      const bottomActions = (item.actions || [])
        .map(getJoinMyActionConfig)
        .filter((action) => action.placement !== "head")
        .filter((action) => !(item.submittedReview && action.action === "review"));
      const locationParts = [escapeHtml(item.countryRegion || item.region || "")];
      const departureAirport = getJoinMyDepartureAirportLabel(item);
      if (departureAirport) {
        locationParts.push(`<i class="join-my-summary-dot" aria-hidden="true"></i>${escapeHtml(departureAirport)}`);
      }
      const tripDuration = getJoinMyTripDuration(item);
      if (tripDuration) {
        locationParts.push(`<i class="join-my-summary-dot join-my-summary-mobile-duration-dot" aria-hidden="true"></i><i class="join-my-summary-mobile-duration">${escapeHtml(formatJoinMyCompactDurationText(tripDuration))}</i>`);
      }
      const locationValue = locationParts.filter(Boolean).join("");
      const periodValue = renderJoinMyPeriodSummaryValue(item);
      const linkedJoin = getJoinMyLinkedJoin(item);
      const summaryImage = item.image || linkedJoin?.image || "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg";
      const summaryBadge = item.region || item.countryRegion || linkedJoin?.region || "";
      const isBrowseCard = Boolean(item.wishOpenTargetKey || item.recentOpenTargetKey);
      const browseCardOnclick = isBrowseCard ? getJoinMyBrowseCardOnclick(item) : "";
      return `
        <article class="join-my-card join-my-card-accordion${isBrowseCard ? " is-browse-card" : ""}"${browseCardOnclick ? ` onclick="${browseCardOnclick}"` : ""}>
          <div class="join-my-card-summary">
            <div class="join-my-card-thumb join-my-card-summary-thumb">
              <img src="${escapeHtml(summaryImage)}" alt="${escapeHtml(item.title || "")}" loading="lazy" decoding="async">
              ${summaryBadge ? `<div class="join-my-card-thumb-badge">${escapeHtml(summaryBadge)}</div>` : ""}
            </div>
            <div class="join-my-card-summary-info">
              <div class="join-my-card-summary-top">
                <div class="join-my-card-status-row">
                  ${dday ? `<div class="join-my-card-dday">${escapeHtml(dday)}</div>` : ""}
                  ${renderJoinMyScheduleBadge(item)}
                </div>
              </div>
              <div class="join-my-card-title">${escapeHtml(item.title)}</div>
              ${renderJoinMySummaryLine("location", locationValue)}
              ${renderJoinMySummaryLine("period", periodValue)}
              ${isBrowseCard ? `<div class="join-my-card-browse-open-row">${renderJoinMyProductButton(item)}</div>` : ""}
            </div>
          <div class="join-my-card-summary-button">
              ${isBrowseCard ? renderJoinMyCardDeleteButton(item) : renderJoinMyProductButton(item)}
            </div>
          </div>
          ${renderJoinMyQuoteButton(item)}
          ${item.hideParticipants ? "" : `<div class="join-my-card-expanded">${renderJoinMyParticipants(item)}</div>`}
          ${item.submittedReview ? renderJoinMySubmittedReviewBox(item.submittedReview) : ""}
          ${bottomActions.length ? `<div class="join-my-card-actions">
            ${bottomActions.map((action) => `<button type="button" class="${escapeHtml(action.variant || "")}" onclick="${getJoinMyActionOnclick(item, action)}">${escapeHtml(action.label)}</button>`).join("")}
          </div>` : ""}
        </article>
      `;
    }

    function toggleJoinMyReservationAccordion(button) {
      const card = button?.closest?.(".join-my-card");
      if (!card) return;
      const isOpening = card.classList.contains("is-accordion-collapsed");
      card.classList.toggle("is-accordion-collapsed", !isOpening);
      button.setAttribute("aria-expanded", String(isOpening));
      button.setAttribute("aria-label", isOpening ? "상세정보 닫기" : "상세정보 열기");
      button.innerHTML = getJoinMyAccordionIcon(isOpening);
    }

    function renderJoinMyCards(items = [], tabKey = "") {
      if (isJoinMyReservationBootstrapLoading(tabKey)) return renderJoinMyLoadingState(tabKey);
      if (!items.length) {
        if (hasJoinMyReservationReadFailed(tabKey)) return renderJoinMyReadFailedState(tabKey);
        return renderJoinMyEmptyState(tabKey);
      }
      return items.map((item) => {
        const headAction = getJoinMyHeadAction(item);
        const dateBadge = item.hideDday ? "" : formatJoinMyCardDateBadge(item);
        const bottomActions = (item.actions || [])
          .map(getJoinMyActionConfig)
          .filter((action) => action.placement !== "head")
          .filter((action) => !(item.submittedReview && action.action === "review"));
        if (headAction?.action === "accordion") {
          return renderJoinMyAccordionCard(item, headAction);
        }
        return `
        <article class="join-my-card${item.hideImage ? " no-image" : ""}${headAction?.action === "accordion" ? " is-accordion-collapsed" : ""}">
          ${item.hideImage ? "" : `<div class="join-my-card-thumb">
            <img src="${escapeHtml(item.image || "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg")}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">
            <div class="join-my-card-thumb-badge">${escapeHtml(item.region || "골프여행")}</div>
          </div>`}
          <div class="join-my-card-content">
            <div class="join-my-card-head">
              <div>
                ${dateBadge ? `<div class="join-my-card-dday">${escapeHtml(dateBadge)}</div>` : ""}
                <div class="join-my-card-title">${escapeHtml(item.title)}</div>
              </div>
              ${headAction?.action === "accordion" ? `<button type="button" class="join-my-card-accordion-button" onclick="${getJoinMyActionOnclick(item, headAction)}" aria-label="상세정보 열기" aria-expanded="false">${getJoinMyAccordionIcon(false)}</button>` : headAction ? `<button type="button" class="join-my-card-detail-button" onclick="${getJoinMyActionOnclick(item, headAction)}">${escapeHtml(headAction.label)}</button>` : `<div class="join-my-status-pill ${escapeHtml(item.statusClass || "")}">${escapeHtml(item.status)}</div>`}
            </div>
            ${renderJoinMyDetailRows(item)}
            ${(item.infos || []).length ? `<div class="join-my-card-info">
              ${(item.infos || []).map(([label, value]) => `
                <div class="join-my-info-chip">
                  <div class="join-my-info-chip-label">${escapeHtml(label)}</div>
                  <div class="join-my-info-chip-value">${escapeHtml(value)}</div>
                </div>
              `).join("")}
            </div>` : ""}
            ${item.submittedReview ? renderJoinMySubmittedReviewBox(item.submittedReview) : ""}
            ${bottomActions.length ? `<div class="join-my-card-actions">
              ${bottomActions.map((action) => {
                return `<button type="button" class="${escapeHtml(action.variant || "")}" onclick="${getJoinMyActionOnclick(item, action)}">${escapeHtml(action.label)}</button>`;
              }).join("")}
            </div>` : ""}
          </div>
        </article>
      `;
      }).join("");
    }

    function refreshJoinMyJoinedParticipantsForDetail(join = {}) {
      const member = getJoinCachedCurrentMember();
      if (!member || isJoinMyCreatedScheduleForMember(join, member)) return join;
      const matchingApplication = Array.from(joinApplicationPayloadMemory.values())
        .map(normalizeJoinApplyPayload)
        .filter((application) => !isCancelledJoinApplyPayload(application))
        .filter((application) => isJoinMyJoinApplicationForMember(application, member))
        .filter((application) => findJoinForJoinApplicationPayload(application) === join)
        .sort((left, right) => String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")))[0];
      if (matchingApplication) {
        applyJoinApplicationPayload(matchingApplication, { remember: false, render: false });
      }
      return join;
    }

    function handleJoinMyReservationProduct(joinId, title = "", hideParticipants = false) {
      const key = String(joinId || "").trim();
      const keyCandidates = new Set([
        key,
        getAdminRecommendedJoinIdFromApplicationId(key)
      ].filter(Boolean));
      const join = joins.find((item) => {
        const itemKeys = [
          item.id,
          item.scheduleId,
          item.sourceApplicationId,
          getNestedValue(item.displayRule || {}, "recommendedScheduleId"),
          getNestedValue(item.displayRule || {}, "displayRuleId")
        ].map((value) => String(value || "").trim()).filter(Boolean);
        return itemKeys.some((itemKey) => keyCandidates.has(itemKey));
      }) || joins.find((item) => {
        const targetTitle = String(title || "").trim();
        const itemTitle = String(item.title || "").trim();
        return targetTitle && itemTitle && (targetTitle.includes(itemTitle) || itemTitle.includes(targetTitle));
      });
      if (!join) {
        alert("연결된 상품을 찾을 수 없습니다.");
        return;
      }
      refreshJoinMyJoinedParticipantsForDetail(join);
      openDetail(join.id, {
        disableEmptySlots: true,
        hideParticipants: Boolean(hideParticipants),
        allowUnavailable: true
      });
      document.getElementById("detailModal")?.classList.add("my-reservation-view-mode");
      setDetailNormalPrimaryAction(join, { ownActiveSchedule: true });
    }

    function ensureJoinMyReviewModal() {
      let overlay = document.getElementById("joinMyReviewModal");
      if (overlay) return portalOverlayToBody("joinMyReviewModal");
      overlay = document.createElement("div");
      overlay.className = "overlay sgj-portal-overlay";
      overlay.id = "joinMyReviewModal";
      overlay.style.setProperty("z-index", "2147483646", "important");
      overlay.setAttribute("onclick", "if(event.target.id === 'joinMyReviewModal') closeJoinMyReviewModal()");
      overlay.innerHTML = `
        <div class="modal join-review-modal" role="dialog" aria-modal="true" aria-labelledby="joinMyReviewTitle">
          <div class="modal-header">
            <button type="button" class="modal-close-icon modal-back-icon" onclick="closeJoinMyReviewModal()" aria-label="뒤로가기">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m12 19-7-7 7-7"></path>
                <path d="M19 12H5"></path>
              </svg>
            </button>
            <div class="modal-title" id="joinMyReviewTitle">후기 작성</div>
            <div class="modal-header-spacer" aria-hidden="true"></div>
          </div>
          <form id="joinMyReviewForm" onsubmit="submitJoinMyReview(event)">
            <div class="join-review-body">
              <div class="join-review-trip">
                <div class="join-review-trip-summary">
                  <div class="join-review-trip-thumb">
                    <img id="joinMyReviewTripImage" src="" alt="" loading="lazy" decoding="async">
                  </div>
                  <div class="join-review-trip-info">
                    <div class="join-review-trip-region" id="joinMyReviewTripRegion"></div>
                    <div class="join-review-trip-title" id="joinMyReviewTripTitle"></div>
                    <div class="join-review-trip-period" id="joinMyReviewTripPeriod"></div>
                  </div>
                </div>
              </div>
              <input type="hidden" id="joinMyReviewJoinId">
              <input type="hidden" id="joinMyReviewRating" value="0">
              <div class="join-review-field">
                <div class="join-review-label">이번 라운드는 어떠셨나요?</div>
                <div class="join-review-stars" role="radiogroup" aria-label="라운드 별점 선택">
                  ${[1, 2, 3, 4, 5].map((rating) => `
                    <button type="button" class="join-review-star" data-review-rating="${rating}" onclick="setJoinMyReviewRating(${rating})" aria-label="${rating}점">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.439 2.999a.626.626 0 0 1 1.122 0l2.51 5.087a.626.626 0 0 0 .472.342l5.614.816a.626.626 0 0 1 .347 1.067l-4.063 3.96a.625.625 0 0 0-.18.554l.96 5.592a.626.626 0 0 1-.908.66l-5.022-2.64a.626.626 0 0 0-.582 0l-5.022 2.64a.626.626 0 0 1-.908-.66l.96-5.592a.626.626 0 0 0-.18-.553l-4.063-3.96a.626.626 0 0 1 .347-1.068l5.614-.816a.626.626 0 0 0 .471-.342L11.44 3Z"></path></svg>
                    </button>
                  `).join("")}
                </div>
              </div>
              <div class="join-review-field">
                <div class="join-review-label">어떤 점이 좋았나요?</div>
                <div class="join-review-field-copy">코스, 숙소, 식사, 동반자, 이동까지 기억에 남는 부분을 골라주세요.</div>
                <div class="join-review-tags" aria-label="좋았던 점 선택">
                  ${["코스가 좋았어요", "숙소가 편했어요", "식사가 만족스러웠어요", "동반자가 좋았어요", "이동이 편했어요", "조인 분위기가 좋았어요"].map((tag) => `<button type="button" class="join-review-tag" onclick="toggleJoinMyReviewTag(this)">${tag}</button>`).join("")}
                </div>
              </div>
              <div class="join-review-field">
                <label class="join-review-label" for="joinMyReviewText">라운드 후기를 들려주세요.</label>
                <div class="join-review-help">20자 이상 작성해주세요.</div>
                <textarea class="join-review-textarea" id="joinMyReviewText" maxlength="1000" placeholder="함께한 일정, 라운딩, 숙소, 이동 등 실제 이용 경험을 남겨주세요."></textarea>
              </div>
              <div class="join-review-field">
                <div class="join-review-label">사진</div>
                <div class="join-review-field-copy">최대 ${REVIEW_IMAGE_MAX_FILES}장까지 첨부할 수 있어요.</div>
                <div class="join-review-photo-head">
                  <div class="join-review-field-copy">최대 ${REVIEW_IMAGE_MAX_FILES}장까지 첨부할 수 있어요.</div>
                  <button type="button" class="join-review-photo-clear" onclick="clearJoinMyReviewPhotoInput()">전체삭제</button>
                </div>
                <input type="file" id="joinMyReviewPhoto" accept="image/*" multiple hidden onchange="handleJoinMyReviewPhotoChange(this)">
                <div class="join-review-photo-list">
                  <button type="button" class="join-review-photo-button" onclick="document.getElementById('joinMyReviewPhoto')?.click()" aria-label="사진 추가">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera-icon lucide-camera" aria-hidden="true"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                    <span id="joinMyReviewPhotoLabel">추가</span>
                  </button>
                  <div class="join-review-photo-preview" id="joinMyReviewPhotoPreview"></div>
                </div>
              </div>
              <div class="join-review-error" id="joinMyReviewError" aria-live="polite"></div>
            </div>
            <div class="join-review-actions">
              <button type="button" onclick="closeJoinMyReviewModal()">취소</button>
              <button type="submit" class="primary">등록</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector(".join-review-modal")?.style.setProperty("z-index", "2147483647", "important");
      return overlay;
    }

    function setJoinMyReviewRating(rating = 0) {
      const numericRating = Number(rating);
      const value = Number.isFinite(numericRating) ? Math.max(0, Math.min(5, numericRating)) : 0;
      const input = document.getElementById("joinMyReviewRating");
      if (input) input.value = String(value);
      document.querySelectorAll("#joinMyReviewModal .join-review-star").forEach((button) => {
        const starValue = Number(button.dataset.reviewRating || 0);
        const active = value > 0 && starValue <= value;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-checked", value > 0 && starValue === value ? "true" : "false");
      });
    }

    function toggleJoinMyReviewTag(button) {
      button?.classList.toggle("is-active");
    }

    function updateJoinMyReviewPhotoLabel(input) {
      const label = document.getElementById("joinMyReviewPhotoLabel");
      if (label) label.textContent = "추가";
    }

    function formatReviewImageSize(bytes = 0) {
      const size = Number(bytes || 0);
      if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
      if (size >= 1024) return `${Math.round(size / 1024)}KB`;
      return `${size}B`;
    }

    function getJoinMyReviewSelectedFiles() {
      return joinMyReviewSelectedPhotoItems.map((item) => item.file).filter(Boolean).slice(0, REVIEW_IMAGE_MAX_FILES);
    }

    function clearJoinMyReviewPhotoInput() {
      const input = document.getElementById("joinMyReviewPhoto");
      if (input) input.value = "";
      joinMyReviewSelectedPhotoItems.forEach((item) => {
        if (!item.existing && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      joinMyReviewSelectedPhotoItems = [];
      const preview = document.getElementById("joinMyReviewPhotoPreview");
      if (preview) preview.innerHTML = "";
      const label = document.getElementById("joinMyReviewPhotoLabel");
      if (label) label.textContent = "추가";
    }

    function removeJoinMyReviewPhoto(index = -1) {
      const itemIndex = Number(index);
      if (!Number.isInteger(itemIndex) || itemIndex < 0) {
        clearJoinMyReviewPhotoInput();
        return;
      }
      const [removed] = joinMyReviewSelectedPhotoItems.splice(itemIndex, 1);
      if (!removed?.existing && removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      const input = document.getElementById("joinMyReviewPhoto");
      if (input) input.value = "";
      renderJoinMyReviewPhotoPreview();
    }

    function getJoinMyReviewExistingPhotoItems(existing = null) {
      const review = existing?.review || existing || {};
      const images = Array.isArray(review.images) ? review.images : [];
      const sourceImages = images.length ? images : (review.imageUrl || review.thumbnailUrl ? [{
        imageUrl: review.imageUrl || review.thumbnailUrl,
        thumbnailUrl: review.thumbnailUrl || review.imageUrl,
        photoName: review.photoName,
        photoSize: review.photoSize,
        photoMimeType: review.photoMimeType,
        objectName: review.objectName || ""
      }] : []);
      return sourceImages.slice(0, REVIEW_IMAGE_MAX_FILES).map((image, index) => ({
        existing: true,
        previewUrl: image.thumbnailUrl || image.imageUrl || "",
        imageUrl: image.imageUrl || image.thumbnailUrl || "",
        thumbnailUrl: image.thumbnailUrl || image.imageUrl || "",
        fileName: image.photoName || review.photoName || `사진 ${index + 1}`,
        size: image.photoSize || review.photoSize || "",
        mimeType: image.photoMimeType || review.photoMimeType || "",
        objectName: image.objectName || "",
        thumbObjectName: image.thumbObjectName || ""
      })).filter((item) => item.previewUrl || item.imageUrl);
    }

    function loadJoinMyReviewExistingPhotos(existing = null) {
      joinMyReviewSelectedPhotoItems = getJoinMyReviewExistingPhotoItems(existing);
      renderJoinMyReviewPhotoPreview();
    }

    function getJoinMyReviewPreservedImageUpload() {
      const existingItems = joinMyReviewSelectedPhotoItems.filter((item) => item.existing && (item.imageUrl || item.previewUrl));
      if (!existingItems.length) return null;
      const images = existingItems.map((item) => ({
        imageUrl: item.imageUrl || item.previewUrl,
        thumbnailUrl: item.thumbnailUrl || item.previewUrl || item.imageUrl,
        photoName: item.fileName || "",
        photoSize: item.size || "",
        photoMimeType: item.mimeType || "",
        objectName: item.objectName || "",
        thumbObjectName: item.thumbObjectName || ""
      }));
      return {
        images,
        imageUrl: images[0]?.imageUrl || "",
        thumbnailUrl: images[0]?.thumbnailUrl || images[0]?.imageUrl || "",
        photoName: images.map((image) => image.photoName).filter(Boolean).join(", "),
        photoSize: images.reduce((sum, image) => sum + (Number(image.photoSize) || 0), 0) || "",
        photoMimeType: images[0]?.photoMimeType || ""
      };
    }

    function mergeJoinReviewImageUploads(existingUpload = null, newUpload = null) {
      const existingImages = Array.isArray(existingUpload?.images) ? existingUpload.images : [];
      const newImages = Array.isArray(newUpload?.images) ? newUpload.images : [];
      const images = [...existingImages, ...newImages].slice(0, REVIEW_IMAGE_MAX_FILES);
      if (!images.length) return null;
      return {
        images,
        imageUrl: images[0]?.imageUrl || "",
        thumbnailUrl: images[0]?.thumbnailUrl || images[0]?.imageUrl || "",
        photoName: images.map((image) => image.photoName).filter(Boolean).join(", "),
        photoSize: images.reduce((sum, image) => sum + (Number(image.photoSize) || 0), 0) || "",
        photoMimeType: images[0]?.photoMimeType || ""
      };
    }

    function renderJoinMyReviewPhotoPreview() {
      const label = document.getElementById("joinMyReviewPhotoLabel");
      if (label) label.textContent = "추가";
      const preview = document.getElementById("joinMyReviewPhotoPreview");
      if (!preview) return;
      preview.innerHTML = joinMyReviewSelectedPhotoItems.map((item, index) => {
        const file = item.file || { name: item.fileName || `사진 ${index + 1}`, size: item.size || 0 };
        const name = file?.name || item.fileName || `사진 ${index + 1}`;
        const size = file?.size || item.size || "";
        const imageUrl = item.previewUrl || item.thumbnailUrl || item.imageUrl || "";
        return `
          <div class="join-review-photo-item">
            <img class="join-review-photo-thumb" src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(file.name)} 미리보기">
            <div class="join-review-photo-name">${escapeHtml(file.name)} ${escapeHtml(formatReviewImageSize(file.size))}</div>
            <button type="button" class="join-review-photo-remove" onclick="removeJoinMyReviewPhoto(${index})" aria-label="사진 삭제"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
          </div>
        `;
      }).join("");
    }

    function handleJoinMyReviewPhotoChange(input) {
      const error = document.getElementById("joinMyReviewError");
      if (error) error.textContent = "";
      const files = Array.from(input?.files || []);
      const invalid = files.find((file) => !/^image\//.test(file.type) || file.size > REVIEW_IMAGE_MAX_ORIGINAL_BYTES);
      if (invalid) {
        if (input) input.value = "";
        if (error) error.textContent = "이미지 파일만 첨부할 수 있고, 원본은 10MB 이하여야 합니다.";
        return;
      }
      const availableCount = Math.max(0, REVIEW_IMAGE_MAX_FILES - joinMyReviewSelectedPhotoItems.length);
      const selected = files.slice(0, availableCount);
      selected.forEach((file) => {
        joinMyReviewSelectedPhotoItems.push({
          file,
          previewUrl: URL.createObjectURL(file)
        });
      });
      if (input) input.value = "";
      renderJoinMyReviewPhotoPreview();
      if (files.length > selected.length && error) {
        error.textContent = `사진은 최대 ${REVIEW_IMAGE_MAX_FILES}장까지 등록됩니다.`;
      }
    }

    function getReviewImageOutputType() {
      const canvas = document.createElement("canvas");
      return canvas.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    }

    function loadReviewImageBitmap(file) {
      if ("createImageBitmap" in window) {
        return createImageBitmap(file, { imageOrientation: "from-image" });
      }
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
      });
    }

    function getReviewResizeRect(width, height, maxSide) {
      const ratio = Math.min(1, maxSide / Math.max(width, height));
      return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio))
      };
    }

    async function resizeJoinReviewImage(file, maxSide, quality = REVIEW_IMAGE_QUALITY) {
      const bitmap = await loadReviewImageBitmap(file);
      const size = getReviewResizeRect(bitmap.width, bitmap.height, maxSide);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      bitmap.close?.();
      const mimeType = getReviewImageOutputType();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
      if (!blob) throw new Error("Image compression failed");
      return {
        blob,
        width: size.width,
        height: size.height,
        mimeType
      };
    }

    function getReviewImageExtension(mimeType = "") {
      return mimeType.includes("webp") ? "webp" : "jpg";
    }

    async function requestJoinReviewUploadUrls({ reviewId, images }) {
      if (!REVIEW_IMAGE_SIGN_ENDPOINT) {
        throw new Error("REVIEW_IMAGE_SIGN_ENDPOINT is not configured");
      }
      const response = await fetch(REVIEW_IMAGE_SIGN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "join_review_images",
          reviewId,
          images: images.map((image) => ({
            role: image.role,
            fileName: image.fileName,
            contentType: image.mimeType,
            size: image.blob.size
          }))
        })
      });
      if (!response.ok) throw new Error(`Upload URL request failed: ${response.status}`);
      const data = await response.json();
      const items = data.items || data.uploads || [];
      if (!items.length) throw new Error("Upload URL response is empty");
      return items;
    }

    function verifyJoinUploadedImagePublicUrl(url = "") {
      const publicUrl = String(url || "").trim();
      if (!publicUrl || typeof Image === "undefined") return Promise.resolve(false);
      return new Promise((resolve) => {
        const image = new Image();
        const timer = setTimeout(() => {
          image.onload = null;
          image.onerror = null;
          resolve(false);
        }, 5000);
        image.onload = () => {
          clearTimeout(timer);
          resolve(true);
        };
        image.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
        image.src = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      });
    }

    async function uploadJoinReviewImageToGcs(upload, image) {
      const publicUrl = upload.publicUrl || upload.imageUrl || upload.downloadUrl || "";
      try {
        const response = await fetch(upload.uploadUrl || upload.signedUrl || upload.url, {
          method: upload.method || "PUT",
          headers: {
            "Content-Type": image.mimeType
          },
          body: image.blob
        });
        if (!response.ok) throw new Error(`Image upload failed: ${response.status}`);
      } catch (error) {
        const looksLikeCorsBlocked = error?.name === "TypeError" || /fetch|cors|network/i.test(String(error?.message || ""));
        if (!looksLikeCorsBlocked || !publicUrl || !(await verifyJoinUploadedImagePublicUrl(publicUrl))) {
          throw error;
        }
        golfJoinSafeWarn("GCS upload response was blocked, but public image URL loaded successfully.", error);
      }
      return {
        ...image,
        imageUrl: publicUrl,
        objectName: upload.objectName || "",
        gcsBucket: upload.bucket || ""
      };
    }

    async function uploadJoinReviewImages(reviewId) {
      const files = getJoinMyReviewSelectedFiles();
      if (!files.length) return { images: [], imageUrl: "", thumbnailUrl: "", photoName: "", photoSize: 0, photoMimeType: "" };
      const compressed = [];
      for (const [index, file] of files.entries()) {
        const main = await resizeJoinReviewImage(file, REVIEW_IMAGE_MAIN_MAX_SIDE);
        const thumb = await resizeJoinReviewImage(file, REVIEW_IMAGE_THUMB_MAX_SIDE);
        const extension = getReviewImageExtension(main.mimeType);
        compressed.push({
          role: `main_${index + 1}`,
          fileName: `${reviewId}_${index + 1}.${extension}`,
          sourceName: file.name,
          ...main
        });
        compressed.push({
          role: `thumb_${index + 1}`,
          fileName: `${reviewId}_${index + 1}_thumb.${extension}`,
          sourceName: file.name,
          ...thumb
        });
      }
      const uploads = await requestJoinReviewUploadUrls({ reviewId, images: compressed });
      const uploaded = [];
      for (const image of compressed) {
        const upload = uploads.find((item) => item.role === image.role || item.fileName === image.fileName);
        if (!upload) throw new Error(`Missing upload URL for ${image.fileName}`);
        uploaded.push(await uploadJoinReviewImageToGcs(upload, image));
      }
      const mainImages = uploaded.filter((image) => image.role.startsWith("main_"));
      const thumbImages = uploaded.filter((image) => image.role.startsWith("thumb_"));
      return {
        images: mainImages.map((image, index) => ({
          imageUrl: image.imageUrl,
          thumbnailUrl: thumbImages[index]?.imageUrl || image.imageUrl,
          photoName: image.sourceName,
          photoSize: image.blob.size,
          photoWidth: image.width,
          photoHeight: image.height,
          photoMimeType: image.mimeType,
          objectName: image.objectName,
          thumbObjectName: thumbImages[index]?.objectName || ""
        })),
        imageUrl: mainImages[0]?.imageUrl || "",
        thumbnailUrl: thumbImages[0]?.imageUrl || mainImages[0]?.imageUrl || "",
        photoName: mainImages.map((image) => image.sourceName).filter(Boolean).join(", "),
        photoSize: mainImages.reduce((sum, image) => sum + image.blob.size, 0),
        photoMimeType: mainImages[0]?.mimeType || ""
      };
    }

    let joinProfileManageSelectedFile = null;
    let joinProfileManageScrollLockY = 0;

    function getJoinProfileInitial(member = {}) {
      const name = String(member.memberName || member.name || "회원").trim();
      return Array.from(name)[0] || "회";
    }

    function getJoinProfileImageDisplayUrl(member = {}) {
      const imageUrl = member.profileThumbnailUrl || member.profileImageUrl || "";
      if (!imageUrl) return "";
      const version = String(member.profileImageUpdatedAt || member.updatedAt || "").trim();
      if (!version || imageUrl.startsWith("blob:") || imageUrl.startsWith("data:")) return imageUrl;
      try {
        const url = new URL(imageUrl, location.href);
        url.searchParams.set("v", version);
        return url.toString();
      } catch (error) {
        const joiner = imageUrl.includes("?") ? "&" : "?";
        return `${imageUrl}${joiner}v=${encodeURIComponent(version)}`;
      }
    }

    function renderJoinProfileImage(target, member = {}) {
      if (!target) return;
      const imageUrl = getJoinProfileImageDisplayUrl(member);
      if (imageUrl) {
        const currentImage = target.querySelector("img");
        if (currentImage?.getAttribute("src") === imageUrl) return;
        target.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="" loading="eager" decoding="async" fetchpriority="high">`;
        return;
      }
      const initial = getJoinProfileInitial(member);
      if (target.textContent === initial && !target.querySelector("img")) return;
      target.textContent = initial;
    }

    function ensureJoinProfileManageModal() {
      let overlay = document.getElementById("joinProfileManageOverlay");
      if (overlay) {
        upgradeJoinProfileManageModalMarkup(overlay);
        return portalOverlayToBody("joinProfileManageOverlay") || overlay;
      }
      overlay = document.createElement("div");
      overlay.id = "joinProfileManageOverlay";
      overlay.className = "join-profile-manage-overlay sgj-portal-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.onclick = (event) => {
        if (event.target.id === "joinProfileManageOverlay") closeJoinProfileManageModal();
      };
      overlay.innerHTML = `
        <div class="join-profile-manage-modal" role="dialog" aria-modal="true" aria-labelledby="joinProfileManageTitle">
          <div class="join-profile-manage-head">
            <div class="join-profile-manage-title" id="joinProfileManageTitle">프로필 관리</div>
            <button type="button" class="join-profile-manage-close" onclick="closeJoinProfileManageModal()" aria-label="닫기">&times;</button>
          </div>
          <form class="join-profile-manage-body" id="joinProfileManageForm" onsubmit="submitJoinProfileManage(event)">
            <div class="join-profile-photo-row">
              <div class="join-profile-photo-preview" id="joinProfileManagePreview"></div>
              <div class="join-profile-photo-actions">
                <label class="join-profile-photo-button" for="joinProfileManagePhoto">사진 변경</label>
                <input type="file" id="joinProfileManagePhoto" accept="image/*" hidden onchange="handleJoinProfilePhotoChange(event)">
                <div class="join-profile-photo-note" id="joinProfileManagePhotoNote">작은 프로필용으로 압축해서 1장만 저장됩니다.</div>
              </div>
            </div>
            <div class="join-profile-manage-grid">
              <label class="join-profile-manage-field">
                <div class="join-profile-manage-label">이름</div>
                <input class="join-profile-manage-input" id="joinProfileManageName" autocomplete="name" required>
              </label>
              <label class="join-profile-manage-field">
                <span class="join-profile-manage-label">휴대폰</span>
                <input class="join-profile-manage-input" id="joinProfileManageMobile" inputmode="tel" autocomplete="tel" maxlength="11" oninput="handleJoinProfileManageMobileInput(this)">
              </label>
              <label class="join-profile-manage-field">
                <span class="join-profile-manage-label">이메일</span>
                <input class="join-profile-manage-input" id="joinProfileManageEmail" type="email" autocomplete="email">
              </label>
              <label class="join-profile-manage-field">
                <span class="join-profile-manage-label">출생년도</span>
                <input class="join-profile-manage-input" id="joinProfileManageBirthYear" inputmode="numeric" maxlength="4" oninput="handleJoinProfileManageBirthYearInput(this)">
              </label>
              <label class="join-profile-manage-field">
                <span class="join-profile-manage-label">성별</span>
                <input class="join-profile-manage-input" id="joinProfileManageGender" readonly>
              </label>
              <label class="join-profile-manage-field">
                <span class="join-profile-manage-label">골프 수준</span>
                <input class="join-profile-manage-input" id="joinProfileManageLevel" readonly>
              </label>
              <label class="join-profile-manage-field is-wide">
                <span class="join-profile-manage-label">직업</span>
                <input class="join-profile-manage-input" id="joinProfileManageProfession">
              </label>
              <label class="join-profile-manage-field is-wide">
                <span class="join-profile-manage-label">선호하는<br>스타일</span>
                <input class="join-profile-manage-input" id="joinProfileManageTravelStyles" placeholder="예: 조용한 일정, 친목, 프리미엄 리조트">
              </label>
            </div>
            <div class="join-profile-manage-actions">
              <button type="button" class="join-profile-manage-cancel" onclick="closeJoinProfileManageModal()">취소</button>
              <button type="submit" class="join-profile-manage-save" id="joinProfileManageSave">저장</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(overlay);
      upgradeJoinProfileManageModalMarkup(overlay);
      return overlay;
    }

    function upgradeJoinProfileManageModalMarkup(overlay) {
      if (!overlay || overlay.dataset.profileManageUpgraded === "true") return;
      overlay.dataset.profileManageUpgraded = "true";
      overlay.innerHTML = `
        <div class="join-profile-manage-modal" role="dialog" aria-modal="true" aria-labelledby="joinProfileManageTitle">
          <div class="modal-header join-profile-manage-head">
            <button type="button" class="modal-close-icon modal-back-icon join-profile-manage-close" onclick="closeJoinProfileManageModal()" aria-label="닫기">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
            </button>
            <div class="modal-title join-profile-manage-title" id="joinProfileManageTitle">프로필 관리</div>
            <span class="modal-header-spacer" aria-hidden="true"></span>
          </div>
          <form class="join-profile-manage-body" id="joinProfileManageForm" onsubmit="submitJoinProfileManage(event)">
            <div class="join-profile-manage-summary">
              <div class="join-profile-photo-wrap">
                <div class="join-profile-photo-preview" id="joinProfileManagePreview"></div>
                <label class="join-profile-photo-button" for="joinProfileManagePhoto" aria-label="사진 변경">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera-icon lucide-camera" aria-hidden="true"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                </label>
                <input type="file" id="joinProfileManagePhoto" accept="image/*" hidden onchange="handleJoinProfilePhotoChange(event)">
              </div>
              <div class="join-profile-summary-name" id="joinProfileManageSummaryName"></div>
              <div class="join-profile-summary-meta" id="joinProfileManageSummaryMeta"></div>
              <div class="join-profile-photo-note" id="joinProfileManagePhotoNote"></div>
            </div>
            <div class="join-profile-info-list">
              <div class="join-profile-info-row">
                <span class="join-profile-manage-label">이름</span>
                <input class="join-profile-manage-input" id="joinProfileManageName" autocomplete="name" required oninput="syncJoinProfileManageSummary()">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageName')">변경</button>
              </div>
              <div class="join-profile-info-row">
                <div class="join-profile-manage-label">휴대폰번호</div>
                <input class="join-profile-manage-input" id="joinProfileManageMobile" inputmode="tel" autocomplete="tel">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageMobile')">변경</button>
              </div>
              <div class="join-profile-info-row">
                <div class="join-profile-manage-label">이메일</div>
                <input class="join-profile-manage-input" id="joinProfileManageEmail" type="email" autocomplete="email">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageEmail')">변경</button>
              </div>
              <div class="join-profile-info-row">
                <div class="join-profile-manage-label">성별</div>
                <input class="join-profile-manage-input" id="joinProfileManageGender" readonly onchange="syncJoinProfileManageSummary()">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageGender')">변경</button>
              </div>
              <div class="join-profile-info-row">
                <div class="join-profile-manage-label">출생년도</div>
                <input class="join-profile-manage-input" id="joinProfileManageBirthYear" inputmode="numeric" maxlength="4" oninput="handleJoinProfileManageBirthYearInput(this)">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageBirthYear')">변경</button>
              </div>
              <div class="join-profile-info-row">
                <div class="join-profile-manage-label">골프 수준</div>
                <input class="join-profile-manage-input" id="joinProfileManageLevel" readonly>
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageLevel')">변경</button>
              </div>
              <div class="join-profile-info-row">
                <div class="join-profile-manage-label">직업</div>
                <input class="join-profile-manage-input" id="joinProfileManageProfession">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageProfession')">변경</button>
              </div>
              <div class="join-profile-info-row is-tall">
                <div class="join-profile-manage-label">선호하는<br>스타일</div>
                <input class="join-profile-manage-input" id="joinProfileManageTravelStyles" placeholder="예: 조용한 일정, 친목, 프리미엄 리조트">
                <button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageTravelStyles')">변경</button>
              </div>
            </div>
            <div class="join-profile-manage-actions">
              <button type="submit" class="join-profile-manage-save" id="joinProfileManageSave">저장</button>
            </div>
          </form>
        </div>
      `;
      overlay.innerHTML = `
        <div class="join-profile-manage-modal" role="dialog" aria-modal="true" aria-labelledby="joinProfileManageTitle">
          <div class="modal-header join-profile-manage-head">
            <button type="button" class="modal-close-icon modal-back-icon join-profile-manage-close" onclick="closeJoinProfileManageModal()" aria-label="">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
            </button>
            <div class="modal-title join-profile-manage-title" id="joinProfileManageTitle"></div>
            <div class="modal-header-spacer" aria-hidden="true"></div>
          </div>
          <form class="join-profile-manage-body" id="joinProfileManageForm" onsubmit="submitJoinProfileManage(event)">
            <div class="join-profile-manage-summary">
              <div class="join-profile-photo-wrap">
                <div class="join-profile-photo-preview" id="joinProfileManagePreview"></div>
                <label class="join-profile-photo-button" for="joinProfileManagePhoto" aria-label="">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-camera-icon lucide-camera" aria-hidden="true"><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                </label>
                <input type="file" id="joinProfileManagePhoto" accept="image/*" hidden onchange="handleJoinProfilePhotoChange(event)">
              </div>
              <div class="join-profile-summary-name" id="joinProfileManageSummaryName"></div>
              <div class="join-profile-summary-meta" id="joinProfileManageSummaryMeta"></div>
              <div class="join-profile-photo-note" id="joinProfileManagePhotoNote"></div>
            </div>
            <div class="join-profile-info-list">
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageName" autocomplete="name" required oninput="syncJoinProfileManageSummary()"></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageName')"></button></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageMobile" inputmode="tel" autocomplete="tel" maxlength="11" oninput="handleJoinProfileManageMobileInput(this)"><div class="join-profile-info-error" id="joinProfileManageMobileError"></div></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageMobile')"></button></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageEmail" type="email" autocomplete="email" oninput="setJoinProfileManageFieldError('joinProfileManageEmail', '')"><div class="join-profile-info-error" id="joinProfileManageEmailError"></div></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageEmail')"></button></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><div class="join-profile-gender-control"><input class="join-profile-manage-input" id="joinProfileManageGender" readonly onchange="syncJoinProfileManageSummary()"><div class="join-profile-gender-radios" role="radiogroup"><div class="join-profile-gender-option" role="radio" tabindex="0" data-gender-value="\uB0A8\uC131" onclick="selectJoinProfileManageGender(this.dataset.genderValue)" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault(); selectJoinProfileManageGender(this.dataset.genderValue)}"><input type="radio" name="joinProfileManageGenderRadio" value="\uB0A8\uC131" tabindex="-1" onchange="selectJoinProfileManageGender(this.value)"><div class="join-profile-gender-option-text" data-gender-label="male"></div></div><div class="join-profile-gender-option" role="radio" tabindex="0" data-gender-value="\uC5EC\uC131" onclick="selectJoinProfileManageGender(this.dataset.genderValue)" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault(); selectJoinProfileManageGender(this.dataset.genderValue)}"><input type="radio" name="joinProfileManageGenderRadio" value="\uC5EC\uC131" tabindex="-1" onchange="selectJoinProfileManageGender(this.value)"><div class="join-profile-gender-option-text" data-gender-label="female"></div></div></div></div></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageGender')"></button></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageBirthYear" inputmode="numeric" maxlength="4" oninput="handleJoinProfileManageBirthYearInput(this)"></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageBirthYear')"></button></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageLevel" readonly></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageLevel')"></button><div class="join-profile-inline-picker" id="joinProfileManageLevelPicker"></div></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageProfession" oninput="syncJoinProfileManagePickerActiveStates()"></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageProfession')"></button><div class="join-profile-inline-picker" id="joinProfileManageProfessionPicker"></div></div>
              <div class="join-profile-info-row"><div class="join-profile-info-main"><div class="join-profile-manage-label"></div><input class="join-profile-manage-input" id="joinProfileManageTravelStyles"></div><button type="button" class="join-profile-info-change" onclick="focusJoinProfileManageField('joinProfileManageTravelStyles')"></button><div class="join-profile-inline-picker" id="joinProfileManageTravelStylesPicker"></div></div>
            </div>
            <div class="join-profile-manage-actions">
              <button type="submit" class="join-profile-manage-save" id="joinProfileManageSave"></button>
            </div>
          </form>
        </div>
      `;
      localizeJoinProfileManageModal(overlay);
    }

    function localizeJoinProfileManageModal(overlay) {
      overlay.querySelectorAll("span.join-profile-manage-label, span.modal-header-spacer").forEach((span) => {
        const div = document.createElement("div");
        Array.from(span.attributes).forEach((attribute) => {
          div.setAttribute(attribute.name, attribute.value);
        });
        div.innerHTML = span.innerHTML;
        span.replaceWith(div);
      });
      const setText = (selector, text) => {
        const node = overlay.querySelector(selector);
        if (node) node.textContent = text;
      };
      const setHtml = (selector, html) => {
        const node = overlay.querySelector(selector);
        if (node) node.innerHTML = html;
      };
      const setAttr = (selector, name, value) => {
        const node = overlay.querySelector(selector);
        if (node) node.setAttribute(name, value);
      };
      setText("#joinProfileManageTitle", "\uD504\uB85C\uD544 \uAD00\uB9AC");
      setAttr(".join-profile-manage-close", "aria-label", "\uB2EB\uAE30");
      setAttr(".join-profile-photo-button", "aria-label", "\uC0AC\uC9C4 \uBCC0\uACBD");
      setText(".join-profile-info-row:nth-child(1) .join-profile-manage-label", "\uC774\uB984");
      setText(".join-profile-info-row:nth-child(2) .join-profile-manage-label", "\uD734\uB300\uD3F0\uBC88\uD638");
      setText(".join-profile-info-row:nth-child(3) .join-profile-manage-label", "\uC774\uBA54\uC77C");
      setText(".join-profile-info-row:nth-child(4) .join-profile-manage-label", "\uC131\uBCC4");
      setText(".join-profile-info-row:nth-child(5) .join-profile-manage-label", "\uCD9C\uC0DD\uB144\uB3C4");
      setText(".join-profile-info-row:nth-child(6) .join-profile-manage-label", "\uD578\uB514");
      setText(".join-profile-info-row:nth-child(7) .join-profile-manage-label", "\uC9C1\uC5C5");
      setHtml(".join-profile-info-row:nth-child(8) .join-profile-manage-label", "\uC120\uD638\uD558\uB294<br>\uC2A4\uD0C0\uC77C");
      const changeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen-icon lucide-square-pen" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>';
      overlay.querySelectorAll(".join-profile-info-change").forEach((button) => {
        button.innerHTML = changeIcon;
        button.setAttribute("aria-label", "\uBCC0\uACBD");
        button.setAttribute("title", "\uBCC0\uACBD");
      });
      const nameChangeButton = overlay.querySelector(".join-profile-info-row:nth-child(1) .join-profile-info-change");
      if (nameChangeButton) {
        nameChangeButton.setAttribute("disabled", "disabled");
        nameChangeButton.hidden = true;
        nameChangeButton.style.display = "none";
        nameChangeButton.setAttribute("aria-label", "\uC774\uB984\uC740 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
        nameChangeButton.setAttribute("title", "\uC774\uB984\uC740 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");
      }
      setText("#joinProfileManageSave", "\uC800\uC7A5");
      const gender = overlay.querySelector("#joinProfileManageGender");
      if (gender) {
        gender.placeholder = "\uC120\uD0DD";
      }
      setText('[data-gender-label="male"]', "\uB0A8\uC131");
      setText('[data-gender-label="female"]', "\uC5EC\uC131");
      const level = overlay.querySelector("#joinProfileManageLevel");
      if (level) {
        level.placeholder = "\uC120\uD0DD";
      }
      const styles = overlay.querySelector("#joinProfileManageTravelStyles");
      if (styles) styles.placeholder = "\uC608: \uC870\uC6A9\uD55C \uC77C\uC815, \uCE5C\uBAA9, \uD504\uB9AC\uBBF8\uC5C4 \uB9AC\uC870\uD2B8";
      renderJoinProfileManagePickers();
    }

    function setJoinProfileManageStatus(message = "") {
      const target = document.getElementById("joinProfileManageStatus");
      if (target) target.textContent = message;
      const saveButton = document.getElementById("joinProfileManageSave");
      if (!target && saveButton) {
        if (message) {
          saveButton.setAttribute("title", message);
          saveButton.setAttribute("aria-label", message);
        } else {
          saveButton.removeAttribute("title");
          saveButton.setAttribute("aria-label", "\uC800\uC7A5");
        }
      }
    }

    function renderJoinProfileBirthYearOptions() {
      const currentYear = new Date().getFullYear();
      const startYear = Math.max(1900, currentYear - 100);
      const endYear = Math.max(startYear, currentYear - 18);
      const options = ['<option value="">선택</option>'];
      for (let year = endYear; year >= startYear; year -= 1) {
        options.push(`<option value="${year}">${year}</option>`);
      }
      return options.join("");
    }

    function completeJoinProfileManageField(field) {
      if (!field) return;
      if (!validateJoinProfileManageContactField(field)) return;
      closeJoinProfileManagePicker(field);
      field.blur?.();
    }

    function handleJoinProfileManageMobileInput(input) {
      if (!input) return;
      const digits = String(input.value || "").replace(/\D/g, "").slice(0, 11);
      if (input.value !== digits) input.value = digits;
      setJoinProfileManageFieldError(input.id, "");
      if (digits.length === 11) {
        setTimeout(() => completeJoinProfileManageField(input), 0);
      }
    }

    function setJoinProfileManageFieldError(fieldId, message = "") {
      const field = document.getElementById(fieldId);
      const row = field?.closest(".join-profile-info-row");
      const error = document.getElementById(`${fieldId}Error`);
      if (!field || !row || !error) return;
      row.classList.toggle("is-invalid", Boolean(message));
      error.textContent = message;
    }

    function clearJoinProfileManageFieldErrors() {
      setJoinProfileManageFieldError("joinProfileManageMobile", "");
      setJoinProfileManageFieldError("joinProfileManageEmail", "");
    }

    function handleJoinProfileManageBirthYearChange(select) {
      syncJoinProfileManageSummary();
      if (select?.value) {
        setTimeout(() => completeJoinProfileManageField(select), 0);
      }
    }

    function handleJoinProfileManageBirthYearInput(input) {
      if (!input) return;
      const digits = String(input.value || "").replace(/\D/g, "").slice(0, 4);
      if (input.value !== digits) input.value = digits;
      syncJoinProfileManageSummary();
      if (digits.length === 4) {
        setTimeout(() => completeJoinProfileManageField(input), 0);
      }
    }

    function getJoinProfileManageAgeBandFromInput() {
      const birthYear = String(document.getElementById("joinProfileManageBirthYear")?.value || "").trim();
      if (!/^\d{4}$/.test(birthYear)) return "";
      const age = new Date().getFullYear() - Number(birthYear) + 1;
      if (!Number.isFinite(age) || age < 1) return "";
      return `${Math.floor(age / 10) * 10}대`;
    }

    function syncJoinProfileManageSummary() {
      const name = String(document.getElementById("joinProfileManageName")?.value || "").trim();
      const gender = String(document.getElementById("joinProfileManageGender")?.value || "").trim();
      const ageBand = getJoinProfileManageAgeBandFromInput();
      const nameTarget = document.getElementById("joinProfileManageSummaryName");
      const metaTarget = document.getElementById("joinProfileManageSummaryMeta");
      if (nameTarget) nameTarget.textContent = name || "회원";
      if (metaTarget) metaTarget.textContent = [gender, ageBand].filter(Boolean).join(", ") || "성별, 연령대";
      if (nameTarget && !name) nameTarget.textContent = "\uD68C\uC6D0";
      if (metaTarget && !gender && !ageBand) metaTarget.textContent = "\uC131\uBCC4, \uC5F0\uB839\uB300";
    }

    function syncJoinProfileManageGenderRadios() {
      const value = document.getElementById("joinProfileManageGender")?.value || "";
      document.querySelectorAll('input[name="joinProfileManageGenderRadio"]').forEach((radio) => {
        const checked = radio.value === value;
        const option = radio.closest(".join-profile-gender-option");
        radio.checked = checked;
        option?.classList.toggle("is-selected", checked);
        option?.setAttribute("aria-checked", checked ? "true" : "false");
      });
    }

    function selectJoinProfileManageGender(value = "") {
      const select = document.getElementById("joinProfileManageGender");
      if (select) select.value = value;
      syncJoinProfileManageGenderRadios();
      syncJoinProfileManageSummary();
    }

    const JOIN_PROFILE_MANAGE_LEVEL_OPTIONS = [
      ["\uC785\uBB38\u00B7\uCD08\uBCF4\uC785\uB2C8\uB2E4", "&#x1F331; \uC785\uBB38\u00B7\uCD08\uBCF4\uC785\uB2C8\uB2E4"],
      ["\uBCF4\uAE30 \uD50C\uB808\uC774\uC5B4", "&#x1F642; \uBCF4\uAE30 \uD50C\uB808\uC774\uC5B4"],
      ["90\uB300 \uC815\uB3C4\uC785\uB2C8\uB2E4", "&#x1F3CC;&#xFE0F; 90\uB300 \uC815\uB3C4\uC785\uB2C8\uB2E4"],
      ["80\uB300 \uC815\uB3C4\uC785\uB2C8\uB2E4", "&#x26F3; 80\uB300 \uC815\uB3C4\uC785\uB2C8\uB2E4"],
      ["\uC2F1\uAE00 \uC218\uC900\uC785\uB2C8\uB2E4", "&#x1F3C6; \uC2F1\uAE00 \uC218\uC900\uC785\uB2C8\uB2E4"],
      ["\uACE8\uD504 \uD504\uB85C\uC785\uB2C8\uB2E4", "&#x1F393; \uACE8\uD504 \uD504\uB85C\uC785\uB2C8\uB2E4"]
    ];

    const JOIN_PROFILE_MANAGE_PROFESSION_OPTIONS = [
      ["\uACBD\uC601", "&#x1F4CA; \uACBD\uC601"],
      ["\uC0AC\uC5C5", "&#x1F4BC; \uC0AC\uC5C5"],
      ["\uBD80\uB3D9\uC0B0", "&#x1F3E0; \uBD80\uB3D9\uC0B0"],
      ["\uAC74\uC124", "&#x1F3D7;&#xFE0F; \uAC74\uC124"],
      ["\uAE08\uC735", "&#x1F3E6; \uAE08\uC735"],
      ["\uBCF4\uD5D8", "&#x1F6E1;&#xFE0F; \uBCF4\uD5D8"],
      ["\uC138\uBB34", "&#x1F9FE; \uC138\uBB34"],
      ["\uBC95\uB960", "&#x2696;&#xFE0F; \uBC95\uB960"],
      ["\uC758\uB8CC", "&#x2695;&#xFE0F; \uC758\uB8CC"],
      ["\uC81C\uC870", "&#x1F3ED; \uC81C\uC870"],
      ["\uC720\uD1B5", "&#x1F4E6; \uC720\uD1B5"],
      ["\uBB34\uC5ED", "&#x1F30F; \uBB34\uC5ED"],
      ["\uC601\uC5C5", "&#x1F91D; \uC601\uC5C5"],
      ["\uAD50\uC721", "&#x1F393; \uAD50\uC721"],
      ["\uACF5\uACF5", "&#x1F3DB;&#xFE0F; \uACF5\uACF5"]
    ];

    const JOIN_PROFILE_MANAGE_STYLE_OPTIONS = [
      ["\uC790\uC720\uB85C\uC6B4", "\uC790\uC720\uB85C\uC6B4 &#x1F343;"],
      ["\uCE5C\uBAA9\uC911\uC2EC", "\uCE5C\uBAA9\uC911\uC2EC &#x1F91D;"],
      ["\uC2E4\uB825\uD5A5\uC0C1", "\uC2E4\uB825\uD5A5\uC0C1 &#x1F4C8;"],
      ["\uB9DB\uC9D1\uAD00\uAD11", "\uB9DB\uC9D1\uAD00\uAD11 &#x1F37D;&#xFE0F;"],
      ["\uBA85\uB791\uACE8\uD504", "\uBA85\uB791\uACE8\uD504 &#x1F60A;"],
      ["\uBE44\uC988\uB2C8\uC2A4", "\uBE44\uC988\uB2C8\uC2A4 &#x1F4BC;"]
    ];

    function renderJoinProfileManagePickers() {
      const levelPicker = document.getElementById("joinProfileManageLevelPicker");
      if (levelPicker) {
        levelPicker.innerHTML = `<div class="apply-chip-group join-profile-level-picker" data-chip-group="join-profile-level">${JOIN_PROFILE_MANAGE_LEVEL_OPTIONS.map(([value, label]) => `<button type="button" class="apply-chip" data-value="${escapeHtml(value)}" onclick="selectJoinProfileManagePickerValue('joinProfileManageLevel', '${escapeJsString(value)}')">${label}</button>`).join("")}</div>`;
      }
      const professionPicker = document.getElementById("joinProfileManageProfessionPicker");
      if (professionPicker) {
        professionPicker.innerHTML = `
          <div class="join-profile-picker-help">직업은 최대 3개까지 선택할 수 있어요.</div>
          <div class="profession-chip-row join-profile-profession-picker">${JOIN_PROFILE_MANAGE_PROFESSION_OPTIONS.map(([value, label]) => `<button type="button" class="profession-chip" data-value="${escapeHtml(value)}" onclick="toggleJoinProfileManageProfession('${escapeJsString(value)}')">${label}</button>`).join("")}<div class="profession-chip join-profile-custom-profession" role="button" tabindex="0" onclick="handleJoinProfileCustomProfessionClick(event, this)" onkeydown="handleJoinProfileCustomProfessionKeydown(event, this)">${joinProfileCustomProfessionDefaultHtml()}</div></div>
          <button type="button" class="join-profile-picker-done" onclick="closeJoinProfileManagePicker(document.getElementById('joinProfileManageProfession'))">선택 완료</button>
        `;
        renderJoinProfileCustomProfession(getJoinProfileCustomProfessionValue());
      }
      const stylePicker = document.getElementById("joinProfileManageTravelStylesPicker");
      if (stylePicker) {
        stylePicker.innerHTML = `<div class="apply-chip-group join-profile-style-picker" data-chip-group="join-profile-travel-style">${JOIN_PROFILE_MANAGE_STYLE_OPTIONS.map(([value, label]) => `<button type="button" class="apply-chip" data-value="${escapeHtml(value)}" onclick="selectJoinProfileManagePickerValue('joinProfileManageTravelStyles', '${escapeJsString(value)}')">${label}</button>`).join("")}</div>`;
      }
      syncJoinProfileManagePickerActiveStates();
    }

    function getJoinProfileManageSelectedProfessionValues() {
      return String(document.getElementById("joinProfileManageProfession")?.value || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3);
    }

    function syncJoinProfileManagePickerActiveStates() {
      const map = {
        joinProfileManageLevel: document.getElementById("joinProfileManageLevel")?.value || "",
        joinProfileManageTravelStyles: document.getElementById("joinProfileManageTravelStyles")?.value || ""
      };
      Object.entries(map).forEach(([id, value]) => {
        document.getElementById(`${id}Picker`)?.querySelectorAll("[data-value]").forEach((chip) => {
          chip.classList.toggle("active", chip.dataset.value === value);
        });
      });
      const selectedProfessions = new Set(getJoinProfileManageSelectedProfessionValues());
      document.getElementById("joinProfileManageProfessionPicker")?.querySelectorAll("[data-value]").forEach((chip) => {
        chip.classList.toggle("active", selectedProfessions.has(chip.dataset.value));
      });
      const customChip = document.querySelector("#joinProfileManageProfessionPicker .join-profile-custom-profession");
      if (customChip) {
        const syncedCustomValue = getJoinProfileCustomProfessionValue();
        if (!customChip.classList.contains("is-editing") && customChip.dataset.value !== syncedCustomValue) {
          renderJoinProfileCustomProfession(syncedCustomValue);
        }
        const customValue = customChip.dataset.value || "";
        const active = Boolean(customValue) && selectedProfessions.has(customValue);
        const disabled = selectedProfessions.size >= 3 && !active;
        customChip.classList.toggle("active", active);
        customChip.classList.toggle("is-disabled", disabled);
        customChip.setAttribute("aria-disabled", disabled ? "true" : "false");
        customChip.tabIndex = disabled ? -1 : 0;
      }
    }

    function closeJoinProfileManagePicker(field) {
      field?.closest(".join-profile-info-row")?.classList.remove("is-picker-open", "is-editing");
      if (field?.tagName === "SELECT") {
        field.setAttribute("disabled", "disabled");
      } else {
        field?.setAttribute("readonly", "readonly");
      }
    }

    function selectJoinProfileManagePickerValue(id, value = "") {
      const field = document.getElementById(id);
      if (!field) return;
      field.value = value;
      syncJoinProfileManagePickerActiveStates();
      closeJoinProfileManagePicker(field);
    }

    function toggleJoinProfileManageProfession(value = "") {
      const field = document.getElementById("joinProfileManageProfession");
      if (!field) return;
      const selected = getJoinProfileManageSelectedProfessionValues();
      const nextValue = String(value || "").trim();
      if (!nextValue) return;
      const existingIndex = selected.indexOf(nextValue);
      if (existingIndex >= 0) {
        selected.splice(existingIndex, 1);
      } else if (selected.length < 3) {
        selected.push(nextValue);
      }
      field.value = selected.join(", ");
      syncJoinProfileManagePickerActiveStates();
      if (selected.length >= 3) {
        setTimeout(() => closeJoinProfileManagePicker(field), 120);
      }
    }

    function joinProfileCustomProfessionDefaultHtml() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg> 직접입력`;
    }

    function joinProfileCustomProfessionEditHtml() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen-icon lucide-square-pen" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>`;
    }

    function getJoinProfileCustomProfessionValue() {
      const selected = getJoinProfileManageSelectedProfessionValues();
      const predefined = new Set(JOIN_PROFILE_MANAGE_PROFESSION_OPTIONS.map(([value]) => value));
      return selected.find((value) => !predefined.has(value)) || "";
    }

    function renderJoinProfileCustomProfession(value = "") {
      const chip = document.querySelector("#joinProfileManageProfessionPicker .join-profile-custom-profession");
      if (!chip) return;
      const normalized = String(value || "").trim().slice(0, 20);
      if (!normalized) {
        delete chip.dataset.value;
        chip.classList.remove("has-value", "active");
        chip.innerHTML = joinProfileCustomProfessionDefaultHtml();
        return;
      }
      chip.dataset.value = normalized;
      chip.classList.add("has-value");
      chip.innerHTML = `<span class="join-profile-custom-profession-text">${escapeHtml(normalized)}</span><span class="join-profile-custom-profession-edit" role="button" tabindex="0" aria-label="직업 수정" onclick="event.stopPropagation(); startJoinProfileCustomProfessionInput(this.closest('.join-profile-custom-profession'), true)" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault(); event.stopPropagation(); startJoinProfileCustomProfessionInput(this.closest('.join-profile-custom-profession'), true)}">${joinProfileCustomProfessionEditHtml()}</span>`;
    }

    function addJoinProfileCustomProfession(value, previousValue = "") {
      const normalized = String(value || "").trim().slice(0, 20);
      if (!normalized) return false;
      const current = getJoinProfileManageSelectedProfessionValues().filter((item) => item !== previousValue && item !== normalized);
      if (current.length >= 3) {
        renderJoinProfileCustomProfession(previousValue);
        syncJoinProfileManagePickerActiveStates();
        return false;
      }
      const field = document.getElementById("joinProfileManageProfession");
      if (!field) return false;
      field.value = [...current, normalized].slice(0, 3).join(", ");
      renderJoinProfileCustomProfession(normalized);
      syncJoinProfileManagePickerActiveStates();
      return true;
    }

    function handleJoinProfileCustomProfessionClick(event, chip) {
      event?.preventDefault?.();
      if (chip?.classList.contains("is-disabled") || chip?.getAttribute("aria-disabled") === "true") return;
      const value = chip?.dataset.value || "";
      if (!value) {
        startJoinProfileCustomProfessionInput(chip);
        return;
      }
      toggleJoinProfileManageProfession(value);
    }

    function handleJoinProfileCustomProfessionKeydown(event, chip) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleJoinProfileCustomProfessionClick(event, chip);
    }

    function scrollJoinProfileCustomProfessionInputIntoView(input) {
      if (!input) return;
      if (typeof scheduleJoinMobileVisualViewportVarsUpdate === "function") {
        scheduleJoinMobileVisualViewportVarsUpdate({ settle: true });
      }
      const scrollBox = input.closest(".join-profile-manage-body");
      const inputRect = input.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportHeight = viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
      const keyboardSafeBottom = viewportTop + viewportHeight - 96;
      const keyboardSafeTop = viewportTop + 72;
      if (scrollBox) {
        if (inputRect.bottom > keyboardSafeBottom) {
          scrollBox.scrollTop += inputRect.bottom - keyboardSafeBottom;
        } else if (inputRect.top < keyboardSafeTop) {
          scrollBox.scrollTop -= keyboardSafeTop - inputRect.top;
        }
      }
      input.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }

    function startJoinProfileCustomProfessionInput(button, edit = false) {
      const row = button?.closest(".join-profile-profession-picker");
      if (!row || row.querySelector(".join-profile-custom-profession-input")) return;
      const previousValue = button.dataset.value || "";
      button.classList.add("is-editing");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "join-profile-custom-profession-input";
      input.maxLength = 20;
      input.placeholder = "직접입력";
      input.value = edit ? previousValue : "";
      input.setAttribute("aria-label", "직업 직접입력");
      let finished = false;
      const finish = (commit = true) => {
        if (finished) return;
        finished = true;
        const value = input.value.trim();
        if (commit && value) {
          addJoinProfileCustomProfession(value, previousValue);
        } else {
          renderJoinProfileCustomProfession(previousValue);
          syncJoinProfileManagePickerActiveStates();
        }
        input.remove();
        button.classList.remove("is-editing");
      };
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      });
      input.addEventListener("blur", () => finish(true));
      row.insertBefore(input, button);
      input.focus({ preventScroll: true });
      input.select();
      scrollJoinProfileCustomProfessionInputIntoView(input);
      requestAnimationFrame(() => {
        if (document.activeElement !== input) input.focus({ preventScroll: true });
        scrollJoinProfileCustomProfessionInputIntoView(input);
      });
      setTimeout(() => scrollJoinProfileCustomProfessionInputIntoView(input), 180);
      setTimeout(() => scrollJoinProfileCustomProfessionInputIntoView(input), 360);
    }

    function normalizeJoinProfileManageLevelValue(value = "") {
      const text = String(value || "").trim();
      if (!text) return "";
      if (JOIN_PROFILE_MANAGE_LEVEL_OPTIONS.some(([option]) => option === text)) return text;
      const compact = text.replace(/\s+/g, "");
      if (compact.includes("\uC785\uBB38") || compact.includes("\uCD08\uBCF4")) return "\uC785\uBB38\u00B7\uCD08\uBCF4\uC785\uB2C8\uB2E4";
      if (compact.includes("\uBCF4\uAE30")) return "\uBCF4\uAE30 \uD50C\uB808\uC774\uC5B4";
      if (compact.includes("90")) return "90\uB300 \uC815\uB3C4\uC785\uB2C8\uB2E4";
      if (compact.includes("80")) return "80\uB300 \uC815\uB3C4\uC785\uB2C8\uB2E4";
      if (compact.includes("\uC2F1\uAE00")) return "\uC2F1\uAE00 \uC218\uC900\uC785\uB2C8\uB2E4";
      if (compact.includes("\uD504\uB85C")) return "\uACE8\uD504 \uD504\uB85C\uC785\uB2C8\uB2E4";
      return text;
    }

    function getJoinProfileManageEditableFields() {
      return Array.from(document.querySelectorAll(
        "#joinProfileManageForm .join-profile-manage-input, #joinProfileManageForm .join-profile-manage-select, #joinProfileManageForm .join-profile-manage-textarea"
      ));
    }

    function hasJoinProfileManageEditingField() {
      return Boolean(document.querySelector("#joinProfileManageForm .join-profile-info-row.is-editing"));
    }

    function lockJoinProfileManageFields() {
      getJoinProfileManageEditableFields().forEach((field) => {
        field.closest(".join-profile-info-row")?.classList.remove("is-editing", "is-picker-open");
        field.style.cursor = "";
        if (field.tagName === "SELECT") {
          field.setAttribute("disabled", "disabled");
        } else {
          field.setAttribute("readonly", "readonly");
        }
      });
      document.querySelectorAll('input[name="joinProfileManageGenderRadio"]').forEach((radio) => {
        radio.setAttribute("disabled", "disabled");
      });
    }

    function lockJoinProfileManageField(field) {
      if (!field) return;
      field.closest(".join-profile-info-row")?.classList.remove("is-editing", "is-picker-open");
      field.style.cursor = "";
      field.blur?.();
      if (field.tagName === "SELECT") {
        field.setAttribute("disabled", "disabled");
      } else {
        field.setAttribute("readonly", "readonly");
      }
      if (field.id === "joinProfileManageGender") {
        document.querySelectorAll('input[name="joinProfileManageGenderRadio"]').forEach((radio) => {
          radio.setAttribute("disabled", "disabled");
        });
      }
    }

    function lockInactiveJoinProfileManageFields(activeRow = null) {
      document.querySelectorAll("#joinProfileManageForm .join-profile-info-row.is-editing").forEach((row) => {
        if (activeRow && row === activeRow) return;
        const field = row.querySelector(".join-profile-manage-input, .join-profile-manage-select, .join-profile-manage-textarea");
        lockJoinProfileManageField(field);
      });
    }

    function validateJoinProfileManageContactField(field, options = {}) {
      if (!field || !["joinProfileManageMobile", "joinProfileManageEmail"].includes(field.id)) return true;
      const shouldFocus = options.focus !== false;
      let message = "";
      if (field.id === "joinProfileManageMobile") {
        const mobile = normalizeJoinMemberPhone(field.value || "");
        field.value = mobile.slice(0, 11);
        if (!/^01\d{9}$/.test(field.value)) {
          message = "\uD734\uB300\uD3F0 \uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.";
        }
      }
      if (field.id === "joinProfileManageEmail") {
        const email = String(field.value || "").trim();
        field.value = email;
        if (email && !isValidJoinMemberEmail(email)) {
          message = "\uC815\uC0C1\uC801\uC778 \uC774\uBA54\uC77C\uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.";
        }
      }
      if (!message) {
        setJoinProfileManageFieldError(field.id, "");
        setJoinProfileManageStatus("");
        return true;
      }
      setJoinProfileManageFieldError(field.id, message);
      setJoinProfileManageStatus(message);
      const row = field.closest(".join-profile-info-row");
      row?.classList.add("is-editing");
      field.removeAttribute("readonly");
      field.removeAttribute("disabled");
      if (shouldFocus) {
        setTimeout(() => {
          field.focus({ preventScroll: true });
          field.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 0);
      }
      return false;
    }

    function validateJoinProfileManageContactFieldsBeforeExit(activeRow = null) {
      const fields = Array.from(document.querySelectorAll(
        "#joinProfileManageForm .join-profile-info-row.is-editing #joinProfileManageMobile, #joinProfileManageForm .join-profile-info-row.is-editing #joinProfileManageEmail"
      ));
      for (const field of fields) {
        if (activeRow && field.closest(".join-profile-info-row") === activeRow) continue;
        if (!validateJoinProfileManageContactField(field)) return false;
      }
      return true;
    }

    function unlockJoinProfileManageField(field) {
      if (!field) return;
      if (field.id === "joinProfileManageName") {
        field.setAttribute("readonly", "readonly");
        field.closest(".join-profile-info-row")?.classList.remove("is-editing", "is-picker-open");
        setJoinProfileManageStatus("\uC774\uB984\uC740 \uD68C\uC6D0 \uBCF8\uC778\uD655\uC778 \uC815\uBCF4\uB85C \uC218\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
        return false;
      }
      const row = field.closest(".join-profile-info-row");
      if (!validateJoinProfileManageContactFieldsBeforeExit(row)) return false;
      lockInactiveJoinProfileManageFields(row);
      if (["joinProfileManageLevel", "joinProfileManageProfession", "joinProfileManageTravelStyles"].includes(field.id)) {
        document.querySelectorAll("#joinProfileManageForm .join-profile-info-row.is-picker-open").forEach((row) => {
          if (row !== field.closest(".join-profile-info-row")) row.classList.remove("is-picker-open", "is-editing");
        });
        row?.classList.add("is-editing", "is-picker-open");
        field.setAttribute("readonly", "readonly");
        field.style.cursor = "";
        syncJoinProfileManagePickerActiveStates();
        return true;
      }
      row?.classList.add("is-editing");
      field.removeAttribute("readonly");
      field.removeAttribute("disabled");
      if (field.tagName === "SELECT") field.style.cursor = "pointer";
      if (field.id === "joinProfileManageGender") {
        document.querySelectorAll('input[name="joinProfileManageGenderRadio"]').forEach((radio) => {
          radio.removeAttribute("disabled");
        });
        syncJoinProfileManageGenderRadios();
      }
      return true;
    }

    function focusJoinProfileManageField(id) {
      const field = document.getElementById(id);
      if (!field) return;
      if (!unlockJoinProfileManageField(field)) return;
      if (["joinProfileManageLevel", "joinProfileManageProfession", "joinProfileManageTravelStyles"].includes(id)) {
        field.closest(".join-profile-info-row")?.scrollIntoView({ block: "center", behavior: "smooth" });
        field.closest(".join-profile-info-row")?.querySelector(".join-profile-inline-picker button, .join-profile-inline-picker [role='button']")?.focus({ preventScroll: true });
        return;
      }
      if (id === "joinProfileManageGender") {
        const activeRadio = document.querySelector('input[name="joinProfileManageGenderRadio"]:checked')
          || document.querySelector('input[name="joinProfileManageGenderRadio"]');
        (activeRadio?.closest(".join-profile-gender-option") || activeRadio)?.focus({ preventScroll: true });
        field.closest(".join-profile-info-row")?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      field.focus({ preventScroll: true });
      field.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    document.addEventListener("pointerdown", (event) => {
      const form = document.getElementById("joinProfileManageForm");
      if (!form) return;
      const isSubmitButton = event.target.closest("#joinProfileManageSave, .join-profile-manage-save");
      if (isSubmitButton) return;
      const targetRow = event.target.closest(".join-profile-info-row");
      const isChangeButton = event.target.closest(".join-profile-info-change");
      const isEditingControl = Boolean(
        targetRow?.classList.contains("is-editing")
        && event.target.closest(".join-profile-manage-input, .join-profile-manage-select, .join-profile-manage-textarea, .join-profile-inline-picker, .join-profile-gender-radios")
      );
      if (isChangeButton || isEditingControl) return;
      if (!validateJoinProfileManageContactFieldsBeforeExit()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      lockInactiveJoinProfileManageFields();
    }, { capture: true });

    function fillJoinProfileManageForm(member = {}) {
      joinProfileManageSelectedFile = null;
      const fields = {
        joinProfileManageName: member.memberName || member.name || "",
        joinProfileManageMobile: normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || ""),
        joinProfileManageEmail: member.memberEmail || member.email || "",
        joinProfileManageBirthYear: getJoinMemberBirthYear(member),
        joinProfileManageGender: member.gender || "",
        joinProfileManageLevel: normalizeJoinProfileManageLevelValue(member.level || ""),
        joinProfileManageProfession: member.profession || "",
        joinProfileManageTravelStyles: member.travelStyles || ""
      };
      Object.entries(fields).forEach(([id, value]) => {
        const node = document.getElementById(id);
        if (node) node.value = value || "";
      });
      const nameField = document.getElementById("joinProfileManageName");
      if (nameField) {
        nameField.setAttribute("readonly", "readonly");
        nameField.setAttribute("aria-readonly", "true");
      }
      lockJoinProfileManageFields();
      syncJoinProfileManageGenderRadios();
      syncJoinProfileManagePickerActiveStates();
      const input = document.getElementById("joinProfileManagePhoto");
      if (input) input.value = "";
      renderJoinProfileImage(document.getElementById("joinProfileManagePreview"), member);
      syncJoinProfileManageSummary();
      const note = document.getElementById("joinProfileManagePhotoNote");
      if (note) note.textContent = "작은 프로필용으로 압축해서 1장만 저장됩니다.";
      if (note) note.textContent = "\uC571\uC6A9 \uD504\uB85C\uD544\uB85C \uC555\uCD95\uD574\uC11C 1\uC7A5\uB9CC \uC800\uC7A5\uB429\uB2C8\uB2E4.";
      clearJoinProfileManageFieldErrors();
      setJoinProfileManageStatus("");
    }

    function lockJoinProfileManagePageScroll() {
      if (document.body.classList.contains("join-profile-scroll-locked")) return;
      const isOpenedFromMyLayer = document.getElementById("joinMyMenuModal")?.classList.contains("open")
        || document.getElementById("joinMyDrawerOverlay")?.classList.contains("open");
      if (isOpenedFromMyLayer) return;
      joinProfileManageScrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
      document.body.style.top = `-${joinProfileManageScrollLockY}px`;
      document.body.classList.add("join-profile-scroll-locked");
    }

    function unlockJoinProfileManagePageScroll() {
      if (!document.body.classList.contains("join-profile-scroll-locked")) return;
      document.body.classList.remove("join-profile-scroll-locked");
      document.body.style.top = "";
      window.scrollTo(0, joinProfileManageScrollLockY || 0);
      joinProfileManageScrollLockY = 0;
    }

    async function openJoinProfileManageModal() {
      const cached = getJoinCachedCurrentMember();
      if (!cached) {
        redirectToJoinLogin("profile-manage");
        return;
      }
      const overlay = portalOverlayToBody("joinProfileManageOverlay") || ensureJoinProfileManageModal();
      fillJoinProfileManageForm(cached);
      if (typeof scheduleJoinMobileVisualViewportVarsUpdate === "function") {
        scheduleJoinMobileVisualViewportVarsUpdate({ settle: true });
      }
      overlay.style.setProperty("z-index", "2147483960", "important");
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      setWidgetModalOpen(true);
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      lockJoinProfileManagePageScroll();
      refreshJoinMemberInBackground((member) => {
        if (
          document.getElementById("joinProfileManageOverlay")?.classList.contains("open")
          && !joinProfileManageSelectedFile
          && !hasJoinProfileManageEditingField()
        ) {
          fillJoinProfileManageForm(member);
        }
      });
    }

    function closeJoinProfileManageModal() {
      const overlay = document.getElementById("joinProfileManageOverlay");
      resetModalRuntimeState(overlay);
      overlay?.classList.remove("open");
      overlay?.setAttribute("aria-hidden", "true");
      joinProfileManageSelectedFile = null;
      setWidgetModalOpen(hasOpenBlockingModal());
      if (!hasOpenBlockingModal()) {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
      }
      unlockJoinProfileManagePageScroll();
    }

    function handleJoinProfilePhotoChange(event) {
      const file = event.target.files?.[0] || null;
      const note = document.getElementById("joinProfileManagePhotoNote");
      if (!file) {
        joinProfileManageSelectedFile = null;
        if (note) note.textContent = "작은 프로필용으로 압축해서 1장만 저장됩니다.";
        return;
      }
      if (!file.type.startsWith("image/")) {
        event.target.value = "";
        joinProfileManageSelectedFile = null;
        setJoinProfileManageStatus("이미지 파일만 선택할 수 있습니다.");
        return;
      }
      joinProfileManageSelectedFile = file;
      const preview = document.getElementById("joinProfileManagePreview");
      if (preview) {
        const url = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
      }
      if (note) note.textContent = `${file.name} · 원본 ${formatReviewImageSize(file.size)}`;
      setJoinProfileManageStatus("");
    }

    async function requestJoinProfileUploadUrls({ profileId, images }) {
      if (!REVIEW_IMAGE_SIGN_ENDPOINT) {
        throw new Error("REVIEW_IMAGE_SIGN_ENDPOINT is not configured");
      }
      const response = await fetch(REVIEW_IMAGE_SIGN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "join_profile_image",
          profileId,
          images: images.map((image) => ({
            role: image.role,
            fileName: image.fileName,
            contentType: image.mimeType,
            size: image.blob.size
          }))
        })
      });
      if (!response.ok) throw new Error(`Profile upload URL request failed: ${response.status}`);
      const data = await response.json();
      const items = data.items || data.uploads || [];
      if (!items.length) throw new Error("Profile upload URL response is empty");
      return items;
    }

    async function uploadJoinProfileImage(profileId) {
      const file = joinProfileManageSelectedFile;
      if (!file) return null;
      const resized = await resizeJoinReviewImage(file, PROFILE_IMAGE_MAX_SIDE, PROFILE_IMAGE_QUALITY);
      const extension = getReviewImageExtension(resized.mimeType);
      const image = {
        role: "profile",
        fileName: `${profileId}_profile.${extension}`,
        sourceName: file.name,
        ...resized
      };
      const uploads = await requestJoinProfileUploadUrls({ profileId, images: [image] });
      const upload = uploads.find((item) => item.role === image.role || item.fileName === image.fileName) || uploads[0];
      const uploaded = await uploadJoinReviewImageToGcs(upload, image);
      const imageUrl = uploaded.imageUrl || uploaded.publicUrl || uploaded.downloadUrl || upload.publicUrl || upload.imageUrl || upload.downloadUrl || "";
      return {
        profileImageUrl: imageUrl,
        profileThumbnailUrl: imageUrl,
        profileImageObjectName: uploaded.objectName || "",
        profileImageMimeType: uploaded.mimeType,
        profileImageSize: uploaded.blob.size,
        profileImageUpdatedAt: nowKstISOString()
      };
    }

    function buildJoinProfileManagePayload(member = {}, image = null) {
      const submittedAt = nowKstISOString();
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinProfileManageMobile")?.value || member.memberMobile || "");
      const name = String(member.memberName || member.name || "").trim();
      const email = document.getElementById("joinProfileManageEmail")?.value.trim() || member.memberEmail || "";
      const birthYear = document.getElementById("joinProfileManageBirthYear")?.value.trim() || "";
      const profileId = getStableJoinMemberProfileId({
        ...member,
        memberMobile: mobile,
        memberEmail: email
      }, mobile);
      const profileImage = image || {
        profileImageUrl: member.profileImageUrl || "",
        profileImageObjectName: member.profileImageObjectName || "",
        profileImageSize: member.profileImageSize || ""
      };
      return {
        profileId,
        action: "upsert",
        keyField: "profileId",
        keyValue: profileId,
        source: "join_member_profile",
        sheet: "join_member_profiles",
        submittedAt,
        pageUrl: location.href,
        memberSeq: member.memberSeq || "",
        memberId: member.memberId || "",
        memberName: name,
        memberChannel: member.memberChannel || "HOME",
        memberMobile: mobile,
        memberEmail: email,
        birthYear,
        gender: document.getElementById("joinProfileManageGender")?.value || "",
        profession: document.getElementById("joinProfileManageProfession")?.value.trim() || "",
        level: document.getElementById("joinProfileManageLevel")?.value || "",
        travelStyles: document.getElementById("joinProfileManageTravelStyles")?.value.trim() || "",
        profileImageUrl: profileImage.profileImageUrl || "",
        profileImageObjectName: profileImage.profileImageObjectName || "",
        profileImageSize: profileImage.profileImageSize || "",
        member: {
          memberSeq: member.memberSeq || "",
          memberId: member.memberId || "",
          memberName: name,
          memberChannel: member.memberChannel || "HOME",
          memberMobile: mobile,
          memberEmail: email
        },
        profile: {
          birthYear,
          gender: document.getElementById("joinProfileManageGender")?.value || "",
          profession: document.getElementById("joinProfileManageProfession")?.value.trim() || "",
          level: document.getElementById("joinProfileManageLevel")?.value || "",
          travelStyles: document.getElementById("joinProfileManageTravelStyles")?.value.trim() || "",
          requiredAgreed: true,
          marketingAgreed: Boolean(member.marketingAgreed),
          termsAgreedAt: submittedAt,
          profileImageUrl: profileImage.profileImageUrl || "",
          profileImageObjectName: profileImage.profileImageObjectName || "",
          profileImageSize: profileImage.profileImageSize || ""
        },
        kakao: {
          kakaoId: member.kakaoId || "",
          nickname: member.kakaoNickname || ""
        }
      };
    }

    function validateJoinProfileManageForm() {
      const name = document.getElementById("joinProfileManageName")?.value.trim() || "";
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinProfileManageMobile")?.value || "");
      const birthYear = document.getElementById("joinProfileManageBirthYear")?.value.trim() || "";
      if (name.length < 2) return "이름을 2자 이상 입력해 주세요.";
      if (mobile && !/^01\d{8,9}$/.test(mobile)) return "휴대폰 번호를 다시 확인해 주세요.";
      if (birthYear && !/^(19\d{2}|20\d{2})$/.test(birthYear)) return "출생년도 4자리를 입력해 주세요.";
      return "";
    }

    function splitJoinMemberMobileParts(value = "") {
      const mobile = normalizeJoinMemberPhone(value);
      const match = mobile.match(/^(010|011|016|017|018|019)(\d{3,4})(\d{4})$/);
      if (!match) {
        return {
          mobile1: mobile.slice(0, 3),
          mobile2: mobile.slice(3, -4),
          mobile3: mobile.slice(-4)
        };
      }
      return {
        mobile1: match[1],
        mobile2: match[2],
        mobile3: match[3]
      };
    }

    function getSecretTourGenderCode(value = "") {
      const text = String(value || "").trim().toLowerCase();
      if (text === "m" || text === "male" || text.includes("\uB0A8")) return "M";
      if (text === "f" || text === "female" || text.includes("\uC5EC")) return "F";
      return "";
    }

    function isSecretTourMemberMobileChanged(payload = {}, member = {}) {
      const nextMobile = normalizeJoinMemberPhone(payload.member?.memberMobile || "");
      const currentMobile = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      return Boolean(nextMobile && currentMobile && nextMobile !== currentMobile);
    }

    function canUseSecretTourMemberApi() {
      const hostname = String(location.hostname || "").toLowerCase();
      return hostname === "secret-tour.com" || hostname.endsWith(".secret-tour.com");
    }

    async function checkSecretTourMemberMobileDuplicate(parts = {}) {
      const result = await postJoinMemberForm("/member/getMemberMobileCheck.json", {
        mobile1: parts.mobile1 || "",
        mobile2: parts.mobile2 || "",
        mobile3: parts.mobile3 || ""
      });
      return Number(result?.count || 0) !== 0;
    }

    async function readSecretTourMemberUpdateBaseParams() {
      const params = new URLSearchParams();
      try {
        const response = await fetch("/mypage/member", { credentials: "include", cache: "no-store" });
        if (!response.ok) return params;
        if (response.url && /\/member\/login/i.test(response.url)) return params;
        const doc = new DOMParser().parseFromString(await response.text(), "text/html");
        doc.querySelectorAll("input, select, textarea").forEach((field) => {
          const key = field.getAttribute("name") || field.id || "";
          if (!key) return;
          const type = String(field.getAttribute("type") || "").toLowerCase();
          if ((type === "checkbox" || type === "radio") && !field.checked) return;
          params.set(key, field.value || field.textContent || "");
        });
      } catch (error) {
        golfJoinSafeWarn("Failed to read Secret Tour member update form.", error);
      }
      return params;
    }

    function buildSecretTourMemberUpdateBody(payload = {}, member = {}, baseParams = null) {
      const mobile = payload.member?.memberMobile || member.memberMobile || member.mobile || "";
      const parts = splitJoinMemberMobileParts(mobile);
      const name = String(payload.member?.memberName || payload.memberName || member.memberName || member.name || "").trim();
      const email = payload.member?.memberEmail || member.memberEmail || member.email || "";
      const birthday = String(payload.profile?.birthday || payload.profile?.birthYear || member.birthday || "").trim();
      const mobileChanged = isSecretTourMemberMobileChanged(payload, member);
      const currentEmail = String(member.memberEmail || member.email || "").trim();
      const emailChanged = Boolean(email && currentEmail && email !== currentEmail);
      const gender = getSecretTourGenderCode(payload.profile?.gender || member.gender || "");
      const params = new URLSearchParams(baseParams || "");
      ["custNm", "userNm", "memberName", "memberNm", "mberNm", "custName", "userName"].forEach((key) => {
        params.set(key, name);
      });
      if (member.memberSeq) {
        params.set("userSeq", member.memberSeq);
        params.set("memberSeq", member.memberSeq);
      }
      params.set("mobile1", parts.mobile1 || "");
      params.set("mobile2", parts.mobile2 || "");
      params.set("mobile3", parts.mobile3 || "");
      params.set("email", email);
      params.set("engLastNm", member.engLastNm || "");
      params.set("engFirstNm", member.engFirstNm || "");
      params.set("gender", gender);
      params.set("birthday", birthday);
      params.set("mobile1Tmp", parts.mobile1 || "");
      params.set("mobile2Tmp", parts.mobile2 || "");
      params.set("mobile3Tmp", parts.mobile3 || "");
      params.set("mobileChangeYn", mobileChanged ? "Y" : "N");
      params.set("homeTel1", member.homeTel1 || "");
      params.set("homeTel2", member.homeTel2 || "");
      params.set("homeTel3", member.homeTel3 || "");
      params.set("emailTmp", email);
      params.set("emailChangeYn", emailChanged ? "Y" : "N");
      params.set("smsYn", member.smsYn || "Y");
      params.set("emailYn", member.emailYn || "Y");
      params.set("homePostNo", member.homePostNo || "");
      params.set("homeAddr1", member.homeAddr1 || "");
      params.set("homeAddr2", member.homeAddr2 || "");
      return params;
    }

    function parseSecretTourMemberUpdateResponse(responseData) {
      if (typeof responseData === "string") {
        try {
          return JSON.parse(responseData);
        } catch (error) {
          return { raw: responseData };
        }
      }
      return responseData || {};
    }

    function isSecretTourMemberUpdateSuccess(responseData) {
      const data = parseSecretTourMemberUpdateResponse(responseData);
      const message = String(data.message || data.result || data.status || data.code || "").trim().toUpperCase();
      if (!message) return true;
      return ["SUCCESS", "OK", "TRUE", "1", "200"].includes(message);
    }

    function normalizeSecretTourMemberCompareName(value = "") {
      return String(value || "").replace(/\s+/g, "").trim();
    }

    async function updateSecretTourMemberProfile(payload = {}, member = {}) {
      if (!canUseSecretTourMemberApi()) {
        golfJoinSafeWarn("Secret Tour member API skipped outside secret-tour.com.", location.origin);
        return { skipped: true, reason: "non_secret_tour_origin" };
      }
      const mobile = payload.member?.memberMobile || member.memberMobile || member.mobile || "";
      const parts = splitJoinMemberMobileParts(mobile);
      if (isSecretTourMemberMobileChanged(payload, member) && await checkSecretTourMemberMobileDuplicate(parts)) {
        const error = new Error("Duplicate mobile number");
        error.code = "DUPLICATE_MOBILE";
        throw error;
      }
      const baseParams = await readSecretTourMemberUpdateBaseParams();
      const response = await fetch("/mypage/updateMember.json", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: buildSecretTourMemberUpdateBody(payload, member, baseParams)
      });
      if (!response.ok) throw new Error(`Secret Tour member update failed: ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!isSecretTourMemberUpdateSuccess(result)) {
        const error = new Error("Secret Tour member update returned failure");
        error.code = "ERP_UPDATE_FAILED";
        error.responseData = result;
        throw error;
      }
      const nextName = normalizeSecretTourMemberCompareName(payload.member?.memberName || payload.memberName || "");
      const prevName = normalizeSecretTourMemberCompareName(member.memberName || member.name || "");
      if (nextName && nextName !== prevName) {
        const detail = await fetchJoinMemberDetail();
        const savedName = normalizeSecretTourMemberCompareName(detail.memberName || "");
        if (savedName && savedName !== nextName) {
          const error = new Error("Secret Tour member name was not updated");
          error.code = "ERP_NAME_NOT_UPDATED";
          error.expectedName = payload.member?.memberName || payload.memberName || "";
          error.actualName = detail.memberName || "";
          error.responseData = result;
          throw error;
        }
      }
      return result;
    }

    function validateJoinProfileManageForm() {
      const name = document.getElementById("joinProfileManageName")?.value.trim() || "";
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinProfileManageMobile")?.value || "");
      const email = document.getElementById("joinProfileManageEmail")?.value.trim() || "";
      const birthYear = document.getElementById("joinProfileManageBirthYear")?.value.trim() || "";
      clearJoinProfileManageFieldErrors();
      if (name.length < 2) {
        return { fieldId: "joinProfileManageName", message: "\uC774\uB984\uC744 2\uC790 \uC774\uC0C1 \uC785\uB825\uD574 \uC8FC\uC138\uC694." };
      }
      if (!/^01\d{9}$/.test(mobile)) {
        const message = "\uD734\uB300\uD3F0 \uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.";
        setJoinProfileManageFieldError("joinProfileManageMobile", message);
        return { fieldId: "joinProfileManageMobile", message };
      }
      if (email && !isValidJoinMemberEmail(email)) {
        const message = "\uC815\uC0C1\uC801\uC778 \uC774\uBA54\uC77C\uC8FC\uC18C\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.";
        setJoinProfileManageFieldError("joinProfileManageEmail", message);
        return { fieldId: "joinProfileManageEmail", message };
      }
      if (birthYear && !/^(19\d{2}|20\d{2})$/.test(birthYear)) {
        return { fieldId: "joinProfileManageBirthYear", message: "\uCD9C\uC0DD\uB144\uB3C4 4\uC790\uB9AC\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694." };
      }
      return null;
    }

    async function submitJoinProfileManage(event) {
      event.preventDefault();
      const member = getJoinCachedCurrentMember();
      if (!member) {
        redirectToJoinLogin("profile-manage");
        return;
      }
      const validation = validateJoinProfileManageForm();
      if (validation?.message) {
        setJoinProfileManageStatus(validation.message);
        if (validation.fieldId) {
          setTimeout(() => focusJoinProfileManageField(validation.fieldId), 0);
        }
        return;
      }
      const saveButton = document.getElementById("joinProfileManageSave");
      saveButton?.setAttribute("disabled", "disabled");
      const loadingToken = openJoinActionLoading("프로필을 저장하고 있어요", { minVisibleMs: 450 });
      setJoinProfileManageStatus("프로필을 저장하고 있어요");
      try {
        const payload = buildJoinProfileManagePayload(member, null);
        const image = joinProfileManageSelectedFile
          ? await uploadJoinProfileImage(payload.profileId)
          : null;
        if (joinProfileManageSelectedFile && !image?.profileImageUrl) {
          throw new Error("Profile image upload failed");
        }
        if (image) {
          payload.profile = {
            ...payload.profile,
            ...image
          };
          payload.profileImageUrl = image.profileImageUrl || payload.profileImageUrl || "";
          payload.profileImageObjectName = image.profileImageObjectName || payload.profileImageObjectName || "";
          payload.profileImageSize = image.profileImageSize || payload.profileImageSize || "";
        }
        const hasProfileImageSave = Boolean(image?.profileImageUrl);
        if (hasProfileImageSave) {
          saveJoinMemberProfileToGoogleSheetInBackground(payload);
          try {
            await updateSecretTourMemberProfile(payload, member);
          } catch (error) {
            if (error?.code === "DUPLICATE_MOBILE" || ["ERP_UPDATE_FAILED", "ERP_NAME_NOT_UPDATED"].includes(error?.code)) {
              throw error;
            }
            golfJoinSafeWarn("Secret Tour member update failed after profile image save.", error);
          }
        } else {
          const saveResults = await Promise.allSettled([
            saveJoinMemberProfileToGoogleSheet(payload),
            updateSecretTourMemberProfile(payload, member)
          ]);
          if (saveResults[0].status === "rejected") {
            throw saveResults[0].reason;
          }
          if (saveResults[1].status === "rejected") {
            if (saveResults[1].reason?.code === "DUPLICATE_MOBILE") {
              throw saveResults[1].reason;
            }
            if (["ERP_UPDATE_FAILED", "ERP_NAME_NOT_UPDATED"].includes(saveResults[1].reason?.code)) {
              throw saveResults[1].reason;
            }
            golfJoinSafeWarn("Secret Tour member update failed after profile save.", saveResults[1].reason);
          }
        }
        const mergedProfile = normalizeJoinMemberProfileRow({
          ...payload.member,
          ...payload.profile,
          profileId: payload.profileId,
          submittedAt: payload.submittedAt
        });
        joinMemberProfileLookupResults.clear();
        joinMemberProfileLookupPromises.clear();
        rememberJoinMemberProfileLocally(payload.member, mergedProfile);
        const updatedMember = mergeJoinMemberWithProfile(member, mergedProfile);
        rememberJoinMemberProfileLocally(member, updatedMember);
        setJoinSessionMember(updatedMember);
        rememberJoinMemberProfileCompletion(updatedMember, isJoinMemberProfileComplete(updatedMember));
        updateJoinMyDrawerProfile(updatedMember);
        closeJoinProfileManageModal();
      } catch (error) {
        golfJoinSafeError("Failed to save join profile.", error);
        if (error?.code === "DUPLICATE_MOBILE") {
          const duplicateMessage = "\uC774\uBBF8 \uC0AC\uC6A9\uC911\uC774\uAC70\uB098 \uD0C8\uD1F4\uD55C \uD734\uB300\uD3F0 \uBC88\uD638\uC785\uB2C8\uB2E4.";
          alert(duplicateMessage);
          setJoinProfileManageStatus(duplicateMessage);
          return;
        }
        if (error?.code === "ERP_NAME_NOT_UPDATED") {
          setJoinProfileManageStatus("\uAD6C\uAE00\uC2DC\uD2B8\uB294 \uC800\uC7A5\uB410\uC9C0\uB9CC ERP \uC774\uB984 \uBCC0\uACBD\uC774 \uBC18\uC601\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. ERP \uC751\uB2F5\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
          return;
        }
        if (error?.code === "ERP_UPDATE_FAILED") {
          setJoinProfileManageStatus("ERP \uD68C\uC6D0\uC815\uBCF4 \uC800\uC7A5\uC774 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
          return;
        }
        setJoinProfileManageStatus(joinProfileManageSelectedFile && !REVIEW_IMAGE_SIGN_ENDPOINT
          ? "사진 업로드 API 설정이 필요합니다. 관리자에게 문의해 주세요."
          : "프로필 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        await closeJoinActionLoading(loadingToken);
        saveButton?.removeAttribute("disabled");
      }
    }

    function findJoinForReview(joinId = "", title = "") {
      const key = String(joinId || "").trim();
      const name = String(title || "").trim();
      const sources = [...joins];
      try {
        getBuilderProductSource().forEach((product) => {
          if (!sources.some((item) => item === product || (item.id && item.id === product.id))) sources.push(product);
        });
      } catch (error) {}
      return sources.find((item) => key && (
          item.id === key
          || item.erpProductId === key
          || item.goodSeq === key
          || getProductGroupKey(item) === key
        ))
        || sources.find((item) => name && (String(item.title || "").includes(name) || name.includes(String(item.title || ""))))
        || null;
    }

    function buildJoinReviewPayload({ reviewId: presetReviewId = "", joinId = "", title = "", rating = 0, tags = [], text = "", photoName = "", imageUpload = null } = {}) {
      const join = findJoinForReview(joinId, title) || { id: joinId, title };
      const productReference = getSecretTourProductReference(join);
      const member = getJoinCachedCurrentMember() || {};
      const submittedAt = nowKstISOString();
      const memberMobile = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      const reviewId = presetReviewId || buildGoogleSheetRecordId("jr", submittedAt, member.memberSeq || member.memberId || member.memberName || "member", productReference.id || join.id || title);
      return {
        reviewId,
        source: "join_review",
        submittedAt,
        pageUrl: location.href,
        member: {
          memberSeq: member.memberSeq || "",
          memberId: member.memberId || "",
          memberName: member.memberName || member.name || "",
          memberMobile,
          memberEmail: member.memberEmail || member.email || ""
        },
        targetType: join.scheduleId ? "new_schedule" : "erp_product",
        targetScheduleId: join.scheduleId || "",
        targetApplicationId: join.sourceApplicationId || getNestedValue(join.sheetApplication || {}, "applicationId") || "",
        product: {
          erpProductId: productReference.goodSeq || normalizeJoinCanonicalErpProductId(join.erpProductId || join.id, join.erpEventSeq || productReference.eventSeq) || "",
          erpEventSeq: normalizeJoinCanonicalErpEventSeq(join.erpEventSeq || productReference.eventSeq),
          productName: join.title || title || "",
          departureDate: join.departureDate || "",
          returnDate: join.returnDate || "",
          region: join.region || ""
        },
        rating,
        tags,
        reviewText: text,
        photoName: imageUpload?.photoName || photoName,
        imageUrl: imageUpload?.imageUrl || "",
        thumbnailUrl: imageUpload?.thumbnailUrl || "",
        imagesJson: imageUpload?.images?.length ? JSON.stringify(imageUpload.images) : "",
        photoSize: imageUpload?.photoSize || "",
        photoMimeType: imageUpload?.photoMimeType || "",
        review: {
          rating,
          tags,
          text,
          photoName: imageUpload?.photoName || photoName,
          imageUrl: imageUpload?.imageUrl || "",
          thumbnailUrl: imageUpload?.thumbnailUrl || "",
          images: imageUpload?.images || [],
          photoSize: imageUpload?.photoSize || "",
          photoMimeType: imageUpload?.photoMimeType || ""
        },
        status: "visible"
      };
    }

    async function handleJoinMyReviewWrite(joinId = "", title = "", summary = {}) {
      const loadingToken = openJoinActionLoading("", { minVisibleMs: 500 });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      try {
      const overlay = ensureJoinMyReviewModal();
      const reviewJoin = findJoinForReview(joinId, title) || { id: joinId, title };
      const existing = getJoinMySubmittedReview(joinId, title) || getJoinMySubmittedReviewForProduct(reviewJoin);
      document.getElementById("joinMyReviewTitle") && (document.getElementById("joinMyReviewTitle").textContent = existing ? "후기 수정" : "후기 작성");
      document.getElementById("joinMyReviewTripTitle") && (document.getElementById("joinMyReviewTripTitle").textContent = title || "다녀온 일정");
      const tripImage = document.getElementById("joinMyReviewTripImage");
      const tripImageSrc = summary.image || reviewJoin.image || "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg";
      if (tripImage) {
        tripImage.src = tripImageSrc;
        tripImage.alt = title || reviewJoin.title || "지난 일정";
      }
      document.getElementById("joinMyReviewTripRegion") && (document.getElementById("joinMyReviewTripRegion").textContent = summary.region || reviewJoin.countryRegion || reviewJoin.region || "");
      document.getElementById("joinMyReviewTripPeriod") && (document.getElementById("joinMyReviewTripPeriod").textContent = summary.period || formatJoinMyDateRange(reviewJoin));
      document.getElementById("joinMyReviewJoinId") && (document.getElementById("joinMyReviewJoinId").value = getJoinMyReviewKey(joinId, title));
      overlay.dataset.reviewJoinId = joinId || "";
      overlay.dataset.reviewTitle = title || "";
      const text = document.getElementById("joinMyReviewText");
      if (text) text.value = existing?.review?.text || existing?.text || "";
      document.querySelectorAll("#joinMyReviewModal .join-review-tag").forEach((button) => {
        const tags = existing?.review?.tags || existing?.tags || [];
        button.classList.toggle("is-active", Boolean(tags.includes(button.textContent.trim())));
      });
      clearJoinMyReviewPhotoInput();
      if (existing) loadJoinMyReviewExistingPhotos(existing);
      document.getElementById("joinMyReviewError") && (document.getElementById("joinMyReviewError").textContent = "");
      const existingRating = existing?.review?.rating ?? existing?.rating;
      setJoinMyReviewRating(existing ? existingRating : 0);
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
      requestAnimationFrame(() => {
        const body = document.querySelector("#joinMyReviewModal .join-review-body");
        if (body) body.scrollTop = 0;
      });
      } finally {
        await closeJoinActionLoading(loadingToken);
      }
    }

    function closeJoinMyReviewModal() {
      const modal = document.getElementById("joinMyReviewModal");
      resetModalRuntimeState(modal);
      modal?.classList.remove("open");
      if (!document.getElementById("joinMyMenuModal")?.classList.contains("open")) {
        setWidgetModalOpen(false);
      }
    }

    async function submitJoinMyReview(event) {
      event?.preventDefault();
      const key = document.getElementById("joinMyReviewJoinId")?.value || "";
      const text = document.getElementById("joinMyReviewText")?.value.trim() || "";
      const error = document.getElementById("joinMyReviewError");
      if (!key) {
        if (error) error.textContent = "후기를 등록할 일정을 확인할 수 없습니다.";
        return;
      }
      if (text.length < 20) {
        if (error) error.textContent = "후기 내용을 20자 이상 입력해 주세요.";
        return;
      }
      const tags = Array.from(document.querySelectorAll("#joinMyReviewModal .join-review-tag.is-active")).map((button) => button.textContent.trim());
      const photoLabel = document.getElementById("joinMyReviewPhotoLabel")?.textContent || "";
      const selectedPhotoNames = getJoinMyReviewSelectedFiles().map((file) => file.name).filter(Boolean).join(", ");
      const photoName = selectedPhotoNames || (photoLabel === "추가" ? "" : photoLabel);
      const overlay = document.getElementById("joinMyReviewModal");
      const reviewJoinId = overlay?.dataset.reviewJoinId || key;
      const reviewTitle = overlay?.dataset.reviewTitle || document.getElementById("joinMyReviewTripTitle")?.textContent || "";
      const preservedImageUpload = getJoinMyReviewPreservedImageUpload();
      let payload = buildJoinReviewPayload({
        joinId: reviewJoinId,
        title: reviewTitle,
        rating: Number(document.getElementById("joinMyReviewRating")?.value || 0),
        tags,
        text,
        photoName,
        imageUpload: getJoinMyReviewSelectedFiles().length ? null : preservedImageUpload
      });
      const submitButton = document.querySelector("#joinMyReviewModal .join-review-actions .primary");
      if (submitButton) {
        submitButton.disabled = true;
      }
      let saveStage = "sheet";
      const loadingToken = openJoinActionLoading("", { minVisibleMs: 300 });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      try {
        if (getJoinMyReviewSelectedFiles().length) {
          saveStage = "image-upload";
          const imageUpload = await uploadJoinReviewImages(payload.reviewId);
          const mergedImageUpload = mergeJoinReviewImageUploads(preservedImageUpload, imageUpload);
          payload = buildJoinReviewPayload({
            reviewId: payload.reviewId,
            joinId: reviewJoinId,
            title: reviewTitle,
            rating: Number(document.getElementById("joinMyReviewRating")?.value || 0),
            tags,
            text,
            photoName: mergedImageUpload?.photoName || imageUpload.photoName,
            imageUpload: mergedImageUpload || imageUpload
          });
        }
        saveStage = "sheet";
        await saveJoinReviewToGoogleSheet(payload);
        rememberJoinReviewPayload(payload);
      } catch (saveError) {
        golfJoinSafeWarn("Failed to save join review.", { stage: saveStage, error: saveError });
        if (error) {
          error.textContent = saveStage === "image-upload"
            ? (!REVIEW_IMAGE_SIGN_ENDPOINT
              ? "사진 업로드 API 설정이 필요합니다. 관리자에게 문의해 주세요."
              : "사진 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
            : "후기 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        }
        await closeJoinActionLoading(loadingToken);
        if (false && error) {
          error.textContent = getJoinMyReviewSelectedFiles().length && !REVIEW_IMAGE_SIGN_ENDPOINT
            ? "사진 업로드 API 설정이 필요합니다. 관리자에게 문의해 주세요."
            : "후기 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        }
        if (submitButton) {
          submitButton.disabled = false;
        }
        return;
      }
      const store = readJoinMyReviewStore();
      store[key] = payload;
      writeJoinMyReviewStore(store);
      await closeJoinActionLoading(loadingToken);
      if (submitButton) {
        submitButton.disabled = false;
      }
      closeJoinMyReviewModal();
      const member = getJoinCachedCurrentMember();
      if (member && isJoinMyMenuViewOpen("reservation")) {
        renderJoinMyMenu(member);
        switchJoinMyTab("completed");
      }
      if (document.getElementById("detailModal")?.classList.contains("open") && currentDetailJoinData) {
        renderDetailContent(currentDetailJoinData);
      }
    }

    let joinMyReservationActiveTab = "created";
    let joinMyCreatedScheduleFilter = "complete";
    let joinMyJoinedScheduleFilter = "complete";
    let joinMyCreatedReservationRenderCache = {
      key: "",
      items: []
    };

    function getJoinMyReservationRenderCacheKey(member = {}) {
      const identity = getJoinMyMemberIdentity(member);
      return [identity.seq, identity.id, identity.phone, identity.email].filter(Boolean).join("|");
    }

    function applyJoinMyCreatedReservationRenderCache(member = {}, groups = {}) {
      const key = getJoinMyReservationRenderCacheKey(member);
      if (!key) return groups;
      if ((groups.created || []).length) {
        joinMyCreatedReservationRenderCache = {
          key,
          items: groups.created
        };
        return groups;
      }
      if (joinMyCreatedReservationRenderCache.key === key && joinMyCreatedReservationRenderCache.items.length) {
        return {
          ...groups,
          created: joinMyCreatedReservationRenderCache.items
        };
      }
      return groups;
    }

    function switchJoinMyTab(tabKey) {
      if (["created", "joined", "completed"].includes(tabKey)) {
        joinMyReservationActiveTab = tabKey;
      }
      document.querySelectorAll("#joinMyMenuModal .join-my-tab").forEach((button) => {
        const active = button.dataset.joinMyTab === tabKey;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("#joinMyMenuModal .join-my-section").forEach((section) => {
        section.hidden = section.dataset.joinMySection !== tabKey;
      });
    }

    function switchJoinMyCreatedStatusFilter(filterKey = "complete") {
      joinMyCreatedScheduleFilter = filterKey === "recruiting" ? "recruiting" : "complete";
      const member = getJoinCachedCurrentMember();
      if (!member || !isJoinMyMenuViewOpen("reservation")) return;
      renderJoinMyMenu(member);
      switchJoinMyTab("created");
    }

    function switchJoinMyJoinedStatusFilter(filterKey = "joined") {
      joinMyJoinedScheduleFilter = filterKey === "complete" ? "complete" : "joined";
      const member = getJoinCachedCurrentMember();
      if (!member || !isJoinMyMenuViewOpen("reservation")) return;
      renderJoinMyMenu(member);
      switchJoinMyTab("joined");
    }

    function normalizeJoinMyReservationTab(value = "", fallback = "created") {
      const tab = String(value || "").trim().toLowerCase();
      return ["created", "joined", "completed"].includes(tab) ? tab : fallback;
    }

    function isJoinMyMenuViewOpen(view = "") {
      return joinMyMenuActiveView === view
        && Boolean(document.getElementById("joinMyMenuModal")?.classList.contains("open"));
    }

    function beginJoinMyMenuView(view = "") {
      joinMyMenuActiveView = String(view || "");
      joinMyMenuViewGeneration += 1;
      return joinMyMenuViewGeneration;
    }

    function isJoinMyMenuRequestCurrent(view = "", generation = 0) {
      return generation === joinMyMenuViewGeneration && isJoinMyMenuViewOpen(view);
    }

    function refreshOpenJoinMyMenu() {
      if (isJoinMyMenuViewOpen("reservation")) {
        const member = getJoinCachedCurrentMember();
        if (member) renderJoinMyMenu(member);
        return;
      }
      if (isJoinMyMenuViewOpen("wish")) {
        renderJoinMyWishMenu();
        return;
      }
      if (isJoinMyMenuViewOpen("recent")) {
        renderJoinMyRecentMenu();
      }
    }

    function restoreJoinMyMenuAfterDetail(context = {}) {
      const menu = String(context.menu || "").trim();
      const tab = String(context.tab || "").trim();
      if (menu === "wish") {
        void handleJoinMyWishClick();
      } else if (menu === "recent") {
        openJoinMyRecentMenu();
      } else {
        return;
      }
      if (tab) {
        requestAnimationFrame(() => switchJoinMyTab(tab));
      }
    }

    function renderJoinMyMenu(member) {
      const target = document.getElementById("joinMyMenuBody");
      if (!target) return;
      if (!member) {
        target.innerHTML = `<div class="join-my-state">로그인 정보가 만료되었습니다. 다시 로그인해 주세요.</div>`;
        return;
      }
      member = getJoinMemberWithCachedProfile(member);
      preloadJoinProfileImage(member);
      const memberName = member.memberName || "회원";
      const groups = getJoinMyReservationGroups(member);
      document.getElementById("joinMyMenuTitle") && (document.getElementById("joinMyMenuTitle").textContent = "내 예약");
      target.innerHTML = `
        <div class="join-my-reservation-nav" role="tablist" aria-label="내예약 분류">
          <button type="button" class="join-my-tab active" data-join-my-tab="created" role="tab" aria-selected="true" onclick="switchJoinMyTab('created')">내가 만든 일정</button>
          <button type="button" class="join-my-tab" data-join-my-tab="joined" role="tab" aria-selected="false" onclick="switchJoinMyTab('joined')">참여중</button>
          <button type="button" class="join-my-tab" data-join-my-tab="completed" role="tab" aria-selected="false" onclick="switchJoinMyTab('completed')">다녀온 일정</button>
        </div>
        <div class="join-my-profile">
          <section class="join-my-section" data-join-my-section="created">
            <div class="join-my-reservation-title-row">
              <div class="join-my-reservation-title">내가 만든 일정</div>
              ${renderJoinMyCreatedStatusFilters(groups.created)}
            </div>
            ${renderJoinMyCards(getJoinMyVisibleCreatedSchedules(groups.created), "created")}
          </section>
          <section class="join-my-section" data-join-my-section="joined" hidden>
            <div class="join-my-reservation-title-row">
              <div class="join-my-reservation-title">내가 참여중인 일정</div>
              ${renderJoinMyJoinedStatusFilters(groups.joined)}
            </div>
            ${renderJoinMyCards(getJoinMyVisibleJoinedSchedules(groups.joined), "joined")}
          </section>
          <section class="join-my-section" data-join-my-section="completed" hidden>
            <div class="join-my-reservation-title">내가 다녀온 일정</div>
            ${renderJoinMyCards(groups.completed, "completed")}
          </section>
        </div>
      `;
      if (joinMyReservationActiveTab !== "created") {
        switchJoinMyTab(joinMyReservationActiveTab);
      }
    }

    async function openJoinMyMenu(options = {}) {
      const overlay = portalOverlayToBody("joinMyMenuModal");
      const wasOpen = Boolean(overlay?.classList.contains("open"));
      joinMyMenuReturnToDrawerOnClose = Boolean(options.returnToDrawer);
      const requestedTab = normalizeJoinMyReservationTab(options.tab || options.golfjoinTab, "");
      const loginParams = requestedTab ? { golfjoinTab: requestedTab } : {};
      const cachedMember = options.member ? getJoinMemberWithCachedProfile(options.member) : getJoinCachedCurrentMember();
      if (!cachedMember) {
        redirectToJoinLogin("my-menu", loginParams);
        return;
      }
      let member = getJoinMemberWithCachedProfile(cachedMember);
      if (!options.skipProfileCheck && (options.forceProfileRefresh || !isJoinMemberProfileComplete(cachedMember))) {
        member = await getJoinCurrentMember({ refresh: true });
        if (!member) {
          redirectToJoinLogin("my-menu", loginParams);
          return;
        }
        if (!isJoinMemberProfileComplete(member)) {
          openJoinMemberRequiredProfileForm(member, "my-menu", loginParams);
          return;
        }
      }
      member = getJoinMemberWithCachedProfile(member);
      preloadJoinProfileImage(member);
      const viewGeneration = beginJoinMyMenuView("reservation");
      document.getElementById("joinMyMenuTitle") && (document.getElementById("joinMyMenuTitle").textContent = "내 예약");
      if (requestedTab) {
        joinMyReservationActiveTab = requestedTab;
      } else if (!wasOpen) {
        joinMyReservationActiveTab = "created";
        joinMyCreatedScheduleFilter = "complete";
        joinMyJoinedScheduleFilter = "complete";
      }
      overlay?.classList.add("open");
      setJoinHostHeaderCovered(true);
      setJoinMobileBottomNavLayerActive("my");
      setJoinMobileBottomNavVisible(false, { force: true, reason: "my-menu" });
      setWidgetModalOpen(true);
      joinMyReservationsRefreshing = true;
      renderJoinMyMenu(member);
      const builderApplicationsRefresh = googleSheetBuilderApplicationsLoading
        ? Promise.resolve([])
        : hydrateBuilderApplicationJoinsFromGoogleSheet({ renderStart: false, renderHome: false });
      const joinApplicationsRefresh = googleSheetJoinApplicationsLoading
        ? Promise.resolve([])
        : hydrateJoinApplicationsFromGoogleSheet({ renderStart: false, renderHome: false });
      Promise.allSettled([builderApplicationsRefresh, joinApplicationsRefresh]).then(() => {
        joinMyReservationsRefreshing = false;
        if (isJoinMyMenuRequestCurrent("reservation", viewGeneration)) {
          renderJoinMyMenu(member);
        }
        requestAnimationFrame(renderJoins);
      });
      refreshJoinMemberInBackground((freshMember) => {
        const refreshedMember = getJoinMemberWithCachedProfile(freshMember);
        preloadJoinProfileImage(refreshedMember);
        if (isJoinMyMenuRequestCurrent("reservation", viewGeneration) && isJoinMemberProfileComplete(refreshedMember)) {
          renderJoinMyMenu(refreshedMember);
        }
      });
    }

    function closeJoinMyMenu(options = {}) {
      const modal = document.getElementById("joinMyMenuModal");
      const shouldReopenDrawer = Boolean(options.reopenDrawer)
        && joinMyMenuReturnToDrawerOnClose
        && (window.matchMedia?.("(min-width: 641px)")?.matches || window.innerWidth > 640);
      joinMyMenuReturnToDrawerOnClose = false;
      resetModalRuntimeState(modal);
      modal?.classList.remove("open");
      beginJoinMyMenuView("");
      if (!document.getElementById("joinMyDrawerOverlay")?.classList.contains("open")) {
        setJoinHostHeaderCovered(false);
      }
      if (!document.getElementById("joinMyDrawerOverlay")?.classList.contains("open")) {
        setJoinMobileBottomNavLayerActive("");
        setJoinMobileBottomNavVisible(true);
      }
      setWidgetModalOpen(hasOpenBlockingModal());
      if (shouldReopenDrawer) {
        void openJoinMyDrawer();
      }
    }

    function handleJoinMyButtonClick() {
      closeJoinMobileCalendarSheetBeforeNavAction("my");
      closeJoinMobileBuilderModalBeforeNavAction("my");
      setJoinMobileNavActive("my");
      setJoinMobileBottomNavLayerActive("my");
      setJoinMobileBottomNavVisible(true, { force: true });
      if (!requireJoinLogin("my-drawer")) return;
      setJoinHostHeaderCovered(true);
      openJoinMyDrawer();
    }

    window.addEventListener("resize", () => {
      if (document.getElementById("joinMyDrawerOverlay")?.classList.contains("open")) {
        updateJoinMyDrawerHeaderOffset();
      }
    }, { passive: true });

    function handleJoinMobileCreateClick(trigger) {
      closeJoinMobileCalendarSheetBeforeNavAction("create");
      const isBuilderAlreadyOpen = isJoinMobileBuilderModalOpen();
      closeJoinMobileMyMenuBeforeNavAction("create");
      setJoinMobileNavActive("create");
      setJoinMobileBottomNavLayerActive("create");
      setJoinMobileBottomNavVisible(true, { force: true });
      if (isBuilderAlreadyOpen) return;
      Promise.resolve(openBuilderModalFromMain(trigger)).catch((error) => {
        golfJoinSafeWarn("Failed to open builder modal from bottom navigation.", error);
      });
    }

    function handleJoinMobileFindClick() {
      closeJoinMobileCalendarSheetBeforeNavAction("find");
      closeJoinMobileBuilderModalBeforeNavAction("find");
      closeJoinMobileMyMenuBeforeNavAction("find");
      setJoinMobileNavActive("find");
      setJoinMobileBottomNavLayerActive("find");
      setJoinMobileBottomNavVisible(true, { force: true });
      openCalendarSheetAfterJoinMobileFindNavMotion();
    }

    function keepJoinMobilePhoneNavVisible() {
      const nav = document.getElementById("joinMobileBottomNav");
      if (!nav || nav.dataset.mobileNavLayerKey !== "phone") return;
      nav.classList.remove("is-scroll-hidden");
      setJoinMobileBottomNavVisible(true, { force: true });
    }

    function handleJoinMobilePhoneClick() {
      closeJoinMobileCalendarSheetBeforeNavAction("phone");
      closeJoinMobileBuilderModalBeforeNavAction("phone");
      closeJoinMobileMyMenuBeforeNavAction("phone");
      setJoinMobileNavActive("phone");
      setJoinMobileBottomNavLayerActive("phone");
      setJoinMobileBottomNavVisible(true, { force: true });
      [80, 240, 520].forEach((delay) => window.setTimeout(keepJoinMobilePhoneNavVisible, delay));
      handlePhoneContact();
    }

    function closeJoinMobileCalendarSheetBeforeNavAction(nextKey = "") {
      const normalizedKey = String(nextKey || "").trim();
      if (normalizedKey !== "find") cancelJoinMobileFindNavDeferredOpen();
      const calendarSheet = document.getElementById("calendarSheet");
      if (!calendarSheet?.classList.contains("open")) return;
      if (normalizedKey === "find") return;
      closeCalendarSheet();
    }

    function isJoinMobileBuilderModalOpen() {
      return Boolean(document.getElementById("builderModal")?.classList.contains("open"));
    }

    function closeJoinMobileBuilderModalBeforeNavAction(nextKey = "") {
      const normalizedKey = String(nextKey || "").trim();
      if (!isJoinMobileBuilderModalOpen()) return;
      if (normalizedKey === "create") return;
      closeModal("builderModal");
    }

    function closeJoinMobileMyMenuBeforeNavAction(nextKey = "") {
      const normalizedKey = String(nextKey || "").trim();
      if (normalizedKey === "my") return;
      const drawer = document.getElementById("joinMyDrawerOverlay");
      const menu = document.getElementById("joinMyMenuModal");
      if (drawer?.classList.contains("open")) closeJoinMyDrawer();
      if (menu?.classList.contains("open")) closeJoinMyMenu();
    }

    function hideJoinMobileBottomNavForBuilderDateSelection() {
      const isMobileViewport = window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
      const nav = document.getElementById("joinMobileBottomNav");
      if (!isMobileViewport || !nav?.classList.contains("is-visible")) return;
      if (!document.getElementById("builderModal")?.classList.contains("open")) return;
      setJoinMobileBottomNavVisible(false, { force: true, reason: "scroll" });
    }

    function hideJoinMobileBottomNavForCalendarDateSelection() {
      const isMobileViewport = window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
      const nav = document.getElementById("joinMobileBottomNav");
      if (!isMobileViewport || !nav?.classList.contains("is-visible")) return;
      if (!document.getElementById("calendarSheet")?.classList.contains("open")) return;
      setJoinMobileBottomNavVisible(false, { force: true, reason: "scroll" });
    }

    function setJoinMobileBottomNavVisible(visible, options = {}) {
      const nav = document.getElementById("joinMobileBottomNav");
      if (!nav) return;
      const previousScrollHidden = nav.classList.contains("is-scroll-hidden");
      const previousVisible = nav.classList.contains("is-visible");
      const previousHidden = nav.classList.contains("is-hidden");
      const previousModalVisible = nav.classList.contains("is-modal-visible");
      if (options.reason === "scroll" && !visible) {
        nav.classList.add("is-scroll-hidden");
      } else if (visible && options.reason !== "modal-sync") {
        nav.classList.remove("is-scroll-hidden");
      }
      const isScrollHidden = nav.classList.contains("is-scroll-hidden");
      const keepOverModal = shouldKeepJoinMobileBottomNavOverModal();
      const forceVisible = Boolean(options.force) && !(isScrollHidden && options.reason === "modal-sync");
      const nextVisible = Boolean(visible) && (keepOverModal
        ? true
        : forceVisible || !hasOpenBlockingModal());
      const nextModalVisible = nextVisible && keepOverModal;
      const stateChanged = previousScrollHidden !== isScrollHidden
        || previousVisible !== nextVisible
        || previousHidden !== !nextVisible
        || previousModalVisible !== nextModalVisible;
      if (!stateChanged) return;
      requestJoinMobileVisualViewportVarsUpdate();
      nav.classList.toggle("is-visible", nextVisible);
      nav.classList.toggle("is-hidden", !nextVisible);
      nav.classList.toggle("is-modal-visible", nextModalVisible);
      if (nextVisible && !joinMobileNavIndicatorState.moving) {
        updateJoinMobileNavIndicator();
        scheduleJoinMobileNavVisibleOverlaySync();
      } else if (!nextVisible) {
        cancelJoinMobileNavVisibleOverlaySync();
      }
    }

    let joinMobileNavIndicatorFrame = 0;
    let joinMobileNavVisibleSyncFrame = 0;
    let joinMobileFindNavOpenFrame = 0;
    const JOIN_MOBILE_NAV_PHYSICS = {
      stiffness: 400,
      damping: 20,
      mass: 0.7,
      maxVelocity: 2400,
      settlePosition: 0.25,
      settleVelocity: 4
    };
    const JOIN_MOBILE_NAV_BUBBLE_PHYSICS = {
      stiffness: 350,
      damping: 14,
      mass: 0.7
    };
    const joinMobileNavIndicatorState = {
      initialized: false,
      moving: false,
      positionX: 0,
      velocityX: 0,
      targetX: 0,
      width: 0,
      widthVelocity: 0,
      targetWidth: 0,
      shapeX: 0,
      shapeY: 0,
      shapeVelocityX: 0,
      shapeVelocityY: 0,
      targetButton: null,
      lastTime: 0,
      impactStarted: false
    };

    function getJoinMobileNavIndicator(shell) {
      let indicator = shell?.querySelector(".join-mobile-bottom-nav-indicator");
      if (!indicator && shell) {
        indicator = document.createElement("div");
        indicator.className = "join-mobile-bottom-nav-indicator";
        indicator.setAttribute("aria-hidden", "true");
        indicator.innerHTML = `
          <div class="join-mobile-bottom-nav-indicator-deform">
            <div class="join-mobile-bottom-nav-indicator-visual"></div>
          </div>
        `;
        const overlay = shell.querySelector(".join-mobile-bottom-nav-active-overlay");
        if (overlay) {
          shell.insertBefore(indicator, overlay);
        } else {
          shell.appendChild(indicator);
        }
      }
      return indicator;
    }

    function getJoinMobileNavActiveOverlay(shell, buttons = getJoinMobileNavButtons()) {
      let overlay = shell?.querySelector(".join-mobile-bottom-nav-active-overlay");
      if (!overlay && shell) {
        overlay = document.createElement("div");
        overlay.className = "join-mobile-bottom-nav-active-overlay";
        overlay.setAttribute("aria-hidden", "true");
        shell.appendChild(overlay);
      }
      if (overlay && overlay.children.length !== buttons.length) {
        overlay.innerHTML = buttons.map((button) => `
          <div class="join-mobile-bottom-nav-overlay-item">
            ${button.innerHTML}
          </div>
        `).join("");
      }
      return overlay;
    }

    function getJoinMobileNavButtons() {
      return Array.from(document.querySelectorAll("#joinMobileBottomNavInactiveLayer [data-mobile-nav-key]"));
    }

    function setJoinMobileNavActive(key) {
      const buttons = getJoinMobileNavButtons();
      const fallbackButton = buttons.find((button) => button.classList.contains("is-active"))
        || buttons.find((button) => button.dataset.mobileNavKey === "my")
        || buttons[0]
        || null;
      if (!key) {
        updateJoinMobileNavIndicator(fallbackButton, fallbackButton ? { animate: false } : { clear: true });
        return;
      }
      const activeButton = buttons.find((button) => button.dataset.mobileNavKey === key) || fallbackButton;
      updateJoinMobileNavIndicator(activeButton, activeButton ? { animate: true } : { clear: true });
    }

    function initializeJoinMobileNavIndicator() {
      const shell = document.querySelector("#joinMobileBottomNav .join-mobile-bottom-nav-shell");
      if (!shell) return;
      const buttons = getJoinMobileNavButtons();
      getJoinMobileNavIndicator(shell);
      getJoinMobileNavActiveOverlay(shell, buttons);
      const target = shell.querySelector('#joinMobileBottomNavInactiveLayer [data-mobile-nav-key="my"]')
        || shell.querySelector("#joinMobileBottomNavInactiveLayer [data-mobile-nav-key].is-active")
        || buttons[0]
        || null;
      if (target && !target.classList.contains("is-active")) {
        buttons.forEach((button) => button.classList.toggle("is-active", button === target));
      }
      updateJoinMobileNavIndicator(target, { animate: false });
    }

    function setJoinMobileNavIndicatorVars(shell, centerX, width) {
      const offsetX = centerX - width / 2;
      shell.style.setProperty("--join-mobile-nav-active-x", `${Math.round(offsetX * 100) / 100}px`);
      shell.style.setProperty("--join-mobile-nav-active-width", `${Math.round(width * 100) / 100}px`);
    }

    function setJoinMobileNavIndicatorScaleVars(shell, scaleX = 1, scaleY = 1) {
      shell.style.setProperty("--join-mobile-nav-scale-x", String(Math.round(scaleX * 1000) / 1000));
      shell.style.setProperty("--join-mobile-nav-scale-y", String(Math.round(scaleY * 1000) / 1000));
    }

    function getJoinMobileNavTrackRect(shell) {
      return shell?.querySelector(".join-mobile-bottom-nav-inactive-layer")?.getBoundingClientRect()
        || shell?.getBoundingClientRect()
        || null;
    }

    function getJoinMobileNavTranslateX(element) {
      const transform = element ? getComputedStyle(element).transform : "";
      if (!transform || transform === "none") return 0;
      const matrix = transform.match(/^matrix\(([^)]+)\)$/);
      const matrix3d = transform.match(/^matrix3d\(([^)]+)\)$/);
      const parts = (matrix || matrix3d)?.[1]?.split(",").map((part) => Number(part.trim())) || [];
      const translateIndex = matrix3d ? 12 : 4;
      return Number.isFinite(parts[translateIndex]) ? parts[translateIndex] : 0;
    }

    function getJoinMobileNavIndicatorBaseLeft(shell) {
      const indicator = getJoinMobileNavIndicator(shell);
      const indicatorRect = indicator?.getBoundingClientRect();
      if (!indicatorRect?.width) {
        return getJoinMobileNavTrackRect(shell)?.left || 0;
      }
      return indicatorRect.left - getJoinMobileNavTranslateX(indicator);
    }

    function setJoinMobileNavActiveOverlayClip(shell, centerX, width, scaleX = 1, scaleY = 1) {
      const overlay = getJoinMobileNavActiveOverlay(shell);
      const overlayRect = overlay?.getBoundingClientRect();
      if (!overlay || !overlayRect?.width || !overlayRect?.height || !width) return;
      const overlayCenterX = centerX + getJoinMobileNavIndicatorBaseLeft(shell) - overlayRect.left;
      const visualWidth = width * scaleX;
      const overlayStyle = getComputedStyle(overlay);
      const verticalPadding = (parseFloat(overlayStyle.paddingTop) || 0) + (parseFloat(overlayStyle.paddingBottom) || 0);
      const visualHeight = Math.max(0, overlayRect.height - verticalPadding) * scaleY;
      const clipLeft = clampJoinMobileNavValue(overlayCenterX - visualWidth / 2, 0, overlayRect.width);
      const clipRight = clampJoinMobileNavValue(overlayRect.width - (overlayCenterX + visualWidth / 2), 0, overlayRect.width);
      const clipY = clampJoinMobileNavValue((overlayRect.height - visualHeight) / 2, 0, overlayRect.height / 2);
      overlay.style.setProperty("--join-mobile-nav-clip-top", `${Math.round(clipY * 100) / 100}px`);
      overlay.style.setProperty("--join-mobile-nav-clip-right", `${Math.round(clipRight * 100) / 100}px`);
      overlay.style.setProperty("--join-mobile-nav-clip-bottom", `${Math.round(clipY * 100) / 100}px`);
      overlay.style.setProperty("--join-mobile-nav-clip-left", `${Math.round(clipLeft * 100) / 100}px`);
    }

    function clampJoinMobileNavValue(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getJoinMobileNavTargetMetrics(shell, target) {
      const targetRect = target?.getBoundingClientRect();
      if (!targetRect?.width) return null;
      const isPcNav = window.matchMedia?.("(min-width: 641px)")?.matches || window.innerWidth > 640;
      const targetWidth = isPcNav ? targetRect.width : 72;
      const targetCenterX = targetRect.left + targetRect.width / 2 - getJoinMobileNavIndicatorBaseLeft(shell);
      return {
        x: targetCenterX,
        width: targetWidth
      };
    }

    function stopJoinMobileNavIndicatorTracking() {
      if (joinMobileNavIndicatorFrame) {
        window.cancelAnimationFrame(joinMobileNavIndicatorFrame);
        joinMobileNavIndicatorFrame = 0;
      }
    }

    function cancelJoinMobileNavVisibleOverlaySync() {
      if (!joinMobileNavVisibleSyncFrame) return;
      window.cancelAnimationFrame(joinMobileNavVisibleSyncFrame);
      joinMobileNavVisibleSyncFrame = 0;
    }

    function scheduleJoinMobileNavVisibleOverlaySync() {
      cancelJoinMobileNavVisibleOverlaySync();
      joinMobileNavVisibleSyncFrame = window.requestAnimationFrame(() => {
        joinMobileNavVisibleSyncFrame = 0;
        const nav = document.getElementById("joinMobileBottomNav");
        if (!nav?.classList.contains("is-visible") || joinMobileNavIndicatorState.moving) return;
        updateJoinMobileNavIndicator();
      });
    }

    function clearJoinMobileNavIndicatorOverlap(buttons = getJoinMobileNavButtons()) {
      buttons.forEach((button) => button.classList.remove("is-indicator-overlap"));
    }

    function updateJoinMobileNavIndicatorOverlap(shell, indicator, buttons, x, width, scaleX = 1, scaleY = 1) {
      getJoinMobileNavActiveOverlay(shell, buttons);
      setJoinMobileNavActiveOverlayClip(shell, x, width, scaleX, scaleY);
    }

    function finishJoinMobileNavIndicatorMove(shell, indicator, buttons, target) {
      shell.classList.remove("is-nav-indicator-moving");
      clearJoinMobileNavIndicatorOverlap(buttons);
      buttons.forEach((button) => button.classList.toggle("is-active", button === target));
      if (target) {
        const metrics = getJoinMobileNavTargetMetrics(shell, target);
        if (metrics) {
          joinMobileNavIndicatorState.positionX = metrics.x;
          joinMobileNavIndicatorState.targetX = metrics.x;
          joinMobileNavIndicatorState.width = metrics.width;
          joinMobileNavIndicatorState.targetWidth = metrics.width;
          setJoinMobileNavIndicatorVars(shell, metrics.x, metrics.width);
          setJoinMobileNavActiveOverlayClip(shell, metrics.x, metrics.width, 1, 1);
        }
        joinMobileNavIndicatorState.velocityX = 0;
        joinMobileNavIndicatorState.widthVelocity = 0;
        joinMobileNavIndicatorState.moving = false;
        shell.classList.add("has-active");
      } else {
        shell.classList.remove("has-active");
      }
    }

    function applyJoinMobileNavSpring(position, velocity, target, dt, physics) {
      const force = -physics.stiffness * (position - target);
      const dampingForce = -physics.damping * velocity;
      const acceleration = (force + dampingForce) / physics.mass;
      const nextVelocity = velocity + acceleration * dt;
      const maxVelocity = physics.maxVelocity || Infinity;
      const clampedVelocity = clampJoinMobileNavValue(nextVelocity, -maxVelocity, maxVelocity);
      return {
        position: position + clampedVelocity * dt,
        velocity: clampedVelocity
      };
    }

    function applyJoinMobileNavShapeSpring(value, velocity, dt) {
      const result = applyJoinMobileNavSpring(value, velocity, 0, dt, JOIN_MOBILE_NAV_BUBBLE_PHYSICS);
      return {
        value: clampJoinMobileNavValue(result.position, -0.12, 0.14),
        velocity: result.velocity
      };
    }

    function startJoinMobileNavImpact(velocityX) {
      const impact = Math.min(Math.abs(velocityX) / JOIN_MOBILE_NAV_PHYSICS.maxVelocity, 1);
      joinMobileNavIndicatorState.shapeX = -0.055 - impact * 0.035;
      joinMobileNavIndicatorState.shapeY = 0.055 + impact * 0.04;
      joinMobileNavIndicatorState.shapeVelocityX = 2.4 + impact * 3.4;
      joinMobileNavIndicatorState.shapeVelocityY = -1.7 - impact * 2.6;
      joinMobileNavIndicatorState.impactStarted = true;
    }

    function renderJoinMobileNavIndicatorFrame(shell, indicator, buttons) {
      const speedRatio = Math.min(Math.abs(joinMobileNavIndicatorState.velocityX) / JOIN_MOBILE_NAV_PHYSICS.maxVelocity, 1);
      const moveScaleX = 1 + speedRatio * 0.075;
      const moveScaleY = 1 - speedRatio * 0.035;
      const scaleX = clampJoinMobileNavValue(moveScaleX + joinMobileNavIndicatorState.shapeX, 0.91, 1.12);
      const scaleY = clampJoinMobileNavValue(moveScaleY + joinMobileNavIndicatorState.shapeY, 0.92, 1.12);
      setJoinMobileNavIndicatorVars(shell, joinMobileNavIndicatorState.positionX, joinMobileNavIndicatorState.width);
      setJoinMobileNavIndicatorScaleVars(shell, scaleX, scaleY);
      updateJoinMobileNavIndicatorOverlap(shell, indicator, buttons, joinMobileNavIndicatorState.positionX, joinMobileNavIndicatorState.width, scaleX, scaleY);
    }

    function animateJoinMobileNavIndicator(now) {
      const shell = document.querySelector("#joinMobileBottomNav .join-mobile-bottom-nav-shell");
      const indicator = getJoinMobileNavIndicator(shell);
      if (!shell || !indicator) {
        stopJoinMobileNavIndicatorTracking();
        return;
      }
      const buttons = getJoinMobileNavButtons();
      const state = joinMobileNavIndicatorState;
      const dt = Math.min((now - (state.lastTime || now)) / 1000, 0.032);
      state.lastTime = now;

      if (state.targetButton) {
        const metrics = getJoinMobileNavTargetMetrics(shell, state.targetButton);
        if (metrics) {
          state.targetX = metrics.x;
          state.targetWidth = metrics.width;
        }
      }

      const previousDelta = state.targetX - state.positionX;
      const xSpring = applyJoinMobileNavSpring(
        state.positionX,
        state.velocityX,
        state.targetX,
        dt,
        JOIN_MOBILE_NAV_PHYSICS
      );
      state.positionX = xSpring.position;
      state.velocityX = xSpring.velocity;

      const widthSpring = applyJoinMobileNavSpring(
        state.width,
        state.widthVelocity,
        state.targetWidth,
        dt,
        { stiffness: 280, damping: 30, mass: 1, maxVelocity: 900 }
      );
      state.width = Math.max(0, widthSpring.position);
      state.widthVelocity = widthSpring.velocity;

      const nextDelta = state.targetX - state.positionX;
      const crossedTarget = previousDelta !== 0 && Math.sign(previousDelta) !== Math.sign(nextDelta);
      const nearTarget = Math.abs(nextDelta) < 0.75;
      if (state.moving && !state.impactStarted && (crossedTarget || nearTarget)) {
        startJoinMobileNavImpact(state.velocityX);
      }

      const shapeX = applyJoinMobileNavShapeSpring(state.shapeX, state.shapeVelocityX, dt);
      state.shapeX = shapeX.value;
      state.shapeVelocityX = shapeX.velocity;
      const shapeY = applyJoinMobileNavShapeSpring(state.shapeY, state.shapeVelocityY, dt);
      state.shapeY = shapeY.value;
      state.shapeVelocityY = shapeY.velocity;

      renderJoinMobileNavIndicatorFrame(shell, indicator, buttons);

      const positionSettled = Math.abs(state.targetX - state.positionX) < JOIN_MOBILE_NAV_PHYSICS.settlePosition;
      const velocitySettled = Math.abs(state.velocityX) < JOIN_MOBILE_NAV_PHYSICS.settleVelocity;
      const widthSettled = Math.abs(state.targetWidth - state.width) < 0.3 && Math.abs(state.widthVelocity) < 4;
      const shapeSettled = Math.abs(state.shapeX) < 0.001
        && Math.abs(state.shapeY) < 0.001
        && Math.abs(state.shapeVelocityX) < 0.02
        && Math.abs(state.shapeVelocityY) < 0.02;

      if (positionSettled && velocitySettled && widthSettled) {
        if (state.moving) {
          finishJoinMobileNavIndicatorMove(shell, indicator, buttons, state.targetButton);
        }
        if (shapeSettled) {
          state.shapeX = 0;
          state.shapeY = 0;
          state.shapeVelocityX = 0;
          state.shapeVelocityY = 0;
          setJoinMobileNavIndicatorScaleVars(shell, 1, 1);
          setJoinMobileNavActiveOverlayClip(shell, state.positionX, state.width, 1, 1);
          joinMobileNavIndicatorFrame = 0;
          return;
        }
      }

      joinMobileNavIndicatorFrame = window.requestAnimationFrame(animateJoinMobileNavIndicator);
    }

    function startJoinMobileNavIndicatorAnimation() {
      if (joinMobileNavIndicatorFrame) return;
      joinMobileNavIndicatorState.lastTime = performance.now();
      joinMobileNavIndicatorFrame = window.requestAnimationFrame(animateJoinMobileNavIndicator);
    }

    function cancelJoinMobileFindNavDeferredOpen() {
      if (!joinMobileFindNavOpenFrame) return;
      window.cancelAnimationFrame(joinMobileFindNavOpenFrame);
      joinMobileFindNavOpenFrame = 0;
    }

    function openCalendarSheetAfterJoinMobileFindNavMotion() {
      cancelJoinMobileFindNavDeferredOpen();
      if (document.getElementById("calendarSheet")?.classList.contains("open")) return;
      const isMobileViewport = window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
      if (!isMobileViewport) {
        openCalendarSheet();
        return;
      }
      const startedAt = performance.now();
      const maxDelayMs = 520;
      const openAfterMotion = () => {
        joinMobileFindNavOpenFrame = 0;
        const nav = document.getElementById("joinMobileBottomNav");
        if (nav?.dataset.mobileNavLayerKey !== "find") return;
        openCalendarSheet();
      };
      const waitForMotion = (now) => {
        const timedOut = now - startedAt >= maxDelayMs;
        if (!joinMobileNavIndicatorState.moving || timedOut) {
          joinMobileFindNavOpenFrame = window.requestAnimationFrame(openAfterMotion);
          return;
        }
        joinMobileFindNavOpenFrame = window.requestAnimationFrame(waitForMotion);
      };
      joinMobileFindNavOpenFrame = window.requestAnimationFrame(waitForMotion);
    }

    function updateJoinMobileNavIndicator(activeButton = null, options = {}) {
      const shell = document.querySelector("#joinMobileBottomNav .join-mobile-bottom-nav-shell");
      if (!shell) return;
      const buttons = getJoinMobileNavButtons();
      const candidate = activeButton instanceof Element ? activeButton : null;
      const target = candidate || shell.querySelector("#joinMobileBottomNavInactiveLayer [data-mobile-nav-key].is-active") || joinMobileNavIndicatorState.targetButton;
      const indicator = getJoinMobileNavIndicator(shell);
      if (options.clear || !target || !indicator) {
        stopJoinMobileNavIndicatorTracking();
        clearJoinMobileNavIndicatorOverlap(buttons);
        buttons.forEach((button) => button.classList.remove("is-active"));
        shell.classList.remove("has-active", "is-nav-indicator-moving");
        joinMobileNavIndicatorState.initialized = false;
        joinMobileNavIndicatorState.moving = false;
        joinMobileNavIndicatorState.targetButton = null;
        return;
      }

      const metrics = getJoinMobileNavTargetMetrics(shell, target);
      if (!metrics) return;
      const state = joinMobileNavIndicatorState;
      const hadActive = state.initialized && shell.classList.contains("has-active");
      const isSameSettledTarget = target.classList.contains("is-active") && !state.moving;
      const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      const shouldAnimate = Boolean(options.animate && hadActive && !isSameSettledTarget && !reducedMotion);

      if (!shouldAnimate) {
        state.initialized = true;
        state.moving = false;
        state.positionX = metrics.x;
        state.velocityX = 0;
        state.targetX = metrics.x;
        state.width = metrics.width;
        state.widthVelocity = 0;
        state.targetWidth = metrics.width;
        state.shapeX = 0;
        state.shapeY = 0;
        state.shapeVelocityX = 0;
        state.shapeVelocityY = 0;
        state.targetButton = target;
        state.impactStarted = false;
        setJoinMobileNavIndicatorVars(shell, metrics.x, metrics.width);
        setJoinMobileNavIndicatorScaleVars(shell, 1, 1);
        setJoinMobileNavActiveOverlayClip(shell, metrics.x, metrics.width, 1, 1);
        shell.classList.add("has-active");
        shell.classList.remove("is-nav-indicator-moving");
        clearJoinMobileNavIndicatorOverlap(buttons);
        buttons.forEach((button) => button.classList.toggle("is-active", button === target));
        return;
      }

      const nextDirection = Math.sign(metrics.x - state.positionX);
      const currentDirection = Math.sign(state.velocityX);
      if (nextDirection && currentDirection && nextDirection !== currentDirection) {
        state.velocityX *= 0.55;
      }
      state.initialized = true;
      state.moving = true;
      state.targetButton = target;
      state.targetX = metrics.x;
      state.targetWidth = metrics.width;
      state.impactStarted = false;
      shell.classList.add("has-active", "is-nav-indicator-moving");
      buttons.forEach((button) => button.classList.remove("is-active", "is-indicator-overlap"));
      startJoinMobileNavIndicatorAnimation();
    }

    function restoreJoinMobileBottomNavAfterNavModalClose() {
      const nav = document.getElementById("joinMobileBottomNav");
      const activeKey = nav?.dataset.mobileNavLayerKey
        || nav?.querySelector("[data-mobile-nav-key].is-active")?.dataset.mobileNavKey
        || "";
      const isNavModalKey = activeKey === "create" || activeKey === "find";
      if (!isNavModalKey || hasOpenBlockingModal()) return;
      setJoinMobileBottomNavLayerActive("");
      setJoinMobileBottomNavVisible(true, { force: true });
    }

    let joinMobileViewportUpdateFrame = 0;
    let joinMobileViewportUpdateTimers = [];
    let joinMobileMainScrollDirection = "";
    let joinMobileMainScrollY = window.scrollY || 0;

    function isJoinGoogleAppBrowser() {
      const ua = navigator.userAgent || "";
      return /(?:\bGSA\/|GoogleApp)/i.test(ua);
    }

    function updateJoinMobileViewportRootProperty(root, name, value) {
      const currentValue = root.style.getPropertyValue(name);
      if (value == null) {
        if (currentValue) root.style.removeProperty(name);
        return;
      }
      if (currentValue !== value) root.style.setProperty(name, value);
    }

    function updateJoinMobileVisualViewportVars() {
      const root = document.documentElement;
      const viewport = window.visualViewport;
      const isGoogleAppBrowser = isJoinGoogleAppBrowser();
      if (root.classList.contains("join-google-app-browser") !== isGoogleAppBrowser) {
        root.classList.toggle("join-google-app-browser", isGoogleAppBrowser);
      }
      if (window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640) {
        const visualEnd = viewport ? viewport.offsetTop + viewport.height : 0;
        const modalHeight = Math.ceil(Math.max(
          visualEnd,
          window.innerHeight || 0,
          document.documentElement.clientHeight || 0
        ));
        const modalHeightValue = `${modalHeight}px`;
        updateJoinMobileViewportRootProperty(root, "--join-mobile-visual-bottom", "0px");
        updateJoinMobileViewportRootProperty(root, "--join-mobile-visual-end", modalHeightValue);
        updateJoinMobileViewportRootProperty(root, "--join-mobile-modal-height", modalHeightValue);
        return;
      }
      let bottomGap = 0;
      if (viewport) {
        bottomGap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      }
      updateJoinMobileViewportRootProperty(root, "--join-mobile-visual-bottom", `${Math.round(bottomGap)}px`);
      updateJoinMobileViewportRootProperty(root, "--join-mobile-visual-end", null);
      updateJoinMobileViewportRootProperty(root, "--join-mobile-modal-height", null);
    }

    function requestJoinMobileVisualViewportVarsUpdate() {
      if (joinMobileViewportUpdateFrame) return;
      joinMobileViewportUpdateFrame = requestAnimationFrame(() => {
        joinMobileViewportUpdateFrame = 0;
        updateJoinMobileVisualViewportVars();
      });
    }

    function scheduleJoinMobileVisualViewportVarsUpdate(options = {}) {
      requestJoinMobileVisualViewportVarsUpdate();
      if (options?.settle !== true) return;
      joinMobileViewportUpdateTimers.forEach((timer) => clearTimeout(timer));
      joinMobileViewportUpdateTimers = [140, 360, 720].map((delay) => setTimeout(
        requestJoinMobileVisualViewportVarsUpdate,
        delay
      ));
    }

    function noteJoinMobileMainScrollDirection(delta, currentScrollY = window.scrollY || 0) {
      if (Math.abs(delta) <= 6) return;
      joinMobileMainScrollDirection = delta > 0 ? "down" : "up";
      joinMobileMainScrollY = currentScrollY;
    }

    function isJoinMobileChromeLikelyCollapsedForModal() {
      if (!(window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640)) return false;
      if (document.documentElement.classList.contains("modal-open") || document.body.classList.contains("modal-open")) {
        return document.documentElement.classList.contains("join-mobile-modal-chrome-collapsed");
      }
      const bottomNav = document.getElementById("joinMobileBottomNav");
      const bottomNavHidden = bottomNav?.classList.contains("is-hidden") || !bottomNav?.classList.contains("is-visible");
      if (isJoinGoogleAppBrowser() && bottomNavHidden && joinMobileMainScrollDirection !== "up" && (window.scrollY || joinMobileMainScrollY) > 80) return true;
      return joinMobileMainScrollDirection === "down" && joinMobileMainScrollY > 80;
    }

    function prepareJoinMobileFullscreenModalViewport() {
      scheduleJoinMobileVisualViewportVarsUpdate({ settle: true });
      document.documentElement.classList.toggle("join-mobile-modal-chrome-collapsed", isJoinMobileChromeLikelyCollapsedForModal());
    }

    function portalJoinMobileBottomNavToBody() {
      const nav = document.getElementById("joinMobileBottomNav");
      if (!nav || !document.body || nav.parentElement === document.body) return nav;
      document.body.appendChild(nav);
      return nav;
    }

    function initializeJoinMobileBottomNav() {
      const nav = portalJoinMobileBottomNavToBody();
      if (!nav) return;
      let lastScrollY = window.scrollY || 0;
      let lastTouchY = 0;
      let ticking = false;
      scheduleJoinMobileVisualViewportVarsUpdate();
      window.visualViewport?.addEventListener("resize", scheduleJoinMobileVisualViewportVarsUpdate, { passive: true });
      window.visualViewport?.addEventListener("scroll", scheduleJoinMobileVisualViewportVarsUpdate, { passive: true });
      window.addEventListener("resize", scheduleJoinMobileVisualViewportVarsUpdate, { passive: true });
      window.visualViewport?.addEventListener("resize", updateJoinMobileNavIndicator, { passive: true });
      window.addEventListener("resize", updateJoinMobileNavIndicator, { passive: true });
      setJoinMobileBottomNavVisible(true);
      requestAnimationFrame(() => {
        initializeJoinMobileNavIndicator();
        requestAnimationFrame(initializeJoinMobileNavIndicator);
      });
      const isMainPageNavScrollContext = () => !hasOpenBlockingModal()
        && !document.documentElement.classList.contains("modal-open")
        && !document.body.classList.contains("modal-open");
      const hideByScrollStart = () => {
        if ((window.scrollY || document.documentElement.scrollTop || 0) <= 80) {
          showByMainPageScrollUp();
          return;
        }
        setJoinMobileBottomNavVisible(false, { force: true, reason: "scroll" });
      };
      const showByMainPageScrollUp = () => {
        if (!isMainPageNavScrollContext()) return;
        setJoinMobileBottomNavLayerActive("");
        setJoinMobileBottomNavVisible(true, { force: true, reason: "scroll-up" });
      };
      const syncByScrollDirection = (delta, currentScrollY = window.scrollY || 0) => {
        if (currentScrollY <= 80) {
          showByMainPageScrollUp();
          return;
        }
        if (Math.abs(delta) <= 6) return;
        if (delta > 0) {
          hideByScrollStart();
        } else {
          showByMainPageScrollUp();
        }
      };
      window.addEventListener("wheel", (event) => {
        const deltaY = event.deltaY || 0;
        if (Math.abs(deltaY) <= 4) return;
        if (deltaY > 0) {
          hideByScrollStart();
        } else {
          showByMainPageScrollUp();
        }
      }, { passive: true });
      window.addEventListener("scroll", () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || 0;
          const delta = currentScrollY - lastScrollY;
          noteJoinMobileMainScrollDirection(delta, currentScrollY);
          syncByScrollDirection(delta, currentScrollY);
          lastScrollY = currentScrollY;
          ticking = false;
        });
      }, { passive: true });
      window.addEventListener("touchstart", (event) => {
        lastTouchY = event.touches?.[0]?.clientY || 0;
      }, { passive: true });
      window.addEventListener("touchmove", (event) => {
        const currentTouchY = event.touches?.[0]?.clientY || 0;
        if (!lastTouchY || !currentTouchY) return;
        const touchDelta = currentTouchY - lastTouchY;
        if (Math.abs(touchDelta) > 8) {
          if (touchDelta < 0) {
            hideByScrollStart();
          } else {
            showByMainPageScrollUp();
          }
          lastTouchY = currentTouchY;
        }
      }, { passive: true });
    }

    async function resumeJoinMyMenuAfterLogin() {
      const params = new URLSearchParams(location.search);
      const afterLogin = params.get("afterLogin");
      if (!["my-menu", "my-drawer", "builder", "apply", "detail", "detail-wish", "my-section", "profile-manage", "return-url"].includes(afterLogin)) return false;
      const applyJoinId = params.get("applyJoinId") || "";
      const joinApplyId = params.get("joinApplyId") || "";
      const wishJoinId = params.get("wishJoinId") || "";
      const joinId = params.get("joinId") || "";
      const scheduleId = params.get("scheduleId") || "";
      const targetScheduleId = params.get("targetScheduleId") || "";
      const targetApplicationId = params.get("targetApplicationId") || "";
      const applicationId = params.get("applicationId") || "";
      const sourceApplicationId = params.get("sourceApplicationId") || "";
      const productId = params.get("productId") || "";
      const goodSeq = params.get("goodSeq") || "";
      const eventSeq = params.get("eventSeq") || "";
      const builderAction = params.get("builderAction") || "";
      const builderProductId = params.get("builderProductId") || "";
      const productGroupKey = params.get("productGroupKey") || "";
      const countryKey = params.get("countryKey") || "";
      const golfjoinTab = afterLogin === "my-section"
        ? normalizeMyHomeJoinFilter(params.get("golfjoinTab"), "created")
        : normalizeJoinMyReservationTab(params.get("golfjoinTab"), "");
      const returnUrl = getJoinSafeReturnUrl(params.get("returnUrl") || "");
      params.delete("afterLogin");
      params.delete("applyJoinId");
      params.delete("joinApplyId");
      params.delete("wishJoinId");
      params.delete("joinId");
      params.delete("scheduleId");
      params.delete("targetScheduleId");
      params.delete("targetApplicationId");
      params.delete("applicationId");
      params.delete("sourceApplicationId");
      params.delete("productId");
      params.delete("goodSeq");
      params.delete("eventSeq");
      params.delete("builderAction");
      params.delete("builderProductId");
      params.delete("productGroupKey");
      params.delete("countryKey");
      params.delete("golfjoinTab");
      params.delete("returnUrl");
      const cleanQuery = params.toString();
      const cleanUrl = `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${location.hash || ""}`;
      history.replaceState(null, "", cleanUrl);
      if (!getJoinLoginState().isLogin) return false;
      if (afterLogin !== "return-url") {
        const readyMember = await ensureJoinMemberProfileReady(afterLogin, {
          applyJoinId,
          joinApplyId,
          wishJoinId,
          joinId,
          scheduleId,
          targetScheduleId,
          targetApplicationId,
          applicationId,
          sourceApplicationId,
          productId,
          goodSeq,
          eventSeq,
          builderAction,
          builderProductId,
          productGroupKey,
          countryKey,
          golfjoinTab
        }, { refresh: true });
        if (!readyMember) return true;
      }
      if (afterLogin === "return-url" && returnUrl) {
        location.href = returnUrl;
        return true;
      }
      if (afterLogin === "detail-wish") {
        await continueDetailWishAfterLogin(wishJoinId ? { wishJoinId } : {});
        return true;
      }
      if (afterLogin === "detail") {
        await continueJoinExternalDetailAfterLogin({ joinId, scheduleId, productId, goodSeq, eventSeq });
        return true;
      }
      if (afterLogin === "my-section") {
        const mySectionParams = {
          joinId,
          scheduleId,
          targetScheduleId,
          targetApplicationId,
          applicationId,
          sourceApplicationId,
          golfjoinTab
        };
        const opened = await continueMyHomeJoinDeepLinkAfterLogin(mySectionParams);
        if (!opened) {
          const retryParams = new URLSearchParams(location.search);
          retryParams.set("golfjoinOpen", "my-section");
          Object.entries(mySectionParams).forEach(([key, value]) => {
            if (value != null && value !== "") retryParams.set(key, value);
          });
          const retryQuery = retryParams.toString();
          history.replaceState(null, "", `${location.pathname}${retryQuery ? `?${retryQuery}` : ""}${location.hash || ""}`);
        }
        return true;
      }
      if (afterLogin === "profile-manage") {
        await openJoinProfileManageModal();
        return true;
      }
      if (afterLogin === "builder") {
        await continueBuilderAfterLogin({ builderAction, builderProductId, productGroupKey, countryKey });
        return true;
      }
      if (afterLogin === "apply") {
        if (applyJoinId) currentDetailJoinId = applyJoinId;
        openGlobalApply();
        return true;
      }
      if (afterLogin === "my-menu") {
        setJoinMobileNavActive("my");
        await openJoinMyMenu({ tab: golfjoinTab });
        return true;
      }
      handleJoinMyButtonClick();
      return true;
    }

    function getJoinExternalDeepLinkTarget() {
      const params = new URLSearchParams(location.search);
      const openTarget = (params.get("golfjoinOpen") || params.get("joinOpen") || "").trim().toLowerCase();
      if (["my", "my-menu", "my-reservation", "my-reservations", "reservations"].includes(openTarget)) {
        return "my-menu";
      }
      if (["my-section", "my-join", "my-home"].includes(openTarget)) {
        return "my-section";
      }
      if (["detail", "product", "join-detail", "schedule"].includes(openTarget)) {
        return "detail";
      }
      const hashTarget = decodeURIComponent((location.hash || "").replace(/^#/, "")).trim().toLowerCase();
      if (["golfjoin-my", "golfjoin-my-menu", "golfjoin-my-reservation", "golfjoin-my-reservations"].includes(hashTarget)) {
        return "my-menu";
      }
      return "";
    }

    function clearJoinExternalDeepLinkTarget() {
      const params = new URLSearchParams(location.search);
      params.delete("golfjoinOpen");
      params.delete("joinOpen");
      params.delete("joinId");
      params.delete("scheduleId");
      params.delete("targetScheduleId");
      params.delete("targetApplicationId");
      params.delete("applicationId");
      params.delete("sourceApplicationId");
      params.delete("joinApplyId");
      params.delete("productId");
      params.delete("goodSeq");
      params.delete("eventSeq");
      params.delete("golfjoinTab");
      const hashTarget = decodeURIComponent((location.hash || "").replace(/^#/, "")).trim().toLowerCase();
      const shouldClearHash = ["golfjoin-my", "golfjoin-my-menu", "golfjoin-my-reservation", "golfjoin-my-reservations"].includes(hashTarget);
      const cleanQuery = params.toString();
      const cleanUrl = `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${shouldClearHash ? "" : (location.hash || "")}`;
      history.replaceState(null, "", cleanUrl);
    }

    function getJoinCanonicalPageUrl() {
      const url = new URL(location.href);
      [
        "golfjoinOpen",
        "joinOpen",
        "joinId",
        "scheduleId",
        "targetScheduleId",
        "targetApplicationId",
        "applicationId",
        "sourceApplicationId",
        "joinApplyId",
        "productId",
        "goodSeq",
        "eventSeq",
        "golfjoinTab",
        "afterLogin",
        "applyJoinId",
        "wishJoinId",
        "builderAction",
        "builderProductId",
        "productGroupKey",
        "countryKey",
        "returnUrl"
      ].forEach((key) => url.searchParams.delete(key));
      return url.toString();
    }

    function getJoinDeepLinkParam(params, key) {
      if (!params) return "";
      if (typeof params.get === "function") return String(params.get(key) || "").trim();
      return String(params[key] || "").trim();
    }

    function getJoinDeepLinkIdentityValues(join = {}) {
      return [
        join.id,
        join.scheduleId,
        join.sourceApplicationId,
        join.applicationId,
        join.targetScheduleId,
        join.targetApplicationId,
        getNestedValue(join.sheetApplication || {}, "scheduleId"),
        getNestedValue(join.sheetApplication || {}, "applicationId")
      ].map((value) => String(value || "").trim()).filter(Boolean);
    }

    function findJoinExternalDeepLinkDetailTarget(params = new URLSearchParams(location.search)) {
      const sources = [
        ...joins,
        ...(homeGolfJoinProducts || []),
        ...(externalGolfJoinProducts || [])
      ];
      const joinId = String(getJoinDeepLinkParam(params, "joinId") || getJoinDeepLinkParam(params, "scheduleId") || "").trim();
      if (joinId) {
        const direct = sources.find((item) => getJoinDeepLinkIdentityValues(item).includes(joinId));
        if (direct && shouldDisplayJoinProduct(direct)) return direct;
      }
      const productId = String(getJoinDeepLinkParam(params, "productId") || getJoinDeepLinkParam(params, "goodSeq") || "").trim();
      const eventSeq = String(getJoinDeepLinkParam(params, "eventSeq") || "").trim();
      if (!productId) return null;
      return sources.find((item) => {
        if (!shouldDisplayJoinProduct(item)) return false;
        const parsedReference = parseSecretTourProductReference(item.id || item.erpProductId || "", item.eventSeq || item.erpEventSeq || "");
        const itemGoodSeq = String(item.goodSeq || parsedReference.goodSeq || item.erpProductId || "").trim();
        const itemEventSeq = String(item.eventSeq || parsedReference.eventSeq || item.erpEventSeq || "").trim();
        if (String(item.id || "") === productId || String(item.productId || "") === productId) return !eventSeq || itemEventSeq === eventSeq;
        if (itemGoodSeq !== productId) return false;
        return !eventSeq || itemEventSeq === eventSeq;
      }) || null;
    }

    async function openJoinExternalDeepLinkDetailTarget(join) {
      if (!join) return false;
      setJoinMobileNavActive("");
      setJoinMobileBottomNavLayerActive("");
      closeJoinMyMenu?.();
      if (joins.some((item) => item === join || item.id === join.id)) {
        openDetail(join.id);
      } else {
        await showMdPickDetailProduct(join, getProductGroupKey(join), getMdPickProductCountryKey(join));
      }
      return true;
    }

    async function continueJoinExternalDetailAfterLogin(params = {}) {
      let join = findJoinExternalDeepLinkDetailTarget(params);
      if (!join) {
        await ensureHomeGolfJoinProductsLoaded();
        join = findJoinExternalDeepLinkDetailTarget(params);
      }
      if (!join) {
        await ensureExternalGolfJoinProductsLoaded();
        join = findJoinExternalDeepLinkDetailTarget(params);
      }
      if (!join) return false;
      return openJoinExternalDeepLinkDetailTarget(join);
    }

    function findMyHomeJoinDeepLinkTarget(params = new URLSearchParams(location.search)) {
      const targetId = [
        "scheduleId",
        "targetScheduleId",
        "joinId",
        "sourceApplicationId",
        "targetApplicationId",
        "applicationId"
      ].map((key) => getJoinDeepLinkParam(params, key)).find(Boolean) || "";
      if (!targetId) return null;
      return getMyHomeJoinItems().find((join) => getJoinDeepLinkIdentityValues(join).includes(targetId)) || null;
    }

    async function openMyHomeJoinDeepLinkTarget(join, filter = "created") {
      if (!join) return false;
      const normalizedFilter = normalizeMyHomeJoinFilter(filter, "created");
      let targetPageScrollState = null;
      renderJoins({ skipQuickMobileCarousel: true });
      setMyJoinFilter(normalizedFilter);
      const section = document.getElementById("join-section-my");
      if (section) {
        const nav = document.getElementById("joinSectionNav");
        const offset = getJoinSectionNavScrollOffset(nav);
        const top = section.getBoundingClientRect().top + window.scrollY - offset;
        targetPageScrollState = {
          top: Math.max(0, top),
          left: window.scrollX || 0
        };
        restorePageScrollState(targetPageScrollState);
        setJoinSectionNavActive("my");
      }
      setJoinMobileNavActive("");
      setJoinMobileBottomNavLayerActive("");
      closeJoinMyMenu?.();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      openDetail(join.id, { allowUnavailable: true, pageScrollState: targetPageScrollState });
      return true;
    }

    async function continueMyHomeJoinDeepLinkAfterLogin(params = {}) {
      let join = findMyHomeJoinDeepLinkTarget(params);
      if (!join) {
        await ensureHomeGolfJoinProductsLoaded();
        join = findMyHomeJoinDeepLinkTarget(params);
      }
      if (!join) return false;
      return openMyHomeJoinDeepLinkTarget(
        join,
        normalizeMyHomeJoinFilter(getJoinDeepLinkParam(params, "golfjoinTab"), "created")
      );
    }

    async function resumeJoinExternalDeepLinkOnce() {
      const target = getJoinExternalDeepLinkTarget();
      if (!target) return false;
      if (target === "my-menu") {
        const params = new URLSearchParams(location.search);
        const reservationTab = normalizeJoinMyReservationTab(params.get("golfjoinTab"), "created");
        const loginParams = getJoinAfterLoginExtraParams(params);
        loginParams.golfjoinTab = reservationTab;
        clearJoinExternalDeepLinkTarget();
        setJoinMobileNavActive("my");
        if (!requireJoinLogin("my-menu", loginParams)) return true;
        await openJoinMyMenu({ tab: reservationTab });
        return true;
      }
      if (target === "detail") {
        if (!getJoinLoginState().isLogin) {
          const params = new URLSearchParams(location.search);
          const loginParams = {
            joinId: params.get("joinId") || "",
            scheduleId: params.get("scheduleId") || "",
            productId: params.get("productId") || "",
            goodSeq: params.get("goodSeq") || "",
            eventSeq: params.get("eventSeq") || ""
          };
          clearJoinExternalDeepLinkTarget();
          requireJoinLogin("detail", loginParams);
          return true;
        }
        let join = findJoinExternalDeepLinkDetailTarget();
        if (!join) {
          await ensureHomeGolfJoinProductsLoaded();
          join = findJoinExternalDeepLinkDetailTarget();
        }
        if (!join) {
          await ensureExternalGolfJoinProductsLoaded();
          join = findJoinExternalDeepLinkDetailTarget();
        }
        if (!join) return false;
        clearJoinExternalDeepLinkTarget();
        return openJoinExternalDeepLinkDetailTarget(join);
      }
      if (target === "my-section") {
        const params = new URLSearchParams(location.search);
        const filter = normalizeMyHomeJoinFilter(params.get("golfjoinTab"), "created");
        const loginParams = getJoinAfterLoginExtraParams(params);
        loginParams.golfjoinTab = filter;
        if (!getJoinLoginState().isLogin) {
          clearJoinExternalDeepLinkTarget();
          requireJoinLogin("my-section", loginParams);
          return true;
        }
        const opened = await continueMyHomeJoinDeepLinkAfterLogin(loginParams);
        if (!opened) return false;
        clearJoinExternalDeepLinkTarget();
        return true;
      }
      return false;
    }

    let joinExternalDeepLinkResumePromise = null;

    async function resumeJoinExternalDeepLink() {
      if (joinExternalDeepLinkResumePromise) return joinExternalDeepLinkResumePromise;
      joinExternalDeepLinkResumePromise = resumeJoinExternalDeepLinkOnce();
      try {
        return await joinExternalDeepLinkResumePromise;
      } finally {
        joinExternalDeepLinkResumePromise = null;
      }
    }

    async function resumeJoinKakaoProfileAfterLogin() {
      const params = new URLSearchParams(location.search);
      const requested = params.get("afterLogin") === "kakao-profile";
      const pending = getJoinPendingKakaoProfile();
      if (!requested) return false;
      params.delete("afterLogin");
      const cleanQuery = params.toString();
      const cleanUrl = `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${location.hash || ""}`;
      history.replaceState(null, "", cleanUrl);
      if (!getJoinLoginState().isLogin || !pending.kakaoId) return false;
      const member = await getJoinCurrentMember({ refresh: true });
      if (member && isJoinMemberProfileComplete(member)) {
        clearJoinPendingKakaoProfile();
        continueAfterJoinMemberLogin(joinMyMenuState.pendingAfterLogin || "my-menu");
        return true;
      }
      const continued = await continueWithExistingKakaoProfileIfReady({
        id: pending.kakaoId,
        properties: { nickname: pending.nickname || "" },
        kakao_account: {
          name: pending.name || "",
          email: pending.email || "",
          profile: { nickname: pending.nickname || "" }
        }
      });
      if (continued) return true;
      openJoinMemberKakaoProfileForm(member || {});
      return true;
    }

    const HERO_OCTOBER_MONTHLY_SCHEDULE_ID = "rs-30001279-30285966";


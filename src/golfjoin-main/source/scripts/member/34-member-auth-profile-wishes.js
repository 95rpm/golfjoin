    function getRenderedCookieDataString() {
      // CookieData is server-rendered into this document and does not change
      // without a navigation. Re-reading documentElement.innerHTML for every
      // card/member check copies and scans the entire embedded page repeatedly.
      if (renderedCookieDataStringCache !== undefined) return renderedCookieDataStringCache;
      // The golf-join script can execute before the outer event page finishes
      // parsing. If CookieData is emitted later in that same document, keep the
      // loading-time miss cheap and allow exactly one fresh scan after parsing.
      if (document.readyState === "loading" && renderedCookieDataStringScannedWhileLoading) return "";
      const html = document.documentElement?.innerHTML || "";
      const match = html.match(/CookieData\(([^)]*(?:userSeq|userId)[^)]*)\)/);
      if (match) {
        renderedCookieDataStringCache = `CookieData(${match[1]})`;
        return renderedCookieDataStringCache;
      }
      if (document.readyState === "loading") {
        renderedCookieDataStringScannedWhileLoading = true;
        if (!renderedCookieDataStringRescanScheduled) {
          renderedCookieDataStringRescanScheduled = true;
          document.addEventListener("DOMContentLoaded", () => {
            renderedCookieDataStringCache = undefined;
            renderedCookieDataStringScannedWhileLoading = false;
            renderedCookieDataStringRescanScheduled = false;
          }, { once: true });
        }
        return "";
      }
      renderedCookieDataStringCache = "";
      return renderedCookieDataStringCache;
    }

    function waitForRenderedCookieDataReady() {
      if (document.readyState !== "loading") return Promise.resolve();
      return new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      });
    }

    function parseJoinCookieData(raw = getRenderedCookieDataString()) {
      const body = (String(raw || "").match(/CookieData\(([^)]*)\)/) || [])[1] || "";
      const fields = {};
      body.split(",").forEach((part) => {
        const index = part.indexOf("=");
        if (index < 0) return;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (key) fields[key] = value;
      });
      return {
        memberSeq: fields.userSeq || "",
        memberId: fields.userId || "",
        memberName: fields.userNm || "",
        memberChannel: fields.userChnCd || "",
        memberMobile: "",
        memberEmail: "",
        gender: "",
        birthday: ""
      };
    }

    function getJoinTempAdminMember() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(JOIN_TEMP_ADMIN_LOGIN_KEY) || "null");
        return saved?.isTempAdmin ? {
          ...saved,
          gender: saved.gender || "남성",
          birthday: saved.birthday || "1969"
        } : null;
      } catch (error) {
        return null;
      }
    }

    function setJoinTempAdminMember() {
      clearJoinLogoutMarker();
      const member = {
        memberSeq: "TEMP_ADMIN",
        memberId: "admin@admin.com",
        memberName: "관리자",
        memberChannel: "TEMP",
        memberMobile: "01000000000",
        memberEmail: "admin@admin.com",
        gender: "남성",
        birthday: "1969",
        isTempAdmin: true
      };
      try {
        sessionStorage.setItem(JOIN_TEMP_ADMIN_LOGIN_KEY, JSON.stringify(member));
      } catch (error) {
        golfJoinSafeWarn("Failed to store temp admin login.", error);
      }
      return member;
    }

    function isJoinTempAdminMember(member = getJoinCachedCurrentMember?.()) {
      return Boolean(
        member?.isTempAdmin
        || String(member?.memberSeq || "").trim() === "TEMP_ADMIN"
        || String(member?.memberId || "").trim().toLowerCase() === "admin@admin.com"
      );
    }

    function getJoinSessionMember() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(JOIN_SESSION_MEMBER_KEY) || "null");
        return saved?.isSessionMember ? saved : null;
      } catch (error) {
        return null;
      }
    }

    function setJoinSessionMember(member = {}) {
      clearJoinLogoutMarker();
      const sessionMember = {
        memberSeq: member.memberSeq || "",
        memberId: member.memberId || "",
        memberName: member.memberName || "",
        memberChannel: member.memberChannel || "HOME",
        memberMobile: member.memberMobile || "",
        memberEmail: member.memberEmail || "",
        kakaoId: member.kakaoId || "",
        kakaoNickname: member.kakaoNickname || "",
        gender: member.gender || "",
        birthday: member.birthday || "",
        birthYear: member.birthYear || "",
        profession: member.profession || "",
        level: member.level || "",
        travelStyles: member.travelStyles || member.styles || "",
        profileImageUrl: member.profileImageUrl || "",
        profileThumbnailUrl: member.profileThumbnailUrl || member.profileImageUrl || "",
        profileImageObjectName: member.profileImageObjectName || "",
        profileImageMimeType: member.profileImageMimeType || "",
        profileImageSize: member.profileImageSize || "",
        profileImageUpdatedAt: member.profileImageUpdatedAt || "",
        erpSessionDocumentId: JOIN_AUTH_DOCUMENT_ID,
        erpSessionVerifiedAt: Date.now(),
        isSessionMember: true,
        ...(typeof member.profileComplete === "boolean"
          ? { profileComplete: member.profileComplete, profileCompleteCheckedAt: Date.now() }
          : (isJoinMemberProfileComplete(member) ? { profileComplete: true, profileCompleteCheckedAt: Date.now() } : {}))
      };
      try {
        sessionStorage.setItem(JOIN_SESSION_MEMBER_KEY, JSON.stringify(sessionMember));
      } catch (error) {
        golfJoinSafeWarn("Failed to store join session member.", error);
      }
      joinMyMenuState.memberPromise = Promise.resolve(sessionMember);
      clearActiveJoinMySchedulesCache();
      return sessionMember;
    }

    function getJoinLoginState() {
      const raw = getRenderedCookieDataString();
      if (isJoinLoggedOutFromRenderedCookie(raw)) {
        return { isLogin: false, member: {} };
      }
      const sessionMember = getJoinSessionMember();
      if (sessionMember?.erpSessionDocumentId === JOIN_AUTH_DOCUMENT_ID) {
        return { isLogin: true, member: sessionMember };
      }
      const member = parseJoinCookieData(raw);
      const isLogin = Boolean(raw && (member.memberSeq || member.memberId));
      if (!isLogin) {
        const tempAdmin = getJoinTempAdminMember();
        if (tempAdmin) return { isLogin: true, member: tempAdmin };
      }
      return { isLogin, member };
    }

    function setJoinLogoutMarker() {
      try {
        sessionStorage.setItem(JOIN_LOGOUT_MARKER_KEY, JSON.stringify({
          renderedCookieData: getRenderedCookieDataString() || "logged-out",
          documentId: JOIN_AUTH_DOCUMENT_ID
        }));
      } catch (error) {
        golfJoinSafeWarn("Failed to store join logout marker.", error);
      }
    }

    function clearJoinLogoutMarker() {
      try {
        sessionStorage.removeItem(JOIN_LOGOUT_MARKER_KEY);
      } catch (error) {
        golfJoinSafeWarn("Failed to clear join logout marker.", error);
      }
    }

    function isJoinLoggedOutFromRenderedCookie(raw = getRenderedCookieDataString()) {
      try {
        const marker = JSON.parse(sessionStorage.getItem(JOIN_LOGOUT_MARKER_KEY) || "null");
        return Boolean(
          marker?.documentId === JOIN_AUTH_DOCUMENT_ID
          && marker?.renderedCookieData === (raw || "logged-out")
        );
      } catch (error) {
        return false;
      }
    }

    function buildJoinAfterLoginPageUrl(afterLogin = "my-menu", extraParams = {}) {
      const redirectUrl = new URL(location.href);
      redirectUrl.searchParams.set("afterLogin", afterLogin);
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value == null || value === "") return;
        redirectUrl.searchParams.set(key, value);
      });
      return redirectUrl.toString();
    }

    function buildJoinLoginRedirectUrl(afterLogin = "my-menu", extraParams = {}) {
      const redirectUrl = buildJoinAfterLoginPageUrl(afterLogin, extraParams);
      return `https://www.secret-tour.com/member/login?redirect=${encodeURIComponent(redirectUrl.toString())}`;
    }

    function buildJoinSignupRedirectUrl(afterLogin = "my-menu", extraParams = {}) {
      const redirectUrl = buildJoinAfterLoginPageUrl(afterLogin, extraParams);
      return `https://www.secret-tour.com/member/join_pay?redirect=${encodeURIComponent(redirectUrl.toString())}`;
    }

    function getJoinAfterLoginExtraParams(params = new URLSearchParams()) {
      const keys = [
        "applyJoinId",
        "joinApplyId",
        "wishJoinId",
        "joinId",
        "scheduleId",
        "targetScheduleId",
        "targetApplicationId",
        "applicationId",
        "sourceApplicationId",
        "productId",
        "goodSeq",
        "eventSeq",
        "builderAction",
        "builderProductId",
        "productGroupKey",
        "countryKey",
        "golfjoinTab",
        "returnUrl"
      ];
      return keys.reduce((acc, key) => {
        const value = params.get(key) || "";
        if (value) acc[key] = value;
        return acc;
      }, {});
    }

    function getJoinSafeReturnUrl(returnUrl = "") {
      const rawReturnUrl = String(returnUrl || "").trim();
      if (!rawReturnUrl) return "";
      try {
        const url = new URL(rawReturnUrl, location.origin);
        const allowedHosts = new Set([location.hostname, "www.secret-tour.com", "m.secret-tour.com", "secret-tour.com"].filter(Boolean));
        if (!["http:", "https:"].includes(url.protocol)) return "";
        if (!allowedHosts.has(url.hostname)) return "";
        return url.toString();
      } catch (error) {
        return "";
      }
    }

    function getJoinLoginRedirectTarget() {
      const returnUrl = getJoinSafeReturnUrl(joinMyMenuState.pendingLoginParams?.returnUrl || "");
      if (returnUrl) return returnUrl;
      return buildJoinAfterLoginPageUrl(
        joinMyMenuState.pendingAfterLogin || "my-menu",
        joinMyMenuState.pendingLoginParams || {}
      );
    }

    function showJoinMemberSignupComplete(action = "continue") {
      joinMyMenuState.loginRedirecting = false;
      joinMyMenuState.signupCompleteAction = action;
      setJoinMemberLoginStatus("");
      setJoinMemberSignupStep(7);
      renderJoinMemberSignupConfetti();
    }

    function continueJoinMemberSignupComplete() {
      const action = joinMyMenuState.signupCompleteAction || "continue";
      joinMyMenuState.signupCompleteAction = "continue";
      if (action === "login") {
        location.href = buildJoinLoginRedirectUrl(
          joinMyMenuState.pendingAfterLogin || "my-menu",
          joinMyMenuState.pendingLoginParams || {}
        );
        return;
      }
      continueAfterJoinMemberLogin(joinMyMenuState.pendingAfterLogin || "my-menu");
    }

    function finishJoinMemberSignupAndContinue(member = {}, profile = {}) {
      const completedMember = mergeJoinMemberWithProfile(member, profile);
      const sessionMember = setJoinSessionMember({
        ...completedMember,
        profileComplete: true
      });
      rememberJoinMemberProfileLocally(sessionMember, profile);
      rememberJoinMemberProfileCompletion(sessionMember, isJoinMemberProfileComplete(sessionMember));
      setJoinMemberLoginStatus("");
      continueAfterJoinMemberLogin(joinMyMenuState.pendingAfterLogin || "my-menu");
    }

    function setJoinMemberLoginStatus(message = "") {
      const status = document.getElementById("joinMemberLoginStatus");
      if (status) status.textContent = message;
    }

    function showJoinMemberSignupAlert(message = "", focusTargetId = "") {
      const alert = document.getElementById("joinMemberSignupAlert");
      const messageEl = document.getElementById("joinMemberSignupAlertMessage");
      if (!alert) {
        window.alert(message);
        return;
      }
      alert.dataset.focusTarget = focusTargetId || "";
      if (messageEl) messageEl.textContent = message;
      alert.hidden = false;
      alert.classList.add("is-open");
      requestAnimationFrame(() => alert.querySelector("button")?.focus());
    }

    function closeJoinMemberSignupAlert() {
      const alert = document.getElementById("joinMemberSignupAlert");
      if (!alert) return;
      const focusTargetId = alert.dataset.focusTarget || "";
      alert.classList.remove("is-open");
      alert.hidden = true;
      if (focusTargetId) requestAnimationFrame(() => document.getElementById(focusTargetId)?.focus());
    }

    function createJoinMemberApiError(message, details = {}) {
      const error = new Error(message);
      Object.assign(error, details);
      return error;
    }

    function summarizeJoinMemberApiResponse(data) {
      if (!data || typeof data !== "object") return "";
      return data.message || data.resultMessage || data.msg || data.error || data.result || "";
    }

    function findJoinApiStringValue(source, candidateKeys = []) {
      const keys = new Set(candidateKeys.map((key) => String(key).toLowerCase()));
      const visited = new Set();
      const queue = [source];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== "object" || visited.has(item)) continue;
        visited.add(item);
        if (Array.isArray(item)) {
          item.forEach((entry) => queue.push(entry));
          continue;
        }
        for (const [key, value] of Object.entries(item)) {
          if (keys.has(String(key).toLowerCase()) && value != null && String(value).trim()) {
            return String(value).trim();
          }
        }
        Object.values(item).forEach((value) => {
          if (value && typeof value === "object") queue.push(value);
        });
      }
      return "";
    }

    function buildJoinErpMemberFromLoginResponse(data = {}, kakaoResponse = {}) {
      const kakaoId = String(kakaoResponse?.id || "").trim();
      const memberSeq = findJoinApiStringValue(data, ["memberSeq", "userSeq", "custSeq", "custNo", "mberSeq"]);
      const memberId = findJoinApiStringValue(data, ["memberId", "userId", "custId", "loginId", "mberId"]);
      const memberName = findJoinApiStringValue(data, ["memberName", "userNm", "custNm", "memberNm", "mberNm", "custName", "userName"]);
      const memberMobile = normalizeJoinMemberPhone(findJoinApiStringValue(data, ["memberMobile", "mobile", "mobileNo", "hpNo", "phone", "telNo"]));
      const memberEmail = findJoinApiStringValue(data, ["memberEmail", "email", "emailAddr", "userEmail", "custEmail"]);
      return {
        memberSeq,
        memberId: memberId || kakaoId,
        memberName,
        memberChannel: "KAKAO",
        memberMobile,
        memberEmail: memberEmail || kakaoResponse?.kakao_account?.email || "",
        kakaoId,
        kakaoNickname: kakaoResponse?.properties?.nickname || kakaoResponse?.kakao_account?.profile?.nickname || ""
      };
    }

    function postJoinMemberLoginForm(url, data, options = {}) {
      const body = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => body.set(key, value == null ? "" : String(value)));
      const controller = new AbortController();
      const timeoutMs = Math.max(3000, Number(options.timeoutMs || 15000));
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
      return fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: body.toString(),
        signal: controller.signal
      }).then(async (response) => {
        const text = await response.text();
        if (!response.ok) {
          throw createJoinMemberApiError(`요청 처리에 실패했습니다. (${response.status})`, {
            endpoint: url,
            status: response.status,
            responseText: text.slice(0, 300)
          });
        }
        try {
          return JSON.parse(text);
        } catch (error) {
          throw createJoinMemberApiError(`응답을 확인하지 못했습니다. (${response.status})`, {
            endpoint: url,
            status: response.status,
            responseText: text.slice(0, 300)
          });
        }
      }).catch((error) => {
        if (error?.name === "AbortError") {
          throw createJoinMemberApiError("회원정보 확인 시간이 초과되었습니다.", {
            endpoint: url,
            code: "member_api_timeout"
          });
        }
        throw error;
      }).finally(() => {
        window.clearTimeout(timeout);
      });
    }

    function ensureJoinKakaoSdk() {
      if (window.Kakao?.Auth) return Promise.resolve(window.Kakao);
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src*="developers.kakao.com/sdk/js/kakao.min.js"]');
        if (existing) {
          existing.addEventListener("load", () => resolve(window.Kakao), { once: true });
          existing.addEventListener("error", reject, { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = "https://developers.kakao.com/sdk/js/kakao.min.js";
        script.onload = () => resolve(window.Kakao);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    function getJoinKakaoProfileReturnUrl() {
      const url = new URL(location.href);
      url.searchParams.set("afterLogin", "kakao-profile");
      return url.toString();
    }

    function nowKstISOString() {
      const date = new Date(Date.now() + 9 * 60 * 60 * 1000);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}:${String(date.getUTCSeconds()).padStart(2, "0")}+09:00`;
    }

    function isJoinLocalDevHost() {
      return /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(location.hostname || "");
    }

    function isKakaoTalkInAppBrowser() {
      return /KAKAOTALK/i.test(navigator.userAgent || "");
    }

    function markPendingJoinKakaoProfile(kakaoResponse = {}, authObj = {}) {
      const kakaoPhone = normalizeJoinMemberPhone(kakaoResponse?.kakao_account?.phone_number || "");
      joinMyMenuState.pendingKakaoSignup = {
        kakaoId: kakaoResponse?.id || "",
        name: kakaoResponse?.kakao_account?.name || "",
        nickname: kakaoResponse?.properties?.nickname || kakaoResponse?.kakao_account?.profile?.nickname || "",
        email: kakaoResponse?.kakao_account?.email || "",
        phone: kakaoPhone,
        channel: "KAKAO",
        accessToken: authObj?.access_token || ""
      };
      try {
        sessionStorage.setItem("joinPendingKakaoProfile", JSON.stringify({
          createdAt: nowKstISOString(),
          kakaoId: kakaoResponse?.id || "",
          name: kakaoResponse?.kakao_account?.name || "",
          nickname: kakaoResponse?.properties?.nickname || kakaoResponse?.kakao_account?.profile?.nickname || "",
          email: kakaoResponse?.kakao_account?.email || "",
          phone: kakaoPhone,
          returnUrl: getJoinKakaoProfileReturnUrl()
        }));
      } catch (error) {
        golfJoinSafeWarn("Failed to store pending Kakao profile state.", error);
      }
    }

    async function continueWithExistingKakaoProfileIfReady(kakaoResponse = {}, options = {}) {
      const kakaoId = String(kakaoResponse?.id || "").trim();
      if (!kakaoId) return false;
      const erpMember = options.member || {};
      const kakaoPhone = normalizeJoinMemberPhone(kakaoResponse?.kakao_account?.phone_number || "");
      const member = {
        memberSeq: erpMember.memberSeq || "",
        memberId: erpMember.memberId || kakaoId,
        memberName: erpMember.memberName || kakaoResponse?.kakao_account?.name || "",
        memberChannel: "KAKAO",
        memberMobile: erpMember.memberMobile || kakaoPhone,
        memberEmail: erpMember.memberEmail || kakaoResponse?.kakao_account?.email || "",
        kakaoId,
        kakaoNickname: kakaoResponse?.properties?.nickname || kakaoResponse?.kakao_account?.profile?.nickname || ""
      };
      const profile = await fetchJoinMemberProfileFromGoogleSheet(member);
      const mergedMember = mergeJoinMemberWithProfile(member, profile);
      if (!isJoinMemberProfileComplete(mergedMember)) return false;
      rememberJoinMemberProfileLocally(member, profile);
      clearJoinPendingKakaoProfile();
      finishJoinMemberSignupAndContinue(mergedMember, profile);
      return true;
    }

    function openLocalKakaoProfileRequiredForm(kakaoResponse = {}, authObj = {}) {
      markPendingJoinKakaoProfile(kakaoResponse, authObj);
      const kakaoPhone = normalizeJoinMemberPhone(kakaoResponse?.kakao_account?.phone_number || "");
      openJoinMemberRequiredProfileForm({
        memberSeq: "",
        memberId: String(kakaoResponse?.id || "").trim(),
        memberName: kakaoResponse?.kakao_account?.name || "",
        memberChannel: "KAKAO",
        memberMobile: kakaoPhone,
        memberEmail: kakaoResponse?.kakao_account?.email || "",
        kakaoId: String(kakaoResponse?.id || "").trim(),
        kakaoNickname: kakaoResponse?.properties?.nickname || kakaoResponse?.kakao_account?.profile?.nickname || ""
      }, joinMyMenuState.pendingAfterLogin || "my-menu", joinMyMenuState.pendingLoginParams || {});
      setJoinMemberLoginStatus("");
    }

    async function submitJoinMemberKakaoLogin() {
      if (joinMyMenuState.loginRedirecting) return;
      joinMyMenuState.loginRedirecting = true;
      setJoinMemberLoginStatus("");
      try {
        if (canUseSecretTourMemberApi()) {
          await prepareJoinMemberSaveSession("010");
        }
        const KakaoSdk = await ensureJoinKakaoSdk();
        if (!KakaoSdk) throw new Error("Kakao SDK unavailable");
        if (!KakaoSdk.isInitialized?.()) {
          KakaoSdk.init(JOIN_KAKAO_JS_KEY);
        }
        await new Promise((resolve) => {
          const finish = () => resolve();
          const reopenLoginWithStatus = (message = "") => {
            openJoinMemberLoginModal(joinMyMenuState.pendingAfterLogin || "my-menu", joinMyMenuState.pendingLoginParams || {});
            setJoinMemberLoginStatus(message);
          };
          const openKakaoProfileForm = (res, authObj) => {
            const kakaoPhone = normalizeJoinMemberPhone(res?.kakao_account?.phone_number || "");
            markPendingJoinKakaoProfile(res, authObj);
            openJoinMemberKakaoProfileForm({
              memberName: res?.kakao_account?.name || "",
              memberMobile: kakaoPhone,
              memberEmail: res?.kakao_account?.email || "",
              memberChannel: "KAKAO"
            });
          };
          KakaoSdk.Auth.login({
            throughTalk: !isKakaoTalkInAppBrowser(),
            success(authObj) {
              closeJoinMemberLoginModal();
              KakaoSdk.API.request({
                url: "/v2/user/me",
                success(res) {
                  if (isJoinLocalDevHost()) {
                    continueWithExistingKakaoProfileIfReady(res).then((continued) => {
                      joinMyMenuState.loginRedirecting = false;
                      if (continued) return;
                      openLocalKakaoProfileRequiredForm(res, authObj);
                    }).catch((profileError) => {
                      joinMyMenuState.loginRedirecting = false;
                      golfJoinSafeWarn("Existing Kakao profile lookup failed.", profileError);
                      openLocalKakaoProfileRequiredForm(res, authObj);
                    }).finally(finish);
                    return;
                  }
                  postJoinMemberLoginForm("/member/getMemberExternalLoginCheck.json", buildJoinExternalMemberLoginPayload({
                    externalId: res?.id || "",
                    externalNickname: res?.properties?.nickname || res?.kakao_account?.profile?.nickname || "",
                    externalName: res?.kakao_account?.name || "",
                    externalEmail: res?.kakao_account?.email || "",
                    extnChnlLinkToken: authObj?.access_token || ""
                  })).then((aspData) => {
                    joinMyMenuState.loginRedirecting = false;
                    if ((aspData?.message || "") === "SUCCESS") {
                      const erpMember = buildJoinErpMemberFromLoginResponse(aspData, res);
                      if (
                        erpMember.memberName
                        || erpMember.memberSeq
                        || erpMember.memberMobile
                        || (erpMember.memberId && erpMember.memberId !== String(res?.id || "").trim())
                      ) {
                        setJoinSessionMember(erpMember);
                      }
                      clearJoinLogoutMarker();
                      location.href = getJoinLoginRedirectTarget();
                      return;
                    }
                    openKakaoProfileForm(res, authObj);
                    return undefined;
                  }).catch((error) => {
                    joinMyMenuState.loginRedirecting = false;
                    golfJoinSafeWarn("Kakao external login failed.", error);
                    if (isJoinLocalDevHost()) {
                      return continueWithExistingKakaoProfileIfReady(res).then((continued) => {
                        if (continued) return;
                        openKakaoProfileForm(res, authObj);
                        setJoinMemberLoginStatus("");
                      }).catch((profileError) => {
                        golfJoinSafeWarn("Existing Kakao profile lookup failed.", profileError);
                        openKakaoProfileForm(res, authObj);
                        setJoinMemberLoginStatus("");
                      });
                    }
                    reopenLoginWithStatus("카카오 로그인 처리 중 오류가 발생했습니다.");
                  }).finally(finish);
                },
                fail(error) {
                  joinMyMenuState.loginRedirecting = false;
                  golfJoinSafeWarn("Kakao profile request failed.", error);
                  reopenLoginWithStatus("카카오 계정 정보를 가져오지 못했습니다.");
                  finish();
                }
              });
            },
            fail(error) {
              joinMyMenuState.loginRedirecting = false;
              golfJoinSafeWarn("Kakao auth failed.", error);
              setJoinMemberLoginStatus("카카오 로그인이 취소되었거나 실패했습니다.");
              finish();
            }
          });
        });
      } catch (error) {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Failed to initialize Kakao login.", error);
        setJoinMemberLoginStatus("카카오 로그인을 준비하지 못했습니다.");
      }
    }

    function redirectToJoinLogin(afterLogin = "my-menu", extraParams = {}) {
      openJoinMemberLoginModal(afterLogin, extraParams);
    }

    function openJoinMemberLoginModal(afterLogin = "my-menu", extraParams = {}) {
      joinMyMenuState.loginRedirecting = false;
      joinMyMenuState.pendingAfterLogin = afterLogin;
      joinMyMenuState.pendingLoginParams = { ...extraParams };
      setJoinMemberLoginStatus("");
      const overlay = portalOverlayToBody("joinMemberLoginModal");
      resetJoinMemberLoginModalMode();
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
    }

    function requireJoinLogin(afterLogin = "my-menu", extraParams = {}) {
      if (getJoinLoginState().isLogin) return true;
      redirectToJoinLogin(afterLogin, extraParams);
      return false;
    }

    function closeJoinMemberLoginModal() {
      resetModalRuntimeState(document.getElementById("joinMemberLoginModal"));
      resetJoinMemberLoginModalMode();
      document.getElementById("joinMemberLoginModal")?.classList.remove("open");
      setWidgetModalOpen(hasOpenBlockingModal());
    }

    function continueAfterJoinMemberLogin(afterLogin = "my-menu") {
      joinMyMenuState.loginRedirecting = false;
      const params = joinMyMenuState.pendingLoginParams || {};
      const returnUrl = getJoinSafeReturnUrl(params.returnUrl || "");
      if (returnUrl) {
        location.href = returnUrl;
        return;
      }
      closeJoinMemberLoginModal();
      if (afterLogin === "builder") {
        continueBuilderAfterLogin(params);
        return;
      }
      if (afterLogin === "apply") {
        openGlobalApply();
        return;
      }
      if (afterLogin === "interest") {
        setJoinMobileNavActive("my");
        openJoinMyMenu();
        return;
      }
      if (afterLogin === "my-drawer") {
        setJoinMobileNavActive("my");
        openJoinMyDrawer();
        return;
      }
      if (afterLogin === "detail-wish") {
        continueDetailWishAfterLogin(params);
        return;
      }
      if (afterLogin === "detail") {
        continueJoinExternalDetailAfterLogin(params);
        return;
      }
      if (afterLogin === "my-section") {
        continueMyHomeJoinDeepLinkAfterLogin(params);
        return;
      }
      if (afterLogin === "profile-manage") {
        openJoinProfileManageModal();
        return;
      }
      if (afterLogin === "my-menu") {
        setJoinMobileNavActive("my");
        openJoinMyMenu({ tab: params.golfjoinTab || "" });
      }
    }

    function handleJoinMemberLoginBack() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      const signupForm = document.getElementById("joinMemberSignupForm");
      if (signupForm?.dataset.profileRequired === "true") {
        setJoinMemberLoginStatus("");
        return;
      }
      if (modal?.classList.contains("is-signup-mode") && signupForm?.classList.contains("is-open")) {
        const currentStep = getJoinMemberSignupStep();
        if (currentStep > 1) {
          goJoinMemberSignupStep(-1);
          return;
        }
      }
      if (
        modal?.classList.contains("is-email-mode")
        || modal?.classList.contains("is-signup-mode")
        || modal?.classList.contains("is-signup-intro-mode")
        || modal?.classList.contains("is-find-id-mode")
        || modal?.classList.contains("is-find-pw-mode")
      ) {
        resetJoinMemberLoginModalMode();
        return;
      }
      closeJoinMemberLoginModal();
    }

    function continueJoinMemberLogin(method = "signup") {
      if (joinMyMenuState.loginRedirecting) return;
      if (method === "kakao") {
        submitJoinMemberKakaoLogin();
        return;
      }
      if (method === "signup") {
        openJoinMemberSignupIntro();
        return;
      }
      joinMyMenuState.loginRedirecting = true;
      const afterLogin = joinMyMenuState.pendingAfterLogin || "my-menu";
      const extraParams = joinMyMenuState.pendingLoginParams || {};
      location.href = method === "signup"
        ? buildJoinSignupRedirectUrl(afterLogin, extraParams)
        : buildJoinLoginRedirectUrl(afterLogin, extraParams);
    }

    function openJoinMemberEmailForm() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.add("is-email-mode");
      modal?.classList.remove("is-signup-mode", "is-signup-intro-mode", "is-find-id-mode", "is-find-pw-mode", "is-profile-required");
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "로그인";
      document.getElementById("joinMemberEmailForm")?.classList.add("is-open");
      document.getElementById("joinMemberSignupIntro")?.classList.remove("is-open");
      document.getElementById("joinMemberSignupForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindIdForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindPwForm")?.classList.remove("is-open");
      setJoinMemberLoginStatus("");
      requestAnimationFrame(() => document.getElementById("joinMemberLoginId")?.focus());
    }
    window.openJoinMemberEmailForm = openJoinMemberEmailForm;

    function closeJoinMemberEmailForm() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.remove("is-email-mode");
      document.getElementById("joinMemberEmailForm")?.classList.remove("is-open");
      resetJoinMemberEmailValidation();
    }

    function closeJoinMemberFindForms() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.remove("is-find-id-mode", "is-find-pw-mode");
      document.getElementById("joinMemberFindIdForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindPwForm")?.classList.remove("is-open");
    }

    function openJoinMemberSignupIntro() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.add("is-signup-intro-mode");
      modal?.classList.remove("is-email-mode", "is-signup-mode", "is-find-id-mode", "is-find-pw-mode", "is-profile-required");
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "회원가입";
      document.getElementById("joinMemberSignupIntro")?.classList.add("is-open");
      document.getElementById("joinMemberEmailForm")?.classList.remove("is-open");
      document.getElementById("joinMemberSignupForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindIdForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindPwForm")?.classList.remove("is-open");
      resetJoinMemberEmailValidation();
      setJoinMemberLoginStatus("");
    }

    function closeJoinMemberSignupIntro() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.remove("is-signup-intro-mode");
      document.getElementById("joinMemberSignupIntro")?.classList.remove("is-open");
    }

    function openJoinMemberSignupForm() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.add("is-signup-mode");
      modal?.classList.remove("is-email-mode", "is-signup-intro-mode", "is-find-id-mode", "is-find-pw-mode", "is-profile-required");
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "일반 회원가입";
      populateJoinMemberSignupYears();
      const form = document.getElementById("joinMemberSignupForm");
      if (form) {
        form.dataset.profileOnly = "false";
        form.dataset.profileRequired = "false";
        form.classList.remove("is-profile-only", "is-profile-required", "is-kakao-signup");
        form.classList.add("is-open");
      }
      document.getElementById("joinMemberEmailForm")?.classList.remove("is-open");
      document.getElementById("joinMemberSignupIntro")?.classList.remove("is-open");
      document.getElementById("joinMemberFindIdForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindPwForm")?.classList.remove("is-open");
      resetJoinMemberEmailValidation();
      resetJoinMemberSignupValidation();
      setJoinMemberSignupStep(1);
      setJoinMemberLoginStatus("");
    }

    function closeJoinMemberSignupForm() {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.remove("is-signup-mode", "is-profile-required", "is-signup-complete");
      const form = document.getElementById("joinMemberSignupForm");
      if (form) {
        form.classList.remove("is-open", "is-profile-only", "is-profile-required", "is-kakao-signup");
        form.dataset.profileOnly = "false";
        form.dataset.profileRequired = "false";
      }
      resetJoinMemberSignupValidation();
    }

    function setJoinMemberFindMode(mode) {
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      modal?.classList.remove("is-email-mode", "is-signup-mode", "is-signup-intro-mode", "is-find-id-mode", "is-find-pw-mode", "is-profile-required");
      modal?.classList.add(mode === "pw" ? "is-find-pw-mode" : "is-find-id-mode");
      document.getElementById("joinMemberEmailForm")?.classList.remove("is-open");
      document.getElementById("joinMemberSignupIntro")?.classList.remove("is-open");
      document.getElementById("joinMemberSignupForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindIdForm")?.classList.toggle("is-open", mode === "id");
      document.getElementById("joinMemberFindPwForm")?.classList.toggle("is-open", mode === "pw");
      setJoinMemberLoginStatus("");
    }

    function openJoinMemberFindIdForm() {
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "아이디 찾기";
      setJoinMemberFindMode("id");
      document.getElementById("joinMemberFindIdResult")?.classList.remove("is-visible");
      document.getElementById("joinMemberFindIdFail")?.classList.remove("is-visible");
      setJoinMemberLoginStatus("");
      requestAnimationFrame(() => document.getElementById("joinMemberFindIdName")?.focus());
    }

    function openJoinMemberFindPwForm(prefillFromFoundId = false) {
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "비밀번호 찾기";
      setJoinMemberFindMode("pw");
      joinMyMenuState.resetPasswordToken = null;
      document.getElementById("joinMemberFindPwReset")?.classList.remove("is-visible");
      document.getElementById("joinMemberFindPwFail")?.classList.remove("is-visible");
      document.querySelector("[data-find-pw-check]")?.removeAttribute("hidden");
      setJoinMemberFieldInvalid("joinMemberResetPasswordField", "joinMemberResetPasswordHelper", "");
      setJoinMemberFieldInvalid("joinMemberResetPasswordConfirmField", "joinMemberResetPasswordConfirmHelper", "");
      if (prefillFromFoundId) {
        const idInput = document.getElementById("joinMemberFindPwId");
        const nameInput = document.getElementById("joinMemberFindPwName");
        const mobileInput = document.getElementById("joinMemberFindPwMobile");
        if (idInput) idInput.value = joinMyMenuState.foundMemberId || idInput.value;
        if (nameInput) nameInput.value = joinMyMenuState.findMemberName || nameInput.value;
        if (mobileInput) mobileInput.value = joinMyMenuState.findMemberMobile || mobileInput.value;
      }
      requestAnimationFrame(() => document.getElementById("joinMemberFindPwId")?.focus());
    }

    function resetJoinMemberLoginModalMode() {
      closeJoinMemberEmailForm();
      closeJoinMemberFindForms();
      closeJoinMemberSignupIntro();
      closeJoinMemberSignupForm();
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "로그인";
      setJoinMemberLoginStatus("");
    }

    function setJoinMemberFieldInvalid(fieldId, helperId, message = "") {
      const field = document.getElementById(fieldId);
      const helper = document.getElementById(helperId);
      field?.classList.toggle("is-invalid", Boolean(message));
      if (helper) helper.textContent = message;
    }

    function isValidJoinMemberEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || "").trim());
    }

    function isValidJoinMemberPassword(value) {
      const text = String(value || "");
      return text.length >= 8 && /[A-Za-z]/.test(text) && /\d/.test(text) && /[^A-Za-z0-9]/.test(text);
    }

    function validateJoinMemberEmailField(force = false) {
      const value = normalizeJoinMemberLoginIdInput(document.getElementById("joinMemberLoginId")).trim();
      const isValid = value.length >= 2;
      const message = value
        ? (isValid ? "" : "아이디를 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberLoginIdField", "joinMemberLoginIdHelper", message);
      return force ? isValid : !message;
    }

    function validateJoinMemberPasswordField(force = false) {
      const value = document.getElementById("joinMemberLoginPassword")?.value || "";
      const isValid = isValidJoinMemberPassword(value);
      const message = value
        ? (isValid ? "" : "비밀번호는 영문, 숫자, 특수문자를 포함해 8자 이상으로 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberLoginPasswordField", "joinMemberLoginPasswordHelper", message);
      return force ? isValid : !message;
    }

    function resetJoinMemberEmailValidation() {
      setJoinMemberFieldInvalid("joinMemberLoginIdField", "joinMemberLoginIdHelper", "");
      setJoinMemberFieldInvalid("joinMemberLoginPasswordField", "joinMemberLoginPasswordHelper", "");
    }

    function syncJoinMemberFloatingField(input) {
      const field = input?.closest?.(".join-member-float-field");
      if (!field) return;
      field.classList.toggle("is-focused", document.activeElement === input);
      field.classList.toggle("is-filled", Boolean(String(input.value || "").trim()));
    }

    function syncAllJoinMemberFloatingFields() {
      document.querySelectorAll("#joinMemberSignupForm input").forEach(syncJoinMemberFloatingField);
    }

    function formatJoinMemberSignupMobile(input) {
      if (!input) return;
      const digits = normalizeJoinMemberPhone(input.value).slice(0, 11);
      if (digits.length <= 3) {
        input.value = digits;
        return;
      }
      if (digits.length <= 7) {
        input.value = `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return;
      }
      const middleLength = digits.length === 10 ? 3 : 4;
      input.value = `${digits.slice(0, 3)}-${digits.slice(3, 3 + middleLength)}-${digits.slice(3 + middleLength)}`;
    }

    function normalizeJoinMemberSignupIdInput(input) {
      if (!input) return "";
      const normalized = String(input.value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (input.value !== normalized) input.value = normalized;
      return normalized;
    }

    function hasJoinMemberSignupHangul(value = "") {
      return /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7af\ud7b0-\ud7ff]/i.test(String(value || ""));
    }

    function joinMemberSignupEventReportsHangul(event) {
      if (typeof event?.getModifierState !== "function") return false;
      try {
        return event.getModifierState("HangulMode") === true;
      } catch (error) {
        return false;
      }
    }

    function setJoinMemberSignupIdPrompt(message = JOIN_MEMBER_SIGNUP_ID_DEFAULT_PROMPT) {
      const form = document.getElementById("joinMemberSignupForm");
      const desc = document.getElementById("joinMemberSignupStepDesc");
      if (!form || !desc || Number(form.dataset.step || 1) !== 2) return;
      desc.textContent = message;
      desc.hidden = !message;
    }

    function syncJoinMemberSignupIdPrompt() {
      const input = document.getElementById("joinMemberSignupEmail");
      if (String(input?.value || "").trim()) {
        setJoinMemberSignupIdPrompt("");
        return;
      }
      setJoinMemberSignupIdPrompt(
        joinMemberSignupIdImeMode === "hangul"
          ? JOIN_MEMBER_SIGNUP_ID_HANGUL_PROMPT
          : JOIN_MEMBER_SIGNUP_ID_DEFAULT_PROMPT
      );
    }

    function handleJoinMemberSignupIdPointerDown(event) {
      if (joinMemberSignupEventReportsHangul(event)) joinMemberSignupIdImeMode = "hangul";
      syncJoinMemberSignupIdPrompt();
    }

    function handleJoinMemberSignupIdFocus(event) {
      if (joinMemberSignupEventReportsHangul(event)) joinMemberSignupIdImeMode = "hangul";
      syncJoinMemberSignupIdPrompt();
    }

    function handleJoinMemberSignupIdKeydown(event) {
      const isHangulToggleKey = event?.key === "HangulMode"
        || event?.code === "Lang1"
        || Number(event?.keyCode || 0) === 21;
      if (isHangulToggleKey) {
        if (joinMemberSignupIdImeMode === "hangul") joinMemberSignupIdImeMode = "english";
        else if (joinMemberSignupIdImeMode === "english") joinMemberSignupIdImeMode = "hangul";
        else joinMemberSignupIdImeMode = joinMemberSignupEventReportsHangul(event) ? "hangul" : "english";
        syncJoinMemberSignupIdPrompt();
        return;
      }
      if (joinMemberSignupEventReportsHangul(event)) joinMemberSignupIdImeMode = "hangul";
      else if (/^[a-z0-9]$/i.test(String(event?.key || ""))) joinMemberSignupIdImeMode = "english";
    }

    function handleJoinMemberSignupIdBeforeInput(event) {
      if (event?.isComposing || hasJoinMemberSignupHangul(event?.data)) {
        joinMemberSignupIdImeMode = "hangul";
        syncJoinMemberSignupIdPrompt();
      }
    }

    function handleJoinMemberSignupIdCompositionStart() {
      joinMemberSignupIdImeMode = "hangul";
      syncJoinMemberSignupIdPrompt();
    }

    function handleJoinMemberSignupIdCompositionEnd(event) {
      if (hasJoinMemberSignupHangul(event?.data) || hasJoinMemberSignupHangul(event?.target?.value)) {
        joinMemberSignupIdImeMode = "hangul";
      }
      syncJoinMemberSignupIdPrompt();
    }

    function handleJoinMemberSignupIdInput(event) {
      const input = event?.currentTarget || event?.target;
      const rawValue = String(input?.value || "");
      const containsHangul = hasJoinMemberSignupHangul(event?.data) || hasJoinMemberSignupHangul(rawValue);
      const normalized = normalizeJoinMemberSignupIdInput(input);
      if (containsHangul || event?.isComposing) joinMemberSignupIdImeMode = "hangul";
      if (normalized) joinMemberSignupIdImeMode = "english";
      syncJoinMemberSignupIdPrompt();
    }

    function normalizeJoinMemberLoginIdInput(input) {
      if (!input) return "";
      const normalized = String(input.value || "").toLowerCase();
      if (input.value !== normalized) input.value = normalized;
      return normalized;
    }

    function isValidJoinMemberSignupId(value = "") {
      const normalized = String(value || "").trim();
      return /^(?=.*[a-z])(?=.*\d)[a-z0-9]{6,50}$/.test(normalized);
    }

    function validateJoinMemberSignupEmailField(force = false) {
      const input = document.getElementById("joinMemberSignupEmail");
      const value = normalizeJoinMemberSignupIdInput(input).trim();
      const message = value || force
        ? (isValidJoinMemberSignupId(value) ? "" : "아이디는 영문, 숫자 조합 6자리 이상 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberSignupEmailField", "joinMemberSignupEmailHelper", message);
      return !message;
    }

    function validateJoinMemberSignupPasswordField(force = false) {
      const value = document.getElementById("joinMemberSignupPassword")?.value || "";
      const message = value || force
        ? (isValidJoinMemberPassword(value) ? "" : "유효한 비밀번호를 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberSignupPasswordField", "joinMemberSignupPasswordHelper", message);
      validateJoinMemberSignupPasswordConfirmField(false);
      return !message;
    }

    function validateJoinMemberSignupPasswordConfirmField(force = false) {
      const value = document.getElementById("joinMemberSignupPasswordConfirm")?.value || "";
      const password = document.getElementById("joinMemberSignupPassword")?.value || "";
      const message = value || force
        ? (value === password && isValidJoinMemberPassword(value) ? "" : "비밀번호가 일치하지 않습니다.")
        : "";
      setJoinMemberFieldInvalid("joinMemberSignupPasswordConfirmField", "joinMemberSignupPasswordConfirmHelper", message);
      return !message;
    }

    function validateJoinMemberSignupNameField(force = false) {
      const value = document.getElementById("joinMemberSignupName")?.value.trim() || "";
      const message = value || force
        ? (value.length >= 2 ? "" : "이름을 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberSignupNameField", "joinMemberSignupNameHelper", message);
      return !message;
    }

    function validateJoinMemberSignupMobileField(force = false) {
      const value = normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || "");
      const message = value || force
        ? (/^01\d{8,9}$/.test(value) ? "" : "올바른 휴대폰번호를 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberSignupMobileField", "joinMemberSignupMobileHelper", message);
      return !message;
    }

    function validateJoinMemberSignupContactEmailField(force = false) {
      const value = document.getElementById("joinMemberSignupContactEmail")?.value.trim() || "";
      const message = value || force
        ? (isValidJoinMemberEmail(value) ? "" : "이메일 형식으로 입력해 주세요.")
        : "";
      setJoinMemberFieldInvalid("joinMemberSignupContactEmailField", "joinMemberSignupContactEmailHelper", message);
      return !message;
    }

    function getJoinMemberSignupDuplicateValue(type) {
      if (type === "id") return normalizeJoinMemberSignupIdInput(document.getElementById("joinMemberSignupEmail")).trim();
      if (type === "mobile") return normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || "");
      if (type === "email") return document.getElementById("joinMemberSignupContactEmail")?.value.trim() || "";
      return "";
    }

    function isJoinMemberSignupDuplicateValueReady(type, value = getJoinMemberSignupDuplicateValue(type)) {
      if (type === "id") return isValidJoinMemberSignupId(value);
      if (type === "mobile") return /^01\d{8,9}$/.test(value);
      if (type === "email") return isValidJoinMemberEmail(value);
      return false;
    }

    function getJoinMemberSignupDuplicateFocusId(type) {
      return {
        id: "joinMemberSignupEmail",
        mobile: "joinMemberSignupMobile",
        email: "joinMemberSignupContactEmail"
      }[type] || "";
    }

    function getJoinMemberSignupDuplicateMessage(type) {
      return {
        id: "이미 사용중이거나 탈퇴한 아이디입니다.",
        mobile: "이미 사용중이거나 탈퇴한 휴대폰 번호입니다.",
        email: "이미 사용중이거나 탈퇴한 이메일입니다."
      }[type] || "이미 사용중인 정보입니다.";
    }

    function clearJoinMemberSignupDuplicateLock(type) {
      window.clearTimeout(joinMyMenuState.signupDuplicateTimers?.[type]);
      if (joinMyMenuState.signupDuplicateLocks) delete joinMyMenuState.signupDuplicateLocks[type];
      if (joinMyMenuState.signupDuplicateCheckedValues) delete joinMyMenuState.signupDuplicateCheckedValues[type];
    }

    function hasJoinMemberSignupDuplicateLock(type) {
      const value = getJoinMemberSignupDuplicateValue(type);
      return Boolean(
        joinMyMenuState.signupDuplicateLocks?.[type]
        && joinMyMenuState.signupDuplicateCheckedValues?.[type] === value
      );
    }

    async function checkJoinMemberSignupFieldDuplicate(type, options = {}) {
      const value = getJoinMemberSignupDuplicateValue(type);
      const silent = Boolean(options.silent);
      if (!isJoinMemberSignupDuplicateValueReady(type, value)) return true;
      if (!canUseSecretTourMemberApi()) return true;
      if (joinMyMenuState.signupDuplicateCheckedValues?.[type] === value && !joinMyMenuState.signupDuplicateLocks?.[type]) {
        return true;
      }
      if (hasJoinMemberSignupDuplicateLock(type)) {
        if (!silent) showJoinMemberSignupAlert(getJoinMemberSignupDuplicateMessage(type), getJoinMemberSignupDuplicateFocusId(type));
        return false;
      }

      try {
        let result = null;
        if (type === "id") {
          result = await postJoinMemberForm("/member/getMemberIdCheck.json", { custId: value });
        } else if (type === "mobile") {
          result = await postJoinMemberForm("/member/getMemberMobileCheck.json", {
            mobile1: value.substring(0, 3),
            mobile2: value.substring(3, 7),
            mobile3: value.substring(7, 11)
          });
        } else if (type === "email") {
          result = await postJoinMemberForm("/member/getMemberEmailCheck.json", { email: value });
        }

        joinMyMenuState.signupDuplicateCheckedValues[type] = value;
        if (Number(result?.count) !== 0) {
          joinMyMenuState.signupDuplicateLocks[type] = true;
          if (!silent) showJoinMemberSignupAlert(getJoinMemberSignupDuplicateMessage(type), getJoinMemberSignupDuplicateFocusId(type));
          updateJoinMemberSignupNavState();
          return false;
        }
        delete joinMyMenuState.signupDuplicateLocks[type];
        updateJoinMemberSignupNavState();
        return true;
      } catch (error) {
        golfJoinSafeWarn("Signup duplicate check failed.", error);
        if (!silent) showJoinMemberSignupAlert("중복 확인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", getJoinMemberSignupDuplicateFocusId(type));
        return silent;
      }
    }

    function scheduleJoinMemberSignupDuplicateCheck(type) {
      window.clearTimeout(joinMyMenuState.signupDuplicateTimers?.[type]);
      const value = getJoinMemberSignupDuplicateValue(type);
      if (!isJoinMemberSignupDuplicateValueReady(type, value)) return;
      joinMyMenuState.signupDuplicateTimers[type] = window.setTimeout(() => {
        checkJoinMemberSignupFieldDuplicate(type, { silent: false });
      }, 550);
    }

    function joinMemberPasswordIconHtml(visible) {
      return visible
        ? `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m2 2 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }

    function toggleJoinMemberPasswordVisibility(inputId, button) {
      const input = document.getElementById(inputId);
      if (!input || !button) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.setAttribute("aria-pressed", visible ? "true" : "false");
      button.setAttribute("aria-label", visible ? "비밀번호 숨기기" : "비밀번호 보기");
      button.innerHTML = joinMemberPasswordIconHtml(visible);
      input.focus();
    }

    const JOIN_MEMBER_SIGNUP_ID_DEFAULT_PROMPT = "아이디를 입력해주세요.";
    const JOIN_MEMBER_SIGNUP_ID_HANGUL_PROMPT = "한/영 키를 눌러 영문으로 변경 후 입력해주세요";
    let joinMemberSignupIdImeMode = "unknown";

    const JOIN_MEMBER_SIGNUP_STEP_COPY = {
      1: ["약관 내용을 확인하고", "동의해주세요."],
      2: ["1분이면 충분해요", JOIN_MEMBER_SIGNUP_ID_DEFAULT_PROMPT],
      3: ["회원정보를 입력해주세요.", "여행 예약을 위한 필수 정보입니다."],
      4: ["핸디를 선택해주세요.", "맞춤 조인 매칭에 필요한 정보입니다."],
      5: ["전문분야", "비슷한 관심사의 멤버를 만나보세요.\n최대 3개까지 선택할 수 있어요."],
      6: ["나의 여행 스타일은?", "나와 맞는 멤버를 쉽게 만날 수 있어요.\n최대 3개까지 선택할 수 있어요."],
      7: ["가입이 완료됐어요", "이제 나에게 맞는 조인여행을 시작해볼까요?"]
    };

    function populateJoinMemberSignupYears() {
      const select = document.getElementById("joinMemberSignupBirthYear");
      if (!select || select.dataset.ready === "true") return;
      const startYear = new Date().getFullYear() - 18;
      for (let year = startYear; year >= 1930; year -= 1) {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        select.appendChild(option);
      }
      select.dataset.ready = "true";
    }

    function setJoinMemberSignupStep(step) {
      const form = document.getElementById("joinMemberSignupForm");
      if (!form) return;
      const profileOnly = form.dataset.profileOnly === "true";
      const minStep = 1;
      const nextStep = Math.max(minStep, Math.min(7, Number(step) || minStep));
      form.dataset.step = String(nextStep);
      const loginModal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      loginModal?.classList.toggle("is-signup-complete", nextStep === 7);
      if (nextStep === 7) {
        const loginTitle = document.getElementById("joinMemberLoginTitle");
        if (loginTitle) loginTitle.textContent = "추가정보 입력";
      }
      const stepCopy = {
        1: ["약관 내용을 확인하고", "동의해주세요."],
        2: ["1분이면 충분해요", JOIN_MEMBER_SIGNUP_ID_DEFAULT_PROMPT],
        3: ["회원정보를 입력해주세요.", "여행 예약을 위한 필수 정보입니다."],
        4: ["핸디를 선택해주세요.", "맞춤 조인 매칭에 필요한 정보입니다."],
        5: ["전문분야", "비슷한 관심사의 멤버를 만나보세요.\n최대 3개까지 선택할 수 있어요."],
        6: ["나의 여행 스타일은?", "나와 맞는 멤버를 쉽게 만날 수 있어요.\n최대 3개까지 선택할 수 있어요."],
        7: ["가입이 완료되었어요", "이제 나에게 맞는 조인여행을 시작해볼까요?"]
      };
      const [title, desc] = stepCopy[nextStep] || stepCopy[1];
      const titleEl = document.getElementById("joinMemberSignupStepTitle");
      const descEl = document.getElementById("joinMemberSignupStepDesc");
      if (titleEl) titleEl.textContent = title;
      if (descEl) {
        descEl.textContent = desc;
        descEl.hidden = !desc;
        descEl.classList.toggle("is-title-style", nextStep === 1);
      }
      if (nextStep === 2) syncJoinMemberSignupIdPrompt();
      form.querySelectorAll("[data-progress-step]").forEach((bar) => {
        const barStep = Number(bar.dataset.progressStep || 0);
        const isActive = profileOnly
          ? (barStep >= minStep && barStep <= Math.min(nextStep, 6))
          : barStep <= Math.min(nextStep, 6);
        bar.classList.toggle("is-active", isActive);
      });
      const prev = form.querySelector("[data-signup-prev]");
      const next = form.querySelector("[data-signup-next]");
      const submit = form.querySelector("[data-signup-submit]");
      const nav = form.querySelector("[data-signup-nav]");
      const profileRequired = form.dataset.profileRequired === "true";
      if (prev) prev.hidden = nextStep <= minStep || nextStep === 5 || nextStep >= 6;
      if (next) next.hidden = nextStep >= 6;
      if (submit) submit.hidden = nextStep !== 6;
      nav?.classList.toggle("has-prev", nextStep > minStep && nextStep !== 5 && nextStep < 6);
      nav?.toggleAttribute("hidden", nextStep === 4 || nextStep === 7);
      if (nextStep === 6) setJoinMemberLoginStatus("");
      updateJoinMemberSignupNavState();
    }

    function syncJoinMemberSignupEmailGate() {
      const form = document.getElementById("joinMemberSignupForm");
      if (!form) return;
      const signupId = document.getElementById("joinMemberSignupEmail")?.value.trim() || "";
      const valid = isValidJoinMemberSignupId(signupId);
      if (!valid) {
        form.classList.remove("is-email-valid");
        return;
      }
      form.classList.add("is-email-valid");
    }

    function getJoinMemberSignupStep() {
      return Number(document.getElementById("joinMemberSignupForm")?.dataset.step || 1);
    }

    function getJoinMemberSignupSelectedGender() {
      return document.querySelector('[data-chip-group="join-member-gender"] .apply-chip.active')?.dataset.value || "";
    }

    function getJoinMemberSignupSelectedTravelStyles() {
      return Array.from(document.querySelectorAll('[data-chip-group="join-member-travel-style"] .apply-chip.active'))
        .map((chip) => chip.dataset.value || chip.textContent.trim())
        .filter(Boolean);
    }

    function normalizeJoinMemberTravelStyleValue(value = "") {
      const text = String(value || "").trim();
      const compact = text.replace(/\s+/g, "").replace(/·/g, "");
      const aliases = {
        "여유로운라운드": "여유로운",
        "친목중심": "친목중심",
        "친목형": "친목중심",
        "실력향상": "실력향상",
        "맛집관광": "맛집관광",
        "명랑골프": "명랑골프",
        "집중라운드": "실력향상",
        "비즈니스": "비즈니스"
      };
      return aliases[compact] || text;
    }

    function hasJoinMemberSignupSelectedTravelStyle() {
      return getJoinMemberSignupSelectedTravelStyles().length > 0;
    }

    function splitJoinMemberProfileStyles(value = []) {
      if (Array.isArray(value)) return value.map(normalizeJoinMemberTravelStyleValue).filter(Boolean);
      return String(value || "").split(",").map(normalizeJoinMemberTravelStyleValue).filter(Boolean);
    }

    function getJoinMemberMissingProfileFields(member = {}) {
      const missing = [];
      if (!getJoinMemberBirthYear(member)) missing.push("birthYear");
      if (!member.gender) missing.push("gender");
      if (!String(member.profession || "").trim()) missing.push("profession");
      if (!member.level) missing.push("level");
      if (splitJoinMemberProfileStyles(member.travelStyles || member.styles).length === 0) missing.push("travelStyles");
      return missing;
    }

    function isJoinMemberProfileComplete(member = {}) {
      return getJoinMemberMissingProfileFields(member).length === 0;
    }

    function validateJoinMemberSignupProfileStep() {
      const birthYear = document.getElementById("joinMemberSignupBirthYear")?.value || "";
      const gender = getJoinMemberSignupSelectedGender();
      const validBirthYear = /^\d{4}$/.test(birthYear);
      setJoinMemberFieldInvalid("joinMemberSignupBirthYearField", "joinMemberSignupBirthYearHelper", validBirthYear ? "" : "출생연도를 선택해 주세요.");
      setJoinMemberFieldInvalid("joinMemberSignupGenderField", "joinMemberSignupGenderHelper", gender ? "" : "성별을 선택해 주세요.");
      return validBirthYear && Boolean(gender);
    }

    function isJoinMemberSignupStepComplete(step = getJoinMemberSignupStep()) {
      if (step === 1) {
        return validateJoinMemberSignupAgreements();
      }
      if (step === 2) {
        const signupId = document.getElementById("joinMemberSignupEmail")?.value.trim() || "";
        const password = document.getElementById("joinMemberSignupPassword")?.value || "";
        const passwordConfirm = document.getElementById("joinMemberSignupPasswordConfirm")?.value || "";
        return isValidJoinMemberSignupId(signupId) && !hasJoinMemberSignupDuplicateLock("id") && isValidJoinMemberPassword(password) && password === passwordConfirm;
      }
      if (step === 3) {
        const name = document.getElementById("joinMemberSignupName")?.value.trim() || "";
        const mobile = normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || "");
        const email = document.getElementById("joinMemberSignupContactEmail")?.value.trim() || "";
        const birthYear = document.getElementById("joinMemberSignupBirthYear")?.value || "";
        return name.length >= 2
          && /^01\d{8,9}$/.test(mobile)
          && !hasJoinMemberSignupDuplicateLock("mobile")
          && isValidJoinMemberEmail(email)
          && !hasJoinMemberSignupDuplicateLock("email")
          && /^\d{4}$/.test(birthYear)
          && Boolean(getJoinMemberSignupSelectedGender());
      }
      if (step === 4) {
        return Boolean(getJoinMemberSignupSelectedLevel());
      }
      if (step === 5) {
        return Boolean(document.getElementById("joinMemberSignupProfession")?.value.trim());
      }
      if (step === 6) {
        return hasJoinMemberSignupSelectedTravelStyle();
      }
      return true;
    }

    function updateJoinMemberSignupNavState() {
      const form = document.getElementById("joinMemberSignupForm");
      if (!form) return;
      const step = getJoinMemberSignupStep();
      const complete = isJoinMemberSignupStepComplete(step);
      const next = form.querySelector("[data-signup-next]");
      const submit = form.querySelector("[data-signup-submit]");
      if (next) next.disabled = step < 6 && !complete;
      if (submit) submit.disabled = Boolean(joinMyMenuState.loginRedirecting) || (step === 6 && !complete);
      if (step === 6 && complete && document.getElementById("joinMemberLoginStatus")?.textContent.includes("라운딩 스타일")) {
        setJoinMemberLoginStatus("");
      }
    }

    function validateJoinMemberSignupStep(step = getJoinMemberSignupStep()) {
      if (step === 1) {
        if (!validateJoinMemberSignupAgreements()) {
          setJoinMemberLoginStatus("필수 약관에 모두 동의해 주세요.");
          document.getElementById("joinMemberSignupAgreeAll")?.focus();
          return false;
        }
        return true;
      }
      if (step === 2) {
        const valid = [
          validateJoinMemberSignupEmailField(true),
          validateJoinMemberSignupPasswordField(true),
          validateJoinMemberSignupPasswordConfirmField(true)
        ];
        if (valid.includes(false)) {
          document.querySelector("#joinMemberSignupForm .join-member-email-field.is-invalid input")?.focus();
          return false;
        }
        return true;
      }
      if (step === 3) {
        const valid = [
          validateJoinMemberSignupNameField(true),
          validateJoinMemberSignupMobileField(true),
          validateJoinMemberSignupContactEmailField(true),
          validateJoinMemberSignupProfileStep()
        ];
        if (valid.includes(false)) {
          document.querySelector("#joinMemberSignupForm .join-member-email-field.is-invalid input, #joinMemberSignupForm .join-member-email-field.is-invalid select")?.focus();
          return false;
        }
        return true;
      }
      if (step === 4 && !getJoinMemberSignupSelectedLevel()) {
        setJoinMemberLoginStatus("현재 핸디를 선택해 주세요.");
        return false;
      }
      if (step === 5 && !document.getElementById("joinMemberSignupProfession")?.value.trim()) {
        setJoinMemberLoginStatus("직업/관심분야를 선택하거나 직접 입력해 주세요.");
        return false;
      }
      if (step === 6 && !hasJoinMemberSignupSelectedTravelStyle()) {
        setJoinMemberLoginStatus("라운딩 스타일을 하나 이상 선택해 주세요.");
        return false;
      }
      return true;
    }

    async function validateJoinMemberSignupDuplicateBeforeNext(step) {
      const form = document.getElementById("joinMemberSignupForm");
      if (!form || form.dataset.profileOnly === "true" || form.dataset.profileRequired === "true") return true;
      if (step === 2) {
        window.clearTimeout(joinMyMenuState.signupDuplicateTimers?.id);
        return checkJoinMemberSignupFieldDuplicate("id");
      }
      if (step === 3) {
        window.clearTimeout(joinMyMenuState.signupDuplicateTimers?.mobile);
        window.clearTimeout(joinMyMenuState.signupDuplicateTimers?.email);
        const mobileOk = await checkJoinMemberSignupFieldDuplicate("mobile");
        if (!mobileOk) return false;
        return checkJoinMemberSignupFieldDuplicate("email");
      }
      return true;
    }

    async function goJoinMemberSignupStep(direction) {
      const current = getJoinMemberSignupStep();
      if (direction > 0 && !validateJoinMemberSignupStep(current)) return;
      if (direction > 0 && !(await validateJoinMemberSignupDuplicateBeforeNext(current))) return;
      setJoinMemberLoginStatus("");
      const form = document.getElementById("joinMemberSignupForm");
      const profileOnly = form?.dataset.profileOnly === "true";
      if (profileOnly && direction > 0 && current === 1) {
        await waitForOpenJoinMemberRequiredProfileFields();
        setJoinMemberSignupStep(3);
        return;
      }
      if (form?.dataset.profileRequired === "true" && direction > 0 && current === 3) {
        setJoinMemberSignupStep(4);
        return;
      }
      if (form?.dataset.profileRequired === "true" && direction < 0 && current === 5) {
        setJoinMemberSignupStep(4);
        return;
      }
      if (profileOnly && direction < 0 && current === 3) {
        setJoinMemberSignupStep(1);
        return;
      }
      setJoinMemberSignupStep(current + Number(direction || 0));
    }

    const JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT = 3;

    function maybeAdvanceJoinMemberSignupProfessionStep(values = getJoinMemberSignupProfessionValues()) {
      if (getJoinMemberSignupStep() !== 5) return;
      if (values.length < JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT) return;
      requestAnimationFrame(() => setJoinMemberSignupStep(6));
    }

    function syncJoinMemberSignupProfessionChips(values = getJoinMemberSignupProfessionValues()) {
      const limitReached = values.length >= JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT;
      document.querySelectorAll("[data-signup-profession-chip]").forEach((chip) => {
        const active = values.includes(chip.dataset.signupProfessionChip);
        chip.classList.toggle("active", active);
        chip.disabled = limitReached && !active;
      });
      const customChip = document.querySelector("#joinMemberSignupForm .join-member-signup-custom-profession");
      if (customChip) {
        const customValue = customChip.dataset.signupProfessionChip || "";
        const active = Boolean(customValue) && values.includes(customValue);
        const disabled = limitReached && !active;
        customChip.classList.toggle("active", active);
        customChip.classList.toggle("is-disabled", disabled);
        customChip.setAttribute("aria-disabled", disabled ? "true" : "false");
        customChip.tabIndex = disabled ? -1 : 0;
      }
    }

    function toggleJoinMemberSignupProfession(value) {
      const input = document.getElementById("joinMemberSignupProfession");
      if (!input) return;
      const current = getJoinMemberSignupProfessionValues();
      const isSelected = current.includes(value);
      if (!isSelected && current.length >= JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT) {
        setJoinMemberLoginStatus(`직업/관심분야는 최대 ${JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT}개까지 선택할 수 있어요.`);
        return;
      }
      const nextValues = isSelected
        ? current.filter((item) => item !== value)
        : [...current, value];
      const next = setJoinMemberSignupProfessionValues(nextValues);
      syncJoinMemberSignupProfessionChips(next);
      setJoinMemberLoginStatus("");
      updateJoinMemberSignupNavState();
      maybeAdvanceJoinMemberSignupProfessionStep(next);
    }

    function joinMemberSignupCustomProfessionDefaultHtml() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-icon lucide-pencil" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg> 직접입력`;
    }

    function joinMemberSignupCustomProfessionEditHtml() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-square-pen-icon lucide-square-pen" aria-hidden="true"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"></path></svg>`;
    }

    function setJoinMemberSignupProfessionValues(values = []) {
      const input = document.getElementById("joinMemberSignupProfession");
      const normalized = [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))]
        .slice(0, JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT);
      if (input) input.value = normalized.join(", ");
      return normalized;
    }

    function getJoinMemberSignupProfessionValues() {
      return (document.getElementById("joinMemberSignupProfession")?.value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function renderJoinMemberSignupCustomProfession(value = "") {
      const chip = document.querySelector("#joinMemberSignupForm .join-member-signup-custom-profession");
      if (!chip) return;
      const normalized = String(value || "").trim().slice(0, 20);
      if (!normalized) {
        delete chip.dataset.signupProfessionChip;
        chip.classList.remove("has-value", "active");
        chip.innerHTML = joinMemberSignupCustomProfessionDefaultHtml();
        return;
      }
      chip.dataset.signupProfessionChip = normalized;
      chip.classList.add("has-value");
      chip.innerHTML = `<span class="join-member-signup-custom-profession-text">${escapeHtml(normalized)}</span><span class="join-member-signup-custom-profession-edit" role="button" tabindex="0" aria-label="직업/관심분야 수정" onclick="event.stopPropagation(); startJoinMemberSignupCustomProfessionInput(this.closest('.join-member-signup-custom-profession'), true)" onkeydown="if(event.key === 'Enter' || event.key === ' '){event.preventDefault(); event.stopPropagation(); startJoinMemberSignupCustomProfessionInput(this.closest('.join-member-signup-custom-profession'), true)}">${joinMemberSignupCustomProfessionEditHtml()}</span>`;
    }

    function addJoinMemberSignupCustomProfession(value, previousValue = "") {
      const normalized = String(value || "").trim().slice(0, 20);
      if (!normalized) return false;
      const current = getJoinMemberSignupProfessionValues().filter((item) => item !== previousValue && item !== normalized);
      if (current.length >= JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT) {
        setJoinMemberLoginStatus(`직업/관심분야는 최대 ${JOIN_MEMBER_SIGNUP_PROFESSION_LIMIT}개까지 선택할 수 있어요.`);
        renderJoinMemberSignupCustomProfession(previousValue);
        syncJoinMemberSignupProfessionChips();
        updateJoinMemberSignupNavState();
        return false;
      }
      const next = setJoinMemberSignupProfessionValues([...current, normalized]);
      renderJoinMemberSignupCustomProfession(normalized);
      syncJoinMemberSignupProfessionChips(next);
      setJoinMemberLoginStatus("");
      updateJoinMemberSignupNavState();
      maybeAdvanceJoinMemberSignupProfessionStep(next);
      return true;
    }

    function handleJoinMemberSignupCustomProfessionClick(event, chip) {
      event?.preventDefault?.();
      if (chip?.classList.contains("is-disabled") || chip?.getAttribute("aria-disabled") === "true") return;
      const value = chip?.dataset.signupProfessionChip || "";
      if (!value) {
        startJoinMemberSignupCustomProfessionInput(chip);
        return;
      }
      toggleJoinMemberSignupProfession(value);
    }

    function handleJoinMemberSignupCustomProfessionKeydown(event, chip) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleJoinMemberSignupCustomProfessionClick(event, chip);
    }

    function scrollJoinMemberSignupCustomProfessionInputIntoView(input) {
      if (!input) return;
      if (typeof scheduleJoinMobileVisualViewportVarsUpdate === "function") {
        scheduleJoinMobileVisualViewportVarsUpdate({ settle: true });
      }
      const scrollBox = input.closest(".join-member-login-body");
      scrollBox?.classList.add("has-signup-keyboard-focus");
      const inputRect = input.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportHeight = viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
      const keyboardSafeBottom = viewportTop + viewportHeight - 112;
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

    function startJoinMemberSignupCustomProfessionInput(button, edit = false) {
      const row = button?.closest(".join-member-signup-chip-row");
      if (!row || row.querySelector(".join-member-signup-custom-profession-input")) return;
      const previousValue = button.dataset.signupProfessionChip || "";
      row.classList.add("is-custom-editing");
      button.classList.add("is-editing");
      const input = document.createElement("input");
      input.type = "text";
      input.className = "join-member-signup-custom-profession-input";
      input.maxLength = 20;
      input.placeholder = "직접입력";
      input.value = edit ? previousValue : "";
      input.setAttribute("aria-label", "직업/관심분야 직접입력");
      let finished = false;
      const finish = (commit = true) => {
        if (finished) return;
        finished = true;
        input.closest(".join-member-login-body")?.classList.remove("has-signup-keyboard-focus");
        const value = input.value.trim();
        if (commit && value) {
          addJoinMemberSignupCustomProfession(value, previousValue);
        } else if (previousValue) {
          renderJoinMemberSignupCustomProfession(previousValue);
        } else {
          renderJoinMemberSignupCustomProfession("");
        }
        input.remove();
        row.classList.remove("is-custom-editing");
        button.classList.remove("is-editing");
        updateJoinMemberSignupNavState();
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
      input.addEventListener("focus", () => {
        scrollJoinMemberSignupCustomProfessionInputIntoView(input);
        setTimeout(() => scrollJoinMemberSignupCustomProfessionInputIntoView(input), 220);
        setTimeout(() => scrollJoinMemberSignupCustomProfessionInputIntoView(input), 420);
      });
      input.addEventListener("blur", () => finish(true));
      row.insertBefore(input, button);
      input.focus({ preventScroll: true });
      input.select();
      scrollJoinMemberSignupCustomProfessionInputIntoView(input);
      requestAnimationFrame(() => {
        if (document.activeElement !== input) input.focus({ preventScroll: true });
        scrollJoinMemberSignupCustomProfessionInputIntoView(input);
      });
      setTimeout(() => scrollJoinMemberSignupCustomProfessionInputIntoView(input), 180);
      setTimeout(() => scrollJoinMemberSignupCustomProfessionInputIntoView(input), 360);
    }

    function getJoinMemberSignupSelectedLevel() {
      return document.querySelector('[data-chip-group="join-member-level"] .apply-chip.active')?.dataset.value || "";
    }

    function renderJoinMemberSignupConfetti() {
      const box = document.getElementById("joinMemberSignupConfetti");
      if (!box) return;
      const colors = ["#2563eb", "#f7e317", "#20c997", "#ff6b6b", "#845ef7", "#ff922b"];
      box.innerHTML = Array.from({ length: 34 }, (_, index) => {
        const color = colors[index % colors.length];
        const x = 4 + ((index * 29) % 92);
        const size = 7 + (index % 4) * 3;
        const drift = ((index % 2 ? 1 : -1) * (24 + (index % 5) * 9));
        const radius = index % 3 === 0 ? "50%" : index % 3 === 1 ? "2px" : "0";
        return `<div class="join-member-confetti-shape" style="--x:${x}%;--s:${size}px;--r:${radius};--c:${color};--d:${1.8 + (index % 5) * .22}s;--delay:${(index % 8) * .06}s;--drift:${drift}px;--rot:${180 + index * 31}deg;"></div>`;
      }).join("");
    }

    function getJoinMemberSignupAgreements() {
      return Array.from(document.querySelectorAll("#joinMemberSignupForm .join-member-signup-agreement"));
    }

    function toggleJoinMemberSignupAllAgreement(checked) {
      getJoinMemberSignupAgreements().forEach((input) => {
        input.checked = Boolean(checked);
      });
      syncJoinMemberSignupAgreementState();
    }

    function syncJoinMemberSignupAgreementState() {
      const inputs = getJoinMemberSignupAgreements();
      const all = document.getElementById("joinMemberSignupAgreeAll");
      const checkedCount = inputs.filter((input) => input.checked).length;
      if (all) {
        all.checked = inputs.length > 0 && checkedCount === inputs.length;
        all.indeterminate = checkedCount > 0 && checkedCount < inputs.length;
      }
      updateJoinMemberSignupNavState();
    }

    function validateJoinMemberSignupAgreements() {
      return getJoinMemberSignupAgreements()
        .filter((input) => input.dataset.required === "true")
        .every((input) => input.checked);
    }

    function getJoinPendingKakaoProfile() {
      try {
        return joinMyMenuState.pendingKakaoSignup || JSON.parse(sessionStorage.getItem("joinPendingKakaoProfile") || "{}") || {};
      } catch (error) {
        return joinMyMenuState.pendingKakaoSignup || {};
      }
    }

    function getJoinPendingKakaoAccessToken(pending = getJoinPendingKakaoProfile()) {
      const pendingToken = String(pending?.accessToken || "").trim();
      if (pendingToken) return pendingToken;
      try {
        return String(window.Kakao?.Auth?.getAccessToken?.() || "").trim();
      } catch (error) {
        golfJoinSafeWarn("Failed to restore Kakao access token.", error);
        return "";
      }
    }

    function clearJoinPendingKakaoProfile() {
      joinMyMenuState.pendingKakaoSignup = null;
      try {
        sessionStorage.removeItem("joinPendingKakaoProfile");
      } catch (error) {
        golfJoinSafeWarn("Failed to clear pending Kakao profile state.", error);
      }
    }

    function getJoinMemberProfileCacheKey(member = {}) {
      return String(
        member.memberSeq
        || member.memberId
        || normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "")
        || member.memberEmail
        || member.kakaoId
        || ""
      ).trim();
    }

    function readJoinMemberProfileCompletionStore() {
      try {
        const stored = JSON.parse(sessionStorage.getItem(JOIN_MEMBER_PROFILE_COMPLETION_KEY) || "{}");
        return stored && typeof stored === "object" ? stored : {};
      } catch (error) {
        return {};
      }
    }

    function getRememberedJoinMemberProfileCompletion(member = {}) {
      if (
        typeof member.profileComplete === "boolean"
        && Date.now() - Number(member.profileCompleteCheckedAt || 0) <= JOIN_MEMBER_PROFILE_COMPLETION_TTL_MS
      ) {
        return member.profileComplete;
      }
      const key = getJoinMemberProfileCacheKey(member);
      if (!key) return null;
      const entry = readJoinMemberProfileCompletionStore()[key];
      if (!entry || typeof entry.complete !== "boolean") return null;
      if (Date.now() - Number(entry.checkedAt || 0) > JOIN_MEMBER_PROFILE_COMPLETION_TTL_MS) return null;
      return entry.complete;
    }

    function rememberJoinMemberProfileCompletion(member = {}, complete = false) {
      const key = getJoinMemberProfileCacheKey(member);
      if (!key) return;
      const normalizedComplete = Boolean(complete);
      try {
        const store = readJoinMemberProfileCompletionStore();
        store[key] = { complete: normalizedComplete, checkedAt: Date.now() };
        sessionStorage.setItem(JOIN_MEMBER_PROFILE_COMPLETION_KEY, JSON.stringify(store));
        [JOIN_TEMP_ADMIN_LOGIN_KEY, JOIN_SESSION_MEMBER_KEY].forEach((storageKey) => {
          const storedMember = JSON.parse(sessionStorage.getItem(storageKey) || "null");
          if (!storedMember || getJoinMemberProfileCacheKey(storedMember) !== key) return;
          sessionStorage.setItem(storageKey, JSON.stringify({
            ...storedMember,
            profileComplete: normalizedComplete,
            profileCompleteCheckedAt: Date.now()
          }));
        });
      } catch (error) {
        golfJoinSafeWarn("Failed to cache join member profile completion.", error);
      }
    }

    function clearJoinMemberProfileCompletion(member = null) {
      try {
        if (!member) {
          sessionStorage.removeItem(JOIN_MEMBER_PROFILE_COMPLETION_KEY);
          return;
        }
        const key = getJoinMemberProfileCacheKey(member);
        if (!key) return;
        const store = readJoinMemberProfileCompletionStore();
        delete store[key];
        sessionStorage.setItem(JOIN_MEMBER_PROFILE_COMPLETION_KEY, JSON.stringify(store));
        [JOIN_TEMP_ADMIN_LOGIN_KEY, JOIN_SESSION_MEMBER_KEY].forEach((storageKey) => {
          const storedMember = JSON.parse(sessionStorage.getItem(storageKey) || "null");
          if (!storedMember || getJoinMemberProfileCacheKey(storedMember) !== key) return;
          const { profileComplete, profileCompleteCheckedAt, ...memberWithoutCompletion } = storedMember;
          sessionStorage.setItem(storageKey, JSON.stringify(memberWithoutCompletion));
        });
      } catch (error) {
        golfJoinSafeWarn("Failed to clear join member profile completion.", error);
      }
    }

    function rememberJoinMemberProfileLocally(member = {}, profile = {}) {
      const memberMobile = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      const profileMobile = normalizeJoinMemberPhone(profile.memberMobile || profile.mobile || profile.phone || "");
      const keys = Array.from(new Set([
        member.memberSeq,
        member.memberId,
        memberMobile,
        member.memberEmail,
        member.kakaoId,
        profile.memberSeq,
        profile.memberId,
        profileMobile,
        profile.memberEmail,
        profile.kakaoId
      ].map((value) => String(value || "").trim()).filter(Boolean)));
      if (!keys.length) return;
      try {
        const store = JSON.parse(localStorage.getItem("joinMemberProfiles") || "{}");
        const existingProfile = keys.map((key) => store[key]).find(Boolean) || {};
        const cachedProfile = {
          ...existingProfile,
          ...profile,
          memberSeq: member.memberSeq || profile.memberSeq || "",
          memberId: member.memberId || profile.memberId || "",
          memberName: profile.memberName || profile.name || member.memberName || "",
          memberMobile: profileMobile || memberMobile || "",
          mobile: profileMobile || memberMobile || "",
          phone: profileMobile || memberMobile || "",
          memberEmail: member.memberEmail || profile.memberEmail || profile.email || "",
          memberChannel: member.memberChannel || profile.memberChannel || "",
          kakaoId: member.kakaoId || profile.kakaoId || "",
          kakaoNickname: member.kakaoNickname || profile.kakaoNickname || "",
          updatedAt: nowKstISOString()
        };
        keys.forEach((key) => {
          store[key] = {
            ...store[key],
            ...cachedProfile
          };
        });
        localStorage.setItem("joinMemberProfiles", JSON.stringify(store));
        if (member.isTempAdmin) {
          sessionStorage.setItem(JOIN_TEMP_ADMIN_LOGIN_KEY, JSON.stringify({
            ...member,
            ...cachedProfile,
            isTempAdmin: true
          }));
        }
        if (member.isSessionMember) {
          sessionStorage.setItem(JOIN_SESSION_MEMBER_KEY, JSON.stringify({
            ...member,
            ...cachedProfile,
            isSessionMember: true
          }));
        }
      } catch (error) {
        golfJoinSafeWarn("Failed to cache join member profile.", error);
      }
    }

    function getRememberedJoinMemberProfile(member = {}) {
      try {
        const store = JSON.parse(localStorage.getItem("joinMemberProfiles") || "{}");
        const keys = [
          member.memberSeq,
          member.memberId,
          normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || ""),
          member.memberEmail,
          member.kakaoId
        ].map((value) => String(value || "").trim()).filter(Boolean);
        for (const key of keys) {
          if (store[key]) return store[key];
        }
      } catch (error) {
        golfJoinSafeWarn("Failed to read cached join member profile.", error);
      }
      return {};
    }

    const joinMemberProfileLookupPromises = new Map();
    const joinMemberProfileLookupResults = new Map();

    function clearRememberedJoinMemberProfile(member = {}) {
      try {
        const store = JSON.parse(localStorage.getItem("joinMemberProfiles") || "{}");
        const keys = [
          member.memberSeq,
          member.memberId,
          normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || ""),
          member.memberEmail,
          member.kakaoId
        ].map((value) => String(value || "").trim()).filter(Boolean);
        keys.forEach((key) => delete store[key]);
        localStorage.setItem("joinMemberProfiles", JSON.stringify(store));
        [JOIN_TEMP_ADMIN_LOGIN_KEY, JOIN_SESSION_MEMBER_KEY].forEach((storageKey) => {
          const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
          if (!stored) return;
          const storedKeys = [
            stored.memberSeq,
            stored.memberId,
            normalizeJoinMemberPhone(stored.memberMobile || stored.mobile || stored.phone || ""),
            stored.memberEmail,
            stored.kakaoId
          ].map((value) => String(value || "").trim()).filter(Boolean);
          if (storedKeys.some((key) => keys.includes(key))) {
            sessionStorage.setItem(storageKey, JSON.stringify({
              ...stripJoinMemberProfileFields(stored),
              isTempAdmin: Boolean(stored.isTempAdmin),
              isSessionMember: Boolean(stored.isSessionMember)
            }));
          }
        });
        Array.from(joinMemberProfileLookupResults.keys()).forEach((lookupKey) => {
          if (keys.some((key) => String(lookupKey || "").includes(key))) {
            joinMemberProfileLookupResults.delete(lookupKey);
          }
        });
        Array.from(joinMemberProfileLookupPromises.keys()).forEach((lookupKey) => {
          if (keys.some((key) => String(lookupKey || "").includes(key))) {
            joinMemberProfileLookupPromises.delete(lookupKey);
          }
        });
      } catch (error) {
        golfJoinSafeWarn("Failed to clear cached join member profile.", error);
      }
    }

    function getStableJoinMemberProfileId(member = {}, fallbackMobile = "") {
      const cached = getRememberedJoinMemberProfile(member);
      if (cached.profileId) return cached.profileId;
      const key = String(
        member.memberSeq
        || member.memberId
        || member.memberEmail
        || ""
      ).trim();
      return buildGoogleSheetRecordId("jmp", "member", key || "profile");
    }

    function normalizeJoinMemberProfileRow(row = {}) {
      const mobile = normalizeJoinMemberPhone(
        row.memberMobile
        || getNestedValue(row, "member.memberMobile")
        || row.mobile
        || row.phone
        || ""
      );
      const profile = row.profile || {};
      return {
        profileId: row.profileId || "",
        submittedAt: row.submittedAt || "",
        memberSeq: row.memberSeq || getNestedValue(row, "member.memberSeq") || "",
        memberId: row.memberId || getNestedValue(row, "member.memberId") || getNestedValue(row, "kakao.kakaoId") || "",
        memberName: row.memberName || getNestedValue(row, "member.memberName") || row.name || "",
        memberChannel: row.memberChannel || getNestedValue(row, "member.memberChannel") || "",
        memberMobile: mobile,
        memberEmail: row.memberEmail || getNestedValue(row, "member.memberEmail") || row.email || "",
        kakaoId: row.kakaoId || getNestedValue(row, "kakao.kakaoId") || "",
        kakaoNickname: row.kakaoNickname || getNestedValue(row, "kakao.nickname") || "",
        name: row.memberName || getNestedValue(row, "member.memberName") || row.name || "",
        gender: normalizeJoinMemberGender(row.gender || profile.gender || ""),
        birthYear: row.birthYear || profile.birthYear || "",
        birthday: row.birthYear || profile.birthYear || "",
        profession: row.profession || profile.profession || "",
        level: row.level || profile.level || "",
        travelStyles: row.travelStyles || row.styles || profile.travelStyles || profile.styles || "",
        profileImageUrl: row.profileImageUrl || profile.profileImageUrl || row.imageUrl || "",
        profileThumbnailUrl: row.profileThumbnailUrl || profile.profileThumbnailUrl || row.thumbnailUrl || row.profileImageUrl || profile.profileImageUrl || row.imageUrl || "",
        profileImageObjectName: row.profileImageObjectName || profile.profileImageObjectName || row.objectName || "",
        profileImageMimeType: row.profileImageMimeType || profile.profileImageMimeType || row.photoMimeType || "",
        profileImageSize: row.profileImageSize || profile.profileImageSize || row.photoSize || "",
        profileImageUpdatedAt: row.profileImageUpdatedAt || profile.profileImageUpdatedAt || row.updatedAt || row.submittedAt || "",
        updatedAt: row.updatedAt || row.submittedAt || ""
      };
    }

    async function fetchJoinMemberProfileFromGoogleSheet(member = {}, options = {}) {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return {};
      const memberSeq = String(member.memberSeq || "").trim();
      const memberId = String(member.memberId || "").trim();
      const memberMobile = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      const memberEmail = String(member.memberEmail || member.email || "").trim();
      const kakaoId = String(member.kakaoId || "").trim();
      if (!memberSeq && !memberId && !memberMobile && !memberEmail && !kakaoId) return {};
      const lookupKey = [memberSeq, memberId, memberMobile, memberEmail, kakaoId].filter(Boolean).join("|");
      const cachedLookup = joinMemberProfileLookupResults.get(lookupKey);
      if (!options.refresh && cachedLookup && Date.now() - cachedLookup.fetchedAt <= GOOGLE_SHEET_READ_CACHE_TTL_MS) {
        return cachedLookup.profile || {};
      }
      if (!options.refresh && joinMemberProfileLookupPromises.has(lookupKey)) {
        return joinMemberProfileLookupPromises.get(lookupKey);
      }
      const lookupPromise = (async () => {
      try {
        const lookupData = await postGolfJoinSheetAction("member_profile_lookup", {
          memberSeq,
          memberId,
          memberMobile,
          memberEmail,
          kakaoId
        }, "Member profile", { timeoutMs: JOIN_MEMBER_PROFILE_LOOKUP_TIMEOUT_MS });
        if (lookupData?.lookupFailed) {
          throw new Error(lookupData.error || "Member profile lookup failed");
        }
        const rows = getGolfJoinSheetActionRows(lookupData);
        const profile = normalizeJoinMemberProfileRow(rows[0] || {});
        if (profile.gender || profile.birthYear || profile.profession || profile.level || profile.travelStyles || profile.profileImageUrl || profile.profileThumbnailUrl) {
          rememberJoinMemberProfileLocally(member, profile);
          joinMemberProfileLookupResults.set(lookupKey, { fetchedAt: Date.now(), profile });
          return profile;
        }
      } catch (error) {
        golfJoinSafeWarn("Failed to load join member profile from Google Sheet.", error);
        const lookupFailedProfile = { __lookupFailed: true };
        joinMemberProfileLookupResults.set(lookupKey, { fetchedAt: Date.now(), profile: lookupFailedProfile });
        return lookupFailedProfile;
      }
      joinMemberProfileLookupResults.set(lookupKey, { fetchedAt: Date.now(), profile: {} });
      return {};
      })().finally(() => {
        joinMemberProfileLookupPromises.delete(lookupKey);
      });
      joinMemberProfileLookupPromises.set(lookupKey, lookupPromise);
      return lookupPromise;
    }

    function mergeJoinMemberWithProfile(member = {}, profile = {}) {
      const memberMobile = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      const profileMobile = normalizeJoinMemberPhone(profile.memberMobile || profile.mobile || profile.phone || "");
      return {
        ...member,
        memberName: profile.memberName || profile.name || member.memberName || "",
        memberMobile: profileMobile || memberMobile || "",
        memberEmail: member.memberEmail || profile.memberEmail || profile.email || "",
        kakaoId: member.kakaoId || profile.kakaoId || "",
        kakaoNickname: member.kakaoNickname || profile.kakaoNickname || "",
        gender: profile.gender || member.gender || "",
        birthYear: profile.birthYear || member.birthYear || "",
        birthday: profile.birthYear || member.birthday || "",
        profession: profile.profession || member.profession || "",
        level: profile.level || member.level || "",
        travelStyles: profile.travelStyles || member.travelStyles || "",
        profileImageUrl: profile.profileImageUrl || member.profileImageUrl || "",
        profileThumbnailUrl: profile.profileThumbnailUrl || member.profileThumbnailUrl || profile.profileImageUrl || member.profileImageUrl || "",
        profileImageObjectName: profile.profileImageObjectName || member.profileImageObjectName || "",
        profileImageMimeType: profile.profileImageMimeType || member.profileImageMimeType || "",
        profileImageSize: profile.profileImageSize || member.profileImageSize || "",
        profileImageUpdatedAt: profile.profileImageUpdatedAt || member.profileImageUpdatedAt || profile.updatedAt || ""
      };
    }

    function getJoinMemberWithCachedProfile(member = {}) {
      if (!member) return member;
      return mergeJoinMemberWithProfile(member, getRememberedJoinMemberProfile(member));
    }

    function preloadJoinProfileImage(member = {}) {
      const imageUrl = getJoinProfileImageDisplayUrl(member);
      if (!imageUrl || typeof Image === "undefined") return;
      const image = new Image();
      image.decoding = "async";
      image.src = imageUrl;
    }

    function stripJoinMemberProfileFields(member = {}) {
      const {
        gender,
        birthYear,
        birthday,
        profession,
        level,
        travelStyles,
        styles,
        profileImageUrl,
        profileThumbnailUrl,
        profileImageObjectName,
        profileImageMimeType,
        profileImageSize,
        profileImageUpdatedAt,
        ...baseMember
      } = member || {};
      return baseMember;
    }

    async function hydrateJoinMemberProfile(member = {}, options = {}) {
      const cached = getRememberedJoinMemberProfile(member);
      const isTempAdmin = isJoinTempAdminMember(member);
      if (!isTempAdmin && !options.refresh && isJoinMemberProfileComplete(cached)) {
        const cachedMember = mergeJoinMemberWithProfile(member, cached);
        rememberJoinMemberProfileCompletion(cachedMember, true);
        return cachedMember;
      }
      const sheetProfile = await fetchJoinMemberProfileFromGoogleSheet(member, options);
      if (sheetProfile.__lookupFailed) {
        clearJoinMemberProfileCompletion(member);
        return {
          ...mergeJoinMemberWithProfile(member, cached),
          __profileLookupFailed: true
        };
      }
      let hydratedMember;
      if (isTempAdmin && !isJoinMemberProfileComplete(sheetProfile)) {
        clearRememberedJoinMemberProfile(member);
        hydratedMember = mergeJoinMemberWithProfile(stripJoinMemberProfileFields(member), sheetProfile);
      } else if (options.refresh && !isJoinMemberProfileComplete(sheetProfile)) {
        clearRememberedJoinMemberProfile(member);
        hydratedMember = mergeJoinMemberWithProfile(stripJoinMemberProfileFields(member), sheetProfile);
      } else {
        hydratedMember = mergeJoinMemberWithProfile(member, {
          ...cached,
          ...sheetProfile
        });
      }
      rememberJoinMemberProfileCompletion(hydratedMember, isJoinMemberProfileComplete(hydratedMember));
      return hydratedMember;
    }

    function getJoinSignupProfileSnapshot(member = {}) {
      const name = document.getElementById("joinMemberSignupName")?.value.trim() || member.memberName || "";
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || member.memberMobile || "");
      const email = document.getElementById("joinMemberSignupContactEmail")?.value.trim() || member.memberEmail || "";
      return {
        name,
        gender: getJoinMemberSignupSelectedGender(),
        birthYear: document.getElementById("joinMemberSignupBirthYear")?.value || "",
        mobile,
        phone: mobile,
        profession: document.getElementById("joinMemberSignupProfession")?.value || "",
        level: getJoinMemberSignupSelectedLevel(),
        travelStyles: getJoinMemberSignupSelectedTravelStyles(),
        email
      };
    }

    function openJoinMemberKakaoProfileForm(member = {}) {
      const overlay = portalOverlayToBody("joinMemberLoginModal");
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      const form = document.getElementById("joinMemberSignupForm");
      if (!form) return;
      const pending = getJoinPendingKakaoProfile();
      modal?.classList.add("is-signup-mode");
      modal?.classList.remove("is-email-mode", "is-signup-intro-mode", "is-find-id-mode", "is-find-pw-mode", "is-profile-required");
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "추가정보 입력";
      populateJoinMemberSignupYears();
      resetJoinMemberEmailValidation();
      resetJoinMemberSignupValidation();
      form.dataset.profileOnly = "true";
      form.dataset.profileRequired = "false";
      form.classList.add("is-open", "is-profile-only", "is-kakao-signup");
      form.classList.remove("is-email-valid");
      document.getElementById("joinMemberSignupIntro")?.classList.remove("is-open");
      document.getElementById("joinMemberEmailForm")?.classList.remove("is-open");
      const nicknameInput = document.getElementById("joinMemberSignupKakaoNickname");
      const nameInput = document.getElementById("joinMemberSignupName");
      const mobileInput = document.getElementById("joinMemberSignupMobile");
      const emailInput = document.getElementById("joinMemberSignupContactEmail");
      if (nicknameInput) nicknameInput.value = pending.nickname || "";
      if (nameInput && !nameInput.value.trim()) nameInput.value = member.memberName || pending.name || "";
      if (mobileInput && !mobileInput.value.trim()) {
        mobileInput.value = normalizeJoinMemberPhone(member.memberMobile || pending.phone || "");
        formatJoinMemberSignupMobile(mobileInput);
      }
      if (emailInput && !emailInput.value.trim()) emailInput.value = member.memberEmail || pending.email || "";
      syncAllJoinMemberFloatingFields();
      setJoinMemberSignupStep(1);
      setJoinMemberLoginStatus("");
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
    }

    function syncJoinMemberGenderToggleSlider(group = document.querySelector('[data-chip-group="join-member-gender"]')) {
      if (!group) return;
      const chips = Array.from(group.querySelectorAll(".apply-chip"));
      const activeIndex = chips.findIndex((chip) => chip.classList.contains("active"));
      group.style.setProperty("--join-member-gender-index", String(Math.max(0, activeIndex)));
      group.classList.toggle("has-gender-selection", activeIndex >= 0);
    }

    function setJoinMemberSignupChipValue(groupName, value) {
      document.querySelectorAll(`[data-chip-group="${groupName}"] .apply-chip`).forEach((chip) => {
        chip.classList.toggle("active", Boolean(value) && chip.dataset.value === value);
      });
      if (groupName === "join-member-gender") {
        syncJoinMemberGenderToggleSlider();
      }
    }

    function setJoinMemberSignupChipValues(groupName, values = []) {
      const selected = new Set(splitJoinMemberProfileStyles(values));
      document.querySelectorAll(`[data-chip-group="${groupName}"] .apply-chip`).forEach((chip) => {
        chip.classList.toggle("active", selected.has(chip.dataset.value || chip.textContent.trim()));
      });
    }

    function updateOpenJoinMemberRequiredProfileFormMember(member = {}) {
      const form = document.getElementById("joinMemberSignupForm");
      if (!form?.classList.contains("is-open") || form.dataset.profileRequired !== "true") return;
      const mergedMember = {
        ...(joinMyMenuState.pendingProfileMember || {}),
        ...(member || {})
      };
      joinMyMenuState.pendingProfileMember = mergedMember;
      const nameInput = document.getElementById("joinMemberSignupName");
      const mobileInput = document.getElementById("joinMemberSignupMobile");
      const emailInput = document.getElementById("joinMemberSignupContactEmail");
      const birthYearInput = document.getElementById("joinMemberSignupBirthYear");
      if (nameInput && !nameInput.value.trim()) nameInput.value = mergedMember.memberName || mergedMember.name || "";
      if (mobileInput && !normalizeJoinMemberPhone(mobileInput.value)) {
        mobileInput.value = normalizeJoinMemberPhone(mergedMember.memberMobile || mergedMember.mobile || mergedMember.phone || "");
        formatJoinMemberSignupMobile(mobileInput);
      }
      if (emailInput && !emailInput.value.trim()) emailInput.value = mergedMember.memberEmail || mergedMember.email || "";
      if (birthYearInput && !birthYearInput.value) birthYearInput.value = getJoinMemberBirthYear(mergedMember);
      syncAllJoinMemberFloatingFields();
      updateJoinMemberSignupNavState();
    }

    async function waitForOpenJoinMemberRequiredProfileFields() {
      const form = document.getElementById("joinMemberSignupForm");
      if (!form?.classList.contains("is-open") || form.dataset.profileRequired !== "true") return;
      const mobileInput = document.getElementById("joinMemberSignupMobile");
      const emailInput = document.getElementById("joinMemberSignupContactEmail");
      if (normalizeJoinMemberPhone(mobileInput?.value || "") && String(emailInput?.value || "").trim()) return;
      const pending = joinMyMenuState.pendingProfileDetailPromise;
      if (!pending) return;
      try {
        await raceJoinPromises([
          pending,
          new Promise((resolve) => {
            const startedAt = Date.now();
            const check = () => {
              if (normalizeJoinMemberPhone(mobileInput?.value || "") && String(emailInput?.value || "").trim()) {
                resolve(true);
                return;
              }
              if (Date.now() - startedAt > 2500) {
                resolve(false);
                return;
              }
              window.setTimeout(check, 50);
            };
            check();
          })
        ]);
      } catch (error) {
        golfJoinSafeWarn("Failed to wait for required join member profile fields.", error);
      }
    }

    function openJoinMemberRequiredProfileForm(member = {}, afterLogin = "my-menu", extraParams = {}) {
      const overlay = portalOverlayToBody("joinMemberLoginModal");
      const modal = document.querySelector("#joinMemberLoginModal .join-member-login-modal");
      const form = document.getElementById("joinMemberSignupForm");
      if (!form) return;
      joinMyMenuState.pendingProfileAfterLogin = afterLogin || "my-menu";
      joinMyMenuState.pendingProfileParams = { ...extraParams };
      joinMyMenuState.pendingProfileMember = member || {};
      joinMyMenuState.pendingProfileDetailPromise = null;
      modal?.classList.add("is-signup-mode", "is-profile-required");
      modal?.classList.remove("is-email-mode", "is-signup-intro-mode", "is-find-id-mode", "is-find-pw-mode");
      const title = document.getElementById("joinMemberLoginTitle");
      if (title) title.textContent = "추가정보 입력";
      populateJoinMemberSignupYears();
      resetJoinMemberEmailValidation();
      resetJoinMemberSignupValidation();
      form.dataset.profileOnly = "true";
      form.dataset.profileRequired = "true";
      form.classList.add("is-open", "is-profile-only", "is-profile-required");
      form.classList.remove("is-kakao-signup");
      document.getElementById("joinMemberSignupIntro")?.classList.remove("is-open");
      document.getElementById("joinMemberEmailForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindIdForm")?.classList.remove("is-open");
      document.getElementById("joinMemberFindPwForm")?.classList.remove("is-open");
      const nameInput = document.getElementById("joinMemberSignupName");
      const mobileInput = document.getElementById("joinMemberSignupMobile");
      const emailInput = document.getElementById("joinMemberSignupContactEmail");
      const birthYearInput = document.getElementById("joinMemberSignupBirthYear");
      if (nameInput) nameInput.value = member.memberName || member.name || "";
      if (mobileInput) mobileInput.value = normalizeJoinMemberPhone(member.memberMobile || member.mobile || member.phone || "");
      if (emailInput) emailInput.value = member.memberEmail || member.email || "";
      if (birthYearInput) birthYearInput.value = getJoinMemberBirthYear(member);
      setJoinMemberSignupChipValue("join-member-gender", member.gender || "");
      setJoinMemberSignupChipValue("join-member-level", member.level || "");
      setJoinMemberSignupChipValues("join-member-travel-style", member.travelStyles || member.styles || []);
      const professionInput = document.getElementById("joinMemberSignupProfession");
      if (professionInput) professionInput.value = member.profession || "";
      syncAllJoinMemberFloatingFields();
      setJoinMemberSignupStep(1);
      setJoinMemberLoginStatus("");
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
    }

    function continueAfterJoinMemberProfileSave(member = {}) {
      const afterLogin = joinMyMenuState.pendingProfileAfterLogin || joinMyMenuState.pendingAfterLogin || "my-menu";
      const params = joinMyMenuState.pendingProfileParams || {};
      joinMyMenuState.pendingProfileAfterLogin = "my-menu";
      joinMyMenuState.pendingProfileParams = {};
      joinMyMenuState.pendingProfileMember = null;
      closeJoinMemberLoginModal();
      if (afterLogin === "builder") {
        continueBuilderAfterLogin(params, { skipProfileCheck: true });
        return;
      }
      if (afterLogin === "apply") {
        if (params.applyJoinId) currentDetailJoinId = params.applyJoinId;
        openGlobalApply({ skipProfileCheck: true });
        return;
      }
      if (afterLogin === "interest") {
        setJoinMobileNavActive("my");
        openJoinMyMenu({ skipProfileCheck: true, member });
        return;
      }
      if (afterLogin === "my-drawer") {
        setJoinMobileNavActive("my");
        showJoinMyDrawer(member);
        return;
      }
      if (afterLogin === "detail-wish") {
        continueDetailWishAfterLogin(params, { skipProfileCheck: true });
        return;
      }
      if (afterLogin === "detail") {
        continueJoinExternalDetailAfterLogin(params);
        return;
      }
      if (afterLogin === "my-section") {
        continueMyHomeJoinDeepLinkAfterLogin(params);
        return;
      }
      if (afterLogin === "profile-manage") {
        openJoinProfileManageModal();
        return;
      }
      if (afterLogin === "my-menu") {
        setJoinMobileNavActive("my");
        openJoinMyMenu({ skipProfileCheck: true, member, tab: params.golfjoinTab || "" });
        return;
      }
      setJoinMobileNavActive("my");
      openJoinMyMenu({ skipProfileCheck: true, member });
    }

    function resetJoinMemberSignupValidation() {
      document.getElementById("joinMemberSignupForm")?.classList.remove("is-email-valid");
      joinMemberSignupIdImeMode = "unknown";
      Object.values(joinMyMenuState.signupDuplicateTimers || {}).forEach((timer) => window.clearTimeout(timer));
      joinMyMenuState.signupDuplicateLocks = {};
      joinMyMenuState.signupDuplicateTimers = {};
      joinMyMenuState.signupDuplicateCheckedValues = {};
      closeJoinMemberSignupAlert();
      [
        ["joinMemberSignupEmailField", "joinMemberSignupEmailHelper"],
        ["joinMemberSignupPasswordField", "joinMemberSignupPasswordHelper"],
        ["joinMemberSignupPasswordConfirmField", "joinMemberSignupPasswordConfirmHelper"],
        ["joinMemberSignupNameField", "joinMemberSignupNameHelper"],
        ["joinMemberSignupMobileField", "joinMemberSignupMobileHelper"],
        ["joinMemberSignupContactEmailField", "joinMemberSignupContactEmailHelper"],
        ["joinMemberSignupBirthYearField", "joinMemberSignupBirthYearHelper"],
        ["joinMemberSignupGenderField", "joinMemberSignupGenderHelper"]
      ].forEach(([fieldId, helperId]) => setJoinMemberFieldInvalid(fieldId, helperId, ""));
      document.querySelectorAll('[data-chip-group="join-member-gender"] .apply-chip').forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.value === "남성");
      });
      syncJoinMemberGenderToggleSlider();
      document.querySelectorAll('[data-chip-group="join-member-level"] .apply-chip, [data-chip-group="join-member-travel-style"] .apply-chip').forEach((chip) => {
        chip.classList.remove("active");
      });
      const professionInput = document.getElementById("joinMemberSignupProfession");
      if (professionInput) professionInput.value = "";
      document.querySelectorAll("#joinMemberSignupForm [data-signup-profession-chip]").forEach((chip) => chip.classList.remove("active"));
      renderJoinMemberSignupCustomProfession("");
      document.getElementById("joinMemberSignupAgreeAll")?.removeAttribute("aria-invalid");
      syncJoinMemberSignupAgreementState();
      syncAllJoinMemberFloatingFields();
      setJoinMemberSignupStep(1);
    }

    function postJoinMemberForm(url, data) {
      return postJoinMemberLoginForm(url, data);
    }

    function buildJoinMemberSavePayload(data = {}) {
      const allowedKeys = [
        "mobile1",
        "mobile2",
        "mobile3",
        "custPw",
        "smsYn",
        "emailYn",
        "extnChnlLinkCd",
        "validTermCd",
        "custId",
        "custNm",
        "mobile",
        "email"
      ];
      return allowedKeys.reduce((payload, key) => {
        if (data[key] != null && data[key] !== "") payload[key] = data[key];
        return payload;
      }, {});
    }

    function buildJoinExternalMemberSavePayload(data = {}) {
      const allowedKeys = [
        "mobile1",
        "mobile2",
        "mobile3",
        "smsYn",
        "emailYn",
        "custId",
        "extnChnlLinkCd",
        "extnChnlLinkToken",
        "validTermCd",
        "email",
        "custNm",
        "mobile"
      ];
      return allowedKeys.reduce((payload, key) => {
        if (data[key] != null && data[key] !== "") payload[key] = data[key];
        return payload;
      }, {});
    }

    function buildJoinExternalMemberLoginPayload(data = {}) {
      return {
        externalId: data.externalId || data.custId || "",
        externalNickname: data.externalNickname || "",
        externalName: data.externalName || data.custNm || "",
        externalEmail: data.externalEmail || data.email || "",
        extnChnlLinkToken: data.extnChnlLinkToken || "",
        extnChnlLinkCd: "KAKAO"
      };
    }

    async function prepareJoinMemberSaveSession(validTermCd = "010") {
      const joinPayFg = String(validTermCd || "010").trim() || "010";
      const result = await postJoinMemberForm("/member/setJoinPayFg.json", { joinPayFg });
      if (Number(result?.count) !== 1) {
        throw createJoinMemberApiError(
          summarizeJoinMemberApiResponse(result) || "회원등급 정보를 설정하지 못했습니다.",
          { endpoint: "/member/setJoinPayFg.json", responseData: result }
        );
      }
      return result;
    }

    function splitJoinMemberMobile(value = "") {
      const mobile = normalizeJoinMemberPhone(value);
      return {
        mobile,
        mobile1: mobile.substring(0, 3),
        mobile2: mobile.substring(3, 7),
        mobile3: mobile.substring(7, 11)
      };
    }

    function setJoinMemberFindFieldInvalid(fieldId, helperId, message = "") {
      setJoinMemberFieldInvalid(fieldId, helperId, message);
      return !message;
    }

    function validateJoinMemberFindIdForm() {
      const name = document.getElementById("joinMemberFindIdName")?.value.trim() || "";
      const email = document.getElementById("joinMemberFindIdEmail")?.value.trim() || "";
      const { mobile } = splitJoinMemberMobile(document.getElementById("joinMemberFindIdMobile")?.value || "");
      const checks = [
        setJoinMemberFindFieldInvalid("joinMemberFindIdNameField", "joinMemberFindIdNameHelper", name.length >= 2 ? "" : "이름을 입력해 주세요."),
        setJoinMemberFindFieldInvalid("joinMemberFindIdMobileField", "joinMemberFindIdMobileHelper", /^01\d{8,9}$/.test(mobile) ? "" : "올바른 휴대폰번호를 입력해 주세요."),
        setJoinMemberFindFieldInvalid("joinMemberFindIdEmailField", "joinMemberFindIdEmailHelper", isValidJoinMemberEmail(email) ? "" : "이메일 형식으로 입력해 주세요.")
      ];
      return checks.every(Boolean);
    }

    function validateJoinMemberFindPwForm() {
      const custId = document.getElementById("joinMemberFindPwId")?.value.trim() || "";
      const name = document.getElementById("joinMemberFindPwName")?.value.trim() || "";
      const { mobile } = splitJoinMemberMobile(document.getElementById("joinMemberFindPwMobile")?.value || "");
      const checks = [
        setJoinMemberFindFieldInvalid("joinMemberFindPwIdField", "joinMemberFindPwIdHelper", custId.length >= 2 ? "" : "아이디를 입력해 주세요."),
        setJoinMemberFindFieldInvalid("joinMemberFindPwNameField", "joinMemberFindPwNameHelper", name.length >= 2 ? "" : "이름을 입력해 주세요."),
        setJoinMemberFindFieldInvalid("joinMemberFindPwMobileField", "joinMemberFindPwMobileHelper", /^01\d{8,9}$/.test(mobile) ? "" : "올바른 휴대폰번호를 입력해 주세요.")
      ];
      return checks.every(Boolean);
    }

    function showJoinMemberFindIdFail() {
      document.getElementById("joinMemberFindIdResult")?.classList.remove("is-visible");
      document.getElementById("joinMemberFindIdFail")?.classList.add("is-visible");
      setJoinMemberLoginStatus("");
    }

    function showJoinMemberFindPwFail() {
      document.getElementById("joinMemberFindPwReset")?.classList.remove("is-visible");
      document.getElementById("joinMemberFindPwFail")?.classList.add("is-visible");
      document.querySelector("[data-find-pw-check]")?.removeAttribute("hidden");
      setJoinMemberLoginStatus("");
    }

    function retryJoinMemberFindId() {
      document.getElementById("joinMemberFindIdFail")?.classList.remove("is-visible");
      setJoinMemberLoginStatus("");
      requestAnimationFrame(() => document.getElementById("joinMemberFindIdName")?.focus());
    }

    function retryJoinMemberFindPw() {
      document.getElementById("joinMemberFindPwFail")?.classList.remove("is-visible");
      setJoinMemberLoginStatus("");
      requestAnimationFrame(() => document.getElementById("joinMemberFindPwId")?.focus());
    }

    async function submitJoinMemberFindId() {
      if (joinMyMenuState.loginRedirecting) return;
      if (!validateJoinMemberFindIdForm()) return;
      document.getElementById("joinMemberFindIdResult")?.classList.remove("is-visible");
      document.getElementById("joinMemberFindIdFail")?.classList.remove("is-visible");
      const custNm = document.getElementById("joinMemberFindIdName")?.value.trim() || "";
      const email = document.getElementById("joinMemberFindIdEmail")?.value.trim() || "";
      const mobileParts = splitJoinMemberMobile(document.getElementById("joinMemberFindIdMobile")?.value || "");
      joinMyMenuState.loginRedirecting = true;
      setJoinMemberLoginStatus("아이디를 확인하고 있어요.");
      try {
        const result = await postJoinMemberForm("/member/getMemberFindId.json", {
          email,
          custNm,
          mobile1: mobileParts.mobile1,
          mobile2: mobileParts.mobile2,
          mobile3: mobileParts.mobile3
        });
        joinMyMenuState.loginRedirecting = false;
        const custId = String(result?.data?.custId || "");
        if ((result?.message || "") !== "SUCCESS" || !custId) {
          showJoinMemberFindIdFail();
          return;
        }
        joinMyMenuState.foundMemberId = custId;
        joinMyMenuState.findMemberName = custNm;
        joinMyMenuState.findMemberMobile = mobileParts.mobile;
        const foundNode = document.getElementById("joinMemberFoundId");
        if (foundNode) foundNode.textContent = custId;
        document.getElementById("joinMemberFindIdResult")?.classList.add("is-visible");
        setJoinMemberLoginStatus("");
      } catch (error) {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Find ID failed.", error);
        setJoinMemberLoginStatus("아이디 찾기 처리 중 오류가 발생했습니다.");
      }
    }

    function prefillJoinMemberLoginFromFoundId() {
      openJoinMemberEmailForm();
      const loginId = document.getElementById("joinMemberLoginId");
      const password = document.getElementById("joinMemberLoginPassword");
      if (loginId) loginId.value = joinMyMenuState.foundMemberId || loginId.value;
      setJoinMemberFieldInvalid("joinMemberLoginIdField", "joinMemberLoginIdHelper", "");
      requestAnimationFrame(() => password?.focus());
    }

    async function submitJoinMemberFindPw() {
      if (joinMyMenuState.loginRedirecting) return;
      if (!validateJoinMemberFindPwForm()) return;
      document.getElementById("joinMemberFindPwReset")?.classList.remove("is-visible");
      document.getElementById("joinMemberFindPwFail")?.classList.remove("is-visible");
      const custId = document.getElementById("joinMemberFindPwId")?.value.trim() || "";
      const custNm = document.getElementById("joinMemberFindPwName")?.value.trim() || "";
      const mobileParts = splitJoinMemberMobile(document.getElementById("joinMemberFindPwMobile")?.value || "");
      joinMyMenuState.loginRedirecting = true;
      setJoinMemberLoginStatus("비밀번호 재설정 정보를 확인하고 있어요.");
      try {
        const result = await postJoinMemberForm("/member/getMemberFindPw.json", {
          custId,
          custNm,
          mobile1: mobileParts.mobile1,
          mobile2: mobileParts.mobile2,
          mobile3: mobileParts.mobile3
        });
        joinMyMenuState.loginRedirecting = false;
        const resetCustSeq = result?.data?.custSeq || "";
        const resetCustId = String(result?.data?.custId || "");
        if ((result?.message || "") !== "SUCCESS" || !resetCustSeq || !resetCustId) {
          showJoinMemberFindPwFail();
          return;
        }
        joinMyMenuState.resetPasswordToken = { custSeq: resetCustSeq, custId: resetCustId, loginId: custId };
        document.getElementById("joinMemberFindPwReset")?.classList.add("is-visible");
        document.querySelector("[data-find-pw-check]")?.setAttribute("hidden", "");
        setJoinMemberLoginStatus("");
        requestAnimationFrame(() => document.getElementById("joinMemberResetPassword")?.focus());
      } catch (error) {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Find password failed.", error);
        setJoinMemberLoginStatus("비밀번호 찾기 처리 중 오류가 발생했습니다.");
      }
    }

    async function submitJoinMemberResetPassword() {
      if (joinMyMenuState.loginRedirecting) return;
      const token = joinMyMenuState.resetPasswordToken;
      const password = document.getElementById("joinMemberResetPassword")?.value || "";
      const confirm = document.getElementById("joinMemberResetPasswordConfirm")?.value || "";
      if (!token?.custSeq || !token?.custId) {
        setJoinMemberLoginStatus("비밀번호 재설정 인증을 먼저 진행해 주세요.");
        return;
      }
      const validPassword = isValidJoinMemberPassword(password);
      setJoinMemberFieldInvalid("joinMemberResetPasswordField", "joinMemberResetPasswordHelper", validPassword ? "" : "유효한 비밀번호를 입력해 주세요.");
      setJoinMemberFieldInvalid("joinMemberResetPasswordConfirmField", "joinMemberResetPasswordConfirmHelper", password === confirm && validPassword ? "" : "비밀번호가 일치하지 않습니다.");
      if (!validPassword || password !== confirm) return;
      if (!window.$?.crypto?.encrypt) {
        setJoinMemberLoginStatus("운영 도메인에서 비밀번호 변경 모듈을 불러온 뒤 이용해 주세요.");
        return;
      }
      joinMyMenuState.loginRedirecting = true;
      setJoinMemberLoginStatus("새 비밀번호를 변경하고 있어요.");
      try {
        const result = await postJoinMemberForm("/member/updateMemberPw.json", {
          custSeq: token.custSeq,
          custId: token.custId,
          custPw: window.$.crypto.encrypt(password)
        });
        joinMyMenuState.loginRedirecting = false;
        if ((result?.message || "") !== "SUCCESS") {
          setJoinMemberLoginStatus("비밀번호 변경에 실패했습니다. 입력 정보를 다시 확인해 주세요.");
          return;
        }
        openJoinMemberEmailForm();
        const loginId = document.getElementById("joinMemberLoginId");
        const loginPassword = document.getElementById("joinMemberLoginPassword");
        if (loginId) loginId.value = token.loginId || joinMyMenuState.foundMemberId || "";
        if (loginPassword) loginPassword.value = "";
        joinMyMenuState.resetPasswordToken = null;
        setJoinMemberLoginStatus("비밀번호가 변경되었어요. 새 비밀번호로 로그인해 주세요.");
        requestAnimationFrame(() => loginPassword?.focus());
      } catch (error) {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Reset password failed.", error);
        setJoinMemberLoginStatus("비밀번호 변경 처리 중 오류가 발생했습니다.");
      }
    }

    async function checkJoinMemberSignupDuplicates(data) {
      joinMyMenuState.lastSignupDuplicateField = "";
      const idCheck = await postJoinMemberForm("/member/getMemberIdCheck.json", { custId: data.custId });
      if (Number(idCheck?.count) !== 0) {
        joinMyMenuState.lastSignupDuplicateField = "id";
        return getJoinMemberSignupDuplicateMessage("id");
      }
      const mobileCheck = await postJoinMemberForm("/member/getMemberMobileCheck.json", {
        mobile1: data.mobile1,
        mobile2: data.mobile2,
        mobile3: data.mobile3
      });
      if (Number(mobileCheck?.count) !== 0) {
        joinMyMenuState.lastSignupDuplicateField = "mobile";
        return getJoinMemberSignupDuplicateMessage("mobile");
      }
      const emailCheck = await postJoinMemberForm("/member/getMemberEmailCheck.json", { email: data.email });
      if (Number(emailCheck?.count) !== 0) {
        joinMyMenuState.lastSignupDuplicateField = "email";
        return getJoinMemberSignupDuplicateMessage("email");
      }
      return "";
    }

    async function checkJoinMemberKakaoSignupDuplicates(data) {
      joinMyMenuState.lastSignupDuplicateField = "";
      const idCheck = await postJoinMemberForm("/member/getMemberIdCheck.json", { custId: data.custId });
      if (Number(idCheck?.count) !== 0) {
        joinMyMenuState.lastSignupDuplicateField = "id";
        return getJoinMemberSignupDuplicateMessage("id");
      }
      const mobileCheck = await postJoinMemberForm("/member/getMemberMobileCheck.json", {
        mobile1: data.mobile1,
        mobile2: data.mobile2,
        mobile3: data.mobile3
      });
      if (Number(mobileCheck?.count) !== 0) {
        joinMyMenuState.lastSignupDuplicateField = "mobile";
        return getJoinMemberSignupDuplicateMessage("mobile");
      }
      if (data.email) {
        const emailCheck = await postJoinMemberForm("/member/getMemberEmailCheck.json", { email: data.email });
        if (Number(emailCheck?.count) !== 0) {
          joinMyMenuState.lastSignupDuplicateField = "email";
          return getJoinMemberSignupDuplicateMessage("email");
        }
      }
      return "";
    }

    function buildJoinMemberKakaoSignupData() {
      const pending = getJoinPendingKakaoProfile();
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || "");
      const name = document.getElementById("joinMemberSignupName")?.value.trim() || pending.name || "";
      const email = document.getElementById("joinMemberSignupContactEmail")?.value.trim() || pending.email || "";
      const birthYear = document.getElementById("joinMemberSignupBirthYear")?.value || "";
      const gender = getJoinMemberSignupSelectedGender();
      const profession = document.getElementById("joinMemberSignupProfession")?.value || "";
      const level = getJoinMemberSignupSelectedLevel();
      const travelStyles = getJoinMemberSignupSelectedTravelStyles();
      const marketingChecked = document.querySelector("#joinMemberSignupForm .join-member-signup-agreement[data-required='false']")?.checked;
      const externalId = String(pending.kakaoId || "");
      return {
        mobile1: mobile.substring(0, 3),
        mobile2: mobile.substring(3, 7),
        mobile3: mobile.substring(7, 11),
        smsYn: marketingChecked ? "Y" : "N",
        emailYn: marketingChecked ? "Y" : "N",
        extnChnlLinkCd: "KAKAO",
        extnChnlLinkToken: getJoinPendingKakaoAccessToken(pending),
        externalId,
        externalNickname: pending.nickname || "",
        externalName: name,
        externalEmail: email,
        validTermCd: "010",
        custId: externalId,
        custNm: name,
        mobile,
        email,
        birthYear,
        gender,
        profession,
        level,
        travelStyles: travelStyles.join(", ")
      };
    }

    function getJoinMemberFromKakaoSignupData(data = {}) {
      return {
        memberSeq: "",
        memberId: data.externalId || data.custId || "",
        memberName: data.custNm || data.externalName || "",
        memberChannel: "KAKAO",
        memberMobile: data.mobile || "",
        memberEmail: data.email || data.externalEmail || "",
        kakaoId: data.externalId || "",
        kakaoNickname: data.externalNickname || ""
      };
    }

    function buildJoinMemberKakaoResponseSnapshot(data = {}) {
      return {
        id: data.externalId || "",
        properties: { nickname: data.externalNickname || "" },
        kakao_account: {
          name: data.externalName || data.custNm || "",
          email: data.externalEmail || data.email || "",
          profile: { nickname: data.externalNickname || "" }
        }
      };
    }

    function mergeJoinMemberIdentity(baseMember = {}, nextMember = {}) {
      const merged = { ...baseMember };
      Object.entries(nextMember || {}).forEach(([key, value]) => {
        if (value != null && String(value).trim()) merged[key] = value;
      });
      return merged;
    }

    async function saveJoinMemberKakaoProfileAndContinue(data = {}, erpMember = {}) {
      const memberForSheet = mergeJoinMemberIdentity(getJoinMemberFromKakaoSignupData(data), erpMember);
      const existingProfile = await fetchJoinMemberProfileFromGoogleSheet(memberForSheet, { refresh: true });
      if (existingProfile?.profileId) {
        rememberJoinMemberProfileLocally(memberForSheet, existingProfile);
      }
      const profileSnapshot = getJoinSignupProfileSnapshot(memberForSheet);
      const profilePayload = buildJoinMemberProfilePayload(memberForSheet);
      if (existingProfile?.profileId) {
        profilePayload.profileId = existingProfile.profileId;
        profilePayload.keyValue = existingProfile.profileId;
      }
      setJoinMemberLoginStatus("추가정보를 저장하고 있어요.");
      const saveResult = await saveJoinMemberProfileWithConfirmation(profilePayload, memberForSheet);
      const savedProfile = {
        ...profileSnapshot,
        profileId: saveResult?.profileId || profilePayload.profileId
      };
      rememberJoinMemberProfileLocally(memberForSheet, savedProfile);
      clearJoinPendingKakaoProfile();
      finishJoinMemberSignupAndContinue(memberForSheet, savedProfile);
    }

    function buildJoinMemberProfilePayload(member = {}) {
      const submittedAt = nowKstISOString();
      const pendingKakao = getJoinPendingKakaoProfile();
      const name = document.getElementById("joinMemberSignupName")?.value.trim() || member.memberName || pendingKakao.name || "";
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || member.memberMobile || "");
      const email = member.memberEmail || document.getElementById("joinMemberSignupContactEmail")?.value.trim() || pendingKakao.email || "";
      const birthYear = document.getElementById("joinMemberSignupBirthYear")?.value || "";
      const gender = getJoinMemberSignupSelectedGender();
      const profession = document.getElementById("joinMemberSignupProfession")?.value || "";
      const level = getJoinMemberSignupSelectedLevel();
      const travelStyles = getJoinMemberSignupSelectedTravelStyles();
      const marketingChecked = document.querySelector("#joinMemberSignupForm .join-member-signup-agreement[data-required='false']")?.checked;
      const profileId = getStableJoinMemberProfileId({
        ...member,
        memberId: member.memberId || pendingKakao.kakaoId || "",
        memberMobile: mobile,
        memberEmail: email
      }, mobile || pendingKakao.kakaoId || "");
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
        memberId: member.memberId || pendingKakao.kakaoId || "",
        memberName: name,
        memberChannel: member.memberChannel || (pendingKakao.kakaoId ? "KAKAO" : "HOME"),
        memberMobile: mobile,
        memberEmail: email,
        birthYear,
        gender,
        profession,
        level,
        travelStyles,
        member: {
          memberSeq: member.memberSeq || "",
          memberId: member.memberId || pendingKakao.kakaoId || "",
          memberName: name,
          memberChannel: member.memberChannel || (pendingKakao.kakaoId ? "KAKAO" : "HOME"),
          memberMobile: mobile,
          memberEmail: email
        },
        profile: {
          birthYear,
          gender,
          profession,
          level,
          travelStyles,
          requiredAgreed: true,
          marketingAgreed: Boolean(marketingChecked),
          termsAgreedAt: submittedAt
        },
        kakao: {
          kakaoId: pendingKakao.kakaoId || "",
          nickname: pendingKakao.nickname || ""
        }
      };
    }

    async function submitJoinMemberProfileOnly() {
      const pendingKakao = getJoinPendingKakaoProfile();
      const profileRequired = document.getElementById("joinMemberSignupForm")?.dataset.profileRequired === "true";
      const validations = [
        validateJoinMemberSignupNameField(true),
        validateJoinMemberSignupMobileField(true),
        validateJoinMemberSignupProfileStep()
      ];
      if (validations.includes(false)) {
        setJoinMemberLoginStatus("");
        setJoinMemberSignupStep(3);
        document.querySelector("#joinMemberSignupForm .join-member-email-field.is-invalid input, #joinMemberSignupForm .join-member-email-field.is-invalid select")?.focus();
        return;
      }
      if (!validateJoinMemberSignupStep(4)) {
        setJoinMemberSignupStep(4);
        return;
      }
      if (!validateJoinMemberSignupStep(5)) {
        setJoinMemberSignupStep(5);
        return;
      }
      if (!validateJoinMemberSignupStep(6)) {
        setJoinMemberSignupStep(6);
        return;
      }
      if (!validateJoinMemberSignupAgreements()) {
        setJoinMemberLoginStatus("필수 약관에 모두 동의해 주세요.");
        setJoinMemberSignupStep(1);
        document.getElementById("joinMemberSignupAgreeAll")?.focus();
        return;
      }
      if (pendingKakao.kakaoId) {
        const data = buildJoinMemberKakaoSignupData();
        if (!data.externalId || !data.extnChnlLinkToken) {
          joinMyMenuState.loginRedirecting = false;
          setJoinMemberLoginStatus("카카오 인증 정보가 만료되었습니다. 다시 카카오로 가입해 주세요.");
          return;
        }
        if (!data.custNm || !data.mobile || !/^01\d{8,9}$/.test(data.mobile)) {
          setJoinMemberLoginStatus("이름과 휴대폰번호를 확인해 주세요.");
          setJoinMemberSignupStep(3);
          return;
        }
        try {
          joinMyMenuState.loginRedirecting = true;
          setJoinMemberLoginStatus("카카오 회원가입을 진행하고 있어요.");
          if (!canUseSecretTourMemberApi()) {
            golfJoinSafeWarn("Kakao ERP signup skipped outside secret-tour.com.", location.origin);
            await saveJoinMemberKakaoProfileAndContinue(data);
            return;
          }
          const duplicateMessage = await checkJoinMemberKakaoSignupDuplicates(data);
          if (duplicateMessage) {
            joinMyMenuState.loginRedirecting = false;
            setJoinMemberLoginStatus(duplicateMessage);
            showJoinMemberSignupAlert(
              duplicateMessage,
              getJoinMemberSignupDuplicateFocusId(joinMyMenuState.lastSignupDuplicateField)
            );
            return;
          }
          const result = await postJoinMemberForm(
            "/member/saveExternalMember.json",
            buildJoinExternalMemberSavePayload(data)
          );
          if ((result?.message || "") !== "SUCCESS") {
            throw createJoinMemberApiError(summarizeJoinMemberApiResponse(result) || "카카오 회원가입 저장에 실패했습니다.", {
              endpoint: "/member/saveExternalMember.json",
              responseData: result
            });
          }
          const savedErpMember = buildJoinErpMemberFromLoginResponse(
            result,
            buildJoinMemberKakaoResponseSnapshot(data)
          );
          await saveJoinMemberKakaoProfileAndContinue(data, savedErpMember);
          return;
        } catch (error) {
          joinMyMenuState.loginRedirecting = false;
          golfJoinSafeWarn("Kakao signup failed.", error);
          if (error?.endpoint === "/member/saveExternalMember.json" && Number(error?.status) === 400) {
            try {
              const duplicateMessage = await checkJoinMemberKakaoSignupDuplicates(data);
              if (duplicateMessage) {
                setJoinMemberLoginStatus(duplicateMessage);
                showJoinMemberSignupAlert(
                  duplicateMessage,
                  getJoinMemberSignupDuplicateFocusId(joinMyMenuState.lastSignupDuplicateField)
                );
                return;
              }
            } catch (duplicateCheckError) {
              golfJoinSafeWarn("Kakao signup duplicate recheck failed.", duplicateCheckError);
            }
          }
          const detail = error?.serverMessage || error?.message || "";
          const userMessage = /member profile|추가정보|sheet/i.test(detail)
            ? "추가정보 저장이 지연되고 있습니다. 잠시 후 입력 완료를 다시 눌러 주세요."
            : "카카오 회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
          setJoinMemberLoginStatus(userMessage);
          showJoinMemberSignupAlert(userMessage);
          return;
        }
      }
      try {
        joinMyMenuState.loginRedirecting = true;
        setJoinMemberLoginStatus("");
        const member = joinMyMenuState.pendingProfileMember || await getJoinCurrentMember({ refresh: true });
        if (!member) {
          joinMyMenuState.loginRedirecting = false;
          setJoinMemberLoginStatus("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
          return;
        }
        const payload = buildJoinMemberProfilePayload(member);
        const saveResult = await saveJoinMemberProfileToGoogleSheet(payload);
        const savedProfile = normalizeJoinMemberProfileRow({
          ...payload.member,
          ...payload.profile,
          profileId: saveResult?.profileId || payload.profileId,
          submittedAt: payload.submittedAt,
          name: payload.member?.memberName || member.memberName || "",
          mobile: payload.member?.memberMobile || member.memberMobile || "",
          phone: payload.member?.memberMobile || member.memberMobile || "",
          email: payload.member?.memberEmail || member.memberEmail || ""
        });
        rememberJoinMemberProfileLocally(member, savedProfile);
        clearJoinPendingKakaoProfile();
        joinMyMenuState.loginRedirecting = false;
        const updatedMember = mergeJoinMemberWithProfile(member, savedProfile);
        rememberJoinMemberProfileCompletion(updatedMember, isJoinMemberProfileComplete(updatedMember));
        joinMyMenuState.memberPromise = Promise.resolve(updatedMember);
        if (profileRequired) {
          continueAfterJoinMemberProfileSave(updatedMember);
          return;
        }
        finishJoinMemberSignupAndContinue(member, savedProfile);
      } catch (error) {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Kakao profile save failed.", error);
        setJoinMemberLoginStatus("추가정보 저장 중 오류가 발생했습니다.");
      }
    }

    async function submitJoinMemberSignup() {
      if (joinMyMenuState.loginRedirecting) return;
      if (document.getElementById("joinMemberSignupForm")?.dataset.profileOnly === "true") {
        await submitJoinMemberProfileOnly();
        return;
      }
      const custId = normalizeJoinMemberSignupIdInput(document.getElementById("joinMemberSignupEmail")).trim();
      const email = document.getElementById("joinMemberSignupContactEmail")?.value.trim() || "";
      const password = document.getElementById("joinMemberSignupPassword")?.value || "";
      const passwordConfirm = document.getElementById("joinMemberSignupPasswordConfirm")?.value || "";
      const name = document.getElementById("joinMemberSignupName")?.value.trim() || "";
      const mobile = normalizeJoinMemberPhone(document.getElementById("joinMemberSignupMobile")?.value || "");
      const birthYear = document.getElementById("joinMemberSignupBirthYear")?.value || "";
      const gender = getJoinMemberSignupSelectedGender();
      const profession = document.getElementById("joinMemberSignupProfession")?.value || "";
      const level = getJoinMemberSignupSelectedLevel();
      const travelStyles = getJoinMemberSignupSelectedTravelStyles();
      const validations = [
        validateJoinMemberSignupEmailField(true),
        validateJoinMemberSignupPasswordField(true),
        validateJoinMemberSignupPasswordConfirmField(true),
        validateJoinMemberSignupNameField(true),
        validateJoinMemberSignupMobileField(true),
        validateJoinMemberSignupContactEmailField(true),
        validateJoinMemberSignupProfileStep()
      ];
      if (validations.includes(false)) {
        setJoinMemberLoginStatus("");
        setJoinMemberSignupStep(validations.slice(0, 3).includes(false) ? 2 : 3);
        document.querySelector("#joinMemberSignupForm .join-member-email-field.is-invalid input")?.focus();
        return;
      }
      if (!validateJoinMemberSignupStep(4)) {
        setJoinMemberSignupStep(4);
        return;
      }
      if (!validateJoinMemberSignupStep(5)) {
        setJoinMemberSignupStep(5);
        return;
      }
      if (!validateJoinMemberSignupStep(6)) {
        setJoinMemberSignupStep(6);
        return;
      }
      if (password !== passwordConfirm) {
        setJoinMemberFieldInvalid("joinMemberSignupPasswordConfirmField", "joinMemberSignupPasswordConfirmHelper", "비밀번호가 일치하지 않습니다.");
        document.getElementById("joinMemberSignupPasswordConfirm")?.focus();
        return;
      }
      if (!validateJoinMemberSignupAgreements()) {
        setJoinMemberLoginStatus("필수 약관에 모두 동의해 주세요.");
        setJoinMemberSignupStep(1);
        document.getElementById("joinMemberSignupAgreeAll")?.focus();
        return;
      }
      if (!window.$?.crypto?.encrypt) {
        setJoinMemberLoginStatus("운영 도메인에서 회원가입 모듈을 불러온 뒤 이용해 주세요.");
        return;
      }
      const data = {
        mobile1: mobile.substring(0, 3),
        mobile2: mobile.substring(3, 7),
        mobile3: mobile.substring(7, 11),
        custPw: window.$.crypto.encrypt(password),
        smsYn: document.querySelector("#joinMemberSignupForm .join-member-signup-agreement[data-required='false']")?.checked ? "Y" : "N",
        emailYn: document.querySelector("#joinMemberSignupForm .join-member-signup-agreement[data-required='false']")?.checked ? "Y" : "N",
        extnChnlLinkCd: "HOME",
        validTermCd: "010",
        custId,
        custNm: name,
        mobile,
        email,
        birthYear,
        gender,
        profession,
        level,
        travelStyles: travelStyles.join(", ")
      };
      try {
        joinMyMenuState.loginRedirecting = true;
        setJoinMemberLoginStatus("회원가입 정보를 확인하고 있어요.");
        const duplicateMessage = await checkJoinMemberSignupDuplicates(data);
        if (duplicateMessage) {
          joinMyMenuState.loginRedirecting = false;
          setJoinMemberLoginStatus("");
          const focusTargetId = getJoinMemberSignupDuplicateFocusId(joinMyMenuState.lastSignupDuplicateField);
          showJoinMemberSignupAlert(duplicateMessage, focusTargetId);
          return;
        }
        setJoinMemberLoginStatus("회원가입을 진행하고 있어요.");
        await prepareJoinMemberSaveSession(data.validTermCd);
        const result = await postJoinMemberForm("/member/saveMember.json", buildJoinMemberSavePayload(data));
        if ((result?.message || "") !== "SUCCESS") {
          throw createJoinMemberApiError(summarizeJoinMemberApiResponse(result) || "회원가입 저장에 실패했습니다.", {
            endpoint: "/member/saveMember.json",
            responseData: result
          });
        }
        const signupMember = {
          memberId: custId,
          memberName: name,
          memberMobile: mobile,
          memberEmail: email,
          memberChannel: "HOME"
        };
        const existingSheetProfile = await fetchJoinMemberProfileFromGoogleSheet(signupMember, { refresh: true });
        if (existingSheetProfile?.profileId) {
          rememberJoinMemberProfileLocally(signupMember, existingSheetProfile);
        }
        const signupProfile = getJoinSignupProfileSnapshot(signupMember);
        rememberJoinMemberProfileLocally(signupMember, signupProfile);
        const profilePayload = buildJoinMemberProfilePayload(signupMember);
        const saveResult = await saveJoinMemberProfileToGoogleSheet(profilePayload);
        const savedSignupProfile = {
          ...signupProfile,
          profileId: saveResult?.profileId || profilePayload.profileId
        };
        rememberJoinMemberProfileLocally(signupMember, savedSignupProfile);
        setJoinMemberLoginStatus("가입이 완료되었어요. 로그인하고 있어요.");
        joinMyMenuState.loginRedirecting = false;
        try {
          const loginResult = await postJoinMemberForm("/member/getMemberLoginCheck.json", {
            custId,
            custPw: data.custPw
          });
          if ((loginResult?.message || "") !== "SUCCESS") {
            throw new Error(loginResult?.message || "login failed after signup");
          }
          finishJoinMemberSignupAndContinue(signupMember, savedSignupProfile);
          return;
        } catch (loginError) {
          golfJoinSafeWarn("Auto login after signup failed.", loginError);
        }
        openJoinMemberEmailForm();
        const loginIdInput = document.getElementById("joinMemberLoginId");
        if (loginIdInput) loginIdInput.value = custId;
        syncAllJoinMemberFloatingFields();
        setJoinMemberLoginStatus("가입이 완료되었어요. 아이디로 로그인해 주세요.");
      } catch (error) {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Email signup failed.", error);
        if (error?.endpoint === "/member/saveMember.json" && Number(error?.status) === 400) {
          try {
            const duplicateMessage = await checkJoinMemberSignupDuplicates(data);
            if (duplicateMessage) {
              setJoinMemberLoginStatus("");
              showJoinMemberSignupAlert(
                duplicateMessage,
                getJoinMemberSignupDuplicateFocusId(joinMyMenuState.lastSignupDuplicateField)
              );
              return;
            }
          } catch (duplicateCheckError) {
            golfJoinSafeWarn("Email signup duplicate recheck failed.", duplicateCheckError);
          }
        }
        const detail = [
          String(error?.message || "").trim(),
          error?.endpoint ? `위치: ${error.endpoint}` : "",
          error?.responseText ? `응답: ${error.responseText}` : ""
        ].filter(Boolean).join(" / ");
        const userMessage = detail ? `회원가입 처리 중 오류가 발생했습니다. ${detail}` : "회원가입 처리 중 오류가 발생했습니다.";
        setJoinMemberLoginStatus(userMessage);
        showJoinMemberSignupAlert(userMessage);
      }
    }

    function submitJoinMemberEmailLogin() {
      if (joinMyMenuState.loginRedirecting) return;
      const custId = normalizeJoinMemberLoginIdInput(document.getElementById("joinMemberLoginId")).trim();
      const custPwPlain = document.getElementById("joinMemberLoginPassword")?.value || "";
      const isEmailValid = validateJoinMemberEmailField(true);
      if (!isEmailValid) {
        setJoinMemberLoginStatus("");
        document.getElementById("joinMemberLoginId")?.focus();
        return;
      }
      if (custId.toLowerCase() === "admin@admin.com" && custPwPlain === "1111") {
        const adminMember = setJoinTempAdminMember();
        joinMyMenuState.memberPromise = null;
        resetJoinMemberEmailValidation();
        const afterLogin = joinMyMenuState.pendingAfterLogin || "my-menu";
        const extraParams = { ...(joinMyMenuState.pendingLoginParams || {}) };
        ensureJoinMemberProfileReady(afterLogin, extraParams, { member: adminMember, refresh: true })
          .then((readyMember) => {
            if (readyMember) continueAfterJoinMemberLogin(afterLogin);
          })
          .catch((error) => {
            golfJoinSafeWarn("Failed to verify temp admin profile.", error);
            alert("회원정보 확인이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
          });
        return;
      }
      const isPasswordValid = validateJoinMemberPasswordField(true);
      if (!isPasswordValid) {
        setJoinMemberLoginStatus("");
        document.getElementById("joinMemberLoginPassword")?.focus();
        return;
      }
      if (!window.$?.crypto?.encrypt) {
        setJoinMemberLoginStatus("운영 도메인에서 로그인 모듈을 불러온 뒤 이용해 주세요.");
        return;
      }
      joinMyMenuState.loginRedirecting = true;
      setJoinMemberLoginStatus("");
      postJoinMemberLoginForm("/member/getMemberLoginCheck.json", {
        custId,
        custPw: window.$.crypto.encrypt(custPwPlain)
      }).then((aspData) => {
        joinMyMenuState.loginRedirecting = false;
        if ((aspData?.message || "") === "SUCCESS") {
          clearJoinLogoutMarker();
          location.href = getJoinLoginRedirectTarget();
          return;
        }
        setJoinMemberLoginStatus("아이디와 비밀번호를 확인해 주세요.");
        document.getElementById("joinMemberLoginId")?.focus();
      }).catch((error) => {
        joinMyMenuState.loginRedirecting = false;
        golfJoinSafeWarn("Email login failed.", error);
        setJoinMemberLoginStatus("로그인 처리 중 오류가 발생했습니다.");
      });
    }
    window.submitJoinMemberEmailLogin = submitJoinMemberEmailLogin;

    function normalizeJoinMemberPhone(value) {
      const digits = String(value || "").replace(/\D/g, "");
      if (/^82(1[016789]\d{8})$/.test(digits)) return `0${digits.slice(2)}`;
      if (/^1[016789]\d{8}$/.test(digits)) return `0${digits}`;
      return digits;
    }

    function normalizeJoinErpProductId(value = "", eventSeq = "") {
      const text = String(value || "").trim();
      if (!text) return "";
      const normalizedEventSeq = String(eventSeq || "").trim();
      if (text.startsWith("secret-tour-")) {
        const withoutPrefix = text.slice("secret-tour-".length);
        if (normalizedEventSeq && withoutPrefix.endsWith(`-${normalizedEventSeq}`)) {
          return withoutPrefix.slice(0, -(normalizedEventSeq.length + 1));
        }
        const numericMatch = withoutPrefix.match(/^(\d+)(?:-\d+)?$/);
        if (numericMatch) return numericMatch[1];
      }
      return text;
    }

    function normalizeJoinCanonicalErpProductId(value = "", eventSeq = "") {
      const normalized = normalizeJoinErpProductId(value, eventSeq);
      return /^\d+$/.test(normalized) ? normalized : "";
    }

    function normalizeJoinCanonicalErpEventSeq(value = "") {
      const normalized = String(value || "").trim();
      return /^\d+$/.test(normalized) ? normalized : "";
    }

    function normalizeJoinMemberGender(value) {
      const text = String(value || "").trim();
      if (/^(M|male|남|남성)$/i.test(text)) return "남성";
      if (/^(F|female|여|여성)$/i.test(text)) return "여성";
      return text;
    }

    function parseJoinMemberDetailPage(html = "") {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const readMemberDetailValue = (selectors) => {
        for (const selector of selectors) {
          const node = doc.querySelector(selector);
          const value = node?.value || node?.textContent || "";
          if (String(value).trim()) return String(value).trim();
        }
        return "";
      };
      const readMemberDetailByLabel = (labelPatterns = []) => {
        const rows = Array.from(doc.querySelectorAll("tr, li, dl, .form-group, .input-group, .field, .row, .member-info, .mypage-info"));
        for (const row of rows) {
          const text = String(row.textContent || "").replace(/\s+/g, " ").trim();
          if (!text || !labelPatterns.some((pattern) => pattern.test(text))) continue;
          const inputValue = Array.from(row.querySelectorAll("input, select, textarea"))
            .map((node) => node.value || node.textContent || "")
            .map((value) => String(value).trim())
            .filter(Boolean)
            .join("");
          if (inputValue) return inputValue;
          const normalized = text.replace(labelPatterns.find((pattern) => pattern.test(text)) || /$^/, "").trim();
          if (normalized) return normalized;
        }
        return "";
      };
      const readScriptValue = (key) => {
        const source = Array.from(doc.querySelectorAll("script"))
          .map((script) => script.textContent || "")
          .join("\n");
        const match = new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`).exec(source);
        return match ? match[1] : "";
      };
      const pageText = String(doc.body?.textContent || "").replace(/\s+/g, " ");
      const mobile = ["#mobile1Tmp", "#mobile2Tmp", "#mobile3Tmp"]
        .map((selector, index) => {
          const nodeValue = doc.querySelector(selector)?.value || doc.querySelector(selector)?.textContent || "";
          return nodeValue || readMemberDetailValue([`input[name='mobile${index + 1}Tmp']`, `input[name='mobile${index + 1}']`, `select[name='mobile${index + 1}']`]) || readScriptValue(`mobile${index + 1}`);
        })
        .join("");
      const directMobile = normalizeJoinMemberPhone(
        mobile
        || readMemberDetailValue([
          "#mobileTmp",
          "#mobile",
          "#phone",
          "#hpNo",
          "#telNo",
          "input[name='mobileTmp']",
          "input[name='mobile']",
          "input[name='memberMobile']",
          "input[name='phone']",
          "input[name='hpNo']",
          "input[name='telNo']",
          "input[name='cellPhone']",
          "input[name='cellphone']"
        ])
        || readMemberDetailByLabel([/휴대\s*전화/, /휴대폰/, /핸드폰/, /전화번호/])
        || (pageText.match(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/) || [""])[0]
      );
      const directEmail = String(
        readMemberDetailValue([
          "#emailTmp",
          "#email",
          "#memberEmail",
          "input[name='emailTmp']",
          "input[name='email']",
          "input[name='memberEmail']",
          "input[name='emailAddr']",
          "input[name='userEmail']",
          "input[name='custEmail']"
        ])
        || readMemberDetailByLabel([/이메일/, /전자\s*우편/, /E-?mail/i])
        || (pageText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0]
      ).trim();
      return {
        memberName: readMemberDetailValue([
          "#userNm",
          "#custNm",
          "#memberName",
          "#memberNm",
          "input[name='userNm']",
          "input[name='custNm']",
          "input[name='memberName']",
          "input[name='memberNm']"
        ]),
        memberMobile: directMobile,
        memberEmail: directEmail,
        gender: normalizeJoinMemberGender(doc.querySelector('input[name="gender"]:checked')?.value || ""),
        birthday: String(doc.querySelector("#birthday")?.value || doc.querySelector("#birthday")?.textContent || "").trim()
      };
    }

    async function fetchJoinMemberDetailPage(path) {
      const response = await fetch(path, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`member page failed: ${response.status}`);
      if (response.url && /\/member\/login/i.test(response.url)) {
        return { sessionExpired: true };
      }
      const html = await response.text();
      const isLoginPage = /\/member\/getMemberLoginCheck\.json/i.test(html)
        || /<form[^>]+(?:id|name)=["'][^"']*login/i.test(html);
      if (isLoginPage && !/CookieData\([^)]*(?:userSeq|userId)\s*=\s*[^,)]/i.test(html)) {
        return { sessionExpired: true };
      }
      const renderedCookieMatch = html.match(/CookieData\(([^)]*(?:userSeq|userId)[^)]*)\)/);
      const renderedMember = parseJoinCookieData(
        renderedCookieMatch ? `CookieData(${renderedCookieMatch[1]})` : ""
      );
      const detail = parseJoinMemberDetailPage(html);
      const hasRenderedMember = Boolean(renderedMember.memberSeq || renderedMember.memberId);
      return {
        ...renderedMember,
        ...detail,
        memberName: detail.memberName || renderedMember.memberName || "",
        sessionAuthenticated: Boolean(
          hasRenderedMember
          || detail.memberName
          || detail.memberMobile
          || detail.memberEmail
        )
      };
    }

    async function fetchJoinMemberDetail() {
      try {
        const detail = await fetchJoinMemberDetailPage("/mypage/member");
        if (detail.sessionExpired || detail.memberMobile) return detail;
        const fallbackDetail = await fetchJoinMemberDetailPage("/mypage/mypage");
        return {
          ...detail,
          ...fallbackDetail,
          memberSeq: fallbackDetail.memberSeq || detail.memberSeq || "",
          memberId: fallbackDetail.memberId || detail.memberId || "",
          memberChannel: fallbackDetail.memberChannel || detail.memberChannel || "",
          memberName: fallbackDetail.memberName || detail.memberName || "",
          memberMobile: fallbackDetail.memberMobile || detail.memberMobile || "",
          memberEmail: fallbackDetail.memberEmail || detail.memberEmail || "",
          gender: fallbackDetail.gender || detail.gender || "",
          birthday: fallbackDetail.birthday || detail.birthday || ""
        };
      } catch (error) {
        golfJoinSafeWarn("Failed to load member detail from /mypage/member.", error);
        try {
          return await fetchJoinMemberDetailPage("/mypage/mypage");
        } catch (fallbackError) {
          golfJoinSafeWarn("Failed to load member detail from /mypage/mypage.", fallbackError);
          return {};
        }
      }
    }

    async function getJoinCurrentMemberDetailOnly() {
      const loginState = getJoinLoginState();
      if (!loginState.isLogin) return null;
      if (loginState.member?.isTempAdmin || loginState.member?.isSessionMember) {
        return loginState.member;
      }
      const detail = await fetchJoinMemberDetail();
      if (detail.sessionExpired) return null;
      const member = {
        ...loginState.member,
        ...detail,
        memberName: detail.memberName || loginState.member.memberName || "",
        memberMobile: detail.memberMobile || loginState.member.memberMobile || "",
        memberEmail: detail.memberEmail || loginState.member.memberEmail || ""
      };
      updateOpenJoinMemberRequiredProfileFormMember(member);
      return member;
    }

    let joinErpSessionSyncPromise = null;
    let joinErpSessionLastCheckedAt = Date.now();

    function clearJoinClientSessionAfterErpLogout() {
      setJoinLogoutMarker();
      try {
        sessionStorage.removeItem(JOIN_SESSION_MEMBER_KEY);
      } catch (error) {
        golfJoinSafeWarn("Failed to clear join ERP session member.", error);
      }
      clearJoinMemberProfileCompletion();
      clearJoinPrivateClientCaches();
      joinMyMenuState.memberPromise = null;
      closeJoinMemberLoginModal();
      closeJoinMyMenu();
      closeJoinMyDrawer();
      setJoinMobileNavActive("");
      overseasBestVisibleCount = OVERSEAS_BEST_INITIAL_VISIBLE_COUNT;
      myJoinFilter = "complete";
      resetMyJoinVisibleCounts();
    }

    async function synchronizeJoinErpSession(options = {}) {
      if (!canUseSecretTourMemberApi()) return getJoinLoginState();
      const before = getJoinLoginState();
      if (before.member?.isTempAdmin) return before;
      const loginModalOpen = document.getElementById("joinMemberLoginModal")?.classList.contains("open");
      if (joinMyMenuState.loginRedirecting || joinMyMenuState.pendingKakaoSignup || loginModalOpen) {
        return before;
      }
      const now = Date.now();
      if (!options.force && now - joinErpSessionLastCheckedAt < 15000) return before;
      if (joinErpSessionSyncPromise) return joinErpSessionSyncPromise;
      joinErpSessionLastCheckedAt = now;
      joinErpSessionSyncPromise = (async () => {
        const detail = await fetchJoinMemberDetail();
        if (detail.sessionExpired) {
          if (before.isLogin) clearJoinClientSessionAfterErpLogout();
          return { isLogin: false, member: {} };
        }
        if (!detail.sessionAuthenticated) return before;
        clearJoinLogoutMarker();
        const member = setJoinSessionMember({
          ...(before.member || {}),
          ...detail,
          memberName: detail.memberName || before.member?.memberName || "",
          memberMobile: detail.memberMobile || before.member?.memberMobile || "",
          memberEmail: detail.memberEmail || before.member?.memberEmail || ""
        });
        updateOpenJoinMemberRequiredProfileFormMember(member);
        if (!before.isLogin) {
          closeJoinMemberLoginModal();
          updateJoinMyDrawerProfile(member);
          renderJoins();
        }
        return { isLogin: true, member };
      })().catch((error) => {
        golfJoinSafeWarn("Failed to synchronize Secret Tour member session.", error);
        return before;
      }).finally(() => {
        joinErpSessionSyncPromise = null;
      });
      return joinErpSessionSyncPromise;
    }

    async function getJoinCurrentMember(options = {}) {
      const loginState = getJoinLoginState();
      if (!loginState.isLogin) return null;
      if (loginState.member?.isTempAdmin) return hydrateJoinMemberProfile(loginState.member, options);
      if (loginState.member?.isSessionMember) return hydrateJoinMemberProfile(loginState.member, options);
      if (!options.refresh && joinMyMenuState.memberPromise) return joinMyMenuState.memberPromise;
      joinMyMenuState.memberPromise = (async () => {
        const [detail, profileMember] = await Promise.all([
          fetchJoinMemberDetail(),
          hydrateJoinMemberProfile(loginState.member, options)
        ]);
        if (detail.sessionExpired) return null;
        const memberWithDetail = {
          ...loginState.member,
          ...detail,
          memberName: detail.memberName || loginState.member.memberName || "",
          memberMobile: detail.memberMobile || loginState.member.memberMobile || "",
          memberEmail: detail.memberEmail || loginState.member.memberEmail || ""
        };
        const member = mergeJoinMemberWithProfile(memberWithDetail, profileMember);
        if (profileMember?.__profileLookupFailed) member.__profileLookupFailed = true;
        updateOpenJoinMemberRequiredProfileFormMember(member);
        return member;
      })();
      return joinMyMenuState.memberPromise;
    }

    async function ensureJoinMemberProfileReady(afterLogin = "my-menu", extraParams = {}, options = {}) {
      const baseMember = options.member || getJoinLoginState().member || null;
      const cachedMember = options.member
        ? getJoinMemberWithCachedProfile(options.member)
        : getJoinCachedCurrentMember();
      const cachedCompletion = getRememberedJoinMemberProfileCompletion(cachedMember || baseMember || {});
      if (
        (options.skipProfileCheck && (cachedMember || baseMember))
        || (cachedCompletion === true && isJoinMemberProfileComplete(cachedMember || {}))
      ) {
        return cachedMember || baseMember;
      }
      if (cachedCompletion === false && cachedMember && !isJoinTempAdminMember(cachedMember)) {
        openJoinMemberRequiredProfileForm(cachedMember, afterLogin, extraParams);
        const refreshPromise = getJoinCurrentMember({ refresh: true })
          .then((refreshedMember) => {
            if (!refreshedMember) {
              closeJoinMemberLoginModal();
              redirectToJoinLogin(afterLogin, extraParams);
              return null;
            }
            if (refreshedMember.__profileLookupFailed) return refreshedMember;
            const form = document.getElementById("joinMemberSignupForm");
            const isSameRequiredForm = Boolean(
              form?.classList.contains("is-open")
              && form.dataset.profileRequired === "true"
              && joinMyMenuState.pendingProfileAfterLogin === (afterLogin || "my-menu")
            );
            if (!isSameRequiredForm) return refreshedMember;
            if (isJoinMemberProfileComplete(refreshedMember)) {
              continueAfterJoinMemberProfileSave(refreshedMember);
              return refreshedMember;
            }
            updateOpenJoinMemberRequiredProfileFormMember(refreshedMember);
            return refreshedMember;
          })
          .catch((error) => {
            golfJoinSafeWarn("Failed to refresh cached incomplete join member profile.", error);
            return null;
          });
        joinMyMenuState.pendingProfileDetailPromise = refreshPromise;
        return null;
      }
      const requiresSheetProfileCheck = isJoinTempAdminMember(baseMember);
      const member = requiresSheetProfileCheck
        ? await getJoinCurrentMember({ refresh: true })
        : options.member || await getJoinCurrentMember({ refresh: Boolean(options.refresh) });
      if (!member) {
        redirectToJoinLogin(afterLogin, extraParams);
        return null;
      }
      if (options.skipProfileCheck || isJoinMemberProfileComplete(member)) return member;
      if (member.__profileLookupFailed) {
        alert("회원정보 확인이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.");
        return null;
      }
      openJoinMemberRequiredProfileForm(member, afterLogin, extraParams);
      return null;
    }

    async function promptRequiredJoinMemberProfileOnStartup() {
      try {
        const loginState = getJoinLoginState();
        if (!loginState.isLogin) return false;
        const loginModal = document.getElementById("joinMemberLoginModal");
        const signupForm = document.getElementById("joinMemberSignupForm");
        if (loginModal?.classList.contains("open") || signupForm?.dataset.profileRequired === "true") return false;
        const cachedMember = getJoinCachedCurrentMember();
        const requiresSheetProfileCheck = isJoinTempAdminMember(cachedMember || loginState.member);
        if (!requiresSheetProfileCheck && isJoinMemberProfileComplete(cachedMember)) return false;
        const member = await getJoinCurrentMember({ refresh: true });
        if (!member || member.__profileLookupFailed || isJoinMemberProfileComplete(member)) return false;
        openJoinMemberRequiredProfileForm(member, "my-menu", { startupProfileRequired: "true" });
        return true;
      } catch (error) {
        golfJoinSafeWarn("Failed to check required join member profile on startup.", error);
        return false;
      }
    }

    function getJoinMemberBirthYear(member = {}) {
      const direct = String(member.birthYear || "").trim();
      if (/^\d{4}$/.test(direct)) return direct;
      const birthday = String(member.birthday || "").trim();
      const match = birthday.match(/\b(19\d{2}|20\d{2})\b/);
      return match ? match[1] : "";
    }

    function getJoinMemberAgeBand(member = {}) {
      const birthYear = getJoinMemberBirthYear(member);
      if (!/^\d{4}$/.test(birthYear)) return "연령대";
      const age = new Date().getFullYear() - Number(birthYear) + 1;
      if (!Number.isFinite(age) || age < 1) return "연령대";
      return `${Math.floor(age / 10) * 10}대`;
    }

    function updateJoinMyDrawerProfile(member = {}) {
      member = getJoinMemberWithCachedProfile(member);
      preloadJoinProfileImage(member);
      const name = member.memberName || "회원";
      const gender = member.gender || "성별";
      const age = getJoinMemberAgeBand(member);
      const nameTarget = document.getElementById("joinMyDrawerName");
      const genderTarget = document.getElementById("joinMyDrawerGender");
      const ageTarget = document.getElementById("joinMyDrawerAge");
      const avatarTarget = document.getElementById("joinMyDrawerAvatar");
      if (nameTarget) nameTarget.textContent = name;
      if (genderTarget) genderTarget.textContent = gender;
      if (ageTarget) ageTarget.textContent = age;
      renderJoinProfileImage(avatarTarget, member);
    }

    function setJoinMyDrawerActiveMenu(menuKey = "") {
      joinMyDrawerActiveMenu = String(menuKey || "").trim();
      document.querySelectorAll("#joinMyDrawerOverlay .join-my-drawer-item[data-join-my-menu]").forEach((button) => {
        const isSelected = button.dataset.joinMyMenu === joinMyDrawerActiveMenu;
        button.classList.toggle("is-selected", isSelected);
        if (isSelected) {
          button.setAttribute("aria-current", "page");
        } else {
          button.removeAttribute("aria-current");
        }
      });
    }

    function shouldReturnJoinMyMenuToDrawer(trigger = null) {
      const isDesktop = window.matchMedia?.("(min-width: 641px)")?.matches || window.innerWidth > 640;
      const drawerOpen = document.getElementById("joinMyDrawerOverlay")?.classList.contains("open");
      return Boolean(isDesktop && drawerOpen && trigger?.closest?.("[data-join-my-menu]"));
    }

    function getJoinMyDrawerCachedProfile() {
      const loginState = getJoinLoginState();
      const member = loginState.member || {};
      return getJoinMemberWithCachedProfile(member);
    }

    function getJoinCachedCurrentMember() {
      const loginState = getJoinLoginState();
      if (!loginState.isLogin) return null;
      const member = getJoinMemberWithCachedProfile(loginState.member || {});
      registerGolfJoinDiagnosticPrivateValues(member);
      return member;
    }

    function refreshJoinMemberInBackground(onReady, options = {}) {
      const cached = getJoinCachedCurrentMember();
      const requiresSheetProfileCheck = isJoinTempAdminMember(cached);
      if (!requiresSheetProfileCheck && !options.force && isJoinMemberProfileComplete(cached)) {
        if (typeof onReady === "function") onReady(cached);
        return Promise.resolve(cached);
      }
      return getJoinCurrentMember({ refresh: Boolean(options.force || requiresSheetProfileCheck) })
        .then((member) => {
          if (member && typeof onReady === "function") onReady(member);
          return member;
        })
        .catch((error) => {
          golfJoinSafeWarn("Failed to refresh join member in background.", error);
          return null;
        });
    }

    function scheduleJoinMyMemberPreload() {
      const run = () => {
        if (!getJoinLoginState().isLogin) return;
        const cached = getJoinCachedCurrentMember();
        if (cached && isJoinMemberProfileComplete(cached)) {
          preloadJoinProfileImage(cached);
          return;
        }
        getJoinCurrentMember({ refresh: false })
          .then((member) => {
            if (member) preloadJoinProfileImage(member);
          })
          .catch((error) => {
            golfJoinSafeWarn("Failed to preload join member profile.", error);
          });
      };
      if (window.requestIdleCallback) {
        window.requestIdleCallback(run, { timeout: 2000 });
      } else {
        window.setTimeout(run, 800);
      }
    }

    function updateJoinMyDrawerHeaderOffset() {
      const overlay = document.getElementById("joinMyDrawerOverlay");
      if (!overlay) return;
      const isDesktop = window.matchMedia?.("(min-width: 641px)")?.matches;
      const header = document.querySelector("#header_zone, .header_zone");
      let offset = 0;
      if (isDesktop && header) {
        const style = getComputedStyle(header);
        const rect = header.getBoundingClientRect();
        if (style.display !== "none" && style.visibility !== "hidden" && rect.height > 0) {
          offset = Math.max(0, Math.round(rect.bottom));
        }
      }
      overlay.style.setProperty("--join-pc-header-zone-offset", `${offset}px`);
    }

    function showJoinMyDrawer(member = {}) {
      const overlay = portalOverlayToBody("joinMyDrawerOverlay");
      setJoinHostHeaderCovered(true);
      updateJoinMyDrawerHeaderOffset();
      updateJoinMyDrawerProfile(member);
      setJoinMyDrawerActiveMenu(joinMyDrawerActiveMenu);
      overlay?.style.setProperty("z-index", "2147483638", "important");
      overlay?.querySelector(".join-my-drawer")?.style.setProperty("z-index", "2147483639", "important");
      overlay?.classList.add("open");
      overlay?.setAttribute("aria-hidden", "false");
      setJoinMobileBottomNavLayerActive("my");
      setJoinMobileBottomNavVisible(true, { force: true });
      setWidgetModalOpen(true);
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
    }

    async function openJoinMyDrawer(options = {}) {
      const cachedMember = getJoinCachedCurrentMember();
      if (!cachedMember) {
        redirectToJoinLogin("my-drawer");
        return;
      }
      const member = isJoinMemberProfileComplete(cachedMember) && !options.forceProfileRefresh
        ? cachedMember
        : await getJoinCurrentMember({ refresh: Boolean(options.forceProfileRefresh) });
      if (!member) {
        redirectToJoinLogin("my-drawer");
        return;
      }
      if (!isJoinMemberProfileComplete(member)) {
        openJoinMemberRequiredProfileForm(member, "my-drawer");
        return;
      }
      showJoinMyDrawer(member);
      refreshJoinMemberInBackground((member) => {
        if (document.getElementById("joinMyDrawerOverlay")?.classList.contains("open")) {
          updateJoinMyDrawerProfile(member);
        }
      });
    }

    function closeJoinMyDrawer() {
      const overlay = document.getElementById("joinMyDrawerOverlay");
      resetModalRuntimeState(overlay);
      overlay?.classList.remove("open");
      overlay?.setAttribute("aria-hidden", "true");
      if (!document.getElementById("joinMyMenuModal")?.classList.contains("open")) {
        setJoinHostHeaderCovered(false);
        setJoinMobileBottomNavLayerActive("");
        setJoinMobileBottomNavVisible(true);
      }
      setWidgetModalOpen(hasOpenBlockingModal());
      if (!hasOpenBlockingModal()) {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
      }
    }

    function handleJoinMyRecentClick(trigger = null) {
      const returnToDrawer = shouldReturnJoinMyMenuToDrawer(trigger);
      setJoinMyDrawerActiveMenu("recent");
      closeJoinMyDrawer();
      openJoinMyRecentMenu({ returnToDrawer });
    }

    function getJoinRecentViewType(join = {}, fallbackType = "join_schedule") {
      const type = String(join.recentType || join.viewType || join.wishType || join.targetType || fallbackType || "").trim();
      return type === "product" ? "product" : "join_schedule";
    }

    function getJoinRecentViewTargetKey(item = {}) {
      const type = getJoinRecentViewType(item, item.targetType || item.recentType || "join_schedule");
      if (type === "product") {
        return String(item.goodSeq || item.productId || item.targetKey || item.targetId || item.id || "").trim();
      }
      return String(item.joinId || item.scheduleId || item.targetKey || item.targetId || item.id || "").trim();
    }

    function normalizeJoinRecentViewedItem(item = {}) {
      const recentType = getJoinRecentViewType(item, item.recentType || item.targetType || "join_schedule");
      const targetKey = getJoinRecentViewTargetKey({ ...item, recentType });
      return {
        ...item,
        recentType,
        targetType: recentType,
        targetKey,
        viewedAt: item.viewedAt || item.savedAt || nowKstISOString()
      };
    }

    function getJoinRecentViewedItems() {
      try {
        const saved = JSON.parse(localStorage.getItem(JOIN_RECENT_VIEW_STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.map(normalizeJoinRecentViewedItem).filter((item) => getJoinRecentViewTargetKey(item)) : [];
      } catch (error) {
        return [];
      }
    }

    function saveJoinRecentViewedItems(items = []) {
      try {
        localStorage.setItem(JOIN_RECENT_VIEW_STORAGE_KEY, JSON.stringify(items.map(normalizeJoinRecentViewedItem)));
      } catch (error) {
        golfJoinSafeWarn("Failed to save recent viewed products.", error);
      }
    }

    function createJoinRecentViewedSnapshot(join = {}, recentType = "join_schedule") {
      const parsedReference = parseSecretTourProductReference(join.id || join.erpProductId || "", join.eventSeq || join.erpEventSeq || "");
      const type = getJoinRecentViewType(join, recentType);
      const goodSeq = String(join.goodSeq || parsedReference.goodSeq || join.erpProductId || "").trim();
      const eventSeq = String(join.eventSeq || parsedReference.eventSeq || join.erpEventSeq || "").trim();
      const targetKey = type === "product"
        ? String(goodSeq || join.productId || join.id || "").trim()
        : String(join.id || join.scheduleId || "").trim();
      const participants = getConfirmedParticipants(join);
      return {
        id: type === "product" ? (join.id || (goodSeq && eventSeq ? `secret-tour-${goodSeq}-${eventSeq}` : goodSeq)) : join.id,
        recentType: type,
        targetType: type,
        targetKey,
        joinId: join.id || "",
        scheduleId: join.scheduleId || "",
        productId: join.erpProductId || goodSeq || "",
        goodSeq,
        eventSeq,
        title: join.title || (type === "product" ? "홈페이지 상품" : "조인모임"),
        region: join.region || join.category || join.countryRegion || "골프여행",
        image: join.image || getDetailSlides(join)[0] || "",
        price: Number(join.price || 0),
        departureDate: join.departureDate || "",
        returnDate: join.returnDate || "",
        currentCount: participants.length,
        targetCount: getCardTeamCapacity(join, 4),
        viewedAt: nowKstISOString()
      };
    }

    function addJoinRecentViewedItem(join = {}, recentType = "join_schedule") {
      const snapshot = createJoinRecentViewedSnapshot(join, recentType);
      const targetKey = getJoinRecentViewTargetKey(snapshot);
      if (!targetKey) return false;
      const current = getJoinRecentViewedItems().filter((item) => {
        return !(getJoinRecentViewType(item, item.recentType) === snapshot.recentType && getJoinRecentViewTargetKey(item) === targetKey);
      });
      saveJoinRecentViewedItems([snapshot, ...current].slice(0, 50));
      return true;
    }

    function renderJoinMyRecentEmptyState(tabKey = "product") {
      const message = tabKey === "join_schedule" ? "최근 본 조인모임이 없어요." : "최근 본 상품이 없어요.";
      return `<div class="join-my-empty"><div class="join-my-empty-box"><div class="join-my-empty-copy">${escapeHtml(message)}</div></div></div>`;
    }

    function getJoinMyRecentTabKey(recentType = "product") {
      return recentType === "join_schedule" ? "recent-joins" : "recent-products";
    }

    function refreshJoinMyRecentMenu(recentType = "product") {
      renderJoinMyRecentMenu();
      switchJoinMyTab(getJoinMyRecentTabKey(recentType));
    }

    function removeJoinRecentViewedItem(targetKey = "", recentType = "product") {
      const key = String(targetKey || "").trim();
      const type = recentType === "join_schedule" ? "join_schedule" : "product";
      if (!key) return;
      const remainingItems = getJoinRecentViewedItems().filter((item) => {
        return !(getJoinRecentViewType(item, item.recentType) === type && getJoinRecentViewTargetKey(item) === key);
      });
      saveJoinRecentViewedItems(remainingItems);
      refreshJoinMyRecentMenu(type);
    }

    function clearJoinRecentViewedItems(recentType = "product") {
      const type = recentType === "join_schedule" ? "join_schedule" : "product";
      const label = type === "join_schedule" ? "최근 본 조인모임" : "최근 본 상품";
      if (!window.confirm(`${label}을 모두 삭제할까요?`)) return;
      const remainingItems = getJoinRecentViewedItems().filter((item) => {
        return getJoinRecentViewType(item, item.recentType) !== type;
      });
      saveJoinRecentViewedItems(remainingItems);
      refreshJoinMyRecentMenu(type);
    }

    function renderJoinMyCardDeleteButton(item = {}) {
      const isWishCard = Boolean(item.wishDeleteTargetKey);
      const targetKey = String(isWishCard ? item.wishDeleteTargetKey : item.recentDeleteTargetKey || "").trim();
      if (!targetKey) return "";
      const itemType = (isWishCard ? item.wishDeleteType : item.recentDeleteType) === "join_schedule" ? "join_schedule" : "product";
      const label = isWishCard
        ? (itemType === "join_schedule" ? "찜한 조인 일정 삭제" : "찜한 상품 삭제")
        : (itemType === "join_schedule" ? "최근 본 조인모임 삭제" : "최근 본 상품 삭제");
      const onclick = isWishCard
        ? `handleJoinWishRemove('${escapeJsString(targetKey)}', '${itemType}')`
        : `removeJoinRecentViewedItem('${escapeJsString(targetKey)}', '${itemType}')`;
      return `<button type="button" class="join-my-recent-delete-button" onclick="event.stopPropagation(); ${onclick}" aria-label="${label}" title="${label}">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-icon lucide-trash" aria-hidden="true"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>`;
    }

    function renderJoinMyRecentCards(items = [], tabKey = "product") {
      if (!items.length) return renderJoinMyRecentEmptyState(tabKey);
      return items.map((item) => {
        const targetKey = getJoinRecentViewTargetKey(item);
        const isJoinSchedule = tabKey === "join_schedule";
        const cardItem = {
          ...item,
          hideImage: true,
          countryRegion: item.countryRegion || item.region || "",
          price: item.price ? `${formatPrice(item.price)}원` : "",
          hideParticipants: !isJoinSchedule,
          detailHideParticipants: !isJoinSchedule,
          showMeBadge: false,
          status: isJoinSchedule ? "조인모임" : "상품",
          statusClass: "green",
          recentOpenTargetKey: targetKey,
          recentOpenType: tabKey,
          recentDeleteTargetKey: targetKey,
          recentDeleteType: tabKey,
          actions: [
            { label: "상세정보 열기", action: "accordion", placement: "head" }
          ]
        };
        return renderJoinMyAccordionCard(cardItem, getJoinMyHeadAction(cardItem));
      }).join("");
    }

    function renderJoinMyRecentMenu() {
      const target = document.getElementById("joinMyMenuBody");
      if (!target) return;
      const recentItems = getJoinRecentViewedItems();
      const productItems = recentItems.filter((item) => getJoinRecentViewType(item, item.recentType) === "product");
      const joinItems = recentItems.filter((item) => getJoinRecentViewType(item, item.recentType) === "join_schedule");
      document.getElementById("joinMyMenuTitle") && (document.getElementById("joinMyMenuTitle").textContent = "최근 본 상품");
      target.innerHTML = `
        <div class="join-my-reservation-nav" role="tablist" aria-label="최근 본 상품 분류">
          <button type="button" class="join-my-tab active" data-join-my-tab="recent-products" role="tab" aria-selected="true" onclick="switchJoinMyTab('recent-products')">상품</button>
          <button type="button" class="join-my-tab" data-join-my-tab="recent-joins" role="tab" aria-selected="false" onclick="switchJoinMyTab('recent-joins')">조인모임</button>
        </div>
        <div class="join-my-profile">
          <section class="join-my-section" data-join-my-section="recent-products">
            <div class="join-my-reservation-title-row">
              <div class="join-my-reservation-title">최근 본 상품</div>
              ${productItems.length ? `<button type="button" class="join-my-recent-clear-button" onclick="clearJoinRecentViewedItems('product')">전체삭제</button>` : ""}
            </div>
            ${renderJoinMyRecentCards(productItems, "product")}
          </section>
          <section class="join-my-section" data-join-my-section="recent-joins" hidden>
            <div class="join-my-reservation-title-row">
              <div class="join-my-reservation-title">최근 본 조인모임</div>
              ${joinItems.length ? `<button type="button" class="join-my-recent-clear-button" onclick="clearJoinRecentViewedItems('join_schedule')">전체삭제</button>` : ""}
            </div>
            ${renderJoinMyRecentCards(joinItems, "join_schedule")}
          </section>
        </div>
      `;
    }

    function openJoinMyRecentMenu(options = {}) {
      const overlay = portalOverlayToBody("joinMyMenuModal");
      const body = document.getElementById("joinMyMenuBody");
      joinMyMenuReturnToDrawerOnClose = Boolean(options.returnToDrawer);
      beginJoinMyMenuView("recent");
      document.getElementById("joinMyMenuTitle") && (document.getElementById("joinMyMenuTitle").textContent = "최근 본 상품");
      if (body) body.innerHTML = `<div class="join-my-state">최근 본 상품을 확인 중입니다.</div>`;
      overlay?.classList.add("open");
      setJoinMobileBottomNavLayerActive("my");
      setJoinMobileBottomNavVisible(false, { force: true, reason: "my-menu" });
      setWidgetModalOpen(true);
      renderJoinMyRecentMenu();
    }

    function openJoinRecentViewedProduct(targetKey, recentType = "product") {
      const key = String(targetKey || "").trim();
      const type = String(recentType || "product");
      if (!key) return;
      if (type === "join_schedule") {
        const join = joins.find((item) => item.id === key || item.scheduleId === key || item.sourceApplicationId === key);
        if (!join) {
          alert("연결된 조인모임을 찾을 수 없습니다.");
          return;
        }
        closeJoinMyMenu();
        openDetail(join.id, { returnToJoinMy: { menu: "recent", tab: "recent-joins" } });
        return;
      }
      const recent = getJoinRecentViewedItems().find((item) => getJoinRecentViewType(item, item.recentType) === "product" && getJoinRecentViewTargetKey(item) === key) || {};
      const join = joins.find((item) => getJoinProductGoodSeq(item) === key || String(item.goodSeq || "") === key || item.id === key);
      if (join) {
        closeJoinMyMenu();
        openDetail(join.id, { returnToJoinMy: { menu: "recent", tab: "recent-products" } });
        return;
      }
      const params = new URLSearchParams({ goodSeq: key });
      if (recent.eventSeq) params.set("eventSeq", recent.eventSeq);
      location.href = `/goods/goods_view?${params.toString()}`;
    }

    function isAdminRecommendedJoinWish(item = {}) {
      if (item.isAdminRecommendedSchedule) return true;
      const identityKeys = new Set([
        item.joinId,
        item.scheduleId,
        item.targetScheduleId,
        item.sourceApplicationId,
        item.targetApplicationId,
        item.id
      ].map((value) => String(value || "").trim()).filter(Boolean));
      if (!identityKeys.size || !Array.isArray(joins)) return false;
      return joins.some((join) => {
        if (!join?.isAdminRecommendedSchedule) return false;
        return [
          join.id,
          join.scheduleId,
          join.sourceApplicationId,
          join.recommendedScheduleId,
          getNestedValue(join.displayRule || {}, "recommendedScheduleId"),
          getNestedValue(join.displayRule || {}, "displayRuleId")
        ].some((value) => identityKeys.has(String(value || "").trim()));
      });
    }

    function getJoinWishType(join = {}) {
      return isJoinMyBuilderApplicationJoin(join) || isAdminRecommendedJoinWish(join) ? "join_schedule" : "product";
    }

    function getJoinWishTargetKey(item = {}) {
      const type = item.wishType || item.targetType || "product";
      if (type === "join_schedule") {
        return String(item.joinId || item.scheduleId || item.targetId || item.id || "").trim();
      }
      return String(item.goodSeq || item.productId || item.targetId || "").trim();
    }

    function normalizeJoinWishProduct(item = {}) {
      const storedWishType = item.wishType || item.targetType || (item.joinId && !item.goodSeq ? "join_schedule" : "product");
      const wishType = storedWishType === "join_schedule" || isAdminRecommendedJoinWish(item) ? "join_schedule" : "product";
      const targetKey = getJoinWishTargetKey({ ...item, wishType });
      return {
        ...item,
        wishType,
        targetType: wishType,
        targetKey,
        status: item.status || "active",
        savedAt: item.savedAt || item.createdAt || nowKstISOString()
      };
    }

    function getJoinWishProducts() {
      try {
        const memberKey = getJoinWishMemberKey();
        if (!memberKey) return [];
        const saved = readJoinMemberScopedItems(JOIN_WISH_STORAGE_KEY);
        const cachedRows = readGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY, { memberKey }).map(normalizeJoinWishSheetRow);
        const localItems = saved.map(normalizeJoinWishProduct).filter((item) => getJoinWishTargetKey(item) && item.status !== "deleted");
        return mergeJoinWishProducts(localItems, cachedRows);
      } catch (error) {
        return [];
      }
    }

    function saveJoinWishProducts(items = []) {
      writeJoinMemberScopedItems(JOIN_WISH_STORAGE_KEY, items.map(normalizeJoinWishProduct));
    }

    function getJoinMemberCanonicalKey(member = {}) {
      const normalized = member ? getJoinMemberWithCachedProfile(member) : {};
      const existingKey = String(normalized.memberKey || "").trim();
      if (existingKey) return existingKey;
      const seq = String(normalized.memberSeq || "").trim();
      if (seq) return `seq:${seq}`;
      const id = String(normalized.memberId || "").trim().toLowerCase();
      if (id) return `id:${id}`;
      const phone = normalizeJoinMemberPhone(normalized.memberMobile || normalized.mobile || normalized.phone || "");
      if (phone) return `phone:${phone}`;
      const email = String(normalized.memberEmail || normalized.email || "").trim().toLowerCase();
      if (email) return `email:${email}`;
      const kakaoId = String(normalized.kakaoId || "").trim();
      if (kakaoId) return `kakao:${kakaoId}`;
      return "";
    }

    function buildJoinSubmissionMemberPayload(...sources) {
      const candidates = sources.filter((source) => source && typeof source === "object");
      const firstValue = (...keys) => {
        for (const source of candidates) {
          for (const key of keys) {
            const value = source[key];
            if (value !== undefined && value !== null && String(value).trim()) return value;
          }
        }
        return "";
      };
      const member = {
        memberKey: String(firstValue("memberKey") || "").trim(),
        memberSeq: String(firstValue("memberSeq", "seq") || "").trim(),
        memberId: String(firstValue("memberId", "id") || "").trim(),
        memberName: String(firstValue("memberName", "name") || "").trim(),
        memberChannel: String(firstValue("memberChannel", "channel") || "").trim(),
        memberMobile: normalizeJoinMemberPhone(firstValue("memberMobile", "mobile", "phone")),
        memberEmail: String(firstValue("memberEmail", "email") || "").trim(),
        kakaoId: String(firstValue("kakaoId") || "").trim()
      };
      member.memberKey = getJoinMemberCanonicalKey(member);
      return member;
    }

    function getJoinWishMemberKey(member = getJoinCachedCurrentMember()) {
      return getJoinMemberCanonicalKey(member);
    }

    function readJoinMemberScopedItems(storageKey, member = getJoinCachedCurrentMember()) {
      const memberKey = getJoinMemberCanonicalKey(member || {});
      if (!memberKey) return [];
      try {
        const cached = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (!cached || Array.isArray(cached)) return [];
        if (String(cached.memberKey || "") !== memberKey) return [];
        return Array.isArray(cached.items) ? cached.items : [];
      } catch (error) {
        golfJoinSafeWarn("Failed to read member-scoped join cache.", storageKey, error);
        return [];
      }
    }

    function writeJoinMemberScopedItems(storageKey, items = [], member = getJoinCachedCurrentMember()) {
      const memberKey = getJoinMemberCanonicalKey(member || {});
      if (!memberKey) return false;
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          memberKey,
          updatedAt: Date.now(),
          items: Array.isArray(items) ? items : []
        }));
        return true;
      } catch (error) {
        golfJoinSafeWarn("Failed to write member-scoped join cache.", storageKey, error);
        return false;
      }
    }

    function clearJoinPrivateClientCaches() {
      [
        JOIN_WISH_STORAGE_KEY,
        JOIN_APPLICATIONS_STORAGE_KEY,
        BUILDER_APPLICATIONS_STORAGE_KEY,
        GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY,
        GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY,
        GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY
      ].forEach((key) => {
        try { localStorage.removeItem(key); } catch (error) {}
      });
      clearJoinApplicationRuntimeState();
      googleSheetJoinApplicationsReadCompleted = false;
      googleSheetJoinApplicationsReadFailed = false;
      googleSheetBuilderApplicationsReadCompleted = false;
      googleSheetBuilderApplicationsReadFailed = false;
      googleSheetJoinWishesReadCompleted = false;
      googleSheetJoinWishesReadFailed = false;
      googleSheetJoinWishesReadMemberKey = "";
      clearActiveJoinMySchedulesCache();
    }

    function getJoinSheetMemberLookupParams(member = getJoinCachedCurrentMember()) {
      const normalized = member ? getJoinMemberWithCachedProfile(member) : {};
      return {
        memberKey: getJoinMemberCanonicalKey(normalized),
        memberSeq: normalized.memberSeq || "",
        memberId: normalized.memberId || "",
        memberMobile: normalizeJoinMemberPhone(normalized.memberMobile || normalized.mobile || normalized.phone || ""),
        memberEmail: String(normalized.memberEmail || normalized.email || "").trim(),
        kakaoId: String(normalized.kakaoId || "").trim()
      };
    }

    function getJoinWishId(member = getJoinCachedCurrentMember(), wishType = "product", targetKey = "") {
      return buildGoogleSheetRecordId("jw", getJoinWishMemberKey(member), wishType, targetKey);
    }

    function normalizeJoinWishSheetRow(row = {}) {
      const wishType = row.wishType || row.targetType || "product";
      const targetKey = row.targetKey || getJoinWishTargetKey({ ...row, wishType });
      return normalizeJoinWishProduct({
        id: row.id || row.joinId || (row.erpProductId && row.erpEventSeq ? `secret-tour-${row.erpProductId}-${row.erpEventSeq}` : row.erpProductId || targetKey),
        wishId: row.wishId || getJoinWishId(row, wishType, targetKey),
        wishType,
        targetType: wishType,
        targetKey,
        joinId: row.joinId || row.targetScheduleId || "",
        scheduleId: row.scheduleId || row.targetScheduleId || "",
        sourceApplicationId: row.sourceApplicationId || row.targetApplicationId || "",
        productId: row.productId || row.erpProductId || "",
        goodSeq: row.goodSeq || row.erpProductId || "",
        eventSeq: row.eventSeq || row.erpEventSeq || "",
        title: row.title || row.productName || "",
        country: row.country || row.countryName || getNestedValue(row, "product.country") || "",
        region: row.region || row.category || "",
        image: row.image || row.imageUrl || "",
        price: Number(row.price || 0),
        departureDate: row.departureDate || "",
        returnDate: row.returnDate || "",
        status: row.status || "active",
        savedAt: row.savedAt || row.createdAt || row.updatedAt || nowKstISOString()
      });
    }

    function mergeJoinWishProducts(localItems = [], sheetItems = []) {
      const merged = new Map();
      [...localItems, ...sheetItems].map(normalizeJoinWishProduct).forEach((item) => {
        const key = `${item.wishType}:${getJoinWishTargetKey(item)}`;
        if (!key || key.endsWith(":")) return;
        const previous = merged.get(key);
        if (!previous || new Date(item.updatedAt || item.savedAt || 0).getTime() >= new Date(previous.updatedAt || previous.savedAt || 0).getTime()) {
          merged.set(key, item);
        }
      });
      return Array.from(merged.values()).filter((item) => item.status !== "deleted");
    }

    function updateJoinWishRowsCache(item = {}, status = "active") {
      try {
        const normalized = normalizeJoinWishProduct({ ...item, status });
        const targetKey = getJoinWishTargetKey(normalized);
        if (!targetKey) return;
        const cached = JSON.parse(localStorage.getItem(GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY) || "null");
        const rows = Array.isArray(cached?.rows) ? cached.rows : [];
        const nextRows = rows.filter((row) => {
          const rowType = row.wishType || row.targetType || "product";
          return !(rowType === normalized.wishType && getJoinWishTargetKey({ ...row, wishType: rowType }) === targetKey);
        });
        if (status !== "deleted") {
          nextRows.unshift({
            ...normalized,
            wishId: normalized.wishId || getJoinWishId(getJoinCachedCurrentMember(), normalized.wishType, targetKey),
            targetType: normalized.wishType,
            targetKey,
            erpProductId: normalized.goodSeq || normalized.productId || (normalized.wishType === "product" ? targetKey : ""),
            erpEventSeq: normalized.eventSeq || "",
            productName: normalized.title || "",
            country: normalized.country || "",
            imageUrl: normalized.image || "",
            updatedAt: nowKstISOString()
          });
        }
        localStorage.setItem(GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY, JSON.stringify({
          fetchedAt: Date.now(),
          memberKey: getJoinWishMemberKey(),
          rows: nextRows
        }));
      } catch (error) {
        golfJoinSafeWarn("Failed to update wish rows cache.", error);
      }
    }

    function getJoinProductGoodSeq(join = {}) {
      const parsedReference = parseSecretTourProductReference(join.id || join.erpProductId || "", join.eventSeq || join.erpEventSeq || "");
      return String(join.goodSeq || parsedReference.goodSeq || join.erpProductId || "").trim();
    }

    function isJoinProductWished(join = {}) {
      const snapshot = createJoinWishProductSnapshot(join);
      const targetKey = getJoinWishTargetKey(snapshot);
      if (!targetKey) return false;
      return getJoinWishProducts().some((item) => item.wishType === snapshot.wishType && getJoinWishTargetKey(item) === targetKey);
    }

    function createJoinWishProductSnapshot(join = {}) {
      const goodSeq = getJoinProductGoodSeq(join);
      const parsedReference = parseSecretTourProductReference(join.id || join.erpProductId || "", join.eventSeq || join.erpEventSeq || "");
      const eventSeq = String(join.eventSeq || parsedReference.eventSeq || join.erpEventSeq || "").trim();
      const wishType = getJoinWishType(join);
      const targetKey = wishType === "join_schedule" ? String(join.id || join.scheduleId || "").trim() : goodSeq;
      const participants = getConfirmedParticipants(join);
      const targetCount = getCardTeamCapacity(join, 4);
      const sheetApplication = join.sheetApplication || {};
      return {
        id: wishType === "join_schedule" ? join.id : (join.id || (goodSeq && eventSeq ? `secret-tour-${goodSeq}-${eventSeq}` : goodSeq)),
        wishType,
        targetType: wishType,
        targetKey,
        joinId: join.id || "",
        scheduleId: join.scheduleId || sheetApplication.scheduleId || "",
        sourceApplicationId: join.sourceApplicationId || sheetApplication.applicationId || "",
        productId: join.erpProductId || parsedReference.goodSeq || goodSeq || "",
        goodSeq,
        eventSeq,
        title: join.title || "골프여행 상품",
        country: getJoinWishCountry(join),
        region: join.region || join.category || "골프여행",
        image: join.image || getDetailSlides(join)[0] || "",
        price: Number(join.price || 0),
        departureDate: join.departureDate || "",
        returnDate: join.returnDate || "",
        currentCount: participants.length,
        targetCount,
        isAdminRecommendedSchedule: Boolean(join.isAdminRecommendedSchedule),
        hostNameMasked: maskApplyName(getNestedValue(sheetApplication, "applicant.name") || getNestedValue(sheetApplication, "member.memberName") || ""),
        savedAt: nowKstISOString()
      };
    }

    function getJoinWishCountry(item = {}) {
      const direct = String(item.country || item.countryName || item.nation || item.productCountry || item.erpCountry || "").trim();
      if (direct) return direct;
      const region = String(item.region || item.countryRegion || item.location || item.category || "").replace(/\s*,\s*/g, " ").trim();
      return inferDetailCountryName(region, item);
    }

    function buildJoinWishSheetPayload(item = {}, status = "active", member = getJoinCachedCurrentMember()) {
      const normalizedMember = getJoinMemberWithCachedProfile(member || {});
      const wishType = item.wishType || item.targetType || "product";
      const targetKey = getJoinWishTargetKey({ ...item, wishType });
      const savedAt = item.savedAt || item.createdAt || nowKstISOString();
      const country = getJoinWishCountry(item);
      return {
        source: "join_wish",
        sheet: "join_wishes",
        action: "upsert",
        keyField: "wishId",
        wishId: item.wishId || getJoinWishId(normalizedMember, wishType, targetKey),
        createdAt: savedAt,
        savedAt,
        pageUrl: location.href,
        member: {
          memberSeq: normalizedMember.memberSeq || "",
          memberId: normalizedMember.memberId || "",
          memberName: normalizedMember.memberName || "",
          memberChannel: normalizedMember.memberChannel || "",
          memberMobile: normalizeJoinMemberPhone(normalizedMember.memberMobile || normalizedMember.mobile || normalizedMember.phone || ""),
          memberEmail: normalizedMember.memberEmail || ""
        },
        targetType: wishType,
        targetKey,
        targetScheduleId: wishType === "join_schedule" ? (item.scheduleId || item.joinId || "") : "",
        targetApplicationId: item.sourceApplicationId || "",
        erpProductId: item.goodSeq || item.productId || (wishType === "product" ? targetKey : ""),
        erpEventSeq: item.eventSeq || "",
        product: {
          erpProductId: item.goodSeq || item.productId || (wishType === "product" ? targetKey : ""),
          erpEventSeq: item.eventSeq || "",
          productName: item.title || "",
          departureDate: item.departureDate || "",
          returnDate: item.returnDate || "",
          category: item.category || "",
          country,
          region: item.region || item.countryRegion || "",
          imageUrl: item.image || "",
          price: item.price || ""
        },
        productName: item.title || "",
        departureDate: item.departureDate || "",
        returnDate: item.returnDate || "",
        country,
        region: item.region || item.countryRegion || "",
        imageUrl: item.image || "",
        price: item.price || "",
        status
      };
    }

    async function saveJoinWishToGoogleSheet(item = {}, status = "active") {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return null;
      const member = getJoinCachedCurrentMember();
      if (!getJoinWishMemberKey(member)) return null;
      return postGolfJoinSheetPayload(buildJoinWishSheetPayload(item, status, member), "Join wish");
    }

    function addJoinWishProduct(join = {}) {
      const snapshot = createJoinWishProductSnapshot(join);
      const targetKey = getJoinWishTargetKey(snapshot);
      if (!targetKey) return false;
      const current = getJoinWishProducts().filter((item) => !(item.wishType === snapshot.wishType && getJoinWishTargetKey(item) === targetKey));
      saveJoinWishProducts([snapshot, ...current].slice(0, 50));
      updateJoinWishRowsCache(snapshot, "active");
      invalidateHomeBootstrapLightCache();
      void saveJoinWishToGoogleSheet(snapshot, "active").catch((error) => {
        golfJoinSafeWarn("Failed to save wish to Google Sheet.", error);
      });
      return true;
    }

    function removeJoinWishProduct(targetKey, wishType = "product") {
      const key = String(targetKey || "").trim();
      if (!key) return;
      const removed = getJoinWishProducts().find((item) => item.wishType === wishType && getJoinWishTargetKey(item) === key) || {
        wishType,
        targetType: wishType,
        targetKey: key
      };
      saveJoinWishProducts(getJoinWishProducts().filter((item) => !(item.wishType === wishType && getJoinWishTargetKey(item) === key)));
      updateJoinWishRowsCache(removed, "deleted");
      invalidateHomeBootstrapLightCache();
      void saveJoinWishToGoogleSheet(removed, "deleted").catch((error) => {
        golfJoinSafeWarn("Failed to remove wish from Google Sheet.", error);
      });
      refreshDetailWishButtons();
      if (isJoinMyMenuViewOpen("wish")) {
        renderJoinMyWishMenu();
      }
    }

    async function deleteSecretTourWishProduct(goodSeq) {
      if (!/^(m\.|www\.)?secret-tour\.com$/i.test(window.location.hostname)) return { skipped: true };
      const body = new URLSearchParams({ goodSeq: String(goodSeq || "") });
      const response = await fetch("/mypage/deleteWish.json", {
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
      if (!response.ok) throw new Error(`Delete wish failed: ${response.status}`);
      return response.json().catch(() => ({}));
    }

    function renderJoinMyWishEmptyState(tabKey = "product") {
      const message = tabKey === "join_schedule" ? "찜한 조인 일정이 없어요." : "찜한 상품이 없어요.";
      return `<div class="join-my-empty">
        <div class="join-my-empty-box">
          <div class="join-my-empty-copy">${escapeHtml(message)}</div>
          <button type="button" class="region-result-empty-action" onclick="openBuilderFromRegionSearch()">새로운 모임 만들기</button>
        </div>
        ${renderJoinMyEmptyRecommendations(tabKey)}
      </div>`;
    }

    function renderJoinMyWishCards(items = [], tabKey = "product") {
      if (!items.length) return renderJoinMyWishEmptyState(tabKey);
      return items.map((item) => {
        const targetKey = getJoinWishTargetKey(item);
        const isJoinSchedule = tabKey === "join_schedule";
        const cardItem = {
          ...item,
          hideImage: true,
          countryRegion: item.countryRegion || item.region || "",
          price: item.price ? `${formatPrice(item.price)}원` : "",
          hideParticipants: !isJoinSchedule,
          detailHideParticipants: !isJoinSchedule,
          showMeBadge: false,
          status: isJoinSchedule ? "조인모임" : "상품",
          statusClass: "green",
          wishOpenTargetKey: targetKey,
          wishOpenType: tabKey,
          wishDeleteTargetKey: targetKey,
          wishDeleteType: tabKey,
          actions: [
            { label: "상세정보 열기", action: "accordion", placement: "head" }
          ]
        };
        return renderJoinMyAccordionCard(cardItem, getJoinMyHeadAction(cardItem));
      }).join("");
    }
    function renderJoinMyWishMenu() {
      const target = document.getElementById("joinMyMenuBody");
      if (!target) return;
      const wishes = getJoinWishProducts();
      const productWishes = wishes.filter((item) => item.wishType === "product");
      const joinScheduleWishes = wishes.filter((item) => item.wishType === "join_schedule");
      document.getElementById("joinMyMenuTitle") && (document.getElementById("joinMyMenuTitle").textContent = "찜한 상품");
      target.innerHTML = `
        <div class="join-my-reservation-nav" role="tablist" aria-label="찜 분류">
          <button type="button" class="join-my-tab active" data-join-my-tab="wish-products" role="tab" aria-selected="true" onclick="switchJoinMyTab('wish-products')">상품</button>
          <button type="button" class="join-my-tab" data-join-my-tab="wish-joins" role="tab" aria-selected="false" onclick="switchJoinMyTab('wish-joins')">조인 일정</button>
        </div>
        <div class="join-my-profile">
          <section class="join-my-section" data-join-my-section="wish-products">
            <div class="join-my-reservation-title">찜한 상품</div>
            ${renderJoinMyWishCards(productWishes, "product")}
          </section>
          <section class="join-my-section" data-join-my-section="wish-joins" hidden>
            <div class="join-my-reservation-title">찜한 조인 일정</div>
            ${renderJoinMyWishCards(joinScheduleWishes, "join_schedule")}
          </section>
        </div>
      `;
    }

    async function hydrateJoinWishesFromGoogleSheet(options = {}) {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return getJoinWishProducts();
      const member = getJoinCachedCurrentMember();
      const memberKey = getJoinWishMemberKey(member);
      if (!memberKey) return getJoinWishProducts();
      if (googleSheetJoinWishesLoading && !options.force) return getJoinWishProducts();
      if (!options.force && googleSheetJoinWishesReadCompleted && !googleSheetJoinWishesReadFailed && googleSheetJoinWishesReadMemberKey === memberKey) return getJoinWishProducts();
      if (!options.force && hasFreshGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY, { memberKey })) return getJoinWishProducts();
      googleSheetJoinWishesLoading = true;
      googleSheetJoinWishesReadFailed = false;
      try {
        const normalizedMember = getJoinMemberWithCachedProfile(member);
        const memberLookupParams = getJoinSheetMemberLookupParams(normalizedMember);
        const rows = getGolfJoinSheetActionRows(await postGolfJoinSheetAction("join_wishes_lookup", {
          ...memberLookupParams,
          limit: 200
        }, "Join wishes"));
        const sheetItems = rows.map(normalizeJoinWishSheetRow).filter((item) => item.status !== "deleted");
        const merged = mergeJoinWishProducts(getJoinWishProducts(), sheetItems);
        saveJoinWishProducts(merged);
        writeGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY, rows, { memberKey });
        googleSheetJoinWishesReadCompleted = true;
        googleSheetJoinWishesReadFailed = false;
        googleSheetJoinWishesReadMemberKey = memberKey;
        return merged;
      } catch (error) {
        googleSheetJoinWishesReadCompleted = true;
        googleSheetJoinWishesReadFailed = true;
        golfJoinSafeWarn("Failed to load join wishes from Google Sheet.", error);
        return getJoinWishProducts();
      } finally {
        googleSheetJoinWishesLoading = false;
      }
    }

    function applyJoinWishesFromGoogleSheetRows(rows = [], memberKey = getJoinWishMemberKey()) {
      const sheetItems = rows.map(normalizeJoinWishSheetRow).filter((item) => item.status !== "deleted");
      const merged = mergeJoinWishProducts(getJoinWishProducts(), sheetItems);
      saveJoinWishProducts(merged);
      writeGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_WISHES_READ_CACHE_KEY, rows, { memberKey: String(memberKey || "") });
      googleSheetJoinWishesReadCompleted = true;
      googleSheetJoinWishesReadFailed = false;
      googleSheetJoinWishesReadMemberKey = String(memberKey || "");
      return merged;
    }


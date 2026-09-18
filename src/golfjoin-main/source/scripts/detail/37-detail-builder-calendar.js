    function findHeroOctoberMonthlyJoin() {
      const exact = joins.find((join) => {
        const rule = join.displayRule || {};
        return [
          join.sourceApplicationId,
          join.recommendedScheduleId,
          rule.recommendedScheduleId,
          rule.displayRuleId
        ].some((value) => String(value || "").trim() === HERO_OCTOBER_MONTHLY_SCHEDULE_ID);
      });
      if (exact) return exact;
      return joins.find((join) => {
        const title = String(join.title || join.displayRule?.overrideTitle || "");
        const departureDate = String(join.departureDate || join.displayRule?.displayStartAt || "");
        return join.isAdminRecommendedSchedule
          && isMonthlyRecommendationJoin(join)
          && (title.includes("10월") || /^\d{4}-10-/.test(departureDate));
      }) || null;
    }

    async function openHeroOctoberMonthlyDetail() {
      try {
        await runJoinActionLoading(async () => {
          let target = findHeroOctoberMonthlyJoin();
          if (!target) {
            await hydrateAdminRecommendedSchedulesFromGoogleSheet();
            target = findHeroOctoberMonthlyJoin();
          }
          if (!target) throw new Error("10월 월례회 상품을 찾을 수 없습니다.");
          openDetail(target.id);
        }, { message: "10월 월례회 상품을 불러오고 있어요", button: null, minVisibleMs: 300 });
      } catch (error) {
        golfJoinSafeWarn("Failed to open the October monthly recommendation from the hero banner.", error);
        alert(error?.message || "10월 월례회 상품을 불러오지 못했습니다.");
      }
    }

    function handleHeroOctoberMonthlyKeydown(event) {
      if (!event || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openHeroOctoberMonthlyDetail();
    }

    function startHeroSlider() {
      const track = document.getElementById("heroSliderTrack");
      const dots = document.getElementById("heroSlickDots");
      if (!track) return;
      const originalSlides = Array.from(track.children);
      heroRealSlideCount = originalSlides.length;
      if (heroRealSlideCount < 2) return;
      track.prepend(originalSlides[heroRealSlideCount - 1].cloneNode(true));
      track.append(originalSlides[0].cloneNode(true));
      track.style.transition = "none";
      track.style.transform = `translateX(-${heroSlideIndex * 100}%)`;
      track.offsetHeight;
      track.style.transition = "";
      if (dots) {
        dots.innerHTML = Array.from({ length: heroRealSlideCount }).map((_, index) => `
          <button type="button" class="hero-slick-dot${index === 0 ? " active" : ""}" onclick="setHeroSlide(${index + 1})" aria-label="배너 ${index + 1}번 보기"></button>
        `).join("");
      }
      track.addEventListener("transitionend", normalizeHeroSlidePosition);
      setInterval(() => {
        setHeroSlide(heroSlideIndex + 1);
      }, 5000);
    }

    function setHeroSlide(index) {
      const track = document.getElementById("heroSliderTrack");
      if (!track || !heroRealSlideCount) return;
      heroSlideIndex = index;
      track.style.transform = `translateX(-${heroSlideIndex * 100}%)`;
      updateHeroDots();
    }

    function normalizeHeroSlidePosition() {
      const track = document.getElementById("heroSliderTrack");
      if (!track || !heroRealSlideCount) return;
      if (heroSlideIndex === heroRealSlideCount + 1) {
        heroSlideIndex = 1;
        track.style.transition = "none";
        track.style.transform = `translateX(-${heroSlideIndex * 100}%)`;
        track.offsetHeight;
        track.style.transition = "";
      } else if (heroSlideIndex === 0) {
        heroSlideIndex = heroRealSlideCount;
        track.style.transition = "none";
        track.style.transform = `translateX(-${heroSlideIndex * 100}%)`;
        track.offsetHeight;
        track.style.transition = "";
      }
      updateHeroDots();
    }

    function updateHeroDots() {
      if (!heroRealSlideCount) return;
      const realIndex = (heroSlideIndex - 1 + heroRealSlideCount) % heroRealSlideCount;
      document.querySelectorAll("#heroSlickDots .hero-slick-dot").forEach((dot, dotIndex) => {
        dot.classList.toggle("active", dotIndex === realIndex);
      });
    }

    function formatPrice(value) {
      const price = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(price) && price > 0 ? price.toLocaleString("ko-KR") : "0";
    }

    function formatCardDateRange(join) {
      const start = new Date(join.departureDate + "T00:00:00");
      const end = new Date((join.returnDate || join.departureDate) + "T00:00:00");
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      if (Number.isNaN(start.getTime())) return "";
      const formatCompact = (date) => {
        if (Number.isNaN(date.getTime())) return "";
        return `${date.getMonth() + 1}.${date.getDate()}(${dayNames[date.getDay()]})`;
      };
      const startLabel = formatCompact(start);
      const endLabel = formatCompact(end);
      const range = startLabel === endLabel ? startLabel : `${startLabel}~${endLabel}`;
      return range;
    }

    function formatCardFlexDateLabel(isoDate) {
      const date = new Date(`${isoDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}.${date.getDate()}(${dayNames[date.getDay()]})`;
    }

    function getJoinDateArray(join, key) {
      const direct = toBuilderApplicationArray(join?.[key]);
      if (direct.length) return direct;
      return toBuilderApplicationArray(getNestedValue(join?.sheetApplication || {}, `trip.${key}`));
    }

    function getJoinFlexibleDays(join) {
      const direct = join?.flexibleDays || {};
      const sheet = getNestedValue(join?.sheetApplication || {}, "trip.flexibleDays") || {};
      return {
        startBefore: Number(direct.startBefore || sheet.startBefore || 0),
        startAfter: Number(direct.startAfter || sheet.startAfter || 0),
        endBefore: Number(direct.endBefore || sheet.endBefore || 0),
        endAfter: Number(direct.endAfter || sheet.endAfter || 0)
      };
    }

    function isJoinFlexibleDateSchedule(join) {
      const flex = getJoinFlexibleDays(join);
      return Boolean(
        flex.startBefore || flex.startAfter || flex.endBefore || flex.endAfter ||
        getJoinDateArray(join, "departureDates").length > 1 ||
        getJoinDateArray(join, "returnDates").length > 1
      );
    }

    function formatJoinAvailableDateRange(join, key, fallbackSummary = "") {
      const dates = getJoinDateArray(join, key)
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      if (dates.length) {
        const first = formatCardFlexDateLabel(dates[0]);
        const last = formatCardFlexDateLabel(dates[dates.length - 1]);
        if (first && last) return first === last ? first : `${first} ~ ${last}`;
      }
      return String(fallbackSummary || "").replace(/\s+-\s+/g, " ~ ").trim();
    }

    function isJoinAvailableDateRangeSingle(join, key, fallbackSummary = "") {
      const dates = getJoinDateArray(join, key)
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      if (dates.length) return dates[0] === dates[dates.length - 1];
      const summary = String(fallbackSummary || "").trim();
      return Boolean(summary) && !/\s[-~]\s/.test(summary);
    }

    function renderCardDepartureIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" class="card-meta-icon card-meta-icon-date lucide lucide-plane-takeoff-icon lucide-plane-takeoff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 22h20"/>
          <path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z"/>
        </svg>
      `;
    }

    function renderCardArrivalIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" class="card-meta-icon card-meta-icon-date lucide lucide-plane-landing-icon lucide-plane-landing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 22h20"/>
          <path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z"/>
        </svg>
      `;
    }

    function renderCardCalendarIcon() {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" class="card-meta-icon card-meta-icon-date lucide lucide-calendar-icon lucide-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 2v4"/>
          <path d="M16 2v4"/>
          <rect width="18" height="18" x="3" y="4" rx="2"/>
          <path d="M3 10h18"/>
        </svg>
      `;
    }

    function renderCardDateMeta(join) {
      const range = formatCardDateRange(join);
      if (!range) return "";
      return `
        <div class="card-meta card-meta-row card-meta-date-flex" style="font-weight:700; color:var(--text);">
          <div class="card-meta-item">
            ${renderCardCalendarIcon()}
            <div class="card-meta-text card-meta-text-date">${escapeHtml(range)}</div>
            ${renderScheduleOverlapBadge(join, "", { includeOwn: true })}
          </div>
        </div>
      `;
    }

    function formatDetailDateWithDay(dateString) {
      const date = new Date(dateString + "T00:00:00");
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${yyyy}.${mm}.${dd} (${dayNames[date.getDay()]})`;
    }

    function normalizeDurationText(value, options = {}) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const directMatch = raw.match(/(\d+)\s*박\s*(\d+)\s*일/);
      if (directMatch) return `${directMatch[1]}박 ${directMatch[2]}일`;
      const dayOnlyMatch = raw.match(/^(\d+)\s*일$/);
      if (dayOnlyMatch) {
        const days = Number(dayOnlyMatch[1]);
        return `${Math.max(days - 1, 0)}박 ${days}일`;
      }
      if (options.loose) {
        const looseMatch = raw.match(/^\D*(\d+)\D+(\d+)\D*$/);
        if (looseMatch) return `${looseMatch[1]}박 ${looseMatch[2]}일`;
      }
      return raw;
    }

    function getExplicitTripDuration(join) {
      const durationFields = [
        join.duration,
        join.dayNightCnt,
        join.durationText,
        join.tripDuration,
        join.dayNightText
      ];
      for (const value of durationFields) {
        const normalized = normalizeDurationText(value, { loose: true });
        if (normalized) return normalized;
      }
      return "";
    }

    function extractDurationFromProductText(join) {
      const source = [
        join.title,
        join.productName,
        join.name,
        join.subtitle,
        join.description
      ].filter(Boolean).join(" ");
      const textDuration = source.match(/(\d+)\s*박\s*(\d+)\s*일/);
      return textDuration ? `${textDuration[1]}박 ${textDuration[2]}일` : "";
    }

    function formatTripDuration(join) {
      const titleDuration = extractDurationFromProductText(join);
      if (titleDuration) return titleDuration;
      const jsonDuration = getExplicitTripDuration(join);
      if (jsonDuration) return jsonDuration;
      const dayNight = Number(join.dayNight);
      const dayCnt = Number(join.dayCnt);
      if (Number.isFinite(dayNight) && Number.isFinite(dayCnt) && dayCnt > 0) {
        return `${dayNight}박 ${dayCnt}일`;
      }
      const start = new Date(join.departureDate + "T00:00:00");
      const end = new Date((join.returnDate || join.departureDate) + "T00:00:00");
      const nights = Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      return `${nights}박 ${nights + 1}일`;
    }

    function formatFlightDateTime(dateString, time) {
      const date = new Date(dateString + "T00:00:00");
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      return `${mm}.${dd} (${dayNames[date.getDay()]}) ${time}`;
    }

    function formatFlightDateOnly(dateString) {
      if (!dateString) return "";
      const date = new Date(dateString + "T00:00:00");
      if (Number.isNaN(date.getTime())) return "";
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}.${date.getDate()} (${dayNames[date.getDay()]})`;
    }

    function hasFlightDateText(value) {
      return /\d{1,4}[.\/-]\d{1,2}(?:[.\/-]\d{1,2})?|\d{1,2}\.\d{1,2}|\([월화수목금토일]\)/.test(String(value || ""));
    }

    function getFlightTimeWithDateFallback(segment = {}, dateString = "") {
      const timeText = String(segment.time || "").trim();
      const dateText = formatFlightDateOnly(dateString);
      if (!timeText) return dateText;
      if (!dateText || hasFlightDateText(timeText)) return timeText;
      return `${dateText} ${timeText}`;
    }

    function renderFlightTime(value) {
      const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
      const lastPart = parts[parts.length - 1] || "";
      const hasClock = /^\d{1,2}[:.]\d{2}$/.test(lastPart);
      const clock = hasClock ? parts.pop().replace(".", ":") : "";
      const dateText = parts.join(" ");
      const weekdayMatch = dateText.match(/\(([^)]+)\)$/);
      const cleanDate = weekdayMatch ? dateText.replace(/\s*\([^)]+\)$/, "") : dateText;
      const weekday = weekdayMatch ? weekdayMatch[1] : "";
      return `<div class="flight-time"><div class="flight-time-date"><span class="flight-time-date-desktop">${dateText}</span><span class="flight-time-date-mobile">${cleanDate}${weekday ? ` <span class="flight-time-weekday">${weekday}</span>` : ""}</span></div><div class="flight-time-clock">${clock}</div></div>`;
    }

    function getFlightInfo(join, options = {}) {
      const isOverseas = getJoinCategoryClass(join) === "overseas"
        || /해외|oversea|overseas/i.test(String(join.category || ""))
        || join.source === "secret-tour-goods-event";
      if (!isOverseas) return null;
      return {
        type: "flightCard",
        items: Array.isArray(join.flightScheduleItems) ? join.flightScheduleItems : []
      };
    }

    function extractFlightRoutePlaces(text = "") {
      const source = cleanSecretTourDetailText(text)
        .replace(/\([^)]*\)/g, " ")
        .replace(/\b[A-Z0-9]{2}\s?\d{3,4}\b/g, " ")
        .replace(/\d{1,4}[.\/-]\d{1,2}(?:[.\/-]\d{1,2})?/g, " ")
        .replace(/\d{1,2}[.:]\d{2}/g, " ");
      const airportCodeNames = {
        ICN: "인천",
        GMP: "김포",
        PUS: "부산",
        TAE: "대구",
        CJJ: "청주",
        MWX: "무안",
        CJU: "제주",
        FUK: "후쿠오카",
        KIX: "오사카",
        NRT: "도쿄",
        HND: "도쿄",
        CTS: "삿포로",
        OKA: "오키나와",
        DAD: "다낭",
        HAN: "하노이",
        SGN: "호치민",
        CXR: "나트랑",
        BKK: "방콕",
        DMK: "방콕",
        CNX: "치앙마이",
        HKT: "푸켓",
        CRK: "클락",
        MNL: "마닐라",
        CEB: "세부",
        TPE: "타이베이",
        HKG: "홍콩",
        MFM: "마카오",
        SIN: "싱가포르",
        KUL: "쿠알라룸푸르",
        BKI: "코타키나발루",
        GUM: "괌",
        SPN: "사이판"
      };
      const codePlaces = [];
      source.replace(/\b[A-Z]{3}\b/g, (code) => {
        const place = airportCodeNames[code];
        if (place && !codePlaces.includes(place)) codePlaces.push(place);
        return code;
      });
      const placePattern = /(인천|김포|김해|부산|대구|청주|무안|제주|후쿠오카|오사카|간사이|도쿄|나리타|하네다|삿포로|치토세|오키나와|나하|다낭|하노이|호치민|나트랑|달랏|방콕|치앙마이|푸켓|파타야|클락|마닐라|세부|타이베이|타오위안|홍콩|마카오|싱가포르|쿠알라룸푸르|코타키나발루|괌|사이판|하이난|삼아|해구)\s*(?:국제)?공항?/g;
      const places = [...codePlaces];
      let match;
      while ((match = placePattern.exec(source))) {
        const place = match[1];
        if (!places.includes(place)) places.push(place);
      }
      return places;
    }

    function extractFlightDateParts(text = "") {
      return String(text || "").match(/\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}(?:\s*\([^)]+\))?|\d{1,2}[.\/-]\d{1,2}\s*\([^)]+\)|\d{1,2}[.\/-]\d{1,2}/g) || [];
    }

    function extractFlightTimeParts(text = "") {
      const source = String(text || "");
      const times = [];
      source.replace(/(^|[^\d.])([01]?\d|2[0-3])[:.]([0-5]\d)(?![.\d])/g, (match, prefix, hour, minute) => {
        times.push(`${String(hour).padStart(2, "0")}:${minute}`);
        return match;
      });
      return times;
    }

    const DETAIL_AIRLINE_BY_CODE = {
      "3u": "사천항공",
      "sc": "산동항공",
      "ke": "대한항공",
      "oz": "아시아나항공",
      "7c": "제주항공",
      "lj": "진에어",
      "tw": "티웨이항공",
      "rs": "에어서울",
      "bx": "에어부산",
      "ze": "이스타항공",
      "yp": "에어프레미아",
      "ga": "가루다인도네시아항공",
      "rf": "에어로케이",
      "vn": "베트남항공",
      "vj": "비엣젯항공",
      "tg": "타이항공",
      "sq": "싱가포르항공",
      "cx": "캐세이퍼시픽",
      "ci": "중화항공",
      "br": "에바항공",
      "mu": "중국동방항공",
      "cz": "중국남방항공",
      "ca": "중국국제항공",
      "fm": "상하이항공",
      "mh": "말레이시아항공",
      "pr": "필리핀항공",
      "5j": "세부퍼시픽",
      "tr": "스쿠트항공"
    };

    const DETAIL_AIRLINE_CODE_BY_NAME = Object.fromEntries(
      Object.entries(DETAIL_AIRLINE_BY_CODE).map(([code, name]) => [name.replace(/\s+/g, ""), code])
    );
    const DETAIL_AIRLINE_CODE_PATTERN = new RegExp(`\\b(${Object.keys(DETAIL_AIRLINE_BY_CODE).join("|")})\\s?\\d{2,4}\\b`, "i");

    function normalizeDetailAirlineCode(code = "") {
      const normalizedCode = String(code || "").trim().replace(/\s+/g, "").slice(0, 2).toLowerCase();
      return DETAIL_AIRLINE_BY_CODE[normalizedCode] ? normalizedCode : "";
    }

    function normalizeDetailAirlineName(name = "") {
      const value = cleanSecretTourDetailText(name).replace(/^항공\s*[:：]\s*/, "").trim();
      return value.replace(/\s+/g, "");
    }

    function getDetailAirlineNameFromCode(code = "") {
      return DETAIL_AIRLINE_BY_CODE[normalizeDetailAirlineCode(code)] || "";
    }

    function getDetailAirlineCodeFromName(name = "") {
      const normalized = normalizeDetailAirlineName(name);
      return DETAIL_AIRLINE_CODE_BY_NAME[normalized] || "";
    }

    function getDetailAirlineCodeFromProductTitle(title = "") {
      const source = cleanSecretTourDetailText(title);
      const packMatch = source.match(/\[\s*항공팩\s*[-–—]\s*([^\]]+)\]/i);
      const packText = cleanSecretTourDetailText(packMatch?.[1] || "");
      const codeMatch = packText.match(/([A-Za-z0-9]{2})\s*$/);
      return normalizeDetailAirlineCode(codeMatch?.[1] || "");
    }

    function extractDetailFlightCode(text = "") {
      const match = DETAIL_AIRLINE_CODE_PATTERN.exec(String(text || ""));
      return match ? match[0].replace(/\s+/g, "").toUpperCase() : "";
    }

    function extractDetailAirlineName(text = "") {
      const source = cleanSecretTourDetailText(text);
      const labeled = source.match(/항공\s*[:：]\s*([^\n\[]+)/)?.[1] || "";
      const matched = labeled || source.match(/(대한항공|아시아나항공?|제주항공|진에어|티웨이항공?|에어서울|에어부산|이스타항공|에어프레미아|사천항공|베트남항공|비엣젯항공|타이항공|싱가포르항공|캐세이퍼시픽|중화항공|에바항공|중국동방항공|중국남방항공|중국국제항공|상하이항공|말레이시아항공|필리핀항공|세부퍼시픽|스쿠트항공|[가-힣A-Za-z]+항공)/)?.[1] || "";
      const name = cleanSecretTourDetailText(matched).replace(/\s*\[.*$/, "").trim();
      if (!name) return "";
      if (name === "아시아나") return "아시아나항공";
      if (name === "티웨이") return "티웨이항공";
      return name;
    }

    function parseFlightScheduleItem(item = {}, fallbackLabel = "") {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const rawText = cleanSecretTourDetailText([
          item.text,
          item.raw,
          item.rawText,
          item.airline,
          item.airlineName,
          item.airlineNm,
          item.route,
          item.departureAirport,
          item.departureCity,
          item.arrivalAirport,
          item.arrivalCity
        ].filter(Boolean).join(" "));
        const routePlaces = extractFlightRoutePlaces(rawText);
        const rawDates = extractFlightDateParts(rawText);
        const rawTimes = extractFlightTimeParts(rawText);
        const directCode = extractDetailFlightCode([
          item.code,
          item.flightCode,
          item.flightNo,
          item.flightNumber,
          rawText
        ].filter(Boolean).join(" "));
        const departureTime = item.fromTime || item.departureClock || item.depTime || item.departureTime || rawTimes[0] || "";
        const arrivalTime = item.toTime || item.arrivalClock || item.arrTime || item.arrivalTime || rawTimes[1] || "";
        const labelText = item.label || item.type || fallbackLabel;
        return {
          label: labelText,
          time: item.time || item.dateTime || item.datetime || "",
          airline: item.airline || item.airlineName || item.airlineNm || extractDetailAirlineName(rawText) || getDetailAirlineNameFromCode(item.code || item.flightCode || item.flightNo || item.flightNumber || ""),
          code: directCode,
          fromCity: item.fromCity || item.departureCity || item.departureAirport || routePlaces[0] || "",
          toCity: item.toCity || item.arrivalCity || item.arrivalAirport || routePlaces[1] || "",
          fromDate: item.fromDate || item.departureDate || rawDates[0] || "",
          toDate: item.toDate || item.arrivalDate || rawDates[1] || rawDates[0] || "",
          fromTime: departureTime || item.departureTime || "",
          toTime: arrivalTime || item.arrivalTime || ""
        };
      }
      const text = cleanSecretTourDetailText(item);
      const flightCode = extractDetailFlightCode(text);
      const airlineName = extractDetailAirlineName(text) || getDetailAirlineNameFromCode(flightCode);
      const timeParts = extractFlightTimeParts(text);
      const dateParts = extractFlightDateParts(text);
      const routePlaces = extractFlightRoutePlaces(text);
      return {
        label: /도착|귀국|복항|인천\s*도착/.test(text) ? "도착" : /출발|출국|왕항/.test(text) ? "출발" : fallbackLabel,
        time: [dateParts[0], timeParts[0]].filter(Boolean).join(" "),
        airline: airlineName,
        code: flightCode,
        fromCity: routePlaces[0] || "",
        toCity: routePlaces[1] || "",
        fromDate: dateParts[0] || "",
        toDate: dateParts[1] || dateParts[0] || "",
        fromTime: timeParts[0] || "",
        toTime: timeParts[1] || ""
      };
    }

    function renderFlightSegment(label, segment = {}, dateString = "") {
      const timeText = getFlightTimeWithDateFallback(segment, dateString);
      return `
        <div class="flight-segment">
          <div class="flight-label">${label}</div>
          ${renderFlightTime(timeText)}
          <div class="flight-airline">${segment.airline || ""}</div>
          <div class="flight-code">${segment.code || ""}</div>
        </div>
      `;
    }

    function renderFlightInfo(join, options = {}) {
      const flight = getFlightInfo(join, options);
      if (!flight) return "";
      const rawItems = flight.items || [];
      const departure = parseFlightScheduleItem(rawItems[0], "출발");
      const arrival = parseFlightScheduleItem(rawItems[1], "도착");
      const departureTime = getFlightTimeWithDateFallback(departure, join.departureDate);
      const arrivalTime = getFlightTimeWithDateFallback(arrival, join.returnDate || join.departureDate);
      const hasVisibleFlightInfo = Boolean(departureTime || arrivalTime || [departure, arrival].some((segment) => segment.airline || segment.code));
      return `
        <div class="flight-info-card${hasVisibleFlightInfo ? "" : " is-flight-placeholder"}">
          ${renderFlightSegment("출발", departure, join.departureDate)}
          <div class="flight-duration">${formatTripDuration(join)}</div>
          ${renderFlightSegment("도착", arrival, join.returnDate || join.departureDate)}
        </div>
      `;
    }

    function renderDetailPeriod(join) {
      if (join.category === "해외") return "";
      return `
        <div class="detail-period-card">
          <div class="detail-label">기간</div>
          <div class="detail-period-row">
            <div class="detail-value">${formatDetailDateWithDay(join.departureDate)}</div>
            <div class="detail-period-arrow">→</div>
            <div class="detail-value">${formatDetailDateWithDay(join.returnDate || join.departureDate)}</div>
            <div class="detail-period-duration">${formatTripDuration(join)}</div>
          </div>
        </div>
      `;
    }

    function getBuilderDateSummaryParts() {
      const month = builderState.viewMonth + 1;
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const lastDate = new Date(builderState.viewYear, builderState.viewMonth + 1, 0).getDate();
      const clampDay = (day) => Math.max(1, Math.min(lastDate, day));
      const formatDay = (day) => {
        const clamped = clampDay(day);
        const date = new Date(builderState.viewYear, builderState.viewMonth, clamped);
        return `${month}.${clamped}(${weekdays[date.getDay()]})`;
      };
      const formatRange = (day, before, after) => {
        if (!Number.isFinite(day)) return "선택 전";
        const min = clampDay(day - before);
        const max = clampDay(day + after);
        return min === max ? formatDay(min) : `${formatDay(min)} - ${formatDay(max)}`;
      };
      const hasStart = Number.isFinite(builderState.startDay);
      const hasEnd = Number.isFinite(builderState.endDay);
      let duration = "선택 전";
      if (hasStart && hasEnd) {
        const startMin = clampDay(builderState.startDay - builderState.startBefore);
        const startMax = clampDay(builderState.startDay + builderState.startAfter);
        const endMin = clampDay(builderState.endDay - builderState.endBefore);
        const endMax = clampDay(builderState.endDay + builderState.endAfter);
        const minDays = Math.max(1, endMin - startMax + 1);
        const maxDays = Math.max(minDays, endMax - startMin + 1);
        duration = minDays === maxDays ? `${minDays}일` : `${minDays}일 - ${maxDays}일`;
      }
      return {
        start: formatRange(builderState.startDay, builderState.startBefore, builderState.startAfter),
        end: formatRange(builderState.endDay, builderState.endBefore, builderState.endAfter),
        duration
      };
    }

    function renderBuilderDetailPeriod() {
      const summary = getBuilderDateSummaryParts();
      return `
        <div class="detail-period-card builder-detail-period-card">
          <div class="builder-detail-period-item">
            <div class="detail-label">출발일</div>
            <div class="detail-period-row">${summary.start}</div>
          </div>
          <div class="builder-detail-period-item">
            <div class="detail-label">도착일</div>
            <div class="detail-period-row">${summary.end}</div>
          </div>
          <div class="builder-detail-period-item">
            <div class="detail-label">여행기간</div>
            <div class="detail-period-row">${summary.duration}</div>
          </div>
        </div>
      `;
    }

    function renderDetailNoteItem(item) {
      const text = typeof item === "object" && item !== null ? item.text : item;
      const dot = `<svg xmlns="http://www.w3.org/2000/svg" class="detail-list-dot" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle></svg>`;
      return `
        <li>
          <div class="detail-list-item">${dot}<div class="detail-list-text">${escapeHtml(text || "")}</div></div>
        </li>
      `;
    }

    function dedupeDetailNotes(notes = []) {
      const seen = new Set();
      return (Array.isArray(notes) ? notes : [notes]).filter((item) => {
        const text = typeof item === "object" && item !== null ? item.text : item;
        const key = String(text || "").normalize("NFKC").replace(/\s+/g, " ").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function renderDetailNotes(notes = []) {
      const uniqueNotes = dedupeDetailNotes(notes);
      const isCollapsible = uniqueNotes.length >= 4;
      return `
        <div class="detail-note-card${isCollapsible ? " collapsible" : ""}">
          <ul class="detail-list">
            ${uniqueNotes.map(renderDetailNoteItem).join("")}
          </ul>
          ${isCollapsible ? `<button type="button" class="detail-note-toggle" onclick="toggleDetailNotes(this)" aria-label="참고사항 펼치기"></button>` : ""}
        </div>
      `;
    }

    function toggleDetailNotes(button) {
      const card = button.closest(".detail-note-card");
      if (!card) return;
      card.classList.toggle("expanded");
    }

    function formatScheduleDate(join, index) {
      const date = new Date(join.departureDate + "T00:00:00");
      date.setDate(date.getDate() + index);
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}(${dayNames[date.getDay()]})`;
    }

    function splitScheduleItems(content) {
      const protectedSlashToken = "__SCHEDULE_SLASH__";
      const protectedContent = String(content || "").replace(
        /([가-힣A-Za-z0-9]+(?:\/[가-힣A-Za-z0-9]+){2,})(?=\s*골프장\s*중\s*한\s*곳)/g,
        (match) => match.replace(/\//g, protectedSlashToken)
      );
      return protectedContent
        .split(/,\s*|및|\/|·/)
        .map((item) => item.replaceAll(protectedSlashToken, "/").trim())
        .filter(Boolean);
    }

    function getScheduleExtraInfo(join, index) {
      const scheduleExtra = join.schedule?.[index]?.extra || {};
      return {
        hotel: scheduleExtra.hotel || "",
        meals: Array.isArray(scheduleExtra.meals) ? scheduleExtra.meals : []
      };
    }

    function renderScheduleExtraInfo(join, index) {
      const extra = getScheduleExtraInfo(join, index);
      const hotel = cleanSecretTourDetailText(extra.hotel);
      const meals = extra.meals
        .map((meal) => ({
          label: cleanSecretTourDetailText(meal?.label),
          menu: cleanSecretTourDetailText(meal?.menu)
        }))
        .filter((meal) => meal.label || meal.menu);
      if (!hotel && !meals.length) return "";
      return `
        <div class="detail-schedule-extra">
          ${hotel ? `<div class="detail-schedule-extra-row">
            <div class="detail-schedule-extra-icon hotel" aria-hidden="true"></div>
            <div class="detail-schedule-extra-title">${escapeHtml(hotel)}</div>
          </div>` : ""}
          ${meals.length ? `<div class="detail-schedule-extra-row">
            <div class="detail-schedule-extra-icon meal" aria-hidden="true"></div>
            <div class="detail-meal-list">
              ${meals.map((meal) => `<div class="detail-meal-item"><div class="detail-meal-label">${escapeHtml(meal.label)}</div><div class="detail-meal-menu">${escapeHtml(meal.menu)}</div></div>`).join("")}
            </div>
          </div>` : ""}
        </div>
      `;
    }

    function renderDetailSchedule(join) {
      const schedule = join.schedule || [];
      return `
        <div class="detail-schedule-day-nav" role="tablist" aria-label="상세일정 일차 선택">
          ${schedule.map((item, index) => `<button type="button" class="detail-schedule-day-chip${index === 0 ? " active" : ""}" role="tab" aria-selected="${index === 0 ? "true" : "false"}" onclick="selectDetailScheduleDay(${index})">${escapeHtml(item.day || `${index + 1}일차`)}</button>`).join("")}
        </div>
        <div class="detail-schedule is-flat">
          ${schedule.map((item, index) => {
            return `
            <div class="detail-schedule-item open" data-schedule-index="${index}">
              <div class="detail-schedule-row">
                <div class="detail-schedule-day">${escapeHtml(item.day || `${index + 1}일차`)}<div class="detail-schedule-date">${escapeHtml(item.dateText || formatScheduleDate(join, index))}</div></div>
                <div class="detail-schedule-copy">
                  <div class="detail-schedule-timeline">
                    ${splitScheduleItems(item.content).map((part) => `<div class="detail-schedule-point">${escapeHtml(part)}</div>`).join("")}
                  </div>
                  ${renderScheduleExtraInfo(join, index)}
                </div>
              </div>
            </div>
          `;
          }).join("")}
        </div>
      `;
    }

    function getSheetDetailReviews(join) {
      const keys = getJoinReviewProductKeys(join);
      return Array.from(joinReviewPayloadMemory.values())
        .map(normalizeJoinReviewPayload)
        .filter((review) => String(review.status || "visible") !== "hidden")
        .filter((review) => {
          const product = {
            id: review.product.erpProductId,
            erpProductId: review.product.erpProductId,
            erpEventSeq: review.product.erpEventSeq,
            title: review.product.productName
          };
          const reviewKeys = getJoinReviewProductKeys(product);
          return Array.from(reviewKeys).some((key) => keys.has(key));
        })
        .filter((review, index, list) => {
          return list.findIndex((item) => item.reviewId === review.reviewId) === index;
        })
        .map((review) => ({
          stars: "★".repeat(Math.max(1, Math.min(5, Number(review.review.rating || 5)))),
          rating: Number(review.review.rating || 5),
          time: review.submittedAt || review.updatedAt || "",
          text: review.review.text || "",
          product: review.product.productName || join.title,
          author: maskJoinReviewAuthor(review.member.memberName),
          image: review.review.thumbnailUrl || review.review.imageUrl || "",
          count: review.review.images?.length > 1 ? `${review.review.images.length}+` : (review.review.imageUrl ? "1" : ""),
          source: "sheet"
        }))
        .filter((review) => review.text);
    }

    function getDetailReviews(join) {
      return getSheetDetailReviews(join);
    }

    function renderDetailReviewStars(review) {
      const count = Math.max(1, Math.min(5, Number(review?.rating || 0) || String(review?.stars || "").replace(/[^★]/g, "").length || 5));
      const star = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" class="mrt-web-icons" color="#ffbf00" aria-hidden="true"><path d="M11.439 2.999a.626.626 0 0 1 1.122 0l2.51 5.087a.626.626 0 0 0 .472.342l5.614.816a.626.626 0 0 1 .347 1.067l-4.063 3.96a.625.625 0 0 0-.18.554l.96 5.592a.626.626 0 0 1-.908.66l-5.022-2.64a.626.626 0 0 0-.582 0l-5.022 2.64a.626.626 0 0 1-.908-.66l.96-5.592a.626.626 0 0 0-.18-.553l-4.063-3.96a.626.626 0 0 1 .347-1.068l5.614-.816a.626.626 0 0 0 .471-.342L11.44 3Z"></path></svg>`;
      return `<div class="detail-review-stars" aria-label="별점 ${count}점">${Array.from({ length: count }).map(() => star).join("")}</div>`;
    }

    function formatDetailReviewDate(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    }

    function isSameDetailReviewDate(a, b) {
      return a instanceof Date
        && b instanceof Date
        && !Number.isNaN(a.getTime())
        && !Number.isNaN(b.getTime())
        && a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
    }

    function parseDetailReviewDate(value) {
      const raw = String(value || "").trim();
      if (!raw) return null;
      const dateMatch = raw.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
      if (dateMatch) {
        return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]));
      }
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDetailReviewTime(review = {}) {
      const raw = String(review.time || review.date || review.createdAt || "").trim();
      const dayAgoMatch = raw.match(/^(\d+)\s*일\s*전$/);
      if (dayAgoMatch) {
        const daysAgo = Number(dayAgoMatch[1]);
        if (daysAgo === 0) return "오늘";
        if (daysAgo <= 7) return raw;
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - daysAgo);
        return formatDetailReviewDate(date);
      }
      const date = parseDetailReviewDate(raw);
      if (isSameDetailReviewDate(date, new Date())) return "오늘";
      return formatDetailReviewDate(date) || raw;
    }

    function getDetailReviewSortTime(review = {}) {
      const raw = String(review.time || review.date || review.createdAt || "").trim();
      const dayAgoMatch = raw.match(/^(\d+)\s*일\s*전$/);
      if (dayAgoMatch) {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - Number(dayAgoMatch[1]));
        return date.getTime();
      }
      const date = parseDetailReviewDate(raw);
      return date ? date.getTime() : 0;
    }

    function sortDetailReviewsLatest(reviews = []) {
      return [...reviews].sort((a, b) => getDetailReviewSortTime(b) - getDetailReviewSortTime(a));
    }

    function renderDetailReviewCard(review, options = {}) {
      const cloneAttr = options.clone ? ` data-review-clone="true" aria-hidden="true"` : "";
      const reviewTime = formatDetailReviewTime(review);
      return `
        <div class="detail-review-card"${cloneAttr}>
          <div class="detail-review-head">
            ${renderDetailReviewStars(review)}
            <div class="detail-review-time">${escapeHtml(reviewTime)}</div>
            <div class="detail-review-author">${escapeHtml(review.author)}</div>
          </div>
          <div class="detail-review-text">${escapeHtml(review.text)}</div>
          <div class="detail-review-thumb-wrap">
            <img class="detail-review-thumb" src="${escapeHtml(review.image)}" alt="${escapeHtml(review.product)} 후기 이미지">
            ${review.count ? `<div class="detail-review-more">${escapeHtml(review.count)}</div>` : ""}
          </div>
        </div>
      `;
    }

    function renderDetailReviews(join) {
      const reviews = sortDetailReviewsLatest(getDetailReviews(join));
      if (!reviews.length) return "";
      if (reviews.length <= 1) return renderDetailReviewCard(reviews[0]);
      const isMobile = window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
      const isInfinite = !isMobile && reviews.length >= 2;
      const reviewCards = isInfinite
        ? [renderDetailReviewCard(reviews[reviews.length - 1], { clone: true }), ...reviews.map(renderDetailReviewCard), renderDetailReviewCard(reviews[0], { clone: true })]
        : reviews.map(renderDetailReviewCard);
      return `
        <div class="detail-review-carousel" data-review-carousel data-review-count="${reviews.length}" data-review-infinite="${isInfinite ? "true" : "false"}" onscroll="handleDetailReviewScroll(this)">
          ${reviewCards.join("")}
        </div>
      `;
    }

    function hasDetailReviews(join) {
      return getDetailReviews(join).length > 0;
    }

    function renderDetailPlaceSection(join) {
      const introImages = getDetailIntroImages(join);
      return `
        <div class="detail-section" data-detail-section="place">
          <div class="detail-section-heading">시설정보</div>
          <div class="detail-place-gallery" aria-label="상품소개 이미지">
            ${introImages.map((image, index) => `<img class="detail-place-photo" src="${image}" alt="${escapeHtml(join.title)} 상품소개 이미지 ${index + 1}">`).join("")}
          </div>
        </div>
      `;
    }

    function renderDetailReviewSection(join) {
      if (!hasDetailReviews(join)) return "";
      return `
        <div class="detail-section" data-detail-section="review">
          <div class="detail-section-heading">여행후기</div>
          ${renderDetailReviews(join)}
        </div>
      `;
    }

    function updateBuilderRegionDisplay() {
      const label = builderState.region || "선택 전";
      const selected = document.getElementById("builderSelectedRegion");
      const button = document.getElementById("builderRegionButton");
      const summary = document.getElementById("builderRegionSummary");
      const regions = (builderState.regions && builderState.regions.length)
        ? builderState.regions
        : (builderState.region ? builderState.region.split(/\s*,\s*(?=[^,]+,\s*[^,]+(?:,|$))/).filter(Boolean) : []);
      if (summary) {
        summary.textContent = regions.length ? regions.map(formatRegionDisplayName).join(", ") : label;
      }
      if (selected) {
        selected.innerHTML = regions.length
          ? regions.map((name) => `<button type="button" class="region-selected-item" onclick="selectBuilderEmbeddedRegion('${name.replace(/'/g, "\\'")}')">${formatRegionDisplayHtml(name)} <span aria-hidden="true">×</span></button>`).join("")
          : "선택 지역: 선택 전";
      }
      if (button) {
        if (regions.length) {
          button.innerHTML = regions.map((name) => `<div class="builder-region-display">${formatRegionDisplayHtml(name)}</div>`).join("");
          button.setAttribute("aria-label", regions.map(formatRegionDisplayName).join(", "));
        } else {
          button.textContent = "태국 / 베트남 / 일본 / 제주 검색";
          button.setAttribute("aria-label", "지역 검색");
        }
      }
      updateBuilderProgressState();
    }

    function renderDetailScheduleTabs(join) {
      return `
        <div class="detail-section" data-detail-section="schedule">
          <div class="detail-section-heading">상세일정</div>
          ${renderDetailSchedule(join)}
        </div>
        ${renderDetailPlaceSection(join)}
        ${renderDetailReviewSection(join)}
        ${renderDetailSafetyInfo()}
      `;
    }

    function toggleDetailSchedule(button) {
      const item = button.closest(".detail-schedule-item");
      if (!item) return;
      selectDetailScheduleDay(Number(item.dataset.scheduleIndex || 0));
    }

    function selectDetailScheduleDay(index) {
      const detail = document.getElementById("detailContent");
      const targetIndex = Number(index) || 0;
      const target = detail?.querySelector(`.detail-schedule-item[data-schedule-index="${targetIndex}"]`);
      const nav = detail?.querySelector(".detail-schedule-day-nav");
      if (!detail || !target) return;
      if (nav) nav.dataset.forcedActiveIndex = String(targetIndex);
      detail?.querySelectorAll(".detail-schedule-day-chip").forEach((chip, chipIndex) => {
        const active = chipIndex === targetIndex;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-selected", active ? "true" : "false");
      });
      ensureDetailScheduleDayChipVisible(nav, targetIndex);
      const detailRect = detail.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const anchorBottom = navRect ? navRect.bottom : detailRect.top;
      detail.scrollTo({
        top: Math.max(0, detail.scrollTop + targetRect.top - anchorBottom - 12),
        behavior: "smooth"
      });
    }

    function ensureDetailScheduleDayChipVisible(nav, activeIndex = 0) {
      if (!nav) return;
      const chips = Array.from(nav.querySelectorAll(".detail-schedule-day-chip"));
      const activeChip = chips[activeIndex];
      if (!activeChip) return;
      const nextChip = chips[Math.min(chips.length - 1, activeIndex + 1)] || activeChip;
      const navRect = nav.getBoundingClientRect();
      const activeRect = activeChip.getBoundingClientRect();
      const nextRect = nextChip.getBoundingClientRect();
      const leftPadding = 8;
      const rightPadding = 8;
      let nextScrollLeft = nav.scrollLeft;
      if (activeRect.left - leftPadding < navRect.left) {
        nextScrollLeft -= navRect.left - activeRect.left + leftPadding;
      } else if (nextRect.right + rightPadding > navRect.right) {
        nextScrollLeft += nextRect.right - navRect.right + rightPadding;
      }
      nextScrollLeft = Math.max(0, Math.min(nav.scrollWidth - nav.clientWidth, nextScrollLeft));
      if (Math.abs(nextScrollLeft - nav.scrollLeft) > 1) {
        nav.scrollLeft = nextScrollLeft;
      }
    }

    function prepareDetailScheduleHeights(options = {}) {
      const forceOpen = Boolean(options.forceOpen);
      if (forceOpen) {
        const items = [...document.querySelectorAll("#detailContent .detail-schedule-item")];
        items.forEach((item) => {
          item.classList.add("open");
        });
      }
      document.querySelectorAll("#detailContent .detail-schedule-item .detail-schedule-copy").forEach((copy) => {
        copy.style.setProperty("--schedule-open-height", `${copy.scrollHeight}px`);
      });
    }

    function switchDetailContentTab(button, tabName) {
      const section = button.closest("[data-detail-section='schedule']");
      if (!section) return;
      section.querySelectorAll(".detail-content-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.detailTab === tabName);
      });
      section.querySelectorAll(".detail-tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.detailTabPanel === tabName);
      });
      if (tabName === "review") {
        startDetailReviewAutoSlide();
      } else {
        stopDetailReviewAutoSlide();
      }
    }

    function switchDetailPlaceTab(button, tabName) {
      const section = button.closest("[data-detail-section='place']");
      if (!section) return;
      section.querySelectorAll(".detail-content-tab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.detailTab === tabName);
      });
      section.querySelectorAll(".detail-tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.detailTabPanel === tabName);
      });
    }

    function stopDetailReviewAutoSlide() {
      clearInterval(detailReviewAutoTimer);
      detailReviewAutoTimer = null;
      clearTimeout(detailReviewResetTimer);
      detailReviewResetTimer = null;
    }

    function startDetailReviewAutoSlide() {
      stopDetailReviewAutoSlide();
      if (window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640) return;
      const carousel = document.querySelector("#detailContent [data-review-carousel][data-review-infinite='true']");
      if (!carousel) return;
      requestAnimationFrame(() => {
        const step = getDetailReviewCarouselStep(carousel);
        if (step > 0 && !carousel.dataset.reviewInitialized) {
          carousel.dataset.reviewInitialized = "true";
          carousel.style.scrollBehavior = "auto";
          carousel.scrollLeft = step;
          carousel.style.scrollBehavior = "";
        }
      });
    }

    function handleDetailReviewScroll(carousel) {
      if (!carousel) return;
      clearTimeout(detailReviewResetTimer);
      if (window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640) return;
      if (carousel.dataset.reviewInfinite !== "true") return;
      detailReviewResetTimer = setTimeout(() => normalizeDetailReviewInfiniteScroll(carousel), 120);
    }

    function getDetailReviewCarouselStep(carousel) {
      const firstCard = carousel?.querySelector(".detail-review-card");
      if (!firstCard) return 0;
      const gap = Number.parseFloat(getComputedStyle(carousel).columnGap || getComputedStyle(carousel).gap || "0") || 0;
      return firstCard.getBoundingClientRect().width + gap;
    }

    function normalizeDetailReviewInfiniteScroll(carousel) {
      const count = Number(carousel?.dataset.reviewCount || 0);
      if (!carousel || count < 2) return;
      const step = getDetailReviewCarouselStep(carousel);
      if (!step) return;
      const left = carousel.scrollLeft;
      if (left <= step * 0.5) {
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = step * count;
        carousel.style.scrollBehavior = "";
      } else if (left >= step * (count + 0.5)) {
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = step;
        carousel.style.scrollBehavior = "";
      }
    }

    function handleDetailScheduleKey(event, row) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleDetailSchedule(row);
    }

    function getDetailAnchorScrollOffset(body, tabs) {
      if (!body || !tabs) return 0;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const headingGap = isMobile ? 16 : 8;
      const tabHeight = tabs.offsetHeight || 0;
      const bodyRect = body.getBoundingClientRect();
      const tabsRect = tabs.getBoundingClientRect();
      const isFixed = tabs.classList.contains("is-mobile-fixed") || getComputedStyle(tabs).position === "fixed";
      if (isFixed && tabsRect.height) {
        return Math.max(0, tabsRect.bottom - bodyRect.top + headingGap);
      }
      if (!isMobile) {
        const styles = getComputedStyle(tabs);
        const stickyTop = styles.position === "sticky" ? (Number.parseFloat(styles.top) || 0) : 0;
        return Math.max(0, tabHeight + stickyTop + headingGap);
      }
      return 56 + tabHeight + headingGap;
    }

    function getDetailSectionMarginRectTop(section) {
      if (!section) return Number.POSITIVE_INFINITY;
      return section.getBoundingClientRect().top;
    }

    function getDetailSectionTargetScrollTop(body, section, stickyOffset) {
      if (!body || !section) return 0;
      const bodyTop = body.getBoundingClientRect().top;
      const sectionTop = getDetailSectionMarginRectTop(section);
      return Math.max(0, body.scrollTop + sectionTop - bodyTop - stickyOffset);
    }

    function getDetailAnchorActivationLine(body, tabs) {
      if (!body) return 0;
      if (!tabs || !tabs.classList.contains("is-visible") || tabs.classList.contains("is-suppressed")) {
        return body.getBoundingClientRect().top;
      }
      return tabs.getBoundingClientRect().bottom;
    }

    function syncDetailAnchorTabsSpacer(body, tabs) {
      const spacer = body?.querySelector(".detail-anchor-tabs-spacer");
      if (!body || !tabs || !spacer) return;
      const isActive = window.matchMedia("(max-width: 640px)").matches && tabs.classList.contains("is-mobile-fixed");
      spacer.classList.toggle("is-active", isActive);
      spacer.style.height = isActive ? `${Math.max(0, (tabs.offsetHeight || 0) + 15)}px` : "0px";
    }

    function scrollDetailSection(sectionName) {
      const body = document.getElementById("detailContent");
      const target = body?.querySelector(`[data-detail-section="${sectionName}"]`);
      const tabs = body?.querySelector(".detail-anchor-tabs");
      if (!body || !target) return;

      clearTimeout(detailAnchorForcedActiveTimer);
      if (tabs) {
        tabs.dataset.pinnedVisible = "true";
        tabs.dataset.forcedActive = sectionName;
        tabs.classList.remove("is-suppressed");
        if (window.matchMedia("(max-width: 640px)").matches) {
          tabs.classList.add("is-visible", "is-mobile-fixed");
          body.classList.add("detail-anchor-tabs-fixed");
          syncDetailAnchorTabsSpacer(body, tabs);
        }
      }
      body.querySelectorAll(".detail-anchor-chip").forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.anchorTarget === sectionName);
      });
      syncDetailAnchorIndicator(tabs, sectionName);

      tabs?.classList.add("is-visible");
      const stickyOffset = getDetailAnchorScrollOffset(body, tabs);
      body.scrollTo({
        top: getDetailSectionTargetScrollTop(body, target, stickyOffset),
        behavior: "smooth"
      });
      detailAnchorForcedActiveTimer = window.setTimeout(() => {
        updateDetailAnchorTabs();
      }, 900);
    }

    function updateDetailAnchorTabs() {
      const body = document.getElementById("detailContent");
      const tabs = body?.querySelector(".detail-anchor-tabs");
      const summary = body?.querySelector('[data-detail-section="summary"]');
      if (!body || !tabs || !summary) return;

      if (window.matchMedia("(max-width: 640px)").matches) {
        tabs.classList.add("is-visible");
        tabs.classList.remove("is-suppressed");
        const mobileHeaderHeight = 56;
        if (!tabs.classList.contains("is-mobile-fixed")) {
          const bodyRect = body.getBoundingClientRect();
          const tabsRect = tabs.getBoundingClientRect();
          const naturalTop = tabsRect.top - bodyRect.top + body.scrollTop;
          if (naturalTop > 0) tabs.dataset.mobileFixedAt = String(naturalTop);
        }
        const fixedAt = Number(tabs.dataset.mobileFixedAt || 0);
        const headerVisible = body.classList.contains("detail-mobile-sticky-visible");
        const shouldFix = headerVisible && fixedAt > mobileHeaderHeight && body.scrollTop >= fixedAt - mobileHeaderHeight;
        tabs.classList.toggle("is-mobile-fixed", shouldFix);
        body.classList.toggle("detail-anchor-tabs-fixed", shouldFix);
        syncDetailAnchorTabsSpacer(body, tabs);
      } else {
        tabs.classList.remove("is-mobile-fixed");
        body.classList.remove("detail-anchor-tabs-fixed");
        syncDetailAnchorTabsSpacer(body, tabs);
        const threshold = Number(tabs.dataset.showAt || summary.offsetTop);
        tabs.classList.toggle("is-visible", tabs.dataset.pinnedVisible === "true" || body.scrollTop >= threshold);
      }

      let activeSection = tabs.dataset.forcedActive || "summary";
      const sectionNames = Array.from(body.querySelectorAll(".detail-anchor-chip"))
        .map((chip) => chip.dataset.anchorTarget)
        .filter(Boolean);
      if (!tabs.dataset.forcedActive) {
        const activationLine = getDetailAnchorActivationLine(body, tabs);
        sectionNames.forEach((sectionName) => {
          const section = body.querySelector(`[data-detail-section="${sectionName}"]`);
          if (section && getDetailSectionMarginRectTop(section) <= activationLine + 1) {
            activeSection = sectionName;
          }
        });
        const lastSectionName = sectionNames[sectionNames.length - 1];
        if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4 && lastSectionName) {
          tabs.classList.add("is-visible");
          activeSection = lastSectionName;
        }
      }
      body.querySelectorAll(".detail-anchor-chip").forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.anchorTarget === activeSection);
      });
      syncDetailAnchorIndicator(tabs, activeSection);
      syncDetailAnchorTabsScroll(tabs, activeSection);
    }

    function syncDetailAnchorIndicator(tabs, activeSection = "") {
      if (!tabs) return;
      const activeChip = activeSection
        ? tabs.querySelector(`.detail-anchor-chip[data-anchor-target="${activeSection}"]`)
        : tabs.querySelector(".detail-anchor-chip.active");
      if (!activeChip) {
        tabs.style.setProperty("--detail-anchor-indicator-opacity", "0");
        return;
      }
      tabs.style.setProperty("--detail-anchor-indicator-left", `${activeChip.offsetLeft}px`);
      tabs.style.setProperty("--detail-anchor-indicator-width", `${activeChip.offsetWidth}px`);
      tabs.style.setProperty("--detail-anchor-indicator-opacity", "1");
    }

    function syncDetailAnchorTabsScroll(tabs, activeSection) {
      if (!tabs || !window.matchMedia("(max-width: 640px)").matches) return;
      const activeChip = tabs.querySelector(`.detail-anchor-chip[data-anchor-target="${activeSection}"]`);
      if (!activeChip) return;
      const chips = Array.from(tabs.querySelectorAll(".detail-anchor-chip"));
      const activeIndex = chips.indexOf(activeChip);
      const maxScrollLeft = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
      let targetLeft = tabs.scrollLeft;
      if (activeIndex <= 1) {
        targetLeft = 0;
      } else if (activeIndex >= chips.length - 2) {
        targetLeft = maxScrollLeft;
      } else {
        const visibleStart = tabs.scrollLeft;
        const visibleEnd = visibleStart + tabs.clientWidth;
        const chipStart = activeChip.offsetLeft;
        const chipEnd = chipStart + activeChip.offsetWidth;
        if (chipStart < visibleStart + 8) {
          targetLeft = Math.max(0, chipStart - 22);
        } else if (chipEnd > visibleEnd - 8) {
          targetLeft = Math.max(0, chipEnd - tabs.clientWidth + 22);
        }
      }
      targetLeft = Math.max(0, Math.min(maxScrollLeft, targetLeft));
      if (Math.abs(tabs.scrollLeft - targetLeft) > 2) {
        tabs.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
    }

    function maybeShowDetailParticipantTooltip() {
      const body = document.getElementById("detailContent");
      const tooltip = body?.querySelector(".detail-participant-info-bubble");
      const price = body?.querySelector(".detail-price-value");
      if (!body || !tooltip || !price || tooltip.dataset.shown === "true") return;
      const detailModal = document.getElementById("detailModal");
      const header = detailModal?.querySelector(".modal-header");
      const bodyRect = body.getBoundingClientRect();
      const headerRect = header && getComputedStyle(header).display !== "none" ? header.getBoundingClientRect() : null;
      const triggerTop = (headerRect?.bottom || bodyRect.top) + 12;
      const priceRect = price.getBoundingClientRect();
      if (priceRect.top > triggerTop || priceRect.bottom < triggerTop - 48) return;
      const card = tooltip.closest(".detail-participant-status-card");
      const team = card?.querySelector(".detail-team");
      const firstSlot = team?.querySelector(".team-avatar-wrap, .team-empty");
      if (card && team) {
        const cardRect = card.getBoundingClientRect();
        const teamRect = team.getBoundingClientRect();
        const slotRect = firstSlot?.getBoundingClientRect();
        const top = Math.max(0, teamRect.bottom - cardRect.top + 8);
        const left = Math.max(12, (slotRect ? slotRect.left : teamRect.left) - cardRect.left);
        tooltip.style.setProperty("--detail-participant-bubble-top", `${top}px`);
        tooltip.style.setProperty("--detail-participant-bubble-left", `${left}px`);
      }
      tooltip.dataset.shown = "true";
      tooltip.classList.add("is-visible");
      clearTimeout(detailParticipantTooltipTimer);
      detailParticipantTooltipTimer = setTimeout(() => {
        tooltip.classList.remove("is-visible");
      }, 5000);
    }

    function updateDetailMobileStickyHeader() {
      const body = document.getElementById("detailContent");
      const header = body?.querySelector(".detail-mobile-sticky-header");
      const contentSheet = body?.querySelector(".detail-content-sheet");
      if (!body || !header || !contentSheet) return;
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      if (!isMobile) {
        header.classList.remove("is-visible");
        body.classList.remove("detail-mobile-sticky-visible");
        header.setAttribute("aria-hidden", "true");
        return;
      }
      const bodyRect = body.getBoundingClientRect();
      const sheetRect = contentSheet.getBoundingClientRect();
      const sheetScrollTop = sheetRect.top - bodyRect.top + body.scrollTop;
      const visible = body.scrollTop >= Math.max(1, sheetScrollTop - 1);
      header.classList.toggle("is-visible", visible);
      body.classList.toggle("detail-mobile-sticky-visible", visible);
      header.setAttribute("aria-hidden", visible ? "false" : "true");
    }

    function updateDetailScheduleDayNav() {
      const body = document.getElementById("detailContent");
      const nav = body?.querySelector(".detail-schedule-day-nav");
      const items = body ? Array.from(body.querySelectorAll(".detail-schedule-item")) : [];
      if (!body || !nav || !items.length) return;

      const bodyRect = body.getBoundingClientRect();
      const navTop = Number.parseFloat(getComputedStyle(nav).top) || 0;
      const navRect = nav.getBoundingClientRect();
      const stickyLine = bodyRect.top + navTop;
      const isPinned = navRect.top <= stickyLine + 1 && navRect.bottom > stickyLine + 1;
      const tabs = body.querySelector(".detail-anchor-tabs");
      const forcedTarget = tabs?.dataset.forcedActive || "";
      const nextSection = body.querySelector('[data-detail-section="place"]');
      const nextSectionTop = nextSection ? nextSection.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
      const shouldHideNav = nextSectionTop <= stickyLine + 1 || (forcedTarget && forcedTarget !== "schedule");
      nav.classList.toggle("is-hidden", shouldHideNav);
      if (tabs) {
        const keepAnchorVisible = forcedTarget && forcedTarget !== "schedule";
        tabs.classList.toggle("is-suppressed", isPinned && !keepAnchorVisible && !shouldHideNav);
      }
      const switchLine = bodyRect.top + navTop + nav.offsetHeight + 12;
      const forcedActiveIndex = nav.dataset.forcedActiveIndex;
      let activeIndex = forcedActiveIndex !== undefined && forcedActiveIndex !== ""
        ? Math.max(0, Math.min(items.length - 1, Number(forcedActiveIndex) || 0))
        : 0;
      if (forcedActiveIndex === undefined || forcedActiveIndex === "") {
        items.forEach((item, index) => {
          if (item.getBoundingClientRect().top <= switchLine) {
            activeIndex = index;
          }
        });
      }

      body.querySelectorAll(".detail-schedule-day-chip").forEach((chip, index) => {
        const active = index === activeIndex;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-selected", active ? "true" : "false");
      });

      ensureDetailScheduleDayChipVisible(nav, activeIndex);
    }

    function handleDetailContentScroll() {
      updateDetailMobileStickyHeader();
      updateDetailAnchorTabs();
      updateDetailScheduleDayNav();
      maybeShowDetailParticipantTooltip();
    }

    function renderDetailMeta(join) {
      const airportLabel = getJoinAirportDepartureLabel(join);
      return `
        <div class="card-meta card-meta-row detail-meta-row">
          <div class="card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" class="card-meta-icon card-meta-icon-location lucide lucide-map-pin-icon lucide-map-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <div class="card-meta-text card-meta-text-location detail-meta-location">${join.region}</div>
          </div>
          ${join.category === "해외" && airportLabel ? `
          <div class="card-meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" class="card-meta-icon card-meta-icon-flight lucide lucide-plane-takeoff-icon lucide-plane-takeoff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 22h20"></path>
              <path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z"></path>
            </svg>
            <div class="card-meta-text card-meta-text-location detail-meta-airport">${airportLabel}</div>
          </div>` : ""}
        </div>
      `;
    }

    function getDetailProductCode(join = {}) {
      return join.goodsCd || join.goodsCode || join.productCode || join.goodSeq || join.erpProductId || join.id || "";
    }

    function copyDetailProductCode(code) {
      const value = String(code || "").trim();
      if (!value) return;
      navigator.clipboard?.writeText(value).catch(() => {});
    }

    function inferDetailCountryName(regionName = "", join = {}) {
      const region = String(regionName || "").replace(/\s*,\s*/g, " ").trim();
      const directCountry = String(join.country || join.countryName || join.nation || join.productCountry || join.erpCountry || "").trim();
      if (directCountry && directCountry !== region) return directCountry;
      for (const category of (regionTree || [])) {
        for (const country of (category.countries || [])) {
          if (region === country.name) return country.name;
          if ((country.cities || []).includes(region)) return country.name;
        }
      }
      const knownCountries = (regionTree || [])
        .flatMap((category) => category.countries || [])
        .map((country) => country.name)
        .filter(Boolean);
      const haystack = [join.title, join.productName, join.goodName, join.location, join.countryRegion, join.region]
        .map((value) => String(value || ""))
        .join(" ");
      return knownCountries.find((country) => haystack.includes(country) && country !== region) || "";
    }

    function formatDetailRegionValue(join = {}) {
      const rawLocation = String(join.countryRegion || join.location || "").trim();
      const rawRegion = String(join.region || join.category || "").trim();
      const parts = (rawLocation || rawRegion)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const countryNames = (regionTree || [])
          .flatMap((category) => category.countries || [])
          .map((country) => country.name)
          .filter(Boolean);
        const countryPart = parts.find((part) => countryNames.includes(part) || part === join.country || part === join.countryName);
        if (countryPart) return [countryPart, ...parts.filter((part) => part !== countryPart)].join(" ");
        return parts.join(" ");
      }
      const region = (parts[0] || rawRegion).replace(/\s*,\s*/g, " ").trim();
      const country = inferDetailCountryName(region, join);
      if (country && region && !region.includes(country)) return `${country} ${region}`.trim();
      return region || country || "확인 필요";
    }

    function getDetailArrivalRegions(join = {}) {
      const region = formatDetailRegionValue(join);
      const parts = region.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) return parts.slice(1).join(", ");
      return parts[0] || "확인 필요";
    }

    function getDetailDepartureRegion(join = {}) {
      const explicitDepartureAirport = inferSecretTourDepartureAirportFromSchedule(join.schedule)
        || normalizeSecretTourAirportName(join.departureAirport, join.airport);
      if (explicitDepartureAirport) return explicitDepartureAirport;
      if (getDetailProductType(join) === "골프팩") return "개별";
      const airport = String(join.airline || join.air2CdNm || join.air2Nm || "").trim();
      if (isSecretTourAirlineName(airport) || isIndividualAirName(airport) || isIndividualAirName(join.air2CdNm) || isIndividualAirName(join.air2Nm) || isIndividualAirCode(join.air2Cd)) return "개별";
      return airport || "개별";
    }

    function getDetailProductType(join = {}) {
      if (isIndividualAirProduct(join)) return "골프팩";
      const actualType = getActualDetailProductType(join);
      if (actualType) return actualType;
      return hasIncludedFlight(join) ? "항공팩" : "골프팩";
    }

    function normalizeDetailProductTypeText(value) {
      const text = String(value ?? "").trim();
      if (!text) return "";
      const normalized = text.replace(/\s+/g, "").toLowerCase();
      if (/골프팩|골프텔|항공불포함|항공별도|golfpack|golftel|landonly|land/.test(normalized)) return "골프팩";
      if (/항공팩|항공포함|에어텔|airpack|airtour|flightincluded|includedflight/.test(normalized)) return "항공팩";
      if (/^(y|yes|true|1|포함|include|included)$/.test(normalized)) return "항공팩";
      if (/^(n|no|false|0|불포함|별도|exclude|excluded)$/.test(normalized)) return "골프팩";
      return "";
    }

    function getActualDetailProductType(join = {}) {
      const candidateFields = [
        "productType",
        "productTypeName",
        "goodsType",
        "goodsTypeName",
        "goodType",
        "goodTypeName",
        "goodKind",
        "goodKindName",
        "goodDetailCd",
        "goodDetailCdNm",
        "goodDetailName",
        "packageType",
        "packageTypeName",
        "packType",
        "packTypeName",
        "tourType",
        "tourTypeName",
        "airProductYn",
        "airYn",
        "flightYn",
        "includeAirYn",
        "flightIncludedYn"
      ];
      for (const field of candidateFields) {
        const normalized = normalizeDetailProductTypeText(join[field]);
        if (normalized) return normalized;
      }
      return "";
    }

    function formatDetailDurationCompact(join = {}) {
      return formatTripDuration(join).replace(/\s+/g, "");
    }

    function renderDetailBenefitCard() {
      const benefitCheckIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;
      return `
        <div class="detail-benefit-card">
          <div class="detail-benefit-head">
            <div class="detail-benefit-title"><img src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/banner_membership2.png" alt="">회원할인</div>
            <div class="detail-benefit-max">즉시 70,000원 할인</div>
          </div>
          <div class="detail-benefit-body">
            <div class="detail-benefit-row"><div>한 번 가입으로 여행마다 할인!</div></div>
            <div class="detail-benefit-note-row">
              <div class="detail-benefit-note">멤버십 가입하고, 할인가로 예약해보세요.</div>
              <button type="button" class="detail-benefit-link" onclick="toggleDetailBenefitAccordion(this)" aria-expanded="false">자세히 보기</button>
            </div>
            <div class="detail-benefit-accordion">
              <div class="detail-benefit-accordion-title">회원 할인 안내</div>
              <div class="detail-benefit-accordion-subtitle">여행할수록 이득인 시크릿투어 멤버십</div>
              <div class="detail-benefit-accordion-copy">해외 골프여행 예약 시 <span class="detail-benefit-highlight">여행마다 최대 7만원 추가 할인</span> 혜택!</div>
              <div class="detail-benefit-table-title">멤버십 종류</div>
              <div class="detail-benefit-table" role="table" aria-label="멤버십 종류">
                <div class="detail-benefit-table-head" role="rowgroup">
                  <div class="detail-benefit-table-row" role="row">
                    <div class="detail-benefit-table-cell" role="columnheader">구분</div>
                    <div class="detail-benefit-table-cell" role="columnheader">가입비</div>
                    <div class="detail-benefit-table-cell" role="columnheader">이용기간</div>
                  </div>
                </div>
                <div class="detail-benefit-table-body" role="rowgroup">
                  <div class="detail-benefit-table-row" role="row"><div class="detail-benefit-table-cell" role="cell">1년 회원</div><div class="detail-benefit-table-cell" role="cell">50,000원</div><div class="detail-benefit-table-cell" role="cell">첫 여행 출발일부터 1년</div></div>
                  <div class="detail-benefit-table-row" role="row"><div class="detail-benefit-table-cell" role="cell">5년 회원</div><div class="detail-benefit-table-cell" role="cell">150,000원</div><div class="detail-benefit-table-cell" role="cell">첫 여행 출발일부터 5년</div></div>
                  <div class="detail-benefit-table-row" role="row"><div class="detail-benefit-table-cell" role="cell">평생 회원</div><div class="detail-benefit-table-cell" role="cell">300,000원</div><div class="detail-benefit-table-cell" role="cell">평생</div></div>
                </div>
              </div>
              <div class="detail-benefit-recommend-title">이런 분께 추천합니다</div>
              <div class="detail-benefit-recommend-list">
                <div class="detail-benefit-recommend-item">${benefitCheckIcon}<span>1년에 1회 이상 해외 골프여행을 계획 중이신 분</span></div>
                <div class="detail-benefit-recommend-item">${benefitCheckIcon}<span>해외 조인 골프를 정기적으로 즐기시는 분</span></div>
                <div class="detail-benefit-recommend-item">${benefitCheckIcon}<span>장기적으로 가장 큰 할인 혜택을 받고 싶으신 분</span></div>
              </div>
              <a class="detail-benefit-join-call" href="tel:0234461119"><svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-phone-icon lucide-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg>가입문의</a>
            </div>
          </div>
        </div>
      `;
    }

    function toggleDetailBenefitAccordion(button) {
      const card = button.closest(".detail-benefit-card");
      if (!card) return;
      const expanded = !card.classList.contains("expanded");
      card.classList.toggle("expanded", expanded);
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.textContent = expanded ? "접기" : "자세히 보기";
    }

    function getDetailParticipantAgeDecade(participant = {}) {
      const source = [participant.age, participant.ageDisplay, participant.birthYear].filter(Boolean).join(" ");
      const decadeMatch = String(source).match(/(\d{2})\s*대/);
      if (decadeMatch) return Number(decadeMatch[1]);
      const birthYearMatch = String(source).match(/\b(19\d{2}|20\d{2})\b/);
      if (birthYearMatch) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - Number(birthYearMatch[1]) + 1;
        return Math.floor(age / 10) * 10;
      }
      return null;
    }

    function getDetailParticipantStats(confirmedParticipants = [], participantCapacity = JOIN_MAX_CAPACITY) {
      const count = confirmedParticipants.length;
      const remaining = Math.max(0, Number(participantCapacity || JOIN_MAX_CAPACITY) - count);
      const genderCounts = confirmedParticipants.reduce((acc, participant) => {
        const gender = String(participant.gender || "").trim();
        if (gender === "여성" || gender.toLowerCase() === "female") acc.female += 1;
        else acc.male += 1;
        return acc;
      }, { male: 0, female: 0 });
      const ageDecades = confirmedParticipants
        .map(getDetailParticipantAgeDecade)
        .filter((value) => Number.isFinite(value));
      const averageAgeDecade = ageDecades.length
        ? `${Math.round((ageDecades.reduce((sum, value) => sum + value, 0) / ageDecades.length) / 10) * 10}대`
        : "확인 중";
      return {
        count,
        remaining,
        averageAgeDecade,
        averageHandicap: formatDetailAverageHandicapV2(confirmedParticipants),
        male: genderCounts.male,
        female: genderCounts.female
      };
    }

    function isMonthlyRecommendationJoin(join = {}) {
      const rule = join.displayRule || {};
      return String(join.scheduleType || rule.scheduleType || join.badgeType || rule.badgeType || "").toLowerCase() === "monthly"
        || String(join.scheduleLabel || rule.scheduleLabel || join.badge || "").includes("월례회");
    }

    function getJoinRecruitmentCapacity(join = {}, fallback = JOIN_MAX_CAPACITY) {
      const rule = join.displayRule || {};
      const value = Number(
        join.participantSummary?.capacity
        || join.lightSummary?.capacity
        || join.capacity
        || join.maxPeople
        || join.maxCapacity
        || rule.capacity
        || rule.maxPeople
        || fallback
      );
      return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
    }

    function renderDetailMonthlyParticipantStatus(join, confirmedParticipants, participantCapacity, options = {}) {
      const stats = getDetailParticipantStats(confirmedParticipants, participantCapacity);
      const aggregateGenderCounts = getJoinParticipantGenderCounts(join, confirmedParticipants);
      stats.male = aggregateGenderCounts.male;
      stats.female = aggregateGenderCounts.female;
      const capacity = getJoinRecruitmentCapacity(join, stats.capacity);
      const count = Math.min(capacity, Math.max(stats.count, getMonthlyCardParticipantCount(join)));
      const remaining = Math.max(0, capacity - count);
      const percent = Math.max(0, Math.min(100, capacity ? (count / capacity) * 100 : 0));
      const deadlineLabel = formatDetailDeadlineLabelV2(join);
      const interestCount = getDetailInterestCountV2(join, { ...stats, capacity, count, remaining });
      const totalGenderCount = Math.max(1, stats.male + stats.female);
      const malePercent = Math.max(0, Math.min(100, (stats.male / totalGenderCount) * 100));
      const femalePercent = Math.max(0, Math.min(100 - malePercent, (stats.female / totalGenderCount) * 100));
      const minMaleWidth = stats.male > 0 ? "8px" : "0";
      const minFemaleWidth = stats.female > 0 ? "8px" : "0";
      const maleRadius = stats.male > 0 && stats.female > 0 ? "999px 0 0 999px" : "999px";
      const femaleRadius = stats.male > 0 && stats.female > 0 ? "0 999px 999px 0" : "999px";
      const travelMatch = calculateDetailTravelMatch(join, confirmedParticipants);
      const matchPercent = travelMatch.percent;
      const styleTags = getDetailRoundStyleTagsV2(join, confirmedParticipants);
      const isMatchLoginRequired = !getJoinCachedCurrentMember();
      const matchGaugeClass = `detail-participant-match-gauge${isMatchLoginRequired ? " is-login-required" : ""}`;
      const mobileMatchReasons = isMatchLoginRequired ? "" : renderDetailTravelMatchReasons(travelMatch.reasons, "mobile");
      const desktopMatchReasons = isMatchLoginRequired ? "" : renderDetailTravelMatchReasons(travelMatch.reasons, "desktop");
      return `
        <div class="detail-participant-status">
          <div class="detail-participant-status-title">함께하는 멤버</div>
          <div class="detail-participant-status-card monthly">
            <div class="detail-participant-status-pills">
              <div class="detail-participant-status-pill deadline">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alarm-clock-icon lucide-alarm-clock" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>
                <div>${escapeHtml(deadlineLabel)}</div>
              </div>
              <div class="detail-participant-status-pill interest">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                <div>${interestCount}명 관심중</div>
              </div>
            </div>
            <div class="detail-monthly-progress detail-monthly-mobile-only">
              <div class="detail-monthly-member-side">
                <div class="detail-monthly-member-copy">
                  <div class="detail-monthly-member-title">월례회</div>
                  <div class="detail-monthly-member-sub">${count > 0 ? `${count}명이 신청했어요` : "누구나 참여 가능한 단체여행입니다"}</div>
                </div>
              </div>
              <div class="detail-monthly-gauge">
                <div class="detail-monthly-gauge-head">
                  <div>모집인원</div>
                  <div class="detail-monthly-gauge-count">${count}/${capacity}명</div>
                </div>
                <div class="detail-participant-gauge-track" aria-hidden="true">
                  <div class="detail-participant-gauge-fill" style="--gauge-width:${percent}%;"></div>
                </div>
              </div>
              <div class="detail-participant-gender">
                <div class="detail-participant-block-title">성별구성</div>
                <div class="detail-participant-gender-row">
                  <div class="detail-participant-gender-side">
                    <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_man.webp" alt="" loading="lazy" decoding="async">
                    <div class="detail-participant-gender-mobile-label">남성 ${stats.male}명</div>
                  </div>
                  <div class="detail-participant-gender-center">
                    <div class="detail-participant-gender-scale">
                      <div class="detail-participant-gauge-track" aria-hidden="true">
                        <div class="detail-participant-gauge-fill" style="--gauge-width:${malePercent}%; --gauge-min-width:${minMaleWidth}; --male-radius:${maleRadius};"></div>
                        <div class="detail-participant-gauge-fill detail-participant-gender-fill-female" style="--male-width:${malePercent}%; --female-width:${femalePercent}%; --female-min-width:${minFemaleWidth}; --female-radius:${femaleRadius};"></div>
                      </div>
                    </div>
                    <div class="detail-participant-gender-summary">남성 ${stats.male}명 · 여성 ${stats.female}명</div>
                  </div>
                  <div class="detail-participant-gender-side">
                    <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_woman.webp" alt="" loading="lazy" decoding="async">
                    <div class="detail-participant-gender-mobile-label">여성 ${stats.female}명</div>
                  </div>
                </div>
              </div>
              <div class="detail-participant-info-grid">
                <div class="detail-participant-info-cell">
                  <div class="detail-participant-info-label">평균연령</div>
                  <div class="detail-participant-info-value">${escapeHtml(count > 0 ? stats.averageAgeDecade : "-")}</div>
                </div>
                <div class="detail-participant-info-cell">
                  <div class="detail-participant-info-label">평균핸디</div>
                  <div class="detail-participant-info-value">${escapeHtml(count > 0 ? stats.averageHandicap : "-")}</div>
                </div>
              </div>
            </div>
            <div class="detail-monthly-desktop-only">
              <div class="detail-monthly-progress">
                <div class="detail-monthly-member-side">
                  <div class="detail-monthly-member-copy">
                    <div class="detail-monthly-member-title">월례회</div>
                    <div class="detail-monthly-member-sub">${count > 0 ? `${count}명이 신청했어요` : "누구나 참여 가능한 단체여행입니다"}</div>
                  </div>
                </div>
                <div class="detail-monthly-gauge">
                  <div class="detail-monthly-gauge-head">
                    <div>모집인원</div>
                    <div class="detail-monthly-gauge-count">${count}/${capacity}명</div>
                  </div>
                  <div class="detail-participant-gauge-track" aria-hidden="true">
                    <div class="detail-participant-gauge-fill" style="--gauge-width:${percent}%;"></div>
                  </div>
                </div>
              </div>
              <div class="detail-participant-info-grid">
                <div class="detail-participant-info-cell">
                  <div class="detail-participant-info-label">현재인원</div>
                  <div class="detail-participant-info-value">${count}명</div>
                </div>
                <div class="detail-participant-info-cell">
                  <div class="detail-participant-info-label">모집인원</div>
                  <div class="detail-participant-info-value">${capacity}명</div>
                </div>
                <div class="detail-participant-info-cell">
                  <div class="detail-participant-info-label">평균연령</div>
                  <div class="detail-participant-info-value">${escapeHtml(count > 0 ? stats.averageAgeDecade : "-")}</div>
                </div>
                <div class="detail-participant-info-cell">
                  <div class="detail-participant-info-label">평균핸디</div>
                  <div class="detail-participant-info-value">${escapeHtml(count > 0 ? stats.averageHandicap : "-")}</div>
                </div>
              </div>
              <div class="detail-participant-gender">
                <div class="detail-participant-block-title">성별구성</div>
                <div class="detail-participant-gender-row">
                  <div class="detail-participant-gender-side">
                    <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_man.webp" alt="" loading="lazy" decoding="async">
                    <div class="detail-participant-gender-mobile-label">남성 ${stats.male}명</div>
                  </div>
                  <div class="detail-participant-gender-center">
                    <div class="detail-participant-gender-scale">
                      <div class="detail-participant-gauge-track" aria-hidden="true">
                        <div class="detail-participant-gauge-fill" style="--gauge-width:${malePercent}%; --gauge-min-width:${minMaleWidth}; --male-radius:${maleRadius};"></div>
                        <div class="detail-participant-gauge-fill detail-participant-gender-fill-female" style="--male-width:${malePercent}%; --female-width:${femalePercent}%; --female-min-width:${minFemaleWidth}; --female-radius:${femaleRadius};"></div>
                      </div>
                    </div>
                    <div class="detail-participant-gender-summary">남성 ${stats.male}명 · 여성 ${stats.female}명</div>
                  </div>
                  <div class="detail-participant-gender-side">
                    <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_woman.webp" alt="" loading="lazy" decoding="async">
                    <div class="detail-participant-gender-mobile-label">여성 ${stats.female}명</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="detail-participant-divider" aria-hidden="true"></div>
            <div class="detail-participant-match">
              <div class="detail-participant-match-head">
                <div class="detail-participant-match-label">여행스타일 적합도<svg class="detail-participant-match-sparkle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="detailMonthlyMatchSparklesGradient" x1="4" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe681"></stop><stop offset="0.55" stop-color="#ffc233"></stop><stop offset="1" stop-color="#ff9f1c"></stop></linearGradient></defs><path fill="url(#detailMonthlyMatchSparklesGradient)" d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path fill="url(#detailMonthlyMatchSparklesGradient)" d="M20 2a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0V7h-2a1 1 0 1 1 0-2h2V3a1 1 0 0 1 1-1z"></path><circle cx="4" cy="20" r="2" fill="url(#detailMonthlyMatchSparklesGradient)"></circle></svg></div>
              </div>
              <div class="${matchGaugeClass}">
                <div class="detail-participant-match-summary">${matchPercent}%</div>
                <div class="detail-participant-gauge-track" aria-hidden="true">
                  <div class="detail-participant-gauge-fill" style="--gauge-width:${matchPercent}%;"></div>
                </div>
                ${mobileMatchReasons}
              </div>
              <div class="detail-participant-style-chips mobile">
                ${styleTags.map((tag) => `<div class="detail-participant-style-chip">${escapeHtml(tag)}</div>`).join("")}
              </div>
            </div>
            ${desktopMatchReasons}
            <div class="detail-participant-style-chips desktop">
              ${styleTags.map((tag) => `<div class="detail-participant-style-chip">${escapeHtml(tag)}</div>`).join("")}
            </div>
          </div>
        </div>
      `;
    }

    function renderDetailParticipantStatus(join, confirmedParticipants, participantCapacity, options = {}) {
      if (isMonthlyRecommendationJoin(join)) {
        return renderDetailMonthlyParticipantStatus(join, confirmedParticipants, getJoinRecruitmentCapacity(join, participantCapacity), options);
      }
      const stats = getDetailParticipantStats(confirmedParticipants, participantCapacity);
      const genderSummary = [
        stats.male > 0 ? `남성 ${stats.male}명` : "",
        stats.female > 0 ? `여성 ${stats.female}명` : ""
      ].filter(Boolean).join(", ");
      return `
        <div class="detail-participant-status">
          <div class="detail-participant-status-title">함께 떠나는 멤버</div>
          <div class="detail-participant-status-card">
            <div class="detail-participant-summary">
              <div class="detail-participant-count"><svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-users-icon lucide-users" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><path d="M16 3.128a4 4 0 0 1 0 7.744"></path><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><circle cx="9" cy="7" r="4"></circle></svg>${stats.count}명 참여중 <div class="detail-participant-meta-separator">·</div> ${stats.remaining}자리 남음</div>
              <div class="detail-participant-meta">
                <div class="detail-participant-meta-item"><svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-chart-line-icon lucide-chart-line" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>평균나이 ${stats.averageAgeDecade}</div>
                ${genderSummary ? `<div class="detail-participant-meta-separator">·</div><div class="detail-participant-meta-item">${genderSummary}</div>` : ""}
              </div>
            </div>
            <div class="team-row detail-team">
              ${renderCardTeamSlots(join, false, 4, { allowEmptySlots: !options.disableEmptySlots })}
            </div>
            <div class="detail-participant-info-bubble">클릭하면 멤버 정보를 확인할 수 있어요</div>
          </div>
        </div>
      `;
    }

    function isDetailFemaleParticipantV2(participant = {}) {
      const source = [participant.gender, participant.gif, participant.name].filter(Boolean).join(" ").toLowerCase();
      return source.includes("여") || source.includes("female") || source.includes("woman");
    }

    function getDetailParticipantScoreValueV2(participant = {}) {
      const source = String(participant.handicap || participant.level || "").trim();
      const score = Number((source.match(/\d+/) || [])[0]);
      if (score) return score;
      if (/프로/.test(source)) return 72;
      if (/싱글/.test(source)) return 79;
      if (/보기/.test(source)) return 100;
      if (/입문|초보/.test(source)) return 110;
      return 0;
    }

    function getDetailParticipantAgeDecadeV2(participant = {}) {
      const source = [participant.age, participant.ageDisplay, participant.ageDetail, participant.birthYear].filter(Boolean).join(" ");
      const decadeMatch = String(source).match(/([3-8]\d)\s*대/);
      if (decadeMatch) return Number(decadeMatch[1]);
      const ageMatch = String(source).match(/(?:^|\D)([3-8]\d)(?:\D|$)/);
      if (ageMatch) return Math.floor(Number(ageMatch[1]) / 10) * 10;
      const birthYearMatch = String(source).match(/\b(19\d{2}|20\d{2})\b/);
      if (birthYearMatch) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - Number(birthYearMatch[1]) + 1;
        return Math.floor(age / 10) * 10;
      }
      return null;
    }

    function formatDetailAverageHandicapV2(participants = []) {
      const values = participants.map(getDetailParticipantScoreValueV2).filter(Boolean);
      if (!values.length) return "확인중";
      const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      return `${average}타`;
    }

    function formatDetailAverageAgeDecadeV2(participants = []) {
      const ageDecades = participants
        .map(getDetailParticipantAgeDecadeV2)
        .filter((value) => Number.isFinite(value));
      if (!ageDecades.length) return "확인중";
      const average = ageDecades.reduce((sum, value) => sum + value, 0) / ageDecades.length;
      return `${Math.round(average / 10) * 10}대`;
    }

    function getDetailInterestCountV2(join = {}, stats = {}) {
      const seed = hashStringToNumber([join.id, join.title, join.departureDate].filter(Boolean).join("|"));
      const displayMinimum = Math.max(8, Number(stats.count || 0) + 8 + (seed % 8));
      const explicit = Number(
        join.interestCount
        || join.viewingCount
        || join.viewerCount
        || join.viewCount
        || join.wishCount
        || join.recentViewCount
        || 0
      );
      if (Number.isFinite(explicit) && explicit > 0) return Math.max(Math.round(explicit), displayMinimum);
      return displayMinimum;
    }

    function formatDetailDeadlineLabelV2(join = {}) {
      if (isJoinFullyBooked(join)) return "마감되었어요";
      const deadlineTimestamp = getJoinReservationDeadlineTimestamp(join);
      const remaining = Number(deadlineTimestamp) - getJoinCountdownNowTimestamp();
      if (!Number.isFinite(remaining) || remaining <= 0) return "마감되었어요";
      const totalHours = Math.ceil(remaining / 3600000);
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      if (days > 0 && hours > 0) return `마감 ${days}일 ${hours}시간 전`;
      if (days > 0) return `마감 ${days}일 전`;
      return `마감 ${Math.max(1, hours)}시간 전`;
    }

    function getDetailTravelStyleMatchPercentV2(join = {}, participants = []) {
      return calculateDetailTravelMatch(join, participants).percent;
    }

    function clampDetailTravelMatchScore(score) {
      return Math.max(68, Math.min(96, Math.round(Number(score) || 72)));
    }

    function getDetailCurrentMemberForMatch() {
      return getJoinCachedCurrentMember?.() || {};
    }

    function normalizeDetailMatchTokens(value) {
      return []
        .concat(Array.isArray(value) ? value : String(value || "").split(/[,\n/·|]+/))
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }

    function getDetailMemberStyleTokens(member = {}) {
      const raw = member.travelStyles || member.styles || member.memberPreferences || member.preferredMemberComposition || "";
      if (typeof splitJoinMemberProfileStyles === "function") {
        const parsed = splitJoinMemberProfileStyles(raw);
        if (parsed.length) return parsed;
      }
      return normalizeDetailMatchTokens(raw);
    }

    function getDetailMemberAgeDecadeForMatch(member = {}) {
      const direct = getDetailParticipantAgeDecadeV2({
        birthYear: member.birthYear || member.birthday,
        age: member.age,
        ageDisplay: member.ageDisplay || getJoinMemberAgeBand?.(member)
      });
      return Number.isFinite(direct) ? direct : null;
    }

    function getDetailMemberScoreForMatch(member = {}) {
      return getDetailParticipantScoreValueV2({
        handicap: member.level || member.handicap || member.averageScore || ""
      });
    }

    function getHeroCalendarProfileCountDisplayValue(count) {
      if (HERO_CALENDAR_PROFILE_COUNT_TEST_VALUE == null) return count;
      const testValue = Number(HERO_CALENDAR_PROFILE_COUNT_TEST_VALUE);
      if (Number.isFinite(testValue) && testValue >= 0) return testValue;
      return count;
    }

    function normalizeHeroCalendarProfileCount(count) {
      return Math.max(0, Math.round(Number(count) || 0));
    }

    function renderHeroCalendarSlotCount(target, formatted, options = {}) {
      if (!target) return;
      const isSameValue = target.dataset.slotCountValue === formatted;
      if (!isSameValue) {
        target.innerHTML = formatted.split("").map((char, index) => {
          if (!/\d/.test(char)) return `<div class="hero-calendar-profile-count-separator">${escapeHtml(char)}</div>`;
          return `
            <div class="hero-calendar-profile-count-digit" aria-hidden="true">
              <div class="hero-calendar-profile-count-reel" data-target-digit="${escapeHtml(char)}" style="transition-delay:${Math.min(index * 70, 420)}ms;">
                ${Array.from({ length: 10 }, (_, digit) => `<div>${digit}</div>`).join("")}
              </div>
            </div>
          `;
        }).join("");
        target.dataset.slotCountValue = formatted;
        target.dataset.slotCountAnimated = "false";
      }
      if (!options.animate) return;
      if (isSameValue && target.dataset.slotCountAnimated === "true") return;
      target.dataset.slotCountAnimated = "true";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          target.querySelectorAll(".hero-calendar-profile-count-reel").forEach((reel) => {
            const digit = Number(reel.dataset.targetDigit || 0);
            reel.style.transform = `translateY(-${digit}em)`;
          });
        });
      });
    }

    function renderHeroCalendarProfileCount(count, options = {}) {
      const numeric = normalizeHeroCalendarProfileCount(count);
      const target = document.getElementById("heroCalendarProfileCount");
      if (!target) return;
      const formatted = numeric.toLocaleString("ko-KR");
      target.setAttribute("aria-label", `최근 30일 홈페이지 방문자 수 ${formatted}명`);
      renderHeroCalendarSlotCount(target, formatted, options);
    }

    function updateHeroCalendarProfileCount(count = joinMemberProfileCompletedCount) {
      const numeric = normalizeHeroCalendarProfileCount(getHeroCalendarProfileCountDisplayValue(count));
      joinMemberProfileCompletedCount = numeric;
      heroCalendarProfileCountQueuedValue = numeric;
      renderHeroCalendarProfileCount(numeric, { animate: true });
    }

    function queueHeroCalendarProfileCount(count = joinMemberProfileCompletedCount) {
      const numeric = normalizeHeroCalendarProfileCount(getHeroCalendarProfileCountDisplayValue(count));
      joinMemberProfileCompletedCount = numeric;
      heroCalendarProfileCountQueuedValue = numeric;
      if (heroCalendarProfileCountAnimationReady) {
        updateHeroCalendarProfileCount(numeric);
        return;
      }
      renderHeroCalendarProfileCount(numeric, { animate: false });
    }

    function startHeroCalendarProfileCountAnimation() {
      if (heroCalendarProfileCountAnimationStarted) return;
      heroCalendarProfileCountAnimationReady = true;
      heroCalendarProfileCountAnimationStarted = true;
      updateHeroCalendarProfileCount(heroCalendarProfileCountQueuedValue);
      updateHeroCalendarActiveCount(heroCalendarActiveCountQueuedValue);
    }

    function normalizeHeroCalendarActiveCount(count) {
      return Math.max(0, Math.round(Number(count) || 0));
    }

    function updateHeroCalendarActiveCount(count = heroCalendarActiveCountValue) {
      const numeric = normalizeHeroCalendarActiveCount(count);
      heroCalendarActiveCountValue = numeric;
      heroCalendarActiveCountQueuedValue = numeric;
      const target = document.getElementById("heroCalendarActiveCount");
      if (!target) return;
      const formatted = numeric.toLocaleString("ko-KR");
      renderHeroCalendarSlotCount(target, formatted, { animate: true });
      target.closest(".hero-calendar-active-count")?.setAttribute("aria-label", `현재 보고 있는 인원 ${formatted}명`);
    }

    function queueHeroCalendarActiveCount(count = heroCalendarActiveCountValue) {
      const numeric = normalizeHeroCalendarActiveCount(count);
      heroCalendarActiveCountValue = numeric;
      heroCalendarActiveCountQueuedValue = numeric;
      const target = document.getElementById("heroCalendarActiveCount");
      if (!target) return;
      if (heroCalendarProfileCountAnimationReady) {
        updateHeroCalendarActiveCount(numeric);
        return;
      }
      const formatted = numeric.toLocaleString("ko-KR");
      renderHeroCalendarSlotCount(target, formatted, { animate: false });
      target.closest(".hero-calendar-active-count")?.setAttribute("aria-label", `현재 보고 있는 인원 ${formatted}명`);
    }

    function getDetailParticipantAverage(values = []) {
      const valid = values.filter((value) => Number.isFinite(value) && value > 0);
      if (!valid.length) return null;
      return valid.reduce((sum, value) => sum + value, 0) / valid.length;
    }

    function getDetailMatchStyleLabel(styles = []) {
      const first = styles.map((style) => String(style || "").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim()).find(Boolean);
      return first ? first.slice(0, 12) : "";
    }

    function getDetailMatchAgeLabel(ageDecade) {
      return Number.isFinite(ageDecade) ? `${Math.round(ageDecade)}대` : "";
    }

    function getDetailMatchScoreLabel(score) {
      if (!Number.isFinite(score) || score <= 0) return "";
      const rounded = Math.round(score / 10) * 10;
      return `${rounded}대 타수`;
    }

    function addDetailMatchReason(reasons, text) {
      if (!text || reasons.includes(text) || reasons.length >= 3) return;
      reasons.push(text);
    }

    function calculateDetailTravelMatch(join = {}, participants = []) {
      const member = getDetailCurrentMemberForMatch();
      const explicitStyleLabel = getDetailMatchStyleLabel(getDetailMemberStyleTokens(member));
      const explicit = Number(join.travelStyleMatchPercent || join.matchPercent || join.matchRate || 0);
      if (Number.isFinite(explicit) && explicit > 0) {
        return {
          percent: clampDetailTravelMatchScore(explicit),
          reasons: [explicitStyleLabel ? `${explicitStyleLabel} 스타일을 기준으로 살펴봤어요` : "입력하신 스타일을 기준으로 살펴봤어요"]
        };
      }

      const memberAgeDecade = getDetailMemberAgeDecadeForMatch(member);
      const participantAgeAverage = getDetailParticipantAverage(participants.map(getDetailParticipantAgeDecadeV2));
      const memberScore = getDetailMemberScoreForMatch(member);
      const participantScoreAverage = getDetailParticipantAverage(participants.map(getDetailParticipantScoreValueV2));
      const memberStyles = getDetailMemberStyleTokens(member);
      const participantStyles = [...new Set(participants.flatMap((participant) => normalizeDetailMatchTokens(participant.preferences || participant.styles || participant.memberPreferences)))];
      const styleMatches = memberStyles.filter((style) => participantStyles.some((item) => item.includes(style) || style.includes(item)));
      const joinStyles = [...new Set([
        ...normalizeDetailMatchTokens(join.styles),
        ...normalizeDetailMatchTokens(join.memberPreferences),
        ...normalizeDetailMatchTokens(join.preferredMemberComposition)
      ])];
      const scheduleStyleMatches = memberStyles.filter((style) => joinStyles.some((item) => item.includes(style) || style.includes(item)));
      const memberStyleLabel = getDetailMatchStyleLabel(memberStyles);
      const matchedStyleLabel = getDetailMatchStyleLabel(styleMatches) || memberStyleLabel;
      const scheduleStyleLabel = getDetailMatchStyleLabel(scheduleStyleMatches) || memberStyleLabel;
      const memberAgeLabel = getDetailMatchAgeLabel(memberAgeDecade);
      const memberScoreLabel = getDetailMatchScoreLabel(memberScore);
      const hasParticipants = participants.length > 0;
      const hasPrice = Number(join.price || join.productPrice || 0) > 0;
      const hasDate = Boolean(join.departureDate && join.returnDate);
      const remaining = Number(join.emptySlots);
      let score = 72;
      const reasons = [];

      if (hasParticipants) {
        score += Math.min(5, participants.length * 2);
      } else if (join.isAdminRecommendedSchedule) {
        score += 6;
        addDetailMatchReason(reasons, memberStyleLabel ? `${memberStyleLabel} 스타일로 시작하기 좋아요` : "원하는 동행 분위기로 시작하기 좋아요");
      }

      if (Number.isFinite(memberAgeDecade) && Number.isFinite(participantAgeAverage)) {
        const diff = Math.abs(memberAgeDecade - participantAgeAverage);
        if (diff <= 10) {
          score += 6;
          addDetailMatchReason(reasons, memberAgeLabel ? `${memberAgeLabel} 기준으로 편하게 어울려요` : "편하게 어울릴 연령대에 가까워요");
        } else if (diff <= 20) {
          score += 3;
        } else {
          score -= 3;
        }
      }

      if (memberScore && participantScoreAverage) {
        const diff = Math.abs(memberScore - participantScoreAverage);
        if (diff <= 10) {
          score += 6;
          addDetailMatchReason(reasons, memberScoreLabel ? `${memberScoreLabel} 템포와 잘 맞아요` : "라운딩 템포가 잘 맞을 가능성이 높아요");
        } else if (diff <= 20) {
          score += 3;
        } else {
          score -= 4;
        }
      }

      if (styleMatches.length) {
        score += Math.min(6, styleMatches.length * 3);
        addDetailMatchReason(reasons, matchedStyleLabel ? `${matchedStyleLabel} 성향이 잘 맞아요` : "선호하는 라운딩 분위기가 잘 맞아요");
      } else if (memberStyles.length && participantStyles.length) {
        score += 1;
      }
      if (!hasParticipants && scheduleStyleMatches.length) {
        score += Math.min(5, scheduleStyleMatches.length * 2);
        addDetailMatchReason(reasons, scheduleStyleLabel ? `${scheduleStyleLabel} 분위기와 잘 맞아요` : "선호하는 동행 성향과 잘 맞아요");
      }

      if (hasDate && hasPrice) {
        score += 5;
      } else if (hasDate || hasPrice) {
        score += 2;
      }

      if (join.isAdminRecommendedSchedule) score += 3;
      if (Number.isFinite(remaining) && remaining > 0 && remaining <= 2) score += 3;
      if (Number.isFinite(remaining) && remaining >= 3) score += 2;

      if (!reasons.length) {
        const hasStyleBasis = Boolean(memberStyles.length || participantStyles.length || joinStyles.length);
        addDetailMatchReason(reasons, hasStyleBasis ? "입력하신 스타일을 바탕으로 살펴봤어요" : "스타일을 입력하면 더 정확하게 볼 수 있어요");
      }

      return {
        percent: clampDetailTravelMatchScore(score),
        reasons
      };
    }

    function renderDetailTravelMatchReasons(reasons = [], scope = "") {
      const items = reasons.slice(0, 3);
      if (!items.length) return "";
      return `
        <div class="detail-participant-match-reasons ${escapeHtml(scope)}">
          ${items.map((reason) => `<div class="detail-participant-match-reason">${escapeHtml(reason)}</div>`).join("")}
        </div>
      `;
    }

    function getDetailRoundStyleTagsV2(join = {}, participants = []) {
      const sources = [
        ...(Array.isArray(join.styles) ? join.styles : []),
        ...(Array.isArray(join.memberPreferences) ? join.memberPreferences : []),
        ...(Array.isArray(join.preferredMemberComposition) ? join.preferredMemberComposition : []),
        ...participants.flatMap((participant) => participant.preferences || [])
      ];
      const tags = [...new Set(sources.map((tag) => String(tag || "").trim()).filter(Boolean))];
      return (tags.length ? tags : ["즐겜", "매너중시", "초보환영"]).slice(0, 3);
    }

    function getDetailParticipantStats(confirmedParticipants = [], participantCapacity = JOIN_MAX_CAPACITY) {
      const count = confirmedParticipants.length;
      const capacity = Math.max(count, Number(participantCapacity || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY);
      const remaining = Math.max(0, capacity - count);
      const genderCounts = confirmedParticipants.reduce((acc, participant) => {
        if (isDetailFemaleParticipantV2(participant)) acc.female += 1;
        else acc.male += 1;
        return acc;
      }, { male: 0, female: 0 });
      return {
        count,
        capacity,
        remaining,
        averageAgeDecade: formatDetailAverageAgeDecadeV2(confirmedParticipants),
        averageHandicap: formatDetailAverageHandicapV2(confirmedParticipants),
        male: genderCounts.male,
        female: genderCounts.female
      };
    }

    function renderDetailParticipantStatus(join, confirmedParticipants, participantCapacity, options = {}) {
      if (isMonthlyRecommendationJoin(join)) {
        return renderDetailMonthlyParticipantStatus(join, confirmedParticipants, getJoinRecruitmentCapacity(join, participantCapacity), options);
      }
      const stats = getDetailParticipantStats(confirmedParticipants, participantCapacity);
      const authoritativeCount = getJoinAuthoritativeConfirmedCount(join);
      stats.capacity = Math.max(stats.capacity, getJoinRecruitmentCapacity(join, participantCapacity));
      stats.count = Math.min(stats.capacity, Math.max(stats.count, authoritativeCount));
      stats.remaining = Math.max(0, stats.capacity - stats.count);
      const aggregateGenderCounts = getJoinParticipantGenderCounts(join, confirmedParticipants);
      if (aggregateGenderCounts.male + aggregateGenderCounts.female > 0) {
        stats.male = aggregateGenderCounts.male;
        stats.female = aggregateGenderCounts.female;
      }
      const totalGenderCount = Math.max(1, stats.male + stats.female);
      const malePercent = Math.max(0, Math.min(100, (stats.male / totalGenderCount) * 100));
      const femalePercent = Math.max(0, Math.min(100 - malePercent, (stats.female / totalGenderCount) * 100));
      const matchPercent = getDetailTravelStyleMatchPercentV2(join, confirmedParticipants);
      const minimumDepartureCount = Math.min(stats.capacity, Math.max(1, Number(join.minimumDepartureCount || join.minDepartureCount || join.minParticipants || 4) || 4));
      const styleTags = getDetailRoundStyleTagsV2(join, confirmedParticipants);
      const interestCount = getDetailInterestCountV2(join, stats);
      const deadlineLabel = formatDetailDeadlineLabelV2(join);
      const minMaleWidth = stats.male > 0 ? "8px" : "0";
      const minFemaleWidth = stats.female > 0 ? "8px" : "0";
      const maleRadius = stats.male > 0 && stats.female > 0 ? "999px 0 0 999px" : "999px";
      const femaleRadius = stats.male > 0 && stats.female > 0 ? "0 999px 999px 0" : "999px";
      const isEmptyAdminRecommendation = Boolean(join?.isAdminRecommendedSchedule) && stats.count <= 0;
      const currentCountLabel = isEmptyAdminRecommendation ? "모집중" : `${stats.count}명`;
      const averageAgeLabel = isEmptyAdminRecommendation ? "-" : stats.averageAgeDecade;
      const averageHandicapLabel = isEmptyAdminRecommendation ? "-" : stats.averageHandicap;
      const participantInfoBubble = isEmptyAdminRecommendation ? "" : `<div class="detail-participant-info-bubble">클릭하면 멤버 정보를 확인할 수 있어요</div>`;
      return `
        <div class="detail-participant-status">
          <div class="detail-participant-status-title">함께 떠나는 멤버</div>
          <div class="detail-participant-status-card">
            <div class="detail-participant-status-pills">
              <div class="detail-participant-status-pill deadline">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alarm-clock-icon lucide-alarm-clock" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>
                <div>${escapeHtml(deadlineLabel)}</div>
              </div>
              <div class="detail-participant-status-pill interest">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                <div>${interestCount}명 관심중</div>
              </div>
            </div>
            <div class="team-row detail-team">
              ${renderCardTeamSlots(join, false, 4, { allowEmptySlots: !options.disableEmptySlots })}
            </div>
            <div class="detail-participant-info-grid">
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">현재인원</div>
                <div class="detail-participant-info-value">${escapeHtml(currentCountLabel)}</div>
              </div>
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">최소출발</div>
                <div class="detail-participant-info-value">${minimumDepartureCount}명</div>
              </div>
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">평균연령</div>
                <div class="detail-participant-info-value">${escapeHtml(averageAgeLabel)}</div>
              </div>
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">평균핸디</div>
                <div class="detail-participant-info-value">${escapeHtml(averageHandicapLabel)}</div>
              </div>
            </div>
            <div class="detail-participant-gender">
              <div class="detail-participant-block-title">성별구성</div>
              <div class="detail-participant-gender-row">
                <div class="detail-participant-gender-side">
                  <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_man.webp" alt="" loading="lazy" decoding="async">
                  <div class="detail-participant-gender-mobile-label">남성 ${stats.male}명</div>
                </div>
                <div class="detail-participant-gender-center">
                  <div class="detail-participant-gender-scale">
                    <div class="detail-participant-gauge-track" aria-hidden="true">
                      <div class="detail-participant-gauge-fill" style="--gauge-width:${malePercent}%; --gauge-min-width:${minMaleWidth}; --male-radius:${maleRadius};"></div>
                      <div class="detail-participant-gauge-fill detail-participant-gender-fill-female" style="--male-width:${malePercent}%; --female-width:${femalePercent}%; --female-min-width:${minFemaleWidth}; --female-radius:${femaleRadius};"></div>
                    </div>
                  </div>
                  <div class="detail-participant-gender-summary">남성 ${stats.male}명 · 여성 ${stats.female}명</div>
                </div>
                <div class="detail-participant-gender-side">
                  <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_woman.webp" alt="" loading="lazy" decoding="async">
                  <div class="detail-participant-gender-mobile-label">여성 ${stats.female}명</div>
                </div>
              </div>
            </div>
            <div class="detail-participant-divider" aria-hidden="true"></div>
            <div class="detail-participant-match">
              <div class="detail-participant-match-head">
                <div class="detail-participant-match-label">여행 스타일이 잘 맞아요<svg class="detail-participant-match-sparkle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="detailMatchSparklesGradient" x1="4" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe681"></stop><stop offset="0.55" stop-color="#ffc233"></stop><stop offset="1" stop-color="#ff9f1c"></stop></linearGradient></defs><path fill="url(#detailMatchSparklesGradient)" d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path fill="url(#detailMatchSparklesGradient)" d="M20 2a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0V7h-2a1 1 0 1 1 0-2h2V3a1 1 0 0 1 1-1z"></path><circle cx="4" cy="20" r="2" fill="url(#detailMatchSparklesGradient)"></circle></svg></div>
              </div>
              <div class="detail-participant-gauge-track" aria-hidden="true">
                <div class="detail-participant-gauge-fill" style="--gauge-width:${matchPercent}%;"></div>
              </div>
              <div class="detail-participant-match-summary">${matchPercent}%</div>
            </div>
            <div class="detail-participant-style-chips">
              ${styleTags.map((tag) => `<div class="detail-participant-style-chip">${escapeHtml(tag)}</div>`).join("")}
            </div>
            ${participantInfoBubble}
          </div>
        </div>
      `;
    }

    function renderDetailParticipantStatus(join, confirmedParticipants, participantCapacity, options = {}) {
      if (isMonthlyRecommendationJoin(join)) {
        return renderDetailMonthlyParticipantStatus(join, confirmedParticipants, getJoinRecruitmentCapacity(join, participantCapacity), options);
      }
      const stats = getDetailParticipantStats(confirmedParticipants, participantCapacity);
      const authoritativeCount = getJoinAuthoritativeConfirmedCount(join);
      stats.capacity = Math.max(stats.capacity, getJoinRecruitmentCapacity(join, participantCapacity));
      stats.count = Math.min(stats.capacity, Math.max(stats.count, authoritativeCount));
      stats.remaining = Math.max(0, stats.capacity - stats.count);
      const aggregateGenderCounts = getJoinParticipantGenderCounts(join, confirmedParticipants);
      if (aggregateGenderCounts.male + aggregateGenderCounts.female > 0) {
        stats.male = aggregateGenderCounts.male;
        stats.female = aggregateGenderCounts.female;
      }
      const totalGenderCount = Math.max(1, stats.male + stats.female);
      const malePercent = Math.max(0, Math.min(100, (stats.male / totalGenderCount) * 100));
      const femalePercent = Math.max(0, Math.min(100 - malePercent, (stats.female / totalGenderCount) * 100));
      const travelMatch = calculateDetailTravelMatch(join, confirmedParticipants);
      const matchPercent = travelMatch.percent;
      const minimumDepartureCount = Math.min(stats.capacity, Math.max(1, Number(join.minimumDepartureCount || join.minDepartureCount || join.minParticipants || 4) || 4));
      const styleTags = getDetailRoundStyleTagsV2(join, confirmedParticipants);
      const interestCount = getDetailInterestCountV2(join, stats);
      const deadlineLabel = formatDetailDeadlineLabelV2(join);
      const minMaleWidth = stats.male > 0 ? "8px" : "0";
      const minFemaleWidth = stats.female > 0 ? "8px" : "0";
      const maleRadius = stats.male > 0 && stats.female > 0 ? "999px 0 0 999px" : "999px";
      const femaleRadius = stats.male > 0 && stats.female > 0 ? "0 999px 999px 0" : "999px";
      const isEmptyAdminRecommendation = Boolean(join?.isAdminRecommendedSchedule) && stats.count <= 0;
      const currentCountLabel = isEmptyAdminRecommendation ? "모집중" : `${stats.count}명`;
      const averageAgeLabel = isEmptyAdminRecommendation ? "-" : stats.averageAgeDecade;
      const averageHandicapLabel = isEmptyAdminRecommendation ? "-" : stats.averageHandicap;
      const participantInfoBubble = isEmptyAdminRecommendation ? "" : `<div class="detail-participant-info-bubble">클릭하면 멤버 정보를 확인할 수 있어요</div>`;
      const isMatchLoginRequired = !getJoinCachedCurrentMember();
      const matchGaugeClass = `detail-participant-match-gauge${isMatchLoginRequired ? " is-login-required" : ""}`;
      const mobileMatchReasons = isMatchLoginRequired ? "" : renderDetailTravelMatchReasons(travelMatch.reasons, "mobile");
      const desktopMatchReasons = isMatchLoginRequired ? "" : renderDetailTravelMatchReasons(travelMatch.reasons, "desktop");
      return `
        <div class="detail-participant-status">
          <div class="detail-participant-status-title">함께 떠나는 멤버</div>
          <div class="detail-participant-status-card">
            <div class="detail-participant-status-pills">
              <div class="detail-participant-status-pill deadline">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alarm-clock-icon lucide-alarm-clock" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>
                <div>${escapeHtml(deadlineLabel)}</div>
              </div>
              <div class="detail-participant-status-pill interest">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                <div>${interestCount}명 관심중</div>
              </div>
            </div>
            <div class="team-row detail-team">
              ${renderCardTeamSlots(join, false, 4, { allowEmptySlots: !options.disableEmptySlots })}
            </div>
            <div class="detail-participant-info-grid">
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">현재인원</div>
                <div class="detail-participant-info-value">${escapeHtml(currentCountLabel)}</div>
              </div>
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">최소출발</div>
                <div class="detail-participant-info-value">${minimumDepartureCount}명</div>
              </div>
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">평균연령</div>
                <div class="detail-participant-info-value">${escapeHtml(averageAgeLabel)}</div>
              </div>
              <div class="detail-participant-info-cell">
                <div class="detail-participant-info-label">평균핸디</div>
                <div class="detail-participant-info-value">${escapeHtml(averageHandicapLabel)}</div>
              </div>
            </div>
            <div class="detail-participant-gender">
              <div class="detail-participant-block-title">성별구성</div>
              <div class="detail-participant-gender-row">
                <div class="detail-participant-gender-side">
                  <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_man.webp" alt="" loading="lazy" decoding="async">
                  <div class="detail-participant-gender-mobile-label">남성 ${stats.male}명</div>
                </div>
                <div class="detail-participant-gender-center">
                  <div class="detail-participant-gender-scale">
                    <div class="detail-participant-gauge-track" aria-hidden="true">
                      <div class="detail-participant-gauge-fill" style="--gauge-width:${malePercent}%; --gauge-min-width:${minMaleWidth}; --male-radius:${maleRadius};"></div>
                      <div class="detail-participant-gauge-fill detail-participant-gender-fill-female" style="--male-width:${malePercent}%; --female-width:${femalePercent}%; --female-min-width:${minFemaleWidth}; --female-radius:${femaleRadius};"></div>
                    </div>
                  </div>
                  <div class="detail-participant-gender-summary">남성 ${stats.male}명 · 여성 ${stats.female}명</div>
                </div>
                <div class="detail-participant-gender-side">
                  <img class="detail-participant-gender-avatar" src="https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/icon_woman.webp" alt="" loading="lazy" decoding="async">
                  <div class="detail-participant-gender-mobile-label">여성 ${stats.female}명</div>
                </div>
              </div>
            </div>
            <div class="detail-participant-divider" aria-hidden="true"></div>
            <div class="detail-participant-match">
              <div class="detail-participant-match-head">
                <div class="detail-participant-match-label">여행스타일 적합도<svg class="detail-participant-match-sparkle" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="detailMatchSparklesGradient" x1="4" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe681"></stop><stop offset="0.55" stop-color="#ffc233"></stop><stop offset="1" stop-color="#ff9f1c"></stop></linearGradient></defs><path fill="url(#detailMatchSparklesGradient)" d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path fill="url(#detailMatchSparklesGradient)" d="M20 2a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0V7h-2a1 1 0 1 1 0-2h2V3a1 1 0 0 1 1-1z"></path><circle cx="4" cy="20" r="2" fill="url(#detailMatchSparklesGradient)"></circle></svg></div>
              </div>
              <div class="${matchGaugeClass}">
                <div class="detail-participant-match-summary">${matchPercent}%</div>
                <div class="detail-participant-gauge-track" aria-hidden="true">
                  <div class="detail-participant-gauge-fill" style="--gauge-width:${matchPercent}%;"></div>
                </div>
                ${mobileMatchReasons}
              </div>
              <div class="detail-participant-style-chips mobile">
                ${styleTags.map((tag) => `<div class="detail-participant-style-chip">${escapeHtml(tag)}</div>`).join("")}
              </div>
            </div>
            ${desktopMatchReasons}
            <div class="detail-participant-style-chips desktop">
              ${styleTags.map((tag) => `<div class="detail-participant-style-chip">${escapeHtml(tag)}</div>`).join("")}
            </div>
            ${participantInfoBubble}
          </div>
        </div>
      `;
    }

    function getDetailFlightRouteParts(join = {}) {
      const rawItems = Array.isArray(join.flightScheduleItems) ? join.flightScheduleItems : [];
      const departure = parseFlightScheduleItem(rawItems[0], "출발");
      const arrival = parseFlightScheduleItem(rawItems[1], "도착");
      const flightCode = departure.code || arrival.code || "";
      const rawFlightText = rawItems.map((item) => typeof item === "string" ? item : Object.values(item || {}).join(" ")).join(" ");
      const titleAirlineCode = getDetailAirlineCodeFromProductTitle(join.title || join.productName || "");
      const airlineCode = getDetailAirlineCodeFromName(join.airline || join.air2Nm || join.air2CdNm)
        || getDetailAirlineCodeFromName(departure.airline || arrival.airline)
        || getDetailAirlineCodeFromName(extractDetailAirlineName(rawFlightText))
        || normalizeDetailAirlineCode(flightCode)
        || titleAirlineCode;
      const airline = join.airline || join.air2Nm || join.air2CdNm || departure.airline || arrival.airline || getDetailAirlineNameFromCode(airlineCode) || extractDetailAirlineName(rawFlightText) || "항공사 확인 중";
      const scheduleAirports = getDetailAirportsFromSchedule(join);
      const airport = scheduleAirports.departureAirport || getDetailDepartureRegion(join);
      const visit = getDetailArrivalRegions(join).split(",").map((part) => part.trim()).filter(Boolean);
      const outboundCity = scheduleAirports.arrivalAirport || visit[0] || formatDetailRegionValue(join);
      const inboundCity = scheduleAirports.returnDepartureAirport || scheduleAirports.arrivalAirport || visit[visit.length - 1] || outboundCity;
      const returnAirport = departure.fromCity || airport || scheduleAirports.returnArrivalAirport;
      const getClock = (segment, dateString) => {
        const value = getFlightTimeWithDateFallback(segment, dateString);
        const match = String(value || "").match(/(\d{1,2}[:.]\d{2})/);
        return match ? match[1].replace(".", ":") : "";
      };
      return {
        airline,
        airlineCode,
        duration: formatDetailDurationCompact(join),
        outbound: {
          type: "takeoff",
          fromDate: departure.fromDate || join.departureDate,
          fromTime: departure.fromTime || getClock(departure, join.departureDate),
          fromCity: departure.fromCity || airport,
          toDate: departure.toDate || departure.fromDate || join.departureDate,
          toTime: departure.toTime || "",
          toCity: departure.toCity || outboundCity
        },
        inbound: {
          type: "landing",
          fromDate: arrival.fromDate || join.returnDate || join.departureDate,
          fromTime: arrival.fromTime || getClock(arrival, join.returnDate || join.departureDate),
          fromCity: arrival.fromCity || inboundCity,
          toDate: arrival.toDate || arrival.fromDate || join.returnDate || join.departureDate,
          toTime: arrival.toTime || "",
          toCity: arrival.toCity || returnAirport
        }
      };
    }

    function getDetailScheduleSearchText(item = {}) {
      return cleanSecretTourDetailText([
        item.rawText,
        item.content,
        item.extra?.hotel,
        ...(Array.isArray(item.extra?.meals) ? item.extra.meals.map((meal) => `${meal.label || ""} ${meal.menu || ""}`) : [])
      ].filter(Boolean).join(" "));
    }

    function extractAirportNamesFromScheduleText(text = "") {
      const source = cleanSecretTourDetailText(text);
      if (!source) return [];
      const airportPattern = /([가-힣A-Za-z]+?)\s*(?:국제)?공항/g;
      const direct = [...source.matchAll(airportPattern)]
        .map((match) => cleanSecretTourDetailText(match[1]))
        .filter((name) => name && name !== "국제")
        .filter(Boolean);
      const placeNames = extractFlightRoutePlaces(source);
      return [...new Set([...direct, ...placeNames])];
    }

    function getDetailAirportsFromSchedule(join = {}) {
      const scheduleDepartureAirport = inferSecretTourDepartureAirportFromSchedule(join.schedule);
      const explicitDepartureAirport = normalizeSecretTourAirportName(join.departureAirport, join.airport);
      const explicitArrivalAirport = String(join.arrivalAirport || "").trim();
      const schedule = Array.isArray(join.schedule) ? join.schedule : [];
      if (!schedule.length) {
        return {
          departureAirport: explicitDepartureAirport,
          arrivalAirport: explicitArrivalAirport,
          returnDepartureAirport: explicitArrivalAirport,
          returnArrivalAirport: explicitDepartureAirport
        };
      }
      const firstText = getDetailScheduleSearchText(schedule[0]);
      const lastText = getDetailScheduleSearchText(schedule[schedule.length - 1]);
      const prevLastText = schedule.length > 1 ? getDetailScheduleSearchText(schedule[schedule.length - 2]) : "";
      const firstAirports = extractAirportNamesFromScheduleText(firstText);
      const lastAirports = extractAirportNamesFromScheduleText(lastText);
      const prevLastAirports = extractAirportNamesFromScheduleText(prevLastText);
      const returnAirports = lastAirports.length ? lastAirports : prevLastAirports;
      return {
        departureAirport: scheduleDepartureAirport || explicitDepartureAirport || firstAirports[0] || "",
        arrivalAirport: explicitArrivalAirport || firstAirports[1] || "",
        returnDepartureAirport: explicitArrivalAirport || (returnAirports.length > 1 ? returnAirports[0] : ""),
        returnArrivalAirport: explicitDepartureAirport || (returnAirports.length > 1 ? returnAirports[returnAirports.length - 1] : (returnAirports[0] || ""))
      };
    }

    function normalizeDetailFlightDateText(dateText = "", fallbackDate = "") {
      const source = String(dateText || "").trim();
      const fallback = fallbackDate ? new Date(`${fallbackDate}T00:00:00`) : null;
      const year = fallback && !Number.isNaN(fallback.getTime()) ? fallback.getFullYear() : new Date().getFullYear();
      const dateMatch = source.match(/(?:(\d{4})[.\/-])?(\d{1,2})[.\/-](\d{1,2})/);
      const date = dateMatch
        ? new Date(`${dateMatch[1] || year}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}T00:00:00`)
        : fallback;
      if (!date || Number.isNaN(date.getTime())) return "";
      const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}(${weekDays[date.getDay()]})`;
    }

    function normalizeDetailFlightTimeText(timeText = "") {
      return extractFlightTimeParts(timeText)[0] || "";
    }

    function formatDetailFlightPointTime(timeText) {
      const time = normalizeDetailFlightTimeText(timeText);
      return time || "";
    }

    function renderDetailFlightAirlineImage(code = "") {
      const normalizedCode = String(code || "").trim().slice(0, 2).toLowerCase();
      if (!/^[a-z0-9]{2}$/.test(normalizedCode)) return "";
      const src = `https://storage.googleapis.com/golfjoin-bucket/golfjoin_img/air_${normalizedCode}.png`;
      return `<img class="detail-flight-airline-image" src="${src}" alt="" aria-hidden="true" onerror="this.hidden=true">`;
    }

    function renderDetailFlightRouteIcon(type) {
      if (type === "landing") {
        return `<svg xmlns="http://www.w3.org/2000/svg" class="detail-flight-route-icon lucide lucide-plane-landing-icon lucide-plane-landing" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 22h20"/><path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z"/></svg>`;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" class="detail-flight-route-icon lucide lucide-plane-takeoff-icon lucide-plane-takeoff" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 22h20"/><path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z"/></svg>`;
    }

    function formatDetailFlightRouteCity(city = "") {
      const text = cleanSecretTourDetailText(city);
      if (!text) return "";
      const countries = new Set();
      (regionTree || []).forEach((category) => {
        (category.countries || []).forEach((country) => {
          if (country.name) countries.add(String(country.name).trim());
        });
      });
      const commaParts = text.split(",").map((part) => part.trim()).filter(Boolean);
      if (commaParts.length > 1) {
        const regionParts = commaParts.filter((part) => !countries.has(part));
        if (regionParts.length) return regionParts[0];
      }
      for (const country of countries) {
        if (text.startsWith(`${country} `)) return text.slice(country.length).trim() || text;
        if (text.endsWith(` ${country}`)) return text.slice(0, -country.length).trim() || text;
      }
      return text;
    }

    function renderDetailFlightRoutePoint(city, dateTime, reverse = false) {
      const displayCity = formatDetailFlightRouteCity(city);
      const cityHtml = `<div class="detail-flight-route-city">${escapeHtml(displayCity || "확인 필요")}</div>`;
      const timeHtml = dateTime ? `<div class="detail-flight-route-time">${escapeHtml(dateTime)}</div>` : "";
      return `
        <div class="detail-flight-route-point">
          ${reverse ? `${timeHtml}${cityHtml}` : `${cityHtml}${timeHtml}`}
        </div>
      `;
    }

    function renderDetailFlightRouteRow(route) {
      const fromTime = formatDetailFlightPointTime(route.fromTime);
      const toTime = formatDetailFlightPointTime(route.toTime);
      return `
        <div class="detail-flight-route-row">
          ${renderDetailFlightRoutePoint(route.fromCity, fromTime)}
          <div class="detail-flight-arrow" aria-hidden="true"></div>
          ${renderDetailFlightRoutePoint(route.toCity, toTime, true)}
        </div>
      `;
    }

    function renderDetailFlightSummary(join = {}) {
      if (getDetailProductType(join) === "골프팩") {
        return `
          <div class="detail-flight-separate-card">
            <div class="detail-flight-separate-title">항공 별도</div>
            <div>항공권은 포함되지 않은 상품입니다.<br>원하시는 항공편을 직접 예약하시거나, 시크릿투어를 통해 항공 예약 및 발권 대행을 요청하실 수 있습니다.</div>
          </div>
        `;
      }
      if (join.secretTourFlightScheduleState === "loading") {
        return `
          <div class="detail-flight-status-card is-loading" role="status" aria-live="polite">
            <div class="detail-flight-status-title">항공편 확인 중</div>
            <div>상품상세는 먼저 확인할 수 있습니다. 항공정보가 도착하면 이 영역만 자동으로 갱신됩니다.</div>
          </div>
        `;
      }
      if (["timeout", "failed", "unavailable"].includes(join.secretTourFlightScheduleState)) {
        return `
          <div class="detail-flight-status-card" role="status">
            <div class="detail-flight-status-title">항공편 정보 확인 필요</div>
            <div>항공일정 응답이 지연되고 있습니다. 나머지 상품상세는 정상적으로 이용할 수 있습니다.</div>
          </div>
        `;
      }
      if (!(join.category === "해외" || join.departureAirport || join.airport || getFlightInfo(join))) return "확인 필요";
      const flight = getDetailFlightRouteParts(join);
      return `
        <div class="detail-flight-summary-card">
          <div class="detail-flight-summary-head">
            <div class="detail-flight-summary-airline">${renderDetailFlightAirlineImage(flight.airlineCode)}${escapeHtml(flight.airline)}</div>
          </div>
          <div class="detail-flight-summary-body">
            ${renderDetailFlightRouteRow(flight.outbound)}
            ${renderDetailFlightRouteRow(flight.inbound)}
          </div>
        </div>
      `;
    }

    function formatDetailSummaryDateWithDay(dateString) {
      if (!dateString) return "";
      const date = new Date(`${dateString}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      const weekDays = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}(${weekDays[date.getDay()]})`;
    }

    function formatDetailTravelSchedule(join = {}) {
      const departure = formatDetailSummaryDateWithDay(join.departureDate);
      const arrival = formatDetailSummaryDateWithDay(join.returnDate || join.departureDate);
      if (departure && arrival) return `${departure} ~ ${arrival}`;
      return departure || arrival || "확인 필요";
    }

    function renderDetailSummaryInfo(join = {}) {
      return `
        <div class="detail-section" data-detail-section="summary">
          <div class="detail-section-heading">상품 요약 정보</div>
          <div class="detail-summary-card">
            <div class="detail-summary-grid">
              <div class="detail-summary-label">상품유형</div>
              <div class="detail-summary-value">${escapeHtml(getDetailProductType(join))}</div>
              <div class="detail-summary-label">여행기간</div>
              <div class="detail-summary-value">${escapeHtml(formatDetailDurationCompact(join))}</div>
              <div class="detail-summary-label">여행일정</div>
              <div class="detail-summary-value">${escapeHtml(formatDetailTravelSchedule(join))}</div>
              <div class="detail-summary-label">출발지역</div>
              <div class="detail-summary-value">${escapeHtml(getDetailDepartureRegion(join))}</div>
              <div class="detail-summary-label">방문지역</div>
              <div class="detail-summary-value">${escapeHtml(formatDetailRegionValue(join))}</div>
            </div>
          </div>
        </div>
      `;
    }

    function renderDetailFlightSection(join = {}) {
      return `
        <div class="detail-section" data-detail-section="flight">
          <div class="detail-section-heading">항공정보</div>
          <div class="detail-summary-flight-card">${renderDetailFlightSummary(join)}</div>
        </div>
      `;
    }

    function renderDetailInclusionBox(title, items, type) {
      const icon = type === "include"
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-circle-icon lucide-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-x-icon lucide-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
      const dot = `<svg xmlns="http://www.w3.org/2000/svg" class="detail-list-dot" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle></svg>`;
      const list = (items && items.length ? items : ["상품 상세 확인 후 안내드립니다."]).map((item) => `<li><div class="detail-list-item">${dot}<div class="detail-list-text">${escapeHtml(item)}</div></div></li>`).join("");
      return `
        <div class="detail-info-box">
          <div class="detail-info-box-title ${type}">${icon}${title}</div>
          <ul class="detail-list">${list}</ul>
        </div>
      `;
    }

    function renderDetailInclusionSection(join = {}) {
      return `
        <div class="detail-section" data-detail-section="includes">
          <div class="detail-section-heading">포함 · 불포함사항</div>
          <div class="detail-inclusion-grid">
            ${renderDetailInclusionBox("포함사항", join.includes || [], "include")}
            ${renderDetailInclusionBox("불포함사항", join.excludes || [], "exclude")}
          </div>
        </div>
      `;
    }

    function renderDetailNotesSection(join = {}) {
      return `
        <div class="detail-section">
          <div class="detail-section-heading">참고사항</div>
          ${renderDetailNotes(join.notes || [])}
        </div>
      `;
    }

    function renderDetailSafetyInfo() {
      return `
        <div class="detail-section">
          <div class="detail-section-heading">외교부 해외여행 안전정보</div>
          <a class="detail-safety-link" href="https://www.0404.go.kr/ntnSafetyInfo/list" target="_blank" rel="noopener">
            <div>
              <div class="detail-safety-link-title">국가별 안전정보 확인하기</div>
              <div class="detail-safety-link-source">외교부 해외안전여행</div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-chevron-right-icon lucide-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
          </a>
        </div>
      `;
    }

    function getDetailSlides(join) {
      if (Array.isArray(join.slides) && join.slides.length) {
        return join.slides;
      }
      return [
        join.image,
        "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC1.jpg",
        "https://cauhemhvdwlkxalwxxxq.supabase.co/storage/v1/object/public/product-images/productCC2.jpg"
      ];
    }

    function getDetailIntroImages(join) {
      if (Array.isArray(join.introImages) && join.introImages.length) {
        return join.introImages;
      }
      return getDetailSlides(join);
    }

    function daysUntil(dateString) {
      const today = getTodayDate();
      const target = parseJoinDate(dateString);
      return Math.floor((target - today) / (1000 * 60 * 60 * 24));
    }

    function matchesPeriod(join) {
      const diff = daysUntil(join.departureDate);
      const today = getTodayDate();
      const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
      if (state.period === "departure-soon") return join.emptySlots <= 1;
      if (state.period === "this-month") return join.departureDate.startsWith(thisMonth);
      if (state.period === "next-month") return join.departureDate.startsWith(nextMonth);
      if (state.period === "three-months") return diff >= 0 && diff <= 92;
      return true;
    }

    function sortJoins(items) {
      const list = [...items];
      if (window.matchMedia("(max-width: 640px)").matches) {
        list.sort((a, b) => (
          a.price - b.price ||
          new Date(a.departureDate) - new Date(b.departureDate) ||
          getConfirmedParticipants(b).length - getConfirmedParticipants(a).length
        ));
      } else if (state.sort === "price-asc") {
        list.sort((a, b) => a.price - b.price);
      } else if (state.sort === "seats-desc") {
        list.sort((a, b) => b.emptySlots - a.emptySlots || a.price - b.price);
      } else {
        list.sort((a, b) => new Date(a.departureDate) - new Date(b.departureDate));
      }
      return list;
    }

    function getMonthKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }

    function addMonths(date, amount) {
      return new Date(date.getFullYear(), date.getMonth() + amount, 1);
    }

    let calendarViewMonth = null;
    let calendarMobileSelectionSort = "region";
    let calendarEmptyScheduleDate = "";
    let calendarEmptyScheduleOpenedAt = 0;

    function getISODateKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function getCalendarMonthBounds() {
      const today = getTodayDate();
      const minDeparture = new Date(`${getBuilderMinDepartureISO()}T00:00:00`);
      const minDepartureMonth = new Date(minDeparture.getFullYear(), minDeparture.getMonth(), 1);
      const visibleJoins = getVisibleCalendarJoinProducts();
      const fallbackDate = visibleJoins[0]?.departureDate || getBuilderMinDepartureISO();
      const builderBounds = getBuilderProductDateBounds();
      const minDate = visibleJoins.reduce((earliest, join) => {
        const candidate = new Date(join.departureDate + "T00:00:00");
        return candidate < earliest ? candidate : earliest;
      }, new Date((builderBounds.startDate || fallbackDate) + "T00:00:00"));
      const maxDate = visibleJoins.reduce((latest, join) => {
        const candidate = new Date((join.returnDate || join.departureDate) + "T00:00:00");
        return candidate > latest ? candidate : latest;
      }, new Date((builderBounds.endDate || fallbackDate) + "T00:00:00"));
      const fallbackMaxDate = new Date(minDeparture);
      fallbackMaxDate.setMonth(fallbackMaxDate.getMonth() + 6);
      const boundedMaxDate = maxDate > today ? maxDate : fallbackMaxDate;
      const dataStartMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      const dataEndMonth = new Date(boundedMaxDate.getFullYear(), boundedMaxDate.getMonth(), 1);
      const startMonth = dataStartMonth > minDepartureMonth ? dataStartMonth : minDepartureMonth;
      const endMonth = dataEndMonth > startMonth ? dataEndMonth : startMonth;
      return {
        startMonth,
        endMonth
      };
    }

    function isCalendarDesktopMode() {
      return !window.matchMedia("(max-width: 640px)").matches;
    }

    function clampCalendarViewMonth(startMonth, endMonth) {
      if (!calendarViewMonth) {
        const today = getTodayDate();
        calendarViewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      }
      if (getMonthKey(calendarViewMonth) < getMonthKey(startMonth)) {
        calendarViewMonth = new Date(startMonth);
      }
      if (getMonthKey(calendarViewMonth) > getMonthKey(endMonth)) {
        calendarViewMonth = new Date(endMonth);
      }
    }

    function changeCalendarMonth(direction) {
      const { startMonth, endMonth } = getCalendarMonthBounds();
      clampCalendarViewMonth(startMonth, endMonth);
      const nextMonth = addMonths(calendarViewMonth, direction);
      if (getMonthKey(nextMonth) < getMonthKey(startMonth) || getMonthKey(nextMonth) > getMonthKey(endMonth)) return;
      calendarViewMonth = nextMonth;
      if (isCalendarDesktopMode() && document.getElementById("calendarSheetBody")?.classList.contains("desktop-date-selected")) {
        refreshCalendarDesktopSelectedMonth();
        return;
      }
      renderCalendarSheet();
    }

    function getJoinEventsByDate() {
      return getVisibleCalendarJoinProducts().reduce((map, join) => {
        const key = join.departureDate;
        if (!map[key]) map[key] = [];
        map[key].push(join);
        return map;
      }, {});
    }

    function hasJoinEventsInMonth(monthDate) {
      const monthKey = getMonthKey(monthDate);
      return getVisibleCalendarJoinProducts().some((join) => String(join.departureDate || "").startsWith(monthKey));
    }

    function isCalendarBuilderDepartureSelectable(date) {
      const iso = getISODateKey(date);
      if (iso < getBuilderMinDepartureISO()) return false;
      const { startDate, endDate } = getBuilderProductDateBounds();
      if (startDate && iso < startDate) return false;
      if (endDate && iso > endDate) return false;
      const products = getBuilderRegisteredProductsForDateSelection();
      if (products.length) return products.some((product) => product.departureDate === iso);
      return true;
    }

    function hasCalendarActiveDatesInMonth(monthDate, eventsByDate = getJoinEventsByDate()) {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const last = new Date(year, month + 1, 0);
      for (let day = 1; day <= last.getDate(); day += 1) {
        const date = new Date(year, month, day);
        const dateKey = getISODateKey(date);
        if ((eventsByDate[dateKey] || []).length || isCalendarBuilderDepartureSelectable(date)) return true;
      }
      return false;
    }

    function getKoreanHolidayMap(year) {
      const holidays = {
        2026: {
          "2026-01-01": "신정",
          "2026-02-16": "설날",
          "2026-02-17": "설날",
          "2026-02-18": "설날",
          "2026-03-01": "삼일절",
          "2026-03-02": "대체공휴일",
          "2026-05-05": "어린이날",
          "2026-05-24": "부처님오신날",
          "2026-05-25": "대체공휴일",
          "2026-06-06": "현충일",
          "2026-08-15": "광복절",
          "2026-08-17": "대체공휴일",
          "2026-09-24": "추석",
          "2026-09-25": "추석",
          "2026-09-26": "추석",
          "2026-10-03": "개천절",
          "2026-10-05": "대체공휴일",
          "2026-10-09": "한글날",
          "2026-12-25": "성탄절"
        }
      };
      return new Map(Object.entries(holidays[year] || {}));
    }

    function getKoreanHolidaySet(year) {
      return new Set(getKoreanHolidayMap(year).keys());
    }

    function getJoinCategoryClass(join) {
      return join.category === "해외" || Boolean(join.departureAirport || join.airport) ? "overseas" : "domestic";
    }

    function isJoinFullyBooked(join = {}) {
      const capacity = getJoinRecruitmentCapacity(join, JOIN_MAX_CAPACITY);
      const summaryCount = Number(join.participantSummary?.confirmedCount ?? join.lightSummary?.confirmedCount);
      const confirmedCount = Number.isFinite(summaryCount) ? Math.max(0, summaryCount) : getConfirmedParticipants(join).length;
      if (isMonthlyRecommendationJoin(join) || capacity > JOIN_MAX_CAPACITY) {
        const emptySlots = Number(join.emptySlots);
        return confirmedCount >= capacity || (Number.isFinite(emptySlots) && emptySlots <= 0);
      }
      const emptySlots = Number(join.emptySlots);
      if (Number.isFinite(emptySlots) && emptySlots <= 0) return true;
      return confirmedCount >= JOIN_MAX_CAPACITY;
    }

    function shouldDisplayJoinProduct(join = {}) {
      if (isJoinFullyBooked(join)) return false;
      if (join.isAdminRecommendedSchedule) return true;
      return SHOW_DOMESTIC_JOIN_PRODUCTS || getJoinCategoryClass(join) !== "domestic";
    }

    function getVisibleJoinProducts(items = joins) {
      return (items || []).filter(shouldDisplayJoinProduct);
    }

    function getVisibleCalendarJoinProducts(items = joins) {
      const minDepartureISO = getBuilderMinDepartureISO();
      return getVisibleJoinProducts(items).filter((join) => String(join.departureDate || "") >= minDepartureISO);
    }

    function renderJoinCategoryChip(join) {
      const categoryClass = getJoinCategoryClass(join);
      const label = categoryClass === "overseas" ? "해외" : "국내";
      return `<div class="join-category-chip ${categoryClass}">${label}</div>`;
    }

    function isIndividualAirProduct(join = {}) {
      if (isIndividualAirName(join.air2CdNm) || isIndividualAirName(join.air2Nm) || isIndividualAirName(join.airline) || isIndividualAirCode(join.air2Cd)) return true;
      const source = [
        join.airline,
        join.air2Nm,
        join.air2CdNm,
        join.airlineType,
        join.flightType,
        join.transportType,
        join.dayNightCnt,
        join.duration,
        join.goodDescription,
        join.title,
        ...[].concat(join.includes || []),
        ...[].concat(join.excludes || []),
        ...[].concat(join.notes || [])
      ].join(" ");
      return /개[별발]\s*항공|개별\s*출발|항공\s*불포함/i.test(source);
    }

    function isIndividualAirName(value) {
      return /개별\s*항공/.test(String(value || "").trim());
    }

    function isIndividualAirCode(value) {
      return String(value || "").trim().toUpperCase() === "XX";
    }

    function hasRoundTripFlightInclude(join = {}) {
      const includesText = [].concat(join.includes || []).join(" ");
      return /왕복\s*항공|왕복항공권|항공권\s*\([^)]*포함\)|항공권\s*포함/i.test(includesText);
    }

    function hasIncludedFlight(join = {}) {
      if (hasRoundTripFlightInclude(join)) return true;
      if (isIndividualAirProduct(join)) return false;
      const includes = [].concat(join.includes || []).filter(Boolean);
      if (includes.length) return false;
      return /\[\s*항공팩|항공팩|왕복\s*항공|왕복항공권|항공권\s*포함/i.test(String(join.title || ""));
    }

    function renderJoinFlightChip(join) {
      const isIncluded = hasIncludedFlight(join);
      return `<div class="join-flight-chip ${isIncluded ? "included" : "excluded"}">${isIncluded ? "항공포함" : "항공불포함"}</div>`;
    }

    function getJoinAirportDepartureLabel(join = {}) {
      const airport = String(join.departureAirport || join.airport || "").trim();
      if (isIndividualAirProduct(join)) return "";
      if (!airport) return join.category === "해외" ? "출발공항 확인 필요" : "";
      return `${airport}출발`;
    }

    function getJoinRegionLabel(join = {}) {
      return String(join.region || "")
        .split(",")[0]
        .trim();
    }

    function getJoinLocationLabel(join = {}) {
      return [getJoinRegionLabel(join), getJoinAirportDepartureLabel(join)].filter(Boolean).join(" · ");
    }

    function getRegionProductLocationLabel(join = {}) {
      const region = getJoinRegionLabel(join);
      const country = inferDetailCountryName(region, join);
      const regionCountry = [region, country]
        .map((value) => String(value || "").trim())
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join(" ");
      return [regionCountry || region || country, getJoinAirportDepartureLabel(join)].filter(Boolean).join(" · ");
    }

    function getApplyJoinLocationLabel(join = {}) {
      const explicitLocation = String(join.countryRegion || "").replace(/\s*,\s*/g, " ").trim();
      if (explicitLocation) return explicitLocation;
      const departureWords = ["인천", "김포", "부산", "김해", "대구", "청주", "무안", "제주", "양양"];
      const parts = String(join.region || join.category || "")
        .split(",")
        .map((part) => part.trim())
        .filter((part) => {
          if (!part) return false;
          const compact = part.replace(/\s+/g, "");
          return !departureWords.some((word) => compact === `${word}출발` || compact === word);
        });
      const countryNames = (regionTree || [])
        .flatMap((category) => category.countries || [])
        .map((country) => country.name)
        .filter(Boolean);
      if (parts.length >= 2) {
        const first = parts[0];
        const last = parts[parts.length - 1];
        if (countryNames.includes(first)) return [first, ...parts.slice(1)].join(" ");
        if (countryNames.includes(last)) return [last, ...parts.slice(0, -1)].join(" ");
        return parts.join(" ");
      }
      const region = parts[0] || getJoinRegionLabel(join);
      if (!region) return "";
      for (const category of (regionTree || [])) {
        for (const country of (category.countries || [])) {
          if (region === country.name) return country.name;
          if ((country.cities || []).includes(region)) return `${country.name} ${region}`;
        }
      }
      return region;
    }

    function getApplyJoinCountryName(join = {}) {
      const direct = String(join.country || join.countryName || join.nation || join.productCountry || join.erpCountry || "").trim();
      if (direct) return direct;
      const location = getApplyJoinLocationLabel(join);
      const countryNames = (regionTree || [])
        .flatMap((category) => category.countries || [])
        .map((country) => country.name)
        .filter(Boolean);
      const locationParts = String(location || "")
        .replace(/\s*,\s*/g, " ")
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      const locationCountry = locationParts.find((part) => countryNames.includes(part));
      if (locationCountry) return locationCountry;
      const region = getJoinRegionLabel(join);
      return inferDetailCountryName(region || location, join);
    }

    function getCalendarEventSummary(events) {
      return events.reduce((summary, join) => {
        if (isMonthlyRecommendationJoin(join)) {
          summary.monthly += 1;
          return summary;
        }
        const key = getJoinCategoryClass(join);
        summary[key] += 1;
        return summary;
      }, { monthly: 0, domestic: 0, overseas: 0 });
    }

    function formatCalendarAccordionDate(dateKey) {
      const date = new Date(`${dateKey}T00:00:00`);
      const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}.${date.getDate()} (${dayNames[date.getDay()]})`;
    }

    function renderCalendarProductCards(events) {
      return events.map((join) => renderRegionProductCard(join, { showDetailButton: true })).join("");
    }

    function getCalendarSortedEvents(events, sort = calendarMobileSelectionSort) {
      return [...events].sort((a, b) => {
        if (sort === "price-asc") {
          return (Number(a.price) || 0) - (Number(b.price) || 0) || String(a.region || "").localeCompare(String(b.region || ""), "ko");
        }
        return String(a.region || "").localeCompare(String(b.region || ""), "ko") || (Number(a.price) || 0) - (Number(b.price) || 0);
      });
    }

    function renderCalendarSelectionHeader(dateKey) {
      return `
        <div class="calendar-selection-head">
          <div class="detail-section-title" style="margin:0;">${formatCalendarAccordionDate(dateKey)}</div>
          <div class="calendar-selection-sort" aria-label="일정 정렬">
            <button type="button" class="${calendarMobileSelectionSort === "region" ? "active" : ""}" onclick="setCalendarMobileSelectionSort('region')">지역순</button>
            <span class="calendar-selection-sort-divider" aria-hidden="true"></span>
            <button type="button" class="${calendarMobileSelectionSort === "price-asc" ? "active" : ""}" onclick="setCalendarMobileSelectionSort('price-asc')">가격낮은순</button>
          </div>
        </div>
      `;
    }

    function setCalendarMobileSelectionSort(sort) {
      calendarMobileSelectionSort = sort === "price-asc" ? "price-asc" : "region";
      const body = document.getElementById("calendarSheetBody");
      const dateKey = body?.dataset.mobileSelectedDate;
      const monthKey = body?.dataset.mobileSelectedMonth;
      if (!dateKey || !monthKey) return;
      openCalendarMobileSelection(monthKey, dateKey, getJoinEventsByDate()[dateKey] || []);
    }

    function renderCalendarWeekdayLabels() {
      const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
      return dayLabels.map((label, index) => `<div class="calendar-label${index === 0 ? " sunday" : ""}">${label}</div>`).join("");
    }

    function formatCalendarMonthTitle(date) {
      return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    }

    function renderCalendarAvailabilityLegend() {
      return `
        <div class="calendar-availability-legend" aria-label="초록색 원은 참여가능한 모임이 있는 날짜를 뜻합니다">
          <div class="calendar-availability-legend-dot" aria-hidden="true"></div>
          <div>참여가능</div>
        </div>
      `;
    }

    function renderCalendarMobileSticky(monthDate) {
      return `
        <div class="calendar-mobile-sticky" id="calendarMobileSticky">
          <div class="calendar-mobile-month-head">
            ${renderCalendarAvailabilityLegend()}
            <div class="calendar-mobile-month-label" id="calendarMobileMonthLabel">${formatCalendarMonthTitle(monthDate)}</div>
          </div>
          <div class="calendar-grid">${renderCalendarWeekdayLabels()}</div>
        </div>
      `;
    }

    function renderCalendarMobileSelectionShell() {
      return `
        <div class="calendar-mobile-selection" id="calendarMobileSelection"></div>
      `;
    }

    function renderCalendarDesktopSelectionShell() {
      return `
        <div class="calendar-desktop-selection" id="calendarDesktopSelection"></div>
      `;
    }

    function updateCalendarMobileMonthLabel() {
      if (isCalendarDesktopMode()) return;
      const body = document.getElementById("calendarSheetBody");
      const label = document.getElementById("calendarMobileMonthLabel");
      if (!body || !label) return;
      const months = document.getElementById("calendarMobileMonths");
      const isExpandedCalendar = body.classList.contains("calendar-calendar-expanded") && months;
      const scrollArea = isExpandedCalendar ? months : body;
      const sections = Array.from(scrollArea.querySelectorAll(".calendar-month[data-month-label]"));
      if (!sections.length) return;
      if (body.classList.contains("mobile-date-selected") && !isExpandedCalendar && body.dataset.mobileSelectedDate) {
        const selectedDate = new Date(`${body.dataset.mobileSelectedDate}T00:00:00`);
        const selectedLabel = formatCalendarMonthTitle(selectedDate);
        if (label.textContent !== selectedLabel) label.textContent = selectedLabel;
        return;
      }
      const sticky = document.getElementById("calendarMobileSticky");
      const switchLine = (sticky || scrollArea).getBoundingClientRect().bottom + 1;
      let activeLabel = sections[0].dataset.monthLabel;

      sections.forEach((section) => {
        const targetTop = section.getBoundingClientRect().top;
        if (targetTop <= switchLine) {
          activeLabel = section.dataset.monthLabel;
        }
      });

      if (activeLabel && label.textContent !== activeLabel) {
        label.textContent = activeLabel;
      }
    }

    function alignCalendarAccordionToHeader(accordion) {
      const body = document.getElementById("calendarSheetBody");
      const target = isCalendarDesktopMode()
        ? document.getElementById(`calendarWeek-${accordion?.id.replace("calendarAccordion-", "")}`)
        : accordion?.querySelector(".calendar-accordion-list");
      if (!body || !target) return;
      const sticky = isCalendarDesktopMode()
        ? accordion.closest(".calendar-month")?.querySelector(".calendar-grid")
        : document.getElementById("calendarMobileSticky");
      const monthTitle = isCalendarDesktopMode()
        ? accordion.closest(".calendar-month")?.querySelector(".calendar-month-title")
        : null;
      const stickyHeight = (sticky?.offsetHeight || 0) + (monthTitle?.offsetHeight || 0);
      const bodyRect = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = body.scrollTop + targetRect.top - bodyRect.top - stickyHeight;
      body.scrollTo({
        top: Math.max(0, nextTop),
        behavior: "smooth"
      });
    }

    function clearCalendarMobileSelection() {
      const body = document.getElementById("calendarSheetBody");
      const selection = document.getElementById("calendarMobileSelection");
      body?.classList.remove("mobile-date-selected", "calendar-calendar-expanded");
      if (body) {
        delete body.dataset.mobileSelectedDate;
        delete body.dataset.mobileSelectedMonth;
      }
      if (selection) selection.innerHTML = "";
    }

    function clearCalendarDesktopSelection() {
      const body = document.getElementById("calendarSheetBody");
      const selection = document.getElementById("calendarDesktopSelection");
      body?.classList.remove("desktop-date-selected", "desktop-calendar-expanded", "desktop-calendar-collapsing");
      if (body) {
        delete body.dataset.desktopSelectedDate;
        delete body.dataset.desktopSelectedMonth;
      }
      if (selection) selection.innerHTML = "";
    }

    function closeCalendarEmptyScheduleSheet() {
      const sheet = document.getElementById("calendarEmptyScheduleSheet");
      resetModalRuntimeState(sheet);
      sheet?.classList.remove("open");
      calendarEmptyScheduleDate = "";
      calendarEmptyScheduleOpenedAt = 0;
    }

    function openCalendarEmptyScheduleSheet(dateKey) {
      calendarEmptyScheduleDate = dateKey;
      calendarEmptyScheduleOpenedAt = Date.now();
      clearCalendarMobileSelection();
      clearCalendarDesktopSelection();
      document.querySelectorAll(".calendar-accordion").forEach((item) => {
        item.classList.remove("open");
        item.innerHTML = "";
        delete item.dataset.dateKey;
      });
      document.getElementById("calendarEmptyScheduleSheet")?.classList.add("open");
    }

    function applyBuilderStartDateFromISO(dateKey) {
      if (!dateKey) return;
      const date = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      builderState.viewYear = date.getFullYear();
      builderState.viewMonth = date.getMonth();
      builderState.startDay = date.getDate();
      builderState.endDay = null;
      builderState.startBefore = 0;
      builderState.startAfter = 0;
      builderState.endBefore = 0;
      builderState.endAfter = 0;
      builderState.durationFilter = "";
      clearBuilderProductForDateChange();
      renderBuilderCalendar();
      updateBuilderSummary();
      updateBuilderNotice();
    }

    function openBuilderFromCalendarEmptyDate() {
      const selectedDate = calendarEmptyScheduleDate;
      closeCalendarEmptyScheduleSheet();
      closeCalendarSheet();
      openModal("builderModal");
      applyBuilderStartDateFromISO(selectedDate);
    }

    function toggleMobileCalendarArea() {
      const body = document.getElementById("calendarSheetBody");
      if (!body) return;
      body.classList.toggle("calendar-calendar-expanded");
      updateMobileExpandedCalendarHeight();
      updateCalendarMobileMonthLabel();
    }

    function toggleDesktopCalendarArea() {
      const body = document.getElementById("calendarSheetBody");
      if (!body) return;
      const willOpen = !body.classList.contains("desktop-calendar-expanded");
      window.clearTimeout(body._calendarDesktopCollapseTimer);
      body.classList.remove("desktop-calendar-collapsing");
      if (willOpen) {
        body.classList.add("desktop-calendar-expanded");
      } else {
        body.classList.remove("desktop-calendar-expanded");
      }
      body.scrollTop = 0;
    }

    function openCalendarMobileSelection(monthKey, dateKey, events) {
      const body = document.getElementById("calendarSheetBody");
      const selection = document.getElementById("calendarMobileSelection");
      const week = document.getElementById(`calendarWeek-${monthKey}`);
      if (!body || !selection || !week) return false;
      const section = week.closest(".calendar-month");
      const monthLabel = section?.dataset.monthLabel || "";
      const label = document.getElementById("calendarMobileMonthLabel");
      if (label && monthLabel) label.textContent = monthLabel;
      body.dataset.mobileSelectedDate = dateKey;
      body.dataset.mobileSelectedMonth = monthKey;
      selection.innerHTML = `
        <div class="calendar-mobile-selected-week">
          <div class="calendar-week">${week.innerHTML}</div>
        </div>
        <button type="button" class="calendar-mobile-toggle" onclick="toggleMobileCalendarArea()" aria-label="캘린더 영역 열기 또는 닫기">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="calendar-mobile-selected-panel">
          <div class="calendar-accordion-list">
            ${renderCalendarSelectionHeader(dateKey)}
            ${renderCalendarProductCards(getCalendarSortedEvents(events))}
          </div>
        </div>
      `;
      body.classList.add("mobile-date-selected");
      body.classList.remove("calendar-calendar-expanded");
      updateMobileExpandedCalendarHeight();
      body.scrollTop = 0;
      return true;
    }

    function renderCalendarDesktopSelectedMonth() {
      const { startMonth, endMonth } = getCalendarMonthBounds();
      clampCalendarViewMonth(startMonth, endMonth);
      return renderCalendarMonth(calendarViewMonth, getJoinEventsByDate(), {
        showMonthNav: true,
        forceSixWeeks: true,
        startMonth,
        endMonth
      });
    }

    function renderCalendarDesktopSelectedHeader() {
      const { startMonth, endMonth } = getCalendarMonthBounds();
      const year = calendarViewMonth.getFullYear();
      const month = calendarViewMonth.getMonth();
      const monthKey = getMonthKey(calendarViewMonth);
      const isPrevDisabled = monthKey <= getMonthKey(startMonth);
      const isNextDisabled = monthKey >= getMonthKey(endMonth);
      return `
        <div class="calendar-month-title has-availability-legend">
          ${renderCalendarAvailabilityLegend()}
          <div class="calendar-month-navigation">
            <button type="button" class="calendar-month-nav prev" onclick="changeCalendarMonth(-1)" ${isPrevDisabled ? "disabled" : ""} aria-label="이전 달">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div class="calendar-month-nav-label">이전 달</div>
            </button>
            <div class="calendar-month-label">${year}년 ${month + 1}월</div>
            <button type="button" class="calendar-month-nav next" onclick="changeCalendarMonth(1)" ${isNextDisabled ? "disabled" : ""} aria-label="다음 달">
              <div class="calendar-month-nav-label">다음 달</div>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div class="calendar-grid">${renderCalendarWeekdayLabels()}</div>
      `;
    }

    function refreshCalendarDesktopSelectedMonth() {
      const body = document.getElementById("calendarSheetBody");
      if (!body) return;
      const header = body.querySelector(".calendar-desktop-selected-header");
      const months = document.getElementById("calendarDesktopSelectedMonths");
      if (header) header.innerHTML = renderCalendarDesktopSelectedHeader();
      if (months) months.innerHTML = renderCalendarDesktopSelectedMonth();
    }

    function openCalendarDesktopSelection(monthKey, dateKey, events) {
      const body = document.getElementById("calendarSheetBody");
      const selection = document.getElementById("calendarDesktopSelection");
      const week = document.getElementById(`calendarWeek-${monthKey}`);
      if (!body || !selection || !week) return false;
      window.clearTimeout(body._calendarDesktopCollapseTimer);
      body.classList.remove("desktop-calendar-collapsing");
      calendarViewMonth = new Date(`${dateKey.slice(0, 7)}-01T00:00:00`);
      body.dataset.desktopSelectedDate = dateKey;
      body.dataset.desktopSelectedMonth = monthKey;
      selection.innerHTML = `
        <div class="calendar-desktop-selected-header">
          ${renderCalendarDesktopSelectedHeader()}
        </div>
        <div class="calendar-desktop-selected-week">
          <div class="calendar-week">${week.innerHTML}</div>
        </div>
        <div class="calendar-desktop-selected-months" id="calendarDesktopSelectedMonths">
          ${renderCalendarDesktopSelectedMonth()}
        </div>
        <button type="button" class="calendar-desktop-toggle" onclick="toggleDesktopCalendarArea()" aria-label="캘린더 영역 열기 또는 닫기">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="calendar-desktop-selected-panel">
          <div class="calendar-accordion-list">
            <div class="detail-section-title" style="margin:0;">${formatCalendarAccordionDate(dateKey)}</div>
            ${renderCalendarProductCards(events)}
          </div>
        </div>
      `;
      body.classList.add("desktop-date-selected");
      body.classList.remove("desktop-calendar-expanded", "desktop-calendar-collapsing");
      body.scrollTop = 0;
      return true;
    }

    function updateMobileExpandedCalendarHeight() {
      const body = document.getElementById("calendarSheetBody");
      const months = document.getElementById("calendarMobileMonths");
      if (!body || !months || isCalendarDesktopMode()) return;
      const selectedWeek = body.dataset.mobileSelectedMonth
        ? document.getElementById(`calendarWeek-${body.dataset.mobileSelectedMonth}`)
        : null;
      const activeSection = selectedWeek?.closest(".calendar-month") || months.querySelector(".calendar-month");
      if (!activeSection) return;
      const firstSection = months.querySelector(".calendar-month");
      const baseTop = firstSection?.offsetTop || 0;
      const weeks = activeSection.querySelectorAll(".calendar-week");
      const firstWeek = weeks[0];
      const lastWeek = weeks[weeks.length - 1];
      const firstWeekTopInSection = firstWeek ? firstWeek.offsetTop - activeSection.offsetTop : 0;
      const height = Math.ceil(lastWeek && firstWeek
        ? lastWeek.offsetTop + lastWeek.offsetHeight - firstWeek.offsetTop
        : activeSection.scrollHeight);
      months.style.setProperty("--calendar-expanded-month-height", `${height}px`);
      const isLastSection = !activeSection.nextElementSibling?.matches?.(".calendar-month");
      const spacer = isLastSection ? Math.max(0, firstWeekTopInSection) : 0;
      months.style.paddingBottom = `${spacer}px`;
      months.style.removeProperty("--calendar-expanded-scroll-spacer");
      months.scrollTop = activeSection.offsetTop - baseTop + firstWeekTopInSection;
      months.onscroll = updateCalendarMobileMonthLabel;
    }

    function renderCalendarMonth(monthDate, eventsByDate, options = {}) {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const startOffset = first.getDay();
      const totalCellsBase = Math.ceil((startOffset + last.getDate()) / 7) * 7;
      const totalCells = options.forceSixWeeks ? Math.max(42, totalCellsBase) : totalCellsBase;
      const todayKey = getISODateKey(getTodayDate());
      const holidayMaps = new Map();
      const getHolidayMapForYear = (targetYear) => {
        if (!holidayMaps.has(targetYear)) holidayMaps.set(targetYear, getKoreanHolidayMap(targetYear));
        return holidayMaps.get(targetYear);
      };
      const labels = [];
      const weeks = [];
      const monthKey = getMonthKey(monthDate);
      const showMonthNav = Boolean(options.showMonthNav);
      const hideWeekdays = Boolean(options.hideWeekdays);
      const inactiveMonth = Boolean(options.inactiveMonth);
      const isPrevDisabled = showMonthNav && monthKey <= getMonthKey(options.startMonth);
      const isNextDisabled = showMonthNav && monthKey >= getMonthKey(options.endMonth);
      const monthTitle = showMonthNav
        ? `
          <div class="calendar-month-title has-availability-legend">
            ${renderCalendarAvailabilityLegend()}
            <div class="calendar-month-navigation">
              <button type="button" class="calendar-month-nav prev" onclick="changeCalendarMonth(-1)" ${isPrevDisabled ? "disabled" : ""} aria-label="이전 달">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <div class="calendar-month-nav-label">이전 달</div>
              </button>
              <div class="calendar-month-label">${year}년 ${month + 1}월</div>
              <button type="button" class="calendar-month-nav next" onclick="changeCalendarMonth(1)" ${isNextDisabled ? "disabled" : ""} aria-label="다음 달">
                <div class="calendar-month-nav-label">다음 달</div>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        `
        : `<div class="calendar-month-title"><div class="calendar-month-label">${formatCalendarMonthTitle(monthDate)}</div></div>`;

      labels.push(renderCalendarWeekdayLabels());

      for (let weekStart = 0; weekStart < totalCells; weekStart += 7) {
        const weekCells = [];

        for (let offset = 0; offset < 7; offset += 1) {
          const index = weekStart + offset;
          const dayNumber = index - startOffset + 1;
          const date = new Date(year, month, dayNumber);
          const dateKey = getISODateKey(date);
          const isMutedMonth = date.getMonth() !== month;
          const displayDayNumber = date.getDate();
          const canCreateSchedule = !isMutedMonth && isCalendarBuilderDepartureSelectable(date);
          const events = !isMutedMonth && canCreateSchedule ? (eventsByDate[dateKey] || []) : [];
          const summary = getCalendarEventSummary(events);
          const canClickDate = !isMutedMonth && (events.length > 0 || canCreateSchedule);
          const isSunday = date.getDay() === 0;
          const holidayName = getHolidayMapForYear(date.getFullYear()).get(dateKey) || "";
          const isHoliday = Boolean(holidayName);
          const isUnavailable = dateKey < getBuilderMinDepartureISO();
          const weekKey = `${getMonthKey(monthDate)}-${weekStart / 7}`;
          weekCells.push(`
            <div class="calendar-cell${isMutedMonth ? " muted" : ""}${events.length ? " has-data" : ""}${!events.length && canCreateSchedule ? " can-create" : ""}${dateKey === todayKey ? " today" : ""}${isUnavailable ? " unavailable" : ""}${isSunday ? " sunday" : ""}${isHoliday ? " holiday" : ""}">
              <button type="button" class="calendar-day-button" ${canClickDate ? `onclick="toggleCalendarDay('${weekKey}', '${dateKey}')"` : "disabled"}>
                <strong>${displayDayNumber}</strong>
                ${dateKey === todayKey ? `<div class="calendar-today-label">TODAY</div>` : ""}
                ${holidayName && dateKey !== todayKey ? `<div class="calendar-holiday-label">${escapeHtml(holidayName)}</div>` : ""}
                ${summary.monthly ? `<div class="calendar-event monthly">월례회 ${summary.monthly}</div>` : ""}
                ${summary.domestic ? `<div class="calendar-event domestic">국내 ${summary.domestic}</div>` : ""}
                ${summary.overseas ? `<div class="calendar-event overseas">해외 ${summary.overseas}</div>` : ""}
              </button>
            </div>
          `);
        }

        const weekKey = `${getMonthKey(monthDate)}-${weekStart / 7}`;
        weeks.push(`
          <div class="calendar-week" id="calendarWeek-${weekKey}">${weekCells.join("")}</div>
          <div class="calendar-accordion" id="calendarAccordion-${weekKey}"></div>
        `);
      }

      return `
        <section class="calendar-month${hideWeekdays ? " mobile-compact" : ""}${inactiveMonth ? " inactive-month" : ""}" data-month-label="${formatCalendarMonthTitle(monthDate)}">
          ${monthTitle}
          ${hideWeekdays ? "" : `<div class="calendar-grid">${labels.join("")}</div>`}
          ${weeks.join("")}
        </section>
      `;
    }

    function renderCalendarSheetLoading() {
      const body = document.getElementById("calendarSheetBody");
      if (!body) return;
      const renderLoadingCell = (index) => `
        <div class="calendar-sheet-loading-cell" aria-hidden="true">
          <div class="calendar-loading-cell-day skeleton-glass-shimmer"></div>
          ${index % 3 === 1 ? "" : `<div class="calendar-loading-cell-event skeleton-glass-shimmer"></div>`}
        </div>
      `;
      const renderLoadingWeek = (weekIndex) => `
        <div class="calendar-loading-week">
          ${Array.from({ length: 7 }).map((_, dayIndex) => renderLoadingCell(weekIndex * 7 + dayIndex)).join("")}
        </div>
      `;
      const renderLoadingCard = (index) => `
        <div class="calendar-sheet-loading-card skeleton-glass-shimmer" aria-hidden="true">
          <div class="calendar-loading-card-thumb skeleton-glass-shimmer"></div>
          <div class="calendar-loading-card-info">
            <div class="calendar-loading-card-line meta skeleton-glass-shimmer"></div>
            <div class="calendar-loading-card-line name skeleton-glass-shimmer" style="width:${index % 2 ? 76 : 86}%;"></div>
            <div class="calendar-loading-card-line date skeleton-glass-shimmer"></div>
          </div>
          <div class="calendar-loading-card-side">
            <div class="calendar-loading-card-pill skeleton-glass-shimmer"></div>
            <div class="calendar-loading-card-team">
              ${Array.from({ length: 3 }).map(() => `<div class="calendar-loading-card-avatar skeleton-glass-shimmer"></div>`).join("")}
            </div>
          </div>
        </div>
      `;
      closeCalendarEmptyScheduleSheet();
      body.onscroll = null;
      body.scrollTop = 0;
      body.classList.add("is-loading-products");
      body.classList.remove("mobile-date-selected", "calendar-calendar-expanded", "desktop-date-selected", "desktop-calendar-expanded", "desktop-calendar-collapsing");
      delete body.dataset.mobileSelectedDate;
      delete body.dataset.mobileSelectedMonth;
      delete body.dataset.desktopSelectedDate;
      delete body.dataset.desktopSelectedMonth;
      body.innerHTML = `
        <div class="calendar-sheet-loading" aria-live="polite" aria-busy="true">
          <div class="calendar-loading-month-title">
            <div class="calendar-sheet-loading-title skeleton-glass-shimmer"></div>
          </div>
          <div class="calendar-grid calendar-loading-weekdays">${renderCalendarWeekdayLabels()}</div>
          <div class="calendar-sheet-loading-grid">
            ${Array.from({ length: 6 }).map((_, weekIndex) => renderLoadingWeek(weekIndex)).join("")}
          </div>
          <div class="calendar-loading-accordion">
            <div class="detail-section-title" style="margin:0;"><div class="calendar-sheet-loading-title skeleton-glass-shimmer"></div></div>
            ${Array.from({ length: 3 }).map((_, index) => renderLoadingCard(index)).join("")}
          </div>
        </div>
      `;
    }

    function renderCalendarSheet() {
      clearActiveJoinMySchedulesCache();
      const { startMonth, endMonth } = getCalendarMonthBounds();
      const endMonthKey = getMonthKey(endMonth);
      const eventsByDate = getJoinEventsByDate();
      const months = [];
      const body = document.getElementById("calendarSheetBody");
      closeCalendarEmptyScheduleSheet();

      if (isCalendarDesktopMode()) {
        clampCalendarViewMonth(startMonth, endMonth);
        months.push('<div class="calendar-desktop-months" id="calendarDesktopMonths">');
        months.push(renderCalendarMonth(calendarViewMonth, eventsByDate, {
          showMonthNav: true,
          forceSixWeeks: true,
          startMonth,
          endMonth
        }));
        months.push('</div>');
        months.push(renderCalendarDesktopSelectionShell());
        body.onscroll = null;
      } else {
        months.push(renderCalendarMobileSticky(startMonth));
        months.push('<div class="calendar-mobile-months" id="calendarMobileMonths">');
        const mobileEndMonth = addMonths(endMonth, 3);
        const mobileEndMonthKey = getMonthKey(mobileEndMonth);
        let cursor = startMonth;
        while (getMonthKey(cursor) <= mobileEndMonthKey) {
          months.push(renderCalendarMonth(cursor, eventsByDate, {
            hideWeekdays: true,
            inactiveMonth: !hasCalendarActiveDatesInMonth(cursor, eventsByDate)
          }));
          cursor = addMonths(cursor, 1);
        }
        months.push('</div>');
        months.push(renderCalendarMobileSelectionShell());
        body.onscroll = updateCalendarMobileMonthLabel;
      }

      body.innerHTML = months.join("");
      body.dataset.calendarRenderMode = isCalendarDesktopMode() ? "desktop" : "mobile";
      body.classList.toggle("is-loading-products", isJoinProductCardsLoading());
      body.scrollTop = 0;
      body.classList.remove("mobile-date-selected", "calendar-calendar-expanded", "desktop-date-selected", "desktop-calendar-expanded", "desktop-calendar-collapsing");
      delete body.dataset.mobileSelectedDate;
      delete body.dataset.mobileSelectedMonth;
      delete body.dataset.desktopSelectedDate;
      delete body.dataset.desktopSelectedMonth;
      const mobileMonthLabel = document.getElementById("calendarMobileMonthLabel");
      if (mobileMonthLabel && !isCalendarDesktopMode()) {
        mobileMonthLabel.textContent = formatCalendarMonthTitle(startMonth);
      }
    }

    function toggleCalendarDay(monthKey, dateKey) {
      hideJoinMobileBottomNavForCalendarDateSelection();
      const accordion = document.getElementById(`calendarAccordion-${monthKey}`);
      if (!accordion) return;
      const events = getJoinEventsByDate()[dateKey] || [];
      const canCreateSchedule = isCalendarBuilderDepartureSelectable(new Date(`${dateKey}T00:00:00`));

      if (events.length === 0) {
        if (canCreateSchedule) {
          openCalendarEmptyScheduleSheet(dateKey);
        }
        return;
      }

      closeCalendarEmptyScheduleSheet();

      if (!isCalendarDesktopMode()) {
        const body = document.getElementById("calendarSheetBody");
        const isSameMobileDate = body?.dataset.mobileSelectedDate === dateKey;
        if (isSameMobileDate) {
          clearCalendarMobileSelection();
          document.querySelectorAll(".calendar-accordion").forEach((item) => {
            item.classList.remove("open");
            item.innerHTML = "";
            delete item.dataset.dateKey;
          });
          return;
        }
        document.querySelectorAll(".calendar-accordion").forEach((item) => {
          item.classList.remove("open");
          item.innerHTML = "";
          delete item.dataset.dateKey;
        });
        openCalendarMobileSelection(monthKey, dateKey, events);
        return;
      }

      const body = document.getElementById("calendarSheetBody");
      const isSameDesktopDate = body?.dataset.desktopSelectedDate === dateKey;
      document.querySelectorAll(".calendar-accordion").forEach((item) => {
        item.classList.remove("open");
        item.innerHTML = "";
        delete item.dataset.dateKey;
      });

      if (isSameDesktopDate) {
        clearCalendarDesktopSelection();
        return;
      }

      openCalendarDesktopSelection(monthKey, dateKey, events);
    }

    function openCalendarSheet() {
      const today = getTodayDate();
      calendarViewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      renderCalendarSheetLoading();
      prepareJoinMobileFullscreenModalViewport();
      const overlay = portalOverlayToBody("calendarSheet");
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          ensureExternalGolfJoinProductsLoaded().finally(() => {
            if (document.getElementById("calendarSheet")?.classList.contains("open")) {
              renderCalendarSheet();
            }
          });
        });
      });
    }

    function closeCalendarSheet() {
      closeCalendarEmptyScheduleSheet();
      const sheet = document.getElementById("calendarSheet");
      resetModalRuntimeState(sheet);
      clearCalendarMobileSelection();
      clearCalendarDesktopSelection();
      sheet.classList.remove("open");
      setWidgetModalOpen(false);
      restoreJoinMobileBottomNavAfterNavModalClose();
    }

    function handleCalendarSheetResize() {
      const sheet = document.getElementById("calendarSheet");
      if (!sheet?.classList.contains("open")) return;
      const body = document.getElementById("calendarSheetBody");
      const nextMode = isCalendarDesktopMode() ? "desktop" : "mobile";
      const previousMode = body?.dataset.calendarRenderMode || "";
      if (!previousMode || previousMode !== nextMode) {
        renderCalendarSheet();
        return;
      }
      updateMobileExpandedCalendarHeight();
      updateCalendarMobileMonthLabel();
    }

    function handleCalendarSheetBackdrop(event) {
      const emptySheet = document.getElementById("calendarEmptyScheduleSheet");
      if (
        emptySheet?.classList.contains("open")
        && !emptySheet.contains(event.target)
        && (!calendarEmptyScheduleOpenedAt || Date.now() - calendarEmptyScheduleOpenedAt > 250)
      ) {
        closeCalendarEmptyScheduleSheet();
        return;
      }
      if (event.target.id === "calendarSheet") {
        closeCalendarSheet();
      }
    }

    function resetBuilderCalendarButtonMargins() {
      document.querySelectorAll("#builderModal .builder-calendar-card button").forEach((button) => {
        button.style.setProperty("margin-right", "0", "important");
      });
    }

    function getBuilderReturnDatePriceLabel(iso) {
      if (!builderState.fixedProductGroupKey || !Number.isFinite(builderState.startDay)) return "";
      const departureIso = builderDateToISO(builderState.startDay);
      const matches = getBuilderFixedProductGroupProducts().filter((product) => {
        return product.departureDate === departureIso && (product.returnDate || product.departureDate) === iso && Number(product.price) > 0;
      });
      if (!matches.length) return "";
      const price = Math.min(...matches.map((product) => Number(product.price)));
      return formatBuilderCalendarPriceLabel(price);
    }

    function formatBuilderCalendarPriceLabel(price) {
      const value = Number(price || 0);
      if (!(value > 0)) return "";
      const manwon = value / 10000;
      const display = Number.isInteger(manwon)
        ? String(manwon)
        : String(Math.round(manwon * 10) / 10);
      return `${display}만`;
    }

    function getBuilderDepartureDatePriceLabel(iso) {
      if (!builderState.mdPickDateChangeMode || !builderState.fixedProductGroupKey || !iso) return "";
      const matches = getBuilderFixedProductGroupProducts().filter((product) => product.departureDate === iso && Number(product.price) > 0);
      if (!matches.length) return "";
      const price = Math.min(...matches.map((product) => Number(product.price)));
      return formatBuilderCalendarPriceLabel(price);
    }

    function getMdPickProductByDepartureDate(iso) {
      if (!iso) return null;
      return getBuilderFixedProductGroupProducts()
        .filter((product) => product.departureDate === iso)
        .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0) || String(a.returnDate || "").localeCompare(String(b.returnDate || "")))[0] || null;
    }

    async function showMdPickDetailProduct(product, productGroupKey = currentMdPickProductGroupKey, countryKey = currentMdPickCountryKey, options = {}) {
      if (!product) return;
      const detailPerformanceGeneration = beginGolfJoinDetailPerformance();
      product = prepareSecretTourInitialFlightScheduleState(product);
      const detailScrollState = options.preserveScroll
        ? (options.scrollState || captureDetailModalScrollState())
        : null;
      currentDetailMode = "mdPickProduct";
      currentDetailJoinId = product.id;
      currentDetailJoinData = product;
      addJoinRecentViewedItem(product, "product");
      currentMdPickProductGroupKey = productGroupKey;
      currentMdPickCountryKey = countryKey;
      currentDetailSlideIndex = 0;
      stopDetailReviewAutoSlide();
      closeDetailApply();
      document.getElementById("detailModalTitle").textContent = product.title;
      renderDetailContent(product, { hideParticipants: true });
      const primary = document.getElementById("detailPrimaryButton");
      if (primary) {
        primary.innerHTML = `<span>멤버 모집하기</span>${renderDetailChevronRightIcon()}`;
        primary.setAttribute("onclick", "handleDetailPrimaryAction()");
      }
      setDetailMdPickRecruitActions();
      setDetailScheduleConflictState(product);
      document.getElementById("detailModal")?.classList.add("mdpick-recruit-mode");
      document.getElementById("detailModal")?.classList.remove("builder-select-mode", "builder-product-detail-mode");
      openModal("detailModal", { pageScrollState: options.pageScrollState });
      requestAnimationFrame(() => {
        prepareDetailScheduleHeights({ forceOpen: true });
        if (detailScrollState) restoreDetailModalScrollState(detailScrollState);
        else resetDetailModalScroll();
        finishGolfJoinDetailPerformance(
          detailPerformanceGeneration,
          "golfjoin:detail:visible",
          "golfjoin:duration:detail-visible"
        );
      });
      try {
        const detail = await loadSecretTourGoodsDetail(product);
        finishGolfJoinDetailPerformance(
          detailPerformanceGeneration,
          "golfjoin:detail:erp-ready",
          "golfjoin:duration:detail-erp"
        );
        const enrichedProduct = { ...mergeSecretTourGoodsDetail(product, detail), secretTourDetailLoaded: true };
        if (Array.isArray(externalGolfJoinProducts)) {
          externalGolfJoinProducts = externalGolfJoinProducts.map((item) => item.id === enrichedProduct.id ? enrichedProduct : item);
        }
        if (currentDetailMode === "mdPickProduct" && currentDetailJoinId === product.id && document.getElementById("detailModal")?.classList.contains("open")) {
          const currentScrollState = detailScrollState || captureDetailModalScrollState();
          currentDetailJoinData = enrichedProduct;
          addJoinRecentViewedItem(enrichedProduct, "product");
          currentDetailSlideIndex = 0;
          document.getElementById("detailModalTitle").textContent = enrichedProduct.title;
          renderDetailContent(enrichedProduct, { hideParticipants: true });
          setDetailMdPickRecruitActions();
          setDetailScheduleConflictState(enrichedProduct);
          requestAnimationFrame(() => {
            prepareDetailScheduleHeights({ forceOpen: true });
            restoreDetailModalScrollState(currentScrollState);
          });
        }
        void enrichSecretTourFlightScheduleInBackground(enrichedProduct, detail, enrichedProduct)
          .then(() => finishGolfJoinDetailPerformance(
            detailPerformanceGeneration,
            "golfjoin:detail:flight-ready",
            "golfjoin:duration:detail-flight"
          ))
          .catch((error) => {
            finishGolfJoinDetailPerformance(
              detailPerformanceGeneration,
              "golfjoin:detail:flight-failed",
              "golfjoin:duration:detail-flight"
            );
            golfJoinSafeWarn("Failed to update MD PICK flight schedule.", error);
          });
      } catch (error) {
        finishGolfJoinDetailPerformance(
          detailPerformanceGeneration,
          "golfjoin:detail:erp-failed",
          "golfjoin:duration:detail-erp"
        );
        golfJoinSafeWarn("Failed to enrich MD PICK detail from ERP.", error);
      }
    }

    function selectMdPickDateChangeDeparture(day) {
      const iso = builderDateToISO(day);
      const product = getMdPickProductByDepartureDate(iso);
      if (!product) return;
      closeModal("builderModal");
      showMdPickDetailProduct(product);
    }

    function renderBuilderCalendar() {
      const grid = document.getElementById("builderCalendar");
      if (!grid) return;
      bindBuilderCalendarSwipe(grid);
      syncActiveJoinMySchedulesMemberScope();
      const isLoadingDates = isBuilderDateLoading();
      grid.closest(".builder-calendar-card")?.classList.toggle("is-loading-dates", isLoadingDates);
      syncBuilderCalendarLoading(isLoadingDates);
      reconcileBuilderConstrainedDates();
      document.getElementById("builderCalendarMonth").textContent = `${builderState.viewYear}년 ${builderState.viewMonth + 1}월`;
      const firstWeekday = new Date(builderState.viewYear, builderState.viewMonth, 1).getDay();
      const lastDate = new Date(builderState.viewYear, builderState.viewMonth + 1, 0).getDate();
      const prevLastDate = new Date(builderState.viewYear, builderState.viewMonth, 0).getDate();
      const toDate = (dayOffset) => new Date(builderState.viewYear, builderState.viewMonth, dayOffset);
      const toStamp = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
      const hasStart = Number.isFinite(builderState.startDay);
      const hasEnd = Number.isFinite(builderState.endDay);
      const startDate = hasStart ? toDate(builderState.startDay) : null;
      const endDate = hasEnd ? toDate(builderState.endDay) : null;
      const startFlexStart = hasStart ? addDays(startDate, -builderState.startBefore) : null;
      const startFlexEnd = hasStart ? addDays(startDate, builderState.startAfter) : null;
      const endFlexStart = hasEnd ? addDays(endDate, -builderState.endBefore) : null;
      const endFlexEnd = hasEnd ? addDays(endDate, builderState.endAfter) : null;
      const todayStamp = toStamp(new Date());
      let hasActiveScheduleInCalendar = false;
      const renderCell = ({ day, dayOffset, date, muted, index }) => {
        const weekday = index % 7;
        const stamp = toStamp(date);
        const unavailable = isLoadingDates || !isBuilderDateSelectable(date);
        const hasStart = Number.isFinite(builderState.startDay);
        const hasEnd = Number.isFinite(builderState.endDay);
        const isStart = hasStart && stamp === toStamp(startDate);
        const isEnd = hasEnd && stamp === toStamp(endDate);
        const isRange = hasStart && hasEnd && stamp > toStamp(startDate) && stamp < toStamp(endDate);
        const flexClasses = [];
        const startFlexMin = hasStart ? toStamp(startFlexStart) : null;
        const startFlexMax = hasStart ? toStamp(startFlexEnd) : null;
        const endFlexMin = hasEnd ? toStamp(endFlexStart) : null;
        const endFlexMax = hasEnd ? toStamp(endFlexEnd) : null;
        const inStartFlex = hasStart && stamp >= startFlexMin && stamp <= startFlexMax;
        const inEndFlex = hasEnd && stamp >= endFlexMin && stamp <= endFlexMax;
        const isFlexDisplay = inStartFlex || inEndFlex;
        const isToday = stamp === todayStamp;
        const iso = getISODateKey(date);
        const holidayName = getKoreanHolidayMap(date.getFullYear()).get(iso) || "";
        const isHoliday = Boolean(holidayName);
        const activeSchedule = getBuilderActiveScheduleForDate(date);
        if (activeSchedule && !muted) hasActiveScheduleInCalendar = true;
        const activeRange = activeSchedule?.range || null;
        const activeStartTime = activeRange?.startTime;
        const activeEndTime = activeRange?.endTime;
        const isActiveScheduleStart = activeRange && stamp === activeStartTime;
        const isActiveScheduleEnd = activeRange && stamp === activeEndTime;
        const isActiveScheduleSingle = activeRange && activeStartTime === activeEndTime;
        const isActiveScheduleRange = activeRange && stamp > activeStartTime && stamp < activeEndTime;
        const displayUnavailable = unavailable && !activeSchedule && !isFlexDisplay && !isStart && !isEnd && !isRange;
        const activeScheduleClasses = activeSchedule ? [
          "active-schedule",
          isActiveScheduleStart ? "active-schedule-start" : "",
          isActiveScheduleEnd ? "active-schedule-end" : "",
          isActiveScheduleSingle ? "active-schedule-single" : "",
          isActiveScheduleRange ? "active-schedule-range" : ""
        ] : [];
        if (isFlexDisplay) flexClasses.push("flex");
        if ((inStartFlex && startFlexMin === startFlexMax) || (inEndFlex && endFlexMin === endFlexMax)) {
          flexClasses.push("flex-single");
        } else {
          if ((inStartFlex && stamp === startFlexMin) || (inEndFlex && stamp === endFlexMin)) flexClasses.push("flex-edge-left");
          if ((inStartFlex && stamp === startFlexMax) || (inEndFlex && stamp === endFlexMax)) flexClasses.push("flex-edge-right");
        }
        const cls = ["builder-day", muted ? "muted" : "", displayUnavailable ? "unavailable" : "", isToday ? "today" : "", weekday === 0 ? "sunday" : "", weekday === 6 ? "saturday" : "", isHoliday ? "holiday" : "", ...activeScheduleClasses, ...new Set(flexClasses), isRange ? "range" : "", hasStart && hasEnd && !displayUnavailable && (isStart || isEnd) ? "linked" : "", !displayUnavailable && isStart ? "start" : "", !displayUnavailable && isEnd ? "end" : ""].filter(Boolean).join(" ");
        const departurePriceLabel = !displayUnavailable && !hasStart ? getBuilderDepartureDatePriceLabel(iso) : "";
        const returnPriceLabel = !displayUnavailable && !isStart && hasStart && !hasEnd ? getBuilderReturnDatePriceLabel(iso) : "";
        const label = activeSchedule ? "" : !displayUnavailable && isStart ? '<div class="builder-day-label">출발</div>' : !displayUnavailable && isEnd ? '<div class="builder-day-label">도착</div>' : departurePriceLabel ? `<div class="builder-day-label">${departurePriceLabel}</div>` : returnPriceLabel ? `<div class="builder-day-label">${returnPriceLabel}</div>` : isToday ? '<div class="builder-day-today-label">TODAY</div>' : holidayName ? `<div class="builder-day-holiday-label">${escapeHtml(holidayName)}</div>` : "";
        const canClick = !isLoadingDates && (activeSchedule || !unavailable || isStart || isEnd);
        const click = activeSchedule
          ? `openBuilderActiveScheduleSheet('${escapeJsString(activeSchedule.key)}', '${iso}')`
          : canClick ? (isStart ? "openBuilderDatePopover('start', this)" : isEnd ? "openBuilderDatePopover('end', this)" : `selectBuilderDate(${dayOffset}, this)`) : "";
        return `<button type="button" class="${cls}" data-builder-day-offset="${dayOffset}" ${activeSchedule ? 'aria-disabled="true"' : ""} ${click ? `onclick="${click}"` : "disabled"}><div class="builder-day-number">${day}</div>${label}</button>`;
      };
      const cells = Array.from({ length: firstWeekday }).map((_, index) => {
        const day = prevLastDate - firstWeekday + index + 1;
        const dayOffset = day - prevLastDate;
        return renderCell({ day, dayOffset, date: toDate(dayOffset), muted: true, index });
      });
      Array.from({ length: lastDate }).forEach((_, index) => {
        const day = index + 1;
        cells.push(renderCell({ day, dayOffset: day, date: toDate(day), muted: false, index: firstWeekday + index }));
      });
      while (cells.length % 7 !== 0) {
        const day = cells.length - firstWeekday - lastDate + 1;
        const dayOffset = lastDate + day;
        cells.push(renderCell({ day, dayOffset, date: toDate(dayOffset), muted: true, index: cells.length }));
      }
      const weeks = [];
      for (let index = 0; index < cells.length; index += 7) {
        weeks.push(`<div class="builder-calendar-week">${cells.slice(index, index + 7).join("")}</div>`);
      }
      grid.closest(".builder-calendar-card")?.classList.toggle("has-six-weeks", weeks.length >= 6);
      grid.innerHTML = weeks.join("");
      const activeScheduleLegend = document.getElementById("builderActiveScheduleLegend");
      if (activeScheduleLegend) activeScheduleLegend.hidden = !hasActiveScheduleInCalendar;
      resetBuilderCalendarButtonMargins();
      updateBuilderSummary();
      updateBuilderNotice();
      if (builderStep === 2 && (builderState.regions || []).length) {
        renderBuilderRegionSearch(document.getElementById("builderRegionSearchInput")?.value || "");
      }
    }

    function bindBuilderCalendarSwipe(grid) {
      if (!grid || grid.dataset.swipeBound === "true") return;
      grid.dataset.swipeBound = "true";
      let startX = 0;
      let startY = 0;
      let touchMode = "";
      let touchActive = false;
      let suppressClickUntil = 0;

      grid.addEventListener("touchstart", (event) => {
        if (!window.matchMedia("(max-width: 640px)").matches || event.touches?.length !== 1) {
          touchActive = false;
          return;
        }
        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        touchMode = "";
        touchActive = true;
      }, { passive: true });

      grid.addEventListener("touchmove", (event) => {
        if (!touchActive || event.touches?.length !== 1) return;
        const touch = event.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (!touchMode && (absX > 8 || absY > 8)) {
          touchMode = absX > absY * 1.15 ? "horizontal" : "vertical";
        }
        if (touchMode === "horizontal") event.preventDefault();
      }, { passive: false });

      grid.addEventListener("touchend", (event) => {
        if (!touchActive) return;
        touchActive = false;
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        if (touchMode === "vertical") return;
        if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
        suppressClickUntil = Date.now() + 450;
        changeBuilderMonth(deltaX < 0 ? 1 : -1);
      }, { passive: true });

      grid.addEventListener("touchcancel", () => {
        touchActive = false;
        touchMode = "";
      }, { passive: true });

      grid.addEventListener("click", (event) => {
        if (Date.now() >= suppressClickUntil) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
    }

    function isBuilderDateLoading() {
      return externalGolfJoinProductsLoading && !externalGolfJoinProducts && !externalGolfJoinProductsLoadFailed;
    }

    function changeBuilderMonth(delta) {
      const currentStartDate = Number.isFinite(builderState.startDay) ? new Date(builderState.viewYear, builderState.viewMonth, builderState.startDay) : null;
      const currentEndDate = Number.isFinite(builderState.endDay) ? new Date(builderState.viewYear, builderState.viewMonth, builderState.endDay) : null;
      const next = new Date(builderState.viewYear, builderState.viewMonth + delta, 1);
      builderState.viewYear = next.getFullYear();
      builderState.viewMonth = next.getMonth();
      const nextMonthStart = new Date(builderState.viewYear, builderState.viewMonth, 1);
      const dayMs = 24 * 60 * 60 * 1000;
      const getDayOffset = (date) => Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - nextMonthStart.getTime()) / dayMs) + 1;
      if (currentStartDate) builderState.startDay = getDayOffset(currentStartDate);
      if (currentEndDate) builderState.endDay = getDayOffset(currentEndDate);
      closeBuilderDatePopover(true);
      closeBuilderDurationPopover();
      closeBuilderActiveScheduleSheet();
      renderBuilderCalendar();
    }

    function resetBuilderDates() {
      builderState.startDay = null;
      builderState.endDay = null;
      builderState.dateSelectionComplete = false;
      builderState.startBefore = 0;
      builderState.startAfter = 0;
      builderState.endBefore = 0;
      builderState.endAfter = 0;
      builderState.durationFilter = "";
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      activeBuilderPopoverTarget = "start";
      activeBuilderPopoverDay = null;
      closeBuilderDatePopover(true);
      closeBuilderDurationPopover();
      closeBuilderActiveScheduleSheet();
      renderBuilderCalendar();
    }

    function clearBuilderProductForDateChange() {
      if (builderState.fixedProductGroupKey) return;
      builderState.regionSelectionComplete = false;
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
    }

    function selectBuilderDate(day, trigger) {
      hideJoinMobileBottomNavForBuilderDateSelection();
      const selectedDate = new Date(builderState.viewYear, builderState.viewMonth, day);
      const activeSchedule = getBuilderActiveScheduleForDate(selectedDate);
      if (activeSchedule) {
        openBuilderActiveScheduleSheet(activeSchedule.key, getISODateKey(selectedDate));
        return;
      }
      if (!isBuilderDateSelectable(selectedDate)) return;
      if (builderState.mdPickDateChangeMode) {
        selectMdPickDateChangeDeparture(day);
        return;
      }
      builderState.dateSelectionComplete = false;
      closeBuilderDurationPopover();
      const clickedIso = builderDateToISO(day);
      const canUseAsDeparture = clickedIso >= getBuilderMinDepartureISO();
      if (!Number.isFinite(builderState.startDay)) {
        if (!canUseAsDeparture) return;
        builderState.startDay = day;
        builderState.startBefore = 0;
        builderState.startAfter = 0;
        builderState.durationFilter = "";
        clearBuilderProductForDateChange();
        renderBuilderCalendar();
        openBuilderDatePopover("start", getBuilderDateButton(builderState.startDay) || trigger);
      } else if (!Number.isFinite(builderState.endDay)) {
        if (hasBuilderDateConstraint() && !hasBuilderConstrainedReturnForSelectedDepartures(clickedIso) && isBuilderConstraintDepartureDate(clickedIso)) {
          if (!canUseAsDeparture) return;
          builderState.startDay = day;
          builderState.startBefore = 0;
          builderState.startAfter = 0;
          builderState.endDay = null;
          builderState.endBefore = 0;
          builderState.endAfter = 0;
          builderState.durationFilter = "";
          clearBuilderProductForDateChange();
          renderBuilderCalendar();
          openBuilderDatePopover("start", getBuilderDateButton(builderState.startDay) || trigger);
          return;
        }
        if (day <= builderState.startDay) {
          if (!canUseAsDeparture) return;
          builderState.startDay = day;
          builderState.startBefore = 0;
          builderState.startAfter = 0;
          builderState.durationFilter = "";
          clearBuilderProductForDateChange();
          renderBuilderCalendar();
          openBuilderDatePopover("start", getBuilderDateButton(builderState.startDay) || trigger);
          return;
        }
        builderState.endDay = day;
        builderState.endBefore = 0;
        builderState.endAfter = 0;
        builderState.durationFilter = "";
        syncBuilderFixedProductFromSelectedDates();
        renderBuilderCalendar();
        openBuilderDatePopover("end", getBuilderDateButton(builderState.endDay) || trigger);
      } else if (day <= builderState.startDay) {
        if (!canUseAsDeparture) return;
        builderState.startDay = Math.min(day, builderState.endDay - 1);
        builderState.startBefore = 0;
        builderState.startAfter = 0;
        builderState.durationFilter = "";
        clearBuilderProductForDateChange();
        renderBuilderCalendar();
        openBuilderDatePopover("start", getBuilderDateButton(builderState.startDay) || trigger);
      } else if (day >= builderState.endDay) {
        builderState.endDay = Math.max(day, builderState.startDay + 1);
        builderState.endBefore = 0;
        builderState.endAfter = 0;
        builderState.durationFilter = "";
        syncBuilderFixedProductFromSelectedDates();
        renderBuilderCalendar();
        openBuilderDatePopover("end", getBuilderDateButton(builderState.endDay) || trigger);
      } else {
        const startDistance = Math.abs(day - builderState.startDay);
        const endDistance = Math.abs(builderState.endDay - day);
        if (startDistance <= endDistance) {
          if (!canUseAsDeparture) return;
          builderState.startDay = day;
          builderState.startBefore = 0;
          builderState.startAfter = 0;
          builderState.durationFilter = "";
          clearBuilderProductForDateChange();
          renderBuilderCalendar();
          openBuilderDatePopover("start", getBuilderDateButton(builderState.startDay) || trigger);
        } else {
          builderState.endDay = day;
          builderState.endBefore = 0;
          builderState.endAfter = 0;
          builderState.durationFilter = "";
          syncBuilderFixedProductFromSelectedDates();
          renderBuilderCalendar();
          openBuilderDatePopover("end", getBuilderDateButton(builderState.endDay) || trigger);
        }
      }
    }

    function getBuilderDateButton(day) {
      return Array.from(document.querySelectorAll("#builderCalendar .builder-day")).find((button) => {
        return Number(button.dataset.builderDayOffset) === day;
      });
    }

    function canChangeBuilderPopoverFlex(target, side, delta) {
      const prefix = target === "start" ? "start" : "end";
      const key = `${prefix}${side === "before" ? "Before" : "After"}`;
      const current = Number(builderState[key]) || 0;
      const next = current + delta;
      if (next < 0 || next > 7) return false;
      const snapshot = {
        startBefore: builderState.startBefore,
        startAfter: builderState.startAfter,
        endBefore: builderState.endBefore,
        endAfter: builderState.endAfter
      };
      builderState[key] = next;
      clampBuilderFlexWindow(key);
      const canChange = builderState[key] === next && isBuilderCurrentFlexSelectionValid();
      builderState.startBefore = snapshot.startBefore;
      builderState.startAfter = snapshot.startAfter;
      builderState.endBefore = snapshot.endBefore;
      builderState.endAfter = snapshot.endAfter;
      if (!canChange) return false;
      if (!Number.isFinite(builderState.startDay) || !Number.isFinite(builderState.endDay)) return true;
      const gap = Math.max(0, builderState.endDay - builderState.startDay);
      if (key === "startAfter") return next <= Math.max(0, gap - builderState.endBefore - 1);
      if (key === "endBefore") return next <= Math.max(0, gap - builderState.startAfter - 1);
      return true;
    }

    function isBuilderDateBottomPanelMode() {
      return true;
    }

    function completeBuilderDateSelectionIfReady() {
      if (activeBuilderPopoverTarget !== "end") return false;
      if (!Number.isFinite(builderState.startDay) || !Number.isFinite(builderState.endDay)) return false;
      builderState.dateSelectionComplete = true;
      setBuilderStep(2);
      return true;
    }

    function renderBuilderDatePopoverTitle(target, day, before, after) {
      const selectedDate = new Date(builderState.viewYear, builderState.viewMonth, day);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const formatShort = (date) => `${date.getMonth() + 1}.${date.getDate()}<span class="builder-date-weekday">${weekdays[date.getDay()]}</span>`;
      const formatPlain = (date) => `${date.getMonth() + 1}.${date.getDate()}(${weekdays[date.getDay()]})`;
      const minusIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus-icon lucide-minus" aria-hidden="true"><path d="M5 12h14"/></svg>';
      const plusIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
      const disabledAttr = (side, delta) => canChangeBuilderPopoverFlex(target, side, delta) ? "" : " disabled";
      const label = target === "start" ? "출발일" : "도착일";
      const selectedText = formatShort(selectedDate);
      const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - before);
      const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + after);
      const rangeText = startDate.getTime() === endDate.getTime()
        ? selectedText
        : `${formatShort(startDate)} ~ ${formatShort(endDate)}`;
      const title = document.getElementById("builderDatePopoverTitle");
      if (!title) return;
      if (!isBuilderDateBottomPanelMode()) {
        title.textContent = `${label} ${formatPlain(selectedDate)} 전 ${before}일 / 후 ${after}일`;
        return;
      }
      title.innerHTML = `
        <div class="builder-date-title-row">
          <span class="builder-date-title-label">${label}</span>
          <span class="builder-date-title-range">${rangeText}</span>
        </div>
        <div class="builder-date-mode-toggle" role="group" aria-label="${label} 선택 방식">
          <button type="button" class="builder-date-mode-button${activeBuilderPopoverFlexOpen ? "" : " active"}" aria-pressed="${activeBuilderPopoverFlexOpen ? "false" : "true"}" onclick="setBuilderPopoverMode('fixed')">이날만</button>
          <button type="button" class="builder-date-mode-button${activeBuilderPopoverFlexOpen ? " active" : ""}" aria-pressed="${activeBuilderPopoverFlexOpen ? "true" : "false"}" onclick="setBuilderPopoverMode('flex')">여유롭게</button>
        </div>
        <div class="builder-date-stepper-stage">
          <div class="builder-date-side-stepper">
            <div class="builder-date-side-label">전</div>
            <div class="builder-date-side-controls">
              <button type="button" onclick="changeBuilderPopoverFlex('before', -1)" aria-label="이전 여유날짜 줄이기"${disabledAttr("before", -1)}>${minusIcon}</button>
              <span id="builderMobileBeforeFlex">+${before}일</span>
              <button type="button" onclick="changeBuilderPopoverFlex('before', 1)" aria-label="이전 여유날짜 늘리기"${disabledAttr("before", 1)}>${plusIcon}</button>
            </div>
          </div>
          <div class="builder-date-center-stepper">
            <div class="builder-date-side-label">기준일</div>
            <div class="builder-date-title-selected">${selectedText}</div>
          </div>
          <div class="builder-date-side-stepper">
            <div class="builder-date-side-label">후</div>
            <div class="builder-date-side-controls">
              <button type="button" onclick="changeBuilderPopoverFlex('after', -1)" aria-label="이후 여유날짜 줄이기"${disabledAttr("after", -1)}>${minusIcon}</button>
              <span id="builderMobileAfterFlex">+${after}일</span>
              <button type="button" onclick="changeBuilderPopoverFlex('after', 1)" aria-label="이후 여유날짜 늘리기"${disabledAttr("after", 1)}>${plusIcon}</button>
            </div>
          </div>
        </div>
      `;
    }

    function formatBuilderFlexDayCount(value) {
      return `+${Math.max(0, Number(value) || 0)}일`;
    }

    function updateBuilderPopoverFlexButtons() {
      document.querySelectorAll("[data-builder-popover-flex-side][data-builder-popover-flex-delta]").forEach((button) => {
        const side = button.dataset.builderPopoverFlexSide;
        const delta = Number(button.dataset.builderPopoverFlexDelta);
        button.disabled = !canChangeBuilderPopoverFlex(activeBuilderPopoverTarget, side, delta);
      });
    }

    function syncBuilderDateModeToggleState() {
      const popover = document.getElementById("builderDatePopover");
      const buttons = popover?.querySelectorAll(".builder-date-mode-button");
      if (!buttons?.length) return;
      buttons.forEach((button) => {
        const isFlexButton = button.getAttribute("onclick")?.includes("'flex'");
        const isActive = Boolean(isFlexButton) === Boolean(activeBuilderPopoverFlexOpen);
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }

    function positionBuilderDatePopover(popover, trigger, card) {
      if (!popover || !trigger || !card) return;
      if (isBuilderDateBottomPanelMode()) {
        const bottom = document.getElementById("builderBottom");
        const bottomStyle = bottom ? window.getComputedStyle(bottom) : null;
        const bottomRect = bottom?.getBoundingClientRect();
        const bottomHeight = bottomStyle && bottomStyle.display !== "none" && bottomRect?.height
          ? Math.ceil(bottomRect.height)
          : 0;
        document.getElementById("builderModal")?.style.setProperty("--builder-bottom-offset", `${bottomHeight}px`);
        const popoverHeight = Math.ceil(popover.getBoundingClientRect().height || popover.offsetHeight || 0);
        if (popoverHeight > 0) {
          document.getElementById("builderModal")?.style.setProperty("--builder-date-popover-space", `${popoverHeight + 18}px`);
        }
        popover.style.removeProperty("--builder-bottom-offset");
        popover.classList.remove("above");
        popover.style.left = "";
        popover.style.top = "";
        popover.style.maxHeight = "";
        popover.style.overflowY = "";
        return;
      }
      const triggerRect = trigger.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const bottomRect = document.getElementById("builderBottom")?.getBoundingClientRect();
      const bottomLimit = (bottomRect && bottomRect.top > 0 ? bottomRect.top : window.innerHeight) - 12;
      const popoverWidth = popover.offsetWidth || 184;
      const left = triggerRect.left - cardRect.left + (triggerRect.width / 2);
      const nextLeft = Math.max(10, Math.min(card.clientWidth - popoverWidth - 10, left - (popoverWidth / 2)));
      popover.style.left = `${nextLeft}px`;
      popover.style.maxHeight = "";
      popover.style.overflowY = "";

      const belowTop = trigger.offsetTop + trigger.offsetHeight + 4;
      popover.style.top = `${belowTop}px`;
      popover.classList.remove("above");

      const belowRect = popover.getBoundingClientRect();
      if (belowRect.bottom <= bottomLimit) return;

      const aboveTop = Math.max(8, trigger.offsetTop - popover.offsetHeight - 6);
      popover.style.top = `${aboveTop}px`;
      popover.classList.add("above");

      const aboveRect = popover.getBoundingClientRect();
      if (aboveRect.bottom > bottomLimit) {
        popover.style.maxHeight = `${Math.max(96, bottomLimit - aboveRect.top)}px`;
        popover.style.overflowY = "auto";
      }
    }

    function resetBuilderDateViewportAdjustment() {
      document.getElementById("builderModal")?.style.removeProperty("--builder-date-popover-space");
    }

    function ensureBuilderDateTriggerVisible(trigger, popover) {
      if (!trigger || !popover || !isBuilderDateBottomPanelMode()) return;
      const scrollBox = document.getElementById("builderBody");
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const safeBottom = popoverRect.top - 12;
      if (!Number.isFinite(safeBottom) || triggerRect.bottom <= safeBottom) return;
      const delta = Math.ceil(triggerRect.bottom - safeBottom);
      if (scrollBox && scrollBox.scrollHeight > scrollBox.clientHeight) {
        scrollBox.scrollTo({
          top: scrollBox.scrollTop + delta,
          behavior: "smooth"
        });
        return;
      }
      const modal = document.getElementById("builderModal");
      if (modal && modal.scrollHeight > modal.clientHeight) {
        modal.scrollTo({
          top: modal.scrollTop + delta,
          behavior: "smooth"
        });
      }
    }

    function openBuilderDatePopover(target, trigger) {
      hideJoinMobileBottomNavForBuilderDateSelection();
      const popover = document.getElementById("builderDatePopover");
      const card = trigger?.closest(".builder-calendar-card");
      if (!popover || !trigger || !card) return;
      activeBuilderPopoverTarget = target;
      const isStart = target === "start";
      const day = isStart ? builderState.startDay : builderState.endDay;
      if (!Number.isFinite(day)) return;
      const flexBefore = isStart ? builderState.startBefore : builderState.endBefore;
      const flexAfter = isStart ? builderState.startAfter : builderState.endAfter;
      activeBuilderPopoverDay = day;
      activeBuilderPopoverFlexOpen = false;
      builderPopoverFlexSnapshot = null;
      if (isBuilderDateBottomPanelMode()) {
        const prefix = isStart ? "start" : "end";
        activeBuilderPopoverFlexOpen = builderState[`${prefix}Before`] > 0 || builderState[`${prefix}After`] > 0;
        if (activeBuilderPopoverFlexOpen) {
          builderPopoverFlexSnapshot = {
            before: builderState[`${prefix}Before`],
            after: builderState[`${prefix}After`]
          };
        }
      }
      activeBuilderPopoverTrigger = trigger;
      renderBuilderDatePopoverTitle(target, day, flexBefore, flexAfter);
      document.getElementById("builderPopoverBeforeFlex").textContent = formatBuilderFlexDayCount(flexBefore);
      document.getElementById("builderPopoverAfterFlex").textContent = formatBuilderFlexDayCount(flexAfter);
      updateBuilderPopoverFlexButtons();

      popover.classList.remove("above", "flex-open");
      popover.classList.add("open");
      popover.classList.toggle("flex-open", activeBuilderPopoverFlexOpen);
      positionBuilderDatePopover(popover, trigger, card);
      requestAnimationFrame(() => ensureBuilderDateTriggerVisible(trigger, popover));
      bindBuilderPopoverHoverClose();
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && trigger.dataset.hoverBound !== "true") {
        trigger.dataset.hoverBound = "true";
        trigger.addEventListener("mouseleave", (event) => {
          if (isBuilderDateBottomPanelMode()) return;
          const next = event.relatedTarget;
          if (next && popover.contains(next)) return;
          window.setTimeout(() => {
            const hovered = document.querySelector("#builderDatePopover:hover");
            if (!hovered) closeBuilderDatePopover();
          }, 80);
        });
      }
    }

    function closeBuilderDatePopover(force = false) {
      if (!force && isBuilderDateBottomPanelMode()) return;
      document.getElementById("builderDatePopover")?.classList.remove("open");
      resetBuilderDateViewportAdjustment();
      builderPopoverFlexSnapshot = null;
      activeBuilderPopoverTrigger = null;
    }

    function closeBuilderDurationPopover() {
      document.getElementById("builderDurationPopover")?.classList.remove("open");
    }

    function getDurationDayCount(duration) {
      const match = String(duration || "").match(/(\d+)\s*박\s*(\d+)\s*일/);
      if (match) return Number(match[2]) || 9999;
      const dayMatch = String(duration || "").match(/(\d+)\s*일/);
      return dayMatch ? Number(dayMatch[1]) : 9999;
    }

    function getBuilderAvailableDurationOptions() {
      if (!hasBuilderDateConstraint() || !Number.isFinite(builderState.startDay)) return [];
      const products = getBuilderDateConstraintProducts();
      if (!products.length) return [];
      const departureDateSet = new Set(getBuilderSelectedDepartureDates());
      const durations = new Map();
      products.forEach((product) => {
        if (!departureDateSet.has(product.departureDate)) return;
        const duration = formatTripDuration(product);
        if (!duration) return;
        if (!durations.has(duration)) {
          durations.set(duration, { label: duration, days: getDurationDayCount(duration), count: 0 });
        }
        durations.get(duration).count += 1;
      });
      return [...durations.values()].sort((a, b) => a.days - b.days || a.label.localeCompare(b.label, "ko"));
    }

    function shouldOpenBuilderDurationPopover(prefix) {
      return prefix === "start" && hasBuilderDateConstraint() && Number.isFinite(builderState.startDay) && !Number.isFinite(builderState.endDay);
    }

    function openBuilderDurationPopover() {
      const popover = document.getElementById("builderDurationPopover");
      const optionsRoot = document.getElementById("builderDurationOptions");
      if (!popover || !optionsRoot) return false;
      const options = getBuilderAvailableDurationOptions();
      if (!options.length) return false;
      optionsRoot.innerHTML = options.map((option) => `
        <button type="button" class="builder-duration-option" onclick="selectBuilderDurationOption('${escapeJsString(option.label)}')">
          <strong>${escapeHtml(option.label)}</strong>
          <span>${option.count}개 상품</span>
        </button>
      `).join("");
      popover.classList.add("open");
      return true;
    }

    function maybeOpenBuilderDurationPopover(prefix) {
      if (!shouldOpenBuilderDurationPopover(prefix)) return false;
      builderState.durationFilter = "";
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      updateBuilderSummary();
      return openBuilderDurationPopover();
    }

    function selectBuilderDurationOption(duration) {
      builderState.durationFilter = duration || "";
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      closeBuilderDurationPopover();
      setBuilderStep(2);
      requestAnimationFrame(() => {
        const input = document.getElementById("builderRegionSearchInput");
        if (input && builderState.regions && builderState.regions.length) {
          input.value = builderState.regions.map(formatRegionDisplayName).join(", ");
        }
        builderRegionSelectorMode = false;
        renderBuilderRegionSearch(input?.value || "");
        updateBuilderSummary();
      });
    }

    function bindBuilderPopoverHoverClose() {
      if (isBuilderDateBottomPanelMode()) return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      const popover = document.getElementById("builderDatePopover");
      if (!popover || popover.dataset.hoverBound === "true") return;
      popover.dataset.hoverBound = "true";
      const shouldClose = (event) => {
        const next = event.relatedTarget;
        if (next && (popover.contains(next) || activeBuilderPopoverTrigger?.contains(next))) return;
        window.setTimeout(() => {
          const hovered = document.querySelector("#builderDatePopover:hover, #builderCalendar .builder-day:hover");
          if (!hovered) closeBuilderDatePopover();
        }, 80);
      };
      popover.addEventListener("mouseleave", shouldClose);
      document.getElementById("builderCalendar")?.addEventListener("mouseleave", (event) => {
        if (window.matchMedia("(max-width: 640px)").matches) return;
        const next = event.relatedTarget;
        if (next && popover.contains(next)) return;
        if (popover.classList.contains("open")) closeBuilderDatePopover();
      });
    }

    function fixBuilderSelectedDate() {
      const prefix = activeBuilderPopoverTarget === "start" ? "start" : "end";
      builderState[`${prefix}Before`] = 0;
      builderState[`${prefix}After`] = 0;
      renderBuilderCalendar();
      closeBuilderDatePopover(true);
      completeBuilderDateSelectionIfReady();
    }

    function openBuilderFlexFromPopover() {
      closeBuilderDatePopover(true);
      openBuilderFlexSheet(activeBuilderPopoverTarget);
    }

    function toggleBuilderPopoverFlex() {
      const popover = document.getElementById("builderDatePopover");
      if (!popover) return;
      activeBuilderPopoverFlexOpen = !activeBuilderPopoverFlexOpen;
      if (activeBuilderPopoverFlexOpen) {
        const prefix = activeBuilderPopoverTarget === "start" ? "start" : "end";
        builderPopoverFlexSnapshot = {
          before: builderState[`${prefix}Before`],
          after: builderState[`${prefix}After`]
        };
      }
      popover.classList.toggle("flex-open", activeBuilderPopoverFlexOpen);
      syncBuilderDateModeToggleState();
      if (isBuilderDateBottomPanelMode()) {
        const prefix = activeBuilderPopoverTarget === "start" ? "start" : "end";
        window.setTimeout(() => {
          renderBuilderDatePopoverTitle(activeBuilderPopoverTarget, activeBuilderPopoverDay, builderState[`${prefix}Before`], builderState[`${prefix}After`]);
        }, 260);
      }
      requestAnimationFrame(() => {
        positionBuilderDatePopover(popover, activeBuilderPopoverTrigger, activeBuilderPopoverTrigger?.closest(".builder-calendar-card"));
      });
    }

    function setBuilderPopoverMode(mode) {
      const popover = document.getElementById("builderDatePopover");
      if (!popover) return;
      const prefix = activeBuilderPopoverTarget === "start" ? "start" : "end";
      if (mode === "flex") {
        activeBuilderPopoverFlexOpen = true;
        builderPopoverFlexSnapshot = {
          before: builderState[`${prefix}Before`],
          after: builderState[`${prefix}After`]
        };
      } else {
        activeBuilderPopoverFlexOpen = false;
        builderState[`${prefix}Before`] = 0;
        builderState[`${prefix}After`] = 0;
        builderPopoverFlexSnapshot = null;
        renderBuilderCalendar();
        activeBuilderPopoverTrigger = getBuilderDateButton(activeBuilderPopoverDay) || activeBuilderPopoverTrigger;
      }
      const before = builderState[`${prefix}Before`];
      const after = builderState[`${prefix}After`];
      popover.classList.add("open");
      popover.classList.toggle("flex-open", activeBuilderPopoverFlexOpen);
      syncBuilderDateModeToggleState();
      window.setTimeout(() => {
        renderBuilderDatePopoverTitle(activeBuilderPopoverTarget, activeBuilderPopoverDay, before, after);
        const beforeEl = document.getElementById("builderPopoverBeforeFlex");
        const afterEl = document.getElementById("builderPopoverAfterFlex");
        if (beforeEl) beforeEl.textContent = formatBuilderFlexDayCount(before);
        if (afterEl) afterEl.textContent = formatBuilderFlexDayCount(after);
        updateBuilderPopoverFlexButtons();
      }, 260);
      updateBuilderPopoverFlexButtons();
      updateBuilderSummary();
      updateBuilderNotice();
      requestAnimationFrame(() => {
        positionBuilderDatePopover(popover, activeBuilderPopoverTrigger, activeBuilderPopoverTrigger?.closest(".builder-calendar-card"));
      });
    }

    function cancelBuilderPopoverFlex() {
      if (builderPopoverFlexSnapshot) {
        const prefix = activeBuilderPopoverTarget === "start" ? "start" : "end";
        builderState[`${prefix}Before`] = builderPopoverFlexSnapshot.before;
        builderState[`${prefix}After`] = builderPopoverFlexSnapshot.after;
      }
      activeBuilderPopoverFlexOpen = false;
      renderBuilderCalendar();
      requestAnimationFrame(() => {
        openBuilderDatePopover(activeBuilderPopoverTarget, getBuilderDateButton(activeBuilderPopoverDay));
      });
    }

    function confirmBuilderPopoverFlex() {
      activeBuilderPopoverFlexOpen = false;
      builderPopoverFlexSnapshot = null;
      closeBuilderDatePopover(true);
      completeBuilderDateSelectionIfReady();
    }

    function clampBuilderFlexWindow(changedKey) {
      if (!Number.isFinite(builderState.startDay) || !Number.isFinite(builderState.endDay)) return;
      const gap = Math.max(0, builderState.endDay - builderState.startDay);
      if (changedKey === "startAfter") {
        const maxStartAfter = Math.max(0, gap - builderState.endBefore - 1);
        builderState.startAfter = Math.max(0, Math.min(builderState.startAfter, maxStartAfter));
      } else if (changedKey === "endBefore") {
        const maxEndBefore = Math.max(0, gap - builderState.startAfter - 1);
        builderState.endBefore = Math.max(0, Math.min(builderState.endBefore, maxEndBefore));
      } else {
        builderState.startAfter = Math.max(0, Math.min(builderState.startAfter, Math.max(0, gap - builderState.endBefore - 1)));
        builderState.endBefore = Math.max(0, Math.min(builderState.endBefore, Math.max(0, gap - builderState.startAfter - 1)));
      }
    }

    function changeBuilderPopoverFlex(side, delta) {
      const prefix = activeBuilderPopoverTarget === "start" ? "start" : "end";
      const key = `${prefix}${side === "before" ? "Before" : "After"}`;
      const previous = builderState[key];
      builderState[key] = Math.max(0, Math.min(7, builderState[key] + delta));
      clampBuilderFlexWindow(key);
      if (!isBuilderCurrentFlexSelectionValid()) {
        builderState[key] = previous;
        clampBuilderFlexWindow(key);
      }
      document.getElementById(side === "before" ? "builderPopoverBeforeFlex" : "builderPopoverAfterFlex").textContent = formatBuilderFlexDayCount(builderState[key]);
      updateBuilderPopoverFlexButtons();
      if (window.matchMedia("(max-width: 640px)").matches) {
        const before = builderState[`${prefix}Before`];
        const after = builderState[`${prefix}After`];
        renderBuilderCalendar();
        renderBuilderDatePopoverTitle(activeBuilderPopoverTarget, activeBuilderPopoverDay, before, after);
        document.getElementById("builderPopoverBeforeFlex").textContent = formatBuilderFlexDayCount(before);
        document.getElementById("builderPopoverAfterFlex").textContent = formatBuilderFlexDayCount(after);
        activeBuilderPopoverFlexOpen = true;
        document.getElementById("builderDatePopover")?.classList.add("open", "flex-open");
        updateBuilderSummary();
        updateBuilderNotice();
        return;
      }
      const snapshot = builderPopoverFlexSnapshot;
      renderBuilderCalendar();
      requestAnimationFrame(() => {
        openBuilderDatePopover(activeBuilderPopoverTarget, getBuilderDateButton(activeBuilderPopoverDay));
        activeBuilderPopoverFlexOpen = true;
        builderPopoverFlexSnapshot = snapshot;
        const popover = document.getElementById("builderDatePopover");
        popover?.classList.add("flex-open");
        positionBuilderDatePopover(popover, activeBuilderPopoverTrigger, activeBuilderPopoverTrigger?.closest(".builder-calendar-card"));
      });
    }

    function updateBuilderSummary() {
      updateBuilderProgressState();
      const start = document.getElementById("builderStartSummary");
      const end = document.getElementById("builderEndSummary");
      const date = document.getElementById("builderDateSummary");
      const trip = document.getElementById("builderTripSummary");
      const price = document.getElementById("builderPriceSummary");
      const productLine = document.getElementById("builderProductSummaryLine");
      const product = document.getElementById("builderProductSummary");
      const completeStart = document.getElementById("builderCompleteStart");
      const completeEnd = document.getElementById("builderCompleteEnd");
      const completeTrip = document.getElementById("builderCompleteTrip");
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const toDate = (dayOffset) => new Date(builderState.viewYear, builderState.viewMonth, dayOffset);
      const toStamp = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
      const formatDate = (date) => {
        return `${date.getMonth() + 1}.${date.getDate()}(${weekdays[date.getDay()]})`;
      };
      const formatFlexRange = (day, before, after) => {
        const base = toDate(day);
        const min = addDays(base, -before);
        const max = addDays(base, after);
        return toStamp(min) === toStamp(max) ? formatDate(min) : `${formatDate(min)} - ${formatDate(max)}`;
      };
      const hasStart = Number.isFinite(builderState.startDay);
      const hasEnd = Number.isFinite(builderState.endDay);
      const selectedProduct = getBuilderSelectedFixedProduct();
      const productStartDate = selectedProduct?.departureDate ? parseJoinDate(selectedProduct.departureDate) : null;
      const productEndDate = selectedProduct?.returnDate ? parseJoinDate(selectedProduct.returnDate) : productStartDate;
      const productHasFixedDates = Boolean(productStartDate && !Number.isNaN(productStartDate.getTime()) && productEndDate && !Number.isNaN(productEndDate.getTime()));
      const startText = productHasFixedDates ? formatDate(productStartDate) : (hasStart ? formatFlexRange(builderState.startDay, builderState.startBefore, builderState.startAfter) : "-");
      const endText = productHasFixedDates ? formatDate(productEndDate) : (hasEnd ? formatFlexRange(builderState.endDay, builderState.endBefore, builderState.endAfter) : "-");
      const dateText = startText && startText !== "-" && endText && endText !== "-" ? (startText === endText ? startText : `${startText} ~ ${endText}`) : "-";
      if (productLine) productLine.hidden = builderStep === 1 || !builderState.productName;
      if (product) product.textContent = builderState.productName || "선택 전";
      if (start) start.textContent = startText;
      if (end) end.textContent = endText;
      if (date) date.textContent = dateText;
      if (price) {
        const priceValue = Number(selectedProduct?.price) || 0;
        price.textContent = priceValue ? `${formatPrice(priceValue)}원` : "-";
      }
      if (completeStart) completeStart.textContent = startText;
      if (completeEnd) completeEnd.textContent = endText;
      if (trip) {
        if (productHasFixedDates) {
          const durationText = formatTripDuration(selectedProduct);
          trip.textContent = durationText;
          if (completeTrip) {
            const people = document.querySelector('[data-builder-group="people"] .active')?.textContent.trim() || "2명";
            const round = document.querySelector('[data-builder-group="round"] .active')?.textContent.trim() || "18홀";
            completeTrip.textContent = `${durationText} · ${round} · ${people}`;
          }
        } else if (hasStart && hasEnd) {
          const startMin = addDays(toDate(builderState.startDay), -builderState.startBefore);
          const startMax = addDays(toDate(builderState.startDay), builderState.startAfter);
          const endMin = addDays(toDate(builderState.endDay), -builderState.endBefore);
          const endMax = addDays(toDate(builderState.endDay), builderState.endAfter);
          const dayMs = 24 * 60 * 60 * 1000;
          const minDays = Math.max(1, Math.round((toStamp(endMin) - toStamp(startMax)) / dayMs) + 1);
          const maxDays = Math.max(minDays, Math.round((toStamp(endMax) - toStamp(startMin)) / dayMs) + 1);
          trip.textContent = minDays === maxDays ? `${minDays}일` : `${minDays}일 - ${maxDays}일`;
          if (completeTrip) {
            const people = document.querySelector('[data-builder-group="people"] .active')?.textContent.trim() || "2명";
            const round = document.querySelector('[data-builder-group="round"] .active')?.textContent.trim() || "18?";
            const duration = minDays === maxDays ? `${Math.max(0, minDays - 1)}박 ${minDays}일` : `${minDays}일 - ${maxDays}일`;
            completeTrip.textContent = `${duration} · ${round} · ${people}`;
          }
        } else {
          trip.textContent = "-";
          if (completeTrip) completeTrip.textContent = "일정 선택 전 · 18홀 · 2명";
        }
      }
    }

    function updateBuilderNotice() {
      const notice = document.getElementById("builderStepNotice");
      if (!notice) return;
      notice.textContent = "여유있게 지정하면 멤버를 더 빠르게 모집할 수 있어요.";
    }

    function goBuilderProgressStep(step) {
      const targetStep = Math.max(1, Math.min(3, Number(step) || 1));
      if (builderState.mdPickMode && targetStep === 2) {
        setBuilderStep(1);
        return;
      }
      setBuilderStep(targetStep);
    }

    function updateBuilderProgressState() {
      const currentStep = Math.min(builderStep, 3);
      const dateComplete = Boolean(
        builderState.dateSelectionComplete
        && Number.isFinite(builderState.startDay)
        && Number.isFinite(builderState.endDay)
      );
      const regionComplete = Boolean(builderState.regionSelectionComplete && builderState.productId);
      document.querySelectorAll("#builderModal [data-builder-progress]").forEach((item) => {
        const itemStep = Number(item.dataset.builderProgress);
        const isDone = itemStep === 1 ? dateComplete : itemStep === 2 ? regionComplete : false;
        item.classList.toggle("active", itemStep === currentStep);
        item.classList.toggle("done", isDone);
      });
    }

    function setBuilderStep(step) {
      builderStep = step;
      closeBuilderDatePopover(true);
      closeBuilderFlexSheet();
      document.getElementById("builderModal")?.classList.toggle("mdpick-builder-mode", Boolean(builderState.mdPickMode));
      document.getElementById("builderModal")?.classList.toggle("mdpick-date-change-mode", Boolean(builderState.mdPickDateChangeMode));
      document.getElementById("builderModal")?.classList.toggle("mdpick-recruit-direct-mode", Boolean(builderState.mdPickRecruitDirectMode));
      document.getElementById("builderModal")?.classList.toggle("builder-complete-mode", step === 4);
      document.querySelectorAll("[data-builder-step]").forEach((panel) => {
        panel.classList.toggle("active", Number(panel.dataset.builderStep) === step);
      });
      updateBuilderProgressState();
      updateBuilderSummary();
      updateBuilderApplySummary();
      const prev = document.getElementById("builderPrevButton");
      const next = document.getElementById("builderNextButton");
      const bottom = document.getElementById("builderBottom");
      if (prev) {
        prev.style.display = step === 1 || step === 3 || builderState.mdPickRecruitDirectMode ? "none" : "";
        prev.textContent = step === 4 ? "전화 상담" : "이전";
        prev.setAttribute("onclick", step === 4 ? "handleBuilderPhoneInquiry()" : "prevBuilderStep()");
      }
      if (next) {
        next.textContent = step === 1 ? "다음" : step === 2 ? "다음" : step === 3 ? "신청하기" : "카톡 공유";
        next.disabled = false;
        next.style.gridColumn = step === 1 || step === 3 || builderState.mdPickRecruitDirectMode ? "1 / -1" : "";
        next.setAttribute("onclick", step === 4 ? "handleBuilderKakaoInquiry()" : "nextBuilderStep()");
      }
      if (bottom) {
        bottom.style.display = builderState.mdPickDateChangeMode || step === 1 || step === 2 || step === 4 ? "none" : "grid";
        bottom.classList.toggle("complete-mode", step === 4);
        bottom.classList.toggle("step-3", step === 3);
      }
      const body = document.getElementById("builderBody");
      if (body) {
        body.classList.toggle("builder-step-1", step === 1);
        body.classList.toggle("builder-step-3", step === 3);
        body.classList.toggle("builder-step-4", step === 4);
      }
      document.querySelector("#builderModal .builder-modal")?.classList.toggle("builder-complete-step", step === 4);
      if (step === 2) {
        renderBuilderRegionSearch(document.getElementById("builderRegionSearchInput")?.value || "");
      }
      updateBuilderAgreeCollapsedLayout();
      requestAnimationFrame(updateBuilderBottomOffset);
      body?.scrollTo({ top: 0, behavior: "smooth" });
    }

    function updateBuilderBottomOffset() {
      if (!window.matchMedia("(max-width: 640px)").matches) return;
      const bottom = document.getElementById("builderBottom");
      const bottomStyle = bottom ? window.getComputedStyle(bottom) : null;
      const bottomRect = bottom?.getBoundingClientRect();
      const isVisible = Boolean(bottomStyle && bottomStyle.display !== "none");
      const height = isVisible && bottomRect?.height
        ? Math.ceil(bottomRect.height)
        : 0;
      document.getElementById("builderModal")?.style.setProperty("--builder-bottom-offset", `${isVisible ? height || 118 : 0}px`);
      document.getElementById("builderDatePopover")?.style.removeProperty("--builder-bottom-offset");
    }

    window.addEventListener("resize", updateBuilderBottomOffset);

    function handleBuilderPhoneInquiry() {
      if (window.matchMedia("(max-width: 768px)").matches) {
        location.href = "tel:02-3446-1119";
      } else {
        alert("전화번호: 02-3446-1119");
      }
    }

    function handleBuilderKakaoInquiry() {
      alert("카카오톡 공유 샘플입니다.");
    }

    function selectBuilderApplyOption(button) {
      const group = button?.closest("[data-builder-apply-single]");
      if (!group) return;
      group.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      updateBuilderApplySummary();
    }

    function getCompanionScopeConfig(scope) {
      const isBuilder = scope === "builder";
      return {
        scope,
        inputId: isBuilder ? "builderApplyPeople" : "globalApplyPeople",
        displayId: isBuilder ? "builderApplyPeopleDisplay" : "globalApplyPeopleDisplay",
        listId: isBuilder ? "builderCompanionList" : "globalCompanionList",
        accordionId: isBuilder ? "builderApplyPeopleAccordion" : "globalApplyPeopleAccordion",
        fieldSelector: `[data-companion-field="${scope}"]`,
        modeSelector: isBuilder ? ".builder-apply-form [data-builder-apply-single]" : '[data-people-mode="global"]',
        summary: isBuilder ? updateBuilderApplySummary : updateApplyProgressive
      };
    }

    function parseApplyPeopleValue(value) {
      const count = Number(String(value || "1").replace(/\D/g, "")) || 1;
      return Math.max(1, Math.min(BUILDER_APPLICATION_MAX_CAPACITY, count));
    }

    function getCompanionPeople(scope) {
      const config = getCompanionScopeConfig(scope);
      return parseApplyPeopleValue(document.getElementById(config.inputId)?.value || "1");
    }

    function getCompanionGenders(scope) {
      const config = getCompanionScopeConfig(scope);
      return Array.from(document.querySelectorAll(`#${config.listId} .apply-companion-card`)).map((card) => {
        return card.querySelector(".apply-companion-gender-button.active")?.dataset.gender || "";
      });
    }

    function clearCompanionGenderError(scope) {
      const config = getCompanionScopeConfig(scope);
      document.querySelector(config.fieldSelector)?.classList.remove("has-error");
    }

    function getApplyScopeCapacity(scope) {
      if (scope === "builder") return BUILDER_APPLICATION_MAX_CAPACITY;
      return JOIN_MAX_CAPACITY;
    }

    function getApplyExistingParticipants(scope) {
      if (scope !== "global") return [];
      const join = getCurrentApplyJoin();
      return join && Array.isArray(join.participants) ? getConfirmedParticipants(join) : [];
    }

    function getApplyAvailablePeople(scope) {
      if (scope === "builder") return BUILDER_APPLICATION_MAX_CAPACITY;
      return Math.max(1, Math.min(JOIN_MAX_CAPACITY, getGlobalApplyRemainingSeats()));
    }

    function syncApplyPeopleModeAvailability(scope) {
      const config = getCompanionScopeConfig(scope);
      const modeGroup = document.querySelector(config.modeSelector);
      if (!modeGroup) return;
      const canGroup = getApplyAvailablePeople(scope) > 1;
      modeGroup.classList.toggle("single-only", !canGroup);
      if (!canGroup) modeGroup.classList.remove("is-group");
      if (!canGroup) {
        modeGroup.querySelectorAll(".apply-people-button").forEach((button) => {
          const isGroupButton = button.dataset.mode === "group" || button.dataset.joinMode === "group";
          const isSolo = !isGroupButton;
          button.classList.toggle("active", isSolo);
        });
      }
      const canAdd = getCompanionGenders(scope).length < Math.max(0, getApplyAvailablePeople(scope) - 1);
      modeGroup.querySelectorAll(".apply-people-inline-add-button").forEach((button) => {
        button.disabled = !canGroup || !canAdd;
      });
    }

    function getApplyApplicantGender(scope) {
      const group = scope === "builder" ? "builder-gender" : "global-gender";
      return document.querySelector(`[data-chip-group="${group}"] .apply-chip.active`)?.dataset.value || "남성";
    }

    function getApplyParticipantGenderCounts(participants) {
      return participants.reduce((acc, participant) => {
        const label = getParticipantGenderLabel(participant.gender);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
    }

    function formatApplyParticipantGenderCounts(participants) {
      const counts = participants.reduce((acc, participant) => {
        const label = getParticipantGenderLabel(participant.gender);
        if (label.includes("여")) acc.female += 1;
        else if (label.includes("남")) acc.male += 1;
        return acc;
      }, { male: 0, female: 0 });
      const labels = [];
      if (counts.male) labels.push(`남성 ${counts.male}명`);
      if (counts.female) labels.push(`여성 ${counts.female}명`);
      return labels.length ? labels.join(" · ") : "인원구성 미정";
    }

    function renderApplyParticipantLabel(participant) {
      const label = escapeHtml(participant?.label || "");
      if (participant?.type === "existing" && (participant.isCurrentMember || isJoinParticipantForCurrentMember(participant))) {
        return '<div class="join-my-card-participant-me-badge apply-me-badge">나</div>';
      }
      if (participant?.type === "applicant") return `<div class="join-my-card-participant-me-badge apply-me-badge">${label}</div>`;
      return label;
    }

    function getApplyParticipantKey(participant) {
      if (!participant) return "empty";
      return `${participant.type}-${participant.companionIndex ?? ""}-${participant.gender || ""}-${participant.label || ""}-${participant.isCurrentMember ? "me" : ""}`;
    }

    function renderApplyParticipantSlot(participant, index, scope) {
      const participantKey = escapeHtml(getApplyParticipantKey(participant));
      if (!participant) {
        return `<div class="apply-participant-slot empty" data-participant-key="${participantKey}"><div class="apply-participant-avatar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-icon lucide-user" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="apply-participant-label">빈자리</div></div>`;
      }
      const removable = participant.type === "companion";
      const labelHtml = renderApplyParticipantLabel(participant);
      const labelHiddenAttr = labelHtml ? "" : ' aria-hidden="true"';
      const genderFlowClass = getParticipantGenderFlowClass(participant.gender);
      const flowDelayStyle = getParticipantFlowDelayStyle(participant, `${scope}-apply-${participant.type || ""}-${index}`);
      return `
        <div class="apply-participant-slot filled ${participant.type === "existing" ? "is-existing" : ""}" data-apply-participant-index="${index}" data-participant-key="${participantKey}">
          ${removable ? `<button type="button" class="apply-participant-remove" onclick="removeCompanionGender('${scope}', ${participant.companionIndex})" aria-label="${escapeHtml(participant.label || "일행")} 삭제"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" stroke-linecap="round"/></svg></button>` : ""}
          <div class="apply-participant-avatar-wrap">
            <div class="apply-participant-avatar participant-flow-avatar ${genderFlowClass}" style="${flowDelayStyle}"><img src="${participant.gif}" alt="${escapeHtml(participant.label)}"></div>
          </div>
          <div class="apply-participant-label${labelHtml ? "" : " is-placeholder"}"${labelHiddenAttr}>${labelHtml || "&nbsp;"}</div>
        </div>
      `;
    }

    function syncApplyParticipantRail(rail, slots, scope, existingDividerIndex = 0, options = {}) {
      if (!rail) return false;
      const extraClass = options.className ? ` ${options.className}` : "";
      rail.className = `apply-participant-rail${extraClass}${existingDividerIndex ? ` has-existing-divider existing-divider-${existingDividerIndex}` : ""}`;
      slots.forEach((participant, index) => {
        const current = rail.children[index];
        if (!current) {
          const wrapper = document.createElement("div");
          wrapper.innerHTML = renderApplyParticipantSlot(participant, index, scope).trim();
          if (wrapper.firstElementChild) rail.appendChild(wrapper.firstElementChild);
          return;
        }
        if (!participant) {
          if (!current.classList.contains("empty")) current.outerHTML = renderApplyParticipantSlot(null, index, scope);
          return;
        }
        const nextKey = getApplyParticipantKey(participant);
        if (current.dataset.participantKey === nextKey) return;
        current.outerHTML = renderApplyParticipantSlot(participant, index, scope);
      });
      while (rail.children.length > slots.length) rail.lastElementChild?.remove();
      return true;
    }

    function renderCompanionGenderRows(scope, overrideGenders = null) {
      const config = getCompanionScopeConfig(scope);
      const join = scope === "global" ? getCurrentApplyJoin() : null;
      const isMonthlyApply = scope === "global" && isMonthlyRecommendationJoin(join);
      const availablePeople = getApplyAvailablePeople(scope);
      const totalPeople = Math.min(getCompanionPeople(scope), availablePeople);
      const companionCount = Math.max(0, totalPeople - 1);
      const preserved = (Array.isArray(overrideGenders) ? overrideGenders : getCompanionGenders(scope)).slice(0, Math.max(0, availablePeople - 1));
      const list = document.getElementById(config.listId);
      const display = document.getElementById(config.displayId);
      const minus = document.querySelector(`[data-people-stepper="${scope}"] [data-people-step="minus"]`);
      const plus = document.querySelector(`[data-people-stepper="${scope}"] [data-people-step="plus"]`);
      if (display) display.textContent = `${totalPeople}명`;
      if (minus) minus.disabled = totalPeople <= 2;
      if (plus) plus.disabled = totalPeople >= availablePeople;
      syncApplyPeopleModeAvailability(scope);
      if (!list) return;
      const genders = Array.from({ length: companionCount }, (_, index) => preserved[index] || "남성");
      const existing = getApplyExistingParticipants(scope).map((participant) => ({
        ...participant,
        type: "existing",
        label: participant.name || "참여자",
        gender: participant.gender,
        gif: participant.gif || getBuilderApplicationGenderIcon(participant.gender, null, `${scope}-existing-${participant.id || ""}`),
        isCurrentMember: isJoinParticipantForCurrentMember(participant)
      }));
      const applicantGender = getApplyApplicantGender(scope);
      const applicant = {
        type: "applicant",
        label: "나",
        gender: applicantGender,
        gif: getBuilderApplicationGenderIcon(applicantGender, null, `${scope}-applicant`)
      };
      const companions = genders.map((gender, index) => ({
        type: "companion",
        companionIndex: index,
        label: `일행${index + 1}`,
        gender,
        gif: getBuilderApplicationGenderIcon(gender, null, `${scope}-companion-${index}-${gender}`)
      }));
      const monthlyCapacity = isMonthlyApply
        ? getJoinRecruitmentCapacity(join, Number(join?.maxCapacity || join?.capacity || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY)
        : JOIN_MAX_CAPACITY;
      const monthlyCurrentCount = isMonthlyApply ? getMonthlyCardParticipantCount(join) : 0;
      const monthlyAfterCount = Math.min(Math.max(monthlyCapacity, monthlyCurrentCount), monthlyCurrentCount + totalPeople);
      const monthlyProgressBase = Math.max(monthlyCapacity, monthlyCurrentCount || 0, 1);
      const monthlyProgress = isMonthlyApply ? Math.max(0, Math.min(100, Math.round((monthlyAfterCount / monthlyProgressBase) * 100))) : 0;
      const monthlySlotCount = Math.max(1, availablePeople);
      const visibleParticipants = isMonthlyApply
        ? [applicant, ...companions].slice(0, monthlySlotCount)
        : [...existing, applicant, ...companions].slice(0, JOIN_MAX_CAPACITY);
      const slots = isMonthlyApply
        ? [
            ...visibleParticipants,
            ...Array.from({ length: Math.max(0, monthlySlotCount - visibleParticipants.length) }).map(() => null)
          ]
        : [
            ...visibleParticipants,
            ...Array.from({ length: Math.max(0, JOIN_MAX_CAPACITY - visibleParticipants.length) }).map(() => null)
          ];
      const existingDividerIndex = !isMonthlyApply && existing.length > 0 && existing.length < JOIN_MAX_CAPACITY ? existing.length : 0;
      const canAdd = genders.length < Math.max(0, availablePeople - 1);
      const newParticipants = [applicant, ...companions];
      const monthlyNewGenderCounts = isMonthlyApply
        ? newParticipants.reduce((acc, participant) => {
            const label = getParticipantGenderLabel(participant.gender);
            if (label.includes("여")) acc.female += 1;
            else if (label.includes("남")) acc.male += 1;
            return acc;
          }, { male: 0, female: 0 })
        : { male: 0, female: 0 };
      const statusDivider = `<svg class="apply-companion-status-divider" viewBox="0 0 1 12" fill="none" aria-hidden="true"><path d="M0.5 0.5v11" stroke="currentColor" stroke-linecap="round"/></svg>`;
      const existingStatusLine = scope === "global" && !isMonthlyApply
        ? `<div class="apply-companion-status-line"><div class="apply-companion-status-label">기존</div>${statusDivider}<div class="apply-companion-status-count">총 ${existing.length}명</div>${statusDivider}<div class="apply-companion-status-gender">${existing.length ? formatApplyParticipantGenderCounts(existing) : "-"}</div></div>`
        : "";
      const statusHtml = isMonthlyApply
        ? `
        <div class="apply-companion-status apply-monthly-status">
          <div class="apply-monthly-recruit-box">
            <div class="apply-monthly-status-head">
              <div class="apply-monthly-status-title">모집현황</div>
            </div>
            <div class="apply-monthly-gauge">
              <div class="apply-monthly-status-count">${monthlyAfterCount}/${monthlyProgressBase}명</div>
              <div class="apply-monthly-progress-track" aria-hidden="true">
                <div class="apply-monthly-progress-fill" style="--apply-monthly-progress:${monthlyProgress}%;"></div>
              </div>
            </div>
          </div>
          <div class="apply-monthly-status-meta">
            <div class="apply-monthly-application-label">나의 신청</div>
            <div class="apply-monthly-application-count">총 ${newParticipants.length}명</div>
            <div class="apply-monthly-application-genders">
              <div class="apply-monthly-application-gender"><span class="apply-monthly-application-gender-label">남성</span><span class="apply-monthly-application-gender-count">${monthlyNewGenderCounts.male}명</span></div>
              <div class="apply-monthly-application-gender"><span class="apply-monthly-application-gender-label">여성</span><span class="apply-monthly-application-gender-count">${monthlyNewGenderCounts.female}명</span></div>
            </div>
          </div>
        </div>`
        : `
        <div class="apply-companion-status">
          ${existingStatusLine}
          <div class="apply-companion-status-line"><div class="apply-companion-status-label">신규</div>${statusDivider}<div class="apply-companion-status-count">총 ${newParticipants.length}명</div>${statusDivider}<div class="apply-companion-status-gender">${formatApplyParticipantGenderCounts(newParticipants)}</div></div>
        </div>`;
      const companionCardsHtml = genders.map((gender, index) => `
          <div class="apply-companion-card" data-companion-index="${index}" hidden>
            <div class="apply-companion-gender-options is-hidden" role="group" aria-label="동반자 ${index + 1} 성별">
              <button type="button" class="apply-companion-gender-button${gender === "남성" ? " active" : ""}" data-gender="남성" onclick="selectCompanionGender('${scope}', ${index}, '남성')">남성</button>
              <button type="button" class="apply-companion-gender-button${gender === "여성" ? " active" : ""}" data-gender="여성" onclick="selectCompanionGender('${scope}', ${index}, '여성')">여성</button>
            </div>
          </div>
        `).join("");
      let status = list.querySelector(":scope > .apply-companion-status");
      if (status) {
        status.outerHTML = statusHtml;
      } else {
        list.insertAdjacentHTML("afterbegin", statusHtml);
      }
      let rail = list.querySelector(":scope > .apply-participant-rail");
      if (!rail) {
        rail = document.createElement("div");
        list.querySelector(":scope > .apply-companion-status")?.after(rail);
      }
      syncApplyParticipantRail(rail, slots, scope, existingDividerIndex, { className: isMonthlyApply ? "monthly" : "" });
      list.querySelectorAll(":scope > .apply-companion-card").forEach((card) => card.remove());
      rail.insertAdjacentHTML("afterend", companionCardsHtml);
      document.querySelectorAll(`${config.modeSelector} .apply-people-inline-add-button`).forEach((button) => {
        button.disabled = !canAdd;
      });
    }

    function setCompanionGenders(scope, genders, options = {}) {
      const config = getCompanionScopeConfig(scope);
      const availablePeople = getApplyAvailablePeople(scope);
      const normalized = (genders || []).slice(0, Math.max(0, availablePeople - 1));
      const input = document.getElementById(config.inputId);
      if (input) input.value = String(Math.max(1, normalized.length + 1));
      renderCompanionGenderRows(scope, normalized);
      clearCompanionGenderError(scope);
      if (scope === "global") updateGlobalApplyRemainingSeat();
      if (options.update !== false) config.summary?.();
    }

    function addCompanionGender(scope, gender) {
      const current = getCompanionGenders(scope);
      setCompanionGenders(scope, [...current, gender]);
    }

    function removeCompanionGender(scope, index) {
      const current = getCompanionGenders(scope);
      current.splice(index, 1);
      setCompanionGenders(scope, current);
    }

    function setCompanionPeople(scope, value, options = {}) {
      const config = getCompanionScopeConfig(scope);
      const count = Math.max(1, Math.min(getApplyAvailablePeople(scope), parseApplyPeopleValue(value)));
      const preserved = getCompanionGenders(scope).slice(0, Math.max(0, count - 1));
      const input = document.getElementById(config.inputId);
      if (input) input.value = String(count);
      renderCompanionGenderRows(scope, preserved);
      clearCompanionGenderError(scope);
      if (scope === "global") updateGlobalApplyRemainingSeat();
      if (options.update !== false) config.summary?.();
    }

    function changeCompanionPeople(scope, delta) {
      const availablePeople = getApplyAvailablePeople(scope);
      if (availablePeople < 2) {
        if (scope === "builder") setBuilderApplyPeopleMode("solo");
        else setGlobalApplyPeopleMode("solo");
        return;
      }
      const next = Math.max(2, Math.min(availablePeople, getCompanionPeople(scope) + delta));
      setCompanionPeople(scope, next);
    }

    function selectCompanionGender(scope, index, gender) {
      const config = getCompanionScopeConfig(scope);
      const card = document.querySelector(`#${config.listId} [data-companion-index="${index}"]`);
      card?.querySelectorAll(".apply-companion-gender-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.gender === gender);
      });
      clearCompanionGenderError(scope);
    }

    function getCompanionPayload(scope) {
      return getCompanionGenders(scope).map((gender) => ({ gender })).filter((item) => item.gender);
    }

    function validateCompanionGenders(scope) {
      const config = getCompanionScopeConfig(scope);
      const requiredCount = Math.max(0, getCompanionPeople(scope) - 1);
      const genders = getCompanionGenders(scope);
      const valid = requiredCount === 0 || (genders.length === requiredCount && genders.every(Boolean));
      const field = document.querySelector(config.fieldSelector);
      field?.classList.toggle("has-error", !valid);
      if (!valid) {
        const firstIncomplete = Array.from(field?.querySelectorAll(".apply-companion-card") || [])
          .find((card) => !card.querySelector(".apply-companion-gender-button.active"));
        firstIncomplete?.querySelector(".apply-companion-gender-button")?.focus?.();
      }
      return valid;
    }

    function setBuilderApplyPeople(value) {
      const count = parseApplyPeopleValue(value);
      setCompanionPeople("builder", count);
      const modeGroup = document.querySelector(".builder-apply-form [data-builder-apply-single]");
      if (count > 1) {
        modeGroup?.classList.add("is-group");
        modeGroup?.querySelectorAll(".apply-people-button").forEach((button) => {
          button.classList.toggle("active", button.dataset.joinMode === "group");
        });
        document.getElementById("builderApplyPeopleAccordion")?.classList.add("open");
      } else {
        modeGroup?.classList.remove("is-group");
        modeGroup?.querySelectorAll(".apply-people-button").forEach((button) => {
          button.classList.toggle("active", button.dataset.joinMode !== "group");
        });
        document.getElementById("builderApplyPeopleAccordion")?.classList.remove("open");
      }
    }

    function setBuilderApplyPeopleMode(mode) {
      const accordion = document.getElementById("builderApplyPeopleAccordion");
      const canGroup = getApplyAvailablePeople("builder") > 1;
      const isGroup = mode === "group" && canGroup;
      const modeGroup = document.querySelector(".builder-apply-form [data-builder-apply-single]");
      modeGroup?.classList.toggle("is-group", isGroup);
      modeGroup?.querySelectorAll(".apply-people-button").forEach((button) => {
        const isGroupButton = button.dataset.joinMode === "group";
        button.classList.toggle("active", isGroup ? isGroupButton : !isGroupButton);
      });
      accordion?.classList.toggle("open", isGroup);
      if (isGroup) {
        const currentPeople = getCompanionPeople("builder");
        setCompanionPeople("builder", currentPeople > 1 ? currentPeople : 1);
      } else {
        setCompanionPeople("builder", 1);
      }
      updateBuilderApplySummary();
    }

    function updateBuilderTravelerFieldState(input) {
      const value = String(input?.value || "").trim();
      const isPhonePrefixOnly = input?.id === "builderApplyPhone" && value === "010";
      input?.closest(".traveler-field")?.classList.toggle("is-filled", value.length > 0 && !isPhonePrefixOnly);
      input?.closest(".field.has-error")?.classList.remove("has-error");
    }

    function formatBuilderApplyPhone(input) {
      if (!input) return;
      let digits = String(input.value || "").replace(/\D/g, "").slice(0, 11);
      if (digits && !digits.startsWith("010")) {
        digits = `010${digits}`.slice(0, 11);
      }
      input.value = digits;
    }

    function handleBuilderApplyPhoneFocus(input) {
      if (!input) return;
      if (!String(input.value || "").trim()) {
        input.value = "010";
        input.setSelectionRange?.(input.value.length, input.value.length);
      }
      updateBuilderTravelerFieldState(input);
    }

    function setBuilderApplyProfession(value) {
      const input = document.getElementById("builderApplyProfession");
      const chip = Array.from(document.querySelectorAll(".builder-apply-form .profession-chip")).find((item) => item.textContent.trim() === value);
      chip?.classList.toggle("active");
      const values = Array.from(document.querySelectorAll(".builder-apply-form .profession-chip.active")).map((item) => item.textContent.trim());
      if (input) {
        input.value = values.join(", ");
        input.closest(".traveler-field")?.classList.toggle("is-filled", input.value.trim().length > 0);
      }
      updateBuilderApplySummary();
    }

    function syncBuilderProfessionChipsFromInput() {
      const value = document.getElementById("builderApplyProfession")?.value || "";
      const selected = value.split(",").map((item) => item.trim()).filter(Boolean);
      document.querySelectorAll(".builder-apply-form .profession-chip").forEach((chip) => {
        chip.classList.toggle("active", selected.includes(chip.textContent.trim()));
      });
    }

    function updateBuilderApplySummary() {
      updateApplyBookingOptions("builder");
      const canShowApplySummary = builderStep >= 3;
      const nameValue = String(document.getElementById("builderApplyName")?.value || "").trim();
      const birthValue = String(document.getElementById("builderApplyBirthYear")?.value || "").trim();
      const genderValue = document.querySelector('[data-chip-group="builder-gender"] .apply-chip.active')?.dataset.value || "";
      const maskName = (value) => value ? `${value.charAt(0)}**` : "";
      const formatAgeBand = (value) => {
        const year = Number(String(value).match(/\d{4}/)?.[0] || NaN);
        if (!Number.isFinite(year)) return "";
        const age = new Date().getFullYear() - year;
        if (age < 10 || age > 99) return "";
        const decade = Math.floor(age / 10) * 10;
        const offset = age % 10;
        const phase = offset <= 3 ? "초반" : offset <= 6 ? "중반" : "후반";
        return `${decade}대 ${phase}`;
      };
      const participantText = [maskName(nameValue), genderValue, formatAgeBand(birthValue)].filter(Boolean).join(" · ");
      const peopleCount = getCompanionPeople("builder");
      const peopleText = peopleCount ? `${peopleCount}명` : "";
      const pairs = [
        ["builderApplyNameSummaryLine", "builderApplyNameSummary", participantText],
        ["builderApplyBirthSummaryLine", "builderApplyBirthSummary", peopleText],
        ["builderApplyProfessionSummaryLine", "builderApplyProfessionSummary", document.getElementById("builderApplyProfession")?.value || ""]
      ];
      pairs.forEach(([lineId, valueId, rawValue]) => {
        const value = String(rawValue || "").trim();
        const line = document.getElementById(lineId);
        const target = document.getElementById(valueId);
        if (target) target.textContent = value;
        if (line) line.hidden = !canShowApplySummary || !value;
      });
    }

    function setBuilderApplyGreeting(value) {
      const input = document.getElementById("builderApplyGreeting");
      if (input) input.value = value;
    }

    function getBuilderApplyAgeDisplay(birthYear) {
      if (!/^\d{4}$/.test(birthYear || "")) return "";
      const year = Number(birthYear);
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      if (age < 10 || age > 99) return "";
      const decade = Math.floor(age / 10) * 10;
      const ones = age % 10;
      const phase = ones <= 3 ? "초반" : ones <= 6 ? "중반" : "후반";
      return `${decade}대 ${phase}`;
    }

    function markBuilderApplyFieldError(fieldKey) {
      const field = document.querySelector(`.builder-apply-form [data-builder-apply-field="${fieldKey}"]`);
      field?.classList.add("has-error");
      field?.querySelector("input, textarea, button")?.focus?.();
    }

    function clearBuilderApplyErrors() {
      document.querySelectorAll(".builder-apply-form .field.has-error").forEach((field) => field.classList.remove("has-error"));
      document.getElementById("builderApplyPrivacyError")?.classList.remove("is-visible");
    }

    function hasRequiredBuilderApplyAgreements() {
      return true;
    }

    function getSelectedBuilderApplyStyles() {
      return Array.from(document.querySelectorAll('[data-chip-group="builder-style"] .apply-chip.active'))
        .map((chip) => chip.dataset.value || chip.textContent.trim())
        .filter(Boolean);
    }

    function validateBuilderApplyStyleSelection() {
      if (getSelectedBuilderApplyStyles().length) return true;
      scrollApplyChipGroupIntoView("builder-style");
      openBuilderAlert("라운딩 스타일을 하나 이상 선택해 주세요.");
      return false;
    }

    function getBuilderApplyValidationPayload() {
      const member = getJoinCachedCurrentMember() || getJoinLoginState().member || {};
      const cached = getRememberedJoinMemberProfile(member || {});
      const cachedBirthYear = getBirthYearFromJoinMember(member || {}, cached);
      const cachedPhone = normalizeJoinMemberPhone(cached.memberMobile || cached.mobile || cached.phone || member.memberMobile || "");
      return {
        applicant: {
          name: document.getElementById("builderApplyName")?.value.trim()
            || cached.name
            || cached.memberName
            || member.memberName
            || "",
          gender: document.querySelector('[data-chip-group="builder-gender"] .apply-chip.active')?.dataset.value
            || cached.gender
            || member.gender
            || "",
          birthYear: document.getElementById("builderApplyBirthYear")?.value.trim()
            || cachedBirthYear
            || "",
          phone: normalizeJoinMemberPhone(document.getElementById("builderApplyPhone")?.value.trim() || cachedPhone),
          styles: getSelectedBuilderApplyStyles()
        }
      };
    }

    function parseBuilderStorageRegionParts(value = "") {
      const parts = String(value || "").split(",").map((part) => part.trim()).filter(Boolean);
      return {
        region: parts[0] || "",
        country: parts.length >= 2 ? parts.slice(1).join(", ") : ""
      };
    }

    function getBuilderStorageRegionText(regions = [], fallbackRegion = "") {
      const source = Array.isArray(regions) && regions.length ? regions : (fallbackRegion ? [fallbackRegion] : []);
      return source.map((region) => parseBuilderStorageRegionParts(region).region || region).filter(Boolean).join(", ");
    }

    function getBuilderStorageCountryText(regions = [], fallbackRegion = "") {
      const source = Array.isArray(regions) && regions.length ? regions : (fallbackRegion ? [fallbackRegion] : []);
      return Array.from(new Set(source.map((region) => parseBuilderStorageRegionParts(region).country).filter(Boolean))).join(", ");
    }

    function inferBuilderCountryFromRegion(regionName = "") {
      const target = String(regionName || "").split(",").map((part) => part.trim()).filter(Boolean)[0] || "";
      if (!target) return "";
      for (const category of (regionTree || [])) {
        for (const country of (category.countries || [])) {
          if (target === country.name) return country.name;
          if ((country.cities || []).some((city) => city === target || regionLabel(city, country.name) === regionName)) {
            return country.name;
          }
        }
      }
      return "";
    }

    async function getBuilderApplyPayload() {
      const memberProfile = await getJoinApplyMemberProfile();
      const name = document.getElementById("builderApplyName")?.value.trim() || memberProfile.name || "";
      const birthYear = document.getElementById("builderApplyBirthYear")?.value.trim() || memberProfile.birthYear || "";
      const gender = document.querySelector('[data-chip-group="builder-gender"] .apply-chip.active')?.dataset.value || memberProfile.gender || "";
      const phone = normalizeJoinMemberPhone(document.getElementById("builderApplyPhone")?.value.trim() || memberProfile.phone || "");
      const profession = document.getElementById("builderApplyProfession")?.value.trim() || memberProfile.profession || "";
      const people = getCompanionPeople("builder");
      const companions = getCompanionPayload("builder");
      const level = memberProfile.level || "";
      const styles = getSelectedBuilderApplyStyles();
      const memberPreferences = Array.from(document.querySelectorAll('[data-chip-group="builder-member-preference"] .apply-chip.active')).map((chip) => chip.dataset.value || chip.textContent.trim());
      const greeting = document.getElementById("builderApplyGreeting")?.value.trim() || "";
      const requiredAgreed = true;
      const marketingAgreed = false;
      const submittedAt = nowKstISOString();
      const cachedMember = getJoinCachedCurrentMember() || getJoinLoginState().member || {};
      const cachedProfile = getRememberedJoinMemberProfile(memberProfile.member || cachedMember);
      const memberPayload = buildJoinSubmissionMemberPayload(
        memberProfile.member,
        cachedMember,
        cachedProfile,
        memberProfile,
        { memberName: name, memberMobile: phone }
      );
      const builderMemberKey = memberPayload.memberKey || memberPayload.memberSeq || memberPayload.memberId || name || "member";
      const applicationId = buildGoogleSheetRecordId("nsa", submittedAt, builderMemberKey);
      const scheduleId = buildGoogleSheetRecordId("sch", applicationId);
      const selectedProduct = getBuilderSelectedFixedProduct()
        || [...(externalGolfJoinProducts || []), ...joins].find((item) => item.id === builderState.productId)
        || { id: builderState.productId };
      if (
        selectedProduct
        && (
          !selectedProduct.secretTourDetailLoaded
          || shouldLoadSecretTourFlightSchedule(selectedProduct, selectedProduct)
        )
      ) {
        try {
          const baseDetail = await loadSecretTourGoodsDetail(selectedProduct);
          const detail = await loadSecretTourGoodsFlightSchedule(selectedProduct, baseDetail);
          Object.assign(selectedProduct, mergeSecretTourGoodsDetail(selectedProduct, detail), { secretTourDetailLoaded: true });
        } catch (error) {
          golfJoinSafeWarn("Failed to load booking option detail.", error);
        }
      }
      const selectedProductReference = getSecretTourProductReference(selectedProduct);
      const selectedProductFamilyId = builderState.productId ? getGolfJoinProductFamilyId(selectedProduct) : "";
      const bookingOptions = getApplyBookingOptions("builder");
      const productDepartureDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedProduct?.departureDate || "") ? selectedProduct.departureDate : "";
      const productReturnDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedProduct?.returnDate || "") ? selectedProduct.returnDate : productDepartureDate;
      const useProductFixedDates = Boolean(builderState.productId && productDepartureDate);
      const builderDepartureDates = useProductFixedDates
        ? [productDepartureDate]
        : (typeof getBuilderSelectedDepartureDates === "function" ? getBuilderSelectedDepartureDates() : []);
      const builderReturnDates = useProductFixedDates
        ? [productReturnDate]
        : (typeof getBuilderSelectedReturnDates === "function" ? getBuilderSelectedReturnDates() : []);
      const productStartSummary = useProductFixedDates ? formatDetailDateWithDay(productDepartureDate) : "";
      const productEndSummary = useProductFixedDates ? formatDetailDateWithDay(productReturnDate) : "";
      const productTripSummary = useProductFixedDates ? formatTripDuration(selectedProduct) : "";
      const productTypeName = getDetailProductType(selectedProduct);
      const productPackType = productTypeName === "항공팩" ? "air" : "golf";
      const tripCountry = getBuilderStorageCountryText(builderState.regions, builderState.region)
        || builderState.country
        || selectedProduct.country
        || inferBuilderCountryFromRegion(builderState.region)
        || inferBuilderCountryFromRegion(selectedProduct.region)
        || "";
      const tripRegion = getBuilderStorageRegionText(builderState.regions, builderState.region)
        || selectedProduct.region
        || selectedProduct.area
        || selectedProduct.city
        || "";
      const tripProductName = builderState.productName || selectedProduct.title || selectedProduct.productName || selectedProduct.goodName || "";
      const rawTripDepartureAirport = resolveSecretTourDepartureAirport(selectedProduct, {
        title: tripProductName
      });
      const tripAirline = resolveSecretTourAirline(selectedProduct, productTypeName);
      const tripDepartureAirport = rawTripDepartureAirport;
      const tripArrivalAirport = String(selectedProduct.arrivalAirport || selectedProduct.arrAirport || selectedProduct.toCity || selectedProduct.arrivalCity || "").trim();

      return {
        applicationId,
        scheduleId,
        source: "new_schedule_builder",
        submittedAt,
        pageUrl: getJoinCanonicalPageUrl(),
        memberKey: memberPayload.memberKey,
        member: memberPayload,
        applicant: {
          name,
          gender,
          birthYear,
          ageDisplay: memberProfile.ageDisplay || getBuilderApplyAgeDisplay(birthYear),
          phone,
          profession,
          people,
          companions,
          level,
          styles,
          memberPreferences,
          preferredMemberComposition: memberPreferences,
          greeting,
          roomType: bookingOptions.roomType,
          flightRequestType: bookingOptions.flightRequestType,
          singleRoomSurcharge: bookingOptions.singleRoomSurcharge,
          singleRoomSurchargeText: bookingOptions.singleRoomSurchargeText,
          singleRoomSurchargeStatus: bookingOptions.singleRoomSurchargeStatus
        },
        trip: {
          country: tripCountry,
          region: tripRegion,
          airline: tripAirline,
          departureAirport: tripDepartureAirport,
          arrivalAirport: tripArrivalAirport,
          imageUrl: normalizeGolfJoinProductImageUrl(selectedProduct.image || selectedProduct.imageUrl),
          productId: builderState.productId || selectedProductReference.id || "",
          productFamilyId: selectedProductFamilyId,
          erpProductId: normalizeJoinCanonicalErpProductId(
            selectedProductReference.goodSeq || builderState.productId || selectedProductReference.id,
            selectedProductReference.eventSeq
          ),
          erpEventSeq: normalizeJoinCanonicalErpEventSeq(selectedProductReference.eventSeq),
          productName: tripProductName,
          packType: productPackType,
          packTypeName: productTypeName,
          productPrice: Number(selectedProduct?.price) || 0,
          startSummary: productStartSummary || document.getElementById("builderStartSummary")?.textContent.trim() || "",
          endSummary: productEndSummary || document.getElementById("builderEndSummary")?.textContent.trim() || "",
          tripSummary: productTripSummary || document.getElementById("builderTripSummary")?.textContent.trim() || "",
          departureDates: builderDepartureDates,
          returnDates: builderReturnDates,
          flexibleDays: {
            startBefore: useProductFixedDates ? 0 : builderState.startBefore,
            startAfter: useProductFixedDates ? 0 : builderState.startAfter,
            endBefore: useProductFixedDates ? 0 : builderState.endBefore,
            endAfter: useProductFixedDates ? 0 : builderState.endAfter
          }
        },
        agreements: {
          required: requiredAgreed,
          marketing: marketingAgreed
        }
      };
    }

    function validateBuilderApplyPayload(payload, options = {}) {
      clearBuilderApplyErrors();
      const requireCanonicalKeys = options.requireCanonicalKeys !== false;
      if (requireCanonicalKeys && !payload.memberKey && !getNestedValue(payload, "member.memberKey")) {
        openBuilderAlert("회원 정보를 정확히 확인하지 못했습니다. 다시 로그인 후 시도해 주세요.");
        return false;
      }
      if (requireCanonicalKeys && (!payload.applicationId || !payload.scheduleId)) {
        openBuilderAlert("새 모임 일정 정보를 정확히 생성하지 못했습니다. 다시 시도해 주세요.");
        return false;
      }
      if (!payload.applicant.name) {
        markBuilderApplyFieldError("name");
        alert("회원정보의 이름이 필요합니다. 회원가입 정보를 확인해 주세요.");
        return false;
      }
      if (!payload.applicant.gender) {
        markBuilderApplyFieldError("gender");
        openBuilderAlert("성별을 선택해 주세요.");
        return false;
      }
      if (!/^\d{4}$/.test(payload.applicant.birthYear || "")) {
        markBuilderApplyFieldError("birthYear");
        openBuilderAlert("생년월일을 입력해 주세요.");
        return false;
      }
      if (!/^010\d{8}$/.test(payload.applicant.phone)) {
        markBuilderApplyFieldError("phone");
        alert("회원정보의 휴대폰번호가 필요합니다. 회원가입 정보를 확인해 주세요.");
        return false;
      }
      if (!validateCompanionGenders("builder")) {
        return false;
      }
      if (!Array.isArray(payload.applicant.styles) || !payload.applicant.styles.length) {
        validateBuilderApplyStyleSelection();
        return false;
      }
      return true;
    }

    async function postGolfJoinSheetPayload(payload, label = "Golfjoin sheet payload") {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) {
        golfJoinSafeWarn("GOLFJOIN_SHEET_API_ENDPOINT is empty. Payload was not sent.", payload);
        return { skipped: true };
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let response;
      try {
        response = await fetch(GOLFJOIN_SHEET_API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (error) {
        golfJoinSafeError(`${label} request failed`, {
          name: error?.name || "",
          message: error?.message || "",
          endpoint: GOLFJOIN_SHEET_API_ENDPOINT
        });
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      const text = await response.text();
      if (!response.ok) {
        golfJoinSafeError(`${label} save failed`, {
          status: response.status,
          body: text.slice(0, 1000)
        });
        const error = new Error(`${label} save failed: ${response.status}`);
        error.status = response.status;
        error.responseBody = text;
        try {
          const parsed = JSON.parse(text || "{}");
          error.serverPayload = parsed;
          error.serverCode = parsed.code || parsed.errorCode || "";
          error.serverMessage = parsed.error || parsed.message || "";
        } catch (parseError) {
          error.serverMessage = text.slice(0, 200);
        }
        throw error;
      }
      try {
        return text ? JSON.parse(text) : { ok: true };
      } catch (error) {
        return { ok: true, raw: text };
      }
    }

    async function fetchGolfJoinSheetRows(params = {}, label = "Golfjoin sheet rows") {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return [];
      const url = new URL(GOLFJOIN_SHEET_API_ENDPOINT);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GOLFJOIN_SHEET_READ_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`${label} load failed: ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data : (data.items || data.rows || data.applications || data.reviews || []);
    }

    async function postGolfJoinSheetAction(action, payload = {}, label = "Golfjoin sheet action", options = {}) {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return [];
      const url = new URL(GOLFJOIN_SHEET_API_ENDPOINT);
      url.searchParams.set("action", action);
      const controller = new AbortController();
      const timeoutMs = Math.max(1000, Number(options.timeoutMs || GOLFJOIN_SHEET_READ_TIMEOUT_MS));
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`${label} failed: ${response.status}`);
      const data = await response.json();
      return data;
    }

    function getGolfJoinSheetActionRows(data = {}) {
      return Array.isArray(data) ? data : (data.items || data.rows || []);
    }

    async function saveBuilderApplyToGoogleSheet(payload) {
      return postGolfJoinSheetPayload(payload, "Builder apply");
    }

    async function saveJoinApplyToGoogleSheet(payload) {
      return postGolfJoinSheetPayload(payload, "Join apply");
    }

    async function confirmBuilderApplySavedToGoogleSheet(payload = {}) {
      const targetId = String(payload.applicationId || "").trim();
      const targetScheduleId = String(payload.scheduleId || "").trim();
      if ((!targetId && !targetScheduleId) || !GOLFJOIN_SHEET_API_ENDPOINT) return false;
      try {
        const rows = await fetchGolfJoinSheetRows({
          sheet: "new_schedule_applications",
          source: "new_schedule_builder",
          limit: "20"
        }, "Builder apply confirmation");
        return rows.some((row) => {
          const applicationId = String(row.applicationId || "").trim();
          const scheduleId = String(row.scheduleId || "").trim();
          return (targetId && applicationId === targetId) || (targetScheduleId && scheduleId === targetScheduleId);
        });
      } catch (error) {
        golfJoinSafeWarn("Failed to confirm builder apply save from Google Sheet.", error);
        return false;
      }
    }

    async function confirmJoinApplySavedToGoogleSheet(payload = {}) {
      const targetId = String(payload.joinApplyId || payload.applicationId || "").trim();
      if (!targetId || !GOLFJOIN_SHEET_API_ENDPOINT) return false;
      try {
        const rows = await fetchGolfJoinSheetRows({
          sheet: "join_applications",
          source: "join_apply",
          limit: "20"
        }, "Join apply confirmation");
        return rows.some((row) => String(row.applicationId || row.joinApplyId || "").trim() === targetId);
      } catch (error) {
        golfJoinSafeWarn("Failed to confirm join apply save from Google Sheet.", error);
        return false;
      }
    }

    async function saveJoinReviewToGoogleSheet(payload) {
      return postGolfJoinSheetPayload(payload, "Join review");
    }

    async function saveJoinMemberProfileToGoogleSheet(payload) {
      return postGolfJoinSheetPayload(payload, "Member profile");
    }

    function cachePendingJoinMemberProfileSave(payload, error = null) {
      try {
        const pending = JSON.parse(localStorage.getItem("joinMemberProfilePendingSaves") || "[]");
        const profileId = String(payload?.profileId || "").trim();
        const next = pending.filter((entry) => String(entry?.payload?.profileId || "").trim() !== profileId);
        next.unshift({
          payload,
          failedAt: nowKstISOString(),
          message: error?.message || ""
        });
        localStorage.setItem("joinMemberProfilePendingSaves", JSON.stringify(next.slice(0, 5)));
      } catch (storageError) {
        golfJoinSafeWarn("Failed to cache pending member profile save.", storageError);
      }
    }

    function clearPendingJoinMemberProfileSave(profileId = "") {
      const targetId = String(profileId || "").trim();
      if (!targetId) return;
      try {
        const pending = JSON.parse(localStorage.getItem("joinMemberProfilePendingSaves") || "[]");
        const next = pending.filter((entry) => String(entry?.payload?.profileId || "").trim() !== targetId);
        if (next.length) localStorage.setItem("joinMemberProfilePendingSaves", JSON.stringify(next));
        else localStorage.removeItem("joinMemberProfilePendingSaves");
      } catch (storageError) {
        golfJoinSafeWarn("Failed to clear pending member profile save.", storageError);
      }
    }

    function doesJoinMemberProfileMatchPayload(profile = {}, payload = {}) {
      const expectedProfile = payload.profile || {};
      const expectedStyles = splitJoinMemberProfileStyles(expectedProfile.travelStyles).sort().join("|");
      const savedStyles = splitJoinMemberProfileStyles(profile.travelStyles || profile.styles).sort().join("|");
      return Boolean(
        profile?.profileId
        && isJoinMemberProfileComplete(profile)
        && normalizeJoinMemberPhone(profile.memberMobile || profile.mobile || profile.phone || "")
          === normalizeJoinMemberPhone(payload?.member?.memberMobile || "")
        && String(profile.birthYear || "") === String(expectedProfile.birthYear || "")
        && normalizeJoinMemberGender(profile.gender || "") === normalizeJoinMemberGender(expectedProfile.gender || "")
        && String(profile.profession || "").trim() === String(expectedProfile.profession || "").trim()
        && String(profile.level || "").trim() === String(expectedProfile.level || "").trim()
        && savedStyles === expectedStyles
      );
    }

    async function saveJoinMemberProfileWithConfirmation(payload = {}, member = {}) {
      let saveError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await saveJoinMemberProfileToGoogleSheet(payload);
          clearPendingJoinMemberProfileSave(result?.profileId || payload.profileId);
          return result;
        } catch (error) {
          saveError = error;
          const savedProfile = await fetchJoinMemberProfileFromGoogleSheet(member, { refresh: true });
          if (doesJoinMemberProfileMatchPayload(savedProfile, payload)) {
            clearPendingJoinMemberProfileSave(savedProfile.profileId);
            return { ok: true, confirmedAfterError: true, profileId: savedProfile.profileId };
          }
          const status = Number(error?.status || 0);
          const retryable = !status || status >= 500 || error?.name === "AbortError";
          if (!retryable || attempt >= 1) break;
          await new Promise((resolve) => window.setTimeout(resolve, 450));
        }
      }
      cachePendingJoinMemberProfileSave(payload, saveError);
      throw saveError || new Error("Member profile save failed");
    }

    function saveJoinMemberProfileToGoogleSheetInBackground(payload) {
      const promise = saveJoinMemberProfileToGoogleSheet(payload);
      promise.catch((error) => {
        golfJoinSafeWarn("Member profile background save failed.", error);
        cachePendingJoinMemberProfileSave(payload, error);
      });
      return promise;
    }

    function getCurrentApplyTargetInfo(join = getCurrentApplyJoin()) {
      const sheetApplication = join?.sheetApplication || {};
      const productReference = getSecretTourProductReference(join || {});
      const scheduleId = join?.scheduleId || sheetApplication.scheduleId || (join?.isAdminRecommendedSchedule ? join.id : "") || "";
      const applicationId = join?.sourceApplicationId || sheetApplication.applicationId || join?.displayRule?.recommendedScheduleId || join?.displayRule?.displayRuleId || "";
      const erpEventSeq = normalizeJoinCanonicalErpEventSeq(join?.erpEventSeq || join?.eventSeq || productReference.eventSeq);
      const erpProductId = normalizeJoinCanonicalErpProductId(
        join?.displayRule?.erpProductId || join?.goodSeq || productReference.goodSeq || join?.erpProductId || productReference.id || "",
        erpEventSeq
      );
      const targetType = join?.isAdminRecommendedSchedule ? "recommended_schedule" : (scheduleId ? "new_schedule" : "erp_product");
      const targetJoinId = String(join?.id || scheduleId || applicationId || "").trim();
      const targetProductKey = erpProductId && erpEventSeq ? `erp:${erpProductId}:${erpEventSeq}` : "";
      return {
        targetType,
        targetJoinId,
        targetScheduleId: scheduleId,
        targetApplicationId: applicationId,
        targetProductKey,
        erpProductId,
        erpEventSeq
      };
    }

    function hasValidJoinApplyTargetInfo(target = {}) {
      if (target.targetType === "new_schedule") {
        return Boolean(target.targetJoinId && target.targetScheduleId);
      }
      if (target.targetType === "recommended_schedule") {
        return Boolean(target.targetJoinId && (target.targetScheduleId || target.targetApplicationId));
      }
      return Boolean(target.targetProductKey && target.erpProductId && target.erpEventSeq);
    }

    function validateJoinApplyCanonicalPayload(payload = {}) {
      const target = {
        targetType: payload.targetType,
        targetJoinId: payload.targetJoinId || getNestedValue(payload, "target.joinId"),
        targetScheduleId: payload.targetScheduleId || getNestedValue(payload, "target.scheduleId"),
        targetApplicationId: payload.targetApplicationId || getNestedValue(payload, "target.applicationId"),
        targetProductKey: payload.targetProductKey || getNestedValue(payload, "target.productKey"),
        erpProductId: payload.erpProductId || getNestedValue(payload, "product.erpProductId"),
        erpEventSeq: payload.erpEventSeq || getNestedValue(payload, "product.erpEventSeq")
      };
      if (!payload.memberKey && !getNestedValue(payload, "member.memberKey")) {
        const error = new Error("memberKey is required");
        error.userMessage = "회원 정보를 정확히 확인하지 못했습니다. 다시 로그인 후 시도해 주세요.";
        throw error;
      }
      if (!hasValidJoinApplyTargetInfo(target)) {
        const error = new Error("canonical target key is required");
        error.userMessage = "신청 대상 상품 정보를 정확히 확인하지 못했습니다. 상품상세를 다시 열어 신청해 주세요.";
        throw error;
      }
      return true;
    }

    function buildJoinApplyPayload(data) {
      const join = getCurrentApplyJoin() || {};
      const target = getCurrentApplyTargetInfo(join);
      const productReference = getSecretTourProductReference(join);
      const submittedAt = nowKstISOString();
      const phone = data.phone || "";
      const member = buildJoinSubmissionMemberPayload(
        data.member,
        getJoinCachedCurrentMember(),
        data,
        { memberName: data.name, memberMobile: phone }
      );
      const memberKey = member.memberKey;
      const joinMemberKey = memberKey || data.member?.memberSeq || data.member?.memberId || data.name || "member";
      const joinApplyId = buildGoogleSheetRecordId("ja", submittedAt, joinMemberKey, join.id || "");
      const country = getApplyJoinCountryName(join);
      const productTypeName = getDetailProductType(join);
      const productPackType = productTypeName === "항공팩" ? "air" : "golf";
      return {
        joinApplyId,
        applicationId: joinApplyId,
        source: "join_apply",
        submittedAt,
        pageUrl: location.href,
        memberKey,
        member,
        targetType: target.targetType,
        targetJoinId: target.targetJoinId,
        targetScheduleId: target.targetScheduleId,
        targetApplicationId: target.targetApplicationId,
        targetProductKey: target.targetProductKey,
        erpProductId: target.erpProductId,
        erpEventSeq: target.erpEventSeq,
        target: {
          type: target.targetType,
          joinId: target.targetJoinId,
          scheduleId: target.targetScheduleId,
          applicationId: target.targetApplicationId,
          productKey: target.targetProductKey
        },
        product: {
          erpProductId: target.erpProductId || productReference.goodSeq || normalizeJoinCanonicalErpProductId(join.erpProductId, target.erpEventSeq) || "",
          erpEventSeq: target.erpEventSeq || join.erpEventSeq || productReference.eventSeq || "",
          productName: join.title || "",
          departureDate: join.departureDate || "",
          returnDate: join.returnDate || "",
          country,
          countryRegion: join.countryRegion || join.location || "",
          region: join.region || "",
          packType: productPackType,
          packTypeName: productTypeName,
          airline: resolveSecretTourAirline(join, productTypeName),
          departureAirport: resolveSecretTourDepartureAirport(join, {
            title: join.title || ""
          }),
          arrivalAirport: join.arrivalAirport || ""
        },
        join: {
          id: join.id || "",
          title: join.title || "",
          country,
          countryRegion: join.countryRegion || join.location || "",
          region: join.region || "",
          departureDate: join.departureDate || "",
          returnDate: join.returnDate || ""
        },
        applicant: {
          name: data.name || "",
          gender: data.gender || "",
          birthYear: data.birthYear || "",
          ageDisplay: data.ageDisplay || data.age || "",
          phone,
          profession: data.profession || "",
          people: data.people || 1,
          companions: data.companions || [],
          level: data.level || "",
          styles: data.styles || [],
          memberPreferences: data.memberPreferences || data.preferredMemberComposition || [],
          preferredMemberComposition: data.preferredMemberComposition || data.memberPreferences || [],
          greeting: data.greeting || "",
          roomType: data.roomType || "2인1실",
          flightRequestType: data.flightRequestType || "",
          singleRoomSurcharge: Number(data.singleRoomSurcharge) || 0,
          singleRoomSurchargeText: data.singleRoomSurchargeText || "",
          singleRoomSurchargeStatus: data.singleRoomSurchargeStatus || ""
        },
        agreements: {
          required: Boolean(data.requiredAgreed),
          marketing: Boolean(data.marketingAgreed)
        }
      };
    }

    function findJoinForJoinApplicationRow(row = {}) {
      const targetJoinId = String(row.targetJoinId || row.joinId || "").trim();
      const targetScheduleId = String(row.targetScheduleId || row.scheduleId || "").trim();
      const targetApplicationId = String(row.targetApplicationId || row.sourceApplicationId || "").trim();
      const erpEventSeq = normalizeJoinCanonicalErpEventSeq(row.erpEventSeq || row.eventSeq);
      const targetIds = [targetJoinId, targetScheduleId, targetApplicationId].filter(Boolean);
      const exactMatch = joins.find((join) => {
        const joinKeys = [
          join.id,
          join.scheduleId,
          join.sourceApplicationId,
          join.applicationId,
          getNestedValue(join.sheetApplication || {}, "scheduleId"),
          getNestedValue(join.sheetApplication || {}, "applicationId"),
          getNestedValue(join.displayRule || {}, "recommendedScheduleId"),
          getNestedValue(join.displayRule || {}, "displayRuleId")
        ].map((value) => String(value || "").trim()).filter(Boolean);
        return targetIds.some((targetId) => joinKeys.includes(targetId));
      });
      if (exactMatch) return exactMatch;
      if (targetIds.length) return null;
      const targetProductKeyParts = String(row.targetProductKey || "").trim().split(":");
      const targetEventSeq = erpEventSeq || (targetProductKeyParts[0] === "erp" ? targetProductKeyParts[targetProductKeyParts.length - 1] : "");
      const targetProductIdFromKey = targetProductKeyParts[0] === "erp" && targetProductKeyParts.length >= 3
        ? targetProductKeyParts.slice(1, -1).join(":")
        : "";
      const erpProductId = normalizeJoinCanonicalErpProductId(row.erpProductId || row.goodSeq || row.productId || targetProductIdFromKey, targetEventSeq);
      if (!erpProductId || !targetEventSeq) return null;
      const matches = joins.filter((join) => {
        const reference = getSecretTourProductReference(join);
        const joinEventSeq = String(join.erpEventSeq || join.eventSeq || reference.eventSeq || "").trim();
        const joinProductId = normalizeJoinCanonicalErpProductId(join.erpProductId || join.goodSeq || reference.goodSeq || reference.id || "", joinEventSeq);
        return joinProductId === erpProductId && joinEventSeq === targetEventSeq;
      });
      return matches.length === 1 ? matches[0] : null;
    }

    function getAdminRecommendedJoinIdFromApplicationId(value = "") {
      const text = String(value || "").trim();
      return text ? `admin-recommended-${text.replace(/[^a-z0-9_-]+/gi, "-")}` : "";
    }

    function getJoinApplicationTargetRow(application = {}) {
      const applicationJoin = getNestedValue(application, "join") || {};
      const applicationProduct = getNestedValue(application, "product") || {};
      const productReference = getSecretTourProductReference(applicationProduct || application);
      const targetJoinId = String(
        application.targetJoinId
        || application.joinId
        || getNestedValue(application, "target.joinId")
        || getNestedValue(application, "join.id")
        || ""
      ).trim();
      const targetScheduleId = String(
        application.targetScheduleId
        || application.scheduleId
        || getNestedValue(application, "join.scheduleId")
        || getNestedValue(application, "join.id")
        || ""
      ).trim();
      const targetApplicationId = String(
        application.targetApplicationId
        || application.sourceApplicationId
        || getNestedValue(application, "join.sourceApplicationId")
        || getNestedValue(application, "product.applicationId")
        || ""
      ).trim();
      const rawErpProductId = String(
        application.erpProductId
        || application.goodSeq
        || application.productId
        || getNestedValue(application, "product.erpProductId")
        || getNestedValue(application, "product.goodSeq")
        || productReference.id
        || productReference.goodSeq
        || ""
      ).trim();
      const rawErpEventSeq = String(
        application.erpEventSeq
        || application.eventSeq
        || getNestedValue(application, "product.erpEventSeq")
        || getNestedValue(application, "product.eventSeq")
        || productReference.eventSeq
        || ""
      ).trim();
      const erpEventSeq = normalizeJoinCanonicalErpEventSeq(rawErpEventSeq);
      const erpProductId = normalizeJoinCanonicalErpProductId(rawErpProductId, erpEventSeq);
      const targetProductKey = erpProductId && erpEventSeq
        ? `erp:${erpProductId}:${erpEventSeq}`
        : String(application.targetProductKey || getNestedValue(application, "target.productKey") || "").trim();
      return {
        targetJoinId,
        targetScheduleId,
        targetApplicationId,
        targetProductKey,
        erpProductId,
        erpEventSeq,
        title: String(applicationJoin.title || applicationProduct.productName || application.productName || application.title || "").trim(),
        departureDate: String(applicationJoin.departureDate || applicationProduct.departureDate || application.departureDate || "").slice(0, 10),
        returnDate: String(applicationJoin.returnDate || applicationProduct.returnDate || application.returnDate || "").slice(0, 10)
      };
    }

    function findJoinForJoinApplicationPayload(application = {}) {
      const target = getJoinApplicationTargetRow(application);
      const scheduleCandidates = [
        target.targetJoinId,
        target.targetScheduleId,
        getAdminRecommendedJoinIdFromApplicationId(target.targetApplicationId)
      ].filter(Boolean);
      const applicationCandidates = [target.targetApplicationId].filter(Boolean);
      const directMatch = joins.find((join) => {
        const joinIds = [
          join.id,
          join.scheduleId,
          getNestedValue(join.sheetApplication || {}, "scheduleId")
        ].map((value) => String(value || "").trim()).filter(Boolean);
        return scheduleCandidates.some((candidate) => joinIds.includes(candidate));
      });
      if (directMatch) return directMatch;
      const applicationMatch = joins.find((join) => {
        const joinIds = [
          join.sourceApplicationId,
          join.applicationId,
          getNestedValue(join.displayRule || {}, "recommendedScheduleId"),
          getNestedValue(join.displayRule || {}, "displayRuleId"),
          getNestedValue(join.sheetApplication || {}, "applicationId")
        ].map((value) => String(value || "").trim()).filter(Boolean);
        return applicationCandidates.some((candidate) => joinIds.includes(candidate));
      });
      if (applicationMatch) return applicationMatch;
      const rowMatch = findJoinForJoinApplicationRow(target);
      if (rowMatch) return rowMatch;
      return null;
    }

    function normalizeJoinApplyPayload(item = {}) {
      if (item.applicant || item.join || item.agreements) {
        return {
          ...item,
          memberKey: item.memberKey || getNestedValue(item, "member.memberKey") || "",
          targetJoinId: item.targetJoinId || getNestedValue(item, "target.joinId") || "",
          targetProductKey: item.targetProductKey || getNestedValue(item, "target.productKey") || "",
          member: {
            ...(item.member || {}),
            memberKey: getNestedValue(item, "member.memberKey") || item.memberKey || "",
            memberSeq: getNestedValue(item, "member.memberSeq") || item.memberSeq || "",
            memberId: getNestedValue(item, "member.memberId") || item.memberId || "",
            memberName: getNestedValue(item, "member.memberName") || item.memberName || item.name || "",
            memberChannel: getNestedValue(item, "member.memberChannel") || item.memberChannel || "",
            memberMobile: normalizeJoinMemberPhone(
              getNestedValue(item, "member.memberMobile")
              || item.memberMobile
              || item.memberPhone
              || getNestedValue(item, "applicant.phone")
              || item.phone
              || ""
            ),
            memberEmail: getNestedValue(item, "member.memberEmail") || item.memberEmail || item.email || "",
            kakaoId: getNestedValue(item, "member.kakaoId") || item.kakaoId || getNestedValue(item, "kakao.kakaoId") || ""
          }
        };
      }
      const productReference = getSecretTourProductReference({
        id: item.productId || item.erpProductId,
        erpProductId: item.erpProductId || item.productId,
        erpEventSeq: item.erpEventSeq || item.eventSeq
      });
      const targetScheduleId = String(item.targetScheduleId || item.scheduleId || "").trim();
      const targetApplicationId = String(item.targetApplicationId || item.sourceApplicationId || "").trim();
      const targetJoin = findJoinForJoinApplicationRow({
        targetJoinId: item.targetJoinId || item.joinId || "",
        targetScheduleId,
        targetApplicationId,
        erpProductId: productReference.goodSeq || normalizeJoinCanonicalErpProductId(item.erpProductId || item.productId, item.erpEventSeq || item.eventSeq || productReference.eventSeq) || "",
        erpEventSeq: item.erpEventSeq || item.eventSeq || productReference.eventSeq || "",
        targetProductKey: item.targetProductKey || ""
      });
      const targetJoinReference = targetJoin ? getSecretTourProductReference(targetJoin) : {};
      const targetEventSeq = normalizeJoinCanonicalErpEventSeq(
        targetJoin?.erpEventSeq
        || targetJoin?.eventSeq
        || targetJoinReference.eventSeq
        || item.erpEventSeq
        || productReference.eventSeq
      );
      const targetProductId = normalizeJoinCanonicalErpProductId(
        targetJoin?.erpProductId
        || targetJoin?.goodSeq
        || targetJoinReference.goodSeq
        || productReference.goodSeq
        || item.erpProductId,
        targetEventSeq
      ) || "";
      const targetProductKey = targetProductId && targetEventSeq
        ? `erp:${targetProductId}:${targetEventSeq}`
        : (item.targetProductKey || "");
      const memberKey = getJoinMemberCanonicalKey({
        memberKey: item.memberKey || "",
        memberSeq: item.memberSeq || "",
        memberId: item.memberId || "",
        memberMobile: item.memberMobile || item.memberPhone || item.applicantMobile || item.phone || "",
        memberEmail: item.memberEmail || item.email || "",
        kakaoId: item.kakaoId || getNestedValue(item, "kakao.kakaoId") || ""
      });
      const recommendedJoinId = targetScheduleId.startsWith("admin-recommended-")
        ? targetScheduleId
        : targetApplicationId
          ? `admin-recommended-${String(targetApplicationId).replace(/[^a-z0-9_-]+/gi, "-")}`
          : "";
      const targetJoinId = targetJoin?.id
        || recommendedJoinId
        || (item.targetType === "new_schedule" && targetScheduleId ? `${BUILDER_APPLICATION_JOIN_PREFIX}${targetScheduleId}` : "")
        || item.joinId
        || "";
      return {
        joinApplyId: item.joinApplyId || item.applicationId || "",
        memberLookupMatched: item.memberLookupMatched === true,
        memberLookupKey: item.memberLookupKey || "",
        participantPreviewSeed: item.participantPreviewSeed || "",
        participantCompanionGroup: item.participantCompanionGroup || "",
        source: item.source || "join_apply",
        submittedAt: item.submittedAt || item.createdAt || "",
        quoteId: item.quoteId || "",
        quoteNo: item.quoteNo || "",
        quoteStatus: item.quoteStatus || "",
        quoteUrl: item.quoteUrl || "",
        quotePageUrl: item.quotePageUrl || item.quoteUrl || "",
        quotePdfUrl: item.quotePdfUrl || "",
        quoteGeneratedAt: item.quoteGeneratedAt || "",
        applicationStatus: item.applicationStatus || item.status || "",
        participantStatus: item.participantStatus || "",
        pageUrl: item.pageUrl || "",
        targetType: item.targetType || "",
        targetJoinId: item.targetJoinId || targetJoinId,
        targetScheduleId,
        targetApplicationId,
        targetProductKey,
        memberKey,
        member: {
            memberKey,
            memberSeq: item.memberSeq || "",
            memberId: item.memberId || "",
            memberName: item.memberName || item.applicantName || item.name || "",
          memberChannel: item.memberChannel || "",
          memberMobile: normalizeJoinMemberPhone(item.memberMobile || item.memberPhone || item.applicantMobile || item.phone || ""),
          memberEmail: item.memberEmail || item.email || "",
          kakaoId: item.kakaoId || getNestedValue(item, "kakao.kakaoId") || ""
        },
        product: {
          erpProductId: targetProductId,
          erpEventSeq: targetEventSeq
        },
        join: {
          id: item.targetJoinId || targetJoinId,
          title: item.joinTitle || item.productName || "",
          region: item.joinRegion || item.region || "",
          departureDate: item.departureDate || "",
          returnDate: item.returnDate || ""
        },
        applicant: {
          name: item.applicantName || item.name || "",
          gender: item.applicantGender || item.gender || "",
          birthYear: item.applicantBirthYear || item.birthYear || "",
          ageDisplay: item.applicantAgeBand || item.ageDisplay || item.age || "",
          phone: item.applicantMobile || item.phone || "",
          profession: item.applicantProfession || item.profession || "",
          people: item.applicantPeople || item.people || 1,
          companions: parseCompanionList(item.applicantCompanions || item.companions),
          level: item.applicantLevel || item.level || "",
          styles: toBuilderApplicationArray(item.applicantStyles || item.styles),
          memberPreferences: toBuilderApplicationArray(item.applicantPreferredMembers || item.memberPreferences),
          preferredMemberComposition: toBuilderApplicationArray(item.applicantPreferredMembers || item.preferredMemberComposition || item.memberPreferences),
          greeting: item.applicantGreeting || item.greeting || "",
          roomType: item.applicantRoomType || item.roomType || "2인1실",
          flightRequestType: item.flightRequestType || "",
          singleRoomSurcharge: Number(item.singleRoomSurcharge) || 0,
          singleRoomSurchargeText: item.singleRoomSurchargeText || "",
          singleRoomSurchargeStatus: item.singleRoomSurchargeStatus || ""
        },
        agreements: {
          required: item.requiredAgreed || "",
          marketing: item.marketingAgreed || ""
        }
      };
    }

    function isCancelledJoinApplyPayload(payload = {}) {
      const status = String(payload.applicationStatus || payload.status || getNestedValue(payload, "application.status") || "").trim().toLowerCase();
      const participantStatus = String(payload.participantStatus || getNestedValue(payload, "participant.status") || "").trim().toLowerCase();
      const cancelledValues = new Set(["cancelled", "canceled", "cancel", "취소", "참여취소", "환불완료"]);
      return [status, participantStatus].some((value) => (
        cancelledValues.has(value) || /cancel|취소|환불/.test(value)
      ));
    }

    function saveJoinApplicationPayloadLocally(payload) {
      const existing = readJoinMemberScopedItems(JOIN_APPLICATIONS_STORAGE_KEY);
      writeJoinMemberScopedItems(JOIN_APPLICATIONS_STORAGE_KEY, [payload, ...existing].slice(0, 30));
    }

    function rememberJoinApplicationPayload(payload) {
      const normalized = normalizeJoinApplyPayload(payload);
      const key = normalized.joinApplyId || buildGoogleSheetRecordId("ja", normalized.submittedAt, getNestedValue(normalized, "member.memberSeq") || getNestedValue(normalized, "member.memberId") || getNestedValue(normalized, "applicant.name") || "member", getNestedValue(normalized, "join.id"));
      if (key) joinApplicationPayloadMemory.set(key, normalized);
      return normalized;
    }

    function reapplyRememberedJoinApplications(options = {}) {
      joinApplicationPayloadMemory.forEach((payload) => {
        applyJoinApplicationPayload(payload, { render: false, remember: false });
      });
      if (options.render !== false) renderJoins();
    }

    function readGoogleSheetRowsCache(key, options = {}) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || "null");
        const rows = Array.isArray(cached?.rows) ? cached.rows : [];
        const fetchedAt = Number(cached?.fetchedAt || 0);
        if (!rows.length || !Number.isFinite(fetchedAt)) return [];
        if (Date.now() - fetchedAt > GOOGLE_SHEET_READ_CACHE_TTL_MS) return [];
        if (options.memberKey !== undefined && String(cached?.memberKey || "") !== String(options.memberKey || "")) return [];
        return rows;
      } catch (error) {
        golfJoinSafeWarn("Failed to read Google Sheet rows cache.", error);
        return [];
      }
    }

    function hasFreshGoogleSheetRowsCache(key, options = {}) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || "null");
        const fetchedAt = Number(cached?.fetchedAt || 0);
        if (options.memberKey !== undefined && String(cached?.memberKey || "") !== String(options.memberKey || "")) return false;
        return Number.isFinite(fetchedAt) && fetchedAt > 0 && Date.now() - fetchedAt <= GOOGLE_SHEET_READ_CACHE_TTL_MS;
      } catch (error) {
        golfJoinSafeWarn("Failed to inspect Google Sheet rows cache.", error);
        return false;
      }
    }

    function writeGoogleSheetRowsCache(key, rows = [], meta = {}) {
      try {
        localStorage.setItem(key, JSON.stringify({
          fetchedAt: Date.now(),
          ...meta,
          rows: Array.isArray(rows) ? rows : []
        }));
      } catch (error) {
        golfJoinSafeWarn("Failed to write Google Sheet rows cache.", error);
      }
    }

    function readJoinJsonCache(key, ttlMs = GOOGLE_SHEET_READ_CACHE_TTL_MS, options = {}) {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || "null");
        const fetchedAt = Number(cached?.fetchedAt || 0);
        if (!cached || !Number.isFinite(fetchedAt) || fetchedAt <= 0) return null;
        if (ttlMs >= 0 && Date.now() - fetchedAt > ttlMs) return null;
        if (options.memberKey !== undefined && String(cached.memberKey || "") !== String(options.memberKey || "")) return null;
        return cached;
      } catch (error) {
        return null;
      }
    }

    function writeJoinJsonCache(key, payload = {}, meta = {}) {
      try {
        localStorage.setItem(key, JSON.stringify({
          fetchedAt: Date.now(),
          ...meta,
          payload
        }));
      } catch (error) {
        golfJoinSafeWarn("Failed to write join json cache.", error);
      }
    }

    function removeJoinJsonCache(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        // Ignore cache cleanup failures.
      }
    }

    function invalidateHomeBootstrapLightCache() {
      removeJoinJsonCache(HOME_BOOTSTRAP_LIGHT_CACHE_KEY);
      pendingHomeBootstrapLightData = null;
      homeBootstrapLightApplySignature = "";
    }

    function getJoinApplicationPreviewReplacementIndexes(existingParticipants = [], application = {}, recordId = "") {
      const directIndexes = new Set();
      const applicationMarkers = [
        recordId,
        application.participantPreviewSeed,
        application.participantCompanionGroup
      ].map(normalizeJoinParticipantApplicationMarker).filter(isUsableJoinParticipantApplicationMarker);
      existingParticipants.forEach((participant, index) => {
        if (
          isJoinParticipantPreviewSource(participant)
          && hasJoinParticipantApplicationMarkerOverlap(participant, applicationMarkers)
        ) directIndexes.add(index);
      });
      return directIndexes;
    }

    function applyJoinApplicationPayload(payload, options = {}) {
      const normalized = options.remember === false ? normalizeJoinApplyPayload(payload) : rememberJoinApplicationPayload(payload);
      if (isCancelledJoinApplyPayload(payload) || isCancelledJoinApplyPayload(normalized)) return null;
      const normalizedJoinId = getNestedValue(normalized, "join.id");
      const join = findJoinForJoinApplicationPayload(normalized)
        || joins.find((item) => item.id === normalizedJoinId);
      if (!join) return null;
      const joinId = join.id || normalizedJoinId;
      const recordId = normalized.joinApplyId || buildGoogleSheetRecordId("ja", normalized.submittedAt, getNestedValue(normalized, "member.memberSeq") || getNestedValue(normalized, "member.memberId") || getNestedValue(normalized, "applicant.name") || "member", joinId);
      const capacity = getJoinRecruitmentCapacity(join, BUILDER_APPLICATION_MAX_CAPACITY);
      const existingParticipants = Array.isArray(join.participants) ? join.participants : [];
      let matchingPreviewIndexes = getJoinApplicationPreviewReplacementIndexes(existingParticipants, normalized, recordId);
      const applicant = normalized.applicant || {};
      const requestedCount = parseApplyPeopleValue(applicant.people || 1);
      const currentMember = typeof getJoinCachedCurrentMember === "function" ? getJoinCachedCurrentMember() : null;
      const currentMemberKey = getJoinMyMemberIdentity(currentMember || {}).memberKey;
      const memberLookupMatched = isJoinMemberLookupMatchedForMember(normalized, currentMember || {});
      let currentMemberMarked = false;
      const currentMemberOwnsJoin = Boolean(currentMember && isJoinMyCreatedScheduleForMember(join, currentMember));
      const baseParticipants = existingParticipants
        .filter((participant, index) => !matchingPreviewIndexes.has(index))
        .map((participant) => {
          let nextParticipant = participant;
          if (
            currentMember
            && !currentMemberOwnsJoin
            && (participant?.isHost || participant?.isCreator)
            && participant?.isCurrentMember === true
          ) {
            nextParticipant = { ...participant };
            delete nextParticipant.isCurrentMember;
            delete nextParticipant.currentMemberKey;
          }
          const isApplicationParticipant = isJoinApplicationMaterializedParticipant(nextParticipant, recordId);
          if (
            isApplicationParticipant
            && !currentMemberMarked
            && (memberLookupMatched || isJoinParticipantForCurrentMember(nextParticipant))
          ) {
            currentMemberMarked = true;
            return { ...nextParticipant, isCurrentMember: true, currentMemberKey };
          }
          return nextParticipant;
        });
      const materializedParticipants = baseParticipants.filter((participant) => {
        return isJoinApplicationMaterializedParticipant(participant, recordId);
      });
      const occupiedApplicationIndexes = new Set();
      materializedParticipants.forEach((participant) => {
        const participantId = String(participant.id || "");
        if (!participantId.startsWith(`${recordId}-p`)) return;
        const participantIndex = Number(participantId.slice(`${recordId}-p`.length)) - 1;
        if (Number.isInteger(participantIndex) && participantIndex >= 0 && participantIndex < requestedCount) {
          occupiedApplicationIndexes.add(participantIndex);
        }
      });
      for (let index = 0; occupiedApplicationIndexes.size < Math.min(requestedCount, materializedParticipants.length) && index < requestedCount; index += 1) {
        if (!occupiedApplicationIndexes.has(index)) occupiedApplicationIndexes.add(index);
      }
      const prioritizeCurrentMemberApplication = Boolean(memberLookupMatched && !currentMemberOwnsJoin);
      const remainingSlots = Math.max(0, capacity - getConfirmedParticipants({ participants: baseParticipants }).length);
      const participantIndexes = Array.from({ length: requestedCount }, (_, index) => index)
        .filter((index) => !occupiedApplicationIndexes.has(index))
        .slice(0, prioritizeCurrentMemberApplication ? requestedCount : remainingSlots);
      const companionGenders = parseCompanionList(applicant.companions).map((item) => item?.gender || "");
      const participants = participantIndexes.map((index) => {
        const participantId = `${recordId}-p${index + 1}`;
        const gender = index === 0 ? applicant.gender : (companionGenders[index - 1] || applicant.gender);
        const memberIdentity = index === 0 ? {
          memberSeq: getNestedValue(normalized, "member.memberSeq") || "",
          memberId: getNestedValue(normalized, "member.memberId") || "",
          memberMobile: normalizeJoinMemberPhone(getNestedValue(normalized, "member.memberMobile") || applicant.phone || ""),
          memberEmail: getNestedValue(normalized, "member.memberEmail") || "",
          kakaoId: getNestedValue(normalized, "member.kakaoId") || ""
        } : {};
        const isCurrentMember = index === 0 && (
          memberLookupMatched
          || isJoinParticipantForCurrentMember(memberIdentity)
        );
        return {
          id: participantId,
          source: "join_apply",
          sourceRecordId: recordId,
          joinApplyId: recordId,
          applicationId: recordId,
          previewSeed: normalized.participantPreviewSeed || "",
          name: index === 0 ? maskApplyName(applicant.name) : `일행${index}`,
          gender,
          ...memberIdentity,
          ...(isCurrentMember ? { isCurrentMember: true, currentMemberKey } : {}),
          companionGroup: requestedCount > 1
            ? (normalized.participantCompanionGroup || `${recordId}-companions`)
            : "",
          age: applicant.ageDisplay || applicant.age || "",
          handicap: applicant.level || "",
          profession: applicant.profession || "",
          preferences: toBuilderApplicationArray(applicant.styles),
          message: index === 0 ? (applicant.greeting || "잘 부탁드립니다.") : "동반 참여 인원입니다.",
          status: "confirmed",
          gif: getBuilderApplicationGenderIcon(gender, null, `${join.id}-${participantId}-${applicant.name || index}`)
        };
      });
      const mergedParticipants = mergeJoinParticipantsByIdentity(
        baseParticipants,
        participants,
        Math.max(capacity, baseParticipants.length + participants.length)
      );
      if (prioritizeCurrentMemberApplication) {
        const hostCompanionGroup = String(
          mergedParticipants.find((participant) => participant?.isHost || participant?.isCreator)?.companionGroup || ""
        ).trim();
        const rankedParticipants = mergedParticipants
          .map((participant, index) => {
            const isCurrentApplicationParticipant = isJoinApplicationMaterializedParticipant(participant, recordId)
              || hasJoinParticipantApplicationMarkerOverlap(participant, [normalized.participantPreviewSeed]);
            let priority = 3;
            if (
              participant?.isHost
              || participant?.isCreator
              || (hostCompanionGroup && String(participant?.companionGroup || "").trim() === hostCompanionGroup)
            ) priority = 0;
            else if (isCurrentApplicationParticipant && !isJoinParticipantPreviewSource(participant)) priority = 1;
            else if (!isJoinParticipantPreviewSource(participant)) priority = 2;
            else if (participant?.summaryCountPlaceholder) priority = 4;
            return { participant, index, priority };
          })
          .sort((left, right) => left.priority - right.priority || left.index - right.index)
          .map(({ participant }) => participant);
        const summaryConfirmedCount = Number(join.participantSummary?.confirmedCount);
        const displayCount = Number.isFinite(summaryConfirmedCount) && summaryConfirmedCount > 0
          ? Math.min(capacity, summaryConfirmedCount)
          : Math.min(capacity, Math.max(baseParticipants.length, baseParticipants.length + participants.length));
        join.participants = rankedParticipants.slice(0, displayCount);
      } else {
        join.participants = mergedParticipants.slice(0, capacity);
      }
      const summaryRemainingSlots = Number(join.participantSummary?.remainingSlots);
      join.emptySlots = Number.isFinite(summaryRemainingSlots)
        ? Math.max(0, summaryRemainingSlots)
        : Math.max(0, capacity - getConfirmedParticipants(join).length);
      join.maxCapacity = capacity;
      clearActiveJoinMySchedulesCache();
      if (options.persist) saveJoinApplicationPayloadLocally(normalized);
      if (options.render !== false) renderJoins();
      return join;
    }

    function getJoinApplicationRecordKey(payload = {}) {
      const normalized = normalizeJoinApplyPayload(payload);
      return normalized.joinApplyId || buildGoogleSheetRecordId(
        "ja",
        normalized.submittedAt,
        getNestedValue(normalized, "member.memberSeq") || getNestedValue(normalized, "member.memberId") || getNestedValue(normalized, "applicant.name") || "member",
        getNestedValue(normalized, "join.id")
      );
    }

    function isRecentJoinApplyPayload(payload = {}, now = Date.now()) {
      if (String(payload.source || "") !== "join_apply") return false;
      const submittedTime = Date.parse(payload.submittedAt || payload.createdAt || "");
      return Number.isFinite(submittedTime)
        && submittedTime <= now + 60 * 1000
        && now - submittedTime <= JOIN_APPLICATION_AUTHORITATIVE_REFRESH_GRACE_MS;
    }

    function removeJoinApplicationParticipants(payloads = []) {
      const recordKeys = new Set((payloads || []).map(getJoinApplicationRecordKey).filter(Boolean));
      if (!recordKeys.size) return;
      joins.forEach((join) => {
        if (!Array.isArray(join.participants) || !join.participants.length) return;
        join.participants = join.participants.filter((participant) => {
          const participantId = String(participant.id || "");
          return !Array.from(recordKeys).some((key) => participantId.startsWith(`${key}-p`));
        });
        const capacity = getJoinRecruitmentCapacity(join, BUILDER_APPLICATION_MAX_CAPACITY);
        join.emptySlots = Math.max(0, capacity - getConfirmedParticipants(join).length);
        join.maxCapacity = capacity;
      });
    }

    function clearJoinApplicationRuntimeState() {
      removeJoinApplicationParticipants(Array.from(joinApplicationPayloadMemory.values()));
      joinApplicationPayloadMemory.clear();
      clearActiveJoinMySchedulesCache();
    }

    function clearJoinApplicationLocalCache() {
      try {
        localStorage.removeItem(JOIN_APPLICATIONS_STORAGE_KEY);
      } catch (error) {
        golfJoinSafeWarn("Failed to clear join application cache.", error);
      }
    }

    function clearJoinApplicationSheetReadCache() {
      try {
        localStorage.removeItem(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY);
      } catch (error) {
        golfJoinSafeWarn("Failed to clear join application sheet cache.", error);
      }
    }

    function refreshOpenDetailAfterJoinParticipantsChange() {
      const detailModal = document.getElementById("detailModal");
      if (!detailModal?.classList.contains("open") || !currentDetailJoinId) return;
      const freshJoin = joins.find((item) => item.id === currentDetailJoinId) || currentDetailJoinData;
      if (!freshJoin) return;
      currentDetailJoinData = freshJoin;
      renderDetailContent(freshJoin);
    }

    function resetJoinApplicationsFromAuthoritativeRows(rows = []) {
      const authoritativePayloads = rows.map(normalizeJoinApplyPayload);
      const authoritativeKeys = new Set(authoritativePayloads.map(getJoinApplicationRecordKey).filter(Boolean));
      const rememberedApplications = Array.from(joinApplicationPayloadMemory.values())
        .map(normalizeJoinApplyPayload)
        .filter((payload) => {
          const source = String(payload.source || "");
          if (source !== "join_apply") return true;
          const key = getJoinApplicationRecordKey(payload);
          return Boolean(key && !authoritativeKeys.has(key) && isRecentJoinApplyPayload(payload));
        });
      clearJoinApplicationLocalCache();
      clearJoinApplicationRuntimeState();
      authoritativePayloads.forEach((payload) => applyJoinApplicationPayload(payload, { render: false }));
      rememberedApplications.forEach((payload) => {
        applyJoinApplicationPayload(payload, { render: false, persist: String(payload.source || "") === "join_apply" });
      });
      clearActiveJoinMySchedulesCache();
      refreshOpenDetailAfterJoinParticipantsChange();
    }

    function hydrateJoinApplicationsFromLocalCache() {
      try {
        const memberKey = getJoinWishMemberKey();
        if (!memberKey) return;
        const cached = readJoinMemberScopedItems(JOIN_APPLICATIONS_STORAGE_KEY);
        cached.map(normalizeJoinApplyPayload).forEach((payload) => applyJoinApplicationPayload(payload, { render: false }));
        readGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY, { memberKey })
          .map(normalizeJoinApplyPayload)
          .forEach((payload) => applyJoinApplicationPayload(payload, { render: false }));
      } catch (error) {
        golfJoinSafeWarn("Failed to load cached join applications.", error);
      }
    }

    function hydrateJoinReviewsFromLocalCache() {
      try {
        Object.values(readJoinMyReviewStore()).forEach((payload) => rememberJoinReviewPayload(payload));
        readGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_REVIEWS_READ_CACHE_KEY)
          .map(normalizeJoinReviewPayload)
          .forEach((payload) => rememberJoinReviewPayload(payload));
      } catch (error) {
        golfJoinSafeWarn("Failed to load cached join reviews.", error);
      }
    }

    async function hydrateJoinApplicationsFromGoogleSheet(options = {}) {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return [];
      const requestGeneration = ++googleSheetJoinApplicationsRequestGeneration;
      const member = getJoinCachedCurrentMember();
      const memberKey = getJoinWishMemberKey(member);
      const memberLookupParams = getJoinSheetMemberLookupParams(member);
      const hasMemberLookup = Object.values(memberLookupParams).some((value) => String(value || "").trim());
      if (!hasMemberLookup) return [];
      const isRequestCurrent = () => (
        requestGeneration === googleSheetJoinApplicationsRequestGeneration
        && memberKey === getJoinWishMemberKey(getJoinCachedCurrentMember())
      );
      googleSheetJoinApplicationsLoading = true;
      googleSheetJoinApplicationsReadFailed = false;
      if (options.renderStart !== false) renderJoins();
      try {
        const rows = (await fetchGolfJoinSheetRows({
          sheet: "join_applications",
          ...memberLookupParams,
          limit: "50"
        }, "Join applications")).map((row) => ({
          ...row,
          memberLookupMatched: true,
          memberLookupKey: memberKey
        }));
        if (!isRequestCurrent()) return [];
        writeGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY, rows, { memberKey });
        resetJoinApplicationsFromAuthoritativeRows(rows);
        googleSheetJoinApplicationsReadCompleted = true;
        googleSheetJoinApplicationsReadFailed = false;
        if (options.renderHome !== false) renderJoins();
        refreshOpenBuilderCalendarAfterJoinDataChange();
        return rows;
      } catch (error) {
        if (!isRequestCurrent()) return [];
        googleSheetJoinApplicationsReadCompleted = true;
        googleSheetJoinApplicationsReadFailed = true;
        golfJoinSafeWarn("Failed to load join applications from Google Sheet. Add matching join_applications reads to the Apps Script doGet endpoint.", error);
        return [];
      } finally {
        if (requestGeneration === googleSheetJoinApplicationsRequestGeneration) {
          googleSheetJoinApplicationsLoading = false;
          if (options.renderHome !== false) renderJoins();
        }
      }
    }

    function applyJoinApplicationsFromGoogleSheetRows(rows = []) {
      writeGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_APPLICATIONS_READ_CACHE_KEY, rows, { memberKey: getJoinWishMemberKey() });
      resetJoinApplicationsFromAuthoritativeRows(rows);
      googleSheetJoinApplicationsReadCompleted = true;
      googleSheetJoinApplicationsReadFailed = false;
      return rows;
    }

    async function hydrateJoinReviewsFromGoogleSheet() {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return [];
      try {
        const rows = await fetchGolfJoinSheetRows({
          sheet: "join_reviews",
          source: "join_review",
          status: "visible",
          limit: "200"
        }, "Join reviews");
        writeGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_REVIEWS_READ_CACHE_KEY, rows);
        const normalizedRows = rows.map(normalizeJoinReviewPayload);
        pruneJoinMyReviewStoreByServerReviews(normalizedRows);
        joinReviewPayloadMemory.clear();
        normalizedRows.forEach((payload) => rememberJoinReviewPayload(payload));
        renderJoins();
        if (document.getElementById("detailModal")?.classList.contains("open") && currentDetailJoinData) {
          renderDetailContent(currentDetailJoinData);
        }
        return rows;
      } catch (error) {
        golfJoinSafeWarn("Failed to load join reviews from Google Sheet. Add matching join_reviews reads to the Apps Script doGet endpoint.", error);
        return [];
      }
    }

    function applyJoinReviewsFromGoogleSheetRows(rows = []) {
      writeGoogleSheetRowsCache(GOOGLE_SHEET_JOIN_REVIEWS_READ_CACHE_KEY, rows);
      const normalizedRows = rows.map(normalizeJoinReviewPayload);
      pruneJoinMyReviewStoreByServerReviews(normalizedRows);
      joinReviewPayloadMemory.clear();
      normalizedRows.forEach((payload) => rememberJoinReviewPayload(payload));
      if (document.getElementById("detailModal")?.classList.contains("open") && currentDetailJoinData) {
        renderDetailContent(currentDetailJoinData);
      }
      return rows;
    }

    function buildGoogleSheetRecordId(prefix, ...parts) {
      const scrubbedParts = parts.map((part) => {
        const text = String(part || "");
        const digits = text.replace(/\D/g, "");
        if (/^010\d{8}$/.test(digits)) return "private";
        return text
          .replace(/010[-\s]?\d{4}[-\s]?\d{4}/g, "private")
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "private");
      });
      const safe = String(scrubbedParts.join("-") || nowKstISOString())
        .replace(/[^a-z0-9가-힣_-]+/gi, "-")
        .replace(/^-+|-+$/g, "");
      return `${prefix}_${safe}`;
    }

    function ensureBuilderApplicationIdentifiers(payload = {}) {
      const submittedAt = payload.submittedAt || nowKstISOString();
      const phone = getNestedValue(payload, "applicant.phone") || payload.creatorPhone || payload.phone || "";
      const applicationId = payload.applicationId || buildGoogleSheetRecordId("nsa", submittedAt, payload.member?.memberSeq || payload.member?.memberId || "member");
      const scheduleId = payload.scheduleId || buildGoogleSheetRecordId("sch", applicationId);
      return {
        ...payload,
        applicationId,
        scheduleId,
        submittedAt
      };
    }

    function getNestedValue(object, path) {
      return String(path || "").split(".").reduce((current, key) => {
        return current && current[key] !== undefined && current[key] !== null ? current[key] : "";
      }, object);
    }

    function toBuilderApplicationArray(value) {
      if (Array.isArray(value)) return value.filter(Boolean);
      return String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function parseCompanionList(value) {
      if (Array.isArray(value)) {
        return value
          .filter((item) => item && (item.gender || typeof item === "string"))
          .map((item) => (typeof item === "string" ? { gender: item } : item));
      }
      const text = String(value || "").trim();
      if (!text) return [];
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parseCompanionList(parsed);
      } catch (error) {
        // Fall back to comma-separated gender values from legacy sheet rows.
      }
      return text.split(",").map((gender) => gender.trim()).filter(Boolean).map((gender) => ({ gender }));
    }

    function normalizeBuilderApplicationPayload(item = {}) {
      if (item.applicant || item.trip || item.agreements) {
        const normalized = ensureBuilderApplicationIdentifiers(item);
        const memberKey = getJoinMemberCanonicalKey({
          ...(normalized.member || {}),
          memberKey: normalized.memberKey || getNestedValue(normalized, "member.memberKey") || ""
        });
        normalized.memberKey = normalized.memberKey || memberKey;
        normalized.member = {
          ...(normalized.member || {}),
          memberKey: getNestedValue(normalized, "member.memberKey") || normalized.memberKey || memberKey,
          kakaoId: getNestedValue(normalized, "member.kakaoId") || normalized.kakaoId || ""
        };
        const reference = getSecretTourProductReference({
          id: getNestedValue(normalized, "trip.productId"),
          erpProductId: getNestedValue(normalized, "trip.erpProductId"),
          erpEventSeq: getNestedValue(normalized, "trip.erpEventSeq")
        });
        normalized.trip = {
          ...(normalized.trip || {}),
          productId: getNestedValue(normalized, "trip.productId") || reference.id,
          productFamilyId: getNestedValue(normalized, "trip.productFamilyId") || normalized.productFamilyId || "",
          erpProductId: normalizeJoinCanonicalErpProductId(reference.goodSeq || getNestedValue(normalized, "trip.erpProductId"), reference.eventSeq),
          erpEventSeq: normalizeJoinCanonicalErpEventSeq(reference.eventSeq || getNestedValue(normalized, "trip.erpEventSeq")),
          productPrice: getNestedValue(normalized, "trip.productPrice") || normalized.productPrice || normalized.price || ""
        };
        return normalized;
      }
      const reference = getSecretTourProductReference({
        id: item.productId || item.erpProductId,
        erpProductId: item.erpProductId || item.productId,
        erpEventSeq: item.erpEventSeq || item.eventSeq
      });
      return ensureBuilderApplicationIdentifiers({
        applicationId: item.applicationId || "",
        scheduleId: item.scheduleId || "",
        memberLookupMatched: item.memberLookupMatched === true,
        memberLookupKey: item.memberLookupKey || "",
        submittedAt: item.submittedAt || item.createdAt || "",
        source: item.source || "new_schedule_builder",
        memberKey: item.memberKey || "",
        status: item.applicationStatus || item.status || item.scheduleStatus || item.departureStatus || item.managerStatus || item.confirmStatus || "",
        applicationStatus: item.applicationStatus || item.status || "",
        participantStatus: item.participantStatus || "",
        refundStatus: item.refundStatus || "",
        scheduleStatus: item.scheduleStatus || item.applicationStatus || item.status || "",
        departureStatus: item.departureStatus || item.confirmStatus || "",
        managerStatus: item.managerStatus || "",
        paymentStatus: item.paymentStatus || item.balanceStatus || "",
        quoteId: item.quoteId || "",
        quoteNo: item.quoteNo || "",
        quoteStatus: item.quoteStatus || "",
        quoteUrl: item.quoteUrl || "",
        quotePageUrl: item.quotePageUrl || item.quoteUrl || "",
        quotePdfUrl: item.quotePdfUrl || "",
        quoteGeneratedAt: item.quoteGeneratedAt || "",
        pageUrl: item.pageUrl || "",
        member: {
          memberKey: item.memberKey || "",
          memberSeq: item.memberSeq || "",
          memberId: item.memberId || "",
          memberName: item.memberName || item.applicantName || item.creatorName || item.name || "",
          memberChannel: item.memberChannel || "",
          memberMobile: normalizeJoinMemberPhone(item.memberMobile || item.mobile || item.applicantMobile || item.creatorPhone || item.phone || ""),
          memberEmail: item.memberEmail || item.email || "",
          kakaoId: item.kakaoId || ""
        },
        applicant: {
          name: item.applicantName || item.creatorName || item.name || "",
          gender: item.applicantGender || item.creatorGender || item.gender || "",
          birthYear: item.applicantBirthYear || item.creatorBirthYear || item.birthYear || "",
          ageDisplay: item.applicantAgeBand || item.creatorAgeDisplay || item.ageDisplay || "",
          phone: item.applicantMobile || item.creatorPhone || item.phone || "",
          profession: item.applicantProfession || item.creatorProfession || item.profession || "",
          people: item.applicantPeople || item.creatorPeople || item.people || 1,
          companions: parseCompanionList(item.applicantCompanions || item.creatorCompanions || item.companions),
          level: item.applicantLevel || item.creatorLevel || item.level || "",
          styles: toBuilderApplicationArray(item.applicantStyles || item.creatorStyles || item.styles),
          memberPreferences: toBuilderApplicationArray(item.applicantPreferredMembers || item.creatorMemberPreferences || item.creatorPreferredMemberComposition || item.memberPreferences || item.preferredMemberComposition),
          preferredMemberComposition: toBuilderApplicationArray(item.applicantPreferredMembers || item.creatorPreferredMemberComposition || item.creatorMemberPreferences || item.preferredMemberComposition || item.memberPreferences),
          greeting: item.applicantGreeting || item.creatorGreeting || item.greeting || "",
          roomType: item.applicantRoomType || item.roomType || "2인1실",
          flightRequestType: item.flightRequestType || "",
          singleRoomSurcharge: Number(item.singleRoomSurcharge) || 0,
          singleRoomSurchargeText: item.singleRoomSurchargeText || "",
          singleRoomSurchargeStatus: item.singleRoomSurchargeStatus || ""
        },
        trip: {
          region: item.region || "",
          regions: toBuilderApplicationArray(item.regions),
          productId: item.productId || item.erpProductId || reference.id || "",
          productFamilyId: item.productFamilyId || "",
          erpProductId: normalizeJoinCanonicalErpProductId(reference.goodSeq || item.erpProductId || item.productId, reference.eventSeq || item.erpEventSeq || item.eventSeq),
          erpEventSeq: normalizeJoinCanonicalErpEventSeq(reference.eventSeq || item.erpEventSeq || item.eventSeq),
          productName: item.productName || "",
          productPrice: item.productPrice || item.price || "",
          startSummary: item.startSummary || item.departureDateFrom || "",
          endSummary: item.endSummary || item.returnDateFrom || "",
          tripSummary: item.tripSummary || "",
          departureDates: toBuilderApplicationArray(item.departureDates || [item.departureDateFrom, item.departureDateTo].filter(Boolean)),
          returnDates: toBuilderApplicationArray(item.returnDates || [item.returnDateFrom, item.returnDateTo].filter(Boolean)),
          flexibleDays: {
            startBefore: item.departureDateFrom || item.startBefore || "",
            startAfter: item.departureDateTo || item.startAfter || "",
            endBefore: item.returnDateFrom || item.endBefore || "",
            endAfter: item.returnDateTo || item.endAfter || ""
          }
        },
        agreements: {
          required: item.requiredAgreed || "",
          marketing: item.marketingAgreed || ""
        }
      });
    }

    function escapeBuilderApplicationText(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

    function maskBuilderApplicantName(name) {
      const text = String(name || "").trim();
      return text ? `${text.charAt(0)}**` : "신청자";
    }

    function getFirstISODate(value) {
      const dates = toBuilderApplicationArray(value);
      return dates.find((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)) || "";
    }

    function parseBuilderApplicationPrice(value) {
      const price = Number(String(value || "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(price) && price > 0 ? price : 0;
    }

    function getBuilderApplicationPeopleCount(payload) {
      const rawCount = Number(String(getNestedValue(payload, "applicant.people") || "1").replace(/\D/g, ""));
      const count = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1;
      return Math.min(JOIN_MAX_CAPACITY, BUILDER_APPLICATION_MAX_PARTICIPANT_ICONS, count);
    }

    function getBuilderApplicationIconPoolKey(gender) {
      const normalizedGender = String(gender || "").trim();
      if (normalizedGender === "여성") return "female";
      return "male";
    }

    function getStableIconIndex(seed, length) {
      if (!length) return 0;
      const source = String(seed || Math.random());
      let hash = 0;
      for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
      }
      return Math.abs(hash) % length;
    }

    function getBuilderApplicationGenderIcon(gender, fallback, seed = "") {
      const poolKey = getBuilderApplicationIconPoolKey(gender);
      const pool = BUILDER_APPLICATION_GENDER_ICON_POOLS[poolKey] || [];
      return pool[getStableIconIndex(seed, pool.length)] || fallback || BUILDER_APPLICATION_GENDER_ICON_POOLS.male[0];
    }

    function buildBuilderApplicationParticipants(payload, fallback, idSeed, participantName) {
      const applicantGender = escapeBuilderApplicationText(getNestedValue(payload, "applicant.gender"));
      const companionGenders = Array.isArray(getNestedValue(payload, "applicant.companions"))
        ? getNestedValue(payload, "applicant.companions").map((item) => escapeBuilderApplicationText(item?.gender || ""))
        : [];
      const participantCount = getBuilderApplicationPeopleCount(payload);
      const currentMember = typeof getJoinCachedCurrentMember === "function" ? getJoinCachedCurrentMember() : null;
      const memberLookupMatched = isJoinMemberLookupMatchedForMember(payload, currentMember || {});
      const currentMemberKey = memberLookupMatched ? getJoinMyMemberIdentity(currentMember || {}).memberKey : "";
      return Array.from({ length: participantCount }, (_, index) => ({
        id: `${BUILDER_APPLICATION_JOIN_PREFIX}${idSeed || "application"}-p${index + 1}`,
        name: index === 0 ? participantName : `일행${index}`,
        gender: index === 0 ? applicantGender : (companionGenders[index - 1] || applicantGender),
        ...(index === 0 ? { isHost: true, isCreator: true } : {}),
        ...(index === 0 ? {
          memberSeq: getNestedValue(payload, "member.memberSeq") || "",
          memberId: getNestedValue(payload, "member.memberId") || "",
          memberMobile: normalizeJoinMemberPhone(getNestedValue(payload, "member.memberMobile") || getNestedValue(payload, "applicant.phone") || ""),
          memberEmail: getNestedValue(payload, "member.memberEmail") || "",
          ...(memberLookupMatched ? { isCurrentMember: true, currentMemberKey } : {})
        } : {}),
        companionGroup: participantCount > 1 ? `${BUILDER_APPLICATION_JOIN_PREFIX}${idSeed || "application"}-companions` : "",
        age: escapeBuilderApplicationText(getNestedValue(payload, "applicant.ageDisplay")),
        handicap: escapeBuilderApplicationText(getNestedValue(payload, "applicant.level") || ""),
        profession: escapeBuilderApplicationText(getNestedValue(payload, "applicant.profession")),
        preferences: [
          ...toBuilderApplicationArray(getNestedValue(payload, "applicant.styles")),
          ...toBuilderApplicationArray(getNestedValue(payload, "applicant.memberPreferences") || getNestedValue(payload, "applicant.preferredMemberComposition"))
        ].map(escapeBuilderApplicationText),
        memberPreferences: toBuilderApplicationArray(getNestedValue(payload, "applicant.memberPreferences") || getNestedValue(payload, "applicant.preferredMemberComposition")).map(escapeBuilderApplicationText),
        preferredMemberComposition: toBuilderApplicationArray(getNestedValue(payload, "applicant.preferredMemberComposition") || getNestedValue(payload, "applicant.memberPreferences")).map(escapeBuilderApplicationText),
        message: escapeBuilderApplicationText(index === 0 ? (getNestedValue(payload, "applicant.greeting") || "새 일정 조인을 신청했어요.") : "동반 참여 인원입니다."),
        status: "confirmed",
        gif: (() => {
          const gender = index === 0 ? applicantGender : (companionGenders[index - 1] || applicantGender);
          const genderFallback = fallback.participants?.find((participant) => participant.gender === gender)?.gif || fallback.participants?.[0]?.gif;
          return getBuilderApplicationGenderIcon(gender, genderFallback, `${idSeed}-${index}-${gender}`);
        })()
      }));
    }

    function findBuilderApplicationProduct(payload) {
      const productId = getNestedValue(payload, "trip.productId");
      const productName = getNestedValue(payload, "trip.productName");
      const reference = getSecretTourProductReference({
        id: productId,
        erpProductId: getNestedValue(payload, "trip.erpProductId"),
        erpEventSeq: getNestedValue(payload, "trip.erpEventSeq")
      });
      const source = [
        ...(externalGolfJoinProducts || []),
        ...joins.filter((item) => !isUserCreatedJoinSchedule(item))
      ];
      const exactProduct = source.find((item) => {
          const itemReference = getSecretTourProductReference(item);
          return reference.goodSeq
            && reference.eventSeq
            && itemReference.goodSeq === reference.goodSeq
            && itemReference.eventSeq === reference.eventSeq;
        });
      if (exactProduct) return exactProduct;
      // 저장된 일정에 ERP 식별자가 있으면 같은 이름의 다른 출발일 상품을 대신 사용하지 않는다.
      // 다른 eventSeq의 상세 로딩 상태·슬라이드·일정표가 상속되면 참여자 화면에서 상세가 비어 보일 수 있다.
      if (reference.goodSeq || reference.eventSeq) return null;
      return source.find((item) => productId && item.id === productId)
        || source.find((item) => reference.id && item.id === reference.id)
        || source.find((item) => productName && item.title === productName)
        || null;
    }

    function resolveBuilderApplicationScheduleRange(normalized = {}, product = {}, fallback = {}) {
      const selectedDepartureDate = getFirstISODate(getNestedValue(normalized, "trip.departureDates"))
        || getFirstISODate(getNestedValue(normalized, "trip.startSummary"));
      const selectedReturnDate = getFirstISODate(getNestedValue(normalized, "trip.returnDates"))
        || getFirstISODate(getNestedValue(normalized, "trip.endSummary"));
      const productDepartureDate = product?.departureDate || "";
      const productReturnDate = product?.returnDate || productDepartureDate;
      const departureDate = selectedDepartureDate || productDepartureDate || fallback.departureDate || "2026-05-15";
      const returnDate = selectedReturnDate || productReturnDate || fallback.returnDate || departureDate;
      return { departureDate, returnDate };
    }

    function buildBuilderApplicationJoin(payload, index = 0) {
      const normalized = normalizeBuilderApplicationPayload(payload);
      const product = findBuilderApplicationProduct(normalized);
      const fallback = product || overseasJoinTemplate || joins.find(isOverseasJoin) || joins[0] || {};
      const storedEventSeq = normalizeJoinCanonicalErpEventSeq(getNestedValue(normalized, "trip.erpEventSeq"));
      const storedProductId = normalizeJoinCanonicalErpProductId(
        getNestedValue(normalized, "trip.erpProductId") || getNestedValue(normalized, "trip.productId"),
        storedEventSeq
      );
      const productReference = getSecretTourProductReference({
        ...(product || {}),
        id: getNestedValue(normalized, "trip.productId") || product?.id,
        erpProductId: getNestedValue(normalized, "trip.erpProductId") || product?.erpProductId,
        erpEventSeq: getNestedValue(normalized, "trip.erpEventSeq") || product?.erpEventSeq
      });
      const canonicalEventSeq = storedEventSeq || normalizeJoinCanonicalErpEventSeq(productReference.eventSeq || product?.eventSeq || product?.erpEventSeq);
      const canonicalProductId = storedProductId
        || normalizeJoinCanonicalErpProductId(productReference.goodSeq || product?.goodSeq || product?.erpProductId, canonicalEventSeq);
      const savedProductMeta = golfJoinProductMetaByGoodSeq.get(String(productReference.goodSeq || "").trim()) || {};
      const { departureDate, returnDate } = resolveBuilderApplicationScheduleRange(normalized, product, fallback);
      const region = getNestedValue(normalized, "trip.region") || toBuilderApplicationArray(getNestedValue(normalized, "trip.regions"))[0] || product?.region || fallback.region || "해외";
      const productName = getNestedValue(normalized, "trip.productName") || product?.title || "";
      const applicantName = getNestedValue(normalized, "applicant.name");
      const submittedAt = normalized.submittedAt || nowKstISOString();
      const idSeed = normalized.scheduleId || normalized.applicationId || buildGoogleSheetRecordId("nsa", submittedAt, productName, region, index);
      const participantName = escapeBuilderApplicationText(maskBuilderApplicantName(applicantName));
      const participants = buildBuilderApplicationParticipants(normalized, fallback, idSeed || index, participantName);
      const savedProductPrice = parseBuilderApplicationPrice(getNestedValue(normalized, "trip.productPrice") || normalized.productPrice || normalized.price);

      return {
        ...fallback,
        id: `${BUILDER_APPLICATION_JOIN_PREFIX}${idSeed || index}`,
        scheduleId: normalized.scheduleId || "",
        sourceApplicationId: normalized.applicationId || "",
        title: escapeBuilderApplicationText(productName || `${region} 맞춤 조인 요청`),
        region: escapeBuilderApplicationText(region),
        category: "해외",
        departureDate,
        returnDate,
        date: `${departureDate} - ${returnDate}`,
        startSummary: escapeBuilderApplicationText(getNestedValue(normalized, "trip.startSummary")),
        endSummary: escapeBuilderApplicationText(getNestedValue(normalized, "trip.endSummary")),
        departureDates: toBuilderApplicationArray(getNestedValue(normalized, "trip.departureDates")),
        returnDates: toBuilderApplicationArray(getNestedValue(normalized, "trip.returnDates")),
        flexibleDays: {
          startBefore: Number(getNestedValue(normalized, "trip.flexibleDays.startBefore") || 0),
          startAfter: Number(getNestedValue(normalized, "trip.flexibleDays.startAfter") || 0),
          endBefore: Number(getNestedValue(normalized, "trip.flexibleDays.endBefore") || 0),
          endAfter: Number(getNestedValue(normalized, "trip.flexibleDays.endAfter") || 0)
        },
        duration: escapeBuilderApplicationText(getNestedValue(normalized, "trip.tripSummary")) || fallback.duration,
        dayNightCnt: escapeBuilderApplicationText(getNestedValue(normalized, "trip.tripSummary")) || fallback.dayNightCnt,
        price: savedProductPrice || Number(product?.price || fallback.price || 0),
        image: normalizeGolfJoinProductImageUrl(
          getNestedValue(normalized, "trip.imageUrl")
          || normalized.imageUrl
          || product?.image
          || savedProductMeta.image
          || fallback.image
        ),
        badge: "신규조인",
        badgeKind: "special",
        badgeImage: BADGE_IMAGES.special,
        departureAirport: product?.departureAirport || product?.airport || fallback.departureAirport || fallback.airport || "",
        arrivalAirport: product?.arrivalAirport || fallback.arrivalAirport || "",
        airline: product?.airline || product?.air2Nm || product?.air2CdNm || fallback.airline || "",
        goodSeq: canonicalProductId || "",
        eventSeq: canonicalEventSeq || "",
        erpProductId: canonicalProductId || "",
        erpEventSeq: canonicalEventSeq || "",
        productFamilyId: getNestedValue(normalized, "trip.productFamilyId") || "",
        participants,
        maxCapacity: BUILDER_APPLICATION_MAX_CAPACITY,
        emptySlots: Math.max(0, BUILDER_APPLICATION_MAX_CAPACITY - participants.length),
        includes: product?.includes?.length ? product.includes : (fallback.includes || []),
        excludes: product?.excludes?.length ? product.excludes : (fallback.excludes || []),
        notes: product?.notes?.length ? product.notes : (fallback.notes || []),
        schedule: product?.schedule?.length ? product.schedule : (fallback.schedule || []),
        sheetApplication: normalized,
        isBuilderApplicationJoin: true,
        submittedAt
      };
    }

    function upsertBuilderApplicationJoin(payload, options = {}) {
      const join = buildBuilderApplicationJoin(payload);
      join.builderApplicationSource = options.source || "local";
      const currentIndex = joins.findIndex((item) => item.id === join.id);
      if (currentIndex >= 0) {
        const existingJoin = joins[currentIndex];
        if (options.source === "sheet") {
          const nextIdentity = getJoinMyBuilderApplicationIdentity(join);
          const existingApplication = existingJoin.sheetApplication || {};
          const nextApplication = join.sheetApplication || {};
          if (!nextIdentity.seq && getNestedValue(existingApplication, "member.memberSeq")) {
            nextApplication.member = { ...(nextApplication.member || {}), memberSeq: getNestedValue(existingApplication, "member.memberSeq") };
          }
          if (!nextIdentity.id && getNestedValue(existingApplication, "member.memberId")) {
            nextApplication.member = { ...(nextApplication.member || {}), memberId: getNestedValue(existingApplication, "member.memberId") };
          }
          if (!nextIdentity.phone && (getNestedValue(existingApplication, "member.memberMobile") || getNestedValue(existingApplication, "applicant.phone"))) {
            nextApplication.member = {
              ...(nextApplication.member || {}),
              memberMobile: getNestedValue(existingApplication, "member.memberMobile") || getNestedValue(existingApplication, "applicant.phone")
            };
            nextApplication.applicant = {
              ...(nextApplication.applicant || {}),
              phone: getNestedValue(nextApplication, "applicant.phone") || getNestedValue(existingApplication, "applicant.phone") || getNestedValue(existingApplication, "member.memberMobile")
            };
          }
          if (!nextIdentity.email && getNestedValue(existingApplication, "member.memberEmail")) {
            nextApplication.member = { ...(nextApplication.member || {}), memberEmail: getNestedValue(existingApplication, "member.memberEmail") };
          }
          if (!nextIdentity.kakaoId && getNestedValue(existingApplication, "member.kakaoId")) {
            nextApplication.member = { ...(nextApplication.member || {}), kakaoId: getNestedValue(existingApplication, "member.kakaoId") };
          }
          join.sheetApplication = nextApplication;
        }
        const baseParticipantIds = new Set((join.participants || []).map((participant) => String(participant.id || "")));
        const shouldReplaceBuilderPreviewParticipants = options.source === "sheet" || options.source === "light";
        const appliedParticipants = (existingJoin.participants || [])
          .filter((participant) => {
            const participantId = String(participant.id || "");
            if (
              shouldReplaceBuilderPreviewParticipants
              && isJoinParticipantPreviewSource(participant)
              && (participant.isHost || participant.isCreator)
            ) return false;
            return participantId && !baseParticipantIds.has(participantId);
          });
        if (existingJoin.lightSummary) {
          join.lightSummary = { ...existingJoin.lightSummary, ...(join.lightSummary || {}) };
        }
        if (existingJoin.participantSummary) {
          join.participantSummary = { ...existingJoin.participantSummary, ...(join.participantSummary || {}) };
        }
        if (!normalizeGolfJoinProductImageUrl(join.image) && normalizeGolfJoinProductImageUrl(existingJoin.image)) {
          join.image = normalizeGolfJoinProductImageUrl(existingJoin.image);
        }
        const participantCapacity = getJoinRecruitmentCapacity(join, BUILDER_APPLICATION_MAX_CAPACITY);
        if (appliedParticipants.length) {
          const prioritizedParticipants = [...appliedParticipants].sort((left, right) => {
            const getPriority = (participant = {}) => {
              if (participant.source === "join_apply" && !isJoinParticipantPreviewSource(participant)) return 0;
              if (!isJoinParticipantPreviewSource(participant)) return 1;
              return 2;
            };
            return getPriority(left) - getPriority(right);
          });
          join.participants = mergeJoinParticipantsByIdentity(
            join.participants || [],
            prioritizedParticipants,
            participantCapacity
          );
        }
        const summaryRemainingSlots = Number(join.participantSummary?.remainingSlots ?? join.lightSummary?.remainingSlots);
        join.emptySlots = Number.isFinite(summaryRemainingSlots)
          ? Math.max(0, summaryRemainingSlots)
          : Math.max(0, participantCapacity - getConfirmedParticipants(join).length);
        join.maxCapacity = participantCapacity;
        joins.splice(currentIndex, 1, join);
        if (existingJoin.participantSummary) applyLightParticipantSummary(existingJoin.participantSummary);
      } else {
        joins.unshift(join);
      }
      reapplyRememberedJoinApplications({ render: false });
      if (options.persist) saveBuilderApplicationPayloadLocally(payload);
      if (options.render !== false) renderJoins();
      return join;
    }

    function getBuilderApplicationIdentityKeys(item = {}) {
      return [
        item.id,
        item.joinId,
        item.scheduleId,
        item.sourceApplicationId,
        item.applicationId,
        item.targetScheduleId,
        item.targetApplicationId
      ].map((value) => String(value || "").trim()).filter(Boolean);
    }

    function getBuilderPayloadIdentityKeys(payload = {}) {
      const normalized = normalizeBuilderApplicationPayload(payload);
      return [
        normalized.scheduleId,
        normalized.applicationId,
        payload.scheduleId,
        payload.applicationId,
        payload.targetScheduleId,
        payload.targetApplicationId
      ].map((value) => String(value || "").trim()).filter(Boolean);
    }

    function getBuilderApplicationSubmittedTime(source = {}) {
      const submittedAt = source.submittedAt || source.createdAt || source.updatedAt || getNestedValue(source, "sheetApplication.submittedAt");
      const time = new Date(submittedAt || 0).getTime();
      return Number.isFinite(time) ? time : 0;
    }

    function isRecentBuilderApplicationSource(source = {}) {
      const submittedTime = getBuilderApplicationSubmittedTime(source);
      return Boolean(submittedTime && Date.now() - submittedTime <= BUILDER_APPLICATION_LOCAL_PRESERVE_MS);
    }

    function shouldPreserveLocalBuilderApplicationJoin(join = {}) {
      if (join.builderApplicationSource !== "local") return false;
      if (!isRecentBuilderApplicationSource(join.sheetApplication || join)) return false;
      const member = getJoinCachedCurrentMember?.();
      return !member || isJoinMyCreatedScheduleForMember(join, member);
    }

    function pruneBuilderApplicationLocalPayloads(validKeys = new Set()) {
      try {
        const cached = readJoinMemberScopedItems(BUILDER_APPLICATIONS_STORAGE_KEY);
        if (!Array.isArray(cached) || !cached.length) return;
        const next = cached.filter((payload) => {
          const keys = getBuilderPayloadIdentityKeys(payload);
          if (keys.some((key) => validKeys.has(key))) return false;
          return isRecentBuilderApplicationSource(payload);
        }).slice(0, 10);
        if (next.length) writeJoinMemberScopedItems(BUILDER_APPLICATIONS_STORAGE_KEY, next);
        else localStorage.removeItem(BUILDER_APPLICATIONS_STORAGE_KEY);
      } catch (error) {
        golfJoinSafeWarn("Failed to prune builder application cache.", error);
      }
    }

    function clearBuilderApplicationLocalCache(options = {}) {
      try {
        const validKeys = new Set((options.authoritativeKeys || []).map((key) => String(key || "").trim()).filter(Boolean));
        if (options.preserveRecentLocal) {
          pruneBuilderApplicationLocalPayloads(validKeys);
        } else {
          localStorage.removeItem(BUILDER_APPLICATIONS_STORAGE_KEY);
        }
        localStorage.removeItem(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY);
      } catch (error) {
        golfJoinSafeWarn("Failed to clear builder application cache.", error);
      }
    }

    function removeBuilderApplicationJoinsNotIn(validKeys = new Set(), options = {}) {
      const before = joins.length;
      for (let index = joins.length - 1; index >= 0; index -= 1) {
        const join = joins[index];
        if (!join?.isBuilderApplicationJoin) continue;
        const keys = getBuilderApplicationIdentityKeys(join);
        const shouldKeep = keys.some((key) => validKeys.has(key));
        if (!shouldKeep && options.preserveRecentLocal && shouldPreserveLocalBuilderApplicationJoin(join)) continue;
        if (!shouldKeep) joins.splice(index, 1);
      }
      return before !== joins.length;
    }

    function syncBuilderApplicationJoinsWithAuthoritativeKeys(keys = [], options = {}) {
      const validKeys = new Set((keys || []).map((key) => String(key || "").trim()).filter(Boolean));
      if (!validKeys.size) {
        removeBuilderApplicationJoinsNotIn(new Set(), options);
        return;
      }
      removeBuilderApplicationJoinsNotIn(validKeys, options);
    }

    function shouldShowLightSummary(item = {}) {
      const approval = String(item.approvalStatus || "").trim().toLowerCase();
      const display = String(item.displayStatus || "").trim().toLowerCase();
      if (["rejected", "deleted", "hidden", "inactive", "cancelled"].includes(approval)) return false;
      if (["hidden", "deleted", "inactive", "false", "0"].includes(display)) return false;
      return true;
    }

    function buildLightPreviewParticipant(preview = {}, joinId = "", index = 0, options = {}) {
      const gender = preview.gender || "";
      const previewSeed = preview.iconSeed || preview.seed || "";
      const isHost = Boolean(options.markFirstAsHost && index === 0);
      return {
        id: `${joinId}-preview-${index + 1}`,
        source: "participant_summary_preview",
        previewSeed,
        ...(isHost ? { isHost: true, isCreator: true } : {}),
        name: preview.displayName || "",
        gender,
        companionGroup: preview.companionGroup || "",
        age: preview.ageDisplay || "",
        handicap: preview.level || "",
        profession: preview.profession || "",
        preferences: [
          ...toBuilderApplicationArray(preview.styles),
          ...toBuilderApplicationArray(preview.memberPreferences)
        ],
        memberPreferences: toBuilderApplicationArray(preview.memberPreferences),
        preferredMemberComposition: toBuilderApplicationArray(preview.memberPreferences),
        message: "",
        status: "confirmed",
        gif: getBuilderApplicationGenderIcon(gender, null, `${joinId}-${previewSeed || index}`)
      };
    }

    function getJoinAuthoritativeConfirmedCount(join = {}) {
      const capacity = getJoinRecruitmentCapacity(join, JOIN_MAX_CAPACITY);
      const counts = [
        getConfirmedParticipants(join).length,
        Number(join.participantSummary?.confirmedCount),
        Number(join.lightSummary?.confirmedCount),
        Number(join.confirmedCount),
        Number(join.currentCount),
        Number(join.participantCount)
      ].filter((value) => Number.isFinite(value) && value >= 0);
      return Math.min(capacity, Math.max(0, ...counts));
    }

    function getLightPreviewMatchKey(preview = {}) {
      const displayName = String(preview.displayName || preview.name || "").replace(/\*/g, "").trim();
      return {
        seed: String(preview.iconSeed || preview.seed || "").trim(),
        nameInitial: displayName.charAt(0),
        gender: String(preview.gender || "").trim().toLowerCase()
      };
    }

    function areLightParticipantPreviewsSame(left = {}, right = {}) {
      const leftKey = getLightPreviewMatchKey(left);
      const rightKey = getLightPreviewMatchKey(right);
      if (leftKey.seed && rightKey.seed && leftKey.seed === rightKey.seed) return true;
      return Boolean(
        leftKey.nameInitial
        && rightKey.nameInitial
        && leftKey.nameInitial === rightKey.nameInitial
        && (!leftKey.gender || !rightKey.gender || leftKey.gender === rightKey.gender)
      );
    }

    function getLightCreatorPreviewPrefixCount(join = {}, summaryPreviews = []) {
      if (!isJoinMyBuilderApplicationJoin(join)) return 0;
      const creatorPreviews = Array.isArray(join.lightSummary?.participantsPreview)
        ? join.lightSummary.participantsPreview
        : [];
      let prefixCount = 0;
      const limit = Math.min(creatorPreviews.length, summaryPreviews.length, BUILDER_APPLICATION_MAX_CAPACITY);
      while (
        prefixCount < limit
        && areLightParticipantPreviewsSame(creatorPreviews[prefixCount], summaryPreviews[prefixCount])
      ) {
        prefixCount += 1;
      }
      return prefixCount;
    }

    function ensureJoinParticipantSummaryCount(join = {}, participants = [], summary = {}) {
      const capacity = getJoinRecruitmentCapacity({ ...join, capacity: summary.capacity || join.capacity }, BUILDER_APPLICATION_MAX_CAPACITY);
      const targetCount = Math.min(
        capacity,
        MAX_DETAIL_PARTICIPANT_PREVIEWS,
        Math.max(0, Number(summary.confirmedCount) || participants.length)
      );
      const reconciled = participants.slice(0, capacity);
      const existingGenderCounts = reconciled.reduce((counts, participant = {}) => {
        const gender = String(participant.gender || "").trim().toLowerCase();
        if (gender.includes("여") || gender === "female") counts.female += 1;
        else if (gender.includes("남") || gender === "male") counts.male += 1;
        return counts;
      }, { male: 0, female: 0 });
      let remainingMale = Math.max(0, Number(summary.maleCount || 0) - existingGenderCounts.male);
      let remainingFemale = Math.max(0, Number(summary.femaleCount || 0) - existingGenderCounts.female);
      while (reconciled.length < targetCount) {
        const index = reconciled.length;
        const gender = remainingFemale > remainingMale ? "여성" : "남성";
        if (gender === "여성") remainingFemale = Math.max(0, remainingFemale - 1);
        else remainingMale = Math.max(0, remainingMale - 1);
        reconciled.push({
          id: `${join.id || join.scheduleId || "join"}-summary-placeholder-${index + 1}`,
          source: "participant_summary_preview",
          previewSeed: `summary-placeholder-${index + 1}`,
          summaryCountPlaceholder: true,
          name: "참여자",
          gender,
          age: "",
          handicap: "",
          profession: "",
          preferences: [],
          message: "",
          status: "confirmed",
          gif: getBuilderApplicationGenderIcon(gender, null, `${join.id || join.scheduleId || "join"}-summary-placeholder-${index + 1}`)
        });
      }
      return reconciled;
    }

    function mergeJoinParticipantsByIdentity(existingParticipants = [], previewParticipants = [], limit = BUILDER_APPLICATION_MAX_CAPACITY) {
      const merged = [];
      const seen = new Set();
      const seenApplicationMarkers = [];
      const getKey = (participant = {}) => {
        const identity = getJoinParticipantMemberIdentity(participant);
        if (identity.seq) return `seq:${identity.seq}`;
        if (identity.id) return `member-id:${identity.id}`;
        if (identity.phone) return `phone:${identity.phone}`;
        if (identity.email) return `email:${identity.email}`;
        if (identity.kakaoId) return `kakao:${identity.kakaoId}`;
        if (participant.id) return `participant:${participant.id}`;
        return "";
      };
      [...existingParticipants, ...previewParticipants].forEach((participant) => {
        if (!participant) return;
        if (
          (participant.isHost || participant.isCreator)
          && merged.some((item) => item?.isHost || item?.isCreator)
        ) return;
        const key = getKey(participant);
        if (key && seen.has(key)) return;
        const markers = getJoinParticipantApplicationMarkers(participant);
        const isPreviewSource = isJoinParticipantPreviewSource(participant);
        const duplicatePreviewRecord = markers.reduce((match, marker) => {
          if (match) return match;
          return seenApplicationMarkers.find((seenMarker) => {
            if (isPreviewSource === seenMarker.isPreviewSource) return false;
            return doJoinParticipantApplicationMarkersMatch(marker, seenMarker.value);
          }) || null;
        }, null);
        if (duplicatePreviewRecord) {
          if (isPreviewSource || !duplicatePreviewRecord.isPreviewSource) return;
          const previewIndex = merged.indexOf(duplicatePreviewRecord.participant);
          if (previewIndex >= 0) merged.splice(previewIndex, 1);
          for (let index = seenApplicationMarkers.length - 1; index >= 0; index -= 1) {
            if (seenApplicationMarkers[index].participant === duplicatePreviewRecord.participant) {
              seenApplicationMarkers.splice(index, 1);
            }
          }
        }
        if (key) seen.add(key);
        markers.forEach((marker) => {
          if (!seenApplicationMarkers.some((seenMarker) => doJoinParticipantApplicationMarkersMatch(marker, seenMarker.value))) {
            seenApplicationMarkers.push({ value: marker, isPreviewSource, participant });
          }
        });
        merged.push(participant);
      });
      return merged.slice(0, Math.max(0, limit));
    }

    function applyLightParticipantsToJoin(join, previews = [], summary = {}) {
      if (!join) return null;
      const capacity = getJoinRecruitmentCapacity(join, BUILDER_APPLICATION_MAX_CAPACITY);
      const previewLimit = Math.min(MAX_DETAIL_PARTICIPANT_PREVIEWS, capacity);
      const previewParticipants = (Array.isArray(previews) ? previews : [])
        .slice(0, previewLimit)
        .map((preview, index) => buildLightPreviewParticipant(preview, join.id || join.scheduleId || "", index));
      if (previewParticipants.length) {
        join.participants = mergeJoinParticipantsByIdentity(join.participants || [], previewParticipants, capacity);
      }
      join.participants = ensureJoinParticipantSummaryCount(join, getConfirmedParticipants(join), summary);
      const confirmedCount = Math.max(0, Math.min(capacity, Number(summary.confirmedCount) || previewParticipants.length || getConfirmedParticipants(join).length));
      const remainingSlots = Number.isFinite(Number(summary.remainingSlots))
        ? Math.max(0, Number(summary.remainingSlots))
        : Math.max(0, capacity - confirmedCount);
      join.emptySlots = remainingSlots;
      join.maxCapacity = capacity;
      return join;
    }

    function normalizeSheetDateText(value = "") {
      const text = String(value || "").trim();
      if (!text) return "";
      const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
      const parsed = new Date(text);
      if (!Number.isFinite(parsed.getTime())) return text.split("~")[0]?.trim() || text;
      const kstTime = parsed.getTime() + (9 * 60 * 60 * 1000);
      return new Date(kstTime).toISOString().slice(0, 10);
    }

    function getSheetSerialFromDateText(value = "") {
      const iso = normalizeSheetDateText(value);
      const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return "";
      const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      const base = Date.UTC(1899, 11, 30);
      return String(Math.round((utc - base) / 86400000));
    }

    function normalizeSheetPriceText(value = "") {
      const text = String(value || "").trim();
      if (!text) return "";
      if (/^\d{4}-\d{2}-\d{2}/.test(text) || /^[A-Z][a-z]{2}\s[A-Z][a-z]{2}\s\d{2}\s\d{4}/.test(text)) {
        return getSheetSerialFromDateText(text);
      }
      return text.replace(/[^\d.-]/g, "");
    }

    function buildLightBuilderPayload(summary = {}) {
      const applicationId = summary.applicationId || "";
      const scheduleId = summary.scheduleId || "";
      const departureDate = normalizeSheetDateText(summary.departureDate);
      const returnDate = normalizeSheetDateText(summary.returnDate) || departureDate;
      return {
        applicationId,
        scheduleId,
        submittedAt: summary.createdAt || summary.updatedAt || nowKstISOString(),
        source: "new_schedule_builder",
        applicationStatus: summary.approvalStatus || "",
        displayStatus: summary.displayStatus || "",
        member: {
          memberSeq: summary.memberSeq || summary.creatorMemberSeq || summary.creatorPreview?.memberSeq || "",
          memberId: summary.memberId || summary.creatorMemberId || summary.creatorPreview?.memberId || "",
          memberName: summary.memberName || summary.creatorName || summary.creatorPreview?.displayName || "",
          memberChannel: summary.memberChannel || "",
          memberMobile: normalizeJoinMemberPhone(summary.memberMobile || summary.creatorMobile || summary.creatorPhone || summary.creatorPreview?.memberMobile || ""),
          memberEmail: summary.memberEmail || summary.creatorEmail || summary.creatorPreview?.memberEmail || ""
        },
        applicant: {
          name: summary.creatorPreview?.displayName || "",
          gender: summary.creatorPreview?.gender || "",
          ageDisplay: summary.creatorPreview?.ageDisplay || "",
          profession: summary.creatorPreview?.profession || "",
          people: Math.max(1, Math.min(BUILDER_APPLICATION_MAX_CAPACITY, Number(summary.confirmedCount) || 1)),
          companions: (summary.participantsPreview || []).slice(1).map((item) => ({ gender: item.gender || "" })),
          level: summary.creatorPreview?.level || "",
          styles: summary.creatorPreview?.styles || [],
          memberPreferences: summary.creatorPreview?.memberPreferences || [],
          preferredMemberComposition: summary.creatorPreview?.memberPreferences || [],
          roomType: summary.roomType || "",
          flightRequestType: summary.flightRequestType || "",
          singleRoomSurchargeText: summary.singleRoomSurchargeText || ""
        },
        trip: {
          country: summary.country || "",
          region: summary.region || "",
          airline: summary.airline || "",
          departureAirport: summary.departureAirport || "",
          arrivalAirport: summary.arrivalAirport || "",
          productId: summary.erpProductId || "",
          productFamilyId: summary.productFamilyId || "",
          erpProductId: summary.erpProductId || "",
          erpEventSeq: summary.erpEventSeq || "",
          productName: summary.title || "",
          productPrice: normalizeSheetPriceText(summary.price),
          startSummary: departureDate,
          endSummary: returnDate,
          departureDates: [departureDate].filter(Boolean),
          returnDates: [returnDate].filter(Boolean)
        }
      };
    }

    function upsertLightNewScheduleSummary(summary = {}) {
      if (!summary.scheduleId && !summary.applicationId) return null;
      if (!shouldShowLightSummary(summary)) return null;
      const join = upsertBuilderApplicationJoin(buildLightBuilderPayload(summary), { render: false, source: "light" });
      join.lightSummary = summary;
      join.scheduleId = summary.scheduleId || join.scheduleId || "";
      join.sourceApplicationId = summary.applicationId || join.sourceApplicationId || "";
      if (summary.title) join.title = escapeBuilderApplicationText(summary.title);
      if (summary.region) join.region = escapeBuilderApplicationText(summary.region);
      if (summary.country) join.country = summary.country;
      if (summary.departureAirport) join.departureAirport = summary.departureAirport;
      if (summary.arrivalAirport) join.arrivalAirport = summary.arrivalAirport;
      const departureDate = normalizeSheetDateText(summary.departureDate);
      const returnDate = normalizeSheetDateText(summary.returnDate) || departureDate;
      if (departureDate) join.departureDate = departureDate;
      if (returnDate) join.returnDate = returnDate;
      join.date = `${join.departureDate || ""} - ${join.returnDate || join.departureDate || ""}`;
      const normalizedPrice = normalizeSheetPriceText(summary.price);
      if (Number(normalizedPrice)) join.price = Number(normalizedPrice);
      if (summary.image) join.image = summary.image;
      join.packType = summary.packType || join.packType || "";
      join.packTypeName = summary.packTypeName || join.packTypeName || "";
      join.flightIncluded = summary.flightIncluded || join.flightIncluded || "";
      join.shareUrl = summary.shareUrl || join.shareUrl || "";
      const capacity = getJoinRecruitmentCapacity(join, BUILDER_APPLICATION_MAX_CAPACITY);
      const confirmedCount = Math.max(0, Math.min(capacity, Number(summary.confirmedCount) || getConfirmedParticipants(join).length));
      join.emptySlots = Number.isFinite(Number(summary.remainingSlots))
        ? Math.max(0, Number(summary.remainingSlots))
        : Math.max(0, capacity - confirmedCount);
      join.maxCapacity = capacity;
      return join;
    }

    function findJoinForParticipantSummary(summary = {}) {
      const exactMatch = joins.find((join) => summary.targetScheduleId && String(join.scheduleId || "") === String(summary.targetScheduleId))
        || joins.find((join) => summary.targetApplicationId && String(join.sourceApplicationId || "") === String(summary.targetApplicationId));
      if (exactMatch) return exactMatch;
      if (summary.targetScheduleId || summary.targetApplicationId) return null;
      const summaryEventSeq = String(summary.erpEventSeq || "").trim();
      const summaryProductId = normalizeJoinErpProductId(summary.erpProductId, summaryEventSeq);
      const matches = joins.filter((join) => {
        const joinEventSeq = String(join.erpEventSeq || join.eventSeq || "").trim();
        const joinProductId = normalizeJoinErpProductId(join.erpProductId || join.goodSeq || "", joinEventSeq);
        return summaryProductId && summaryEventSeq && joinProductId === summaryProductId && joinEventSeq === summaryEventSeq;
      });
      return matches.length === 1 ? matches[0] : null;
    }

    function applyLightParticipantSummary(summary = {}) {
      const join = findJoinForParticipantSummary(summary);
      if (!join) return null;
      join.participantSummary = { ...(join.participantSummary || {}), ...summary };
      if (join.isBuilderApplicationJoin || join.scheduleId || join.sourceApplicationId) {
        const capacity = getJoinRecruitmentCapacity({ ...join, capacity: summary.capacity || join.capacity }, BUILDER_APPLICATION_MAX_CAPACITY);
        const previewLimit = Math.min(MAX_DETAIL_PARTICIPANT_PREVIEWS, capacity);
        // participant_summary is authoritative for public preview rows. Keep materialized
        // creator/member rows, but discard previews from the previous summary before merging
        // the latest list so a cancelled participant cannot survive as an anonymous icon.
        const existingParticipants = getConfirmedParticipants(join)
          .filter((participant) => !isJoinParticipantPreviewSource(participant));
        const summaryPreviews = (Array.isArray(summary.participantsPreview) ? summary.participantsPreview : []).slice(0, previewLimit);
        const creatorPrefixCount = getLightCreatorPreviewPrefixCount(join, summaryPreviews);
        const previewParticipants = summaryPreviews
          .slice(creatorPrefixCount)
          .map((preview, index) => buildLightPreviewParticipant(preview, join.id || join.scheduleId || "", index + creatorPrefixCount, {
            markFirstAsHost: isJoinMyBuilderApplicationJoin(join) && creatorPrefixCount === 0
          }));
        join.participants = mergeJoinParticipantsByIdentity(existingParticipants, previewParticipants, capacity);
        join.participants = ensureJoinParticipantSummaryCount(join, getConfirmedParticipants(join), summary);
        const confirmedCount = Math.max(0, Math.min(capacity, Number(summary.confirmedCount) || getConfirmedParticipants(join).length));
        join.emptySlots = Number.isFinite(Number(summary.remainingSlots))
          ? Math.max(0, Number(summary.remainingSlots))
          : Math.max(0, capacity - confirmedCount);
        join.maxCapacity = capacity;
        return join;
      }
      return applyLightParticipantsToJoin(join, summary.participantsPreview, summary);
    }

    function applyLightWishTargetKeys(items = [], memberKey = getJoinWishMemberKey()) {
      const rows = (Array.isArray(items) ? items : []).map((item) => ({
        wishType: item.targetType || "product",
        targetType: item.targetType || "product",
        targetKey: item.targetKey || "",
        targetScheduleId: item.targetScheduleId || "",
        targetApplicationId: item.targetApplicationId || "",
        erpProductId: item.erpProductId || item.targetKey || "",
        erpEventSeq: item.erpEventSeq || "",
        status: item.status || "active",
        updatedAt: item.updatedAt || nowKstISOString()
      })).filter((item) => item.targetKey);
      applyJoinWishesFromGoogleSheetRows(rows, memberKey);
      return rows;
    }

    function getHomeBootstrapLightSignature(data = {}) {
      return [
        data.serverTime || data.updatedAt || "",
        (data.newScheduleSummaries || []).length,
        (data.participantSummaries || []).length,
        (data.displayRules || []).length,
        homeGolfJoinProducts ? "products" : "no-products"
      ].join("|");
    }

    function refreshOpenCalendarSheetAfterJoinDataChange() {
      const sheet = document.getElementById("calendarSheet");
      if (!sheet?.classList.contains("open")) return;
      renderCalendarSheet();
    }

    function refreshOpenBuilderCalendarAfterJoinDataChange() {
      const modal = document.getElementById("builderModal");
      if (!modal?.classList.contains("open")) return;
      clearActiveJoinMySchedulesCache();
      renderBuilderCalendar();
    }

    function applyHomeBootstrapLightRows(data = {}, options = {}) {
      const fromCache = options.fromCache === true;
      if (fromCache && homeBootstrapLightAuthoritativeApplied) return data;
      if (!fromCache) homeBootstrapLightAuthoritativeApplied = true;
      pendingHomeBootstrapLightData = data || null;
      pendingHomeBootstrapLightOptions = { fromCache, render: options.render };
      const signature = getHomeBootstrapLightSignature(data || {});
      const newScheduleSummaries = Array.isArray(data.newScheduleSummaries) ? data.newScheduleSummaries : [];
      const hasAuthoritativeScheduleList = options.fromCache !== true && Array.isArray(data.newScheduleSummaries);
      if (!hasAuthoritativeScheduleList && options.fromCache !== true && signature === homeBootstrapLightApplySignature) return data;
      homeBootstrapLightApplySignature = signature;
      if (hasAuthoritativeScheduleList) {
        const authoritativeKeys = newScheduleSummaries.flatMap(getBuilderApplicationIdentityKeys);
        clearBuilderApplicationLocalCache({ authoritativeKeys });
        syncBuilderApplicationJoinsWithAuthoritativeKeys(authoritativeKeys);
      }
      const hasAuthoritativeParticipantSummaryList = options.fromCache !== true && Array.isArray(data.participantSummaries);
      googleSheetBuilderApplicationsLoading = false;
      googleSheetJoinApplicationsLoading = false;
      googleSheetBuilderApplicationsReadCompleted = true;
      if (!hasAuthoritativeParticipantSummaryList || Array.isArray(data.joinApplications)) {
        googleSheetJoinApplicationsReadCompleted = true;
      }
      googleSheetBuilderApplicationsReadFailed = false;
      googleSheetJoinApplicationsReadFailed = false;
      newScheduleSummaries.forEach(upsertLightNewScheduleSummary);
      applyAdminRecommendedScheduleRows(data.displayRules || []);
      (data.participantSummaries || []).forEach(applyLightParticipantSummary);
      reapplyRememberedJoinApplications({ render: false });
      if (options.render !== false) renderJoins();
      refreshOpenDetailAfterJoinParticipantsChange();
      refreshOpenCalendarSheetAfterJoinDataChange();
      refreshOpenBuilderCalendarAfterJoinDataChange();
      refreshDetailWishButtons();
      refreshOpenJoinMyMenu();
      return data;
    }

    function reapplyPendingHomeBootstrapLightData(options = {}) {
      if (!pendingHomeBootstrapLightData) return;
      homeBootstrapLightApplySignature = "";
      applyHomeBootstrapLightRows(pendingHomeBootstrapLightData, {
        ...pendingHomeBootstrapLightOptions,
        ...options
      });
    }

    function isTruthyDisplayRuleValue(value) {
      const text = String(value ?? "").trim().toLowerCase();
      return !["false", "0", "no", "n", "hidden", "disabled", "deleted"].includes(text);
    }

    function findAdminRecommendedProduct(rule = {}) {
      const reference = getSecretTourProductReference({
        id: rule.erpProductId || rule.goodSeq,
        erpProductId: rule.erpProductId || rule.goodSeq,
        erpEventSeq: rule.erpEventSeq || rule.eventSeq
      });
      const inlineProducts = Array.isArray(window.SECRET_GOLF_JOIN_PRODUCTS?.items)
        ? window.SECRET_GOLF_JOIN_PRODUCTS.items.map(normalizeExternalGolfJoinProduct)
        : [];
      const source = [...(externalGolfJoinProducts || inlineProducts), ...joins];
      const sameReference = (item = {}) => {
        const itemReference = getSecretTourProductReference(item);
        return reference.goodSeq
          && reference.eventSeq
          && itemReference.goodSeq === reference.goodSeq
          && itemReference.eventSeq === reference.eventSeq;
      };
      const sameId = (item = {}) => {
        const itemReference = getSecretTourProductReference(item);
        return reference.id && [item.id, item.erpProductId, item.productId, itemReference.id].map(String).includes(String(reference.id));
      };
      return source.find(sameReference)
        || source.find(sameId)
        || source.find((item) => rule.overrideTitle && String(item.title || "") === String(rule.overrideTitle || "") && (!rule.displayStartAt || String(item.departureDate || "") === String(rule.displayStartAt || "")))
        || source.find((item) => rule.overrideTitle && String(item.title || "") === String(rule.overrideTitle || ""))
        || null;
    }

    function normalizeAdminRecommendedScheduleRule(rule = {}) {
      const section = String(rule.section || "").trim() || "available_schedule";
      if (section !== "available_schedule") return null;
      if (!isTruthyDisplayRuleValue(rule.isVisible)) return null;
      const product = findAdminRecommendedProduct(rule);
      const fallback = product || overseasJoinTemplate || joins.find(isOverseasJoin) || joins[0] || {};
      const productReference = getSecretTourProductReference({
        ...(product || {}),
        id: rule.erpProductId || product?.id,
        erpProductId: rule.erpProductId || product?.erpProductId,
        erpEventSeq: rule.erpEventSeq || product?.erpEventSeq
      });
      const departureDate = getFirstISODate(rule.displayStartAt) || product?.departureDate || fallback.departureDate || "";
      const returnDate = getFirstISODate(rule.displayEndAt) || product?.returnDate || product?.departureDate || departureDate;
      const idSeed = rule.recommendedScheduleId || rule.displayRuleId || `${productReference.goodSeq || rule.erpProductId || product?.id || "product"}-${productReference.eventSeq || rule.erpEventSeq || departureDate || "date"}`;
      const scheduleId = `admin-recommended-${String(idSeed).replace(/[^a-z0-9_-]+/gi, "-")}`;
      const recruitmentCapacity = getJoinRecruitmentCapacity({ displayRule: rule, capacity: rule.capacity, maxPeople: rule.maxPeople }, JOIN_MAX_CAPACITY);
      const isMonthlySchedule = String(rule.scheduleType || rule.badgeType || "").toLowerCase() === "monthly" || String(rule.scheduleLabel || "").includes("월례회");
      const title = rule.overrideTitle || product?.title || fallback.title || "추천 조인 일정";
      const ruleCountry = String(rule.country || "").trim();
      const ruleRegion = String(rule.region || "").trim();
      const ruleDepartureAirport = String(rule.departureAirport || "").trim();
      const ruleArrivalAirport = String(rule.arrivalAirport || "").trim();
      const rulePriceText = [rule.productPrice, rule.price]
        .map((value) => String(value ?? "").trim())
        .find(Boolean) || "";
      const rulePrice = Number(rulePriceText.replace(/[^\d.-]/g, ""));
      const hasRulePrice = rulePriceText !== "" && Number.isFinite(rulePrice);
      const category = product?.category || (ruleCountry && ruleCountry !== "한국" ? "해외" : "") || fallback.category || (product?.departureAirport || product?.airport ? "해외" : "국내");
      return {
        ...fallback,
        ...(product || {}),
        id: scheduleId,
        title: escapeBuilderApplicationText(title),
        scheduleId,
        sourceApplicationId: rule.recommendedScheduleId || rule.displayRuleId || "",
        departureDate,
        returnDate,
        date: `${departureDate} - ${returnDate}`,
        country: ruleCountry || product?.country || fallback.country || "",
        region: ruleRegion || product?.region || fallback.region || "",
        category,
        departureAirport: normalizeSecretTourAirportName(ruleDepartureAirport, product?.departureAirport, product?.airport, fallback.departureAirport, fallback.airport),
        arrivalAirport: ruleArrivalAirport || product?.arrivalAirport || fallback.arrivalAirport || "",
        airline: rule.airline || product?.airline || normalizeSecretTourAirlineName(product?.air2Nm, product?.air2CdNm),
        price: hasRulePrice ? rulePrice : (Number(product?.price) || Number(fallback.price) || 0),
        image: rule.overrideImageUrl || product?.image || fallback.image || "",
        badge: rule.badgeType === "pinned" || isTruthyDisplayRuleValue(rule.isPinned) ? "추천일정" : (product?.badge || fallback.badge || "추천일정"),
        badge: isMonthlySchedule ? "월례회" : (rule.badgeType === "pinned" || isTruthyDisplayRuleValue(rule.isPinned) ? "추천일정" : (product?.badge || fallback.badge || "추천일정")),
        scheduleType: rule.scheduleType || (isMonthlySchedule ? "monthly" : ""),
        scheduleLabel: rule.scheduleLabel || (isMonthlySchedule ? "월례회" : ""),
        capacity: recruitmentCapacity,
        maxPeople: recruitmentCapacity,
        badgeKind: product?.badgeKind || "special",
        badgeImage: product?.badgeImage || BADGE_IMAGES.special || fallback.badgeImage || "",
        goodSeq: rule.erpProductId || product?.goodSeq || productReference.goodSeq || "",
        eventSeq: product?.eventSeq || productReference.eventSeq || rule.erpEventSeq || "",
        erpProductId: normalizeJoinCanonicalErpProductId(rule.erpProductId || product?.goodSeq || productReference.goodSeq || product?.erpProductId, product?.erpEventSeq || productReference.eventSeq || rule.erpEventSeq) || "",
        erpEventSeq: normalizeJoinCanonicalErpEventSeq(product?.erpEventSeq || productReference.eventSeq || rule.erpEventSeq),
        packType: rule.packType || product?.packType || fallback.packType || "",
        packTypeName: rule.packTypeName || product?.packTypeName || fallback.packTypeName || "",
        participants: [],
        maxCapacity: JOIN_MAX_CAPACITY,
        emptySlots: JOIN_MAX_CAPACITY,
        maxCapacity: recruitmentCapacity,
        emptySlots: recruitmentCapacity,
        notes: (product?.notes || fallback.notes || []).slice(),
        schedule: product?.schedule?.length ? product.schedule : (fallback.schedule || []),
        displayOrder: Number(rule.displayOrder || 0),
        displayRule: rule,
        isAdminRecommendedSchedule: true
      };
    }

    function applyAdminRecommendedScheduleRows(rows = []) {
      const nextIds = new Set();
      rows.map(normalizeAdminRecommendedScheduleRule).filter(Boolean).forEach((join) => {
        nextIds.add(join.id);
        const currentIndex = joins.findIndex((item) => item.id === join.id);
        if (currentIndex >= 0) joins.splice(currentIndex, 1, join);
        else joins.unshift(join);
      });
      for (let index = joins.length - 1; index >= 0; index -= 1) {
        if (joins[index]?.isAdminRecommendedSchedule && !nextIds.has(joins[index].id)) {
          joins.splice(index, 1);
        }
      }
      joins.sort((a, b) => {
        if (!a.isAdminRecommendedSchedule && !b.isAdminRecommendedSchedule) return 0;
        if (a.isAdminRecommendedSchedule && b.isAdminRecommendedSchedule) return (Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
        return a.isAdminRecommendedSchedule ? -1 : 1;
      });
      return rows;
    }

    async function hydrateAdminRecommendedSchedulesFromGoogleSheet() {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return [];
      try {
        const rows = await fetchGolfJoinSheetRows({
          sheet: "recommended_schedules",
          section: "available_schedule",
          limit: "100"
        }, "Recommended schedules");
        const visibleRows = rows.filter((row) => String(row.section || "") === "available_schedule" && String(row.isVisible || "true").toLowerCase() !== "false");
        applyAdminRecommendedScheduleRows(visibleRows);
        renderJoins();
        refreshOpenCalendarSheetAfterJoinDataChange();
        return visibleRows;
      } catch (error) {
        golfJoinSafeWarn("Failed to load recommended schedules from Google Sheet.", error);
        return [];
      }
    }

    function saveBuilderApplicationPayloadLocally(payload) {
      const existing = readJoinMemberScopedItems(BUILDER_APPLICATIONS_STORAGE_KEY);
      writeJoinMemberScopedItems(BUILDER_APPLICATIONS_STORAGE_KEY, [payload, ...existing].slice(0, 10));
    }

    function hydrateBuilderApplicationJoinsFromLocalCache() {
      try {
        const memberKey = getJoinWishMemberKey();
        if (!memberKey) return;
        const cached = readJoinMemberScopedItems(BUILDER_APPLICATIONS_STORAGE_KEY);
        cached.map(normalizeBuilderApplicationPayload).forEach((payload) => upsertBuilderApplicationJoin(payload, { render: false, source: "local" }));
        readGoogleSheetRowsCache(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY, { memberKey })
          .map(normalizeBuilderApplicationPayload)
          .forEach((payload) => upsertBuilderApplicationJoin(payload, { render: false, source: "sheet" }));
      } catch (error) {
        golfJoinSafeWarn("Failed to load cached builder applications.", error);
      }
    }

    function applyBuilderApplicationsFromGoogleSheetRows(rows = []) {
      const authoritativeKeys = rows.flatMap(getBuilderPayloadIdentityKeys);
      clearBuilderApplicationLocalCache({ authoritativeKeys });
      syncBuilderApplicationJoinsWithAuthoritativeKeys(authoritativeKeys);
      writeGoogleSheetRowsCache(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY, rows, { memberKey: getJoinWishMemberKey() });
      rows.map(normalizeBuilderApplicationPayload).forEach((payload) => upsertBuilderApplicationJoin(payload, { render: false, source: "sheet" }));
      googleSheetBuilderApplicationsReadCompleted = true;
      googleSheetBuilderApplicationsReadFailed = false;
      return rows;
    }

    function applyHomeBootstrapRows(data = {}, options = {}) {
      const newSchedules = Array.isArray(data.newSchedules) ? data.newSchedules : [];
      const joinApplications = Array.isArray(data.joinApplications) ? data.joinApplications : [];
      const reviews = Array.isArray(data.reviews) ? data.reviews : [];
      const wishes = Array.isArray(data.wishes) ? data.wishes : [];
      const displayRules = Array.isArray(data.displayRules) ? data.displayRules : [];
      queueHeroCalendarProfileCount(data.visitorCount ?? data.profileCount);
      queueHeroCalendarActiveCount(data.activeUserCount);
      googleSheetBuilderApplicationsLoading = false;
      googleSheetJoinApplicationsLoading = false;
      googleSheetJoinWishesLoading = false;
      applyBuilderApplicationsFromGoogleSheetRows(newSchedules);
      applyAdminRecommendedScheduleRows(displayRules);
      applyJoinApplicationsFromGoogleSheetRows(joinApplications);
      applyJoinReviewsFromGoogleSheetRows(reviews);
      applyJoinWishesFromGoogleSheetRows(wishes, options.wishMemberKey || "");
      if (Array.isArray(data.warnings) && data.warnings.length) {
        golfJoinSafeWarn("Home bootstrap completed with warnings.", data.warnings);
      }
      renderJoins();
      refreshOpenDetailAfterJoinParticipantsChange();
      refreshOpenCalendarSheetAfterJoinDataChange();
      refreshOpenBuilderCalendarAfterJoinDataChange();
      refreshDetailWishButtons();
      refreshOpenJoinMyMenu();
      return data;
    }

    async function hydrateBuilderApplicationJoinsFromGoogleSheet(options = {}) {
      if (!GOLFJOIN_SHEET_API_ENDPOINT) return [];
      const requestGeneration = ++googleSheetBuilderApplicationsRequestGeneration;
      const requestMember = getJoinCachedCurrentMember();
      const requestMemberKey = getJoinWishMemberKey(requestMember);
      const memberLookupParams = getJoinSheetMemberLookupParams(requestMember);
      const isRequestCurrent = () => (
        requestGeneration === googleSheetBuilderApplicationsRequestGeneration
        && requestMemberKey === getJoinWishMemberKey(getJoinCachedCurrentMember())
      );
      googleSheetBuilderApplicationsLoading = true;
      googleSheetBuilderApplicationsReadFailed = false;
      if (options.renderStart !== false) renderJoins();
      try {
        const hasMemberLookup = Object.values(memberLookupParams).some((value) => String(value || "").trim());
        const [publicRows, memberRows] = await Promise.all([
          fetchGolfJoinSheetRows({
            sheet: "new_schedule_applications",
            source: "new_schedule_builder",
            limit: "100"
          }, "Builder applications"),
          hasMemberLookup ? fetchGolfJoinSheetRows({
            sheet: "new_schedule_applications",
            source: "new_schedule_builder",
            ...memberLookupParams,
            limit: "100"
          }, "Member builder applications").catch((error) => {
            golfJoinSafeWarn("Failed to load member builder applications.", error);
            return [];
          }) : Promise.resolve([])
        ]);
        if (!isRequestCurrent()) return [];
        const rows = [];
        const rowIndexesByKey = new Map();
        const mergeRow = (row) => {
          const keys = getBuilderPayloadIdentityKeys(row);
          const existingIndex = keys.map((key) => rowIndexesByKey.get(key)).find((index) => Number.isInteger(index));
          if (Number.isInteger(existingIndex)) {
            rows[existingIndex] = { ...rows[existingIndex], ...row };
            getBuilderPayloadIdentityKeys(rows[existingIndex]).forEach((key) => rowIndexesByKey.set(key, existingIndex));
            return;
          }
          const nextIndex = rows.length;
          rows.push(row);
          keys.forEach((key) => rowIndexesByKey.set(key, nextIndex));
        };
        publicRows.forEach(mergeRow);
          memberRows.map((row) => ({
            ...row,
            memberLookupMatched: true,
            memberLookupKey: requestMemberKey
          })).forEach(mergeRow);
        const authoritativeKeys = rows.flatMap(getBuilderPayloadIdentityKeys);
        clearBuilderApplicationLocalCache({ authoritativeKeys });
        syncBuilderApplicationJoinsWithAuthoritativeKeys(authoritativeKeys);
        writeGoogleSheetRowsCache(GOOGLE_SHEET_BUILDER_APPLICATIONS_READ_CACHE_KEY, rows, { memberKey: requestMemberKey });
        rows.map(normalizeBuilderApplicationPayload).forEach((payload) => upsertBuilderApplicationJoin(payload, { render: false, source: "sheet" }));
        clearActiveJoinMySchedulesCache();
        googleSheetBuilderApplicationsReadCompleted = true;
        googleSheetBuilderApplicationsReadFailed = false;
        if (options.renderHome !== false) renderJoins();
        refreshOpenBuilderCalendarAfterJoinDataChange();
        return rows;
      } catch (error) {
        if (!isRequestCurrent()) return [];
        googleSheetBuilderApplicationsReadCompleted = true;
        googleSheetBuilderApplicationsReadFailed = true;
        golfJoinSafeWarn("Failed to load builder applications from Google Sheet. Add a doGet endpoint to the Apps Script to enable persisted reads.", error);
        return [];
      } finally {
        if (requestGeneration === googleSheetBuilderApplicationsRequestGeneration) {
          googleSheetBuilderApplicationsLoading = false;
          if (options.renderHome !== false) renderJoins();
        }
      }
    }

    async function submitBuilderApply(options = {}) {
      if (builderApplySubmitting) return false;
      if (!validateBuilderApplyStyleSelection()) return false;
      if (!options.confirmed) {
        const payload = getBuilderApplyValidationPayload();
        if (!validateBuilderApplyPayload(payload, { requireCanonicalKeys: false })) return false;
        openApplySubmitConfirmModal("builder");
        return false;
      }
      builderApplySubmitting = true;
      const next = document.getElementById("builderNextButton");
      const previousText = next?.textContent || "";
      try {
        const result = await runJoinActionLoading(async () => {
          const payload = await getBuilderApplyPayload();
          if (!validateBuilderApplyPayload(payload)) return { ok: false };
          try {
            await saveBuilderApplyToGoogleSheet(payload);
          } catch (error) {
            const confirmed = await confirmBuilderApplySavedToGoogleSheet(payload);
            if (!confirmed) throw error;
            golfJoinSafeWarn("Builder apply save response failed, but the row was confirmed in Google Sheet.", error);
          }
          invalidateHomeBootstrapLightCache();
          const join = upsertBuilderApplicationJoin(payload, { persist: true });
          latestBuilderApplicationShareJoin = join;
          return { ok: true, join, payload };
        }, {
          button: next,
          message: "모임을 생성 중이에요."
        });
        if (!result?.ok) return false;
        setBuilderStep(4);
        return true;
      } catch (error) {
        golfJoinSafeError("Failed to save builder apply payload.", error);
        const rawErrorMessage = error?.serverMessage || error?.message || "";
        const detailMessage = rawErrorMessage ? `\n\n오류: ${rawErrorMessage}` : "";
        openBuilderAlert(`신청 정보 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.${detailMessage}`);
        return false;
      } finally {
        builderApplySubmitting = false;
        if (next && builderStep === 3) {
          next.disabled = false;
          next.textContent = previousText || "신청하기";
        }
      }
    }

    function updateBuilderAgreeCollapsedLayout() {
      const body = document.getElementById("builderBody");
      const agreeBox = document.querySelector(".builder-apply-form .apply-agree-box");
      body?.classList.toggle("builder-agree-collapsed", builderStep === 3 && Boolean(agreeBox?.classList.contains("is-collapsed")));
    }

    function ensureApplyAgreeBoxVisible(agreeBox) {
      if (!agreeBox) return;
      requestAnimationFrame(() => {
        const scrollBox = agreeBox.closest(".detail-apply-scroll, .builder-body");
        if (!scrollBox) return;
        const fixedBottom = agreeBox.closest("#builderModal")
          ? document.querySelector("#builderModal .builder-bottom")
          : document.querySelector("#globalApplyOverlay .detail-apply-actions");
        const bottomGuard = (fixedBottom?.getBoundingClientRect().height || 0) + 42;
        const boxRect = agreeBox.getBoundingClientRect();
        const scrollRect = scrollBox.getBoundingClientRect();
        const visibleBottom = scrollRect.bottom - bottomGuard;
        if (boxRect.bottom > visibleBottom) {
          scrollBox.scrollTop += boxRect.bottom - visibleBottom;
        }
      });
    }

    function toggleBuilderApplyAgreeSection(button) {
      const agreeBox = button?.closest(".apply-agree-box");
      agreeBox?.classList.toggle("is-collapsed");
      updateBuilderAgreeCollapsedLayout();
      if (agreeBox?.classList.contains("is-collapsed")) ensureApplyAgreeBoxVisible(agreeBox);
    }

    function getApplyReservationChevronIcon(isOpen = true) {
      return isOpen
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-icon lucide-chevron-up" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon lucide-chevron-down" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
    }

    function syncApplyReservationPartIcon(button) {
      const part = button?.closest(".apply-reservation-part");
      if (!button || !part) return;
      const isOpen = !part.classList.contains("is-collapsed");
      const icon = button.querySelector("svg");
      if (icon) icon.outerHTML = getApplyReservationChevronIcon(isOpen);
    }

    function toggleApplyReservationPart(button) {
      const part = button?.closest(".apply-reservation-part");
      if (!part) return;
      const collapsed = part.classList.toggle("is-collapsed");
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      syncApplyReservationPartIcon(button);
    }

    function toggleBuilderApplyAllAgreements(checked) {
      document.querySelectorAll("#builderApplyAgreementList .builder-apply-agreement").forEach((checkbox) => {
        checkbox.checked = checked;
      });
      const agreeBox = document.querySelector(".builder-apply-form .apply-agree-box");
      if (checked) {
        agreeBox?.classList.add("is-collapsed");
      } else {
        agreeBox?.classList.remove("is-collapsed");
      }
      updateBuilderAgreeCollapsedLayout();
      syncBuilderApplyAgreementState();
      if (checked) ensureApplyAgreeBoxVisible(agreeBox);
    }

    function setApplyCompleteBadge(scopeSelector, completed) {
      const box = document.querySelector(scopeSelector);
      const badge = document.querySelector(`${scopeSelector} .apply-complete-badge`);
      if (badge) badge.hidden = !completed;
      box?.classList.toggle("is-required-complete", Boolean(completed));
    }

    function syncBuilderApplyAgreementState() {
      const all = document.getElementById("builderApplyPrivacy");
      const inputs = Array.from(document.querySelectorAll("#builderApplyAgreementList .builder-apply-agreement"));
      const required = inputs.filter((input) => input.dataset.required === "true");
      const requiredComplete = required.length > 0 && required.every((input) => input.checked);
      if (all) {
        all.checked = inputs.length > 0 && inputs.every((input) => input.checked);
        all.indeterminate = !all.checked && inputs.some((input) => input.checked);
      }
      setApplyCompleteBadge(".builder-apply-form .apply-agree-box", requiredComplete);
    }

    function resetBuilderApplyForm() {
      document.querySelectorAll(".builder-apply-form input").forEach((input) => {
        if (input.type === "checkbox" || input.type === "radio") {
          input.checked = false;
        } else if (input.id === "builderApplyPeople") {
          input.value = "1";
        } else {
          input.value = "";
        }
      });
      const greeting = document.getElementById("builderApplyGreeting");
      if (greeting) greeting.value = "잘 부탁드립니다.";
      document.querySelectorAll(".builder-apply-form .apply-chip.active, .builder-apply-form .profession-chip.active").forEach((item) => item.classList.remove("active"));
      document.querySelector('[data-chip-group="builder-gender"] .apply-chip[data-value="남성"]')?.classList.add("active");
      const builderPeopleMode = document.querySelector(".builder-apply-form [data-builder-apply-single]");
      builderPeopleMode?.classList.remove("is-group");
      builderPeopleMode?.querySelectorAll(".apply-people-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.joinMode !== "group");
      });
      document.querySelector('[data-chip-group="builder-room-type"]')?.classList.remove("is-group");
      document.querySelector('[data-chip-group="builder-flight-request"]')?.classList.remove("is-group");
      document.querySelectorAll('[data-chip-group="builder-room-type"] .apply-people-button').forEach((button) => {
        button.classList.toggle("active", button.dataset.value === "2인1실");
      });
      document.querySelectorAll('[data-chip-group="builder-flight-request"] .apply-people-button').forEach((button) => {
        button.classList.toggle("active", button.dataset.value === "대행요청");
      });
      document.getElementById("builderApplyPeopleAccordion")?.classList.remove("open");
      setCompanionPeople("builder", 1, { update: false });
      document.querySelectorAll(".builder-apply-form .traveler-field").forEach((field) => field.classList.remove("is-filled"));
      document.querySelector(".builder-apply-form .apply-agree-box")?.classList.remove("is-collapsed");
      document.querySelectorAll(".builder-apply-form .apply-reservation-part-button").forEach(syncApplyReservationPartIcon);
      updateBuilderAgreeCollapsedLayout();
      updateBuilderApplySummary();
      syncBuilderApplyAgreementState();
    }

    async function applyJoinMemberProfileToBuilderForm() {
      const memberProfile = await getJoinApplyMemberProfile();
      if (memberProfile.travelStyles) {
        const styles = new Set(splitJoinMemberProfileStyles(memberProfile.travelStyles));
        document.querySelectorAll('[data-chip-group="builder-style"] .apply-chip').forEach((chip) => {
          chip.classList.toggle("active", styles.has(chip.dataset.value || chip.textContent.trim()));
        });
      }
      updateBuilderApplySummary();
    }

    function openBuilderAlert(message = "도착일을 선택해주세요.", options = {}) {
      builderAlertOpenedAt = Date.now();
      builderAlertConfirmHandler = typeof options.onConfirm === "function" ? options.onConfirm : null;
      const overlay = portalOverlayToBody("builderAlertModal");
      if (overlay && overlay.parentElement === document.body) document.body.appendChild(overlay);
      const messageTarget = document.getElementById("builderAlertMessage");
      if (messageTarget) messageTarget.textContent = message;
      overlay?.style.setProperty("z-index", "2147483647", "important");
      overlay?.querySelector(".builder-alert-modal")?.style.setProperty("z-index", "1", "important");
      overlay?.classList.add("open");
      overlay?.setAttribute("aria-hidden", "false");
      setWidgetModalOpen(true);
    }

    function closeBuilderAlert() {
      const overlay = document.getElementById("builderAlertModal");
      resetModalRuntimeState(overlay);
      overlay?.classList.remove("open");
      overlay?.setAttribute("aria-hidden", "true");
      builderAlertOpenedAt = 0;
      builderAlertConfirmHandler = null;
      setWidgetModalOpen(hasOpenBlockingModal());
    }

    function confirmBuilderAlert() {
      const onConfirm = builderAlertConfirmHandler;
      closeBuilderAlert();
      if (typeof onConfirm === "function") onConfirm();
    }

    function handleBuilderAlertBackdropClick(event) {
      if (event?.target?.id !== "builderAlertModal") return;
      if (builderAlertOpenedAt && Date.now() - builderAlertOpenedAt < 450) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      closeBuilderAlert();
    }

    function openApplySubmitConfirmModal(type = "apply") {
      pendingApplySubmitConfirmType = type;
      applySubmitConfirmOpenedAt = Date.now();
      const isBuilder = type === "builder";
      const overlay = portalOverlayToBody("applySubmitConfirmModal");
      if (overlay && overlay.parentElement === document.body) document.body.appendChild(overlay);
      const title = document.getElementById("applySubmitConfirmTitle");
      const message = document.getElementById("applySubmitConfirmMessage");
      const button = document.getElementById("applySubmitConfirmButton");
      if (title) title.textContent = isBuilder ? "새 모임을 만들까요?" : "참여 신청할까요?";
      if (message) {
        message.textContent = isBuilder
          ? "선택한 상품과 입력한 정보로 새 모임을 등록합니다."
          : "입력한 정보로 모임 참여를 신청합니다.";
      }
      if (button) button.textContent = isBuilder ? "모임 만들기" : "신청하기";
      overlay?.style.setProperty("z-index", "2147483647", "important");
      overlay?.querySelector(".apply-submit-confirm-modal")?.style.setProperty("z-index", "1", "important");
      overlay?.setAttribute("aria-hidden", "false");
      setWidgetModalOpen(true);
      if (!overlay) return;
      overlay.classList.remove("open");
      if (applySubmitConfirmOpenFrame) {
        window.cancelAnimationFrame(applySubmitConfirmOpenFrame);
      }
      void overlay.offsetHeight;
      applySubmitConfirmOpenFrame = window.requestAnimationFrame(() => {
        applySubmitConfirmOpenFrame = 0;
        overlay.classList.add("open");
      });
    }

    function closeApplySubmitConfirmModal() {
      const overlay = document.getElementById("applySubmitConfirmModal");
      if (applySubmitConfirmOpenFrame) {
        window.cancelAnimationFrame(applySubmitConfirmOpenFrame);
        applySubmitConfirmOpenFrame = 0;
      }
      resetModalRuntimeState(overlay);
      overlay?.classList.remove("open");
      overlay?.setAttribute("aria-hidden", "true");
      pendingApplySubmitConfirmType = "";
      applySubmitConfirmOpenedAt = 0;
      setWidgetModalOpen(hasOpenBlockingModal());
    }

    function handleApplySubmitConfirmBackdropClick(event) {
      if (event?.target?.id !== "applySubmitConfirmModal") return;
      if (applySubmitConfirmOpenedAt && Date.now() - applySubmitConfirmOpenedAt < 450) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      closeApplySubmitConfirmModal();
    }

    function handleGlobalApplySubmitError(error) {
      golfJoinSafeError("Failed to prepare join apply submit.", error);
      showGlobalApplyRequiredMessage("신청 정보를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }

    function handleGlobalApplySubmitButtonActivation(event) {
      const button = event.target?.closest?.("#globalApplySubmitButton");
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void submitGlobalApply().catch(handleGlobalApplySubmitError);
    }

    async function confirmApplySubmitModal() {
      if (applySubmitConfirmOpenedAt && Date.now() - applySubmitConfirmOpenedAt < 450) return;
      const type = pendingApplySubmitConfirmType;
      closeApplySubmitConfirmModal();
      if (type === "builder") {
        await submitBuilderApply({ confirmed: true });
        return;
      }
      await submitGlobalApply({ confirmed: true }).catch(handleGlobalApplySubmitError);
    }

    async function nextBuilderStep() {
      if (builderStep >= 4) {
        closeModal("builderModal");
        return;
      }
      if (Date.now() < suppressBuilderNextUntil) return;
      if (builderStep === 3) {
        await submitBuilderApply();
        return;
      }
      if (builderStep === 1) {
        if (!Number.isFinite(builderState.startDay)) {
          openBuilderAlert("출발일을 선택해주세요.");
          return;
        }
        if (!Number.isFinite(builderState.endDay)) {
          openBuilderAlert("도착일을 선택해주세요.");
          return;
        }
      }
      if (builderStep === 1 && builderState.mdPickMode && Number.isFinite(builderState.startDay) && Number.isFinite(builderState.endDay)) {
        syncBuilderFixedProductFromSelectedDates();
        setBuilderStep(3);
        return;
      }
      setBuilderStep(builderStep + 1);
    }
    window.nextBuilderStep = nextBuilderStep;

    function prevBuilderStep() {
      if (builderStep <= 1) return;
      if (builderStep === 3 && builderState.mdPickMode) {
        setBuilderStep(1);
        return;
      }
      setBuilderStep(builderStep - 1);
    }

    function resetBuilderModal() {
      builderStep = 1;
      activeBuilderPopoverTarget = "start";
      activeBuilderPopoverDay = null;
      activeBuilderPopoverFlexOpen = false;
      builderPopoverFlexSnapshot = null;
      Object.assign(builderState, {
        ...getBuilderInitialMonthState(),
        startDay: null,
        endDay: null,
        startBefore: 0,
        startAfter: 0,
        endBefore: 0,
        endAfter: 0,
        dateSelectionComplete: false,
        regionSelectionComplete: false,
        region: "",
        regions: [],
        dateConstraintRegions: [],
        productId: "",
        productName: "",
        productFamilyId: "",
        fixedProductGroupKey: "",
        fixedProductGoodSeq: "",
        mdPickMode: false,
        mdPickDateChangeMode: false,
        mdPickRecruitDirectMode: false
      });
      resetBuilderApplyForm();
      applyJoinMemberProfileToBuilderForm();
      builderRegionSelectorMode = true;
      closeBuilderDatePopover(true);
      closeBuilderFlexSheet();
      closeBuilderProductDetail();
      document.getElementById("builderModal")?.classList.remove("mdpick-builder-mode", "mdpick-date-change-mode", "mdpick-recruit-direct-mode");
      renderBuilderCalendar();
      ensureExternalGolfJoinProductsLoaded();
      updateBuilderRegionDisplay();
      clearBuilderRegionSearchInput();
      setBuilderStep(1);
    }

    function openBuilderFlexSheet(target) {
      closeBuilderDatePopover(true);
      closeBuilderActiveScheduleSheet();
      activeBuilderFlexTarget = target;
      const sheet = document.getElementById("builderFlexSheet");
      const isStart = target === "start";
      const selectedDate = new Date(builderState.viewYear, builderState.viewMonth, isStart ? builderState.startDay : builderState.endDay);
      document.getElementById("builderFlexTitle").textContent = isStart ? "출발일 선택" : "도착일 선택";
      document.getElementById("builderFlexDate").textContent = `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`;
      document.getElementById("builderBeforeFlex").textContent = formatBuilderFlexDayCount(isStart ? builderState.startBefore : builderState.endBefore);
      document.getElementById("builderAfterFlex").textContent = formatBuilderFlexDayCount(isStart ? builderState.startAfter : builderState.endAfter);
      sheet?.classList.add("open");
    }

    function closeBuilderFlexSheet() {
      document.getElementById("builderFlexSheet")?.classList.remove("open");
    }

    function getBuilderActiveScheduleForDate(date) {
      const time = getDateOnlyTime(getISODateKey(date));
      if (!Number.isFinite(time)) return null;
      return getActiveJoinMySchedules().find((item) => item.range && time >= item.range.startTime && time <= item.range.endTime) || null;
    }

    function getBuilderActiveScheduleByKey(key = "") {
      return getActiveJoinMySchedules().find((item) => item.key === key) || null;
    }

    function closeBuilderActiveScheduleSheet() {
      const sheet = document.getElementById("builderActiveScheduleSheet");
      sheet?.classList.remove("open");
      sheet?.setAttribute("aria-hidden", "true");
      const backdrop = document.getElementById("builderActiveScheduleBackdrop");
      backdrop?.classList.remove("open");
      backdrop?.setAttribute("aria-hidden", "true");
    }

    function openBuilderActiveScheduleSheet(scheduleKey = "", iso = "") {
      hideJoinMobileBottomNavForBuilderDateSelection();
      closeBuilderDatePopover(true);
      closeBuilderFlexSheet();
      const schedule = getBuilderActiveScheduleByKey(scheduleKey);
      if (!schedule) return;
      const sheet = document.getElementById("builderActiveScheduleSheet");
      const dateTarget = document.getElementById("builderActiveScheduleDate");
      const list = document.getElementById("builderActiveScheduleList");
      if (dateTarget) dateTarget.textContent = iso ? iso.replace(/-/g, ".") : formatJoinMyDateRange(schedule);
      if (list) {
        const linkedJoin = getJoinMyLinkedJoin(schedule);
        const cardJoin = linkedJoin ? {
          ...linkedJoin,
          title: linkedJoin.title || schedule.title || "참여중인 일정",
          image: linkedJoin.image || schedule.image || "",
          departureDate: linkedJoin.departureDate || schedule.departureDate || "",
          returnDate: linkedJoin.returnDate || schedule.returnDate || schedule.departureDate || "",
          price: linkedJoin.price || Number(String(schedule.price || "").replace(/[^\d.-]/g, "")) || 0,
          currentCount: schedule.currentCount || linkedJoin.currentCount,
          targetCount: schedule.targetCount || linkedJoin.targetCount
        } : {
          ...schedule,
          id: schedule.joinId || schedule.key,
          title: schedule.title || "참여중인 일정",
          image: schedule.image || "",
          region: schedule.countryRegion || schedule.region || "",
          category: schedule.category || "조인모임",
          price: Number(String(schedule.price || "").replace(/[^\d.-]/g, "")) || 0,
          participants: [],
          emptySlots: Math.max(0, Number(schedule.targetCount || 0) - Number(schedule.currentCount || 0))
        };
        list.innerHTML = renderRegionProductCard(cardJoin, {
          showDetailButton: true,
          onClick: `openBuilderActiveScheduleDetail('${escapeJsString(schedule.key)}')`
        });
      }
      const backdrop = document.getElementById("builderActiveScheduleBackdrop");
      backdrop?.classList.add("open");
      backdrop?.setAttribute("aria-hidden", "false");
      sheet?.setAttribute("aria-hidden", "false");
      sheet?.classList.add("open");
    }

    function openBuilderActiveScheduleDetail(scheduleKey = "") {
      const schedule = getBuilderActiveScheduleByKey(scheduleKey);
      if (!schedule?.joinId) return;
      closeBuilderActiveScheduleSheet();
      openDetail(schedule.joinId, {
        elevateOverBuilder: true,
        ownActiveSchedule: true,
        allowUnavailable: true
      });
      const detailModal = document.getElementById("detailModal");
      detailModal?.style.setProperty("z-index", "2147483643", "important");
    }

    function changeBuilderFlex(side, delta) {
      const prefix = activeBuilderFlexTarget === "start" ? "start" : "end";
      const key = `${prefix}${side === "before" ? "Before" : "After"}`;
      builderState[key] = Math.max(0, Math.min(7, builderState[key] + delta));
      clampBuilderFlexWindow(key);
      document.getElementById(side === "before" ? "builderBeforeFlex" : "builderAfterFlex").textContent = formatBuilderFlexDayCount(builderState[key]);
      renderBuilderCalendar();
    }

    function selectBuilderChip(button) {
      const group = button.closest("[data-builder-group]");
      if (!group) return;
      group.querySelectorAll(".builder-pill, .builder-option").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
    }

    function openBuilderProductDetail() {
      document.getElementById("builderProductDetail")?.classList.add("open");
    }

    function closeBuilderProductDetail() {
      document.getElementById("builderProductDetail")?.classList.remove("open");
    }

    function findBuilderProductById(productId = "") {
      const targetId = String(productId || "").trim();
      if (!targetId) return null;
      if (currentDetailJoinData?.id === targetId) return currentDetailJoinData;
      return getBuilderProductSource().find((item) => item.id === targetId)
        || (externalGolfJoinProducts || []).find((item) => item.id === targetId)
        || null;
    }

    function getCurrentBuilderLoginParams(builderAction = "") {
      const productId = currentDetailJoinData?.id || currentDetailJoinId || "";
      return {
        builderAction,
        builderProductId: productId,
        productGroupKey: currentMdPickProductGroupKey || (currentDetailJoinData ? getProductGroupKey(currentDetailJoinData) : ""),
        countryKey: currentMdPickCountryKey || ""
      };
    }

    async function continueBuilderAfterLogin(params = {}, options = {}) {
      const builderAction = params.builderAction || "";
      const shouldShowLoading = options.showLoading !== false && !isJoinActionLoadingOpen();
      let loadingToken = null;
      if (shouldShowLoading) {
        loadingToken = openJoinActionLoading(builderAction === "mdpick-detail" ? "상품 정보를 확인하고 있어요" : "신청 정보를 확인하고 있어요");
      }
      try {
        if (builderAction === "mdpick-detail") {
          const productId = params.builderProductId || params.productId;
          const isSameDetailOpen = document.getElementById("detailModal")?.classList.contains("open")
            && currentDetailJoinId === productId;
          if (isSameDetailOpen) return true;
          let product = findBuilderProductById(productId);
          if (!product) {
            try {
              await ensureExternalGolfJoinProductsLoaded();
            } catch (error) {
              golfJoinSafeWarn("Failed to load product while restoring detail after login.", error);
            }
            product = findBuilderProductById(productId);
          }
          if (product) {
            const productGroupKey = params.productGroupKey || getProductGroupKey(product);
            const countryKey = params.countryKey || currentMdPickCountryKey;
            await showMdPickDetailProduct(product, productGroupKey, countryKey);
            return true;
          }
          return false;
        }
        if (builderAction === "mdpick-recruit") {
          const product = findBuilderProductById(params.builderProductId || params.productId);
          const productGroupKey = params.productGroupKey || (product ? getProductGroupKey(product) : currentMdPickProductGroupKey);
          const countryKey = params.countryKey || currentMdPickCountryKey;
          if (product && productGroupKey) {
            if (document.getElementById("detailModal")?.classList.contains("open")) {
              closeModal("detailModal");
            }
            await openMdPickBuilderWithCurrentDate(productGroupKey, countryKey, product, { skipProfileCheck: Boolean(options.skipProfileCheck) });
            return true;
          }
        }
        if (builderAction === "builder-product") {
          const product = findBuilderProductById(params.builderProductId || params.productId);
          if (product) {
            builderState.productId = product.id || "";
            builderState.productName = product.title || "";
            builderState.productFamilyId = getGolfJoinProductFamilyId(product);
            builderState.region = product.region || builderState.region || "";
            builderState.regions = product.region ? [product.region] : builderState.regions;
            builderState.dateConstraintRegions = product.region ? [product.region] : builderState.dateConstraintRegions;
            if (product.departureDate) {
              const date = new Date(`${product.departureDate}T00:00:00`);
              builderState.viewYear = date.getFullYear();
              builderState.viewMonth = date.getMonth();
              builderState.startDay = getBuilderDayOffsetFromISO(product.departureDate, builderState.viewYear, builderState.viewMonth);
              builderState.endDay = getBuilderDayOffsetFromISO(product.returnDate || product.departureDate, builderState.viewYear, builderState.viewMonth);
            }
            if (document.getElementById("detailModal")?.classList.contains("open")) {
              closeModal("detailModal");
            }
            const opened = await openModal("builderModal", { preserveBuilderState: true, skipProfileCheck: Boolean(options.skipProfileCheck) });
            if (opened) {
              renderBuilderCalendar();
              updateBuilderRegionDisplay();
              updateBuilderSummary();
              updateBuilderApplySummary();
              setBuilderStep(3);
              suppressBuilderNextUntil = Date.now() + 500;
            }
            return opened;
          }
        }
        return openModal("builderModal", { skipProfileCheck: Boolean(options.skipProfileCheck) });
      } finally {
        if (loadingToken) await closeJoinActionLoading(loadingToken);
      }
    }

    let detailModalPageScrollState = null;
    let detailModalPageScrollLockState = null;

    function capturePageScrollState() {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return {
        top: window.scrollY || scrollingElement?.scrollTop || 0,
        left: window.scrollX || scrollingElement?.scrollLeft || 0
      };
    }

    function restorePageScrollState(state = {}) {
      const scrollingElement = document.scrollingElement || document.documentElement;
      const top = Math.max(0, Number(state.top) || 0);
      const left = Math.max(0, Number(state.left) || 0);
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(left, top);
      if (scrollingElement) {
        scrollingElement.scrollTop = top;
        scrollingElement.scrollLeft = left;
      }
      requestAnimationFrame(() => {
        window.scrollTo(left, top);
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
      });
    }

    function lockDetailModalPageScroll(state = {}) {
      if (detailModalPageScrollLockState || !document.body) return;
      const body = document.body;
      const top = Math.max(0, Number(state.top) || 0);
      const left = Math.max(0, Number(state.left) || 0);
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      const bodyPaddingRight = Number.parseFloat(getComputedStyle(body).paddingRight) || 0;
      const usesFixedBodyLock = Boolean(window.matchMedia?.("(max-width: 640px)")?.matches);
      detailModalPageScrollLockState = {
        usesFixedBodyLock,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight
      };
      if (usesFixedBodyLock) {
        body.style.position = "fixed";
        body.style.top = `-${top}px`;
        body.style.left = `-${left}px`;
        body.style.right = "0";
        body.style.width = "100%";
      }
      if (scrollbarWidth) body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
      body.classList.add("detail-modal-page-scroll-locked");
    }

    function unlockDetailModalPageScroll(state = {}) {
      const lockState = detailModalPageScrollLockState;
      if (!lockState || !document.body) {
        restorePageScrollState(state);
        return;
      }
      const body = document.body;
      body.style.position = lockState.position;
      body.style.top = lockState.top;
      body.style.left = lockState.left;
      body.style.right = lockState.right;
      body.style.width = lockState.width;
      body.style.paddingRight = lockState.paddingRight;
      body.classList.remove("detail-modal-page-scroll-locked");
      detailModalPageScrollLockState = null;
      restorePageScrollState(state);
    }

    async function openModal(id, options = {}) {
      if (id === "builderModal" && !requireJoinLogin("builder")) return false;
      if (id === "builderModal" && !options.skipProfileCheck) {
        const member = await ensureJoinMemberProfileReady("builder");
        if (!member) return false;
      }
      const isOpeningMainPageDetail = id === "detailModal"
        && !document.getElementById("detailModal")?.classList.contains("open")
        && !document.querySelector(
          "#builderModal.open, #joinMyMenuModal.open, #joinMyDrawerOverlay.open, #regionSearchModal.open, #calendarSheet.open, #globalApplyOverlay.open"
        );
      if (isOpeningMainPageDetail) {
        const requestedPageScrollState = options.pageScrollState;
        detailModalPageScrollState = requestedPageScrollState
          ? {
              top: Math.max(0, Number(requestedPageScrollState.top) || 0),
              left: Math.max(0, Number(requestedPageScrollState.left) || 0)
            }
          : capturePageScrollState();
        restorePageScrollState(detailModalPageScrollState);
        lockDetailModalPageScroll(detailModalPageScrollState);
      }
      stopQuickMobileCarousel();
      prepareJoinMobileFullscreenModalViewport();
      const overlay = portalOverlayToBody(id);
      if (id === "detailModal" && overlay) {
        overlay.style.setProperty("z-index", "2147483643", "important");
        overlay.querySelector(".detail-modal")?.style.setProperty("z-index", "2147483644", "important");
      }
      if (id === "builderModal" && overlay) {
        overlay.style.setProperty("z-index", "2147483635", "important");
        overlay.querySelector(".builder-modal")?.style.setProperty("z-index", "2147483636", "important");
      }
      overlay?.classList.add("open");
      if (id === "builderModal" && !options.preserveBuilderState) {
        resetBuilderModal();
      }
      if (id === "detailModal" || id === "builderModal") {
        setWidgetModalOpen(true);
      }
      if (id === "detailModal" && detailModalPageScrollState && !detailModalPageScrollLockState?.usesFixedBodyLock) {
        restorePageScrollState(detailModalPageScrollState);
      }
      return true;
    }
    window.openModal = openModal;

    function elevateBuilderProductDetailModal() {
      const overlay = portalOverlayToBody("detailModal");
      if (!overlay?.classList.contains("builder-product-detail-mode")) return;
      overlay.style.setProperty("z-index", "2147483643", "important");
      overlay.querySelector(".detail-modal")?.style.setProperty("z-index", "2147483644", "important");
    }

    async function openBuilderModalFromMain(trigger) {
      return runJoinActionLoading(
        () => openModal("builderModal"),
        { button: trigger, message: "조인모임 신청을 시작하고 있어요" }
      );
    }

    function resetDetailModalScroll() {
      const overlay = document.getElementById("detailModal");
      const modal = overlay?.querySelector(".detail-modal");
      const body = document.getElementById("detailContent");
      if (overlay) overlay.scrollTop = 0;
      if (modal) modal.scrollTop = 0;
      if (body) body.scrollTop = 0;
      updateDetailAnchorTabs();
    }

    function captureDetailModalScrollState() {
      const overlay = document.getElementById("detailModal");
      const modal = overlay?.querySelector(".detail-modal");
      const body = document.getElementById("detailContent");
      return {
        overlayTop: overlay?.scrollTop || 0,
        overlayLeft: overlay?.scrollLeft || 0,
        modalTop: modal?.scrollTop || 0,
        modalLeft: modal?.scrollLeft || 0,
        bodyTop: body?.scrollTop || 0,
        bodyLeft: body?.scrollLeft || 0
      };
    }

    function restoreDetailModalScrollState(state = {}) {
      const overlay = document.getElementById("detailModal");
      const modal = overlay?.querySelector(".detail-modal");
      const body = document.getElementById("detailContent");
      if (overlay) {
        overlay.scrollTop = Number(state.overlayTop) || 0;
        overlay.scrollLeft = Number(state.overlayLeft) || 0;
      }
      if (modal) {
        modal.scrollTop = Number(state.modalTop) || 0;
        modal.scrollLeft = Number(state.modalLeft) || 0;
      }
      if (body) {
        body.scrollTop = Number(state.bodyTop) || 0;
        body.scrollLeft = Number(state.bodyLeft) || 0;
      }
      updateDetailAnchorTabs();
    }

    function resetModalScrollState(root) {
      if (!root) return;
      root.scrollTop = 0;
      root.scrollLeft = 0;
      root.querySelectorAll("*").forEach((node) => {
        if (node.scrollTop) node.scrollTop = 0;
        if (node.scrollLeft) node.scrollLeft = 0;
      });
    }

    function resetModalInputState(root) {
      if (!root) return;
      root.querySelectorAll("input, textarea, select").forEach((field) => {
        if (field.matches("[data-reset-ignore]")) return;
        if (field.type === "checkbox" || field.type === "radio") {
          field.checked = field.defaultChecked;
          field.indeterminate = false;
          return;
        }
        if (field.tagName === "SELECT") {
          field.selectedIndex = Array.from(field.options).findIndex((option) => option.defaultSelected);
          if (field.selectedIndex < 0) field.selectedIndex = 0;
          return;
        }
        field.value = field.defaultValue || "";
      });
    }

    function resetModalRuntimeState(root) {
      if (!root) return;
      resetModalScrollState(root);
      resetModalInputState(root);
      root.querySelectorAll(".field.has-error, .traveler-field.is-filled").forEach((node) => {
        node.classList.remove("has-error", "is-filled");
      });
      root.querySelectorAll(".apply-error.is-visible, .join-member-email-helper.is-visible").forEach((node) => {
        node.classList.remove("is-visible");
      });
    }

    function closeModal(id) {
      const modal = document.getElementById(id);
      const detailReturnContext = id === "detailModal" ? currentDetailReturnContext : null;
      const detailPageScrollState = id === "detailModal" ? detailModalPageScrollState : null;
      const hadDetailPageScrollLock = id === "detailModal" && Boolean(detailModalPageScrollLockState);
      resetModalRuntimeState(modal);
      modal?.classList.remove("open");
      if ((id === "detailModal" || id === "builderModal") && !document.getElementById("detailModal")?.classList.contains("open") && !document.getElementById("builderModal")?.classList.contains("open") && !document.getElementById("regionSearchModal")?.classList.contains("open")) {
        setWidgetModalOpen(hasOpenBlockingModal());
        if (id === "builderModal") {
          restoreJoinMobileBottomNavAfterNavModalClose();
        }
      }
      if (id === "detailModal") {
        closeDetailApply();
        currentDetailMode = "normal";
        currentDetailJoinData = null;
        currentDetailReturnContext = null;
        document.getElementById("detailModal")?.classList.remove("builder-select-mode", "builder-product-detail-mode", "mdpick-recruit-mode", "my-reservation-view-mode");
        const primary = document.getElementById("detailPrimaryButton");
        if (primary) {
          primary.textContent = "참여하기";
          primary.setAttribute("onclick", "openGlobalApply()");
          primary.setAttribute("aria-label", "참여하기");
        }
        setDetailDefaultContactActions();
        detailModalPageScrollState = null;
        if (hadDetailPageScrollLock) unlockDetailModalPageScroll(detailPageScrollState || {});
      }
      if (id === "builderModal") {
        closeBuilderFlexSheet();
        closeBuilderProductDetail();
        resetBuilderApplyForm();
      }
      if (
        homeRenderDeferredUntilModalClose
        && !isHomeRenderBlockedByModalOrInteraction()
      ) {
        flushDeferredHomeRenderIfReady();
      }
      resumeQuickMobileCarouselIfIdle();
      if (detailReturnContext) {
        restoreJoinMyMenuAfterDetail(detailReturnContext);
      } else if (detailPageScrollState && !hadDetailPageScrollLock) {
        restorePageScrollState(detailPageScrollState);
      }
    }
    window.closeModal = closeModal;

    function openMdPickRegionSearchModal(event) {
      event?.stopPropagation?.();
      openRegionSearchModal("mdpick");
    }

    async function openRegionSearchModal(context = "default", options = {}) {
      const shouldShowLoading = options.showLoading === true;
      const loadingToken = shouldShowLoading ? openJoinActionLoading() : null;
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!golfJoinDestinationSummary) {
          void hydrateHomeBootstrapLightFromHomeCardsJson().then(() => {
            if (!document.getElementById("regionSearchModal")?.classList.contains("open")) return;
            renderRegionSearchResults(document.getElementById("regionSearchInput")?.value || "");
            renderRegionDesktop();
            renderRegionMobile();
            renderRegionQuickbar();
          });
        }
        regionSearchContext = context;
        selectedRegionSearchName = "";
        regionProductSort = "recommended";
        regionProductSortMenuOpen = false;
        document.documentElement.classList.add("join-region-search-modal-open");
        prepareJoinMobileFullscreenModalViewport();
        portalOverlayToBody("regionSearchModal")?.classList.add("open");
        const shell = document.querySelector("#regionSearchModal .region-search-shell");
        shell?.classList.toggle("builder-context", context === "builder");
        shell?.classList.toggle("mdpick-context", context === "mdpick");
        shell?.classList.remove("searching", "has-product-results", "has-region-query", "has-region-selection");
        setRegionSearchPanelMode("");
        if (context === "builder") {
          builderState.regions = builderState.region ? builderState.region.split(",").map((item) => item.trim()).filter(Boolean) : [];
        }
        setWidgetModalOpen(true);
        const input = document.getElementById("regionSearchInput");
        if (input) {
          input.value = "";
          renderRegionSearchResults("");
        }
        updateRegionSearchSelectedText();
        renderRegionDesktop();
        renderRegionMobile();
        if (context === "mdpick") {
          ensureHomeGolfJoinProductsLoaded().then(() => {
            if (regionSearchContext !== "mdpick" || !document.getElementById("regionSearchModal")?.classList.contains("open")) return;
            renderRegionSearchResults(document.getElementById("regionSearchInput")?.value || "");
            renderRegionDesktop();
            renderRegionMobile();
          });
        }
      } finally {
        if (loadingToken) await closeJoinActionLoading(loadingToken);
      }
    }

    async function openMainMobileRegionSearch(trigger) {
      return openRegionSearchModal("default", { showLoading: false });
    }

    function closeRegionSearchModal() {
      const modal = document.getElementById("regionSearchModal");
      resetModalRuntimeState(modal);
      modal.classList.remove("open");
      document.documentElement.classList.remove("join-region-search-modal-open");
      document.querySelector("#regionSearchModal .region-search-shell")?.classList.remove("builder-context", "mdpick-context");
      if (!document.getElementById("travelDateModal")?.classList.contains("open") && !document.getElementById("builderModal")?.classList.contains("open")) {
        setWidgetModalOpen(false);
      }
    }

    function handleRegionSearchBackdrop(event) {
      if (event.target.id === "regionSearchModal") {
        closeRegionSearchModal();
      }
    }

    function getBuilderProductDateBounds() {
      const items = Array.isArray(window.SECRET_GOLF_JOIN_PRODUCTS?.items)
        ? window.SECRET_GOLF_JOIN_PRODUCTS.items
        : (externalGolfJoinProducts || []);
      const dates = items.map((item) => item.departureDate).filter(Boolean).sort();
      return {
        startDate: window.SECRET_GOLF_JOIN_PRODUCTS?.range?.startDate || dates[0] || "",
        endDate: window.SECRET_GOLF_JOIN_PRODUCTS?.range?.endDate || dates[dates.length - 1] || ""
      };
    }

    function getBuilderMinDepartureISO() {
      const today = new Date();
      const minimumAdvanceDays = Number.isFinite(Number(homeGolfJoinMinimumAdvanceDays))
        ? Math.max(0, Number(homeGolfJoinMinimumAdvanceDays))
        : GOLFJOIN_DEFAULT_MINIMUM_ADVANCE_DAYS;
      const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + minimumAdvanceDays);
      return `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-${String(minDate.getDate()).padStart(2, "0")}`;
    }

    function isBuilderDateSelectable(date) {
      const { startDate, endDate } = getBuilderProductDateBounds();
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!Number.isFinite(builderState.startDay) && iso < getBuilderMinDepartureISO()) return false;
      if (builderState.mdPickDateChangeMode) {
        return getBuilderFixedProductGroupProducts().some((product) => product.departureDate === iso);
      }
      if (startDate && iso < startDate) return false;
      if (endDate && iso > endDate) return false;
      if (!isBuilderDateAllowedByConstraint(iso)) return false;
      return true;
    }

    const regionTree = [
      {
        category: "동남아/서남아",
        countries: [
          { name: "라오스", cities: ["비엔티안"] },
          { name: "말레이시아", cities: ["조호바루", "코타키나발루"] },
          { name: "미얀마", cities: ["양곤"] },
          { name: "베트남", cities: ["다낭", "푸꾸옥", "하노이", "호치민"] },
          { name: "브루나이", cities: ["반다르"] },
          { name: "인도네시아", cities: ["발리", "롬복", "자카르타", "바탐"] },
          { name: "태국", cities: ["방콕", "파타야", "후아힌", "치앙마이", "카오야이", "푸켓"] },
          { name: "필리핀", cities: ["마닐라", "세부", "클락"] }
        ]
      },
      {
        category: "일본",
        countries: [
          { name: "일본", cities: ["구마모토", "가고시마", "기타큐슈", "나가사키", "나고야", "미야자키", "오키나와", "아오모리", "후쿠오카", "이바라키", "시즈오카"] }
        ]
      },
      {
        category: "중국/대만",
        countries: [
          { name: "중국", cities: ["계림", "곤명", "남경", "대련", "베이징", "상해", "심천", "청도", "해구", "황산", "연길", "장가계", "위해", "하문", "심양"] },
          { name: "대만", cities: ["가오슝"] }
        ]
      },
      {
        category: "괌/사이판",
        countries: [
          { name: "괌", cities: ["괌"] },
          { name: "사이판", cities: [] }
        ]
      },
      {
        category: "국내",
        countries: [
          { name: "제주", cities: [] }
        ]
      }
    ];
    let activeRegionCategoryIndex = 0;
    let activeRegionCountryIndex = 0;
    let activeMobileRegionCategoryIndex = 0;
    let activeMobileRegionCountryKey = "0:0";
    let activeBuilderRegionCategoryIndex = 0;
    let activeBuilderRegionCountryKey = "0:0";
    let builderRegionSelectorMode = true;
    let regionSearchContext = "default";
    let selectedRegionSearchName = "";
    let regionProductSort = "recommended";
    let regionProductSortMenuOpen = false;
    let regionEmptyRecommendType = "overseas";
    let mdPickRegionCache = {
      sourceRef: null,
      minDepartureIso: "",
      products: [],
      availability: new Map(),
      searchItems: null,
      themeCandidates: null
    };
    let regionRecent = [];

    function getJoinRegionSearchNames(join) {
      const names = new Set([join.region, join.category].filter(Boolean));
      const joinRegionKey = normalizeRegionKeyword(join.region);
      getActiveRegionTree().forEach((category) => {
        (category.countries || []).forEach((country) => {
          const countryKey = normalizeRegionKeyword(country.name);
          if (joinRegionKey && joinRegionKey === countryKey) {
            names.add(category.category);
            names.add(country.name);
          }
          (country.cities || []).forEach((city) => {
            const cityKey = normalizeRegionKeyword(city);
            const label = regionLabel(city, country.name);
            const labelKey = normalizeRegionKeyword(label);
            if (joinRegionKey && (joinRegionKey === cityKey || joinRegionKey === labelKey)) {
              names.add(category.category);
              names.add(country.name);
              names.add(city);
              names.add(label);
            }
          });
        });
      });
      return [...names].filter(Boolean);
    }

    function getRegionSearchItemType(name, fallback = "") {
      const key = normalizeRegionKeyword(name);
      if (key === normalizeRegionKeyword("국내") || key === normalizeRegionKeyword("해외")) return "구분";
      for (const category of getActiveRegionTree()) {
        if (key === normalizeRegionKeyword(category.category)) return "권역";
        for (const country of (category.countries || [])) {
          if (key === normalizeRegionKeyword(country.name)) return category.category;
          for (const city of (country.cities || [])) {
            if (key === normalizeRegionKeyword(city) || key === normalizeRegionKeyword(regionLabel(city, country.name))) {
              return country.name;
            }
          }
        }
      }
      return fallback || "지역";
    }

    function getMainJoinRegionSearchItems() {
      if (regionSearchContext === "mdpick") return getMdPickRegionSearchItems();
      return getRegionBodySearchItems().map(([name, type]) => [name, type]);
    }

    function getRegionBodySearchItems() {
      const builderContext = regionSearchContext === "builder";
      const mdPickContext = regionSearchContext === "mdpick";
      const items = new Map();
      const addItem = (name, type, searchText = "") => {
        const key = normalizeRegionKeyword(name);
        if (!key || items.has(key)) return;
        items.set(key, [name, type || getRegionSearchItemType(name), searchText || name]);
      };

      getRegionDisplayCategories({ builderContext }).forEach(({ item: category }) => {
        if (mdPickContext && !isMdPickCategoryAvailable(category)) return;
        const countries = builderContext
          ? getBuilderAvailableCountries(category)
          : mdPickContext
            ? getMdPickAvailableCountries(category)
            : (category.countries || []).map((country, countryIndex) => ({ country, countryIndex }));

        countries.forEach(({ country }) => {
          const countrySearchText = [category.category, country.name].join(" ");
          addItem(country.name, category.category, countrySearchText);
          const cities = builderContext
            ? getBuilderAvailableCities(country)
            : mdPickContext
              ? getMdPickAvailableCities(country)
              : (country.cities || []);
          cities.forEach((city) => {
            const label = regionLabel(city, country.name);
            addItem(label, country.name, [category.category, country.name, city, label].join(" "));
          });
        });
      });

      return [...items.values()].sort((a, b) => a[0].localeCompare(b[0], "ko"));
    }

    function getMdPickRegionProductSource() {
      const source = getHomeProductSource();
      const minDepartureIso = getBuilderMinDepartureISO();
      if (mdPickRegionCache.sourceRef !== source || mdPickRegionCache.minDepartureIso !== minDepartureIso) {
        mdPickRegionCache = {
          sourceRef: source,
          minDepartureIso,
          products: source.filter((product) => (
            !product.homeReferenceOnly
            && (
              Boolean(product.homeProductSummary && product.availabilityObjectName)
              || (product.departureDate && product.departureDate >= minDepartureIso)
            )
          )),
          availability: new Map(),
          searchItems: null,
          themeCandidates: null
        };
      }
      return mdPickRegionCache.products;
    }

    function mdPickProductMatchesRegion(product, name, options = {}) {
      const tokens = getBuilderRegionAvailabilityTokens(name, options);
      if (!tokens.length) return false;
      return builderProductMatchesTokens(product, tokens);
    }

    function hasMdPickRegionProducts(name, options = {}) {
      const products = getMdPickRegionProductSource();
      const cacheKey = `${options.country ? "country" : "region"}:${normalizeRegionKeyword(name)}`;
      if (!mdPickRegionCache.availability.has(cacheKey)) {
        const result = products.some((product) => mdPickProductMatchesRegion(product, name, options));
        mdPickRegionCache.availability.set(cacheKey, result);
      }
      return mdPickRegionCache.availability.get(cacheKey);
    }

    function getMdPickRegionSearchItems() {
      getMdPickRegionProductSource();
      if (mdPickRegionCache.searchItems) return mdPickRegionCache.searchItems;
      const items = new Map();
      getActiveRegionTree().forEach((category) => {
        if (isDomesticRegionCategory(category)) return;
        (category.countries || []).forEach((country) => {
          if (hasMdPickRegionProducts(country.name, { country: true })) {
            items.set(normalizeRegionKeyword(country.name), [country.name, category.category]);
          }
          (country.cities || []).forEach((city) => {
            const label = regionLabel(city, country.name);
            if (hasMdPickRegionProducts(label)) {
              items.set(normalizeRegionKeyword(label), [label, country.name]);
            }
          });
        });
      });
      getMdPickRegionProductSource().forEach((product) => {
        if (!product.region) return;
        const key = normalizeRegionKeyword(product.region);
        if (!key || items.has(key)) return;
        items.set(key, [product.region, product.category || "지역"]);
      });
      mdPickRegionCache.searchItems = [...items.values()].sort((a, b) => a[0].localeCompare(b[0], "ko"));
      return mdPickRegionCache.searchItems;
    }

    function regionLabel(city, country) {
      return city && city !== country ? `${city}, ${country}` : country;
    }

    function getRegionTreeCountryCategory(countryName = "") {
      const countryKey = normalizeRegionKeyword(countryName);
      if (!countryKey) return "";
      for (const category of (regionTree || [])) {
        if ((category.countries || []).some((country) => normalizeRegionKeyword(country.name) === countryKey)) {
          return category.category || "";
        }
      }
      return "";
    }

    function getErpRegisteredRegionProducts() {
      if (!homeGolfJoinProducts && !homeGolfJoinProductsLoadFailed) {
        void ensureHomeGolfJoinProductsLoaded();
      }
      const products = homeGolfJoinProducts || externalGolfJoinProducts;
      return Array.isArray(products) ? products : [];
    }

    function getDestinationSummaryRegionTree() {
      const countries = Array.isArray(golfJoinDestinationSummary?.countries) ? golfJoinDestinationSummary.countries : [];
      if (!countries.length) return [];
      const categories = new Map();
      countries.forEach((country) => {
        const countryName = String(country.name || "").trim();
        if (!countryName) return;
        const categoryName = getRegionTreeCountryCategory(countryName) || country.category || "기타";
        const categoryKey = normalizeRegionKeyword(categoryName) || "etc";
        if (!categories.has(categoryKey)) {
          categories.set(categoryKey, { category: categoryName, countries: [] });
        }
        categories.get(categoryKey).countries.push({
          name: countryName,
          count: Number(country.count) || 0,
          earliestDepartureDate: country.earliestDepartureDate || "",
          cities: (Array.isArray(country.regions) ? country.regions : [])
            .map((region) => String(region.name || "").trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, "ko"))
        });
      });
      return [...categories.values()].map((category) => ({
        category: category.category,
        countries: category.countries.sort((a, b) => a.name.localeCompare(b.name, "ko"))
      })).sort((a, b) => a.category.localeCompare(b.category, "ko"));
    }

    function getErpRegisteredProductRegionTree() {
      const categories = new Map();
      getErpRegisteredRegionProducts().forEach((product) => {
        const regionName = String(product.region || product.city || product.area || product.location || "").split(",")[0]?.trim() || "";
        const countryName = String(product.country || product.countryName || product.nation || product.productCountry || product.erpCountry || inferDetailCountryName(regionName, product) || "").trim();
        if (!regionName && !countryName) return;
        const categoryName = getRegionTreeCountryCategory(countryName) || product.regionGroup || product.categoryGroup || product.category || "기타";
        const categoryKey = normalizeRegionKeyword(categoryName) || "etc";
        if (!categories.has(categoryKey)) {
          categories.set(categoryKey, {
            category: categoryName,
            countries: new Map()
          });
        }
        const category = categories.get(categoryKey);
        const countryDisplay = countryName || regionName;
        const countryKey = normalizeRegionKeyword(countryDisplay);
        if (!countryKey) return;
        if (!category.countries.has(countryKey)) {
          category.countries.set(countryKey, {
            name: countryDisplay,
            cities: new Set()
          });
        }
        const country = category.countries.get(countryKey);
        if (regionName && normalizeRegionKeyword(regionName) !== normalizeRegionKeyword(countryDisplay)) {
          country.cities.add(regionName);
        }
      });
      return [...categories.values()].map((category) => ({
        category: category.category,
        countries: [...category.countries.values()].map((country) => ({
          name: country.name,
          cities: [...country.cities].sort((a, b) => a.localeCompare(b, "ko"))
        })).sort((a, b) => a.name.localeCompare(b.name, "ko"))
      })).sort((a, b) => a.category.localeCompare(b.category, "ko"));
    }

    function getActiveRegionTree() {
      const summaryTree = getDestinationSummaryRegionTree();
      return summaryTree.length ? summaryTree : getErpRegisteredProductRegionTree();
    }

    function formatRegionDisplayName(name) {
      const parts = String(name || "").split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}(${parts.slice(1).join(", ")})`;
      return parts[0] || "";
    }

    function formatRegionResultName(name) {
      return String(name || "").split(",").map((part) => part.trim()).filter(Boolean)[0] || "";
    }

    function formatRegionDisplayHtml(name) {
      const parts = String(name || "").split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        return `<div>${parts[0]}</div><div class="region-country-muted">(${parts.slice(1).join(", ")})</div>`;
      }
      return `<div>${parts[0] || ""}</div>`;
    }

    function isDomesticRegionCategory(category) {
      return !SHOW_DOMESTIC_JOIN_PRODUCTS && normalizeRegionKeyword(category?.category) === normalizeRegionKeyword("국내");
    }

    function getRegionDisplayCategories({ builderContext = false } = {}) {
      const mdPickContext = regionSearchContext === "mdpick";
      return getActiveRegionTree()
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !isDomesticRegionCategory(item))
        .filter(({ item }) => !builderContext || isBuilderCategoryAvailable(item))
        .filter(({ item }) => !mdPickContext || isMdPickCategoryAvailable(item));
    }

    function isUserCreatedJoinSchedule(join = {}) {
      return Boolean(join.isBuilderApplicationJoin || join.lightSummary || join.sheetApplication || join.sourceApplicationId || join.scheduleId);
    }

    function getUserCreatedRegionHotMap() {
      const map = new Map();
      joins.filter(isUserCreatedJoinSchedule).forEach((join) => {
        const regionName = String(join.region || "").split(",")[0]?.trim() || "";
        const countryName = String(join.country || join.countryName || inferDetailCountryName(regionName, join) || "").trim();
        const labels = [
          countryName,
          regionName,
          regionLabel(regionName, countryName)
        ].filter(Boolean);
        labels.forEach((label) => {
          const key = normalizeRegionKeyword(label);
          if (!key) return;
          if (!map.has(key)) {
            map.set(key, { name: label, count: 0, earliest: "9999-12-31" });
          }
          const item = map.get(key);
          item.count += 1;
          const departureDate = String(join.departureDate || "");
          if (departureDate && departureDate < item.earliest) item.earliest = departureDate;
        });
      });
      return map;
    }

    function hasUserCreatedRegionSchedule(name) {
      return getUserCreatedRegionHotMap().has(normalizeRegionKeyword(name));
    }

    function getRegionScheduledLeafNames() {
      const names = new Set();
      getActiveRegionTree().forEach((category) => {
        if (isDomesticRegionCategory(category)) return;
        (category.countries || []).forEach((country) => {
          const cities = Array.isArray(country.cities) ? country.cities : [];
          if (!cities.length) {
            if (hasUserCreatedRegionSchedule(country.name)) names.add(normalizeRegionKeyword(country.name));
            return;
          }
          cities.forEach((city) => {
            const label = regionLabel(city, country.name);
            if (hasUserCreatedRegionSchedule(label)) names.add(normalizeRegionKeyword(label));
          });
        });
      });
      return names;
    }

    function hasRegisteredRegionLeafSchedule(name) {
      return getRegionScheduledLeafNames().has(normalizeRegionKeyword(name));
    }

    function hasRegisteredRegionSubregionSchedule(country) {
      const cities = Array.isArray(country?.cities) ? country.cities : [];
      return hasUserCreatedRegionSchedule(country?.name) || cities.some((city) => hasRegisteredRegionLeafSchedule(regionLabel(city, country.name)));
    }

    function hasRegisteredRegionSchedule(name) {
      if (regionSearchContext === "mdpick") {
        return hasMdPickRegionProducts(name, { country: !String(name || "").includes(",") });
      }
      return getVisibleCalendarJoinProducts().some((join) => joinMatchesRegionSearch(join, name));
    }

    function regionCountryHotBadgeHtml(country, options = {}) {
      if (options.hideForCountryAll) return "";
      return hasRegisteredRegionSubregionSchedule(country) ? `<span class="region-desktop-hot-badge">HOT</span>` : "";
    }

    function regionLeafHotBadgeHtml(name) {
      return hasRegisteredRegionLeafSchedule(name) ? `<span class="region-desktop-hot-badge">HOT</span>` : "";
    }

    function renderRegionDesktop() {
      const categories = document.getElementById("regionDesktopCategories");
      const countries = document.getElementById("regionDesktopCountries");
      const cities = document.getElementById("regionDesktopCities");
      if (!categories || !countries || !cities) return;
      const builderContext = regionSearchContext === "builder";
      const mdPickContext = regionSearchContext === "mdpick";
      const displayCategories = getRegionDisplayCategories({ builderContext });
      if (!displayCategories.some(({ index }) => index === activeRegionCategoryIndex)) {
        activeRegionCategoryIndex = displayCategories[0]?.index || 0;
        activeRegionCountryIndex = builderContext
          ? getFirstBuilderAvailableCountryIndex(getActiveRegionTree()[activeRegionCategoryIndex])
          : mdPickContext
            ? getFirstMdPickAvailableCountryIndex(getActiveRegionTree()[activeRegionCategoryIndex])
            : 0;
      }
      const activeCategory = displayCategories.find(({ index }) => index === activeRegionCategoryIndex)?.item || displayCategories[0]?.item;
      const activeCountries = builderContext
        ? getBuilderAvailableCountries(activeCategory)
        : mdPickContext
          ? getMdPickAvailableCountries(activeCategory)
        : (activeCategory?.countries || []).map((country, countryIndex) => ({ country, countryIndex }));
      if (builderContext && !activeCountries.some(({ countryIndex }) => countryIndex === activeRegionCountryIndex)) {
        activeRegionCountryIndex = getFirstBuilderAvailableCountryIndex(activeCategory);
      }
      if (mdPickContext && !activeCountries.some(({ countryIndex }) => countryIndex === activeRegionCountryIndex)) {
        activeRegionCountryIndex = getFirstMdPickAvailableCountryIndex(activeCategory);
      }
      const activeCountryItem = activeCountries.find(({ countryIndex }) => countryIndex === activeRegionCountryIndex) || activeCountries[0];
      const activeCountry = activeCountryItem?.country;

      categories.innerHTML = displayCategories.map(({ item, index }) => `
        <button type="button" class="region-desktop-button ${index === activeRegionCategoryIndex ? "active" : ""}" onclick="selectRegionCategory(${index})">
          <div>${item.category}</div>
        </button>
      `).join("");

      countries.innerHTML = `<div class="region-desktop-country-list">${activeCountries.map(({ country: item, countryIndex }) => {
        const hasChildren = Array.isArray(item.cities) && item.cities.length > 0;
        return `
          <button type="button" class="region-desktop-button ${countryIndex === activeRegionCountryIndex ? "active" : ""} ${hasChildren ? "has-children" : ""}" onclick="selectRegionCountry(${countryIndex})">
            <div class="region-desktop-label"><span>${item.name}</span>${regionCountryHotBadgeHtml(item)}</div>
            ${hasChildren ? `
              <svg class="region-desktop-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            ` : ""}
          </button>
        `;
      }).join("")}</div>`;

      const activeCities = builderContext
        ? getBuilderAvailableCities(activeCountry)
        : mdPickContext
          ? getMdPickAvailableCities(activeCountry)
          : (activeCountry?.cities || []);
      const cityButtons = activeCountry && activeCities.length
        ? activeCities.map((city) => {
          const label = regionLabel(city, activeCountry.name);
          return `
          <button type="button" class="region-desktop-city" onclick="selectDesktopRegion('${label.replace(/'/g, "\\'")}')">
            <div class="region-desktop-label"><span>${city}</span>${regionLeafHotBadgeHtml(label)}</div>
          </button>
        `;
        }).join("")
        : (() => {
          if (!activeCountry) return `<div class="region-result-empty">선택 가능한 지역이 없습니다.</div>`;
          return `<button type="button" class="region-desktop-city" onclick="selectDesktopRegion('${activeCountry.name.replace(/'/g, "\\'")}')"><div class="region-desktop-label"><span>${activeCountry.name}</span>${regionLeafHotBadgeHtml(activeCountry.name)}</div></button>`;
        })();
      cities.innerHTML = `<div class="region-desktop-city-list">${cityButtons}</div>`;
      renderRegionRecent();
      renderRegionQuickbar();
      renderRegionSelected();
    }

    function renderRegionMobile() {
      const body = document.querySelector("#regionSearchModal .region-search-body");
      if (!body) return;
      const builderContext = regionSearchContext === "builder";
      const mdPickContext = regionSearchContext === "mdpick";
      const displayCategories = getRegionDisplayCategories({ builderContext })
        .map(({ item, index }) => ({ category: item, categoryIndex: index }));
      body.innerHTML = displayCategories.map(({ category, categoryIndex }) => {
        const countries = builderContext
          ? getBuilderAvailableCountries(category)
          : mdPickContext
            ? getMdPickAvailableCountries(category)
          : (category.countries || []).map((country, countryIndex) => ({ country, countryIndex }));
        const defaultCountryKey = getDefaultMobileRegionCountryKey(categoryIndex);
        const categoryCountryKey = activeMobileRegionCategoryIndex === categoryIndex
          ? (activeMobileRegionCountryKey || defaultCountryKey)
          : defaultCountryKey;
        const rows = [];
        for (let countryIndex = 0; countryIndex < countries.length; countryIndex += 2) {
          const rowCountries = countries.slice(countryIndex, countryIndex + 2);
          const rowCountryHtml = rowCountries.map(({ country, countryIndex: actualIndex }) => {
            const cities = Array.isArray(country.cities) ? country.cities : [];
            const key = `${categoryIndex}:${actualIndex}`;
            const isActive = categoryCountryKey === key && cities.length > 0;
            if (!cities.length) {
              return `<button type="button" class="region-option" data-region="${country.name}" onclick="selectRegionResult('${country.name.replace(/'/g, "\\'")}')"><span>${country.name}</span>${regionLeafHotBadgeHtml(country.name)}</button>`;
            }
            return `
              <button type="button" class="region-subgroup-toggle ${isActive ? "active" : ""}" onclick="toggleMobileRegionCountry(${categoryIndex}, ${actualIndex})">
                <span class="region-subgroup-label"><span>${country.name}</span>${regionCountryHotBadgeHtml(country)}</span>
              </button>
            `;
          }).join("");
          const activeCountryItem = rowCountries.find(({ country, countryIndex: actualIndex }) => {
            const cities = Array.isArray(country.cities) ? country.cities : [];
            return cities.length > 0 && categoryCountryKey === `${categoryIndex}:${actualIndex}`;
          });
          const activeCountry = activeCountryItem?.country;
          const activeCities = builderContext
            ? getBuilderAvailableCities(activeCountry)
            : mdPickContext
              ? getMdPickAvailableCities(activeCountry)
              : (activeCountry && Array.isArray(activeCountry.cities) ? activeCountry.cities : []);
          rows.push(`
            <div class="region-grid-row">
              ${rowCountryHtml}
              ${activeCountry ? `
                <div class="region-subregion-list">
                  <button type="button" class="region-subregion-heading" data-region="${activeCountry.name}" onclick="selectRegionResult('${activeCountry.name.replace(/'/g, "\\'")}')"><span>${activeCountry.name} 전체</span>${regionCountryHotBadgeHtml(activeCountry, { hideForCountryAll: true })}</button>
                  ${activeCities.map((city) => {
                    const label = regionLabel(city, activeCountry.name);
                    return `<button type="button" class="region-subregion" data-region="${label}" onclick="selectRegionResult('${label.replace(/'/g, "\\'")}')"><span>${city}</span>${regionLeafHotBadgeHtml(label)}</button>`;
                  }).join("")}
                </div>
              ` : ""}
            </div>
          `);
        }
        return `
          <details class="region-group ${categoryIndex === 0 ? "featured" : ""}" data-region-category-index="${categoryIndex}" ${categoryIndex === activeMobileRegionCategoryIndex ? "open" : ""}>
            <summary>${category.category}</summary>
            <div class="region-grid-list">${rows.join("")}</div>
          </details>
        `;
      }).join("");
    }

    function getDefaultMobileRegionCountryKey(categoryIndex) {
      const category = getActiveRegionTree()[categoryIndex];
      const firstCountry = category?.countries?.[0];
      if (category?.category === "일본" && Array.isArray(firstCountry?.cities) && firstCountry.cities.length) {
        return `${categoryIndex}:0`;
      }
      return "";
    }

    function toggleMobileRegionCountry(categoryIndex, countryIndex) {
      const nextKey = `${categoryIndex}:${countryIndex}`;
      activeMobileRegionCategoryIndex = categoryIndex;
      activeMobileRegionCountryKey = activeMobileRegionCountryKey === nextKey ? "" : nextKey;
      renderRegionMobile();
    }

    function builderDateToISO(dayOffset) {
      if (!Number.isFinite(dayOffset)) return "";
      const date = new Date(builderState.viewYear, builderState.viewMonth, dayOffset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    const SECRET_TOUR_GOODS_LIST_URL = "/goods/getGoodsList.json";
    const SECRET_TOUR_GOODS_EVENT_LIST_URL = "/goods/getGoodsEventList.json";
    const SECRET_TOUR_FLIGHT_SCHEDULE_URL = "/goods/add/flight_schedule";
    const SECRET_TOUR_PUBLIC_ORIGIN = "https://www.secret-tour.com";
    const SECRET_TOUR_FLIGHT_SCHEDULE_TIMEOUT_MS = 5000;
    const SECRET_TOUR_GOODS_CATEGORY_ROOTS = ["1", "2", "3", "5"];
    const secretTourGoodsDetailCache = new Map();
    const secretTourFlightSchedulePromiseCache = new Map();

    function secretTourImageUrl(path) {
      const value = String(path || "").trim();
      if (!value) return "";
      if (value.startsWith("//")) return `https:${value}`;
      if (/^https?:\/\//i.test(value)) return value;
      return `${SECRET_TOUR_PUBLIC_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
    }

    function secretTourDateToISO(value) {
      const text = String(value || "").replace(/\D/g, "");
      if (text.length !== 8) return "";
      return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
    }

    function addDaysToISO(isoDate, days) {
      if (!isoDate) return "";
      const date = new Date(`${isoDate}T00:00:00`);
      if (Number.isNaN(date.getTime())) return "";
      date.setDate(date.getDate() + Number(days || 0));
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function isSecretTourIndividualAirlineName(value) {
      return /(개별\s*항공|개별\s*발권)/.test(String(value || "").trim());
    }

    function isSecretTourAirlineName(value) {
      const text = String(value || "").trim();
      return isSecretTourIndividualAirlineName(text)
        || /(대한항공|아시아나항공?|제주항공|진에어|티웨이항공?|에어서울|에어부산|이스타항공|에어프레미아|에어로케이|가루다\s*인도네시아(?:항공)?|사천항공|산동항공|베트남항공|비엣젯항공|타이항공|싱가포르항공|캐세이퍼시픽|중화항공|에바항공|중국동방항공|중국남방항공|중국국제항공|상하이항공|말레이시아항공|필리핀항공|세부퍼시픽|스쿠트항공|[가-힣A-Za-z]+항공(?:사)?|Airlines?|항공사)/i.test(text);
    }

    const SECRET_TOUR_DEPARTURE_AIRPORT_NAMES = ["인천", "김포", "부산", "김해", "대구", "청주", "무안", "제주", "양양"];

    function extractSecretTourAirportName(value) {
      const text = String(value || "").trim();
      if (!text) return "";
      return SECRET_TOUR_DEPARTURE_AIRPORT_NAMES.find((airport) => (
        new RegExp(`(^|[^가-힣])${airport}(?:(?:국제)?공항)?(?=$|[^가-힣]|출발)`).test(text)
      )) || "";
    }

    function normalizeSecretTourAirportName(...values) {
      return values.map(extractSecretTourAirportName).find(Boolean) || "";
    }

    function getSecretTourFirstDayScheduleText(value) {
      let schedule = value;
      if (typeof schedule === "string") {
        try {
          schedule = JSON.parse(schedule);
        } catch (_) {
          return schedule.trim();
        }
      }
      if (schedule && !Array.isArray(schedule) && Array.isArray(schedule.schedule)) schedule = schedule.schedule;
      const firstDay = Array.isArray(schedule) ? schedule[0] : schedule;
      if (!firstDay) return "";
      if (typeof firstDay === "string") return firstDay.trim();
      return [
        firstDay.rawText,
        firstDay.content,
        firstDay.text,
        firstDay.description,
        firstDay.route,
        firstDay.departureAirport,
        firstDay.fromCity
      ].filter(Boolean).join(" ").trim();
    }

    function inferSecretTourDepartureAirportFromSchedule(...values) {
      for (const value of values) {
        const text = getSecretTourFirstDayScheduleText(value);
        if (!text) continue;
        const departureMatches = [...text.matchAll(/출발/g)];
        for (const match of departureMatches) {
          const departureIndex = Number(match.index) || 0;
          const before = text.slice(Math.max(0, departureIndex - 80), departureIndex);
          const beforeAirport = SECRET_TOUR_DEPARTURE_AIRPORT_NAMES
            .map((airport) => ({ airport, index: before.lastIndexOf(airport) }))
            .sort((a, b) => b.index - a.index)
            .find((item) => item.index >= 0)?.airport;
          if (beforeAirport) return beforeAirport;
          const after = text.slice(departureIndex + match[0].length, departureIndex + match[0].length + 40);
          const afterAirport = SECRET_TOUR_DEPARTURE_AIRPORT_NAMES
            .map((airport) => ({ airport, index: after.indexOf(airport) }))
            .filter((item) => item.index >= 0)
            .sort((a, b) => a.index - b.index)[0]?.airport;
          if (afterAirport) return afterAirport;
        }
        const firstDayAirport = normalizeSecretTourAirportName(text);
        if (firstDayAirport) return firstDayAirport;
      }
      return "";
    }

    function inferSecretTourDepartureAirportFromTitle(...values) {
      for (const value of values) {
        const text = String(value || "").trim();
        if (!text) continue;
        const leadingTag = /^\s*\[([^\]]+)\]/.exec(text)?.[1] || "";
        const taggedAirport = SECRET_TOUR_DEPARTURE_AIRPORT_NAMES.find((airport) => leadingTag.includes(airport));
        if (taggedAirport) return taggedAirport;
        const departureAirport = SECRET_TOUR_DEPARTURE_AIRPORT_NAMES.find((airport) => new RegExp(`${airport}(?:(?:국제)?공항)?\\s*출발`).test(text));
        if (departureAirport) return departureAirport;
      }
      return "";
    }

    function resolveSecretTourDepartureAirport(product = {}, options = {}) {
      const reference = getSecretTourProductReference(product);
      const sourceProducts = [
        ...(externalGolfJoinProducts || []),
        ...(homeGolfJoinProducts || []),
        ...(Array.isArray(window.SECRET_GOLF_JOIN_PRODUCTS?.items) ? window.SECRET_GOLF_JOIN_PRODUCTS.items : []),
        ...(joins || [])
      ];
      const matchedProduct = sourceProducts.find((item) => {
        if (!item || item === product) return false;
        const itemReference = getSecretTourProductReference(item);
        if (reference.id && (String(item.id || "") === reference.id || itemReference.id === reference.id)) return true;
        if (reference.goodSeq && reference.eventSeq) {
          return itemReference.goodSeq === reference.goodSeq && itemReference.eventSeq === reference.eventSeq;
        }
        return Boolean(reference.goodSeq && itemReference.goodSeq === reference.goodSeq);
      }) || null;
      const productFlightItem = Array.isArray(product.flightScheduleItems) ? product.flightScheduleItems[0] : null;
      const matchedFlightItem = Array.isArray(matchedProduct?.flightScheduleItems) ? matchedProduct.flightScheduleItems[0] : null;
      return inferSecretTourDepartureAirportFromSchedule(
        product.schedule,
        matchedProduct?.schedule,
        options.schedule
      ) || normalizeSecretTourAirportName(
        productFlightItem?.fromCity,
        productFlightItem?.departureAirport,
        typeof productFlightItem === "string" ? productFlightItem : "",
        product.departureAirport,
        product.depAirport,
        product.airport,
        product.airportName,
        matchedFlightItem?.fromCity,
        matchedFlightItem?.departureAirport,
        typeof matchedFlightItem === "string" ? matchedFlightItem : "",
        matchedProduct?.departureAirport,
        matchedProduct?.depAirport,
        matchedProduct?.airport,
        matchedProduct?.airportName,
        options.departureAirport
      ) || inferSecretTourDepartureAirportFromTitle(
        options.title,
        product.title,
        product.productName,
        matchedProduct?.title,
        matchedProduct?.productName
      );
    }

    function normalizeSecretTourAirlineName(...values) {
      return values
        .map((value) => String(value || "").trim())
        .find((value) => isSecretTourAirlineName(value) && !isSecretTourIndividualAirlineName(value)) || "";
    }

    function resolveSecretTourAirline(product = {}, packTypeName = "") {
      const normalizedPackType = String(packTypeName || getDetailProductType(product) || "").trim().toLowerCase();
      if (normalizedPackType === "golf" || normalizedPackType.includes("골프")) return "개별항공";
      const flightItems = Array.isArray(product.flightScheduleItems) ? product.flightScheduleItems : [];
      const flightText = flightItems.map((item) => (
        typeof item === "string" ? item : Object.values(item || {}).join(" ")
      )).join(" ");
      const flightAirline = flightItems
        .map((item) => typeof item === "object" && item ? (item.airline || item.airlineName || item.airlineNm) : "")
        .find(Boolean) || "";
      const titleAirline = getDetailAirlineNameFromCode(getDetailAirlineCodeFromProductTitle(product.title || product.productName || ""));
      return normalizeSecretTourAirlineName(
        flightAirline,
        extractDetailAirlineName(flightText),
        product.airline,
        product.airlineName,
        product.airlineNm,
        product.air2Nm,
        product.air2CdNm,
        titleAirline
      );
    }

    function createSecretTourDebugNote(text, source) {
      const value = String(text || "").trim();
      return value ? { text: value, source } : null;
    }

    function parseSecretTourProductReference(value, eventSeqValue = "") {
      const raw = String(value || "").trim();
      const explicitEventSeq = String(eventSeqValue || "").trim();
      const compositeMatch = /^(?:secret-tour|erp)-(\d+)-(\d+)$/i.exec(raw);
      if (compositeMatch) {
        return {
          id: raw,
          goodSeq: compositeMatch[1],
          eventSeq: compositeMatch[2]
        };
      }
      const goodSeq = /^\d+$/.test(raw) ? raw : "";
      return {
        id: raw,
        goodSeq,
        eventSeq: explicitEventSeq
      };
    }

    function getSecretTourProductReference(product = {}) {
      const parsed = parseSecretTourProductReference(
        product.erpProductId || product.productId || product.id || product.goodSeq,
        product.erpEventSeq || product.eventSeq
      );
      const goodSeq = String(product.goodSeq || parsed.goodSeq || "").trim();
      const eventSeq = String(product.eventSeq || parsed.eventSeq || "").trim();
      const parsedIdIsComposite = /^(?:secret-tour|erp)-\d+-\d+$/i.test(parsed.id);
      return {
        id: goodSeq && eventSeq
          ? (parsedIdIsComposite ? parsed.id : `secret-tour-${goodSeq}-${eventSeq}`)
          : (parsed.id || String(product.id || "").trim()),
        goodSeq,
        eventSeq
      };
    }

    function withSecretTourProductReference(product = {}) {
      const reference = getSecretTourProductReference(product);
      return {
        ...product,
        id: product.id || reference.id,
        goodSeq: product.goodSeq || reference.goodSeq,
        eventSeq: product.eventSeq || reference.eventSeq,
        erpProductId: reference.goodSeq || normalizeJoinCanonicalErpProductId(product.erpProductId, reference.eventSeq),
        erpEventSeq: normalizeJoinCanonicalErpEventSeq(product.erpEventSeq || reference.eventSeq)
      };
    }

    function normalizeSecretTourGoodsItem(item, index) {
      const departureDate = secretTourDateToISO(item.minStartDay);
      const dayCnt = Number(item.dayCnt) || 1;
      const price = Number(item.dpPrice) || Number(item.maxPrice) || Number(item.adultPrice) || Number(item.minPrice) || 0;
      const productType = item.productType || item.goodsType || item.goodType || item.goodKind || item.goodDetailCdNm || item.goodDetailName || item.packageType || item.packType || item.tourType || item.airProductYn || item.airYn || item.flightYn || item.includeAirYn || "";

      return {
        id: item.goodSeq ? `secret-tour-${item.goodSeq}` : `secret-tour-product-${index}`,
        goodSeq: item.goodSeq,
        erpProductId: String(item.goodSeq || "").trim(),
        erpEventSeq: "",
        goodTransportSeq: item.goodTransportSeq || item.transportSeq || item.goodAirSeq || item.airSeq || item.flightSeq || "",
        goodCd: item.goodCd || "",
        productType,
        goodsType: item.goodsType || item.goodType || "",
        goodDetailCdNm: item.goodDetailCdNm || item.goodDetailName || "",
        airProductYn: item.airProductYn || item.airYn || item.flightYn || item.includeAirYn || "",
        air2Cd: item.air2Cd || "",
        air2CdNm: item.air2CdNm || "",
        air2Nm: item.air2Nm || item.air2CdNm || "",
        title: item.goodNm || "골프 조인 상품",
        sourceProductTitle: item.goodNm || "골프 조인 상품",
        region: item.tourCity || item.areaCdNm || "",
        category: item.areaCdNm || "해외",
        airport: normalizeSecretTourAirportName(item.departureAirport, item.depAirport, item.airport, item.airportName),
        airline: normalizeSecretTourAirlineName(item.airline, item.airlineName, item.airlineNm, item.air2Nm, item.air2CdNm),
        departureDate,
        returnDate: addDaysToISO(departureDate, Math.max(dayCnt - 1, 0)),
        duration: item.period || String(item.dayNightCnt || "").trim(),
        dayNightCnt: item.period || "",
        generalPrice: price,
        memberPrice: Number(item.minPrice) || 0,
        price,
        image: secretTourImageUrl(item.imagePath),
        includes: [],
        excludes: [],
        notes: [],
        schedule: [],
        emptySlots: 4,
        source: "secret-tour-goods"
      };
    }

    function normalizeSecretTourGoodsEventItem(product, event, index) {
      const departureDate = secretTourDateToISO(event.startDay || event.depStartDay || product.minStartDay);
      const returnDate = secretTourDateToISO(event.endDay || event.arrStartDay);
      const price = Number(event.adultPrice) || Number(event.maxPrice) || Number(product.dpPrice) || Number(product.maxPrice) || Number(event.minPrice) || Number(product.minPrice) || 0;
      const restCnt = Number(event.restCnt);
      const productType = event.productType || event.goodsType || event.goodType || event.goodKind || event.goodDetailCdNm || event.goodDetailName || event.packageType || event.packType || event.tourType || event.airProductYn || event.airYn || event.flightYn || event.includeAirYn || product.productType || product.goodsType || product.goodType || product.goodKind || product.goodDetailCdNm || product.goodDetailName || product.packageType || product.packType || product.tourType || product.airProductYn || product.airYn || product.flightYn || product.includeAirYn || "";

      return {
        id: event.eventSeq ? `secret-tour-${product.goodSeq}-${event.eventSeq}` : `secret-tour-${product.goodSeq}-event-${index}`,
        goodSeq: product.goodSeq,
        eventSeq: event.eventSeq,
        erpProductId: String(product.goodSeq || "").trim(),
        erpEventSeq: String(event.eventSeq || "").trim(),
        goodTransportSeq: event.goodTransportSeq || event.transportSeq || event.goodAirSeq || event.airSeq || event.flightSeq || product.goodTransportSeq || product.transportSeq || product.goodAirSeq || product.airSeq || product.flightSeq || "",
        goodCd: product.goodCd || "",
        productType,
        goodsType: event.goodsType || event.goodType || product.goodsType || product.goodType || "",
        goodDetailCdNm: event.goodDetailCdNm || event.goodDetailName || product.goodDetailCdNm || product.goodDetailName || "",
        airProductYn: event.airProductYn || event.airYn || event.flightYn || event.includeAirYn || product.airProductYn || product.airYn || product.flightYn || product.includeAirYn || "",
        air2Cd: event.air2Cd || product.air2Cd || "",
        air2CdNm: product.air2CdNm || "",
        air2Nm: event.air2Nm || product.air2Nm || product.air2CdNm || "",
        title: event.eventNm || product.goodNm || "Golf join product",
        sourceProductTitle: product.goodNm || event.eventNm || "Golf join product",
        region: product.tourCity || product.areaCdNm || "",
        category: product.areaCdNm || "Overseas",
        airport: normalizeSecretTourAirportName(event.departureAirport, event.depAirport, event.airport, event.airportName, product.airport),
        airline: normalizeSecretTourAirlineName(event.airline, event.airlineName, event.airlineNm, event.air2Nm, product.airline, product.air2Nm, product.air2CdNm),
        departureDate,
        returnDate: returnDate || departureDate,
        duration: event.period || product.period || String(product.dayNightCnt || "").trim(),
        dayNightCnt: event.period || product.period || "",
        generalPrice: price,
        memberPrice: Number(event.minPrice) || Number(product.minPrice) || 0,
        price,
        image: secretTourImageUrl(event.imagePath || product.imagePath),
        includes: [],
        excludes: [],
        notes: [],
        schedule: [],
        emptySlots: Math.min(JOIN_MAX_CAPACITY, Number.isFinite(restCnt) ? restCnt : JOIN_MAX_CAPACITY),
        source: "secret-tour-goods-event"
      };
    }

    function buildSecretTourGoodsListUrl(page, rows, category = {}) {
      const params = new URLSearchParams({
        cate1: category.cate1 || "",
        cate2: category.cate2 || "",
        cate3: "",
        goodDetailCd: "",
        page: String(page),
        rows: String(rows)
      });
      return `${SECRET_TOUR_GOODS_LIST_URL}?${params.toString()}`;
    }

    function buildSecretTourGoodsEventListUrl(goodSeq) {
      const params = new URLSearchParams({ goodSeq: String(goodSeq || "") });
      return `${SECRET_TOUR_GOODS_EVENT_LIST_URL}?${params.toString()}`;
    }

    function buildSecretTourGoodsViewUrl(product) {
      const params = new URLSearchParams({
        goodSeq: String(product?.goodSeq || ""),
        eventSeq: String(product?.eventSeq || "")
      });
      return `/goods/goods_view?${params.toString()}`;
    }

    function buildSecretTourFlightScheduleUrl(product) {
      const params = new URLSearchParams({
        eventSeq: String(product?.eventSeq || ""),
        goodTransportSeq: String(product?.goodTransportSeq || ""),
        startDay: String(product?.startDay || product?.departureDate || "").replace(/\D/g, ""),
        endDay: String(product?.endDay || product?.returnDate || "").replace(/\D/g, "")
      });
      return `${SECRET_TOUR_FLIGHT_SCHEDULE_URL}?${params.toString()}`;
    }

    function cleanSecretTourDetailText(value) {
      return String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^[\s\-]+/, "")
        .trim();
    }

    function isSecretTourMealScheduleText(value) {
      const text = cleanSecretTourDetailText(value);
      return /(\uc2dd\uc0ac|\uc870\uc2dd|\uc911\uc2dd|\uc11d\uc2dd|\uc544\uce68|\uc810\uc2ec|\uc800\ub141)\s*[:\uff1a]?/.test(text)
        || /(\ud638\ud154\uc2dd|\uae30\ub0b4\uc2dd|\ud074\ub7fd\ud558\uc6b0\uc2a4|\ubd88\ud3ec\ud568|\uc790\uc720\uc2dd|\ud604\uc9c0\uc2dd)/.test(text);
    }

    function hasSecretTourLodgingText(value) {
      return /(\uc219\uc18c|\ud638\ud154(?!\uc2dd)|\ub9ac\uc870\ud2b8|\uace8\ud504\ud154|\ucf58\ub3c4|\ube4c\ub77c|hotel|resort)/i.test(cleanSecretTourDetailText(value));
    }

    function normalizeSecretTourScheduleHotel(value) {
      const text = cleanSecretTourDetailText(value);
      if (!text) return "";
      if (isSecretTourMealScheduleText(text) && !hasSecretTourLodgingText(text)) return "";
      return text;
    }

    function getSecretTourDetailList(container) {
      if (!container) return [];
      const nodes = [...container.querySelectorAll("p, li")];
      const values = (nodes.length ? nodes : [container])
        .map((node) => cleanSecretTourDetailText(node.textContent))
        .filter(Boolean);
      return [...new Set(values)];
    }

    function getSecretTourDetailBoxMap(doc) {
      const mobileBoxes = [...doc.querySelectorAll(".detail_box")].map((box) => ({
        title: cleanSecretTourDetailText(box.querySelector(".dbox_title")?.textContent),
        content: box.querySelector(".dbox_content_row")
      }));
      const pcNoteBoxes = [...doc.querySelectorAll(".data_note_item")].map((box) => ({
        title: cleanSecretTourDetailText(box.querySelector(".note_title")?.textContent),
        content: box.querySelector(".data_note_cont, .data_note_content_row")
      }));
      const pcVerticalBoxes = [...doc.querySelectorAll(".getdata_vertical_item")].map((box) => ({
        title: cleanSecretTourDetailText(box.querySelector(".getdata_vertical_title")?.textContent),
        content: box.querySelector(".data_rendar_zone, .data_note_cont, .dbox_content_row")
      }));
      return [...mobileBoxes, ...pcNoteBoxes, ...pcVerticalBoxes].filter((box) => box.title && box.content);
    }

    function findSecretTourDetailBox(boxes, titleParts, fallbackIndex = -1) {
      const matched = boxes.find((box) => titleParts.some((part) => box.title.includes(part)));
      return matched?.content || boxes[fallbackIndex]?.content || null;
    }

    function parseSecretTourMeals(text) {
      const raw = cleanSecretTourDetailText(text);
      if (!raw) return [];
      const labelMap = { "\uc544\uce68": "\uc870\uc2dd", "\uc810\uc2ec": "\uc911\uc2dd", "\uc800\ub141": "\uc11d\uc2dd" };
      const labelPattern = /(\uc870\uc2dd|\uc911\uc2dd|\uc11d\uc2dd|\uc544\uce68|\uc810\uc2ec|\uc800\ub141)\s*[:\uff1a]?\s*([^|]+?)(?=\s*(?:\uc870\uc2dd|\uc911\uc2dd|\uc11d\uc2dd|\uc544\uce68|\uc810\uc2ec|\uc800\ub141|$|\|))/g;
      const matched = [...raw.matchAll(labelPattern)]
        .map((match) => ({
          label: labelMap[match[1]] || match[1],
          menu: cleanSecretTourDetailText(match[2])
        }))
        .filter((meal) => meal.label || meal.menu);
      if (matched.length) return matched;
      return raw
        .split(/\s*\|\s*/)
        .map((part) => {
          const [label, ...rest] = part.split(/\s*[:\uff1a]\s*/);
          const menu = cleanSecretTourDetailText(rest.join(":"));
          return { label: cleanSecretTourDetailText(label), menu };
        })
        .filter((meal) => meal.label || meal.menu);
    }

    function applySecretTourScheduleExtra(extra, label, value) {
      const cleanLabel = cleanSecretTourDetailText(label);
      const cleanValue = cleanSecretTourDetailText(value);
      if (!cleanLabel || !cleanValue) return;
      if ((cleanLabel.includes("\uc219\uc18c") || cleanLabel.includes("\ud638\ud154")) && !extra.hotel) {
        const hotel = normalizeSecretTourScheduleHotel(cleanValue);
        if (hotel) extra.hotel = hotel;
      }
      if (cleanLabel.includes("\uc2dd\uc0ac") || cleanLabel.includes("\uc870\uc2dd") || cleanLabel.includes("\uc911\uc2dd") || cleanLabel.includes("\uc11d\uc2dd")) {
        const meals = parseSecretTourMeals(cleanValue);
        if (meals.length) extra.meals = meals;
      }
    }

    function parseSecretTourScheduleExtra(item) {
      const extra = {};
      item.querySelectorAll(".elsedata_tb tr, .elsedata_item, .schedule_info_row, .timeline_info_row").forEach((row, rowIndex) => {
        const cells = [...row.children].map((cell) => cleanSecretTourDetailText(cell.textContent)).filter(Boolean);
        const label = cleanSecretTourDetailText(row.querySelector(".elsedata_label, .schedule_info_label, .timeline_info_label, th")?.textContent) || cells[0] || "";
        const value = cleanSecretTourDetailText(row.querySelector(".elsedata_value, .schedule_info_value, .timeline_info_value, td")?.textContent) || cells.slice(1).join(" ");
        const hadHotel = Boolean(extra.hotel);
        const hadMeals = Boolean(extra.meals?.length);
        applySecretTourScheduleExtra(extra, label, value);
        if (row.closest(".elsedata_tb")) {
          if (!hadHotel && !extra.hotel && rowIndex === 0 && value) {
            const hotel = normalizeSecretTourScheduleHotel(value);
            if (hotel && hasSecretTourLodgingText(hotel)) extra.hotel = hotel;
          }
          if (!hadMeals && !extra.meals?.length && rowIndex === 1 && value) {
            const meals = parseSecretTourMeals(value);
            if (meals.length) extra.meals = meals;
          }
        }
      });
      item.querySelectorAll(".timeline_elsedata_row, .elsedata_tb, .elsedata, .schedule_info, .timeline_info, .stay_info, .hotel_info, .meal_info").forEach((block) => {
        const text = cleanSecretTourDetailText(block.textContent);
        if (!text) return;
        const hotelMatch = text.match(/(\uc219\uc18c|\ud638\ud154)\s*([:\uff1a]|\s)\s*([^|]+?)(?=\s*(?:\||\uc2dd\uc0ac|\uc870\uc2dd|\uc911\uc2dd|\uc11d\uc2dd|\uc544\uce68|\uc810\uc2ec|\uc800\ub141|$))/);
        if (hotelMatch && !extra.hotel) {
          const hotel = normalizeSecretTourScheduleHotel(hotelMatch[3]);
          const hasExplicitSeparator = Boolean(hotelMatch[2].trim());
          const isStayLabel = hotelMatch[1].includes("\uc219\uc18c");
          if (hotel && (hasExplicitSeparator || isStayLabel || hasSecretTourLodgingText(hotel))) extra.hotel = hotel;
        }
        const mealMatch = text.match(/\uc2dd\uc0ac\s*[:\uff1a]?\s*(.+)$/);
        if (mealMatch) {
          const meals = parseSecretTourMeals(mealMatch[1]);
          if (meals.length) extra.meals = meals;
        } else if (/(\uc870\uc2dd|\uc911\uc2dd|\uc11d\uc2dd|\uc544\uce68|\uc810\uc2ec|\uc800\ub141)/.test(text)) {
          const meals = parseSecretTourMeals(text);
          if (meals.length) extra.meals = meals;
        }
      });
      return extra;
    }

    function formatSecretTourScheduleTitleDate(value) {
      const text = cleanSecretTourDetailText(value);
      const match = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\s*\(([^)]+)\)/.exec(text);
      if (!match) return text;
      return `${Number(match[2])}/${String(Number(match[3])).padStart(2, "0")}(${match[4].trim()})`;
    }

    function isSecretTourExcludedDetailImage(image) {
      return Boolean(
        image.closest(".data_rendar_zone .imgConvert") ||
        image.closest(".data_rendar_zone.imgConvert") ||
        (image.matches("img.imgConvert") && image.closest(".data_rendar_zone"))
      );
    }

    function parseSecretTourSchedule(doc) {
      return [...doc.querySelectorAll(".timeline_item, .timeline_vitem")].map((item, index) => {
        const day = cleanSecretTourDetailText(item.querySelector(".timeline_bar_bullet, .timeline_title_main")?.textContent) || `${index + 1}일차`;
        const dateText = formatSecretTourScheduleTitleDate(item.querySelector(".timeline_title_sub")?.textContent);
        const points = [...item.querySelectorAll(".scheduleBox li")]
          .map((node) => cleanSecretTourDetailText(node.textContent))
          .filter(Boolean);
        const extra = parseSecretTourScheduleExtra(item);
        const rawText = cleanSecretTourDetailText(item.textContent);
        return {
          day,
          dateText,
          content: points.join(", "),
          rawText,
          extra
        };
      }).filter((item) => item.content || item.rawText || item.extra?.hotel || item.extra?.meals?.length);
    }

    function decodeSecretTourJsString(value) {
      return String(value || "")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, "\"")
        .replace(/\\n/g, "\n")
        .replace(/\\\\/g, "\\")
        .trim();
    }

    function parseSecretTourGoodsViewScript(doc) {
      const scriptText = [...doc.scripts]
        .map((script) => script.textContent || "")
        .find((text) => text.includes("const oGoodsView") || text.includes("oGoodsView")) || "";
      if (!scriptText) return {};
      const readString = (key) => {
        const match = new RegExp(`${key}\\s*(?::|=)\\s*(['"])([\\s\\S]*?)\\1`).exec(scriptText);
        return match ? decodeSecretTourJsString(match[2]) : "";
      };
      const readRawValue = (key) => {
        const match = new RegExp(`${key}\\s*(?::|=)\\s*(?:Number\\(\\s*)?['"]?([^'",)\\s}]+)`).exec(scriptText);
        return match ? decodeSecretTourJsString(match[1]) : "";
      };
      const readFirstString = (...keys) => {
        for (const key of keys) {
          const value = readString(key) || readRawValue(key);
          if (value) return value;
        }
        return "";
      };
      const readNumber = (key) => {
        const numberCall = new RegExp(`${key}\\s*(?::|=)\\s*Number\\(\\s*['"]?([0-9]+)`).exec(scriptText);
        if (numberCall) return Number(numberCall[1]);
        const direct = new RegExp(`${key}\\s*(?::|=)\\s*['"]?([0-9]+)`).exec(scriptText);
        return direct ? Number(direct[1]) : 0;
      };
      const adultPrice = readNumber("adultPrice");
      const oilPrice = readNumber("oilPrice");
      const goodsImage = readString("goodsImage");
      return {
        eventNm: readString("eventNm"),
        goodTransportSeq: readFirstString("goodTransportSeq", "transportSeq", "goodAirSeq", "airSeq", "flightSeq"),
        startDay: readString("startDay"),
        endDay: readString("endDay"),
        adultPrice,
        childPrice: readNumber("childPrice"),
        infantPrice: readNumber("infantPrice"),
        oilPrice,
        price: adultPrice + oilPrice,
        sourceUrl: readString("sourceUrl"),
        shortUrl: readString("shortUrl"),
        goodsImage: secretTourImageUrl(goodsImage),
        goodDescription: readString("goodDescription")
      };
    }

    function parseSecretTourFlightDateTime(value = "") {
      const match = String(value || "").match(/(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})(?:\s*\([^)]+\))?\s*([01]?\d|2[0-3])[:.]([0-5]\d)/);
      if (!match) return { date: "", time: "" };
      return {
        date: `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`,
        time: `${String(match[4]).padStart(2, "0")}:${match[5]}`
      };
    }

    function parseSecretTourFlightInfoText(text = "") {
      const source = cleanSecretTourDetailText(String(text || "").replace(/\n/g, " "));
      if (!source) return [];
      const airline = source.match(/항공\s*[:：]\s*([^\[]+?)(?=\s*\[|$)/)?.[1]?.trim() || "";
      const dateTimePattern = "\\d{4}[.\\/-]\\d{1,2}[.\\/-]\\d{1,2}(?:\\s*\\([^)]+\\))?\\s*(?:[01]?\\d|2[0-3])[:.][0-5]\\d";
      const createItem = (label) => {
        const pattern = new RegExp(`\\[${label}정보\\]\\s*(${dateTimePattern})\\s*(${dateTimePattern})\\s*([A-Z0-9]{2}\\s?\\d{3,4})`, "i");
        const match = pattern.exec(source);
        if (!match) return null;
        const departure = parseSecretTourFlightDateTime(match[1]);
        const arrival = parseSecretTourFlightDateTime(match[2]);
        return {
          label,
          airline,
          code: match[3].replace(/\s+/g, "").toUpperCase(),
          fromDate: departure.date,
          fromTime: departure.time,
          toDate: arrival.date,
          toTime: arrival.time,
          rawText: cleanSecretTourDetailText([label, airline, match[1], match[2], match[3]].filter(Boolean).join(" "))
        };
      };
      return [createItem("출발"), createItem("도착")].filter(Boolean);
    }

    function parseSecretTourSummaryFlightItems(doc) {
      const rows = [...doc.querySelectorAll(".detail_summary_tb tr")];
      const scheduleRow = rows.find((row) => cleanSecretTourDetailText(row.querySelector(".detail_summary_label, th")?.textContent).includes("일정"));
      const data = scheduleRow?.querySelector(".detail_summary_data, td");
      const summaryHtml = data?.innerHTML || "";
      const summaryText = summaryHtml
        ? cleanSecretTourDetailText(summaryHtml
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(?:div|p|span|em)>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\n/g, " \n "))
        : "";
      const summaryItems = parseSecretTourFlightInfoText(summaryText);
      if (summaryItems.length) return summaryItems;
      return parseSecretTourFlightInfoText(doc.body?.textContent || "");
    }

    function parseSecretTourGoodsDetailHtml(html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const setData = parseSecretTourGoodsViewScript(doc);
      const detailTitleCopy = cleanSecretTourDetailText(doc.querySelector(".detail_title_copy")?.textContent || "");
      const summaryFlightItems = parseSecretTourSummaryFlightItems(doc);
      const boxes = getSecretTourDetailBoxMap(doc);
      const includes = getSecretTourDetailList(findSecretTourDetailBox(boxes, ["\ud3ec\ud568"], 0));
      const excludes = getSecretTourDetailList(findSecretTourDetailBox(boxes, ["\ubd88\ud3ec\ud568"], 1));
      const notes = getSecretTourDetailList(findSecretTourDetailBox(boxes, ["\ucc38\uace0"], 2))
        .map((item) => createSecretTourDebugNote(item, "goods detail page .detail_box title includes 참고"))
        .filter(Boolean);
      const introBox = findSecretTourDetailBox(boxes, ["\uc0c1\ud488\uc18c\uac1c"], 3);
      const detailImages = [...doc.querySelectorAll(".swiper-slide img")]
        .filter((image) => !isSecretTourExcludedDetailImage(image))
        .map((image) => secretTourImageUrl(image.getAttribute("src")))
        .filter(Boolean);
      const introImages = introBox
        ? [...introBox.querySelectorAll("img")].map((image) => secretTourImageUrl(image.getAttribute("src"))).filter(Boolean)
        : [];
      return {
        ...setData,
        detailTitleCopy,
        includes,
        excludes,
        notes,
        flightScheduleItems: summaryFlightItems,
        schedule: parseSecretTourSchedule(doc),
        slides: [...new Set(detailImages.filter(Boolean))],
        introImages: [...new Set(introImages.filter(Boolean))]
      };
    }

    function parseSecretTourFlightScheduleHtml(html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const rowItems = [...doc.querySelectorAll("tr")].map((row) => {
        return [...row.querySelectorAll("th, td")]
          .map((cell) => cleanSecretTourDetailText(cell.textContent))
          .filter(Boolean)
          .join(" ");
      }).filter(Boolean);
      const listItems = [...doc.querySelectorAll("li, p, div")].map((node) => {
        if (node.children.length) return "";
        return cleanSecretTourDetailText(node.textContent);
      }).filter(Boolean);
      return [...new Set(rowItems.length ? rowItems : listItems)].slice(0, 12);
    }

    function hasCompleteSecretTourFlightScheduleItems(items = []) {
      const list = Array.isArray(items) ? items : [];
      if (list.length < 2) return false;
      return list.slice(0, 2).every((item, index) => {
        const parsed = parseFlightScheduleItem(item, index === 0 ? "출발" : "도착");
        return Boolean(parsed.fromTime && parsed.toTime);
      });
    }

    function getSecretTourGoodsDetailCacheKey(product = {}) {
      const lookupProduct = withSecretTourProductReference(product);
      return lookupProduct.goodSeq && lookupProduct.eventSeq
        ? `${lookupProduct.goodSeq}:${lookupProduct.eventSeq}`
        : "";
    }

    function shouldLoadSecretTourFlightSchedule(product = {}, detail = {}) {
      const candidate = { ...product, ...detail };
      const lookupProduct = withSecretTourProductReference(candidate);
      if (hasCompleteSecretTourFlightScheduleItems(candidate.flightScheduleItems)) return false;
      if (getDetailProductType(candidate) === "골프팩") return false;
      return Boolean(lookupProduct.eventSeq && candidate.goodTransportSeq);
    }

    function prepareSecretTourFlightScheduleState(product = {}, detail = {}) {
      const candidate = { ...product, ...detail };
      if (hasCompleteSecretTourFlightScheduleItems(candidate.flightScheduleItems)) {
        return { ...detail, secretTourFlightScheduleState: "loaded" };
      }
      if (getDetailProductType(candidate) === "골프팩") {
        return { ...detail, secretTourFlightScheduleState: "not_required" };
      }
      return {
        ...detail,
        secretTourFlightScheduleState: shouldLoadSecretTourFlightSchedule(product, detail)
          ? "loading"
          : "unavailable"
      };
    }

    function prepareSecretTourInitialFlightScheduleState(product = {}) {
      const preparedProduct = prepareSecretTourFlightScheduleState(product, product);
      const reference = getSecretTourProductReference(preparedProduct);
      if (
        preparedProduct.secretTourFlightScheduleState === "unavailable"
        && reference.eventSeq
        && getDetailProductType(preparedProduct) !== "골프팩"
      ) {
        return { ...preparedProduct, secretTourFlightScheduleState: "loading" };
      }
      return preparedProduct;
    }

    function loadSecretTourFlightSchedule(product) {
      if (!product?.eventSeq || !product?.goodTransportSeq) return Promise.resolve([]);
      const requestUrl = buildSecretTourFlightScheduleUrl(product);
      if (secretTourFlightSchedulePromiseCache.has(requestUrl)) {
        return secretTourFlightSchedulePromiseCache.get(requestUrl);
      }
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), SECRET_TOUR_FLIGHT_SCHEDULE_TIMEOUT_MS);
      const requestPromise = fetch(requestUrl, {
        method: "GET",
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        cache: "no-store",
        signal: controller.signal
      })
        .then((response) => {
          if (!response.ok) throw new Error(`Secret Tour flight schedule failed: ${response.status}`);
          return response.text();
        })
        .then(parseSecretTourFlightScheduleHtml)
        .catch((error) => {
          secretTourFlightSchedulePromiseCache.delete(requestUrl);
          if (error?.name === "AbortError") {
            const timeoutError = new Error("Secret Tour flight schedule timed out.");
            timeoutError.code = "flight_schedule_timeout";
            throw timeoutError;
          }
          throw error;
        })
        .finally(() => window.clearTimeout(timeoutId));
      secretTourFlightSchedulePromiseCache.set(requestUrl, requestPromise);
      return requestPromise;
    }

    function loadSecretTourGoodsDetail(product) {
      const lookupProduct = withSecretTourProductReference(product);
      if (!lookupProduct.goodSeq || !lookupProduct.eventSeq) return Promise.resolve({});
      const cacheKey = getSecretTourGoodsDetailCacheKey(lookupProduct);
      if (secretTourGoodsDetailCache.has(cacheKey)) {
        return secretTourGoodsDetailCache.get(cacheKey)
          .then((detail) => prepareSecretTourFlightScheduleState(lookupProduct, detail));
      }
      const detailPromise = fetch(buildSecretTourGoodsViewUrl(lookupProduct), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      })
        .then((response) => {
          if (!response.ok) throw new Error(`Secret Tour detail failed: ${response.status}`);
          return response.text();
        })
        .then(parseSecretTourGoodsDetailHtml)
        .then((detail) => prepareSecretTourFlightScheduleState(lookupProduct, detail))
        .catch((error) => {
          secretTourGoodsDetailCache.delete(cacheKey);
          throw error;
        });
      secretTourGoodsDetailCache.set(cacheKey, detailPromise);
      return detailPromise;
    }

    async function loadSecretTourGoodsFlightSchedule(product, detail = {}) {
      const preparedDetail = prepareSecretTourFlightScheduleState(product, detail);
      if (preparedDetail.secretTourFlightScheduleState !== "loading") return preparedDetail;
      let nextDetail;
      try {
        const lookupProduct = withSecretTourProductReference({ ...product, ...preparedDetail });
        const flightScheduleItems = await loadSecretTourFlightSchedule({
          ...lookupProduct,
          ...preparedDetail,
          departureDate: secretTourDateToISO(preparedDetail.startDay) || lookupProduct.departureDate,
          returnDate: secretTourDateToISO(preparedDetail.endDay) || lookupProduct.returnDate
        });
        const resolvedItems = hasCompleteSecretTourFlightScheduleItems(flightScheduleItems)
          ? flightScheduleItems
          : (preparedDetail.flightScheduleItems?.length ? preparedDetail.flightScheduleItems : flightScheduleItems);
        nextDetail = {
          ...preparedDetail,
          flightScheduleItems: resolvedItems,
          secretTourFlightScheduleState: hasCompleteSecretTourFlightScheduleItems(resolvedItems)
            ? "loaded"
            : "unavailable"
        };
      } catch (error) {
        golfJoinSafeWarn(error);
        nextDetail = {
          ...preparedDetail,
          secretTourFlightScheduleState: error?.code === "flight_schedule_timeout" ? "timeout" : "failed"
        };
      }
      const cacheKey = getSecretTourGoodsDetailCacheKey(product);
      if (cacheKey) secretTourGoodsDetailCache.set(cacheKey, Promise.resolve(nextDetail));
      return nextDetail;
    }

    function mergeSecretTourGoodsDetail(product, detail) {
      if (!detail) return product;
      // 로그인 상태의 상세 페이지 가격은 회원가일 수 있으므로
      // 행사 목록에서 확정한 일반가를 상세 정보 병합 후에도 유지한다.
      const generalPrice = Number(product.generalPrice) || Number(product.price) || Number(detail.price) || 0;
      const mergedSchedule = detail.schedule?.length ? detail.schedule : product.schedule;
      const departureAirport = inferSecretTourDepartureAirportFromSchedule(mergedSchedule)
        || normalizeSecretTourAirportName(
          detail.departureAirport,
          detail.depAirport,
          detail.airport,
          product.departureAirport,
          product.airport
        )
        || inferSecretTourDepartureAirportFromTitle(detail.eventNm, product.title);
      return {
        ...product,
        title: detail.eventNm || product.title,
        detailTitleCopy: detail.detailTitleCopy || product.detailTitleCopy || "",
        goodTransportSeq: detail.goodTransportSeq || product.goodTransportSeq,
        departureDate: secretTourDateToISO(detail.startDay) || product.departureDate,
        returnDate: secretTourDateToISO(detail.endDay) || product.returnDate,
        generalPrice,
        price: generalPrice,
        airport: departureAirport || product.airport || "",
        departureAirport: departureAirport || product.departureAirport || product.airport || "",
        image: detail.goodsImage || product.image,
        sourceUrl: detail.sourceUrl || product.sourceUrl,
        shortUrl: detail.shortUrl || product.shortUrl,
        goodDescription: detail.goodDescription || product.goodDescription,
        adultPrice: Number(product.adultPrice) || Number(detail.adultPrice) || 0,
        childPrice: Number(detail.childPrice) || product.childPrice,
        infantPrice: Number(detail.infantPrice) || product.infantPrice,
        oilPrice: Number(detail.oilPrice) || product.oilPrice,
        flightScheduleItems: detail.flightScheduleItems?.length ? detail.flightScheduleItems : product.flightScheduleItems,
        secretTourFlightScheduleState: detail.secretTourFlightScheduleState || product.secretTourFlightScheduleState || "",
        includes: detail.includes?.length ? detail.includes : product.includes,
        excludes: detail.excludes?.length ? detail.excludes : product.excludes,
        notes: dedupeDetailNotes(detail.notes?.length ? [...detail.notes, ...(product.notes || [])] : product.notes),
        schedule: mergedSchedule,
        slides: detail.slides?.length ? detail.slides : product.slides,
        introImages: detail.introImages?.length ? detail.introImages : product.introImages
      };
    }

    function isSameSecretTourDetailProduct(left = {}, right = {}) {
      if (left.id && right.id && left.id === right.id) return true;
      const leftReference = getSecretTourProductReference(left);
      const rightReference = getSecretTourProductReference(right);
      return Boolean(
        leftReference.goodSeq
        && leftReference.eventSeq
        && leftReference.goodSeq === rightReference.goodSeq
        && leftReference.eventSeq === rightReference.eventSeq
      );
    }

    function syncSecretTourFlightScheduleResult(product = {}, target = null) {
      if (target && typeof target === "object") Object.assign(target, product);
      if (Array.isArray(externalGolfJoinProducts)) {
        externalGolfJoinProducts = externalGolfJoinProducts.map((item) => (
          isSameSecretTourDetailProduct(item, product) ? { ...item, ...product } : item
        ));
      }
      if (Array.isArray(homeGolfJoinProducts)) {
        homeGolfJoinProducts = homeGolfJoinProducts.map((item) => (
          isSameSecretTourDetailProduct(item, product) ? { ...item, ...product } : item
        ));
      }
      golfJoinProductAvailabilityCache.forEach((items, goodSeq) => {
        const updatedItems = (Array.isArray(items) ? items : []).map((item) => (
          isSameSecretTourDetailProduct(item, product) ? { ...item, ...product } : item
        ));
        golfJoinProductAvailabilityCache.set(goodSeq, updatedItems);
      });
      const linkedJoin = joins.find((item) => isSameSecretTourDetailProduct(item, product));
      if (linkedJoin && linkedJoin !== target) Object.assign(linkedJoin, product);

      const detailModal = document.getElementById("detailModal");
      if (!detailModal?.classList.contains("open") || !isSameSecretTourDetailProduct(currentDetailJoinData || {}, product)) return;
      currentDetailJoinData = { ...(currentDetailJoinData || {}), ...product };
      const flightCard = detailModal.querySelector("[data-detail-section='flight'] .detail-summary-flight-card");
      if (flightCard) {
        flightCard.dataset.flightState = product.secretTourFlightScheduleState || "";
        flightCard.innerHTML = renderDetailFlightSummary(currentDetailJoinData);
      }
    }

    function enrichSecretTourFlightScheduleInBackground(product, detail = {}, target = null) {
      const preparedDetail = prepareSecretTourFlightScheduleState(product, detail);
      if (preparedDetail.secretTourFlightScheduleState !== "loading") {
        const enrichedProduct = mergeSecretTourGoodsDetail(product, preparedDetail);
        syncSecretTourFlightScheduleResult(enrichedProduct, target);
        return Promise.resolve(enrichedProduct);
      }
      return loadSecretTourGoodsFlightSchedule(product, preparedDetail).then((flightDetail) => {
        const enrichedProduct = mergeSecretTourGoodsDetail(product, flightDetail);
        syncSecretTourFlightScheduleResult(enrichedProduct, target);
        return enrichedProduct;
      });
    }

    async function enrichOpenDetailWithSecretTourData(join, renderOptions = {}, detailPerformanceGeneration = 0) {
      const lookupProduct = withSecretTourProductReference(join);
      if (!lookupProduct.goodSeq || !lookupProduct.eventSeq || join.secretTourDetailLoaded) {
        if (detailPerformanceGeneration) {
          finishGolfJoinDetailPerformance(
            detailPerformanceGeneration,
            "golfjoin:detail:erp-ready",
            "golfjoin:duration:detail-erp"
          );
        }
        return join;
      }
      try {
        const detail = await loadSecretTourGoodsDetail(lookupProduct);
        if (detailPerformanceGeneration) {
          finishGolfJoinDetailPerformance(
            detailPerformanceGeneration,
            "golfjoin:detail:erp-ready",
            "golfjoin:duration:detail-erp"
          );
        }
        const enrichedJoin = mergeSecretTourGoodsDetail(lookupProduct, detail);
        Object.assign(join, enrichedJoin, { secretTourDetailLoaded: true });
        const isSameDetail = currentDetailJoinId === join.id && document.getElementById("detailModal")?.classList.contains("open");
        if (isSameDetail) {
          const currentScrollState = captureDetailModalScrollState();
          currentDetailJoinData = join;
          document.getElementById("detailModalTitle").textContent = join.title;
          renderDetailContent(join, renderOptions);
          requestAnimationFrame(() => {
            prepareDetailScheduleHeights({ forceOpen: true });
            restoreDetailModalScrollState(currentScrollState);
          });
        }
        void enrichSecretTourFlightScheduleInBackground(join, detail, join)
          .then(() => {
            if (detailPerformanceGeneration) {
              finishGolfJoinDetailPerformance(
                detailPerformanceGeneration,
                "golfjoin:detail:flight-ready",
                "golfjoin:duration:detail-flight"
              );
            }
          })
          .catch((error) => {
            if (detailPerformanceGeneration) {
              finishGolfJoinDetailPerformance(
                detailPerformanceGeneration,
                "golfjoin:detail:flight-failed",
                "golfjoin:duration:detail-flight"
              );
            }
            golfJoinSafeWarn("Failed to update open detail flight schedule.", error);
          });
        return join;
      } catch (error) {
        if (detailPerformanceGeneration) {
          finishGolfJoinDetailPerformance(
            detailPerformanceGeneration,
            "golfjoin:detail:erp-failed",
            "golfjoin:duration:detail-erp"
          );
        }
        golfJoinSafeWarn("Failed to enrich Secret Tour detail from ERP.", error);
        return join;
      }
    }


    async function loadSecretTourGoodsEvents(goodSeq) {
      if (!goodSeq) return [];
      const response = await fetch(buildSecretTourGoodsEventListUrl(goodSeq), {
        method: "GET",
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Secret Tour event list failed: ${response.status}`);
      const payload = await response.json();
      return Array.isArray(payload?.list) ? payload.list : [];
    }

    async function mapWithConcurrency(items, limit, mapper) {
      const results = new Array(items.length);
      let cursor = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (cursor < items.length) {
          const index = cursor;
          cursor += 1;
          results[index] = await mapper(items[index], index);
        }
      });
      await Promise.all(workers);
      return results;
    }

    async function loadSecretTourGoodsListForCategory(cate1, rows) {
      const category = { cate1 };
      const firstResponse = await fetch(buildSecretTourGoodsListUrl(1, rows, category), {
        method: "GET",
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        cache: "no-store"
      });
      if (!firstResponse.ok) throw new Error(`Secret Tour product list failed: ${firstResponse.status}`);

      const firstPayload = await firstResponse.json();
      const firstList = Array.isArray(firstPayload?.list) ? firstPayload.list : [];
      const totalCount = Number(firstPayload?.count || firstList[0]?.totalCount || firstList.length) || firstList.length;
      const pageCount = Math.ceil(totalCount / rows);
      const allItems = firstList.slice();

      for (let page = 2; page <= pageCount; page += 1) {
        const response = await fetch(buildSecretTourGoodsListUrl(page, rows, category), {
          method: "GET",
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest" },
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`Secret Tour product list failed: ${response.status}`);
        const payload = await response.json();
        const list = Array.isArray(payload?.list) ? payload.list : [];
        allItems.push(...list);
      }

      return allItems;
    }

    function uniqueSecretTourGoodsItems(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = item.goodSeq || item.goodCd || item.goodNm;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function fetchGolfJoinProductFamilyJson(url, cache = "no-cache") {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), GOLFJOIN_PRODUCT_FAMILY_LOAD_TIMEOUT_MS);
      return fetch(url, { cache, signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Product family data load failed: ${response.status}`);
          return response.json();
        })
        .finally(() => window.clearTimeout(timeout));
    }

    function loadFirstGolfJoinProductFamilyJson(urls = [], validator = () => true) {
      return urls.reduce((promise, url) => promise.catch(() => (
        fetchGolfJoinProductFamilyJson(url).then((payload) => {
          if (!validator(payload)) throw new Error(`Product family payload is invalid: ${url}`);
          return payload;
        })
      )), Promise.reject(new Error("Product family data load not started.")));
    }

    function applyGolfJoinProductFamilyCatalog(manifest = {}, catalog = {}) {
      if (String(catalog.publicationRevision || "") !== String(manifest.activePublicationRevision || "")) {
        throw new Error("Product family manifest and catalog revisions do not match.");
      }
      golfJoinProductFamilyIdByGoodSeq.clear();
      golfJoinProductFamilyById.clear();
      Object.entries(catalog.familyIdByGoodSeq || {}).forEach(([goodSeq, familyId]) => {
        if (/^\d+$/.test(String(goodSeq || "")) && familyId) {
          golfJoinProductFamilyIdByGoodSeq.set(String(goodSeq), String(familyId));
        }
      });
      (catalog.families || []).forEach((family) => {
        const familyId = String(family?.familyId || "").trim();
        if (familyId) golfJoinProductFamilyById.set(familyId, family);
      });
      golfJoinProductFamilyManifest = manifest;
      golfJoinProductFamilyCatalog = catalog;
      mdPickRegionCache = {
        sourceRef: null,
        minDepartureIso: "",
        products: [],
        availability: new Map(),
        searchItems: null,
        themeCandidates: null
      };
      mdPickListCacheSourceSignature = "";
      mdPickListElementCache.clear();
      scheduleMdPickSectionRenderWhenDataReady();
      return catalog;
    }

    function ensureGolfJoinProductFamilyCatalogLoaded() {
      if (!GOLFJOIN_PRODUCT_FAMILY_ENABLED) return Promise.resolve(null);
      if (golfJoinProductFamilyCatalog || golfJoinProductFamilyLoadFailed) {
        return Promise.resolve(golfJoinProductFamilyCatalog);
      }
      if (!golfJoinProductFamilyLoadPromise) {
        const manifestUrls = [
          `https://storage.googleapis.com/golfjoin-bucket/${GOLFJOIN_PRODUCT_FAMILY_MANIFEST_PATH}`,
          GOLFJOIN_PRODUCT_FAMILY_MANIFEST_PATH
        ];
        golfJoinProductFamilyLoadPromise = loadFirstGolfJoinProductFamilyJson(manifestUrls, (payload) => (
          payload?.schema === "golfjoin-product-family-manifest-v1"
          && /^pfc_[a-f0-9]{24}$/.test(String(payload.activePublicationRevision || ""))
          && Boolean(payload.activeCatalogObjectName || payload.activeCatalogUrl)
        )).then((manifest) => {
          const catalogUrls = [...new Set([
            manifest.activeCatalogUrl,
            manifest.activeCatalogObjectName
              ? `https://storage.googleapis.com/golfjoin-bucket/${String(manifest.activeCatalogObjectName).replace(/^\/+/, "")}`
              : ""
          ].filter(Boolean))];
          return loadFirstGolfJoinProductFamilyJson(catalogUrls, (payload) => (
            payload?.schema === "golfjoin-product-family-catalog-v1"
            && String(payload.publicationRevision || "") === String(manifest.activePublicationRevision || "")
            && Array.isArray(payload.families)
          )).then((catalog) => applyGolfJoinProductFamilyCatalog(manifest, catalog));
        }).catch((error) => {
          golfJoinProductFamilyLoadFailed = true;
          golfJoinProductFamilyManifest = null;
          golfJoinProductFamilyCatalog = null;
          golfJoinProductFamilyIdByGoodSeq.clear();
          golfJoinProductFamilyById.clear();
          scheduleMdPickSectionRenderWhenDataReady();
          golfJoinSafeWarn("Product family catalog is unavailable. Individual products will be used.", error);
          return null;
        });
      }
      return golfJoinProductFamilyLoadPromise;
    }

    function loadLocalGolfJoinProductsData() {
      const fullCacheBust = `v=${encodeURIComponent(GOLFJOIN_PRODUCTS_DATA_VERSION)}`;
      const urls = [
        `https://storage.googleapis.com/golfjoin-bucket/web/golfjoin_local_data.json?${fullCacheBust}`,
        `web/golfjoin_local_data.json?${fullCacheBust}`
      ];
      const loadPayload = (url) => fetch(url, { cache: "force-cache" }).then((response) => {
        if (!response.ok) throw new Error(`Local golf join products load failed: ${response.status}`);
        return response.json();
      });
      const loadFallbackPayload = () => urls.reduce((promise, url) => {
        return promise.catch(() => loadPayload(url).then((payload) => {
          if (!Array.isArray(payload?.items) || !payload.items.length) {
            throw new Error(`Golf join products payload is empty: ${url}`);
          }
          return payload;
        }));
      }, Promise.reject(new Error("Golf join products load not started.")));
      return loadGolfJoinHomeSummaryJson().then((payload) => {
        if (!Array.isArray(payload?.items) || !payload.items.length) {
          throw new Error("Golf join products are missing from the home summary.");
        }
        return payload;
      }).catch(() => loadFallbackPayload());
    }

    async function loadSecretTourGoodsProducts() {
      const rows = 100;
      const categoryLists = await mapWithConcurrency(SECRET_TOUR_GOODS_CATEGORY_ROOTS, 3, (cate1) => {
        return loadSecretTourGoodsListForCategory(cate1, rows);
      });
      const allItems = uniqueSecretTourGoodsItems(categoryLists.flat());

      const eventGroups = await mapWithConcurrency(allItems, 4, async (item, itemIndex) => {
        try {
          const events = await loadSecretTourGoodsEvents(item.goodSeq);
          if (!events.length) return [normalizeSecretTourGoodsItem(item, itemIndex)];
          return events.map((event, eventIndex) => normalizeSecretTourGoodsEventItem(item, event, eventIndex));
        } catch (error) {
          golfJoinSafeWarn(error);
          return [normalizeSecretTourGoodsItem(item, itemIndex)];
        }
      });

      return eventGroups.flat();
    }

    function normalizeExternalGolfJoinProduct(item, index) {
      const fallback = item.airport ? overseasJoinTemplate : domesticJoinTemplate;
      const badgeKind = item.badgeKind || "";
      const duration = getExplicitTripDuration(item) || extractDurationFromProductText(item) || getExplicitTripDuration(fallback);
      const productReference = getSecretTourProductReference(item);
      const savedProductMeta = golfJoinProductMetaByGoodSeq.get(String(item.goodSeq || productReference.goodSeq || "").trim()) || {};
      const normalizedRegion = item.region || fallback.region || "";
      const normalizedCountry = item.country || item.countryName || item.nation || item.productCountry || item.erpCountry || inferDetailCountryName(normalizedRegion, item) || "";
      const generalPrice = Number(item.generalPrice) || Number(item.price) || Number(fallback.generalPrice) || Number(fallback.price) || 0;
      const normalizedDepartureAirport = inferSecretTourDepartureAirportFromSchedule(item.schedule, fallback.schedule)
        || normalizeSecretTourAirportName(
          item.departureAirport,
          item.depAirport,
          item.airport,
          item.airportName,
          savedProductMeta.departureAirport,
          fallback.departureAirport,
          fallback.airport
        )
        || inferSecretTourDepartureAirportFromTitle(item.title, item.sourceProductTitle);
      return {
        ...fallback,
        ...item,
        id: item.id || productReference.id || `external-product-${index}`,
        goodSeq: item.goodSeq || productReference.goodSeq,
        eventSeq: item.eventSeq || productReference.eventSeq,
        erpProductId: productReference.goodSeq || normalizeJoinCanonicalErpProductId(item.erpProductId || item.id, productReference.eventSeq),
        erpEventSeq: normalizeJoinCanonicalErpEventSeq(item.erpEventSeq || item.eventSeq || productReference.eventSeq),
        productType: item.productType || item.goodsType || item.goodType || item.goodKind || item.goodDetailCdNm || item.goodDetailName || item.packageType || item.packType || item.tourType || item.airProductYn || item.airYn || item.flightYn || item.includeAirYn || fallback.productType || "",
        goodsType: item.goodsType || item.goodType || fallback.goodsType || "",
        goodDetailCdNm: item.goodDetailCdNm || item.goodDetailName || fallback.goodDetailCdNm || "",
        airProductYn: item.airProductYn || item.airYn || item.flightYn || item.includeAirYn || fallback.airProductYn || "",
        air2Cd: item.air2Cd || fallback.air2Cd || "",
        air2CdNm: item.air2CdNm || fallback.air2CdNm || "",
        air2Nm: item.air2Nm || item.air2CdNm || fallback.air2Nm || fallback.air2CdNm || "",
        title: item.title || fallback.title || "골프 조인 상품",
        detailTitleCopy: item.detailTitleCopy || savedProductMeta.detailTitleCopy || fallback.detailTitleCopy || "",
        country: normalizedCountry,
        region: normalizedRegion,
        category: item.category || (normalizeSecretTourAirportName(item.airport, item.departureAirport) ? "해외" : "국내"),
        airport: normalizedDepartureAirport,
        departureAirport: normalizedDepartureAirport,
        arrivalAirport: item.arrivalAirport || item.arrAirport || item.toCity || item.arrivalCity || item.region || fallback.arrivalAirport || "",
        airline: item.airline || normalizeSecretTourAirlineName(item.air2Nm, item.air2CdNm, fallback.airline),
        departureDate: item.departureDate || fallback.departureDate,
        returnDate: item.returnDate || item.departureDate || fallback.returnDate,
        duration,
        dayNightCnt: duration,
        generalPrice,
        memberPrice: Number(item.memberPrice) || Number(item.minPrice) || 0,
        price: generalPrice,
        priceFrom: Number(item.priceFrom) > 0 ? Number(item.priceFrom) : generalPrice,
        image: item.image || savedProductMeta.image || fallback.image || "",
        badgeImage: item.badgeImage || BADGE_IMAGES[badgeKind] || fallback.badgeImage || "",
        participants: Array.isArray(item.participants) ? item.participants.slice(0, JOIN_MAX_CAPACITY) : [],
        includes: Array.isArray(item.includes) ? item.includes : (fallback.includes || []),
        excludes: Array.isArray(item.excludes) ? item.excludes : (fallback.excludes || []),
        notes: Array.isArray(item.notes) ? item.notes : (fallback.notes || []),
        schedule: Array.isArray(item.schedule) && item.schedule.length ? item.schedule : (fallback.schedule || []),
        emptySlots: Math.min(JOIN_MAX_CAPACITY, Number.isFinite(Number(item.emptySlots)) ? Number(item.emptySlots) : JOIN_MAX_CAPACITY)
      };
    }

    function getGolfJoinProductAvailabilityUrls(product = {}) {
      const objectName = String(product.availabilityObjectName || "").replace(/^\/+/, "").trim();
      const publicUrl = String(product.availabilityUrl || "").trim();
      return [...new Set([
        publicUrl,
        objectName
          ? `https://storage.googleapis.com/golfjoin-bucket/${objectName.split("/").map(encodeURIComponent).join("/")}`
          : "",
        objectName
      ].filter(Boolean))];
    }

    function getCachedGolfJoinAvailabilityProducts() {
      return [...golfJoinProductAvailabilityCache.values()].flat();
    }

    function mergeGolfJoinProductSources(...sources) {
      const merged = new Map();
      sources.flat().filter(Boolean).forEach((product, index) => {
        const reference = getSecretTourProductReference(product);
        const key = reference.goodSeq && reference.eventSeq
          ? `${reference.goodSeq}:${reference.eventSeq}`
          : String(product.id || reference.id || `product-${index}`);
        if (!merged.has(key)) merged.set(key, product);
      });
      return [...merged.values()];
    }

    function loadGolfJoinProductAvailability(product = {}) {
      const goodSeq = getGolfJoinProductGoodSeq(product);
      if (!goodSeq) return Promise.resolve([]);
      if (golfJoinProductAvailabilityCache.has(goodSeq)) {
        return Promise.resolve(golfJoinProductAvailabilityCache.get(goodSeq));
      }
      if (golfJoinProductAvailabilityPromiseCache.has(goodSeq)) {
        return golfJoinProductAvailabilityPromiseCache.get(goodSeq);
      }
      const urls = getGolfJoinProductAvailabilityUrls(product);
      if (!urls.length) return Promise.resolve([]);
      const loadPromise = urls.reduce((promise, url) => (
        promise.catch(() => fetchGolfJoinHomeJson(url, "Product availability"))
      ), Promise.reject(new Error("Product availability load not started."))).then((payload) => {
        if (payload?.schema !== "secret-golf-join-product-availability-v1") {
          throw new Error("Product availability payload is invalid.");
        }
        const minimumAdvanceDays = Number(payload.minimumAdvanceDays);
        if (Number.isFinite(minimumAdvanceDays) && minimumAdvanceDays >= 0) {
          homeGolfJoinMinimumAdvanceDays = minimumAdvanceDays;
        }
        const products = (Array.isArray(payload.events) ? payload.events : [])
          .map((event, index) => normalizeExternalGolfJoinProduct({
            ...product,
            ...event,
            homeProductSummary: false,
            homeReferenceOnly: false,
            priceFrom: Number(product.priceFrom) || Number(event.price) || 0
          }, index));
        golfJoinProductAvailabilityCache.set(goodSeq, products);
        return products;
      }).catch((error) => {
        golfJoinSafeWarn("Failed to load product availability.", { goodSeq, message: error?.message || "" });
        return [];
      }).finally(() => {
        golfJoinProductAvailabilityPromiseCache.delete(goodSeq);
      });
      golfJoinProductAvailabilityPromiseCache.set(goodSeq, loadPromise);
      return loadPromise;
    }

    async function loadGolfJoinProductGroupAvailability(products = []) {
      const summaries = (Array.isArray(products) ? products : []).filter(Boolean);
      const uniqueByGoodSeq = new Map();
      summaries.forEach((product) => {
        const goodSeq = getGolfJoinProductGoodSeq(product);
        if (goodSeq && !uniqueByGoodSeq.has(goodSeq)) uniqueByGoodSeq.set(goodSeq, product);
      });
      const groups = await Promise.all([...uniqueByGoodSeq.values()].map(loadGolfJoinProductAvailability));
      return mergeGolfJoinProductSources(...groups);
    }

    function hydrateOverseasJoinsWithSecretProducts() {
      const items = Array.isArray(window.SECRET_GOLF_JOIN_PRODUCTS?.items) ? window.SECRET_GOLF_JOIN_PRODUCTS.items : [];
      if (!items.length) return;
      const overseasProducts = items.filter((item) => {
        const category = String(item.category || "").trim();
        return category === "해외" || /oversea|overseas/i.test(category) || Boolean(item.airport);
      }).map(normalizeExternalGolfJoinProduct);
      if (!overseasProducts.length) return;
      const overseasJoins = joins.filter((join) => String(join.category || "").trim() === "해외" && !join.isBuilderApplicationJoin && !join.isRecommendationFixture);
      if (!overseasJoins.length) return;
      const sortedProducts = overseasProducts.slice().sort((a, b) => {
        const aDate = parseJoinDate(a.departureDate);
        const bDate = parseJoinDate(b.departureDate);
        if (aDate.getTime() !== bDate.getTime()) return aDate - bDate;
        const aPrice = Number(a.price) || 0;
        const bPrice = Number(b.price) || 0;
        if (aPrice !== bPrice) return aPrice - bPrice;
        return String(a.title || "").localeCompare(String(b.title || ""), "ko");
      });
      overseasJoins.forEach((join, index) => {
        const product = sortedProducts[index % sortedProducts.length];
        if (!product) return;
        const departureDate = product.departureDate || join.departureDate;
        const returnDate = product.returnDate || product.departureDate || join.returnDate;
        join.title = product.title || join.title;
        join.region = product.region || join.region;
        join.category = "해외";
        join.departureDate = departureDate;
        join.returnDate = returnDate;
        join.date = product.date || `${departureDate} - ${returnDate}`;
        join.price = Number(product.price) || join.price;
        join.departureAirport = product.departureAirport || product.airport || join.departureAirport || "";
        join.arrivalAirport = product.arrivalAirport || join.arrivalAirport || "";
        join.airline = product.airline || product.air2Nm || product.air2CdNm || join.airline || "";
        join.badge = product.badge || join.badge;
        join.badgeKind = product.badgeKind || join.badgeKind;
        join.badgeImage = product.badgeImage || BADGE_IMAGES[join.badgeKind] || join.badgeImage;
        if (product.image) {
          join.image = product.image;
        }
        if (product.sourceUrl) {
          join.sourceUrl = product.sourceUrl;
        }
        if (product.goodSeq) {
          join.goodSeq = product.goodSeq;
        }
        if (product.eventSeq) {
          join.eventSeq = product.eventSeq;
        }
        if (Number.isFinite(Number(product.emptySlots))) {
          join.emptySlots = Math.min(JOIN_MAX_CAPACITY, Number(product.emptySlots));
        }
      });
      reapplyRememberedJoinApplications({ render: false });
    }

    function ensureExternalGolfJoinProductsLoaded() {
      if (externalGolfJoinProducts || externalGolfJoinProductsLoadFailed) {
        return Promise.resolve(externalGolfJoinProducts || []);
      }
      if (!externalGolfJoinProductsLoadPromise) {
        externalGolfJoinProductsLoading = true;
        const productsPromise = loadLocalGolfJoinProductsData().catch((error) => {
          const inlineItems = Array.isArray(window.SECRET_GOLF_JOIN_PRODUCTS?.items) ? window.SECRET_GOLF_JOIN_PRODUCTS.items : [];
          if (inlineItems.length) return { items: inlineItems };
          golfJoinSafeWarn("Failed to load local golf join products. Falling back to live products.", error);
          return loadSecretTourGoodsProducts().then((items) => ({ items }));
        });
        externalGolfJoinProductsLoadPromise = Promise.all([
          productsPromise,
          ensureGolfJoinProductFamilyCatalogLoaded()
        ]).then(([payload]) => {
            applyHomeBootstrapLightFromHomeSummaryPayload(payload, { source: "products-load" });
            const items = Array.isArray(payload?.items) ? payload.items : [];
            externalGolfJoinProducts = items.map(normalizeExternalGolfJoinProduct);
            hydrateOverseasJoinsWithSecretProducts();
            return externalGolfJoinProducts;
          })
          .catch((error) => {
            externalGolfJoinProductsLoadFailed = true;
            golfJoinSafeWarn(error);
            return [];
          })
          .finally(() => {
            externalGolfJoinProductsLoading = false;
            if (document.getElementById("builderModal")?.classList.contains("open")) {
              renderBuilderCalendar();
              renderBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "");
            }
            if (document.getElementById("calendarSheet")?.classList.contains("open")) {
              renderCalendarSheet();
            }
            scheduleHomeRender({ deferWhileModalOpen: true });
          });
        if (document.getElementById("builderModal")?.classList.contains("open")) {
          renderBuilderCalendar();
        }
      }
      return externalGolfJoinProductsLoadPromise;
    }

    function scheduleMdPickSectionRenderWhenDataReady() {
      const productsSettled = Boolean(homeGolfJoinProducts) || homeGolfJoinProductsLoadFailed;
      const productFamilySettled = !GOLFJOIN_PRODUCT_FAMILY_ENABLED
        || Boolean(golfJoinProductFamilyCatalog)
        || golfJoinProductFamilyLoadFailed;
      if (!productsSettled || !productFamilySettled) return false;
      const marked = markGolfJoinPerformanceOnce(
        "golfjoin:mdpick:data-ready",
        "golfjoin:duration:mdpick-data",
        "golfjoin:boot:start"
      );
      if (marked) {
        try {
          if (!renderMdPickSectionOnly()) scheduleMdPickSectionRender();
        } catch (error) {
          golfJoinSafeWarn("Failed to render MD PICK as soon as its data became ready.", error);
          scheduleMdPickSectionRender();
        }
      }
      return marked;
    }

    function ensureHomeGolfJoinProductsLoaded(options = {}) {
      if (homeGolfJoinProducts || homeGolfJoinProductsLoadFailed) {
        return Promise.resolve(homeGolfJoinProducts || []);
      }
      if (!homeGolfJoinProductsLoadPromise) {
        const homeProductFamilyPromise = ensureGolfJoinProductFamilyCatalogLoaded();
        void homeProductFamilyPromise.finally(() => {
          if (homeGolfJoinProducts && options.renderHome !== false) scheduleHomeRender();
        });
        const productsPromise = withGolfJoinHomeProductsReadyTimeout(loadGolfJoinHomeCardsJson()
          .catch((error) => {
            golfJoinSafeWarn("Failed to load compact home cards. Falling back to the full home summary.", error);
            return loadGolfJoinHomeSummaryJson();
          }));
        const homeGolfJoinProductsReadyPromise = productsPromise
          .then((payload) => {
            applyHomeBootstrapLightFromHomeSummaryPayload(payload, { source: "home-products", render: false });
            const minimumAdvanceDays = Number(payload?.minimumAdvanceDays);
            if (Number.isFinite(minimumAdvanceDays) && minimumAdvanceDays >= 0) {
              homeGolfJoinMinimumAdvanceDays = minimumAdvanceDays;
            }
            const items = Array.isArray(payload?.items) ? payload.items : [];
            if (!items.length) throw new Error("Home product cards are empty.");
            homeGolfJoinProducts = items.map(normalizeExternalGolfJoinProduct);
            markGolfJoinPerformanceOnce(
              "golfjoin:boot:products-ready",
              "golfjoin:duration:home-products",
              "golfjoin:boot:start"
            );
            scheduleMdPickSectionRenderWhenDataReady();
            return homeGolfJoinProducts;
          })
          .catch((error) => {
            homeGolfJoinProductsLoadFailed = true;
            markGolfJoinPerformanceOnce(
              "golfjoin:boot:products-failed",
              "golfjoin:duration:home-products",
              "golfjoin:boot:start"
            );
            golfJoinSafeWarn(error);
            scheduleMdPickSectionRenderWhenDataReady();
            return [];
          });
        homeGolfJoinProductsLoadPromise = homeGolfJoinProductsReadyPromise
          .finally(() => {
            mdPickListCacheSourceSignature = "";
            mdPickListElementCache?.clear?.();
            mdPickRegionCache = {
              sourceRef: null,
              minDepartureIso: "",
              products: [],
              availability: new Map(),
              searchItems: null,
              themeCandidates: null
            };
            try {
              reapplyPendingHomeBootstrapLightData({ render: false });
            } catch (error) {
              golfJoinSafeWarn("Failed to reapply home bootstrap data after loading product cards.", error);
            } finally {
              if (options.renderHome !== false) scheduleHomeRender();
            }
          });
      }
      return homeGolfJoinProductsLoadPromise;
    }

    function getHomeProductSource() {
      if (!homeGolfJoinProducts && !homeGolfJoinProductsLoadFailed) {
        void ensureHomeGolfJoinProductsLoaded();
      }
      return homeGolfJoinProducts || externalGolfJoinProducts || joins || [];
    }

    function getBuilderProductSource() {
      ensureExternalGolfJoinProductsLoaded();
      return mergeGolfJoinProductSources(
        getCachedGolfJoinAvailabilityProducts(),
        externalGolfJoinProducts || joins || []
      );
    }

    function isGolfJoinProductFamilyGroupingEligible(product = {}) {
      return !(
        product.isAdminRecommendedSchedule
        || product.isBuilderApplicationJoin
        || product.scheduleId
        || product.sourceApplicationId
        || product.targetScheduleId
        || product.targetApplicationId
      );
    }

    function getGolfJoinProductFamilyId(product = {}) {
      if (!GOLFJOIN_PRODUCT_FAMILY_ENABLED || !isGolfJoinProductFamilyGroupingEligible(product)) return "";
      const reference = getSecretTourProductReference(product);
      const goodSeq = String(product.goodSeq || reference.goodSeq || product.erpProductId || "").trim();
      return golfJoinProductFamilyIdByGoodSeq.get(goodSeq) || "";
    }

    function getGolfJoinProductFamily(product = {}) {
      const familyId = getGolfJoinProductFamilyId(product);
      return familyId ? golfJoinProductFamilyById.get(familyId) || null : null;
    }

    function getGolfJoinProductGoodSeq(product = {}) {
      const reference = getSecretTourProductReference(product);
      const goodSeq = String(product.goodSeq || reference.goodSeq || product.erpProductId || "").trim();
      return /^\d+$/.test(goodSeq) ? goodSeq : "";
    }

    function getGolfJoinProductEventSeq(product = {}) {
      const reference = getSecretTourProductReference(product);
      return String(product.eventSeq || product.erpEventSeq || reference.eventSeq || "").trim();
    }

    function selectGolfJoinProductGroupRepresentative(products = [], options = {}) {
      const source = (Array.isArray(products) ? products : []).filter(Boolean);
      if (!source.length) return null;
      const family = source.map(getGolfJoinProductFamily).find(Boolean) || null;
      const representativeGoodSeq = String(
        family?.representativeGoodSeq
        || family?.representative?.goodSeq
        || ""
      ).trim();
      const representativeEventSeq = options.ignoreRepresentativeEvent === true
        ? ""
        : String(family?.representative?.representativeEventSeq || "").trim();
      const representativeProducts = representativeGoodSeq
        ? source.filter((product) => getGolfJoinProductGoodSeq(product) === representativeGoodSeq)
        : [];
      const candidates = representativeProducts.length ? representativeProducts : source;
      return candidates.slice().sort((left, right) => {
        const leftEventPriority = representativeEventSeq && getGolfJoinProductEventSeq(left) === representativeEventSeq ? 0 : 1;
        const rightEventPriority = representativeEventSeq && getGolfJoinProductEventSeq(right) === representativeEventSeq ? 0 : 1;
        const leftPrice = Number(left.price) > 0 ? Number(left.price) : Number.MAX_SAFE_INTEGER;
        const rightPrice = Number(right.price) > 0 ? Number(right.price) : Number.MAX_SAFE_INTEGER;
        return leftEventPriority - rightEventPriority
          || leftPrice - rightPrice
          || String(left.departureDate || "9999-12-31").localeCompare(String(right.departureDate || "9999-12-31"))
          || String(left.returnDate || "9999-12-31").localeCompare(String(right.returnDate || "9999-12-31"))
          || String(left.id || "").localeCompare(String(right.id || ""));
      })[0] || null;
    }

    function isGolfJoinBookableProductEvent(product = {}) {
      const departureDate = String(product.departureDate || "").slice(0, 10);
      const returnDate = String(product.returnDate || departureDate || "").slice(0, 10);
      const status = String(product.status || "");
      return Boolean(
        departureDate
        && departureDate >= getBuilderMinDepartureISO()
        && returnDate
        && Number(product.price) > 0
        && !/(마감|종료|판매중지|취소|closed|cancel)/i.test(status)
      );
    }

    function selectGolfJoinBookableProduct(products = [], options = {}) {
      const eligibleProducts = (Array.isArray(products) ? products : [])
        .filter(isGolfJoinBookableProductEvent);
      if (!eligibleProducts.length) return null;
      const avoidActiveScheduleOverlap = options.avoidActiveScheduleOverlap !== false;
      const activeSchedules = avoidActiveScheduleOverlap ? getActiveJoinMySchedules() : [];
      const nonOverlappingProducts = activeSchedules.length
        ? eligibleProducts.filter((product) => {
          const productRange = normalizeJoinScheduleRange(product);
          if (!productRange) return true;
          return !activeSchedules.some((active) => doJoinScheduleRangesOverlap(productRange, active.range));
        })
        : eligibleProducts;
      const candidates = nonOverlappingProducts.length ? nonOverlappingProducts : eligibleProducts;
      return selectGolfJoinProductGroupRepresentative(candidates, { ignoreRepresentativeEvent: true });
    }

    function formatGolfJoinProductFamilyDuration(member = {}, product = {}) {
      const nights = Number(member.durationNights || 0);
      const days = Number(member.durationDays || 0);
      if (nights > 0 && days > 0) return `${nights}박 ${days}일`;
      const rawLabel = String(member.durationLabel || product.durationLabel || product.tripSummary || "").trim();
      const matched = rawLabel.match(/(\d+)\s*박\s*(\d+)\s*일/);
      return matched ? `${matched[1]}박 ${matched[2]}일` : rawLabel;
    }

    function parseDetailProductFamilyDeparturePattern(value = "") {
      const title = String(value || "").normalize("NFKC").trim();
      const durationMatch = /(\d+)\s*박\s*(\d+)\s*일/.exec(title);
      if (!durationMatch) return { mode: "unknown", weekdays: [], label: "출발요일 확인 필요", status: "review_required" };
      const tail = title.slice((durationMatch.index || 0) + durationMatch[0].length);
      const departureIndex = tail.indexOf("출발");
      if (departureIndex < 0) return { mode: "daily", weekdays: [], label: "매일출발", status: "resolved" };
      const weekdayText = tail.slice(0, departureIndex).trim();
      const matched = /^\s*[([{]?\s*([월화수목금토일](?:\s*[\/·,]\s*[월화수목금토일])*)\s*[)\]}]?\s*$/.exec(weekdayText);
      if (!matched) return { mode: "unknown", weekdays: [], label: "출발요일 확인 필요", status: "review_required" };
      const weekdays = [...new Set(matched[1].match(/[월화수목금토일]/g) || [])];
      return weekdays.length
        ? { mode: "weekday", weekdays, label: `${weekdays.join("/")}출발`, status: "resolved" }
        : { mode: "unknown", weekdays: [], label: "출발요일 확인 필요", status: "review_required" };
    }

    function analyzeDetailProductFamilyHoleLine(value = "") {
      const source = String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim();
      const holes = [...source.matchAll(/(\d+)\s*(?:홀|H\b)/gi)]
        .map((match) => Number(match[1]))
        .filter((number) => Number.isFinite(number) && number > 0 && number <= 144);
      if (!holes.length) return null;
      if (/또는/.test(source) || /주중[\s\S]*\/[\s\S]*주말|주말[\s\S]*\/[\s\S]*주중/.test(source)) {
        return { minHoles: Math.min(...holes), maxHoles: Math.max(...holes), condition: "alternative" };
      }
      if (/보너스/.test(source)) {
        return { minHoles: holes[0], maxHoles: holes.reduce((sum, number) => sum + number, 0), condition: "optional_bonus" };
      }
      const total = holes.reduce((sum, number) => sum + number, 0);
      return { minHoles: total, maxHoles: total, condition: "fixed" };
    }

    function buildDetailProductFamilyGolfSummary(schedule = []) {
      const dayBreakdown = [];
      (Array.isArray(schedule) ? schedule : []).forEach((item, index) => {
        const points = Array.isArray(item?.points) ? item.points.map(cleanSecretTourDetailText).filter(Boolean) : [];
        const contentLines = points.length
          ? points
          : cleanSecretTourDetailText(item?.content)
            ? String(item.content).split(/\s*,\s*|\s*\n\s*/).map(cleanSecretTourDetailText).filter(Boolean)
            : cleanSecretTourDetailText(item?.rawText) ? [cleanSecretTourDetailText(item.rawText)] : [];
        const golfLines = [...new Set(contentLines
          .filter((line) => /라운드|라운딩|\d+\s*(?:홀|H\b)/i.test(line) || (/골프/i.test(line) && !/이동|출발|도착|중\s*한\s*곳/.test(line)))
          .map((line) => String(line).normalize("NFKC").replace(/\s+/g, " ").trim()))];
        if (!golfLines.length) return;
        const analyses = golfLines.map(analyzeDetailProductFamilyHoleLine).filter(Boolean);
        const resolved = analyses.length > 0;
        dayBreakdown.push({
          day: index + 1,
          minHoles: resolved ? analyses.reduce((sum, item) => sum + item.minHoles, 0) : 0,
          maxHoles: resolved ? analyses.reduce((sum, item) => sum + item.maxHoles, 0) : 0,
          status: resolved ? "resolved" : "review_required"
        });
      });
      const golfDays = dayBreakdown.length;
      if (!golfDays) return { golfDays: 0, minTotalHoles: 0, maxTotalHoles: 0, label: "", status: "empty", dayBreakdown: [] };
      const unresolved = dayBreakdown.some((item) => item.status !== "resolved");
      const minTotalHoles = dayBreakdown.reduce((sum, item) => sum + item.minHoles, 0);
      const maxTotalHoles = dayBreakdown.reduce((sum, item) => sum + item.maxHoles, 0);
      const holeLabel = unresolved
        ? "총 홀수 확인 필요"
        : minTotalHoles === maxTotalHoles ? `총 ${minTotalHoles}홀` : `총 ${minTotalHoles}~${maxTotalHoles}홀`;
      return {
        golfDays,
        minTotalHoles,
        maxTotalHoles,
        label: `골프 ${golfDays}일 · ${holeLabel}`,
        status: unresolved ? "review_required" : "resolved",
        dayBreakdown
      };
    }

    const detailProductFamilyMetadataCache = new Map();

    function getDetailProductFamilyMetadataKey(product = {}) {
      return `${getGolfJoinProductGoodSeq(product)}:${getGolfJoinProductEventSeq(product)}`;
    }

    function getDetailProductFamilyGolfSummary(member = {}, product = {}) {
      if (Array.isArray(product.schedule) && product.schedule.length) {
        const liveSummary = buildDetailProductFamilyGolfSummary(product.schedule);
        if (liveSummary.label) return liveSummary;
      }
      const cached = detailProductFamilyMetadataCache.get(getDetailProductFamilyMetadataKey(product));
      return cached?.golfSummary || member.golfSummary || null;
    }

    async function hydrateDetailProductFamilyPeriodMetadata(join = {}) {
      const options = getDetailProductFamilyPeriodOptions(join);
      const queue = options.filter((option) => {
        const key = getDetailProductFamilyMetadataKey(option.product);
        return key && !detailProductFamilyMetadataCache.has(key) && !option.golfSummary?.label;
      });
      if (!queue.length) return;
      let cursor = 0;
      const worker = async () => {
        while (cursor < queue.length) {
          const option = queue[cursor++];
          const key = getDetailProductFamilyMetadataKey(option.product);
          const pending = loadSecretTourGoodsDetail(option.product)
            .then((detail) => ({
              status: "loaded",
              golfSummary: buildDetailProductFamilyGolfSummary(detail?.schedule || [])
            }))
            .catch(() => ({ status: "failed", golfSummary: null }));
          detailProductFamilyMetadataCache.set(key, { status: "loading", promise: pending });
          detailProductFamilyMetadataCache.set(key, await pending);
        }
      };
      await Promise.all(Array.from({ length: Math.min(2, queue.length) }, worker));
      if (!document.getElementById("detailModal")?.classList.contains("open")) return;
      const currentFamilyId = getGolfJoinProductFamilyId(currentDetailJoinData || {});
      if (!currentFamilyId || currentFamilyId !== getGolfJoinProductFamilyId(join)) return;
      const currentBox = document.querySelector("#detailModal .detail-family-periods");
      if (currentBox) currentBox.outerHTML = renderDetailProductFamilyPeriods(currentDetailJoinData || join);
    }

    function isGolfJoinProductFamilyPeriodAvailable(product = {}) {
      return isGolfJoinBookableProductEvent(product);
    }

    function getDetailProductFamilyPeriodOptions(join = {}) {
      if (!new Set(["mdPickProduct", "builderProduct"]).has(currentDetailMode)) return [];
      const family = getGolfJoinProductFamily(join);
      const familyId = String(family?.familyId || "").trim();
      if (!familyId || !Array.isArray(family.members) || family.members.length < 2) return [];
      const products = getBuilderProductSource().filter((product) => (
        getGolfJoinProductFamilyId(product) === familyId
        && isGolfJoinProductFamilyPeriodAvailable(product)
      ));
      const selectedGoodSeq = getGolfJoinProductGoodSeq(join);
      return family.members.map((member) => {
        const goodSeq = String(member?.goodSeq || "").trim();
        if (!goodSeq) return null;
        const periodProducts = products.filter((product) => getGolfJoinProductGoodSeq(product) === goodSeq);
        const builderDepartureDate = currentDetailMode === "builderProduct" ? getBuilderSelectedDepartureDate() : "";
        const sameDepartureProducts = builderDepartureDate
          ? periodProducts.filter((product) => product.departureDate === builderDepartureDate)
          : [];
        const productCandidates = currentDetailMode === "builderProduct" && builderDepartureDate
          ? sameDepartureProducts
          : periodProducts;
        const product = selectGolfJoinBookableProduct(productCandidates, { avoidActiveScheduleOverlap: true });
        if (!product) return null;
        return {
          goodSeq,
          label: formatGolfJoinProductFamilyDuration(member, product),
          departurePattern: member.departurePattern || parseDetailProductFamilyDeparturePattern(member.sourceProductTitle || member.title || product.sourceProductTitle || product.title),
          golfSummary: getDetailProductFamilyGolfSummary(member, product),
          price: Number(product.price) || Number(member.lowestPrice) || 0,
          product,
          hasScheduleConflict: Boolean(getBlockingActiveJoinSchedule(product)),
          selected: goodSeq === selectedGoodSeq
        };
      }).filter(Boolean);
    }

    function renderDetailProductFamilyPeriods(join = {}) {
      const options = getDetailProductFamilyPeriodOptions(join);
      if (options.length < 2) return "";
      return `
        <div class="detail-family-periods${detailProductFamilyPeriodSwitching ? " is-switching" : ""}" aria-label="여행기간 선택">
          <div class="detail-family-period-title">여행기간을 선택해주세요</div>
          <div class="detail-family-period-options">
            ${options.map((option) => `
              <button
                type="button"
                class="detail-family-period-option${option.selected ? " is-selected" : ""}"
                data-family-good-seq="${escapeHtml(option.goodSeq)}"
                aria-pressed="${option.selected ? "true" : "false"}"
                ${detailProductFamilyPeriodSwitching ? "disabled" : ""}
                onclick="selectDetailProductFamilyPeriod('${escapeJsString(option.goodSeq)}')"
              >
                <span class="detail-family-period-radio" aria-hidden="true"></span>
                <span class="detail-family-period-copy">
                  <strong>${escapeHtml(option.label)}</strong>
                  <span class="detail-family-period-departure">${escapeHtml(option.departurePattern?.label || "매일출발")}${option.hasScheduleConflict ? " · 내 일정과 겹침" : ""}</span>
                  <span class="detail-family-period-golf">${escapeHtml(option.golfSummary?.label || "골프 일정 확인 중")}</span>
                  <span class="detail-family-period-price">${formatPrice(option.price)}원~</span>
                </span>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    async function selectDetailProductFamilyPeriod(goodSeq) {
      if (detailProductFamilyPeriodSwitching || !new Set(["mdPickProduct", "builderProduct"]).has(currentDetailMode)) return;
      const normalizedGoodSeq = String(goodSeq || "").trim();
      if (!normalizedGoodSeq || normalizedGoodSeq === getGolfJoinProductGoodSeq(currentDetailJoinData || {})) return;
      const option = getDetailProductFamilyPeriodOptions(currentDetailJoinData || {})
        .find((item) => item.goodSeq === normalizedGoodSeq);
      if (!option?.product) return;

      const detailScrollState = captureDetailModalScrollState();
      detailProductFamilyPeriodSwitching = true;
      const periodBox = document.querySelector("#detailModal .detail-family-periods");
      periodBox?.classList.add("is-switching");
      periodBox?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      try {
        await runJoinReadLoading(async () => {
          if (currentDetailMode === "builderProduct") {
            await showBuilderProductDetailProduct(option.product, {
              open: false,
              preserveScroll: true,
              scrollState: detailScrollState
            });
          } else {
            await showMdPickDetailProduct(
              option.product,
              currentMdPickProductGroupKey,
              currentMdPickCountryKey,
              { preserveScroll: true, scrollState: detailScrollState }
            );
          }
        }, {
          ownerKey: `detail-family-period:${currentDetailMode}:${normalizedGoodSeq}`,
          getTarget: () => document.querySelector("#detailModal .detail-family-periods"),
          message: "선택한 기간의 상품 정보를 불러오고 있어요"
        });
      } finally {
        detailProductFamilyPeriodSwitching = false;
        const activePeriodBox = document.querySelector("#detailModal .detail-family-periods");
        activePeriodBox?.classList.remove("is-switching");
        activePeriodBox?.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      }
    }

    function getProductGroupKey(product = {}) {
      const familyId = getGolfJoinProductFamilyId(product);
      if (familyId) return `family-${familyId}`;
      const goodSeq = String(product.goodSeq || product.erpProductId || "").trim();
      if (goodSeq) return `good-${goodSeq}`;
      return `title-${normalizeRegionKeyword(product.title || "")}`;
    }

    function getBuilderFixedProductGroupProducts() {
      const key = builderState.fixedProductGroupKey || "";
      if (!key) return [];
      const products = getBuilderProductSource().filter((product) => getProductGroupKey(product) === key);
      const fixedGoodSeq = String(builderState.fixedProductGoodSeq || "").trim();
      if (!fixedGoodSeq) return products;
      return products.filter((product) => getGolfJoinProductGoodSeq(product) === fixedGoodSeq);
    }

    function getBuilderSelectedFixedProduct() {
      const productId = String(builderState.productId || "").trim();
      if (!productId) return null;
      return getBuilderProductSource().find((item) => item.id === productId)
        || joins.find((item) => item.id === productId)
        || (currentDetailMode === "builderProduct" && currentDetailJoinData?.id === productId ? currentDetailJoinData : null)
        || null;
    }

    function syncBuilderFixedProductFromSelectedDates() {
      if (!builderState.fixedProductGroupKey) return;
      const startIso = builderDateToISO(builderState.startDay);
      const endIso = builderDateToISO(builderState.endDay);
      const product = getBuilderFixedProductGroupProducts()
        .filter((item) => item.departureDate === startIso && (item.returnDate || item.departureDate) === endIso)
        .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))[0];
      if (!product) return;
      builderState.productId = product.id;
      builderState.productName = product.title;
      builderState.productFamilyId = getGolfJoinProductFamilyId(product);
      builderState.fixedProductGoodSeq = getGolfJoinProductGoodSeq(product) || builderState.fixedProductGoodSeq;
      builderState.region = product.region || builderState.region || "";
      builderState.regions = builderState.region ? [builderState.region] : builderState.regions;
    }

    function getBuilderSelectedDepartureDate() {
      return builderDateToISO(builderState.startDay);
    }

    function getBuilderSelectedDepartureDates() {
      if (!Number.isFinite(builderState.startDay)) return [];
      const dates = [];
      const start = builderState.startDay - (Number(builderState.startBefore) || 0);
      const end = builderState.startDay + (Number(builderState.startAfter) || 0);
      for (let day = start; day <= end; day++) {
        const iso = builderDateToISO(day);
        if (iso) dates.push(iso);
      }
      return [...new Set(dates)];
    }

    function getBuilderSelectedReturnDates() {
      if (!Number.isFinite(builderState.endDay)) return [];
      const dates = [];
      const start = builderState.endDay - (Number(builderState.endBefore) || 0);
      const end = builderState.endDay + (Number(builderState.endAfter) || 0);
      for (let day = start; day <= end; day++) {
        const iso = builderDateToISO(day);
        if (iso) dates.push(iso);
      }
      return [...new Set(dates)];
    }

    function formatBuilderDateSetLabel(dates) {
      if (!dates.length) return "";
      return dates.length === 1 ? dates[0] : `${dates[0]} ~ ${dates[dates.length - 1]}`;
    }

    function getBuilderProductDateCriteria() {
      const departureDates = getBuilderSelectedDepartureDates();
      const returnDates = getBuilderSelectedReturnDates();
      return {
        departureDates,
        returnDates,
        departureDateSet: new Set(departureDates),
        returnDateSet: new Set(returnDates)
      };
    }

    function builderProductMatchesSelectedDates(product) {
      const { departureDateSet, returnDateSet } = getBuilderProductDateCriteria();
      if (departureDateSet.size && !departureDateSet.has(product.departureDate)) return false;
      if (returnDateSet.size && !returnDateSet.has(product.returnDate || product.departureDate)) return false;
      return true;
    }

    function getBuilderProductDateLabel() {
      const { departureDates, returnDates } = getBuilderProductDateCriteria();
      const departureLabel = formatBuilderDateSetLabel(departureDates);
      const returnLabel = formatBuilderDateSetLabel(returnDates);
      if (departureLabel && returnLabel) return `${departureLabel} 출발 · ${returnLabel} 도착`;
      if (departureLabel) return `${departureLabel} 출발`;
      return "";
    }

    function getBuilderProductCriteria(query) {
      const values = [
        query,
        ...(builderState.regions || [])
      ].filter(Boolean);
      const tokens = values.flatMap((item) => {
        const rawParts = String(item || "").split(/[,\s/·()]+/).map((part) => part.trim()).filter(Boolean);
        if (rawParts.length > 1) {
          return [rawParts[0], item].map(normalizeRegionKeyword).filter(Boolean);
        }
        return getRegionSearchTokens(item);
      });
      return [...new Set(tokens)];
    }

    function getBuilderProductFallbackCriteria(query) {
      const values = [
        query,
        ...(builderState.regions || [])
      ].filter(Boolean);
      return [...new Set(values.flatMap((item) => getRegionSearchTokens(item)))];
    }

    function builderProductMatchesTokens(product, tokens) {
      const haystack = normalizeRegionKeyword([
        product.title,
        product.region,
        product.category,
        product.airport
      ].filter(Boolean).join(" "));
      return tokens.some((token) => haystack.includes(token));
    }

    function hasBuilderDateConstraint() {
      return Array.isArray(builderState.dateConstraintRegions) && builderState.dateConstraintRegions.length > 0;
    }

    function getBuilderDateConstraintTokens() {
      const regions = builderState.dateConstraintRegions || [];
      return [...new Set(regions.flatMap((name) => {
        const rawParts = String(name || "").split(/[,\s/·()]+/).map((part) => part.trim()).filter(Boolean);
        if (rawParts.length > 1) {
          return [rawParts[0], name].map(normalizeRegionKeyword).filter(Boolean);
        }
        return getRegionSearchTokens(name);
      }))];
    }

    function getBuilderDateConstraintProducts() {
      const fixedProducts = getBuilderFixedProductGroupProducts();
      if (fixedProducts.length) return fixedProducts;
      if (!hasBuilderDateConstraint()) return [];
      const products = getBuilderProductSource();
      if (!products.length) return [];
      const tokens = getBuilderDateConstraintTokens();
      if (!tokens.length) return [];
      return products.filter((product) => builderProductMatchesTokens(product, tokens));
    }

    function getBuilderRegisteredProductsForDateSelection() {
      const fixedProducts = getBuilderFixedProductGroupProducts();
      if (fixedProducts.length) return fixedProducts;
      const constrained = getBuilderDateConstraintProducts();
      if (constrained.length) return constrained;
      return getBuilderProductSource();
    }

    function isBuilderConstraintDepartureDate(iso) {
      if (!hasBuilderDateConstraint()) return false;
      const products = getBuilderDateConstraintProducts();
      if (!products.length) return false;
      return products.some((product) => product.departureDate === iso);
    }

    function hasBuilderConstrainedProductForDates(startIso, endIso = "") {
      if (!hasBuilderDateConstraint()) return true;
      const products = getBuilderDateConstraintProducts();
      if (!products.length) return true;
      return products.some((product) => {
        if (startIso && product.departureDate !== startIso) return false;
        if (endIso && (product.returnDate || product.departureDate) !== endIso) return false;
        return true;
      });
    }

    function hasBuilderConstrainedProductForSelectedDateRanges() {
      if (!hasBuilderDateConstraint()) return true;
      const products = getBuilderDateConstraintProducts();
      if (!products.length) return false;
      const departureDates = getBuilderSelectedDepartureDates();
      const returnDates = getBuilderSelectedReturnDates();
      return products.some((product) => {
        if (departureDates.length && !departureDates.includes(product.departureDate)) return false;
        if (returnDates.length && !returnDates.includes(product.returnDate || product.departureDate)) return false;
        return true;
      });
    }

    function hasBuilderConstrainedReturnForSelectedDepartures(returnIso) {
      const products = getBuilderRegisteredProductsForDateSelection();
      if (!products.length) return false;
      const departureDates = getBuilderSelectedDepartureDates();
      return products.some((product) => {
        return departureDates.includes(product.departureDate) && (product.returnDate || product.departureDate) === returnIso;
      });
    }

    function isBuilderCurrentFlexSelectionValid() {
      const products = getBuilderRegisteredProductsForDateSelection();
      if (!products.length) return true;
      const departureDates = getBuilderSelectedDepartureDates();
      const returnDates = getBuilderSelectedReturnDates();
      if (!returnDates.length) {
        return departureDates.every((departureIso) => products.some((product) => product.departureDate === departureIso));
      }
      return departureDates.every((departureIso) => {
        return products.some((product) => product.departureDate === departureIso && returnDates.includes(product.returnDate || product.departureDate));
      }) && returnDates.every((returnIso) => {
        return products.some((product) => returnIso === (product.returnDate || product.departureDate) && departureDates.includes(product.departureDate));
      });
    }

    function isBuilderDateAllowedByConstraint(iso) {
      const products = getBuilderRegisteredProductsForDateSelection();
      if (!products.length) return true;
      if (!hasBuilderDateConstraint() && !Number.isFinite(builderState.startDay)) {
        return products.some((product) => product.departureDate === iso);
      }
      if (!Number.isFinite(builderState.startDay)) {
        return products.some((product) => product.departureDate === iso);
      }
      const departureDates = getBuilderSelectedDepartureDates();
      const returnDates = getBuilderSelectedReturnDates();
      if (Number.isFinite(builderState.endDay)) {
        return departureDates.includes(iso) || returnDates.includes(iso);
      }
      return products.some((product) => departureDates.includes(product.departureDate) && (product.returnDate || product.departureDate) === iso);
    }

    function reconcileBuilderConstrainedDates() {
      if (!hasBuilderDateConstraint() || !Number.isFinite(builderState.startDay)) return;
      const startIso = builderDateToISO(builderState.startDay);
      if (!hasBuilderConstrainedProductForDates(startIso)) {
        builderState.startDay = null;
        builderState.endDay = null;
        builderState.startBefore = 0;
        builderState.startAfter = 0;
        builderState.endBefore = 0;
        builderState.endAfter = 0;
        return;
      }
      if (Number.isFinite(builderState.endDay)) {
        if (!hasBuilderConstrainedProductForSelectedDateRanges()) {
          builderState.endDay = null;
          builderState.endBefore = 0;
          builderState.endAfter = 0;
        }
      }
    }

    function getBuilderRegionAvailabilityTokens(name, options = {}) {
      if (options.country) return getRegionSearchTokens(name);
      const rawParts = String(name || "").split(/[,\s/·()]+/).map((part) => part.trim()).filter(Boolean);
      if (rawParts.length > 1) {
        return [...new Set([rawParts[0], name].map(normalizeRegionKeyword).filter(Boolean))];
      }
      return getRegionSearchTokens(name);
    }

    function isBuilderRegionAvailableForDate(name, options = {}) {
      const { departureDateSet, returnDateSet } = getBuilderProductDateCriteria();
      if (!departureDateSet.size && !returnDateSet.size) return true;
      const products = getBuilderProductSource();
      if (!products.length) return true;
      const tokens = getBuilderRegionAvailabilityTokens(name, options);
      if (!tokens.length) return false;
      return products.some((product) => {
        if (departureDateSet.size && !departureDateSet.has(product.departureDate)) return false;
        if (returnDateSet.size && !returnDateSet.has(product.returnDate || product.departureDate)) return false;
        return builderProductMatchesTokens(product, tokens);
      });
    }

    function builderRegionDisabledAttrs(isAvailable) {
      return isAvailable ? "" : " disabled aria-disabled=\"true\"";
    }

    function isBuilderCountryAvailable(country) {
      if (!country) return false;
      return isBuilderRegionAvailableForDate(country.name, { country: true });
    }

    function getBuilderAvailableCities(country) {
      const cities = Array.isArray(country?.cities) ? country.cities : [];
      return cities.filter((city) => isBuilderRegionAvailableForDate(regionLabel(city, country.name)));
    }

    function isBuilderCategoryAvailable(category) {
      return (category?.countries || []).some((country) => isBuilderCountryAvailable(country));
    }

    function getBuilderAvailableCountries(category) {
      return (category?.countries || [])
        .map((country, countryIndex) => ({ country, countryIndex }))
        .filter(({ country }) => isBuilderCountryAvailable(country));
    }

    function getFirstBuilderAvailableCountryIndex(category) {
      return getBuilderAvailableCountries(category)[0]?.countryIndex ?? 0;
    }

    function isMdPickCountryAvailable(country) {
      if (!country) return false;
      return hasMdPickRegionProducts(country.name, { country: true });
    }

    function getMdPickAvailableCities(country) {
      const cities = Array.isArray(country?.cities) ? country.cities : [];
      return cities.filter((city) => hasMdPickRegionProducts(regionLabel(city, country.name)));
    }

    function isMdPickCategoryAvailable(category) {
      return (category?.countries || []).some((country) => isMdPickCountryAvailable(country));
    }

    function getMdPickAvailableCountries(category) {
      return (category?.countries || [])
        .map((country, countryIndex) => ({ country, countryIndex }))
        .filter(({ country }) => isMdPickCountryAvailable(country));
    }

    function getFirstMdPickAvailableCountryIndex(category) {
      return getMdPickAvailableCountries(category)[0]?.countryIndex ?? 0;
    }

    function getDefaultBuilderRegionCountryKey(categoryIndex) {
      const category = getActiveRegionTree()[categoryIndex];
      if (!category || category.category !== "일본") return "";
      const countryIndex = getFirstBuilderAvailableCountryIndex(category);
      const country = category.countries?.[countryIndex];
      return Array.isArray(country?.cities) && country.cities.length ? `${categoryIndex}:${countryIndex}` : "";
    }

    function collapseBuilderProductsByDisplayGroup(products = []) {
      const groups = new Map();
      (products || []).forEach((product) => {
        const key = getProductGroupKey(product);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(product);
      });
      return [...groups.values()]
        .map((groupProducts) => selectGolfJoinProductGroupRepresentative(groupProducts))
        .filter(Boolean);
    }

    function getBuilderRegionProducts(query = "") {
      const products = getBuilderProductSource();
      const tokens = getBuilderProductCriteria(query);
      const fallbackTokens = getBuilderProductFallbackCriteria(query);
      if (!tokens.length) return [];
      const exactRegionMatched = products.filter((product) => builderProductMatchesTokens(product, tokens));
      const regionMatched = exactRegionMatched.length
        ? exactRegionMatched
        : products.filter((product) => builderProductMatchesTokens(product, fallbackTokens));
      const matched = collapseBuilderProductsByDisplayGroup(
        regionMatched.filter(builderProductMatchesSelectedDates)
      );
      if (regionProductSort === "price") {
        return matched.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      }
      if (regionProductSort === "deadline") {
        return matched.sort((a, b) => parseJoinDate(a.departureDate) - parseJoinDate(b.departureDate));
      }
      return matched;
    }

    function hasExactBuilderDateProducts(query = "") {
      const products = getBuilderProductSource();
      const tokens = getBuilderProductCriteria(query);
      const fallbackTokens = getBuilderProductFallbackCriteria(query);
      const { departureDateSet, returnDateSet } = getBuilderProductDateCriteria();
      if (!tokens.length || (!departureDateSet.size && !returnDateSet.size)) return true;
      const exactRegionMatched = products.filter((product) => builderProductMatchesTokens(product, tokens));
      const targetTokens = exactRegionMatched.length ? tokens : fallbackTokens;
      return products.some((product) => {
        if (departureDateSet.size && !departureDateSet.has(product.departureDate)) return false;
        if (returnDateSet.size && !returnDateSet.has(product.returnDate || product.departureDate)) return false;
        return builderProductMatchesTokens(product, targetTokens);
      });
    }

    function setBuilderProductSort(sort) {
      regionProductSort = sort || "recommended";
      regionProductSortMenuOpen = false;
      renderBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "");
    }

    function getBuilderProductSortLabel(sort = regionProductSort) {
      return {
        recommended: "추천순",
        price: "낮은가격순",
        deadline: "마감임박순"
      }[sort] || "추천순";
    }

    function toggleBuilderProductSortMenu() {
      regionProductSortMenuOpen = !regionProductSortMenuOpen;
      renderBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "");
    }

    function renderBuilderRegionProductCard(product) {
      const selectedProduct = builderState.productId ? findBuilderProductById(builderState.productId) : null;
      const selectedClass = builderState.productId === product.id
        || (selectedProduct && getProductGroupKey(selectedProduct) === getProductGroupKey(product))
        ? " selected"
        : "";
      return `
        <article class="region-product-card${selectedClass}" onclick="openBuilderProductDetailModal('${product.id}')">
          <div class="region-product-thumb">
            <img src="${product.image}" alt="${product.title}">
          </div>
          <div class="region-product-info">
            <div class="region-product-meta">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/>
              </svg>
              <div class="region-product-location">${getJoinLocationLabel(product)}</div>
              ${renderJoinFlightChip(product)}
            </div>
            <div class="region-product-name">${product.title}</div>
            <div class="region-product-date">${formatCardDateRange(product)}${renderScheduleOverlapBadge(product, "", { includeOwn: true })}</div>
          </div>
          <div class="region-product-side">
            <div class="region-product-price">
              <div class="region-product-price-value">${formatPrice(product.price)}</div>
              <div class="region-product-price-unit">원</div>
            </div>
          </div>
        </article>
      `;
    }

    function renderBuilderRegionProducts(query = "") {
      const area = document.getElementById("builderRegionProductArea");
      if (!area) return;
      const products = getBuilderRegionProducts(query);
      const isLoading = !externalGolfJoinProducts && !externalGolfJoinProductsLoadFailed;
      const productDateLabel = getBuilderProductDateLabel();
      const isCompactProductView = window.innerWidth <= 640 || document.documentElement.clientWidth <= 640;
      const selectedProduct = builderState.productId ? findBuilderProductById(builderState.productId) : null;
      const hasSelectedProductGroup = selectedProduct && products.some((product) => (
        getProductGroupKey(product) === getProductGroupKey(selectedProduct)
      ));
      if (builderState.productId && !products.some((product) => product.id === builderState.productId) && !hasSelectedProductGroup) {
        builderState.productId = "";
        builderState.productName = "";
        builderState.productFamilyId = "";
        updateBuilderSummary();
      }
      const targetLabel = (builderState.regions && builderState.regions.length)
        ? builderState.regions.map(formatRegionDisplayName).join(", ")
        : String(query || "").trim();
      area.innerHTML = `
        <div class="builder-region-product-head">
          <div class="builder-region-product-count${isLoading ? " is-loading skeleton-glass-shimmer" : ""}"><div>${isLoading ? "상품을 확인하고 있어요" : `${products.length}개 상품`}${productDateLabel && !isCompactProductView ? `<span class="builder-region-product-date-context"> · ${productDateLabel}</span>` : ""}</div></div>
          <div class="builder-region-product-sort${regionProductSortMenuOpen ? " open" : ""}" aria-label="상품 정렬">
            <select onchange="setBuilderProductSort(this.value)">
              <option value="recommended" ${regionProductSort === "recommended" ? "selected" : ""}>추천순</option>
              <option value="price" ${regionProductSort === "price" ? "selected" : ""}>낮은가격순</option>
              <option value="deadline" ${regionProductSort === "deadline" ? "selected" : ""}>마감임박순</option>
            </select>
            <svg class="native-sort-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <button type="button" class="builder-region-sort-custom" aria-haspopup="listbox" aria-expanded="${regionProductSortMenuOpen ? "true" : "false"}" onclick="event.stopPropagation(); toggleBuilderProductSortMenu();">
              <span>${getBuilderProductSortLabel()}</span>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="builder-region-sort-menu" role="listbox">
              ${["recommended", "price", "deadline"].map((sort) => `
                <button type="button" role="option" aria-selected="${regionProductSort === sort ? "true" : "false"}" class="builder-region-sort-option${regionProductSort === sort ? " active" : ""}" onclick="event.stopPropagation(); setBuilderProductSort('${sort}')">${getBuilderProductSortLabel(sort)}</button>
              `).join("")}
            </div>
          </div>
        </div>
        ${products.length ? `
          <div class="builder-region-product-list">
            ${products.map(renderBuilderRegionProductCard).join("")}
          </div>
        ` : `<div class="builder-region-product-empty${isLoading ? " is-loading skeleton-glass-shimmer" : ""}"><div>${isLoading ? "상품을 확인하고 있어요" : `${targetLabel || "선택 조건"}${productDateLabel ? ` · ${productDateLabel}` : ""}에 맞는 상품이 없습니다.`}</div></div>`}
      `;
    }

    function selectBuilderProduct(productId) {
      const product = getBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "").find((item) => item.id === productId)
        || findBuilderProductById(productId);
      if (!product) return false;
      builderState.regionSelectionComplete = true;
      builderState.productId = product.id;
      builderState.productName = product.title;
      builderState.productFamilyId = getGolfJoinProductFamilyId(product);
      if (product.departureDate) {
        const departure = new Date(`${product.departureDate}T00:00:00`);
        if (!Number.isNaN(departure.getTime())) {
          builderState.viewYear = departure.getFullYear();
          builderState.viewMonth = departure.getMonth();
          builderState.startDay = getBuilderDayOffsetFromISO(product.departureDate, builderState.viewYear, builderState.viewMonth);
          builderState.endDay = getBuilderDayOffsetFromISO(product.returnDate || product.departureDate, builderState.viewYear, builderState.viewMonth);
          builderState.startBefore = 0;
          builderState.startAfter = 0;
          builderState.endBefore = 0;
          builderState.endAfter = 0;
        }
      }
      updateBuilderSummary();
      updateBuilderApplySummary();
      renderBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "");
      return true;
    }

    async function showBuilderProductDetailProduct(product, options = {}) {
      if (!product) return false;
      product = prepareSecretTourInitialFlightScheduleState(product);
      const detailScrollState = options.preserveScroll
        ? (options.scrollState || captureDetailModalScrollState())
        : null;
      currentDetailMode = "builderProduct";
      currentDetailJoinId = product.id;
      currentDetailJoinData = product;
      addJoinRecentViewedItem(product, "product");
      currentDetailSlideIndex = 0;
      stopDetailReviewAutoSlide();
      closeDetailApply();
      document.getElementById("detailModalTitle").textContent = product.title;
      renderDetailContent(product, { mode: "builder", hideParticipants: true });
      setDetailBuilderProductActions();
      document.getElementById("detailModal")?.classList.add("builder-select-mode", "builder-product-detail-mode");
      if (options.open !== false) await openModal("detailModal");
      elevateBuilderProductDetailModal();
      requestAnimationFrame(() => {
        elevateBuilderProductDetailModal();
        prepareDetailScheduleHeights({ forceOpen: true });
        if (detailScrollState) restoreDetailModalScrollState(detailScrollState);
        else resetDetailModalScroll();
      });
      try {
        const detail = await loadSecretTourGoodsDetail(product);
        const enrichedProduct = { ...mergeSecretTourGoodsDetail(product, detail), secretTourDetailLoaded: true };
        if (Array.isArray(externalGolfJoinProducts)) {
          externalGolfJoinProducts = externalGolfJoinProducts.map((item) => item.id === enrichedProduct.id ? enrichedProduct : item);
        }
        if (currentDetailMode === "builderProduct" && currentDetailJoinId === enrichedProduct.id && document.getElementById("detailModal")?.classList.contains("open")) {
          const currentScrollState = detailScrollState || captureDetailModalScrollState();
          currentDetailJoinData = enrichedProduct;
          addJoinRecentViewedItem(enrichedProduct, "product");
          currentDetailSlideIndex = 0;
          renderDetailContent(enrichedProduct, { mode: "builder", hideParticipants: true });
          requestAnimationFrame(() => {
            prepareDetailScheduleHeights({ forceOpen: true });
            restoreDetailModalScrollState(currentScrollState);
          });
        }
        void enrichSecretTourFlightScheduleInBackground(enrichedProduct, detail, enrichedProduct)
          .catch((error) => golfJoinSafeWarn("Failed to update builder product flight schedule.", error));
      } catch (error) {
        golfJoinSafeWarn(error);
      }
      return true;
    }

    async function openBuilderProductDetailModal(productId) {
      const product = getBuilderRegionProducts(document.getElementById("builderRegionSearchInput")?.value || "").find((item) => item.id === productId)
        || findBuilderProductById(productId);
      return showBuilderProductDetailProduct(product);
    }

    function showBuilderRegionSelector() {
      builderRegionSelectorMode = true;
      const input = document.getElementById("builderRegionSearchInput");
      if (input) input.value = "";
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      updateBuilderSummary();
      renderBuilderRegionSearch("");
    }

    function syncBuilderRegionAutoExpand(displayCategories) {
      if (!Array.isArray(displayCategories) || !displayCategories.length) return;
      const activeCategoryStillAvailable = displayCategories.some(({ categoryIndex }) => categoryIndex === activeBuilderRegionCategoryIndex);
      if (displayCategories.length === 1 || !activeCategoryStillAvailable) {
        activeBuilderRegionCategoryIndex = displayCategories[0].categoryIndex;
      }

      const activeCategoryItem = displayCategories.find(({ categoryIndex }) => categoryIndex === activeBuilderRegionCategoryIndex);
      if (!activeCategoryItem) return;
      const countries = getBuilderAvailableCountries(activeCategoryItem.category);
      const hasActiveCountryInCategory = countries.some(({ country, countryIndex }) => {
        const cities = Array.isArray(country?.cities) ? country.cities : [];
        return cities.length > 0 && activeBuilderRegionCountryKey === `${activeBuilderRegionCategoryIndex}:${countryIndex}`;
      });
      if (countries.length === 1) {
        const [{ country, countryIndex }] = countries;
        if (Array.isArray(country?.cities) && country.cities.length > 0) {
          activeBuilderRegionCountryKey = `${activeBuilderRegionCategoryIndex}:${countryIndex}`;
        }
        return;
      }
      if (!hasActiveCountryInCategory) {
        activeBuilderRegionCountryKey = getDefaultBuilderRegionCountryKey(activeBuilderRegionCategoryIndex);
      }
    }

    function renderBuilderRegionSearch(keyword = "") {
      const shell = document.querySelector(".builder-region-search");
      const body = document.getElementById("builderRegionSearchBody");
      const results = document.getElementById("builderRegionSearchResults");
      const productArea = document.getElementById("builderRegionProductArea");
      if (!shell || !body || !results || !productArea) return;
      const query = String(keyword || "").trim();
      shell.classList.toggle("searching", query.length > 0);
      const hasProductCriteria = query.length > 0 || (builderState.regions && builderState.regions.length > 0);
      const shouldShowProducts = hasProductCriteria && !builderRegionSelectorMode;
      shell.classList.toggle("has-product-results", shouldShowProducts);
      const input = document.getElementById("builderRegionSearchInput");
      if (input && shouldShowProducts && builderState.regions && builderState.regions.length) {
        input.value = builderState.regions.map(formatRegionDisplayName).join(", ");
      }
      updateBuilderRegionSearchInputClearPosition(input?.value || query);
      updateBuilderRegionDisplay();
      if (shouldShowProducts) {
        results.innerHTML = "";
        renderBuilderRegionProducts(query);
        return;
      }
      productArea.innerHTML = "";
      if (query) {
        const normalizedQuery = normalizeRegionKeyword(query);
        const matched = getMainJoinRegionSearchItems()
          .filter(([name]) => normalizeRegionKeyword(name).includes(normalizedQuery))
          .filter(([name]) => isBuilderRegionAvailableForDate(name, { country: !String(name || "").includes(",") }))
          .slice(0, 12);
        results.innerHTML = matched.length
          ? `<div class="region-result-suggestions">${matched.map(([name, type]) => `
              <button type="button" class="region-result-item" onclick="selectBuilderEmbeddedRegion('${name.replace(/'/g, "\\'")}')">
                <div class="region-result-pin">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2"/>
                    <circle cx="12" cy="11" r="2.3" stroke="currentColor" stroke-width="2"/>
                  </svg>
                </div>
                <div><div class="region-result-name">${name}</div><div class="region-result-type">${type}</div></div>
              </button>
            `).join("")}</div>`
          : `<div class="region-result-suggestions"><div class="region-result-empty">검색 결과가 없습니다.</div></div>`;
        return;
      }
      const displayCategories = getRegionDisplayCategories({ builderContext: true })
        .map(({ item, index }) => ({ category: item, categoryIndex: index }))
        .filter(({ category }) => isBuilderCategoryAvailable(category));
      syncBuilderRegionAutoExpand(displayCategories);
      body.innerHTML = displayCategories.length ? displayCategories.map(({ category, categoryIndex }) => {
        const countries = getBuilderAvailableCountries(category);
        const rows = [];
        for (let countryIndex = 0; countryIndex < countries.length; countryIndex += 2) {
          const rowCountries = countries.slice(countryIndex, countryIndex + 2);
          const rowCountryHtml = rowCountries.map(({ country, countryIndex: actualIndex }) => {
            const cities = Array.isArray(country.cities) ? country.cities : [];
            const key = `${categoryIndex}:${actualIndex}`;
            const isActive = activeBuilderRegionCountryKey === key && cities.length > 0;
            if (!cities.length) {
              return `<button type="button" class="region-option" onclick="selectBuilderEmbeddedRegion('${country.name.replace(/'/g, "\\'")}')"><span>${country.name}</span>${regionLeafHotBadgeHtml(country.name)}</button>`;
            }
            return `
              <button type="button" class="region-subgroup-toggle ${isActive ? "active" : ""}" onclick="toggleBuilderRegionCountry(${categoryIndex}, ${actualIndex})">
                <span>${country.name}</span>${regionCountryHotBadgeHtml(country)}
              </button>
            `;
          }).join("");
          const activeCountryItem = rowCountries.find(({ country, countryIndex: actualIndex }) => {
            const cities = Array.isArray(country.cities) ? country.cities : [];
            return cities.length > 0 && activeBuilderRegionCountryKey === `${categoryIndex}:${actualIndex}`;
          });
          const activeCountry = activeCountryItem?.country;
          const activeCities = getBuilderAvailableCities(activeCountry);
          rows.push(`
            <div class="region-grid-row">
              ${rowCountryHtml}
              ${activeCountry ? `
                <div class="region-subregion-list">
                  <button type="button" class="region-subregion-heading" onclick="selectBuilderEmbeddedRegion('${activeCountry.name.replace(/'/g, "\\'")}')"><span>${activeCountry.name} 전체</span>${regionCountryHotBadgeHtml(activeCountry, { hideForCountryAll: true })}</button>
                  ${activeCities.map((city) => {
                    const label = regionLabel(city, activeCountry.name);
                    return `<button type="button" class="region-subregion" onclick="selectBuilderEmbeddedRegion('${label.replace(/'/g, "\\'")}')"><span>${city}</span>${regionLeafHotBadgeHtml(label)}</button>`;
                  }).join("")}
                </div>
              ` : ""}
            </div>
          `);
        }
        return `
          <details class="region-group ${categoryIndex === 0 ? "featured" : ""}" ${categoryIndex === activeBuilderRegionCategoryIndex ? "open" : ""} ontoggle="handleBuilderRegionCategoryToggle(this, ${categoryIndex})">
            <summary>${category.category}</summary>
            <div class="region-grid-list">${rows.join("")}</div>
          </details>
        `;
      }).join("") : `<div class="region-result-empty">선택한 날짜 조건에 가능한 지역이 없습니다.</div>`;
    }

    function updateBuilderRegionSearchInputClearPosition(value = "") {
      const input = document.getElementById("builderRegionSearchInput");
      const field = input?.closest(".region-search-field");
      if (!input || !field) return;
      const text = String(value || input.value || "").trim();
      if (!text) {
        field.style.removeProperty("--region-search-input-width");
        return;
      }
      const style = window.getComputedStyle(input);
      const canvas = updateBuilderRegionSearchInputClearPosition.canvas || (updateBuilderRegionSearchInputClearPosition.canvas = document.createElement("canvas"));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
      const width = Math.ceil(context.measureText(text).width);
      field.style.setProperty("--region-search-input-width", `${Math.max(12, width)}px`);
    }

    function handleBuilderRegionCategoryToggle(details, categoryIndex) {
      if (!details.open) return;
      activeBuilderRegionCategoryIndex = categoryIndex;
      const defaultKey = getDefaultBuilderRegionCountryKey(categoryIndex);
      if (defaultKey && activeBuilderRegionCountryKey !== defaultKey) {
        activeBuilderRegionCountryKey = defaultKey;
        requestAnimationFrame(() => renderBuilderRegionSearch(document.getElementById("builderRegionSearchInput")?.value || ""));
      }
    }

    function toggleBuilderRegionCountry(categoryIndex, countryIndex) {
      const nextKey = `${categoryIndex}:${countryIndex}`;
      activeBuilderRegionCategoryIndex = categoryIndex;
      activeBuilderRegionCountryKey = activeBuilderRegionCountryKey === nextKey ? "" : nextKey;
      renderBuilderRegionSearch(document.getElementById("builderRegionSearchInput")?.value || "");
    }

    function selectBuilderEmbeddedRegion(name) {
      builderRegionSelectorMode = false;
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      const current = builderState.regions || [];
      builderState.regions = current.includes(name) ? [] : [name];
      builderState.region = builderState.regions.join(", ");
      builderState.dateConstraintRegions = builderState.regions.slice();
      regionRecent = [name, ...regionRecent.filter((item) => item !== name)].slice(0, 4);
      const input = document.getElementById("builderRegionSearchInput");
      if (input) input.value = builderState.regions.map(formatRegionDisplayName).join(", ");
      updateBuilderRegionDisplay();
      updateBuilderSummary();
      renderBuilderRegionSearch("");
    }

    function handleBuilderRegionSearchInput(value) {
      builderRegionSelectorMode = false;
      builderState.regions = [];
      builderState.region = "";
      builderState.dateConstraintRegions = [];
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      updateBuilderSummary();
      renderBuilderRegionSearch(value);
    }

    function clearBuilderRegionSearchInput() {
      const input = document.getElementById("builderRegionSearchInput");
      if (input) {
        input.value = "";
        input.focus();
      }
      builderRegionSelectorMode = true;
      builderState.regions = [];
      builderState.region = "";
      builderState.dateConstraintRegions = [];
      builderState.productId = "";
      builderState.productName = "";
      builderState.productFamilyId = "";
      updateBuilderSummary();
      renderBuilderRegionSearch("");
    }

    function renderRegionSelected() {
      const list = document.getElementById("regionSelectedList");
      if (!list) return;
      const selected = builderState.regions || [];
      list.innerHTML = selected.length
        ? selected.map((name) => `
          <button type="button" class="region-selected-item" onclick="toggleRegionSelection('${name.replace(/'/g, "\\'")}')">
            <div>${formatRegionDisplayHtml(name)}</div>
            <div class="region-recent-remove">×</div>
          </button>
        `).join("")
        : `<div class="region-result-empty">선택한 지역이 없습니다.</div>`;
    }

    function renderRegionRecent() {
      const list = document.getElementById("regionRecentList");
      if (!list) return;
      const hotRegions = getRegionSearchHotRegions().map((item) => item.name);
      const slideRegions = [...hotRegions, ...hotRegions.slice(0, 2)];
      list.classList.add("region-hot-window");
      list.innerHTML = `
        <div class="region-hot-track">
          ${slideRegions.map((name) => `
            <button type="button" class="region-recent-item region-hot-row" onclick="selectDesktopRegion('${name.replace(/'/g, "\\'")}')">
              <div>${formatRegionDisplayHtml(name)}</div>
            </button>
          `).join("")}
        </div>
      `;
    }

    function getRegionSearchHotRegionName(join = {}) {
      const region = String(join.region || join.area || join.city || join.location || "").split(",")[0]?.trim() || "";
      const country = String(join.country || join.countryName || inferDetailCountryName(region, join) || "").trim();
      return regionLabel(region, country) || country || region;
    }

    function getRegionSearchSubmittedTimestamp(join = {}) {
      const raw = join.submittedAt || join.createdAt || join.updatedAt || join.sheetApplication?.submittedAt || "";
      const timestamp = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function getRegionSearchHotRegions() {
      const regionMap = new Map();
      const today = getTodayDate();
      const recentLimit = new Date(today);
      recentLimit.setDate(recentLimit.getDate() - 7);
      const upsert = (name, condition) => {
        if (!name || !condition) return;
        const key = normalizeRegionKeyword(name);
        if (!key) return;
        if (!regionMap.has(key)) {
          regionMap.set(key, { name, priority: condition.priority, message: condition.message, count: 0, earliest: "9999-12-31" });
        }
        const item = regionMap.get(key);
        item.count += Number(condition.count || 0);
        if (condition.priority < item.priority) {
          item.priority = condition.priority;
          item.message = condition.message;
        }
        if (condition.earliest && condition.earliest < item.earliest) item.earliest = condition.earliest;
      };

      const userCreatedJoins = joins.filter(isUserCreatedJoinSchedule);
      const groupedCreated = new Map();
      userCreatedJoins.forEach((join) => {
        const name = getRegionSearchHotRegionName(join);
        if (!name) return;
        const key = normalizeRegionKeyword(name);
        if (!groupedCreated.has(key)) groupedCreated.set(key, { name, count: 0, earliest: "9999-12-31", latestSubmittedAt: 0 });
        const item = groupedCreated.get(key);
        item.count += 1;
        const departureDate = String(join.departureDate || "");
        if (departureDate && departureDate < item.earliest) item.earliest = departureDate;
        item.latestSubmittedAt = Math.max(item.latestSubmittedAt, getRegionSearchSubmittedTimestamp(join));
      });

      groupedCreated.forEach((item) => {
        if (item.latestSubmittedAt >= recentLimit.getTime()) {
          upsert(item.name, { priority: 1, message: "새 모임이 방금 열렸어요", count: item.count, earliest: item.earliest });
        } else if (item.count >= 2) {
          upsert(item.name, { priority: 2, message: "여러 모임이 모집중이에요", count: item.count, earliest: item.earliest });
        } else {
          upsert(item.name, { priority: 3, message: "새 모임이 열려 있어요", count: item.count, earliest: item.earliest });
        }
      });

      const visibleProducts = typeof getVisibleJoinProducts === "function" ? getVisibleJoinProducts() : joins;
      const soonProducts = visibleProducts.filter((join) => !join?.isSoonLoadMoreFixture && isSoonCandidate(join));
      getQuickDeadlineItems(soonProducts).forEach((join) => {
        const name = getRegionSearchHotRegionName(join);
        upsert(name, { priority: 4, message: "곧 출발하는 일정이 있어요", count: 1, earliest: String(join.departureDate || "9999-12-31") });
      });

      visibleProducts.forEach((join) => {
        const name = getRegionSearchHotRegionName(join);
        const capacity = getJoinRecruitmentCapacity(join, Number(join.maxCapacity || join.capacity || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY);
        const confirmedCount = getConfirmedParticipants(join).length || Number(join.participantSummary?.confirmedCount || join.participantCount || 0) || 0;
        const remainingSeats = Number.isFinite(Number(join.emptySlots))
          ? Number(join.emptySlots)
          : Math.max(0, capacity - confirmedCount);
        if (remainingSeats > 0 && remainingSeats <= 1) {
          upsert(name, { priority: 5, message: "남은 자리가 많지 않아요", count: 1, earliest: String(join.departureDate || "9999-12-31") });
        }
        const days = getJoinDaysFromToday(join);
        if (Number.isFinite(days) && days >= 7 && days <= 14) {
          upsert(name, { priority: 6, message: "가까운 출발일이 있어요", count: 1, earliest: String(join.departureDate || "9999-12-31") });
        }
      });

      regionRecent.forEach((name, index) => {
        upsert(name, { priority: 7 + index / 10, message: "많은 분들이 찾고 있어요", count: 1 });
      });

      return Array.from(regionMap.values())
        .sort((a, b) => a.priority - b.priority || b.count - a.count || a.earliest.localeCompare(b.earliest) || a.name.localeCompare(b.name, "ko"))
        .slice(0, 4)
        .map((item) => ({
          name: item.name,
          message: item.message
        }));
    }

    function regionQuickItemHtml(item) {
      const name = typeof item === "string" ? item : item.name;
      const message = typeof item === "string" ? "" : item.message;
      const safeName = String(name || "").replace(/'/g, "\\'");
      return `
        <button type="button" class="region-search-quickitem" onclick="selectDesktopRegion('${safeName}')">
          <span>${formatRegionDisplayName(name)}</span>
          ${message ? `<span class="region-search-quickmeta">${message}</span>` : ""}
        </button>
      `;
    }

    function regionRecentQuickItemHtml(name, index) {
      const safeName = String(name || "").replace(/'/g, "\\'");
      return `
        <div class="region-search-recentrow">
          <button type="button" class="region-search-quickitem" onclick="selectDesktopRegion('${safeName}')">
            <span>${formatRegionDisplayName(name)}</span>
          </button>
          <button type="button" class="region-search-remove" onclick="event.stopPropagation(); removeRegionRecent(${index})" aria-label="최근 검색 지역 삭제">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      `;
    }

    function renderRegionQuickbar() {
      const hotList = document.getElementById("regionHotList");
      const recentList = document.getElementById("regionQuickRecentList");
      if (!hotList || !recentList) return;

      const hotRegions = getRegionSearchHotRegions();
      const shouldSlide = hotRegions.length >= 4;
      const hotRows = shouldSlide ? [...hotRegions, ...hotRegions] : hotRegions.slice(0, 3);
      hotList.classList.toggle("is-sliding", shouldSlide);
      hotList.style.setProperty("--region-quick-slide-distance", `${hotRegions.length * 38}px`);
      hotList.style.setProperty("--region-quick-slide-steps", hotRegions.length);
      hotList.style.setProperty("--region-quick-slide-duration", `${hotRegions.length * 3}s`);
      hotList.innerHTML = hotRows.length
        ? `<div class="region-search-quicktrack">${hotRows.map((item) => regionQuickItemHtml(item)).join("")}</div>`
        : `<div class="region-result-empty">추천 지역이 없습니다.</div>`;

      recentList.innerHTML = regionRecent.length
        ? regionRecent.slice(0, 4).map((name, index) => regionRecentQuickItemHtml(name, index)).join("")
        : "";
    }

    function setRegionSearchPanelMode(mode = "") {
      const shell = document.querySelector("#regionSearchModal .region-search-shell");
      if (!shell) return;
      shell.classList.remove("region-panel-hot", "region-panel-recent", "region-panel-cities");
      if (mode) shell.classList.add(`region-panel-${mode}`);
      document.querySelectorAll("[data-region-panel-button]").forEach((button) => {
        const isActive = button.dataset.regionPanelButton === mode;
        button.classList.toggle("active", isActive);
        button.textContent = `${button.dataset.regionPanelButton === "hot" ? "지금 핫한 지역" : button.dataset.regionPanelButton === "recent" ? "최근 검색한 지역" : "주요도시"} ${isActive ? "닫기" : "열기"}`;
      });
    }

    function toggleRegionSearchPanel(mode) {
      const shell = document.querySelector("#regionSearchModal .region-search-shell");
      const isOpen = shell?.classList.contains(`region-panel-${mode}`);
      setRegionSearchPanelMode(isOpen ? "" : mode);
      if (!isOpen) {
        renderRegionQuickbar();
        renderRegionDesktop();
      }
    }

    function selectRegionCategory(index) {
      activeRegionCategoryIndex = index;
      activeRegionCountryIndex = regionSearchContext === "builder"
        ? getFirstBuilderAvailableCountryIndex(getActiveRegionTree()[index])
        : regionSearchContext === "mdpick"
          ? getFirstMdPickAvailableCountryIndex(getActiveRegionTree()[index])
        : 0;
      renderRegionDesktop();
    }

    function selectRegionCountry(index) {
      activeRegionCountryIndex = index;
      renderRegionDesktop();
    }

    function selectDesktopRegion(name) {
      selectRegionResult(name);
    }

    function toggleRegionSelection(name) {
      const current = builderState.regions || [];
      builderState.regions = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
      renderRegionSelected();
    }

    function clearRegionSelected() {
      builderState.regions = [];
      renderRegionSelected();
    }

    function confirmRegionSelection() {
      if (regionSearchContext !== "builder") return;
      builderState.region = (builderState.regions || []).join(", ");
      updateBuilderRegionDisplay();
      closeRegionSearchModal();
      setWidgetModalOpen(true);
      regionSearchContext = "default";
    }

    function selectRegionResult(name) {
      if (regionSearchContext === "builder" && !isBuilderRegionAvailableForDate(name, { country: !String(name || "").includes(",") })) return;
      if (regionSearchContext === "mdpick" && !hasMdPickRegionProducts(name, { country: !String(name || "").includes(",") })) return;
      regionRecent = [name, ...regionRecent.filter((item) => item !== name)].slice(0, 4);
      if (regionSearchContext === "builder") {
        toggleRegionSelection(name);
        renderRegionRecent();
        renderRegionQuickbar();
        return;
      }
      selectedRegionSearchName = name;
      regionProductSort = "recommended";
      regionProductSortMenuOpen = false;
      document.querySelector("#regionSearchModal .region-search-shell")?.classList.add("has-region-selection");
      const input = document.getElementById("regionSearchInput");
      if (input) input.value = formatRegionDisplayName(name);
      updateRegionSearchQueryState(input?.value || name);
      updateRegionSearchSelectedText();
      performRegionProductSearch();
      renderRegionQuickbar();
    }

    function removeRegionRecent(index) {
      regionRecent.splice(index, 1);
      renderRegionRecent();
      renderRegionQuickbar();
    }

    function clearRegionRecent() {
      regionRecent = [];
      renderRegionRecent();
      renderRegionQuickbar();
    }

    function updateRegionSearchSelectedText() {
      return;
    }

    function handleRegionSearchInput(keyword) {
      selectedRegionSearchName = "";
      regionProductSort = "recommended";
      regionProductSortMenuOpen = false;
      document.querySelector("#regionSearchModal .region-search-shell")?.classList.remove("has-region-selection");
      updateRegionSearchSelectedText();
      updateRegionSearchQueryState(keyword);
      setRegionSearchPanelMode("");
      renderRegionSearchResults(keyword);
    }

    function updateRegionSearchQueryState(value) {
      document.querySelector("#regionSearchModal .region-search-shell")?.classList.toggle("has-region-query", String(value || "").trim().length > 0);
      updateRegionSearchInputClearPosition(value);
    }

    function updateRegionSearchInputClearPosition(value = "") {
      const input = document.getElementById("regionSearchInput");
      const field = input?.closest(".region-search-field");
      if (!input || !field) return;
      const text = String(value || input.value || "").trim();
      if (!text) {
        field.style.removeProperty("--region-search-input-width");
        return;
      }
      const style = window.getComputedStyle(input);
      const canvas = updateRegionSearchInputClearPosition.canvas || (updateRegionSearchInputClearPosition.canvas = document.createElement("canvas"));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
      const width = Math.ceil(context.measureText(text).width);
      field.style.setProperty("--region-search-input-width", `${Math.max(12, width)}px`);
    }

    function clearRegionSearchInput() {
      const input = document.getElementById("regionSearchInput");
      if (input) {
        input.value = "";
        input.focus();
      }
      selectedRegionSearchName = "";
      regionProductSort = "recommended";
      regionProductSortMenuOpen = false;
      document.querySelector("#regionSearchModal .region-search-shell")?.classList.remove("has-region-selection");
      updateRegionSearchQueryState("");
      setRegionSearchPanelMode("");
      renderRegionSearchResults("");
      updateRegionSearchSelectedText();
    }

    function openRegionAllPanel() {
      const shell = document.querySelector("#regionSearchModal .region-search-shell");
      const isOpen = shell?.classList.contains("region-panel-cities");
      shell?.classList.remove("searching");
      setRegionSearchPanelMode(isOpen ? "" : "cities");
      if (!isOpen) {
        renderRegionDesktop();
        renderRegionMobile();
      }
    }

    function renderRegionSearchResults(keyword) {
      const shell = document.querySelector("#regionSearchModal .region-search-shell");
      const list = document.getElementById("regionSearchResults");
      const query = keyword.trim();
      shell.classList.toggle("searching", query.length > 0);
      shell.classList.remove("has-product-results");
      if (!query) {
        list.innerHTML = "";
        return;
      }
      const normalizedQuery = normalizeRegionKeyword(query);
      const results = getRegionBodySearchItems()
        .filter(([name, type, searchText]) => normalizeRegionKeyword(searchText || `${name} ${type}`).includes(normalizedQuery))
        .map(([name, type]) => [name, type]);
      if (!results.length) {
        list.innerHTML = `<div class="region-result-suggestions"><div class="region-result-empty">검색 결과가 없습니다.</div></div>`;
        return;
      }
      list.innerHTML = `<div class="region-result-suggestions">${results.map(([name, type]) => `
        <button type="button" class="region-result-item" onclick="selectRegionResult('${name.replace(/'/g, "\\'")}')">
          <div class="region-result-pin">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2"/>
              <circle cx="12" cy="11" r="2.3" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div><div class="region-result-name">${formatRegionResultName(name)}</div><div class="region-result-type">${type}</div></div>
        </button>
      `).join("")}</div>`;
    }

    function normalizeRegionKeyword(value) {
      return String(value || "").replace(/\s+/g, "").replace(/[(),·/]/g, "").toLowerCase();
    }

    function getRegionMasterCountryMap() {
      const countries = new Map();
      (regionTree || []).forEach((category) => {
        (category.countries || []).forEach((country) => {
          const name = String(country.name || "").trim();
          if (!name) return;
          countries.set(normalizeRegionKeyword(name), {
            category: category.category || "",
            name,
            cities: new Set((country.cities || []).map((city) => normalizeRegionKeyword(city)).filter(Boolean)),
            cityNames: country.cities || []
          });
        });
      });
      return countries;
    }

    function inferRegionMasterProductCountry(product = {}, countryMap = getRegionMasterCountryMap()) {
      const direct = [product.country, product.countryName, product.nation, product.productCountry, product.erpCountry]
        .map((value) => String(value || "").trim())
        .find(Boolean);
      if (direct) return direct;
      const regionText = [product.region, product.area, product.city, product.location]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ");
      const regionKey = normalizeRegionKeyword(regionText);
      for (const country of countryMap.values()) {
        if (regionKey && regionKey === normalizeRegionKeyword(country.name)) return country.name;
        if (regionKey && country.cities.has(regionKey)) return country.name;
      }
      const haystack = normalizeRegionKeyword([
        product.title,
        product.productName,
        product.goodName,
        product.region,
        product.area,
        product.city,
        product.location
      ].filter(Boolean).join(" "));
      for (const country of countryMap.values()) {
        if (haystack.includes(normalizeRegionKeyword(country.name))) return country.name;
      }
      return "";
    }

    function inferRegionMasterProductRegion(product = {}, countryName = "", countryMap = getRegionMasterCountryMap()) {
      const rawRegion = [product.region, product.area, product.city, product.location]
        .map((value) => String(value || "").trim())
        .find(Boolean) || "";
      const country = countryMap.get(normalizeRegionKeyword(countryName));
      const directRegion = String(rawRegion || "").split(",").map((part) => part.trim()).filter(Boolean)[0] || "";
      if (directRegion && normalizeRegionKeyword(directRegion) !== normalizeRegionKeyword(countryName)) return directRegion;
      if (!country) return directRegion;
      const haystack = normalizeRegionKeyword([product.title, product.productName, product.goodName, rawRegion].filter(Boolean).join(" "));
      return (country.cityNames || []).find((city) => haystack.includes(normalizeRegionKeyword(city))) || directRegion;
    }

    function auditGolfJoinRegionMaster() {
      const countryMap = getRegionMasterCountryMap();
      const searchItemKeys = new Set(getRegionBodySearchItems().map(([name]) => normalizeRegionKeyword(name)));
      const products = (typeof getBuilderProductSource === "function" ? getBuilderProductSource() : [])
        .filter((product) => product && (product.title || product.productName || product.region));
      const missingCountries = new Map();
      const missingCities = new Map();
      const missingSearchItems = new Map();
      products.forEach((product) => {
        const countryName = inferRegionMasterProductCountry(product, countryMap);
        const regionName = inferRegionMasterProductRegion(product, countryName, countryMap);
        if (!countryName) return;
        const countryKey = normalizeRegionKeyword(countryName);
        const country = countryMap.get(countryKey);
        const title = product.title || product.productName || product.goodName || product.id || "";
        if (!country) {
          if (!missingCountries.has(countryName)) missingCountries.set(countryName, { country: countryName, examples: [] });
          missingCountries.get(countryName).examples.push(title);
          return;
        }
        if (!searchItemKeys.has(countryKey)) {
          missingSearchItems.set(country.name, { name: country.name, type: "country", expected: country.name });
        }
        const regionKey = normalizeRegionKeyword(regionName);
        if (!regionKey || regionKey === countryKey) return;
        if (!country.cities.has(regionKey)) {
          const key = `${country.name}|${regionName}`;
          if (!missingCities.has(key)) missingCities.set(key, { country: country.name, city: regionName, examples: [] });
          missingCities.get(key).examples.push(title);
        }
        const searchName = regionLabel(regionName, country.name);
        if (!searchItemKeys.has(normalizeRegionKeyword(searchName))) {
          missingSearchItems.set(searchName, { name: searchName, type: "city", expected: searchName });
        }
      });
      const result = {
        productCount: products.length,
        missingCountries: [...missingCountries.values()].map((item) => ({ ...item, examples: item.examples.slice(0, 3) })),
        missingCities: [...missingCities.values()].map((item) => ({ ...item, examples: item.examples.slice(0, 3) })),
        missingSearchItems: [...missingSearchItems.values()]
      };
      if (result.missingCountries.length || result.missingCities.length || result.missingSearchItems.length) {
        console.groupCollapsed("[GolfJoin] Region master audit");
        golfJoinSafeLog(result);
        if (result.missingCountries.length) console.table(result.missingCountries);
        if (result.missingCities.length) console.table(result.missingCities);
        if (result.missingSearchItems.length) console.table(result.missingSearchItems);
        console.groupEnd();
      }
      return result;
    }

    window.auditGolfJoinRegionMaster = auditGolfJoinRegionMaster;

    function getRegionSearchTokens(value) {
      const rawParts = String(value || "").split(/[,\s/·()]+/).map((item) => item.trim()).filter(Boolean);
      const tokens = [...rawParts, value].filter(Boolean);
      const aliases = {
        "베트남": ["다낭", "푸꾸옥", "하노이", "호치민", "나트랑"],
        "태국": ["방콕", "파타야", "후아힌", "치앙마이", "카오야이", "푸켓"],
        "필리핀": ["마닐라", "세부", "클락"],
        "일본": ["미야자키", "후쿠오카", "오키나와", "구마모토"],
        "국내": ["국내", "제주", "경기", "강원", "경남"],
        "해외": ["해외", "방콕", "다낭", "괌", "클락"]
      };
      rawParts.forEach((part) => {
        (aliases[part] || []).forEach((alias) => tokens.push(alias));
      });
      return [...new Set(tokens.map(normalizeRegionKeyword).filter(Boolean))];
    }

    function getSpecificRegionSearchTokens(value) {
      const text = String(value || "").trim();
      if (!text.includes(",")) return [];
      const parts = text.split(",").map((item) => item.trim()).filter(Boolean);
      return [text, parts[0]].map(normalizeRegionKeyword).filter(Boolean);
    }

    function joinMatchesRegionSearch(join, query) {
      const specificTokens = getSpecificRegionSearchTokens(query);
      if (specificTokens.length) {
        const specificHaystack = normalizeRegionKeyword([
          join.title,
          join.region,
          ...getJoinRegionSearchNames(join)
        ].filter(Boolean).join(" "));
        return specificTokens.some((token) => specificHaystack.includes(token));
      }
      const tokens = getRegionSearchTokens(query);
      if (!tokens.length) return false;
      const haystack = normalizeRegionKeyword([
        join.title,
        join.region,
        join.category,
        join.departureAirport,
        join.airport,
        join.badge,
        ...getJoinRegionSearchNames(join),
        ...(join.includes || [])
      ].filter(Boolean).join(" "));
      return tokens.some((token) => haystack.includes(token));
    }

    function renderRegionProductCard(join, options = {}) {
      const participantCapacity = getJoinRecruitmentCapacity(join, Number(join.maxCapacity || join.capacity || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY);
      const showMonthlyParticipantSummary = isMonthlyRecommendationJoin(join) || participantCapacity > JOIN_MAX_CAPACITY;
      const cardOnClick = options.onClick || `openDetail('${escapeJsString(join.id)}')`;
      const adminRecommendedBadges = join.isAdminRecommendedSchedule
        ? (isMonthlyRecommendationJoin(join)
          ? '<div class="region-product-admin-badges"><div class="region-product-admin-badge recommended monthly">\uC6D4\uB840\uD68C</div></div>'
          : '<div class="region-product-admin-badges"><span class="region-product-admin-badge lowest-price">\uCD5C\uC800\uAC00</span><span class="region-product-admin-badge recommended">\uCD94\uCC9C\uC77C\uC815</span></div>')
        : "";
      return `
        <article class="region-product-card" onclick="${cardOnClick}">
          <div class="region-product-thumb">
            <img src="${join.image}" alt="${join.title}">
          </div>
          <div class="region-product-info">
            <div class="region-product-meta">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/>
              </svg>
              <div class="region-product-location">${getRegionProductLocationLabel(join)}</div>
              ${adminRecommendedBadges}
            </div>
            <div class="region-product-name">${join.title}</div>
            <div class="region-product-date">${formatCardDateRange(join)}${renderScheduleOverlapBadge(join, "", { includeOwn: true })}</div>
          </div>
          <div class="region-product-side">
            <div class="region-product-price">
              <div class="region-product-price-value">${formatPrice(join.price)}</div>
              <div class="region-product-price-unit">원</div>
            </div>
            <div class="region-product-team${showMonthlyParticipantSummary ? " monthly-summary" : ""}">
              ${showMonthlyParticipantSummary ? renderMonthlyCalendarParticipantSummary(join) : renderCardTeamSlots(join)}
            </div>
          </div>
        </article>
      `;
    }

    function sortRegionProductResults(results) {
      const sorted = [...results];
      if (regionProductSort === "price") {
        sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      } else if (regionProductSort === "deadline") {
        sorted.sort((a, b) => {
          const aOneSeat = Number(a.emptySlots) === 1 ? 0 : 1;
          const bOneSeat = Number(b.emptySlots) === 1 ? 0 : 1;
          if (aOneSeat !== bOneSeat) return aOneSeat - bOneSeat;
          return parseJoinDate(a.departureDate) - parseJoinDate(b.departureDate);
        });
      }
      return sorted;
    }

    function setRegionProductSort(sort) {
      regionProductSort = sort;
      regionProductSortMenuOpen = false;
      performRegionProductSearch();
    }

    function setRegionEmptyRecommendType(type) {
      regionEmptyRecommendType = SHOW_DOMESTIC_JOIN_PRODUCTS ? type : "overseas";
      performRegionProductSearch();
    }

    function openBuilderFromRegionSearch() {
      const inputValue = document.getElementById("regionSearchInput")?.value.trim() || "";
      pendingBuilderRegion = selectedRegionSearchName || inputValue || "";
      closeRegionSearchModal();
      openModal("builderModal");
      if (pendingBuilderRegion) {
        builderState.region = pendingBuilderRegion;
        builderState.regions = [pendingBuilderRegion];
        builderState.dateConstraintRegions = [pendingBuilderRegion];
        builderRegionSelectorMode = false;
        updateBuilderRegionDisplay();
        updateBuilderSummary();
        renderBuilderCalendar();
        ensureExternalGolfJoinProductsLoaded().then(() => {
          if (document.getElementById("builderModal")?.classList.contains("open") && builderStep === 1 && builderState.dateConstraintRegions.includes(pendingBuilderRegion)) {
            renderBuilderCalendar();
          }
        });
      }
    }

    function getJoinRecommendationRegionParts(region = "", products = []) {
      const text = String(region || "").trim();
      const [regionName = "", countryFromRegion = ""] = text.split(",").map((part) => part.trim());
      if (countryFromRegion) return { regionName, countryName: countryFromRegion };
      const source = products.find(Boolean) || {};
      const fieldCountry = [
        source.country,
        source.countryName,
        source.nation,
        source.productCountry,
        source.erpCountry
      ].map((value) => String(value || "").trim()).find(Boolean);
      if (fieldCountry && fieldCountry !== regionName) return { regionName: regionName || fieldCountry, countryName: fieldCountry };
      const haystack = [source.title, source.productName, source.region, source.location].map((value) => String(value || "")).join(" ");
      const knownCountries = ["태국", "베트남", "필리핀", "일본", "중국", "대만", "라오스", "말레이시아", "인도네시아", "미얀마", "브루나이", "괌", "사이판"];
      const inferredCountry = knownCountries.find((country) => haystack.includes(country) && country !== regionName) || "";
      return { regionName: regionName || inferredCountry, countryName: inferredCountry };
    }

    function renderJoinRecommendationRegionLabel(region = "", products = []) {
      const { regionName, countryName } = getJoinRecommendationRegionParts(region, products);
      const displayName = [regionName, countryName].filter(Boolean).join(", ");
      return `
        <div class="region-empty-recommend-region-name">
          <svg class="region-empty-recommend-pin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <div class="region-empty-recommend-region-text">${escapeHtml(displayName || region)}</div>
        </div>
      `;
    }

    function renderEmptyRegionRecommendations(query, options = {}) {
      const activeType = SHOW_DOMESTIC_JOIN_PRODUCTS && regionEmptyRecommendType === "domestic" ? "domestic" : "overseas";
      const title = options.title || "지금 합류 가능한 다른 지역";
      const setTypeHandler = options.setTypeHandler || "setRegionEmptyRecommendType";
      const moreHandler = options.moreHandler || "selectRegionResult";
      const excludeActiveScheduleOverlaps = options.excludeActiveScheduleOverlaps === true;
      const groups = new Map();
      getVisibleCalendarJoinProducts()
        .filter((join) => Number(join.emptySlots) > 0
          && join.region
          && !joinMatchesRegionSearch(join, query)
          && getJoinCategoryClass(join) === activeType
          && (!excludeActiveScheduleOverlaps || !isJoinExcludedFromMyReservationRecommendations(join)))
        .forEach((join) => {
          if (!groups.has(join.region)) groups.set(join.region, []);
          groups.get(join.region).push(join);
        });
      const items = [...groups.entries()].slice(0, 4).map(([region, products]) => [region, products.slice(0, 2), products.length]);
      if (!items.length) return "";
      const columns = [[], []];
      const columnWeights = [0, 0];
      const balancedItems = items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => b.item[1].length - a.item[1].length || a.index - b.index);
      balancedItems.forEach(({ item }) => {
        const targetIndex = columnWeights[0] <= columnWeights[1] ? 0 : 1;
        columns[targetIndex].push(item);
        columnWeights[targetIndex] += item[1].length;
      });
      const renderRecommendationGroup = ([region, products, totalCount]) => `
        <div class="region-empty-recommend-group">
          <div class="region-empty-recommend-region">
            ${renderJoinRecommendationRegionLabel(region, products)}
            ${totalCount >= 3 ? `<button type="button" class="region-empty-recommend-more" onclick="${moreHandler}('${escapeJsString(region)}')">더보기<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg></button>` : ""}
          </div>
          ${products.map((join) => `
            <button type="button" class="region-empty-recommend-card" onclick="openDetail('${escapeJsString(join.id)}')">
              <div class="region-empty-recommend-thumb"><img src="${escapeHtml(join.image || "")}" alt="${escapeHtml(join.title || "")}"></div>
              <div class="region-empty-recommend-info">
                <div class="region-empty-recommend-name">${escapeHtml(join.title || "")}</div>
                <div class="region-empty-recommend-meta">${escapeHtml(formatCardDateRange(join))}</div>
                <div class="region-empty-recommend-bottom">
                  <div class="region-empty-recommend-price">${formatPrice(join.price)}원</div>
                  <div class="region-empty-recommend-slot">${escapeHtml(String(join.emptySlots || 0))}자리 남았어요</div>
                </div>
              </div>
            </button>
          `).join("")}
          <div class="region-empty-recommend-mobile-list calendar-accordion-list">
            ${products.map((join) => renderRegionProductCard(join, { showDetailButton: true })).join("")}
          </div>
        </div>
      `;
      return `
        <div class="region-empty-recommend">
          <div class="region-empty-recommend-title">${escapeHtml(title)}</div>
          <div class="region-empty-recommend-tabs" role="tablist" aria-label="추천 지역 분류">
            <button type="button" class="region-empty-recommend-tab ${activeType === "overseas" ? "active" : ""}" onclick="${setTypeHandler}('overseas')">해외</button>
            ${SHOW_DOMESTIC_JOIN_PRODUCTS ? `<button type="button" class="region-empty-recommend-tab ${activeType === "domestic" ? "active" : ""}" onclick="${setTypeHandler}('domestic')">국내</button>` : ""}
          </div>
          <div class="region-empty-recommend-grid">
            ${columns.map((column) => `
              <div class="region-empty-recommend-column">
                ${column.map(renderRecommendationGroup).join("")}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }

    function performRegionProductSearch() {
      const shell = document.querySelector("#regionSearchModal .region-search-shell");
      const list = document.getElementById("regionSearchResults");
      const inputValue = document.getElementById("regionSearchInput")?.value.trim() || "";
      const query = selectedRegionSearchName || inputValue;
      shell?.classList.toggle("has-region-selection", Boolean(selectedRegionSearchName));
      shell?.classList.add("has-product-results");
      shell?.classList.remove("searching");
      updateRegionSearchQueryState(query);
      setRegionSearchPanelMode("");
      updateRegionSearchSelectedText();
      if (!query) {
        list.innerHTML = `<div class="region-result-empty">검색어를 입력하거나 국가 또는 지역을 선택해 주세요.</div>`;
        return;
      }
      if (regionSearchContext === "mdpick") {
        const results = getMdPickRegionProducts(query);
        if (!results.length) {
          const emptyRegionName = escapeHtml(formatRegionDisplayName(query) || query);
          list.innerHTML = `<div class="region-result-empty">ERP에 등록된 ${emptyRegionName} 상품이 없습니다.</div>`;
          return;
        }
        list.innerHTML = `
          <div class="region-product-head">
            <div class="region-product-count"><strong>${results.length}</strong>개 상품</div>
            <div class="region-product-sort" aria-label="상품 정렬">
              <button type="button" class="${regionProductSort === "recommended" ? "active" : ""}" onclick="setRegionProductSort('recommended')">추천순</button>
              <button type="button" class="${regionProductSort === "price" ? "active" : ""}" onclick="setRegionProductSort('price')">낮은가격순</button>
              <button type="button" class="${regionProductSort === "deadline" ? "active" : ""}" onclick="setRegionProductSort('deadline')">빠른출발순</button>
            </div>
          </div>
          <div class="region-product-grid">
            ${results.map(renderMdPickRegionProductCard).join("")}
          </div>
        `;
        return;
      }
      const results = sortRegionProductResults(getVisibleCalendarJoinProducts().filter((join) => joinMatchesRegionSearch(join, query))).slice(0, 12);
      if (!results.length) {
        list.innerHTML = `
          <div class="region-result-empty">
            <div class="region-result-empty-copy"><div class="region-result-empty-title">이 지역에는 아직 등록된 일정이 없어요.</div><div class="region-result-empty-action-line">직접 모임을 만들어 멤버를 초대해보세요.</div></div>
            <div><button type="button" class="region-result-empty-action" onclick="openBuilderFromRegionSearch()">새 모임 만들기</button></div>
          </div>
          ${renderEmptyRegionRecommendations(query)}
        `;
        return;
      }
      list.innerHTML = `
        <div class="region-product-head">
          <div class="region-product-count"><strong>${results.length}</strong>개 상품</div>
          <div class="region-product-sort" aria-label="상품 정렬">
            <button type="button" class="${regionProductSort === "recommended" ? "active" : ""}" onclick="setRegionProductSort('recommended')">추천순</button>
            <button type="button" class="${regionProductSort === "price" ? "active" : ""}" onclick="setRegionProductSort('price')">낮은가격순</button>
            <button type="button" class="${regionProductSort === "deadline" ? "active" : ""}" onclick="setRegionProductSort('deadline')">마감임박순</button>
            <label class="region-product-sort-native">
              <select aria-label="상품 정렬" onchange="setRegionProductSort(this.value)">
                <option value="recommended" ${regionProductSort === "recommended" ? "selected" : ""}>추천순</option>
                <option value="price" ${regionProductSort === "price" ? "selected" : ""}>낮은가격순</option>
                <option value="deadline" ${regionProductSort === "deadline" ? "selected" : ""}>마감임박순</option>
              </select>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </label>
          </div>
        </div>
        <div class="region-product-grid">
          ${results.map((join) => renderRegionProductCard(join)).join("")}
        </div>
      `;
    }

    function openTravelDateModal(region) {
      selectedTravelRegion = region;
      selectedTravelStart = null;
      selectedTravelEnd = null;
      closeRegionSearchModal();
      portalOverlayToBody("travelDateModal")?.classList.add("open");
      setWidgetModalOpen(true);
      renderTravelDateCalendar();
    }

    function closeTravelDateModal() {
      const modal = document.getElementById("travelDateModal");
      resetModalRuntimeState(modal);
      modal.classList.remove("open");
      setWidgetModalOpen(false);
    }

    function formatTravelDate(date) {
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    }

    function renderTravelDateCalendar() {
      const body = document.getElementById("travelDateBody");
      const today = new Date("2026-04-28T00:00:00");
      const months = [0, 1, 2, 3].map((offset) => new Date(today.getFullYear(), today.getMonth() + offset, 1));
      body.innerHTML = months.map((month) => renderTravelMonth(month, today)).join("");
      updateTravelDateSummary();
    }

    function renderTravelMonth(month, today) {
      const year = month.getFullYear();
      const monthIndex = month.getMonth();
      const firstDay = new Date(year, monthIndex, 1).getDay();
      const lastDate = new Date(year, monthIndex + 1, 0).getDate();
      const blanks = Array.from({ length: firstDay }).map(() => `<button type="button" class="travel-calendar-day muted"></button>`).join("");
      const days = Array.from({ length: lastDate }).map((_, index) => {
        const date = new Date(year, monthIndex, index + 1);
        const iso = formatTravelDate(date);
        const cls = [
          "travel-calendar-day",
          date.getDay() === 0 ? "sunday" : "",
          date.getDay() === 6 ? "saturday" : "",
          iso === formatTravelDate(today) ? "today" : "",
          selectedTravelStart && iso === selectedTravelStart ? "selected-start" : "",
          selectedTravelEnd && iso === selectedTravelEnd ? "selected-end" : "",
          selectedTravelStart && selectedTravelEnd && iso > selectedTravelStart && iso < selectedTravelEnd ? "in-range" : ""
        ].filter(Boolean).join(" ");
        return `<button type="button" class="${cls}" onclick="selectTravelDate('${iso}')"><div class="travel-day-number">${index + 1}</div>${iso === formatTravelDate(today) ? '<div class="today-label">오늘</div>' : ""}</button>`;
      }).join("");
      return `<section class="travel-month"><div class="travel-month-head"><div>${year}.${String(monthIndex + 1).padStart(2, "0")}</div><button type="button" class="travel-month-all" onclick="selectTravelMonth(${year}, ${monthIndex})">전체</button></div><div class="travel-calendar-grid">${blanks}${days}</div></section>`;
    }

    function selectTravelDate(iso) {
      if (!selectedTravelStart || selectedTravelEnd) {
        selectedTravelStart = iso;
        selectedTravelEnd = null;
      } else if (iso < selectedTravelStart) {
        selectedTravelEnd = selectedTravelStart;
        selectedTravelStart = iso;
      } else {
        selectedTravelEnd = iso;
      }
      renderTravelDateCalendar();
    }

    function selectTravelMonth(year, monthIndex) {
      selectedTravelStart = formatTravelDate(new Date(year, monthIndex, 1));
      selectedTravelEnd = formatTravelDate(new Date(year, monthIndex + 1, 0));
      renderTravelDateCalendar();
    }

    function updateTravelDateSummary() {
      const summary = document.getElementById("travelDateSummary");
      const range = selectedTravelStart ? `${selectedTravelStart}${selectedTravelEnd ? " ~ " + selectedTravelEnd : ""}` : "여행일을 선택해주세요";
      summary.textContent = `${selectedTravelRegion || "전체"} · ${range} · 57개 상품`;
    }

    function openDetailApply() {
      openGlobalApply();
    }

    function closeDetailApply() {
      const panel = document.getElementById("detailApplyPanel");
      if (panel) panel.classList.remove("open");
      resumeQuickMobileCarouselIfIdle();
    }

    function openGlobalApplyFor(joinId) {
      if (joinId) currentDetailJoinId = joinId;
      openGlobalApply();
    }

    function getCurrentApplyJoin() {
      return joins.find((item) => item.id === currentDetailJoinId) || null;
    }

    function getCurrentDetailJoin() {
      return currentDetailJoinData || joins.find((item) => item.id === currentDetailJoinId) || null;
    }

    function renderGlobalApplyJoinSummary() {
      const summary = document.getElementById("globalApplyJoinSummary");
      if (!summary) return;
      const join = getCurrentApplyJoin();
      if (!join) {
        summary.innerHTML = `
          <div class="apply-join-summary-head">
            <div class="apply-join-summary-title">5060 매너 골프조인 신청</div>
          </div>
          <div class="apply-join-summary-meta">선택한 조인 일정으로 참여 신청을 접수합니다.</div>
        `;
        return;
      }
      const location = getApplyJoinLocationLabel(join);
      const duration = formatTripDuration(join).replace(/\s+/g, "");
      summary.innerHTML = `
        <div class="apply-join-info-grid">
          <div class="apply-join-info-item">
            <div class="apply-join-info-label">상품명</div>
            <div class="apply-join-info-value">${escapeHtml(join.title || "")}</div>
          </div>
          <div class="apply-join-info-item">
            <div class="apply-join-info-label">일정</div>
            <div class="apply-join-info-value">${escapeHtml(formatCardDateRange(join))}</div>
          </div>
          <div class="apply-join-info-item">
            <div class="apply-join-info-label">기간</div>
            <div class="apply-join-info-value">${duration ? escapeHtml(duration) : "-"}</div>
          </div>
          <div class="apply-join-info-item">
            <div class="apply-join-info-label">지역</div>
            <div class="apply-join-info-value">${escapeHtml(location || "조인 일정")}</div>
          </div>
          <div class="apply-join-info-item">
            <div class="apply-join-info-label">참가비</div>
            <div class="apply-join-info-value">${formatPrice(join.price)}원</div>
          </div>
        </div>
      `;
    }

    function isCurrentApplyOverseas() {
      const join = getCurrentApplyJoin();
      return (join?.category || "").includes("해외") || Boolean(join?.departureAirport || join?.airport);
    }

    function getVisibleApplyAgreementInputs(selector = ".global-apply-agreement") {
      return Array.from(document.querySelectorAll(selector)).filter((input) => {
        const row = input.closest(".apply-agreement-row");
        return row && !row.classList.contains("is-hidden");
      });
    }

    function renderGlobalApplyAgreements() {
      document.querySelectorAll("#globalApplyAgreementList .apply-agreement-row[data-agreement-scope]").forEach((row) => {
        const key = row.querySelector(".global-apply-agreement")?.dataset.agreementKey || "";
        const visible = key === "booking";
        row.classList.toggle("is-hidden", !visible);
        const input = row.querySelector("input");
        if (input && !visible) input.checked = false;
        const label = row.querySelector(".apply-check-line-text");
        if (visible && label) label.textContent = "예약/취소규정을 확인했습니다";
      });
      syncApplyAgreementState();
    }

    function toggleApplyAllAgreements(checked) {
      getVisibleApplyAgreementInputs().forEach((input) => {
        input.checked = checked;
      });
      syncApplyAgreementState();
      if (checked) {
        const agreeBox = document.querySelector("#globalApplyPanel .apply-agree-box");
        agreeBox?.classList.add("is-collapsed");
        ensureApplyAgreeBoxVisible(agreeBox);
      }
    }

    function toggleApplyAgreeSection() {
      const agreeBox = document.querySelector("#globalApplyPanel .apply-agree-box");
      agreeBox?.classList.toggle("is-collapsed");
      if (agreeBox?.classList.contains("is-collapsed")) ensureApplyAgreeBoxVisible(agreeBox);
    }

    function syncApplyAgreementState() {
      const all = document.getElementById("globalApplyPrivacy");
      const visible = getVisibleApplyAgreementInputs();
      const required = visible.filter((input) => input.dataset.required === "true");
      const requiredComplete = required.length > 0 && required.every((input) => input.checked);
      if (all) {
        all.checked = visible.length > 0 && visible.every((input) => input.checked);
        all.indeterminate = !all.checked && visible.some((input) => input.checked);
      }
      setApplyCompleteBadge("#globalApplyPanel .apply-agree-box", requiredComplete);
      if (requiredComplete) {
        document.getElementById("globalApplyPrivacyError")?.classList.remove("is-visible");
      }
    }

    function hasRequiredApplyAgreements() {
      return true;
    }

    function getGlobalApplyMarketingAgreement() {
      return getVisibleApplyAgreementInputs().some((input) => input.dataset.required === "false" && input.checked);
    }

    function getApplyChipValue(groupName) {
      return document.querySelector(`[data-chip-group="${groupName}"] .apply-chip.active`)?.dataset.value || "";
    }

    function getApplyChipValues(groupName) {
      return Array.from(document.querySelectorAll(`[data-chip-group="${groupName}"] .apply-chip.active`)).map((chip) => chip.dataset.value || chip.textContent.trim()).filter(Boolean);
    }

    function selectApplyBookingOption(button) {
      const group = button?.closest(".apply-chip-group, .apply-people-mode");
      if (!group) return;
      group.querySelectorAll(".apply-chip, .apply-people-button").forEach((chip) => chip.classList.toggle("active", chip === button));
    }

    function getApplyBookingChipValue(scope, key, fallback = "") {
      return getApplyChipValue(`${scope}-${key}`)
        || document.querySelector(`[data-chip-group="${scope}-${key}"] .apply-people-button.active`)?.dataset.value
        || fallback;
    }

    function getApplyProductForBookingOptions(scope) {
      if (scope === "builder") {
        return getBuilderSelectedFixedProduct()
          || [...(externalGolfJoinProducts || []), ...joins].find((item) => item.id === builderState.productId)
          || { id: builderState.productId };
      }
      return getCurrentApplyJoin() || getCurrentDetailJoin() || {};
    }

    function getApplyProductPackType(product = {}) {
      const savedPackType = String(product.packType || getNestedValue(product, "trip.packType") || getNestedValue(product, "product.packType") || "").trim().toLowerCase();
      if (savedPackType === "air" || savedPackType === "항공팩") return "air";
      if (savedPackType === "golf" || savedPackType === "골프팩") return "golf";
      if (typeof getMdPickPackType === "function") {
        const mdPickType = getMdPickPackType(product);
        if (mdPickType === "air" || mdPickType === "golf") return mdPickType;
      }
      const typeText = String(getDetailProductType(product) || product.packTypeName || product.productType || "").trim();
      if (/항공|air/i.test(typeText)) return "air";
      return "golf";
    }

    function parseApplyBookingList(value) {
      if (Array.isArray(value)) return value.flatMap(parseApplyBookingList);
      if (value && typeof value === "object") return Object.values(value).flatMap(parseApplyBookingList);
      return String(value || "")
        .split(/[,\n/·|]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    function collectApplyBookingNoteTexts(value) {
      if (Array.isArray(value)) return value.flatMap(collectApplyBookingNoteTexts);
      if (value && typeof value === "object") return Object.values(value).flatMap(collectApplyBookingNoteTexts);
      const text = String(value || "").trim();
      return text ? [text, ...parseApplyBookingList(text)] : [];
    }

    function parseApplyBookingNotes(product = {}) {
      const noteValues = [
        product.singleRoomSurchargeText,
        getNestedValue(product, "applicant.singleRoomSurchargeText"),
        getNestedValue(product, "sheetApplication.applicant.singleRoomSurchargeText"),
        getNestedValue(product, "displayRule.singleRoomSurchargeText"),
        product.singleRoomSurchargeNote,
        product.singleRoomNote,
        product.singleRoomChargeNote,
        product.roomSurchargeNote,
        product.roomChargeNote,
        product.extraChargeNote,
        product.notes,
        product.notice,
        getNestedValue(product, "trip.notes"),
        getNestedValue(product, "product.notes"),
        getNestedValue(product, "sheetApplication.notes")
      ];
      return [...new Set(noteValues.flatMap(collectApplyBookingNoteTexts).map((item) => String(item || "").trim()).filter(Boolean))];
    }

    const singleRoomSurchargeKeywordPattern = /(1\s*인\s*1\s*실|1\s*인실|싱글\s*(?:룸|차지|룸차지)?|싱글|독실|single(?:\s*(?:room|charge|supplement))?)/i;

    function parseApplyWonAmount(value) {
      const text = String(value ?? "").trim();
      if (!text) return 0;
      const match = text.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만원|만|천원|원)?/);
      if (!match) return 0;
      const raw = Number(String(match[1]).replace(/,/g, ""));
      if (!Number.isFinite(raw) || raw <= 0) return 0;
      const unit = match[2] || "";
      if (/만원|만/.test(unit)) return Math.round(raw * 10000);
      if (/천원/.test(unit)) return Math.round(raw * 1000);
      if (!unit && !String(match[1]).includes(",") && raw < 10000) return 0;
      return Math.round(raw);
    }

    function extractSingleRoomSurcharge(notes = []) {
      const candidates = notes.filter((text) => singleRoomSurchargeKeywordPattern.test(text));
      for (const text of candidates) {
        const matches = [...String(text || "").matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(만원|만|천원|원)?/g)];
        for (const match of matches) {
          const amount = parseApplyWonAmount(match[0]);
          if (!amount) continue;
          return {
            amount,
            sourceText: text,
            status: "found"
          };
        }
      }
      return {
        amount: 0,
        sourceText: candidates[0] || "",
        status: candidates.length ? "manual_check" : "not_found"
      };
    }

    function getSingleRoomSurchargeInfo(product = {}) {
      const directAmount = parseApplyWonAmount(product.singleRoomSurcharge || getNestedValue(product, "applicant.singleRoomSurcharge") || getNestedValue(product, "sheetApplication.applicant.singleRoomSurcharge") || 0);
      const directText = String(product.singleRoomSurchargeText || getNestedValue(product, "applicant.singleRoomSurchargeText") || getNestedValue(product, "sheetApplication.applicant.singleRoomSurchargeText") || "").trim();
      if (Number.isFinite(directAmount) && directAmount > 0) {
        return {
          amount: directAmount,
          sourceText: directText,
          status: product.singleRoomSurchargeStatus || "found"
        };
      }
      return extractSingleRoomSurcharge(parseApplyBookingNotes(product));
    }

    function getApplyBookingOptions(scope) {
      const product = getApplyProductForBookingOptions(scope);
      const packType = getApplyProductPackType(product);
      const roomType = getApplyBookingChipValue(scope, "room-type", "2인1실");
      const flightRequestType = packType === "golf" ? getApplyBookingChipValue(scope, "flight-request", "대행요청") : "";
      const surcharge = roomType === "1인1실"
        ? getSingleRoomSurchargeInfo(product)
        : { amount: 0, sourceText: "", status: "not_selected" };
      return {
        packType,
        roomType,
        flightRequestType,
        singleRoomSurcharge: surcharge.amount || 0,
        singleRoomSurchargeText: surcharge.sourceText || "",
        singleRoomSurchargeStatus: surcharge.status || ""
      };
    }

    function formatApplyWon(amount) {
      const number = Number(amount);
      if (!Number.isFinite(number) || number <= 0) return "";
      return `${number.toLocaleString("ko-KR")}원`;
    }

    function updateApplyBookingOptions(scope) {
      const options = getApplyBookingOptions(scope);
      document.querySelector(`[data-apply-flight-option="${scope}"]`)?.classList.toggle("is-hidden", options.packType !== "golf");
      document.querySelector(`[data-apply-room-option="${scope}"]`)?.classList.remove("is-hidden");
      const surcharge = document.querySelector(`[data-apply-room-surcharge="${scope}"]`);
      if (!surcharge) return;
      surcharge.removeAttribute("title");
      if (options.roomType !== "1인1실") {
        surcharge.textContent = "";
      } else if (options.singleRoomSurcharge > 0) {
        surcharge.innerHTML = `1인 1실 추가요금 <strong>${escapeHtml(formatApplyWon(options.singleRoomSurcharge))}</strong>`;
        if (options.singleRoomSurchargeText) surcharge.title = options.singleRoomSurchargeText;
      } else if (options.singleRoomSurchargeText) {
        surcharge.textContent = `1인 1실 요금 참고사항: ${options.singleRoomSurchargeText}`;
      } else {
        surcharge.textContent = "1인 1실 추가요금은 상품 참고사항 확인 후 별도 안내됩니다.";
      }
    }

    function scrollApplyChipGroupIntoView(groupName) {
      const group = document.querySelector(`[data-chip-group="${groupName}"]`);
      if (!group) return;
      const target = group.closest(".field") || group;
      const scrollBox = target.closest(".detail-apply-scroll, .builder-body, .join-profile-manage-body, .modal-body");
      target.classList.add("has-error");
      requestAnimationFrame(() => {
        if (scrollBox) {
          const scrollRect = scrollBox.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const nextTop = scrollBox.scrollTop + targetRect.top - scrollRect.top - 18;
          scrollBox.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTimeout(() => group.querySelector(".apply-chip")?.focus?.({ preventScroll: true }), 180);
      });
    }

    const applyAgreementDetails = {
      booking: {
        title: "예약안내 및 취소규정",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">시크릿투어 골프여행은 예약금 결제 후 예약이 접수됩니다. 예약금 결제만으로 일정이 즉시 확정되는 것은 아니며, 최소 성원과 항공·골프장·호텔 예약 가능 여부 확인 후 최종 확정됩니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>국내<br>예약금</th><td>100,000원</td></tr>
            <tr><th>해외<br>예약금</th><td>200,000원</td></tr>
            <tr><th>성원<br>안내</th><td>해외 출발 20일 전, 국내 출발 7일 전 기준으로 안내합니다.</td></tr>
            <tr><th>취소<br>기준</th><td>항공권, 골프장, 호텔, 현지 수배 확정 후 취소 시 각 예약처 규정에 따른 위약금이 발생할 수 있습니다.</td></tr>
          </tbody></table>
          <div class="privacy-modal-copy">최소 성원이 충족되지 않아 일정이 진행되지 않을 경우 예약금은 전액 환불됩니다.</div>
        `
      },
      overseasTerms: {
        title: "국외여행 표준약관",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">국외 골프여행 계약은 상품 상세페이지, 예약안내, 여행일정표, 여행약관, 상품별 특약 및 예약확정 안내를 기준으로 구성됩니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>계약<br>구성</th><td>상품 상세페이지, 여행일정표, 예약안내, 여행약관, 상품별 특약</td></tr>
            <tr><th>여행<br>요금</th><td>상품 상세페이지에 명시된 포함사항 기준</td></tr>
            <tr><th>별도<br>비용</th><td>현지 지불 비용 또는 불포함 사항은 상품별로 별도 안내합니다.</td></tr>
          </tbody></table>
          <div class="privacy-modal-copy">천재지변, 감염병, 항공 지연 또는 취소, 골프장·호텔·현지 사정 등 부득이한 사유가 있는 경우 일정이 변경될 수 있습니다.</div>
        `
      },
      domesticTerms: {
        title: "국내여행 약관",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">국내 골프여행 계약은 상품 상세페이지, 예약안내, 여행일정표, 여행약관, 상품별 특약 및 예약확정 안내를 기준으로 구성됩니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>계약<br>구성</th><td>상품 상세페이지, 여행일정표, 예약안내, 여행약관, 상품별 특약</td></tr>
            <tr><th>여행<br>요금</th><td>상품 상세페이지에 명시된 포함사항 기준</td></tr>
            <tr><th>별도<br>비용</th><td>현장 결제 비용 또는 불포함 사항은 상품별로 별도 안내합니다.</td></tr>
          </tbody></table>
          <div class="privacy-modal-copy">기상악화, 골프장 사정, 숙박업체 사정, 교통 상황 등 부득이한 사유가 있는 경우 일정이 변경될 수 있습니다.</div>
        `
      },
      privacyUse: {
        title: "개인정보 수집 및 이용",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">㈜시크릿투어는 골프조인 신청, 예약 안내, 성원 확인, 여행 예약 및 고객 상담을 위해 필요한 최소한의 개인정보를 수집·이용합니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>조인<br>정보</th><td>성별, 연령대, 주요경력/관심분야, 골프 수준, 라운딩 스타일, 한 줄 인사는 매칭과 동반자 참고 정보 제공에 이용됩니다.</td></tr>
            <tr><th>예약<br>정보</th><td>이름, 휴대폰 번호는 예약 안내, 성원 여부 안내, 고객 상담, 본인 확인에 이용됩니다.</td></tr>
            <tr><th>요청<br>사항</th><td>조인 운영 및 고객 요청사항 확인에 이용됩니다.</td></tr>
            <tr><th>보유<br>기간</th><td>신청 취소 또는 성원 불가 안내 후 3개월까지 보관합니다. 예약 진행 정보는 관계 법령에 따른 기간까지 보관될 수 있습니다.</td></tr>
          </tbody></table>
          <div class="privacy-modal-copy">필수 정보 제공에 동의하지 않을 경우 조인 신청, 예약 안내, 항공권 발권, 골프장 예약, 호텔 예약, 여행자보험 가입 등이 제한될 수 있습니다.</div>
        `
      },
      publicProfile: {
        title: "공개 프로필 제공",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">시크릿투어 골프조인은 함께 라운딩할 분들이 서로의 기본 성향을 참고할 수 있도록 일부 프로필 정보를 동반자에게 안내할 수 있습니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>공개<br>항목</th><td>성별, 연령대, 주요경력/관심분야, 골프 수준, 라운딩 스타일, 한 줄 인사</td></tr>
            <tr><th>공개<br>목적</th><td>조인 매칭, 참여자 간 기본 정보 확인, 원활한 라운딩 운영</td></tr>
            <tr><th>비공개<br>정보</th><td>이름, 휴대폰 번호, 여권정보, 결제정보, 요청사항</td></tr>
          </tbody></table>
        `
      },
      thirdParty: {
        title: "개인정보 제3자 제공",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">㈜시크릿투어는 골프여행 예약 및 여행 서비스 제공을 위해 필요한 범위 내에서 개인정보를 제3자에게 제공합니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>항공</th><td>국내·해외 운항 항공사에 항공권 예약, 발권, 출국 가능 여부 확인을 위해 제공합니다.</td></tr>
            <tr><th>숙박</th><td>상품별 확정 호텔 및 리조트에 객실 예약과 숙박 서비스 제공을 위해 제공합니다.</td></tr>
            <tr><th>골프장</th><td>상품별 확정 골프장에 티타임 예약, 라운딩 진행, 이용자 확인을 위해 제공합니다.</td></tr>
            <tr><th>보험</th><td>여행자보험 가입 및 보험 서비스 제공을 위해 보험사에 제공합니다.</td></tr>
          </tbody></table>
        `
      },
      outsourcing: {
        title: "개인정보 처리위탁 안내",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">㈜시크릿투어는 원활한 예약 안내와 고객 알림 발송을 위해 개인정보 처리 업무를 외부 업체에 위탁합니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>카카오</th><td>알림톡 발송, 예약 안내, 성원 안내, 결제 안내, 출발 안내</td></tr>
            <tr><th>알리고</th><td>문자 발송, 예약 안내, 성원 안내, 결제 안내, 출발 안내</td></tr>
          </tbody></table>
          <div class="privacy-modal-copy">위탁업체는 위탁받은 업무 목적 범위 내에서만 개인정보를 처리합니다.</div>
        `
      },
      identityInfo: {
        title: "고유식별정보 수집 및 처리",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">해외 골프여행 예약 및 출국 관련 서비스 제공을 위해 여권번호 등 고유식별정보를 수집·처리할 수 있습니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>수집<br>항목</th><td>여권번호</td></tr>
            <tr><th>이용<br>목적</th><td>항공권 예약 및 발권, 출국 가능 여부 확인, 여행자보험 가입, 필요 시 비자 수속</td></tr>
            <tr><th>보유<br>기간</th><td>여행 종료 후 1개월 이내 파기 또는 관계 법령에 따른 보존기간까지</td></tr>
          </tbody></table>
        `
      },
      overseasTransfer: {
        title: "개인정보 국외이전",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">해외 골프여행 예약 및 여행 서비스 제공을 위해 필요한 경우 개인정보를 국외의 항공사, 호텔, 리조트, 골프장, 현지 수배사 등에 이전할 수 있습니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>이전<br>항목</th><td>성명, 생년월일, 성별, 연락처, 여권정보, 예약정보, 항공 출도착 정보, 객실 정보, 티타임 정보</td></tr>
            <tr><th>이전<br>시기</th><td>항공권 발권, 호텔 예약, 골프장 티타임 예약, 현지 행사 수배가 필요한 시점</td></tr>
            <tr><th>이용<br>목적</th><td>항공권 예약 및 발권, 호텔 예약, 골프장 티타임 예약, 현지 행사 진행</td></tr>
          </tbody></table>
        `
      },
      insurance: {
        title: "여행자보험 가입 및 보험약관",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">해당 상품에 여행자보험이 포함된 경우, ㈜시크릿투어는 여행자보험 가입을 위해 필요한 정보를 보험사에 제공할 수 있습니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>보험사</th><td>삼성화재</td></tr>
            <tr><th>제공<br>항목</th><td>성명, 생년월일, 성별, 연락처, 여권번호</td></tr>
            <tr><th>이용<br>목적</th><td>여행자보험 가입 및 보험 서비스 제공</td></tr>
          </tbody></table>
        `
      },
      marketing: {
        title: "골프여행 특가·이벤트 수신",
        button: "동의하고 닫기",
        html: `
          <div class="privacy-modal-copy">골프여행 특가, 이벤트, 추천 여행상품 및 프로모션 정보를 안내하기 위해 아래 정보를 이용할 수 있습니다.</div>
          <table class="apply-privacy-table"><tbody>
            <tr><th>이용<br>항목</th><td>이름, 휴대폰 번호, 신청 상품 정보</td></tr>
            <tr><th>이용<br>목적</th><td>골프여행 특가, 이벤트, 추천 상품, 프로모션 안내</td></tr>
            <tr><th>보유<br>기간</th><td>동의 철회 시까지</td></tr>
          </tbody></table>
          <div class="privacy-modal-copy">마케팅 정보 수신 동의는 선택 사항이며, 동의하지 않아도 조인 신청과 예약 서비스 이용에는 제한이 없습니다.</div>
        `
      }
    };

    function getApplyAgeDisplay() {
      const birthYear = document.getElementById("globalApplyBirthYear")?.value.trim();
      if (!/^\d{4}$/.test(birthYear || "")) return "50대 초반";
      const year = Number(birthYear);
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      if (age < 30 || age > 99) return "";
      const decade = Math.min(Math.floor(age / 10) * 10, 70);
      const ones = age % 10;
      const phase = ones <= 3 ? "초반" : ones <= 6 ? "중반" : "후반";
      return `${decade >= 70 ? "70대이상" : `${decade}대`} ${phase}`;
    }

    function getApplyAgeDisplayFromBirthYear(birthYear) {
      if (!/^\d{4}$/.test(String(birthYear || ""))) return "";
      const year = Number(birthYear);
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      if (age < 30 || age > 99) return "";
      const decade = Math.min(Math.floor(age / 10) * 10, 70);
      const ones = age % 10;
      const phase = ones <= 3 ? "초반" : ones <= 6 ? "중반" : "후반";
      return `${decade >= 70 ? "70대이상" : `${decade}대`} ${phase}`;
    }

    function getBirthYearFromJoinMember(member = {}, cached = {}) {
      const direct = cached.birthYear || member.birthYear || "";
      if (/^\d{4}$/.test(String(direct || ""))) return String(direct);
      const birthday = String(member.birthday || cached.birthday || "");
      const match = birthday.match(/\d{4}/);
      return match ? match[0] : "";
    }

    async function getJoinApplyMemberProfile(memberSource = null, options = {}) {
      let member = memberSource || null;
      if (!member) {
        try {
          member = await getJoinCurrentMember({ refresh: true });
        } catch (error) {
          golfJoinSafeWarn("Failed to refresh join member profile for apply form; using login fallback.", error);
          member = getJoinLoginState().member || {};
        }
      }
      if (options.refresh && member) {
        try {
          const sheetProfile = await fetchJoinMemberProfileFromGoogleSheet(member, { refresh: true });
          if (sheetProfile && !sheetProfile.__lookupFailed) {
            member = mergeJoinMemberWithProfile(member, sheetProfile);
            rememberJoinMemberProfileLocally(member, sheetProfile);
          }
        } catch (error) {
          golfJoinSafeWarn("Failed to refresh join member profile for apply phone; using current member data.", error);
        }
      }
      const cached = getRememberedJoinMemberProfile(member || {});
      const birthYear = getBirthYearFromJoinMember(member || {}, cached);
      const mobile = normalizeJoinMemberPhone(cached.memberMobile || cached.mobile || cached.phone || member?.memberMobile || "");
      return {
        member,
        name: cached.name || cached.memberName || member?.memberName || "",
        gender: cached.gender || member?.gender || "",
        birthYear,
        ageDisplay: getApplyAgeDisplayFromBirthYear(birthYear),
        phone: mobile,
        email: cached.memberEmail || cached.email || member?.memberEmail || member?.email || "",
        profession: cached.profession || member?.profession || "",
        level: cached.level || member?.level || "",
        travelStyles: cached.travelStyles || member?.travelStyles || ""
      };
    }

    function formatJoinMemberPhoneDisplay(phone = "") {
      const value = normalizeJoinMemberPhone(phone);
      if (/^010\d{8}$/.test(value)) {
        return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
      }
      return value || "확인 필요";
    }

    function formatApplyBirthYear(input) {
      input.value = input.value.replace(/\D/g, "").slice(0, 4);
    }

    function updateApplyPreview() {
      const gender = getApplyChipValue("global-gender") || "성별 미선택";
      const age = getApplyAgeDisplay() || "연령 확인 필요";
      const tags = getApplyChipValues("global-style");
      const greeting = document.getElementById("globalApplyGreeting")?.value.trim() || "잘 부탁드립니다.";
      const identity = document.getElementById("applyPreviewIdentity");
      const levelNode = document.getElementById("applyPreviewLevel");
      const tagNode = document.getElementById("applyPreviewTags");
      const greetingNode = document.getElementById("applyPreviewGreeting");
      if (identity) identity.textContent = `${gender} · ${age}`;
      if (levelNode) levelNode.textContent = "";
      if (tagNode) tagNode.textContent = tags.length ? tags.join(" ") : "라운딩스타일 미선택";
      if (greetingNode) greetingNode.textContent = `“${greeting}”`;
    }

    async function openGlobalApply(options = {}) {
      if (openGlobalApply.isOpening) return;
      openGlobalApply.isOpening = true;
      try {
        const applyJoinId = currentDetailJoinId || "";
        const applyJoin = getCurrentApplyJoin();
        if (applyJoin && getBlockingActiveJoinSchedule(applyJoin)) {
          setDetailScheduleConflictState(applyJoin);
          return;
        }
        if (!requireJoinLogin("apply", applyJoinId ? { applyJoinId } : {})) return;
        let readyMember = null;
        if (!options.skipProfileCheck) {
          readyMember = await ensureJoinMemberProfileReady("apply", applyJoinId ? { applyJoinId } : {});
          if (!readyMember) return;
        }
        stopQuickMobileCarousel();
        const overlay = document.getElementById("globalApplyOverlay");
        portalOverlayToBody("globalApplyOverlay");
        const panel = document.getElementById("globalApplyPanel");
        panel.classList.remove("is-complete");
        const submitButton = document.getElementById("globalApplySubmitButton");
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "모임 참여 신청하기";
        }
        overlay.style.setProperty("z-index", "2147483644", "important");
        panel.style.setProperty("z-index", "2147483645", "important");
        renderGlobalApplyJoinSummary();
        clearApplyErrors();
        document.querySelectorAll('[data-chip-group="global-gender"] .apply-chip.active').forEach((chip) => chip.classList.remove("active"));
        document.querySelector('[data-chip-group="global-gender"] .apply-chip[data-value="남성"]')?.classList.add("active");
        document.querySelector('[data-chip-group="global-room-type"]')?.classList.remove("is-group");
        document.querySelector('[data-chip-group="global-flight-request"]')?.classList.remove("is-group");
        document.querySelectorAll('[data-chip-group="global-room-type"] .apply-chip, [data-chip-group="global-room-type"] .apply-people-button').forEach((chip) => {
          chip.classList.toggle("active", chip.dataset.value === "2인1실");
        });
        document.querySelectorAll('[data-chip-group="global-flight-request"] .apply-chip, [data-chip-group="global-flight-request"] .apply-people-button').forEach((chip) => {
          chip.classList.toggle("active", chip.dataset.value === "대행요청");
        });
        const privacy = document.getElementById("globalApplyPrivacy");
        if (privacy) {
          privacy.checked = false;
          privacy.indeterminate = false;
        }
        document.querySelectorAll(".global-apply-agreement").forEach((input) => {
          input.checked = false;
        });
        document.querySelector("#globalApplyPanel .apply-agree-box")?.classList.remove("is-collapsed");
        renderGlobalApplyAgreements();
        document.querySelectorAll("#globalApplyPanel .apply-reservation-part-button").forEach(syncApplyReservationPartIcon);
        globalApplyWaitlistApproved = false;
        updateGlobalApplyRemainingSeat();
        setGlobalApplyPeopleMode("solo");
        const memberProfile = await getJoinApplyMemberProfile(readyMember, { refresh: true });
        const nameInput = document.getElementById("globalApplyName");
        const birthYearInput = document.getElementById("globalApplyBirthYear");
        const phoneInput = document.getElementById("globalApplyPhone");
        if (nameInput) nameInput.value = memberProfile.name || "";
        if (birthYearInput) birthYearInput.value = memberProfile.birthYear || "";
        if (phoneInput) phoneInput.value = memberProfile.phone || "";
        if (memberProfile.gender) {
          document.querySelectorAll('[data-chip-group="global-gender"] .apply-chip').forEach((chip) => {
            chip.classList.toggle("active", chip.dataset.value === memberProfile.gender);
          });
        }
        const professionInput = document.getElementById("globalApplyProfession");
        if (professionInput && memberProfile.profession && !professionInput.value.trim()) {
          professionInput.value = memberProfile.profession;
          syncApplyProfessionChips(professionInput.value);
        }
        if (memberProfile.travelStyles) {
          const styles = new Set(splitJoinMemberProfileStyles(memberProfile.travelStyles));
          document.querySelectorAll('[data-chip-group="global-style"] .apply-chip').forEach((chip) => {
            chip.classList.toggle("active", styles.has(chip.dataset.value || chip.textContent.trim()));
          });
        }
        prepareJoinMobileFullscreenModalViewport();
        overlay.classList.add("open");
        requestAnimationFrame(() => panel.classList.add("open"));
        setWidgetModalOpen(true);
        updateApplyBookingOptions("global");
        updateApplyProgressive();
        document.querySelectorAll("#globalApplyPanel .traveler-field input").forEach(updateTravelerFieldState);
        refreshGlobalApplyProductDataInBackground(applyJoin, applyJoinId);
      } finally {
        openGlobalApply.isOpening = false;
      }
    }

    function refreshGlobalApplyProductDataInBackground(applyJoin, applyJoinId = "") {
      if (!applyJoin || applyJoin.secretTourDetailLoaded || typeof enrichOpenDetailWithSecretTourData !== "function") return;
      enrichOpenDetailWithSecretTourData(applyJoin, { preserveScroll: true })
        .then(() => {
          const overlay = document.getElementById("globalApplyOverlay");
          const panel = document.getElementById("globalApplyPanel");
          if (!overlay?.classList.contains("open") || panel?.classList.contains("is-complete")) return;
          if (applyJoinId && currentDetailJoinId !== applyJoinId) return;
          renderGlobalApplyJoinSummary();
          updateApplyBookingOptions("global");
          updateGlobalApplyRemainingSeat();
        })
        .catch((error) => {
          golfJoinSafeWarn("Failed to refresh apply product data in background.", error);
        });
    }

    function showGlobalApplyCompleteState() {
      const panel = document.getElementById("globalApplyPanel");
      const scroll = panel?.querySelector(".detail-apply-scroll");
      if (scroll) scroll.scrollTop = 0;
      panel?.classList.add("is-complete");
    }

    function resetGlobalApplyModalState() {
      const overlay = document.getElementById("globalApplyOverlay");
      const panel = document.getElementById("globalApplyPanel");
      resetModalRuntimeState(overlay);
      panel?.classList.remove("open", "is-complete");
      clearApplyErrors();
      document.querySelectorAll("#globalApplyPanel .apply-chip.active, #globalApplyPanel .profession-chip.active").forEach((chip) => {
        chip.classList.remove("active");
      });
      document.querySelector('[data-chip-group="global-gender"] .apply-chip[data-value="남성"]')?.classList.add("active");
      document.querySelector('[data-chip-group="global-room-type"]')?.classList.remove("is-group");
      document.querySelector('[data-chip-group="global-flight-request"]')?.classList.remove("is-group");
      document.querySelectorAll('[data-chip-group="global-room-type"] .apply-chip, [data-chip-group="global-room-type"] .apply-people-button').forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.value === "2인1실");
      });
      document.querySelectorAll('[data-chip-group="global-flight-request"] .apply-chip, [data-chip-group="global-flight-request"] .apply-people-button').forEach((chip) => {
        chip.classList.toggle("active", chip.dataset.value === "대행요청");
      });
      const greeting = document.getElementById("globalApplyGreeting");
      if (greeting) greeting.value = greeting.defaultValue || "잘 부탁드립니다.";
      document.querySelectorAll(".global-apply-agreement").forEach((input) => {
        input.checked = input.defaultChecked;
        input.indeterminate = false;
      });
      const privacy = document.getElementById("globalApplyPrivacy");
      if (privacy) {
        privacy.checked = privacy.defaultChecked;
        privacy.indeterminate = false;
      }
      document.querySelector("#globalApplyPanel .apply-agree-box")?.classList.remove("is-collapsed", "is-required-complete");
      globalApplyWaitlistApproved = false;
      setCompanionPeople("global", 1, { update: false });
      document.querySelector('[data-people-mode="global"]')?.classList.remove("is-group");
      document.querySelectorAll('[data-people-mode="global"] .apply-people-button').forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === "solo");
      });
      document.getElementById("globalApplyPeopleAccordion")?.classList.remove("open");
      renderCompanionGenderRows("global");
      updateApplyBookingOptions("global");
      const submitButton = document.getElementById("globalApplySubmitButton");
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "모임 참여 신청하기";
      }
      updateApplyProgressive();
    }

    function closeGlobalApply() {
      const overlay = document.getElementById("globalApplyOverlay");
      const panel = document.getElementById("globalApplyPanel");
      resetGlobalApplyModalState();
      panel?.classList.remove("open");
      overlay?.classList.remove("open");
      setWidgetModalOpen(false);
      resumeQuickMobileCarouselIfIdle();
    }

    function closeAllJoinModals() {
      closeBuilderFlexSheet();
      closeBuilderProductDetail();
      closeDetailApply();
      closeTravelDateModal();
      closeRegionSearchModal();
      closePrivacyApplyModal();
      closeWaitlistApplyModal();
      closeParticipant();

      document.querySelectorAll(".overlay.open, .global-apply-overlay.open, .calendar-sheet-overlay.open, .participant-floating.open").forEach((overlay) => {
        resetModalRuntimeState(overlay);
        overlay.classList.remove("open");
      });
      document.querySelectorAll(".detail-apply-panel.open, #globalApplyPanel.is-complete, #detailModal.builder-select-mode, #detailModal.mdpick-recruit-mode").forEach((panel) => {
        resetModalRuntimeState(panel);
        panel.classList.remove("open", "is-complete", "builder-select-mode", "builder-product-detail-mode", "mdpick-recruit-mode", "my-reservation-view-mode");
      });
      resetGlobalApplyModalState();
      currentDetailMode = "normal";
      currentDetailJoinData = null;
      const primary = document.getElementById("detailPrimaryButton");
      if (primary) {
        primary.textContent = "참여하기";
        primary.setAttribute("onclick", "openGlobalApply()");
        primary.setAttribute("aria-label", "참여하기");
      }
      setWidgetModalOpen(false);
      resumeQuickMobileCarouselIfIdle();
    }

    function handleGlobalApplyBackdrop(event) {
      if (event.target.id === "globalApplyOverlay") {
        closeGlobalApply();
      }
    }

    function updateApplyProgressive() {
      updateApplyPreview();
    }

    function setApplyGreeting(message) {
      const input = document.getElementById("globalApplyGreeting");
      if (input) input.value = message;
      updateApplyProgressive();
    }

    function syncApplyProfessionChips(value) {
      const selected = String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      document.querySelectorAll("[data-profession-chip]").forEach((chip) => {
        chip.classList.toggle("active", selected.includes(chip.dataset.professionChip));
      });
    }

    function setApplyProfession(value) {
      const input = document.getElementById("globalApplyProfession");
      if (!input) return;
      const values = input.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const index = values.indexOf(value);
      if (index >= 0) {
        values.splice(index, 1);
      } else {
        values.push(value);
      }
      input.value = values.join(", ");
      updateTravelerFieldState(input);
      syncApplyProfessionChips(input.value);
    }

    function handleApplyProfessionInput(input) {
      syncApplyProfessionChips(input?.value || "");
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function escapeJsString(value) {
      return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");
    }

    function markGolfJoinImageFallback(image) {
      if (!image || image.dataset.imageFallbackApplied === "true") return;
      const box = image.closest([
        ".join-mdpick-thumb",
        ".join-mdpick-theme-thumb",
        ".join-thumb",
        ".region-product-thumb",
        ".join-my-card-thumb",
        ".join-review-trip-thumb"
      ].join(","));
      if (!box) return;
      image.dataset.imageFallbackApplied = "true";
      box.classList.add("is-image-fallback");
    }

    function applyGolfJoinImageFallbacks(root = document) {
      root.querySelectorAll([
        ".join-mdpick-thumb > img",
        ".join-mdpick-theme-thumb > img",
        ".join-thumb > img:first-child",
        ".region-product-thumb > img",
        ".join-my-card-thumb > img",
        ".join-review-trip-thumb > img"
      ].join(",")).forEach((image) => {
        if (!image.getAttribute("src")) markGolfJoinImageFallback(image);
      });
    }

    function maskApplyName(name) {
      const value = String(name || "").trim();
      if (!value) return "신**";
      return `${value.slice(0, 1)}**`;
    }

    function addCurrentApplyParticipant(data, recordId = "") {
      const join = getCurrentApplyJoin();
      if (!join) return null;
      const requestedCount = parseApplyPeopleValue(data.people || 1);
      const hasLimitedCapacity = Number.isFinite(Number(join.emptySlots));
      const remainingSlots = hasLimitedCapacity ? Number(join.emptySlots) : requestedCount;
      const participantCount = Math.max(0, Math.min(BUILDER_APPLICATION_MAX_CAPACITY, requestedCount, remainingSlots));
      if (participantCount <= 0) return null;
      const createdAt = Date.now();
      const participantSeed = recordId || `apply-${createdAt}`;
      const companionGenders = parseCompanionList(data.companions).map((item) => item?.gender || "");
      const participants = Array.from({ length: participantCount }, (_, index) => {
        const participantId = `${participantSeed}-p${index + 1}`;
        const gender = index === 0 ? data.gender : (companionGenders[index - 1] || data.gender);
        return {
          id: participantId,
          name: index === 0 ? maskApplyName(data.name) : `일행${index}`,
          gender,
          companionGroup: participantCount > 1 ? `${participantSeed}-companions` : "",
          age: data.age,
          handicap: data.level || "",
          profession: data.profession,
          preferences: data.styles,
          message: index === 0 ? data.greeting : "동반 참여 인원입니다.",
          status: "confirmed",
          gif: getBuilderApplicationGenderIcon(gender, null, `${join.id}-${participantId}-${data.name || index}`)
        };
      });
      join.participants = [...(join.participants || []), ...participants];
      if (hasLimitedCapacity) {
        join.emptySlots = Math.max(0, Number(join.emptySlots) - participants.length);
      }
      renderJoins();
      if (document.getElementById("detailModal")?.classList.contains("open") && currentDetailJoinId === join.id) {
        renderDetailContent(join);
      }
      return participants[0] || null;
    }

    function clearApplyErrors() {
      document.querySelectorAll("#globalApplyPanel .field.has-error").forEach((field) => field.classList.remove("has-error"));
      document.getElementById("globalApplyPrivacyError")?.classList.remove("is-visible");
    }

    function markApplyFieldError(fieldKey) {
      const field = document.querySelector(`#globalApplyPanel [data-apply-field="${fieldKey}"]`);
      field?.classList.add("has-error");
      field?.querySelector("input, textarea, select, button")?.focus();
    }

    function showGlobalApplyRequiredMessage(message) {
      openBuilderAlert(message || "필수정보를 입력해 주세요.");
    }

    function markApplyFieldErrorWithMessage(fieldKey, message) {
      markApplyFieldError(fieldKey);
      showGlobalApplyRequiredMessage(message);
    }

    function openPrivacyApplyModal() {
      const overlay = portalOverlayToBody("privacyApplyModal");
      overlay?.style.setProperty("z-index", "2147483900", "important");
      overlay?.querySelector(".modal")?.style.setProperty("z-index", "2147483901", "important");
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
    }

    function openAgreementDetail(key) {
      const detail = applyAgreementDetails[key] || applyAgreementDetails.privacyUse;
      currentAgreementDetailKey = key;
      const title = document.querySelector("#privacyApplyModal .modal-title");
      const content = document.getElementById("privacyApplyModalContent");
      const button = document.getElementById("privacyApplyModalConfirm");
      if (title) title.textContent = detail.title;
      if (content) {
        content.innerHTML = detail.html;
        normalizeAgreementDetailTableCells(content);
      }
      if (button) button.textContent = "확인";
      openPrivacyApplyModal();
    }

    function normalizeAgreementDetailTableCells(content) {
      content.querySelectorAll(".apply-privacy-table th, .apply-privacy-table td").forEach((cell) => {
        if (cell.firstElementChild?.classList?.contains("apply-privacy-th-text") || cell.firstElementChild?.classList?.contains("apply-privacy-td-text")) return;
        const wrapper = document.createElement("div");
        if (cell.tagName === "TH") {
          wrapper.className = "apply-privacy-th-text";
          wrapper.textContent = cell.textContent.replace(/\s+/g, " ").trim();
        } else {
          wrapper.className = "apply-privacy-td-text";
          wrapper.innerHTML = cell.innerHTML;
        }
        cell.replaceChildren(wrapper);
      });
    }

    function handlePrivacyCheckLineClick(event) {
      event?.preventDefault();
      toggleApplyAllAgreements(true);
      openAgreementDetail("privacyUse");
    }

    function closePrivacyApplyModal() {
      const modal = document.getElementById("privacyApplyModal");
      resetModalRuntimeState(modal);
      modal?.classList.remove("open");
      currentAgreementDetailKey = null;
      if (!document.getElementById("globalApplyOverlay")?.classList.contains("open")) {
        setWidgetModalOpen(false);
      }
    }

    function confirmPrivacyApplyModal() {
      if (currentAgreementDetailKey) {
        const input = document.querySelector(`.global-apply-agreement[data-agreement-key="${currentAgreementDetailKey}"]`);
        if (input && !input.closest(".apply-agreement-row")?.classList.contains("is-hidden")) {
          input.checked = true;
        }
      }
      syncApplyAgreementState();
      document.getElementById("globalApplyPrivacyError")?.classList.remove("is-visible");
      closePrivacyApplyModal();
    }

    function isJoinScheduleFullSaveError(error) {
      const code = String(error?.serverCode || error?.serverPayload?.code || error?.serverPayload?.error || error?.serverMessage || "").trim();
      return Number(error?.status) === 409 && code === "join_schedule_full";
    }

    function reloadJoinMainPage() {
      try {
        const url = new URL(location.href);
        [
          "golfjoinOpen",
          "joinOpen",
          "afterLogin",
          "applyJoinId",
          "joinId",
          "scheduleId",
          "wishJoinId",
          "productId",
          "goodSeq",
          "eventSeq"
        ].forEach((key) => url.searchParams.delete(key));
        url.hash = "";
        location.replace(url.toString());
      } catch (error) {
        location.reload();
      }
    }

    function openJoinScheduleFullAlert() {
      openBuilderAlert("모집이 완료되어 참여 신청이 마감되었습니다.\n메인페이지를 새로고침합니다.", {
        onConfirm: reloadJoinMainPage
      });
    }

    async function submitGlobalApply(options = {}) {
      clearApplyErrors();
      const loginState = getJoinLoginState();
      let applyMember = loginState.member || {};
      if (options.confirmed && loginState.isLogin) {
        try {
          applyMember = await getJoinCurrentMemberDetailOnly() || applyMember;
        } catch (error) {
          golfJoinSafeWarn("Failed to refresh join member detail before apply submit.", error);
        }
      }
      const memberProfile = options.confirmed
        ? await getJoinApplyMemberProfile(applyMember, { refresh: true })
        : await getJoinApplyMemberProfile(applyMember);
      const cachedProfile = getRememberedJoinMemberProfile(memberProfile.member || applyMember);
      applyMember = memberProfile.member || applyMember;
      const phoneInput = document.getElementById("globalApplyPhone");
      if (options.confirmed && memberProfile.phone && phoneInput) {
        phoneInput.value = memberProfile.phone;
      }
      const name = document.getElementById("globalApplyName")?.value.trim() || memberProfile.name || "";
      const birthYear = document.getElementById("globalApplyBirthYear")?.value.trim() || memberProfile.birthYear || "";
      const gender = getApplyChipValue("global-gender") || memberProfile.gender || "";
      const ageDisplay = getApplyAgeDisplayFromBirthYear(birthYear) || "";
      const phone = normalizeJoinMemberPhone(phoneInput?.value.trim() || memberProfile.phone || "");
      const profession = document.getElementById("globalApplyProfession")?.value.trim() || memberProfile.profession || "";
      const people = getCompanionPeople("global");
      const companions = getCompanionPayload("global");
      const level = memberProfile.level || "";
      const styles = getApplyChipValues("global-style");
      const memberPreferences = getApplyChipValues("global-member-preference");
      const greeting = document.getElementById("globalApplyGreeting")?.value.trim();
      const bookingOptions = getApplyBookingOptions("global");

      if (!name) {
        markApplyFieldErrorWithMessage("name", "이름을 입력해 주세요.");
        return;
      }
      if (!gender) {
        markApplyFieldErrorWithMessage("gender", "성별을 선택해 주세요.");
        return;
      }
      updateApplyProgressive();
      if (!/^\d{4}$/.test(birthYear || "") || !ageDisplay) {
        markApplyFieldErrorWithMessage("birthYear", "생년월일 4자리를 입력해 주세요.");
        return;
      }
      if (!/^010\d{8}$/.test(phone || "")) {
        markApplyFieldErrorWithMessage("phone", "휴대폰 번호를 정확히 입력해 주세요.");
        return;
      }
      if (!validateCompanionGenders("global")) {
        showGlobalApplyRequiredMessage("동반자 성별을 모두 선택해 주세요.");
        return;
      }
      if (!level) {
        showGlobalApplyRequiredMessage("핸디 정보를 입력해 주세요.");
        return;
      }
      if (!styles.length) {
        scrollApplyChipGroupIntoView("global-style");
        showGlobalApplyRequiredMessage("라운딩 스타일을 하나 이상 선택해 주세요.");
        return;
      }
      const submissionMember = buildJoinSubmissionMemberPayload(
        memberProfile.member,
        applyMember,
        getJoinCachedCurrentMember(),
        cachedProfile,
        memberProfile,
        { memberName: name, memberMobile: phone }
      );
      const applyData = {
        name,
        gender,
        birthYear,
        age: ageDisplay,
        ageDisplay,
        phone,
        profession,
        people,
        companions,
        level,
        styles,
        memberPreferences,
        preferredMemberComposition: memberPreferences,
        greeting,
        roomType: bookingOptions.roomType,
        flightRequestType: bookingOptions.flightRequestType,
        singleRoomSurcharge: bookingOptions.singleRoomSurcharge,
        singleRoomSurchargeText: bookingOptions.singleRoomSurchargeText,
        singleRoomSurchargeStatus: bookingOptions.singleRoomSurchargeStatus,
        member: submissionMember,
        requiredAgreed: true,
        marketingAgreed: getGlobalApplyMarketingAgreement()
      };
      if (!options.confirmed) {
        openApplySubmitConfirmModal("apply");
        return;
      }
      const submitButton = document.getElementById("globalApplySubmitButton");
      if (submitButton?.disabled) return;
      const previousText = submitButton?.textContent || "모임 참여 신청하기";
      if (submitButton) {
        submitButton.disabled = true;
      }
      const loadingToken = openJoinActionLoading("참여 신청을 접수하고 있어요");
      try {
        const applyPayload = buildJoinApplyPayload(applyData);
        validateJoinApplyCanonicalPayload(applyPayload);
        try {
          await saveJoinApplyToGoogleSheet(applyPayload);
        } catch (error) {
          if (isJoinScheduleFullSaveError(error)) throw error;
          const confirmed = await confirmJoinApplySavedToGoogleSheet(applyPayload);
          if (!confirmed) throw error;
          golfJoinSafeWarn("Join apply save response failed, but the row was confirmed in Google Sheet.", error);
        }
        invalidateHomeBootstrapLightCache();
        applyJoinApplicationPayload(applyPayload, { persist: true });
        if (document.getElementById("detailModal")?.classList.contains("open") && currentDetailJoinId === getNestedValue(applyPayload, "join.id")) {
          renderDetailContent(getCurrentApplyJoin());
        }
        showGlobalApplyCompleteState();
      } catch (error) {
        golfJoinSafeError("Failed to save join apply payload.", error);
        if (isJoinScheduleFullSaveError(error)) {
          await closeJoinActionLoading(loadingToken);
          openJoinScheduleFullAlert();
        } else {
          alert(error?.userMessage || "참여 신청 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        await closeJoinActionLoading(loadingToken);
        if (submitButton && !document.getElementById("globalApplyPanel")?.classList.contains("is-complete")) {
          submitButton.disabled = false;
          submitButton.textContent = previousText;
        }
      }
    }

    function ensurePhonePrefix(input) {
      if (!input) return;
      input.value = input.value.replace(/\D/g, "").slice(0, 11);
    }

    function formatApplyPhone(input) {
      input.value = input.value.replace(/\D/g, "").slice(0, 11);
    }

    function updateTravelerFieldState(input) {
      input?.closest(".traveler-field")?.classList.toggle("is-filled", Boolean(input.value.trim()));
      input?.closest(".field.has-error")?.classList.remove("has-error");
    }

    function handleTravelerFieldFocus(input) {
      if (!input) return;
      input.placeholder = input.dataset.example || input.placeholder;
      updateTravelerFieldState(input);
    }

    function handleTravelerFieldBlur(input) {
      if (!input) return;
      if (!input.value.trim()) input.placeholder = input.dataset.label || input.placeholder;
      updateTravelerFieldState(input);
    }

    function changeApplyPeople(delta, inputId = "detailApplyPeople") {
      const input = document.getElementById(inputId);
      if (!input) return;
      const current = Number(input.value.replace(/\D/g, "")) || 1;
      const next = Math.max(1, Math.min(4, current + delta));
      input.value = `${next}명`;
    }

    function setGlobalApplyPeopleMode(mode) {
      const canGroup = getApplyAvailablePeople("global") > 1;
      const isGroup = mode === "group" && canGroup;
      const accordion = document.getElementById("globalApplyPeopleAccordion");
      syncApplyPeopleModeAvailability("global");
      document.querySelector('[data-people-mode="global"]')?.classList.toggle("is-group", isGroup);
      document.querySelectorAll('[data-people-mode="global"] .apply-people-button').forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === (isGroup ? "group" : "solo"));
      });
      accordion?.classList.toggle("open", isGroup);
      if (!isGroup) {
        setCompanionPeople("global", 1);
        return;
      }
      setCompanionPeople("global", getCompanionPeople("global") > 1 ? getCompanionPeople("global") : 1);
    }

    function setGlobalApplyPeopleCount(value) {
      setCompanionPeople("global", value);
    }

    function getGlobalApplyRemainingSeats() {
      const join = getCurrentApplyJoin();
      if (!join) return 0;
      const capacity = getJoinRecruitmentCapacity(join, JOIN_MAX_CAPACITY);
      if (isMonthlyRecommendationJoin(join) || capacity > JOIN_MAX_CAPACITY) {
        return Math.max(0, capacity - getMonthlyCardParticipantCount(join));
      }
      const explicitEmptySlots = Number(join.emptySlots);
      if (Number.isFinite(explicitEmptySlots) && explicitEmptySlots >= 0) {
        return Math.max(0, Math.round(explicitEmptySlots));
      }
      return Math.max(0, capacity - getConfirmedParticipants(join).length);
    }

    function formatRemainingSeatText(count) {
      return count > 0 ? `${count}자리 남았어요` : "남은 자리 없어요";
    }

    function getGlobalApplySelectedSeatCount() {
      const modeGroup = document.querySelector('[data-people-mode="global"]');
      return modeGroup?.classList.contains("is-group") ? getCompanionPeople("global") : 0;
    }

    function updateGlobalApplyRemainingSeat() {
      const target = document.getElementById("globalApplyRemainingSeat");
      const remaining = Math.max(0, getGlobalApplyRemainingSeats() - getGlobalApplySelectedSeatCount());
      if (target) target.textContent = formatRemainingSeatText(remaining);
      syncApplyPeopleModeAvailability("global");
    }

    function handleGlobalApplyPeopleOptionClick(event, value) {
      event?.preventDefault();
      const selectedCount = Number(String(value).replace(/\D/g, "")) || 2;
      setGlobalApplyPeopleCount(Math.min(selectedCount, getApplyAvailablePeople("global")));
    }

    function showWaitlistApplyModal(message, onConfirm, onSolo) {
      waitlistConfirmAction = onConfirm;
      waitlistSoloAction = onSolo;
      const overlay = portalOverlayToBody("waitlistApplyModal");
      document.getElementById("waitlistApplyMessage").innerHTML = String(message).replace(/\n/g, "<br>");
      overlay?.style.setProperty("z-index", "100920", "important");
      overlay?.querySelector(".modal")?.style.setProperty("z-index", "100921", "important");
      overlay?.classList.add("open");
      setWidgetModalOpen(true);
    }

    function closeWaitlistApplyModal() {
      const modal = document.getElementById("waitlistApplyModal");
      resetModalRuntimeState(modal);
      modal?.classList.remove("open");
      waitlistConfirmAction = null;
      waitlistSoloAction = null;
    }

    function confirmWaitlistApply() {
      const action = waitlistConfirmAction;
      closeWaitlistApplyModal();
      action?.();
    }

    function chooseWaitlistSolo() {
      const action = waitlistSoloAction;
      closeWaitlistApplyModal();
      action?.();
    }

    function handlePhoneContact() {
      const isMobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
      if (isMobile) {
        location.href = "tel:02-3446-1119";
        return;
      }
      openModal("phoneModal");
    }

    function openExternalLink(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function scheduleParticipantClose() {
      clearTimeout(participantCloseTimer);
      participantCloseTimer = setTimeout(() => {
        closeParticipant();
      }, 120);
    }

    function cancelParticipantClose() {
      clearTimeout(participantCloseTimer);
    }

    function lockParticipantPageScroll() {
      if (!isMobileParticipantSheet()) return;
      if (document.body.classList.contains("join-participant-scroll-locked")) return;
      document.body.classList.add("join-participant-scroll-locked");
    }

    function unlockParticipantPageScroll() {
      if (!document.body.classList.contains("join-participant-scroll-locked")) return;
      document.body.classList.remove("join-participant-scroll-locked");
    }

    function getParticipantJoinById(joinId) {
      const id = String(joinId || "");
      if (!id) return null;
      return (currentDetailJoinData && String(currentDetailJoinData.id || "") === id ? currentDetailJoinData : null)
        || joins.find((item) => String(item.id || "") === id)
        || (externalGolfJoinProducts || []).find((item) => String(item.id || "") === id)
        || null;
    }

    function closeParticipant() {
      const modal = document.getElementById("participantModal");
      modal?.classList.remove("sheet-open");
      modal?.classList.remove("open");
      activeParticipantTrigger = null;
      unlockParticipantPageScroll();
      setWidgetModalOpen(hasOpenBlockingModal());
      resumeQuickMobileCarouselIfIdle();
    }
    function getParticipantStyleIcon(tag) {
      const value = String(tag || "");
      if (value.indexOf("매너") >= 0) return "&#x1F91D;";
      if (value.indexOf("명랑") >= 0) return "&#x1F60A;";
      if (value.indexOf("조용") >= 0 || value.indexOf("집중") >= 0 || value.indexOf("실력") >= 0) return "&#x1F3AF;";
      if (value.indexOf("사진") >= 0) return "&#x1F4F7;";
      if (value.indexOf("진행") >= 0 || value.indexOf("빠른") >= 0) return "&#x26A1;";
      if (value.indexOf("초보") >= 0 || value.indexOf("배려") >= 0) return "&#x1F331;";
      if (value.indexOf("대화") >= 0 || value.indexOf("친목") >= 0) return "&#x1F4AC;";
      if (value.indexOf("분위기") >= 0) return "&#x1F324;&#xFE0F;";
      if (value.indexOf("시간") >= 0 || value.indexOf("약속") >= 0) return "&#x23F1;&#xFE0F;";
      if (value.indexOf("편안") >= 0 || value.indexOf("여유") >= 0) return "&#x1F343;";
      if (value.indexOf("해외") >= 0) return "&#x2708;&#xFE0F;";
      return "&#x1F4AC;";
    }

    function getParticipantProfessionIcon(tag) {
      const value = String(tag || "");
      if (/IT|개발|소프트웨어|테크|기술|데이터/i.test(value)) return "&#x1F4BB;";
      if (value.indexOf("경영") >= 0) return "&#x1F4CA;";
      if (value.indexOf("사업") >= 0 || value.indexOf("창업") >= 0) return "&#x1F3E2;";
      if (value.indexOf("부동산") >= 0) return "&#x1F3D8;&#xFE0F;";
      if (value.indexOf("건설") >= 0 || value.indexOf("건축") >= 0) return "&#x1F3D7;&#xFE0F;";
      if (value.indexOf("금융") >= 0 || value.indexOf("투자") >= 0) return "&#x1F4B9;";
      if (value.indexOf("보험") >= 0) return "&#x1F6E1;&#xFE0F;";
      if (value.indexOf("세무") >= 0 || value.indexOf("회계") >= 0) return "&#x1F9FE;";
      if (value.indexOf("법률") >= 0 || value.indexOf("법무") >= 0) return "&#x2696;&#xFE0F;";
      if (value.indexOf("의료") >= 0 || value.indexOf("병원") >= 0 || value.indexOf("의사") >= 0) return "&#x1FA7A;";
      if (value.indexOf("제조") >= 0 || value.indexOf("공장") >= 0) return "&#x1F3ED;";
      if (value.indexOf("유통") >= 0 || value.indexOf("물류") >= 0) return "&#x1F69A;";
      if (value.indexOf("무역") >= 0 || value.indexOf("수출") >= 0 || value.indexOf("수입") >= 0) return "&#x1F30F;";
      if (value.indexOf("영업") >= 0 || value.indexOf("세일즈") >= 0) return "&#x1F91D;";
      if (value.indexOf("교육") >= 0 || value.indexOf("강의") >= 0) return "&#x1F393;";
      if (value.indexOf("공공") >= 0 || value.indexOf("공무") >= 0 || value.indexOf("행정") >= 0) return "&#x1F3DB;&#xFE0F;";
      if (value.indexOf("마케팅") >= 0 || value.indexOf("홍보") >= 0 || value.indexOf("광고") >= 0) return "&#x1F4E3;";
      return "&#x1F4BC;";
    }

    function renderParticipantTag(tag, type = "style") {
      const icon = type === "profession" ? getParticipantProfessionIcon(tag) : getParticipantStyleIcon(tag);
      return `<div class="participant-tag"><span aria-hidden="true">${icon}</span><span>${escapeHtml(tag)}</span></div>`;
    }

    function getParticipantLevelIcon(level) {
      const value = String(level || "");
      if (value.indexOf("프로") >= 0) return "&#x1F393;";
      if (value.indexOf("싱글") >= 0) return "&#x1F3C6;";
      if (value.indexOf("입문") >= 0 || value.indexOf("초보") >= 0) return "&#x1F331;";
      if (value.indexOf("보기") >= 0) return "&#x1F642;";
      if (value.indexOf("80") >= 0) return "&#x26F3;";
      if (value.indexOf("90") >= 0) return "&#x1F3CC;&#xFE0F;";
      if (value.indexOf("100") >= 0) return "&#x1F642;";
      if (value.indexOf("110") >= 0) return "&#x1F331;";
      return "&#x26F3;";
    }

    function formatParticipantLevelLabel(level) {
      const value = String(level || "").trim();
      if (!value) return "골프 수준 미선택";
      if (/입니다|플레이|수준/.test(value)) return value;
      if (/프로/.test(value)) return "골프 프로입니다";
      if (/싱글/.test(value)) return "싱글 수준입니다";
      const score = Number((value.match(/\d+/) || [])[0]);
      if (score && score < 90) return "80대 정도입니다";
      if (score && score < 100) return "90대 정도입니다";
      if (score && score < 110) return "편안한 보기 플레이";
      if (score && score >= 110) return "입문·초보입니다";
      return value;
    }

    function renderParticipantQuoteIcon() {
      return `
        <svg class="participant-quote-icon" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <path d="M18.3 12.5c-4.9 2.7-7.4 6.7-7.4 11.8 0 4.1 2.6 7.2 6.2 7.2 3.2 0 5.5-2.2 5.5-5.2 0-2.9-2-5-4.9-5.2.5-2.1 1.9-3.9 4.1-5.4l-3.5-3.2Z" fill="currentColor"/>
          <path d="M32.7 12.5c-4.9 2.7-7.4 6.7-7.4 11.8 0 4.1 2.6 7.2 6.2 7.2 3.2 0 5.5-2.2 5.5-5.2 0-2.9-2-5-4.9-5.2.5-2.1 1.9-3.9 4.1-5.4l-3.5-3.2Z" fill="currentColor"/>
        </svg>`;
    }

    function getParticipantGroup(join, participant) {
      if (!join || !participant?.companionGroup) return [participant].filter(Boolean);
      return getConfirmedParticipants(join).filter((item) => item.companionGroup === participant.companionGroup);
    }

    function getParticipantGenderLabel(gender) {
      const value = String(gender || "").trim();
      if (/여/.test(value)) return "여성";
      if (/남/.test(value)) return "남성";
      return value || "미상";
    }

    function formatParticipantGroupName(participants) {
      const leader = participants[0] || {};
      const leaderName = String(leader.name || "대표 신청자").trim();
      const extraCount = Math.max(0, participants.length - 1);
      return extraCount > 0 ? `${leaderName} 외 ${extraCount}명` : leaderName;
    }

    function formatParticipantGroupGender(participants, primaryParticipant) {
      const counts = participants.reduce((acc, participant) => {
        const label = getParticipantGenderLabel(participant.gender);
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const primaryLabel = getParticipantGenderLabel(primaryParticipant?.gender);
      const orderedLabels = Object.keys(counts).sort((a, b) => {
        if (a === primaryLabel) return -1;
        if (b === primaryLabel) return 1;
        return a.localeCompare(b, "ko");
      });
      return orderedLabels.map((label) => `${escapeHtml(label)} <span class="participant-meta-count">${counts[label]}</span>`).join(" / ");
    }

    function formatParticipantGroupAges(participants) {
      const counts = participants.reduce((acc, participant) => {
        const label = formatParticipantAge(participant) || "연령 미입력";
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      return Object.keys(counts).join(", ");
    }

    function renderParticipantHeroThumb(participants, primaryParticipant) {
      const first = primaryParticipant || participants[0] || {};
      const orderedParticipants = [
        first,
        ...participants.filter((participant) => participant && participant !== first)
      ].filter(Boolean);
      if (orderedParticipants.length <= 1) {
        return `<div class="participant-thumb"><img src="${first.gif}" alt="${escapeHtml(first.name || "참여자")}" loading="lazy" decoding="async"></div>`;
      }
      const stackCount = orderedParticipants.length;
      const desktopWidth = 48 + (stackCount - 1) * 6;
      const mobileWidth = 58 + (stackCount - 1) * 7;
      const thumbs = orderedParticipants.map((participant, index) => {
        const zIndex = stackCount - index;
        const opacity = index === 0 ? 1 : Math.max(0.52, 0.86 - (index - 1) * 0.18);
        return `<div class="participant-thumb" style="--participant-stack-left:${index * 6}px; --participant-stack-mobile-left:${index * 7}px; --participant-stack-z:${zIndex}; --participant-stack-opacity:${opacity};"><img src="${participant.gif}" alt="${escapeHtml(participant.name || "참여자")}" loading="lazy" decoding="async"></div>`;
      }).join("");
      return `<div class="participant-thumb-stack" style="--participant-stack-width:${desktopWidth}px; --participant-stack-mobile-width:${mobileWidth}px;" aria-hidden="true">${thumbs}</div>`;
    }

    function toggleParticipantInfoHint(event) {
      event.stopPropagation();
      const wrap = event.currentTarget.closest(".participant-info-wrap");
      const wasOpen = wrap?.classList.contains("open");
      document.querySelectorAll(".participant-info-wrap.open").forEach((item) => {
        if (item !== wrap) item.classList.remove("open");
      });
      if (wasOpen) {
        wrap.classList.remove("open");
        wrap.classList.add("suppress-hover");
      } else {
        wrap?.classList.remove("suppress-hover");
        wrap?.classList.add("open");
      }
    }

    function toggleMdPickPackTooltip(event, countryKey) {
      event.stopPropagation();
      const tooltip = document.getElementById(`mdPickPackTooltip-${countryKey}`);
      if (!tooltip) return;
      const wasOpen = tooltip.classList.contains("open");
      document.querySelectorAll(".join-mdpick-pack-tooltip.open").forEach((item) => {
        if (item !== tooltip) item.classList.remove("open");
      });
      if (wasOpen) {
        tooltip.classList.remove("open");
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const margin = 12;
      const tooltipWidth = Math.min(tooltip.offsetWidth || 280, Math.max(0, viewportWidth - (margin * 2)));
      const tooltipHeight = tooltip.offsetHeight || 120;
      const centerLeft = rect.left + (rect.width / 2);
      const tooltipLeft = Math.min(
        Math.max(centerLeft, margin + (tooltipWidth / 2)),
        Math.max(margin + (tooltipWidth / 2), viewportWidth - margin - (tooltipWidth / 2))
      );
      const canShowAbove = rect.top >= tooltipHeight + margin + 12;
      const canShowBelow = viewportHeight - rect.bottom >= tooltipHeight + margin + 12;
      const showBelow = !canShowAbove && canShowBelow;
      tooltip.classList.toggle("below", showBelow);
      tooltip.style.setProperty("--mdpick-pack-tooltip-left", `${tooltipLeft}px`);
      tooltip.style.setProperty("--mdpick-pack-tooltip-top", `${showBelow ? rect.bottom : rect.top}px`);
      tooltip.classList.add("open");
    }

    function closeMdPickPackTooltips() {
      document.querySelectorAll(".join-mdpick-pack-tooltip.open").forEach((item) => {
        item.classList.remove("open");
      });
    }

    function getConfirmedParticipants(join) {
      return (Array.isArray(join?.participants) ? join.participants : []).filter((participant) => participant.status === "confirmed");
    }

    function getParticipantGenderFlowClass(gender) {
      const normalizedGender = String(gender || "").trim();
      if (normalizedGender === "여성" || normalizedGender.toLowerCase() === "female") return "participant-gender-female";
      return "participant-gender-male";
    }

    function hashStringToNumber(value) {
      const source = String(value || "");
      let hash = 0;
      for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
      }
      return Math.abs(hash);
    }

    function getParticipantGenderKey(participant) {
      const gender = String(participant?.gender || "").trim().toLowerCase();
      const gif = String(participant?.gif || "").toLowerCase();
      if (gender === "female" || gender.includes("woman") || gender.includes("여") || gif.includes("woman")) return "female";
      return "male";
    }

    function getUniqueCardParticipants(participants, joinId) {
      const usedByGender = { male: new Set(), female: new Set() };
      return participants.map((participant, index) => {
        const genderKey = getParticipantGenderKey(participant);
        const pool = BUILDER_APPLICATION_GENDER_ICON_POOLS[genderKey] || BUILDER_APPLICATION_GENDER_ICON_POOLS.male;
        const used = usedByGender[genderKey];
        const startIndex = hashStringToNumber(`${joinId}|${participant.id}|${index}`) % pool.length;
        let gif = participant.gif;
        for (let offset = 0; offset < pool.length; offset += 1) {
          const candidate = pool[(startIndex + offset) % pool.length];
          if (!used.has(candidate)) {
            gif = candidate;
            break;
          }
        }
        used.add(gif);
        return { ...participant, gif };
      });
    }

    function getParticipantFlowDelayStyle(participant, joinId) {
      const source = [joinId, participant?.id, participant?.gender, participant?.name].filter(Boolean).join("|");
      const delaySeconds = (hashStringToNumber(source) % 8000) / 1000;
      return `--participant-flow-delay:-${delaySeconds.toFixed(2)}s;`;
    }

    function participantButtonHtml(participant, joinId, compact = true, options = {}) {
      const payload = encodeURIComponent(JSON.stringify({ joinId, participantId: participant.id }));
      const genderFlowClass = getParticipantGenderFlowClass(participant.gender);
      const flowDelayStyle = getParticipantFlowDelayStyle(participant, joinId);
      const shouldCheckCurrentMember = !compact || options.showCurrentMemberBadge;
      const isCurrentMember = shouldCheckCurrentMember && isJoinParticipantForCurrentMemberInSchedule(participant, options.join || joinId);
      const showCurrentMemberBadge = isCurrentMember && (!compact || options.showCurrentMemberBadge);
      const roleBadge = showCurrentMemberBadge
        ? `<div class="join-my-card-participant-me-badge${compact ? "" : " detail-me-badge"}">나</div>`
        : (participant.isHost || participant.isCreator) && (!compact || options.showCurrentMemberBadge)
        ? `<div class="join-my-card-participant-me-badge host${compact ? "" : " detail-me-badge"}">모임장</div>`
        : "";
      return `<div class="team-avatar-wrap">
        <button type="button" class="team-avatar participant-flow-avatar ${genderFlowClass}${compact ? "" : " detail-avatar"}" data-participant="${payload}" data-participant-gender="${escapeHtml(participant.gender || "")}" style="${flowDelayStyle}" onclick="event.stopPropagation(); handleParticipantClick(this)" title="${participant.name} / ${participant.age} / ${participant.handicap}" aria-label="${participant.name} 참여자 정보">
          <img src="${participant.gif}" alt="${participant.name}">
        </button>
        ${participant.status === "pending" ? '<div class="participant-badge">대기</div>' : ""}
        ${roleBadge}
      </div>`;
    }

    function renderParticipantGroupHtml(participants, joinId, compact = true, options = {}) {
      if (!participants.length) return "";
      if (participants.length === 1 || !participants[0].companionGroup) {
        return participantButtonHtml(participants[0], joinId, compact, options);
      }
      return `<div class="team-couple-wrap">${participants.map((participant) => participantButtonHtml(participant, joinId, compact, options)).join("")}</div>`;
    }

    function renderGroupedParticipantsHtml(participants, joinId, compact = true, options = {}) {
      const renderedGroups = [];
      for (let index = 0; index < participants.length;) {
        const participant = participants[index];
        const groupKey = participant.companionGroup || "";
        if (!groupKey) {
          renderedGroups.push(participantButtonHtml(participant, joinId, compact, options));
          index += 1;
          continue;
        }
        const groupedParticipants = [];
        while (index < participants.length && participants[index].companionGroup === groupKey) {
          groupedParticipants.push(participants[index]);
          index += 1;
        }
        renderedGroups.push(renderParticipantGroupHtml(groupedParticipants, joinId, compact, options));
      }
      return renderedGroups.join("");
    }

    function getBadgeKind(join) {
      if (join.badgeKind) return join.badgeKind;
      if (join.badgeImage === BADGE_IMAGES.justgo) return "justgo";
      if (join.badgeImage === BADGE_IMAGES.limit) return "limit";
      if (join.badgeImage === BADGE_IMAGES.special) return "special";
      if (join.badgeImage === BADGE_IMAGES.lowest) return "lowest";
      return "";
    }

    function badgeTooltipHtml(kind) {
      return "";
    }

    function renderJoinLocationBadge(join) {
      return `<div class="join-location-badge">
        <svg class="card-meta-icon card-meta-icon-location" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/>
        </svg>
        <div class="join-location-badge-text">${getJoinRegionLabel(join)}</div>
      </div>`;
    }

    function emptySlotHtml(compact = true, joinId = "", options = {}) {
      if (options.disabled) {
        return `<div class="team-avatar-wrap">
          <button type="button" class="team-empty${compact ? "" : " detail-empty"} is-disabled" disabled aria-label="빈 인원 슬롯">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-icon lucide-user" aria-hidden="true">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          </button>
        </div>`;
      }
      const action = `openGlobalApplyFor('${joinId}')`;
      return `<div class="team-avatar-wrap">
        <button type="button" class="team-empty${compact ? "" : " detail-empty"}" onclick="event.stopPropagation(); ${action}" aria-label="참여 신청">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-plus-icon lucide-user-plus" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M19 8v6"/>
          <path d="M22 11h-6"/>
        </svg>
        </button>
      </div>`;
    }

    function renderCardTeamSlots(join, compact = true, maxSlots = 4, options = {}) {
      const slotLimit = Math.min(JOIN_MAX_CAPACITY, maxSlots);
      const confirmedParticipants = getUniqueCardParticipants(getConfirmedParticipants(join).slice(0, slotLimit), join.id);
      const emptyCount = Math.max(0, Math.min(Number(join.emptySlots) || 0, slotLimit - confirmedParticipants.length));
      return [
        renderGroupedParticipantsHtml(confirmedParticipants, join.id, compact, { ...options, join }),
        ...Array.from({ length: emptyCount }).map(() => emptySlotHtml(compact, join.id, { disabled: !options.allowEmptySlots }))
      ].join("");
    }

    function getMonthlyCardParticipantCount(join = {}) {
      const values = [
        join.participantSummary?.confirmedCount,
        join.lightSummary?.confirmedCount,
        join.confirmedCount,
        join.currentCount,
        join.participantCount,
        getConfirmedParticipants(join).length
      ];
      const count = values.map(Number).find((value) => Number.isFinite(value) && value >= 0);
      return Math.max(0, count || 0);
    }

    function renderMonthlyCardThumbStack(join = {}, count = 0) {
      const visibleCount = Math.min(4, Math.max(0, Number(count) || 0));
      if (!visibleCount) return "";
      const participants = getUniqueCardParticipants(getConfirmedParticipants(join), join.id || "").slice(0, visibleCount);
      const fallbackIcons = [
        BUILDER_APPLICATION_GENDER_ICON_POOLS.male[0],
        BUILDER_APPLICATION_GENDER_ICON_POOLS.female[0],
        BUILDER_APPLICATION_GENDER_ICON_POOLS.male[1],
        BUILDER_APPLICATION_GENDER_ICON_POOLS.female[1]
      ];
      const thumbs = Array.from({ length: visibleCount }).map((_, index) => {
        const participant = participants[index] || {};
        const src = participant.gif || fallbackIcons[index % fallbackIcons.length] || BUILDER_APPLICATION_GENDER_ICON_POOLS.male[0];
        const alt = participant.name ? `${participant.name} 참여자` : "참여자";
        return `<div class="monthly-card-thumb"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></div>`;
      }).join("");
      const overlap = visibleCount >= 4 ? -15 : visibleCount === 3 ? -10 : -7;
      return `<div class="monthly-card-thumb-stack" style="--monthly-card-thumb-overlap:${overlap}px;" aria-hidden="true">${thumbs}</div>`;
    }

    function renderMonthlyCardTeamSlots(join, compact = true) {
      const capacity = getJoinRecruitmentCapacity(join, Number(join.maxCapacity || join.capacity || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY);
      const currentCount = getMonthlyCardParticipantCount(join);
      const displayCapacity = Math.max(capacity, currentCount || 0);
      const progress = displayCapacity > 0 ? Math.max(0, Math.min(100, Math.round((currentCount / displayCapacity) * 100))) : 0;
      const participantLabel = currentCount > 0 ? `현재 ${currentCount}명 참여중` : "&#x1F525; 모집중";
      return `
        <div class="monthly-card-participant-summary" aria-label="월례회 참여 현황">
          <div class="monthly-card-participant-head">
            <div class="monthly-card-participant-left">
              <div class="monthly-card-participant-label">${participantLabel}</div>
            </div>
            <div class="monthly-card-count">${currentCount}/${displayCapacity}명</div>
          </div>
          <div class="monthly-card-progress-track" aria-hidden="true">
            <div class="monthly-card-progress-fill" style="--monthly-card-progress: ${progress}%;"></div>
          </div>
        </div>
      `;
    }

    function renderMonthlyCalendarParticipantSummary(join) {
      const currentCount = getMonthlyCardParticipantCount(join);
      const capacity = getJoinRecruitmentCapacity(join, Number(join.maxCapacity || join.capacity || JOIN_MAX_CAPACITY) || JOIN_MAX_CAPACITY);
      return `
        <div class="calendar-monthly-participant-box">
          <div class="calendar-monthly-participant-item">
            <div class="calendar-monthly-participant-label">현재인원</div>
            <div class="calendar-monthly-participant-value">${currentCount}명</div>
          </div>
          <div class="calendar-monthly-participant-item">
            <div class="calendar-monthly-participant-label">모집인원</div>
            <div class="calendar-monthly-participant-value">${capacity}명</div>
          </div>
        </div>
      `;
    }

    function getCardTeamCapacity(join, maxSlots = 4) {
      if (isMonthlyRecommendationJoin(join)) {
        return getJoinRecruitmentCapacity(join, Number(join.maxCapacity || join.capacity || maxSlots) || maxSlots);
      }
      const slotLimit = Math.min(JOIN_MAX_CAPACITY, maxSlots);
      const confirmedCount = Math.min(slotLimit, getJoinAuthoritativeConfirmedCount(join));
      const rawCapacity = confirmedCount + (Number(join.emptySlots) || 0);
      return Math.max(confirmedCount, Math.min(slotLimit, rawCapacity || slotLimit));
    }

    function getJoinCountdownNowTimestamp() {
      return Date.now();
    }

    function getJoinReservationDeadlineTimestamp(join) {
      const departure = parseJoinDate(join.departureDate);
      departure.setDate(departure.getDate() - 7);
      departure.setHours(23, 59, 59, 999);
      return departure.getTime();
    }

    function formatReservationRemaining(deadlineTimestamp) {
      const remaining = Math.max(0, Number(deadlineTimestamp) - getJoinCountdownNowTimestamp());
      const totalSeconds = Math.floor(remaining / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `예약마감 ${days}일 ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} 남음`;
    }

    function renderJoinReservationCountdown(join) {
      const deadlineTimestamp = getJoinReservationDeadlineTimestamp(join);
      return `
        <div class="join-reservation-countdown" data-reservation-deadline="${deadlineTimestamp}" aria-label="예약 가능 시간">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor"/>
            <path d="M12 7v5l3 2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="join-reservation-countdown-time">${formatReservationRemaining(deadlineTimestamp)}</div>
        </div>
      `;
    }

    function updateJoinReservationCountdowns() {
      document.querySelectorAll(".join-reservation-countdown[data-reservation-deadline]").forEach((item) => {
        const time = item.querySelector(".join-reservation-countdown-time");
        if (!time) return;
        time.textContent = formatReservationRemaining(item.dataset.reservationDeadline);
      });
    }

    function ensureJoinReservationCountdownTimer() {
      updateJoinReservationCountdowns();
      if (joinReservationCountdownTimer) return;
      joinReservationCountdownTimer = setInterval(updateJoinReservationCountdowns, 1000);
    }

    function renderJoinCard(join, options = {}) {
      const isMonthlyCard = isMonthlyRecommendationJoin(join);
      const cardClass = ["join-card", options.cardClass].filter(Boolean).join(" ");
      const shortDate = options.shortDate || "";
      const isSoonCard = Boolean(shortDate);
      const reviewCount = getJoinReviewCount(join);
      const detailOptions = options.allowUnavailable ? ", { allowUnavailable: true }" : "";
      const myJoinCardAttribute = options.myJoinFilter ? ` data-my-join-card="${options.myJoinFilter}"` : "";
      const hiddenAttribute = options.hidden ? " hidden" : "";
      return `
        <article class="${cardClass}"${shortDate ? ` data-short-date="${shortDate}"` : ""}${myJoinCardAttribute}${hiddenAttribute} onclick="openDetail('${join.id}'${detailOptions})">
          <div class="join-thumb">
            <img src="${join.image}" alt="${join.title}" loading="lazy" decoding="async">
            ${options.thumbOverlay || ""}
            ${renderJoinLocationBadge(join)}
            ${renderJoinOwnScheduleBadge(join)}
          </div>
          <div class="join-body">
            ${isSoonCard ? "" : `
              <div class="join-category-row">
                ${options.featureTag ? `<div class="join-card-feature-tag"${options.featureTagColor ? ` style="--feature-tag-color:${options.featureTagColor};--feature-tag-soft:${options.featureTagSoft || "rgba(241, 245, 249, .9)"};"` : ""}>${options.featureTag}</div>` : ""}
                ${join.isAdminRecommendedSchedule ? `<div class="join-recommended-schedule-chip">추천일정</div>` : ""}
                ${renderJoinCategoryChip(join)}
                ${renderJoinFlightChip(join)}
              </div>
            `}
            ${false ? `
            <div class="card-meta card-meta-row">
              <div class="card-meta-item">
                <svg class="card-meta-icon card-meta-icon-location" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="2"/>
                </svg>
                <div class="card-meta-text card-meta-text-location">${getJoinLocationLabel(join)}</div>
                ${renderJoinCategoryChip(join)}
              </div>
            </div>
            ` : ""}
            ${isSoonCard ? renderJoinReservationCountdown(join) : ""}
            <div class="join-title">${join.title}</div>
            ${renderCardDateMeta(join)}
            ${options.showIncludes ? `<div class="join-card-include-tags">${renderJoinIncludeTags(join)}</div>` : ""}
            ${options.showParticipantCopy ? renderJoinParticipantCopy(join) : ""}
            <div class="join-price">
              <div class="join-price-value">${formatPrice(join.price)}</div>
              <div class="join-price-unit">원</div>
            </div>
            ${options.showReviewNote && reviewCount ? `<div class="join-card-review-note">후기 ${reviewCount}개로 검증</div>` : ""}
            <div class="team-row${isMonthlyCard ? " monthly-card-team" : ""}">
              ${isMonthlyCard ? renderMonthlyCardTeamSlots(join) : renderCardTeamSlots(join, true, 4, {
                showCurrentMemberBadge: options.showCurrentMemberBadge === true
              })}
            </div>
          </div>
        </article>
      `;
    }

    function parseJoinDate(value) {
      return new Date(`${value}T00:00:00`);
    }

    function getTodayDate() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function isWithinOneMonth(join) {
      const today = getTodayDate();
      const limit = new Date(today);
      limit.setMonth(limit.getMonth() + 1);
      const departure = parseJoinDate(join.departureDate);
      return departure >= today && departure <= limit;
    }

    function isWithinDays(join, days) {
      if (join?.isSoonLoadMoreFixture) return true;
      const today = getTodayDate();
      const limit = new Date(today);
      limit.setDate(limit.getDate() + Number(days || 0));
      const departure = parseJoinDate(join.departureDate);
      return departure >= today && departure <= limit;
    }

    function getJoinDaysFromToday(join) {
      const today = getTodayDate();
      const departure = parseJoinDate(join.departureDate);
      return Math.floor((departure - today) / (1000 * 60 * 60 * 24));
    }

    function isWithinSoonRange(join, filter) {
      const diff = getJoinDaysFromToday(join);
      if (diff < Number(filter.minDays || 0)) return false;
      if (filter.maxDays == null) return true;
      return diff <= Number(filter.maxDays);
    }

    function isSoonCandidate(join) {
      return getJoinDaysFromToday(join) >= 7;
    }

    function getAvailableSoonRangeFilters(items = []) {
      return SOON_RANGE_FILTERS.filter((filter) => items.some((join) => isWithinSoonRange(join, filter)));
    }

    function getActiveSoonRangeFilter(items = []) {
      const availableFilters = getAvailableSoonRangeFilters(items);
      return availableFilters.find((item) => item.key === activeSoonRangeKey)
        || availableFilters[0]
        || SOON_RANGE_FILTERS[0];
    }

    function getSoonFilteredItems(items) {
      const filter = getActiveSoonRangeFilter(items);
      return sortByDeparture(items.filter((join) => isWithinSoonRange(join, filter)));
    }

    function isSoonMobilePagedLayout() {
      return window.matchMedia?.("(max-width: 640px)")?.matches || window.innerWidth <= 640;
    }

    function getSoonPageSize() {
      return isSoonMobilePagedLayout() ? SOON_MOBILE_PAGE_SIZE : SOON_DESKTOP_PAGE_SIZE;
    }

    function getSoonVisibleCount() {
      return isSoonMobilePagedLayout() ? soonMobileVisibleCount : soonDesktopVisibleCount;
    }

    function resetSoonVisibleCount() {
      soonMobileVisibleCount = SOON_MOBILE_PAGE_SIZE;
      soonDesktopVisibleCount = SOON_DESKTOP_PAGE_SIZE;
    }

    function increaseSoonVisibleCount() {
      if (isSoonMobilePagedLayout()) {
        soonMobileVisibleCount += SOON_MOBILE_PAGE_SIZE;
      } else {
        soonDesktopVisibleCount += SOON_DESKTOP_PAGE_SIZE;
      }
    }

    function getSoonDisplayItems(items) {
      const filteredItems = getSoonFilteredItems(items);
      return filteredItems.slice(0, Math.max(getSoonPageSize(), getSoonVisibleCount()));
    }

    function isOverseasJoin(join) {
      return getJoinCategoryClass(join) === "overseas";
    }

    function getJoinReviewCount(join) {
      return getSheetDetailReviews(join).length;
    }

    function sortByDeparture(items) {
      return [...items].sort((a, b) => parseJoinDate(a.departureDate) - parseJoinDate(b.departureDate));
    }

    function getJoinShortDateLabel(join) {
      const date = parseJoinDate(join.departureDate);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}.${day}`;
    }

    function getJoinDateKey(join) {
      return join.departureDate;
    }

    function getJoinDateRailLabel(join) {
      const date = parseJoinDate(join.departureDate);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      return `${month}.${day}(${weekdays[date.getDay()]})`;
    }

    function getJoinDateRailLabelHtml(join) {
      const date = parseJoinDate(join.departureDate);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      return `${month}.${day}<div class="join-soon-date-weekday">${weekdays[date.getDay()]}</div>`;
    }

    function getSoonCardDepartureLabel(join) {
      const date = parseJoinDate(join.departureDate);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}.${date.getDate()} ${weekdays[date.getDay()]}`;
    }

    function formatSoonThumbDateLabel(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      return `${date.getMonth() + 1}.${date.getDate()} ${weekdays[date.getDay()]}`;
    }

    function renderSoonThumbDateRangePart(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      return `<div class="join-soon-thumb-date-range-number">${date.getMonth() + 1}.${date.getDate()}</div><div class="join-soon-thumb-date-range-weekday">${weekdays[date.getDay()]}</div>`;
    }

    function getSoonFlexibleDepartureRange(join) {
      const departureDates = getJoinDateArray(join, "departureDates")
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort();
      if (departureDates.length > 1) {
        return {
          start: parseJoinDate(departureDates[0]),
          end: parseJoinDate(departureDates[departureDates.length - 1])
        };
      }

      const flex = getJoinFlexibleDays(join);
      if ((flex.startBefore || flex.startAfter) && join.departureDate) {
        const start = parseJoinDate(join.departureDate);
        const end = parseJoinDate(join.departureDate);
        start.setDate(start.getDate() - flex.startBefore);
        end.setDate(end.getDate() + flex.startAfter);
        return { start, end };
      }

      return null;
    }

    function renderSoonCardDepartureLabel(join) {
      const flexibleRange = getSoonFlexibleDepartureRange(join);
      if (flexibleRange) {
        const startPart = renderSoonThumbDateRangePart(flexibleRange.start);
        const endPart = renderSoonThumbDateRangePart(flexibleRange.end);
        const isSameDate = formatSoonThumbDateLabel(flexibleRange.start) === formatSoonThumbDateLabel(flexibleRange.end);
        const rangeHtml = startPart && endPart && !isSameDate
          ? `${startPart}<div class="join-soon-thumb-date-range-separator">~</div>${endPart}`
          : startPart || endPart;
        if (rangeHtml) return `<div class="join-soon-thumb-date-range">${rangeHtml}<div class="join-soon-thumb-date-range-label">출발</div></div>`;
      }

      const date = parseJoinDate(join.departureDate);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      return `
        <div class="join-soon-thumb-date-number">${date.getMonth() + 1}.${date.getDate()}</div>
        <div class="join-soon-thumb-date-weekday">${weekdays[date.getDay()]}</div>
        <div class="join-soon-thumb-date-label">출발</div>
      `;
    }

    function renderSoonThumbOverlay(join) {
      const dday = formatJoinMyDday(join.departureDate);
      return `
        <div class="join-soon-thumb-overlay">
          <div class="join-soon-thumb-bottom">
            <div class="join-soon-thumb-main">
              ${dday ? `<div class="join-soon-thumb-duration">${escapeHtml(dday)}</div>` : ""}
              <div class="join-soon-thumb-date">${renderSoonCardDepartureLabel(join)}</div>
            </div>
          </div>
        </div>
      `;
    }

    function getJoinDateRailWeekdayClass(join) {
      return parseJoinDate(join.departureDate).getDay() === 0 ? " sunday" : "";
    }

    function formatSoonMonthLabel(monthKey) {
      const month = Number(monthKey.split("-")[1]);
      return `${month}\uC6D4`;
    }

    function getJoinCardOptions(section, join, index) {
      if (section.key === "quick") {
        return {
          cardClass: "featured",
          featureTag: Number(join.emptySlots) === 1 ? "마지막 1자리" : "마감임박",
          showIncludes: true,
          showParticipantCopy: true
        };
      }
      if (section.key === "soon") {
        return {
          shortDate: getJoinShortDateLabel(join),
          thumbOverlay: renderSoonThumbOverlay(join)
        };
      }
      return {};
    }

    function getSectionDisplayItems(section) {
      if (section.key === "soon") return getSoonDisplayItems(section.items);
      if (section.key === "overseas") {
        const filteredItems = getOverseasBestFilteredItems(section.items);
        const isMobileLayout = isMobileSlideDotsViewport();
        overseasBestLastMobileLayout = isMobileLayout;
        return isMobileLayout
          ? filteredItems
          : filteredItems.slice(0, Math.max(OVERSEAS_BEST_INITIAL_VISIBLE_COUNT, overseasBestVisibleCount));
      }
      if (section.key !== "quick") return section.items;
      if (isLargeDesktopQuickLayout()) return section.items;
      if (section.items.length <= QUICK_SECTION_DISPLAY_LIMIT) return section.items;
      const start = ((quickSectionFeaturedIndex % section.items.length) + section.items.length) % section.items.length;
      return section.items
        .slice(start)
        .concat(section.items.slice(0, start))
        .slice(0, QUICK_SECTION_DISPLAY_LIMIT);
    }


    // GOLFJOIN_DIAGNOSTICS_START
    // Diagnostics stay in the browser Performance Timeline only. Mark names are
    // static and diagnostic console arguments are sanitized before they are shown.
    const GOLFJOIN_PERFORMANCE_ENTRY_PREFIX = "golfjoin:";
    const GOLFJOIN_PERFORMANCE_MARK_NAMES = new Set([
      "golfjoin:boot:start",
      "golfjoin:boot:overlay-open",
      "golfjoin:boot:interactive",
      "golfjoin:boot:products-ready",
      "golfjoin:boot:products-failed",
      "golfjoin:boot:bootstrap-settled",
      "golfjoin:home:local-render-start",
      "golfjoin:home:local-render-ready",
      "golfjoin:mdpick:data-ready",
      "golfjoin:mdpick:primary-render-start",
      "golfjoin:mdpick:primary-dom-ready",
      "golfjoin:image:mdpick-first-ready",
      "golfjoin:image:mdpick-first-failed",
      "golfjoin:private:start",
      "golfjoin:private:ready",
      "golfjoin:detail:start",
      "golfjoin:detail:visible",
      "golfjoin:detail:erp-ready",
      "golfjoin:detail:erp-failed",
      "golfjoin:detail:flight-ready",
      "golfjoin:detail:flight-failed"
    ]);
    const GOLFJOIN_PERFORMANCE_MEASURE_NAMES = new Set([
      "golfjoin:duration:boot-interactive",
      "golfjoin:duration:home-products",
      "golfjoin:duration:home-bootstrap",
      "golfjoin:duration:home-local-render",
      "golfjoin:duration:mdpick-data",
      "golfjoin:duration:mdpick-primary-render",
      "golfjoin:duration:mdpick-data-to-dom",
      "golfjoin:duration:mdpick-first-image",
      "golfjoin:duration:private-data",
      "golfjoin:duration:detail-visible",
      "golfjoin:duration:detail-erp",
      "golfjoin:duration:detail-flight"
    ]);
    const GOLFJOIN_ORIGINAL_CONSOLE = {
      warn: window.console?.warn?.bind(window.console) || (() => {}),
      error: window.console?.error?.bind(window.console) || (() => {}),
      log: window.console?.log?.bind(window.console) || (() => {})
    };
    const golfJoinPerformanceOnceMarks = new Set();
    const golfJoinObservedPerformanceImages = new WeakSet();
    const golfJoinDiagnosticPrivateValues = new Set();
    let golfJoinDetailPerformanceGeneration = 0;

    function isGolfJoinSensitiveDiagnosticKey(key = "") {
      const normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
      return /^(?:name|phone|mobile|email|memberkey|memberid|memberseq|membername|applicantname|applicantphone|applicantmobile|applicantemail|creatorname|hostname|username|customername|token|accesstoken|refreshtoken|authorization|cookie|password|birthday|birthdate)$/.test(normalized);
    }

    function registerGolfJoinDiagnosticPrivateValues(member = {}) {
      if (!member || typeof member !== "object") return;
      [
        "name", "memberName", "applicantName", "phone", "mobile", "memberMobile",
        "email", "memberEmail", "memberKey", "memberId", "memberSeq"
      ].forEach((key) => {
        const value = String(member[key] ?? "").trim();
        if (value.length >= 2) golfJoinDiagnosticPrivateValues.add(value);
      });
    }

    function sanitizeGolfJoinDiagnosticString(value = "", options = {}) {
      let output = String(value ?? "");
      const trimmed = output.trim();
      if (options.parseJson !== false && trimmed.length <= 100000 && (
        (trimmed.startsWith("{") && trimmed.endsWith("}"))
        || (trimmed.startsWith("[") && trimmed.endsWith("]"))
      )) {
        try {
          return JSON.stringify(sanitizeGolfJoinDiagnosticValue(JSON.parse(trimmed), 0, new WeakSet()));
        } catch (error) {
          // Non-JSON diagnostic text continues through the normal masking rules.
        }
      }
      output = output.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]");
      output = output.replace(/\b(?:\+?82[-\s]?(?:0)?1[016789]|01[016789])[-\s]?\d{3,4}[-\s]?\d{4}\b/g, "[redacted-phone]");
      output = output.replace(/https?:\/\/[^\s\"'<>]+/gi, (candidate) => {
        const trailingMatch = candidate.match(/[),.;]+$/);
        const trailing = trailingMatch?.[0] || "";
        const core = trailing ? candidate.slice(0, -trailing.length) : candidate;
        try {
          const parsed = new URL(core);
          return `${parsed.origin}${parsed.pathname}${trailing}`;
        } catch (error) {
          return candidate.replace(/[?#].*$/, "");
        }
      });
      output = output.replace(/(^|[\s(\"'])((?:\/|\.\.?\/)[^\s\"'<>?#]+)\?[^\s\"'<>]*/g, "$1$2");
      output = output.replace(/\b(memberKey|memberId|memberSeq|memberMobile|memberEmail|phone|mobile|email|name)=([^\s&]+)/gi, "$1=[redacted]");
      golfJoinDiagnosticPrivateValues.forEach((privateValue) => {
        output = output.split(privateValue).join("[redacted-private]");
      });
      return output;
    }

    function sanitizeGolfJoinDiagnosticValue(value, depth = 0, seen = new WeakSet()) {
      if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") return value;
      if (typeof value === "string") return sanitizeGolfJoinDiagnosticString(value);
      if (typeof value === "bigint") return String(value);
      if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;
      const isError = value instanceof Error || Object.prototype.toString.call(value) === "[object Error]";
      if (isError) {
        return {
          name: sanitizeGolfJoinDiagnosticString(value.name || "Error", { parseJson: false }),
          message: sanitizeGolfJoinDiagnosticString(value.message || "", { parseJson: false }),
          code: sanitizeGolfJoinDiagnosticString(value.code || value.serverCode || "", { parseJson: false }),
          status: Number(value.status) || undefined
        };
      }
      if (depth >= 4) return "[truncated]";
      if (seen.has(value)) return "[circular]";
      seen.add(value);
      if (Array.isArray(value)) {
        return value.slice(0, 30).map((item) => sanitizeGolfJoinDiagnosticValue(item, depth + 1, seen));
      }
      const result = {};
      Object.entries(value).slice(0, 50).forEach(([key, item]) => {
        result[key] = isGolfJoinSensitiveDiagnosticKey(key)
          ? "[redacted]"
          : sanitizeGolfJoinDiagnosticValue(item, depth + 1, seen);
      });
      return result;
    }

    function golfJoinSafeConsole(method, args = []) {
      const logger = GOLFJOIN_ORIGINAL_CONSOLE[method] || GOLFJOIN_ORIGINAL_CONSOLE.log;
      try {
        logger(...Array.from(args).map((item) => sanitizeGolfJoinDiagnosticValue(item)));
      } catch (error) {
        logger("[GolfJoin] Diagnostic logging failed safely.");
      }
    }

    function golfJoinSafeWarn(...args) {
      golfJoinSafeConsole("warn", args);
    }

    function golfJoinSafeError(...args) {
      golfJoinSafeConsole("error", args);
    }

    function golfJoinSafeLog(...args) {
      golfJoinSafeConsole("log", args);
    }

    function markGolfJoinPerformance(name, options = {}) {
      if (!GOLFJOIN_PERFORMANCE_MARK_NAMES.has(name) || !window.performance?.mark) return false;
      if (options.once && golfJoinPerformanceOnceMarks.has(name)) return false;
      try {
        window.performance.mark(name);
        if (options.once) golfJoinPerformanceOnceMarks.add(name);
        return true;
      } catch (error) {
        return false;
      }
    }

    function measureGolfJoinPerformance(name, startMark, endMark) {
      if (
        !GOLFJOIN_PERFORMANCE_MEASURE_NAMES.has(name)
        || !GOLFJOIN_PERFORMANCE_MARK_NAMES.has(startMark)
        || !GOLFJOIN_PERFORMANCE_MARK_NAMES.has(endMark)
        || !window.performance?.measure
      ) return false;
      try {
        window.performance.measure(name, startMark, endMark);
        return true;
      } catch (error) {
        return false;
      }
    }

    function markGolfJoinPerformanceOnce(name, measureName = "", startMark = "") {
      const marked = markGolfJoinPerformance(name, { once: true });
      if (marked && measureName && startMark) measureGolfJoinPerformance(measureName, startMark, name);
      return marked;
    }

    function beginGolfJoinDetailPerformance() {
      golfJoinDetailPerformanceGeneration += 1;
      [
        "golfjoin:detail:start", "golfjoin:detail:visible", "golfjoin:detail:erp-ready",
        "golfjoin:detail:erp-failed", "golfjoin:detail:flight-ready", "golfjoin:detail:flight-failed"
      ].forEach((name) => window.performance?.clearMarks?.(name));
      [
        "golfjoin:duration:detail-visible", "golfjoin:duration:detail-erp", "golfjoin:duration:detail-flight"
      ].forEach((name) => window.performance?.clearMeasures?.(name));
      markGolfJoinPerformance("golfjoin:detail:start");
      return golfJoinDetailPerformanceGeneration;
    }

    function finishGolfJoinDetailPerformance(generation, markName, measureName) {
      if (generation !== golfJoinDetailPerformanceGeneration) return false;
      const marked = markGolfJoinPerformance(markName);
      if (marked && measureName) measureGolfJoinPerformance(measureName, "golfjoin:detail:start", markName);
      return marked;
    }

    function observeGolfJoinMdPickFirstImageReady(root = document) {
      if (
        golfJoinPerformanceOnceMarks.has("golfjoin:image:mdpick-first-ready")
        || golfJoinPerformanceOnceMarks.has("golfjoin:image:mdpick-first-failed")
      ) return;
      const image = root?.querySelector?.(".join-mdpick-card img");
      if (!image || golfJoinObservedPerformanceImages.has(image)) return;
      golfJoinObservedPerformanceImages.add(image);
      const finish = (markName) => markGolfJoinPerformanceOnce(
        markName,
        "golfjoin:duration:mdpick-first-image",
        "golfjoin:boot:start"
      );
      if (image.complete) {
        finish(image.naturalWidth > 0 ? "golfjoin:image:mdpick-first-ready" : "golfjoin:image:mdpick-first-failed");
        return;
      }
      image.addEventListener("load", () => finish("golfjoin:image:mdpick-first-ready"), { once: true });
      image.addEventListener("error", () => finish("golfjoin:image:mdpick-first-failed"), { once: true });
    }

    function getGolfJoinPerformanceSnapshot() {
      if (!window.performance?.getEntriesByType) return [];
      return [
        ...window.performance.getEntriesByType("mark"),
        ...window.performance.getEntriesByType("measure")
      ].filter((entry) => String(entry.name || "").startsWith(GOLFJOIN_PERFORMANCE_ENTRY_PREFIX))
        .map((entry) => ({
          name: String(entry.name || ""),
          entryType: String(entry.entryType || ""),
          startTime: Math.round((Number(entry.startTime) || 0) * 100) / 100,
          duration: Math.round((Number(entry.duration) || 0) * 100) / 100
        }));
    }

    window.getGolfJoinPerformanceSnapshot = getGolfJoinPerformanceSnapshot;
    // GOLFJOIN_DIAGNOSTICS_END

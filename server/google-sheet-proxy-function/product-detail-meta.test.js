"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decodeHtmlText,
  extractSecretTourTimelineSchedule,
  buildProductGolfSummaryFromHtml,
  buildPublicProductDetailSnapshot
} = require("./product-detail-meta");
const { assertDataContract } = require("./data-contracts");

test("상품상세 HTML의 PC·모바일 일정 블록을 순서대로 추출한다", () => {
  const html = `
    <div class="timeline_item">
      <strong>1일차</strong>
      <ul class="scheduleBox"><li>인천공항 출발<br>가이드 미팅 및 수속</li><li>호텔/리조트 이동 · 휴식</li></ul>
    </div>
    <section class="card timeline_vitem active">
      <strong>2일차</strong>
      <div><ul class="scheduleBox"><li>오전 18홀 + 오후 18홀 라운딩</li></ul></div>
    </section>`;
  const schedule = extractSecretTourTimelineSchedule(html);
  assert.equal(schedule.length, 2);
  assert.match(schedule[0].rawText, /인천공항 출발/);
  assert.deepEqual(schedule[0].points, [
    "인천공항 출발\n가이드 미팅 및 수속",
    "호텔/리조트 이동 · 휴식"
  ]);
  assert.match(schedule[1].rawText, /오전 18홀 \+ 오후 18홀/);
  assert.deepEqual(schedule[1].points, ["오전 18홀 + 오후 18홀 라운딩"]);
});

test("상품업데이트용 골프 요약은 일차와 조건부 홀 수를 계산한다", () => {
  const html = `
    <div class="timeline_item"><div>1일차</div><p>공항 출발</p></div>
    <div class="timeline_item"><div>2일차</div><p>오전 18홀 + 오후 18홀 라운딩</p></div>
    <div class="timeline_item"><div>3일차</div><p>주중 오전36홀/주말 오후18홀</p></div>
    <div class="timeline_item"><div>4일차</div><p>18홀 + 보너스 9홀</p></div>`;
  const summary = buildProductGolfSummaryFromHtml(html);
  assert.equal(summary.golfDays, 3);
  assert.equal(summary.minTotalHoles, 72);
  assert.equal(summary.maxTotalHoles, 99);
  assert.equal(summary.label, "골프 3일 · 총 72~99홀");
});

test("같은 일정 li의 관광옵션 18홀은 기본 36홀에 추가하지 않는다", () => {
  const html = `
    <div class="timeline_item">
      <div class="timeline_bar_bullet">4일차</div>
      <ul class="scheduleBox"><li>바탐 아일랜드 골프장 오전36홀 라운딩<br>[관광옵션]<br>18홀 라운드 후 관광</li></ul>
    </div>`;
  const summary = buildProductGolfSummaryFromHtml(html);
  assert.deepEqual([summary.golfDays, summary.minTotalHoles, summary.maxTotalHoles, summary.label], [1, 36, 36, "골프 1일 · 총 36홀"]);
});

test("스크립트·스타일의 가짜 일정 문구는 골프 요약에 포함하지 않는다", () => {
  const html = `
    <div class="timeline_item">
      <script>const fake = "99홀 라운딩";</script>
      <style>.fake::after { content: "72홀"; }</style>
      <p>공항 도착</p>
    </div>`;
  assert.doesNotMatch(decodeHtmlText(html), /99홀|72홀/);
  assert.equal(buildProductGolfSummaryFromHtml(html).status, "empty");
});

test("일정 마크업이 바뀌어도 빈 요약으로 안전하게 실패한다", () => {
  assert.deepEqual(buildProductGolfSummaryFromHtml("<main><p>18홀 라운딩</p></main>"), {
    golfDays: 0,
    minTotalHoles: 0,
    maxTotalHoles: 0,
    label: "",
    status: "empty",
    dayBreakdown: []
  });
});

test("공개 상품상세 스냅샷은 회원 데이터 없이 본문·일정·이미지만 생성한다", () => {
  const html = `
    <script>const oGoodsView = { eventNm: '치앙마이 골프', goodTransportSeq: '30002073', goodsImage: '/images/hero.jpg', goodDescription: '공개 설명' };</script>
    <p class="detail_title_copy">가산쿤탄 골프 여행</p>
    <div class="detail_box"><h3 class="dbox_title">포함사항</h3><div class="dbox_content_row"><p>그린피</p></div></div>
    <div class="detail_box"><h3 class="dbox_title">불포함사항</h3><div class="dbox_content_row"><p>캐디팁</p></div></div>
    <div class="detail_box"><h3 class="dbox_title">참고사항</h3><div class="dbox_content_row"><p>여권 확인</p></div></div>
    <div class="detail_box"><h3 class="dbox_title">상품소개</h3><div class="dbox_content_row"><img src="/images/intro.jpg"></div></div>
    <div class="timeline_item"><b class="timeline_bar_bullet">1일차</b><span class="timeline_title_sub">2026.09.07 (월)</span><ul class="scheduleBox"><li>인천공항 출발</li></ul></div>
    <div class="swiper-slide"><img src="/images/detail.jpg"></div>`;
  const snapshot = buildPublicProductDetailSnapshot(html, {
    goodSeq: "30001104",
    eventSeq: "30285494",
    title: "치앙마이 골프",
    departureDate: "2026-09-07",
    returnDate: "2026-09-15",
    duration: "7박 9일",
    price: 1290000,
    productType: "골프팩"
  }, { generatedAt: "2026-08-12T10:00:00+09:00" });
  assertDataContract("productDetailSnapshotV1", snapshot);
  assert.equal(snapshot.detailStatus, "ready");
  assert.deepEqual(snapshot.includes, ["그린피"]);
  assert.equal(snapshot.schedule[0].dateText, "9/07(월)");
  assert.deepEqual(snapshot.schedule[0].points, ["인천공항 출발"]);
  assert.equal(snapshot.flight.state, "not_required");
  assert.equal(Object.hasOwn(snapshot, "memberPrice"), false);
  assert.equal(Object.hasOwn(snapshot, "adultPrice"), false);
});

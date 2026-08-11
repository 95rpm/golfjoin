# 골프조인 메인 의존성 목록

이 문서는 기능별 파일 이동 중 전역 함수나 이벤트 연결을 놓치지 않기 위한 자동 생성 자료다. JavaScript를 실행하지 않고 이름과 정적 문자열만 읽으므로 회원정보나 API 응답은 포함하지 않는다.

- 조립 소스 SHA-256: `B6D09D1AA648D567BBF0BB5CCBF4A98D9EA653E1648C28318C56596080C773FA`
- 조립 소스 크기: 2,767,496 bytes
- 이름 있는 함수: 1,851개
- `window` 공개 대입: 47개, 고유 이름 40개
- 정적 window/document 이벤트 연결: 35개

## 모듈 현황

| 소스 | bytes | 함수 | window 공개 | 이벤트 연결 |
|---|---:|---:|---:|---:|
| `source/shell/00-preamble.html#inline-script-1` | 4497 | 1 | 0 | 1 |
| `source/scripts/store/30-state-and-presets.js` | 30429 | 7 | 0 | 1 |
| `source/scripts/performance/31-diagnostics.js` | 10849 | 15 | 1 | 0 |
| `source/scripts/store/32-runtime-state-and-guards.js` | 8898 | 6 | 0 | 0 |
| `source/scripts/loading/33-loading-and-modal-layer.js` | 29527 | 34 | 0 | 2 |
| `source/scripts/member/34-member-auth-profile-wishes.js` | 222237 | 264 | 2 | 2 |
| `source/scripts/data/35-home-bootstrap.js` | 18831 | 24 | 0 | 0 |
| `source/scripts/member/36-member-reservations-deeplinks.js` | 293374 | 318 | 0 | 8 |
| `source/scripts/detail/37-detail-builder-calendar.js` | 792941 | 922 | 4 | 1 |
| `source/scripts/sections/38-home-sections.js` | 153809 | 186 | 14 | 0 |
| `source/scripts/detail/39-detail-actions-participants.js` | 82919 | 73 | 26 | 20 |
| `source/scripts/boot/40-initialize.js` | 7296 | 1 | 0 | 0 |

## window 공개 목록

HTML의 인라인 속성이나 다른 원사이트 코드가 부를 수 있으므로, 아래 이름은 이동 후에도 같은 시점에 공개되어야 한다.

| 공개 이름 | 연결 함수 | 위치 |
|---|---|---|
| `getGolfJoinPerformanceSnapshot` | `getGolfJoinPerformanceSnapshot` | `source/scripts/performance/31-diagnostics.js:239` |
| `openJoinMemberEmailForm` | `openJoinMemberEmailForm` | `source/scripts/member/34-member-auth-profile-wishes.js:782` |
| `submitJoinMemberEmailLogin` | `submitJoinMemberEmailLogin` | `source/scripts/member/34-member-auth-profile-wishes.js:3320` |
| `nextBuilderStep` | `nextBuilderStep` | `source/scripts/detail/37-detail-builder-calendar.js:8560` |
| `openModal` | `openModal` | `source/scripts/detail/37-detail-builder-calendar.js:8949` |
| `closeModal` | `closeModal` | `source/scripts/detail/37-detail-builder-calendar.js:9095` |
| `auditGolfJoinRegionMaster` | `auditGolfJoinRegionMaster` | `source/scripts/detail/37-detail-builder-calendar.js:12952` |
| `setMyJoinFilter` | `setMyJoinFilter` | `source/scripts/sections/38-home-sections.js:143` |
| `loadMoreMyJoinItems` | `loadMoreMyJoinItems` | `source/scripts/sections/38-home-sections.js:146` |
| `loadMoreOverseasBestItems` | `loadMoreOverseasBestItems` | `source/scripts/sections/38-home-sections.js:147` |
| `updateMdPickThemeDots` | `updateMdPickThemeDots` | `source/scripts/sections/38-home-sections.js:375` |
| `updateBestSectionControls` | `updateBestSectionControls` | `source/scripts/sections/38-home-sections.js:442` |
| `updateBestSectionControlsAll` | `updateBestSectionControlsAll` | `source/scripts/sections/38-home-sections.js:443` |
| `updateQuickSectionControls` | `updateQuickSectionControls` | `source/scripts/sections/38-home-sections.js:475` |
| `updateCustomSectionControls` | `updateCustomSectionControls` | `source/scripts/sections/38-home-sections.js:498` |
| `prefetchMdPickCountryImages` | `prefetchMdPickCountryImages` | `source/scripts/sections/38-home-sections.js:1484` |
| `prefetchMdPickThemeImages` | `prefetchMdPickThemeImages` | `source/scripts/sections/38-home-sections.js:1486` |
| `prefetchMdPickSlideTarget` | `prefetchMdPickSlideTarget` | `source/scripts/sections/38-home-sections.js:1487` |
| `setMdPickTheme` | `setMdPickTheme` | `source/scripts/sections/38-home-sections.js:1561` |
| `setSoonRangeFilter` | `setSoonRangeFilter` | `source/scripts/sections/38-home-sections.js:2121` |
| `loadMoreSoonItems` | `loadMoreSoonItems` | `source/scripts/sections/38-home-sections.js:2128` |
| `handleDetailShare` | `handleDetailShare` | `source/scripts/detail/39-detail-actions-participants.js:760` |
| `handleCompletionShare` | `handleCompletionShare` | `source/scripts/detail/39-detail-actions-participants.js:761` |
| `closeDetailShareModal` | `closeDetailShareModal` | `source/scripts/detail/39-detail-actions-participants.js:762` |
| `handleDetailShareBackdrop` | `handleDetailShareBackdrop` | `source/scripts/detail/39-detail-actions-participants.js:763` |
| `copyDetailShareUrl` | `copyDetailShareUrl` | `source/scripts/detail/39-detail-actions-participants.js:764` |
| `shareDetailToKakao` | `shareDetailToKakao` | `source/scripts/detail/39-detail-actions-participants.js:765` |
| `submitJoinMemberEmailLogin` | `submitJoinMemberEmailLogin` | `source/scripts/detail/39-detail-actions-participants.js:1452` |
| `submitJoinMemberSignup` | `submitJoinMemberSignup` | `source/scripts/detail/39-detail-actions-participants.js:1453` |
| `openJoinMemberEmailForm` | `openJoinMemberEmailForm` | `source/scripts/detail/39-detail-actions-participants.js:1454` |
| `nextBuilderStep` | `nextBuilderStep` | `source/scripts/detail/39-detail-actions-participants.js:1456` |
| `openModal` | `openModal` | `source/scripts/detail/39-detail-actions-participants.js:1457` |
| `closeModal` | `closeModal` | `source/scripts/detail/39-detail-actions-participants.js:1458` |
| `__golfjoinMainReady` | `true` | `source/scripts/detail/39-detail-actions-participants.js:1459` |
| `openGlobalApply` | `openGlobalApply` | `source/scripts/detail/39-detail-actions-participants.js:1460` |
| `submitGlobalApply` | `submitGlobalApply` | `source/scripts/detail/39-detail-actions-participants.js:1461` |
| `confirmApplySubmitModal` | `confirmApplySubmitModal` | `source/scripts/detail/39-detail-actions-participants.js:1462` |
| `closeApplySubmitConfirmModal` | `closeApplySubmitConfirmModal` | `source/scripts/detail/39-detail-actions-participants.js:1463` |
| `handleApplySubmitConfirmBackdropClick` | `handleApplySubmitConfirmBackdropClick` | `source/scripts/detail/39-detail-actions-participants.js:1464` |
| `openBuilderAlert` | `openBuilderAlert` | `source/scripts/detail/39-detail-actions-participants.js:1465` |
| `closeBuilderAlert` | `closeBuilderAlert` | `source/scripts/detail/39-detail-actions-participants.js:1466` |
| `confirmBuilderAlert` | `confirmBuilderAlert` | `source/scripts/detail/39-detail-actions-participants.js:1467` |
| `handleBuilderAlertBackdropClick` | `handleBuilderAlertBackdropClick` | `source/scripts/detail/39-detail-actions-participants.js:1468` |
| `openMdPickProductDetail` | `openMdPickProductDetail` | `source/scripts/detail/39-detail-actions-participants.js:1469` |
| `selectDetailProductFamilyPeriod` | `selectDetailProductFamilyPeriod` | `source/scripts/detail/39-detail-actions-participants.js:1470` |
| `handleDetailShare` | `handleDetailShare` | `source/scripts/detail/39-detail-actions-participants.js:1472` |
| `copyDetailShareUrl` | `copyDetailShareUrl` | `source/scripts/detail/39-detail-actions-participants.js:1473` |

## 정적 이벤트 연결 요약

| 대상 | 이벤트 | 연결 수 |
|---|---|---:|
| `document` | `click` | 4 |
| `document` | `contextmenu` | 1 |
| `document` | `DOMContentLoaded` | 2 |
| `document` | `dragstart` | 1 |
| `document` | `error` | 1 |
| `document` | `gesturestart` | 1 |
| `document` | `mouseleave` | 1 |
| `document` | `mouseout` | 1 |
| `document` | `mouseover` | 1 |
| `document` | `pointerdown` | 2 |
| `document` | `selectstart` | 1 |
| `document` | `toggle` | 1 |
| `document` | `touchend` | 1 |
| `document` | `touchmove` | 1 |
| `document` | `touchstart` | 1 |
| `document` | `visibilitychange` | 1 |
| `window` | `DOMContentLoaded` | 1 |
| `window` | `focus` | 1 |
| `window` | `pageshow` | 1 |
| `window` | `resize` | 6 |
| `window` | `scroll` | 2 |
| `window` | `touchmove` | 1 |
| `window` | `touchstart` | 1 |
| `window` | `wheel` | 1 |

## 사용 시 주의

- 이 목록의 함수 수에는 중첩 함수도 포함된다. 실제 파일 이동 전에는 선언이 사용하는 상위 상태를 함께 확인한다.
- 변수에 담긴 동적 이벤트 이름은 정적 이벤트 표에 포함되지 않는다.
- 기능 파일을 옮긴 뒤에는 이 목록을 다시 생성하고 단일 HTML hash·E2E 결과를 함께 비교한다.

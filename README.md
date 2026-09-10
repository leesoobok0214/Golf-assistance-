# 골프비서

모바일 우선 골프 스코어 도우미 PWA입니다.  
스코어카드 사진을 **기기에서 OCR**하고, 라운드·통계를 **IndexedDB**에만 저장합니다. 서버 API·예약·랭킹 기능은 없습니다.

## 기술 스택

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- PWA: `@ducanh2912/next-pwa` (standalone, theme-color 초록)
- 저장소: Dexie (IndexedDB)
- OCR: `tesseract.js` (kor+eng 시도, 실패 시 eng) — 클라이언트 전용

## 로컬 실행

```bash
cd golf-assistant
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

프로덕션 빌드:

```bash
npm run build
npm start
```

Vercel 등에도 그대로 배포 가능합니다 (`next build` / Node 서버 또는 호스팅 기본 설정).

## Android Chrome — 홈 화면에 추가

1. Chrome으로 앱 URL을 엽니다 (HTTPS 또는 localhost).
2. 메뉴(⋮) → **홈 화면에 추가** / **앱 설치**.
3. 아이콘 이름 **골프비서** 확인 후 추가합니다.
4. 홈 화면 아이콘으로 열면 전체 화면(standalone)으로 실행됩니다.

iOS Safari는 공유 → **홈 화면에 추가**로 유사하게 설치할 수 있습니다.

## 주요 기능

| 화면 | 설명 |
|------|------|
| 홈 | 최근 라운드, 평균·라운드 수, 스캔 CTA |
| 스캔 | 카메라/앨범 → OCR → 편집 후 저장 |
| 수동 추가 | OCR 없이 동일 필드 입력 |
| 상세 | 전반/후반, 동반자, 18홀, OUT/IN/TOTAL |
| 기록 | 검색·필터 (전체/내 기록/예시) |
| 통계 | 평균, 베스트/워스트, 추세, 코스별 평균 |

**예시 데이터** 버튼으로 샘플 라운드를 넣을 수 있으며, 항상 «예시» 배지가 붙고 **예시 데이터 삭제**로 제거할 수 있습니다.

## 데이터·개인정보

- 모든 라운드 데이터는 브라우저 IndexedDB에만 저장됩니다.
- OCR 이미지는 외부 서버로 전송되지 않습니다 (언어 traineddata CDN 다운로드만 발생).

## 라이선스

개인/학습용 샘플 프로젝트입니다.

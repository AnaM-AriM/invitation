# 모바일 청첩장

React/Vite로 만든 독립 정적 청첩장입니다. GitHub Pages 배포, 사진 갤러리·사진 관리, 선택적인 Google Sheets 방명록을 제공합니다. 권아남·유아림의 2027년 3월 13일 오후 2시, 전주 그랜드힐스턴 예식 정보가 설정되어 있습니다. 방명록 URL은 비어 있습니다. URL을 연결하지 않으면 방명록 입력은 현재 탭에서만 유지됩니다.

## 시작하기

Node.js 22.13 이상과 npm이 필요합니다. 저장소 루트에서 실행하세요.

```sh
npm ci
npm run dev
```

`site/wedding.ts`에서 예식 정보와 문구를 수정합니다. 개인 전화번호(`couple[].phone`), 부모님(`parents`), 홀(`venue.hall`)은 확인 후 입력하세요. 번호가 없으면 개인 전화 버튼은 준비 중으로 비활성화되고, 번호 입력 후 전화·문자 링크가 표시됩니다. `endDateTime`은 일정 저장용으로 기존 1시간 길이(오후 3시)를 유지한 값이며 실제 예식 종료 시각을 확인한 값은 아닙니다. 사진은 웹 화면 하단의 **사진 관리** 또는 `npm run photos:add -- "/path/to/photo.jpg"`로 추가합니다. 저장한 사진은 공개됩니다.

```sh
PAGES_BASE_PATH=/invitation/ npm run build
PAGES_BASE_PATH=/invitation/ npm run preview
```

산출물은 `out/`입니다. 도메인 루트 배포는 `PAGES_BASE_PATH=/`를 사용합니다. `dev:pages`, `build:pages`, `preview:pages` 별칭도 사용할 수 있습니다.

`.github/workflows/pages.yml`은 main push 시 검사 후 GitHub Pages에 배포합니다. 저장소 Settings → Pages → Source를 **GitHub Actions**로 지정하세요. 선택적으로 Repository Variables의 `VITE_GUESTBOOK_URL`에 본인이 배포한 Apps Script `/exec` URL을 설정합니다.

[예식 설정, 사진 관리, Google Sheets 연결과 실제 연결 검증](docs/GITHUB_PAGES.md)을 참고하세요. 현재 Google 연결이나 실제 공유 저장이 설정되어 있지는 않습니다.

## 검증

```sh
npm run typecheck
npm run test:unit
npm run test:pages
npm run test:pages:browser
```

브라우저 테스트는 Google Chrome과 4180·4191 포트를 사용합니다. 외부 서비스는 fixture 응답으로 검증하므로 실제 Google/GitHub 계정 연결을 확인하려면 설정 문서의 운영 검증을 별도로 진행하세요.

## 교통 안내와 배경 음악

`site/wedding.ts`의 `venue.transit`에 주차·대중교통 안내를 설정합니다. [전주시 관광 공식 안내](https://tour.jeonju.go.kr/board/view.jeonju?boardId=BBS_0000004&dataSid=220&menuCd=DOM_000000104001000000)를 2026-11-23 확인한 내용을 바탕으로, 별도 주차동과 인근 정류장만 간단히 안내합니다. 요금·배차·소요 시간은 안내하지 않습니다.

하단 **음악 켜기**를 누르면 봄 정원 분위기의 오리지널 연주 `public/audio/spring-garden.mp3`가 반복 재생됩니다. 외부 음원·녹음을 사용하지 않았습니다. 기본은 꺼짐이며, 탭이 숨겨지면 정지하고 돌아와도 자동으로 켜지지 않습니다. 모바일 기기에서 음량 조절이 제한될 수 있어 파일 자체의 음량도 낮췄습니다.

음원 재생성은 Node.js와 ffmpeg가 설치된 환경에서 `node scripts/create-garden-music.mjs public/audio/spring-garden.mp3`로 선택적으로 실행합니다. 일반 빌드에는 필요하지 않습니다.

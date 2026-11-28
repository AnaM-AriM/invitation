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

### 표지의 입체 정원

방문자는 표지 아래의 **아침 정원 · 노을 · 별밤** 버튼으로 풍경을 바꿀 수 있습니다. 삽화 위에서 손가락을 좌우로 움직이면 앞쪽 꽃과 뒤쪽 아치가 다른 속도로 움직입니다. 기기의 ‘동작 줄이기’를 켜면 선택한 풍경이 정지 화면으로 보입니다. 등록한 표지 사진이 있으면 사진이 우선 표시되고, 사진을 불러올 수 없으면 정원이 나타납니다.

장면의 색상과 삽화 배치, 카메라 움직임은 [site/cover-scene.ts](site/cover-scene.ts)에서 조정합니다. 시간대 버튼과 WebGL을 사용할 수 없을 때의 삽화는 [site/illustrated-cover.tsx](site/illustrated-cover.tsx)에서 관리합니다.

### 축하가 모여 피어나는 정원

`#guestbook`에서 강아지 눈높이로 정원을 산책할 수 있습니다. 새 메시지를 남기면 해당 하객의 캐릭터가 추가됩니다. 강아지는 빈 정원에서 기다립니다. 자동 산책 중에는 방금 글을 남긴 하객을 찾아가며, 거리별로 약 5~11초에 걸쳐 이동합니다. 도착하면 하객이 가볍게 인사하고 축하 문구를 10초 이상 읽을 수 있습니다. 하객들은 각자 짧게 걷거나 건배·박수·연주처럼 삽화에 어울리는 몸짓을 하며, 강아지가 찾아오면 그 자리에서 인사합니다. 춤추는 하객은 강아지가 머무는 동안에도 두 박자 스텝을 이어갑니다. 축하 문구는 하객의 발이 보이도록 그림 아래에 표시됩니다. 52종의 하객 삽화가 차례로 등장합니다. 길가의 흰 꽃은 처음 44개의 축하까지 한 무리씩 늘어납니다.

강아지 시점에서 **쉬기**로 강아지와 하객의 움직임을 함께 멈추고 **다음 축하**로 직접 이동할 수 있습니다. 기기의 동작 줄이기 설정에서는 다음 하객으로 즉시 전환합니다. **정원 전체**에서는 하객을 직접 골라 읽을 수 있고, WebGL을 지원하지 않는 브라우저도 이 보기를 사용합니다.

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

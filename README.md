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

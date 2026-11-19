# 모바일 청첩장

React/Vite로 만든 독립 정적 청첩장입니다. GitHub Pages 배포, 사진 갤러리·사진 관리, 선택적인 Google Sheets 방명록을 제공합니다. 현재 이름·예식 정보는 예시이며 사진 목록과 방명록 URL은 비어 있습니다. URL을 연결하지 않으면 방명록 입력은 현재 탭에서만 유지됩니다.

## 시작하기

Node.js 22.13 이상과 npm이 필요합니다. 저장소 루트에서 실행하세요.

```sh
npm ci
npm run dev
```

`site/wedding.ts`에서 예식 정보와 문구를 수정하고 실제 정보로 바꾼 후 `isExample: false`로 설정합니다. 사진은 웹 화면 하단의 **사진 관리** 또는 `npm run photos:add -- "/path/to/photo.jpg"`로 추가합니다. 저장한 사진은 공개됩니다.

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

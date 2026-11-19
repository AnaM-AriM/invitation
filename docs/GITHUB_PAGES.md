# 모바일 청첩장 · GitHub Pages + Google Sheets

이 저장소는 GitHub Pages에 배포하는 독립 정적 React/Vite 청첩장입니다. `site/`가 진입점이며 `npm run dev`, `build`, `preview`는 Pages 구성을 사용합니다. 기본 화면은 **예시 청첩장**이며 실제 예식 정보나 Google Sheet에 연결되어 있지 않습니다. 기존 그림과 강아지·팔 동작을 그대로 사용합니다.

## 1. 청첩장 꾸미기

`site/wedding.ts` 한 곳에서 두 사람의 이름, 부모님, 예식 일시(한국 시간 `+09:00`), 장소, 초대 문구, 사진, 연락처, 계좌를 수정하세요. 실제 정보로 바꾼 뒤 `isExample: false`로 설정합니다. 제목, HTML 설명, Open Graph 제목·설명도 이 설정에서 빌드 시 생성됩니다. 공유 미리보기 이미지는 아직 지정하지 않습니다.

- 연락처 `phone`은 선택 사항입니다. 실제 번호만 입력하세요. 없으면 전화·문자 버튼이 숨겨집니다.
- 주소가 비어 있으면 지도 링크와 주소 복사 버튼이 나타나지 않습니다. 교통 안내는 `venue.transit` 배열에 적습니다.
- 사진은 배포된 웹 화면 하단의 **사진 관리**에서 선택해 저장할 수 있습니다. 빈 배열이면 기존 그림과 사진 준비 중 표시가 나옵니다.
- `accounts`는 빈 배열이면 표시되지 않습니다. 실제 계좌만 `{label, bank, number, holder}` 형태로 추가합니다.
- `guestbookUrl`은 공개 웹 앱의 `/exec` URL입니다. 대신 로컬 `.env.local` 또는 GitHub Repository **Variables**의 `VITE_GUESTBOOK_URL`로 덮어쓸 수 있습니다. 이 값은 빌드 결과에 포함되는 공개 설정이며 비밀이 아닙니다. 브라우저 코드에 Google 인증 정보나 서비스 계정 키를 넣지 마세요.
- URL이 없으면 방명록은 **저장되지 않는 예시**입니다. 입력은 현재 탭의 메모리에만 남고 새로고침하면 사라집니다. URL이 설정된 상태에서 오류가 나면 예시 모드로 전환하지 않습니다.

### 배포된 웹 화면에서 사진 추가하기

1. 이 코드를 **이 저장소의 루트**로 main에 올리고, Settings → Pages → Source를 **GitHub Actions**로 지정해 먼저 배포합니다. `site/photos.json`은 처음에는 빈 배열이어도 됩니다.
2. [GitHub Fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)을 만듭니다. Resource owner를 지정하고 **Only select repositories**에서 이 청첩장 저장소만 선택하세요. Repository permissions는 **Contents: Read and write**만 추가하며, 짧은 만료 기간을 지정합니다. 조직 정책에 따라 승인이 필요할 수 있습니다. 토큰은 저장소 쓰기 권한이므로 타인에게 공유하지 마세요.
3. 배포된 github.io 청첩장 맨 아래 **사진 관리**를 누릅니다. 표시된 `owner/repository`가 이 청첩장의 저장소인지 확인합니다. github.io에서는 주소로 추정하고, 커스텀 도메인에서는 직접 입력합니다. 대상 브랜치는 기존 workflow와 같은 **main**입니다.
4. 토큰을 붙여 넣고 JPEG·PNG·WebP 사진을 여러 장 선택합니다. 공통 설명을 먼저 입력하거나 선택한 각 사진의 설명을 수정한 뒤 **GitHub에 저장**을 누릅니다. 한 장 10 MiB 이하, 한 번에 10장·총 20 MiB 이하입니다. 전체 파일의 크기·확장자·헤더와 브라우저 이미지 열기를 저장 전에 검사합니다.
5. 성공 안내는 **저장소에 커밋되었다는 뜻**입니다. 연결된 GitHub Actions에서 기존 Pages 빌드·배포 성공을 확인한 다음 청첩장을 새로고침하세요. 방문자 화면에 즉시 반영되는 것은 아닙니다. 배포 실패 시 저장소 커밋은 남으므로 Actions 오류를 해결합니다.

토큰은 비밀번호 입력창과 실행 중 메모리에만 존재합니다. URL, 소스, 빌드 설정, localStorage/sessionStorage에 넣지 않으며 창을 닫거나 저장 시도가 끝나면 지웁니다. 실패 시 선택한 사진과 설명은 유지하지만 재시도에는 토큰을 다시 입력해야 합니다. 닫기는 저장 중 잠시 제한됩니다. 응답 유실 시 실제 저장 여부가 불확실하므로 **GitHub main 커밋과 목록을 확인한 후** 재시도하세요. 자동 재시도는 하지 않습니다.

GitHub REST API의 [브라우저 CORS 지원](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)을 사용하므로 별도 서버, OAuth 비밀키나 Google Drive는 필요하지 않습니다. 기존 트리를 바탕으로 새 사진과 목록을 [같은 Git tree/commit](https://docs.github.com/en/rest/git/trees)에 추가한 뒤 main을 [강제 갱신 없이](https://docs.github.com/en/rest/git/refs#update-a-reference) 한 번 변경합니다. 다른 변경과 경합하거나 main 보호 규칙이 직접 쓰기를 거절하면 중단합니다. main의 상태/규칙을 확인해 주세요. 실패 시 브랜치에 반영되지 않은 Git 객체가 남을 수 있습니다.

사진은 UUID 이름으로 `public/photos/`에 저장하고 `site/photos.json` 끝에 설명과 함께 추가합니다. 기존 목록의 순서와 추가 필드는 보존합니다. 파일은 크기 조정이나 메타데이터 제거 없이 **원본 그대로 공개**되므로 위치 등 공개할 수 없는 정보는 업로드 전에 제거하세요. 기본 `site/wedding.ts`가 가져오는 `photos` 목록을 사용해야 갤러리가 갱신됩니다. `photos`를 직접 다른 배열로 덮어썼다면 이 목록의 사진은 표시되지 않으며, `coverPhoto`를 직접 지정했다면 표지는 바뀌지 않습니다.

실제 사진과 원격 저장소 인증 정보가 제공되지 않은 로컬 검증은 모의 GitHub API를 사용합니다. 실제 GitHub 인증·조직 정책·main 쓰기·Actions 실행·배포는 운영 저장소에서 별도 확인이 필요합니다. 방문자 사진 업로드나 방명록 사진 저장은 제공하지 않습니다.

### 로컬 명령으로 사진 추가하기 (선택 사항)

저장소 루트에서 실제 사진 경로를 전달하세요. 공백이 있는 경로는 따옴표로 감쌉니다.

```sh
npm run photos:add -- "/Users/me/Pictures/우리 사진.jpg" ./second.png
npm run dev
```

JPEG(`.jpg`, `.jpeg`), PNG, WebP를 지원하며 파일마다 0바이트 초과, **10 MiB 이하**여야 합니다. 확장자와 파일 헤더가 일치하는지 검사하며 전체 이미지 디코딩 검사는 하지 않습니다. 전체 입력과 기존 목록을 먼저 검사하고, 실패하면 기존 사진과 목록을 유지합니다.

명령은 원본 바이트를 수정하지 않고 `public/photos/`에 복사한 뒤 `site/photos.json` 목록 끝에 `{ "src": "/photos/파일명.jpg", "alt": "두 사람이 함께한 순간" }`을 추가합니다. 같은 이름이나 같은 파일을 다시 넣어도 숫자 접미사로 새 복사본을 만듭니다. 크기 조정, 이미지 최적화, 메타데이터 제거는 자동으로 수행하지 않습니다.

`site/photos.json`에서 순서와 각 `alt` 설명을 수정하세요. 기본 `site/wedding.ts`는 이 목록을 갤러리로 사용하고 **첫 사진을 메인 표지**로 사용합니다. 표지만 별도로 쓰려면 `coverPhoto: { src: "/photos/cover.jpg", alt: "두 사람의 결혼 사진" }`으로 수정하세요. `coverPhoto: undefined`이면 기존 꽃 아치와 두 사람 그림을 사용하며, 표지를 불러오지 못할 때도 그림으로 돌아옵니다.

직접 `public/photos/`에 파일을 넣고 `site/wedding.ts`의 `photos`를 `[{ src: "/photos/photo.webp", alt: "두 사람이 산책하는 모습" }]`로 설정하는 기존 방식도 가능합니다. 표지는 `coverPhoto`에서 따로 지정합니다. 외부 이미지에는 `https://...` 주소를 사용할 수 있으며, 로컬 `/photos/...` 주소는 프로젝트의 `/invitation/` 같은 배포 경로를 자동으로 따릅니다.

방문자는 사진을 눌러 확대하고 이전·다음 버튼 또는 방향키로 이동할 수 있습니다. 닫기, Escape, 사진 창 바깥 누르기로 닫습니다. 사진을 불러오지 못하면 안내가 나오며 다른 사진으로 이동할 수 있습니다.

로컬 확인 후 `public/photos/`와 `site/photos.json`(수정했다면 `site/wedding.ts`도)을 함께 commit/push하여 Pages 빌드·배포에 포함하세요. 배포된 사진은 공개 URL로 접근할 수 있습니다. 이 로컬 명령은 웹 관리 화면 대신 사용할 수 있는 선택 사항입니다.

## 2. 로컬 실행과 정적 빌드

Node 22.13 이상을 사용합니다. 의존성이 설치되지 않았다면 `npm ci`를 실행하세요.

```sh
npm run dev
npm run build
npm run preview
```

개인/조직의 `https://username.github.io/` 또는 루트 커스텀 도메인은 기본 `/` 빌드를 사용합니다. 프로젝트 저장소 `https://username.github.io/invitation/`는 다음처럼 저장소 이름을 지정합니다.

```sh
PAGES_BASE_PATH=/invitation/ npm run build
PAGES_BASE_PATH=/invitation/ npm run preview
```

미리보기의 `/invitation/` 경로를 열어야 합니다. 출력 폴더는 무시된 `out/`입니다. Vite 청크뿐 아니라 배경, SVG 팔 이미지, preload, 강아지 이미지에도 동일한 base를 적용합니다. 이 독립 저장소의 `public/`에는 활성 이미지 172개만 포함되어 있습니다. 빌드 도우미는 `public/`의 파일을 복사하되 사용하지 않는 과거 아트 디렉터리(`assets/v2`–`v7`, `v12`, `v13`, `v14`, `v16`)를 제외하고 복사합니다. 사진 목록이나 별도 표지가 과거 디렉터리의 로컬 파일을 참조하면 해당 디렉터리 전체를 유지하며, 로컬 경로를 확실히 해석할 수 없으면 과거 디렉터리를 모두 유지합니다. 원본 파일은 바꾸지 않습니다. 다른 파일은 모두 공개되므로 `public/`에 개인 자료나 비밀 파일을 두지 마세요.

Pages 빌드에서만 하객 motion 메타데이터를 실제 사용하는 action·facing·still로 줄이고, 소유자용 사진 관리 코드는 버튼을 누를 때 불러옵니다. 불러오기에 실패하면 안내와 재시도를 제공하며 청첩장은 계속 사용할 수 있습니다. 과거 아트 제외는 배포 산출물 크기를 줄이며, 원래 요청하지 않던 이미지의 방문자 전송량이 줄었다는 의미는 아닙니다.

## 3. 비공개 Google Sheet에 방명록 연결

1. 새 Google Spreadsheet를 만들고 공유 범위를 **제한됨**으로 유지합니다.
2. 해당 Sheet에서 **확장 프로그램 → Apps Script**를 열어 container-bound 스크립트를 만듭니다. `google-apps-script/Code.gs` 내용을 붙여 넣습니다.
3. Apps Script 설정에서 manifest 표시를 켜고 `google-apps-script/appsscript.json`을 적용하거나, 편집기의 **서비스 + → Google Sheets API (v4)** 를 추가합니다. [Advanced Sheets service 안내](https://developers.google.com/apps-script/advanced/sheets)를 확인하세요. 표준 Google Cloud 프로젝트를 연결했다면 해당 프로젝트의 Sheets API도 활성화해야 합니다.
4. 편집기에서 **`setupGuestbook`을 한 번 실행**하고 소유자 권한을 승인합니다. 이 함수가 Sheet ID를 서버 Script Properties의 `SPREADSHEET_ID`로 보관하고 `Guestbook` 탭과 `id, requestId, name, message, createdAt` 헤더를 만듭니다. 기존 헤더가 다르면 아무 헤더도 덮어쓰지 않고 중단합니다. 탭/열 이름과 순서를 바꾸지 마세요. 모든 읽기와 쓰기에서 스키마를 검사합니다.
5. **배포 → 새 배포 → 웹 앱**에서 실행 계정을 **나(소유자)**, 접근 권한을 **모든 사용자(Anyone, 로그인 불필요)**로 지정합니다. 조직 정책 때문에 익명 사용을 허용하지 않으면 이 방식은 사용할 수 없습니다.
6. 배포 URL 중 `/exec`로 끝나는 주소를 `guestbookUrl` 또는 `VITE_GUESTBOOK_URL`에 넣습니다. `/dev`는 편집자 테스트 주소이므로 사용하지 마세요.
7. 코드를 수정한 후에는 **배포 관리 → 수정 → 새 버전 → 배포**하여 기존 `/exec` URL이 새 버전을 실행하도록 갱신합니다. 파일을 편집하는 것만으로 기존 배포가 바뀌지는 않습니다.

사용자 입력은 Advanced Sheets API `valueInputOption: RAW`로 기록합니다. `=1+2`와 `00123` 같은 내용은 수식/숫자 변환 없이 문자로 저장합니다. [RAW 정의](https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueInputOption)를 참고하세요. 일반 `appendRow`나 `setValues`로 바꾸면 같은 보장을 할 수 없습니다.

서버는 UUIDv4, 이름 1–20자, 메시지 1–300자와 제어 문자를 검사합니다. 스크립트 잠금 안에서 UUID 중복과 다음 ID를 확인한 뒤 append합니다. 같은 요청 UUID·내용을 재전송하면 기존 행을 돌려줍니다. 클라이언트도 반환된 UUID·이름·메시지를 확인한 뒤에만 저장 성공을 표시합니다. 응답이 유실되어도 같은 내용을 재시도하면 같은 UUID를 사용합니다. 내용이 바뀌면 새 요청으로 취급합니다.

`doGet`은 최신 메시지 6개/페이지, 오래된 순서 하객 36명/장면과 total/page/scene을 반환합니다. 공개 필드는 id/name/message/createdAt뿐입니다. 행을 삭제해 관리할 수 있지만 이미 공개된 메시지가 다시 비공개가 되는 것은 아닙니다. 삭제 시 기존 하객의 순번·배치가 달라질 수 있습니다. 중복 재시도 기록도 행 자체에 저장되므로 해당 행을 삭제하면 이전 UUID의 재시도가 새 행으로 들어올 수 있습니다.

**운영 한계:** Sheet가 비공개여도 웹 앱에서 내보낸 이름과 메시지는 공개입니다. 공개 쓰기 URL은 누가든 호출할 수 있으며 강력한 rate limit, 봇 방지, origin 인증을 제공하지 않습니다. Apps Script 실행/Sheets 할당량과 전체 행 스캔 비용이 있으므로 소규모 예식 방명록을 전제로 합니다. Sheet에서 직접 메시지를 검토·삭제하고, 필요하면 배포 접근을 중지하세요. 삭제/수정 중에는 잠금이 적용되지 않으므로 새 입력이 적은 시간에 관리하세요. 서버 로그/Sheet 권한에 개인정보를 노출하지 않도록 관리하세요.

## 4. 실제 Google 연결 검증 — 배포 후 필수

자동 테스트는 Apps Script fixture와 모의 HTTP 응답을 사용합니다. Google의 실제 익명 인증·redirect·CORS·공유 저장은 실제 `/exec` 없이는 확인할 수 없습니다.

- 로그아웃/시크릿 브라우저에서 `/exec?page=0&scene=0`을 열어 로그인 화면 대신 JSON이 나오는지 확인합니다.
- 정적 청첩장을 열고 고유한 테스트 이름·메시지를 한 번 제출합니다. 네트워크에서 urlencoded POST와 redirect 후 읽을 수 있는 JSON 응답을 확인합니다. `no-cors`/opaque 응답은 성공 증거가 아닙니다.
- Sheet에 정확히 한 행이 추가됐는지, 이름 `00123`과 메시지 `=1+2`가 실제 문자로 저장됐는지 확인합니다. 날짜는 ISO 문자열이어야 합니다.
- 다른 시크릿 탭/휴대폰에서 새로고침하여 같은 메시지가 보이는지 확인합니다.
- 네트워크 응답을 유실시킨 후 같은 내용으로 재시도하여 UUID가 유지되고 Sheet 행이 중복되지 않는지 확인합니다. 실패 중에는 입력이 유지되어야 합니다.
- 테스트 메시지를 수동으로 정리합니다. 최소한 실제 GET·POST·한 행 증가·중복 재시도와 두 브라우저 공유 확인 전에는 연결 완료로 간주하지 마세요.

## 5. GitHub Pages 배포

이 독립 Git 저장소의 루트에서 명령을 실행합니다. `.github/workflows/pages.yml`은 main push 또는 수동 실행으로 `npm ci`, 타입 검사, 런타임 단위 테스트와 Pages 테스트를 실행한 뒤 Pages의 `base_path`를 사용해 `out/`을 빌드·배포합니다. workflow에 추가 하위 `working-directory`는 필요 없습니다.

GitHub 저장소의 **Settings → Pages → Source: GitHub Actions**를 선택하세요. 필요하면 Repository Variables에 `VITE_GUESTBOOK_URL`을 설정하세요. main에 commit/push하면 workflow가 실행됩니다. Pages 설정을 바꾸려면 저장소 관리자 권한이 필요합니다. Google Apps Script 배포는 별도로 진행해야 합니다.

## 검증 명령

```sh
npm run test:unit
npm run test:pages
npm run typecheck
npm run test:pages:browser
npm run build
PAGES_BASE_PATH=/invitation/ npm run build
```

브라우저 테스트는 설치된 Google Chrome과 4180·4191 포트를 사용하며 Google/GitHub 응답을 모의 처리합니다. Chrome이 없다면 먼저 설치하세요. 결과와 스크린샷은 `outputs/`에서 확인합니다. 실제 Sheets 저장이나 원격 GitHub 쓰기를 검증하는 테스트는 아닙니다.

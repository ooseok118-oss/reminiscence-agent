# 1단계: 프로젝트 실행 → GitHub 공개 저장소 → Vercel 배포

전체 코드는 https://github.com/ooseok118-oss/reminiscence-agent 에 있습니다. 저장소의 Code → Download ZIP으로 내려받아 압축을 풀고, package.json과 app 폴더가 보이는 프로젝트 폴더를 VS Code에서 여세요. GitHub 저장소 공개는 완료됐으므로 아래 3절은 새 저장소를 직접 만들 때만 참고하면 됩니다.

현재 완료된 범위는 영어 안내 화면과 Next.js 프로젝트 구성입니다. 프로필 폼은 2단계에서 만듭니다. GitHub 공개 저장소에 전체 코드를 업로드했습니다. Vercel 배포는 권한 설정을 확인한 뒤 진행해야 합니다.

## 1. 컴퓨터에서 실행

[Node.js 공식 사이트](https://nodejs.org/en/download)에서 Node.js 24 LTS를 설치하고 VS Code를 다시 여세요. VS Code의 Terminal → New Terminal을 누릅니다. 아래 명령은 프로젝트 폴더 안에서 한 줄씩 실행합니다.

설치된 Node.js 버전을 확인합니다. v24로 시작하면 됩니다.

```bash
node --version
```

package-lock.json에 기록한 버전으로 라이브러리를 설치합니다.

```bash
npm ci
```

개발 서버를 시작합니다.

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 열어 Reminiscence Agent 안내 화면을 확인하세요. 서버를 종료할 때는 터미널에서 Ctrl+C를 누릅니다. 포트가 이미 사용 중이면 터미널에 표시되는 주소를 여세요.

## 2. 파일 확인

| 경로 | 역할 |
|---|---|
| app/page.tsx | 첫 화면의 영어 문구 |
| app/layout.tsx | 페이지 제목과 영어 언어 설정 |
| app/globals.css | Tailwind와 기본 스타일 |
| app/icon.svg | 브라우저 아이콘 |
| package.json | 실행 명령과 의존성 |
| package-lock.json | 설치할 정확한 버전 |
| next.config.ts | Next.js와 Tailwind 설정 |
| tsconfig.json | TypeScript 설정 |
| eslint.config.mjs | 코드 검사 설정 |
| LICENSE | MIT 라이선스 전문 |
| .gitignore | 비밀키와 빌드 결과를 Git에서 제외 |
| .env.example | 값이 비어 있는 환경변수 이름 |
| .nvmrc | Node.js 24 선택 |
| README.md | 영어 프로젝트 설명과 실행 방법 |

파일명이 점으로 시작하는 파일도 포함돼 있습니다. VS Code의 탐색기에서 확인하세요.

.env.example의 전체 내용은 다음과 같습니다.

```dotenv
QLOO_API_KEY=
GEMINI_API_KEY=
```

현재 첫 화면은 키 없이 실행되고 배포됩니다. 3단계부터 컴퓨터에서는 .env.local을 만들고, Vercel에서는 프로젝트 환경변수에 값을 등록합니다. 실제 키 파일은 GitHub에 올리지 마세요. 이 압축파일에는 실제 키를 넣지 않았습니다.

## 3. GitHub 공개 저장소 만들기

Windows/macOS에서는 [GitHub Desktop](https://desktop.github.com/download/)으로 올리는 방법이 간단합니다. 설치 후 본인 GitHub 계정으로 로그인하세요.

1. GitHub Desktop에서 File → Add local repository를 누르고 압축을 푼 reminiscence-agent 폴더를 선택합니다.
2. Git 저장소가 아니라고 나오면 해당 위치에 저장소를 만드는 create a repository 링크를 선택합니다. 기존 프로젝트 폴더에 만들고, 안에 같은 이름의 폴더를 한 번 더 만들지 마세요. README·Git ignore·License를 새로 생성하는 옵션은 고르지 않습니다. 준비된 파일을 그대로 씁니다.
3. 변경 목록에 LICENSE, .gitignore, .env.example, package-lock.json, app 폴더가 포함돼 있는지 확인합니다. 실제 .env.local이나 API 키가 포함돼 있으면 진행하지 말고 제외합니다.
4. 커밋할 변경 사항이 남아 있으면 Summary에 `Set up Reminiscence Agent starter`를 입력하고 Commit 버튼을 누릅니다.
5. Publish repository를 누르고 이름은 `reminiscence-agent`로 둡니다. `Keep this code private` 체크를 해제해 공개 저장소로 만들고 Publish Repository를 누릅니다. 같은 이름이 이미 있으면 다른 이름을 선택하세요.
6. View on GitHub로 저장소를 엽니다. Public 표시와 MIT license 표시가 있는지 확인합니다.

GitHub Desktop이 없는 Linux 환경이면 Git 명령을 사용할 수 있습니다. 아래에서 GitHub사용자이름, 이름, 이메일을 본인 값으로 바꾸세요. 이메일은 GitHub 계정 설정의 비공개용 noreply 주소를 써도 됩니다.

먼저 [GitHub 새 저장소](https://github.com/new?name=reminiscence-agent&visibility=public)에서 Public으로 생성합니다. README, .gitignore, License 자동 추가 옵션은 모두 끕니다. 아래 명령은 프로젝트 폴더에서 하나씩 실행합니다. 이미 GitHub Desktop으로 올렸다면 이 경로는 실행하지 않습니다.

프로젝트에 Git 저장소를 초기화합니다.

```bash
git init
```

이 저장소의 커밋 작성자 이름을 지정합니다.

```bash
git config user.name "본인 이름"
```

이 저장소의 커밋 작성자 이메일을 지정합니다.

```bash
git config user.email "본인 GitHub 이메일"
```

첫 브랜치 이름을 main으로 정합니다.

```bash
git branch -M main
```

.env.local이 무시되고 .env.example은 무시되지 않는지 확인합니다. 정상이라면 .env.local만 표시됩니다.

```bash
git check-ignore .env.local .env.example
```

올릴 파일을 준비합니다.

```bash
git add .
```

준비된 목록을 확인합니다. .env.local, node_modules, .next가 없어야 합니다.

```bash
git status --short
```

첫 커밋을 만듭니다.

```bash
git commit -m "Set up Reminiscence Agent starter"
```

GitHub에서 만든 저장소 주소를 연결합니다. 사용자이름은 본인 값으로 바꾸세요.

```bash
git remote add origin https://github.com/GitHub사용자이름/reminiscence-agent.git
```

GitHub에 업로드합니다. 로그인 요청이 뜨면 본인 계정으로 인증하세요. GitHub 계정 비밀번호 자체로 HTTPS push 인증을 할 수는 없습니다. 인증이 막히면 GitHub Desktop 또는 GitHub CLI의 브라우저 로그인 방식을 사용하세요.

```bash
git push -u origin main
```

## 4. Vercel에 배포

1. [Vercel](https://vercel.com/new)에 로그인하고 개인 프로젝트의 무료 Hobby 플랜을 사용합니다.
2. Add New → Project에서 GitHub 계정을 연결하고 방금 만든 저장소를 Import합니다. 저장소가 안 보이면 Vercel의 GitHub 접근 권한에서 해당 저장소를 허용합니다.
3. Framework Preset은 Next.js, Root Directory는 package.json이 있는 최상위 폴더로 둡니다. 저장소 최상위가 app과 package.json이면 `.`입니다. 폴더가 한 겹 더 들어갔다면 그 안을 Root Directory로 지정합니다.
4. Build Command는 기본값 `npm run build`, Install Command와 Output Directory는 Next.js 자동 설정을 유지합니다. Node.js Version은 24.x를 사용합니다.
5. 지금은 Environment Variables를 입력하지 않아도 됩니다. 안내 화면에는 키가 필요 없습니다.
6. Deploy를 누릅니다. Ready 상태가 되면 생성된 Production URL을 엽니다.
7. 시크릿 창에서도 같은 주소가 열리고 영어 안내 화면과 `A conversation aid, not medical advice.` 문구가 보이면 1단계의 배포 확인이 끝납니다. 로그인이 요구되면 프로젝트의 Deployment Protection 설정에서 공개 데모용 production 접근 설정을 확인하세요.

GitHub의 main에 다음 변경을 올리면 연결된 Vercel 프로젝트가 다시 배포됩니다.

## 5. 이후 단계에서 키 등록하기

Vercel 프로젝트 → Settings → Environment Variables에서 QLOO_API_KEY와 GEMINI_API_KEY를 추가합니다. 필요할 환경(Production 및 Preview)을 선택하고 저장한 뒤 새로 배포하세요. NEXT_PUBLIC_ 접두사를 붙이지 않습니다. 키는 향후 app/api 아래 서버 라우트에서만 읽습니다.

## 6. 확인 명령

코드 스타일과 오류를 검사합니다.

```bash
npm run lint
```

타입을 생성하고 TypeScript 오류를 검사합니다.

```bash
npm run typecheck
```

배포용 빌드를 만듭니다.

```bash
npm run build
```

만든 배포용 앱을 로컬에서 실행합니다.

```bash
npm run start
```

## 7. 성공 기준

- [ ] 내 컴퓨터에서 안내 화면이 열림
- [ ] GitHub 공개 저장소에 코드가 보임
- [ ] MIT license 표시가 보임
- [ ] .env.example은 있고 실제 키는 없음
- [ ] Vercel production 주소에서 안내 화면이 열림
- [ ] 시크릿 창에서도 열림

실제 GitHub 저장소 주소와 Vercel production 주소는 계정 연결 및 배포 후 확인할 수 있습니다. 현재 다운로드 파일만으로 두 주소가 자동 생성되지는 않습니다.

## 공식 문서

- [Next.js 설치](https://nextjs.org/docs/app/getting-started/installation)
- [GitHub Desktop으로 프로젝트 공개](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-an-existing-project-to-github-using-github-desktop)
- [GitHub 새 저장소 생성](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [Vercel GitHub 연결](https://vercel.com/docs/git/vercel-for-github)

## 이 작업에서의 검증 상태

- 의존성 설치, ESLint, TypeScript 검사는 통과했습니다.
- 빌드 결과를 production 서버로 실행해 HTTP 200, 영어 제목, 첫 화면, 면책 문구를 확인했습니다.
- 일반 빌드는 이 실행환경의 Node.js 메모리 계측 오류(uv_resident_set_memory)로 중단됐습니다. 검증용으로 선택적 메모리 추적만 끄고 다시 빌드했을 때 컴파일·타입 검사·정적 페이지 생성이 모두 통과했습니다. 이 환경 전용 조정은 앱 소스에 포함하지 않았습니다. Vercel에서도 일반 npm run build를 확인해야 합니다.
- Vercel 프로젝트 생성 요청은 연결된 계정의 팀 접근 권한 부족(403)으로 거절됐습니다. Vercel 플러그인 재인증 시 본인 Hobby 워크스페이스 ooseok118-6341에 대한 접근 권한을 허용한 후 재시도해야 합니다.
- 공개 저장소: https://github.com/ooseok118-oss/reminiscence-agent

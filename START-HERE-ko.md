# 3단계 실행 안내: Qloo 연결

공개 앱: https://reminiscence-agent.vercel.app

전체 코드: https://github.com/ooseok118-oss/reminiscence-agent

## 화면에서 확인하기

1. **Try an example**을 누릅니다. Mary / 1948 / Columbus, Ohio / Elvis Presley(Singer) / Roman Holiday(Movie)가 채워집니다.
2. **Find familiar connections**를 누릅니다. 실제 검색과 영화·TV·음악 확장에 맞춰 진행 문구가 바뀝니다.
3. Recognized favorites에서 인식한 종류와 이름을 확인합니다. Roman Holiday는 popularity가 가장 높은 1953년 영화로 선택됩니다. 다른 결과를 원하면 이름이나 종류를 수정해 다시 제출합니다.
4. Movies / TV shows / Music 목록과 각 항목의 출발점별 기여 점수를 확인합니다. 기본 회상 구간은 1958–1978년입니다.

현재 결과는 데이터 확인용입니다. **안전 점검과 피할 주제 적용은 아직 하지 않았습니다.** Gemini 안전 점검과 세션 설계는 4단계에서 연결합니다. 기여 점수는 좋아할 확률이 아니며 퍼센트로 표시하지 않습니다.

## 주요 파일

| 경로 | 역할 |
| --- | --- |
| app/components/profile-form.tsx | 프로필 입력과 실제 API 호출 진행 표시 |
| app/components/qloo-results.tsx | 인식 결과, 영역별 목록, 기여 점수 표시 |
| app/api/resolve/route.ts | 종류가 일치하는 검색 결과 중 최고 popularity 선택 |
| app/api/expand/route.ts | 출발점을 모두 사용해 세 영역 병렬 확장 |
| lib/qloo-server.ts | 서버 전용 키, API 호출, 입력 검사, 오류 처리, 필터 완화 |
| lib/qloo-data.ts | 종류 매칭, 활동 연도, 기여 점수 변환 |
| lib/qloo-types.ts | API 결과 타입 |
| tests/qloo-data.test.mjs | 동명 검색·연도 경계·설명 점수 검증 |

영화는 회상 구간과 인기도 0.8, TV는 회상 구간과 인기도 0.5를 적용합니다. 음악에는 미지원 API 연도 필터를 보내지 않고 활동 연도 겹침을 앱에서 검사합니다. 종료 연도가 없으면 활동 중으로 취급하며 시작 연도가 없으면 제외합니다. 결과가 3개 미만이면 인기도를 낮추고, 다음으로 구간을 앞뒤 5년 넓힙니다. 적용한 필터와 부분 실패는 화면에 표시합니다.

## 컴퓨터에서 실행하기

Node.js 24를 설치하고 프로젝트 폴더에서 아래 명령을 한 줄씩 실행합니다.

필요한 라이브러리를 설치합니다.

```bash
npm ci
```

비어 있는 환경변수 템플릿을 복사합니다.

```bash
cp .env.example .env.local
```

VS Code에서 `.env.local`의 `QLOO_API_KEY=` 뒤에 본인 키를 넣고 저장합니다. 실제 키 파일은 GitHub에 올리지 않습니다. Gemini 키는 현재 단계에 필요 없습니다.

개발 서버를 시작합니다.

```bash
npm run dev
```

http://localhost:3000 을 엽니다. 종료는 Ctrl+C입니다.

## Vercel 환경변수

Vercel 프로젝트 → Settings → Environment Variables에서 `QLOO_API_KEY`를 Secret으로 등록하고 Production·Preview를 선택합니다. 저장 후 새로 배포해야 반영됩니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 기존 프로젝트는 GitHub main에 변경을 올리면 자동 배포됩니다.

키는 서버 라우트에서만 사용합니다. 브라우저에 키를 전달하거나 콘솔에 프로필을 출력하지 않습니다. 현재 단계에서는 이름·고향·피할 주제도 서버로 전송하지 않습니다.

## 검사 명령

검색과 결과 변환 규칙을 검사합니다.

```bash
npm test
```

코드 스타일을 검사합니다.

```bash
npm run lint
```

타입 오류를 검사합니다.

```bash
npm run typecheck
```

배포용 빌드를 만듭니다.

```bash
npm run build
```

`.env.local`은 Git에서 제외되며 `.env.example`에는 빈 변수 이름만 있습니다. 저장소에는 MIT LICENSE가 포함돼 있습니다.

# HYSYS Companion 화면 데모 (ui-shell)

[한국어](#한국어) · [English](#english)

Licensed under the [Apache License 2.0](../LICENSE), like the rest of this repository. Bundled fonts keep their own licenses (see [`docs/ui-shell/licenses/`](../docs/ui-shell/licenses/)).

## 한국어

HYSYS Companion 앱의 화면 코드를 예시 데이터로 돌리는 웹 페이지예요. 케이스 홈, 새 케이스, 초안 그림, 진행 카드, 승인 카드, 에이전트 패널, 버전, 설정 화면이 앱과 같은 코드로 그려져요.

이 폴더는 앱 자체가 아니에요. HYSYS나 AI에 연결하지 않고, 모든 답은 `src/mock/*.json`에 미리 적어 둔 예시예요. 그래서 실제 케이스를 만들거나 열지 못해요. PDF 저장, PDF 쪽 읽기, 스터디 실행처럼 앱 서비스가 있어야 하는 기능은 "화면 데모에서는 쓸 수 없는 기능"이라고 답해요.

### 해 볼 수 있는 것

1. 빈 화면(열린 케이스 없음)에서 **새 케이스 만들기**를 눌러요.
2. **말로 설명하기**를 골라 공정을 적고 **만들기 시작**을 눌러요.
3. 빠진 값을 묻는 질문에 답해요. 추천값을 눌러도 돼요.
4. 초안 흐름도와 승인 카드가 나오면 **이대로 케이스 열기**를 눌러요.
5. 케이스 홈, 문제, 버전, 에이전트 패널을 둘러봐요.

`?case=open`을 주소 끝에 붙이면 케이스가 열린 상태로 시작해요.

### 실행

Node.js 20 이상이 필요해요.

```sh
npm ci
npm run dev      # http://localhost:5180
npm run build    # dist/ 에 빌드, dist/index.html 은 파일로 바로 열려요
```

## English

The HYSYS Companion app's screen code, running on sample data in a web page. Case home, New case, the draft drawing, the progress card, the approval card, the agent panel, Versions and Settings are drawn by the same code as the app.

This folder is not the app. It connects to no HYSYS and no AI, and every answer is a prepared example in `src/mock/*.json`, so it cannot build or open a real case. Features that need the app's service (PDF export, reading PDF pages, running studies) answer "not available in the screen demo".

### What to try

1. On the empty screen (no case open), press **새 케이스 만들기** (New case).
2. Pick **말로 설명하기** (Describe in words), type a process and press **만들기 시작** (Start building).
3. Answer the questions about missing values, or press a suggested value.
4. When the draft flowsheet and approval card appear, press **이대로 케이스 열기** (Open the case as is).
5. Look around Case home, Problems, Versions and the agent panel.

Add `?case=open` to the address to start with the case already open. Switch the interface to English in Settings.

### Run

Needs Node.js 20 or newer.

```sh
npm ci
npm run dev      # http://localhost:5180
npm run build    # builds into dist/; dist/index.html opens straight from disk
```

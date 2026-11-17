# Contributing / 기여하기

[한국어](#한국어) · [English](#english)

## 한국어

HYSYS Companion을 같이 좋게 만들어 주셔서 고마워요. 이 저장소에는 설치 파일, 브라우저 튜토리얼, 예시 데이터로 도는 화면 데모(`ui-shell/`)가 있어요. 앱의 엔진 코드는 들어 있지 않아요.

### 버그 알리기

1. 앱의 설정에서 **문제 보고용 로그 저장**을 눌러요. 키는 지우고 저장하지만 파일 경로는 남으니, 보내기 전에 한 번 확인해 주세요.
2. [Issues](https://github.com/wjgoarxiv/hysys-companion-releases/issues)에 새 이슈를 열고 적어 주세요.
   - 앱 버전(설정 > 업데이트)과 Windows, HYSYS 버전
   - 무엇을 하려고 했는지, 실제로 무슨 일이 있었는지
   - 다시 일어나게 하는 순서
3. 로그 파일을 붙이기 전에 한 번 더 열어 보세요. 회사 케이스 파일, 공장 데이터, 고객 이름은 올리지 마세요.

보안 문제는 이슈로 올리지 말고 [SECURITY.md](SECURITY.md)의 비공개 신고 양식을 써 주세요.

### 기능 제안

이슈에 "하고 싶은 일"을 적어 주세요. 예: "탑의 환류비를 말로 바꾸고 싶어요". 지금은 어떻게 하는지, 왜 불편한지도 적어 주면 좋아요.

### 튜토리얼과 화면 데모 고치기

`docs/`(튜토리얼, 소개 슬라이드)와 `ui-shell/`(화면 데모)은 고쳐서 pull request를 보낼 수 있어요.

```sh
cd ui-shell
npm ci
npm run dev      # http://localhost:5180
npm run build
```

- 한 pull request에는 한 가지 주제만 담아요.
- 화면 글은 한국어와 영어를 같이 고쳐요.
- 바꾼 화면을 밝은 테마와 어두운 테마에서 확인하고 스크린샷을 붙여요.

## English

Thank you for helping improve HYSYS Companion. This repository holds the installer, the browser tutorial and a screen demo that runs on sample data (`ui-shell/`). The app's engine code is not included.

### Report a bug

1. In the app, press **Save problem-report log** in Settings. Keys are removed before saving; file paths stay, so check the file before you send it.
2. Open a new issue in [Issues](https://github.com/wjgoarxiv/hysys-companion-releases/issues) with:
   - the app version (Settings > Updates) and your Windows and HYSYS versions;
   - what you tried to do and what happened instead;
   - the steps that make it happen again.
3. Open the log file once more before attaching it. Do not upload company case files, plant data or customer names.

Report security problems through the private form in [SECURITY.md](SECURITY.md), not as an issue.

### Suggest a feature

Open an issue that describes what you want to do, for example "I want to change a column's reflux ratio by words", how you do it today, and why that is slow.

### Improve the tutorial or the screen demo

`docs/` (tutorial and intro slides) and `ui-shell/` (screen demo) accept pull requests.

```sh
cd ui-shell
npm ci
npm run dev      # http://localhost:5180
npm run build
```

- One topic per pull request.
- Change screen text in both Korean and English.
- Check the changed screen in light and dark themes and attach screenshots.

## License

By contributing, you agree that your contribution is licensed under the [Apache License 2.0](LICENSE). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

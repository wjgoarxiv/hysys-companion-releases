<p align="center">
  <img src="docs/readme-assets/app-icon-mono.png" width="96" alt="HYSYS Companion">
</p>

<h1 align="center">HYSYS Companion</h1>

<p align="center">
  Aspen HYSYS용 Windows 데스크톱 앱 배포 채널입니다.
</p>

<p align="center">
  <a href="../../releases/latest"><img src="https://img.shields.io/github/v/release/wjgoarxiv/hysys-companion-releases?label=latest" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Windows-10%2F11-0D7377" alt="Windows 10/11">
</p>

이 저장소는 **설치 파일만** 올립니다.

## 설치

1. [Releases](../../releases/latest) 를 엽니다.
2. `HYSYSCompanion_Native_Setup_0.9.37.exe` 를 받습니다.
3. 공개 SHA-256을 확인합니다.
4. 설치 파일을 실행합니다.

현재 Latest `v0.9.37` SHA-256:

```text
8077f9230213421b615942c459d1dd6791c355bb3ce0f2b9e7acca18067637eb
```

필요 환경: Windows 10/11 · Aspen HYSYS · Microsoft Edge WebView2.

설치 파일에 WebView 셸과 Python sidecar가 들어 있습니다.
별도 Python을 설치하지 않아도 됩니다.

## 앱이 하는 일

- 실행 중인 HYSYS 세션에 COM으로 붙습니다.
- 한국어/영어 화면에서 공정을 만듭니다.
- 미리보기를 본 뒤에만 Apply 합니다.
- 시작 시 새 버전 배너만 띄웁니다. 자동 설치는 하지 않습니다.

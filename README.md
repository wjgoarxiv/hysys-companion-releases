# HYSYS AI Companion — 배포 채널

HYSYS AI Companion 데스크톱 앱의 **설치 파일과 자동 업데이트 피드**를 호스팅하는 공개 저장소입니다.

> ⚠️ 소스 코드는 여기에 없습니다 (비공개 저장소에서 관리). 이 저장소에는 릴리스 산출물만 올립니다.

## 설치

[Releases](../../releases/latest) 에서 최신 `HYSYSCompanion_Native_Setup_*.exe` 를 받아 실행하세요.

- 요구사항: Windows 10/11, Aspen HYSYS, Microsoft Edge WebView2 런타임
- 설치 파일은 아직 코드 서명이 안 돼 있어, 처음 실행 시 SmartScreen 경고가 나올 수 있습니다 ("추가 정보 → 실행").

## 자동 업데이트

앱이 `latest.json` 을 읽어 새 버전을 알립니다. 각 릴리스에는 다음이 포함됩니다:

- `HYSYSCompanion_Native_Setup_<버전>.exe` — 설치 파일
- `latest.json` — 버전 · 다운로드 링크 · SHA-256 체크섬 · 용량

다운로드 후 SHA-256 이 `latest.json` 의 값과 같은지 확인하세요.

## 제작

고우진 책임연구원 · woojin.go@hd.com
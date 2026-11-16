import { casehomeMessages } from "./casehome";
import { pfdsheetMessages } from "./pfdsheet";
import { versionsMessages } from "./versions";
import { studiesMessages } from "./studies";

import { newcaseMessages } from "./newcase";
import { pdfMessages } from "./pdf";
import { agentMessages } from "./agent";
import { tutorialMessages } from "./tutorial";

export type MessagePair = Readonly<{ ko: string; en: string }>;

export const catalog = {
  ...newcaseMessages,
  ...pdfMessages,
  "app.name": { ko: "HYSYS 컴패니언", en: "HYSYS Companion" },
  "app.skip": { ko: "본문으로 건너뛰기", en: "Skip to content" },

  "nav.label": { ko: "화면 이동", en: "Screens" },
  "nav.case": { ko: "케이스 홈", en: "Case home" },
  "nav.problems": { ko: "문제", en: "Problems" },
  "nav.versions": { ko: "버전", en: "Versions" },
  "nav.new": { ko: "새 케이스", en: "New case" },
  "nav.beacon.running": { ko: "만드는 중", en: "Working" },
  "nav.beacon.waiting": { ko: "답을 기다려요", en: "Needs you" },
  "nav.beacon.ready": { ko: "승인 대기", en: "Ready to approve" },
  "nav.beacon.stopped": { ko: "멈춤", en: "Stopped" },
  "nav.beacon.done": { ko: "열었어요", en: "Opened" },
  "nav.beacon.sr": { ko: "새 케이스 {state}, {count} 단계", en: "New case {state}, step {count}" },
  "nav.studies": { ko: "스터디", en: "Studies" },
  "nav.deliverables": { ko: "산출물", en: "Deliverables" },
  "nav.settings": { ko: "설정", en: "Settings" },

  "screen.case.title": { ko: "케이스 홈", en: "Case home" },
  "screen.case.empty": { ko: "열린 케이스가 아직 없어요. HYSYS에서 케이스를 열거나 새 케이스를 만들어 보세요.", en: "No case is open yet. Open a case in HYSYS or start a new one." },
  "screen.problems.title": { ko: "문제", en: "Problems" },
  "screen.problems.empty": { ko: "지금 확인할 문제가 없어요.", en: "There is nothing to fix right now." },
  "screen.versions.title": { ko: "버전", en: "Versions" },
  "screen.versions.empty": { ko: "저장된 버전이 아직 없어요.", en: "No versions are saved yet." },
  "screen.new.title": { ko: "새 케이스", en: "New case" },
  "screen.new.empty": { ko: "만들고 싶은 공정을 설명하면 여기서 시작해요.", en: "Describe the process you want, and it starts here." },
  "screen.settings.title": { ko: "설정", en: "Settings" },
  "screen.studies.title": { ko: "스터디", en: "Studies" },
  "screen.deliverables.title": { ko: "산출물", en: "Deliverables" },
  "screen.deliverables.soon": { ko: "산출물 — v0.10.7에서 만나요", en: "Deliverables — coming in v0.10.7" },

  "header.unconverged": { ko: "수렴하지 않은 유닛 {count}개", en: "{count} units not converged" },
  "header.busy": { ko: "HYSYS 작업 중", en: "HYSYS busy" },
  "header.busy.hint": { ko: "HYSYS가 작업하는 동안에는 마지막으로 읽은 케이스를 보여줘요.", en: "While HYSYS is working, the last case that was read is shown." },
  "header.dialog": { ko: "HYSYS 확인 창 대기", en: "Waiting on a HYSYS dialog" },
  "header.unresponsive": { ko: "HYSYS 응답 없음", en: "HYSYS not responding" },
  "header.unresponsive.hint": { ko: "HYSYS가 한동안 응답하지 않아요. HYSYS 창이 멈췄는지 확인해 주세요.", en: "HYSYS has not responded for a while. Check whether the HYSYS window is frozen." },
  "header.dialog.hint": { ko: "HYSYS가 확인 창의 답을 기다리고 있어요. HYSYS 창에서 답해 주세요.", en: "HYSYS is waiting for an answer in one of its dialogs. Answer it in the HYSYS window." },
  "header.noCase": { ko: "열린 케이스 없음", en: "No case open" },
  "header.hysys.pid": { ko: "HYSYS PID {pid}", en: "HYSYS PID {pid}" },
  "header.units": { ko: "유닛", en: "units" },
  "header.streams": { ko: "스트림", en: "streams" },
  "header.label": { ko: "케이스 정보", en: "Case details" },
  "solver.converged": { ko: "수렴", en: "Converged" },
  "solver.unconverged": { ko: "미수렴", en: "Not converged" },
  "solver.solving": { ko: "계산 중", en: "Solving" },
  "solver.unknown": { ko: "상태 모름", en: "Unknown" },

  "layout.toWide": { ko: "넓게 보기", en: "Wide view" },
  "layout.toPanel": { ko: "패널로 보기", en: "Panel view" },

  "agent.title": { ko: "에이전트", en: "Agent" },
  "agent.label": { ko: "에이전트에게 요청", en: "Ask the agent" },
  "agent.placeholder": { ko: "무엇을 할까요? (Ctrl+K)", en: "What should we do? (Ctrl+K)" },
  "agent.send": { ko: "보내기", en: "Send" },
  "agent.open": { ko: "에이전트 열기", en: "Open agent" },
  "agent.close": { ko: "에이전트 닫기", en: "Close agent" },
  "agent.resize": { ko: "에이전트 폭 조절", en: "Resize the agent" },
  "agent.resizeHint": { ko: "끌거나 ←/→ 키로 폭을 바꿔요. 두 번 누르면 처음 폭으로 돌아가요.", en: "Drag or use ←/→ to change the width. Double-click to reset." },

  "settings.display": { ko: "화면", en: "Display" },
  "settings.language": { ko: "언어", en: "Language" },
  "settings.language.hint": { ko: "화면 글자와 답변 언어가 함께 바뀌어요.", en: "Changes the interface text and the reply language." },
  "settings.theme": { ko: "테마", en: "Theme" },
  "settings.layout": { ko: "화면 배치", en: "Layout" },
  "settings.layout.hint": { ko: "자동은 창 너비에 맞춰 바뀌어요.", en: "Auto follows the window width." },
  "settings.webLookup": { ko: "웹 자료 찾기", en: "Web lookup" },
  "settings.webLookup.hint": { ko: "말로 새 케이스를 만들 때 공정을 웹에서 먼저 찾아 AI에게 보여 줘요. 검색어에는 요청의 숫자를 넣지 않아요.", en: "Before a New case from words, the app looks the process up on the web for the AI. The search never carries the numbers you typed." },
  "settings.about": { ko: "정보", en: "About" },
  "settings.about.ciLink": { ko: "만든 사람의 GitHub 열기", en: "Open the maker's GitHub" },
  "settings.about.line": { ko: "HYSYS 컴패니언 · 만든 사람", en: "HYSYS Companion · built by" },
  "choice.ko": { ko: "한국어", en: "한국어" },
  "choice.en": { ko: "English", en: "English" },
  "choice.light": { ko: "라이트", en: "Light" },
  "choice.dark": { ko: "다크", en: "Dark" },
  "choice.system": { ko: "시스템", en: "System" },
  "choice.auto": { ko: "자동", en: "Auto" },
  "choice.panel": { ko: "패널", en: "Panel" },
  "choice.wide": { ko: "넓게", en: "Wide" },
  "choice.on": { ko: "켬", en: "On" },
  "choice.off": { ko: "끔", en: "Off" },

  "providers.title": { ko: "AI 계정", en: "AI accounts" },
  "providers.demo": { ko: "데모 계정으로 로그인한 상태예요", en: "Signed in (demo)" },
  "providers.demoHint": { ko: "이 화면 데모는 실제 AI나 HYSYS에 연결하지 않아요. 모든 답은 미리 만든 예시 데이터예요.", en: "This screen demo connects to no AI and no HYSYS. Every answer is prepared sample data." },
  ...casehomeMessages,
  ...pfdsheetMessages,
  ...agentMessages,
  ...tutorialMessages,
  ...versionsMessages,
  ...studiesMessages,
} as const satisfies Record<string, MessagePair>;

export type MessageKey = keyof typeof catalog;

# 이 프로젝트 실행 및 배포

- GitHub: https://github.com/RogertheKorean/comefollowme
- 로컬 폴더: `C:\Users\roger\OneDrive\Desktop\Workspace\comefollowme`
- 원본: `Together_Insights_v3_Vercel.zip`

## 로컬 실행

프로젝트 폴더에서 다음 명령을 실행합니다. 외부 패키지는 필요하지 않습니다.

```sh
node scripts/build.mjs
node --test tests/*.test.cjs
node scripts/serve.mjs
```

브라우저에서 http://127.0.0.1:4173 을 엽니다. npm을 사용할 수 있는 환경에서는 각각 `npm run build`, `npm test`, `npm start`로 실행해도 됩니다.

## Vercel 연결

1. https://vercel.com/new 에서 GitHub 저장소 `RogertheKorean/comefollowme`를 Import합니다.
2. 아래 설정을 확인하고 Deploy를 누릅니다.

| 항목 | 값 |
| --- | --- |
| Production Branch | `main` |
| Framework Preset | Other |
| Root Directory | `.` (저장소 최상위) |
| Build Command | `npm run build` |
| Output Directory | `public` |
| Install Command | 빈 문자열 (`vercel.json`에 설정됨) |
| Environment Variables | 필요 없음 |

빌드 설정은 저장소 최상위 `vercel.json`에 포함되어 있습니다. GitHub에 코드를 올리는 단계와 Vercel에서 처음 프로젝트를 연결하는 단계는 별개입니다. 연결 후 `main`에 변경을 push하면 Vercel이 다시 배포합니다.

화면 변경은 `src/`, 기본 콘텐츠 변경은 `content/`에서 합니다. `public/index.html`과 최상위 `index.html`은 빌드할 때 생성됩니다.

현재 버전은 브라우저의 로컬 저장소를 사용하는 시연본입니다. 다른 사용자 또는 기기와 기록을 공유하는 서버는 포함되어 있지 않습니다.

배포 설정 참고: [Vercel 프로젝트 설정](https://vercel.com/docs/project-configuration), [GitHub 연결](https://vercel.com/docs/git/vercel-for-github).

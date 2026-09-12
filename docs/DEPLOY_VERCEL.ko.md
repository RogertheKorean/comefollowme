# GitHub → Vercel 배포

ZIP 압축 해제 후 최상위 내용물을 저장소에 올리세요. ZIP 자체를 업로드하는 방식이 아닙니다.

```text
저장소 최상위
├── package.json
├── package-lock.json
├── vercel.json
├── src/
├── content/
├── scripts/
└── public/
```

Vercel에서 GitHub 저장소를 Import하고 Framework Preset **Other**, Root Directory **`.`**, Build Command **`npm run build`**, Output Directory **`public`**로 확인한 뒤 배포합니다. `vercel.json`에 빌드·출력 설정이 들어 있습니다. 환경변수나 데이터베이스 키가 필요하지 않습니다.

`src/` 또는 `content/`를 수정한 후 커밋하면 빌드 결과가 다시 생성됩니다. `public/index.html`만 수정하면 다음 빌드에 덮어써집니다.

관리 화면에서 붙여 넣은 참조 본문을 함께 배포하려면 **콘텐츠 팩 내보내기** 결과로 `content/deployment-content.json`을 교체합니다. 브라우저에 등록만 한 자료는 다른 기기에 자동 전달되지 않습니다. 이 파일에는 인사이트·개인 기록을 넣지 마세요.

## 배포 후 확인

첫 화면 → 연차대회 패널 체험 → 문단 선택 → 인사이트 첨부 → 생각 작성 → 우리 반에 나누기 → 새로고침 후 기록 확인 순서로 점검합니다. 다른 브라우저에서는 그 기록이 보이지 않는 것이 현재 데모의 정상 동작입니다.

비공개 GitHub 저장소 여부와 배포 사이트 공개 여부는 별개입니다. 검색 제외 설정은 접근 제어가 아닙니다. 실제 개인 정보는 기록하지 말고 시연용 정보만 사용하세요. 동일 주소에 로컬로 등록한 본문이 있으면 그 브라우저에서는 로컬 자료가 우선할 수 있습니다. 기본 배포 자료로 돌아가려면 시연 초기화 후 확인합니다.

실제 계정에 대한 배포는 이 전달물 제작 과정에서 수행하지 않았습니다. 상세 검증 범위는 TESTING.md를 참고하세요.

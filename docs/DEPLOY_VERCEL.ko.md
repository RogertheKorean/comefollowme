# GitHub · Vercel · Supabase 배포

저장소는 `RogertheKorean/comefollowme`, Vercel 프로젝트는 `comefollowme`입니다. 서비스 주소는 https://comefollowme.vercel.app 입니다.

## 빌드

Vercel Framework **Other**, Root Directory **`.`**, Build Command **`npm run build`**, Output Directory **`public`**, Install Command **빈 문자열**로 설정합니다. `vercel.json`에도 같은 설정이 있습니다.

Production, Preview, Development 환경에 `SUPABASE_URL`과 `SUPABASE_PUBLISHABLE_KEY`를 등록합니다. publishable 키는 브라우저에서 사용하도록 만들어진 공개 키입니다. secret/service_role 키와 SMTP 앱 비밀번호를 Vercel 프런트엔드 환경변수로 등록하지 않습니다.

`src/` 또는 `content/`를 수정하고 빌드합니다. Git 연결이 설정되면 push 후 Vercel이 배포합니다. 연결되지 않은 계정에서는 인증된 Vercel CLI로 `vercel --prod`를 실행할 수 있습니다. `.vercel`, `.env*`, 개인 기록 내보내기 파일은 커밋하지 않습니다.

## 서버 설정

Supabase 프로젝트에 `supabase/migrations/`를 순서대로 적용합니다. 인증 설정의 서비스 URL과 Redirect URLs가 실제 도메인을 가리키는지 확인합니다. 이메일 로그인·가입 확인·비회원 인증이 사용됩니다.

`supabase/config.toml`의 Gmail SMTP 비밀번호는 `env(SMTP_PASSWORD)`에서 읽습니다. 설정을 다시 push할 때 비밀번호 환경변수가 필요합니다. `.env.smtp.local`은 로컬 입력용 파일이며 빌드에 읽히지 않습니다.

## 확인

주별 카드 → 공과 → 참조자료와 공식 원문 → 회원/비회원 참여 → 인사이트 저장 → 다른 브라우저의 공유 글 확인 → 댓글 → 새로고침 후 유지 순서로 점검합니다. 비공개 글은 다른 계정과 로그아웃한 방문자에게 보이지 않아야 합니다.

모바일의 입력창과 원문 패널, 비밀번호 재설정 링크도 확인합니다. 테스트 범위와 실기기 검증 여부는 `TESTING.md`에 기록합니다.

공과 준비 화면의 **공과 게시**는 Supabase에 저장하며 사이트 재배포 없이 반영됩니다. 마이그레이션 006·007이 필요하며 기존 프로젝트에는 2026-09-13 적용했습니다. 참조자료 전문 등록은 별도 브라우저 로컬 작업으로, 콘텐츠 팩의 `content/deployment-content.json`을 교체하고 재배포합니다. 개인 인사이트 내보내기는 콘텐츠 팩과 다릅니다.

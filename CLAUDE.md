# Lớp Nhạc Vui — quy ước cho người & agent

Nguồn chuẩn: `docs/SPEC_v1.md` (spec) và `mockup/lop-nhac-vui-mockup.html` (giao diện/luồng/âm thanh). **Lệch nhau thì mockup thắng**, trừ các mục đánh dấu **[Vận hành]** trong spec.

## Kiến trúc (lint ép một phần)
- `src/domain/` — logic thuần + `schemas/` (Zod). Không React/DB/audio/DOM. Thời gian và ngẫu nhiên **truyền vào** (`now: number`, `rng: () => number`), không gọi `Date.now()`/`Math.random()` trực tiếp.
- `src/db/` — Dexie, migrations, repositories, backup/gói cài đặt. Nơi duy nhất import `dexie`. Repository tự gán `id` (UUID v7), `ownerId`, `createdAt`, `updatedAt`. Xoá = xoá mềm (`deletedAt`).
- `src/audio/` — engine Web Audio (port module `Snd` của mockup), trình phát mp3, đo mic. Có interface để test dùng bản giả.
- `src/machines/` — XState v5 cho luồng game (chairs, silence, wait, tvCheck, welcome). Mọi phím được xử lý qua event của machine; không dùng cờ boolean rời rạc.
- `src/ui/` — component dùng chung (Sticker, Button, Mascot, Overlay, Confetti, Kbd).
- `src/features/<screen>/` — màn hình. Chỉ gọi repositories/hooks, machine, audio interface.
- `src/app/` — khung app, điều hướng, ErrorBoundary, phím tắt toàn cục, wake lock, fullscreen + keyboard lock.

## Style
- Port CSS từ mockup (giữ nguyên tên biến `--ink`, `--sun`…, đã khai báo ở `src/styles/index.css`). CSS theo màn đặt cạnh component (`*.css`). Tailwind dùng cho layout tiện tay. Không tự chế màu/hiệu ứng mới.
- Chuỗi giao diện tiếng Việt, code/commit/comment kỹ thuật bằng tiếng Anh (comment tiếng Việt được khi giải thích nghiệp vụ).

## Chất lượng
- `npm run check` (typecheck + lint + test) phải xanh trước khi commit.
- Logic trong `domain/` phải có test; bất biến quan trọng dùng fast-check.
- Machine có test gửi chuỗi event → kiểm tra trạng thái.
- Không commit dữ liệu học sinh thật hay file nhạc.
- Commit nhỏ, mỗi commit 1 việc, message dạng `feat(domain): ...`, `chore: ...`.

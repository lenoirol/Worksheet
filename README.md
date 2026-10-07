# WS by PHN

Ứng dụng web tạo **Word Search** và **Word Scramble**, xem trước đề/đáp án, lưu PNG/PDF, in và chia sẻ. Giao diện hỗ trợ chế độ sáng/tối và vật liệu Liquid Glass.

Ứng dụng chạy trên trình duyệt, không cần backend hoặc tài khoản. Danh sách từ và các tùy chọn chỉ nằm trong bộ nhớ; tải lại trang sẽ xóa dữ liệu đã nhập. Bản production hỗ trợ sử dụng offline sau khi tải lần đầu.

## Chạy trên máy

```sh
npm ci
npm run dev
```

Mở địa chỉ do Vite hiển thị, mặc định là `http://localhost:5173/`.

## Kiểm tra và build

```sh
npm test
npm run build
npm run preview
```

Build tạo thư mục `dist/`, có thể triển khai lên dịch vụ hosting tĩnh.

## Cấu trúc

- `src/core/`: xử lý từ, sinh lưới và xáo chữ theo seed.
- `src/layout/`, `src/render/`: bố cục và vẽ trang.
- `src/export/`: PNG, PDF, in và chia sẻ.
- `src/ui/`: giao diện và hiệu ứng kính.
- `src/workers/`: sinh lưới bằng Web Worker.
- `tests/`: kiểm thử thuật toán, bố cục và xuất file.
- `reference/`: tài liệu và các mẫu đối chiếu.

Công nghệ: React, TypeScript, Vite, Vitest, pdf-lib và fflate.

# Tin học không khó — Gia sư Python gợi mở

Website tiếng Việt có chatbot AI thật dành cho học sinh THCS, phát triển theo ý tưởng trang giới thiệu:
https://gia-su-python-goi-mo-tin-hoc.fizzyox20.chatgpt.site/

## Chức năng

- Học theo **2 câu hỏi gợi mở**, hỏi lần lượt trước khi đưa lời giải; có gợi ý nếu học sinh chưa trả lời đúng.
- Sau khi gợi mở: ý tưởng, code Python, hai test và câu vận dụng.
- Chế độ **Giải thích lý thuyết** dành cho câu hỏi kiến thức đơn thuần.
- Nhập đề bài, dán code, đính kèm `.py`, `.txt`, `.md`, `.json`, `.csv` hoặc ảnh `.jpg`, `.png`, `.webp`.
- Ghi nhớ lịch sử ngay trên thiết bị bằng localStorage; nút xóa cuộc trò chuyện.
- Giao diện desktop/mobile, không yêu cầu học sinh đăng nhập ChatGPT.

**Quan trọng:** Giao diện tải được ngay, nhưng chatbot chỉ phản hồi AI khi chủ website thiết lập `GEMINI_API_KEY` trên máy chủ. Không có API key thì không thể trò chuyện trực tiếp. Việc phục vụ nhiều người có thể phát sinh chi phí và giới hạn từ Gemini.

## Chạy trên máy tính để kiểm thử

Cần Node.js 20 trở lên.

1. Sao chép `.env.example` thành `.env`.
2. Vào [Google AI Studio](https://aistudio.google.com/apikey) tạo Gemini API key, điền vào `.env` ở `GEMINI_API_KEY=...`.
3. Mở Terminal trong thư mục website rồi chạy:

```bash
npm start
```

4. Truy cập `http://localhost:3000`.

Website không dùng thư viện npm ngoài, nên không cần cài đặt thêm gói. `npm test` chạy bộ kiểm thử phía máy chủ.

## Triển khai để mọi người truy cập bằng đường link Vercel

1. Giải nén dự án và đẩy toàn bộ mã nguồn lên repository GitHub (không được đưa `.env` hoặc khóa API lên GitHub).
2. Mở [Vercel](https://vercel.com/new), **Add New Project → Import Git Repository**.
3. Trong cấu hình, chọn dự án, **Framework Preset = Other**, **Root Directory = `./`**, không cần Build Command.
4. Trong **Environment Variables** thêm:
   - `GEMINI_API_KEY` = khóa lấy từ Google AI Studio.
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite` (hoặc model khác có trong tài khoản).
   - `RATE_LIMIT_PER_MINUTE` = `12` (tùy chọn).
5. Nhấn **Deploy**. Sau khi deploy xong, Vercel cấp link `https://<ten-du-an>.vercel.app`, có thể gửi cho học sinh.
6. Dùng cửa sổ ẩn danh kiểm tra 1 hội thoại 2 câu hỏi trên điện thoại và máy tính. Nếu lỗi 404 mô hình, kiểm tra tên model và quyền API key trong AI Studio.

**Vercel:** `api/chat.js` là Vercel Serverless Function xử lý AI; API key lưu bằng Environment Variables chỉ ở máy chủ. Các tệp giao diện `index.html`, `styles.css`, `app.js` nằm tại thư mục gốc.

## An toàn và giới hạn

- Không nhập thông tin cá nhân nhạy cảm của học sinh hoặc dữ liệu lớp vào chatbot.
- Nội dung câu hỏi và ảnh đính kèm được gửi đến Gemini qua máy chủ để xử lý. Lịch sử cuộc trò chuyện được lưu trên trình duyệt của học sinh, không có cơ sở dữ liệu riêng.
- Nếu học sinh dùng máy tính chung, cần xóa lịch sử bằng nút **Cuộc trò chuyện mới** sau khi sử dụng.
- Lọc tệp, giới hạn dung lượng, giới hạn độ dài và số lần gọi API mức cơ bản. **Rate limit trong mã nguồn chỉ tính theo từng tiến trình server, KHÔNG bảo vệ đầy đủ khi chạy nhiều phiên bản serverless.** Trước khi phổ biến rộng, cấu hình WAF/rate limit phân tán, theo dõi chi phí/quota Gemini và cân nhắc CAPTCHA để tránh lạm dụng.
- Không tuyệt đối bảo đảm mọi câu trả lời AI đều chính xác. Giáo viên nên kiểm tra code/test mẫu.
- Không đưa `GEMINI_API_KEY` vào code frontend hoặc gửi khóa API trong khung chat.

## Cấu trúc

```
index.html       Giao diện chatbot
styles.css       Thiết kế và responsive
app.js           Logic trò chuyện, lưu lịch sử, file đính kèm
api/chat.js      API serverless chuyển tin nhắn đến Gemini
server.mjs       Chạy thử trên máy
vercel.json      Thiết lập Vercel
.env.example     Mẫu cấu hình máy chủ
```

Liên hệ trong giao diện: `thihoaqaqs@gmail.com` (được dẫn từ trang tham khảo).

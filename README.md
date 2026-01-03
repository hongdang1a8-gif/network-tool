# Network Diagnostic Tool - Công Cụ Chẩn Đoán Mạng

Đây là bộ công cụ web mạnh mẽ dành cho IT Helpdesk và người dùng cá nhân để kiểm tra, giám sát hệ thống mạng và quản lý máy tính cơ bản.

## 🚀 Tính Năng Nổi Bật

### 1. 📊 Tổng Quan Mạng (Network Overview)
*   **WAN IP**: Hiển thị IP Quốc tế (Public IP) chính xác.
*   **LAN IP**: Hiển thị IP nội bộ (Local IP) của máy.
*   **Connection Type**: Phát hiện đang dùng dây **Ethernet (LAN) 🔌** hay **Wi-Fi 📶** (kèm băng tần 5GHz/2.4GHz).
*   **Speed Test**: Kiểm tra tốc độ download thực tế (sử dụng Cloudflare).

### 2. 🛠️ Công Cụ Nâng Cao (Advanced Tools)
*   **Real-time Ping Graph**: Biểu đồ độ trễ (latency) thời gian thực tới Google (8.8.8.8).
*   **System Health**: Giám sát CPU, RAM, Uptime, Hostname và phiên bản Windows chi tiết (VD: Windows 11 24H2).
*   **Port Scanner**: Quét các cổng phổ biến (80, 443, 3389...) trên localhost.
*   **Traceroute**: Truy vết đường đi của gói tin.

### 3. 📝 Nhật Ký Mạng (Google Sheets Logging)
*   Lưu kết quả kiểm tra mạng (IP, Speed, Ping, Hostname...) trực tiếp vào Google Sheets để báo cáo.

### 4. 💻 Quản Lý Máy Tính
*   **Rename Computer**: Đổi tên máy tính nhanh chóng (Yêu cầu quyền Administrator).

### 5. 📱 Friendly UI
*   Giao diện Dark Mode, thiết kế Glassmorphism đẹp mắt.
*   Tương thích hoàn toàn với điện thoại di động (Mobile Responsive).

---

## ⚙️ Cài Đặt (Installation)

Yêu cầu: Máy tính đã cài **Node.js** (v14 trở lên).

1.  **Clone/Download** dự án về máy.
2.  Mở Terminal (CMD/PowerShell) tại thư mục dự án.
3.  Cài đặt thư viện:
    ```bash
    npm install
    ```
4.  Chạy chương trình:
    ```bash
    node server.js
    ```
    *(Để dùng tính năng Đổi tên máy, bạn cần chạy Terminal với quyền **Run as Administrator**)*

5.  Mở trình duyệt truy cập: `http://localhost:3001`

---

## ☁️ Hướng Dẫn Kết Nối Google Sheets

Để tính năng "Save to Google Sheet" hoạt động, bạn cần cấu hình như sau:

### Bước 1: Tạo Google Service Account
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo Project mới -> Vào menu **IAM & Admin** -> **Service Accounts**.
3. Tạo Service Account mới -> Chọn và tải xuống key định dạng **JSON**.
4. Đổi tên file key thành `service-account.json` và copy vào thư mục gốc của dự án này.

### Bước 2: Chuẩn Bị Google Sheet
1. Tạo một file Google Sheet mới tại [sheets.google.com](https://docs.google.com/spreadsheets).
2. Mở file `service-account.json` bằng Notepad, copy địa chỉ email (VD: `network-bot@...iam.gserviceaccount.com`).
3. Trong Google Sheet, bấm nút **Share (Chia sẻ)** và dán email đó vào (Quyền **Editor**).
4. **QUAN TRỌNG:** Tại dòng 1 của Sheet, bạn **PHẢI** điền chính xác các tiêu đề cột sau:
    *   Cột A: `Time`
    *   Cột B: `WanIP`
    *   Cột C: `LanIP`
    *   Cột D: `Ping`
    *   Cột E: `DownloadSpeed`
    *   Cột F: `Note`
    *   Cột G: `Hostname`
    *   Cột H: `OS`
    *   Cột J (hoặc I): `Wifi/LAN`  *(Tên phải khớp chính xác)*

### Bước 3: Cấu Hình ID
1. Lấy ID của Google Sheet từ đường dẫn URL:
   `https://docs.google.com/spreadsheets/d/`**`COPY_DOAN_NAY`**`/edit...`
2. Mở file `server.js`, tìm dòng `const SPREADSHEET_ID` và dán ID của bạn vào.
3. Restart lại server server.

---

## ⚠️ Lưu Ý
*   **Rename Computer**: Sau khi đổi tên, máy tính cần khởi động lại (Restart) để tên mới có hiệu lực.
*   **Cổng 3001**: Đảm bảo cổng 3001 không bị firewall chặn nếu bạn muốn truy cập từ máy khác trong mạng LAN.

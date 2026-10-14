#  Smart Helmet Companion App

Đây là kho lưu trữ mã nguồn cho ứng dụng di động (Mobile App) thuộc đồ án Nón Bảo Hiểm Thông Minh. Ứng dụng đóng vai trò là bảng điều khiển trung tâm (Dashboard), kết nối và tương tác trực tiếp với phần cứng trên xe và nón bảo hiểm.

*(Lưu ý: Mã nguồn Firmware điều khiển vi mạch ESP-IDF được đặt ở một kho lưu trữ riêng biệt).*

##  Tính năng chính của App
- **Giám sát thời gian thực:** Cập nhật liên tục dữ liệu từ các cảm biến trên nón (MPU6050, MQ-3) thông qua kết nối Bluetooth Low Energy (BLE).
- **Cảnh báo an toàn (SOS):** Nhận diện tín hiệu va đập/té ngã và nồng độ cồn vượt mức để hiển thị cảnh báo Pop-up ngay trên màn hình.
- **Bản đồ định vị:** Hiển thị tọa độ GPS chính xác của người dùng dựa trên dữ liệu từ module NEO-6M.
- **Điều khiển phương tiện:** Tích hợp các nút chức năng để chủ xe cấp lệnh mở khóa (0x01), khóa xe (0x00), hoặc mở khóa khẩn cấp (0x02) truyền thẳng xuống mạch Relay trên xe.
- **Đồng bộ Đám mây:** Lưu trữ lịch sử dữ liệu và trạng thái hệ thống lên Firebase Realtime Database để người thân có thể theo dõi từ xa.

##  Công nghệ sử dụng
- **Framework:** React Native & Expo.
- **Kết nối phần cứng:** `react-native-ble-plx` (Xử lý giao tiếp BLE).
- **Cơ sở dữ liệu:** Firebase Realtime Database.
- **Biểu đồ & Bản đồ:** `react-native-chart-kit`, Google Maps Integration.

##  Hướng dẫn cài đặt & Chạy thử nghiệm

### Yêu cầu môi trường
- Đã cài đặt [Node.js](https://nodejs.org/) (Khuyên dùng bản LTS).
- Cài đặt ứng dụng **Expo Go** trên thiết bị di động (Android / iOS).

### Để chạy App
1. Clone dự án về máy tính:
   ```bash
   git clone [https://github.com/tho2495032-gif/Smart_Helmet_app.git](https://github.com/tho2495032-gif/Smart_Helmet_app.git)
   cd Smart_Helmet_app
2. Có thể tải file đã xuất .apk
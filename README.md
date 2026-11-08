# Smart Helmet App (Android)

Ứng dụng Android thuộc đồ án Nón Bảo Hiểm Thông Minh. App đọc dữ liệu thiết bị từ Firebase Realtime Database, hiển thị trạng thái và lịch sử, đồng thời gửi cảnh báo khi phát hiện nồng độ cồn hoặc va đập. Mã nguồn firmware ESP-IDF được quản lý ở repository riêng.

## Tính năng

- Đăng nhập, đăng ký và khôi phục mật khẩu qua Firebase Authentication.
- Dashboard hiển thị telemetry và biểu đồ cảm biến từ Firebase Realtime Database.
- Cảnh báo trong app và notification khi phát hiện sự cố.
- Bản đồ hiển thị vị trí GPS lấy từ telemetry Firebase.
- Lịch sử sự kiện và trang hồ sơ thiết bị.
- Các nút điều khiển khóa/mở khóa và Bluetooth hiện chỉ là giao diện mẫu; thao tác sẽ báo chức năng đang phát triển.

## Công nghệ

- React Native, Expo SDK 54 và TypeScript.
- Firebase Authentication, Realtime Database và Firestore.
- Expo Notifications, React Native WebView và React Native Chart Kit.

## Cấu trúc mã nguồn

```text
app/                         Expo Router: route và layout
src/
├── components/              UI theo module (auth, home, history, profile)
├── config/                  Khởi tạo Firebase và Auth native
├── hooks/                   Logic tải dữ liệu theo màn hình
├── screens/                 Nội dung các màn hình
├── types/                   Kiểu dữ liệu dùng chung
└── utils/                   Helper thuần (bản đồ, sự kiện)
```

`app/` giữ các route mỏng; phần màn hình và logic chính nằm trong `src/`.

## Yêu cầu

- Node.js phiên bản LTS và npm.
- Android Studio cùng Android SDK, hoặc thiết bị Android đã bật USB debugging.
- Cấu hình Firebase Authentication và Realtime Database cho dự án.

## Chạy trên Android

```bash
npm ci
npm run android
```

Để mở Metro riêng:

```bash
npm start
```

## Tạo file APK

Repository đã có profile `preview` trong `eas.json`, cấu hình xuất APK để cài trực tiếp lên thiết bị Android. Cài và đăng nhập EAS CLI, sau đó chạy:

```bash
npm install --global eas-cli
eas login
eas build --platform android --profile preview
```

EAS Build cung cấp liên kết tải APK sau khi quá trình build hoàn tất. [Tài liệu Expo về build APK](https://docs.expo.dev/build-reference/apk/).

Có thể liên hệ Quân để lấy file .apk
## Kiểm tra mã nguồn

```bash
npm run lint
npx tsc --noEmit
```

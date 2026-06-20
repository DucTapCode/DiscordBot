import { data, execute, handleInteraction } from "../commands/masoi.js";

console.log("=== BẮT ĐẦU KIỂM TRA LỆNH /MASOI ===");
console.log("- Tên lệnh:", data.name);
console.log("- Mô tả:", data.description);

if (data.name === "masoi" && typeof execute === "function" && typeof handleInteraction === "function") {
  console.log("✅ Lệnh /masoi đã được export đúng chuẩn và có đầy đủ hàm execute/handleInteraction!");
} else {
  console.error("❌ Lỗi: Định dạng lệnh /masoi không đúng chuẩn.");
}
console.log("=== KẾT THÚC KIỂM TRA ===");

import { data as tlData } from "../commands/tienlen.js";
import { data as pkData } from "../commands/poker.js";
import { data as pmData } from "../commands/phom.js";
import { data as bjData } from "../commands/blackjack.js";

console.log("=== BẮT ĐẦU CHẠY KIỂM TRA CÚ PHÁP CÁC PHÒNG CHƠI BÀI ===");
console.log("- Lệnh Tiến Lên:", tlData.name);
console.log("- Lệnh Poker:", pkData.name);
console.log("- Lệnh Phỏm:", pmData.name);
console.log("- Lệnh Blackjack:", bjData.name);
console.log("✅ Tất cả các lệnh chơi bài đã được import thành công mà không có lỗi cú pháp!");
console.log("=== KẾT THÚC KIỂM TRA ===");

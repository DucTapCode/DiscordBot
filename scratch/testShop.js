import { User, sequelize } from '../database.js';

// Mô phỏng hàm getPriceScale từ commands/shop.js
function getPriceScale(balance) {
  return Math.max(1, Math.floor(balance / 1000));
}

// Giả lập hàm getRandomItems
function getRandomItems() {
  return ['gun', 'time_machine', 'free_all_in'];
}

async function testShopLogic() {
  console.log("=== BẮT ĐẦU KIỂM THỬ KHÓA HỆ SỐ SHOP ===");
  await sequelize.sync();

  const testUserId = "shop_test_user_id";
  // Dọn dẹp dữ liệu cũ
  await User.destroy({ where: { discordId: testUserId } });

  // 1. Tạo user mới với số dư nhỏ (1,000 chips)
  let user = await User.create({
    discordId: testUserId,
    username: "Test Reroll Lock",
    balance: 1000,
    shopScale: 1
  });
  console.log(`\n[Bước 1] Khởi tạo user với số dư: ${user.balance} chips`);

  // 2. Chạy logic tự động reroll (lần đầu tiên mở shop)
  const now = Date.now();
  const threeHours = 3 * 60 * 60 * 1000;
  
  const initialScale = getPriceScale(user.balance);
  user.shopItems = JSON.stringify(getRandomItems());
  user.shopPurchased = JSON.stringify([false, false, false]);
  user.shopScale = initialScale;
  user.shopLastReroll = now;
  await user.save();

  console.log(`[Bước 2] Lần đầu mở shop:`);
  console.log(` - Hệ số nhân giá đã khóa (shopScale): ${user.shopScale}x (Mong đợi: 1x)`);
  console.log(` - Mốc thời gian chốt (shopLastReroll): ${user.shopLastReroll}`);

  // 3. Người chơi kiếm được rất nhiều tiền (ví dụ: thắng casino được 10 tỷ chips)
  user.balance = 10000001399;
  await user.save();
  console.log(`\n[Bước 3] Người chơi thắng casino, số dư tăng vọt: ${user.balance.toLocaleString()} chips`);

  // 4. Người chơi thực hiện Reroll thủ công
  console.log(`\n[Bước 4] Người chơi ấn nút "Reroll" thủ công...`);
  let transaction = await sequelize.transaction();
  try {
    const dbUser = await User.findOne({
      where: { discordId: testUserId },
      transaction,
      lock: true
    });

    const currentScale = dbUser.shopScale || 1;
    const rerollPrice = 100 * currentScale;
    console.log(` - Phí Reroll tính được: ${rerollPrice.toLocaleString()} chips (Dựa trên hệ số đã khóa: ${currentScale}x)`);

    // Trừ tiền Reroll
    dbUser.balance -= rerollPrice;

    // Sinh mới items (không cập nhật shopScale và shopLastReroll)
    dbUser.shopItems = JSON.stringify(getRandomItems());
    dbUser.shopPurchased = JSON.stringify([false, false, false]);

    await dbUser.save({ transaction });
    await transaction.commit();
    console.log(` - Đã Reroll thành công và trừ phí.`);
  } catch (error) {
    await transaction.rollback();
    console.error("Lỗi giao dịch:", error);
  }

  // Reload user từ DB để kiểm tra
  const updatedUser = await User.findOne({ where: { discordId: testUserId } });
  console.log(`\n[Kết quả sau Reroll thủ công]:`);
  console.log(` - Số dư còn lại: ${updatedUser.balance.toLocaleString()} chips`);
  console.log(` - Hệ số nhân giá (shopScale): ${updatedUser.shopScale}x (Mong đợi vẫn là: 1x để người chơi tiếp cận được item)`);
  console.log(` - Mốc thời gian chốt (shopLastReroll) có đổi không: ${updatedUser.shopLastReroll === now ? "KHÔNG ĐỔI (Đúng)" : "BỊ THAY ĐỔI (Sai)"}`);

  // 5. Giả lập thời gian trôi qua 3 giờ và người dùng mở shop lại
  console.log(`\n[Bước 5] Giả lập chu kỳ 3 giờ trôi qua (cộng thêm 3 giờ 1 giây vào shopLastReroll)...`);
  const pastTime = now - (threeHours + 1000);
  updatedUser.shopLastReroll = pastTime;
  await updatedUser.save();

  // Mở shop lần tiếp theo
  const currentNow = Date.now();
  let finalUser = await User.findOne({ where: { discordId: testUserId } });
  if (currentNow - Number(finalUser.shopLastReroll) >= threeHours) {
    console.log(" -> Đã quá 3 giờ! Tự động cập nhật hệ số mới và Reroll shop.");
    const newScale = getPriceScale(finalUser.balance);
    finalUser.shopItems = JSON.stringify(getRandomItems());
    finalUser.shopPurchased = JSON.stringify([false, false, false]);
    finalUser.shopScale = newScale;
    finalUser.shopLastReroll = currentNow;
    await finalUser.save();
  }

  console.log(`\n[Kết quả sau khi chu kỳ 3 giờ kết thúc]:`);
  console.log(` - Hệ số nhân giá mới (shopScale): ${finalUser.shopScale}x (Mong đợi: ${getPriceScale(10000001299)}x dựa trên số dư mới)`);
  console.log(` - Mốc thời gian chốt mới (shopLastReroll): ${finalUser.shopLastReroll}`);

  // Dọn dẹp dữ liệu kiểm thử
  await User.destroy({ where: { discordId: testUserId } });
  console.log(`\n🧹 Đã dọn dẹp dữ liệu kiểm thử.`);
  console.log("=== KIỂM THỬ HOÀN THÀNH ===");
}

testShopLogic();

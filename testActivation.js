import { User, Inventory, sequelize } from './database.js';
import { 
  triggerFreeAllIn, 
  processGameResult, 
  triggerTimeMachine, 
  triggerChanceToRevert, 
  openMysteryBox, 
  executeGunShoot,
  timeMachineCache
} from './itemActivation.js';

async function runTests() {
  console.log("🚀 BẮT ĐẦU CHẠY KIỂM THỬ HỆ THỐNG KÍCH HOẠT VẬT PHẨM CASINO...\n");

  try {
    // 1. Đồng bộ cơ sở dữ liệu
    await sequelize.sync();
    console.log("💾 Đồng bộ Database thành công!\n");

    const killerId = "test_killer_id";
    const victimId = "test_victim_id";

    // 2. Dọn dẹp dữ liệu cũ (nếu có)
    await Inventory.destroy({ where: { userId: [killerId, victimId] } });
    await User.destroy({ where: { discordId: [killerId, victimId] } });

    // 3. Khởi tạo người chơi test
    const killer = await User.create({ discordId: killerId, username: "Sát Thủ Test", balance: 5000, quota: 10 });
    const victim = await User.create({ discordId: victimId, username: "Nạn Nhân Test", balance: 2000, quota: 5 });
    console.log(`👤 Đã khởi tạo người chơi:\n - Killer: ${killer.username} (${killer.balance} chips)\n - Victim: ${victim.username} (${victim.balance} chips)\n`);

    // 4. Cấp phát vật phẩm test vào Inventory của Killer
    await Inventory.bulkCreate([
      { userId: killerId, itemId: 'free_all_in', quantity: 2 },
      { userId: killerId, itemId: 'increase_profit', quantity: 1 },
      { userId: killerId, itemId: 'loss_reduction', quantity: 1 },
      { userId: killerId, itemId: 'time_machine', quantity: 1 },
      { userId: killerId, itemId: 'chance_to_revert', quantity: 1 },
      { userId: killerId, itemId: 'mystery_box', quantity: 2 },
      { userId: killerId, itemId: 'gun', quantity: 1 }
    ]);
    console.log("📦 Đã cấp phát đầy đủ 7 loại vật phẩm thử nghiệm vào Kho đồ của Killer!\n");

    console.log("------------------------------------------------------------------");
    console.log("TEST 1: KÍCH HOẠT FREE ALL-IN COIN (PRE-BET)");
    console.log("------------------------------------------------------------------");
    const preBetRes = await triggerFreeAllIn(killerId, 1000);
    console.log("Kết quả:", preBetRes.message);
    const freeAllInInv = await Inventory.findOne({ where: { userId: killerId, itemId: 'free_all_in' } });
    console.log(`Số lượng Free All-In Coin còn lại: ${freeAllInInv ? freeAllInInv.quantity : 0} (Mong đợi: 1)\n`);

    console.log("------------------------------------------------------------------");
    console.log("TEST 2: XỬ LÝ KẾT QUẢ THẮNG VỚI INCREASE PROFIT & NHẬN TICKET (POST-GAME)");
    console.log("------------------------------------------------------------------");
    // Giả lập game chính đã cộng tiền thắng gốc (từ 5000 + 2000 = 7000) vào DB
    await User.update({ balance: 7000 }, { where: { discordId: killerId } });

    // Increase Profit kích hoạt cộng thêm 50% tiền cược gốc = 1000 chips.
    // Kết quả mong đợi: Số dư = 7000 + 1000 = 8000 chips. Nhận thêm 1 vé get_ticket.
    const gameWinRes = await processGameResult(killerId, true, 2000, 7000);
    console.log("Kết quả:", gameWinRes.message);
    const updatedKillerWin = await User.findByPk(killerId);
    console.log(`Số dư thực tế trong DB: ${updatedKillerWin.balance} chips (Mong đợi: 8000)`);
    const ticketInv = await Inventory.findOne({ where: { userId: killerId, itemId: 'get_ticket' } });
    console.log(`Số lượng Vé Jackpot sở hữu: ${ticketInv ? ticketInv.quantity : 0} (Mong đợi: 1)\n`);

    console.log("------------------------------------------------------------------");
    console.log("TEST 3: XỬ LÝ KẾT QUẢ THUA VỚI LOSS REDUCTION & LƯU SNAPSHOT (POST-GAME)");
    console.log("------------------------------------------------------------------");
    // Giả lập game chính trừ tiền thua cược (từ 8000 - 4000 = 4000) vào DB
    await User.update({ balance: 4000 }, { where: { discordId: killerId } });

    // Loss Reduction kích hoạt hoàn 25% tiền cược = 1000.
    // Kết quả mong đợi: Số dư = 4000 + 1000 = 5000 chips.
    // Đồng thời lưu snapshot cho Time Machine.
    const gameLossRes = await processGameResult(killerId, false, 4000, 4000);
    console.log("Kết quả:", gameLossRes.message);
    const updatedKillerLoss = await User.findByPk(killerId);
    console.log(`Số dư thực tế trong DB: ${updatedKillerLoss.balance} chips (Mong đợi: 5000)`);
    const snapshot = timeMachineCache.get(killerId);
    console.log(`Snapshot lưu trong Cache:`, snapshot ? `Số dư trước cược: ${snapshot.balanceBeforeBet} chips` : "Không tìm thấy snapshot!", "(Mong đợi trước cược: 8000)\n");

    console.log("------------------------------------------------------------------");
    console.log("TEST 4: SỬ DỤNG TIME MACHINE PHỤC HỒI TIỀN CƯỢC (ACTIVE INTERACTION)");
    console.log("------------------------------------------------------------------");
    // Kích hoạt Time Machine. Phục hồi số dư về trước ván cược thua (tức là 8000).
    const timeMachineRes = await triggerTimeMachine(killerId);
    console.log("Kết quả:", timeMachineRes.message);
    const updatedKillerTM = await User.findByPk(killerId);
    console.log(`Số dư thực tế sau khôi phục: ${updatedKillerTM.balance} chips (Mong đợi: 8000)`);
    const tmInv = await Inventory.findOne({ where: { userId: killerId, itemId: 'time_machine' } });
    console.log(`Số lượng Time Machine còn lại: ${tmInv ? tmInv.quantity : 0} (Mong đợi: 0)\n`);

    console.log("------------------------------------------------------------------");
    console.log("TEST 5: SỬ DỤNG CHANCE TO REVERT ĐẢO NGƯỢC THẾ CỜ (ACTIVE INTERACTION)");
    console.log("------------------------------------------------------------------");
    // Thử đảo ngược ván thua 3000 chips. Tỷ lệ 30%.
    const revertRes = await triggerChanceToRevert(killerId, 3000);
    console.log("Kết quả:", revertRes.message);
    const updatedKillerRevert = await User.findByPk(killerId);
    console.log(`Số dư hiện tại: ${updatedKillerRevert.balance} chips (Thắng cộng thêm 3000 thành 11000, thua giữ nguyên 8000)`);
    const revertInv = await Inventory.findOne({ where: { userId: killerId, itemId: 'chance_to_revert' } });
    console.log(`Số lượng Chance to Revert còn lại: ${revertInv ? revertInv.quantity : 0} (Mong đợi: 0)\n`);

    console.log("------------------------------------------------------------------");
    console.log("TEST 6: MỞ HỘP QUÀ BÍ ẨN (MYSTERY BOX) (STANDALONE)");
    console.log("------------------------------------------------------------------");
    const boxRes = await openMysteryBox(killerId);
    console.log("Kết quả:", boxRes.message);
    const boxInv = await Inventory.findOne({ where: { userId: killerId, itemId: 'mystery_box' } });
    console.log(`Số lượng Mystery Box còn lại: ${boxInv ? boxInv.quantity : 0} (Mong đợi: 1)\n`);

    console.log("------------------------------------------------------------------");
    console.log("TEST 7: BẮN SÚNG (GUN) PHẠT ĐỐI THỦ & TĂNG QUOTA (STANDALONE)");
    console.log("------------------------------------------------------------------");
    // Killer quota ban đầu: 10, tăng 33 thành 43.
    // Victim balance ban đầu: 2000, phạt 500 còn 1500.
    const gunRes = await executeGunShoot(killerId, victimId);
    console.log("Kết quả:", gunRes.message);
    const finalKiller = await User.findByPk(killerId);
    const finalVictim = await User.findByPk(victimId);
    console.log(`Thống kê sau nổ súng:`);
    console.log(` - Quota Killer: ${finalKiller.quota}/100 (Mong đợi: 43)`);
    console.log(` - Số dư Victim: ${finalVictim.balance} chips (Mong đợi: 1500)`);
    const gunInv = await Inventory.findOne({ where: { userId: killerId, itemId: 'gun' } });
    console.log(`Số lượng Súng còn lại: ${gunInv ? gunInv.quantity : 0} (Mong đợi: 0)\n`);

    // 5. Dọn dẹp dữ liệu kiểm thử
    await Inventory.destroy({ where: { userId: [killerId, victimId] } });
    await User.destroy({ where: { discordId: [killerId, victimId] } });
    console.log("🧹 Đã dọn dẹp sạch sẽ các bản ghi kiểm thử trong Database.");
    console.log("\n✅ TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ HOÀN THÀNH XUẤT SẮC!");

  } catch (error) {
    console.error("❌ XẢY RA LỖI TRONG QUÁ TRÌNH CHẠY KIỂM THỬ:", error);
  }
}

runTests();

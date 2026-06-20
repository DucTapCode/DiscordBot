import { User, Inventory, sequelize } from './database.js';
import { getItemById } from './itemManager.js';

// Cache Map lưu trữ snapshot trạng thái người chơi trước khi cược ván bài bị thua
// Khóa là userId (chuỗi discordId), giá trị là { balanceBeforeBet, timestamp }
export const timeMachineCache = new Map();

// Cache Map lưu trữ trạng thái Free All-In chờ kích hoạt của người chơi
export const freeAllInCache = new Map();

/**
 * ============================================================================
 * 1. ĐIỂM KÍCH HOẠT: TRƯỚC KHI ĐẶT CƯỢC (PRE-BET TRIGGER)
 * ============================================================================
 */

/**
 * Kích hoạt vật phẩm Free All-In Coin trước khi ván cược bắt đầu.
 * @param {string} userId - ID Discord của người chơi
 * @param {number} betAmount - Số tiền cược người chơi định đặtban đầu
 * @returns {Promise<{success: boolean, betAmount: number, isFreeAllIn: boolean, message: string}>}
 */
export async function triggerFreeAllIn(userId, betAmount) {
  let transaction;
  try {
    // Tạo Transaction để đảm bảo việc đọc và trừ vật phẩm diễn ra an toàn
    transaction = await sequelize.transaction();

    // Lấy thông tin User để biết số dư hiện tại của họ
    const user = await User.findOne({ 
      where: { discordId: userId },
      transaction
    });

    if (!user) {
      await transaction.rollback();
      return { success: false, betAmount, isFreeAllIn: false, message: 'Không tìm thấy tài khoản người chơi!' };
    }

    // Truy vấn kiểm tra xem trong Kho đồ người chơi có vật phẩm 'free_all_in' hay không
    const inv = await Inventory.findOne({
      where: { userId, itemId: 'free_all_in' },
      transaction,
      lock: true // Khóa bản ghi để tránh bị duplicate hoặc click liên tục
    });

    if (!inv || inv.quantity <= 0) {
      await transaction.rollback();
      return { success: false, betAmount, isFreeAllIn: false, message: 'Bạn không sở hữu vật phẩm Free All-In Coin!' };
    }

    // Tiêu thụ (trừ 1) vật phẩm trong DB
    inv.quantity -= 1;
    if (inv.quantity === 0) {
      await inv.destroy({ transaction }); // Xoá bản ghi nếu số lượng về 0
    } else {
      await inv.save({ transaction });
    }

    // Thực hiện lưu giao dịch thành công
    await transaction.commit();

    // Thiết lập tiền cược bằng số tiền hiện có của người chơi, gán cờ isFreeAllIn = true
    return {
      success: true,
      betAmount: user.balance,
      isFreeAllIn: true,
      message: `🪙 Đã kích hoạt Free All-In Coin thành công! Bạn đã đặt cược toàn bộ số dư **${user.balance.toLocaleString()} chips** mà không lo bị mất tiền thật nếu thua cuộc.`
    };

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Lỗi triggerFreeAllIn:', error);
    return { success: false, betAmount, isFreeAllIn: false, message: 'Đã xảy ra lỗi hệ thống khi kích hoạt Free All-In.' };
  }
}

/**
 * ============================================================================
 * 2. ĐIỂM KÍCH HOẠT: KHI PHÂN ĐỊNH KẾT QUẢ VÁN CƯỢC (POST-GAME TRIGGER)
 * ============================================================================
 */

/**
 * Tự động kích hoạt/áp dụng hiệu ứng vật phẩm thụ động sau khi biết kết quả ván cược.
 * @param {string} userId - ID Discord của người chơi
 * @param {boolean} isWin - Kết quả ván cược (true: Thắng, false: Thua)
 * @param {number} originalBet - Số tiền đặt cược ban đầu của ván bài
 * @param {number} currentBalance - Số dư hiện tại của người chơi sau khi game đã cộng/trừ tiền cược
 * @returns {Promise<{success: boolean, isWin: boolean, extraProfitApplied: boolean, extraProfitAmount: number, getTicketAdded: boolean, lossReductionApplied: boolean, refundAmount: number, newBalance: number, message: string}>}
 */
export async function processGameResult(userId, isWin, originalBet, currentBalance) {
  let transaction;
  let extraProfitApplied = false;
  let extraProfitAmount = 0;
  let getTicketAdded = false;
  let lossReductionApplied = false;
  let refundAmount = 0;

  try {
    const user = await User.findOne({ where: { discordId: userId } });
    if (!user) {
      return { success: false, message: 'Không tìm thấy tài khoản người dùng!' };
    }

    if (isWin) {
      // ---------------- TRƯỜNG HỢP: NGƯỜI CHƠI THẮNG ----------------
      transaction = await sequelize.transaction();

      // a. Kiểm tra & tiêu thụ Increase Profit (Tăng 50% tiền lãi thắng được)
      const increaseProfitInv = await Inventory.findOne({
        where: { userId, itemId: 'increase_profit' },
        transaction,
        lock: true
      });

      if (increaseProfitInv && increaseProfitInv.quantity > 0) {
        increaseProfitInv.quantity -= 1;
        if (increaseProfitInv.quantity === 0) {
          await increaseProfitInv.destroy({ transaction });
        } else {
          await increaseProfitInv.save({ transaction });
        }

        // Tăng thêm 50% lợi nhuận thu về (originalBet * 0.5)
        extraProfitAmount = Math.floor(originalBet * 0.5);
        user.balance += extraProfitAmount;
        await user.save({ transaction });
        extraProfitApplied = true;
      }

      // b. Tự động tặng 1 vật phẩm vé số Jackpot 'get_ticket' vào Kho đồ
      const [ticketInv, ticketCreated] = await Inventory.findOrCreate({
        where: { userId, itemId: 'get_ticket' },
        defaults: { quantity: 1 },
        transaction
      });

      if (!ticketCreated) {
        ticketInv.quantity += 1;
        await ticketInv.save({ transaction });
      }
      getTicketAdded = true;

      await transaction.commit();

      return {
        success: true,
        isWin: true,
        extraProfitApplied,
        extraProfitAmount,
        getTicketAdded,
        lossReductionApplied: false,
        refundAmount: 0,
        newBalance: user.balance,
        message: `🎉 Thắng cuộc! ${extraProfitApplied ? `Đã kích hoạt 📈 Increase Profit và nhận thêm **+${extraProfitAmount.toLocaleString()} chips**.` : ''} Đồng thời nhận thêm **🎟️ 1 vé số may mắn**.`
      };

    } else {
      // ---------------- TRƯỜNG HỢP: NGƯỜI CHƠI THUA ----------------
      transaction = await sequelize.transaction();

      // a. Kiểm tra & tiêu thụ Loss Reduction (Bảo hiểm hoàn 25% tiền thua cược)
      const lossReductionInv = await Inventory.findOne({
        where: { userId, itemId: 'loss_reduction' },
        transaction,
        lock: true
      });

      if (lossReductionInv && lossReductionInv.quantity > 0) {
        lossReductionInv.quantity -= 1;
        if (lossReductionInv.quantity === 0) {
          await lossReductionInv.destroy({ transaction });
        } else {
          await lossReductionInv.save({ transaction });
        }

        // Hoàn tiền bảo hiểm 25% tiền cược gốc
        refundAmount = Math.floor(originalBet * 0.25);
        user.balance += refundAmount;
        await user.save({ transaction });
        lossReductionApplied = true;
      }

      await transaction.commit();

      // b. Lưu snapshot trạng thái số dư trước khi cược vào Cache để hỗ trợ Time Machine
      // Số dư trước cược = Số dư cuối cùng sau ván cược - tiền được bảo hiểm hoàn trả (nếu có) + số tiền cược đã mất
      const balanceBeforeBet = user.balance - refundAmount + originalBet;
      timeMachineCache.set(userId, {
        balanceBeforeBet,
        timestamp: Date.now()
      });

      return {
        success: true,
        isWin: false,
        extraProfitApplied: false,
        extraProfitAmount: 0,
        getTicketAdded: false,
        lossReductionApplied,
        refundAmount,
        newBalance: user.balance,
        message: `💀 Thua cuộc! ${lossReductionApplied ? `Kích hoạt 🛡️ Loss Reduction bảo hiểm hoàn lại **+${refundAmount.toLocaleString()} chips** (25% số tiền cược).` : ''} Thông tin ván thua đã được ghi nhớ cho cỗ máy thời gian.`
      };
    }

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Lỗi processGameResult:', error);
    return { success: false, message: 'Đã xảy ra lỗi hệ thống khi xử lý kết quả ván cược.' };
  }
}

/**
 * ============================================================================
 * 3. ĐIỂM KÍCH HOẠT: TƯƠNG TÁC CHỦ ĐỘNG SAU TRẬN ĐẤU (COMPONENT INTERACTION)
 * ============================================================================
 */

/**
 * Quay ngược thời gian bằng Time Machine để khôi phục lại số dư trước ván thua.
 * @param {string} userId - ID Discord của người chơi
 * @returns {Promise<{success: boolean, oldBalance: number, restoredBalance: number, message: string}>}
 */
export async function triggerTimeMachine(userId) {
  // Tìm kiếm bản ghi nhớ ván thua gần nhất từ cache Map
  const snapshot = timeMachineCache.get(userId);
  if (!snapshot) {
    return { success: false, message: '⚠️ Không tìm thấy dữ liệu ván cược thua gần nhất của bạn để quay ngược thời gian!' };
  }

  const now = Date.now();
  // Giới hạn thời gian sử dụng vật phẩm trong vòng 60 giây kể từ khi thua
  if (now - snapshot.timestamp > 60000) {
    timeMachineCache.delete(userId); // Xoá cache đã quá hạn
    return { success: false, message: '⚠️ Đã quá thời hạn 60 giây để bạn kích hoạt Cỗ máy thời gian!' };
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    // Kiểm tra & tiêu thụ 1 vật phẩm 'time_machine'
    const inv = await Inventory.findOne({
      where: { userId, itemId: 'time_machine' },
      transaction,
      lock: true
    });

    if (!inv || inv.quantity <= 0) {
      await transaction.rollback();
      return { success: false, message: '⚠️ Bạn không sở hữu vật phẩm Time Machine để sử dụng!' };
    }

    inv.quantity -= 1;
    if (inv.quantity === 0) {
      await inv.destroy({ transaction });
    } else {
      await inv.save({ transaction });
    }

    // Tiến hành phục hồi lại số dư User
    const user = await User.findOne({ where: { discordId: userId }, transaction });
    const oldBalance = user.balance;
    user.balance = snapshot.balanceBeforeBet; // Khôi phục về số dư trước cược
    await user.save({ transaction });

    await transaction.commit();
    
    // Đã sử dụng thành công, xoá snapshot khỏi Cache bộ nhớ
    timeMachineCache.delete(userId);

    return {
      success: true,
      oldBalance,
      restoredBalance: user.balance,
      message: `⏳ Cỗ máy thời gian kích hoạt! Đã hồi phục ví của bạn từ **${oldBalance.toLocaleString()} chips** quay lại mức cũ **${user.balance.toLocaleString()} chips**.`
    };

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Lỗi triggerTimeMachine:', error);
    return { success: false, message: '❌ Lỗi hệ thống khi kích hoạt cỗ máy thời gian.' };
  }
}

/**
 * Kích hoạt Chance to Revert chủ động để có 30% cơ hội lấy lại 100% số tiền đã mất.
 * @param {string} userId - ID Discord của người dùng
 * @param {number} lostAmount - Số tiền chips thực tế đã bị mất đi ở ván thua vừa qua
 * @returns {Promise<{success: boolean, reverted: boolean, returnedAmount: number, newBalance: number, message: string}>}
 */
export async function triggerChanceToRevert(userId, lostAmount) {
  if (!lostAmount || lostAmount <= 0) {
    return { success: false, message: '⚠️ Số tiền thua không hợp lệ để thực hiện đảo ngược kết quả!' };
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    // Kiểm tra và trừ 1 vật phẩm 'chance_to_revert'
    const inv = await Inventory.findOne({
      where: { userId, itemId: 'chance_to_revert' },
      transaction,
      lock: true
    });

    if (!inv || inv.quantity <= 0) {
      await transaction.rollback();
      return { success: false, message: '⚠️ Bạn không có vật phẩm Chance to Revert trong kho đồ!' };
    }

    inv.quantity -= 1;
    if (inv.quantity === 0) {
      await inv.destroy({ transaction });
    } else {
      await inv.save({ transaction });
    }

    // Tỷ lệ ngẫu nhiên 30% thành công
    const isSuccess = Math.random() < 0.3;
    const user = await User.findOne({ where: { discordId: userId }, transaction });

    if (isSuccess) {
      // Thành công -> Cộng trả 100% số tiền đã thua cược
      user.balance += lostAmount;
      await user.save({ transaction });
      await transaction.commit();

      return {
        success: true,
        reverted: true,
        returnedAmount: lostAmount,
        newBalance: user.balance,
        message: `🔄 Đảo ngược kết quả THÀNH CÔNG! Thần may mắn mỉm cười, bạn nhận lại **+${lostAmount.toLocaleString()} chips**.`
      };
    } else {
      // Thất bại -> Mất vật phẩm mà không nhận lại tiền
      await transaction.commit();

      return {
        success: true,
        reverted: false,
        returnedAmount: 0,
        newBalance: user.balance,
        message: `🔄 Đảo ngược kết quả THẤT BẠI! Phép màu không xảy ra, bạn đã tốn 1 vật phẩm nhưng không được hoàn lại tiền.`
      };
    }

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Lỗi triggerChanceToRevert:', error);
    return { success: false, message: '❌ Lỗi hệ thống khi kích hoạt đảo ngược kết quả.' };
  }
}

/**
 * ============================================================================
 * 4. ĐIỂM KÍCH HOẠT: LỆNH ĐỘC LẬP (STANDALONE COMMANDS)
 * ============================================================================
 */

/**
 * Mở Hộp Quà Bí Ẩn (Mystery Box) nhận ngẫu nhiên 1 trong 7 vật phẩm còn lại.
 * @param {string} userId - ID Discord của người dùng
 * @returns {Promise<{success: boolean, rewardItem: object, message: string}>}
 */
export async function openMysteryBox(userId) {
  let transaction;
  try {
    transaction = await sequelize.transaction();

    // Kiểm tra & trừ 1 Hộp quà 'mystery_box' của người chơi
    const boxInv = await Inventory.findOne({
      where: { userId, itemId: 'mystery_box' },
      transaction,
      lock: true
    });

    if (!boxInv || boxInv.quantity <= 0) {
      await transaction.rollback();
      return { success: false, message: '⚠️ Bạn không sở hữu Mystery Box trong Kho đồ!' };
    }

    boxInv.quantity -= 1;
    if (boxInv.quantity === 0) {
      await boxInv.destroy({ transaction });
    } else {
      await boxInv.save({ transaction });
    }

    // Danh sách 7 vật phẩm còn lại để chọn ngẫu nhiên
    const pool = [
      'free_all_in', 
      'time_machine', 
      'increase_profit', 
      'loss_reduction', 
      'chance_to_revert', 
      'get_ticket', 
      'gun'
    ];
    const randomItemId = pool[Math.floor(Math.random() * pool.length)];
    const rewardItem = getItemById(randomItemId);

    // Thêm vật phẩm ngẫu nhiên nhận được vào kho đồ người chơi
    const [rewardInv, created] = await Inventory.findOrCreate({
      where: { userId, itemId: randomItemId },
      defaults: { quantity: 1 },
      transaction
    });

    if (!created) {
      rewardInv.quantity += 1;
      await rewardInv.save({ transaction });
    }

    await transaction.commit();

    return {
      success: true,
      rewardItem,
      message: `🎁 Mở hộp quà bí ẩn thành công! Bạn đã may mắn nhận được: **${rewardItem.emoji} ${rewardItem.name}**.`
    };

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Lỗi openMysteryBox:', error);
    return { success: false, message: '❌ Lỗi hệ thống khi mở Hộp quà bí ẩn.' };
  }
}

/**
 * Thực hiện phát bắn Súng (Gun) bắn hạ đối thủ, phạt chips của đối thủ và cộng hạn mức ngày cho bản thân.
 * @param {string} killerId - ID Discord của người bắn súng
 * @param {string} victimId - ID Discord của nạn nhân bị bắn
 * @returns {Promise<{success: boolean, lostAmount: number, addedQuota: number, newQuota: number, message: string}>}
 */
export async function executeGunShoot(killerId, victimId) {
  if (killerId === victimId) {
    return { success: false, message: '⚠️ Bạn không thể tự nổ súng bắn vào chính mình!' };
  }

  let transaction;
  try {
    transaction = await sequelize.transaction();

    // 1. Kiểm tra và trừ 1 khẩu Súng 'gun' trong Kho đồ của Killer
    const gunInv = await Inventory.findOne({
      where: { userId: killerId, itemId: 'gun' },
      transaction,
      lock: true
    });

    if (!gunInv || gunInv.quantity <= 0) {
      await transaction.rollback();
      return { success: false, message: '⚠️ Bạn phải sở hữu 🔫 Gun trong Kho đồ mới có thể bắn người khác!' };
    }

    gunInv.quantity -= 1;
    if (gunInv.quantity === 0) {
      await gunInv.destroy({ transaction });
    } else {
      await gunInv.save({ transaction });
    }

    // 2. Phạt nạn nhân (Victim): Trừ 500 chips từ số dư (balance), không cho phép số dư âm
    const [victim] = await User.findOrCreate({
      where: { discordId: victimId },
      defaults: { username: 'Victim', balance: 1000, quota: 0 },
      transaction
    });

    const lostAmount = Math.min(victim.balance, 500); // Trừ tối đa 500 hoặc toàn bộ số tiền còn lại của nạn nhân
    victim.balance -= lostAmount;
    await victim.save({ transaction });

    // 3. Thưởng cho thủ phạm (Killer): Cộng +33 điểm hạn mức ngày (quota)
    const [killer] = await User.findOrCreate({
      where: { discordId: killerId },
      defaults: { username: 'Killer', balance: 1000, quota: 0 },
      transaction
    });

    const oldQuota = killer.quota;
    // Tăng 33 điểm hạn mức ngày và khoá tối đa không vượt quá 100
    killer.quota = Math.min(killer.quota + 33, 100);
    const addedQuota = killer.quota - oldQuota;
    await killer.save({ transaction });

    await transaction.commit();

    return {
      success: true,
      lostAmount,
      addedQuota,
      newQuota: killer.quota,
      message: `🔫 Đoành! Bạn đã sử dụng Súng hạ gục đối thủ thành công!\n` +
               `- 🤕 Nạn nhân bị phạt mất **-${lostAmount.toLocaleString()} chips**.\n` +
               `- ⚡ Hạn mức ngày của bạn tăng **+${addedQuota} điểm** (Đạt: ${killer.quota}/100 quota).`
    };

  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Lỗi executeGunShoot:', error);
    return { success: false, message: '❌ Lỗi hệ thống khi thực hiện hành động bắn súng.' };
  }
}

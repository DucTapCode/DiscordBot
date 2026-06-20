import { User } from './database.js';

// Danh sách cấu hình tất cả vật phẩm trong Casino
export const items = [
  {
    id: 'free_all_in',
    name: 'Free All-In Coin',
    price: 1500,
    emoji: '🪙',
    description: 'Cho phép bạn cược Tất tay (All-In) mà không mất tiền thật nếu thua ván đó.'
  },
  {
    id: 'time_machine',
    name: 'Time Machine',
    price: 3000,
    emoji: '⏳',
    description: 'Quay ngược thời gian để hoàn tác kết quả của ván cược thua gần nhất.'
  },
  {
    id: 'increase_profit',
    name: 'Increase Profit',
    price: 1200,
    emoji: '📈',
    description: 'Tăng 25% tổng số tiền thưởng thu về nếu bạn chiến thắng ván cược tiếp theo.'
  },
  {
    id: 'loss_reduction',
    name: 'Loss Reduction',
    price: 800,
    emoji: '🛡️',
    description: 'Kích hoạt bảo hiểm giảm 50% số tiền tổn thất nếu không may thua ván cược tiếp theo.'
  },
  {
    id: 'chance_to_revert',
    name: 'Chance to Revert',
    price: 500,
    emoji: '🔄',
    description: 'Cung cấp 30% tỷ lệ lật ngược thế cờ biến kết quả ván cược từ Thua thành Thắng.'
  },
  {
    id: 'get_ticket',
    name: 'Get Ticket',
    price: 600,
    emoji: '🎟️',
    description: 'Đổi lấy 1 vé tham dự vòng quay may mắn Jackpot Casino tổ chức định kỳ.'
  },
  {
    id: 'mystery_box',
    name: 'Mystery Box',
    price: 400,
    emoji: '🎁',
    description: 'Hộp quà bí ẩn chứa cơ hội mở ra các vật phẩm hiếm hoặc số lượng chips ngẫu nhiên.'
  },
  {
    id: 'gun',
    name: 'Gun',
    price: 2000,
    emoji: '🔫',
    description: 'Tăng hạn mức (quota) số lần chơi casino trong ngày hôm nay thêm +5.'
  }
];

/**
 * Xử lý logic của vật phẩm Loss Reduction (Giảm tổn thất khi thua ván cược)
 * @param {number} betAmount - Số tiền người chơi đã đặt cược
 * @returns {number} Số tiền chips được bảo hiểm hoàn trả lại (50% tiền cược)
 */
export function applyLossReduction(betAmount) {
  if (!betAmount || betAmount <= 0) return 0;
  // Hoàn lại 50% số tiền cược (làm tròn xuống)
  return Math.floor(betAmount * 0.5);
}

/**
 * Xử lý sử dụng vật phẩm Súng (Gun) để tăng thêm quota hạn mức ngày chơi game
 * @param {string} discordId - ID Discord của người sử dụng vật phẩm
 * @returns {Promise<{success: boolean, addedQuota: number, newQuota: number, message: string}>} Kết quả xử lý
 */
export async function useGun(discordId) {
  // Tìm hoặc khởi tạo thông tin người dùng trong DB
  const [user] = await User.findOrCreate({
    where: { discordId },
    defaults: { username: 'Player', balance: 1000, quota: 0 }
  });

  const addedQuota = 5; // Tăng thêm 5 hạn mức chơi
  user.quota += addedQuota;
  
  // Lưu thay đổi hạn mức vào SQLite database
  await user.save();

  return {
    success: true,
    addedQuota,
    newQuota: user.quota,
    message: `Đã sử dụng 🔫 Gun thành công! Hạn mức ngày (quota) của bạn đã được cộng thêm +${addedQuota} (Hiện tại: ${user.quota}).`
  };
}

/**
 * Lấy thông tin chi tiết của vật phẩm dựa theo ID
 * @param {string} itemId - ID vật phẩm cần tìm
 * @returns {object|undefined} Trả về thông tin vật phẩm hoặc undefined nếu không tìm thấy
 */
export function getItemById(itemId) {
  return items.find(item => item.id === itemId);
}

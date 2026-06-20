import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Hiển thị danh sách các lệnh và hướng dẫn chơi game bài tây!");

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("📖 CASINO BOT HELP & HƯỚNG DẪN 📖")
    .setColor("#2b2d31")
    .setDescription("Chào mừng bạn đến với hệ thống Casino! Dưới đây là danh sách toàn bộ các lệnh và hướng dẫn cơ bản:")
    .addFields(
      {
        name: "💰 Lệnh Tài Khoản & Giao Dịch",
        value: 
          "`/balance` - Kiểm tra số dư chips hiện tại.\n" +
          "`/daily` - Nhận quà hàng ngày miễn phí (+1,000 chips mỗi 24h).\n" +
          "`/transfer <nguoi_nhan> <so_luong>` - Chuyển khoản chips cho người chơi khác.\n" +
          "`/leaderboard` - Xem bảng xếp hạng top 10 người chơi giàu nhất.",
        inline: false
      },
      {
        name: "🏪 Cửa Hàng & Túi Đồ",
        value:
          "`/shop` - Mở cửa hàng mua sắm vật phẩm đặc biệt.\n" +
          "`/inventory` - Xem các vật phẩm bạn đang sở hữu trong túi đồ.",
        inline: false
      },
      {
        name: "🔫 Lệnh Vật Phẩm Chủ Động (Sử dụng từ Kho đồ)",
        value:
          "`/gun <muc_tieu>` - Bắn đối thủ, phạt chips của nạn nhân và cộng quota chơi cho bạn.\n" +
          "`/timemachine` - Quay ngược thời gian phục hồi số dư ván thua (sử dụng trong vòng 60s sau khi thua).\n" +
          "`/revert` - Sử dụng Chance to Revert đảo ngược kết quả ván thua (tỷ lệ thành công 30%).\n" +
          "`/openbox` - Mở Mystery Box nhận ngẫu nhiên vật phẩm/chips.\n" +
          "`/freeallin` - Sử dụng Free All-In Coin để ván blackjack/tiến lên kế tiếp được cược tất tay miễn phí.",
        inline: false
      },
      {
        name: "🃏 Các Trò Chơi Bài Tây",
        value:
          "`/blackjack <cuoc>` - Chơi Blackjack đối đầu với nhà cái (Bot).\n" +
          "`/tienlen <cuoc>` - Tạo phòng chơi Tiến Lên Miền Nam cùng bạn bè (2-4 người).\n" +
          "`/poker` - Tạo phòng chơi Poker Texas Hold'em.\n" +
          "`/phom` - Tạo phòng chơi Phỏm (Tá Lả).",
        inline: false
      },
      {
        name: "🔰 Hướng Dẫn Cơ Bản",
        value:
          "**Blackjack**: Cố gắng rút bài sao cho tổng điểm gần 21 nhất và không được vượt quá 21 (Quắc). Nhấn *Hit* để rút bài, *Stand* để dừng rút bài so điểm.\n" +
          "**Tiến Lên Miền Nam**: Ai đánh hết 13 lá bài trên tay đầu tiên sẽ thắng và nhận trọn Pot tiền cược. Lượt đầu bắt buộc đánh kèm lá 3 Bích (3♠).\n" +
          "**Phỏm (Tá Lả)**: Ăn bài rác của người trước hoặc bốc bài từ Nọc để tạo Phỏm (3 lá cùng số hoặc sảnh cùng chất). Sau 4 vòng, hạ Phỏm, gửi bài và cộng điểm bài rác còn lại. Người ít điểm nhất thắng (Móm = 999đ, Ù = 0đ).\n" +
          "**Texas Hold'em Poker**: Kết hợp 2 lá bài tẩy trên tay và 5 lá bài chung trên bàn để tạo ra liên kết 5 lá mạnh nhất. Qua 4 vòng cược (Pre-flop, Flop, Turn, River), người chơi có bài mạnh nhất ở Showdown hoặc người duy nhất không Fold sẽ thắng Pot.",
        inline: false
      }
    )
    .setFooter({ text: "Chúc bạn có những giây phút giải trí vui vẻ!" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { User } from "../database.js";

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription("Nhận 1,000 chips miễn phí mỗi 24 giờ để làm vốn chơi casino!");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  const now = Date.now();
  const cooldownAmount = 24 * 60 * 60 * 1000; // Cooldown 24 giờ (mili giây)

  // Truy vấn tìm hoặc tạo mới bản ghi User tương ứng với discordId của người dùng
  const [user] = await User.findOrCreate({
    where: { discordId: userId },
    defaults: { username, balance: 1000, quota: 0, lastDaily: null }
  });

  // Kiểm tra thời gian cooldown nếu đã từng nhận quà daily
  if (user.lastDaily !== null) {
    const lastDailyTime = Number(user.lastDaily); // Chuyển đổi từ BIGINT về Number an toàn
    const expirationTime = lastDailyTime + cooldownAmount;

    if (now < expirationTime) {
      const timeLeftMs = expirationTime - now;
      const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.ceil((timeLeftMs % (1000 * 60)) / 1000);

      // Trả về thông báo lỗi ẩn danh (ephemeral) cho biết thời gian cần chờ đợi thêm
      return interaction.reply({
        content: `⚠️ Bạn đã nhận quà hôm nay rồi! Vui lòng quay lại sau **${hours} giờ ${minutes} phút ${seconds} giây** nữa.`,
        ephemeral: true
      });
    }
  }

  // Thực hiện cộng tiền và cập nhật timestamp nhận quà vào Database
  user.balance += 1000;
  user.lastDaily = now;
  await user.save(); // Lưu lại thay đổi vào SQLite DB

  // Tạo EmbedBuilder thông báo phần thưởng trực quan, sống động
  const embed = new EmbedBuilder()
    .setTitle("🎁 QUÀ TẶNG HÀNG NGÀY CASINO 🎁")
    .setColor("#2ecc71") // Màu xanh lá tươi tắn biểu trưng cho thắng lợi
    .setDescription(`Chúc mừng **${username}**! Bạn đã nhận quà thành công từ hệ thống Casino.`)
    .addFields(
      { name: "Phần quà nhận được", value: "**+1,000 chips** 🪙", inline: true },
      { name: "Số dư tài khoản mới", value: `**${user.balance.toLocaleString()} chips** 🪙`, inline: true }
    )
    .setFooter({ text: "Chúc bạn chơi game vui vẻ và thắng lớn hôm nay!" })
    .setTimestamp();

  // Phản hồi công khai cho cả Server cùng chúc mừng
  await interaction.reply({ embeds: [embed] });
}


import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { triggerFreeAllIn, freeAllInCache } from "../itemActivation.js";

export const data = new SlashCommandBuilder()
  .setName("freeallin")
  .setDescription("Kích hoạt 🪙 Free All-In Coin chuẩn bị cược Tất tay miễn phí cho ván tiếp theo!");

export async function execute(interaction) {
  const userId = interaction.user.id;

  // Gọi triggerFreeAllIn để tiêu thụ vật phẩm
  const result = await triggerFreeAllIn(userId, 0);

  if (!result.success) {
    return interaction.reply({
      content: result.message,
      ephemeral: true
    });
  }

  // Lưu trạng thái Free All-In vào Cache cho ván tiếp theo
  freeAllInCache.set(userId, {
    betAmount: result.betAmount,
    active: true
  });

  const embed = new EmbedBuilder()
    .setTitle("🪙 ĐÃ KÍCH HOẠT FREE ALL-IN COIN 🪙")
    .setColor("#f1c40f")
    .setDescription(
      `${result.message}\n\n` +
      `👉 Ván Blackjack hoặc Tiến Lên tiếp theo của bạn sẽ tự động là ván cược Tất tay miễn phí với **${result.betAmount.toLocaleString()} chips**.`
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

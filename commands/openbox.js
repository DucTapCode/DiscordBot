import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { openMysteryBox } from "../itemActivation.js";

export const data = new SlashCommandBuilder()
  .setName("openbox")
  .setDescription("Mở 🎁 Mystery Box để nhận ngẫu nhiên một vật phẩm hiếm hoặc chips!");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const result = await openMysteryBox(userId);

  if (!result.success) {
    return interaction.reply({
      content: result.message,
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🎁 MỞ HỘP QUÀ BÍ ẨN 🎁")
    .setColor("#e67e22")
    .setDescription(result.message)
    .setTimestamp();

  if (result.rewardItem) {
    embed.addFields({
      name: "Phần thưởng nhận được",
      value: `**${result.rewardItem.emoji} ${result.rewardItem.name}**\n> *${result.rewardItem.description}*`,
      inline: false
    });
  }

  return interaction.reply({ embeds: [embed] });
}

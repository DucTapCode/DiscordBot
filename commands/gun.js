import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { executeGunShoot } from "../itemActivation.js";

export const data = new SlashCommandBuilder()
  .setName("gun")
  .setDescription("Kích hoạt 🔫 Gun để bắn hạ đối thủ, phạt chips của họ và cộng quota cho bản thân!")
  .addUserOption(option =>
    option.setName("muc_tieu")
      .setDescription("Người chơi bạn muốn bắn")
      .setRequired(true)
  );

export async function execute(interaction) {
  const killerId = interaction.user.id;
  const victimUser = interaction.options.getUser("muc_tieu");
  const victimId = victimUser.id;

  if (killerId === victimId) {
    return interaction.reply({
      content: "⚠️ Bạn không thể tự nổ súng bắn vào chính mình!",
      ephemeral: true
    });
  }

  const result = await executeGunShoot(killerId, victimId);

  if (!result.success) {
    return interaction.reply({
      content: result.message,
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🔫 TIẾNG SÚNG VANG LÊN! 🔫")
    .setColor("#e74c3c")
    .setDescription(result.message)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

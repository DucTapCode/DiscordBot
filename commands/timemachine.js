import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { triggerTimeMachine } from "../itemActivation.js";

export const data = new SlashCommandBuilder()
  .setName("timemachine")
  .setDescription("Kích hoạt ⏳ Time Machine để khôi phục số dư tài khoản của ván thua gần nhất (trong vòng 60s)!");

export async function execute(interaction) {
  const userId = interaction.user.id;
  const result = await triggerTimeMachine(userId);

  if (!result.success) {
    return interaction.reply({
      content: result.message,
      ephemeral: true
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("⏳ CỖ MÁY THỜI GIAN KÍCH HOẠT! ⏳")
    .setColor("#3498db")
    .setDescription(result.message)
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

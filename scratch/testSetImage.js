import { EmbedBuilder } from "discord.js";

try {
  const embed = new EmbedBuilder().setTitle("Test").setImage(null);
  console.log("setImage(null) success:", embed.data.image);
} catch (e) {
  console.error("setImage(null) failed:", e);
}

try {
  const embed = new EmbedBuilder().setTitle("Test").setImage(undefined);
  console.log("setImage(undefined) success:", embed.data.image);
} catch (e) {
  console.error("setImage(undefined) failed:", e);
}

import { 
  ALL_CHARACTERS, 
  PRESETS, 
  GIF_COLLECTION, 
  getRandomGif, 
  setPreset, 
  updateCardCount,
  sendNightEmbedSample,
  sendDayEmbedSample,
  sendVoteEmbedSample 
} from "../werewolfLogic.js";

console.log("=== BẮT ĐẦU CHẠY UNIT TEST CHO MA SÓI CORE LOGIC MỞ RỘNG ===");

// 1. Kiểm tra số lượng nhân vật định nghĩa
const charKeys = Object.keys(ALL_CHARACTERS);
console.log(`Số lượng nhân vật đã khai báo: ${charKeys.length} / 80`);
if (charKeys.length === 80) {
  console.log("✅ Đã khai báo chính xác và đầy đủ 80 nhân vật!");
} else {
  console.error("❌ Thiếu nhân vật! Vui lòng kiểm tra lại danh sách.");
}

// 2. Kiểm tra presets
console.log("Kiểm tra các presets:");
console.log("- basic:", PRESETS.basic);
console.log("- chaos:", PRESETS.chaos);
console.log("- advanced:", PRESETS.advanced);

const mockGameState = {
  currentDeck: {}
};

// Test setPreset
setPreset(mockGameState, "basic");
console.log("Sau khi setPreset('basic'):", mockGameState.currentDeck);
if (Object.keys(mockGameState.currentDeck).length === Object.keys(PRESETS.basic).length) {
  console.log("✅ setPreset hoạt động hoàn hảo!");
} else {
  console.error("❌ Lỗi setPreset!");
}

// Test updateCardCount
updateCardCount(mockGameState, "Dân Thường", 5);
console.log("Sau khi updateCardCount('Dân Thường', 5):", mockGameState.currentDeck);
if (mockGameState.currentDeck["Dân Thường"] === 5) {
  console.log("✅ updateCardCount tăng/giảm hoạt động hoàn hảo!");
} else {
  console.error("❌ Lỗi updateCardCount!");
}

updateCardCount(mockGameState, "Dân Thường", 0);
console.log("Sau khi updateCardCount('Dân Thường', 0):", mockGameState.currentDeck);
if (mockGameState.currentDeck["Dân Thường"] === undefined) {
  console.log("✅ updateCardCount xóa lá khi số lượng <= 0 hoạt động hoàn hảo!");
} else {
  console.error("❌ Lỗi updateCardCount xóa lá!");
}

// 3. Kiểm tra getRandomGif
console.log("Kiểm tra getRandomGif cho các phase:");
const nightGif = getRandomGif("night");
const dayGif = getRandomGif("day");
const voteGif = getRandomGif("vote");

console.log("- Night phase GIF:", nightGif);
console.log("- Day phase GIF:", dayGif);
console.log("- Vote phase GIF:", voteGif);

if (nightGif === null && dayGif === null && voteGif === null) {
  console.log("✅ Lấy random GIF trả về null chính xác (đã bỏ mọi GIF)!");
} else {
  console.error("❌ Lỗi: getRandomGif không trả về null!");
}

// 4. Kiểm tra Embed samples
const nightEmbed = sendNightEmbedSample();
const dayEmbed = sendDayEmbedSample();
const voteEmbed = sendVoteEmbedSample();

console.log("Embed ban đêm có chứa image url không:", nightEmbed.data.image ? nightEmbed.data.image.url : "Không");
console.log("Embed ban ngày có chứa image url không:", dayEmbed.data.image ? dayEmbed.data.image.url : "Không");
console.log("Embed biểu quyết có chứa image url không:", voteEmbed.data.image ? voteEmbed.data.image.url : "Không");

if (!nightEmbed.data.image && !dayEmbed.data.image && !voteEmbed.data.image) {
  console.log("✅ Đã loại bỏ GIF thành công trong các Embed!");
} else {
  console.error("❌ Lỗi: Các Embed vẫn còn chứa image!");
}

console.log("=== KẾT THÚC TEST MA SÓI CORE ===");

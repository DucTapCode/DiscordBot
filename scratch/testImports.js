async function testImports() {
  console.log("=== KIỂM TRA IMPORT DỰ PHÒNG CÁC COMMANDS ===");
  try {
    const tl = await import("../commands/tienlen.js");
    console.log("✅ Import commands/tienlen.js THÀNH CÔNG!");
  } catch (err) {
    console.error("❌ Lỗi import commands/tienlen.js:", err);
  }

  try {
    const ph = await import("../commands/phom.js");
    console.log("✅ Import commands/phom.js THÀNH CÔNG!");
  } catch (err) {
    console.error("❌ Lỗi import commands/phom.js:", err);
  }

  try {
    const pk = await import("../commands/poker.js");
    console.log("✅ Import commands/poker.js THÀNH CÔNG!");
  } catch (err) {
    console.error("❌ Lỗi import commands/poker.js:", err);
  }

  try {
    const tk = await import("../commands/timkiem.js");
    console.log("✅ Import commands/timkiem.js THÀNH CÔNG!");
  } catch (err) {
    console.error("❌ Lỗi import commands/timkiem.js:", err);
  }
}

testImports();

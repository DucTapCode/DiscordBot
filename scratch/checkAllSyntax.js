async function checkSyntax() {
  const files = [
    '../commands/timkiem.js',
    '../commands/taixiu.js',
    '../commands/blackjack.js',
    '../commands/masoi.js',
    '../commands/tienlen.js',
    '../commands/phom.js',
    '../commands/poker.js'
  ];

  console.log("=== BẮT ĐẦU KIỂM TRA CÚ PHÁP CÁC FILE LỆNH ===");
  for (const file of files) {
    try {
      const module = await import(file);
      console.log(`✅ ${file}: Import thành công! (Command: ${module.data?.name || 'N/A'})`);
    } catch (e) {
      console.error(`❌ ${file}: Lỗi import!`, e);
    }
  }
  console.log("=== KẾT THÚC KIỂM TRA ===");
}
checkSyntax();

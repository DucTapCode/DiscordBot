/**
 * BỘ TÀI NGUYÊN GAME MA SÓI MỞ RỘNG (120 LÁ - 80 NHÂN VẬT)
 * Phát triển bổ sung tính năng quản lý bài (Deck) và hình ảnh (Embed Gif)
 */

import { EmbedBuilder } from "discord.js";

// ==========================================
// 1. ĐỊNH NGHĨA TOÀN BỘ 80 NHÂN VẬT (ALL_CHARACTERS)
// ==========================================
export const ALL_CHARACTERS = {
  // --- PHE DÂN LÀNG & CHỨC NĂNG (VILLAGERS) ---
  "Dân Thường": {
    id: 1,
    name: "Dân Thường",
    faction: "Villagers",
    description: "Không có chức năng ban đêm."
  },
  "Tiên Tri": {
    id: 2,
    name: "Tiên Tri",
    faction: "Villagers",
    description: "Mỗi đêm soi 1 người để biết thuộc phe Sói hay phe Dân."
  },
  "Bảo Vệ": {
    id: 3,
    name: "Bảo Vệ",
    faction: "Villagers",
    description: "Mỗi đêm bảo vệ 1 người không bị Sói cắn (không bảo vệ 1 người 2 đêm liên tiếp)."
  },
  "Thợ Săn": {
    id: 4,
    name: "Thợ Săn",
    faction: "Villagers",
    description: "Khi chết, được quyền bắn chết thêm 1 người bất kỳ."
  },
  "Phù Thủy": {
    id: 5,
    name: "Phù Thủy",
    faction: "Villagers",
    description: "Có 1 bình thuốc cứu người và 1 bình thuốc độc giết người."
  },
  "Cupid": {
    id: 6,
    name: "Cupid",
    faction: "Villagers",
    description: "Đêm đầu kết đôi 2 người. Nếu 1 người chết, người kia chết theo."
  },
  "Già Làng": {
    id: 7,
    name: "Già Làng",
    faction: "Villagers",
    description: "Có 2 mạng trước Sói. Nếu Già Làng bị treo cổ bởi dân, tất cả chức năng mất phép thuật."
  },
  "Thần Gấu": {
    id: 8,
    name: "Thần Gấu",
    faction: "Villagers",
    description: "Sáng ra nếu có Sói ngồi cạnh, Quản trò thông báo 'Gấu cảm thấy nguy hiểm'."
  },
  "Oan Nhân": {
    id: 9,
    name: "Oan Nhân",
    faction: "Villagers",
    description: "Bị vote chết khi huề phiếu sẽ chỉ định người lên giàn vào sáng hôm sau."
  },
  "Hiệp Sỹ": {
    id: 10,
    name: "Hiệp Sỹ",
    faction: "Villagers",
    description: "Nếu bị Sói cắn, con sói đầu tiên bên tay trái sẽ chết vào đêm kế tiếp."
  },
  "Cổ Hoặc Sư": {
    id: 11,
    name: "Cổ Hoặc Sư",
    faction: "Villagers",
    description: "Mỗi đêm chọn 1 người, nếu Cổ Hoặc Sư chết người đó chết thay."
  },
  "Bác Sỹ Điên": {
    id: 12,
    name: "Bác Sỹ Điên",
    faction: "Villagers",
    description: "Mỗi đêm chọn 2 người để hoán đổi hiệu ứng xúc tác (Sói-Dân, Sói-Chức năng...)."
  },
  "Ba Anh Em": {
    id: 13,
    name: "Ba Anh Em",
    faction: "Villagers",
    description: "Đêm đầu thức dậy nhìn mặt nhận diện nhau."
  },
  "Kẻ Ngốc": {
    id: 14,
    name: "Kẻ Ngốc",
    faction: "Villagers",
    description: "Nếu bị làng treo cổ sẽ lật bài lên và không chết, nhưng mất phiếu bầu."
  },
  "Cô Bé Ti Hí": {
    id: 15,
    name: "Cô Bé Ti Hí",
    faction: "Villagers",
    description: "Có thể hí mắt lúc Sói thức giấc, nhưng nếu bị Sói nhìn thấy sẽ chết ngay."
  },
  "Nguyệt Nữ": {
    id: 16,
    name: "Nguyệt Nữ",
    faction: "Villagers",
    description: "Mỗi đêm chọn 1 người để khóa kỹ năng ban đêm của họ."
  },
  "Dược Sỹ": {
    id: 17,
    name: "Dược Sỹ",
    faction: "Villagers",
    description: "Có 2 bình thuốc: Mê Hồn Dược (khóa mõm) và Hồi Phục Dược (hồi bình cứu cho Phù Thủy)."
  },
  "Thích Khách": {
    id: 18,
    name: "Thích Khách",
    faction: "Villagers",
    description: "Mỗi 2 đêm, nếu bị vote >= 4 phiếu ban ngày, được quyền chọn giết 1 người."
  },
  "Kỵ Sỹ": {
    id: 19,
    name: "Kỵ Sỹ",
    faction: "Villagers",
    description: "Ban ngày có thể lật bài chém 1 người. Nếu là Sói thì Sói chết, nếu là Dân thì Kỵ Sỹ chết."
  },
  "Ảnh Tử": {
    id: 20,
    name: "Ảnh Tử",
    faction: "Villagers",
    description: "Đêm đầu chọn 1 người, nếu người đó chết sẽ thừa kế chức năng của họ."
  },
  "Diễn Viên": {
    id: 21,
    name: "Diễn Viên",
    faction: "Villagers",
    description: "Chọn 1 trong 3 lá chức năng ngẫu nhiên bên ngoài để xài kỹ năng mỗi đêm."
  },
  "Con Bệnh": {
    id: 22,
    name: "Con Bệnh",
    faction: "Villagers",
    description: "If bị Sói cắn chết, đàn Sói sẽ bị mệt và mất lượt cắn vào đêm tiếp theo."
  },
  "Lực Sỹ": {
    id: 23,
    name: "Lực Sỹ",
    faction: "Villagers",
    description: "Bị Sói cắn vẫn sống ráng thêm được 1 ngày rồi mới chết."
  },
  "Thẩm Phán": {
    id: 24,
    name: "Thẩm Phán",
    faction: "Villagers",
    description: "Ra ám hiệu cho Quản trò để treo cổ liền 2 người trong ngày không cần thảo luận."
  },
  "Hoàng Tử": {
    id: 25,
    name: "Hoàng Tử",
    faction: "Villagers",
    description: "Nếu bị làng vote treo cổ, lật bài lên để được miễn tử nhưng bị lộ vai trò."
  },
  "Say Rượu": {
    id: 26,
    name: "Say Rượu",
    faction: "Villagers",
    description: "2 đêm đầu ngủ, đêm thứ 3 tỉnh dậy đổi vai với 1 lá bài dư bên ngoài."
  },
  "Thiên Thần": {
    id: 27,
    name: "Thiên Thần",
    faction: "Villagers",
    description: "Tìm cách để bị chết vào đêm đầu hoặc ngày đầu để thắng luôn."
  },
  "Con Quạ": {
    id: 28,
    name: "Con Quạ",
    faction: "Villagers",
    description: "Mỗi đêm ám 1 người, sáng hôm sau người đó mặc định bị +2 phiếu vote."
  },
  "Tiên Tri Tập Sự": {
    id: 29,
    name: "Tiên Tri Tập Sự",
    faction: "Villagers",
    description: "Khi Tiên Tri chính chết, bạn này sẽ kế thừa năng lực soi bài."
  },
  "Tiên Tri Thối": {
    id: 30,
    name: "Tiên Tri Thối",
    faction: "Villagers",
    description: "Mỗi đêm soi 1 người xem họ là Dân thường hay người có chức năng."
  },
  "Bà Da Đen": {
    id: 31,
    name: "Bà Da Đen",
    faction: "Villagers",
    description: "Mỗi đêm chọn 1 người đuổi khỏi làng vào sáng hôm sau (không được vote/bị vote)."
  },
  "Ông Già": {
    id: 32,
    name: "Ông Già",
    faction: "Villagers",
    description: "Sẽ tự lăn đùng ra chết vào đêm bằng số lượng Sói ban đầu cộng 1."
  },
  "Người Yêu Hòa Bình": {
    id: 33,
    name: "Người Yêu Hòa Bình",
    faction: "Villagers",
    description: "Luôn luôn bắt buộc phải bỏ phiếu 'Cứu' khi có người lên giàn."
  },
  "Hồn Ma": {
    id: 34,
    name: "Hồn Ma",
    faction: "Villagers",
    description: "Chết đêm đầu, mỗi đêm được viết 1 lời nhắn gửi ẩn danh cho làng vào sáng hôm sau."
  },
  "Thầy Đồng": {
    id: 35,
    name: "Thầy Đồng",
    faction: "Villagers",
    description: "Mỗi đêm có thể gọi hồn 1 người đã chết dậy để hỏi chuyện công khai."
  },
  "Trưởng Làng": {
    id: 36,
    name: "Trưởng Làng",
    faction: "Villagers",
    description: "Phiếu vote của Trưởng Làng tính là 2 phiếu khi biểu quyết ban ngày."
  },
  "Cậu Bé Tội Nghiệp": {
    id: 37,
    name: "Cậu Bé Tội Nghiệp",
    faction: "Villagers",
    description: "Nếu Trưởng Làng chết, Cậu Bé sẽ lên thay làm Trưởng Làng mới."
  },
  "Cáo": {
    id: 38,
    name: "Cáo",
    faction: "Villagers",
    description: "Mỗi đêm chọn 3 người ngồi cạnh nhau, nếu có ít nhất 1 Sói, Cáo được quyền soi tiếp đêm sau."
  },
  "Người Buôn Đồ Chơi": {
    id: 39,
    name: "Người Buôn Đồ Chơi",
    faction: "Villagers",
    description: "Mỗi đêm trao 1 món đồ chơi cho 1 người để kích hoạt hiệu ứng đặc biệt."
  },
  "Kiếm Sĩ": {
    id: 40,
    name: "Kiếm Sĩ",
    faction: "Villagers",
    description: "Mỗi đêm chọn thách đấu 1 người, nếu đấu trúng Sói thì Kiếm Sĩ thắng, trúng Dân thì tự thương tổn."
  },
  "Chị Em Sinh Đôi": {
    id: 41,
    name: "Chị Em Sinh Đôi",
    faction: "Villagers",
    description: "Đêm đầu thức dậy nhận mặt nhau, một người chết người kia cũng chết theo."
  },
  "Người Thổi Sáo": {
    id: 42,
    name: "Người Thổi Sáo",
    faction: "Villagers",
    description: "Mỗi đêm thôi miên 2 người. Thắng khi tất cả người còn sống đều bị thôi miên."
  },
  "Kẻ Thu Thập": {
    id: 43,
    name: "Kẻ Thu Thập",
    faction: "Villagers",
    description: "Mỗi khi có người chết, Kẻ Thu Thập nhận thêm 1 thuộc tính/sức mạnh tích lũy."
  },
  "Người Gác Đêm": {
    id: 44,
    name: "Người Gác Đêm",
    faction: "Villagers",
    description: "Mỗi đêm đi tuần tra, nếu gặp Sói đi cắn người sẽ báo động cho làng."
  },
  "Kẻ Trộm": {
    id: 45,
    name: "Kẻ Trộm",
    faction: "Villagers",
    description: "Đêm đầu chọn hoán đổi lá bài của mình với 1 trong 2 lá bài dư ngoài cuộc chơi."
  },
  "Nhà Khảo Cổ": {
    id: 46,
    name: "Nhà Khảo Cổ",
    faction: "Villagers",
    description: "Mỗi đêm đi đào mộ người chết để tìm kiếm thông tin phe phái của họ."
  },
  "Cầu Nguyện Sư": {
    id: 47,
    name: "Cầu Nguyện Sư",
    faction: "Villagers",
    description: "Mỗi đêm cầu nguyện chúc phúc cho 1 người, giúp họ miễn nhiễm độc/cắn đêm đó."
  },
  "Người Thuốc Súng": {
    id: 48,
    name: "Người Thuốc Súng",
    faction: "Villagers",
    description: "Có thể đặt bom vào 1 người, bom nổ sẽ kéo theo những người xung quanh chết."
  },
  "Thợ May": {
    id: 49,
    name: "Thợ May",
    faction: "Villagers",
    description: "Thắng cuộc nếu sống sót đến cuối game cùng phe Dân mà không bị lộ vai trò."
  },
  "Người Loan Tin": {
    id: 50,
    name: "Người Loan Tin",
    faction: "Villagers",
    description: "Có quyền tương tác và thay đổi lá bài Sự Kiện New Moon của ngày tiếp theo."
  },
  "Cô Gái Digan": {
    id: 51,
    name: "Cô Gái Digan",
    faction: "Villagers",
    description: "Biết trước lá bài Sự Kiện New Moon sắp tới là gì để cảnh báo làng."
  },
  "Kẻ Thừa Kế": {
    id: 52,
    name: "Kẻ Thừa Kế",
    faction: "Villagers",
    description: "Chọn 1 người đêm đầu, nếu họ chết, Kẻ Thừa Kế nhận toàn bộ chức năng của họ."
  },

  // --- PHE MA SÓI (WEREWOLVES) ---
  "Sói Thường": {
    id: 53,
    name: "Sói Thường",
    faction: "Werewolves",
    description: "Đêm thức giấc cùng đàn sói để chọn 1 nạn nhân cắn chết."
  },
  "Sói Trùm": {
    id: 54,
    name: "Sói Trùm",
    faction: "Werewolves",
    description: "Khi có 1 con sói khác chết, Sói Trùm được thức dậy riêng cắn thêm 1 mạng nữa."
  },
  "Sói Quỷ": {
    id: 55,
    name: "Sói Quỷ",
    faction: "Werewolves",
    description: "Biến nạn nhân bị cắn thành Sói vĩnh viễn từ đêm tiếp theo thay vì giết chết họ."
  },
  "Sói Anh (Lang Huynh)": {
    id: 56,
    name: "Sói Anh (Lang Huynh)",
    faction: "Werewolves",
    description: "Biết mặt Sói Em, nếu chết sẽ khiến Sói Em nổi điên."
  },
  "Sói Em (Lang Đệ)": {
    id: 57,
    name: "Sói Em (Lang Đệ)",
    faction: "Werewolves",
    description: "Nếu Sói Anh chết, đêm sau Sói Em thức giấc riêng giết 1 người trả thù."
  },
  "Sói Trắng": {
    id: 58,
    name: "Sói Trắng",
    faction: "Werewolves",
    description: "Cứ 2 đêm 1 lần được thức riêng để cắn chết 1 con Sói khác. Muốn thắng đơn độc."
  },
  "Sói Lửa": {
    id: 59,
    name: "Sói Lửa",
    faction: "Werewolves",
    description: "Khi có đồng bọn chết, Sói Lửa đêm đến chọn khóa vĩnh viễn năng lực của 1 người."
  },
  "Sói Con": {
    id: 60,
    name: "Sói Con",
    faction: "Werewolves",
    description: "Nếu bị treo cổ hoặc chết, đêm sau đàn Sói nổi điên được cắn liền 2 người."
  },
  "Phản Bội": {
    id: 61,
    name: "Phản Bội",
    faction: "Werewolves",
    description: "Thân là Dân nhưng theo phe Sói, đêm đầu thức dậy biết mặt toàn bộ đàn Sói."
  },
  "Sói Tiên Tri": {
    id: 62,
    name: "Sói Tiên Tri",
    faction: "Werewolves",
    description: "Đêm đi cắn người với Sói, sau đó dậy riêng soi tìm Tiên Tri của làng."
  },
  "Lycan": {
    id: 63,
    name: "Lycan",
    faction: "Werewolves",
    description: "Ban đầu là Dân, nếu bị Tiên Tri soi trúng sẽ lập tiếp hóa Sói từ đêm hôm sau."
  },
  "Sói Mộng Mơ": {
    id: 64,
    name: "Sói Mộng Mơ",
    faction: "Werewolves",
    description: "Lượt Sói không được mở mắt, chỉ giơ tay nhận diện. Khi đàn Sói chết hết mới tỉnh giấc."
  },
  "Sói Lạc Bầy": {
    id: 65,
    name: "Sói Lạc Bầy",
    faction: "Werewolves",
    description: "Chọn 1 bạn đồng hành đêm đầu, bạn đồng hành chết thì Sói Lạc Bầy chết theo."
  },
  "Sói Đá": {
    id: 66,
    name: "Sói Đá",
    faction: "Werewolves",
    description: "Vẫn đi cắn chung, nhưng nếu là con Sói cuối cùng sống sót thì mất khả năng cắn người."
  },
  "Con Hoang": {
    id: 67,
    name: "Con Hoang",
    faction: "Werewolves",
    description: "Chọn 1 Hình Tượng, Hình Tượng còn sống thì mình là Dân, Hình Tượng chết mình hóa Sói."
  },
  "Sói Lai": {
    id: 68,
    name: "Sói Lai",
    faction: "Werewolves",
    description: "Đêm đầu tiên tự chọn phe cho mình (chọn theo Sói hoặc theo Dân)."
  },
  "Lời Nguyền": {
    id: 69,
    name: "Lời Nguyền",
    faction: "Werewolves",
    description: "Ban đầu là Dân, nếu bị Sói cắn trúng không chết mà chuyển hóa thành Sói luôn."
  },
  "Sói Giác Đấu": {
    id: 70,
    name: "Sói Giác Đấu",
    faction: "Werewolves",
    description: "Có thể thách đấu 1 người ban đêm, người thua cuộc sẽ bị loại khỏi trò chơi."
  },
  "Sói Thần Bí": {
    id: 71,
    name: "Sói Thần Bí",
    faction: "Werewolves",
    description: "Mỗi đêm có thể che giấu hành tung của 1 con Sói khỏi sự tìm kiếm của Tiên Tri/Gấu."
  },
  "Sói Thao Túng": {
    id: 72,
    name: "Sói Thao Túng",
    faction: "Werewolves",
    description: "Có thể thôi miên vote của 1 người ban ngày, bắt họ vote theo ý Sói."
  },

  // --- PHE THỨ 3 & CÁC VAI TRÒ ĐỘC LẬP (THIRD PARTY) ---
  "Vampire": {
    id: 73,
    name: "Vampire",
    faction: "Third Party",
    description: "Mỗi đêm cắn biến 1 người thành Vampire con. Khi Vampire gốc chết, tất cả con chết theo."
  },
  "Tà Đạo": {
    id: 74,
    name: "Tà Đạo",
    faction: "Third Party",
    description: "Đêm đầu chọn 2 người. Nếu 2 người đó chết và Tà Đạo sống sót cô độc đến cuối thì thắng."
  },
  "Sói Cô Độc": {
    id: 75,
    name: "Sói Cô Độc",
    faction: "Third Party",
    description: "Thuộc phe Sói nhưng mục tiêu thắng là phải tiêu diệt cả Dân lẫn các con Sói khác."
  },
  "Kẻ Ám Sát": {
    id: 76,
    name: "Kẻ Ám Sát",
    faction: "Third Party",
    description: "Đêm đầu nhận danh sách 3 mục tiêu từ Quản trò, giết sạch 3 mục tiêu này sẽ thắng độc lập."
  },
  "Kẻ Phóng Hỏa": {
    id: 77,
    name: "Kẻ Phóng Hỏa",
    faction: "Third Party",
    description: "Mỗi đêm đi tẩm xăng vào nhà 1 người, có thể kích nổ thiêu rụi tất cả nhà đã tẩm xăng."
  },
  "Quái Vật Đầm Lầy": {
    id: 78,
    name: "Quái Vật Đầm Lầy",
    faction: "Third Party",
    description: "Sống sót qua đêm X sẽ thức tỉnh và bắt đầu đi nuốt chửng 1 người mỗi đêm."
  },
  "Kẻ Săn Tiền Thưởng": {
    id: 79,
    name: "Kẻ Săn Tiền Thưởng",
    faction: "Third Party",
    description: "Chọn 1 người làm mục tiêu, nếu người đó bị treo cổ ban ngày thì thắng cuộc."
  },
  "Bản Sao (Doppelganger)": {
    id: 80,
    name: "Bản Sao (Doppelganger)",
    faction: "Third Party",
    description: "Đêm đầu chọn nhìn bài 1 người, nếu họ chết sẽ lấy luôn chức năng và phe của họ."
  }
};

// ==========================================
// 2. KHAI BÁO PRESETS (CẤU HÌNH BỘ BÀI MẪU)
// ==========================================
// Cấu hình số lượng từng nhân vật ứng với số lượng người chơi
export const PRESETS = {
  // basic: Dành cho 8-10 người chơi
  "basic": {
    "Dân Thường": 3,
    "Tiên Tri": 1,
    "Bảo Vệ": 1,
    "Phù Thủy": 1,
    "Thợ Săn": 1,
    "Sói Thường": 2,
    "Sói Con": 1
  },
  // chaos: Dành cho 12-15 người chơi
  "chaos": {
    "Dân Thường": 3,
    "Tiên Tri": 1,
    "Bảo Vệ": 1,
    "Phù Thủy": 1,
    "Thợ Săn": 1,
    "Cupid": 1,
    "Già Làng": 1,
    "Kẻ Ngốc": 1,
    "Sói Thường": 2,
    "Sói Con": 1,
    "Sói Trùm": 1,
    "Phản Bội": 1
  },
  // advanced: Dành cho 15+ người chơi
  "advanced": {
    "Dân Thường": 4,
    "Tiên Tri": 1,
    "Bảo Vệ": 1,
    "Phù Thủy": 1,
    "Thợ Săn": 1,
    "Cupid": 1,
    "Già Làng": 1,
    "Thần Gấu": 1,
    "Hiệp Sỹ": 1,
    "Kẻ Ngốc": 1,
    "Sói Thường": 3,
    "Sói Trùm": 1,
    "Sói Con": 1,
    "Sói Trắng": 1,
    "Phản Bội": 1,
    "Vampire": 1,
    "Kẻ Phóng Hỏa": 1
  }
};

// ==========================================
// 3. KHO GIF ANIME PIXEL (GIF_COLLECTION) - ĐÃ BỎ HẾT ĐỂ KHÔNG HIỂN THỊ GIF TRONG CÂU TRẢ LỜI
// ==========================================
export const GIF_COLLECTION = {
  // Nhóm Tối (Dùng cho Ban Đêm - Night Phase)
  toi: [],
  // Nhóm Sáng (Dùng chung cho Ban Ngày và lúc Lên Giàn/Bỏ Phiếu - Day & Vote/Execution Phase)
  sang: []
};

// ==========================================
// 4. HÀM HELPER LẤY GIF NGẪU NHIÊN THEO GIAI ĐOẠN (phase)
// ==========================================
/**
 * Lấy ngẫu nhiên link ảnh GIF dựa trên phase hiện tại.
 * @param {string} phase - Giai đoạn hiện tại ('night', 'day', hoặc 'vote')
 * @returns {null} Trả về null để không hiển thị GIF theo yêu cầu
 */
export function getRandomGif(phase) {
  return null;
}

// ==========================================
// 5. CÁC HÀM CẬP NHẬT TRẠNG THÁI BÀI (DECK)
// ==========================================
/**
 * Chọn nhanh preset và gán vào gameState.currentDeck.
 * @param {object} gameState - Trạng thái hiện tại của phòng game
 * @param {string} presetName - Tên preset muốn áp dụng ('basic', 'chaos', 'advanced')
 * @returns {object} Trạng thái deck sau khi cập nhật
 */
export function setPreset(gameState, presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Không tìm thấy preset mẫu nào có tên là: ${presetName}`);
  }
  // Gán đè cấu hình preset mẫu vào currentDeck
  gameState.currentDeck = { ...preset };
  return gameState.currentDeck;
}

/**
 * Cập nhật thủ công số lượng của một lá bài trong gameState.currentDeck.
 * @param {object} gameState - Trạng thái hiện tại của phòng game
 * @param {string} cardName - Tên nhân vật cần thay đổi số lượng
 * @param {number} amount - Số lượng mới (nếu <= 0 sẽ tự động xóa khỏi deck)
 * @returns {object} Trạng thái deck sau khi cập nhật
 */
export function updateCardCount(gameState, cardName, amount) {
  // Chuẩn hóa nếu currentDeck chưa được khởi tạo
  if (!gameState.currentDeck) {
    gameState.currentDeck = {};
  }

  // Kiểm tra tính hợp lệ của tên nhân vật trong danh sách tổng
  if (!ALL_CHARACTERS[cardName]) {
    throw new Error(`Nhân vật '${cardName}' không tồn tại trong danh sách 80 nhân vật.`);
  }

  if (amount <= 0) {
    delete gameState.currentDeck[cardName];
  } else {
    gameState.currentDeck[cardName] = amount;
  }
  return gameState.currentDeck;
}

// ==========================================
// 6. PHƯƠNG THỨC MẪU CẬP NHẬT EMBED (SỬ DỤNG CHO D.JS EMBEDBUILDER)
// ==========================================
/**
 * Dưới đây là các ví dụ minh họa cách tích hợp getRandomGif(phase) vào các hàm 
 * gửi tin nhắn chuyển phase trong hệ thống bot Ma Sói của bạn.
 * Bạn có thể chèn trực tiếp dòng `.setImage(getRandomGif('...'))` vào code của mình.
 */

// Ví dụ cho hàm sendNightEmbed
export function sendNightEmbedSample(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🌑 ĐÊM THỨ 2")
    .setDescription("Trò chơi đã bắt đầu! Màn đêm buông xuống, dân làng chìm vào giấc ngủ...\nHãy nhấn nút bên dưới để xem vai trò và thực hiện chức năng của mình trong đêm nay.")
    .setColor("#2f3136")
    // Ép tỉ lệ 16:9 bằng cách đặt ảnh lớn nằm dưới qua setImage
    .setImage(getRandomGif("night")) 
    .setFooter({ text: "Thời gian hành động: 90 giây" });

  return embed;
}

// Ví dụ cho hàm sendDayEmbed
export function sendDayEmbedSample(channel) {
  const embed = new EmbedBuilder()
    .setTitle("☀️ NGÀY THỨ 2 - THẢO LUẬN")
    .setDescription("Dân làng có 3 phút để thảo luận và đưa ra suy đoán của mình. Sau đó, chúng ta sẽ tiến hành bỏ phiếu.")
    .setColor("#f1c40f")
    // Chọn gif nhóm sáng và đưa vào setImage
    .setImage(getRandomGif("day"))
    .setFooter({ text: "Thời gian còn lại: 3 phút" });

  return embed;
}

// Ví dụ cho hàm sendVoteEmbed
export function sendVoteEmbedSample(channel) {
  const embed = new EmbedBuilder()
    .setTitle("🗳️ NGÀY THỨ 2 - BIỂU QUYẾT")
    .setDescription("Hãy đưa ra quyết định cuối cùng. Chọn người bạn nghi ngờ hoặc bỏ phiếu trắng.")
    .setColor("#e74c3c")
    // Chọn gif nhóm sáng (cho vote/execution) và đưa vào setImage
    .setImage(getRandomGif("vote"))
    .setFooter({ text: "Biểu quyết công khai" });

  return embed;
}

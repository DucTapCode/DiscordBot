import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

// Cache lưu trữ link_embed của các tập phim để tránh quá 100 ký tự customId
const urlCache = new Map();

// Tự động dọn dẹp cache định kỳ để tránh tràn RAM
setInterval(() => {
  if (urlCache.size > 500) {
    urlCache.clear();
  }
}, 15 * 60 * 1000); // 15 phút dọn 1 lần

// Helper lấy link ảnh tuyệt đối của phim
function getImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://img.ophim.tv/uploads/movies/${url}`;
}

export const data = new SlashCommandBuilder()
  .setName("timkiem")
  .setDescription("Tìm kiếm phim nhanh qua API OPhim!")
  .addStringOption(option =>
    option.setName("ten")
      .setDescription("Tên phim cần tìm")
      .setRequired(true)
  );

export async function execute(interaction) {
  const keyword = interaction.options.getString("ten").trim();

  if (keyword.length < 2) {
    return interaction.reply({ content: "⚠️ Từ khóa quá ngắn!", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: false });
  await searchAndShowResults(interaction, keyword, 1);
}

async function searchAndShowResults(interaction, keyword, page) {
  try {
    const limit = 5; // Hiển thị 5 kết quả mỗi trang cho giao diện gọn gàng
    let result = null;
    try {
      const searchUrl = `https://ophim17.cc/api/phim/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&page=${page}`;
      const res = await fetch(searchUrl);
      result = await res.json();
    } catch (e) {
      // Fallback qua API tìm kiếm của ophim1.com
      const searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}&limit=${limit}&page=${page}`;
      const res = await fetch(searchUrl);
      result = await res.json();
    }

    const items = result?.data?.items || [];
    const pagination = result?.data?.params?.pagination || {};
    const totalItems = pagination.totalItems || items.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;

    if (items.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle("❌ Không tìm thấy phim")
        .setDescription(`Không tìm thấy bộ phim nào khớp với từ khóa: **${keyword}** (Trang ${page}/${totalPages})`)
        .setColor("#E74C3C");
      return interaction.editReply({ embeds: [emptyEmbed], components: [] });
    }

    // Trường hợp chỉ có 1 kết quả duy nhất ở trang 1 -> Hiển thị thẳng chi tiết phim
    if (items.length === 1 && page === 1) {
      const slug = items[0].slug;
      await showMovieDetail(interaction, slug, 1, true);
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🎬 Kết quả tìm kiếm: ${keyword}`)
      .setDescription(`Hiển thị kết quả trang **${page}** / **${totalPages}** (Tổng số phim: **${totalItems}**):`)
      .setColor("#2ECC71");

    let desc = "";
    const movieButtons = [];
    items.forEach((item, index) => {
      const displayIndex = (page - 1) * limit + index + 1;
      desc += `**${displayIndex}**. **${item.name}** (${item.year || "N/A"}) - *${item.episode_current || "N/A"}*\n`;
      
      movieButtons.push(
        new ButtonBuilder()
          .setCustomId(`timkiem_movie_${item.slug}`)
          .setLabel(`${displayIndex}`)
          .setStyle(ButtonStyle.Success)
      );
    });
    
    embed.setDescription(`${embed.data.description}\n\n${desc}`);

    const movieRow = new ActionRowBuilder().addComponents(movieButtons);
    const components = [movieRow];

    // Chỉ thêm thanh chuyển trang nếu tổng số trang > 1
    if (totalPages > 1) {
      const paginationRow = new ActionRowBuilder();
      const truncatedKeyword = keyword.length > 70 ? keyword.slice(0, 70) : keyword;

      const prevButton = new ButtonBuilder()
        .setCustomId(`timkiem_pg_${page - 1}_${truncatedKeyword}`)
        .setLabel("⬅️ Trang trước")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page <= 1);

      const pageIndicator = new ButtonBuilder()
        .setCustomId(`timkiem_page_indicator`)
        .setLabel(`Trang ${page}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const nextButton = new ButtonBuilder()
        .setCustomId(`timkiem_pg_${page + 1}_${truncatedKeyword}`)
        .setLabel("Trang sau ➡️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages);

      paginationRow.addComponents(prevButton, pageIndicator, nextButton);
      components.push(paginationRow);
    }

    await interaction.editReply({
      embeds: [embed],
      components: components
    });

  } catch (error) {
    console.error("Lỗi tìm kiếm phim OPhim API:", error);
    await interaction.editReply({ content: "❌ Lỗi hệ thống khi tìm phim.", embeds: [], components: [] });
  }
}

// Xử lý nút bấm tương tác
export async function handleInteraction(interaction) {
  const customId = interaction.customId;

  // 1. Người chơi chuyển trang
  if (customId.startsWith("timkiem_pg_")) {
    const parts = customId.split("_");
    const page = parseInt(parts[2], 10);
    const keyword = parts.slice(3).join("_");
    await interaction.deferUpdate();
    await searchAndShowResults(interaction, keyword, page);
  }

  // 2. Người chơi chọn xem chi tiết phim
  else if (customId.startsWith("timkiem_movie_")) {
    const slug = customId.replace("timkiem_movie_", "");
    await interaction.deferReply({ ephemeral: false });
    await showMovieDetail(interaction, slug, 1, false);
  }

  // 3. Người chơi chuyển trang tập phim
  else if (customId.startsWith("timkiem_eppg_")) {
    const parts = customId.split("_");
    const page = parseInt(parts[2], 10);
    const slug = parts.slice(3).join("_");
    await interaction.deferUpdate();
    await showMovieDetail(interaction, slug, page, true);
  }

  // 4. Người chơi chọn tập phim để xem
  else if (customId.startsWith("timkiem_ep_")) {
    const epCacheKey = customId.replace("timkiem_ep_", "");
    const linkEmbed = urlCache.get(epCacheKey);

    if (!linkEmbed) {
      return interaction.reply({ content: "⚠️ Link đã hết hạn. Hãy tìm lại!", ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("▶️ Xem Phim Không Quảng Cáo")
        .setStyle(ButtonStyle.Link)
        .setURL(linkEmbed)
    );

    await interaction.reply({
      content: `🎉 Giải mã luồng phát thành công!`,
      components: [row],
      ephemeral: true
    }).catch(() => {});
  }
}

// Hàm hỗ trợ hiển thị chi tiết phim và danh sách tập phim (kết hợp các API TMDB)
async function showMovieDetail(interaction, slug, page = 1, isFirstEdit = false) {
  try {
    // Gọi đồng thời 4 Endpoint API để tối ưu hóa tốc độ tải dữ liệu
    const [detailRes, imgRes, peoplesRes, keywordsRes] = await Promise.all([
      // Chi tiết phim (ưu tiên ophim1.com để đồng bộ dữ liệu hình ảnh/diễn viên)
      fetch(`https://ophim1.com/v1/api/phim/${slug}`).then(r => r.json()).catch(() => null),
      // Ảnh TMDB (backdrops, posters)
      fetch(`https://ophim1.com/v1/api/phim/${slug}/images`).then(r => r.json()).catch(() => null),
      // Diễn viên & Đạo diễn
      fetch(`https://ophim1.com/v1/api/phim/${slug}/peoples`).then(r => r.json()).catch(() => null),
      // Từ khóa
      fetch(`https://ophim1.com/v1/api/phim/${slug}/keywords`).then(r => r.json()).catch(() => null)
    ]);

    // Fallback chi tiết phim sang ophim17.cc nếu ophim1.com gặp lỗi
    let detail = detailRes;
    if (!detail || (!detail.movie && !detail.data?.item)) {
      detail = await fetch(`https://ophim17.cc/api/phim/${slug}`).then(r => r.json()).catch(() => null);
    }

    // Map dữ liệu thống nhất giữa 2 cấu trúc API
    const movie = detail?.movie || detail?.data?.item;
    const servers = detail?.episodes || detail?.data?.item?.episodes || [];

    if (!movie) {
      const msg = "❌ Lỗi tải thông tin phim.";
      if (isFirstEdit) return interaction.editReply(msg);
      return interaction.followUp({ content: msg, ephemeral: true });
    }

    // --- 1. XỬ LÝ HÌNH ẢNH TMDB ---
    let backdropUrl = "";
    let posterUrl = "";

    if (imgRes && imgRes.data && imgRes.data.images) {
      const imagesList = imgRes.data.images;
      const backdrops = imagesList.filter(img => img.type === "backdrop") || [];
      const posters = imagesList.filter(img => img.type === "poster") || [];

      // Lấy ảnh backdrop ngang 16:9 đầu tiên làm banner chính
      if (backdrops.length > 0) {
        const bd = backdrops[0];
        backdropUrl = `${imgRes.data.image_sizes?.backdrop?.w780 || "https://image.tmdb.org/t/p/w780"}${bd.file_path}`;
      }
      // Lấy ảnh poster dọc đầu tiên làm thumbnail nhỏ
      if (posters.length > 0) {
        const pt = posters[0];
        posterUrl = `${imgRes.data.image_sizes?.poster?.w342 || "https://image.tmdb.org/t/p/w342"}${pt.file_path}`;
      }
    }

    // Fallback ảnh cơ bản nếu API TMDB không trả về hình ảnh
    if (!backdropUrl) {
      backdropUrl = getImageUrl(movie.thumb_url || movie.poster_url);
    }
    if (!posterUrl) {
      posterUrl = getImageUrl(movie.poster_url || movie.thumb_url);
    }

    // --- 2. XỬ LÝ DIỄN VIÊN & ĐẠO DIỄN TMDB ---
    let castText = "N/A";
    let crewText = "N/A";

    if (peoplesRes && peoplesRes.data && peoplesRes.data.peoples) {
      const peoples = peoplesRes.data.peoples;
      const casts = peoples.filter(p => p.known_for_department === "Acting");
      const crews = peoples.filter(p => p.known_for_department === "Directing" || p.known_for_department === "Production" || p.known_for_department === "Writing");

      if (casts.length > 0) {
        castText = casts.slice(0, 7).map(c => c.name).join(", ");
      }
      if (crews.length > 0) {
        const directors = crews.filter(p => p.known_for_department === "Directing");
        if (directors.length > 0) {
          crewText = directors.slice(0, 3).map(d => d.name).join(", ");
        } else {
          crewText = crews.slice(0, 3).map(c => c.name).join(", ");
        }
      }
    }

    // --- 3. XỬ LÝ TỪ KHÓA PHIM TMDB ---
    let keywordText = "";
    if (keywordsRes && keywordsRes.data && keywordsRes.data.keywords) {
      const kwList = keywordsRes.data.keywords;
      if (kwList.length > 0) {
        keywordText = kwList.slice(0, 5).map(k => k.name_vn || k.name).join(", ");
      }
    }

    // --- 4. XÂY DỰNG DISCORD EMBED ---
    const genres = movie.category?.map(c => c.name).join(", ") || "N/A";

    const embed = new EmbedBuilder()
      .setTitle(`🎬 ${movie.name}`)
      .setDescription(
        `• Tên gốc: **${movie.origin_name || "N/A"}**\n` +
        `• Năm phát hành: **${movie.year || "N/A"}**\n` +
        `• Trạng thái: **${movie.episode_current || "N/A"}**\n` +
        `• Chất lượng: **${movie.quality || "HD"}** | Ngôn ngữ: **${movie.lang || "Vietsub"}**\n` +
        `• Thể loại: **${genres}**\n` +
        `• Đạo diễn: **${crewText}**\n` +
        `• Diễn viên: **${castText}**\n` +
        (keywordText ? `• Từ khóa: *${keywordText}*\n` : "") +
        `🔗 Xem phim: [Xem tại OPhim](https://ophim17.cc/phim/${movie.slug})`
      )
      .setColor("#3498DB");

    if (backdropUrl) {
      embed.setImage(backdropUrl);
    }
    if (posterUrl && posterUrl !== backdropUrl) {
      embed.setThumbnail(posterUrl);
    }

    // Xử lý danh sách tập phim (mặc định lấy server đầu tiên)
    const rows = [];
    if (servers.length > 0 && servers[0].server_data?.length > 0) {
      const allEpisodes = servers[0].server_data;
      const episodesPerPage = 20; // Hiển thị tối đa 20 tập một trang
      const totalEpPages = Math.ceil(allEpisodes.length / episodesPerPage) || 1;
      
      // Đảm bảo trang hiện tại nằm trong phạm vi hợp lệ
      const currentEpPage = Math.max(1, Math.min(page, totalEpPages));
      
      const startIndex = (currentEpPage - 1) * episodesPerPage;
      const endIndex = startIndex + episodesPerPage;
      const displayEpisodes = allEpisodes.slice(startIndex, endIndex);

      for (let i = 0; i < displayEpisodes.length; i++) {
        if (i % 5 === 0) {
          rows.push(new ActionRowBuilder());
        }
        const ep = displayEpisodes[i];
        const epCacheKey = `e_${Math.random().toString(36).substring(2, 9)}`;
        urlCache.set(epCacheKey, ep.link_embed);

        rows[rows.length - 1].addComponents(
          new ButtonBuilder()
            .setCustomId(`timkiem_ep_${epCacheKey}`)
            .setLabel(`Tập ${ep.name}`)
            .setStyle(ButtonStyle.Primary)
        );
      }

      // Thanh chuyển trang tập phim nếu có nhiều hơn 1 trang tập
      if (totalEpPages > 1) {
        const paginationRow = new ActionRowBuilder();

        const prevEpBtn = new ButtonBuilder()
          .setCustomId(`timkiem_eppg_${currentEpPage - 1}_${slug}`)
          .setLabel("⬅️ Tập trước")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentEpPage <= 1);

        const epIndicator = new ButtonBuilder()
          .setCustomId(`timkiem_eppg_ind`)
          .setLabel(`Tập ${startIndex + 1} - ${Math.min(endIndex, allEpisodes.length)} / ${allEpisodes.length}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true);

        const nextEpBtn = new ButtonBuilder()
          .setCustomId(`timkiem_eppg_${currentEpPage + 1}_${slug}`)
          .setLabel("Tập sau ➡️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentEpPage >= totalEpPages);

        paginationRow.addComponents(prevEpBtn, epIndicator, nextEpBtn);
        rows.push(paginationRow);
      }
    }

    const payload = {
      embeds: [embed],
      components: rows
    };

    if (isFirstEdit) {
      await interaction.editReply(payload);
    } else {
      await interaction.followUp(payload);
    }

  } catch (error) {
    console.error("Lỗi showMovieDetail:", error);
    const msg = "❌ Lỗi tải chi tiết phim.";
    if (isFirstEdit) await interaction.editReply(msg);
    else await interaction.followUp({ content: msg, ephemeral: true });
  }
}


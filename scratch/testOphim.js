// Dùng fetch toàn cục có sẵn của Node.js >= 18

async function test() {
  try {
    const searchUrl = `https://ophim17.cc/api/phim/search?keyword=Naruto&limit=3`;
    console.log("Fetching search results...");
    const res = await fetch(searchUrl);
    const data = await res.json();
    console.log("Search result keys:", Object.keys(data));
    console.log("Search data items:", JSON.stringify(data.data?.items, null, 2));

    if (data.data?.items?.length > 0) {
      const firstSlug = data.data.items[0].slug;
      console.log(`\nFetching details for slug: ${firstSlug}...`);
      const detailUrl = `https://ophim17.cc/api/phim/${firstSlug}`;
      const resDetail = await fetch(detailUrl);
      const detailData = await resDetail.json();
      console.log("Detail data keys:", Object.keys(detailData));
      console.log("Movie info:", JSON.stringify(detailData.movie, null, 2));
      console.log("Episodes info (first 2):", JSON.stringify(detailData.episodes?.slice(0, 2), null, 2));
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();

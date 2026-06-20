async function test() {
  const urls = [
    "https://ophim17.cc/api/phim/search?keyword=Naruto&limit=3&page=1",
    "https://ophim17.cc/api/phim/search?keyword=Naruto&limit=3&page=2",
    "https://ophim1.com/v1/api/tim-kiem?keyword=Naruto&limit=3&page=1",
    "https://ophim1.com/v1/api/tim-kiem?keyword=Naruto&limit=3&page=2"
  ];

  for (const url of urls) {
    console.log(`\nFetching: ${url}`);
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log("Status:", data?.status);
      console.log("Pagination:", JSON.stringify(data?.data?.params?.pagination));
      console.log("Items length:", data?.data?.items?.length);
      if (data?.data?.items?.length > 0) {
        console.log("First item:", data.data.items[0].name, "-", data.data.items[0].slug);
      }
    } catch (e) {
      console.error("Failed to fetch:", e.message);
    }
  }
}

test();

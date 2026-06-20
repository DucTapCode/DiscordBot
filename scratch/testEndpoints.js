async function test() {
  try {
    const slug = 'spider-noir';
    const res = await fetch(`https://ophim1.com/v1/api/phim/${slug}`);
    const detail = await res.json();
    if (detail.data?.item?.episodes) {
      console.log("Episodes sample:");
      console.log(detail.data.item.episodes[0]);
    }
  } catch (e) {
    console.error("Test error:", e);
  }
}
test();

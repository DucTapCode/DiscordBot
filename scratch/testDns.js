import dns from 'dns/promises';

async function testDns() {
  const hosts = ['ophim17.cc', 'ophim1.com', 'google.com'];
  for (const host of hosts) {
    try {
      const addresses = await dns.resolve4(host);
      console.log(`${host} IPv4:`, addresses);
    } catch (e) {
      console.error(`Failed to resolve ${host}:`, e.message);
    }
  }
}
testDns();

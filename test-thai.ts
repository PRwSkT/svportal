import * as thai from 'thai-address-universal';
async function test() {
  console.log('Search:', (await thai.searchAddressBySubDistrict('บางรัก')).slice(0, 1));
}
test();

import * as thai from 'thai-address-universal';
async function test() {
  console.log('Districts in กรุงเทพมหานคร:', (await thai.getDistrictByProvince('กรุงเทพมหานคร')).length);
  console.log('SubDistricts in บางรัก:', (await thai.getSubDistrictByDistrict('บางรัก')).length);
  // Wait, does getSubDistrictByDistrict take 1 or 2 arguments?
  console.log('SubDistricts in บางรัก (2 args?):', (await thai.getSubDistrictByDistrict('กรุงเทพมหานคร', 'บางรัก')).length);
}
test();

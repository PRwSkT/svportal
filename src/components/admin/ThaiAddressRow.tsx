'use client';

import React, { useState } from 'react';
import { searchAddressBySubDistrict, searchAddressByDistrict, searchAddressByProvince, searchAddressByPostalCode } from 'thai-address-universal';

interface AddressData {
  sub_district?: string;
  district?: string;
  province?: string;
  zip_code?: string;
}

interface Props {
  address: any;
  onChange: (field: string, value: string) => void;
  onAddressSelect: (data: AddressData) => void;
}

export default function ThaiAddressRow({ address, onChange, onAddressSelect }: Props) {
  const [subDistricts, setSubDistricts] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<string[]>([]);

  // Generate unique ID for datalists so multiple rows don't clash
  const uniqueId = React.useId();

  const handleZipCodeChange = async (val: string) => {
    onChange('zip_code', val);
    if (val.length === 5) {
      try {
        const results = await searchAddressByPostalCode(val);
        if (results.length > 0) {
          const uProvs = [...new Set(results.map(r => r.province))];
          const uDists = [...new Set(results.map(r => r.district))];
          const uSubs = [...new Set(results.map(r => r.sub_district))];

          const updates: any = {};
          if (uProvs.length === 1) updates.province = uProvs[0];
          if (uDists.length === 1) updates.district = uDists[0];
          if (uSubs.length === 1) updates.sub_district = uSubs[0];

          if (Object.keys(updates).length > 0) {
            onAddressSelect(updates);
          }

          setSubDistricts(uSubs as string[]);
          setDistricts(uDists as string[]);
          setProvinces(uProvs as string[]);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Clear options if zip code is not complete
      setSubDistricts([]);
      setDistricts([]);
      setProvinces([]);
    }
  };

  const handleSubDistrictChange = async (val: string) => {
    onChange('sub_district', val);
    if (val.length >= 2 && address.zip_code?.length !== 5) {
      const results = await searchAddressBySubDistrict(val);
      const exactMatches = results.filter(r => r.sub_district === val);
      
      if (exactMatches.length === 1) {
        const match = exactMatches[0];
        onAddressSelect({
          district: match.district,
          province: match.province,
          zip_code: match.postal_code,
        });
      } else if (exactMatches.length > 1) {
        setDistricts([...new Set(exactMatches.map(r => r.district))] as string[]);
      } else {
        setSubDistricts([...new Set(results.map(r => r.sub_district))] as string[]);
      }
    }
  };

  const handleDistrictChange = async (val: string) => {
    onChange('district', val);
    if (val.length >= 2 && address.zip_code?.length !== 5) {
      const results = await searchAddressByDistrict(val);
      const exactMatches = results.filter(r => r.district === val);
      
      if (exactMatches.length === 1) {
        const match = exactMatches[0];
        onAddressSelect({
          province: match.province,
          zip_code: match.postal_code,
        });
      } else {
        setDistricts([...new Set(results.map(r => r.district))] as string[]);
      }
    }
  };

  const handleProvinceChange = async (val: string) => {
    onChange('province', val);
    if (val.length >= 2 && address.zip_code?.length !== 5) {
      const results = await searchAddressByProvince(val);
      setProvinces([...new Set(results.map(r => r.province))] as string[]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">รหัสไปรษณีย์</label>
        <input 
          type="text" 
          value={address.zip_code || ''} 
          onChange={e => handleZipCodeChange(e.target.value)}
          placeholder="กรอกรหัสไปรษณีย์ 5 หลัก"
          maxLength={5}
          className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-primary font-bold transition-all" 
        />
      </div>

      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">ตำบล / แขวง</label>
        {subDistricts.length > 1 && address.zip_code?.length === 5 ? (
          <select
            value={address.sub_district || ''}
            onChange={e => handleSubDistrictChange(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all appearance-none cursor-pointer"
          >
            <option value="">-- เลือกตำบล/แขวง --</option>
            {subDistricts.map(sd => (
              <option key={sd} value={sd}>{sd}</option>
            ))}
          </select>
        ) : (
          <>
            <input 
              type="text" 
              list={`sub_district-${uniqueId}`}
              value={address.sub_district || ''} 
              onChange={e => handleSubDistrictChange(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" 
            />
            <datalist id={`sub_district-${uniqueId}`}>
              {subDistricts.map(sd => <option key={sd} value={sd} />)}
            </datalist>
          </>
        )}
      </div>

      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">อำเภอ / เขต</label>
        {districts.length > 1 && address.zip_code?.length === 5 ? (
          <select
            value={address.district || ''}
            onChange={e => handleDistrictChange(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all appearance-none cursor-pointer"
          >
            <option value="">-- เลือกอำเภอ/เขต --</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        ) : (
          <>
            <input 
              type="text" 
              list={`district-${uniqueId}`}
              value={address.district || ''} 
              onChange={e => handleDistrictChange(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" 
            />
            <datalist id={`district-${uniqueId}`}>
              {districts.map(d => <option key={d} value={d} />)}
            </datalist>
          </>
        )}
      </div>

      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">จังหวัด</label>
        {provinces.length > 1 && address.zip_code?.length === 5 ? (
          <select
            value={address.province || ''}
            onChange={e => handleProvinceChange(e.target.value)}
            className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all appearance-none cursor-pointer"
          >
            <option value="">-- เลือกจังหวัด --</option>
            {provinces.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        ) : (
          <>
            <input 
              type="text" 
              list={`province-${uniqueId}`}
              value={address.province || ''} 
              onChange={e => handleProvinceChange(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" 
            />
            <datalist id={`province-${uniqueId}`}>
              {provinces.map(p => <option key={p} value={p} />)}
            </datalist>
          </>
        )}
      </div>
    </div>
  );
}

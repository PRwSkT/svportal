'use client';

import React, { useState, useEffect, useRef } from 'react';
import { searchAddressBySubDistrict, searchAddressByDistrict, searchAddressByProvince, searchAddressByPostalCode } from 'thai-address-universal';

interface AddressData {
  sub_district?: string;
  district?: string;
  province?: string;
  postal_code?: string;
  zip_code?: string;
}

interface Props {
  address: any;
  onChange: (field: string, value: string) => void;
  onAddressSelect: (data: AddressData) => void;
}

export default function ThaiAddressRow({ address, onChange, onAddressSelect }: Props) {
  const [suggestions, setSuggestions] = useState<AddressData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (query: string, field: 'sub_district' | 'district' | 'province' | 'zip_code') => {
    onChange(field, query);
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      let results: AddressData[] = [];
      if (field === 'sub_district') {
        results = await searchAddressBySubDistrict(query);
      } else if (field === 'district') {
        results = await searchAddressByDistrict(query);
      } else if (field === 'province') {
        results = await searchAddressByProvince(query);
      } else if (field === 'zip_code') {
        results = await searchAddressByPostalCode(query);
      }
      
      // De-duplicate results
      const uniqueResults = [];
      const seen = new Set();
      for (const item of results) {
        const key = `${item.sub_district}-${item.district}-${item.province}-${item.postal_code}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(item);
        }
      }

      setSuggestions(uniqueResults.slice(0, 5));
      setShowSuggestions(uniqueResults.length > 0);
    } catch (error) {
      console.error('Failed to search address', error);
    }
  };

  const handleSelect = (suggestion: AddressData) => {
    onAddressSelect({
      sub_district: suggestion.sub_district || '',
      district: suggestion.district || '',
      province: suggestion.province || '',
      zip_code: suggestion.postal_code || '' // Map back to zip_code
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="grid grid-cols-2 gap-6 relative" ref={wrapperRef}>
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">รหัสไปรษณีย์</label>
        <input 
          type="text" 
          value={address.zip_code || ''} 
          onChange={e => handleSearch(e.target.value, 'zip_code')}
          onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true) }}
          placeholder="กรอกรหัสไปรษณีย์..."
          className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-primary font-bold transition-all" 
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">ตำบล / แขวง</label>
        <input 
          type="text" 
          value={address.sub_district || ''} 
          onChange={e => handleSearch(e.target.value, 'sub_district')}
          onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true) }}
          className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" 
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">อำเภอ / เขต</label>
        <input 
          type="text" 
          value={address.district || ''} 
          onChange={e => handleSearch(e.target.value, 'district')}
          onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true) }}
          className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" 
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-semibold text-foreground/70 mb-2">จังหวัด</label>
        <input 
          type="text" 
          value={address.province || ''} 
          onChange={e => handleSearch(e.target.value, 'province')}
          onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true) }}
          className="w-full px-4 py-3 bg-surface border border-foreground/10 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground transition-all" 
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-surface border border-foreground/10 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-xl">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={i}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-6 py-4 hover:bg-primary/5 hover:text-primary transition-all border-b border-foreground/5 last:border-0 flex items-center justify-between"
            >
              <div>
                <span className="font-medium text-primary">{s.postal_code}</span>
                <span className="text-foreground/50 text-sm mx-3">|</span>
                <span className="font-medium">{s.sub_district}</span>
                <span className="text-foreground/50 text-sm mx-2">»</span>
                <span className="text-foreground/80">{s.district}</span>
                <span className="text-foreground/50 text-sm mx-2">»</span>
                <span className="text-foreground/80">{s.province}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

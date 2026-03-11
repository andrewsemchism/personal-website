'use client';

import { useState } from 'react';
import Link from 'next/link';

const KG_TO_LB = 2.20462;
const GAL_TO_L = 3.78541;

function format(val: number): string {
  if (isNaN(val) || !isFinite(val)) return '';
  return val.toFixed(4).replace(/\.?0+$/, '');
}

function Converter({
  labelA, unitA,
  labelB, unitB,
  valueA, valueB,
  onChangeA, onChangeB,
}: {
  labelA: string; unitA: string;
  labelB: string; unitB: string;
  valueA: string; valueB: string;
  onChangeA: (v: string) => void;
  onChangeB: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-[#fbfcff]/5 border border-[#7796cb]/30 rounded-xl p-4">
        <label className="block text-[#888e9e] font-sans text-xs mb-2 uppercase tracking-wider">
          {labelA}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[#7796cb] font-mono text-xl font-semibold">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={valueA}
            onChange={e => onChangeA(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-[#fbfcff] font-mono text-2xl font-semibold outline-none placeholder:text-[#888e9e]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[#888e9e] font-sans text-sm">{unitA}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#7796cb]/20" />
        <span className="text-[#7796cb] font-mono text-lg">⇅</span>
        <div className="flex-1 h-px bg-[#7796cb]/20" />
      </div>

      <div className="bg-[#fbfcff]/5 border border-[#7796cb]/30 rounded-xl p-4">
        <label className="block text-[#888e9e] font-sans text-xs mb-2 uppercase tracking-wider">
          {labelB}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[#7796cb] font-mono text-xl font-semibold">$</span>
          <input
            type="number"
            inputMode="decimal"
            value={valueB}
            onChange={e => onChangeB(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-[#fbfcff] font-mono text-2xl font-semibold outline-none placeholder:text-[#888e9e]/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[#888e9e] font-sans text-sm">{unitB}</span>
        </div>
      </div>
    </div>
  );
}

export default function PriceConverters() {
  const [kgInput, setKgInput] = useState('');
  const [lbInput, setLbInput] = useState('');
  const [lInput, setLInput] = useState('');
  const [galInput, setGalInput] = useState('');

  function handleKgChange(val: string) {
    setKgInput(val);
    const n = parseFloat(val);
    setLbInput(val === '' ? '' : !isNaN(n) ? format(n / KG_TO_LB) : '');
  }

  function handleLbChange(val: string) {
    setLbInput(val);
    const n = parseFloat(val);
    setKgInput(val === '' ? '' : !isNaN(n) ? format(n * KG_TO_LB) : '');
  }

  function handleLChange(val: string) {
    setLInput(val);
    const n = parseFloat(val);
    setGalInput(val === '' ? '' : !isNaN(n) ? format(n * GAL_TO_L) : '');
  }

  function handleGalChange(val: string) {
    setGalInput(val);
    const n = parseFloat(val);
    setLInput(val === '' ? '' : !isNaN(n) ? format(n / GAL_TO_L) : '');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-[#fbfcff] font-mono mb-10 text-center">Price Converters</h1>

        <div className="space-y-10">
          <div>
            <p className="text-[#888e9e] font-sans text-xs uppercase tracking-wider mb-4">Weight</p>
            <Converter
              labelA="Price per kilogram" unitA="/kg"
              labelB="Price per pound" unitB="/lb"
              valueA={kgInput} valueB={lbInput}
              onChangeA={handleKgChange} onChangeB={handleLbChange}
            />
          </div>

          <div className="h-px bg-[#fbfcff]/10" />

          <div>
            <p className="text-[#888e9e] font-sans text-xs uppercase tracking-wider mb-4">Volume</p>
            <Converter
              labelA="Price per litre" unitA="/L"
              labelB="Price per gallon" unitB="/gal"
              valueA={lInput} valueB={galInput}
              onChangeA={handleLChange} onChangeB={handleGalChange}
            />
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/vibes" className="text-[#888e9e] font-sans text-sm hover:text-[#fbfcff] no-underline transition-colors">
            ← Back to Vibes
          </Link>
        </div>
      </div>
    </div>
  );
}

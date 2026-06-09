import React, { createContext, useContext, useState, useEffect } from 'react';
import { SERVICES } from '../data/services';
import { COND_FUNCTIONS } from '../data/condFunctions';
import { fetchServicesFromSheets } from '../services/sheetsService';

const ServicesContext = createContext({
  services: SERVICES,
  loading: true,
  source: 'static',
});

/**
 * アプリ起動時に Google Sheets からサービスデータを取得し、
 * 全画面に提供する Context プロバイダー
 */
export function ServicesProvider({ children }) {
  const [services, setServices] = useState(SERVICES);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('static');

  useEffect(() => {
    fetchServicesFromSheets().then(sheetData => {
      if (sheetData && sheetData.length > 0) {
        // シートのデータに cond 関数を付与して静的データを上書き
        const merged = sheetData.map(s => ({
          ...s,
          cond: COND_FUNCTIONS[s.id] || (() => true),
        }));
        setServices(merged);
        setSource('sheets');
      } else {
        // 取得失敗またはシートが空 → 静的データをそのまま使用
        setSource('static');
      }
      setLoading(false);
    });
  }, []);

  return (
    <ServicesContext.Provider value={{ services, loading, source }}>
      {children}
    </ServicesContext.Provider>
  );
}

/** サービスデータとロード状態を取得するカスタムフック */
export function useServices() {
  return useContext(ServicesContext);
}

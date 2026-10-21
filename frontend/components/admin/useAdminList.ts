'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PAGE_SIZE } from '@/components/ui/Pager';
import { useI18n } from '@/lib/i18n';
import type { Paged } from '@/lib/types';


/** โหลดรายการแบบแบ่งหน้าจาก /api/admin/... พร้อมคำค้น (หน่วงพิมพ์ 300 ms) และตัวกรองเพิ่มเติม */
export function useAdminList<T>(path: string, extra: Record<string, string> = {}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const extraKey = JSON.stringify(extra);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [extraKey]);


  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), ...JSON.parse(extraKey) });
    if (debouncedQ) params.set('q', debouncedQ);
    api<Paged<T>>(`${path}?${params}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : t('admin.loadFail')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, page, debouncedQ, extraKey, reloadKey, t]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return { q, setQ, debouncedQ, page, setPage, data, loading, error, reload, totalPages };
}

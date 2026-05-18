import { useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useAppTranslation } from '../i18n/hooks/useAppTranslation';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  summary?: string;
  className?: string;
}

function clampPage(value: number, totalPages: number): number {
  const safeTotal = Math.max(1, totalPages || 1);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(safeTotal, Math.trunc(value)));
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  summary,
  className = '',
}: PaginationProps) {
  const { t } = useAppTranslation(['common']);
  const safeTotalPages = Math.max(1, totalPages || 1);
  const safePage = clampPage(page, safeTotalPages);
  const [draftPage, setDraftPage] = useState(String(safePage));

  useEffect(() => {
    setDraftPage(String(safePage));
  }, [safePage]);

  const goToPage = (nextPage: number) => {
    const clamped = clampPage(nextPage, safeTotalPages);
    setDraftPage(String(clamped));
    if (clamped !== safePage) {
      onPageChange(clamped);
    }
  };

  const applyDraft = () => {
    if (!draftPage) {
      setDraftPage(String(safePage));
      return;
    }
    const parsed = Number(draftPage);
    if (!Number.isFinite(parsed)) {
      setDraftPage(String(safePage));
      return;
    }
    goToPage(parsed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
      applyDraft();
    } else if (event.key === 'Escape') {
      setDraftPage(String(safePage));
      event.currentTarget.blur();
    }
  };

  const isFirstPage = safePage <= 1;
  const isLastPage = safePage >= safeTotalPages;

  return (
    <nav className={`pagination-control ${className}`.trim()} aria-label={t('pagination.page')}>
      {summary && <div className="pagination-summary">{summary}</div>}

      <div className="pagination-actions">
        <button
          type="button"
          className="btn-secondary pagination-button"
          onClick={() => goToPage(1)}
          disabled={isFirstPage}
          aria-label={t('pagination.first')}
          title={t('pagination.first')}
        >
          <span aria-hidden="true">«</span>
          <span className="pagination-button-label">{t('pagination.first')}</span>
        </button>

        <button
          type="button"
          className="btn-secondary pagination-button"
          onClick={() => goToPage(safePage - 1)}
          disabled={isFirstPage}
          aria-label={t('pagination.previous')}
          title={t('pagination.previous')}
        >
          <span aria-hidden="true">‹</span>
          <span className="pagination-button-label">{t('pagination.previous')}</span>
        </button>

        <div className="pagination-page-field" aria-label={t('pagination.totalPages', { totalPages: safeTotalPages })}>
          <span className="pagination-page-label">{t('pagination.page')}</span>
          <input
            className="pagination-page-input"
            value={draftPage}
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={t('pagination.page')}
            onChange={(event) => setDraftPage(event.target.value.replace(/\D/g, ''))}
            onBlur={applyDraft}
            onKeyDown={handleKeyDown}
          />
          <span className="pagination-total">/ {safeTotalPages}</span>
        </div>

        <button type="button" className="btn-secondary pagination-go" onMouseDown={(event) => event.preventDefault()} onClick={applyDraft}>
          {t('pagination.go')}
        </button>

        <button
          type="button"
          className="btn-secondary pagination-button"
          onClick={() => goToPage(safePage + 1)}
          disabled={isLastPage}
          aria-label={t('pagination.next')}
          title={t('pagination.next')}
        >
          <span className="pagination-button-label">{t('pagination.next')}</span>
          <span aria-hidden="true">›</span>
        </button>

        <button
          type="button"
          className="btn-secondary pagination-button"
          onClick={() => goToPage(safeTotalPages)}
          disabled={isLastPage}
          aria-label={t('pagination.last')}
          title={t('pagination.last')}
        >
          <span className="pagination-button-label">{t('pagination.last')}</span>
          <span aria-hidden="true">»</span>
        </button>
      </div>

      {typeof totalItems === 'number' && !summary && (
        <div className="pagination-summary">{t('pagination.totalItems', { total: totalItems })}</div>
      )}
    </nav>
  );
}

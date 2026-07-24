import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem 1.25rem',
      background: '#ffffff',
      borderTop: '1px solid #EDF2EF',
      borderBottomLeftRadius: '12px',
      borderBottomRightRadius: '12px',
      flexWrap: 'wrap',
      gap: '0.75rem'
    }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Showing <span style={{ fontWeight: 600 }}>{startItem}</span> to{' '}
        <span style={{ fontWeight: 600 }}>{endItem}</span> of{' '}
        <span style={{ fontWeight: 600 }}>{totalItems}</span> entries
      </div>
      
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          type="button"
        >
          <ChevronLeft size={14} />
        </button>
        
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} style={{ padding: '0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ...
              </span>
            );
          }
          
          const isCurrent = page === currentPage;
          return (
            <button
              key={`page-${page}`}
              className={isCurrent ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
                minWidth: '32px',
                height: '32px',
                backgroundColor: isCurrent ? 'var(--color-primary)' : '#ffffff',
                color: isCurrent ? '#ffffff' : 'var(--text-secondary)',
                borderColor: isCurrent ? 'var(--color-primary)' : 'var(--border-input)',
                fontWeight: isCurrent ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={() => onPageChange(page as number)}
              type="button"
            >
              {page}
            </button>
          );
        })}
        
        <button
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          type="button"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

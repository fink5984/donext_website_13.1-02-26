import React from "react";
import styles from "./Pagination.module.scss";
import LeftArrow from "@/app/icons/navLeft.svg";
import RightArrow from "@/app/icons/navRight.svg";

const Pagination = ({ totalPages, currentPage, onPageChange }) => {
  
  const renderPageNumbers = () => {
    if (totalPages <= 1) {
      return (
        <button
          className={`${styles.pageNumber} ${styles.active} small-button-2`}
          disabled
        >
          1
        </button>
      );
    }
    const pages = [];
    const maxPagesToShow = 3;
    const showRightEllipsis = currentPage < totalPages - maxPagesToShow;
    const showLeftEllipsis = currentPage > maxPagesToShow;

    if (showRightEllipsis) {
      pages.push(totalPages, "..."); // דף אחרון + שלוש נקודות
    } else {
      for (let i = totalPages; i >= Math.max(1, totalPages - (maxPagesToShow - 1)); i--) {
        pages.push(i);
      }
    }

    if (showLeftEllipsis) {
      for (
        let i = Math.min(totalPages, currentPage + 1);
        i >= Math.max(1, currentPage - 1);
        i--
      ) {
        if (!pages.includes(i)) pages.push(i);
      }
      pages.push("...", 1); // שלוש נקודות + דף ראשון
    } else {
      for (let i = Math.min(maxPagesToShow, totalPages); i >= 1; i--) {
        if (!pages.includes(i)) pages.push(i);
      }
    }

    return pages.map((page, index) =>
      typeof page === "number" ? (
        <button
          key={index}
          className={`${styles.pageNumber} ${
            currentPage === page ? `${styles.active} small-button-2` : ""
          }`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ) : (
        <span key={index} className={styles.ellipsis}>
          {page}
        </span>
      )
    );
  };

  return (
    <div className={`${styles.pagination} small-button-1`}>
      <button
        className={styles.arrow}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <LeftArrow />
      </button>
      {renderPageNumbers()}
      <button
        className={styles.arrow}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <RightArrow />
      </button>
    </div>
  );
};

export default Pagination;
